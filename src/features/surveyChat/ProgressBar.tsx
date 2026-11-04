// 대화형 설문 진행 막대(QF2 Q2-10a · 디자인 2-1): 머리 바로 아래 칸 막대 한 줄 — 숫자 · 퍼센트 · '3/9' · 남은 개수 0.
//  지난 칸 accent · 지금 칸 accentAlt(높이 8 — 색과 높이 두 가지로 구분) · 남은 칸 line. 누르지 않는 장식(터치 0)이고 읽기 이름은 섹션 이름 하나(숫자를 읽지 않는다).
//  1부 = 섹션별 칸(FLOW_SECTIONS) · 2부 = 칸별(SLOT_ORDER). 위치를 못 읽으면(index < 0) 그리지 않는다 — 진행 표시는 부가 정보
import { StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '@/theme/tokens';

export function ProgressBar({ total, index, a11yLabel, testID = 'chat-progress' }: { total: number; index: number; a11yLabel: string; testID?: string }) {
  if (total < 1 || index < 0 || index >= total) return null;
  return (
    <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel={a11yLabel} testID={testID}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.cell, i < index ? styles.done : i === index ? styles.now : styles.rest]} testID={`${testID}-${i}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s4, height: size.barTrait, marginHorizontal: size.screenPadding, marginBottom: space.s8 },
  cell: { flex: 1, borderRadius: radius.pill },
  done: { height: size.barProgress, backgroundColor: colors.accent },
  now: { height: size.barTrait, backgroundColor: colors.accentAlt },
  rest: { height: size.barProgress, backgroundColor: colors.line },
});
