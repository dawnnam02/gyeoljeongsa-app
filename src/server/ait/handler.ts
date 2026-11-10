// AIT-A · 서버 함수 참고 구현 — 앱(AIT-F)의 `src/app/api/ai/*+api.ts` 가 이 함수를 얇게 불러 쓰거나, 순서를 그대로 따라 쓴다.
// 순서(보안 AC-14 ~ 28 · 11장): 방법 → 출처 → 접근 코드(닫힘이 기본) → 형식 · 크기 → 키 허용 목록 → 모드 → 기능별 준비(위기 · 거절 · 가리기) → 한도 → 업체 호출 1회(재시도 0) → 출력 검사 → 응답.
// RS2-01(Edge): 같은 핸들러를 Edge 함수 ai-run 이 문 뒤 진입(handleAiBody)으로 부른다 — 로그인(JWT)이 문이고, 마일리지 예치 · 확정 · 해제는 EDGE/ts/run.ts 가 이 핸들러 바깥에서 한다(핸들러는 마일리지를 모른다).
// 이 파일도 환경 변수를 직접 읽지 않는다: 호출하는 쪽이 서버 변수에서 아래 이름만 골라 `deps.env`로 넘긴다.
// 업체 호출은 `deps.callModel`(공식 SDK를 감싼 것) 하나뿐이다. 도구 0 · 저장소 0 · 밖으로 나가는 주소는 업체 하나.

import type { Feature, ModelId } from './types.ts';
import { AitError } from './codes.ts';
import type { ResponseCode } from './codes.ts';
import type { HttpReply, Mode } from './reply.ts';
import { replyCard, replyError, replyOk } from './reply.ts';
import type { Counters, Guard, LogRecord, VendorKind } from './limits.ts';
import { authLocked, checkAccessCode, consume, consumeChatCall, featureCosts, logRecord, noteAuthFail, refund, refundCount, takeVendorCall, ACCESS_HEADER, GUARD } from './limits.ts';
import type { MessagesBody } from './request.ts';
import { buildChatRequest, buildOneShotRequest, pickChatModel } from './request.ts';
import type { ChatEnvelope, ChatInput } from './chat.ts';
import { CHAT_LIMITS, applyCrisisCard, applyMisuseCard, finishTurn, newSession, prepareTurn } from './chat.ts';
import { finishCoach, finishCompat, finishHoroscope, prepareCoach, prepareCompat, prepareHoroscope, buildCompatSystem } from './features.ts';
import type { ApiResultLike } from './features.ts';
import { activeCards, buildChatSystem, cardIndex, parseCards } from './cards.ts';
import type { EvidenceCard } from './cards.ts';
import { CARDS_JSON, PROMPTS, SCHEMAS } from './generated.ts';
import { newNonce, nextSealCtx, openEnvelope, sealEnvelope } from './seal.ts';
import type { SealedBundle } from './seal.ts';
import { asApiResult, mockChatOutput, mockCoachOutput, mockCompatOutput, mockHoroscopeOutput } from './mock.ts';
import { classifyUpstream, shouldLockLive } from './upstream.ts';
import { JUDGE_TIMEOUT_MS, buildInputJudgeRequest, buildOutputJudgeRequest, parseInputJudge, parseOutputJudge } from './judge.ts';
import { ALWAYS_LINE, CRISIS_CARD, JUDGE_RETRY_LINE, MISUSE_CARD, VIOLENCE_CARD } from './fixed.ts';
import { COACH_REFUSED_CARD, applyOneShotJudge, buildCoachInputJudgeRequest, buildOneShotOutputJudgeRequest, parseCoachInputJudge, parseOneShotOutputJudge, planOneShotJudge } from './judge_oneshot.ts';
import type { UpstreamFailure } from './upstream.ts';

/** 요청 본문 상한. AI-FIX1: 32KB → 96KB. 서명 묶음(seal.ts SEAL_MAX_BYTES 80KB)이 본문에 실려 돌아오므로 그보다 커야 한다 — 32KB 일 때 9턴째에 413 이 났다 */
export const MAX_BODY_BYTES = 96 * 1024;

