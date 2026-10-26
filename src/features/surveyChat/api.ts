// 대화형 설문(V6-F)이 서버와 주고받는 일 — 2부 인터뷰 · CK16 · 정리 · 내 성향. 1부 답은 설문 v2 API(features/surveyV2/api.ts save_answers 등) 그대로 쓴다.
//  서버 이름은 CHAT_SERVER 한 곳(backend/작업중/0033_survey_interview.sql · functions/survey-interview · survey-analyze). 데모는 같은 이름의 모의 서버(src/demo/surveyChatBackend.ts)
//  · 앱 함수: interview_start(p_device) · interview_resume(p_session) · interview_set_state(p_session, p_state) · get_interview_summary() · edit_interview_summary(p_edit)
//  · Edge: survey-interview {action: open | turn, session_id, text?, behavior?} → {ok, reply{seq, slot, text, source}, turn, turns_left, done, fallback, guard, behavior_saved} | {off}
//          survey-analyze {session_id} → {ok: true, status: 'done', version} | {ok: false, status: 'waiting'} | {off}
//  · CK16 동의: consents 에 CK16 한 줄(정치 CK15 와 같은 길, lib/consentApi). 동의가 없으면 행동 숫자를 보내지 않는다(서버도 한 번 더 버림)
//  · 스트리밍(SSE)은 쓰지 않는다 — 한 턴 JSON 하나. 실제 호출 여부(live)는 서버가 정한다(앱은 모델 · 키를 모른다)
//  로그에는 이벤트 이름과 코드만(글 · 숫자 · 사용자 ID 0).
import type { SupabaseClient } from '@supabase/supabase-js';

import { CK16_TEXT_VERSION } from '@/config/laterConsent';
import type { ConsentCode } from '@/content/types';
import { recordConsents } from '@/lib/consentApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

import type { Behavior } from './behavior';

export const CHAT_SERVER = {
  start: 'interview_start',
  resume: 'interview_resume',
  setState: 'interview_set_state',
  summary: 'get_interview_summary',
  edit: 'edit_interview_summary',
  turn: 'survey-interview',
  analyze: 'survey-analyze',
  consentCode: 'CK16',
  consentVersion: CK16_TEXT_VERSION, // 법무 메모 판(팀장 D-186 · 판_관리 2-1), config/laterConsent.ts 한 곳
} as const;

export type ChatFailure = 'network' | 'server' | 'off' | 'daily_limit' | 'turn_limit';
export type SessionState = 'part1' | 'part2' | 'wrap' | 'done';
export type Session = { id: number; state: SessionState; userTurns: number; turnsLeft: number; ck16: boolean; analysis: string };
export type Turn = { seq: number; role: 'ai' | 'user'; slot: string | null; text: string | null };
export type Reply = { seq: number; slot: string | null; text: string; source: 'model' | 'fallback' | 'preset' };
export type TurnResult = { reply: Reply; turn: number; turnsLeft: number; done: boolean; fallback: boolean; guard: 'ok' | 'flagged' | 'blocked'; behaviorSaved: boolean; duplicate: boolean };
export type SummaryFacts = Readonly<Record<string, string>>;
export type Summary = {
  status: 'none' | 'running' | 'waiting' | 'done';
  summary: string | null;
  reason: string | null;
  facts: SummaryFacts;
  edited: { summary?: string; facts?: SummaryFacts } | null;
  styleChips: readonly string[]; // 가정 키 style_chips(이야기하는 방식 갈래 코드) — 서버에 없으면 빈 목록
  paceUsed: boolean;
};
export type Result<T> = { ok: true; data: T } | { ok: false; reason: ChatFailure };

