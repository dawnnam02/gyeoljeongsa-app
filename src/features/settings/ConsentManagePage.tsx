// 12 › 동의 관리(Figma 12i 230:47 · 12j 230:120 · 12k 230:201, K2 12 '동의 관리 화면' · 동의문구 3-4 · 5-6 · 6장 · N25).
//  위 "선택 동의" 2줄: CK4 · CK9. 줄 이름 · 덧붙이는 안내는 03 글(consentContent.ts) 그대로. 스위치로 켜고 끈다
//    · CK4 끄기: 확인창(N25) → 철회(서버가 종교 3문항을 '답하지 않음'으로) → 토스트 N10
//    · CK4 켜기 · CK9 켜기/끄기: 확인창 없이 바로 기록 → 토스트 N10. CK9 는 알림 화면의 마케팅 알림과 같은 값
//  이어서 03 밖 선택 동의 CK11 ~ CK16 6줄(동의문구 5-6 ② · 1-1, L17A). 줄 이름 = 1-1 표 이름(CK16 은 4-16 제목 '글 쓰는 속도 분석')
//    · 켜져 있으면 끌 수 있다: 확인창(CONSENT_LATER) → revoke_consent(서버가 그 칸의 데이터를 지움 — CK15 정치 답 · CK16 행동 숫자)
//    · 켜기는 CK16 만(판 config/laterConsent.ts). CK11 ~ CK14 는 기능을 처음 쓸 때 · CK15 는 설문 정치 막대 앞에서 받으므로, 꺼져 있으면 '처음 쓸 때 따로 물어요.'(스위치 잠김)
//  아래 "동의한 내용" 7줄: 필수 칸. 스위치 없이 '보기 ›'로 03 과 같은 요약 · 전문 시트. 철회는 탈퇴로 안내(N25 필수 칸 안내)
//    + CK11 ~ CK16 6줄(4-11 ~ 4-16 요약 · 전문 보기, L17A · D-190)
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pressable } from '@/components/Pressable';
import { COMMON } from '@/content/copy';
import { CONSENT_ITEMS, CONSENT_LATER_ITEMS, CONSENT_LATER_NAMES } from '@/content/consentContent';
import { CONSENT_LATER, CONSENT_MANAGE } from '@/content/settingsCopy';
import type { ConsentItemContent, ConsentSheetContent, LaterConsentCode } from '@/content/types';
import { ConsentSummarySheet } from '@/features/consent/ConsentSummarySheet';
import type { OptionalCode, OptionalConsents, SettingsApi } from '@/lib/settingsApi';
import { alpha, colors, size, space } from '@/theme/tokens';

import { GroupLabel, LoadState, RowGroup, SubPage, SwitchRow } from './SettingsParts';
import { useLoad } from './useLoad';

const OPTIONAL: readonly OptionalCode[] = ['CK4', 'CK9'];
const itemOf = (code: string) => CONSENT_ITEMS.find((i) => i.code === code) as ConsentItemContent;
const REQUIRED_ITEMS = CONSENT_ITEMS.filter((i) => i.required);
// 03 밖 선택 동의: 줄 이름(CK16 은 동의문구 5-6 ② '글 쓰는 속도 분석' = 4-16 제목에서 [선택]을 뗀 것) · 여기서 켤 수 있는 칸
// 줄 머리(선택 표시)는 생성 파일의 체크 문구에서 뗀다(법무 글을 화면 코드에 옮겨 적지 않는다, staticRules F1)
const OPTIONAL_TAG = /^\[[^\]]+\] /.exec(CONSENT_LATER_ITEMS[0]?.label ?? '')?.[0] ?? '';
const CK16_ROW = (CONSENT_LATER_ITEMS.find((i) => i.code === 'CK16')?.title ?? '').replace(/ \[선택\]$/, '');
const LATER = CONSENT_LATER_NAMES.map(({ code, name }) => ({ code, label: `${OPTIONAL_TAG}${code === 'CK16' ? CK16_ROW : name}` }));
const ON_HERE: ReadonlySet<LaterConsentCode> = new Set(['CK16']);
const VIEW_ITEMS: readonly ConsentSheetContent[] = [...REQUIRED_ITEMS, ...CONSENT_LATER_ITEMS];

