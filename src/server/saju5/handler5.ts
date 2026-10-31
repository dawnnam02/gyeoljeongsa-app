// IF5-F2 ⑩ · 사주 AI 맞춤 서버 함수 — AIT 서버 경로(/api/ai/*) 위에 얹은 사주 기능 여섯(앱이 따로 쓰는 파일 — scripts/sync-if5.mjs 가 건드리지 않는다).
//  기능: s5_reading 풀이 · s5_daewoon 대운 · s5_sinyeon 올해 · s5_compat 둘이 맞춰 보기 · s5_taekil 날짜 고르기 설명 · s5_chat 사주 이야기. (종합 풀이는 앱이 풀이 · 대운 · 올해 세 번 부른다)
//  AIT 핸들러(server/ait/handler.ts)와 같은 순서: 방법 → 출처 → 접근 코드(닫힘이 기본) → 형식 · 크기 → 키 허용 목록 → 모드 → 기능별 준비(위기 · 거절 · 가리기) → 속도 → 업체 호출 1회(재시도 0) → 출력 검사 → 응답.
//  · 업체 호출은 deps.callModel 하나. 접근 코드가 있으면 실제(AIT_MODE=live + 키 + 작업 공간 확인이 갖춰졌을 때) · 아니면 모의 글(mock5) — 시험은 모의 응답만 쓴다(실호출 0)
//  · 앱이 보내는 사실은 이 문에서 다시 걸러진다: 대운 날짜(start_date · end_date 와 날짜 꼴) 0 · 생일 원값 · 입력 꼴 0 · 한자 0 · 상대 쪽은 간지 없는 2단계 사실만(partner5 guardCompatFacts)
//  · 끝줄(FOOTER5)은 응답에 붙이지 않는다 — 앱이 SAJU.card.footer 한 곳에서 보인다(팀장 10-31). 서버 저장 0 · 이력은 서명 묶음으로 앱이 들고 다닌다
//  · 마일리지 예치 · 확정은 이 함수의 일이 아니다(진짜 서버에서는 Edge 가 한다 — P0 는 기기 안 가상 잔액이 앱 쪽에서 한다). 위기 · 거절 카드는 업체 호출 0
import { AitError } from '../ait/codes.ts';
import type { ResponseCode } from '../ait/codes.ts';
import { classifyUpstream, shouldLockLive } from '../ait/upstream.ts';
import type { UpstreamFailure } from '../ait/upstream.ts';
import { checkAccessCode, consume, consumeChatCall, ACCESS_HEADER, GUARD } from '../ait/limits.ts';
import type { HandlerDeps, HandlerRequest, ModelResult } from '../ait/handler.ts';
import { MAX_BODY_BYTES } from '../ait/handler.ts';
import { replyCard, replyError, replyOk } from '../ait/reply.ts';
import type { HttpReply, Mode } from '../ait/reply.ts';
import { newNonce } from '../ait/seal.ts';
import type { MessagesBody } from '../ait/request.ts';
import type { Feature5 } from '../../saju5/spec5.ts';
import { buildMessages, buildSummaryInput, finishTurn5, foldJobOf, needsFold, newChatEnv, open5, seal5 } from './chat5.ts';
import type { ChatEnv5, Sealed5 } from './chat5.ts';
import { prepareChatText } from './input5.ts';
import { asResult, mockOutput5 } from '../../saju5/mock5.ts';
import { guardCompatFacts, compatMessages } from './partner5.ts';
import { buildRequest5, oneShotMessages } from './request5.ts';
import { finish5, finishSummary } from './validate5.ts';

export const S5_FEATURES = ['s5_reading', 's5_daewoon', 's5_sinyeon', 's5_compat', 's5_taekil', 's5_chat'] as const;
export type S5Feature = (typeof S5_FEATURES)[number];
export const isS5Feature = (v: unknown): v is S5Feature => typeof v === 'string' && (S5_FEATURES as readonly string[]).includes(v);

