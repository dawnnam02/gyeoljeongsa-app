// 12 탈퇴(K2 12 '탈퇴 인증번호 재확인' · 정책 P6-01 · 가정 D-23 BD-5 · Figma 12g 201:281 · 12e 197:240).
//  [탈퇴하기] → 확인창(법무 5-6 제목 · 본문 · 보조) → 확인창의 [탈퇴하기] → 서버가 가입 이메일로 인증번호 6자리를 보냄 → 같은 자리에서 재확인 단계
//  → 6자리가 차면 [탈퇴 확정] → 맞으면 서버가 탈퇴를 확정(이 순간이 탈퇴 확인일) → 부모가 로그인 정보를 지우고 01 로.
//  맞게 입력하기 전에는 아무것도 지우거나 숨기지 않는다: 틀림 · 3분 지남 · 횟수 초과 · 발송 실패 · [취소] · 뒤로가기는 모두 탈퇴가 아니다(12 로 돌아가거나 이 단계에 머묾).
//  인증번호 유효 3분 · 다시 받기는 3분 뒤(02 와 같은 시계, lib/otpClock). 틀림은 칸만 비우고 머문다. 같은 버튼을 두 번 눌러도 요청은 한 번.
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { SIGN_IN } from '@/content/copy';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { WITHDRAW } from '@/content/settingsCopy';
import { fmt } from '@/features/mileage/mileageLogic';
import { formatMmSs, OTP_LENGTH, secondsLeft } from '@/lib/otpClock';
import type { SettingsApi } from '@/lib/settingsApi';
import { colors, size, space } from '@/theme/tokens';

import { onlyDigits, withdrawConfirmError, withdrawStartError } from './settingsLogic';

type Step = 'confirm' | 'otp';

/** 탈퇴 확인창 마일리지 줄: 잔액 → (산 분이 있으면) 환불을 요청할 수 있고 정산 날짜 규칙 → (받은 무료분이 있으면) 탈퇴하면 사라진다. 숫자 강조 · 재촉 0 */
export function mileageLines(m: { total: number; paid: number; free: number } | null | undefined): string[] {
  if (!m || m.total <= 0) return [];
  return [t5('MILEAGE.free.leave.bal', { N: fmt(m.total) }), ...(m.paid > 0 ? [IF5_TEXT['MILEAGE.free.leave.refund']] : []), ...(m.free > 0 ? [IF5_TEXT['MILEAGE.free.leave.freeGone']] : [])];
}
type Props = {
  visible: boolean;
  api: Pick<SettingsApi, 'startWithdraw' | 'confirmWithdraw'>;
  now: () => number;
  /** IF5-F2: 탈퇴 확인창 마일리지 줄(23-13-3 · 법무 5-9 M7). 마일리지를 켜고 잔액이 있을 때만 — 없으면 줄 0 */
  mileage?: { total: number; paid: number; free: number } | null;
  onRefund?: () => void; // [환불 요청] — 고객센터 안내로
  onCancel: () => void; // 탈퇴하지 않고 12 로
  onDone: () => Promise<void> | void; // 탈퇴 확정됨 — 부모가 로그인 정보를 지우고 01 로
};

