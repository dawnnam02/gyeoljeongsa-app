// 화면 ID 03 약관 · 동의(K2 4장 03 · 법무/동의문구.md 3장 · Figma 3:47 + D7).
//  위에서 아래: 제목 · 부제 / 필수 항목 모두 동의 / CK1 · CK2 · CK3 / 안내 상자 / CK4 ~ CK9 / 링크 줄 · 작은 글씨 — 스크롤
//  아래(고정): [동의하고 계속]. 필수 7칸이 모두 켜져야 눌린다. 비어 있는 채로 누르면 이유 문구를 보이고 빈 칸을 강조한다(R7)
//  [동의하고 계속] → 동의 기록 한 번에 저장(consents) → 04-01.  문구가 바뀐 뒤에는(?mode=reconsent) 바뀐 칸만 보인다(N28).
//  뒤로가기(‹ · Android): 로그인 상태를 끊고 02 로 간다. 02 는 이메일 입력부터 다시 시작하고 체크한 내용은 버린다.
// 체크 칸의 글은 법무 문서에서 자동으로 뽑은 content/consentContent.ts 의 것을 그대로 쓴다(글자를 여기서 옮겨 적지 않는다).
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { InfoBox } from '@/components/InfoBox';
import { Pressable } from '@/components/Pressable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt } from '@/components/StateArt';
import { TextButton } from '@/components/TextButton';
import { CONSENT_LINKS, CONSENT_NOTICE, CONSENT_SUBTITLE, CONSENT_TOP, CONSENT_ERROR } from '@/content/consentContent';
import { COMMON, CONSENT } from '@/content/copy';
import type { ConsentCode } from '@/content/types';
import { APP_VERSION } from '@/lib/appVersion';
import { buildConsentRows, loadActiveConsents, recordConsents, type ActiveConsent, type ConsentFailure, type ConsentRowInput } from '@/lib/consentApi';
import { changedConsents } from '@/lib/progress';
import { authApi, supabase } from '@/lib/services';
import { goBackOr, goForward } from '@/navigation/go';
import { resolveDest } from '@/navigation/resolve';
import { routeForStage } from '@/navigation/stage';
import { useSignupStore } from '@/store';
import { layout } from '@/theme/layout';
import { tintAccent } from '@/theme/color';
import { colors, radius, size, space } from '@/theme/tokens';

import { ConsentRow } from './ConsentRow';
import { ConsentSummarySheet } from './ConsentSummarySheet';
import { LegalReader } from './LegalReader';
import {
  allRequiredChecked,
  canSubmit,
  emptyChecked,
  ITEMS,
  missingRequired,
  REQUIRED_SET,
  requiredOf,
  shownCodes,
  toggleAllRequired,
  toggleItem,
  type Checked,
} from './consentLogic';

export type ConsentDeps = {
  userId: () => Promise<string | null>;
  loadActive: () => Promise<{ ok: true; rows: ActiveConsent[] } | { ok: false; reason: ConsentFailure }>;
  record: (rows: ConsentRowInput[]) => Promise<{ ok: true } | { ok: false; reason: ConsentFailure }>;
  signOut: () => Promise<void>;
};

