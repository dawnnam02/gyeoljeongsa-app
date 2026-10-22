// 12 설정이 기기 기능에 닿는 곳(F7 2단계): 클립보드(고객센터 [복사]) · 푸시 권한(알림 화면).
// 화면 시험은 이 함수 대신 가짜를 deps 로 넣는다. 모듈은 부를 때 불러 시험 환경에 네이티브 모듈이 없어도 화면 파일을 읽을 수 있게 한다.
import { Platform } from 'react-native';

import { safeLog } from '@/lib/log';

export type PushStatus = 'granted' | 'denied' | 'undetermined';

type PermissionLike = { granted?: boolean; status?: string; canAskAgain?: boolean };

export function pushStatusOf(p: PermissionLike | null | undefined): PushStatus {
  if (!p) return 'undetermined';
  if (p.granted || p.status === 'granted') return 'granted';
  if (p.status === 'denied' || p.canAskAgain === false) return 'denied';
  return 'undetermined';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    return await Clipboard.setStringAsync(text);
  } catch {
    safeLog({ event: 'settings.copy.fail' });
    return false;
  }
}

// 지금 권한(묻지 않는다). 웹은 앱 알림이 없어 '아직 정하지 않음'으로 본다
export async function readPushStatus(): Promise<PushStatus> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    return pushStatusOf(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

// 시스템 권한 창을 띄운다. 화면은 이 직전에 동의문구 5-5 안내 글을 먼저 보인다(NOTIFY.pushPrime)
export async function requestPushPermission(): Promise<PushStatus> {
  if (Platform.OS === 'web') return 'undetermined';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    return pushStatusOf(await Notifications.requestPermissionsAsync());
  } catch {
    safeLog({ event: 'settings.push.request.fail' });
    return 'undetermined';
  }
}