/** 호출하는 쪽이 서버 변수에서 이 이름들만 골라 넘긴다(값은 어디에도 적지 않는다) */
export interface HandlerEnv { AI_ACCESS_CODE?: string; AIT_SIGN_KEY?: string; AIT_MODE?: string; AIT_CHAT_MODEL?: string }
export interface ModelResult { stop_reason: string | null; content: unknown[]; usage?: { input_tokens?: number; output_tokens?: number } }

/** 계정 단위 바닥값(RS2-01 · RS2-02 · AI-FIX8 항목 5). 서버(Edge)가 계정별로 저장한 값으로, 봉투 안 값과 **더 엄한 쪽(max)**을 쓴다 — 올리기만 하고 내리지 않는다(옛 봉투 다시 보내기 · 새 세션으로 내려가지 않는다).
 *  misuse = 가해 의도로 닫은 글 수(입력 판정의 closed_before) · blocked = 검사 탈락 연속 수. 차단 · 자동 정지 · 제재는 하지 않는다 — 입력 판정을 더 엄하게 읽거나 탈락 한도에 더 빨리 닿을 뿐이다.
 *  바닥값은 한도 아래로 자른다: misuse 는 FLOOR_MISUSE_MAX(3) · blocked 는 maxBlocked − 1(바닥값만으로 세션이 닫히는 일은 없다). */
export interface AccountFloor { misuse?: number; blocked?: number }
export const FLOOR_MISUSE_MAX = 3;
const clampInt = (v: unknown, lo: number, hi: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo);
/** 챗봇 봉투에 바닥값을 적용한다(올리기만). 바뀐 것이 없으면 같은 객체를 돌려준다 */
export function floorChatEnv(env: ChatEnvelope, f: AccountFloor | undefined): ChatEnvelope {
  if (!f) return env;
  const misuse = Math.max(env.state.misuse ?? 0, clampInt(f.misuse, 0, FLOOR_MISUSE_MAX));
  const blocked = Math.max(env.state.blocked, clampInt(f.blocked, 0, CHAT_LIMITS.maxBlocked - 1));
  if (misuse === (env.state.misuse ?? 0) && blocked === env.state.blocked) return env;
  return { ...env, state: { ...env.state, misuse, blocked } };
}

