// AIT-F ③ ④ · 서버 함수 연결(앱이 따로 쓰는 파일 — scripts/sync-ait.mjs 가 건드리지 않는다).
//  이 폴더(src/server/ait)와 src/app/api/ai/[feature]+api.ts 만 서버 변수 이름을 읽는다(보안 AC-01 · 10장). 화면 쪽 코드는 이 폴더를 가져오지 않는다.
//  · 열쇠는 서버의 process.env 에서만, 요청마다 읽는다: ANTHROPIC_API_KEY · AI_ACCESS_CODE · AIT_SIGN_KEY (+ AIT_MODE · AIT_CHAT_MODEL · AIT_WORKSPACE_ID). EXPO_PUBLIC_ 접두어 0
//  · 값은 응답 · 로그 · 오류 어디에도 내보내지 않는다. 로그는 handler 의 logRecord 를 거친 허용 키(t f in out ms code mode rid)뿐, 던져진 오류 객체는 버린다
//  · AIT_MODE 가 live 가 아니면(기본 mock) 업체를 부르지 않는다. live 는 AIT_MODE=live + 키 + 작업 공간 ID(AIT_WORKSPACE_ID)가 있을 때만
//  · 업체 호출: 공식 SDK(@anthropic-ai/sdk) · maxRetries 0 · 60초 AbortSignal · 도구 0 · 요청 꼴은 request.ts 가 정한 그대로(모델 · max_tokens · effort)
//  · 응답 머리 anthropic-workspace-id 가 AIT_WORKSPACE_ID 와 다르면 그 격리는 잠그고(live 호출 0) 그 응답은 버린다(AC-08, 첫 응답 확인 방식)
import Anthropic from '@anthropic-ai/sdk';

import { createCounters, GUARD, handleAi, MAX_BODY_BYTES, replyError } from './index.ts';
import type { Counters, HandlerDeps, HttpReply, MessagesBody, ModelResult, UpstreamFailure } from './index.ts';

export const UPSTREAM_TIMEOUT_MS = 60_000;

/** 호출하는 쪽이 서버 변수에서 고른 이름들(값은 어디에도 적지 않는다) */
export interface RouteEnv {
  ANTHROPIC_API_KEY?: string;
  AI_ACCESS_CODE?: string;
  AIT_SIGN_KEY?: string;
  AIT_MODE?: string;
  AIT_CHAT_MODEL?: string;
  AIT_WORKSPACE_ID?: string;
}

/** 업체 쪽 한 겹(시험은 이것을 가짜로 끼운다 — 진짜는 공식 SDK) */
export interface Upstream {
  create(body: MessagesBody, signal: AbortSignal): Promise<{ data: ModelResult; workspaceId: string | null }>;
}

export interface RouteOptions {
  env: () => RouteEnv;
  /** live 일 때만 부른다. 열쇠는 이 함수 안에서만 쓰인다 */
  makeUpstream: (apiKey: string) => Upstream;
  now: () => number;
  counters: Counters;
  lock: { live: boolean };
  /** 로그 한 줄 내보내기(허용 키만 든 JSON 문자열) */
  sink: (line: string) => void;
}

/** 업체 호출 실패 값 — 필드는 status · errorType · messageHead(앞 40자) · timeout 뿐(오류 객체 · 본문 · 머리는 버린다) */
export class UpstreamError extends Error implements UpstreamFailure {
  status?: number;
  errorType?: string;
  messageHead?: string;
  timeout?: boolean;
  constructor(f: UpstreamFailure) {
    super('ait:upstream');
    this.name = 'UpstreamError';
    this.status = f.status;
    this.errorType = f.errorType;
    this.messageHead = f.messageHead;
    this.timeout = f.timeout;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** SDK 오류에서 이름 · 상태 · 앞 40자만 뽑는다(AC-12). 한도 도달은 error_code 우선 */
export function failureOf(e: unknown, timedOut: boolean): UpstreamFailure {
  if (timedOut) return { timeout: true };
  const r = isRecord(e) ? e : {};
  const status = typeof r.status === 'number' ? r.status : undefined;
  const body = isRecord(r.error) ? r.error : {};
  const inner = isRecord(body.error) ? body.error : {};
  return {
    status,
    errorType: str(inner.error_code) ?? str(body.error_code) ?? str(inner.type) ?? str(body.type),
    messageHead: (str(inner.message) ?? str(body.message))?.slice(0, 40),
  };
}

/** 공식 SDK 를 한 겹 감싼 것. 재시도 0 · 시간 상한 60초 */
export function anthropicUpstream(apiKey: string): Upstream {
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: UPSTREAM_TIMEOUT_MS });
  return {
    async create(body, signal) {
      const { data, response } = await client.messages.create(body as never, { signal }).withResponse();
      return {
        data: { stop_reason: data.stop_reason, content: data.content as unknown[], usage: { input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens } },
        workspaceId: response.headers.get('anthropic-workspace-id'),
      };
    },
  };
}

