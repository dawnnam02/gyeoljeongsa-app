// 호감 보내기(D25 장면 4)의 작은 편지 한 통: 버튼 위에서 나타나 위로 떠나며 사라진다(시제품 keyframes mail 700ms ease-out —
//  0% 투명 · -6° · 0.9배 → 20% 보임 → 100% 위로 120px · 4° · 0.95배 · 투명). 그림은 react-native-svg(카드 면 · 선 색 봉투 + 와인 점), 색은 토큰만.
//  동작 줄이기: 편지는 나오지 않는다(시제품 html.rm .mailEl 숨김). onDone 은 움직임이 끝난 뒤(줄이기면 바로) 한 번 부른다.
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useReduceMotion } from '@/lib/reduceMotion';
import { scene } from '@/theme/motion';
import { colors, space } from '@/theme/tokens';

import { tween } from './primitives';

const W = 56;
const H = 40;

export function MailFly({ onDone, testID }: { onDone?: () => void; testID?: string }) {
  const reduce = useReduceMotion();
  const total = scene.like.mail;
  const o = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(-6);
  const sc = useSharedValue(0.9);
  useEffect(() => {
    // 끝 알림은 JS 타이머(움직임과 같은 시간) — 시험 환경에서도 같게 돈다
    const timer = setTimeout(() => onDone?.(), reduce ? 0 : total);
    if (!reduce) {
      o.set(withSequence(tween(1, total * 0.2), tween(0, total * 0.8)));
      rot.set(tween(4, total));
      sc.set(tween(0.95, total));
      ty.set(tween(-scene.like.mailRise, total));
    }
    return () => clearTimeout(timer);
  }, [reduce, total, o, ty, rot, sc, onDone]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: ty.get() }, { rotate: `${rot.get()}deg` }, { scale: sc.get() }] }));
  if (reduce) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.mail, animated]} testID={testID}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={1} y={1} width={W - 2} height={H - 2} rx={5} fill={colors.card} stroke={colors.line} />
        <Path d={`M2 3l26 20L${W - 2} 3`} fill="none" stroke={colors.line} />
        <Circle cx={W / 2} cy={23} r={6.5} fill={colors.accent} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mail: { position: 'absolute', right: space.s48 + space.s40, bottom: space.s8, width: W, height: H },
});
