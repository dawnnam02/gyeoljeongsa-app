// [1] 오늘의 한 분 강조 표시(09 카드 안, K12 2-1 · 1-D1). 받는 것은 불리언 하나(featured)뿐이다 — 숫자 · 차례 · 개수는 받지도 그리지도 않는다(K12 1-06).
//  · featured=false 면 아무것도 그리지 않는다(강조 없는 날 · 호감 보냄 · 넘김 카드)
//  · 모양: 작은 표시 자리(mark) + 라벨 한 줄(accent). 카드 면은 FEATURED_CARD_STYLE(accentSoft)을 부모 카드에 더한다. 사진 · 이름 줄 · 한 줄 정보는 다른 카드와 같다
//  · 표시 자리(mark)는 2단계에 A안 로고 타일(D-76)을 넣는다. F17 이 로고 타일을 만드는 중이라 1단계는 비워 둔다(꾸밈이라 스크린리더는 건너뛴다)
//  · 시계 · 남은 시간 · 깜빡임 · 진동 없음(K12 1-08). 움직임은 D25 '등장'만 — 2단계에서 F17 의 움직임 토큰으로
//  · 글은 키 자리(content/v4Wave01Copy.ts, 1단계 임시)
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { V4W01 } from '@/content/v4Wave01Copy';
import { colors, space } from '@/theme/tokens';

type Props = { featured: boolean; mark?: ReactNode; testID?: string };

export function FeaturedLabel({ featured, mark, testID = 'featured-label' }: Props) {
  if (featured !== true) return null;
  return (
    <View style={styles.row} testID={testID}>
      {mark ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`${testID}-mark`}>
          {mark}
        </View>
      ) : null}
      <AppText variant="captionMedium" tone="accent" numberOfLines={2} style={styles.text} testID={`${testID}-text`}>
        {V4W01.featured.label}
      </AppText>
    </View>
  );
}

// 강조 카드의 면(연한 와인 톤). 부모 카드 style 배열에 더한다: style={[styles.card, look ? FEATURED_CARD_STYLE : null]}
export const FEATURED_CARD_STYLE = StyleSheet.create({ card: { backgroundColor: colors.accentSoft } }).card;

// 강조 카드의 접근성 이름(NF1-02). 이름 줄을 받는다
export const featuredA11y = (head: string): string => V4W01.featured.a11y(head);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  text: { flexShrink: 1 },
});
