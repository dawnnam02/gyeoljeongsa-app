// AI 시험판 서버 함수 부르기(AIT-F ⑤ ⑥ · 보안 ATF-06 ~ 10).
//  · 웹은 상대 경로 /api/ai/<기능> 만(새 주소 변수 0). 코드는 머리 x-ait-code 로만 — 주소 · 본문 · 쿠키 0, credentials 'omit'
//  · 본문 키는 서버 허용 목록과 같은 것만(feature · 글칸 · 서명 묶음). 모델 · max_tokens · system · 가격 · 횟수는 앱이 정하지 못한다(서버가 정함)
//  · 서버가 준 오류 문장은 쓰지 않는다 — code 만 읽는다. 닿지 못하면(정적 판 · 끊김 · 시간 초과 · 모양이 다른 답) offline
//  · 로그 · 저장 0: 이 모듈은 입력 글 · 출력 글 · 코드를 어디에도 남기지 않는다(잡은 오류도 버린다)
import { AIT_REQUEST_TIMEOUT_MS } from './aitConfig';
import { parseReply, type AitFeature, type AitResult } from './aitTypes';

export const AIT_ACCESS_HEADER = 'x-ait-code';

/** 서버 handler.ts 의 ALLOWED_KEYS 와 같은 목록(어긋나면 서버가 bad_request — 시험이 서로 맞는지 본다) */
export const AIT_BODY_KEYS: Readonly<Record<AitFeature, readonly string[]>> = {
  chat: ['asker_text', 'partner_text', 'partner_alias', 'chip', 'bundle'],
  compat: ['shared'],
  coach: ['field', 'text'],
  horoscope: ['sun_sign', 'day_element', 'cusp'],
};

export type AitFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; credentials: 'omit'; cache: 'no-store'; signal: AbortSignal }) => Promise<{ json: () => Promise<unknown> }>;

/** 허용 목록 밖 키는 버린다(앱이 실수로 모델 · 토큰 같은 필드를 얹어도 나가지 않는다) */
export function pickBody(feature: AitFeature, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { feature };
  for (const k of AIT_BODY_KEYS[feature]) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

export async function postAit(feature: AitFeature, body: Record<string, unknown>, code: string, fetchImpl: AitFetch = fetch as unknown as AitFetch): Promise<AitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIT_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`/api/ai/${feature}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [AIT_ACCESS_HEADER]: code },
      body: JSON.stringify(pickBody(feature, body)),
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
