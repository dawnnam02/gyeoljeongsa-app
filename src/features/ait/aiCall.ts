// RS2-01 순 3 · AI 호출 길을 한 곳에서 고르고, 실서버 길(Supabase 함수 ai-run)로 보내는 얇은 층.
//  고민 정리 · 코치 · 궁합 · 별자리(features/ait) 와 사주 AI(features/saju/ai)가 모두 여기서 길을 받는다.
//  · 길은 셋: 'mock' = 데모 판의 모의(서버 요청 0 · 지금 그대로) / 'eas' = AI 서버 판 빌드(export-ait)의 /api/ai/* (예비 — 지우지 않는다) / 'ai-run' = 실서버 판의 Edge 함수
//  · 길을 고르는 값은 지금 있는 설정뿐이다: 데모 표시(EXPO_PUBLIC_DEMO_MODE — aitEnabled.ts 와 같은 식) + 시험용 접근 코드. 새 EXPO_PUBLIC_ 이름 0.
//    실서버 판은 코드가 있어도 ai-run 이다(EAS 는 꺼짐). 예비 EAS 를 실서버 판에서 켜는 값은 아래 AI_REAL_VIA_EAS 하나(앱을 다시 내야 바뀐다)
//  · 서버 스위치 ai_run 은 서버 전용이다 — 앱은 읽지 않는다. 닫히면 서버가 403 unavailable 로 답하고 앱은 '지금은 쓸 수 없어요' 상태가 된다
//  · 요청 머리는 넷뿐: authorization(로그인 토큰) · apikey(공개 키) · content-type · idempotency-key. 사용자 번호 · 차감 키 · 금액 · 예치 번호는 본문에도 머리에도 싣지 않는다(서버가 400)
//  · 한 번의 누름 = Idempotency-Key 하나(메모리에만). 서버는 같은 키를 어떤 상태로든(진행 중 · 확정 · 해제) 이미 알면 already_done 으로 답하므로
//    같은 키는 '닿았는지 모르는' 시도(끊김 · 시간 초과)를 같은 요청으로 다시 보낼 때만 쓰고, 서버가 답한 뒤의 새 시도는 새 키를 쓴다(createKeyKeeper)
//  · 서버가 준 오류 문장은 쓰지 않는다 — code 만 읽는다. 로그 · 저장 0(토큰 · 키 · 글을 어디에도 남기지 않는다)
import { newRequestId } from '@/lib/requestId';

import { AIT_REQUEST_TIMEOUT_MS } from './aitConfig';
import { isDemoBuild } from './aitEnabled';
import { parseReply, type AitResult } from './aitTypes';

export type AiRoute = 'mock' | 'eas' | 'ai-run';

/** 실서버 판에서 예비 EAS 길을 켜는 값(기본 꺼짐). 환경 변수가 아니라 코드 상수라 앱을 다시 내야 바뀐다 */
export const AI_REAL_VIA_EAS = false;

/** 길 고르기. 데모 판: 코드 없음 → 모의 · 코드 있음 → AI 서버 판(EAS). 실서버 판: ai-run (EAS 를 켠 빌드에서만 코드가 있으면 EAS) */
export function aiRouteOf(a: { code: string | null; demoMode?: boolean; realViaEas?: boolean }): AiRoute {
  const demo = a.demoMode ?? isDemoBuild();
  if (demo) return a.code ? 'eas' : 'mock';
  return (a.realViaEas ?? AI_REAL_VIA_EAS) && a.code ? 'eas' : 'ai-run';
}

// ── 실서버 길: 보내기 ─────────────────────────────────────────────────────────
export const AI_RUN_PATH = '/functions/v1/ai-run';
export const IDEMPOTENCY_HEADER = 'idempotency-key';
/** Idempotency-Key 모양(서버 IDEM_RE 와 같다) */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
/** 앱이 본문에 실으면 안 되는 이름들 — 서버가 정하는 값이다(사용자 번호 · 차감 키 · 금액 · 예치 번호 · 업체 설정). 허용 목록 밖 키는 이미 버려지지만 한 번 더 걸러 낸다 */
export const FORBIDDEN_BODY_KEYS: readonly string[] = [
  'user_id', 'userId', 'uid', 'account_id', 'accountId',
  'cost_key', 'costKey', 'feature_key', 'featureKey', 'cost', 'amount', 'price', 'mileage', 'balance',
  'hold', 'hold_id', 'holdId', 'request_id', 'requestId', 'idempotency_key', 'idempotencyKey',
  'model', 'max_tokens', 'maxTokens', 'system',
];

export function stripForbidden(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (!FORBIDDEN_BODY_KEYS.includes(k)) out[k] = v;
  return out;
}

