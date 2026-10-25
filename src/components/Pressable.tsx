// 누르는 모든 것(버튼 · 카드 · 탭)이 쓰는 공통 컴포넌트. react-native 의 Pressable · Touchable* 는 직접 쓰지 않는다(린트가 막는다).
// 규격 원본: 2안 '지면'(D42-M 명세 4-1 press · 5-3 · 7장, 앱 적용 D-176). 값은 theme/motion.ts 의 press 다(가이드 13장 옛 값 0.97 · 물결은 개정 대기).
//  ① scale  누르면 1 → 0.985(버튼 · 카드 · 칩) · 0.92(아이콘) 100ms std, 떼면 → 1 200ms edOut, 요소 가운데 기준
//  ② 덮개   요소 위에 text 색 덮개가 투명도 0 → 6% 로 100ms std, 떼면 200ms edOut 으로 0. filter(밝기)는 안드로이드에서만 돼서 쓰지 않는다. 퍼지는 물결은 2안에서 지웠다
//  어느 요소에 무엇을: 'both' = 크기 + 덮개(기본) · 'ripple' = 덮개만(탭 칸 — 이름은 옛 그대로) · 'scale' = 크기만(제 눌림 면이 있는 버튼 v3 · 카드) · 'none' = 없음
//  동작 줄이기(명세 7장): 크기 · 내려감 변화 0, 덮개(투명도)만
//  비활성(disabled): 컴포넌트 전체 40%, 눌러도 반응 없음. 단 offLook='own' 이면 투명도를 주지 않는다 — 버튼 v2 는 색으로 비활성을 그린다(가이드 4-4, F21)
// 주의: 덮개가 둥근 모서리 안에 머물도록 overflow 를 숨긴다(clip). clip=false 인 요소(버튼 v3)는 덮개 없이 크기만 쓴다.
import { useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable as NativePressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion } from '@/lib/reduceMotion';
import { rippleColor, withAlpha, type PressSurface } from '@/theme/color';
import { ease, press } from '@/theme/motion';
import { alpha, colors } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);
const nativeDriver = Platform.OS !== 'web';
const easeStd = Easing.bezier(...ease.std); // 누를 때
const easeUp = Easing.bezier(...ease.edOut); // 뗄 때

function animate(value: Animated.Value, toValue: number, duration: number, easing: (t: number) => number): void {
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: nativeDriver }).start();
}

// react-native 의 Pressable 처럼 눌린 동안의 모양을 함수로 줄 수 있다.
export type PressableStyle = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

// 어느 효과를 쓰나(가이드 10-3)
export type PressEffect = 'both' | 'scale' | 'ripple' | 'none';

export type AppPressableProps = Omit<PressableProps, 'style' | 'android_ripple' | 'children'> & {
  style?: PressableStyle;
  children?: ReactNode;
  effect?: PressEffect; // 기본 both(기본 버튼)
  surface?: PressSurface; // 이 요소의 면: light(기본) · accent(장미 면). systemRipple 일 때 Android 물결 색에만 쓴다
  systemRipple?: boolean; // Android 에서만: 덮개 대신 시스템 ripple. 기본 false
  scaleTo?: 'button' | 'card' | 'icon'; // 줄어드는 크기: 버튼 · 카드 0.985 · 아이콘 0.92
  offLook?: 'fade' | 'own'; // 비활성 모양: fade(기본, 전체 40%) · own(부르는 쪽이 색으로 그림 — 버튼 v2)
  pressShift?: number; // 눌리면 아래로 내려가는 거리(버튼 v3 A안 1px, D-141). 동작 줄이기면 0
  clip?: boolean; // 모양대로 자르기(기본 true). 물결 없이 그림자를 밖으로 보여야 하는 버튼 v3 는 false
};

export function Pressable({
  style,
  children,
  effect = 'both',
  surface = 'light',
  systemRipple = false,
  scaleTo,
  offLook = 'fade',
  pressShift = 0,
  clip = true,
  disabled,
  accessibilityRole = 'button',
  onPressIn,
  onPressOut,
  ...rest
}: AppPressableProps) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1)); // 몸통 크기
  const [shift] = useState(() => new Animated.Value(0)); // 몸통이 내려간 거리(버튼 v3)
  const [shade] = useState(() => new Animated.Value(0)); // 눌림 덮개 투명도(0 → 1, 색 자체가 text 6%)

  const withScale = effect === 'both' || effect === 'scale';
  const withShade = (effect === 'both' || effect === 'ripple') && clip;
  const useSystemRipple = withShade && systemRipple && Platform.OS === 'android';
  const overlay = withShade && !useSystemRipple;
  const pressScale = reduceMotion ? 1 : press[scaleTo ?? 'button'];

  const handlePressIn = (event: GestureResponderEvent) => {
    if (typeof style === 'function') setPressed(true);
    if (withScale && pressScale !== 1) animate(scale, pressScale, press.downMs, easeStd);
    if (pressShift !== 0 && !reduceMotion) animate(shift, pressShift, press.downMs, easeStd);
    if (overlay) animate(shade, 1, press.downMs, easeStd);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (typeof style === 'function') setPressed(false);
    if (withScale) {
      if (pressScale === 1) scale.setValue(1); // 누르는 도중 동작 줄이기가 켜졌어도 크기가 남지 않는다
      else animate(scale, 1, press.upMs, easeUp);
    }
    if (pressShift !== 0) {
      if (reduceMotion) shift.setValue(0);
      else animate(shift, 0, press.upMs, easeUp);
    }
    if (overlay) animate(shade, 0, press.upMs, easeUp);
    onPressOut?.(event);
  };

  const resolved = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={useSystemRipple ? { color: rippleColor(surface), borderless: false } : undefined}
      style={[resolved, clip ? styles.clip : null, disabled && offLook === 'fade' ? styles.disabled : null, { transform: pressShift !== 0 ? [{ translateY: shift }, { scale }] : [{ scale }] }]}>
      {children}
      {overlay ? <Animated.View style={[styles.overlay, { opacity: shade }]} /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  disabled: { opacity: alpha.disabled },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.text, press.overlay), pointerEvents: 'none' },
});
