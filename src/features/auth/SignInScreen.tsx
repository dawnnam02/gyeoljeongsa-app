// 화면 ID 02 가입 · 로그인(K2 4장 02 · Figma 3:26) — 이메일 → 인증번호 6자리 → (새 이메일이면) 생년월일 → 03 / 가입된 이메일이면 진행 단계대로.
// 상태기계는 signInMachine, 서버 호출 · 시계는 useSignIn. 이 파일은 그림과 이동만 한다.
//  · 위에서 아래: 제목 · 부제 / 이메일 칸 · [인증번호 받기] / 인증번호 칸 · 다시 받을 수 있을 때까지 남은 시간 / 생년월일 칸(새 이메일일 때만)
//  · 아래(고정): 가입 안내(동의문구 5-2)와 개인정보 처리방침 링크 · 만 19세 안내 · [확인]
//  · 뒤로가기(‹ · Android): 입력값과 인증 상태를 버리고(확인창 없음) 로그인 상태를 끊은 뒤 01 로 간다. 생년월일 칸이 열린 뒤에도 같다
// 15 인증 실패 화면(/sign-in-code-error)은 이 화면의 '인증번호 틀림' 모양을 그대로 보이는 점검용 화면이다(preview).
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type TextInput } from 'react-native';

import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { LockNote } from '@/components/LockNote';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { env } from '@/config/env';
import { SIGNUP_NOTICE } from '@/content/consentContent';
import { SIGN_IN } from '@/content/copy';
import { DEMO } from '@/content/demo';
import { LegalReader } from '@/features/consent/LegalReader';
import { DEMO_OTP_CODE } from '@/lib/demoBackend';
import { formatMmSs } from '@/lib/otpClock';
import { loadProgressStage } from '@/lib/progress';
import { authApi, supabase } from '@/lib/services';
import { goBackOr, goForward } from '@/navigation/go';
import { routeForStage } from '@/navigation/stage';
import { useSignupStore } from '@/store';
import { colors, size, space } from '@/theme/tokens';

import { errorText } from './errorCopy';
import { initialSignIn, type SignInState } from './signInMachine';
import { useSignIn, type SignInDeps } from './useSignIn';

// 15 인증 실패(Figma 38:348): 인증번호가 맞지 않은 모양. 시각을 고정해 남은 시간이 02:59 로 멈춰 있다.
const PREVIEW_NOW = 0;
const CODE_ERROR_PREVIEW: SignInState = {
  ...initialSignIn,
  phase: 'sent',
  email: 'hello@email.com',
  code: '123456',
  sentAt: PREVIEW_NOW - 1000,
  error: { key: 'code-wrong', field: 'code' },
};

