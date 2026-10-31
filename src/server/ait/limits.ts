// AIT-A · 접근 코드 비교 · 기계 폭주 막기(연타 간격 · 분당) · 어림 카운터 · 로그 한 줄.
// 10-31 본인 결정(D-236): 하루 횟수 · 턴 상한은 뗐다. 남은 것은 (1) 콘솔 작업 공간 월 지출 상한(≈ 1만 원, 최종 안전망) (2) 기계 폭주 막기(초 단위 연타 · 분당) (3) 요청당 max_tokens.
// 서버 함수는 상태가 없다(격리 사이 메모리 공유 미확인). 그래서 아래 카운터는 '이 격리 안에서만 아는 최선 노력'이고, 돈의 최종 상한은 콘솔 월 상한이다.
// 이 파일은 키 · 접근 코드를 읽지 않는다. 비교 대상은 호출하는 쪽이 문자열로 넘긴다.

import type { Feature, ModelId } from './types.ts';
import { FEATURE_MODEL } from './types.ts';
import type { ResponseCode } from './codes.ts';
import {
  CHAT_STATE_TOKENS, CHAT_TURNS_MAX, FX, SCENARIOS, chatHardCapUsd, oneShotUsd, simulateSession,
} from './cost.ts';
import { STAGE_MAX_TOKENS } from './chat.ts';
import { ONE_SHOT } from './features.ts';

// ---------------------------------------------------------------- 접근 코드 (AC-13 · AC-14)
export const ACCESS_HEADER = 'x-ait-code';
/** ait- + 4글자 묶음 4개(헷갈리는 i l o 0 1 뺀 31글자) */
export const ACCESS_CODE_RE = /^ait-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/;

const enc = new TextEncoder();
async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

/** 두 값을 SHA-256으로 같은 길이로 만든 뒤 바이트마다 XOR을 누적한다(조기 반환 0 · 길이와 무관).
 *  기대값이 없음 · 빈 값 · 공백뿐 · 너무 짧음이면 항상 false(닫힘이 기본). 머리가 없어도 같은 비교를 한 번 한다. */
export async function checkAccessCode(provided: unknown, expected: unknown): Promise<boolean> {
  const p = typeof provided === 'string' ? provided : '';
  const e = typeof expected === 'string' ? expected : '';
  const [hp, he] = await Promise.all([sha256(p), sha256(e)]);
  let diff = 0;
  for (let i = 0; i < hp.length; i++) diff |= hp[i] ^ he[i];
  const configured = e.trim().length >= 8 && e === e.trim();
  return configured && diff === 0;
}

// ---------------------------------------------------------------- 예산 (정보용 — 하루 상한은 없다)
/** 최종 안전망은 콘솔 작업 공간 월 지출 상한(약 $7 ≈ 1만 원). 서버 카운터는 이 값을 강제하지 않는다. */
export const BUDGET = { monthlyWon: 10000 } as const;
/** 원가 계산이 전제하는 챗봇 시스템 지시문 글자 수(카드 포함, 실제 지시문이 이보다 길어지면 시험이 깨진다) */
export const ASSUMED_CHAT_SYSTEM_CHARS = 9500;
const CHAT_SYSTEM_TOKENS = (k: number) => ASSUMED_CHAT_SYSTEM_CHARS * k + 500;   // + 출력 틀(grammar) 약 500토큰

function chatSessionWon(model: ModelId, scenario: 'base' | 'high', warm = false): number {
  return simulateSession({ model, systemTokens: CHAT_SYSTEM_TOKENS, turns: CHAT_TURNS_MAX, stateTokens: CHAT_STATE_TOKENS, warmStart: warm }, SCENARIOS[scenario]).won;
}
/** 하드 상한: 캐시 0 · 모든 턴이 max_tokens를 전부 쓰고 질문자 글 상한까지 쓴 최악(12턴 기준 — 한 요청의 상한은 턴 수와 무관하게 이 값에서 접기로 묶인다) */
export function chatHardWon(model: ModelId): number {
  const stages = ['S1', 'S1', 'S1', 'S2', 'S2', 'S3', 'S3', 'S4', 'S4', 'S4', 'S5', 'S5'] as const;
  return chatHardCapUsd(model, CHAT_SYSTEM_TOKENS(1.4), stages.map((s) => STAGE_MAX_TOKENS[s]), 12000, 1.4) * FX;
}

