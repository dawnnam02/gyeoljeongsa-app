// IF5-A · 사주 상담(대화) 상태 · 요약(접기) · 서명 묶음. 업체를 부르지 않는다. 키를 읽지 않는다(호출하는 쪽이 문자열로 넘긴다).
//
// 무제한 원가 묶기: 서버에 대화 저장소가 없으므로 이력은 서명된 묶음으로 앱이 들고 다닌다. 묶음 안에는
//   facts(사주 계산 결과) · summary(오래된 부분의 요약, 약 900토큰 이하) · recent(요약 뒤의 원문 턴) 만 있다.
// 접기 규칙: recent 가 FOLD_AT(12)턴이 되면 이번 턴을 처리하면서 가장 오래된 FOLD_N(6)턴을 요약 호출(Haiku)로 summary 에 합친다.
//   → 요약 호출은 6턴마다 1회. 한 턴이 보는 원문은 6 ~ 12턴 + 요약 1개로 늘 같은 크기 → 턴당 원가가 길이와 무관.
// 이력에는 모델의 생각 블록을 넣지 않고 글만 넣는다 → 접기로 앞부분을 바꿔도 생각 블록 검사에 걸릴 것이 없다.

import { AitError } from '../ait/codes.ts';
import { charLen } from '../ait/text.ts';
import { screenRelationLabels } from './ai_facts5.ts';

export const WINDOW = 6;
export const FOLD_AT = 12;
export const FOLD_N = 6;
export const FORCE_FOLD_AT = 18;       // 요약 호출이 계속 실패해도 이 이상 쌓이지 않게 결정적 접기
export const SUMMARY_MAX_CHARS = 1300;  // 약 900토큰

export interface Turn5 { u: string; a: string }
export interface ChatEnv5 {
  v: 1;
  facts: unknown;
  summary: string;
  recent: Turn5[];
  turns: number;        // 지금까지 끝난 턴 수(표시 · 시험용 — 한도로 쓰지 않음)
  folded: number;       // 요약에 합쳐진 턴 수
  crisisCards: number;  // 위기 카드가 나온 횟수(통계만 — 세션을 닫지 않음)
  blocked: number;      // 검사 탈락 연속 수(재전송 폭주 막기용으로 호출하는 쪽이 본다)
  ended: boolean;       // 미성년 감지 때만 true
}

export function newChatEnv(facts: unknown): ChatEnv5 {
  return { v: 1, facts, summary: '', recent: [], turns: 0, folded: 0, crisisCards: 0, blocked: 0, ended: false };
}

export interface FoldJob { previousSummary: string; turns: Turn5[] }
export function needsFold(env: ChatEnv5): boolean { return env.recent.length >= FOLD_AT; }
export function foldJobOf(env: ChatEnv5): FoldJob { return { previousSummary: env.summary, turns: env.recent.slice(0, FOLD_N) }; }

// ---------------------------------------------------------------- 메시지 만들기 (요청 앞부분이 턴마다 같게 — 캐시)
export interface Msg5 { role: 'user' | 'assistant'; content: string }

export function preface(env: ChatEnv5): string {
  return '<사실>' + JSON.stringify(screenRelationLabels(env.facts)) + '</사실>\n<앞이야기>' + (env.summary || '없음') + '</앞이야기>\n';
}
const wrapUser = (text: string): string => '<내말>' + JSON.stringify({ text }) + '</내말>';

/** 과거 recent 전부 + 새 말. 첫 user 메시지에 사실 · 앞이야기를 붙인다(접힌 턴에만 바뀜). */
export function buildMessages(env: ChatEnv5, newText: string): Msg5[] {
  const out: Msg5[] = [];
  const all: Array<{ u: string; a?: string }> = [...env.recent, { u: newText }];
  all.forEach((t, i) => {
    out.push({ role: 'user', content: (i === 0 ? preface(env) : '') + wrapUser(t.u) });
    if (t.a !== undefined) out.push({ role: 'assistant', content: t.a });
  });
  return out;
}

/** 요약 호출용 사용자 메시지 */
export function buildSummaryInput(job: FoldJob): string {
  const conv = job.turns.map((t, i) => `[${i + 1}] 사용자: ${t.u}\n답: ${t.a}`).join('\n');
  return '<이전요약>' + (job.previousSummary || '없음') + '</이전요약>\n<대화>' + conv + '</대화>';
}

// ---------------------------------------------------------------- 턴 끝내기 / 접기
/** 모델이 낸 답에서 이력에 넣을 글(답 + 되물음). 생각 블록은 넣지 않는다 */
export function assistantText(reply: string, ask: string): string { return ask ? `${reply} ${ask}` : reply; }

