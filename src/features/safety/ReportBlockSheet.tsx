// 신고 · 차단 공용 시트(F7 소유, F5 의 10 상단 '신고 · 차단' · F6 의 11 행 ⋯ 가 같은 것을 연다). 카피.md 11 N33 · 정책 5장 · Figma 11b 195:12 · 11c~11g 227:2.
//  1) 선택 시트(아래에서 올라옴): 손잡이 · 제목 "신고 · 차단" · [신고하기] + 작은 글 · [차단하기] + 작은 글 · [취소]
//  2) 신고 사유 고르기(화면 가득): ‹ + 제목 · 사유 8개(하나만) · RP6 아래 24시간 안내 · 익명 안내 · 설명(선택 200자 / 기타는 10자 이상) · [제출하기]
//  3) 차단 확인창: "이분을 차단할까요? 서로 보이지 않게 돼요." [차단하기] [취소]
// 성공하면 시트를 닫고 부모에게 알린다. 토스트("신고했어요…" · "차단했어요.")와 그다음 이동은 부모가 한다(10 은 진입한 화면으로, 11 은 머묾).
// 같은 버튼을 두 번 눌러도 요청은 한 번(R9). 뒤로가기는 한 단계씩 닫는다(사유 → 선택 시트 → 닫힘, 확인창 → 선택 시트).
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { haptic } from '@/motion';
import { Pressable } from '@/components/Pressable';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { REPORT_SHEET } from '@/content/copy';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { Radio } from './Radio';
import { blockFailureText, checkReport, DESC_MAX, MINOR_INDEX, OTHER_INDEX, REPORT_CODES, reportFailure, type SafetyApi } from './reportLogic';

type Step = 'menu' | 'reason' | 'block';
type Props = {
  visible: boolean;
  targetId: string;
  api: SafetyApi;
  onClose: () => void; // 아무것도 하지 않고 닫힘
  onReported: () => void; // 신고 접수(부모가 토스트 REPORT_SHEET.done)
  onBlocked: () => void; // 차단됨(부모가 토스트 REPORT_SHEET.blockDone + 이동)
  onUnavailable?: () => void; // 이미 볼 수 없는 상대(부모가 "이 프로필은 더 이상 볼 수 없어요." 등)
  testID?: string;
};

