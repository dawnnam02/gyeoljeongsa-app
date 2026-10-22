// 움직임 바탕 부품(F17 · D25). 값은 theme/motion.ts 한 곳, 움직이는 속성은 transform · opacity 만(D25 6장). Reanimated 4 + React Compiler 라 공유 값은 get() · set() 으로만 읽고 쓴다.
//  동작 줄이기(OS 설정, lib/reduceMotion 이 바뀌어도 따라감)가 켜지면 이동 · 크기 · 기울기 없이 투명도만 150ms(D25 5장).
//  부품: Rise(아래 · 옆에서 올라오며 나타남) · Land(카드가 편지처럼 놓임) · Fade(투명도만)
import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { dist, dur, ease, reduced, scene, staggerDelay, type EaseName } from '@/theme/motion';

export const curve = (name: EaseName) => {
  const [x1, y1, x2, y2] = ease[name];
  return Easing.bezier(x1, y1, x2, y2);
};
export const tween = (to: number, duration: number, name: EaseName = 'out') => withTiming(to, { duration, easing: curve(name) });
// 동작 줄이기 때 나타남(투명도만 150ms)
export const fadeIn = (o: SharedValue<number>) => o.set(withTiming(1, { duration: reduced.fadeMs, easing: curve('std') }));

type Base = { style?: StyleProp<ViewStyle>; children?: ReactNode; testID?: string; pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only' };

// 올라오며 나타남(riseSmall 8 · riseIn 16 · 옆 넘김 40). play 가 false 면 처음부터 보인다(움직임 없음)
export function Rise({ delay = 0, distance = dist.s, duration = dur.base, axis = 'y', play = true, style, children, testID, pointerEvents }: Base & { delay?: number; distance?: number; duration?: number; axis?: 'x' | 'y'; play?: boolean }) {
  const reduce = useReduceMotion();
  const move = play && !reduce; // 동작 줄이기면 처음부터 제자리(투명도만 바뀐다)
  const o = useSharedValue(play ? 0 : 1);
  const t = useSharedValue(move ? distance : 0);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      t.set(0);
      fadeIn(o);
      return;
    }
    o.set(withDelay(delay, tween(1, duration)));
    t.set(withDelay(delay, tween(0, duration)));
  }, [play, reduce, delay, duration, o, t]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get(), transform: axis === 'x' ? [{ translateX: t.get() }] : [{ translateY: t.get() }] }));
  return (
    <Animated.View style={[style, animated]} testID={testID} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// 카드가 놓임(시제품 keyframes land 520ms ease-out): 오른쪽 위(10, -30)에서 살짝 기울어(3° 안) 들어와 55% 에 3px 지나쳤다가 제자리. index 로 70ms 차례 · 기울기
export function Land({ index = 0, delay = 0, play = true, style, children, testID }: Base & { index?: number; delay?: number; play?: boolean }) {
  const reduce = useReduceMotion();
  const tilt = scene.today.tilts[index % scene.today.tilts.length];
  const first = Math.round(scene.today.land * 0.55);
  const rest = scene.today.land - first;
  const move = play && !reduce;
  const o = useSharedValue(play ? 0 : 1);
  const tx = useSharedValue(move ? 10 : 0);
  const ty = useSharedValue(move ? -30 : 0);
  const rot = useSharedValue(move ? tilt : 0);
  const sc = useSharedValue(move ? 0.97 : 1);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      tx.set(0);
      ty.set(0);
      rot.set(0);
      sc.set(1);
      fadeIn(o);
      return;
    }
    const wait = delay + staggerDelay(index);
    o.set(withDelay(wait, tween(1, first)));
    tx.set(withDelay(wait, tween(0, first)));
    sc.set(withDelay(wait, tween(1, first)));
    ty.set(withDelay(wait, withSequence(tween(3, first), tween(0, rest))));
    rot.set(withDelay(wait, withSequence(tween(tilt * -0.18, first), tween(0, rest))));
  }, [play, reduce, index, delay, tilt, first, rest, o, tx, ty, rot, sc]);
  const animated = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { rotate: `${rot.get()}deg` }, { scale: sc.get() }],
  }));
  return (
    <Animated.View style={[style, animated]} testID={testID}>
      {children}
    </Animated.View>
  );
}

// 투명도만(덮개 · 걷힘). to 로 갈 때 duration · curve
export function Fade({ visible, duration = dur.base, delay = 0, name = 'std', style, children, testID, pointerEvents }: Base & { visible: boolean; duration?: number; delay?: number; name?: EaseName }) {
  const reduce = useReduceMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withDelay(reduce ? 0 : delay, withTiming(visible ? 1 : 0, { duration: reduce ? reduced.fadeMs : duration, easing: curve(name) })));
  }, [visible, reduce, delay, duration, name, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[style, animated]} testID={testID} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