export interface HandlerDeps {
  env: HandlerEnv;
  /** 키가 있고 작업 공간 확인(AC-08)을 통과했나. false면 AIT_MODE=live 여도 모의로 돈다 */
  liveReady: boolean;
  /** 공식 SDK 호출을 감싼 것. maxRetries 0 · AbortSignal 60초. 실패는 UpstreamFailure 모양의 값을 던진다 */
  callModel: (body: MessagesBody, kind?: VendorKind) => Promise<ModelResult>;      // kind(RS2-01): main = 본 호출 · 칸 고쳐 쓰기 · 접기 요약(비싼 쪽) / judge = 입력 · 출력 판정(값싼 쪽). EAS 경로는 무시한다. Edge 는 main 앞에서만 예치를 잡는다(EDGE/ts/run.ts)
  now: () => number;
  counters: Counters;
  /** 기계 폭주 막기(연타 간격 · 분당). 없으면 기본값. 하루 횟수 한도는 없다(10-31) */
  guard?: Guard;
  log: (r: LogRecord) => void;
  /** 월 상한 도달 같은 신호를 받으면 켠다(이 격리 안에서 live를 잠금) */
  lock?: { live: boolean };
  /** AI 심사층(judge.ts) 한 번의 시간 상한(밀리초). 없으면 JUDGE_TIMEOUT_MS. 시험에서 짧게 줄일 때만 쓴다 */
  judgeTimeoutMs?: number;
  /** 계정 단위 바닥값(Edge 만 넣는다). 없으면 지금 동작 그대로(봉투 값만) */
  floor?: AccountFloor;
  /** 요청 단위 분당 한도 칸의 열쇠. 없으면 'pool'(EAS 경로 — 격리 하나에 한 칸). Edge 는 사람별 열쇠를 넣는다(한 격리를 여러 사람이 나눠 써도 서로의 한도를 먹지 않게) */
  poolKey?: string;
  /** 업체 호출 수 한도 칸의 열쇠. 없으면 VENDOR_KEY. Edge 는 사람별 열쇠를 넣는다(RS2-08 · RS2-01) */
  vendorKey?: string;
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
const poolOf = (deps: HandlerDeps): string => deps.poolKey ?? POOL;
/** 업체 호출 수 세는 칸의 열쇠(AI-FIX11 RS2-08). EAS 경로는 호출한 사람을 몰라서 AIT 와 사주 경로가 한 칸을 같이 쓴다. Edge(RS2-01)는 JWT 로 사람을 알아 `deps.vendorKey` 로 사람별 열쇠를 넣는다 */
export const VENDOR_KEY = 'vendor';

let cache: { cards: EvidenceCard[]; index: Map<string, EvidenceCard>; chatSystem: string } | null = null;
function loaded() {
  if (!cache) {
    const cards = activeCards(parseCards(CARDS_JSON));   // AI 검증을 마친 카드만(D-242: 사람 확인은 없다)
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

/** 본문을 읽기 **전에** 끝나는 문(AI-FIX11 RS2-04): 방법 → 출처 → 틀린 코드 연타 잠금 → 접근 코드. 걸리면 그 응답을, 통과하면 null.
 *  호출하는 쪽(앱 route.ts)이 본문을 읽기 전에 이 함수를 먼저 불러, 접근 코드 없는 요청이 본문을 끝까지 읽게 만들지 못하게 한다. handleAi · handleSaju5 도 같은 함수를 첫 문으로 쓴다(응답이 한 곳에서만 정해진다).
 *  접근 코드 — 닫힘이 기본. 없음 / 틀림 / 서버 미설정은 같은 상태 · 같은 본문 · 같은 머리 (AC-14 · AC-15). 틀린 코드는 격리 안 최선 노력으로 연타를 막는다(limits.ts authLocked · RS2-06). */
export async function gateRequest(req: { method: string; headers: Record<string, string | undefined> }, ctx: { accessCode: string | undefined; counters: Counters; now: number }): Promise<HttpReply | null> {
  const h = lower(req.headers);
  // 1) 방법 · 출처 (AC-15 · AC-17)
  if (req.method !== 'POST') return replyError('bad_request', 'mock', { status: 405 });
  const origin = h['origin'];
  if (origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === h['host']; } catch { sameHost = false; }
    if (!sameHost) return replyError('auth', 'mock', { status: 403 });
  }
  if (h['sec-fetch-site'] === 'cross-site') return replyError('auth', 'mock', { status: 403 });
  // 2) 접근 코드
  if (authLocked(ctx.counters, ctx.now)) return replyError('rate', 'mock', { retryAfterSec: 60 });
  if (!(await checkAccessCode(h[ACCESS_HEADER], ctx.accessCode))) {
    noteAuthFail(ctx.counters, ctx.now);
    return replyError('auth', 'mock');
  }
  return null;
}

export async function handleAi(req: HandlerRequest, deps: HandlerDeps): Promise<HttpReply> {
  const t0 = deps.now();
  // 1) 방법 · 출처 → 2) 접근 코드(gateRequest)
  const gate = await gateRequest(req, { accessCode: deps.env.AI_ACCESS_CODE, counters: deps.counters, now: t0 });
  if (gate) return gate;
  return handleAiBody(req, deps, t0);
}

/** 문(방법 · 출처 · 접근 코드) **뒤**의 처리 전부 — 형식 · 크기 → 키 허용 목록 → 모드 → 기능별 준비 → 한도 → 업체 호출 → 출력 검사 → 응답.
 *  EAS 경로는 handleAi 가 문을 지난 뒤 이 함수를 부른다. Edge(ai-run, RS2-01)는 접근 코드 대신 로그인(JWT)이 문이라 문을 지난 요청으로 이 함수를 바로 부른다(EDGE/ts/run.ts). t0 는 문과 같은 시각을 쓰려고 넘기는 값이다. */
export async function handleAiBody(req: HandlerRequest, deps: HandlerDeps, t0: number = deps.now()): Promise<HttpReply> {
  const h = lower(req.headers);
  const mode: Mode = deps.env.AIT_MODE === 'live' && deps.liveReady && !deps.lock?.live ? 'live' : 'mock';
  const emit = (feature: Feature, extra: Record<string, unknown>) => deps.log(logRecord({ t: t0, f: feature, ms: deps.now() - t0, mode, ...extra }));

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

/** 업체 호출 한 번. AI-FIX11 RS2-08: 보내기 **직전**에 업체 호출 수 한도(limits.ts takeVendorCall)를 본다 — 넘으면 호출은 나가지 않고 rate.
 *  kind: main = 본 호출 · 칸 고쳐 쓰기 · 접기 요약 / judge = 입력 · 출력 판정(judgeCall 이 부른다). 요청 단위 한도(consume)와 별개로 실제 호출 수를 센다 */
export async function callLive(deps: HandlerDeps, body: MessagesBody, kind: VendorKind = 'main'): Promise<{ ok: true; res: ModelResult } | { ok: false; code: ReturnType<typeof classifyUpstream> }> {
  const v = takeVendorCall(deps.counters, deps.vendorKey ?? VENDOR_KEY, kind, deps.now(), deps.guard ?? GUARD);
  if (!v.ok) return { ok: false, code: v.code };
  try {
    return { ok: true, res: await deps.callModel(body, kind) };
  } catch (e) {
    const f = e as UpstreamFailure;
    const code = classifyUpstream({ status: typeof f?.status === 'number' ? f.status : undefined, errorType: typeof f?.errorType === 'string' ? f.errorType : undefined, messageHead: typeof f?.messageHead === 'string' ? f.messageHead : undefined, timeout: f?.timeout === true });
    if (shouldLockLive(code) && deps.lock) deps.lock.live = true;
    return { ok: false, code };
  }
}

type JudgeFail = { ok: false; code: ReturnType<typeof classifyUpstream> };
/** AI 심사층 호출 한 번: 시간 상한 안에 업체가 답하고 틀에 맞아야 ok. 아니면 안전한 쪽으로 가라는 신호(ok:false)다. 청구서가 생겼을 수 있으므로 호출 횟수 되돌림은 없다 */
export async function judgeCall<T>(deps: HandlerDeps, body: MessagesBody, parse: (r: { stop_reason: string | null; content: unknown[] }) => T | null): Promise<{ ok: true; value: T } | JudgeFail> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), deps.judgeTimeoutMs ?? JUDGE_TIMEOUT_MS); });
  try {
    const r = await Promise.race([callLive(deps, body, 'judge'), timeout]);
    if (r === 'timeout') return { ok: false, code: 'timeout' };
    if (!r.ok) return { ok: false, code: r.code };
    const v = parse({ stop_reason: r.res.stop_reason, content: r.res.content });
    return v === null ? { ok: false, code: 'upstream' } : { ok: true, value: v };
  } finally {
    if (timer) clearTimeout(timer);
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
  // AI-FIX11 RS2-02 · 사실대로: 서버에는 대화 저장소가 없어 세션 상태(가해 표지 misuse · 연속 탈락 blocked · 위기 카드 수 · 턴 수)를 서명 봉투에 실어 앱이 들고 다닌다.
  //  서명은 **위변조**를 막을 뿐이다. 앱(또는 앱을 고친 사람)이 옛 봉투를 다시 보내거나 봉투 없이 새 세션을 열면 이 상태는 그 값으로 되돌아가고, 서버는 알 길이 없다.
  //  그래서 이 상태로 만든 한도(가해 표지 누적 · 연속 탈락 6번 닫힘)는 **'최선 노력'**이다 — 정직한 앱의 안전 장치이지 막아 내는 보증이 아니다. 실제 돈 상한은 격리별 분당 한도(RS2-08의 업체 호출 수 한도 포함)와 콘솔 월 상한이다.
  //  계정 단위로 서버가 저장하는 길은 RS2-01 설계(backend/RS2-01_AI차감_서버결합_설계.md)에 합친다. 읽기 자리: 아래 isNew 분기(newSession)와 openEnvelope 결과 사이 — ai/평가결과_EV1/고칠것.md 'RS2-02 연결 지점'.
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
  env = floorChatEnv(env, deps.floor);                       // RS2-01 · RS2-02: 계정 단위 바닥값(Edge 만) — 봉투 값과 더 엄한 쪽. 없으면 그대로
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
    // AI-FIX6 ④: 폭력 낱말이 걸린 글은 입력 판정을 함께 불러, 글쓴이가 하는 쪽(가해, harm)이면 피해자용 폭력 카드 대신 오용 카드로 보낸다.
    //  판정이 실패하거나 harm 이 아니거나 연타 한도에 걸리면 폭력 안전 카드를 **그대로** 낸다(안전한 쪽). 위기 · 가해 의도 카드는 prepareTurn 에서 이 앞에 이미 돌았다.
    const cardJudge = prep.violenceJudge ?? prep.crisisJudge;      // 폭력 낱말 글 · 오용 사전 글 둘 다 위기가 끼었는지 본다(위기가 언제나 먼저)
    if (cardJudge && mode === 'live' && consumeChatCall(deps.counters, poolOf(deps), deps.now(), deps.guard ?? GUARD, 0).ok) {
      const vReq = buildInputJudgeRequest(cardJudge.texts);
      let vj = await judgeCall(deps, vReq, parseInputJudge);
      if (!vj.ok && (vj.code === 'upstream' || vj.code === 'timeout' || vj.code === 'rate')) vj = await judgeCall(deps, vReq, parseInputJudge);
      if (vj.ok && vj.value === 'crisis') {                      // AI-FIX7 ①: 위기가 언제나 먼저다 — 폭력 낱말 옆에 "그냥 빨리 가고 싶어요"가 있으면 폭력 카드가 아니라 위기 카드(번호 줄 109 포함)
        emit('chat', { code: 'crisis' });
        return replyCard('crisis', CRISIS_CARD, mode, await seal(applyCrisisCard(cardJudge.plainEnv)));
      }
      if (prep.violenceJudge && vj.ok && vj.value === 'harm') {
        emit('chat', { code: 'refused_intent' });
        return replyCard('refused_intent', MISUSE_CARD, mode, await seal(applyMisuseCard(prep.violenceJudge.plainEnv)));
      }
    }
    emit('chat', { code: prep.code });                       // 로그에는 코드만(낱말 · 판정 0)
    return replyCard(prep.code, prep.card, mode, await seal(prep.env));
  }
  if (prep.kind === 'end') { emit('chat', { code: 'ok' }); return replyOk(prep.display, mode, await seal(prep.env)); }

  // 기계 폭주 막기: 업체 호출마다 연타 간격 · 분당만 본다(횟수 한도 0)
  const est = costOf.chat / 12;
  const cc = consumeChatCall(deps.counters, poolOf(deps), now, deps.guard ?? GUARD, est);
  if (!cc.ok) {
    emit('chat', { code: cc.code });
    return replyError(cc.code, mode, { retryAfterSec: cc.code === 'rate' ? 30 : undefined });
  }

  if (prep.call.softMisuse && mode !== 'live') {          // 판정 없이는 사전 결과(카드)로 닫는다
    refundCount(deps.counters, poolOf(deps), 'chat_call', est);
    emit('chat', { code: 'refused_intent' });
    return replyCard('refused_intent', MISUSE_CARD, mode, await seal(prep.env));
  }
  // AI 입력 판정(AI-FIX4): 사전을 지난 글을 값싼 모델이 한 번 더 본다. 위기 · 폭력 · 미성년 카드는 위(prepareTurn)에서 이미 먼저 돌았다.
  //  가해 의도(harm)면 오용 카드(챗봇 본 호출 0). 판정이 실패하면 **한 번 다시** 부르고(AI-FIX5 D1), 그래도 실패하면 챗봇으로 보내지 않고 고정 한 줄로 닫는다(턴 차감 0).
  //  앞서 한 말 최대 두 개를 맥락으로 함께 넣는다(AI-FIX5 D2 — 본 호출 이력에 이미 있는 글이라 새로 보내는 범위가 아니다).
  if (mode === 'live' && (prep.call.newTexts.asker.trim() || prep.call.newTexts.partner.trim())) {
    const prevTexts = prep.env.userTexts.map((u) => u.asker).filter((x) => x.trim()).slice(-2);
    const inReq = buildInputJudgeRequest({ ...prep.call.newTexts, prev: prevTexts, closed: prep.env.state.misuse ?? 0 });
    let j = await judgeCall(deps, inReq, parseInputJudge);
    if (!j.ok && (j.code === 'upstream' || j.code === 'timeout' || j.code === 'rate')) j = await judgeCall(deps, inReq, parseInputJudge);   // 일시 연결 오류 한 번 더
    if (j.ok && j.value === 'harm') {
      refundCount(deps.counters, poolOf(deps), 'chat_call', est);
      emit('chat', { code: 'refused_intent' });
      return replyCard('refused_intent', MISUSE_CARD, mode, await seal(applyMisuseCard(prep.env)));
    }
    if (j.ok && j.value === 'crisis') {                        // AI-FIX6 ⑤: 사전이 못 잡은 간접 위기 표현 — 위기 카드를 올리는 방향으로만 쓴다(내리는 일 없음)
      refundCount(deps.counters, poolOf(deps), 'chat_call', est);
      emit('chat', { code: 'crisis' });
      return replyCard('crisis', CRISIS_CARD, mode, await seal(applyCrisisCard(prep.env)));
    }
    if (!j.ok) {
      if (j.code === 'spend_limit') { emit('chat', { code: 'spend_limit' }); return replyError('spend_limit', mode); }
      refundCount(deps.counters, poolOf(deps), 'chat_call', est);       // 챗봇을 부르지 않았으니 이 턴은 차감 0 · 봉투는 그대로(새 서명 묶음 없음)
      if (prep.call.softMisuse) {                          // 사전이 걸렸는데 판정도 못 했다 → 안전한 쪽(사전 결과: 오용 카드)
        emit('chat', { code: 'refused_intent' });
        return replyCard('refused_intent', MISUSE_CARD, mode, await seal(applyMisuseCard(prep.env)));
      }
      emit('chat', { code: 'timeout' });
      // AI-FIX7 ③: 위기 · 폭력 카드를 이미 낸 세션에서 판정이 두 번 실패해도 번호 줄(112 · 119 · 109 · 1366)은 빠지지 않는다
      const sess = prep.call.stateAfterResolve;
      return replyError('timeout', mode, { text: sess.crisisCards > 0 || sess.safety ? `${JUDGE_RETRY_LINE} ${ALWAYS_LINE}` : JUDGE_RETRY_LINE });
    }
  }

  let result: ModelResult;
  if (mode === 'live') {
    const model: ModelId = pickChatModel(deps.env.AIT_CHAT_MODEL);
    const reqBody = buildChatRequest({ model, system: chatSystem, messages: prep.call.messages, plan: prep.call.plan, schema: SCHEMAS.chat });
    const r = await callLive(deps, reqBody);
    if (!r.ok) {
      if (r.code !== 'timeout') refund(deps.counters, poolOf(deps), 'chat_call', est);   // 청구가 없었던 실패만 되돌림
      emit('chat', { code: r.code });
      return replyError(r.code, mode);
    }
    result = r.res;
  } else {
    result = asApiResult(mockChatOutput(prep.call, index)) as ModelResult;
  }
  let fin = finishTurn(prep, { stop_reason: result.stop_reason, content: result.content }, index);
  const usage = { in: result.usage?.input_tokens, out: result.usage?.output_tokens };
  // AI 출력 판정(AI-FIX4): 화면에 나갈 문장을 값싼 모델이 한 번 더 본다. 닿은 문장은 화면에서 빼고 구성을 다시 확인한다(남은 문장으로 답이 안 되면 blocked_output).
  //  판정이 실패하면 답을 내보내지 않는다. 다만 위기 카드 · 폭력 트랙이 켜진 세션에서는 판정 실패가 안내를 막지 않게 고정 카드로 대신한다.
  if (mode === 'live' && fin.kind === 'ok') {
    const shown = fin.display.sentences;
    const j = await judgeCall(deps, buildOutputJudgeRequest(prep.call.newTexts, shown), (r) => parseOutputJudge(r, shown.length));
    if (!j.ok) {
      if (j.code === 'spend_limit') { emit('chat', { code: 'spend_limit', ...usage }); return replyError('spend_limit', mode); }
      const st = prep.call.stateAfterResolve;
      if (st.crisisCards > 0 || st.safety) {
        emit('chat', { code: 'crisis', ...usage });
        return replyCard('crisis', st.crisisCards > 0 ? CRISIS_CARD : VIOLENCE_CARD, mode, await seal(prep.env));
      }
      emit('chat', { code: j.code, ...usage });
      return replyError(j.code, mode);
    }
    if (j.value.length > 0) {
      const drop = new Set(j.value.map((x) => shown[x.i].text));
      fin = finishTurn(prep, { stop_reason: result.stop_reason, content: result.content }, index, { dropTexts: drop });
    }
  }
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

  const c = consume(deps.counters, poolOf(deps), feature, now, deps.guard ?? GUARD, costOf[feature]);
  if (!c.ok) { emit(feature, { code: c.code }); return replyError(c.code, mode, { retryAfterSec: c.code === 'rate' ? 30 : undefined }); }

  // AI 입력 판정(Q2-30): 자유 글을 받는 기능은 코치뿐(내 공개 문구). 궁합 · 별자리는 코드 목록이라 입력 판정이 없다.
  //  scam(사기 · 광고) · instruction(AI 에게 시키는 글)이면 고정 카드(호출 0). 판정 실패는 한 번 다시 부르고, 그래도 실패하면 보내지 않고 고정 한 줄(차감 0)
  if (mode === 'live' && feature === 'coach') {
    const inReq = buildCoachInputJudgeRequest(String((prep.input as { text?: unknown }).text ?? ''));
    let j = await judgeCall(deps, inReq, parseCoachInputJudge);
    if (!j.ok && (j.code === 'upstream' || j.code === 'timeout' || j.code === 'rate')) j = await judgeCall(deps, inReq, parseCoachInputJudge);
    if (j.ok && j.value !== 'normal') {
      refundCount(deps.counters, poolOf(deps), feature, costOf[feature]);
      emit(feature, { code: 'refused_intent' });
      return replyCard('refused_intent', COACH_REFUSED_CARD, mode);
    }
    if (!j.ok) {
      refundCount(deps.counters, poolOf(deps), feature, costOf[feature]);
      emit(feature, { code: j.code === 'spend_limit' ? 'spend_limit' : 'timeout' });
      return j.code === 'spend_limit' ? replyError('spend_limit', mode) : replyError('timeout', mode, { text: JUDGE_RETRY_LINE });
    }
  }

  let result: ModelResult;
  if (mode === 'live') {
    const system = feature === 'compat' ? buildCompatSystem(PROMPTS.compat) : PROMPTS[feature];
    const reqBody = buildOneShotRequest({ spec: prep.spec, system, userContent: prep.userContent, schema: SCHEMAS[feature] });
    const r = await callLive(deps, reqBody);
    if (!r.ok) {
      if (r.code !== 'timeout') refund(deps.counters, poolOf(deps), feature, costOf[feature]);
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
  if (done.kind === 'ok') {
    // AI 출력 판정(Q2-30): 화면에 나갈 글을 값싼 모델이 한 번 더 본다. 걸린 글은 빼고(코치) 쓸 수 없으면 내보내지 않는다. 판정이 실패하면 내보내지 않는다. 모두 차감 0
    let shown = done.display;
    if (mode === 'live') {
      const plan = planOneShotJudge(feature, shown as never, prep.input);
      if (plan.items.length > 0) {
        const j = await judgeCall(deps, buildOneShotOutputJudgeRequest(feature, plan), (r) => parseOneShotOutputJudge(feature, r, plan.items.length));
        if (!j.ok) {
          refundCount(deps.counters, poolOf(deps), feature, costOf[feature]);
          emit(feature, { code: j.code, ...usage });
          return replyError(j.code, mode);
        }
        const applied = applyOneShotJudge(feature, shown as never, plan, j.value);
        if (applied === null) {
          refundCount(deps.counters, poolOf(deps), feature, costOf[feature]);
          emit(feature, { code: 'blocked_output', ...usage });
          return replyError('blocked_output', mode);
        }
        shown = applied as typeof shown;
      }
    }
    emit(feature, { code: 'ok', ...usage });
    return replyOk(shown, mode);
  }
  emit(feature, { code: 'blocked_output', ...usage });
  return replyError('blocked_output', mode);
}

