// [2] 만남 뒤 한 줄 피드백이 서버와 주고받는 일(K12 2-2 · backend/S12_변경기록.md 4-3 · migrations/0016).
//  get_meet_feedback_prompt() → null(카드 없음) | {off:true}(스위치 꺼짐) | {match_id, state:'ask', card} | {match_id, state:'answered', card, can_edit, editable_until, answer}
//    card = {name: '성OO', age, region{sido, sigungu}} (사진 · 이름 전체 없음) · answer = {met, outcome, mismatch[]} (자기 답만, 고치기 시트 채움용)
//  submit_meet_feedback(p_match, p_met, p_outcome, p_mismatch) → {ok:true} | {off:true}
//    p_met 'met' | 'not_yet' | 'declined' · p_outcome 'good' | 'ok' | 'off' 는 met 일 때만 필수 · p_mismatch 는 outcome 'off' 일 때만(최대 3개, 중복 없음, 허용 코드 21개)
//    오류: forbidden(42501) · invalid_value · not_available · edit_window_closed(48시간이 지났거나 이미 한 번 고침) · rate_limited
//  dismiss_meet_feedback(p_match) → {ok:true} | {off:true} · 오류 forbidden · not_available
//  · 답은 말 3단계뿐이다. 숫자 값 · 별 모양 평가는 보내지도 받지도 않는다(K12 2-13). 상대에게는 아무것도 가지 않는다
//  · '프로필과 달랐어요' · '불편했어요'를 보내도 자동 신고가 아니다. 신고는 사용자가 [신고하기]를 눌러 기존 report_user 로만(2-09)
//  · 카드를 못 불러오면 카드를 그리지 않는다(오류 글 0, 2-2 사용자 흐름) → prompt() 는 오류일 때 none
//  · 로그에는 이벤트 이름과 코드만(이름 · 지역 · 답 금지)
//  · 1단계(F19): 11 화면 연결은 2단계(app/F19_변경기록.md 3장)
import type { SupabaseClient } from '@supabase/supabase-js';

import { cardHead } from '@/features/likes/likesLogic';
import { REASON_NAMES } from '@/features/recs/recsLogic';

import { safeLog } from './log';
import { readDbFailure } from './serverError';

export const MET_VALUES = ['met', 'not_yet', 'declined'] as const;
export const OUTCOME_VALUES = ['good', 'ok', 'off'] as const;
export type MetValue = (typeof MET_VALUES)[number];
export type OutcomeValue = (typeof OUTCOME_VALUES)[number];

// 달랐던 점 코드 21개: 맞는 점 이름 19개(정책 2-4 · 서버 허용 목록과 같은 ID) + 프로필과 달랐어요 + 불편했어요
export const MISMATCH_REPORTABLE = ['profile_diff', 'uncomfortable'] as const;
export const MISMATCH_CODES: readonly string[] = [...Object.keys(REASON_NAMES), ...MISMATCH_REPORTABLE];
export const MISMATCH_MAX = 3;

export type MeetAnswer = { met: MetValue; outcome: OutcomeValue | null; mismatch: string[] };
export type MeetPrompt =
  | { kind: 'none' }
  | { kind: 'off' }
  | { kind: 'ask'; matchId: string; head: string }
  | { kind: 'answered'; matchId: string; head: string; canEdit: boolean; editableUntil: number | null; answer: MeetAnswer | null };

export type MeetFailure = 'off' | 'network' | 'server' | 'unavailable' | 'invalid' | 'edit_closed' | 'limited';
export type MeetResult = { ok: true } | { ok: false; reason: MeetFailure };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isMet = (v: unknown): v is MetValue => typeof v === 'string' && (MET_VALUES as readonly string[]).includes(v);
const isOutcome = (v: unknown): v is OutcomeValue => typeof v === 'string' && (OUTCOME_VALUES as readonly string[]).includes(v);

function readAnswer(raw: unknown): MeetAnswer | null {
  if (!isRecord(raw) || !isMet(raw.met)) return null;
  const mismatch = Array.isArray(raw.mismatch) ? raw.mismatch.filter((c): c is string => typeof c === 'string' && MISMATCH_CODES.includes(c)).slice(0, MISMATCH_MAX) : [];
  return { met: raw.met, outcome: isOutcome(raw.outcome) ? raw.outcome : null, mismatch };
}

