// Supabase 클라이언트. 세션(access · refresh 토큰)은 SecureStore 조각 저장에만 둔다(보안/구성.md 4-1).
// 앱은 토큰을 직접 만지지 않는다. 재발급은 supabase-js 의 autoRefreshToken 이 한다(4-2).
// 웹에서는 세션을 메모리에만 둔다(secureStorage.ts). localStorage · sessionStorage 에 토큰을 두지 않는다(보안 결정 전).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/config/env';

import { createDemoClient } from './demoClient';
import { safeLog } from './log';
import { authStorage } from './secureStorage';

// 분기 지점: EXPO_PUBLIC_DEMO_MODE=1 이면 서버에 닿지 않는 메모리 모의 클라이언트(테스트웹 TW1, 본문은 F8)를 쓴다. 기본은 진짜 클라이언트.
export const supabase: SupabaseClient = env.demoMode
  ? createDemoClient()
  : createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

const INSTALL_MARKER = 'app.installed';

// 첫 실행: iOS 키체인에 남은 옛 세션을 지운다(앱을 지워도 키체인 값은 남는다).
// 표식은 AsyncStorage 에 둔다. 앱을 지우면 표식도 같이 지워지므로 재설치를 알아볼 수 있다(점검표 A-12).
export async function purgeStaleSessionOnFreshInstall(): Promise<void> {
  // 웹은 세션이 메모리에만 있어 옛 세션이 남을 수 없다. 웹 저장소(localStorage)에 표식을 쓰지 않는다.
  if (Platform.OS === 'web') return;
  if (await AsyncStorage.getItem(INSTALL_MARKER)) return;
  await supabase.auth.signOut({ scope: 'local' });
  await AsyncStorage.setItem(INSTALL_MARKER, '1');
}

// 앱이 백그라운드로 가면 자동 재발급을 멈추고, 돌아오면 다시 켠다(보안/구성.md 4-2).
export function bindAuthAppState(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
  return () => subscription.remove();
}

// 앱을 켤 때 한 번: 옛 세션 정리 → 저장된 로그인이 있는지 확인(K2 2-1 '앱 시작').
// 읽지 못하면 로그인이 없는 것으로 본다. 로그에는 오류 코드만 남긴다(값 · 토큰 금지).
export async function hasStoredLogin(): Promise<boolean> {
  try {
    await purgeStaleSessionOnFreshInstall();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      safeLog({ event: 'session.read.fail', code: error.code ?? 'unknown' });
      return false;
    }
    return data.session != null;
  } catch {
    safeLog({ event: 'session.read.error' });
    return false;
  }
}
