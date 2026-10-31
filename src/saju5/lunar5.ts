// IF5-F1b · 음양력 바꾸기(TS) — ai/IF5/lunar5.py 의 같은 표(ts/data/lunar5.json = 참조표_음양력_1960_2051.csv)를 읽는다.
// 의존성 0(표준 JS 만) · 기기 시간대와 무관(날짜는 모두 'UTC 로 읽은 날 수'로 센다) · 앱이 복사해 쓰는 순수 함수.
// 약속(계산명세5.md 8장): 한국 표준시 날짜 · 달의 첫날 = 합삭이 든 날 · 달 이름 = 든 중기 · 윤달 = 중기 없는 첫 달.
// 범위: 양력 1960-01-01 ~ 2051-12-31. 범위 밖 · 없는 날짜는 LunarError 를 던진다(파이썬 ValueError 와 같은 code 글자).
// 맞춤 시험: ts/tests/lunar5.test.ts 가 lunar5.py 가 만든 4,000건 + 33,603일 전체 지문과 대조한다.

import lunarJson from './data/lunar5.json';

export type LunarErrorCode = 'invalid_date' | 'out_of_range' | 'no_such_lunar_month' | 'no_such_lunar_day';

export class LunarError extends Error {
  readonly code: LunarErrorCode;
  constructor(code: LunarErrorCode) {
    super(code);
    this.name = 'LunarError';
    this.code = code;
  }
}

export interface LunarDate { year: number; month: number; day: number; leap: boolean }
export interface SolarDate { year: number; month: number; day: number }
export interface LunarMonthInfo { month: number; leap: boolean; length: number; start: SolarDate }

interface Table { first: string; last: string; count: number; s: number[]; n: number[]; y: number[]; m: number[]; l: number[] }
const T = lunarJson as unknown as Table;

const DAY_MS = 86400000;
const dayNumOf = (y: number, m: number, d: number): number => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
const solarOf = (dn: number): SolarDate => {
  const t = new Date(dn * DAY_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
};

export const LUNAR_FIRST_SOLAR: SolarDate = { year: 1960, month: 1, day: 1 };
export const LUNAR_LAST_SOLAR: SolarDate = { year: 2051, month: 12, day: 31 };
const FIRST_DN = dayNumOf(1960, 1, 1);
const LAST_DN = dayNumOf(2051, 12, 31);

/** 존재하는 양력 날짜인가(윤년 포함). 기기 시간대와 무관. */
function validSolar(y: number, m: number, d: number): boolean {
  if (![y, m, d].every(Number.isInteger)) return false;
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 달 키: 음력 해 · 달 · 윤 → 표 번호
const KEY = (y: number, m: number, leap: boolean): number => (y * 13 + m) * 2 + (leap ? 1 : 0);
const INDEX = new Map<number, number>();
T.s.forEach((_s, i) => INDEX.set(KEY(T.y[i], T.m[i], T.l[i] === 1), i));

/** 양력 → 음력. 범위(1960-01-01 ~ 2051-12-31) 밖이면 out_of_range, 없는 날짜면 invalid_date. */
export function solarToLunar(y: number, m: number, d: number): LunarDate {
  if (!validSolar(y, m, d)) throw new LunarError('invalid_date');
  const dn = dayNumOf(y, m, d);
  if (dn < FIRST_DN || dn > LAST_DN) throw new LunarError('out_of_range');
  let lo = 0;
  let hi = T.s.length - 1;
  while (lo < hi) {                                  // 마지막으로 start <= dn 인 달
    const mid = (lo + hi + 1) >> 1;
    if (T.s[mid] <= dn) lo = mid;
    else hi = mid - 1;
  }
  return { year: T.y[lo], month: T.m[lo], day: dn - T.s[lo] + 1, leap: T.l[lo] === 1 };
}

/** 음력 → 양력. 없는 달(윤달이 없는 해에 leap=true · 표 밖) · 없는 날(29일 달의 30일 등) · 범위 밖은 오류. */
export function lunarToSolar(year: number, month: number, day: number, leap = false): SolarDate {
  if (![year, month, day].every(Number.isInteger)) throw new LunarError('no_such_lunar_month');
  const i = INDEX.get(KEY(year, month, leap));
  if (i === undefined) throw new LunarError('no_such_lunar_month');
  if (day < 1 || day > T.n[i]) throw new LunarError('no_such_lunar_day');
  const dn = T.s[i] + day - 1;
  if (dn < FIRST_DN || dn > LAST_DN) throw new LunarError('out_of_range');
  return solarOf(dn);
}

/** 그 음력 해의 윤달 이름(1~12). 없으면 null. */
export function leapMonthOf(year: number): number | null {
  for (let i = 0; i < T.s.length; i++) if (T.y[i] === year && T.l[i] === 1) return T.m[i];
  return null;
}

/** 그 달이 며칠인가(29 또는 30). 표에 없는 달이면 no_such_lunar_month. */
export function daysInLunarMonth(year: number, month: number, leap = false): number {
  const i = INDEX.get(KEY(year, month, leap));
  if (i === undefined) throw new LunarError('no_such_lunar_month');
  return T.n[i];
}

/** 날짜 고르기 화면용: 그 음력 해의 달 목록(윤달 포함, 차례대로). 표 밖 해는 빈 목록. */
export function lunarMonthsOfYear(year: number): LunarMonthInfo[] {
  const out: LunarMonthInfo[] = [];
  for (let i = 0; i < T.s.length; i++) {
    if (T.y[i] === year) out.push({ month: T.m[i], leap: T.l[i] === 1, length: T.n[i], start: solarOf(T.s[i]) });
  }
  return out;
}

/** 시험용: 표의 달 수 · 양력 범위 안의 모든 날을 'YYYY-MM-DD ly-lm-ld-leap' 한 줄씩(파이썬 listing_lines 와 같은 글자). */
export const LUNAR_MONTH_COUNT: number = T.count;
export function* lunarListing(): Generator<string> {
  const p2 = (n: number): string => String(n).padStart(2, '0');
  for (let dn = FIRST_DN; dn <= LAST_DN; dn++) {
    const s = solarOf(dn);
    const l = solarToLunar(s.year, s.month, s.day);
    yield `${s.year}-${p2(s.month)}-${p2(s.day)} ${l.year}-${l.month}-${l.day}-${l.leap ? 1 : 0}`;
  }
}
