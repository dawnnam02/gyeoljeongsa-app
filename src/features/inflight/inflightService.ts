// 기내 서비스 화면이 쓰는 연결(IF2-F). 처음 쓸 때 만든다(시험이 서버 설정 없이 화면 파일을 읽을 수 있게 — boardingServices 와 같은 방식)
//  · 홈 · 기내지 · 카드 · 미리 답 질문 · 미리보기 · 궁합 카드 = lib/supabase 클라이언트(데모 모드면 메모리 모의 서버 demo/inflightDemo)
//  · 대화방 칸 = features/chat/chatService inflightChatApi(데모면 데모 채팅)
//  · 재미 정보 동의 CK17A · CK17B(동의문구 4-17 · 판 IF2_CONSENT_VERSIONS): 기록 = consents 넣기(받은 곳 feature_sheet | settings) · 거두기 = revoke_consent(0043 — A 를 거두면 B 도)
//  · 내 여행 타입(F-19): 서버에 타입 계산이 아직 없다(backend 11-5 'R48 ② 서버에 없음') → 실서버는 타입 없음(칸 0). 데모만 계산명세 10-1 식(fun_calc.travel_type)으로 정한 타입 id. 이름 · 설명 · 노선 글은 라이브러리(열두 타입)
import type { SupabaseClient } from '@supabase/supabase-js';

import { IF2_CONSENT_VERSIONS } from '@/config/laterConsent';
import type { ConsentCode } from '@/content/types';
import { loadActiveConsents, recordConsents, type ConsentSource } from '@/lib/consentApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

import { createInflightApi, rpcOf, type InflightApi } from './inflightApi';

export type Ck17State = { a: boolean; b: boolean };
export type Ck17Api = {
  load(): Promise<{ ok: true; data: Ck17State } | { ok: false; reason: 'network' | 'server' }>;
  record(a: boolean, b: boolean, source: ConsentSource): Promise<{ ok: true } | { ok: false; reason: 'network' | 'server' | 'limit' | 'session' }>;
  revoke(code: 'CK17A' | 'CK17B'): Promise<{ ok: true } | { ok: false; reason: 'network' | 'server' | 'session' }>;
};

export function createCk17Api(client: SupabaseClient, appVersion: string): Ck17Api {
  return {
    async load() {
      const r = await loadActiveConsents(client);
      if (!r.ok) return r;
      const on = (code: 'CK17A' | 'CK17B') => r.rows.some((x) => x.item_code === code && x.text_version === IF2_CONSENT_VERSIONS[code]);
      const a = on('CK17A');
      return { ok: true, data: { a, b: a && on('CK17B') } };
    },
    // 예 · 아니오 모두 남긴다(거부도 기록 — 동의문구 6장 1번). B 는 A 를 고른 분만(앱이 막고 서버도 막음)
    async record(a, b, source) {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return { ok: false, reason: 'session' };
      const row = (code: 'CK17A' | 'CK17B', agreed: boolean) => ({ user_id: userId, item_code: code as unknown as ConsentCode /* CK17A · CK17B 는 03 코드 목록 밖(0043 검사 식) */, agreed, text_version: IF2_CONSENT_VERSIONS[code], app_version: appVersion, source });
      const saved = await recordConsents(client, [row('CK17A', a), row('CK17B', a && b)]);
      if (!saved.ok) safeLog({ event: 'if2.ck17.save.fail', code: saved.reason });
      return saved;
    },
    async revoke(code) {
      const { error } = await client.rpc('revoke_consent', { p_item: code });
      if (!error) return { ok: true };
      const f = readDbFailure(error);
      safeLog({ event: 'if2.ck17.revoke.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
      return { ok: false, reason: f.network ? 'network' : f.code === '42501' ? 'session' : 'server' };
    },
  };
}

// 내 여행 타입 id('tt-01' ~ 'tt-12') — 이름 · 앞면 한 줄 · 설명 · 노선 두 역은 라이브러리가 id 로 가진다(서버 값이 생기면 이 id 만 받는다)
export type TypeSource = { mine(): Promise<string | null> };

let made: { api: InflightApi; ck17: Ck17Api; type: TypeSource } | null = null;
export function inflightServices(): { api: InflightApi; ck17: Ck17Api; type: TypeSource } {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const { APP_VERSION } = require('@/lib/appVersion') as typeof import('@/lib/appVersion');
    const type: TypeSource = env.demoMode ? (require('@/demo/typeDemo') as typeof import('@/demo/typeDemo')).demoTypeSource : { mine: async () => null };
    /* eslint-enable @typescript-eslint/no-require-imports */
    made = { api: createInflightApi(rpcOf(supabase)), ck17: createCk17Api(supabase, APP_VERSION), type };
  }
  return made;
}

// 화면 주소(라우트는 src/app — IF-MAG · IF-TYPE · IF-PREVIEW 만 화면, 나머지는 시트)
export const MAGAZINE_HREF = '/magazine';
export const TYPE_CARD_HREF = '/type-card';
export const PREVIEW_HREF = '/preview-me';
