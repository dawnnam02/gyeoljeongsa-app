// 앱 안 스플래시(D15 · D31 로고 타일 · D42-M 2안 '지면' 명세 4-5). 시스템 스플래시(크림 바탕 + 로고 타일 그림, 정지)가 걷히면 이 화면이 이어받는다.
//  하루 한 번이라 핵심 규칙(풍성하게)을 따른다. 순서 · 시간(theme/motion scene2.splash):
//   0ms   바탕 bgGrad(높이 360) 250 으로 나타남(네이티브 스플래시 뒤 연분홍이 갑자기 생기지 않게, D29)
//   100ms 가는 와인 선 120 이 가운데서 scaleX 0 → 1(600 edInOut)
//   250ms 로고 타일 104 가 잉크 번짐으로 드러남(600 edOut, motion/InkTile)
//   450ms 글자 로고 결 · 정 · 사 가 글자마다 줄 가림으로 올라옴(620 edOut, 80ms 차례) — 글자 로고는 그림이라 같은 폭 세 칸으로 나눠 가린다
//   800ms 브랜드 한 줄 투명도 400
//   1900ms(그리고 준비가 끝난 뒤) 장 넘김: 스플래시가 10% 위로 물러나며 옅어지고(640 edInOut) 아래 첫 화면이 드러난다 → 끝나면 사라짐
//  튕김 · 퍼지는 고리 · 종이 펼침은 2안에서 지웠다. 3초 넘게 준비가 안 끝나면 링 + "불러오는 중이에요"를 더한다
//  동작 줄이기: 선 · 이동 없이 로고 · 글자 투명도 150 → 1.5초 뒤(준비가 끝났으면) 전체 투명도 150 으로 사라짐
//  스크린리더에는 "불러오는 중이에요" 하나만 읽게 한다(그림은 장식). 햅틱 없음(첫 화면은 조용히, D25 4장)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Ring } from '@/components/Ring';
import { Backdrop } from '@/components/Screen';
import { COMMON, ONBOARDING } from '@/content/copy';
import { curve, dur, Fade, fadeIn, InkTile, logoTile, reduced, scene2, tween, useReduceMotion } from '@/motion';
import { layout } from '@/theme/layout';
import { colors, space } from '@/theme/tokens';
import { BRAND } from '@/theme/uiAssets';

type Props = {
  ready: boolean; // 앱이 쓸 준비가 끝났는가(글꼴 · 첫 화면)
  onShown?: () => void; // 스플래시가 처음 그려졌다(시스템 스플래시를 걷어도 되는 때)
};

const S = scene2.splash;
const LETTERS = 3; // 결 · 정 · 사