/** 결정적 접기(요약 호출 실패 때): 오래된 턴을 한 줄씩 줄여 summary 끝에 붙이고 뒤에서부터 SUMMARY_MAX_CHARS 만큼만 남긴다 */
export function foldDeterministic(previousSummary: string, turns: Turn5[]): string {
  const lines = turns.map((t) => '사용자가 "' + Array.from(t.u).slice(0, 50).join('') + '" 라고 물었고 답했어요.');
  const joined = [previousSummary, ...lines].filter(Boolean).join(' ');
  const chars = Array.from(joined);
  return chars.length <= SUMMARY_MAX_CHARS ? joined : chars.slice(chars.length - SUMMARY_MAX_CHARS).join('');
}

export interface FinishTurnArgs { env: ChatEnv5; userText: string; reply: string; ask: string; newSummary?: string | null }
/** 한 턴이 검사를 통과한 뒤 새 봉투를 만든다. newSummary 가 있으면 가장 오래된 FOLD_N 턴을 그 요약으로 바꾼다. */
export function finishTurn5(a: FinishTurnArgs): ChatEnv5 {
  const env: ChatEnv5 = { ...a.env, recent: [...a.env.recent], blocked: 0 };
  let recent = [...env.recent, { u: a.userText, a: assistantText(a.reply, a.ask) }];
  if (needsFold(a.env)) {
    const job = foldJobOf(a.env);
    const summary = a.newSummary && charLen(a.newSummary) <= SUMMARY_MAX_CHARS ? a.newSummary : null;
    if (summary !== null) { env.summary = summary; recent = recent.slice(FOLD_N); env.folded += FOLD_N; }
    else if (recent.length > FORCE_FOLD_AT) { env.summary = foldDeterministic(job.previousSummary, job.turns); recent = recent.slice(FOLD_N); env.folded += FOLD_N; }
  }
  env.recent = recent;
  env.turns += 1;
  return env;
}

// ---------------------------------------------------------------- 서명 묶음 (HMAC-SHA256 · Web Crypto) — AIT seal.ts 와 같은 방식, 기능 이름만 다르다
export interface Sealed5 { payload: string; mac: string }
export const SEAL5_MAX_AGE_MS = 7 * 24 * 3600_000;   // 대화 이어가기 유효 기간(쉼 시간). 길게 쉬어도 이어 가려면 앱이 묶음을 보관 — 기간은 법무 결정 대기(처방: 7일)
export const SEAL5_MAX_PAYLOAD = 96 * 1024;           // 접기로 크기가 늘지 않으므로(수 KB) 넘으면 이상 신호
const enc = new TextEncoder();
const b64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0)); } catch { return null; }
}
async function key(secret: unknown): Promise<CryptoKey> {
  if (typeof secret !== 'string' || secret.trim().length < 32) throw new AitError('unavailable');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const input = (payload: string): Uint8Array<ArrayBuffer> => enc.encode('if5|saju_chat|' + payload);

export async function seal5(secret: string, env: ChatEnv5, ctx: { nonce: string; seq: number; now: number; prev: string }): Promise<Sealed5> {
  const k = await key(secret);
  const payload = JSON.stringify({ v: 1, nonce: ctx.nonce, seq: ctx.seq, iat: ctx.now, prev: ctx.prev, env });
  if (payload.length > SEAL5_MAX_PAYLOAD) throw new AitError('limit');
  const sig = await crypto.subtle.sign('HMAC', k, input(payload));
  return { payload, mac: b64url(new Uint8Array(sig)) };
}

export interface Opened5 { env: ChatEnv5; nonce: string; seq: number; mac: string }
export async function open5(secret: string, bundle: unknown, now: number, maxAgeMs = SEAL5_MAX_AGE_MS): Promise<Opened5> {
  const k = await key(secret);
  if (typeof bundle !== 'object' || bundle === null) throw new AitError('bad_request');
  const b = bundle as Record<string, unknown>;
  if (typeof b.payload !== 'string' || typeof b.mac !== 'string' || b.payload.length > SEAL5_MAX_PAYLOAD) throw new AitError('bad_request');
  const sig = fromB64url(b.mac);
  if (!sig || !(await crypto.subtle.verify('HMAC', k, sig, input(b.payload)))) throw new AitError('bad_request');
  let p: Record<string, unknown>;
  try { p = JSON.parse(b.payload) as Record<string, unknown>; } catch { throw new AitError('bad_request'); }
  if (p.v !== 1 || typeof p.nonce !== 'string' || typeof p.seq !== 'number' || typeof p.iat !== 'number' || typeof p.env !== 'object' || p.env === null) throw new AitError('bad_request');
  if (now - p.iat > maxAgeMs || p.iat - now > 60_000) throw new AitError('limit');
  const env = p.env as ChatEnv5;
  if (env.v !== 1 || !Array.isArray(env.recent) || typeof env.summary !== 'string' || env.recent.length > FORCE_FOLD_AT + 1) throw new AitError('bad_request');
  return { env, nonce: p.nonce, seq: p.seq, mac: b.mac };
}
