// 화면 ID 06 AI 정리 중(K2 4장 06 · 카피.md 06 · Figma 3:171 + 오류 상태 메모 52:2).
//  처리 중: 도는 원 · 제목 · 부제(1분쯤 걸려요 = 평균 대기 안내) · AI 이용 고지 · 진행바 · 단계 글 · (60초 넘으면) 오래 걸림 안내
//  오류: 제목 "정리하지 못했어요" + 본문 + [다시 시도] (3번째 실패부터 [직접 입력하기] + N13 안내, 4번째는 [직접 입력하기]만)
//  뒤로가기: 정리 중에는 무시, 오류 상태에서는 앱을 백그라운드로 보낸다. 상단 바에 ‹ 는 없다.
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/motion';
import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Illustration } from '@/components/Illustration';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ANALYSIS, COMMON } from '@/content/copy';
import { aiApi } from '@/lib/services';
import { goForward } from '@/navigation/go';
import { useSignupStore } from '@/store';
import { illustration } from '@/theme/illustrations';
import { layout } from '@/theme/layout';
import { colors, size, space } from '@/theme/tokens';

import { useAnalysis, type AnalysisDeps, type AnalysisDest } from './useAnalysis';

const defaultDeps: AnalysisDeps = {
  api: aiApi,
  setStage: (stage) => useSignupStore.getState().setStage(stage),
};

export function AnalysisScreen({ deps = defaultDeps }: { deps?: AnalysisDeps }) {
  const router = useRouter();
  const onNavigate = useCallback(
    (dest: Exclude<AnalysisDest, null>) => {
      if (dest === 'consent') goForward(router, '/consent');
      else if (dest === 'traits-manual') router.push({ pathname: '/traits', params: { mode: 'manual' } });
      else goForward(router, '/traits');
    },
    [router],
  );
  const a = useAnalysis(deps, onNavigate);
  const phaseRef = useRef(a.phase);
  useLayoutEffect(() => {
    phaseRef.current = a.phase;
  });

  // Android 뒤로가기: 정리 중에는 무시, 오류 상태에서는 앱을 백그라운드로 보낸다
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (phaseRef.current === 'failed') BackHandler.exitApp();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  const failed = a.phase === 'failed' && a.failure !== null;
  const failure = a.failure;
  const stepName = ANALYSIS.steps[a.step];

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScreenHeader title={ANALYSIS.headerTitle} testID="analysis-header" />
      <ScrollView contentContainerStyle={styles.content} testID={failed ? 'screen-06-failed' : 'screen-06'}>
        {failed && failure ? (
          <View style={styles.center}>
            <AppText variant="title" accessibilityRole="header" testID="analysis-fail-title" style={styles.centered}>
              {ANALYSIS.failTitle}
            </AppText>
            <AppText variant="body" tone="sub" testID="analysis-fail-body" style={styles.centered}>
              {ANALYSIS.failBody}
            </AppText>
            {failure.showManual ? (
              <AppText variant="caption" testID="analysis-manual-note" style={styles.centered}>
                {ANALYSIS.manualNote}
              </AppText>
            ) : null}
            {a.problem ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="analysis-problem" style={styles.centered}>
                {a.problem === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View style={styles.center}>
            {/* D43 B1: 돌림 고리 대신 그림 4안 '정리중' 장면(상태 칸 240). 진행은 아래 막대가 보여 준다 */}
            <Illustration scene="organizing" maxWidth={illustration.state} testID="analysis-art" />
            <AppText variant="title" accessibilityRole="header" testID="analysis-title" style={styles.centered}>
              {ANALYSIS.title}
            </AppText>
            <AppText variant="body" tone="sub" testID="analysis-subtitle" style={styles.centered}>
              {ANALYSIS.subtitle}
            </AppText>
            <AppText variant="caption" testID="analysis-ai-notice" style={styles.centered}>
              {ANALYSIS.aiNotice}
            </AppText>

            {/* 진행 막대(F21): 안쪽을 scaleX 로 250(std) 채움 */}
            <ProgressBar
              ratio={a.ratio}
              style={styles.bar}
              accessibilityLabel={`${ANALYSIS.steps.join(' → ')}. ${stepName}`}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(a.ratio * 100) }}
              testID="analysis-progress"
            />
            <View style={styles.steps} testID="analysis-steps" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {ANALYSIS.steps.map((name, index) => (
                <View key={name} style={styles.step}>
                  <AppText variant={index === a.step ? 'captionBold' : 'caption'} tone={index === a.step ? 'text' : 'sub'}>
                    {name}
                  </AppText>
                  {index < ANALYSIS.steps.length - 1 ? <AppText variant="caption">{' → '}</AppText> : null}
                </View>
              ))}
            </View>

            {a.slow ? (
              <AppText variant="captionMedium" tone="accent" accessibilityLiveRegion="polite" testID="analysis-slow" style={styles.centered}>
                {ANALYSIS.slow}
              </AppText>
            ) : null}
            {a.offline ? (
              <AppText variant="caption" accessibilityLiveRegion="polite" testID="analysis-offline" style={styles.centered}>
                {COMMON.offline}
              </AppText>
            ) : null}
          </View>
        )}
      </ScrollView>

      {failed && failure ? (
        <View style={styles.footer}>
        <CtaFade />
          {failure.showRetry ? <Button label={ANALYSIS.retry} loading={a.retryBusy} onPress={a.retry} testID="analysis-retry" /> : null}
          {failure.showManual ? (
            <Button label={ANALYSIS.manual} variant={failure.showRetry ? 'secondary' : 'primary'} onPress={a.manual} testID="analysis-manual" />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: size.screenPadding, paddingVertical: space.s24 },
  center: { alignItems: 'center', gap: space.s12 },
  centered: { textAlign: 'center' },
  bar: { maxWidth: layout.analysisBarWidth, marginTop: space.s12 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  step: { flexDirection: 'row' },
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s12, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
});
