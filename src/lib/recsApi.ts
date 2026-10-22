// 09 · 10 이 서버와 주고받는 일. 원본: backend/스키마.md 9-6 (list_today_recommendations · get_candidate_profile · pass_candidate · send_like · report_user · block_user).
//  · 앱은 서버가 내려 준 것만 그린다(R5): 정렬 · 가리기 · 점수 계산을 하지 않는다. 응답에서 아는 키만 읽는다 — 모르는 키(예: 순위)는 버린다
//  · 점수 · 순위 키는 타입에도 없다. 시험(recsScreen)이 응답 전체에서 영어 이름의 같은 키를 찾는다
//  · 등급(F13): 구독자에게만, 상대가 CK10 에 동의했을 때만 항목에 grade_no(정수 1~9, 작을수록 계산 점수가 높은 쪽)가 온다. 없으면 키 자체가 없다 — 앱은 있을 때만 배지를 그리고 숨기는 계산을 하지 않는다
//  · source(F13): 'free' 오늘 무료 3장 · 'match_once' 1회 매칭으로 받은 추가 카드('추가로 받은 추천' 구역). 서버가 준 순서 그대로
//  · 사진: 서버 함수 photo { action:'url', photo_id } 의 서명 URL(300초). 메모리에서만 쓴다
//  · 로그에는 이벤트 이름과 코드만(이름 · 답 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { readPrompts, type PromptCard } from '@/features/recs/PromptCards';
import { cardInfoLine, headLine, reasonNames, CARD_REASON_MAX, DETAIL_REASON_MAX, type PhotoSlot, type PhotoSlotState } from '@/features/recs/recsLogic';

import { asGradeNo } from './gradeApi';
import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

export type RecsFailure = 'network' | 'server';
export type ActionFailure = 'network' | 'server' | 'unavailable' | 'limit' | 'already';
export type ReportFailure = 'network' | 'server' | 'already' | 'invalid_reason' | 'description_required' | 'invalid_description' | 'unavailable';

