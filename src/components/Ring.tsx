// 도는 원(로딩 링): 바탕 원은 line 토큰, 호(90도)는 accent. 06 AI 정리 중(96)과 스플래시(24)가 같은 부품을 쓴다.
// 팀장 결정(D8 2차): 바탕 색은 accent 20% 가 아니라 line 으로 Figma 와 통일, 호는 accent 유지.
// 동작: 호가 가운데를 중심으로 시계 방향으로 1회전 900ms · 등속 · 무한(스플래시 규격 D15 3장). 시스템 '동작 줄이기'가 켜져 있으면 돌지 않고 12시 방향에 멈춘 채 보인다.
// 그림일 뿐이라 스크린리더에는 숨긴다(안내는 이 부품 옆의 글이 한다).
// 3부-사(검수 Q9-N5 · 웹점검_f1f3_원인 1장): RN Animated(useNativeDriver)는 웹에서 네이티브 모듈이 없어 JS 대체 경로로 떨어지고 호의 transform 을 다시 쓰지 않아
//  웹에서 링이 거의 멈춰 있었다 → 다른 움직임(Skeleton · Button)과 같은 Reanimated(withRepeat)로 돌린다. 네이티브 · 웹 같은 코드
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { colors, radius } from '@/theme/tokens';

export const RING_TURN_MS = 900;

type Props = { size: number; stroke: number; testID?: string };

export function Ring({ size, stroke, testID }: Props) {
  const reduced = useReduceMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(turn);
    turn.set(0);
    if (reduced) return undefined;
    turn.set(withRepeat(withTiming(1, { duration: RING_TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduced, turn]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  const box = { width: size, height: size, borderRadius: radius.pill, borderWidth: stroke };
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <View style={[box, { borderColor: colors.line }]} />
      <Animated.View
        testID={testID ? `${testID}-arc` : undefined}
        style={[StyleSheet.absoluteFill, box, { borderColor: 'transparent', borderTopColor: colors.accent }, spin]}
      />
    </View>
  );
}