export interface FeatureCost { feature: Feature; model: ModelId; typicalWon: number; planningWon: number; hardWon: number; maxTokens: number }

/** 기능별 1회 원가(원): 보통(기준 시나리오) · 계획용(높음 시나리오) · 하드 상한(max_tokens 전부). 챗봇은 12턴 세션 기준 */
export function featureCosts(chatModel: ModelId = FEATURE_MODEL.chat): FeatureCost[] {
  const one = (f: 'compat' | 'coach' | 'horoscope', inBase: number, outBase: number, inHigh: number, outHigh: number, outHard: number): FeatureCost => {
    const m = ONE_SHOT[f].model;
    return {
      feature: f, model: m, maxTokens: ONE_SHOT[f].maxTokens,
      typicalWon: oneShotUsd(m, inBase, outBase) * FX,
      planningWon: oneShotUsd(m, inHigh, outHigh) * FX,
      hardWon: oneShotUsd(m, inHigh, outHard) * FX,
    };
  };
  return [
    {
      feature: 'chat', model: chatModel, maxTokens: STAGE_MAX_TOKENS.S5,
      typicalWon: chatSessionWon(chatModel, 'base'), planningWon: chatSessionWon(chatModel, 'high'), hardWon: chatHardWon(chatModel),
    },
    one('compat', 2450, 300, 3100, 600, ONE_SHOT.compat.maxTokens),
    one('coach', 2800, 1200, 3560, 2200, ONE_SHOT.coach.maxTokens),
    one('horoscope', 1550, 840, 1950, 1300, ONE_SHOT.horoscope.maxTokens),
  ];
}

/** 월 1만 원으로 가능한 양(계획용 원가 기준) — 한 기능만 썼을 때. 정보용이며 강제하지 않는다 */
export function monthlyCapacity(chatModel: ModelId = FEATURE_MODEL.chat): Array<{ feature: Feature; typical: number; planning: number }> {
  return featureCosts(chatModel).map((x) => ({
    feature: x.feature,
    typical: Math.floor(BUDGET.monthlyWon / x.typicalWon),
    planning: Math.floor(BUDGET.monthlyWon / x.planningWon),
  }));
}

// ---------------------------------------------------------------- 기계 폭주 막기 (연타 간격 + 분당) — 사람이 치는 속도는 걸리지 않는다
/** minGapMs: 같은 기능의 연속 호출 사이 최소 간격(초 단위 연타 차단). perMinute: 60초 안 최대 호출 수. 넘으면 'rate' + retry-after */
export interface Guard { minGapMs: number; perMinute: Readonly<Record<Feature, number>> }
export const GUARD: Guard = { minGapMs: 1200, perMinute: { chat: 12, coach: 10, compat: 12, horoscope: 12 } };
/** 이전 이름 호환 */
export const PER_MINUTE: Readonly<Record<Feature, number>> = GUARD.perMinute;

// ---------------------------------------------------------------- 어림 카운터 (격리 메모리 — 격리마다 따로 셈, 최선 노력). 횟수 한도 0 — 통계만
export interface Counters { day: string; used: Record<string, number>; minute: Record<string, number[]>; spentWon: number }
export function createCounters(): Counters { return { day: '', used: {}, minute: {}, spentWon: 0 }; }

/** 한국 시각 날짜 문자열 */
export function kstDay(nowMs: number): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10);
}

export type ConsumeResult = { ok: true } | { ok: false; code: Extract<ResponseCode, 'rate'> };

