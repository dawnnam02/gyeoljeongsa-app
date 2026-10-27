// 움직임 v2 '흐르는 결정사'(D25 10장 · F21) 부품 모음. 값은 theme/motion.ts(scene · springFollow · waitStage), 움직이는 속성은 transform · opacity 만.
//  releaseSpring : 손을 놓은 속도에서 출발하는 스프링(감쇠 1 · 체감 400, spring-follow)
//  RollingNumber : 숫자가 바뀌면 자리마다 위로 굴러 새 숫자에 멈춤(400 out · 오른쪽 자리부터 30 간격 · 새 자리는 8 아래에서). 등급 · 점수 · 남은 시간에는 쓰지 않는다(D-94)
//  ProgressBar   : 진행 막대 안쪽을 scaleX 로 채움(250 std, 왼쪽 기준). 너비를 움직이지 않는다
//  useWaitStage · WaitState : 대기 단계표(0.3초 안 아무것도 · 1초 안 정지된 뼈대 · 10초 안 뼈대 + 머리 아래 2px 선 왕복(2안 load.line) · 10초 넘음 선 멈춤 + 글 한 줄). 가운데 큰 스피너 단독 0
//  AnimatedRow   : 목록에서 한 줄이 빠지면 투명해지며 접히고 아래 줄이 미끄러져 메움(250 std · 사라짐 150)
//  useCollapsingTitle : 큰 제목이 스크롤 0 → 48 동안 투명해지며 8 위로 · 0.9배, 머리 막대 가운데 작은 제목(16 Bold)이 나타나고 48 에서 아래 선
//  동작 줄이기: 굴림 · 채움은 바로 + 투명도 150, 메움은 바로 빠짐, 제목은 투명도만, 뼈대 반짝임 멈춤(D25 10-6)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText, type TextTone, type TextVariant } from '@/components/AppText';
import { useReduceMotion } from '@/lib/reduceMotion';
import { reduced, scene, springFollow, waitStage } from '@/theme/motion';
import { colors, radius, size, type } from '@/theme/tokens';

import { curve, fadeIn, Rise, tween } from './primitives';
import { SkeletonPulse } from './Skeleton';

// ── 손을 놓은 속도를 이어받는 스프링(D25 10-3 spring-follow) ─────────────────
export const releaseSpring = (to: number, velocity = 0, done?: (finished?: boolean) => void) =>
  withSpring(to, { duration: springFollow.duration, dampingRatio: springFollow.dampingRatio, velocity }, done);

// ── 숫자 굴림 ────────────────────────────────────────────────────────────────
type RollProps = { value: number; suffix?: string; variant?: TextVariant; tone?: TextTone; testID?: string };

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function RollingNumber({ value, suffix = '', variant = 'bodyBold', tone, testID }: RollProps) {
  const reduce = useReduceMotion();
  const text = String(Math.max(0, Math.floor(value)));
  const lineHeight = type[variant].lineHeight;
  const first = useRef(true);
  // 앞 값의 자릿수(렌더 중에 앞 값을 기억하는 방식 — 효과 안에서 상태를 바꾸지 않는다)
  const [shown, setShown] = useState({ text, prevLength: text.length });
  if (shown.text !== text) setShown({ text, prevLength: shown.text.length });
  const prevLength = shown.prevLength;
  const fade = useSharedValue(1);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) {
      fade.set(0);
      fadeIn(fade); // 바로 바뀜 + 투명도 150
    }
  }, [text, reduce, fade]);
  const faded = useAnimatedStyle(() => ({ opacity: fade.get() }));
  return (
    <Animated.View style={[styles.roll, faded]} accessible accessibilityLabel={`${text}${suffix}`} accessibilityLiveRegion="polite" testID={testID}>
      {text.split('').map((d, i) => {
        const fromRight = text.length - 1 - i;
        const grown = i < text.length - prevLength; // 자리가 늘어난 왼쪽 새 자리
        return <Digit key={`d${fromRight}`} digit={Number(d)} order={fromRight} lineHeight={lineHeight} variant={variant} tone={tone} grown={grown} />;
      })}
      {suffix ? (
        <AppText variant={variant} tone={tone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {suffix}
        </AppText>
      ) : null}
    </Animated.View>
  );
}

