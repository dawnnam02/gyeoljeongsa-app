// 앱 안 스플래시(D15 · D25 장면 1 · D31 로고 타일 · F17). 시스템 스플래시(크림 바탕 + 로고 타일 그림)가 걷히면 이 화면이 이어받는다.
//  순서 · 시간(시제품 D25_시제품 #splash, theme/motion scene.splash):
//   0ms   바탕 bgGrad(높이 360) 투명도 250 으로 나타남(네이티브 스플래시 뒤 연분홍이 갑자기 생기지 않게, D29) · 로고 타일 찍힘 700(위 26 · 1.2배 · -6° → 제자리)
//   300ms 퍼짐 고리 700 · 600ms 글자 로고 + 브랜드 한 줄 올라옴 400
//   2100ms(그리고 준비가 끝난 뒤) 종이가 가운데 줄에서 위아래로 펼쳐지며(700, out) 아래 첫 화면이 나타난다 → 끝나면 사라짐. 합계 3초 안
//  3초 넘게 준비가 안 끝나면 링 + "불러오는 중이에요"를 더한다(그 전에는 움직이는 주인공이 로고 타일 하나뿐)
//  동작 줄이기: 이동 · 크기 없이 투명도만 — 타일 · 글자는 150 으로 나타나고, 펼침 대신 전체가 150 으로 사라진다(기다림도 0.35배)
//  스크린리더에는 "불러오는 중이에요" 하나만 읽게 한다(그림은 장식). 햅틱 없음(첫 화면은 조용히, D25 4장)
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Ring } from '@/components/Ring';
import { Backdrop } from '@/components/Screen';
import { COMMON, ONBOARDING } from '@/content/copy';
import { curve, Fade, logoTile, reduced, Rise, scene, StampTile, tween, useReduceMotion } from '@/motion';
import { layout } from '@/theme/layout';
import { colors, space } from '@/theme/tokens';
import { BRAND } from '@/theme/uiAssets';

type Props = {
  ready: boolean; // 앱이 쓸 준비가 끝났는가(글꼴 · 첫 화면)
  onShown?: () => void; // 스플래시가 처음 그려졌다(시스템 스플래시를 걷어도 되는 때)
};

export const SPLASH_REDUCED_WAIT = 0.35; // 동작 줄이기면 기다림을 줄인다(시제품과 같은 비율)

