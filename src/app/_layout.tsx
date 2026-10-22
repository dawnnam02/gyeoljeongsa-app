import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { bindAuthAppState } from '@/lib/supabase';
import { safeLog } from '@/lib/log';
import { AppSplash } from '@/features/splash/AppSplash';
import { dur, PhotoHandoffLayer } from '@/motion';
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
      {/* 시트 끌어 닫기 · 넘김 놓기(손 제스처)를 UI 스레드에서 받으려고 맨 바깥을 제스처 뿌리로(D-118 ⑤). 깊이 이동 시간은 토큰 base 250(D25 3장) */}
      <GestureHandlerRootView style={styles.root}>
        {ready ? <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animationDuration: dur.base }} /> : null}
        <PhotoHandoffLayer />
        <AppSplash ready={ready} onShown={hideSystemSplash} />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
