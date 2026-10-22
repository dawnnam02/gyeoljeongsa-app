// 스켈레톤(D25 장면 6): 화면 전체를 불러올 때만, 실제 카드와 같은 틀(사진 96×120 · 이름 · 한 줄 · 맞는 점 · 칩 3). 한 조각(카드 하나)은 스피너.
//  반짝임은 은은하게 — 공유 값 하나로 뼈대 전체의 밝기를 1600ms 주기로 조금만 바꾼다(항목마다 따로 움직이지 않음). 동작 줄이기면 정지된 뼈대.
//  내용이 오면 부모가 뼈대를 걷고(150) 카드가 놓인다(Land).
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { layout } from '@/theme/layout';
import { scene } from '@/theme/motion';
import { colors, radius, size, space } from '@/theme/tokens';

import { tween } from './primitives';

const LOW = 0.45; // 밝기 변화는 작게(0.7 ↔ 0.45)
const HIGH = 0.7;

export function SkeletonPulse({ children, testID }: { children: ReactNode; testID?: string }) {
  const reduce = useReduceMotion();
  const o = useSharedValue(HIGH);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(o);
      o.set(HIGH);
      return undefined;
    }
    const half = scene.skeleton.shimmer / 2;
    o.set(withRepeat(withSequence(tween(LOW, half, 'std'), tween(HIGH, half, 'std')), -1));
    return () => cancelAnimation(o);
  }, [reduce, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={animated} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {children}
    </Animated.View>
  );
}

// 09 추천 카드 하나의 뼈대(카드와 같은 크기 · 간격)
export function SkeletonCard({ testID }: { testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={[styles.block, styles.photo]} />
      <View style={styles.info}>
        <View style={[styles.block, styles.line, styles.w80]} />
        <View style={[styles.block, styles.lineSmall, styles.w60]} />
        <View style={[styles.block, styles.lineSmall, styles.w30, styles.gapTop]} />
        <View style={styles.chips}>
          <View style={[styles.block, styles.chip]} />
          <View style={[styles.block, styles.chip]} />
          <View style={[styles.block, styles.chip]} />
        </View>
      </View>
    </View>
  );
}

// 목록 쪽(설정 하위 · 이용권 등)의 뼈대: 줄 3개(목록 줄과 같은 높이 56)
export function SkeletonLines({ count = 3, testID }: { count?: number; testID?: string }) {
  return (
    <View style={styles.lines} testID={testID}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.lineRow}>
          <View style={[styles.block, styles.line, i % 2 === 0 ? styles.w80 : styles.w60]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: space.s4, alignSelf: 'stretch' },
  lineRow: { minHeight: size.listRow, justifyContent: 'center', paddingHorizontal: space.s16, borderRadius: radius.lg, backgroundColor: colors.card },
  card: { flexDirection: 'row', gap: space.s12, padding: space.s12, borderRadius: radius.lg, backgroundColor: colors.card },
  block: { backgroundColor: colors.line, borderRadius: radius.sm },
  photo: { width: layout.cardPhotoWidth, height: layout.cardPhotoHeight },
  info: { flex: 1, gap: space.s8, paddingTop: space.s4 },
  line: { height: space.s16 },
  lineSmall: { height: space.s12 },
  w80: { width: '80%' },
  w60: { width: '60%' },
  w30: { width: '30%' },
  gapTop: { marginTop: space.s8 },
  chips: { flexDirection: 'row', gap: space.s8 },
  chip: { width: space.s48, height: size.chip - space.s4, borderRadius: radius.pill },
});