// 서버 응답 → 카드 상태. 모르는 모양은 none(카드 없음)
export function parsePrompt(raw: unknown): MeetPrompt {
  if (!isRecord(raw)) return { kind: 'none' };
  if (raw.off === true) return { kind: 'off' };
  if (typeof raw.match_id !== 'string') return { kind: 'none' };
  const head = cardHead(isRecord(raw.card) ? raw.card : {});
  if (raw.state === 'ask') return { kind: 'ask', matchId: raw.match_id, head };
  if (raw.state === 'answered') {
    const until = typeof raw.editable_until === 'string' ? Date.parse(raw.editable_until) : NaN;
    return { kind: 'answered', matchId: raw.match_id, head, canEdit: raw.can_edit === true, editableUntil: Number.isNaN(until) ? null : until, answer: readAnswer(raw.answer) };
  }
  return { kind: 'none' };
}

// 보내기 전에 서버와 같은 규칙으로 고른다. 어긋나면 null(보내지 않는다)
export function toSubmitArgs(matchId: string, answer: MeetAnswer): { p_match: string; p_met: MetValue; p_outcome: OutcomeValue | null; p_mismatch: string[] | null } | null {
  if (!matchId || !isMet(answer.met)) return null;
  if (answer.met === 'met' ? !isOutcome(answer.outcome) : answer.outcome !== null) return null;
  const mismatch = answer.mismatch ?? [];
  if (mismatch.length > 0 && answer.outcome !== 'off') return null;
  if (mismatch.length > MISMATCH_MAX || new Set(mismatch).size !== mismatch.length || mismatch.some((c) => !MISMATCH_CODES.includes(c))) return null;
  return { p_match: matchId, p_met: answer.met, p_outcome: answer.met === 'met' ? answer.outcome : null, p_mismatch: mismatch.length > 0 ? [...mismatch] : null };
}

type Rpc = { data: unknown; error: { code?: string | null; message?: string | null } | null };

export function createMeetFeedbackApi(client: SupabaseClient) {
  // 서버 오류 메시지의 코드(0016 raise exception 이름)
  const messageCode = (error: { message?: string | null }) => String(error.message ?? '').split(':')[0].trim();
  const call = async (name: string, args: Record<string, unknown>): Promise<Rpc> => {
    try {
      return (await client.rpc(name, args)) as Rpc;
    } catch {
      return { data: null, error: { code: 'client', message: 'rpc_failed' } }; // 데모 모드에서 아직 연결되지 않은 함수 등
    }
  };
  const failure = (error: { code?: string | null; message?: string | null }, event: string): MeetFailure => {
    const f = readDbFailure(error);
    const code = messageCode(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    if (f.network) return 'network';
    if (code === 'edit_window_closed') return 'edit_closed';
    if (code === 'invalid_value') return 'invalid';
    if (code === 'rate_limited') return 'limited';
    if (code === 'not_available' || code === 'forbidden' || f.code === '42501') return 'unavailable';
    return 'server';
  };
  const okOrOff = (data: unknown): MeetResult => (isRecord(data) && data.off === true ? { ok: false, reason: 'off' } : { ok: true });

  return {
    // 11 연결됨 탭을 열 때 한 번. 푸시 · 배지 · 알림은 없다(K12 2-04)
    async prompt(): Promise<MeetPrompt> {
      const { data, error } = await call('get_meet_feedback_prompt', {});
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'meet.prompt.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return { kind: 'none' };
      }
      return parsePrompt(data);
    },

    // 처음 부르면 저장, 48시간 안에 한 번 더 부르면 고친다(K12 2-12)
    async submit(matchId: string, answer: MeetAnswer): Promise<MeetResult> {
      const args = toSubmitArgs(matchId, answer);
      if (!args) return { ok: false, reason: 'invalid' };
      const { data, error } = await call('submit_meet_feedback', args);
      if (error) return { ok: false, reason: failure(error, 'meet.submit.fail') };
      return okOrOff(data);
    },

    // 카드의 ×(묻지 않기): 그 쌍은 다시 묻지 않는다
    async dismiss(matchId: string): Promise<MeetResult> {
      const { data, error } = await call('dismiss_meet_feedback', { p_match: matchId });
      if (error) return { ok: false, reason: failure(error, 'meet.dismiss.fail') };
      return okOrOff(data);
    },
  };
}

export type MeetFeedbackApi = ReturnType<typeof createMeetFeedbackApi>;
