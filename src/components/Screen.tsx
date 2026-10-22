// 화면 공통 감싸개(F17 · D29 앱 넘김 메모): 모든 화면의 바탕을 여기서 한 번만 그린다.
//  바닥은 단색 bg, 맨 뒤 층에 bgGrad(accentSoft → bg, 위 → 아래) 덮개 한 장 — 화면 맨 위 0(상태 표시줄 뒤)부터 높이 260(화면마다 kind 로 300 · 360 · 460).
//  덮개는 고정이다(내용과 함께 스크롤되지 않음) · 정지 그림(움직이지 않음) · 누름을 받지 않는다. 그 위의 카드 · 시트 · 버튼 · 탭바 · 하단 막대는 제 단색 그대로.
//  값은 theme/tokens.ts bgGrad 한 곳. expo-linear-gradient 는 이 파일에서만 쓴다(check:tokens E) — 하단 고정 위 흐림(BottomCTA)도 여기 둔다(D-118 ⑦).
//  화면 넘김(F21 · D25 10-4): enter='depth' = 깊이 들어온 화면이 오른쪽 16 에서 250(out)으로 · enter='tab' = 탭으로 돌아올 때 페이드 스루(나감 100 뒤 들어옴 150, 이동 없음).
//  동작 줄이기: 깊이 이동은 투명도만 150, 탭은 그대로 투명도.
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { curve, dist, Rise, scene } from '@/motion';
import { withAlpha } from '@/theme/color';
import { bgGrad, colors, size, space } from '@/theme/tokens';

export type BackdropKind = keyof typeof bgGrad.height;

export function Backdrop({ kind = 'base', testID = 'screen-backdrop' }: { kind?: BackdropKind; testID?: string }) {
  return (
    <View pointerEvents="none" style={[styles.backdrop, { height: bgGrad.height[kind] }]} testID={testID}>
      <LinearGradient colors={bgGrad.colors} start={bgGrad.start} end={bgGrad.end} style={StyleSheet.absoluteFill} />
    </View>
  );
}

type Props = {
  children?: ReactNode;
  edges?: readonly Edge[];
  backdrop?: BackdropKind;
  enter?: 'none' | 'depth' | 'tab';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Screen({ children, edges = ['top'], backdrop = 'base', enter = 'none', style, testID }: Props) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, style]} testID={testID}>
      <Backdrop kind={backdrop} />
      {enter === 'depth' ? (
        <Rise axis="x" distance={dist.m} duration={scene.list.dur} style={styles.fill}>
          {children}
        </Rise>
      ) : enter === 'tab' ? (
        <TabFade>{children}</TabFade>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

// 탭 페이드 스루: 처음 열 때는 그대로, 다른 탭에서 돌아올 때 나감(100) 뒤 들어옴 150(out). 화면은 살려 둔다(투명도만)
function TabFade({ children }: { children: ReactNode }) {
  const o = useSharedValue(1);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return undefined;
      }
      o.set(0);
      o.set(withDelay(scene.fadeThrough.out, withTiming(1, { duration: scene.fadeThrough.in, easing: curve('out') })));
      return undefined;
    }, [o]),
  );
  const faded = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[styles.fill, faded]}>{children}</Animated.View>;
}

// 하단 고정 위 24 흐림(bg 투명 → bg) 한 장 — 이미 있는 하단 막대가 첫 자식으로 넣어 쓴다
export function CtaFade() {
  return <LinearGradient pointerEvents="none" colors={[withAlpha(colors.bg, 0), colors.bg]} style={styles.ctaFade} />;
}

// 하단 고정(D36 #10): 위 선 대신 위 24 흐림(bg 투명 → bg) · 안 여백 위 8 · 좌우 20 · 아래 16. 스크롤로 숨기지 않는다
export const CTA_PADDING = { paddingTop: space.s8, paddingHorizontal: size.screenPadding, paddingBottom: space.s16 } as const;
export function BottomCTA({ children, style, onLayout, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onLayout?: ComponentProps<typeof View>['onLayout']; testID?: string }) {
  return (
    <View style={[styles.cta, style]} onLayout={onLayout} testID={testID}>
      <CtaFade />
      {children}
    </View>
  );
}

// 하단 고정에 버튼 둘: 보조 1 : 주 2(D36 #10)
export function CtaPair({ secondary, primary }: { secondary: ReactNode; primary: ReactNode }) {
  return (
    <View style={styles.pair}>
      <View style={styles.one}>{secondary}</View>
      <View style={styles.two}>{primary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0 },
  cta: { paddingTop: space.s8, paddingHorizontal: size.screenPadding, paddingBottom: space.s16, gap: space.s8, backgroundColor: colors.bg },
  ctaFade: { position: 'absolute', left: 0, right: 0, top: -size.ctaFade, height: size.ctaFade },
  pair: { flexDirection: 'row', gap: space.s12 },
  one: { flex: 1 },
  two: { flex: 2 },
});
