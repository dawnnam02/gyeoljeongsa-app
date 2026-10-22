// 서버 호출이 실패했을 때 앱이 문구를 고르는 데 필요한 것만 뽑는다: 인터넷 문제인가 · 서버가 준 코드는 무엇인가.
// 서버 함수(Edge Function)의 오류 본문은 { ok:false, code } 모양이다(backend/스키마.md 9-7). 본문의 다른 값은 읽지 않고 로그에도 남기지 않는다.
//  · supabase.functions.invoke 의 error: FunctionsFetchError(인터넷 끊김) · FunctionsHttpError(서버가 2xx 가 아닌 값을 줌, context = Response) · FunctionsRelayError
//  · supabase.from(…) · rpc 의 error: { code, message } (인터넷이 끊기면 code 가 비어 있고 message 에 fetch 가 들어 있다)

export type Failure = {
  readonly network: boolean; // 서버에 닿지 못했다
  readonly status: number | null; // 서버가 준 상태 코드
  readonly code: string | null; // 서버가 준 코드(otp-gate: invalid_token · locked …, DB: 23505 · 42501 …)
};

type FunctionsErrorLike = { name?: unknown; context?: unknown };

function isResponseLike(value: unknown): value is { status: number; json: () => Promise<unknown> } {
  return typeof value === 'object' && value !== null && typeof (value as { status?: unknown }).status === 'number' && typeof (value as { json?: unknown }).json === 'function';
}

// supabase.functions.invoke 가 돌려준 error → Failure. 본문은 한 번만 읽는다.
export async function readFunctionFailure(error: unknown): Promise<Failure> {
  const e = (error ?? {}) as FunctionsErrorLike;
  if (e.name === 'FunctionsFetchError') return { network: true, status: null, code: null };
  if (e.name === 'FunctionsHttpError' && isResponseLike(e.context)) {
    let code: string | null = null;
    try {
      const body = (await e.context.json()) as { code?: unknown } | null;
      if (body && typeof body.code === 'string') code = body.code;
    } catch {
      code = null; // 본문이 JSON 이 아니면 상태 코드만 쓴다
    }
    return { network: false, status: e.context.status, code };
  }
  return { network: false, status: null, code: null };
}

// supabase.from · rpc 의 error({ code, message }) → Failure
export function readDbFailure(error: { code?: string | null; message?: string | null } | null | undefined): Failure {
  const code = error?.code ? String(error.code) : null;
  const message = String(error?.message ?? '');
  const network = code === null && /fetch|network|failed to|timeout/i.test(message);
  return { network, status: null, code };
}
