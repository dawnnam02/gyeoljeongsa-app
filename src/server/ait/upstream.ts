// AIT-A · 업체 오류 분류(보안 AC-23 · AT-24): 재시도 0 · 한도 도달을 구분 · 본문 · 머리는 읽지 않고 버린다.
// 앱 서버 함수가 SDK 오류에서 아래 모양의 값만 뽑아 넘긴다: status(숫자) · errorType(문자열 이름) · messageHead(앞 40자) · timeout(true/false).
// 요청 머리 · 키 · 응답 본문은 이 함수로 들어오지 않는다.

import type { ResponseCode } from './codes.ts';

export interface UpstreamFailure {
  status?: number;
  /** 업체 오류의 error.type 이름(예: rate_limit_error · invalid_request_error · api_error · overloaded_error) 또는 error_code(enforced_spend_limit_reached) */
  errorType?: string;
  /** 오류 메시지 앞 40자(한도 도달 구분용). 그 뒤는 버린다 */
  messageHead?: string;
  timeout?: boolean;
}

export const SPEND_LIMIT_HEAD = 'You have reached your specified';

export function classifyUpstream(f: UpstreamFailure): Extract<ResponseCode, 'spend_limit' | 'rate' | 'bad_request' | 'unavailable' | 'upstream' | 'timeout'> {
  if (f.timeout) return 'timeout';
  const s = f.status ?? 0;
  const head = String(f.messageHead ?? '').slice(0, 40);
  // ① 조직 등급 상한: 429 + enforced_spend_limit_reached(retry-after 없음)  ② 직접 건 지출 한도: 400 + 'You have reached your specified …'
  if (s === 429 && f.errorType === 'enforced_spend_limit_reached') return 'spend_limit';
  if (s === 400 && head.startsWith(SPEND_LIMIT_HEAD)) return 'spend_limit';
  if (s === 429) return 'rate';
  if (s === 401 || s === 403) return 'unavailable';
  if (s === 400 || s === 404 || s === 413 || s === 422) return 'bad_request';
  if (s === 529 || s >= 500) return 'upstream';
  return 'upstream';
}

/** 월 상한 도달이면 일정 시간 live를 잠근다(데모 글로). 일반 429는 잠그지 않는다 */
export function shouldLockLive(code: ReturnType<typeof classifyUpstream>): boolean {
  return code === 'spend_limit' || code === 'unavailable';
}
