// AIT-A · 서버 함수 참고 구현 — 앱(AIT-F)의 `src/app/api/ai/*+api.ts` 가 이 함수를 얇게 불러 쓰거나, 순서를 그대로 따라 쓴다.
// 순서(보안 AC-14 ~ 28 · 11장): 방법 → 출처 → 접근 코드(닫힘이 기본) → 형식 · 크기 → 키 허용 목록 → 모드 → 기능별 준비(위기 · 거절 · 가리기) → 한도 → 업체 호출 1회(재시도 0) → 출력 검사 → 응답.
// 이 파일도 환경 변수를 직접 읽지 않는다: 호출하는 쪽이 서버 변수에서 아래 이름만 골라 `deps.env`로 넘긴다.
// 업체 호출은 `deps.callModel`(공식 SDK를 감싼 것) 하나뿐이다. 도구 0 · 저장소 0 · 밖으로 나가는 주소는 업체 하나.

import type { Feature, ModelId } from './types.ts';
import { AitError } from './codes.ts';
import type { ResponseCode } from './codes.ts';
import type { HttpReply, Mode } from './reply.ts';
import { replyCard, replyError, replyOk } from './reply.ts';
import type { Counters, Guard, LogRecord } from './limits.ts';
import { checkAccessCode, consume, consumeChatCall, featureCosts, logRecord, refund, ACCESS_HEADER, GUARD } from './limits.ts';
import type { MessagesBody } from './request.ts';
import { buildChatRequest, buildOneShotRequest, pickChatModel } from './request.ts';
import type { ChatEnvelope, ChatInput } from './chat.ts';
import { finishTurn, newSession, prepareTurn } from './chat.ts';
import { finishCoach, finishCompat, finishHoroscope, prepareCoach, prepareCompat, prepareHoroscope, buildCompatSystem } from './features.ts';
import type { ApiResultLike } from './features.ts';
import { activeCards, buildChatSystem, cardIndex, parseCards } from './cards.ts';
import type { EvidenceCard } from './cards.ts';
import { CARDS_JSON, PROMPTS, SCHEMAS } from './generated.ts';
import { newNonce, nextSealCtx, openEnvelope, sealEnvelope } from './seal.ts';
import type { SealedBundle } from './seal.ts';
import { asApiResult, mockChatOutput, mockCoachOutput, mockCompatOutput, mockHoroscopeOutput } from './mock.ts';
import { classifyUpstream, shouldLockLive } from './upstream.ts';
import type { UpstreamFailure } from './upstream.ts';

export const MAX_BODY_BYTES = 32 * 1024;

/** 호출하는 쪽이 서버 변수에서 이 이름들만 골라 넘긴다(값은 어디에도 적지 않는다) */
export interface HandlerEnv { AI_ACCESS_CODE?: string; AIT_SIGN_KEY?: string; AIT_MODE?: string; AIT_CHAT_MODEL?: string }
export interface ModelResult { stop_reason: string | null; content: unknown[]; usage?: { input_tokens?: number; output_tokens?: number } }

export interface HandlerDeps {
  env: HandlerEnv;
  /** 키가 있고 작업 공간 확인(AC-08)을 통과했나. false면 AIT_MODE=live 여도 모의로 돈다 */
  liveReady: boolean;
  /** 공식 SDK 호출을 감싼 것. maxRetries 0 · AbortSignal 60초. 실패는 UpstreamFailure 모양의 값을 던진다 */
  callModel: (body: MessagesBody) => Promise<ModelResult>;
  now: () => number;
  counters: Counters;
  /** 기계 폭주 막기(연타 간격 · 분당). 없으면 기본값. 하루 횟수 한도는 없다(10-31) */
  guard?: Guard;
  log: (r: LogRecord) => void;
  /** 월 상한 도달 같은 신호를 받으면 켠다(이 격리 안에서 live를 잠금) */
  lock?: { live: boolean };
}
export interface HandlerRequest { method: string; headers: Record<string, string | undefined>; bodyText: string }

