// 사전 오픈 화면의 서버 연결(F22). 처음 쓸 때 만든다 — 시험이 서버 설정 없이 화면 파일을 읽을 수 있게(hooks/useFeatureFlags 의 appFlagsStore 와 같은 방식).
//  · 실제: lib/supabase 의 클라이언트 · 스위치는 앱 공용 저장소(appFlagsStore)
//  · 데모 모드: 데모 클라이언트 위에 사전 오픈 모의 호출(demo/prelaunchDemo)을 얹는다. 스위치도 그 위에서 읽어 데모 처음값(avoid_org · vouch · doc_verify 켜짐)이 보인다
//  · 데모 모드에는 09 위 끼리끼리 데모 줄(demo/kinDemo — '나'의 등급 바꾸기)도 함께 만든다(F24)
//  · 사전 오픈 상태 저장소(launchStore) 하나를 09 · 11 · 16 이 나눠 쓴다. 미룸 공지 본 횟수는 네이티브만 기기에 남긴다(웹은 메모리)
import type { FlagsStore } from '@/hooks/useFeatureFlags';
import type { KinDemo } from '@/demo/kinDemo';
import type { PrelaunchDemo } from '@/demo/prelaunchDemo';

import { createLaunchApi, type LaunchApi } from './launchApi';
import { createLaunchStore, memoryOnly, type DeferMemory, type LaunchStore } from './launchStore';

export type PrelaunchServices = {
  api: Pick<LaunchApi, 'load' | 'link' | 'earlyJoin' | 'loadPublic'>;
  store: LaunchStore;
  flags: FlagsStore;
  demo: PrelaunchDemo | null;
  kin?: KinDemo | null; // F24: 09 위 끼리끼리 데모 줄(데모 모드만)
};

const DEFER_KEY = 'prelaunch.deferSeen';
let made: PrelaunchServices | null = null;

export function prelaunchServices(): PrelaunchServices {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { appFlagsStore, createFlagsStore } = require('@/hooks/useFeatureFlags') as typeof import('@/hooks/useFeatureFlags');
    const { Platform } = require('react-native') as typeof import('react-native');
    let memory: DeferMemory = memoryOnly;
    if (Platform.OS !== 'web') {
      const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
      memory = {
        read: async () => {
          const raw = await AsyncStorage.getItem(DEFER_KEY);
          const v = Number(raw);
          return raw !== null && Number.isInteger(v) && v >= 0 ? v : null;
        },
        write: async (n) => AsyncStorage.setItem(DEFER_KEY, String(n)),
      };
    }
    if (env.demoMode) {
      const { appPrelaunchDemo, withPrelaunchDemo } = require('@/demo/prelaunchDemo') as typeof import('@/demo/prelaunchDemo');
      const { createFeatureFlagsApi } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
      const demo = appPrelaunchDemo();
      const client = withPrelaunchDemo(supabase, demo);
      const flagsApi = createFeatureFlagsApi(client);
      const api = createLaunchApi(client);
      const { createKinDemo } = require('@/demo/kinDemo') as typeof import('@/demo/kinDemo');
      made = { api, store: createLaunchStore(api, memory), flags: createFlagsStore(() => flagsApi.load()), demo, kin: createKinDemo(client) };
    } else {
      const api = createLaunchApi(supabase);
      made = { api, store: createLaunchStore(api, memory), flags: appFlagsStore(), demo: null };
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
  }
  return made;
}