export function AppSplash({ ready, onShown }: Props) {
  const reduce = useReduceMotion();
  const [slow, setSlow] = useState(false);
  const [gone, setGone] = useState(false);
  const [height, setHeight] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const shownOnce = useRef(false);
  const leave = useSharedValue(0); // 장 넘김 0 → 1

  // 3초 안에 준비가 안 끝나면 링 + 안내 한 줄을 더한다
  useEffect(() => {
    if (ready) return undefined;
    const timer = setTimeout(() => setSlow(true), layout.splashSlowMs);
    return () => clearTimeout(timer);
  }, [ready]);

  // 선 · 잉크 · 글자가 다 보일 때까지는 넘기지 않는다(1.9초, 줄이기 1.5초)
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), reduce ? S.reducedWait : S.nextAt);
    return () => clearTimeout(timer);
  }, [reduce]);

  // 준비가 끝났고 기다림도 지났으면 장을 넘긴다(줄이기면 투명도 150) → 끝나면 사라진다
  const leaving = ready && minDone;
  useEffect(() => {
    if (!leaving) return undefined;
    const ms = reduce ? reduced.fadeMs : S.next;
    leave.set(withTiming(1, { duration: ms, easing: curve(reduce ? 'std' : 'edInOut') }));
    const timer = setTimeout(() => setGone(true), ms); // 장 넘김이 끝나면 치운다
    return () => clearTimeout(timer);
  }, [leaving, reduce, leave]);

  const lift = height * S.nextLift;
  const whole = useAnimatedStyle(() => (reduce ? { opacity: 1 - leave.get() } : { opacity: 1 - leave.get(), transform: [{ translateY: -lift * leave.get() }] }));

  if (gone) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
    if (!shownOnce.current) {
      shownOnce.current = true;
      onShown?.();
    }
  };

  return (
    <Animated.View
      style={[styles.fill, whole]}
      pointerEvents={ready ? 'none' : 'auto'}
      onLayout={onLayout}
      accessible
      accessibilityLabel={COMMON.loading}
      accessibilityLiveRegion="polite"
      testID="splash">
      <View style={styles.face}>
        <Fade visible duration={dur.base} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Backdrop kind="splash" testID="splash-backdrop" />
        </Fade>
        <View style={styles.column}>
          <InkTile size={logoTile.splash} delay={S.logoDelay} duration={S.logo} testID="splash-tile" />
          <View style={styles.words}>
            <Rule />
            <Wordmark />
            <Fade visible delay={S.tagDelay} duration={S.tag} name="edOut">
              <AppText variant="caption" testID="splash-line">
                {ONBOARDING.brandLine}
              </AppText>
            </Fade>
          </View>
          {slow ? (
            <View style={styles.slow}>
              <Ring size={layout.splashRing} stroke={layout.splashRingStroke} testID="splash-ring" />
              <AppText variant="caption" testID="splash-slow">
                {COMMON.loading}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

// 가는 와인 선 120 × 1.5: 가운데서 양옆으로 그어진다. 동작 줄이기면 처음부터 그어져 있다(투명도만)
function Rule() {
  const reduce = useReduceMotion();
  const s = useSharedValue(reduce ? 1 : 0);
  const o = useSharedValue(reduce ? 0 : 1);
  useEffect(() => {
    if (reduce) {
      s.set(1);
      fadeIn(o);
      return;
    }
    s.set(withDelay(S.ruleDelay, tween(1, S.rule, 'edInOut')));
  }, [reduce, s, o]);
  const drawn = useAnimatedStyle(() => (reduce ? { opacity: o.get() } : { transform: [{ scaleX: s.get() }] }));
  return <Animated.View style={[styles.rule, drawn]} testID="splash-rule" />;
}

// 글자 로고(그림)를 같은 폭 세 칸으로 나눠, 칸마다 제 높이 110% 아래에서 올라온다(80ms 차례). 동작 줄이기면 투명도 150
function Wordmark() {
  const w = layout.splashLogoWidth;
  const cell = w / LETTERS;
  return (
    <View style={styles.wordmark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="splash-wordmark">
      {Array.from({ length: LETTERS }, (_, i) => (
        <Letter key={i} index={i}>
          <Image source={BRAND.wordmark} style={[styles.logo, { marginLeft: -i * cell }]} resizeMode="contain" />
        </Letter>
      ))}
    </View>
  );
}

function Letter({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      fadeIn(p);
      return;
    }
    p.set(withDelay(S.lettersDelay + index * S.letterStep, tween(1, S.letters)));
  }, [reduce, index, p]);
  const rise = Math.round(scene2.mask.rise * 100); // 110
  const moving = useAnimatedStyle(() => (reduce ? { opacity: p.get() } : { transform: [{ translateY: `${(1 - p.get()) * rise}%` as const }] }));
  return (
    <View style={styles.letter}>
      <Animated.View style={moving}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, zIndex: 10 },
  face: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s24 },
  words: { alignItems: 'center', gap: space.s12 },
  rule: { width: S.ruleWidth, height: S.ruleHeight, backgroundColor: colors.accent },
  wordmark: { flexDirection: 'row', width: layout.splashLogoWidth, height: layout.splashLogoHeight },
  letter: { width: layout.splashLogoWidth / LETTERS, height: layout.splashLogoHeight, overflow: 'hidden' },
  logo: { width: layout.splashLogoWidth, height: layout.splashLogoHeight },
  slow: { alignItems: 'center', gap: layout.splashNoteGap },
});
