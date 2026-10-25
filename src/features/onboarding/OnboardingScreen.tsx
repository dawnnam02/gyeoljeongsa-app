// 화면 ID 01 온보딩(K2 4장 01 · Figma 3:8).
//  위: 상단 바에 서비스 로고 글자 '결정사'(목업의 '온보딩' 글자 자리) · 로고 그림
//  가운데: 소개 그림 · 제목 · 부제 · 장 표시 점 3개. 점을 누르거나 좌우로 밀면 장이 바뀐다. 자동으로 넘기지 않는다
//  아래(고정): [시작하기] · [이미 계정이 있어요] — 모든 장에서 보인다. 건너뛰기 버튼은 없다. 둘 다 02 로 간다
// 뒤로가기: 2 · 3장에서는 이전 장으로 가고, 1장에서 Android 뒤로가기는 앱을 백그라운드로 보낸다. 상단 '<' 는 없다.
// 소개 그림 3장(D42-I 4안 확정 · D-176): 장면 그림 온보딩 1~3(react-native-svg, 4:3)을 카드(둥글기 20 · 잘라 담기) 안에 담는다. 다크 모드면 다크 판.
//  옛 사진 intro_1~3(정사각 1:1)은 쓰지 않는다. 그림 위에 글자는 올리지 않는다(K2).
// 움직임(D25 장면 2 · F17): 장이 바뀌면 새 장이 넘긴 쪽에서 40px 옆으로 들어온다(400 out) · 그림은 1.06배에서 700ms 로 천천히 안착(팀장 10-17) ·
//  제목 · 부제는 8px 아래에서 250(60ms 간격) · 지금 점은 알약으로 늘어난다(250 std). 자동으로 넘기지 않는다. 동작 줄이기: 투명도만 150. 햅틱 없음
//  바탕 bgGrad 높이 360(Screen backdrop="onboarding")
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, PanResponder, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Illustration } from '@/components/Illustration';
import { Pressable } from '@/components/Pressable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { A11Y, ONBOARDING } from '@/content/copy';
import { OnboardingLaunchLine } from '@/features/prelaunch/OnboardingLaunchLine';
import { dist, Fade, releaseSpring, Rise, scene, tween, useReduceMotion } from '@/motion';
import { illustration, INTRO_SCENES } from '@/theme/illustrations';
import { layout } from '@/theme/layout';
import { BRAND } from '@/theme/uiAssets';
import { colors, radius, size, space } from '@/theme/tokens';

import { stepIndex, swipeDelta } from './pager';

