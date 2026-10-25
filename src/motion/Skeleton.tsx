// 스켈레톤(D25 장면 6 · D42-M 2안 load): 화면 전체를 불러올 때만, 실제 카드와 같은 틀(사진 96×120 · 이름 · 한 줄 · 맞는 점 · 칩 3). 한 조각(카드 하나)은 스피너.
//  2안: 뼈대는 멈춰 있고(반짝임 0), 1초를 넘게 기다리면 뼈대 위(머리 아래) 2px 와인 선이 왼쪽 기준 scaleX 0 ↔ 1 로 1400ms 왕복(edInOut).
//  10초가 넘으면 선을 멈춘다(글 한 줄은 WaitState 가 더한다). 동작 줄이기면 선 없이 정지 뼈대.
//  내용이 오면 부모가 뼈대를 걷고(200) 카드가 놓인다(Land).
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { layout } from '@/theme/layout';
import { scene2, waitStage } from '@/theme/motion';
import { colors, radius, size, space } from '@/theme/tokens';

import { tween } from './primitives';

// 이름은 옛 그대로(뼈대 감싸개). delay: 선이 나오기까지 기다림(기본 1초 — WaitState 처럼 이미 1초를 기다린 쪽은 0)
export function SkeletonPulse({ children, delay = scene2.load.lineDelay, testID }: { children: ReactNode; delay?: number; testID?: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <LoadLine delay={delay} />
      {children}
    </View>
  );
}

// 머리 아래 2px 선(load.line). 동작 줄이기면 그리지 않는다
export function LoadLine({ delay = scene2.load.lineDelay, testID }: { delay?: number; testID?: string }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(s);
      s.set(0);
      return undefined;
    }
    const half = scene2.load.line / 2;
    s.set(withDelay(delay, withRepeat(withSequence(tween(1, half, 'edInOut'), tween(0, half, 'edInOut')), -1)));
    const stop = setTimeout(() => cancelAnimation(s), waitStage.long - waitStage.still + delay); // 기다림 10초가 넘으면 멈춘다
    return () => {
      clearTimeout(stop);
      cancelAnimation(s);
    };
  }, [reduce, delay, s]);
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: s.get() }] }));
  if (reduce) return null;
  return <Animated.View pointerEvents="none" style={[styles.line, line]} testID={testID} />;
}

// 09 추천 카드 하나의 뼈대(카드와 같은 크기 · 간격)
export function SkeletonCard({ testID }: { testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={[styles.block, styles.photo]} />
      <View style={styles.info}>
        <View style={[styles.block, styles.line1, styles.w80]} />
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
          <View style={[styles.block, styles.line1, i % 2 === 0 ? styles.w80 : styles.w60]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', top: 0, left: 0, right: 0, height: scene2.load.lineHeight, backgroundColor: colors.accent, transformOrigin: 'left', zIndex: 1 },
  lines: { gap: space.s4, alignSelf: 'stretch' },
  lineRow: { minHeight: size.listRow, justifyContent: 'center', paddingHorizontal: space.s16, borderRadius: radius.lg, backgroundColor: colors.card },
  card: { flexDirection: 'row', gap: space.s12, padding: space.s12, borderRadius: radius.lg, backgroundColor: colors.card },
  block: { backgroundColor: colors.line, borderRadius: radius.sm },
  photo: { width: layout.cardPhotoWidth, height: layout.cardPhotoHeight },
  info: { flex: 1, gap: space.s8, paddingTop: space.s4 },
  line1: { height: space.s16 },
  lineSmall: { height: space.s12 },
  w80: { width: '80%' },
  w60: { width: '60%' },
  w30: { width: '30%' },
  gapTop: { marginTop: space.s8 },
  chips: { flexDirection: 'row', gap: space.s8 },
  chip: { width: space.s48, height: size.chip - space.s4, borderRadius: radius.pill },
});
