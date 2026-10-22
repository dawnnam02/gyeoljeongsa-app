// 탑승권 화면의 서버 연결(V5 W6). 처음 쓸 때 만든다 — 시험이 서버 설정 없이 화면 파일을 읽을 수 있게(prelaunchServices 와 같은 방식).
//  · 실제 · 데모 모두 lib/supabase 의 클라이언트(데모 모드면 메모리 모의 서버 — demo/boardingDemo)
//  · 데모 모드에는 탑승권 화면 아래 장면 줄(demo/boardingDemoBar)을 함께 넘긴다
import type { ReactNode } from 'react';

import { createBoardingApi, type BoardingApi } from './boardingApi';

export type BoardingServices = { api: BoardingApi; newId: () => string; demoBar?: (reload: () => void) => ReactNode };

let made: BoardingServices | null = null;

export function boardingServices(): BoardingServices {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { newRequestId } = require('@/lib/requestId') as typeof import('@/lib/requestId');
    const api = createBoardingApi(supabase);
    if (env.demoMode) {
      const { boardingDemoBar } = require('@/demo/boardingDemoBar') as typeof import('@/demo/boardingDemoBar');
      made = { api, newId: () => newRequestId(), demoBar: boardingDemoBar(supabase) };
    } else {
      made = { api, newId: () => newRequestId() };
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
  }
  return made;
}
