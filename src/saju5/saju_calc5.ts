// IF5-A2 · 사주 계산 TS 모듈 — ai/IF5/calc5.py 를 그대로 옮긴 것(상대 생일 기기 안 계산 · 데모 · 서버 포팅의 기준 사본).
// 의존성 0(표준 JS 만) · 참조표는 작은 JSON 두 개(ts/data/jie5.json 절입 1,104개 · ts/data/sun5.json 태양 급수 L0~L5).
// 이름·모양은 calc5.py 와 같게(snake_case) 둔다 — 그래야 calc5.py 가 만든 사실 묶음과 글자 하나까지 맞춰 볼 수 있다.
// 시간은 '한국 표준시 벽시계를 UTC 로 읽은 초'(Sec)로 다룬다. Date 의 지역 시간대를 쓰지 않는다(기기 시간대와 무관).
// 맞춤 시험: ts/tests/calc5.test.ts 가 calc5.py 가 만든 무작위 3,000건 이상 + 계산시험값5.csv 16건과 대조한다.
//
// 균시차는 Meeus 28.1 전체식 한 가지로 정했다(까닭: calc5.py 가 이 식이고, Spencer 근사로 바꾸면 시진 경계 ±0.6분 안 출생
// (약 0.5%)에서 calc5 와 갈라진다. 식 전체는 급수 120여 줄 + 상수 몇 개라 앱에 넣어도 가볍다). 근거: 계산명세5.md 1장.

import jieJson from './data/jie5.json';
import sunJson from './data/sun5.json';

export type Sec = number;
export type Gender = 'M' | 'F';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>;

// ---------------------------------------------------------------- 파이썬과 같은 나머지 · 몫
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const fdiv = (a: number, n: number): number => Math.floor(a / n);
const rad = (x: number): number => (x * Math.PI) / 180;
const deg = (x: number): number => (x * 180) / Math.PI;
const sinD = (x: number): number => Math.sin(rad(x));
const cosD = (x: number): number => Math.cos(rad(x));
const wrap180 = (x: number): number => mod(x + 180, 360) - 180;

// ---------------------------------------------------------------- 시간 도우미
export const mkSec = (y: number, m: number, d: number, h = 0, mi = 0, s = 0): Sec => Date.UTC(y, m - 1, d, h, mi, s) / 1000;
export interface Parts { y: number; m: number; d: number; h: number; mi: number; s: number }
export function partsOf(sec: Sec): Parts {
  const t = new Date(sec * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
}
const dayNum = (sec: Sec): number => Math.floor(sec / 86400);                 // 1970-01-01 = 0
const p2 = (n: number): string => String(n).padStart(2, '0');
export const isoDate = (dn: number): string => { const t = partsOf(dn * 86400); return `${t.y}-${p2(t.m)}-${p2(t.d)}`; };
export const isoMinute = (sec: Sec): string => { const t = partsOf(sec); return `${t.y}-${p2(t.m)}-${p2(t.d)} ${p2(t.h)}:${p2(t.mi)}`; };
export const dayNumOf = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d) / 86400000;
const monthLen = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const J2000 = 2451545.0;
const EPOCH2000_12 = Date.UTC(2000, 0, 1, 12, 0, 0) / 1000;
const HOUR = 3600;
const MIN = 60;

export const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
export const ELEMENTS = ['목', '화', '토', '금', '수'] as const;
export const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
export const BRANCH_ELEMENT = BRANCH_MAIN_STEM.map((s) => Math.floor(s / 2));
export const POS_KO: Record<string, string> = { year: '년', month: '월', day: '일', hour: '시' };
export const POS_ORDER = ['year', 'month', 'day', 'hour'] as const;
type Pos = (typeof POS_ORDER)[number];

const SUPPORT_FROM: Sec = mkSec(1961, 8, 10);
const SUPPORT_TO: Sec = mkSec(2050, 12, 31, 23, 59);
const MARGIN_MIN = 2.0;

export function ganji_idx(stem: number, branch: number): number {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  throw new Error('간지 짝이 맞지 않음');
}
export const gj = (i: number): string => STEMS[mod(i, 10)] + BRANCHES[mod(i, 12)];
/** 일주 번호(0 = 갑자) = (율리우스 적일 + 49) mod 60. 1970-01-01 의 율리우스 적일 = 2440588 */
export const day_idx = (dn: number): number => mod(dn + 2440588 + 49, 60);

// ---------------------------------------------------------------- 절입 표(작은 JSON)
const JIE_T: readonly number[] = jieJson.t;
const JIE_K: readonly number[] = jieJson.k;
const JIE_YS: readonly number[] = jieJson.ys;
export const JIE_RANGE = { first: jieJson.first, last: jieJson.last };

function bisectRight(arr: readonly number[], x: number): number {
  let lo = 0; let hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (x < arr[mid]) hi = mid; else lo = mid + 1; }
  return lo;
}
/** 그 순간 직전 절(節): [시각, k, 사주 해]. k 0 입춘(인월) … 11 소한(축월) */
export function jie_state(t: Sec): [Sec, number, number] {
  const i = bisectRight(JIE_T, t) - 1;
  if (i < 0) throw new Error('절입 표 밖');
  return [JIE_T[i], JIE_K[i], JIE_YS[i]];
}
export function next_jie(t: Sec): [Sec, number, number] {
  const i = bisectRight(JIE_T, t);
  if (i >= JIE_T.length) throw new Error('절입 표 밖');
  return [JIE_T[i], JIE_K[i], JIE_YS[i]];
}
export const year_pillar_idx = (sajuYear: number): number => mod(sajuYear - 4, 60);
export function month_pillar_idx(yearIdx: number, k: number): number {
  const stem = mod(2 * ((yearIdx % 10) % 5) + 2 + k, 10);
  return ganji_idx(stem, mod(2 + k, 12));
}
export function ym_at(t: Sec): [number, number, number, number] {
  const [, k, ys] = jie_state(t);
  const yi = year_pillar_idx(ys);
  return [yi, month_pillar_idx(yi, k), k, ys];
}