export type SurveyChatApi = {
  start(device: 'phone' | 'pc'): Promise<Result<Session>>;
  resume(sessionId: number | null): Promise<Result<{ session: Session | null; turns: Turn[] }>>;
  setState(sessionId: number, state: 'part2' | 'wrap'): Promise<Result<Session>>;
  open(sessionId: number): Promise<Result<TurnResult>>;
  turn(sessionId: number, text: string, behavior: Behavior | null | undefined, clientTurn?: number): Promise<Result<TurnResult>>;
  analyze(sessionId: number): Promise<Result<'done' | 'waiting'>>;
  summary(): Promise<Result<Summary>>;
  edit(edit: { summary?: string | null; facts?: Readonly<Record<string, string | null>> }): Promise<Result<true>>;
  agreeCk16(): Promise<Result<true>>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const STYLE_CODES = ['deliberate', 'warm', 'candid'];

function failOf(error: unknown): ChatFailure {
  const e = isRecord(error) ? error : {};
  const msg = typeof e.message === 'string' ? e.message : '';
  for (const code of ['daily_limit', 'turn_limit'] as const) if (msg.startsWith(code)) return code;
  // Edge 오류(FunctionsHttpError): 응답 상태로 가린다 — 429 는 25턴 상한(turn_limit)
  const ctx = isRecord(e.context) ? e.context : null;
  if (e.name === 'FunctionsHttpError') return ctx && ctx.status === 429 ? 'turn_limit' : 'server';
  if (e.name === 'FunctionsFetchError' || e.name === 'FunctionsRelayError') return 'network';
  const f = readDbFailure({ code: typeof e.code === 'string' ? e.code : null, message: msg });
  return f.network ? 'network' : 'server';
}

export function readSession(v: unknown): Session | null {
  if (!isRecord(v) || typeof v.session_id !== 'number') return null;
  const state = (['part1', 'part2', 'wrap', 'done'] as const).find((s) => s === v.state) ?? 'part1';
  return { id: v.session_id, state, userTurns: num(v.user_turns), turnsLeft: num(v.turns_left, 25), ck16: v.ck16 === true, analysis: str(v.analysis) ?? 'none' };
}

function readTurn(v: unknown): Result<TurnResult> {
  if (!isRecord(v)) return { ok: false, reason: 'server' };
  if (v.off === true) return { ok: false, reason: 'off' };
  const r = isRecord(v.reply) ? v.reply : null;
  if (v.ok !== true || !r || typeof r.text !== 'string') return { ok: false, reason: 'server' };
  const source = r.source === 'fallback' || r.source === 'preset' ? r.source : 'model';
  const guard = v.guard === 'flagged' || v.guard === 'blocked' ? v.guard : 'ok';
  return {
    ok: true,
    data: { reply: { seq: num(r.seq), slot: str(r.slot), text: r.text, source }, turn: num(v.turn), turnsLeft: num(v.turns_left, 25), done: v.done === true, fallback: v.fallback === true, guard, behaviorSaved: v.behavior_saved === true, duplicate: v.duplicate === true },
  };
}

// 사실 칸: {T01: 글} 또는 {T01: {text, turns}} 둘 다 받는다
function readFacts(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    const text = typeof x === 'string' ? x : isRecord(x) && typeof x.text === 'string' ? x.text : '';
    if (/^(T0[1-9]|Q(1[7-9]|2[0-4]))$/.test(k) && text.trim()) out[k] = text;
  }
  return out;
}

export function readSummary(v: unknown): Summary | null {
  if (!isRecord(v) || v.off === true) return null;
  const status = (['none', 'running', 'waiting', 'done'] as const).find((s) => s === v.status) ?? 'none';
  const sum = typeof v.summary === 'string' ? v.summary : isRecord(v.summary) && typeof v.summary.text === 'string' ? v.summary.text : null;
  const ed = isRecord(v.edited) ? v.edited : null;
  return {
    status,
    summary: sum,
    reason: typeof v.reason === 'string' ? v.reason : isRecord(v.reason) && typeof v.reason.text === 'string' ? v.reason.text : null,
    facts: readFacts(v.facts),
    edited: ed ? { ...(typeof ed.summary === 'string' ? { summary: ed.summary } : {}), ...(isRecord(ed.facts) ? { facts: readFacts(ed.facts) } : {}) } : null,
    styleChips: Array.isArray(v.style_chips) ? v.style_chips.filter((c): c is string => typeof c === 'string' && STYLE_CODES.includes(c)).slice(0, 3) : [],
    paceUsed: v.pace_used === true,
  };
}