/** 본문 키 허용 목록 — 모델 · max_tokens · system · 가격 · 금액을 앱이 정하려 하면 거절한다 */
export const S5_ALLOWED_KEYS: Readonly<Record<S5Feature, readonly string[]>> = {
  s5_reading: ['feature', 'facts'],
  s5_daewoon: ['feature', 'facts'],
  s5_sinyeon: ['feature', 'facts'],
  s5_compat: ['feature', 'facts'],
  s5_taekil: ['feature', 'facts'],
  s5_chat: ['feature', 'text', 'facts', 'bundle', 'precheck'],
};
const KIND_OF: Readonly<Record<Exclude<S5Feature, 's5_chat'>, Feature5>> = { s5_reading: 'reading', s5_daewoon: 'daewoon', s5_sinyeon: 'sinyeon', s5_compat: 'compat', s5_taekil: 'taekil' };
const MAX_FACTS_CHARS = 12000;
const POOL = 'pool5';
// 앱이 보내면 안 되는 칸 이름(어느 깊이에서든): 대운 날짜 · 생일 원값 · 입력 · 내부 번호/코드
const BAD_KEYS = new Set(['start_date', 'end_date', 'date_exact', 'birth', 'birth_date', 'birthday', 'input', 'idx', 'name', 'nickname', 'phone', 'email']);
const ISO_DAY = /\b\d{4}-\d{2}-\d{2}\b/;
const HANJA = /[㐀-鿿]/;

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function lower(h: Record<string, string | undefined>): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v;
  return o;
}
function validSignKey(k: unknown): k is string {
  return typeof k === 'string' && k.trim().length >= 32;
}
function plain(code: ResponseCode): Exclude<ResponseCode, 'ok' | 'crisis' | 'refused_intent'> {
  return code === 'ok' || code === 'crisis' || code === 'refused_intent' ? 'bad_request' : code;
}

/** 사실 묶음의 겉모양 검사 — 통과해야 업체 요청 글이 만들어진다. 이유 코드를 돌려준다(응답 · 로그에는 내보내지 않는다) */
export function guardFacts(feature: S5Feature, facts: unknown): { ok: true } | { ok: false; why: string } {
  const no = (why: string): { ok: false; why: string } => ({ ok: false, why });
  if (!isRec(facts)) return no('not_object');
  if (feature === 's5_chat') {
    if (facts.kind !== 'chat') return no('kind');
  } else if (facts.kind !== KIND_OF[feature]) return no('kind');
  const text = JSON.stringify(facts);
  if (text.length > MAX_FACTS_CHARS) return no('too_long');
  if (HANJA.test(text)) return no('hanja');
  let badKey = false;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isRec(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (BAD_KEYS.has(k) || (k === 'code' && feature !== 's5_compat')) badKey = true;
        walk(x);
      }
    }
  };
  walk(facts);
  if (badKey) return no('forbidden_key');
  // 대운 날짜 0: 택일 사실 말고는 연-월-일 꼴 날짜가 어디에도 없어야 한다(택일 날짜는 공개 달력 날이라 예외, 절기 시각은 'starts' 칸 하나만 — 공개 절기표 값)
  if (feature !== 's5_taekil') {
    const rest = JSON.stringify(facts, (k, v) => (k === 'starts' ? undefined : v));
    if (ISO_DAY.test(rest)) return no('date_in_facts');
  }
  if (feature === 's5_compat') {
    const g = guardCompatFacts(facts);
    if (!g.ok) return no('partner_' + g.why);
  }
  return { ok: true };
}

type Emit = (extra: Record<string, unknown>) => void;

