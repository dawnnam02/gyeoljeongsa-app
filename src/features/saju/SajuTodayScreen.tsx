// IF-SJ-CARD F5-08 오늘 하루(IF5-F1 ③ · 정책 PS-34 · 디자인 TD-1): 홈 '오늘 하루' 띠를 누르면 오는 화면.
//  · 위 '오늘의 바탕' 한 줄은 모든 회원에게 같은 글(오늘 날짜의 바탕만 · 앱 번들 표 · 내 정보 0 · 서버 호출 0). 아래 '하루 쓰는 법' 두 줄은 내 일간에 맞춰 이 화면을 열 때만 서버가 즉석 계산(get_my_day) — CK17A 켠 분
//  · AI 0(홈 열기 · 이 화면 열기는 업체 호출을 만들지 않는다) · 푸시 0 · 새 점 0 · 연속 접속 표시 0 · 하루 한 번 제한 0 · 점수 · 별점 · 행운 색 · 숫자 · 물건 0
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { IF5_TEXT } from '@/content/if5Copy';
import { Footnote } from '@/features/inflight/If2Parts';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { colors, radius, size, space } from '@/theme/tokens';

import { inputStore, useInputStore, type InputStore } from './deviceInput';
import { chartOf, nowIso, todayBaseLine, todayView } from './sajuLogic';
import { sajuServices, type SajuDeps } from './sajuService';
import { ErrorBlock, LoadingBlock, sajuStyles } from './SajuParts';
import { useCk17, useSajuData } from './useSajuData';

export function SajuTodayScreen({ deps: injected, store: injectedStore }: { deps?: SajuDeps; store?: InputStore }) {
  const flags = useFeatureFlags();
  const svc = useMemo(() => injected ?? { ...sajuServices(), isOn: flags.isOn }, [injected, flags.isOn]);
  const router = useRouter();
  const store = injectedStore ?? inputStore();
  const input = useInputStore(store);
  const [loaded, setLoaded] = useState(store.ready());
  useEffect(() => {
    let alive = true;
    void store.load().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [store]);
  const ck = useCk17(svc);
  const enabled = ck.slot.kind === 'on' && loaded && input.answered;
  const data = useSajuData(svc, input, enabled);
  const nowFn = svc.now ?? Date.now;
  const today = nowIso(nowFn());
  const base = todayBaseLine(today);
  const ready = data.chart.kind === 'ready' && data.chart.data.state === 'ready' ? data.chart.data : null;
  const day = data.day.kind === 'ready' && data.day.data.state === 'ready' ? data.day.data : null;
  const my = useMemo(() => (ready ? chartOf(ready) : null), [ready]);
  const view = my && day ? todayView(my, day) : null;
  useAlwaysCaptureBlock(view !== null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));

  return (
    <Screen edges={['top']} testID="screen-saju-today">
      <ScreenHeader title={IF5_TEXT['SAJU.today.title']} onBack={back} testID="saju-today-header" />
      <ScrollView contentContainerStyle={styles.body} testID="saju-today-scroll">
        <AppText variant="caption" tone="text">
          {IF5_TEXT['SAJU.card.fun']}
        </AppText>
        {base ? (
          <View style={styles.card} testID="saju-today-base">
            <AppText variant="caption">{IF5_TEXT['SAJU.today.lab']}</AppText>
            <AppText variant="bodyBold" testID="saju-today-one">
              {base}
            </AppText>
          </View>
        ) : null}
        {enabled && (data.chart.kind === 'loading' || data.day.kind === 'loading') ? <LoadingBlock id="saju-today-loading" /> : null}
        {enabled && (data.chart.kind === 'fail' || data.day.kind === 'fail') ? <ErrorBlock id="saju-today-error" onRetry={data.reload} /> : null}
        {view ? (
          <View style={styles.card} testID="saju-today-howto">
            <AppText variant="bodyMedium">{IF5_TEXT['SAJU.today.howto']}</AppText>
            {view.three.slice(0, 2).map((l, i) => (
              <AppText key={l} variant="body" testID={`saju-today-l${i + 1}`}>
                {`· ${l}`}
              </AppText>
            ))}
          </View>
        ) : null}
        <Button label={IF5_TEXT['SAJU.today.go']} variant="secondary" onPress={() => router.push('/saju' as Href)} testID="saju-today-go" />
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.card.end']}</AppText>
        <Footnote text={IF5_TEXT['SAJU.card.footer']} testID="saju-today-footer" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s16 },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
});
void sajuStyles;