export type RecCard = {
  id: string;
  head: string; // "김OO · 32 · 서울 강남"
  info: string; // "직업군 · 학력 · 종교 · 혼인 이력"(상대가 보이게 둔 것만)
  reasons: string[]; // 맞는 점 이름 최대 3
  face: PhotoSlot;
  source: 'free' | 'match_once'; // F13: 1회 매칭 카드는 '추가로 받은 추천' 구역
  gradeNo: number | null; // F13: 서버가 준 상대 등급(구독자 + 상대 CK10 동의일 때만). 없으면 null = 배지 없음
  liked: boolean;
  connected: boolean;
  passed: boolean;
};
export type TodayData = {
  day: string;
  ready: boolean; // 오늘(09:00 기준 하루) 매칭 배치가 끝났나. 서버가 주지 않으면 true(0008 이전 응답)
  firstListPending: boolean; // 성향 확정 뒤 아직 첫 목록을 받을 차례가 안 온 계정(서버 계산, 가정 D-40) → 0장이면 첫 추천 대기 NK01
  regionHint: boolean; // Q3c: 오늘 목록이 만들어졌고 무료 추천이 3명 미만이면 서버가 true. 앱은 무료 카드가 1~2장일 때만 '지역 조건 바꾸기' 안내 3줄을 보인다(지역 조건은 서버가 풀지 않는다)
  nextAt: number; // 다음 갱신 시각(ms)
  offset: number; // 서버 시각 − 기기 시각(ms). 서버가 now 를 주지 않으면 0
  cards: RecCard[];
};
export type CandidateData = {
  id: string;
  answers: Readonly<Record<string, unknown>>;
  photos: PhotoSlot[];
  reasons: string[]; // 맞는 점 이름 최대 5
  gradeNo: number | null; // F13: 구독자 + 상대 CK10 동의일 때만(없으면 null)
  prompts?: PromptCard[]; // F24 · D-144: 질문 카드(서버 prompts[{code, question, answer}], S14 0018). 없으면 빈 목록 = 칸 없음
};
export type LikeResult = { connected: boolean };
// get_pair_state(0008 · 0011): 10 하단 버튼 상태. state = none(보낼 수 있음) · sent(내가 보냄 — 0011 뒤에는 상대가 거절해도 만료까지 sent) · received(상대가 보냄) · connected,
// likesLeft = 오늘 더 보낼 호감 0~3, likeId = received 면 수락 · 거절에 쓰는 id, matchId = connected 의 연결 id, expiresAt = received 의 만료 시각(ms)
export type PairState = { state: 'none' | 'sent' | 'received' | 'connected'; likesLeft: number | null; likeId: string | null; matchId: string | null; expiresAt: number | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SLOT_ORDER = ['face', 'full', 'free'];

function readPhotos(value: unknown): PhotoSlot[] {
  const list = Array.isArray(value) ? value : [];
  const out: PhotoSlot[] = [];
  for (const slot of SLOT_ORDER) {
    const row = list.find((x) => isRecord(x) && x.slot === slot) as Record<string, unknown> | undefined;
    const state: PhotoSlotState = row?.state === 'approved' || row?.state === 'pending' ? row.state : 'none';
    out.push({ slot, state, photoId: state === 'approved' && typeof row?.photo_id === 'string' ? row.photo_id : null });
  }
  return out;
}

export function parseToday(raw: unknown, deviceNow: number): TodayData | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  const nextAt = typeof raw.next_at === 'string' ? Date.parse(raw.next_at) : NaN;
  if (Number.isNaN(nextAt)) return null;
  const serverNow = typeof raw.now === 'string' ? Date.parse(raw.now) : NaN; // 서버가 현재 시각을 주면 기기 시계 차이를 지운다
  const cards: RecCard[] = [];
  for (const item of raw.items) {
    if (!isRecord(item) || typeof item.candidate_id !== 'string') continue;
    const answers = isRecord(item.profile) ? item.profile : {};
    cards.push({
      id: item.candidate_id,
      head: headLine(answers),
      info: cardInfoLine(answers),
      reasons: reasonNames(Array.isArray(item.reasons) ? item.reasons : [], CARD_REASON_MAX),
      face: readPhotos(item.photos)[0],
      source: item.source === 'match_once' ? 'match_once' : 'free',
      gradeNo: asGradeNo(item.grade_no),
      liked: item.liked === true,
      connected: item.connected === true,
      passed: item.passed === true,
    });
  }
  return { day: typeof raw.day === 'string' ? raw.day : '', ready: raw.ready !== false, firstListPending: raw.first_list_pending === true, regionHint: raw.region_hint === true, nextAt, offset: Number.isNaN(serverNow) ? 0 : serverNow - deviceNow, cards };
}

export function parseCandidate(raw: unknown): CandidateData | null {
  if (!isRecord(raw) || typeof raw.user_id !== 'string') return null;
  return {
    id: raw.user_id,
    answers: isRecord(raw.answers) ? raw.answers : {},
    photos: readPhotos(raw.photos),
    reasons: reasonNames(Array.isArray(raw.reasons) ? raw.reasons : [], DETAIL_REASON_MAX),
    gradeNo: asGradeNo(raw.grade_no),
    prompts: readPrompts(raw.prompts),
  };
}