export async function handleSaju5(req: HandlerRequest, deps: HandlerDeps): Promise<HttpReply> {
  const t0 = deps.now();
  const h = lower(req.headers);
  const mode: Mode = deps.env.AIT_MODE === 'live' && deps.liveReady && !deps.lock?.live ? 'live' : 'mock';
  let feature: S5Feature | 's5_unknown' = 's5_unknown';
  // 로그: 허용 키(t f ms code mode in out)뿐 — 입력 · 사실 · 코드 값 0
  const emit: Emit = (extra) => deps.log({ t: t0, f: feature, ms: deps.now() - t0, mode, ...extra } as never);

  // 1) 방법 · 출처
  if (req.method !== 'POST') return replyError('bad_request', 'mock', { status: 405 });
  const origin = h['origin'];
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === h['host'];
    } catch {
      sameHost = false;
    }
    if (!sameHost) return replyError('auth', 'mock', { status: 403 });
  }
  if (h['sec-fetch-site'] === 'cross-site') return replyError('auth', 'mock', { status: 403 });

  // 2) 접근 코드 — 닫힘이 기본. 없음 / 틀림 / 서버 미설정은 같은 상태 · 같은 본문
  if (!(await checkAccessCode(h[ACCESS_HEADER], deps.env.AI_ACCESS_CODE))) return replyError('auth', 'mock');

  // 3) 형식 · 크기
  if (!/^application\/json(\s*;|$)/i.test(h['content-type'] ?? '')) return replyError('bad_request', 'mock', { status: 415 });
  if (new TextEncoder().encode(req.bodyText ?? '').length > MAX_BODY_BYTES) return replyError('too_long', 'mock', { status: 413 });
  if (deps.env.AIT_MODE !== undefined && deps.env.AIT_MODE !== 'mock' && deps.env.AIT_MODE !== 'live') return replyError('unavailable', 'mock');
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(req.bodyText) as Record<string, unknown>;
  } catch {
    return replyError('bad_request', mode);
  }
  if (!isRec(body) || !isS5Feature(body.feature)) return replyError('bad_request', mode);
  feature = body.feature;
  if (!Object.keys(body).every((k) => S5_ALLOWED_KEYS[feature as S5Feature].includes(k))) return replyError('bad_request', mode);

  try {
    return feature === 's5_chat' ? await handleChat(body, deps, mode, emit) : await handleOneShot(feature, body, deps, mode, emit);
  } catch (e) {
    const code: ResponseCode = e instanceof AitError ? e.code : 'upstream';
    emit({ code });
    return replyError(plain(code) === 'bad_request' && code !== 'bad_request' ? 'upstream' : plain(code), mode); // 던져진 오류 객체는 어디에도 내보내지 않는다
  }
}

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

// ================================================================ 단발 기능
async function handleOneShot(feature: Exclude<S5Feature, 's5_chat'>, body: Record<string, unknown>, deps: HandlerDeps, mode: Mode, emit: Emit): Promise<HttpReply> {
  const now = deps.now();
  const g = guardFacts(feature, body.facts);
  if (!g.ok) {
    emit({ code: 'bad_request' });
    return replyError('bad_request', mode);
  }
  const facts = body.facts as Record<string, unknown>;
  const kind = KIND_OF[feature];
  const c = consume(deps.counters, POOL, 'horoscope', now, deps.guard ?? GUARD, 0);
  if (!c.ok) {
    emit({ code: c.code });
    return replyError(c.code, mode, { retryAfterSec: 30 });
  }
  let result: ModelResult;
  if (mode === 'live') {
    const messages = kind === 'compat' ? compatMessages(facts) : oneShotMessages(facts);
    const r = await callLive(deps, buildRequest5(kind, messages) as unknown as MessagesBody);
    if (!r.ok) {
      emit({ code: r.code });
      return replyError(r.code, mode);
    }
    result = r.res;
  } else {
    result = asResult(mockOutput5(kind, facts)) as ModelResult;
  }
  const done = finish5(kind, { stop_reason: result.stop_reason, content: result.content }, { facts });
  const usage = { in: result.usage?.input_tokens, out: result.usage?.output_tokens };
  if (done.kind === 'ok') {
    emit({ code: 'ok', ...usage });
    return replyOk(done.display, mode);
  }
  emit({ code: 'blocked_output', ...usage }); // 탈락 이유는 응답 · 로그 어디에도 내보내지 않는다
  return replyError('blocked_output', mode);
}