export function ConsentManagePage({ api, onBack, onToast }: { api: Pick<SettingsApi, 'loadConsents' | 'setOptional'>; onBack: () => void; onToast: (text: string) => void }) {
  const read = useCallback(() => api.loadConsents(), [api]);
  const { phase, data, setData, reload, alive } = useLoad<OptionalConsents>(read);
  const [error, setError] = useState<string | null>(null);
  const [askCk4Off, setAskCk4Off] = useState(false);
  const [askOff, setAskOff] = useState<LaterConsentCode | null>(null); // 03 밖 선택 동의 끄기 확인창
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [reading, setReading] = useState<ConsentSheetContent | null>(null);

  const apply = async (code: OptionalCode, next: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await api.setOptional(code, next);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    setAskCk4Off(false);
    setAskOff(null);
    if (result.ok) {
      setData((d) => (d ? { ...d, [code]: next } : d));
      onToast(CONSENT_MANAGE.saved);
      return;
    }
    setError(result.reason === 'network' ? COMMON.offline : result.reason === 'session' ? COMMON.sessionLost : CONSENT_MANAGE.saveFailed);
  };

  const onSwitch = (code: OptionalCode) => {
    if (!data || busyRef.current) return;
    const next = !data[code];
    if (code === 'CK4' && !next) {
      setError(null);
      setAskCk4Off(true);
      return;
    }
    if (code !== 'CK4' && code !== 'CK9' && code !== 'CK10') {
      if (next && !ON_HERE.has(code)) return; // 판 · 글이 없는 칸은 여기서 켜지 않는다(스위치도 잠겨 있다)
      if (!next) {
        setError(null);
        setAskOff(code);
        return;
      }
    }
    void apply(code, next);
  };

  return (
    <SubPage title={CONSENT_MANAGE.headerTitle} onBack={onBack} testID="settings-consents">
      {phase !== 'ready' || !data ? (
        <LoadState state={phase === 'ready' ? 'server' : phase} onRetry={reload} testID="settings-consents" />
      ) : (
        <>
          <GroupLabel text={CONSENT_MANAGE.optionalTitle} />
          <RowGroup testID="settings-consents-optional">
            {OPTIONAL.map((code) => {
              const item = itemOf(code);
              return <SwitchRow key={code} label={item.label} note={item.note ?? undefined} on={data[code]} disabled={busy} last={false} onPress={() => onSwitch(code)} testID={`settings-consent-${code}`} />;
            })}
            {LATER.map(({ code, label }, i) => {
              const locked = !data[code] && !ON_HERE.has(code);
              return <SwitchRow key={code} label={label} note={locked ? CONSENT_LATER.askLater : undefined} on={data[code]} disabled={busy || locked} last={i === LATER.length - 1} onPress={() => onSwitch(code)} testID={`settings-consent-${code}`} />;
            })}
          </RowGroup>
          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="settings-consents-error">
              {error}
            </AppText>
          ) : null}
          <View style={styles.agreedHead}>
            <GroupLabel text={CONSENT_MANAGE.agreedTitle} />
            <AppText variant="caption" style={styles.pad} testID="settings-consents-required-note">
              {CONSENT_MANAGE.requiredNote}
            </AppText>
          </View>
          <RowGroup testID="settings-consents-required">
            {VIEW_ITEMS.map((item, i) => (
              <Pressable
                key={item.code}
                accessibilityLabel={`${item.label}, ${CONSENT_MANAGE.view}`}
                onPress={() => setReading(item)}
                effect="none"
                testID={`settings-consent-view-${item.code}`}
                style={({ pressed }) => [styles.row, i < VIEW_ITEMS.length - 1 && styles.divider, pressed && styles.pressed]}>
                <AppText variant="body" style={styles.flex}>
                  {item.label}
                </AppText>
                <AppText variant="bodyMedium" tone="accent">
                  {CONSENT_MANAGE.view}
                </AppText>
              </Pressable>
            ))}
          </RowGroup>
        </>
      )}
      <ConfirmDialog
        visible={askCk4Off}
        title={CONSENT_MANAGE.ck4OffTitle}
        body={CONSENT_MANAGE.ck4OffBody}
        confirmLabel={CONSENT_MANAGE.ck4OffConfirm}
        cancelLabel={CONSENT_MANAGE.cancel}
        busy={busy}
        error={askCk4Off ? error : null}
        onConfirm={() => void apply('CK4', false)}
        onCancel={() => !busyRef.current && setAskCk4Off(false)}
        testID="settings-ck4-off"
      />
      <ConfirmDialog
        visible={askOff !== null}
        title={CONSENT_LATER.offTitle}
        body={askOff === 'CK15' ? CONSENT_LATER.ck15OffBody : CONSENT_LATER.offBody}
        confirmLabel={CONSENT_LATER.offConfirm}
        cancelLabel={CONSENT_MANAGE.cancel}
        busy={busy}
        error={askOff ? error : null}
        onConfirm={() => askOff && void apply(askOff, false)}
        onCancel={() => !busyRef.current && setAskOff(null)}
        testID="settings-later-off"
      />
      <ConsentSummarySheet item={reading} onClose={() => setReading(null)} />
    </SubPage>
  );
}

const styles = StyleSheet.create({
  agreedHead: { gap: space.s4 },
  pad: { paddingHorizontal: space.s4 },
  row: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { opacity: alpha.pressed },
  flex: { flex: 1, flexShrink: 1 },
});
