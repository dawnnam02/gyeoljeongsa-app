// 행 오른쪽 위 ⋯ 버튼(11 행 · Figma 11 195:4): 누르는 면 44 × 44, 스크린리더 이름 "더보기"(N33). 누르면 부모가 ReportBlockSheet 를 연다(F6 이 쓴다).
import { StyleSheet, View } from 'react-native';

import { Pressable } from '@/components/Pressable';
import { REPORT_SHEET } from '@/content/copy';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

const DOT = space.s4;

export function MoreButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityLabel={REPORT_SHEET.moreA11y} onPress={onPress} effect="none" testID={testID} style={({ pressed }) => [styles.touch, pressed && styles.pressed]}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: alpha.pressed },
  dots: { flexDirection: 'row', gap: DOT / 2 + 1 },
  dot: { width: DOT + 1, height: DOT + 1, borderRadius: radius.pill, backgroundColor: colors.text },
});
