// 공개 범위 토글 한 줄(Figma 3:264 'row'): 높이 56 · 왼쪽 이름 · 오른쪽 토글 · 줄 사이 line 1px.
// 줄 전체가 공통 Pressable 이라 터치 영역이 줄 높이(56)다. 구간 항목은 이름 아래에 "구간으로만 보여요"를 보인다.
// 잠긴 줄(답하지 않은 항목)은 꺼짐 · 전체 40% 이고 누르면 이유(N15)를 보이도록 부모가 onPress 를 받는다.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Pressable } from '@/components/Pressable';
import { Toggle } from '@/components/Toggle';
import { haptic } from '@/motion';
import { PROFILE_DRAFT } from '@/content/copy';
import { alpha, colors, size, space } from '@/theme/tokens';

type Props = {
  label: string;
  on: boolean;
  locked: boolean;
  range: boolean; // 구간 공개 항목
  last: boolean;
  onPress: () => void;
  a11yLabel?: string; // IF2-F '같은 취미' 줄: 읽기 이름이 줄 이름과 다름(카피 21-17 PROFILE.sameHobby.a11y)
  testID?: string;
};

export function ToggleRow({ label, on, locked, range, last, onPress, a11yLabel, testID }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={a11yLabel ?? (range ? `${label}, ${PROFILE_DRAFT.rangeNote}` : label)}
      accessibilityState={{ checked: on, disabled: locked }}
      accessibilityValue={{ text: on ? PROFILE_DRAFT.toggleOn : PROFILE_DRAFT.toggleOff }}
      aria-checked={on}
      aria-disabled={locked}
      onPress={() => {
        if (!locked) haptic.selection(); // 스위치를 바꿈(D25 10-5 새 자리)
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      effect="none"
      testID={testID}
      style={[styles.row, !last && styles.divider]}>
      <View style={styles.texts}>
        <AppText variant="body">{label}</AppText>
        {range ? <AppText variant="caption">{PROFILE_DRAFT.rangeNote}</AppText> : null}
      </View>
      <View style={locked ? styles.locked : null}>
        <Toggle on={on} pressed={pressed && !locked} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  locked: { opacity: alpha.disabled }, // QP-16: 잠긴 줄은 스위치만 흐리게 — 글(이름 · '구간으로만 보여요')은 그대로 읽히게(대비 4.5 이상)
  texts: { flex: 1 },
});
