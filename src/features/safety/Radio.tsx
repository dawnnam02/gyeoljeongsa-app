// 하나만 고르는 동그라미(Figma 11c 227:3 사유 줄 왼쪽): 지름 20 · 선 1.5. 꺼짐 = sub 선, 켜짐 = accent 선 + 가운데 accent 점 10.
// 그림만 그린다. 누르는 일은 줄 전체(공통 Pressable, role radio)가 한다.
import { StyleSheet, View } from 'react-native';

import { layout } from '@/theme/layout';
import { colors, radius } from '@/theme/tokens';

export function Radio({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.ring, { borderColor: checked ? colors.accent : colors.sub }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {checked ? <View style={styles.dot} /> : null}
    </View>
  );
}

const DOT = layout.checkBox / 2;

const styles = StyleSheet.create({
  ring: { width: layout.checkBox, height: layout.checkBox, borderRadius: radius.pill, borderWidth: layout.checkBoxBorder, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: colors.accent },
});