// ---------------------------------------------------------------- 한국 표준시 · 서머타임
// 표준시(UTC+9) 기준 구간: 1987-05-10 02:00 ~ 10-11 02:00 · 1988-05-08 02:00 ~ 10-09 02:00
const DST_STD: ReadonlyArray<readonly [Sec, Sec]> = [
  [mkSec(1987, 5, 10, 2, 0), mkSec(1987, 10, 11, 2, 0)],
  [mkSec(1988, 5, 8, 2, 0), mkSec(1988, 10, 9, 2, 0)],
];
export function clock_to_std(clock: Sec, dst_first = true): [Sec, string[]] {
  const flags: string[] = [];
  for (const [s, e] of DST_STD) {
    if (clock >= s && clock < s + HOUR) throw new Error('nonexistent_clock_time');
    if (clock >= e && clock < e + HOUR) {
      flags.push('ambiguous_clock_time');
      return [dst_first ? clock - HOUR : clock, [...flags, dst_first ? 'dst_adjusted' : 'dst_not_adjusted']];
    }
    if (clock >= s + HOUR && clock < e) { flags.push('dst_adjusted'); return [clock - HOUR, flags]; }
  }
  return [clock, flags];
}
/** 1987 · 1988 한국 서머타임이 걸린 날짜인가(날짜 단위 · IF3 와 같은 창) */
const dst_dates = (dn: number): boolean =>
  (dn >= dayNumOf(1987, 5, 10) && dn <= dayNumOf(1987, 10, 10)) || (dn >= dayNumOf(1988, 5, 8) && dn <= dayNumOf(1988, 10, 8));

