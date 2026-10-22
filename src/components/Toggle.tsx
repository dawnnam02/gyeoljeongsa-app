// 토글 모양(가이드 4장 토글): 트랙 폭 44 · 높이 24 · pill. 꺼짐 = line 트랙, 켜짐 = accent 트랙, 손잡이 = bg(크림) 20 × 20 · 둘레 2.
// 누르는 동안 손잡이는 가로 24 로 늘어난다(가이드 10-3). 이 컴포넌트는 그림이고, 누르는 일은 공통 Pressable 을 가진 줄(ToggleRow)이 한다.
// 움직임 v2(D25 10-4 '스위치' · F21): 켜고 끄면 손잡이가 150(std)로 미끄러지고 바탕색이 150 으로 바뀐다. 저장에 실패해 원래로 돌아갈 때(누른 지 0.4초 넘어 바뀜)는 250 으로 되돌아간다.
//  동작 줄이기: 손잡이는 바로 옮기고 색만 150. 비활성(잠금)은 부모가 정한다.
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { curve, scene, useReduceMotion } from '@/motion';
import { colors, radius, size } from '@/theme/tokens';

type Props = { on: boolean; pressed?: boolean; testID?: string };

const GAP = (size.toggleH - size.toggleThumb) / 2; // 손잡이 둘레 2
const REVERT_AFTER_MS = 400; // 누른 뒤 이만큼 지나 바뀌면 저장 실패 되돌림으로 본다

export function Toggle({ on, pressed = false, testID }: Props) {
  const reduce = useReduceMotion();
  const thumbWidth = pressed ? size.toggleThumbPressed : size.toggleThumb;
  const travel = size.toggleW - GAP * 2 - thumbWidth;
  const x = useSharedValue(on ? travel : 0);
  const fill = useSharedValue(on ? 1 : 0);
  const pressedAt = useRef(0);

  useEffect(() => {
    if (pressed) pressedAt.current = Date.now();
  }, [pressed]);

  useEffect(() => {
    const revert = pressedAt.current > 0 && Date.now() - pressedAt.current > REVERT_AFTER_MS;
    const duration = revert ? scene.toggle.revert : scene.toggle.slide;
    fill.set(withTiming(on ? 1 : 0, { duration, easing: curve('std') }));
    if (reduce) x.set(on ? travel : 0);
    else x.set(withTiming(on ? travel : 0, { duration: pressed ? scene.toggle.press : duration, easing: curve('std') }));
  }, [on, travel, pressed, reduce, x, fill]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const accent = useAnimatedStyle(() => ({ opacity: fill.get() }));
  return (
    <View testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.track}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.accent, accent]} />
      <Animated.View style={[styles.thumb, { width: thumbWidth }, thumb]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: size.toggleW, height: size.toggleH, borderRadius: radius.pill, padding: GAP, justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', backgroundColor: colors.line }, // 켜짐 accent 는 위 덮개의 투명도로(150)
  accent: { backgroundColor: colors.accent, borderRadius: radius.pill },
  thumb: { height: size.toggleThumb, borderRadius: radius.pill, backgroundColor: colors.bg },
});
