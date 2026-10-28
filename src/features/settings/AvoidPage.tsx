// 12-5 아는 분 피하기(D-200 ① · D-201 · 화면_요구사항 12-5 · 정책 P2-05a · 카피 14-7 · 12-Q).
//  ① 피할 회사(최대 5곳, 이름 입력 · 지우기) ② 피할 학교(최대 5곳, 설문과 같은 내장 학교 검색) ③ 지인 차단(CK11 · 주소록)
//  ④ 스위치 '내 이메일을 다른 분의 지인 비교에 쓰기'(처음 켜짐, 끄면 서버가 내 비교 키를 지움) + 아래 작은 글
//  · 바꾸면 바로 저장한다. 실패하면 되돌리고 '저장하지 못했어요.' · 5곳이 다 차면 입력 대신 한 줄
//  · 상대에게 흔적 0 · '몇 명을 피했는지' 숫자 0. 학교 검색어는 기기 밖으로 보내지 않는다(내장 목록)
//  · 0037: 한 곳씩 set_avoid_org(이름은 서버에서 해시로만, 목록 글은 이 기기). 서버 스위치 avoid_org 가 꺼져 있으면 회사 · 학교 줄은 '준비 중'(지인 차단 줄과 같은 모양)
//  · 3부-바(12-Q 새 9줄): 목록 아래 '이 기기에만 보관' 한 줄 · 서버 개수가 기기 목록보다 많으면 '다른 기기에서 넣은 n곳' 한 줄 ·
//    [모두 지우기](서버 개수 기준 하나라도 있을 때) → 확인창 → clear_avoid_orgs + 기기 목록 지움 → '모두 지웠어요.'
//  · 3부-바 지인 차단: 스위치 contact_block 꺼짐(또는 기기 연결 없음)이면 '준비 중' 그대로. 켜짐이면 시트(설명 · 이메일만 · CK11) →
//    [주소록 허용하기] → CK11 동의 기록(없으면) → 권한 → 기기에서 이메일 해시 → sync_contact_hashes(lib/contactSync) → 결과 한 줄(토스트)
//  · 3부-사(0039): 더하기가 org_key_missing(서버 비밀 키 아직 없음) · feature_off 로 막히면 되돌리고 '준비 중이에요' 한 줄(토스트) — 다시 시도 글 0. 빼기는 그대로 된다
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { CONSENT_LATER_ITEMS } from '@/content/consentContent';
import { COMMON, CONSENT } from '@/content/copy';
import { AVOID, AVOID_MAX, CONSENT_MANAGE, CONTACT_BLOCK, SETTINGS } from '@/content/settingsCopy';
import { schoolIndex } from '@/data/schools/schoolSearch';
import { LaterConsentLink } from '@/features/consent/LaterConsentLink';
import { localSchoolSearch } from '@/features/surveyV2/api';
import { orgKey } from '@/lib/avoidLocal';
import { runContactSync, type ContactSyncResult } from '@/lib/contactSync';
import type { ContactPorts } from '@/lib/contactsServices';
import type { AvoidOrgFailure, AvoidSettings, Outcome, SettingsApi } from '@/lib/settingsApi';
import { colors, space } from '@/theme/tokens';

import { GroupLabel, LoadState, NavRow, RowGroup, SubPage, SwitchRow } from './SettingsParts';
import { useLoad } from './useLoad';

type Api = Pick<SettingsApi, 'loadAvoid' | 'setAvoidCompany' | 'setAvoidSchool' | 'setShareEmail'> &
  Partial<Pick<SettingsApi, 'clearAvoidOrgs' | 'syncContacts' | 'loadConsents' | 'setOptional' | 'markContactPrompted'>>;

const schoolNameOf = (key: string, fallback: string): string => schoolIndex().byKey(key)?.name ?? fallback;
// CK11 체크 글 = 법무 동의문구 4-11 생성물(gen:legal) 그대로
export const CK11_LABEL: string | null = CONSENT_LATER_ITEMS.find((i) => i.code === 'CK11')?.label ?? null;