// ---------------------------------------------------------------- 태양 황경 · 균시차 (Meeus 28.1)
const SUN_L: readonly (readonly (readonly number[])[])[] = sunJson.L;
function delta_t(y: number): number {
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t ** 2 + 0.0020936 * t ** 3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
  if (y < 2005) {
    const t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  if (y < 2015) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
  return 67.64 + 0.30 * (y - 2015);
}
const jdeOf = (jdUt: number): number => jdUt + delta_t(2000.0 + (jdUt - J2000) / 365.25) / 86400.0;
function series(tab: readonly (readonly number[])[], tau: number): number {
  let s = 0;
  for (const [a, b, c] of tab) s += a * Math.cos(b + c * tau);
  return s;
}
function sunTrueLonGeo(jde: number): number {
  const tau = (jde - J2000) / 365250.0;
  const L = (series(SUN_L[0], tau) + series(SUN_L[1], tau) * tau + series(SUN_L[2], tau) * tau ** 2
    + series(SUN_L[3], tau) * tau ** 3 + series(SUN_L[4], tau) * tau ** 4 + series(SUN_L[5], tau) * tau ** 5) / 1e8;
  return mod(deg(L) + 180.0, 360.0);
}
function nutationLonDeg(T: number): number {
  const om = 125.04452 - 1934.136261 * T;
  const ls = 280.4665 + 36000.7698 * T;
  const lm = 218.3165 + 481267.8813 * T;
  return (-17.20 * sinD(om) - 1.32 * sinD(2 * ls) - 0.23 * sinD(2 * lm) + 0.21 * sinD(2 * om)) / 3600.0;
}
function sunLon(jdUt: number): number {
  const jde = jdeOf(jdUt);
  const T = (jde - J2000) / 36525.0;
  const lam = sunTrueLonGeo(jde) - 0.09033 / 3600.0;
  const M = 357.52911 + 35999.05029 * T;
  const R = 1.000140 - 0.016708 * cosD(M) - 0.000140 * cosD(2 * M);
  return mod(lam + nutationLonDeg(T) - 20.4898 / 3600.0 / R, 360.0);
}
/** 균시차(분) = 참태양시 − 평균태양시 */
export function eot_minutes(std: Sec): number {
  const jd = (std - 9 * HOUR - EPOCH2000_12) / 86400.0 + J2000;
  const jde = jdeOf(jd);
  const T = (jde - J2000) / 36525.0;
  const tau = T / 10.0;
  const L0 = 280.4664567 + 360007.6982779 * tau + 0.03032028 * tau ** 2 + tau ** 3 / 49931 - tau ** 4 / 15300 - tau ** 5 / 2000000;
  const lam = sunLon(jd);
  const eps0 = 23.439291111 - 0.0130041667 * T - 1.64e-7 * T ** 2 + 5.04e-7 * T ** 3;
  const om = 125.04452 - 1934.136261 * T;
  const eps = eps0 + (9.20 / 3600.0) * cosD(om);
  const alpha = deg(Math.atan2(Math.cos(rad(eps)) * sinD(lam), cosD(lam)));
  const dpsi = nutationLonDeg(T);
  const E = wrap180(L0 - 0.0057183 - alpha + dpsi * Math.cos(rad(eps)));
  return E * 4.0;
}
export const solar_shift_minutes = (std: Sec, lon: number): number => (lon - 135.0) * 4.0 + eot_minutes(std);

/** 태어난 곳 대표 지점 23곳(시청 부근 근사 경도, 동경 도). S-5(20~30곳) 안 — 근거는 AI설계 IF5A2 문서 */
export const BIRTH_PLACES: Readonly<Record<string, number>> = {
  서울: 126.98, 인천: 126.71, 수원: 127.03, 춘천: 127.73, 강릉: 128.88, 원주: 127.95, 청주: 127.49,
  대전: 127.38, 세종: 127.29, 전주: 127.15, 광주: 126.85, 목포: 126.39, 여수: 127.66, 제주: 126.53,
  대구: 128.60, 안동: 128.73, 포항: 129.37, 울산: 129.31, 부산: 129.08, 창원: 128.68, 진주: 128.11,
  평양: 125.75, 개성: 126.55,
};

// ---------------------------------------------------------------- 오행 · 십성 · 12운성
const stem_el = (s: number): number => Math.floor(s / 2);
const stem_pol = (s: number): number => s % 2;
export function sipsung(dayStem: number, otherStem: number): string {
  const de = stem_el(dayStem); const oe = stem_el(otherStem);
  const same = stem_pol(dayStem) === stem_pol(otherStem);
  const diff = mod(oe - de, 5);
  if (diff === 0) return same ? '비견' : '겁재';
  if (diff === 1) return same ? '식신' : '상관';
  if (diff === 2) return same ? '편재' : '정재';
  if (diff === 3) return same ? '편관' : '정관';
  return same ? '편인' : '정인';
}
export const sipsung_branch = (dayStem: number, branch: number): string => sipsung(dayStem, BRANCH_MAIN_STEM[branch]);
export const STAGE_NAMES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
export const STAGE_NEUTRAL = ['싹트는 때', '다듬어지는 때', '자라나는 때', '자리 잡는 때', '한창인 때', '무르익는 때', '쉬어 가는 때', '거두는 때', '갈무리하는 때', '비우는 때', '씨 품는 때', '기르는 때'];
const STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
export const twelve_stage = (stem: number, branch: number): number => {
  const start = STAGE_START[stem];
  return stem % 2 === 0 ? mod(branch - start, 12) : mod(start - branch, 12);
};

// ---------------------------------------------------------------- 합 · 충 · 형
const pk = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
const pairMap = (rows: Array<[number, number, string | null]>): Map<string, string | null> => new Map(rows.map(([a, b, v]) => [pk(a, b), v]));
const pairSet = (rows: Array<[number, number]>): Set<string> => new Set(rows.map(([a, b]) => pk(a, b)));
const STEM_COMBINE = pairMap([[0, 5, '토'], [1, 6, '금'], [2, 7, '수'], [3, 8, '목'], [4, 9, '화']]);
const STEM_CLASH = pairSet([[0, 6], [1, 7], [2, 8], [3, 9]]);
const BRANCH_COMBINE6 = pairMap([[0, 1, '토'], [2, 11, '목'], [3, 10, '화'], [4, 9, '금'], [5, 8, '수'], [6, 7, '화']]);
const BRANCH_TRIAD: ReadonlyArray<readonly [readonly number[], string]> = [[[8, 0, 4], '수'], [[11, 3, 7], '목'], [[2, 6, 10], '화'], [[5, 9, 1], '금']];
const BRANCH_CLASH = pairSet([[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]);
const BRANCH_PUNISH = pairSet([[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]]);
const SELF_PUNISH = new Set([4, 6, 9, 11]);

export const REL_LABEL: Readonly<Record<string, string>> = {
  stem_combine: '끌어당기는 짝(합)',
  stem_clash: '서로 자극하는 관계',
  branch_combine: '어우러지는 짝(합)',
  branch_triad_half: '손을 잡는 흐름(반합)',
  branch_triad_full: '한 흐름으로 모이는 합(삼합)',
  branch_clash: '마주 보며 자극하는 관계',
  branch_punish: '서로 다듬어 가는 관계',
  branch_self: '스스로 다듬는 관계',
  branch_same: '같은 기운',
};
type RelPair = [string, string | null];
export function stem_relations(a: number, b: number): RelPair[] {
  const out: RelPair[] = [];
  const p = pk(a, b);
  if (a !== b && STEM_COMBINE.has(p)) out.push(['stem_combine', STEM_COMBINE.get(p) ?? null]);
  if (STEM_CLASH.has(p)) out.push(['stem_clash', null]);
  return out;
}
export function branch_relations(a: number, b: number): RelPair[] {
  const out: RelPair[] = [];
  if (a === b) out.push([SELF_PUNISH.has(a) ? 'branch_self' : 'branch_same', null]);
  const p = pk(a, b);
  if (a !== b) {
    if (BRANCH_COMBINE6.has(p)) out.push(['branch_combine', BRANCH_COMBINE6.get(p) ?? null]);
    for (const [grp, el] of BRANCH_TRIAD) if (grp.includes(a) && grp.includes(b)) out.push(['branch_triad_half', el]);
    if (BRANCH_CLASH.has(p)) out.push(['branch_clash', null]);
    if (BRANCH_PUNISH.has(p)) out.push(['branch_punish', null]);
  }
  return out;
}
export function full_triads(branches: number[]): string[] {
  const s = new Set(branches);
  return BRANCH_TRIAD.filter(([grp]) => grp.every((x) => s.has(x))).map(([, el]) => el);
}

// ---------------------------------------------------------------- 신살 → 중립 이름 (calc5.py 와 같은 표 · 화면용 이름표는 neutral_names5.json)
export const SINSAL_NEUTRAL: Readonly<Record<string, readonly [string, string]>> = {
  cheon_eul: ['도움 인연의 기운', '필요할 때 손 내밀어 주는 사람을 만나기 쉬운 기운이래요'],
  munchang: ['글과 공부의 기운', '읽고 쓰고 배우는 쪽에 마음이 가는 기운이에요'],
  yangin: ['단단한 집중의 기운', '한 가지에 파고드는 힘이 센 기운이에요'],
  dohwa: ['매력의 기운', '사람을 끌어당기는 분위기를 가진 기운이에요'],
  yeokma: ['움직임의 기운', '자리를 옮기고 새 곳을 향하는 걸 좋아하는 기운이에요'],
  hwagae: ['고요한 몰입의 기운', '혼자 깊이 빠져드는 시간이 힘이 되는 기운이에요'],
  baekho: ['과감한 추진의 기운', '한번 마음먹으면 밀고 나가는 기운이에요'],
  goegang: ['강한 결단의 기운', '선택을 또렷하게 하는 기운이에요'],
  wonjin: ['엇갈려 보이는 끌림의 기운', '가까운데도 서로 어긋난다고 느끼기 쉬운 기운이래요'],
  gwimun: ['예민하고 섬세한 감각의 기운', '작은 신호를 잘 알아채는 기운이에요'],
  gongmang: ['비어 있어 채워 가는 자리', '아직 채워질 여지가 큰 자리라는 뜻이에요'],
  samjae: ['쉬어 가며 정비하는 시기', '새로 벌이기보다 정리하고 다지기 좋은 시기래요'],
};
const CHEON_EUL: Record<number, number[]> = { 0: [1, 7], 1: [0, 8], 2: [11, 9], 3: [11, 9], 4: [1, 7], 5: [0, 8], 6: [1, 7], 7: [2, 6], 8: [3, 5], 9: [3, 5] };
const MUNCHANG: Record<number, number> = { 0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3 };
const YANGIN: Record<number, number> = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
const arr12 = (r: Record<number, number>): number[] => Array.from({ length: 12 }, (_, i) => r[i]);
const DOHWA_OF_TRIAD = arr12({ 0: 9, 8: 9, 4: 9, 2: 3, 6: 3, 10: 3, 5: 6, 9: 6, 1: 6, 11: 0, 3: 0, 7: 0 });
const YEOKMA_OF_TRIAD = arr12({ 0: 2, 8: 2, 4: 2, 2: 8, 6: 8, 10: 8, 5: 11, 9: 11, 1: 11, 11: 5, 3: 5, 7: 5 });
const HWAGAE_OF_TRIAD = arr12({ 0: 4, 8: 4, 4: 4, 2: 10, 6: 10, 10: 10, 5: 1, 9: 1, 1: 1, 11: 7, 3: 7, 7: 7 });
const BAEKHO = new Set([ganji_idx(0, 4), ganji_idx(1, 7), ganji_idx(2, 10), ganji_idx(3, 1), ganji_idx(4, 4), ganji_idx(8, 10), ganji_idx(9, 1)]);
const GOEGANG = new Set([ganji_idx(6, 4), ganji_idx(6, 10), ganji_idx(8, 4), ganji_idx(4, 10)]);
const WONJIN = pairSet([[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]]);
const GWIMUN = pairSet([[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]]);
const SAMJAE_YEARS: Record<number, number[]> = {
  8: [2, 3, 4], 0: [2, 3, 4], 4: [2, 3, 4], 2: [8, 9, 10], 6: [8, 9, 10], 10: [8, 9, 10],
  5: [11, 0, 1], 9: [11, 0, 1], 1: [11, 0, 1], 11: [5, 6, 7], 3: [5, 6, 7], 7: [5, 6, 7],
};
const gongmang_branches = (idx60: number): [number, number] => { const xun = fdiv(idx60, 10) * 10; return [mod(xun + 10, 12), mod(xun + 11, 12)]; };

// ---------------------------------------------------------------- 사주 원국
export interface BirthInput { year: number; month: number; day: number; hour?: number | null; minute?: number | null; gender?: Gender | null; lon?: number | null; place?: string | null }
export interface Chart {
  input: Rec; flags: string[]; notes: string[]; gender: Gender | null | undefined; zi_mode: string;
  pillars: { year: number; month: number; day: number; hour: number | null };
  combos: Array<{ year: string; month: string }>;
  birth_std: Sec; birth_std_approx: boolean; month_k: number; solar_shift_min: number | null;
  local_solar?: Sec; birth_date: number;
  pillar_list: Record<Pos, { idx: number; ko: string; stem: number; branch: number } | null>;
  day_master: { stem: number; ko: string; element: string; polarity: string };
}
const _pillar = (i: number | null) => (i === null ? null : { idx: i, ko: gj(i), stem: i % 10, branch: i % 12 });

export function build_chart(inp: BirthInput, zi_mode: 'yaja' | 'jeong' = 'yaja', dst_first = true): Chart {
  const { year, month, day } = inp;
  const hour = inp.hour ?? null; const minute = inp.minute ?? null; const gender = inp.gender ?? null;
  const lon = inp.lon ?? (inp.place ? (BIRTH_PLACES[inp.place] ?? null) : null);
  if (inp.place && lon === null) throw new Error('unknown_place');
  const dn = dayNumOf(year, month, day);
  const chk = partsOf(dn * 86400);
  if (chk.y !== year || chk.m !== month || chk.d !== day) throw new Error('invalid_date');
  const flags: string[] = []; const notes: string[] = [];
  if (mkSec(year, month, day, 23, 59) < SUPPORT_FROM || mkSec(year, month, day) > SUPPORT_TO) throw new Error('out_of_range');
  const chart: Rec = { input: { year, month, day, hour, minute, gender, lon }, flags, notes, gender, zi_mode };
  if (hour === null) {
    flags.push('hour_unknown');
    notes.push('시각을 넣으면 더 자세해요');
    let t0 = mkSec(year, month, day);
    if (dst_dates(dn)) t0 -= HOUR;
    const t1 = t0 + 86400;
    const m = MARGIN_MIN * MIN;
    const a = ym_at(t0 - m); const b = ym_at(t1 + m);
    const combos = [{ year: gj(a[0]), month: gj(a[1]) }];
    if (a[0] !== b[0] || a[1] !== b[1]) { combos.push({ year: gj(b[0]), month: gj(b[1]) }); flags.push('jie_day_two_possibilities'); }
    const [stdRep] = clock_to_std(mkSec(year, month, day, 12, 0));
    const [yi, mi, k] = ym_at(stdRep);
    chart.pillars = { year: yi, month: mi, day: day_idx(dn), hour: null };
    chart.combos = combos;
    chart.birth_std = stdRep; chart.birth_std_approx = true; chart.month_k = k; chart.solar_shift_min = null;
  } else {
    const clock = mkSec(year, month, day, hour, minute ?? 0);
    const [std, fl] = clock_to_std(clock, dst_first);
    flags.push(...fl);
    if (std < SUPPORT_FROM) throw new Error('out_of_range');
    const [yi, mi, k] = ym_at(std);
    const prevT = jie_state(std)[0]; const nxtT = next_jie(std)[0];
    if (Math.min(std - prevT, nxtT - std) <= MARGIN_MIN * MIN) flags.push('near_jie_edge');
    let localMicro: number;                                  // 진태양시(또는 표준시) 마이크로초 — 파이썬 timedelta 와 같은 단위
    if (lon !== null) {
      const shift = solar_shift_minutes(std, lon);
      localMicro = std * 1e6 + Math.round(shift * 60e6);
      chart.solar_shift_min = Math.round(shift * 100) / 100;
      if (Math.floor(localMicro / (86400 * 1e6)) !== dayNum(std)) flags.push('date_shifted_by_solar_time');
      chart.local_solar = localMicro / 1e6;
    } else {
      localMicro = std * 1e6;
      chart.solar_shift_min = null;
      notes.push('출생지를 넣으면 진태양시로 시간을 더 정확히 봐요');
    }
    const ldn = Math.floor(localMicro / (86400 * 1e6));
    const inDay = localMicro - ldn * 86400 * 1e6;
    const minutes = Math.floor(inDay / 60e6);              // local.hour * 60 + local.minute
    const hb = mod(fdiv(minutes + 60, 120), 12);
    let d_idx = day_idx(ldn);
    let stem_base = d_idx;
    if (minutes >= 23 * 60) {
      if (zi_mode === 'yaja') { stem_base = d_idx + 1; flags.push('yaja_si'); }
      else { d_idx += 1; stem_base = d_idx; flags.push('jeong_jasi_next_day'); }
    }
    const hs = mod(((stem_base % 10) % 5) * 2 + hb, 10);
    chart.pillars = { year: yi, month: mi, day: d_idx, hour: ganji_idx(hs, hb) };
    chart.combos = [{ year: gj(yi), month: gj(mi) }];
    chart.birth_std = std; chart.birth_std_approx = false; chart.month_k = k;
  }
  chart.birth_date = dn;
  const P = chart.pillars as Chart['pillars'];
  chart.pillar_list = {} as Chart['pillar_list'];
  for (const pos of POS_ORDER) (chart.pillar_list as Rec)[pos] = _pillar(P[pos]);
  const dstem = P.day % 10;
  chart.day_master = { stem: dstem, ko: STEMS[dstem], element: ELEMENTS[stem_el(dstem)], polarity: P.day % 2 === 0 ? '양' : '음' };
  return chart as Chart;
}

/** 서버가 알려 준 네 기둥 번호(0~59)로 원국을 세운다 — 내 것은 서버 계산을 그대로 받을 때(생년월일 원값 없이). 시주 없으면 null */
export function chart_from_pillars(p: { year: number; month: number; day: number; hour?: number | null }, gender?: Gender | null): Chart {
  const pillars = { year: p.year, month: p.month, day: p.day, hour: p.hour ?? null };
  const pl: Rec = {};
  for (const pos of POS_ORDER) pl[pos] = _pillar(pillars[pos]);
  const dstem = pillars.day % 10;
  return {
    input: {}, flags: pillars.hour === null ? ['hour_unknown'] : [], notes: [], gender: gender ?? null, zi_mode: 'yaja', pillars,
    combos: [{ year: gj(pillars.year), month: gj(pillars.month) }], birth_std: 0, birth_std_approx: true, month_k: 0, solar_shift_min: null, birth_date: 0,
    pillar_list: pl as Chart['pillar_list'], day_master: { stem: dstem, ko: STEMS[dstem], element: ELEMENTS[stem_el(dstem)], polarity: pillars.day % 2 === 0 ? '양' : '음' },
  };
}

export interface Sinsal { code: string; name: string; hint: string; where: Pos }
export function sinsal(chart: Chart): Sinsal[] {
  const P = chart.pillars; const ds = P.day % 10; const out: Sinsal[] = [];
  const add = (code: string, where: Pos): void => { const [name, hint] = SINSAL_NEUTRAL[code]; out.push({ code, name, hint, where }); };
  for (const pos of POS_ORDER) {
    const v = P[pos]; if (v === null) continue;
    const b = v % 12;
    if (CHEON_EUL[ds].includes(b)) add('cheon_eul', pos);
    if (b === MUNCHANG[ds]) add('munchang', pos);
    if (ds in YANGIN && b === YANGIN[ds]) add('yangin', pos);
  }
  for (const base of ['year', 'day'] as const) {
    const bb = (P[base] as number) % 12;
    for (const pos of POS_ORDER) {
      const v = P[pos]; if (v === null || pos === base) continue;
      const b = v % 12;
      for (const [code, table] of [['dohwa', DOHWA_OF_TRIAD], ['yeokma', YEOKMA_OF_TRIAD], ['hwagae', HWAGAE_OF_TRIAD]] as const) {
        if (b === table[bb] && !out.some((o) => o.code === code && o.where === pos)) add(code, pos);
      }
    }
  }
  if (BAEKHO.has(P.day)) add('baekho', 'day');
  if (GOEGANG.has(P.day)) add('goegang', 'day');
  const dayb = P.day % 12;
  for (const pos of POS_ORDER) {
    const v = P[pos]; if (v === null || pos === 'day') continue;
    const pair = pk(dayb, v % 12);
    if (WONJIN.has(pair)) add('wonjin', pos);
    if (GWIMUN.has(pair)) add('gwimun', pos);
  }
  const gm = gongmang_branches(P.day);
  for (const pos of POS_ORDER) {
    const v = P[pos]; if (v === null || pos === 'day') continue;
    if (gm.includes(v % 12)) add('gongmang', pos);
  }
  return out;
}
export function samjae_for_year(chart: Chart, year: number): number | null {
  const yb = chart.pillars.year % 12; const yrBranch = mod(year - 4, 12);
  const i = SAMJAE_YEARS[yb].indexOf(yrBranch);
  return i >= 0 ? i : null;
}

export function element_counts(chart: Chart): { counts: Record<string, number>; chars: number; lacking: string[]; abundant: string[] } {
  const cnt = [0, 0, 0, 0, 0];
  for (const pos of POS_ORDER) {
    const i = chart.pillars[pos]; if (i === null) continue;
    cnt[stem_el(i % 10)] += 1; cnt[BRANCH_ELEMENT[i % 12]] += 1;
  }
  const counts: Record<string, number> = {};
  for (let e = 0; e < 5; e++) counts[ELEMENTS[e]] = cnt[e];
  return { counts, chars: cnt.reduce((a, b) => a + b, 0), lacking: ELEMENTS.filter((_, e) => cnt[e] === 0), abundant: ELEMENTS.filter((_, e) => cnt[e] >= 3) };
}
export function sipsung_list(chart: Chart): Array<{ pos: string; name: string }> {
  const ds = chart.pillars.day % 10; const out: Array<{ pos: string; name: string }> = [];
  for (const pos of POS_ORDER) {
    const i = chart.pillars[pos]; if (i === null) continue;
    if (pos !== 'day') out.push({ pos: POS_KO[pos] + '간', name: sipsung(ds, i % 10) });
    out.push({ pos: POS_KO[pos] + '지', name: sipsung_branch(ds, i % 12) });
  }
  return out;
}
export function chart_relations(chart: Chart): Rec[] {
  const out: Rec[] = [];
  const list = POS_ORDER.filter((p) => chart.pillars[p] !== null);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]; const b = list[j];
      const ia = chart.pillars[a] as number; const ib = chart.pillars[b] as number;
      for (const [code, el] of stem_relations(ia % 10, ib % 10)) out.push({ scope: 'stem', a: POS_KO[a] + '간', b: POS_KO[b] + '간', code, label: REL_LABEL[code], element: el });
      for (const [code, el] of branch_relations(ia % 12, ib % 12)) {
        if (code === 'branch_same') continue;
        out.push({ scope: 'branch', a: POS_KO[a] + '지', b: POS_KO[b] + '지', code, label: REL_LABEL[code], element: el });
      }
    }
  }
  for (const el of full_triads(list.map((p) => (chart.pillars[p] as number) % 12))) out.push({ scope: 'branch', a: '원국', b: '원국', code: 'branch_triad_full', label: REL_LABEL.branch_triad_full, element: el });
  return out;
}

