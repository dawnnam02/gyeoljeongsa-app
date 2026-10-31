// IF-MILE-LOG 내역(IF5-F2 ⑨ · 화면 요구 IF-MILE-LOG · 정책 PS-43 · 디자인 MI-2 · 카피 24-10 `MILEAGE.log.*`).
//  · 위: 잔액 · 무료 / 산 분 · 쓰는 차례 한 줄('무료 마일리지가 먼저 쓰여요. 쓰고 나면 돌려받을 수 없어요.') → 날짜순 목록(날짜 · 종류 · +/− 수 · 무료/산 분 표시) → '더 오래된 내역'(한 번에 한 묶음 · 무한 스크롤 0) → [충전하기]
//  · 탑승 적립은 앱을 열었을 때 이 목록에서만 확인한다(푸시 0). 'n주 연속' · 모은 합계 · 순위 · 배지 0. 숫자는 서버 내역 응답 그대로(앱이 합산하지 않는다)
//  · 빈 내역 '아직 내역이 없어요' · 불러오기 실패 한 줄 + [다시 시도]
import { Redirect, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { IF5_TEXT } from '@/content/if5Copy';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { colors, radius, space } from '@/theme/tokens';

import type { HistoryItem } from './mileageApi';
import { bucketOf, fmt, KIND_KEY, logDate, signed, splitLine, usedKey } from './mileageLogic';
import { mileageServices, type MileageDeps } from './mileageService';
import { MILEAGE_HREF } from './MileageScreen';
import { useMileageHistory, useMileageState } from './useMileage';

export function MileageLogScreen({ deps }: { deps?: MileageDeps }) {
  return deps ? <Log deps={deps} /> : <LogWithDefaults />;
}
function LogWithDefaults() {
  const { flags, isOn } = useFeatureFlags();
  const svc = mileageServices();
  const deps = useMemo(() => ({ ...svc, isOn }), [svc, isOn]);
  if (flags.loaded && !isOn('mileage')) return <Redirect href={'/boarding' as Href} />;
  return <Log deps={deps} />;
}

export function rowLabel(it: HistoryItem): { kind: string; sub: string | null } {
  const kind = IF5_TEXT[KIND_KEY[it.kind]];
  const uk = it.kind === 'use' ? usedKey(it.feature) : null;
  return { kind, sub: uk ? IF5_TEXT[uk] : null };
}

function Log({ deps }: { deps: MileageDeps }) {
  const router = useRouter();
  const { slot: bal } = useMileageState(deps.api);
  const { slot, older, retry } = useMileageHistory(deps.api);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  return (
    <Screen edges={['top']} testID="screen-mileage-log">
      <ScreenHeader title={IF5_TEXT['MILEAGE.log.title']} onBack={back} testID="mileage-log-header" />
      <ScrollView contentContainerStyle={styles.body} testID="mileage-log-scroll">
        {bal.kind === 'ready' ? (
          <View style={styles.card} testID="mileage-log-balance">
            <AppText variant="caption">{IF5_TEXT['MILEAGE.shop.balance']}</AppText>
            <AppText variant="title" testID="mileage-log-total">
              {fmt(bal.state.total)}
            </AppText>
            <AppText variant="caption" testID="mileage-log-split">
              {splitLine(bal.state.free, bal.state.paid)}
            </AppText>
          </View>
        ) : null}
        <AppText variant="caption" testID="mileage-log-order">
          {IF5_TEXT['MILEAGE.log.order']}
        </AppText>
        {slot.kind === 'loading' ? (
          <View style={styles.card} accessible accessibilityLabel={IF5_TEXT['SAJU.status.loadLab']} testID="mileage-log-loading">
            <View style={[styles.skel, styles.skelWide]} />
            <View style={styles.skel} />
            <View style={styles.skel} />
          </View>
        ) : null}
        {slot.kind === 'fail' ? (
          <View style={styles.card} testID="mileage-log-fail">
            <AppText variant="bodyBold" accessibilityRole="alert">
              {IF5_TEXT['SAJU.status.balanceFailed']}
            </AppText>
            {slot.code === 'feature_off' || slot.code === 'forbidden' ? null : <Button label={IF5_TEXT['SAJU.status.retry']} variant="secondary" onPress={retry} testID="mileage-log-retry" />}
          </View>
        ) : null}
        {slot.kind === 'ready' && slot.items.length === 0 ? (
          <AppText variant="body" testID="mileage-log-empty">
            {IF5_TEXT['MILEAGE.log.empty']}
          </AppText>
        ) : null}
        {slot.kind === 'ready' && slot.items.length > 0 ? (
          <View style={styles.list} testID="mileage-log-list">
            {slot.items.map((it) => {
              const l = rowLabel(it);
              const tag = bucketOf(it.kind);
              return (
                <View key={it.id} style={styles.item} accessible accessibilityLabel={`${logDate(it.at)}, ${l.kind}${l.sub ? ` ${l.sub}` : ''}, ${signed(it.amount)}`} testID={`mileage-log-item-${it.id}`}>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium" testID={`mileage-log-kind-${it.id}`}>
                      {l.sub ? `${l.kind} · ${l.sub}` : l.kind}
                    </AppText>
                    <AppText variant="caption">
                      {logDate(it.at)}
                      {tag ? ` · ${tag === 'free' ? IF5_TEXT['MILEAGE.log.tagFree'] : IF5_TEXT['MILEAGE.log.tagPaid']}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="bodyBold" testID={`mileage-log-amount-${it.id}`}>
                    {signed(it.amount)}
                  </AppText>
                </View>
              );
            })}
            {slot.next !== null ? <TextButton label={IF5_TEXT['MILEAGE.log.older']} align="start" disabled={slot.more} onPress={older} testID="mileage-log-older" /> : null}
          </View>
        ) : null}
        <Button label={IF5_TEXT['MILEAGE.log.charge']} variant="secondary" onPress={() => router.replace(MILEAGE_HREF as Href)} testID="mileage-log-charge" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.s20, gap: space.s16, paddingBottom: space.s32 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, gap: space.s8 },
  list: { gap: space.s8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: space.s8 },
  flex: { flex: 1 },
  skel: { height: 14, borderRadius: radius.sm, backgroundColor: colors.line, width: '60%' },
  skelWide: { width: '85%' },
});