export type AiRunFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string; credentials: 'omit'; cache: 'no-store'; signal: AbortSignal },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** 실서버 길이 쓰는 연결. 기본은 처음 쓸 때 만든다(시험이 서버 설정 없이 이 파일을 읽을 수 있게). 토큰은 부를 때마다 로그인 상태에서 읽고 어디에도 두지 않는다 */
export type AiRunEnv = {
  url: string;
  apikey: string;
  token: () => Promise<string | null>;
  fetch?: AiRunFetch;
  /** 401 — 로그인이 끝났다. 기본은 이 기기의 로그인을 끝내 화면 가드가 로그인으로 보낸다(세션 만료와 같은 길) */
  onAuthLost?: () => void;
};

let injected: AiRunEnv | null = null;
export function setAiRunEnvForTest(e: AiRunEnv | null): void {
  injected = e;
}

function aiRunEnv(): AiRunEnv {
  if (injected) return injected;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { defaultAiRunEnv } = require('@/lib/aiRunEnv') as typeof import('@/lib/aiRunEnv'); // 처음 쓸 때 가져온다 — 이 파일은 로그인 클라이언트를 직접 모른다
  return defaultAiRunEnv();
}

const authReply = (): AitResult => ({
  kind: 'reply',
  status: 401,
  reply: { ok: false, code: 'auth', mode: null, display: null, card: null, bundle: null, retryAfterSec: null, charge: { state: 'none', need: null, have: null } },
});

/** ai-run 에 요청 하나를 보낸다. body 는 기능 이름(feature)과 허용 목록 글칸만 든 것(pickBody · pickS5Body 결과). 닿지 못하면(끊김 · 시간 초과 · 모양이 다른 답) offline */
export async function postAiRun(body: Record<string, unknown>, key: string, envOverride?: AiRunEnv): Promise<AitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIT_REQUEST_TIMEOUT_MS);
  try {
    const env = envOverride ?? aiRunEnv();
    const token = await env.token();
    if (!token) {
      env.onAuthLost?.();
      return authReply(); // 로그인이 없다 — 요청 0
    }
    const res = await (env.fetch ?? (fetch as unknown as AiRunFetch))(`${env.url}${AI_RUN_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: env.apikey, [IDEMPOTENCY_HEADER]: key },
      body: JSON.stringify(stripForbidden(body)),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    let raw: unknown = null;
    try {
      raw = await res.json();
    } catch {
      raw = null;
    }
    const reply = parseReply(raw);
    if (res.status === 401) {
      env.onAuthLost?.();
      return reply ? { kind: 'reply', status: 401, reply } : authReply(); // 플랫폼이 먼저 막은 401(우리 모양이 아닌 본문)도 같은 길
    }
    return reply ? { kind: 'reply', status: res.status, reply } : { kind: 'offline' };
  } catch {
    return { kind: 'offline' }; // 오류 객체 · 본문은 버린다
  } finally {
    clearTimeout(timer);
  }
}

// ── 같은 요청 = 같은 키 ───────────────────────────────────────────────────────
export const newIdempotencyKey = (): string => newRequestId(); // uuid 모양 = 서버 키 모양에 맞다(중복 방지 이름표 — 보안용 난수 아님)

/** 요청 내용의 짧은 지문(두 32비트 값). 키를 어떤 요청에 붙였는지만 가르고 글 자체는 들고 있지 않는다 */
function signatureOf(request: unknown): string {
  const s = JSON.stringify(request) ?? '';
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${s.length}:${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
}

/** 한 화면(훅 · 컴포넌트)이 하나 들고 있는다. 메모리에만 — 저장 0, 화면이 닫히면 함께 사라진다.
 *  begin(request): 앞 시도가 '닿았는지 모른' 채 끝났고(done(false)) 같은 요청이면 그 키를 다시 쓴다(다시 시도). 그 밖에는 새 키(새 누름).
 *  done(reached): 서버가 답했으면 그 키는 다 쓴 것이라 비운다. 닿았는지 모르면(끊김 · 시간 초과) 같은 요청의 다시 시도를 위해 남긴다 */
export type KeyKeeper = { begin: (request: unknown) => string; done: (reached: boolean) => void; clear: () => void };

export function createKeyKeeper(make: () => string = newIdempotencyKey): KeyKeeper {
  let open: { sig: string; key: string } | null = null;
  let current: { sig: string; key: string } | null = null;
  return {
    begin(request) {
      const sig = signatureOf(request);
      current = open && open.sig === sig ? open : { sig, key: make() };
      return current.key;
    },
    done(reached) {
      open = reached ? null : current;
      current = null;
    },
    clear() {
      open = null;
      current = null;
    },
  };
}

/** 키 하나로 한 번 보내기: begin → 보내기 → done. 호출하는 쪽이 키를 직접 만지지 않게 하는 얇은 틀 */
export async function postAiRunKeyed(body: Record<string, unknown>, keys: KeyKeeper, envOverride?: AiRunEnv): Promise<AitResult> {
  const key = keys.begin(body);
  const res = await postAiRun(body, key, envOverride);
  keys.done(res.kind === 'reply');
  return res;
}