// 지인 차단 결과 → 한 줄(맞은 수 · 인원 숫자 0)
export function contactResultText(r: ContactSyncResult): string {
  if (r.ok) return r.kind === 'done' ? CONTACT_BLOCK.done : CONTACT_BLOCK.noContacts;
  switch (r.reason) {
    case 'denied':
      return CONTACT_BLOCK.denied;
    case 'blocked':
      return CONTACT_BLOCK.deniedForever;
    case 'unavailable':
      return CONTACT_BLOCK.accessOff;
    case 'partial':
      return CONTACT_BLOCK.partialFail;
    case 'network':
      return COMMON.offline;
    default:
      return AVOID.saveFailed; // 동의 저장 실패 · 스위치 꺼짐 · 동의 없음 · 하루 3번 · 모양 · 서버(NF5-19 저장 실패 글 재사용)
  }
}

export function AvoidPage({ api, onBack, onToast, contact }: { api: Api; onBack: () => void; onToast: (text: string) => void; contact?: () => ContactPorts }) {
  const read = useCallback(() => api.loadAvoid(), [api]);
  const { phase, data, setData, reload, alive } = useLoad<AvoidSettings>(read);
  const [company, setCompany] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [askClear, setAskClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);
  const [adding, setAdding] = useState(false); // [더하기] 점 셋(읽기 이름 AVOID.saving — 카피 20장 · D45 '저장 중 줄')

  const failText = (reason: string) => (reason === 'network' ? COMMON.offline : AVOID.saveFailed);

  // 한 곳씩 서버에 보낸다(0037 set_avoid_org). 화면은 먼저 바꾸고, 실패하면 되돌린다
  const saveOrgs = async (next: AvoidSettings, send: () => Promise<Outcome<AvoidOrgFailure>>) => {
    if (!data || busy.current) return false;
    busy.current = true;
    const before = data;
    setError(null);
    setData(next);
    const result = await send();
    busy.current = false;
    if (!alive.current) return false;
    if (!result.ok) {
      setData(before);
      if (result.reason === 'off') onToast(SETTINGS.verificationToast);
      else setError(failText(result.reason));
      return false;
    }
    onToast(CONSENT_MANAGE.saved);
    return true;
  };

  const addCompany = async () => {
    const name = company.trim();
    // 기호 · (주) 만 다른 이름은 서버에서 한 곳(0037 org_hash) — 이미 있는 줄로 본다. 기호뿐인 이름은 서버가 받지 않는다
    if (!data || busy.current || !orgKey(name) || data.companies.length >= AVOID_MAX || data.companies.some((c) => orgKey(c) === orgKey(name))) return;
    setAdding(true);
    const saved = await saveOrgs({ ...data, companies: [...data.companies, name] }, () => api.setAvoidCompany(name, true));
    if (!alive.current) return;
    setAdding(false);
    if (saved) setCompany('');
  };
  const removeCompany = (name: string) => data && void saveOrgs({ ...data, companies: data.companies.filter((c) => c !== name) }, () => api.setAvoidCompany(name, false));
  const addSchool = async (key: string, name: string) => {
    if (!data || data.schools.length >= AVOID_MAX || data.schools.some((s) => s.key === key)) return;
    const school = { key, name: schoolNameOf(key, name) };
    if (await saveOrgs({ ...data, schools: [...data.schools, school] }, () => api.setAvoidSchool(school, true))) setQuery('');
  };
  const removeSchool = (key: string) => {
    const hit = data?.schools.find((s) => s.key === key);
    if (!data || !hit) return;
    const school = { key, name: schoolNameOf(key, hit.name) };
    void saveOrgs({ ...data, schools: data.schools.filter((s) => s.key !== key) }, () => api.setAvoidSchool(school, false));
  };

  // [모두 지우기] 확인 → 서버 clear_avoid_orgs(서버 개수 0) + 이 기기 목록 지움(settingsApi)
  const clearAll = async () => {
    if (!data || !api.clearAvoidOrgs || clearing) return;
    setClearing(true);
    setError(null);
    const r = await api.clearAvoidOrgs();
    if (!alive.current) return;
    setClearing(false);
    setAskClear(false);
    if (!r.ok) {
      setError(r.reason === 'network' ? COMMON.offline : AVOID.clearFailed);
      return;
    }
    setData({ ...data, companies: [], schools: [], otherCount: 0 });
    onToast(AVOID.cleared);
  };

  const toggleShare = async () => {
    if (!data || busy.current) return;
    busy.current = true;
    const next = !data.shareEmail;
    setError(null);
    setData({ ...data, shareEmail: next });
    const result = await api.setShareEmail(next);
    busy.current = false;
    if (!alive.current) return;
    if (!result.ok) {
      setData((d) => (d ? { ...d, shareEmail: !next } : d));
      setError(failText(result.reason));
      return;
    }
    onToast(CONSENT_MANAGE.saved);
  };

  // 지인 차단(스위치 켜짐 + 기기 연결이 있을 때만 시트). 시트를 보인 시각은 서버에 한 번(5-16)
  const contactReady = !!data?.contactOn && !!contact && !!api.syncContacts && !!api.loadConsents && !!api.setOptional;
  const openContact = () => {
    setSheet(true);
    void api.markContactPrompted?.();
  };
  const allowContacts = async () => {
    if (!contact || !api.syncContacts || !api.loadConsents || !api.setOptional || syncing) return;
    setSyncing(true);
    const ports = contact();
    const r = await runContactSync({ ...ports, api: { syncContacts: api.syncContacts, loadConsents: api.loadConsents, setOptional: api.setOptional, markContactPrompted: api.markContactPrompted ?? (async () => ({ ok: true as const })) } });
    if (!alive.current) return;
    setSyncing(false);
    setSheet(false);
    onToast(contactResultText(r));
  };

  const hits = query.trim().length >= 2 ? localSchoolSearch(query, { courses: ['U', 'C', 'G'], limit: 5 }) : [];
  const anyOrg = !!data && data.companies.length + data.schools.length + data.otherCount > 0; // 서버 개수 기준

  return (
    <SubPage title={AVOID.title} onBack={onBack} testID="settings-avoid">
      {phase !== 'ready' || !data ? (
        <LoadState state={phase === 'ready' ? 'server' : phase} onRetry={reload} testID="settings-avoid" />
      ) : (
        <>
          <AppText variant="body" testID="settings-avoid-intro">
            {AVOID.intro}
          </AppText>

          {data.orgOn ? (
            <>
              <GroupLabel text={AVOID.companyTitle} testID="settings-avoid-company-title" />
              <RowGroup testID="settings-avoid-companies">
                {data.companies.map((name, i) => (
                  <View key={name} style={[styles.item, i > 0 && styles.line]} testID={`settings-avoid-company-${i}`}>
                    <AppText variant="body" style={styles.flex}>
                      {name}
                    </AppText>
                    <TextButton label={AVOID.remove} onPress={() => removeCompany(name)} testID={`settings-avoid-company-${i}-remove`} />
                  </View>
                ))}
              </RowGroup>
              {data.companies.length >= AVOID_MAX ? (
                <AppText variant="caption" testID="settings-avoid-company-full">
                  {AVOID.full}
                </AppText>
              ) : (
                <View style={styles.addRow}>
                  <View style={styles.flex}>
                    <TextField value={company} onChangeText={setCompany} placeholder={AVOID.companyPlaceholder} label={AVOID.companyTitle} returnKeyType="done" onSubmitEditing={() => void addCompany()} testID="settings-avoid-company-input" />
                  </View>
                  <Button label={AVOID.add} variant="secondary" inline disabled={company.trim() === ''} loading={adding} loadingLabel={AVOID.saving} onPress={() => void addCompany()} testID="settings-avoid-company-add" />
                </View>
              )}

              <GroupLabel text={AVOID.schoolTitle} testID="settings-avoid-school-title" />
              <RowGroup testID="settings-avoid-schools">
                {data.schools.map((s, i) => (
                  <View key={s.key} style={[styles.item, i > 0 && styles.line]} testID={`settings-avoid-school-${i}`}>
                    <AppText variant="body" style={styles.flex}>
                      {schoolNameOf(s.key, s.name)}
                    </AppText>
                    <TextButton label={AVOID.remove} onPress={() => removeSchool(s.key)} testID={`settings-avoid-school-${i}-remove`} />
                  </View>
                ))}
              </RowGroup>
              {data.schools.length >= AVOID_MAX ? (
                <AppText variant="caption" testID="settings-avoid-school-full">
                  {AVOID.full}
                </AppText>
              ) : (
                <>
                  <TextField value={query} onChangeText={setQuery} placeholder={AVOID.schoolPlaceholder} label={AVOID.schoolTitle} testID="settings-avoid-school-input" />
                  {hits.length > 0 ? (
                    <RowGroup testID="settings-avoid-school-hits">
                      {hits.map((h, i) => (
                        <NavRow key={h.school_key} label={h.name} last={i === hits.length - 1} onPress={() => void addSchool(h.school_key, h.name)} testID={`settings-avoid-school-hit-${i}`} />
                      ))}
                    </RowGroup>
                  ) : null}
                </>
              )}

              {/* 12-Q AVOID.localNote · otherDevice(n) · clearAll — 이름 원문은 이 기기에만(SecureStore), 서버는 알아볼 수 없게 바꾼 값 · 개수만 */}
              <AppText variant="caption" testID="settings-avoid-local-note">
                {AVOID.localNote}
              </AppText>
              {data.otherCount > 0 ? (
                <AppText variant="caption" testID="settings-avoid-other-device">
                  {AVOID.otherDevice(data.otherCount)}
                </AppText>
              ) : null}
              {anyOrg && api.clearAvoidOrgs ? <TextButton label={AVOID.clearAll} align="start" onPress={() => setAskClear(true)} testID="settings-avoid-clear-all" /> : null}
            </>
          ) : (
            // 서버 스위치 avoid_org 꺼짐(사전 오픈 시작 때 켬, K20 결정 2): 넣을 수 없으니 지인 차단 줄과 같은 '준비 중' 줄
            <RowGroup testID="settings-avoid-orgs-soon">
              <NavRow label={AVOID.companyTitle} right={SETTINGS.verificationSoon} onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-company-soon" />
              <NavRow label={AVOID.schoolTitle} right={SETTINGS.verificationSoon} last onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-school-soon" />
            </RowGroup>
          )}

          <RowGroup testID="settings-avoid-contacts">
            {/* 지인 차단: 스위치 contact_block 켜짐 + 기기 연결(주소록 · 해시)이 있으면 시트, 아니면 '준비 중'(인증 서류 줄과 같은 글) */}
            {contactReady ? (
              <NavRow label={AVOID.contactTitle} last onPress={openContact} testID="settings-avoid-contact" />
            ) : (
              <NavRow label={AVOID.contactTitle} right={SETTINGS.verificationSoon} last onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-contact" />
            )}
          </RowGroup>

          <RowGroup testID="settings-avoid-share">
            <SwitchRow label={AVOID.shareEmail} note={AVOID.shareEmailNote} on={data.shareEmail} last onPress={() => void toggleShare()} testID="settings-avoid-share-email" />
          </RowGroup>

          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="settings-avoid-error">
              {error}
            </AppText>
          ) : null}
        </>
      )}
      <ConfirmDialog
        visible={askClear}
        title={AVOID.clearConfirm.title}
        body={AVOID.clearConfirm.body}
        confirmLabel={AVOID.clearConfirm.confirm}
        cancelLabel={AVOID.clearConfirm.cancel}
        busy={clearing}
        onConfirm={() => void clearAll()}
        onCancel={() => setAskClear(false)}
        testID="settings-avoid-clear-confirm"
      />
      <BottomSheet visible={sheet} onClose={() => (syncing ? undefined : setSheet(false))} testID="settings-contact-sheet">
        <View style={styles.sheet}>
          <AppText variant="title" accessibilityRole="header" testID="settings-contact-sheet-title">
            {CONTACT_BLOCK.sheetTitle}
          </AppText>
          <AppText variant="body" testID="settings-contact-sheet-body">
            {CONTACT_BLOCK.sheetBody}
          </AppText>
          <AppText variant="caption" testID="settings-contact-email-only">
            {CONTACT_BLOCK.emailOnly}
          </AppText>
          {CK11_LABEL ? (
            <AppText variant="caption" tone="text" testID="settings-contact-ck11">
              {CK11_LABEL}
            </AppText>
          ) : null}
          {/* 카피 14-7 12-5: 체크 글 바로 아래 두 줄 · 늘 보임(법무 L21 11-2 c) */}
          <AppText variant="caption" testID="settings-contact-optional-note">
            {CONTACT_BLOCK.optionalNote}
          </AppText>
          <AppText variant="caption" testID="settings-contact-withdraw-note">
            {CONTACT_BLOCK.withdrawNote}
          </AppText>
          <LaterConsentLink code="CK11" label={CONSENT.more} testID="settings-contact-ck11-more" />
          {/* 버튼 둘은 같은 무게(NF5-04) */}
          <Button label={CONTACT_BLOCK.allow} variant="secondary" onPress={() => void allowContacts()} loading={syncing} testID="settings-contact-allow" />
          <Button label={CONTACT_BLOCK.later} variant="secondary" disabled={syncing} onPress={() => setSheet(false)} testID="settings-contact-later" />
        </View>
      </BottomSheet>
    </SubPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  line: { borderTopWidth: 1, borderTopColor: colors.line },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
  sheet: { gap: space.s12 },
});
