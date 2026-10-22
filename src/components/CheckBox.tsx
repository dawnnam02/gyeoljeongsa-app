// 체크 칸 그림(03 동의). 누르는 일은 이 그림을 담은 줄(Pressable)이 한다.
// 치수 · 색: 디자인/figma_화면목록.md 'D7 값' 표 — 20×20 · 둥글기 5 · 선 1.5.
//   해제: 면 bg · 선 sub   /   체크: 면 accent · 선 accent · 안에 체크 16×16(흰색)
//   강조(필수인데 비어 있음, 눌렀을 때 이유 문구와 함께): 선 accent · 면 tint
import { Image, StyleSheet, View } from 'react-native';

import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { tintAccent } from '@/theme/color';
import { colors } from '@/theme/tokens';

type Props = { checked: boolean; emphasized?: boolean };

export function CheckBox({ checked, emphasized = false }: Props) {
  return (
    <View style={[styles.box, checked ? styles.checked : emphasized ? styles.emphasized : styles.empty]}>
      {checked ? <Image source={UI_ICONS.check} style={styles.icon} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: layout.checkBox,
    height: layout.checkBox,
    borderRadius: layout.checkBoxRadius,
    borderWidth: layout.checkBoxBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { backgroundColor: colors.bg, borderColor: colors.sub },
  emphasized: { backgroundColor: tintAccent, borderColor: colors.accent },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  icon: { width: layout.checkIcon, height: layout.checkIcon, tintColor: colors.onAccent },
});
