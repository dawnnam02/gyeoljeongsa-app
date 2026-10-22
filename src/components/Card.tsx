// 카드 v2(D36 #13 · 가이드 4-4, F21): 두 가지로 정리 — 면(face, 기본) = card 채움 · 둥글기 16 / 종이(paper) = bg 채움 + line 1 선 · 둥글기 20(큰 카드: 추천 · 상점 큰 카드).
// 안 여백 20 · 그림자 없음(눌려도 없음, D-118 ③). 누르게 하려면 onPress 를 주면 공통 Pressable(scale 0.985)로 바뀐다.
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

import { Pressable } from './Pressable';

type Props = ViewProps & { onPress?: () => void; onPressIn?: () => void; variant?: 'face' | 'paper' };

export function Card({ onPress, onPressIn, style, children, variant = 'face', ...rest }: Props) {
  const look = variant === 'paper' ? styles.paper : styles.face;
  if (onPress) {
    return (
      <Pressable onPress={onPress} onPressIn={onPressIn} effect="scale" accessibilityLabel={rest.accessibilityLabel} testID={rest.testID} style={[styles.card, look, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} style={[styles.card, look, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.s20 },
  face: { backgroundColor: colors.card, borderRadius: radius.lg },
  paper: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line },
});