function roll(counters: Counters, nowMs: number): void {
  const day = kstDay(nowMs);
  if (counters.day !== day) { counters.day = day; counters.used = {}; counters.spentWon = 0; }   // 통계만 날마다 비운다. 분 창은 시각으로 스스로 지난다
}
function take(counters: Counters, bucket: string, perMinute: number, guard: Guard, nowMs: number, estWon: number): ConsumeResult {
  roll(counters, nowMs);
  const win = (counters.minute[bucket] ?? []).filter((t) => nowMs - t < 60_000);
  const last = win.length ? win[win.length - 1] : undefined;
  if ((last !== undefined && nowMs - last < guard.minGapMs) || win.length >= perMinute) { counters.minute[bucket] = win; return { ok: false, code: 'rate' }; }
  win.push(nowMs);
  counters.minute[bucket] = win;
  counters.used[bucket] = (counters.used[bucket] ?? 0) + 1;
  counters.spentWon += estWon;
  return { ok: true };
}

/** 기능 한 번을 시작하기 전에 부른다. 통과하면 분 창에 기록한다. 위기 카드 · 거절 카드 · 틀린 코드는 부르지 않는다(무과금). */
export function consume(counters: Counters, key: string, feature: Feature, nowMs: number, guard: Guard = GUARD, estWon = 0): ConsumeResult {
  return take(counters, key + '|' + feature, guard.perMinute[feature], guard, nowMs, estWon);
}
/** 챗봇의 업체 호출 하나마다 부른다(턴 · 검사 탈락 · 사용자 재전송 포함). 횟수 한도는 없고 연타 · 분당만 본다. */
export function consumeChatCall(counters: Counters, key: string, nowMs: number, guard: Guard = GUARD, estWon = 0): ConsumeResult {
  return take(counters, key + '|chat_call', guard.perMinute.chat, guard, nowMs, estWon);
}

/** 업체가 토큰을 청구하지 않은 실패(요청 전 거절 · 5xx 등)만 되돌린다(분 창의 마지막 기록을 뺀다). blocked_output · timeout 은 돈이 이미 들었을 수 있어 되돌리지 않는다. */
export function refund(counters: Counters, key: string, bucket: Feature | 'chat_call', estWon = 0): void {
  const k = key + '|' + bucket;
  if ((counters.used[k] ?? 0) > 0) counters.used[k] -= 1;
  const win = counters.minute[k];
  if (win && win.length) win.pop();
  counters.spentWon = Math.max(0, counters.spentWon - estWon);
}

// ---------------------------------------------------------------- 로그 한 줄 (AC-11: 허용 키만 · 값 0)
export interface LogRecord { t: number; f: Feature; in?: number; out?: number; ms?: number; code?: ResponseCode; mode?: 'mock' | 'live'; rid?: string }
const LOG_FEATURES: readonly string[] = ['chat', 'compat', 'coach', 'horoscope'];

/** 입력 글 · 출력 글 · 코드 · IP · 요청 머리는 이 함수로 들어올 수 없다. 숫자와 열거형만 남기고 문자열은 40자로 자른다. */
export function logRecord(raw: Record<string, unknown>): LogRecord {
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);
  const out: LogRecord = { t: num(raw.t) ?? 0, f: (LOG_FEATURES.includes(String(raw.f)) ? raw.f : 'chat') as Feature };
  const i = num(raw.in); if (i !== undefined) out.in = i;
  const o = num(raw.out); if (o !== undefined) out.out = o;
  const ms = num(raw.ms); if (ms !== undefined) out.ms = ms;
  if (typeof raw.code === 'string') out.code = String(raw.code).slice(0, 40) as ResponseCode;
  if (raw.mode === 'mock' || raw.mode === 'live') out.mode = raw.mode;
  if (typeof raw.rid === 'string') out.rid = raw.rid.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return out;
}
