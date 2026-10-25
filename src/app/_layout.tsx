import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { bindAuthAppState } from '@/lib/supabase';
import { safeLog } from '@/lib/log';
import { AppSplash } from '@/features/splash/AppSplash';
import { PhotoHandoffLayer, reduced, scene2, useReduceMotion } from '@/motion';
import { useAppFonts } from '@/theme/fonts';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// 화면 전환 틀(react-navigation)의 색도 토큰으로만 정한다. 다크 모드 색은 가이드에 없어서 라이트 하나다.
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const ready = fontsLoaded || fontError != null;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (fontError) safeLog({ event: 'font.load.fail' }); // 오류가 나도 시스템 글꼴로 계속 뜬다
  }, [fontError]);

  // 앱 안 스플래시(로고 정중앙)가 처음 그려지면 시스템 스플래시를 걷는다 — 같은 로고가 같은 자리에 있어 움직이지 않는다(D15)
  const hideSystemSplash = useCallback(() => void SplashScreen.hideAsync(), []);

  // 앱이 백그라운드로 가면 토큰 자동 재발급을 멈추고 돌아오면 다시 켠다(보안/구성.md 4-2)
  useEffect(() => bindAuthAppState(), []);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      {/* 시트 끌어 닫기 · 넘김 놓기(손 제스처)를 UI 스레드에서 받으려고 맨 바깥을 제스처 뿌리로(D-118 ⑤).
          화면 전환(2안 '지면' D42-M 명세 5-5 · D-175): native-stack fade 320(동작 줄이기 150). animationDuration 은 iOS 에만 먹고 안드로이드는 시스템 시간.
          iOS 가장자리 스와이프 뒤로: animationMatchesGesture 기본 false 라 손으로 끌 때는 기본 밀기로 돌아간다(실기기 시험 항목 — 안 되면 animation 줄을 지워 기본 slide 로) */}
      <GestureHandlerRootView style={styles.root}>
        {ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade', animationDuration: reduce ? reduced.fadeMs : scene2.nav.in, gestureEnabled: true }} /> : null}
        <PhotoHandoffLayer />
        <AppSplash ready={ready} onShown={hideSystemSplash} />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
