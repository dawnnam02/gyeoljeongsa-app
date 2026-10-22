// 생년월일 입력 규칙(K2 02 · K1 A01)과 가입 나이 판정 — 만 24세 이상(D-100 · K20 5장, F22. 그 전에는 만 19세).
// 판정은 서버(underage-reject)가 한다. 앱은 ① 입력 모양(실제 있는 날짜 · 1950-01-01 이후 · 오늘 이전)을 먼저 걸러
// 서버에 헛걸음을 보내지 않고, ② 데모 모드의 모의 서버가 같은 식으로 판정하게 한다. 식은 서버와 같다:
//   가입 나이 미달 = 생년월일 > (오늘[한국 날짜] − 24년). 날짜가 없는 해(2월 29일)는 그 달의 마지막 날로 줄인다(Postgres 의 interval 계산과 같다).
//  · 설문 A01 의 고를 수 있는 끝 날짜(surveyLite liteModel · 설문 v2)도 같은 adultCutoff 를 쓴다
//  · 미성년자 보호 규정(만 19세 미만 신고 24시간 먼저 확인 · 만 14세 미만 정보 미수집)은 가입 나이와 따로 간다(K20 5장 — 그 글은 그대로)
//  · 함수 이름(adultCutoff · isAdult)은 그대로 두고 값만 바꿨다(부르는 곳 그대로)
export const BIRTH_MIN = '1950-01-01';
export const BIRTH_DIGITS = 8;
export const SIGNUP_MIN_AGE = 24; // 가입 나이(만). 서버 private.signup_config.min_age(제안, K20 5장 8번)와 같은 값

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 지금(ms) → 한국 날짜 'YYYY-MM-DD'
export function kstToday(nowMs: number): string {
  const d = new Date(nowMs + KST_OFFSET_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// 숫자 8자리(YYYYMMDD) → 'YYYY-MM-DD'. 실제 있는 날짜가 아니면 null
export function birthDigitsToIso(digits: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(digits);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export type BirthCheck = 'ok' | 'format' | 'range';

// 입력 모양 검사: 8자리 · 실제 있는 날짜 · 1950-01-01 이후 · 오늘 이전. 가입 나이 판정은 아니다(서버가 판정하고 거절을 센다).
export function checkBirthShape(digits: string, todayIso: string): { result: BirthCheck; iso: string | null } {
  const iso = birthDigitsToIso(digits);
  if (!iso) return { result: 'format', iso: null };
  if (iso < BIRTH_MIN || iso > todayIso) return { result: 'range', iso };
  return { result: 'ok', iso };
}

// 오늘에서 가입 나이(24년) 뒤로 간 날(없는 날은 그 달의 마지막 날)
export function adultCutoff(todayIso: string, years = SIGNUP_MIN_AGE): string {
  const year = Number(todayIso.slice(0, 4)) - years;
  const month = Number(todayIso.slice(5, 7));
  const day = Math.min(Number(todayIso.slice(8, 10)), daysInMonth(year, month));
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

// 만 24세 생일이 지났는가(생일 당일부터 true)
export function isAdult(birthIso: string, todayIso: string): boolean {
  return birthIso <= adultCutoff(todayIso);
}
