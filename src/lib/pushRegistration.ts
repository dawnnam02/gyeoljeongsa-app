// 알림 토큰 등록(D-199 R 승인 ② 대화방 새 글 알림 · 백엔드 0036 [5] · 처리방침 R26). 비용 0(Expo 기본 푸시).
//  · 서버 함수: public.register_device(p_platform, p_os_version, p_app_version, p_push_token) — 0004(이미 있음). 표 public.devices(본인만 읽기 · 지우기, 탈퇴 때 삭제)
//  · 스위치 chat_push(서버 0036 처음 꺼짐 · 앱 config/featureKeys.json live 꺼짐 · demo 꺼짐)가 켜져 있지 않으면 등록 0 — 토큰을 얻지도 않는다
//  · 알림 권한을 허락한 기기만(묻지 않는다 — 묻는 것은 12 알림 화면의 안내 글 뒤). 웹은 앱 알림이 없어 등록 0
//  · 토큰은 로그 · 화면에 내지 않는다. 실패해도 앱 쓰기는 그대로(조용히 끝)
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { safeLog } from './log';

export const PUSH_FLAG = 'chat_push';
export const REGISTER_DEVICE_RPC = 'register_device';

export type PushRegisterOutcome = 'flag-off' | 'web' | 'no-permission' | 'no-token' | 'registered' | 'failed';
export type PushRegisterDeps = {
  flagOn: () => Promise<boolean>; // 스위치 chat_push
  permission: () => Promise<'granted' | 'denied' | 'undetermined'>; // 지금 권한(묻지 않음)
  token: () => Promise<string | null>; // Expo 알림 토큰
  platform: string; // Platform.OS
  osVersion: string | null;
  appVersion: string | null;
  client: Pick<SupabaseClient, 'rpc'>;
};

export async function registerPushToken(deps: PushRegisterDeps): Promise<PushRegisterOutcome> {
  if (!(await deps.flagOn())) return 'flag-off';
  if (deps.platform !== 'ios' && deps.platform !== 'android') return 'web';
  if ((await deps.permission()) !== 'granted') return 'no-permission';
  let token: string | null = null;
  try {
    token = await deps.token();
  } catch {
    token = null;
  }
  if (!token || token.length < 10 || token.length > 512) return 'no-token';
  const { error } = await deps.client.rpc(REGISTER_DEVICE_RPC, {
    p_platform: deps.platform,
    p_os_version: deps.osVersion ? deps.osVersion.slice(0, 32) : null,
    p_app_version: deps.appVersion ? deps.appVersion.slice(0, 32) : null,
    p_push_token: token,
  });
  if (error) {
    safeLog({ event: 'push.register.fail', code: error.code ?? 'unknown' });
    return 'failed';
  }
  return 'registered';
}

// 기기에서 Expo 알림 토큰 얻기(EAS projectId 가 있어야 한다 — 없으면 null)
export async function expoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = (require('expo-constants') as typeof import('expo-constants')).default;
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId;
    const t = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return t.data ?? null;
  } catch {
    return null;
  }
}
