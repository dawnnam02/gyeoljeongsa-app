// T5 크레딧 · 내역(V5 W6 · 청사진 v5 초안 5장 돌려받기 · 6-1). 잔액 · 기한 없음 한 줄(D-200 ③) · 돌려받은 이유 · 회차별 내역 · 스토어 환불 안내.
//  · 크레딧은 탑승권 1장 = 1장(금액 글 0). 현금 환불은 스토어 절차 안내 한 줄(T-21)
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, size, space } from '@/theme/tokens';

import type { BoardingApi, CreditLoad } from './boardingApi';
import { BOARDING, CREDITS } from './boardingCopy';
import { hrefOf } from './BoardingScreen';

const KST = 9 * 3_600_000;
const dateText = (ms: number) => {
  const d = new Date(ms + KST);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

export function CreditScreen({ deps }: { deps: { api: Pick<BoardingApi, 'ledger'> } }) {
  const router = useRouter();
  const [load, setLoad] = useState<CreditLoad | null>(null);
  const read = () => void deps.api.ledger().then(setLoad);
  useEffect(() => {
    let alive = true;
    void deps.api.ledger().then((l) => alive && setLoad(l));
    return () => {
      alive = false;
    };
  }, [deps]);
  const back = () => (router.canGoBack() ? router.back() : router.replace(hrefOf('/boarding')));

  return (
    <Screen edges={['top']} testID="screen-credits">
      <ScreenHeader title={CREDITS.headerTitle} onBack={back} testID="credits-header" />
      {load === null ? null : !load.ok ? (
        <View style={[styles.pad, styles.gap]} testID="credits-error">
          <AppText variant="body" tone="sub" accessibilityRole="alert">
            {CREDITS.failed}
          </AppText>
          <Button label={BOARDING.retry} variant="secondary" onPress={read} testID="credits-retry" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap]} testID="credits-scroll">
          <Card style={styles.gapSmall} testID="credits-balance-card">
            <AppText variant="caption">{CREDITS.balanceLabel}</AppText>
            <AppText variant="title" testID="credits-balance">
              {CREDITS.balance(load.balance)}
            </AppText>
            <AppText variant="caption">{CREDITS.note}</AppText>
            {/* D-200 ③: 끝나는 날 표시 없음 — '기한 없이' 한 줄(카피 14-7 CREDITS.noExpiry) */}
            <AppText variant="caption" testID="credits-no-expiry">
              {CREDITS.noExpiry}
            </AppText>
          </Card>
          <AppText variant="bodyBold" accessibilityRole="header">
            {CREDITS.historyTitle}
          </AppText>
          {load.items.length === 0 ? (
            <AppText variant="body" tone="sub" testID="credits-empty">
              {CREDITS.empty}
            </AppText>
          ) : (
            <View testID="credits-list">
              {load.items.map((x, i) => (
                <View key={`${x.at}-${i}`} style={[styles.row, i > 0 ? styles.line : null]} testID={`credits-row-${i}`}>
                  <View style={styles.flex}>
                    <AppText variant="body">{CREDITS.reasons[x.reason]}</AppText>
                    <AppText variant="caption">{[dateText(x.at), x.roundNo ? CREDITS.round(x.roundNo) : null].filter(Boolean).join(' · ')}</AppText>
                  </View>
                  <AppText variant="bodyMedium" tone={x.delta > 0 ? 'accent' : 'sub'} testID={`credits-row-${i}-delta`}>
                    {CREDITS.delta(x.delta)}
                  </AppText>
                </View>
              ))}
            </View>
          )}
          <AppText variant="caption" testID="credits-refund">
            {CREDITS.refund}
          </AppText>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: size.screenPadding, paddingTop: space.s16, paddingBottom: space.s40 },
  gap: { gap: space.s16 },
  gapSmall: { gap: space.s8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingVertical: space.s12 },
  line: { borderTopWidth: 1, borderColor: colors.line },
  flex: { flex: 1 },
});