// ---------------------------------------------------------------- 운 (대운 · 세운 · 월운 · 일진)
function add_months(t: Sec, months: number): Sec {
  const p = partsOf(t);
  const y = p.y + fdiv(p.m - 1 + months, 12);
  const m = mod(p.m - 1 + months, 12) + 1;
  const d = Math.min(p.d, monthLen(y, m));
  return mkSec(y, m, d, p.h, p.mi, p.s);
}
export function luck_facts(chart: Chart, stem: number, branch: number): Rec {
  const ds = chart.pillars.day % 10; const rel: Rec[] = [];
  for (const pos of POS_ORDER) {
    const i = chart.pillars[pos]; if (i === null) continue;
    for (const [code, el] of stem_relations(stem, i % 10)) rel.push({ with: POS_KO[pos] + '간', code, label: REL_LABEL[code], element: el });
    for (const [code, el] of branch_relations(branch, i % 12)) {
      if (code === 'branch_same') continue;
      rel.push({ with: POS_KO[pos] + '지', code, label: REL_LABEL[code], element: el });
    }
  }
  const have = POS_ORDER.map((p) => chart.pillars[p]).filter((v): v is number => v !== null).map((v) => v % 12);
  const allb = [...have, branch];
  for (const el of full_triads(allb)) if (!full_triads(have).includes(el)) rel.push({ with: '원국', code: 'branch_triad_full', label: REL_LABEL.branch_triad_full, element: el });
  const ec = element_counts(chart).counts;
  const fills = [...new Set([ELEMENTS[stem_el(stem)], ELEMENTS[BRANCH_ELEMENT[branch]]])].filter((e) => ec[e] === 0).sort();
  return {
    stem_sipsung: sipsung(ds, stem), branch_sipsung: sipsung_branch(ds, branch),
    stem_element: ELEMENTS[stem_el(stem)], branch_element: ELEMENTS[BRANCH_ELEMENT[branch]],
    stage: STAGE_NEUTRAL[twelve_stage(ds, branch)], relations: rel, fills_lacking: fills,
  };
}
export function daewoon(chart: Chart, n = 9): Rec | null {
  const g = chart.gender;
  if (g !== 'M' && g !== 'F') return null;
  const P = chart.pillars; const yang = (P.year % 10) % 2 === 0;
  const forward = (yang && g === 'M') || (!yang && g === 'F');
  const birth = chart.birth_std;
  const tJie = forward ? next_jie(birth)[0] : jie_state(birth)[0];
  const days = Math.abs(tJie - birth) / 86400.0;
  const months_total = Math.floor((days / 3.0) * 12 + 0.5);
  const ys = fdiv(months_total, 12); const ms = months_total % 12;
  const start_dt = add_months(birth, months_total);
  const step = forward ? 1 : -1;
  const items: Rec[] = [];
  for (let i = 0; i < n; i++) {
    const idx = mod(P.month + step * (i + 1), 60);
    const a0 = months_total + 120 * i;
    const s0 = add_months(birth, a0); const s1 = add_months(birth, a0 + 120);
    items.push({ order: i + 1, ganji: gj(idx), idx, start_age_years: fdiv(a0, 12), start_age_months: a0 % 12, start_date: isoDate(dayNum(s0)), end_date: isoDate(dayNum(s1)), ...luck_facts(chart, idx % 10, idx % 12) });
  }
  return {
    direction: forward ? '순행' : '역행', forward, year_polarity: yang ? '양' : '음',
    days_to_jie: Math.round(days * 1e4) / 1e4, daewoon_su: Math.floor(days / 3.0 + 0.5),
    start_age: { years: ys, months: ms }, start_date: isoDate(dayNum(start_dt)),
    approx: !!chart.birth_std_approx, items,
  };
}
export function current_daewoon(chart: Chart, whenDn: number): Rec | null {
  const dw = daewoon(chart); if (dw === null) return null;
  let cur: Rec | null = null;
  const when = isoDate(whenDn);
  for (const it of dw.items as Rec[]) if (it.start_date <= when) cur = it;
  return cur;
}
export function seun(chart: Chart, year: number): Rec {
  const idx = year_pillar_idx(year);
  let lichun = 0;
  for (let i = 0; i < JIE_T.length; i++) if (JIE_K[i] === 0 && partsOf(JIE_T[i]).y === year) { lichun = JIE_T[i]; break; }
  return { year, ganji: gj(idx), idx, starts: isoMinute(lichun), samjae_step: samjae_for_year(chart, year), ...luck_facts(chart, idx % 10, idx % 12) };
}
export function wolun(chart: Chart, year: number): Rec[] {
  const yi = year_pillar_idx(year); const out: Rec[] = [];
  const rows: Array<[Sec, number]> = [];
  for (let i = 0; i < JIE_T.length; i++) if (JIE_YS[i] === year) rows.push([JIE_T[i], JIE_K[i]]);
  rows.sort((a, b) => a[0] - b[0]);
  for (const [t, k] of rows) {
    const idx = month_pillar_idx(yi, k);
    out.push({ month_k: k, ganji: gj(idx), idx, starts: isoMinute(t), ...luck_facts(chart, idx % 10, idx % 12) });
  }
  return out;
}
export function wolun_at(chart: Chart, whenDn: number): Rec {
  const [std] = clock_to_std(whenDn * 86400 + 12 * HOUR);
  const [, mi, k, ys] = ym_at(std);
  return { ganji: gj(mi), idx: mi, saju_year: ys, month_k: k, ...luck_facts(chart, mi % 10, mi % 12) };
}
export function iljin(chart: Chart, whenDn: number): Rec {
  const idx = day_idx(whenDn);
  return { date: isoDate(whenDn), ganji: gj(idx), idx, ...luck_facts(chart, idx % 10, idx % 12) };
}

