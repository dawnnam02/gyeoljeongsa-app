// AIT-A · 서버 함수 응답 꼴(보안/AIT_위협.md 11장 #4: 응답 코드 13개 + mode).
// 앱은 code만 보고 고정 한글 문구로 바꾼다. 응답에는 이 모양의 필드만 담는다 — 입력 반사 · 검사 탈락 이유 · 스택 · 변수 이름 · 요청 머리 0.
// 접근 코드가 없음 / 틀림 / 서버 미설정은 같은 상태 · 같은 본문(AC-15)이라 replyError('auth') 하나로만 낸다.

import type { ResponseCode } from './codes.ts';
import { CODE_TEXT_KO, SUGGESTED_STATUS } from './codes.ts';
import type { FixedCard } from './fixed.ts';
import type { SealedBundle } from './seal.ts';

export type Mode = 'mock' | 'live';

export interface Reply {
  ok: boolean;                       // code === 'ok'
  code: ResponseCode;
  mode: Mode;
  text?: string;                     // 고정 문구(오류 코드)
  display?: unknown;                 // 화면용 턴 / 카드 결과(검사 통과분만)
  card?: { id: string; lines: readonly string[]; options: readonly string[] };
  bundle?: SealedBundle;             // 챗봇: 서버가 서명한 이력 묶음 — 앱은 그대로 돌려보낸다
  retryAfterSec?: number;            // rate 일 때만
}
export interface HttpReply { status: number; body: Reply; headers: Record<string, string> }

const NO_STORE: Record<string, string> = { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' };

function wrap(body: Reply, extraHeaders: Record<string, string> = {}, status?: number): HttpReply {
  return { status: status ?? SUGGESTED_STATUS[body.code], body, headers: { ...NO_STORE, ...extraHeaders } };
}

export function replyOk(display: unknown, mode: Mode, bundle?: SealedBundle): HttpReply {
  const body: Reply = { ok: true, code: 'ok', mode, display };
  if (bundle) body.bundle = bundle;
  return wrap(body);
}

export function replyCard(code: 'crisis' | 'refused_intent', card: FixedCard, mode: Mode, bundle?: SealedBundle): HttpReply {
  const body: Reply = { ok: false, code, mode, card: { id: card.id, lines: card.lines, options: card.options } };
  if (bundle) body.bundle = bundle;
  return wrap(body);
}

export function replyError(code: Exclude<ResponseCode, 'ok' | 'crisis' | 'refused_intent'>, mode: Mode, opts: { retryAfterSec?: number; bundle?: SealedBundle; status?: number } = {}): HttpReply {
  const body: Reply = { ok: false, code, mode, text: CODE_TEXT_KO[code] };
  if (code === 'rate' && typeof opts.retryAfterSec === 'number') body.retryAfterSec = Math.max(1, Math.min(3600, Math.round(opts.retryAfterSec)));
  if (opts.bundle) body.bundle = opts.bundle;       // blocked_output 에서도 새 묶음(탈락 수 갱신)을 돌려준다
  return wrap(body, code === 'rate' && body.retryAfterSec ? { 'retry-after': String(body.retryAfterSec) } : {}, opts.status);
}
