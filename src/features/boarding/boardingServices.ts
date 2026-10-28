// 탑승권 화면의 서버 연결(V5 W6). 처음 쓸 때 만든다 — 시험이 서버 설정 없이 화면 파일을 읽을 수 있게(prelaunchServices 와 같은 방식).
//  · 실제 · 데모 모두 lib/supabase 의 클라이언트(데모 모드면 메모리 모의 서버 — demo/boardingDemo)
//  · 데모 모드에는 탑승권 화면 아래 장면 줄(demo/boardingDemoBar)을 함께 넘긴다
import type { ReactNode } from 'react';

import { createBoardingApi, type BoardingApi } from './boardingApi';
import type { InflightHomeDeps } from '@/features/inflight/InflightHome';

import { createOpenedRounds, openedMemoryOnly, type OpenedMemory, type OpenedRounds } from './openedRounds';

const OPENED_KEY = 'boarding.openedRounds.v1'; // 공개를 열어 본 회차 번호(도착 화면은 한 회차에 한 번, D-178)

// IF2-F: inflightBase = 홈 새 구성 연결(스위치 읽기 isOn 은 라우트가 훅으로 더한다) · inflightBar = 데모 장면 줄(데모만)
export type BoardingServices = { api: BoardingApi; newId: () => string; opened: OpenedRounds; demoBar?: (reload: () => void) => ReactNode; inflightBase: Omit<InflightHomeDeps, 'isOn'>; inflightBar?: (reload: () => void) => ReactNode };

let made: BoardingServices | null = null;

export function boardingServices(): BoardingServices {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { newRequestId } = require('@/lib/requestId') as typeof import('@/lib/requestId');
    const { Platform } = require('react-native') as typeof import('react-native');
    const api = createBoardingApi(supabase);
    let memory: OpenedMemory = openedMemoryOnly;
    if (Platform.OS !== 'web') {
      const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
      memory = {
        read: async () => {
          const raw = await AsyncStorage.getItem(OPENED_KEY);
          const v: unknown = raw ? JSON.parse(raw) : null;
          return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : null;
        },
        write: async (rounds) => AsyncStorage.setItem(OPENED_KEY, JSON.stringify(rounds)),
      };
    }
    const opened = createOpenedRounds(memory);
    const { inflightServices } = require('@/features/inflight/inflightService') as typeof import('@/features/inflight/inflightService');
    const s = inflightServices();
    const inflightBase = { api: s.api, ck17: s.ck17, type: s.type };
    if (env.demoMode) {
      const { boardingDemoBar } = require('@/demo/boardingDemoBar') as typeof import('@/demo/boardingDemoBar');
      const { inflightDemoBar } = require('@/demo/inflightDemoBar') as typeof import('@/demo/inflightDemoBar');
      made = { api, newId: () => newRequestId(), opened, demoBar: boardingDemoBar(supabase, opened), inflightBase, inflightBar: inflightDemoBar(supabase, opened) };
    } else {
      made = { api, newId: () => newRequestId(), opened, inflightBase };
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
  }
  return made;
}
