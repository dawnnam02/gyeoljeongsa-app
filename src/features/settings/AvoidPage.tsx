// 12-5 아는 분 피하기(D-200 ① · D-201 · 화면_요구사항 12-5 · 정책 P2-05a · 카피 14-7 · 12-Q).
//  ① 피할 회사(최대 5곳, 이름 입력 · 지우기) ② 피할 학교(최대 5곳, 설문과 같은 내장 학교 검색) ③ 지인 차단(CK11 · 주소록 — 준비 중 줄)
//  ④ 스위치 '내 이메일을 다른 분의 지인 비교에 쓰기'(처음 켜짐, 끄면 서버가 내 비교 키를 지움) + 아래 작은 글
//  · 바꾸면 바로 저장한다. 실패하면 되돌리고 '저장하지 못했어요.' · 5곳이 다 차면 입력 대신 한 줄
//  · 상대에게 흔적 0 · '몇 명을 피했는지' 숫자 0. 학교 검색어는 기기 밖으로 보내지 않는다(내장 목록)
//  · 0037: 한 곳씩 set_avoid_org(이름은 서버에서 해시로만, 목록 글은 이 기기). 서버 스위치 avoid_org 가 꺼져 있으면 회사 · 학교 줄은 '준비 중'(지인 차단 줄과 같은 모양)
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { COMMON } from '@/content/copy';
import { AVOID, AVOID_MAX, CONSENT_MANAGE, SETTINGS } from '@/content/settingsCopy';
import { schoolIndex } from '@/data/schools/schoolSearch';
import { localSchoolSearch } from '@/features/surveyV2/api';
import { orgKey } from '@/lib/avoidLocal';
import type { AvoidSettings, Outcome, SettingsApi } from '@/lib/settingsApi';
import { colors, space } from '@/theme/tokens';

import { GroupLabel, LoadState, NavRow, RowGroup, SubPage, SwitchRow } from './SettingsParts';
import { useLoad } from './useLoad';

type Api = Pick<SettingsApi, 'loadAvoid' | 'setAvoidCompany' | 'setAvoidSchool' | 'setShareEmail'>;

const schoolNameOf = (key: string, fallback: string): string => schoolIndex().byKey(key)?.name ?? fallback;

export function AvoidPage({ api, onBack, onToast }: { api: Api; onBack: () => void; onToast: (text: string) => void }) {
  const read = useCallback(() => api.loadAvoid(), [api]);
  const { phase, data, setData, reload, alive } = useLoad<AvoidSettings>(read);
  const [company, setCompany] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const failText = (reason: string) => (reason === 'network' ? COMMON.offline : AVOID.saveFailed);

  // 한 곳씩 서버에 보낸다(0037 set_avoid_org). 화면은 먼저 바꾸고, 실패하면 되돌린다
  const saveOrgs = async (next: AvoidSettings, send: () => Promise<Outcome>) => {
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
      setError(failText(result.reason));
      return false;
    }
    onToast(CONSENT_MANAGE.saved);
    return true;
  };

  const addCompany = async () => {
    const name = company.trim();
    // 기호 · (주) 만 다른 이름은 서버에서 한 곳(0037 org_hash) — 이미 있는 줄로 본다. 기호뿐인 이름은 서버가 받지 않는다
    if (!data || !orgKey(name) || data.companies.length >= AVOID_MAX || data.companies.some((c) => orgKey(c) === orgKey(name))) return;
    if (await saveOrgs({ ...data, companies: [...data.companies, name] }, () => api.setAvoidCompany(name, true))) setCompany('');
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

  const hits = query.trim().length >= 2 ? localSchoolSearch(query, { courses: ['U', 'C', 'G'], limit: 5 }) : [];

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
                  <Button label={AVOID.add} variant="secondary" inline disabled={company.trim() === ''} onPress={() => void addCompany()} testID="settings-avoid-company-add" />
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
            </>
          ) : (
            // 서버 스위치 avoid_org 꺼짐(사전 오픈 시작 때 켬, K20 결정 2): 넣을 수 없으니 지인 차단 줄과 같은 '준비 중' 줄
            <RowGroup testID="settings-avoid-orgs-soon">
              <NavRow label={AVOID.companyTitle} right={SETTINGS.verificationSoon} onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-company-soon" />
              <NavRow label={AVOID.schoolTitle} right={SETTINGS.verificationSoon} last onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-school-soon" />
            </RowGroup>
          )}

          <RowGroup testID="settings-avoid-contacts">
            {/* 지인 차단: CK11 시트(동의문구 4-11) → 주소록 비교. 서버 함수는 0037 이름으로 맞춤(settingsApi.syncContacts 등) · 주소록 모듈 · 기기 해시 전이라 '준비 중'(인증 서류 줄과 같은 글) */}
            <NavRow label={AVOID.contactTitle} right={SETTINGS.verificationSoon} last onPress={() => onToast(SETTINGS.verificationToast)} testID="settings-avoid-contact" />
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
    </SubPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  line: { borderTopWidth: 1, borderTopColor: colors.line },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
});
