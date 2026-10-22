// [1] 오늘의 한 분 강조를 읽는 일(K12 2-1 · backend/S12_변경기록.md 4-2). 새 서버 함수는 없고 list_today_recommendations 응답에 키 하나가 더해졌다.
//  items[i].featured : boolean, true 일 때만 키가 있다. 항상 items[0] · 무료 카드(source 'free')에만 붙는다
//  items[0].reasons  : 강조일 때 최대 5개(보통 카드는 3개)
//  · 앱이 읽는 것은 '불리언 하나'뿐이다: featured === true 가 아니면(1 · 'true' · 없음) 강조가 아니다. 숫자 키는 읽지도 타입에 두지도 않는다
//  · 앱은 정렬하지 않는다(R5). 서버가 강조 카드를 맨 앞에 놓아 준 순서 그대로 그린다. items[0] 밖의 featured 는 버린다
//  · 강조 모양은 호감을 보냈거나 넘긴 카드에서 벗긴다(자리는 그대로, features/featured/featuredLogic.ts)
//  · 카드 목록은 기존 parseToday(lib/recsApi.ts)를 그대로 쓴다. 이 파일은 강조 한 가지만 더 읽는다
//  · 1단계(F19): 09 화면 연결은 2단계(app/F19_변경기록.md 3장 — recsApi.loadToday 대신 이 loadToday 를 쓴다)
import type { SupabaseClient } from '@supabase/supabase-js';

import { reasonNames } from '@/features/recs/recsLogic';

import { safeLog } from './log';
import { parseToday, type RecsFailure, type TodayData } from './recsApi';
import { readDbFailure } from './serverError';

export const FEATURED_REASON_MAX = 5; // 강조 카드 칩(보통 카드 3)

export type FeaturedPick = {
  candidateId: string;
  reasons: string[]; // 맞는 점 이름(정책 2-4 의 19개 안에서만) 최대 5
};
export type TodayWithFeatured = { today: TodayData; featured: FeaturedPick | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseFeatured(raw: unknown): FeaturedPick | null {
  if (!isRecord(raw) || !Array.isArray(raw.items) || raw.items.length === 0) return null;
  const first: unknown = raw.items[0];
  if (!isRecord(first) || first.featured !== true || typeof first.candidate_id !== 'string') return null;
  if (first.source === 'match_once') return null; // 1회 매칭 카드에는 붙지 않는다(K12 1-10)
  return { candidateId: first.candidate_id, reasons: reasonNames(Array.isArray(first.reasons) ? first.reasons : [], FEATURED_REASON_MAX) };
}

export function createFeaturedApi(client: SupabaseClient, now: () => number = Date.now) {
  return {
    // 09 목록 + 강조 한 분(없으면 null). 강조를 못 읽어도 목록은 그대로 보인다(오류 글 0, K12 2-1 오류 칸)
    async loadToday(): Promise<{ ok: true; data: TodayWithFeatured } | { ok: false; reason: RecsFailure }> {
      const { data, error } = await client.rpc('list_today_recommendations');
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'recs.load.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return { ok: false, reason: f.network ? 'network' : 'server' };
      }
      const today = parseToday(data, now());
      if (!today) return { ok: false, reason: 'server' };
      const pick = parseFeatured(data);
      const featured = pick && today.cards[0]?.id === pick.candidateId ? pick : null; // 목록에서 읽힌 첫 카드와 같을 때만
      return { ok: true, data: { today, featured } };
    },
  };
}

export type FeaturedApi = ReturnType<typeof createFeaturedApi>;
