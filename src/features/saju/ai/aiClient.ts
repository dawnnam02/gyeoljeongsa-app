// 사주 AI 맞춤 서버 함수 부르기(IF5-F2 ⑩ · AIT 서버 경로 /api/ai/<기능> 위 — 보안 ATF-06 ~ 10 · IFF5-26).
//  · 웹은 상대 경로 /api/ai/<기능> 만(새 주소 변수 0). 접근 코드는 머리 x-ait-code 로만(주소 · 본문 · 쿠키 0) · credentials 'omit' · 코드가 없으면 서버 요청 0(데모 글)
//  · 본문 키는 서버 허용 목록과 같은 것만(feature · facts · text · bundle · precheck). 모델 · max_tokens · system · 가격 · 금액 · 이력 필드는 앱이 정하지 못한다(서버가 정함)
//  · 서버가 준 오류 문장은 쓰지 않는다 — code 만 읽는다. 닿지 못하면(정적 판 · 끊김 · 시간 초과 · 모양이 다른 답) offline. 자동 재시도 0(IFF5-06) · 로그 · 저장 0
import { AIT_REQUEST_TIMEOUT_MS } from '@/features/ait/aitConfig';
import { parseReply, type AitResult } from '@/features/ait/aitTypes';

export const S5_ACCESS_HEADER = 'x-ait-code';
export const S5_KINDS = ['reading', 'daewoon', 'sinyeon', 'compat', 'taekil', 'chat'] as const;
export type S5Kind = (typeof S5_KINDS)[number];
/** 서버 handler5.ts 의 S5_ALLOWED_KEYS 와 같은 목록(시험이 서로 맞는지 본다) */
export const S5_BODY_KEYS: Readonly<Record<S5Kind, readonly string[]>> = {
  reading: ['facts'],
  daewoon: ['facts'],
  sinyeon: ['facts'],
  compat: ['facts'],
  taekil: ['facts'],
  chat: ['text', 'facts', 'bundle', 'precheck'],
};

export type S5Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; credentials: 'omit'; cache: 'no-store'; signal: AbortSignal }) => Promise<{ json: () => Promise<unknown> }>;

export function pickS5Body(kind: S5Kind, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { feature: `s5_${kind}` };
  for (const k of S5_BODY_KEYS[kind]) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

export async function postSaju5(kind: S5Kind, body: Record<string, unknown>, code: string, fetchImpl: S5Fetch = fetch as unknown as S5Fetch): Promise<AitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIT_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`/api/ai/s5_${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [S5_ACCESS_HEADER]: code },
      body: JSON.stringify(pickS5Body(kind, body)),
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    const reply = parseReply(await res.json());
    return reply ? { kind: 'reply', reply } : { kind: 'offline' };
  } catch {
    return { kind: 'offline' }; // 오류 객체 · 본문은 버린다
  } finally {
    clearTimeout(timer);
  }
}
