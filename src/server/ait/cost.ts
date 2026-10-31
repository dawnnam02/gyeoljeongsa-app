// AIT-A · 단가표와 원가 계산. 호출 0 · 네트워크 0.
// 단가: 공식 가격표(platform.claude.com/docs/en/about-claude/pricing) 2026-10-30에 읽은 값. 환율 1달러 = 1,400원.
// 단가표에 없는 모델은 0원으로 셈하지 않고 던진다(보안 AC-22 · AT-22).

import type { ModelId } from './types.ts';
import { AitError } from './codes.ts';

export const FX = 1400;

export interface Price { input: number; cacheWrite5m: number; cacheRead: number; output: number } // $ / MTok
export const PRICE: Readonly<Record<ModelId, Price>> = {
  'claude-haiku-5-5': { input: 0.10, cacheWrite5m: 0.125, cacheRead: 0.01, output: 0.50 },   // 프롬프트 10만 토큰 이하
  'claude-sonnet-5-5': { input: 2, cacheWrite5m: 2.5, cacheRead: 0.10, output: 10 },
  'claude-opus-5-5': { input: 4, cacheWrite5m: 5, cacheRead: 0.20, output: 20 },
};

export interface Usage { input: number; cacheRead?: number; cacheWrite?: number; output: number }

export function priceOf(model: string): Price {
  const p = Object.prototype.hasOwnProperty.call(PRICE, model) ? (PRICE as Record<string, Price>)[model] : undefined;   // 'constructor' 같은 이름이 걸리지 않게
  if (!p) throw new AitError('unavailable');   // 단가표에 없으면 0원 셈 금지 → 호출 거부
  return p;
}

/** 토큰 사용량 → 달러. input은 캐시와 상관없는 보통 입력 토큰 */
export function usdOf(model: string, u: Usage): number {
  const p = priceOf(model);
  return (u.input * p.input + (u.cacheRead ?? 0) * p.cacheRead + (u.cacheWrite ?? 0) * p.cacheWrite5m + u.output * p.output) / 1e6;
}
export function wonOf(usd: number): number { return usd * FX; }

// ---------------------------------------------------------------- 시나리오
export interface Scenario { name: string; tokPerChar: number; outScale: number; thinkScale: number; gapSec: number }
export const SCENARIOS: Readonly<Record<'low' | 'base' | 'high', Scenario>> = {
  low: { name: '낮음', tokPerChar: 0.9, outScale: 0.85, thinkScale: 0.6, gapSec: 60 },
  base: { name: '기준', tokPerChar: 1.1, outScale: 1.0, thinkScale: 1.0, gapSec: 90 },
  high: { name: '높음', tokPerChar: 1.4, outScale: 1.25, thinkScale: 2.0, gapSec: 200 },
};
export const CACHE_TTL_SEC = 300;
/** 출력 속도(토큰/초, 생각 포함) — A7 실측 환산 */
export const OUT_RATE: Readonly<Record<ModelId, number>> = { 'claude-haiku-5-5': 150, 'claude-sonnet-5-5': 105, 'claude-opus-5-5': 72 };

export interface TurnSpec {
  stage: string;
  userChars: number;       // 이 턴에 질문자가 보낸 글(질문자 + 상대 칸 합, 가린 뒤)
  outTokens: number;       // 보이는 출력(JSON 포함)
  thinkTokens: number;     // 생각 토큰(effort에 따라)
}

export interface SimParams {
  model: ModelId;
  systemTokens: (tokPerChar: number) => number;  // 캐시되는 앞부분(지시문 + 카드 + 출력 틀)
  turns: readonly TurnSpec[];
  stateTokens: number;     // 매 턴 <상태> 줄 + 감싸는 글
  warmStart?: boolean;     // 앞부분 캐시가 이미 데워져 있나(다른 세션이 5분 안에 같은 앞부분을 씀)
}
export interface SimResult { usd: number; won: number; genSec: number; tokens: { read: number; write: number; plain: number; out: number }; perTurn: Array<{ stage: string; won: number; prompt: number; read: number; write: number; out: number }> }

