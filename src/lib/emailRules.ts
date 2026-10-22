// 이메일 입력 규칙(K2 02). 서버(otp-gate 의 normalizeEmail)와 같은 식이라 앱이 통과시킨 주소를 서버가 다시 거절하지 않는다.
//  · 앞뒤 공백은 지우고 영문 대소문자는 같은 이메일로 본다
//  · @ 앞뒤에 글자가 있고 도메인에 점이 있다, 공백 없음
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
}
