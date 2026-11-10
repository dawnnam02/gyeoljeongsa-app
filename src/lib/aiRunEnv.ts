// RS2-01 · 실서버 AI 길(features/ait/aiCall.ts)의 기본 연결 — 서버 주소 · 공개 키 · 로그인 토큰.
//  features/ait 안 코드는 로그인 클라이언트(supabase)를 직접 가져오지 않는다(ATF-16 ~ 19 분리 점검) — 필요한 연결은 여기서 만들어 처음 쓸 때 가져간다.
//  · 토큰은 부를 때마다 로그인 상태에서 읽고 어디에도 두지 않는다. 401 이면 이 기기의 로그인을 끝낸다(세션 만료와 같은 길 — 화면 가드가 로그인으로 보낸다).
import { env } from '@/config/env';
import type { AiRunEnv } from '@/features/ait/aiCall';

import { supabase } from './supabase';

export function defaultAiRunEnv(): AiRunEnv {
  return {
    url: env.supabaseUrl,
    apikey: env.supabasePublishableKey,
    token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
    onAuthLost: () => {
      void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
  };
}
