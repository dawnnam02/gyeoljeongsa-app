// 11 호감이 서버와 주고받는 일. 원본: backend/스키마.md 9-12 (S5) — list_likes · accept_like · decline_like (0004).
//  list_likes(p_kind = 'received' | 'sent' | 'connected') → 배열(최신순)
//    received  { like_id, user_id, created_at, expires_at, card }
//    sent      { like_id, user_id, created_at, card }                (만료 시각 없음 — 보낸 호감은 남은 시간을 보이지 않는다, P7-05)
//    connected { match_id, user_id, created_at, card }
//    card = { name(성+OO), age, region{sido,sigungu}, face_photo_id }. 만료 · 차단 · 탈퇴 · 거절은 서버가 목록에서 뺀다. 쓸 수 없는 계정은 null
//  accept_like(p_like_id) → { match_id, user_id } · decline_like(p_like_id) → null. 오류: forbidden(42501) · not_available(만료 · 이미 처리 · 차단 · 탈퇴 · 정지, 이유 구분 없음)
//  · 앱은 응답에서 아는 키만 읽는다(점수 · 등급 · 순위는 타입에도 없다). 사진은 승인된 얼굴 사진 id 만 오고, 열람 URL 은 photo 함수(recsApi.photoUrl)
//  · 로그에는 이벤트 이름과 코드만(이름 · 지역 금지)
//  · 1단계: services.ts 를 고치지 않으려고 화면이 createLikesApi(supabase) 를 처음 쓸 때 만든다(app/확인/F6_통합목록.md 1)
import type { SupabaseClient } from '@supabase/supabase-js';

import { cardHead, newestFirst } from '@/features/likes/likesLogic';

import { safeLog } from './log';
import { readDbFailure } from './serverError';

export type LikesKind = 'received' | 'sent' | 'connected';
export type LoadFailure = 'network' | 'server';
export type RespondFailure = 'network' | 'server' | 'unavailable';

type Base = { userId: string; createdAt: number; head: string; facePhotoId: string | null };
export type ReceivedLike = Base & { kind: 'received'; likeId: string; expiresAt: number };
export type SentLike = Base & { kind: 'sent'; likeId: string };
export type ConnectedLike = Base & { kind: 'connected'; matchId: string };
export type LikeRow = ReceivedLike | SentLike | ConnectedLike;
export type LikeLists = { received: ReceivedLike[]; sent: SentLike[]; connected: ConnectedLike[] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const time = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) : NaN);

function base(item: Record<string, unknown>): Base | null {
  const createdAt = time(item.created_at);
  if (typeof item.user_id !== 'string' || Number.isNaN(createdAt)) return null;
  const card = isRecord(item.card) ? item.card : {};
  return { userId: item.user_id, createdAt, head: cardHead(card), facePhotoId: typeof card.face_photo_id === 'string' ? card.face_photo_id : null };
}

// 모르는 모양의 행은 버린다. 배열이 아니면 null(읽지 못함)
export function parseLikes(kind: 'received', raw: unknown): ReceivedLike[] | null;
export function parseLikes(kind: 'sent', raw: unknown): SentLike[] | null;
export function parseLikes(kind: 'connected', raw: unknown): ConnectedLike[] | null;
export function parseLikes(kind: LikesKind, raw: unknown): LikeRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: LikeRow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const b = base(item);
    if (!b) continue;
    if (kind === 'connected') {
      if (typeof item.match_id === 'string') rows.push({ ...b, kind, matchId: item.match_id });
      continue;
    }
    if (typeof item.like_id !== 'string') continue;
    if (kind === 'sent') {
      rows.push({ ...b, kind, likeId: item.like_id });
      continue;
    }
    const expiresAt = time(item.expires_at);
    if (Number.isNaN(expiresAt)) continue;
    rows.push({ ...b, kind, likeId: item.like_id, expiresAt });
  }
  return newestFirst(rows);
}

type Rpc = { data: unknown; error: { code?: string | null; message?: string | null } | null };

export function createLikesApi(client: SupabaseClient) {
  // 서버 오류 메시지의 코드(스키마 9-12 오류 코드 표)
  const messageCode = (error: { message?: string | null }) => String(error.message ?? '').split(':')[0].trim();
  const call = async (name: string, args: Record<string, unknown>): Promise<Rpc> => {
    try {
      return (await client.rpc(name, args)) as Rpc;
    } catch {
      return { data: null, error: { code: 'client', message: 'rpc_failed' } }; // 데모 모드에서 아직 연결되지 않은 함수 등
    }
  };
  const respondFailure = (error: { code?: string | null; message?: string | null }, event: string): RespondFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    if (f.network) return 'network';
    if (f.code === '42501' || messageCode(error) === 'not_available' || messageCode(error) === 'forbidden') return 'unavailable';
    return 'server';
  };

  async function list(kind: 'received'): Promise<{ ok: true; data: ReceivedLike[] } | { ok: false; reason: LoadFailure }>;
  async function list(kind: 'sent'): Promise<{ ok: true; data: SentLike[] } | { ok: false; reason: LoadFailure }>;
  async function list(kind: 'connected'): Promise<{ ok: true; data: ConnectedLike[] } | { ok: false; reason: LoadFailure }>;
  async function list(kind: LikesKind): Promise<{ ok: true; data: LikeRow[] } | { ok: false; reason: LoadFailure }> {
    const { data, error } = await call('list_likes', { p_kind: kind });
    if (error) {
      const f = readDbFailure(error);
      safeLog({ event: 'likes.load.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
      return { ok: false, reason: f.network ? 'network' : 'server' };
    }
    const rows = kind === 'received' ? parseLikes('received', data) : kind === 'sent' ? parseLikes('sent', data) : parseLikes('connected', data);
    if (!rows) return { ok: false, reason: 'server' };
    return { ok: true, data: rows };
  }

  return {
    list,

    // 세 목록을 한 번에. 하나라도 실패하면 실패(인터넷 문제가 있으면 그것을 먼저 알린다)
    async loadAll(): Promise<{ ok: true; data: LikeLists } | { ok: false; reason: LoadFailure }> {
      const [received, sent, connected] = await Promise.all([list('received'), list('sent'), list('connected')]);
      if (received.ok && sent.ok && connected.ok) return { ok: true, data: { received: received.data, sent: sent.data, connected: connected.data } };
      const reasons = [received, sent, connected].flatMap((r) => (r.ok ? [] : [r.reason]));
      return { ok: false, reason: reasons.includes('network') ? 'network' : 'server' };
    },

    // [수락] → 연결. 수락한 쪽 하루 한도에는 세지 않는다(P7-13)
    async accept(likeId: string): Promise<{ ok: true; data: { matchId: string | null; userId: string | null } } | { ok: false; reason: RespondFailure }> {
      const { data, error } = await call('accept_like', { p_like_id: likeId });
      if (error) return { ok: false, reason: respondFailure(error, 'likes.accept.fail') };
      const d = isRecord(data) ? data : {};
      return { ok: true, data: { matchId: typeof d.match_id === 'string' ? d.match_id : null, userId: typeof d.user_id === 'string' ? d.user_id : null } };
    },

    // [거절] → 상대에게 알리지 않고 되돌릴 수 없다. 그 쌍은 영구 제외(P7-06)
    async decline(likeId: string): Promise<{ ok: true } | { ok: false; reason: RespondFailure }> {
      const { error } = await call('decline_like', { p_like_id: likeId });
      if (error) return { ok: false, reason: respondFailure(error, 'likes.decline.fail') };
      return { ok: true };
    },
  };
}

export type LikesApi = ReturnType<typeof createLikesApi>;
