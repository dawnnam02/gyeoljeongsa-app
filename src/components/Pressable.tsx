// 누르는 모든 것(버튼 · 카드 · 탭)이 쓰는 공통 컴포넌트. react-native 의 Pressable · Touchable* 는 직접 쓰지 않는다(린트가 막는다).
// 규격 원본: 디자인/가이드.md 10장(D10) · 13장(D38, F17). 값은 tokens.ts 의 motion · alpha.ripple 이다.
//  ① scale  누르면 1 → 0.97(버튼 · 칩 · 단추) · 0.985(카드 · 목록 줄) 100ms, 떼면 → 1 100ms, std 곡선, 요소 가운데 기준
//  ② ripple 요소 가운데서 원이 지름 0 → 대각선까지 250ms 퍼지고, 다 퍼지고 손가락도 뗀 뒤 150ms 동안 사라진다. 요소 모양대로 자르고 농도 20%
//           iOS · 웹 · Android 모두 위 원을 직접 그린다(팀장 결정 2026-10-14, 본인 지시 "가운데를 중심으로").
//           Android 시스템 android_ripple 은 시작점을 손가락 자리로 정해서 '가운데'가 아니다. 쓰려면 systemRipple 을 준다(기본 꺼짐).
//  어느 요소에 무엇을(10-3): 기본 버튼 both · 탭 칸 ripple · 카드 scale · 그 밖 none
//  동작 줄이기(10-4 · D-124): scale 은 하지 않고, ripple 은 크기 변화 없이 투명도만 — 원은 처음부터 요소를 다 덮고 75ms 나타남 · 75ms 사라짐(합 150), 농도는 그대로
//  비활성(disabled): 컴포넌트 전체 40%, 눌러도 반응 없음. 단 offLook='own' 이면 투명도를 주지 않는다 — 버튼 v2 는 색으로 비활성을 그린다(가이드 4-4, F21)
// 주의: 퍼지는 원이 둥근 모서리 안에 머물도록 overflow 를 숨긴다. 이 컴포넌트 밖으로 삐져나오는 장식은 두지 않는다.
import { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable as NativePressable,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion } from '@/lib/reduceMotion';
import { rippleColor, type PressSurface } from '@/theme/color';
import { alpha, motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);
const nativeDriver = Platform.OS !== 'web';
const easeOut = Easing.bezier(...motion.easeOut); // ripple
const easeStd = Easing.bezier(...motion.pressEase); // 눌림(13장)

function animate(value: Animated.Value, toValue: number, duration: number, delay = 0, easing = easeOut): void {
  Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: nativeDriver }).start();
}

// react-native 의 Pressable 처럼 눌린 동안의 모양을 함수로 줄 수 있다.
export type PressableStyle = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

// 어느 효과를 쓰나(가이드 10-3)
export type PressEffect = 'both' | 'scale' | 'ripple' | 'none';

export type AppPressableProps = Omit<PressableProps, 'style' | 'android_ripple' | 'children'> & {
  style?: PressableStyle;
  children?: ReactNode;
  effect?: PressEffect; // 기본 both(기본 버튼)
  surface?: PressSurface; // 이 요소의 면: light(기본, 장미 20%가 퍼진다) · accent(장미 면이라 흰색 20%가 퍼진다)
  systemRipple?: boolean; // Android 에서만: 원 대신 시스템 ripple. 기본 false(Android 도 가운데서 퍼지는 원)
  scaleTo?: 'button' | 'card'; // 줄어드는 크기: button 0.97 · card 0.985. 기본은 effect 'scale'(카드 · 목록 줄)이면 card, 그 밖은 button
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
  onLayout,
  ...rest
}: AppPressableProps) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [scale] = useState(() => new Animated.Value(1)); // 몸통 크기
  const [shift] = useState(() => new Animated.Value(0)); // 몸통이 내려간 거리(버튼 v3)
  const [spread] = useState(() => new Animated.Value(0)); // 퍼지는 원의 크기(대각선 지름의 몇 배인가)
  const [fade] = useState(() => new Animated.Value(0)); // 퍼지는 원의 투명도
  const pressedAt = useRef(0);

  const withScale = effect === 'both' || effect === 'scale';
  const withRipple = effect === 'both' || effect === 'ripple';
  const useSystemRipple = withRipple && systemRipple && Platform.OS === 'android';
  const circle = withRipple && !useSystemRipple;
  const spreadMs = reduceMotion ? motion.reduced.rippleMs : motion.rippleSpreadMs; // 동작 줄이기: 퍼짐 대신 나타남(투명도)
  const fadeOutMs = reduceMotion ? motion.reduced.rippleMs : motion.rippleFadeMs;
  const size = scaleTo ?? (effect === 'scale' ? 'card' : 'button');
  const pressScale = reduceMotion ? motion.reduced.pressScale : size === 'card' ? motion.pressScaleCard : motion.pressScale;
  const color = rippleColor(surface);

  const handlePressIn = (event: GestureResponderEvent) => {
    if (typeof style === 'function') setPressed(true);
    if (withScale && pressScale !== 1) animate(scale, pressScale, motion.pressInMs, 0, easeStd);
    if (pressShift !== 0 && !reduceMotion) animate(shift, pressShift, motion.pressInMs, 0, easeStd);
    if (circle) {
      pressedAt.current = Date.now();
      if (reduceMotion) {
        // 동작 줄이기(D-124): 원은 늘 다 덮는 크기(아래 transform 이 1 고정), 투명도만 0 → 1
        fade.setValue(0);
        animate(fade, 1, spreadMs);
      } else {
        spread.setValue(0);
        fade.setValue(1);
        animate(spread, 1, spreadMs);
      }
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    if (typeof style === 'function') setPressed(false);
    if (withScale) {
      if (pressScale === 1) scale.setValue(1); // 누르는 도중 동작 줄이기가 켜졌어도 크기가 남지 않는다
      else animate(scale, 1, motion.pressOutMs, 0, easeStd);
    }
    if (pressShift !== 0) {
      if (reduceMotion) shift.setValue(0);
      else animate(shift, 0, motion.pressOutMs, 0, easeStd);
    }
    if (circle) {
      // 다 퍼지고 손가락도 뗀 뒤에 사라진다: 퍼짐이 남은 만큼 기다렸다가 투명해진다
      const wait = Math.max(0, spreadMs - (Date.now() - pressedAt.current));
      animate(fade, 0, fadeOutMs, wait);
    }
    onPressOut?.(event);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    if (circle) {
      const { width, height } = event.nativeEvent.layout;
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }
    onLayout?.(event);
  };

  const resolved = typeof style === 'function' ? style({ pressed }) : style;
  const diagonal = Math.hypot(box.width, box.height); // 모서리까지 덮는 지름

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={handleLayout}
      android_ripple={useSystemRipple ? { color, borderless: false } : undefined}
      style={[resolved, clip ? styles.clip : null, disabled && offLook === 'fade' ? styles.disabled : null, { transform: pressShift !== 0 ? [{ translateY: shift }, { scale }] : [{ scale }] }]}>
      {circle ? (
        <Animated.View
          style={[
            styles.circle,
            {
              width: diagonal,
              height: diagonal,
              borderRadius: diagonal / 2,
              left: (box.width - diagonal) / 2,
              top: (box.height - diagonal) / 2,
              backgroundColor: color,
              opacity: fade,
              transform: [{ scale: reduceMotion ? 1 : spread }], // 동작 줄이기면 크기 고정(D-124)
            },
          ]}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  disabled: { opacity: alpha.disabled },
  circle: { position: 'absolute', pointerEvents: 'none' },
});
