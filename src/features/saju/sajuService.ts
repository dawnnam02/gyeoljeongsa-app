// 사주 마당 화면이 쓰는 서버 연결(IF5-F1). 처음 쓸 때 만든다(시험이 서버 설정 없이 화면 파일을 읽을 수 있게 — inflightService 와 같은 방식).
//  · 사주 계산 = lib/supabase 클라이언트의 rpc(데모 모드면 메모리 모의 서버 demo/sajuDemo) · 재미 정보 동의 CK17A = 기내 서비스와 같은 Ck17Api
//  · 상대 생일은 이 연결을 지나지 않는다(늘 기기 계산 — partnerLocal)
import { rpcOf } from '@/features/inflight/inflightApi';
import type { Ck17Api } from '@/features/inflight/inflightService';

import { createSajuApi, type SajuApi } from './sajuApi';

export type SajuDeps = {
  api: SajuApi;
  ck17: Ck17Api;
  isOn: (key: string) => boolean;
  birthDate?: () => Promise<string | null>; // 입력 시트에 읽기만 보여 줄 저장된 생년월일(프로필 읽기 — 이 화면은 쥐고 있지 않는다)
  now?: () => number;
};

let made: { api: SajuApi; ck17: Ck17Api; birthDate: () => Promise<string | null> } | null = null;
export function sajuServices(): { api: SajuApi; ck17: Ck17Api; birthDate: () => Promise<string | null> } {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { inflightServices } = require('@/features/inflight/inflightService') as typeof import('@/features/inflight/inflightService');
    const { profileApi } = require('@/lib/services') as typeof import('@/lib/services');
    /* eslint-enable @typescript-eslint/no-require-imports */
    made = {
      api: createSajuApi(rpcOf(supabase)),
      ck17: inflightServices().ck17,
      birthDate: async () => {
        const r = await profileApi.load();
        return r.ok ? r.data.birthDate : null;
      },
    };
  }
  return made;
}