export function createRecsApi(client: SupabaseClient, now: () => number = Date.now) {
  const fail = (error: { code?: string | null; message?: string | null }, event: string) => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return f;
  };
  // 서버 오류 메시지의 코드(스키마 9-6 오류 코드 표)
  const messageCode = (error: { message?: string | null }) => String(error.message ?? '').split(':')[0].trim();

  return {
    async loadToday(): Promise<{ ok: true; data: TodayData } | { ok: false; reason: RecsFailure }> {
      const { data, error } = await client.rpc('list_today_recommendations');
      if (error) return { ok: false, reason: fail(error, 'recs.load.fail').network ? 'network' : 'server' };
      const parsed = parseToday(data, now());
      if (!parsed) return { ok: false, reason: 'server' };
      return { ok: true, data: parsed };
    },

    // 볼 수 없으면 null(정지 · 탈퇴 · 차단 · 목록 밖 · 넘긴 카드를 구분하지 않는다)
    async loadCandidate(id: string): Promise<{ ok: true; data: CandidateData | null } | { ok: false; reason: RecsFailure }> {
      const { data, error } = await client.rpc('get_candidate_profile', { p_target: id });
      if (error) {
        const f = fail(error, 'candidate.load.fail');
        return f.code === '42501' || messageCode(error) === 'forbidden' ? { ok: true, data: null } : { ok: false, reason: f.network ? 'network' : 'server' };
      }
      return { ok: true, data: data === null ? null : parseCandidate(data) };
    },

    async photoUrl(photoId: string): Promise<string | null> {
      const { data, error } = await client.functions.invoke('photo', { body: { action: 'url', photo_id: photoId } });
      if (error) {
        const f = await readFunctionFailure(error);
        safeLog({ event: 'recs.photo.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return null;
      }
      return isRecord(data) && data.ok === true && typeof data.url === 'string' ? data.url : null;
    },

    // 못 읽어도 화면은 그대로 간다(서버가 보낼 때 최종으로 막는다). 볼 수 없는 상대 · 오류는 null
    async pairState(id: string): Promise<PairState | null> {
      const { data, error } = await client.rpc('get_pair_state', { p_target: id });
      if (error || !isRecord(data)) return null;
      const state = data.state === 'sent' || data.state === 'received' || data.state === 'connected' ? data.state : 'none';
      const expires = typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN;
      return {
        state,
        likesLeft: typeof data.likes_left === 'number' ? data.likes_left : null,
        likeId: typeof data.like_id === 'string' ? data.like_id : null,
        matchId: typeof data.match_id === 'string' ? data.match_id : null,
        expiresAt: Number.isNaN(expires) ? null : expires,
      };
    },

    async pass(id: string): Promise<{ ok: true } | { ok: false; reason: ActionFailure }> {
      const { error } = await client.rpc('pass_candidate', { p_target: id });
      if (!error) return { ok: true };
      const f = fail(error, 'recs.pass.fail');
      return { ok: false, reason: f.network ? 'network' : messageCode(error) === 'not_available' || f.code === '42501' ? 'unavailable' : 'server' };
    },

    async sendLike(id: string): Promise<{ ok: true; data: LikeResult } | { ok: false; reason: ActionFailure }> {
      const { data, error } = await client.rpc('send_like', { p_target: id });
      if (error) {
        const f = fail(error, 'recs.like.fail');
        const code = messageCode(error);
        if (f.network) return { ok: false, reason: 'network' };
        if (code === 'daily_limit') return { ok: false, reason: 'limit' };
        if (code === 'already_sent') return { ok: false, reason: 'already' };
        if (code === 'not_available' || f.code === '42501') return { ok: false, reason: 'unavailable' };
        return { ok: false, reason: 'server' };
      }
      return { ok: true, data: { connected: isRecord(data) && data.connected === true } };
    },

    // 신고: 사유 코드 RP1~RP8 · 설명(선택, 200자 이하, RP8 은 10자 이상). 서버가 신고자에게 상대를 즉시 숨긴다(P5-03)
    async report(id: string, reasonCode: string, description: string): Promise<{ ok: true } | { ok: false; reason: ReportFailure }> {
      const text = description.trim();
      const { error } = await client.rpc('report_user', { p_target: id, p_reason: reasonCode, p_description: text === '' ? null : text });
      if (!error) return { ok: true };
      const f = fail(error, 'recs.report.fail');
      if (f.network) return { ok: false, reason: 'network' };
      const code = messageCode(error);
      if (code === 'already_reported') return { ok: false, reason: 'already' };
      if (code === 'invalid_reason' || code === 'description_required' || code === 'invalid_description') return { ok: false, reason: code };
      if (code === 'not_available' || f.code === '42501') return { ok: false, reason: 'unavailable' };
      return { ok: false, reason: 'server' };
    },

    async block(id: string): Promise<{ ok: true } | { ok: false; reason: 'network' | 'server' | 'unavailable' }> {
      const { error } = await client.rpc('block_user', { p_target: id });
      if (!error) return { ok: true };
      const f = fail(error, 'recs.block.fail');
      return { ok: false, reason: f.network ? 'network' : messageCode(error) === 'not_available' || f.code === '42501' ? 'unavailable' : 'server' };
    },
  };
}

export type RecsApi = ReturnType<typeof createRecsApi>;