// ---------------------------------------------------------------- 택일 (건제 12신 하나 · 점수 0)
export const OFFICERS = ['건', '제', '만', '평', '정', '집', '파', '위', '성', '수', '개', '폐'] as const;
export const PURPOSES: Readonly<Record<string, readonly [string, ReadonlySet<string>]>> = {
  wedding: ['결혼식', new Set(['평', '정', '성'])],
  moving: ['이사 · 입주', new Set(['만', '정', '성', '개'])],
  business: ['개업 · 계약', new Set(['만', '정', '집', '성', '개', '수'])],
  travel: ['여행 · 출발', new Set(['건', '성', '개'])],
  new_start: ['새 시작(입학 · 새 일)', new Set(['건', '정', '성', '수', '개'])],
  cleanup: ['정리 · 청소', new Set(['제', '파'])],
  important_talk: ['중요한 대화', new Set(['평', '정', '성', '수'])],   // 가안(calc5.py 와 같음) — 역술 자문 검수 전
};
const REST_OFFICERS = new Set(['위', '폐', '파']);
export const OFFICER_LABEL: Readonly<Record<string, string>> = { good: '좋아요', neutral: '무난해요', rest: '쉬어 가는 날' };
export const WEEKDAYS_KO = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
/** 요일(월 = 0) — 1970-01-01 은 목요일 */
export const weekday_idx = (dn: number): number => mod(dn + 3, 7);