export function WithdrawFlow({ visible, api, now, mileage, onRefund, onCancel, onDone }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [tick, setTick] = useState(() => now());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 재확인 단계가 열려 있는 동안 1초마다 남은 시간을 다시 센다
  useEffect(() => {
    if (!visible || step !== 'otp') return undefined;
    const timer = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(timer);
  }, [visible, step, now]);

  const left = secondsLeft(sentAt, tick);
  const expired = sentAt !== null && left === 0;

  const reset = () => {
    setStep('confirm');
    setSentAt(null);
    setCode('');
    setError(null);
    setDialogError(null);
  };
  const cancel = () => {
    if (busyRef.current) return;
    reset();
    onCancel();
  };

  const guard = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };

  // 인증번호 보내기(확인창의 [탈퇴하기] · 재확인 단계의 [인증번호 다시 받기]). 실패해도 재확인 단계에 머문다(분기 ①)
  const send = () =>
    guard(async () => {
      setDialogError(null);
      const result = await api.startWithdraw();
      if (!alive.current) return;
      const t = now();
      setTick(t);
      setCode('');
      if (result.ok) {
        setSentAt(t);
        setError(null);
      } else if (result.reason === 'network' && step === 'confirm') {
        setDialogError(withdrawStartError(result.reason)); // 인터넷이 끊겼으면 확인창에 머문다
        return;
      } else {
        setError(withdrawStartError(result.reason));
      }
      setStep('otp');
    });

  const confirm = () =>
    guard(async () => {
      if (code.length !== OTP_LENGTH) return;
      if (expired) {
        setError(SIGN_IN.errors.codeExpired);
        return;
      }
      setError(null);
      const result = await api.confirmWithdraw(code);
      if (!alive.current) return;
      if (result.ok) {
        reset();
        await onDone();
        return;
      }
      if (result.reason === 'wrong') setCode(''); // 칸만 비우고 머문다
      setError(withdrawConfirmError(result.reason));
    });

  const shownError = error ?? (expired ? SIGN_IN.errors.codeExpired : null);

  return (
    <>
      <ConfirmDialog
        visible={visible && step === 'confirm'}
        title={WITHDRAW.title}
        body={WITHDRAW.body}
        sub={WITHDRAW.sub}
        note={{
          text: [WITHDRAW.credit, WITHDRAW.rejoinNote, ...mileageLines(mileage)].join('\n'),
          action: mileage && mileage.paid > 0 && onRefund ? { label: IF5_TEXT['MILEAGE.free.leave.refundBtn'], onPress: onRefund } : undefined,
        }} // 크레딧 줄 + 바로 아래 '다시 가입' 한 줄(카피.md 12-Q WITHDRAW.credit · rejoinNote(M8, 3부-사) · v5엔 구독 안내 NV36 없음, QP-A)
        confirmLabel={WITHDRAW.confirm}
        cancelLabel={WITHDRAW.cancel}
        busy={busy}
        error={dialogError}
        onConfirm={() => void send()}
        onCancel={cancel}
        testID="withdraw-confirm"
      />
      <Modal visible={visible && step === 'otp'} animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel} testID="withdraw-otp">
        <SafeAreaView style={styles.page}>
          <ScreenHeader title={WITHDRAW.otpHeader} onBack={cancel} testID="withdraw-otp-header" />
          <KeyboardAvoid>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <AppText variant="title" accessibilityRole="header" testID="withdraw-otp-title">
              {WITHDRAW.otpTitle}
            </AppText>
            <AppText variant="body" tone="sub" testID="withdraw-otp-body">
              {WITHDRAW.otpBody}
            </AppText>
            <TextField
              label={WITHDRAW.codeLabel}
              value={code}
              onChangeText={(v) => {
                setCode(onlyDigits(v, OTP_LENGTH));
                if (error && !expired) setError(null);
              }}
              placeholder={WITHDRAW.codeLabel}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              error={shownError}
              testID="withdraw-code"
            />
            {left > 0 ? (
              <AppText variant="caption" accessibilityLiveRegion="none" testID="withdraw-retry-after">
                {WITHDRAW.retryAfter(formatMmSs(left))}
              </AppText>
            ) : (
              <TextButton label={WITHDRAW.resend} align="start" variant="captionMedium" disabled={busy} onPress={() => void send()} testID="withdraw-resend" />
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Button label={WITHDRAW.submit} loading={busy} disabled={code.length !== OTP_LENGTH} onPress={() => void confirm()} testID="withdraw-submit" />
            <Button label={WITHDRAW.cancel} variant="secondary" disabled={busy} onPress={cancel} testID="withdraw-cancel" />
          </View>
          </KeyboardAvoid>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s24, gap: space.s12 },
  footer: { paddingHorizontal: size.screenPadding, paddingBottom: space.s16, paddingTop: space.s16, gap: space.s12 },
});