function Digit({ digit, order, lineHeight, variant, tone, grown }: { digit: number; order: number; lineHeight: number; variant: TextVariant; tone?: TextTone; grown: boolean }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(-digit * lineHeight);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const to = -digit * lineHeight;
    if (reduce) y.set(to);
    else y.set(withDelay(order * scene.roll.digitGap, tween(to, scene.roll.dur)));
  }, [digit, lineHeight, order, reduce, y]);
  const column = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const cell = (
    <View style={[styles.cell, { height: lineHeight }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={column}>
        {DIGITS.map((n) => (
          <AppText key={n} variant={variant} tone={tone} style={[styles.digit, { height: lineHeight }]}>
            {n}
          </AppText>
        ))}
      </Animated.View>
    </View>
  );
  return grown ? <Rise distance={scene.roll.newDigitRise} duration={scene.roll.dur}>{cell}</Rise> : cell;
}

// ── 진행 막대 ────────────────────────────────────────────────────────────────
export function ProgressBar({ ratio, height = size.barProgress, style, fillTestID, testID, accessibilityLabel, accessibilityValue }: { ratio: number; height?: number; style?: StyleProp<ViewStyle>; fillTestID?: string; testID?: string; accessibilityLabel?: string; accessibilityValue?: { min: number; max: number; now: number } }) {
  const reduce = useReduceMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const scale = useSharedValue(clamped);
  useEffect(() => {
    if (reduce) scale.set(clamped);
    else scale.set(withTiming(clamped, { duration: scene.survey.bar, easing: curve('std') }));
  }, [clamped, reduce, scale]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.get() }] }));
  return (
    // 3부-사(검수 Q9-N4): RN-web 0.21 은 accessibilityValue 객체를 aria-valuenow 로 넘기지 않아 aria-value* 를 같이 준다
    <View style={[styles.track, { height }, style]} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={accessibilityValue} aria-valuemin={accessibilityValue?.min} aria-valuemax={accessibilityValue?.max} aria-valuenow={accessibilityValue?.now} testID={testID}>
      <Animated.View style={[styles.fill, { height }, fill]} testID={fillTestID} />
    </View>
  );
}

// ── 대기 단계표 ──────────────────────────────────────────────────────────────
export type WaitStage = 0 | 1 | 2 | 3; // 0 아무것도 · 1 정지된 뼈대 · 2 뼈대 + 로딩 선 · 3 선 멈춤 + 글

export function useWaitStage(waiting: boolean): WaitStage {
  const [stage, setStage] = useState<WaitStage>(0);
  useEffect(() => {
    if (!waiting) return undefined;
    const timers = [
      setTimeout(() => setStage(1), waitStage.blank),
      setTimeout(() => setStage(2), waitStage.still),
      setTimeout(() => setStage(3), waitStage.long),
    ];
    return () => timers.forEach(clearTimeout);
  }, [waiting]);
  // 기다림이 끝나면 다음 기다림은 0 단계부터(렌더 중 맞춤)
  if (!waiting && stage !== 0) setStage(0);
  return waiting ? stage : 0;
}

// 화면 전체 대기: 단계에 따라 아무것도 · 뼈대(skeleton) · 반짝이는 뼈대 · 멈춘 뼈대 + 글(note). 뼈대는 부르는 쪽이 그 화면과 같은 틀로 준다
export function WaitState({ waiting, skeleton, note, testID }: { waiting: boolean; skeleton: ReactNode; note: ReactNode; testID?: string }) {
  const stage = useWaitStage(waiting);
  if (stage === 0) return <View style={styles.blank} testID={testID ? `${testID}-blank` : undefined} />;
  return (
    <View style={styles.wait} accessible accessibilityLiveRegion="polite" testID={testID} accessibilityState={{ busy: true }}>
      {stage === 2 ? <SkeletonPulse delay={0}>{skeleton}</SkeletonPulse> : <View style={styles.still}>{skeleton}</View>}
      {stage === 3 ? note : null}
    </View>
  );
}

// ── 레이아웃 메움 ────────────────────────────────────────────────────────────
export function AnimatedRow({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const reduce = useReduceMotion();
  return (
    <Animated.View
      layout={reduce ? undefined : LinearTransition.duration(scene.fadeThrough.fill)}
      exiting={FadeOut.duration(reduce ? reduced.fadeMs : scene.toast.out)}
      style={style}
      testID={testID}>
      {children}
    </Animated.View>
  );
}

// ── 큰 제목 줄어듦 ───────────────────────────────────────────────────────────
export function useCollapsingTitle() {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.set(e.contentOffset.y);
  });
  const { range, rise, scale } = scene.collapse;
  const big = useAnimatedStyle(() => {
    const p = interpolate(y.get(), [0, range], [0, 1], Extrapolation.CLAMP);
    return reduce ? { opacity: 1 - p } : { opacity: 1 - p, transform: [{ translateY: -rise * p }, { scale: 1 - (1 - scale) * p }] };
  });
  const small = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [range * 0.5, range], [0, 1], Extrapolation.CLAMP) }));
  const line = useAnimatedStyle(() => ({ opacity: y.get() >= range ? 1 : 0 }));
  return { onScroll, big, small, line, y };
}

const styles = StyleSheet.create({
  roll: { flexDirection: 'row', alignItems: 'flex-end' },
  cell: { overflow: 'hidden' },
  digit: { fontVariant: ['tabular-nums'] },
  track: { width: '100%', borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { width: '100%', borderRadius: radius.pill, backgroundColor: colors.accent, transformOrigin: 'left' },
  blank: { flex: 1 },
  wait: { flex: 1, alignSelf: 'stretch' },
  still: { opacity: 0.7 },
});
