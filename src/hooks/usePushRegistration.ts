// 탭 묶음이 열릴 때 한 번: 스위치 chat_push 가 켜져 있고 알림 권한을 허락한 기기면 알림 토큰을 서버에 등록한다(lib/pushRegistration, D-199).
//  스위치가 꺼져 있으면(출시 전 처음값) 아무것도 하지 않는다 — 토큰을 얻지도 보내지도 않는다. 권한은 여기서 묻지 않는다(12 알림 화면 몫)
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { isOn } from '@/lib/featureFlagsApi';
import { expoPushToken, PUSH_FLAG, registerPushToken } from '@/lib/pushRegistration';

import { appFlagsStore } from './useFeatureFlags';

export function usePushRegistration(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { readPushStatus } = require('@/features/settings/deviceDeps') as typeof import('@/features/settings/deviceDeps');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { APP_VERSION } = require('@/lib/appVersion') as typeof import('@/lib/appVersion');
        const store = appFlagsStore();
        await registerPushToken({
          flagOn: async () => alive && isOn(await store.refresh(), PUSH_FLAG),
          permission: readPushStatus,
          token: expoPushToken,
          platform: Platform.OS,
          osVersion: String(Platform.Version ?? ''),
          appVersion: APP_VERSION,
          client: supabase,
        });
      } catch {
        // 등록 실패는 조용히(앱 쓰기는 그대로)
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
}