// opts.guestUserId: 데모에서 로그인 없이 연 설문(손님)의 사용자 칸. 실서버에는 넘기지 않는다
export function createSurveyChatApi(client: SupabaseClient, appVersion = 'app', opts: { guestUserId?: string } = {}): SurveyChatApi {
  const rpc = async (name: string, args: Record<string, unknown> = {}): Promise<{ data: unknown; reason: ChatFailure | null }> => {
    try {
      const { data, error } = await client.rpc(name, args);
      if (error) {
        safeLog({ event: 'chat.rpc.fail', code: name });
        return { data: null, reason: failOf(error) };
      }
      if (isRecord(data) && data.off === true) return { data: null, reason: 'off' };
      return { data, reason: null };
    } catch {
      return { data: null, reason: 'network' };
    }
  };
  const invoke = async (name: string, body: Record<string, unknown>): Promise<{ data: unknown; reason: ChatFailure | null }> => {
    try {
      const { data, error } = await client.functions.invoke(name, { body });
      if (error) {
        safeLog({ event: 'chat.fn.fail', code: name });
        return { data: null, reason: failOf(error) };
      }
      return { data, reason: null };
    } catch {
      return { data: null, reason: 'network' };
    }
  };

  return {
    async start(device) {
      const r = await rpc(CHAT_SERVER.start, { p_device: device });
      if (r.reason) return { ok: false, reason: r.reason };
      const s = readSession(r.data);
      return s ? { ok: true, data: s } : { ok: false, reason: 'server' };
    },
    async resume(sessionId) {
      const r = await rpc(CHAT_SERVER.resume, sessionId === null ? {} : { p_session: sessionId });
      if (r.reason) return { ok: false, reason: r.reason };
      const d = isRecord(r.data) ? r.data : {};
      const turns: Turn[] = Array.isArray(d.turns)
        ? d.turns.filter(isRecord).map((t) => ({ seq: num(t.seq), role: t.role === 'user' ? 'user' : 'ai', slot: str(t.slot), text: str(t.text) }))
        : [];
      return { ok: true, data: { session: readSession(d.session), turns } };
    },
    async setState(sessionId, state) {
      const r = await rpc(CHAT_SERVER.setState, { p_session: sessionId, p_state: state });
      if (r.reason) return { ok: false, reason: r.reason };
      const s = readSession(r.data);
      return s ? { ok: true, data: s } : { ok: false, reason: 'server' };
    },
    async open(sessionId) {
      const r = await invoke(CHAT_SERVER.turn, { action: 'open', session_id: sessionId });
      return r.reason ? { ok: false, reason: r.reason } : readTurn(r.data);
    },
    async turn(sessionId, text, behavior, clientTurn) {
      // 동의가 없으면(undefined) behavior 키 자체를 보내지 않는다. turn(D-187): 몇 번째 답인지 — 서버는 같은 번호면 저장 없이 그 턴 AI 말(duplicate: true), 앞지르면 400
      const body: Record<string, unknown> = { action: 'turn', session_id: sessionId, text };
      if (clientTurn !== undefined) body.turn = clientTurn;
      if (behavior !== undefined) body.behavior = behavior;
      const r = await invoke(CHAT_SERVER.turn, body);
      return r.reason ? { ok: false, reason: r.reason } : readTurn(r.data);
    },
    async analyze(sessionId) {
      const r = await invoke(CHAT_SERVER.analyze, { session_id: sessionId });
      if (r.reason) return { ok: false, reason: r.reason };
      const d = isRecord(r.data) ? r.data : {};
      if (d.off === true) return { ok: false, reason: 'off' };
      return { ok: true, data: d.ok === true && d.status === 'done' ? 'done' : 'waiting' };
    },
    async summary() {
      const r = await rpc(CHAT_SERVER.summary);
      if (r.reason) return { ok: false, reason: r.reason };
      const s = readSummary(r.data);
      return s ? { ok: true, data: s } : { ok: false, reason: 'server' };
    },
    async edit(edit) {
      const r = await rpc(CHAT_SERVER.edit, { p_edit: edit });
      return r.reason ? { ok: false, reason: r.reason } : { ok: true, data: true };
    },
    async agreeCk16() {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id ?? opts.guestUserId;
      if (!userId) return { ok: false, reason: 'server' };
      const saved = await recordConsents(client, [
        { user_id: userId, item_code: CHAT_SERVER.consentCode as ConsentCode /* CK16 은 생성 코드 목록 밖(법무 판 생기면 합친다) */, agreed: true, text_version: CHAT_SERVER.consentVersion, app_version: appVersion },
      ]);
      safeLog({ event: 'ck16_consent', status: saved.ok ? 'ok' : saved.reason });
      return saved.ok ? { ok: true, data: true } : { ok: false, reason: saved.reason };
    },
  };
}