export function officer_of(dn: number): string {
  const end = dn * 86400 + 23 * HOUR + 59 * MIN;
  const inDst = DST_STD.some(([s, e]) => dayNum(s) <= dn && dn <= dayNum(e));
  const stdEnd = inDst ? end - HOUR : clock_to_std(end)[0];
  const k = jie_state(stdEnd)[1];
  const monthBranch = mod(2 + k, 12);
  return OFFICERS[mod(mod(day_idx(dn), 12) - monthBranch, 12)];
}
export function taekil(startDn: number, endDn: number, purpose: string, chart: Chart | null = null): Rec[] {
  if (!(purpose in PURPOSES)) throw new Error('unknown_purpose');
  const good = PURPOSES[purpose][1]; const out: Rec[] = [];
  for (let d = startDn; d <= endDn; d++) {
    const off = officer_of(d);
    let tone = 'neutral';
    if (good.has(off)) tone = 'good';
    else if (REST_OFFICERS.has(off) && purpose !== 'cleanup') tone = 'rest';
    const row: Rec = { date: isoDate(d), weekday: WEEKDAYS_KO[weekday_idx(d)], ganji: gj(day_idx(d)), officer: off, tone, label: OFFICER_LABEL[tone] };
    if (chart !== null) {
      const db = day_idx(d) % 12;
      const hit = POS_ORDER.filter((p) => chart.pillars[p] !== null && BRANCH_CLASH.has(pk(db, (chart.pillars[p] as number) % 12))).map((p) => POS_KO[p] + '지');
      row.clash_with_me = hit;
      if (hit.length && tone === 'good') { row.tone = 'neutral'; row.label = OFFICER_LABEL.neutral; row.note = '내 기운과 마주 보는 날이라 한 단계 낮춰요'; }
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------- 두 사람 궁합 (점수 없음 · 이름 없음)
export function compat(a: Chart, b: Chart): Rec {
  const PA = a.pillars; const PB = b.pillars;
  const da = PA.day % 10; const db = PB.day % 10; const tags: string[] = [];
  const el_rel: Record<number, string> = { 0: '같은 오행', 1: '내가 길러 주는 쪽', 4: '나를 길러 주는 쪽', 2: '내가 다루는 쪽', 3: '나를 다듬어 주는 쪽' };
  const de = mod(stem_el(db) - stem_el(da), 5);
  const day_master = {
    a_to_b_sipsung: sipsung(da, db), b_to_a_sipsung: sipsung(db, da),
    a_element: ELEMENTS[stem_el(da)], b_element: ELEMENTS[stem_el(db)], relation_for_a: el_rel[de],
    stem_relations: stem_relations(da, db).map(([c, el]) => ({ code: c, label: REL_LABEL[c], element: el })),
  };
  for (const [c] of stem_relations(da, db)) tags.push('day_stem_' + c);
  const cross: Rec[] = [];
  for (const pa of POS_ORDER) {
    for (const pb of POS_ORDER) {
      const ia = PA[pa]; const ib = PB[pb];
      if (ia === null || ib === null) continue;
      for (const [code, el] of stem_relations(ia % 10, ib % 10)) if (!(pa === 'day' && pb === 'day')) cross.push({ a: POS_KO[pa] + '간', b: POS_KO[pb] + '간', code, label: REL_LABEL[code], element: el });
      for (const [code, el] of branch_relations(ia % 12, ib % 12)) {
        if (code === 'branch_same') continue;
        cross.push({ a: POS_KO[pa] + '지', b: POS_KO[pb] + '지', code, label: REL_LABEL[code], element: el });
      }
    }
  }
  const rels = (x: number, y: number): Rec[] => branch_relations(x, y).filter(([c]) => c !== 'branch_same').map(([c, el]) => ({ code: c, label: REL_LABEL[c], element: el }));
  const day_branch = rels(PA.day % 12, PB.day % 12);
  const year_branch = rels(PA.year % 12, PB.year % 12);
  for (const r of day_branch) tags.push('day_branch_' + r.code);
  for (const r of year_branch) tags.push('year_branch_' + r.code);
  const ea = element_counts(a).counts; const eb = element_counts(b).counts;
  const comp_a = ELEMENTS.filter((e) => ea[e] === 0 && eb[e] >= 2);
  const comp_b = ELEMENTS.filter((e) => eb[e] === 0 && ea[e] >= 2);
  const shared_lack = ELEMENTS.filter((e) => ea[e] === 0 && eb[e] === 0);
  const shared_rich = ELEMENTS.filter((e) => ea[e] >= 3 && eb[e] >= 3);
  for (const e of comp_a) tags.push('a_fills_' + e);
  for (const e of comp_b) tags.push('b_fills_' + e);
  const bs = (P: Chart['pillars']): number[] => POS_ORDER.map((p) => P[p]).filter((v): v is number => v !== null).map((v) => v % 12);
  const tri_together = full_triads([...bs(PA), ...bs(PB)]).filter((el) => !full_triads(bs(PA)).includes(el) && !full_triads(bs(PB)).includes(el));
  for (const el of tri_together) tags.push('triad_together_' + el);
  return {
    day_master, day_branch, year_branch, cross,
    elements: { a: ea, b: eb, a_gets_from_b: comp_a, b_gets_from_a: comp_b, both_lack: shared_lack, both_abundant: shared_rich },
    triad_together: tri_together, partial: PA.hour === null || PB.hour === null, tags: [...new Set(tags)].sort(),
  };
}

// ---------------------------------------------------------------- AI 에 넘길 사실 묶음 (중립 이름만 · 이름 · 생년월일 원값 0)
function _strip(d: unknown): unknown {
  if (Array.isArray(d)) return d.map(_strip);
  if (d !== null && typeof d === 'object') {
    const o: Rec = {};
    for (const [k, v] of Object.entries(d as Rec)) if (k !== 'code' && k !== 'idx' && k !== 'date_exact' && k !== 'start_date' && k !== 'end_date') o[k] = _strip(v);
    return o;
  }
  return d;
}
export function chart_public(chart: Chart): Rec {
  return {
    pillars: POS_ORDER.filter((p) => chart.pillar_list[p] !== null).map((p) => ({ pos: POS_KO[p] + '주', ganji: (chart.pillar_list[p] as { ko: string }).ko })),
    hour_known: chart.pillars.hour !== null,
    day_master: { ganji_stem: chart.day_master.ko, element: chart.day_master.element, polarity: chart.day_master.polarity },
    elements: element_counts(chart), sipsung: sipsung_list(chart),
    relations: chart_relations(chart).map((r) => { const { code: _c, ...rest } = r; return rest; }),
    sinsal: sinsal(chart).map((s) => ({ name: s.name, where: POS_KO[s.where] + '주', hint: s.hint })),
    two_possibilities: chart.combos.length > 1 ? chart.combos : null,
  };
}
export function facts_reading(chart: Chart): Rec { return _strip({ kind: 'reading', ...chart_public(chart) }) as Rec; }
/** 상대 쪽을 간지 없이 줄인 꼴: 일간의 오행 · 음양, 시각을 아는지만 */
function _partner_minimal(chart: Chart): Rec {
  return { hour_known: chart.pillars.hour !== null, day_master: { element: chart.day_master.element, polarity: chart.day_master.polarity } };
}
/** 궁합 사실. 단계 0 = 간지 포함(데모 · 내 쪽 기기 화면용 — AI 로 보내지 않는다) · 1 · 2 · 3 = 상대를 줄여 보낸 꼴.
 *  AI 로 보내는 길은 partner5.ts 의 `compat_facts_for_ai` 만 쓴다(단계 2 고정). */
export function facts_compat(a: Chart, b: Chart, partner_level: 0 | 1 | 2 | 3 = 2): Rec {
  const level = partner_level;
  const c = compat(a, b);
  if (level === 0) {
    const { tags, ...body } = c;
    return _strip({ kind: 'compat', a: chart_public(a), b: chart_public(b), ...body, tags, partner_minimal: false, partner_level: 0 }) as Rec;
  }
  const el = c.elements;
  const body: Rec = { day_master: c.day_master, day_branch: c.day_branch };
  let tags: string[] = (c.tags as string[]).filter((t) => t.startsWith('day_stem_') || t.startsWith('day_branch_'));
  if (level <= 2) {
    body.elements = { a_gets_from_b: el.a_gets_from_b, b_gets_from_a: el.b_gets_from_a };
    tags = [...tags, ...(c.tags as string[]).filter((t) => t.startsWith('a_fills_') || t.startsWith('b_fills_'))];
    body.partial = c.partial;
  }
  if (level <= 1) {
    body.year_branch = c.year_branch;
    body.triad_together = c.triad_together;
    body.elements = { a: el.a, a_gets_from_b: el.a_gets_from_b, b_gets_from_a: el.b_gets_from_a, both_lack: el.both_lack, both_abundant: el.both_abundant };
    tags = c.tags as string[];
  }
  return _strip({ kind: 'compat', a: chart_public(a), b: _partner_minimal(b), ...body, tags: [...new Set(tags)].sort(), partner_minimal: true, partner_level: level }) as Rec;
}
