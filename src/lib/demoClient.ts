// 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)에서 supabase 대신 쓰는 모의 클라이언트.
// 약속: 서버에 요청을 보내지 않고, 아무것도 기기에 저장하지 않는다(웹이어도 localStorage · sessionStorage 를 쓰지 않는다).
//  · F0: 앱 시작이 부르는 auth 몇 개('로그인 없는 상태')
//  · F1: 02 가입 · 03 동의 흐름에 필요한 만큼 — auth.setSession · getUser · functions.invoke(otp-gate · underage-reject) ·
//        rpc(save_answers) · from(account_status · profiles · consents). 규칙은 lib/demoBackend.ts 가 실제 서버와 같게 흉내 낸다
//  · F3: 06 AI 정리 · 07 확정 — functions.invoke(ai-profile, 모의 응답 3종) · from(ai_results) 읽기 · user_edited 수정 · rpc(confirm_profile)
//  · F2L: 짧은 설문 · 사진은 lib/surveyLiteDemo.ts(메모리, get_progress 는 demoLiteProgress 로 진행을 읽는다)
//  · F5 · F6 · F7: 09 · 10 추천 · 신고 · 차단(lib/demoRecs.ts) · 11 호감 list_likes · accept_like · decline_like(lib/likesDemo.ts) · 12 설정 차단 목록 · 신고 내역 · 알림 · 선택 동의 철회 · 탈퇴(lib/settingsDemo.ts)
//  · 그 밖의 데이터 호출(설문 · 사진 · 추천 · 호감 …)은 F8 에서 채운다. 아직 없는 것을 부르면 무엇이 빠졌는지 알려 주며 멈춘다.
import type { SupabaseClient } from '@supabase/supabase-js';

import { createDemoBackend, type DemoBackend } from './demoBackend';

function notYet(name: string): () => never {
  return () => {
    throw new Error(`데모 모드의 ${name} 은 F8 에서 구현해요`);
  };
}

export function createDemoClient(backend: DemoBackend = createDemoBackend()): SupabaseClient {
  // 화면 점검(scripts/web-f3.mjs)이 모의 서버가 알고 있는 것을 볼 수 있게 읽기 전용 창구를 연다. 데모 모드 웹에서만 만들어지고(스토어 빌드에는 이 클라이언트가 없다) 메모리 안에만 있다
  const host = globalThis as { document?: unknown; __demoPeek?: unknown };
  if (host.document !== undefined) host.__demoPeek = backend.peek;
  const auth = {
    getSession: async () => ({ data: { session: backend.getSession() }, error: null }),
    getUser: async () => ({ data: { user: backend.getSession()?.user ?? null }, error: null }),
    setSession: async (tokens: { access_token?: string; refresh_token?: string }) => {
      const session = backend.setSession(tokens);
      return session
        ? { data: { session, user: session.user }, error: null }
        : { data: { session: null, user: null }, error: { code: 'bad_jwt', message: 'invalid token' } };
    },
    signOut: async () => {
      backend.signOut();
      return { error: null };
    },
    startAutoRefresh: async () => undefined,
    stopAutoRefresh: async () => undefined,
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  };
  // 위에 적은 것만 있는 부분 구현이라 SupabaseClient 로 바꿔 부른다. 없는 메서드는 F8 에서 채운다.
  return {
    auth,
    from: (table: string) => backend.from(table),
    rpc: (name: string, args?: Record<string, unknown>) => backend.rpc(name, args),
    functions: { invoke: (name: string, options?: { body?: unknown }) => backend.invoke(name, options) },
    // LG-F: 라운지 실시간(비공개 채널 흉내 — demo/loungeDemo). 서버 요청 0
    channel: (name: string) => backend.channel(name), // 비공개 설정(config.private)은 데모가 늘 지킨다(내 객실 채널만)
    removeChannel: (ch: unknown) => backend.removeChannel(ch),
    storage: { from: notYet('storage.from') },
  } as unknown as SupabaseClient;
}
