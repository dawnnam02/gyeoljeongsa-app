// 왜 이 분인지 카드(QF2-B6 · Q2-01). T3 공개 순간(최대 3줄)과 10 상대 프로필(from=reveal, 최대 5줄)이 같은 부품 하나를 쓴다.
//  · 서버(pair_reasons)가 보낸 맞는 점 ID 중 줄이 있는 것만, 서버가 준 순서 그대로 위에서부터. 줄이 없는 ID(지역 · 종교 · 돈 · 집안)는 서버가 보내도 그리지 않는다
//  · 줄이 0개면 카드째 없다(빈 카드 · '이유 없음' 글 0). 오류 · 불러오는 중 · 꺼짐도 카드 없음. 누르는 곳 0
//  · 점수 · 등급 · 순서 · 우열 · 퍼센트 말 0, 체크 표시 0(인증 배지로 읽힘) — 줄 앞 작은 점만
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { WHY } from '@/content/qf2Copy';
import { space } from '@/theme/tokens';

import { whyLines } from './recsLogic';

export function WhyCard({ ids, max, on = true, testID = 'why' }: { ids: readonly string[]; max: number; on?: boolean; testID?: string }) {
  const lines = on ? whyLines(ids, max) : [];
  if (lines.length === 0) return null;
  return (
    <Card style={styles.card} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {WHY.title}
      </AppText>
      {lines.map((line, i) => (
        <View key={line} style={styles.row}>
          <AppText variant="body" tone="sub" accessibilityElementsHidden importantForAccessibility="no">
            {'•'}
          </AppText>
          <AppText variant="body" style={styles.text} testID={`${testID}-line-${i}`}>
            {line}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s8 },
  row: { flexDirection: 'row', gap: space.s8 },
  text: { flex: 1 },
});
