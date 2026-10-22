// 로고 타일(D31 · D25 용어 줄): A안 앱 아이콘 그림(assets/icon/app-icon.png = 디자인/로고/최종/결정사_앱아이콘_1024.png)을 모서리 22.5% 로 둥글게 잘라 쓴다.
//  옛 '씰(밀랍 도장)'이 있던 세 자리 — 스플래시(104) · 서로 수락 순간(48) · 구매 완료(48) — 에 같은 타일이 '찍힌다'.
//  찍힘(시제품 keyframes sealStamp 700ms ease-out): 위 26px · 1.2배 · -6° 에서 투명 → 50% 에 제자리 0.92배 · 보임 → 72% 1.04배 → 1. 퍼짐 고리는 300ms 뒤 700ms(0.4 → 0, 0.95 → 1.7배)
//  동작 줄이기: 투명도만 150ms, 퍼짐 고리 없음
import { useEffect } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { LOGO_TILE_RADIUS, scene } from '@/theme/motion';
import { colors } from '@/theme/tokens';
import { BRAND } from '@/theme/uiAssets';

import { fadeIn, tween } from './primitives';

type TileProps = { size: number; style?: StyleProp<ViewStyle>; testID?: string };

export function LogoTile({ size, style, testID }: TileProps) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * LOGO_TILE_RADIUS }, styles.clip, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <Image source={BRAND.tile} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

// 찍히는 로고 타일. delay 뒤 시작, play=false 면 처음부터 놓여 있다
export function StampTile({ size, delay = 0, play = true, ripple = false, style, testID }: TileProps & { delay?: number; play?: boolean; ripple?: boolean }) {
  const reduce = useReduceMotion();
  const total = scene.splash.stamp; // hero 700
  const a = Math.round(total * 0.5);
  const b = Math.round(total * 0.22);
  const c = total - a - b;
  const move = play && !reduce; // 동작 줄이기면 처음부터 제자리(투명도만 바뀐다)
  const o = useSharedValue(play ? 0 : 1);
  const ty = useSharedValue(move ? -26 : 0);
  const rot = useSharedValue(move ? -6 : 0);
  const sc = useSharedValue(move ? 1.2 : 1);
  const ro = useSharedValue(0); // 퍼짐 고리 투명도
  const rs = useSharedValue(0.95);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      ty.set(0);
      rot.set(0);
      sc.set(1);
      fadeIn(o);
      return;
    }
    o.set(withDelay(delay, tween(1, a)));
    ty.set(withDelay(delay, tween(0, a)));
    rot.set(withDelay(delay, tween(0, a)));
    sc.set(withDelay(delay, withSequence(tween(0.92, a), tween(1.04, b), tween(1, c))));
    if (ripple) {
      ro.set(withDelay(delay + scene.splash.rippleDelay, withSequence(tween(0.4, 1), tween(0, total))));
      rs.set(withDelay(delay + scene.splash.rippleDelay, tween(1.7, total)));
    }
  }, [play, reduce, delay, ripple, a, b, c, total, o, ty, rot, sc, ro, rs]);
  const tile = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: ty.get() }, { rotate: `${rot.get()}deg` }, { scale: sc.get() }] }));
  const ring = useAnimatedStyle(() => ({ opacity: ro.get(), transform: [{ scale: rs.get() }] }));
  return (
    <View style={[{ width: size, height: size }, style]} testID={testID}>
      {ripple && !reduce ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: size * LOGO_TILE_RADIUS }, ring]} /> : null}
      <Animated.View style={tile}>
        <LogoTile size={size} testID={testID ? `${testID}-tile` : undefined} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', backgroundColor: colors.accent },
  fill: { width: '100%', height: '100%' },
  ring: { borderWidth: 2, borderColor: colors.accentAlt },
});