/** 세션 원가. 앞 호출의 전체 프롬프트가 5분 안에 다시 오면 그 부분은 캐시 읽기, 나머지는 캐시 쓰기 */
export function simulateSession(p: SimParams, sc: Scenario): SimResult {
  const price = priceOf(p.model);
  const sys = p.systemTokens(sc.tokPerChar);
  let hist = 0;
  let t = 0;
  let lastPrompt = 0;
  let lastAt = -1e9;
  let usd = 0;
  let gen = 0;
  const tok = { read: 0, write: 0, plain: 0, out: 0 };
  const perTurn: SimResult['perTurn'] = [];
  p.turns.forEach((turn, i) => {
    const u = turn.userChars * sc.tokPerChar + p.stateTokens;
    const prompt = sys + hist + u;
    let read = 0;
    let write = prompt;
    if (t - lastAt <= CACHE_TTL_SEC && lastPrompt > 0) { read = Math.min(lastPrompt, prompt); write = prompt - read; }
    else if (i === 0 && p.warmStart) { read = sys; write = prompt - sys; }
    const out = turn.outTokens * sc.outScale + turn.thinkTokens * sc.thinkScale;
    const cost = (read * price.cacheRead + write * price.cacheWrite5m + out * price.output) / 1e6;
    usd += cost;
    gen += out / OUT_RATE[p.model];
    tok.read += read; tok.write += write; tok.out += out;
    perTurn.push({ stage: turn.stage, won: wonOf(cost), prompt, read, write, out });
    t += out / OUT_RATE[p.model];
    lastAt = t; lastPrompt = prompt;
    t += sc.gapSec;
    hist += u + turn.outTokens * sc.outScale;   // 생각 토큰은 다음 요청 입력에 다시 들어가지 않는다고 본다(보존된 생각 블록은 별도 · 미확인)
  });
  return { usd, won: wonOf(usd), genSec: gen, tokens: tok, perTurn };
}

// ---------------------------------------------------------------- 챗봇 세션 형틀(AIT 지시문 기준)
/** 보이는 출력 토큰(JSON 틀 · 근거 인용 포함) 추정 — 문장 하나 약 140토큰(본문 77 + 키 40 + 인용 22) */
const Q = { stage: 'q', outTokens: 520, thinkTokens: 250 };
const S3A = { stage: 'S3', outTokens: 980, thinkTokens: 700 };
const S3B = { stage: 'S3', outTokens: 520, thinkTokens: 300 };
const S5A = { stage: 'S5', outTokens: 1450, thinkTokens: 900 };
const S5B = { stage: 'S5', outTokens: 520, thinkTokens: 300 };
function turn(spec: { stage: string; outTokens: number; thinkTokens: number }, stage: string, userChars: number): TurnSpec {
  return { ...spec, stage, userChars };
}
/** 12턴을 다 쓰는 경로(상한). S1 3 · S2 2 · S3 2 · S4 3 · S5 2 */
export const CHAT_TURNS_MAX: readonly TurnSpec[] = [
  turn(Q, 'S1', 340), turn(Q, 'S1', 150), turn(Q, 'S1', 120),
  turn(Q, 'S2', 300), turn(Q, 'S2', 100),
  turn(S3A, 'S3', 80), turn(S3B, 'S3', 80),
  turn(Q, 'S4', 100), turn(Q, 'S4', 100), turn(Q, 'S4', 100),
  turn(S5A, 'S5', 60), turn(S5B, 'S5', 80),
];
/** 보통 경로 10턴: S1 2 · S2 2 · S3 1 · S4 2 · S5 2→ 3턴 아래 */
export const CHAT_TURNS_TYPICAL: readonly TurnSpec[] = [
  turn(Q, 'S1', 340), turn(Q, 'S1', 150),
  turn(Q, 'S2', 300), turn(Q, 'S2', 100),
  turn(S3A, 'S3', 80),
  turn(Q, 'S4', 100), turn(Q, 'S4', 100),
  turn(S5A, 'S5', 60), turn(S5B, 'S5', 80),
];

export const CHAT_STATE_TOKENS = 220; // <상태> JSON(칸 포함) + 감싸는 글

/** 하드 상한: 캐시 0 · 모든 턴이 max_tokens 전부 사용 · 질문자 글 상한까지(남용해도 이 값을 못 넘는다) */
export function chatHardCapUsd(model: ModelId, systemTokens: number, maxTokensByTurn: readonly number[], historyCharsMax: number, tokPerChar: number): number {
  const p = priceOf(model);
  let hist = 0;
  let usd = 0;
  const perTurnUser = historyCharsMax * tokPerChar / maxTokensByTurn.length;
  for (const mt of maxTokensByTurn) {
    const prompt = systemTokens + hist + perTurnUser + CHAT_STATE_TOKENS;
    usd += (prompt * p.input + mt * p.output) / 1e6;
    hist += perTurnUser + Math.min(mt, 1500);
  }
  return usd;
}

/** 단발 기능 한 번: 입력 토큰 · 출력 토큰(생각 포함) */
export function oneShotUsd(model: ModelId, inputTokens: number, outputTokens: number, cached = false): number {
  const p = priceOf(model);
  const inCost = cached ? inputTokens * p.cacheRead : inputTokens * p.input;
  return (inCost + outputTokens * p.output) / 1e6;
}