// ================================================================ 사주 이야기(대화)
async function handleChat(body: Record<string, unknown>, deps: HandlerDeps, mode: Mode, emit: Emit): Promise<HttpReply> {
  const now = deps.now();
  if (!validSignKey(deps.env.AIT_SIGN_KEY)) return replyError('unavailable', mode); // 서명 키가 없으면 닫힘
  const signKey = deps.env.AIT_SIGN_KEY;

  // 위기 앞거름(precheck): 업체 호출 0 · 묶음 0 — 앱이 마일리지 예치 전에 위기 카드를 먼저 보이려고 부른다(위기 턴은 잔액이 0이어도 막지 않는다)
  if (body.precheck === true) {
    const p = prepareChatText(body.text);
    if (p.kind === 'card') {
      emit({ code: p.code });
      return replyCard(p.code, p.card, mode);
    }
    if (p.kind === 'reject') {
      emit({ code: p.code });
      return replyError(p.code === 'too_long' ? 'too_long' : 'bad_request', mode);
    }
    emit({ code: 'ok' });
    return replyOk({ pass: true }, mode);
  }

  let env: ChatEnv5;
  let ctx: { nonce: string; seq: number; now: number; prev: string };
  if (body.bundle === undefined) {
    const g = guardFacts('s5_chat', body.facts);
    if (!g.ok) {
      emit({ code: 'bad_request' });
      return replyError('bad_request', mode);
    }
    env = newChatEnv(body.facts);
    ctx = { nonce: newNonce(), seq: 0, now, prev: '' };
  } else {
    if (body.facts !== undefined) return replyError('bad_request', mode); // 이어 갈 때 사실을 다시 보내지 않는다(서명 묶음 안 사실만)
    try {
      const o = await open5(signKey, body.bundle, now);
      env = o.env;
      ctx = { nonce: o.nonce, seq: o.seq + 1, now, prev: o.mac };
    } catch (e) {
      const code = e instanceof AitError ? e.code : 'bad_request';
      emit({ code });
      return replyError(plain(code), mode);
    }
  }
  const seal = (e: ChatEnv5): Promise<Sealed5> => seal5(signKey, e, ctx);

  const prep = prepareChatText(body.text);
  if (prep.kind === 'reject') {
    emit({ code: prep.code });
    return replyError(prep.code === 'too_long' ? 'too_long' : 'bad_request', mode);
  }
  if (prep.kind === 'card') {
    emit({ code: prep.code }); // 로그에는 코드만(낱말 · 판정 0)
    const next: ChatEnv5 = { ...env, crisisCards: env.crisisCards + (prep.code === 'crisis' ? 1 : 0), ended: env.ended || prep.endSession };
    return replyCard(prep.code, prep.card, mode, await seal(next));
  }
  if (env.ended) {
    emit({ code: 'limit' });
    return replyError('limit', mode);
  }

  const cc = consumeChatCall(deps.counters, POOL, now, deps.guard ?? GUARD, 0);
  if (!cc.ok) {
    emit({ code: cc.code });
    return replyError(cc.code, mode, { retryAfterSec: 30 });
  }

  let result: ModelResult;
  if (mode === 'live') {
    const r = await callLive(deps, buildRequest5('chat', buildMessages(env, prep.text) as never) as unknown as MessagesBody);
    if (!r.ok) {
      emit({ code: r.code });
      return replyError(r.code, mode);
    }
    result = r.res;
  } else {
    result = asResult(mockOutput5('chat', env.facts as Record<string, unknown>)) as ModelResult;
  }
  const done = finish5('chat', { stop_reason: result.stop_reason, content: result.content }, { facts: env.facts, extraSource: env.summary, userText: prep.text });
  const usage = { in: result.usage?.input_tokens, out: result.usage?.output_tokens };
  if (done.kind === 'card') {
    emit({ code: done.code, ...usage });
    return replyCard(done.code, done.card, mode, await seal({ ...env, crisisCards: env.crisisCards + (done.code === 'crisis' ? 1 : 0), ended: env.ended || done.code === 'refused_intent' }));
  }
  if (done.kind === 'blocked') {
    emit({ code: 'blocked_output', ...usage });
    return replyError('blocked_output', mode, { bundle: await seal({ ...env, blocked: env.blocked + 1 }) as never });
  }
  const display = done.kind === 'ok' ? done.display : { reply: done.line, ask: '', flags: [done.flag] };
  // 접기: 12턴이 되면 오래된 6턴을 요약(live 는 요약 호출 · mock 은 결정적 접기)
  let newSummary: string | null = null;
  if (needsFold(env) && mode === 'live') {
    const job = foldJobOf(env);
    const sr = await callLive(deps, buildRequest5('summary', [{ role: 'user', content: buildSummaryInput(job) }]) as unknown as MessagesBody);
    if (sr.ok) {
      const f = finishSummary({ stop_reason: sr.res.stop_reason, content: sr.res.content }, JSON.stringify(job));
      newSummary = f.ok ? f.summary : null;
    }
  }
  const next = finishTurn5({ env, userText: prep.text, reply: String(display.reply ?? ''), ask: String(display.ask ?? ''), newSummary });
  emit({ code: 'ok', ...usage });
  return replyOk({ reply: display.reply, ask: display.ask, flags: display.flags, turns: next.turns, summarized: next.folded > 0 }, mode, await seal(next) as never);
}