const BASE_HEADERS: Record<string, string> = { 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' };

function toResponse(res: HttpReply): Response {
  return new Response(JSON.stringify(res.body), { status: res.status, headers: { ...res.headers, ...BASE_HEADERS } });
}

export function createAitRoute(opts: RouteOptions): (request: Request) => Promise<Response> {
  let upstream: Upstream | null = null;
  return async function route(request: Request): Promise<Response> {
    try {
      const env = opts.env();
      const wantLive = env.AIT_MODE === 'live';
      const key = (env.ANTHROPIC_API_KEY ?? '').trim();
      const workspace = (env.AIT_WORKSPACE_ID ?? '').trim();
      const liveReady = wantLive && key.length > 0 && workspace.length > 0; // 열쇠 없으면 not_ready → 모의로 돈다(업체 호출 0)

      const deps: HandlerDeps = {
        env: { AI_ACCESS_CODE: env.AI_ACCESS_CODE, AIT_SIGN_KEY: env.AIT_SIGN_KEY, AIT_MODE: env.AIT_MODE, AIT_CHAT_MODEL: env.AIT_CHAT_MODEL },
        liveReady,
        callModel: async (body) => {
          upstream ??= opts.makeUpstream(key);
          const controller = new AbortController();
          let timedOut = false;
          const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, UPSTREAM_TIMEOUT_MS);
          try {
            const r = await upstream.create(body, controller.signal);
            if (r.workspaceId !== workspace) throw new UpstreamError({ status: 403, errorType: 'workspace_mismatch' }); // 이 응답은 버리고 이 격리는 잠근다
            return r.data;
          } catch (e) {
            if (e instanceof UpstreamError) throw e;
            throw new UpstreamError(failureOf(e, timedOut));
          } finally {
            clearTimeout(timer);
          }
        },
        now: opts.now,
        counters: opts.counters,
        guard: GUARD,
        log: (r) => opts.sink(JSON.stringify(r)),
        lock: opts.lock,
      };

      const declared = Number(request.headers.get('content-length'));
      // 너무 큰 본문은 읽지 않는다 — 코드 검사 뒤에 handler 가 같은 413 으로 답하게 상한을 넘긴 자리 글을 넘긴다
      const bodyText = Number.isFinite(declared) && declared > MAX_BODY_BYTES ? ' '.repeat(MAX_BODY_BYTES + 1) : await request.text();
      const res = await handleAi({ method: request.method, headers: Object.fromEntries(request.headers), bodyText }, deps);
      return toResponse(res);
    } catch {
      return toResponse(replyError('upstream', 'mock')); // 던져진 오류는 어디에도 내보내지 않는다(Crashes · 로그 0)
    }
  };
}

function processEnv(): RouteEnv {
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    AI_ACCESS_CODE: process.env.AI_ACCESS_CODE,
    AIT_SIGN_KEY: process.env.AIT_SIGN_KEY,
    AIT_MODE: process.env.AIT_MODE,
    AIT_CHAT_MODEL: process.env.AIT_CHAT_MODEL,
    AIT_WORKSPACE_ID: process.env.AIT_WORKSPACE_ID,
  };
}

const state = { counters: createCounters(), lock: { live: false } };

/** src/app/api/ai/[feature]+api.ts 가 부르는 기본 연결(격리 하나 안의 메모리 카운터 · 잠금) */
export const handleAitRequest = createAitRoute({
  env: processEnv,
  makeUpstream: anthropicUpstream,
  now: Date.now,
  counters: state.counters,
  lock: state.lock,
  // eslint-disable-next-line no-console
  sink: (line) => console.log(line),
});