const defaultDeps: ConsentDeps = {
  userId: () => authApi.userId(),
  loadActive: () => loadActiveConsents(supabase),
  record: async (rows) => {
    const r = await recordConsents(supabase, rows);
    return r.ok ? r : { ok: false, reason: r.reason === 'limit' ? 'server' : r.reason };
  },
  signOut: () => authApi.signOut(),
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const NOTICE_BEFORE: ConsentCode = 'CK4'; // 안내 상자 자리: CK3 와 CK4 사이(동의문구 3-1)

export function ConsentScreen({ deps: injected }: { deps?: ConsentDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const reconsent = first(params.mode) === 'reconsent';
  const deps = injected ?? defaultDeps;

  // 보이는 칸. null = 문구가 바뀐 칸을 서버에서 알아보는 중
  const [shown, setShown] = useState<readonly ConsentCode[] | null>(reconsent ? null : shownCodes(null));
  const [loadFailed, setLoadFailed] = useState<ConsentFailure | null>(null);
  const [checked, setChecked] = useState<Checked>(emptyChecked);
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // 연달아 눌린 두 번을 막는다(state 는 다음 그리기에서야 바뀐다)
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<ConsentCode | null>(null);
  const [reader, setReader] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 문구가 바뀐 칸을 서버에서 알아본 결과를 화면에 반영한다(처음 한 번 · [다시 시도]). 서버 응답이 온 뒤에만 부른다.
  const applyLoaded = useCallback(
    (result: Awaited<ReturnType<ConsentDeps['loadActive']>>) => {
      if (!alive.current) return;
      if (!result.ok) {
        setLoadFailed(result.reason);
        return;
      }
      const changed = changedConsents(result.rows);
      if (changed.length === 0) goForward(router, routeForStage('consented')); // 바뀐 칸이 없으면 다시 받을 것이 없다
      else setShown(shownCodes(changed));
    },
    [router],
  );
  const retryLoad = useCallback(() => {
    setLoadFailed(null);
    return deps.loadActive().then(applyLoaded);
  }, [deps, applyLoaded]);
  useEffect(() => {
    if (!reconsent) return;
    void deps.loadActive().then(applyLoaded);
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBack = useCallback(async () => {
    await deps.signOut();
    useSignupStore.getState().setStage(null);
    goBackOr(router, '/sign-in');
  }, [deps, router]);
  const onBackRef = useRef(onBack);
  useLayoutEffect(() => {
    onBackRef.current = onBack; // Android 뒤로가기 handler 가 늘 최신 onBack 을 부르게 한다
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        void onBackRef.current();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  const onSubmit = useCallback(async () => {
    if (savingRef.current || !shown) return;
    if (!canSubmit(checked, shown)) {
      setShowError(true); // 흐린 모양으로 눌렸다: 이유 문구를 보이고 빈 칸을 강조한다
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const userId = await deps.userId();
    if (!alive.current) return;
    if (!userId) {
      savingRef.current = false;
      router.replace({ pathname: '/sign-in', params: { reason: 'session' } }); // 로그인이 풀렸다(분기 ⑦)
      return;
    }
    const rows = buildConsentRows({ userId, shown, checked, required: REQUIRED_SET, appVersion: APP_VERSION, source: 'signup' });
    const result = await deps.record(rows);
    if (!alive.current) return;
    if (!result.ok) {
      savingRef.current = false;
      setSaving(false);
      setSaveError(result.reason === 'network' ? COMMON.offline : COMMON.server); // 입력한 체크는 그대로 둔다(R8)
      return;
    }
    useSignupStore.getState().setStage('consented');
    const next = resolveDest('04:first');
    goForward(router, next.kind === 'href' ? next.href : routeForStage('consented'));
  }, [shown, checked, deps, router]);

  const items = useMemo(() => (shown ? ITEMS.filter((item) => shown.includes(item.code)) : []), [shown]);
  const open = ITEMS.find((item) => item.code === sheet) ?? null;

  if (!shown) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <ScreenHeader title={CONSENT.headerTitle} onBack={onBack} testID="consent-header" />
        <View style={styles.loading} testID="screen-03-loading">
          {loadFailed ? (
            <>
              <OfflineArt show={loadFailed === 'network'} />
              <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered}>
                {loadFailed === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
              <Button label={COMMON.retry} inline onPress={retryLoad} testID="consent-retry" />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="caption">{COMMON.loading}</AppText>
            </>
          )}
        </View>
      </Screen>
    );
  }

  const requiredShown = requiredOf(shown);
  const topChecked = allRequiredChecked(checked, shown);
  const missing = missingRequired(checked, shown);
  const errorVisible = showError && missing.length > 0;
  const emphasize = (code: ConsentCode) => showError && missing.includes(code);

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScreenHeader title={CONSENT.headerTitle} onBack={onBack} testID="consent-header" />
      <ScrollView contentContainerStyle={styles.content} testID="screen-03">
        <View style={styles.titles}>
          <AppText variant="title" testID="consent-title">
            {reconsent ? CONSENT.reconsentTitle : CONSENT.title}
          </AppText>
          <AppText variant="body" tone="sub" testID="consent-subtitle">
            {reconsent ? CONSENT.reconsentSubtitle : CONSENT_SUBTITLE}
          </AppText>
        </View>

        {requiredShown.length > 0 ? (
          <>
            <Pressable
              accessibilityRole="checkbox"
              aria-checked={topChecked}
              accessibilityLabel={CONSENT_TOP.label}
              accessibilityHint={CONSENT_TOP.note ?? undefined}
              onPress={() => setChecked((c) => toggleAllRequired(c, shown))}
              effect="none"
              testID="consent-all"
              style={[styles.all, showError && !topChecked ? styles.allEmphasized : null]}>
              <View style={styles.allLine}>
                <View style={styles.allBox}>
                  <CheckBox checked={topChecked} emphasized={showError && !topChecked} />
                </View>
                <AppText variant="bodyMedium" style={styles.allLabel}>
                  {CONSENT_TOP.label}
                </AppText>
              </View>
              {CONSENT_TOP.note ? (
                <AppText variant="caption" tone="text" style={styles.allNote}>
                  {CONSENT_TOP.note}
                </AppText>
              ) : null}
            </Pressable>
            <View style={styles.rule} />
          </>
        ) : null}

        <View testID="consent-list">
          {items.map((item) => (
            <View key={item.code}>
              {item.code === NOTICE_BEFORE ? (
                <View style={styles.notice}>
                  <InfoBox title={CONSENT_NOTICE.title} body={CONSENT_NOTICE.body} testID="consent-notice" />
                </View>
              ) : null}
              <ConsentRow
                item={item}
                checked={checked[item.code]}
                emphasized={emphasize(item.code)}
                onToggle={() => setChecked((c) => toggleItem(c, item.code))}
                onOpen={() => setSheet(item.code)}
              />
            </View>
          ))}
        </View>

        <View>
          <TextButton label={CONSENT_LINKS.line} align="start" onPress={() => setReader(true)} testID="consent-links" />
          <AppText variant="caption" testID="consent-links-note">
            {CONSENT_LINKS.small}
          </AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CtaFade />
        {errorVisible || saveError ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="consent-error">
            {errorVisible ? CONSENT_ERROR : saveError}
          </AppText>
        ) : null}
        <Button label={CONSENT.submit} dimmed={!canSubmit(checked, shown)} loading={saving} onPress={onSubmit} testID="consent-submit" />
      </View>

      <ConsentSummarySheet item={open} onClose={() => setSheet(null)} />
      <LegalReader visible={reader} initial="terms" onClose={() => setReader(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s16 },
  titles: { gap: space.s12 },
  // 필수 항목 모두 동의 상자(D7, F9 v2): 면 card · 둥글기 16 · 안 여백 20
  all: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s20, gap: space.s4 },
  allEmphasized: { backgroundColor: tintAccent },
  allLine: { flexDirection: 'row', alignItems: 'center' },
  allBox: { marginRight: space.s12 },
  allLabel: { flex: 1 },
  allNote: { marginLeft: layout.checkBox + space.s12 },
  rule: { height: 1, backgroundColor: colors.line },
  notice: { paddingVertical: space.s4 }, // 안내 상자 위 · 아래 자리 4(D7)
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s8, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centered: { textAlign: 'center' },
});