type Props = {
  preview?: 'code-error';
  deps?: SignInDeps; // 화면 시험에서 가짜 서버를 넣는다
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function SignInScreen({ preview, deps: injected }: Props) {
  const router = useRouter();
  const params = useLocalSearchParams<{ open?: string; reason?: string }>();
  const reason = first(params.reason);
  const [reader, setReader] = useState(false);

  const deps = useMemo<SignInDeps>(
    () =>
      injected ?? {
        auth: authApi,
        loadStage: () => loadProgressStage(supabase),
        now: preview ? () => PREVIEW_NOW : Date.now,
        onStage: (stage) => {
          useSignupStore.getState().setStage(stage);
          // 03(동의)으로 가는 길은 쌓아 둔다: 03 의 뒤로가기가 02 로 돌아온다. 그 밖의 단계는 지나온 화면을 쌓지 않고 갈아 끼운다
          if (stage === 'birthdate-passed' || stage === 'consent-changed') router.push(routeForStage(stage));
          else goForward(router, routeForStage(stage));
        },
        onBirthPassed: () => {
          useSignupStore.getState().setStage('birthdate-passed');
          router.push('/consent');
        },
      },
    [injected, preview, router],
  );

  const initial = useMemo<SignInState | undefined>(() => {
    if (preview === 'code-error') return CODE_ERROR_PREVIEW;
    // 정지된 계정 · 로그인 풀림으로 02 에 왔을 때 이메일 칸 아래에 안내를 보인다(K2 2-3 표 · R8)
    if (reason === 'blocked') return { ...initialSignIn, error: { key: 'account-blocked', field: 'email' } };
    if (reason === 'session') return { ...initialSignIn, error: { key: 'session-lost', field: 'email' } };
    return undefined;
  }, [preview, reason]);

  const ui = useSignIn(deps, { initial, restore: first(params.open) === 'birthdate' && !preview });
  const { state } = ui;

  // 정지된 계정으로 왔다면 이 기기의 로그인을 끊는다
  useEffect(() => {
    if (reason === 'blocked') void deps.auth.signOut();
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codeRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  useEffect(() => {
    if (state.phase === 'sent' && !preview) codeRef.current?.focus(); // 인증번호를 보냈으면 바로 입력할 수 있게
  }, [state.phase, preview]);
  useEffect(() => {
    if (ui.showBirth) birthRef.current?.focus(); // 새 이메일이면 생년월일 칸이 열리며 입력이 이어진다
  }, [ui.showBirth]);

  const onBack = useCallback(async () => {
    if (!preview) await ui.discard();
    useSignupStore.getState().setStage(null);
    goBackOr(router, '/onboarding');
  }, [preview, router, ui]);
  const onBackRef = useRef(onBack);
  useLayoutEffect(() => {
    onBackRef.current = onBack; // Android 뒤로가기 handler 가 늘 최신 onBack 을 부르게 한다
  });

  // Android 뒤로가기 · 03 에서 돌아왔을 때 로그인이 끊겨 있으면 처음부터
  useFocusEffect(
    useCallback(() => {
      void ui.syncSession();
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        void onBackRef.current();
        return true;
      });
      return () => subscription.remove();
      // syncSession 은 안정된 함수다
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // 15 점검용 화면에서 [확인]은 '다시 입력'이다: 02 처음 모양으로 간다(flow.ts: 15 → 02)
  const onConfirm = preview ? () => router.replace('/sign-in') : ui.pressConfirm;
  const onSend = preview ? undefined : ui.pressSend;

  const emailError = ui.errorOf('email');
  const codeError = ui.errorOf('code');
  const birthError = ui.errorOf('birth');
  const busy = state.busy;

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScreenHeader title={SIGN_IN.headerTitle} onBack={onBack} testID="signin-header" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="screen-02">
          <View style={styles.titles}>
            <AppText variant="title">{SIGN_IN.title}</AppText>
            <AppText variant="body" tone="sub">
              {SIGN_IN.subtitle}
            </AppText>
          </View>

          <View style={styles.fields}>
            <TextField
              label={SIGN_IN.emailLabel}
              value={state.email}
              onChangeText={ui.setEmail}
              placeholder={SIGN_IN.emailPlaceholder}
              error={emailError ? errorText(emailError) : null}
              disabled={state.phase === 'verified'}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={onSend}
              testID="signin-email"
            />
            <Button
              variant="secondary"
              label={SIGN_IN.sendCode}
              dimmed={ui.sendDimmed}
              loading={busy === 'send'}
              onPress={onSend}
              testID="signin-send"
            />
            <View>
              <TextField
                ref={codeRef}
                label={SIGN_IN.codePlaceholder}
                value={state.code}
                onChangeText={ui.setCode}
                placeholder={SIGN_IN.codePlaceholder}
                error={codeError ? errorText(codeError) : null}
                disabled={state.phase !== 'sent'}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={onConfirm}
                testID="signin-code"
              />
              {ui.remaining > 0 ? (
                <AppText variant="caption" testID="signin-countdown" style={styles.countdown}>
                  {SIGN_IN.retryAfter(formatMmSs(ui.remaining))}
                </AppText>
              ) : null}
            </View>
            {ui.showBirth ? (
              <TextField
                ref={birthRef}
                label={SIGN_IN.birthLabel}
                value={state.birth}
                onChangeText={ui.setBirth}
                placeholder={SIGN_IN.birthPlaceholder}
                error={birthError ? errorText(birthError) : null}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={8}
                returnKeyType="done"
                onSubmitEditing={onConfirm}
                testID="signin-birth"
              />
            ) : null}
            {env.demoMode ? (
              <AppText variant="caption" testID="signin-demo-hint">
                {DEMO.otpHint(DEMO_OTP_CODE)}
              </AppText>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
        <CtaFade />
          <View>
            <LockNote text={SIGNUP_NOTICE.text} textTestID="signin-notice" />
            <TextButton label={SIGNUP_NOTICE.link} align="start" variant="captionMedium" onPress={() => setReader(true)} testID="signin-privacy-link" />
          </View>
          <AppText variant="caption" testID="signin-age-notice">
            {SIGN_IN.ageNotice}
          </AppText>
          <Button
            label={SIGN_IN.confirm}
            disabled={!preview && !ui.confirmEnabled}
            loading={busy === 'verify' || busy === 'birth'}
            onPress={onConfirm}
            testID="signin-confirm"
          />
        </View>
      </KeyboardAvoidingView>
      <LegalReader visible={reader} initial="privacy" onClose={() => setReader(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s12 },
  titles: { gap: space.s12 },
  fields: { gap: space.s12 },
  countdown: { marginTop: space.s12 }, // 입력 칸(또는 오류 문구) 아래 12(Figma 02 · 15)
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s12, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
});