const ALLOWED_KEYS: Readonly<Record<Feature, readonly string[]>> = {
  chat: ['feature', 'asker_text', 'partner_text', 'partner_alias', 'chip', 'bundle'],
  compat: ['feature', 'shared'],
  coach: ['feature', 'field', 'text'],
  horoscope: ['feature', 'sun_sign', 'day_element', 'cusp'],
};
const FEATURES: readonly string[] = ['chat', 'compat', 'coach', 'horoscope'];
const POOL = 'pool';

let cache: { cards: EvidenceCard[]; index: Map<string, EvidenceCard>; chatSystem: string } | null = null;
function loaded() {
  if (!cache) {
    const cards = activeCards(parseCards(CARDS_JSON), { allowPending: true });   // 비공개 시험: 사람 검수 대기 카드도 씀. 공개 전에는 false
    cache = { cards, index: cardIndex(cards), chatSystem: buildChatSystem(PROMPTS.chat, cards) };
  }
  return cache;
}

function lower(h: Record<string, string | undefined>): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v;
  return o;
}
function validSignKey(k: unknown): k is string { return typeof k === 'string' && k.trim().length >= 32; }
/** 응답 코드 가운데 '오류'로 낼 수 있는 것만 남긴다(ok · 카드 코드는 bad_request로) */
function plain(code: ResponseCode): Exclude<ResponseCode, 'ok' | 'crisis' | 'refused_intent'> {
  return code === 'ok' || code === 'crisis' || code === 'refused_intent' ? 'bad_request' : code;
}
const costOf = Object.fromEntries(featureCosts().map((c) => [c.feature, c.planningWon])) as Record<Feature, number>;

export async function handleAi(req: HandlerRequest, deps: HandlerDeps): Promise<HttpReply> {
  const t0 = deps.now();
  const h = lower(req.headers);
  const mode: Mode = deps.env.AIT_MODE === 'live' && deps.liveReady && !deps.lock?.live ? 'live' : 'mock';
  const emit = (feature: Feature, extra: Record<string, unknown>) => deps.log(logRecord({ t: t0, f: feature, ms: deps.now() - t0, mode, ...extra }));

  // 1) 방법 · 출처 (AC-15 · AC-17)
  if (req.method !== 'POST') return replyError('bad_request', 'mock', { status: 405 });
  const origin = h['origin'];
  if (origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === h['host']; } catch { sameHost = false; }
    if (!sameHost) return replyError('auth', 'mock', { status: 403 });
  }
  if (h['sec-fetch-site'] === 'cross-site') return replyError('auth', 'mock', { status: 403 });

  // 2) 접근 코드 — 닫힘이 기본. 없음 / 틀림 / 서버 미설정은 같은 상태 · 같은 본문 · 같은 머리 (AC-14 · AC-15)
  const okCode = await checkAccessCode(h[ACCESS_HEADER], deps.env.AI_ACCESS_CODE);
  if (!okCode) return replyError('auth', 'mock');

  // 3) 형식 · 크기
  if (!/^application\/json(\s*;|$)/i.test(h['content-type'] ?? '')) return replyError('bad_request', 'mock', { status: 415 });
  if (new TextEncoder().encode(req.bodyText ?? '').length > MAX_BODY_BYTES) return replyError('too_long', 'mock', { status: 413 });
  if (deps.env.AIT_MODE !== undefined && deps.env.AIT_MODE !== 'mock' && deps.env.AIT_MODE !== 'live') return replyError('unavailable', 'mock');   // 알 수 없는 값은 설정 오류

  let body: Record<string, unknown>;
  try { body = JSON.parse(req.bodyText) as Record<string, unknown>; } catch { return replyError('bad_request', mode); }
  if (typeof body !== 'object' || body === null || Array.isArray(body) || typeof body.feature !== 'string' || !FEATURES.includes(body.feature)) return replyError('bad_request', mode);
  const feature = body.feature as Feature;
  if (!Object.keys(body).every((k) => ALLOWED_KEYS[feature].includes(k))) return replyError('bad_request', mode);   // 모델 · max_tokens · system … 을 앱이 정하려 하면 거절 (AC-20)

  try {
    if (feature === 'chat') return await handleChat(body, deps, mode, emit);
    return await handleOneShot(feature, body, deps, mode, emit);
  } catch (e) {
    const code: ResponseCode = e instanceof AitError ? e.code : 'upstream';
    emit(feature, { code });
    return replyError(plain(code) === 'bad_request' && code !== 'bad_request' ? 'upstream' : plain(code), mode);   // 던져진 오류 객체는 어디에도 내보내지 않는다 (AC-12)
  }
}