export function ReportBlockSheet({ visible, targetId, api, onClose, onReported, onBlocked, onUnavailable, testID = 'report' }: Props) {
  const [step, setStep] = useState<Step>('menu');
  const [picked, setPicked] = useState<number | null>(null);
  const [desc, setDesc] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const clearErrors = () => {
    setReasonError(null);
    setDescError(null);
    setFormError(null);
  };
  const reset = () => {
    setStep('menu');
    setPicked(null);
    setDesc('');
    clearErrors();
    setMenuError(null);
  };
  const close = () => {
    if (busyRef.current) return;
    reset();
    onClose();
  };
  const run = async <T,>(work: () => Promise<T>): Promise<T | null> => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const submit = async () => {
    const check = checkReport(picked, desc);
    clearErrors();
    if (check) {
      (check.field === 'reason' ? setReasonError : setDescError)(check.text);
      return;
    }
    const result = await run(() => api.report(targetId, REPORT_CODES[picked as number], desc.trim()));
    if (!result) return;
    if (result.ok) {
      reset();
      onReported();
      return;
    }
    if (result.reason === 'unavailable') {
      reset();
      onUnavailable?.();
      return;
    }
    const shown = reportFailure(result.reason);
    (shown.field === 'reason' ? setReasonError : shown.field === 'desc' ? setDescError : setFormError)(shown.text);
  };

  const block = async () => {
    const result = await run(() => api.block(targetId));
    if (!result) return;
    if (result.ok) {
      reset();
      onBlocked();
      return;
    }
    if (result.reason === 'unavailable') {
      reset();
      onUnavailable?.();
      return;
    }
    setStep('menu');
    setMenuError(blockFailureText(result.reason));
  };

  const id = (part: string) => `${testID}-${part}`;

  return (
    <>
      {/* 신고 · 차단 시트(F21): 공통 BottomSheet — 위 모서리 24 · 손잡이 36 × 4 · 열림 400 · 닫힘 250 내려감 · 아래로 끌어 닫기(D25 10-5 '10 신고 · 차단 시트 끌어 닫기') */}
      <BottomSheet visible={visible && step === 'menu'} onClose={close} dismissable={!busy} testID={id('menu')}>
            <AppText variant="bodyBold" accessibilityRole="header" style={styles.sheetTitle}>
              {REPORT_SHEET.title}
            </AppText>
            <Pressable
              accessibilityLabel={`${REPORT_SHEET.report}. ${REPORT_SHEET.reportHint}`}
              onPress={() => {
                setMenuError(null);
                setStep('reason');
              }}
              effect="none"
              style={({ pressed }) => [styles.item, styles.itemLine, pressed && styles.pressed]}
              testID={id('menu-report')}>
              <AppText variant="bodyMedium">{REPORT_SHEET.report}</AppText>
              <AppText variant="caption">{REPORT_SHEET.reportHint}</AppText>
            </Pressable>
            <Pressable
              accessibilityLabel={`${REPORT_SHEET.block}. ${REPORT_SHEET.blockHint}`}
              onPress={() => {
                setMenuError(null);
                haptic.warning(); // 되돌릴 수 없는 확인창(차단)이 열린다(D25 4장)
                setStep('block');
              }}
              effect="none"
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              testID={id('menu-block')}>
              <AppText variant="bodyMedium">{REPORT_SHEET.block}</AppText>
              <AppText variant="caption">{REPORT_SHEET.blockHint}</AppText>
            </Pressable>
            {menuError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('menu-error')}>
                {menuError}
              </AppText>
            ) : null}
            <Button label={REPORT_SHEET.cancel} variant="secondary" onPress={close} testID={id('menu-cancel')} />
      </BottomSheet>

      <Modal visible={visible && step === 'reason'} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => !busyRef.current && setStep('menu')} testID={id('reasons')}>
        <SafeAreaView style={styles.page}>
          <ScreenHeader title={REPORT_SHEET.reasonTitle} onBack={() => !busyRef.current && setStep('menu')} testID={id('reasons-header')} />
          <KeyboardAvoid>
          <ScrollView contentContainerStyle={styles.reasonBody} keyboardShouldPersistTaps="handled">
            <View accessibilityRole="radiogroup" style={styles.reasonCard}>
              {REPORT_SHEET.reasons.map((label, i) => (
                <View key={REPORT_CODES[i]} style={i < REPORT_CODES.length - 1 ? styles.itemLine : null}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: picked === i }}
                    aria-checked={picked === i}
                    onPress={() => {
                      setPicked(i);
                      setReasonError(null);
                      setFormError(null);
                      if (descError) setDescError(null);
                    }}
                    effect="none"
                    style={styles.reasonRow}
                    testID={id(`reason-${REPORT_CODES[i]}`)}>
                    <Radio checked={picked === i} />
                    <AppText variant={picked === i ? 'bodyMedium' : 'body'} style={styles.flex}>
                      {label}
                    </AppText>
                  </Pressable>
                  {i === MINOR_INDEX ? ( // K2 10: 늘 보인다(Figma 11e 는 고르지 않았을 때 숨김 — 팀장 확인)
                    <AppText variant="caption" style={styles.reasonNote} testID={id('minor-note')}>
                      {REPORT_SHEET.reasonRP6Note}
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
            {reasonError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('reason-error')}>
                {reasonError}
              </AppText>
            ) : null}
            <AppText variant="caption" testID={id('anonymous-note')}>
              {REPORT_SHEET.anonymousNote}
            </AppText>
            <View style={styles.desc}>
              <AppText variant="bodyBold">{REPORT_SHEET.descLabel}</AppText>
              <TextField
                label={REPORT_SHEET.descLabel}
                value={desc}
                onChangeText={(v) => {
                  setDesc(v);
                  setDescError(null);
                  setFormError(null);
                }}
                placeholder={picked === OTHER_INDEX ? REPORT_SHEET.descPlaceholderOther : REPORT_SHEET.descPlaceholder}
                maxLength={DESC_MAX + 1}
                error={descError}
                multiline
                testID={id('desc')}
              />
            </View>
            {formError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('error')}>
                {formError}
              </AppText>
            ) : null}
            <Button label={REPORT_SHEET.submit} loading={busy} onPress={submit} testID={id('submit')} />
          </ScrollView>
          </KeyboardAvoid>
        </SafeAreaView>
      </Modal>

      <ConfirmDialog
        visible={visible && step === 'block'}
        title={REPORT_SHEET.blockConfirm}
        confirmLabel={REPORT_SHEET.block}
        cancelLabel={REPORT_SHEET.cancel}
        busy={busy}
        onConfirm={block}
        onCancel={() => !busyRef.current && setStep('menu')}
        testID={id('block-confirm')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { paddingVertical: space.s8, borderBottomWidth: 1, borderBottomColor: colors.line },
  item: { minHeight: size.listRow, justifyContent: 'center', gap: space.s4, paddingVertical: space.s12 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { opacity: alpha.pressed },
  page: { flex: 1, backgroundColor: colors.bg },
  reasonBody: { padding: size.screenPadding, gap: space.s16 },
  reasonCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space.s12 },
  reasonRow: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s8 },
  reasonNote: { paddingLeft: space.s32, paddingBottom: space.s12 },
  flex: { flex: 1 },
  desc: { gap: space.s8 },
});