export function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  useLayoutEffect(() => {
    indexRef.current = index; // Android 뒤로가기 handler 가 지금 장을 읽는다
  });
  const total = ONBOARDING.slides.length;
  const slide = ONBOARDING.slides[index];

  const [dir, setDir] = useState<-1 | 0 | 1>(0); // 마지막으로 넘긴 쪽(새 장이 들어오는 쪽). 처음 0 = 움직임 없음
  const step = useCallback(
    (delta: -1 | 1) => {
      setDir(delta); // 새 장이 들어오는 쪽(끝에서 더 밀면 장은 그대로라 움직이지 않는다)
      setIndex((i) => stepIndex(i, delta, total));
    },
    [total],
  );
  const go = (next: number) => {
    if (next === index) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  // 좌우로 밀기: 가로로 더 많이 움직인 때만 가로채서 위아래 스크롤과 겹치지 않게 한다.
  // 넘김 놓기(F21 · D25 10-2 원칙 7): 끄는 동안 장이 손을 따라오고, 넘기지 않고 놓으면 놓은 속도에서 출발하는 스프링(감쇠 1 · 체감 400)으로 제자리.
  //  동작 줄이기: 손을 따라가는 것은 그대로, 놓으면 바로 제자리
  const reduce = useReduceMotion();
  const drag = useSharedValue(0);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > space.s8,
        onPanResponderMove: (_event, g) => drag.set(g.dx),
        onPanResponderRelease: (_event, g) => {
          const delta = swipeDelta(g.dx, layout.swipeDistance);
          if (delta !== 0) {
            drag.set(0); // 새 장이 넘긴 쪽에서 들어온다
            step(delta);
            return;
          }
          drag.set(reduce ? 0 : releaseSpring(0, g.vx * 1000));
        },
        onPanResponderTerminate: () => drag.set(reduce ? 0 : releaseSpring(0)),
      }),
    [step, drag, reduce],
  );
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.get() }] }));

  // Android 뒤로가기: 2 · 3장에서는 이전 장, 1장에서는 기본 동작(앱을 백그라운드로)
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (indexRef.current === 0) return false;
        step(-1);
        return true;
      });
      return () => subscription.remove();
    }, [step]),
  );

  const goSignIn = useCallback(() => router.push('/sign-in'), [router]);

  return (
    <Screen edges={['top', 'bottom']} backdrop="onboarding">
      <ScreenHeader title={ONBOARDING.logo} testID="onboarding-header" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="screen-01">
        <View style={styles.logoSlot}>
          <Image source={BRAND.wordmark} style={styles.logo} resizeMode="contain" accessibilityLabel={ONBOARDING.logo} />
        </View>

        <Animated.View
          {...pan.panHandlers}
          style={[styles.slide, dragStyle]}
          accessibilityRole="adjustable"
          accessibilityLabel={A11Y.introDot(index + 1, total)}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
          testID="intro-slide">
          <Rise key={index} play={dir !== 0} axis="x" distance={dir * dist.xl} duration={scene.onboarding.slide} style={styles.slide}>
            <View style={styles.art} testID="intro-art">
              {/* 소개 그림(4:3)은 칸을 꽉 채운다. 그림 위에 글자는 올리지 않는다 */}
              <Settle play={dir !== 0}>
                <Illustration scene={INTRO_SCENES[index]} style={styles.artImage} testID="intro-art-image" />
              </Settle>
            </View>
            <Rise play={dir !== 0} duration={scene.onboarding.text}>
              <AppText variant="title" testID="intro-title">
                {slide.title}
              </AppText>
            </Rise>
            <Rise play={dir !== 0} delay={scene.onboarding.textGap} duration={scene.onboarding.text}>
              <AppText variant="body" tone="sub" testID="intro-body">
                {slide.body}
              </AppText>
            </Rise>
            {index === total - 1 ? <OnboardingLaunchLine /> : null}
          </Rise>
        </Animated.View>

        <View style={styles.dots} testID="intro-dots">
          {ONBOARDING.slides.map((_, i) => (
            <Pressable
              key={i}
              effect="none"
              accessibilityLabel={A11Y.introDot(i + 1, total)}
              aria-selected={i === index}
              onPress={() => go(i)}
              testID={`intro-dot-${i + 1}`}
              style={styles.dotTouch}>
              <View style={[styles.dot, i === index ? styles.dotOn : styles.dotOff]} />
              <Fade visible={i === index} duration={scene.onboarding.dot} style={styles.pill} pointerEvents="none" />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CtaFade />
        <Button label={ONBOARDING.start} onPress={goSignIn} testID="onboarding-start" />
        <TextButton label={ONBOARDING.haveAccount} onPress={goSignIn} testID="onboarding-login" />
      </View>
    </Screen>
  );
}

// 점 하나의 터치 칸은 44 × 44(가이드 3장 · G6). 그림은 8 이고 첫 점의 왼쪽 끝이 글자 왼쪽(20)에 맞게 당겨 둔다.
const dotPad = (size.touchMin - layout.dot) / 2;

// 그림 안착: 1.06배에서 제자리로 천천히(700, out). 동작 줄이기면 처음부터 1배
function Settle({ play, children }: { play: boolean; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const move = play && !reduce;
  const sc = useSharedValue(move ? scene.onboarding.photoScaleFrom : 1);
  useEffect(() => {
    if (move) sc.set(tween(1, scene.onboarding.photoSettle));
  }, [move, sc]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: sc.get() }] }));
  return <Animated.View style={[styles.artImage, animated]}>{children}</Animated.View>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s8, gap: space.s12 },
  logoSlot: { height: layout.logoHeight + space.s12, alignItems: 'center', justifyContent: 'center' },
  logo: { width: layout.logoWidth, height: layout.logoHeight },
  slide: { gap: space.s12 },
  // 소개 그림 칸: 4:3(폭 348까지, D42-I). 작은 화면에서는 본문이 위아래로 스크롤되고 버튼 둘은 아래에 고정된다
  art: { alignSelf: 'stretch', maxWidth: illustration.hero, aspectRatio: illustration.ratio, borderRadius: radius.xl, backgroundColor: colors.card, overflow: 'hidden' },
  artImage: { width: '100%', height: '100%', maxWidth: undefined, borderRadius: 0 },
  dots: { flexDirection: 'row', marginLeft: -dotPad, marginTop: -dotPad },
  dotTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  dot: { width: layout.dot, height: layout.dot, borderRadius: radius.pill },
  dotOn: { backgroundColor: colors.accent },
  dotOff: { backgroundColor: colors.line },
  pill: { position: 'absolute', width: layout.dot * 2.5, height: layout.dot, borderRadius: radius.pill, backgroundColor: colors.accent }, // 지금 점 = 알약(8 → 20)
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s4, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
});