type Emit = (feature: Feature, extra: Record<string, unknown>) => void;

async function callLive(deps: HandlerDeps, body: MessagesBody): Promise<{ ok: true; res: ModelResult } | { ok: false; code: ReturnType<typeof classifyUpstream> }> {
  try {
    return { ok: true, res: await deps.callModel(body) };
  } catch (e) {
    const f = e as UpstreamFailure;
    const code = classifyUpstream({ status: typeof f?.status === 'number' ? f.status : undefined, errorType: typeof f?.errorType === 'string' ? f.errorType : undefined, messageHead: typeof f?.messageHead === 'string' ? f.messageHead : undefined, timeout: f?.timeout === true });
    if (shouldLockLive(code) && deps.lock) deps.lock.live = true;
    return { ok: false, code };
  }
}

// ================================================================ 챗봇
async function handleChat(body: Record<string, unknown>, deps: HandlerDeps, mode: Mode, emit: Emit): Promise<HttpReply> {
  const now = deps.now();
  if (!validSignKey(deps.env.AIT_SIGN_KEY)) return replyError('unavailable', mode);      // 서명 키가 없으면 챗봇 닫힘
  const signKey = deps.env.AIT_SIGN_KEY;
  const { index, chatSystem } = loaded();

  let env: ChatEnvelope;
  let ctx: { nonce: string; seq: number; now: number; prev: string };
  const isNew = body.bundle === undefined;
  if (isNew) { env = newSession(); ctx = { nonce: newNonce(), seq: 0, now, prev: '' }; }
  else {
    try {
      const opened = await openEnvelope(signKey, body.bundle, now);
      env = opened.env; ctx = nextSealCtx(opened, now);
    } catch (e) {
      const code = e instanceof AitError ? e.code : 'bad_request';
      emit('chat', { code });
      return replyError(plain(code), mode);
    }
  }
  const seal = (e: ChatEnvelope): Promise<SealedBundle> => sealEnvelope(signKey, e, ctx);

  const input: ChatInput = {
    askerText: body.asker_text === undefined ? '' : (body.asker_text as string),
    partnerText: body.partner_text === undefined ? '' : (body.partner_text as string),
    partnerAlias: (body.partner_alias ?? null) as string | null,
    chip: (body.chip ?? null) as ChatInput['chip'],
  };
  const prep = prepareTurn(env, input);
  if (prep.kind === 'reject') { emit('chat', { code: prep.code }); return replyError(plain(prep.code), mode); }
  if (prep.kind === 'card') {
    emit('chat', { code: prep.code });                       // 로그에는 코드만(낱말 · 판정 0)
    return replyCard(prep.code, prep.card, mode, await seal(prep.env));
  }
  if (prep.kind === 'end') { emit('chat', { code: 'ok' }); return replyOk(prep.display, mode, await seal(prep.env)); }

  // 기계 폭주 막기: 업체 호출마다 연타 간격 · 분당만 본다(횟수 한도 0)
  const est = costOf.chat / 12;
  const cc = consumeChatCall(deps.counters, POOL, now, deps.guard ?? GUARD, est);
  if (!cc.ok) {
    emit('chat', { code: cc.code });
    return replyError(cc.code, mode, { retryAfterSec: cc.code === 'rate' ? 30 : undefined });
  }

  let result: ModelResult;
  if (mode === 'live') {
    const model: ModelId = pickChatModel(deps.env.AIT_CHAT_MODEL);
    const reqBody = buildChatRequest({ model, system: chatSystem, messages: prep.call.messages, plan: prep.call.plan, schema: SCHEMAS.chat });
    const r = await callLive(deps, reqBody);
    if (!r.ok) {
      if (r.code !== 'timeout') refund(deps.counters, POOL, 'chat_call', est);   // 청구가 없었던 실패만 되돌림
      emit('chat', { code: r.code });
      return replyError(r.code, mode);
    }
    result = r.res;
  } else {
    result = asApiResult(mockChatOutput(prep.call, index)) as ModelResult;
  }
  const fin = finishTurn(prep, { stop_reason: result.stop_reason, content: result.content }, index);
  const usage = { in: result.usage?.input_tokens, out: result.usage?.output_tokens };
  if (fin.kind === 'ok') { emit('chat', { code: 'ok', ...usage }); return replyOk(fin.display, mode, await seal(fin.env)); }
  if (fin.kind === 'card') { emit('chat', { code: fin.code, ...usage }); return replyCard(fin.code, fin.card, mode, await seal(fin.env)); }
  emit('chat', { code: 'blocked_output', ...usage });          // 탈락 이유는 응답 · 로그 어디에도 내보내지 않는다
  return replyError('blocked_output', mode, { bundle: await seal(fin.env) });
}