export function AppSplash({ ready, onShown }: Props) {
  const reduce = useReduceMotion();
  const [slow, setSlow] = useState(false);
  const [gone, setGone] = useState(false);
  const [height, setHeight] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const shownOnce = useRef(false);
  const open = useSharedValue(0); // 펼침 0 → 1
  const fade = useSharedValue(1); // 동작 줄이기 때 전체 투명도

  // 3초 안에 준비가 안 끝나면 링 + 안내 한 줄을 더한다
  useEffect(() => {
    if (ready) return undefined;
    const timer = setTimeout(() => setSlow(true), layout.splashSlowMs);
    return () => clearTimeout(timer);
  }, [ready]);

  // 찍힘 · 글자가 다 보일 때까지는 펼치지 않는다(시제품 2100ms, 줄이기는 0.35배)
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), Math.round(scene.splash.unfoldAt * (reduce ? SPLASH_REDUCED_WAIT : 1)));
    return () => clearTimeout(timer);
  }, [reduce]);

  // 준비가 끝났고 기다림도 지났으면 펼친다(줄이기면 투명도) → 끝나면 사라진다
  const unfolding = ready && minDone;
  useEffect(() => {
    if (!unfolding) return undefined;
    if (reduce) fade.set(withTiming(0, { duration: reduced.fadeMs, easing: curve('std') }));
    else open.set(tween(1, scene.splash.unfold));
    const timer = setTimeout(() => setGone(true), reduce ? reduced.fadeMs : scene.splash.unfold);
    return () => clearTimeout(timer);
  }, [unfolding, reduce, open, fade]);

  const half = height / 2;
  const top = useAnimatedStyle(() => ({ transform: [{ translateY: -open.get() * half }] }));
  const topInner = useAnimatedStyle(() => ({ transform: [{ translateY: open.get() * half }] }));
  const bottom = useAnimatedStyle(() => ({ transform: [{ translateY: open.get() * half }] }));
  const bottomInner = useAnimatedStyle(() => ({ transform: [{ translateY: -open.get() * half }] }));
  const crease = useAnimatedStyle(() => ({ opacity: open.get() > 0 && open.get() < 1 ? 0.9 - open.get() * 0.9 : 0, transform: [{ scaleX: 0.2 + open.get() * 0.8 }] }));
  const whole = useAnimatedStyle(() => ({ opacity: fade.get() }));

  if (gone) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
    if (!shownOnce.current) {
      shownOnce.current = true;
      onShown?.();
    }
  };

  // 종이 두 쪽: 위쪽 반 · 아래쪽 반이 각자 밖으로 물러나고, 안의 그림은 제자리에 있다(가운데 줄에서 열리는 틈이 커지는 모양)
  const paper = (copy: 'top' | 'bottom', content: ReactNode) => (
    <Animated.View style={[styles.half, copy === 'top' ? { top: 0, height: half } : { top: half, height: half }, copy === 'top' ? top : bottom]} pointerEvents="none">
      <Animated.View style={[styles.sheet, { height, top: copy === 'top' ? 0 : -half }, copy === 'top' ? topInner : bottomInner]}>{content}</Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View
      style={[styles.fill, whole]}
      pointerEvents={ready ? 'none' : 'auto'}
      onLayout={onLayout}
      accessible
      accessibilityLabel={COMMON.loading}
      accessibilityLiveRegion="polite"
      testID="splash">
      {height > 0 ? (
        <>
          {paper('top', <SplashFace slow={slow} withIds />)}
          {paper('bottom', <SplashFace slow={slow} />)}
          {unfolding && !reduce ? <Animated.View pointerEvents="none" style={[styles.crease, { top: half }, crease]} /> : null}
        </>
      ) : (
        <SplashFace slow={slow} withIds />
      )}
    </Animated.View>
  );
}

// 스플래시 한 장(바탕 + 로고 타일 + 글자 로고 + 한 줄 + 느릴 때 링 · 안내)
function SplashFace({ slow, withIds = false }: { slow: boolean; withIds?: boolean }) {
  const id = (name: string) => (withIds ? name : undefined);
  return (
    <View style={styles.face}>
      <Fade visible duration={scene.splash.backdropFade} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Backdrop kind="splash" testID={id('splash-backdrop')} />
      </Fade>
      <View style={styles.column}>
        <StampTile size={logoTile.splash} ripple testID={id('splash-tile')} />
        <Rise delay={scene.splash.wordmarkDelay} duration={scene.splash.wordmark} style={styles.words}>
          <Image source={BRAND.wordmark} style={styles.logo} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={id('splash-wordmark')} />
          <AppText variant="caption" testID={id('splash-line')}>
            {ONBOARDING.brandLine}
          </AppText>
        </Rise>
        {slow ? (
          <View style={styles.slow}>
            <Ring size={layout.splashRing} stroke={layout.splashRingStroke} testID={id('splash-ring')} />
            <AppText variant="caption" testID={id('splash-slow')}>
              {COMMON.loading}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, zIndex: 10 },
  half: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  sheet: { position: 'absolute', left: 0, right: 0 },
  face: { flex: 1, backgroundColor: colors.bg },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s24 },
  words: { alignItems: 'center', gap: space.s12 },
  logo: { width: layout.splashLogoWidth, height: layout.splashLogoHeight },
  slow: { alignItems: 'center', gap: layout.splashNoteGap },
  crease: { position: 'absolute', left: space.s32, right: space.s32, height: 1, backgroundColor: colors.line },
});
