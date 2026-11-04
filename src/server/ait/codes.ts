// AIT-A · 응답 코드 13개(보안/AIT_위협.md 11장 #4) — 앱이 고정 한글 문구로 바꾼다.
// 오류 문구는 상수다. 입력 · 요청 머리 · 키 · 변수 이름을 끼워 넣지 않는다(AC-12).

export const RESPONSE_CODES = [
  'auth', 'rate', 'spend_limit', 'limit', 'unavailable', 'too_long', 'bad_request',
  'upstream', 'timeout', 'blocked_output', 'crisis', 'refused_intent', 'ok',
] as const;

export type ResponseCode = (typeof RESPONSE_CODES)[number];

/** 앱이 보여 줄 고정 문구. 마케팅 카피 `AIT.code.*`(app/src/content/aitCopy.ts)와 같은 글로 맞췄다(AI-FIX1, 마케팅/FA1/QF2_글표.md · AI/FA1/사람검수_자료.md A-1 ~ A-8). 남은 횟수 숫자 · 재촉 말 없음.
 *  '미리 쓴 글로 보여 드려요' 줄은 미리 쓴 글이 있는 기능에서만 앱이 `AIT.code.fallback` 으로 덧붙인다 — 서버 글에는 넣지 않는다. */
export const CODE_TEXT_KO: Readonly<Record<ResponseCode, string>> = {
  auth: "접근 코드가 맞지 않아요. 설정의 '시험용 AI 코드'에서 다시 확인해 주세요.",
  rate: '요청이 많았어요. 잠시 뒤에 다시 보내 주세요.',
  spend_limit: '이번 달 시험 이용분을 다 썼어요. 다음 달에 다시 시도해 주세요.',
  limit: '이 대화 기록이 너무 길어졌어요. 새 대화로 시작할 수 있어요.',
  unavailable: 'AI를 쓸 수 없어요. 잠시 뒤에 다시 시도해 주세요.',
  too_long: '글이 너무 길어요. 조금 줄여서 다시 보내 주세요.',
  bad_request: '요청을 읽지 못했어요. 화면을 새로 열어 다시 시도해 주세요.',
  upstream: 'AI가 바빠요. 잠시 뒤에 다시 시도해 주세요.',
  timeout: '답이 늦어지고 있어요. 이번 시도는 횟수에 넣지 않으니 다시 보내 주세요.',
  blocked_output: '이번 답은 안전 문제로 보여 드리지 않아요. 횟수는 줄지 않으니 같은 글을 다시 보내 주세요.',
  crisis: '',
  refused_intent: '',
  ok: '',
};

/** 제안하는 HTTP 상태(앱 서버 경로가 정한다). crisis · refused_intent는 고정 카드를 담은 정상 응답. */
export const SUGGESTED_STATUS: Readonly<Record<ResponseCode, number>> = {
  auth: 401, rate: 429, spend_limit: 503, limit: 429, unavailable: 503, too_long: 413,
  bad_request: 400, upstream: 502, timeout: 504, blocked_output: 200, crisis: 200, refused_intent: 200, ok: 200,
};

export function isResponseCode(v: unknown): v is ResponseCode {
  return typeof v === 'string' && (RESPONSE_CODES as readonly string[]).includes(v);
}

/** 우리 쪽 오류. 메시지는 코드별 상수뿐이다(입력 · 머리 · 키 · 변수 이름 0). */
export class AitError extends Error {
  code: ResponseCode;
  constructor(code: ResponseCode) {
    super('ait:' + code);
    this.name = 'AitError';
    this.code = code;
  }
}