// ================================================================ 단발 기능
async function handleOneShot(feature: Exclude<Feature, 'chat'>, body: Record<string, unknown>, deps: HandlerDeps, mode: Mode, emit: Emit): Promise<HttpReply> {
  const now = deps.now();
  const rest = Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'feature'));
  const prep = feature === 'compat' ? prepareCompat(rest) : feature === 'coach' ? prepareCoach(rest) : prepareHoroscope(rest);
  if (prep.kind === 'reject') { emit(feature, { code: prep.code }); return replyError(plain(prep.code), mode); }
  if (prep.kind === 'card') { emit(feature, { code: prep.code }); return replyCard(prep.code, prep.card, mode); }

  const c = consume(deps.counters, POOL, feature, now, deps.guard ?? GUARD, costOf[feature]);
  if (!c.ok) { emit(feature, { code: c.code }); return replyError(c.code, mode, { retryAfterSec: c.code === 'rate' ? 30 : undefined }); }

  let result: ModelResult;
  if (mode === 'live') {
    const system = feature === 'compat' ? buildCompatSystem(PROMPTS.compat) : PROMPTS[feature];
    const reqBody = buildOneShotRequest({ spec: prep.spec, system, userContent: prep.userContent, schema: SCHEMAS[feature] });
    const r = await callLive(deps, reqBody);
    if (!r.ok) {
      if (r.code !== 'timeout') refund(deps.counters, POOL, feature, costOf[feature]);
      emit(feature, { code: r.code });
      return replyError(r.code, mode);
    }
    result = r.res;
  } else {
    const inp = prep.input as never;
    const mock = feature === 'compat' ? mockCompatOutput(inp) : feature === 'coach' ? mockCoachOutput(inp) : mockHoroscopeOutput(inp);
    result = asApiResult(mock) as ModelResult;
  }
  const resp: ApiResultLike = { stop_reason: result.stop_reason, content: result.content };
  const done = feature === 'compat' ? finishCompat(resp) : feature === 'coach' ? finishCoach(resp, prep.input as { field: string; text: string }) : finishHoroscope(resp);
  const usage = { in: result.usage?.input_tokens, out: result.usage?.output_tokens };
  if (done.kind === 'ok') { emit(feature, { code: 'ok', ...usage }); return replyOk(done.display, mode); }
  emit(feature, { code: 'blocked_output', ...usage });
  return replyError('blocked_output', mode);
}

