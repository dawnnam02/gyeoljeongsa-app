// 사주 마당 규칙(순수 함수 · IF5-F1). 계산 모듈 = src/saju5(ai/IF5/ts 사본 — scripts/sync-if5.mjs), 미리 쓴 글 = saju5/fragments5 + data/fragments5.json(판 2026-10-31.3).
//  · 내 기둥은 서버(get_my_saju)가 준 번호로만 세운다(chart_from_pillars) — 생년월일 원값은 앱에 없다. 데모 모드 모의 서버만 기기 계산(demo/sajuDemo)
//  · 점수 · 퍼센트 · 판정 · 순위 · 숫자 막대 0. 오행은 막대 길이만(숫자 라벨 0). 한자 0(한글 간지)
//  · 글은 조각 표(검사기 check_text5 통과 · 관계 말 '부딪히기 쉬운 결' · '엇갈리기 쉬운 결') + 카피 24장 틀. 이 파일은 화면 글을 쓰지 않는다
import { BIRTH_PLACES, BRANCHES, BRANCH_ELEMENT, ELEMENTS, STAGE_NEUTRAL, STEMS, chart_from_pillars, current_daewoon, dayNumOf, day_idx, element_counts, gj, isoDate, jie_state, luck_facts, sinsal, sipsung, twelve_stage, clock_to_std } from '@/saju5/saju_calc5';
import type { Chart, Rec } from '@/saju5/saju_calc5';
import { pickCard, quarterTones, type Card5, type PickInput } from '@/saju5/fragments5';
import { NAMES5 } from '@/saju5/names5';
import { hiddenStemSipsung } from '@/saju5/jijanggan5';
import { LunarError, solarToLunar } from '@/saju5/lunar5';

import { IF5_TEXT, type If5Key } from '@/content/if5Copy';
import type { LuckItem, MyChart, MyDay, MyLuck, Pair } from './sajuApi';

export type ReadyChart = Extract<MyChart, { state: 'ready' }>;
export type ReadyLuck = Extract<MyLuck, { state: 'ready' }>;

// ── 기둥 번호 ────────────────────────────────────────────────────────────────
/** 천간 0~9 · 지지 0~11 → 60갑자 번호(0~59). 짝이 맞지 않는 조합(양 · 음이 다름)은 -1 */
export function idx60(stem: number, branch: number): number {
  for (let i = 0; i < 60; i += 1) if (i % 10 === stem && i % 12 === branch) return i;
  return -1;
}
export const pairText = (p: Pair): string => `${STEMS[p.stem]}${BRANCHES[p.branch]}`;
export const stemEl = (s: number): string => ELEMENTS[Math.floor(s / 2)];
export const branchEl = (b: number): string => ELEMENTS[BRANCH_ELEMENT[b]];
/** 오행 한 글자 → 화면 이름(나무 · 불 · 흙 · 쇠 · 물) */
export const EL_PLAIN: Readonly<Record<string, string>> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };

/** 서버가 준 기둥 → saju5 원국. option = 입춘 · 절입 당일 · 시각 모름일 때 두 가지 중 몇 번째(0 · 1). 번호가 어긋나면 null */
export function chartOf(c: ReadyChart, option = 0): Chart | null {
  const o = c.options[Math.min(option, c.options.length - 1)];
  const year = idx60(o.year.stem, o.year.branch);
  const month = idx60(o.month.stem, o.month.branch);
  const day = idx60(c.day.stem, c.day.branch);
  const hour = c.hour ? idx60(c.hour.stem, c.hour.branch) : null;
  if (year < 0 || month < 0 || day < 0 || hour === -1) return null;
  const chart = chart_from_pillars({ year, month, day, hour }, null);
  if (c.options.length > 1) chart.combos = c.options.map((x) => ({ year: pairText(x.year), month: pairText(x.month) }));
  return chart;
}

// ── 네 기둥 표 ───────────────────────────────────────────────────────────────
export type PillarCell = { pos: 'year' | 'month' | 'day' | 'hour'; posName: string; stem: string; branch: string; stemEl: string; branchEl: string; alt: { stem: string; branch: string } | null } | null;
const POS_NAME = { year: IF5_TEXT['SAJU.pillars.col.year'], month: IF5_TEXT['SAJU.pillars.col.month'], day: IF5_TEXT['SAJU.pillars.col.day'], hour: IF5_TEXT['SAJU.pillars.col.hour'] } as const; // 카피 24-15-1 칸 이름(IF5-F1b)
export function pillarCells(c: ReadyChart): PillarCell[] {
  const first = c.options[0];
  const second = c.options[1];
  const mk = (pos: 'year' | 'month' | 'day' | 'hour', p: Pair | null, alt: Pair | null): PillarCell =>
    p ? { pos, posName: POS_NAME[pos], stem: STEMS[p.stem], branch: BRANCHES[p.branch], stemEl: EL_PLAIN[stemEl(p.stem)], branchEl: EL_PLAIN[branchEl(p.branch)], alt: alt && (alt.stem !== p.stem || alt.branch !== p.branch) ? { stem: STEMS[alt.stem], branch: BRANCHES[alt.branch] } : null } : null;
  return [mk('year', first.year, second?.year ?? null), mk('month', first.month, second?.month ?? null), mk('day', c.day, null), mk('hour', c.hour, null)];
}
/** 경계 날 두 가지가 어느 쪽에서 갈렸나('year' = 입춘 · 'month' = 절입일) */
export function cuspKind(c: ReadyChart): 'year' | 'month' | null {
  const [a, b] = c.options;
  if (!b) return null;
  return a.year.stem !== b.year.stem || a.year.branch !== b.year.branch ? 'year' : 'month';
}

// ── 오행 막대(길이만) ────────────────────────────────────────────────────────
export type ElementBar = { el: string; name: string; level: number }; // level 0 ~ 1 (막대 길이 비율 · 화면에 숫자로 내지 않는다)
export function elementBars(chart: Chart): { bars: ElementBar[]; lacking: string[] } {
  const e = element_counts(chart);
  const max = Math.max(1, ...ELEMENTS.map((x) => e.counts[x] ?? 0));
  return { bars: ELEMENTS.map((x) => ({ el: x, name: EL_PLAIN[x], level: (e.counts[x] ?? 0) / max })), lacking: e.lacking };
}
export const elementWord = (el: string): string => (NAMES5.elements as Record<string, { name: string }>)[el]?.name.replace(/ 기운$/, '') ?? EL_PLAIN[el] ?? el;

// ── 자세히 보기 표(관계의 결 · 기운의 단계) ──────────────────────────────────
export type TableRow = { pos: string; text: string };
export function tableRows(chart: Chart): { rel: TableRow[]; stage: TableRow[] } {
  const ds = chart.pillars.day % 10;
  const names = NAMES5.sipsung as { code: string; name: string }[];
  const nameOf = (code: string): string => names.find((n) => n.code === code)?.name ?? '';
  const rel: TableRow[] = [];
  const stage: TableRow[] = [];
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const idx = chart.pillars[pos];
    if (idx === null) continue;
    rel.push({ pos: POS_NAME[pos], text: pos === 'day' ? '나' : nameOf(sipsung(ds, idx % 10)) });
    stage.push({ pos: POS_NAME[pos], text: STAGE_NEUTRAL[twelve_stage(ds, idx % 12)] });
  }
  return { rel, stage };
}

/** 숨은 글자 줄(IF5-F1b ⓑ · 카피 `SAJU.table.row.hidden`): 기둥마다 지지가 품은 천간 + 내 날 기준 쉬운 이름. 통설 표 하나만(P0 가안) — 서적별 갈래 표는 화면에 0 · 이 파일은 갈래 함수를 부르지 않는다 */
export function hiddenRows(chart: Chart): TableRow[] {
  const ds = chart.pillars.day % 10;
  const names = NAMES5.sipsung as { code: string; name: string }[];
  const nameOf = (code: string): string => names.find((n) => n.code === code)?.name ?? '';
  const rows: TableRow[] = [];
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const idx = chart.pillars[pos];
    if (idx === null) continue;
    const text = hiddenStemSipsung(ds, idx % 12)
      .map((h) => `${h.name}(${nameOf(h.sipsung)})`)
      .join(', ');
    rows.push({ pos: POS_NAME[pos], text });
  }
  return rows;
}

// ── 별난 점 카드 ─────────────────────────────────────────────────────────────
export type TraitView = { code: string; title: string; text: string };
export function traitCards(chart: Chart): TraitView[] {
  const sin = NAMES5.sinsal as Record<string, { card_title: string; name: string }>;
  const out: TraitView[] = [];
  for (const s of sinsal(chart)) {
    const card = pickCard('F5-14', { variant: s.code });
    if (!card.one) continue;
    out.push({ code: s.code, title: sin[s.code]?.card_title ?? sin[s.code]?.name ?? '', text: card.one.text });
  }
  return out;
}

// ── 카드(한 문장 · 세 줄 · 펼침) ─────────────────────────────────────────────
export type CardView = { feature: string; one: string | null; day: string | null; three: string[]; more: string[]; row: string | null };
const view = (c: Card5): CardView => ({ feature: c.feature, one: c.one?.text ?? null, day: c.day_one?.text ?? null, three: c.three.map((p) => p.text), more: c.more.map((p) => p.text), row: c.row?.text ?? null });
export const hasText = (v: CardView): boolean => !!v.one || v.three.length > 0;
function safePick(feature: string, input: PickInput): CardView | null {
  try {
    const v = view(pickCard(feature, input));
    return hasText(v) ? v : null;
  } catch {
    return null; // 조각이 모자란 호는 카드째 빈다(틀린 글은 안 나감)
  }
}
export const readingCard = (chart: Chart): CardView | null => safePick('F5-02', { chart });
export const loveCard = (chart: Chart): CardView | null => safePick('F5-03', { chart });
export const workCard = (chart: Chart, chip: 'work' | 'money' | 'people' | 'rest'): CardView | null => safePick('F5-04', { chart, variant: chip });
export const pillarsCard = (chart: Chart): CardView | null => safePick('F5-01', { chart });
export const tableCard = (chart: Chart): CardView | null => safePick('F5-15', { chart });

const luckOf = (chart: Chart, it: { stem: number; branch: number }): Rec => luck_facts(chart, it.stem, it.branch);
/** 올해 흐름(F5-06) + 열두 달 한 줄(F5-13 — 한 장에 묶음) + 띠 한 줄(F5-18) */
export type YearView = { year: CardView | null; months: CardView | null; zodiac: CardView | null; best: string[]; rest: string[] }; // best · rest = 서버 월운의 절기 달 이름(인월 ~ 축월)
export function yearView(chart: Chart, luck: ReadyLuck): YearView | null {
  if (!luck.seun) return null;
  const seun = { ...luckOf(chart, luck.seun), samjae_step: luck.seun.sam };
  const tones = quarterTones(luck.wolun.map((w) => luckOf(chart, w)));
  const base: PickInput = { chart, luck: seun, topic: 'year', samjae_step: luck.seun.sam, quarter_tones: tones };
  const year = safePick('F5-06', base);
  const months = safePick('F5-13', base);
  const zodiac = safePick('F5-18', { chart, birth_branch: chart.pillars.year % 12, this_year_branch: luck.seun.branch });
  // 힘 내기 좋은 달 · 쉬어 가는 달: 월운 12개의 12운성 어조. 달 이름은 서버 get_my_luck 월운의 month_name(0050 · 인월 ~ 축월)을 그대로 쓴다
  const toneOf = (w: { stem: number; branch: number }): string => {
    const stage = String(luckOf(chart, w).stage);
    return ['쉬어 가는 때', '거두는 때', '갈무리하는 때', '비우는 때'].includes(stage) ? 'rest' : ['싹트는 때', '자라나는 때', '자리 잡는 때', '한창인 때'].includes(stage) ? 'up' : 'mid';
  };
  const best: string[] = [];
  const rest: string[] = [];
  luck.wolun.forEach((w) => {
    const t = toneOf(w);
    if (!w.monthName) return; // 서버가 달 이름(0050 month_name)을 안 주면 그 달은 목록에 넣지 않는다(절기 근사 0)
    if (t === 'up') best.push(w.monthName);
    else if (t === 'rest') rest.push(w.monthName);
  });
  if (!year && !months && !zodiac) return null;
  return { year, months, zodiac, best, rest }; // 월운은 입춘 ~ 다음 입춘 차례라 그대로 차례
}

export function monthView(chart: Chart, day: Extract<MyDay, { state: 'ready' }>, monthLuck: { stem: number; branch: number } | null): CardView | null {
  if (!monthLuck) return null;
  return safePick('F5-07', { chart, luck: luckOf(chart, monthLuck), topic: 'month' });
}
export function todayView(chart: Chart, day: Extract<MyDay, { state: 'ready' }>): CardView | null {
  if (day.stem === null || day.branch === null) return null;
  return safePick('F5-08', { chart, luck: luckOf(chart, { stem: day.stem, branch: day.branch }), topic: 'day' });
}

// ── 인생 계절표(대운 열 해) ──────────────────────────────────────────────────
export type SeasonRow = { index: number; ageFrom: number | null; ageTo: number | null; label: string | null; one: string | null; current: boolean };
export function seasonRows(chart: Chart, luck: ReadyLuck, todayIso: string): SeasonRow[] {
  const dw = luck.daewoon;
  if (!dw) return [];
  return dw.items.map((it, i) => {
    const card = safePick('F5-05', { chart, luck: luckOf(chart, it), topic: 'period' });
    const from = it.startDate ?? '';
    const to = it.endDate ?? '';
    return {
      index: i,
      ageFrom: it.startAgeYears,
      ageTo: it.startAgeYears === null ? null : it.startAgeYears + 10,
      label: card?.row ?? null,
      one: card?.one ?? null,
      current: !!from && !!to && from <= todayIso && todayIso < to,
    };
  });
}

/** 계절표 한 줄의 나이 구간 '{n}세 ~ {n}세'(카피 `SAJU.life.age` 틀 + 부호 '~' 는 앱이 잇는다) */
export function ageSpan(from: number | null, to: number | null): string {
  const one = (n: number | null): string => (n === null ? '' : IF5_TEXT['SAJU.life.age'].replace('{n}', String(n)));
  return `${one(from)} ~ ${one(to)}`;
}

// ── 날짜 · 달력 ──────────────────────────────────────────────────────────────
export const isoOf = (y: number, m: number, d: number): string => isoDate(dayNumOf(y, m, d));
export const dnOf = (iso: string): number => dayNumOf(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
export const SUPPORT_FROM_ISO = '1961-08-10';
export const SUPPORT_TO_ISO = '2050-12-31';
export const inSupport = (iso: string): boolean => iso >= SUPPORT_FROM_ISO && iso <= SUPPORT_TO_ISO;
export const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'] as const;
const WEEKDAY_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;
export const weekdayOf = (iso: string): (typeof WEEKDAY_FULL)[number] => WEEKDAY_FULL[new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay()];
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const addMonths = (y: number, m: number, delta: number): { y: number; m: number } => {
  const t = y * 12 + (m - 1) + delta;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
export type MonthCell = { iso: string; day: number; ganji: string; stem: number; branch: number; jeol: string | null; inRange: boolean } | null;
const JEOL_NAMES = ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'];
/** 그날에 12절입이 드는가(한국 표준시 하루 안에 절입이 있으면 그 절기 이름) */
export function jeolOn(iso: string): string | null {
  if (!inSupport(iso)) return null;
  const dn = dnOf(iso);
  const s0 = clock_to_std(dn * 86400)[0];
  const s1 = clock_to_std(dn * 86400 + 86399)[0];
  const [t0] = jie_state(s0);
  const [t1, k1] = jie_state(s1);
  return t1 !== t0 ? JEOL_NAMES[k1] ?? null : null;
}
/** 한 달 달력(일요일 시작 · 앞뒤 빈 칸은 null). 범위 밖 날짜 칸은 inRange false */
export function monthGrid(y: number, m: number): MonthCell[][] {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const n = daysInMonth(y, m);
  const cells: MonthCell[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= n; d += 1) {
    const iso = isoOf(y, m, d);
    const ok = inSupport(iso);
    const idx = ok ? day_idx(dnOf(iso)) : 0;
    cells.push({ iso, day: d, ganji: ok ? gj(idx) : '', stem: idx % 10, branch: idx % 12, jeol: ok ? jeolOn(iso) : null, inRange: ok });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
/** 날짜 하나의 글(F5-12): 절기가 든 날은 절기 글, 아니면 그날 글자의 바탕 글 */
export function calendarLine(iso: string): CardView | null {
  if (!inSupport(iso)) return null;
  const idx = day_idx(dnOf(iso));
  return safePick('F5-12', { jeolgi: jeolOn(iso) ?? undefined, day_element: ELEMENTS[Math.floor((idx % 10) / 2)] });
}
/** 음력 날짜(IF5-F1b ⓐ). 음양력 표 범위(1960-01-01 ~ 2051-12-31) 밖이면 null(줄을 숨긴다). 윤달은 달 번호 앞에 '윤'을 붙인다. 경계 달 단서(어느 절기 달인지 등)는 달지 않는다(팀장 정함) */
export function lunarOf(iso: string): { month: string; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    const l = solarToLunar(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
    return { month: `${l.leap ? '윤' : ''}${l.month}`, day: l.day };
  } catch (e) {
    if (e instanceof LunarError) return null;
    throw e;
  }
}
/** 홈 '오늘 하루' 띠의 한 줄: 모든 회원에게 같은 글 · 오늘 날짜의 바탕만(내 정보 0 · 서버 호출 0) */
export function todayBaseLine(iso: string): string | null {
  if (!inSupport(iso)) return null;
  const v = calendarLine(iso);
  if (!v) return null;
  return v.more.length > 0 ? v.more[v.more.length - 1] : v.one;
}

// ── 날짜 고르기(택일) 글 ─────────────────────────────────────────────────────
export const PURPOSE_KEYS = ['moving', 'business', 'new_start', 'important_talk', 'travel', 'wedding', 'cleanup'] as const;
/** 카피 24장 용도 칩 일곱(이사 · 개업 · 계약 · 면접 · 여행 · 중요한 대화 · 결혼식) ↔ 서버 목적 코드 */
export const USE_PURPOSE = ['moving', 'business', 'business', 'new_start', 'travel', 'important_talk', 'wedding'] as const;
export function pickDayCard(purpose: string, tone: string, officer: string, clash: boolean): CardView | null {
  return safePick('F5-09', { purpose, tone, officer_code: officer, clash });
}

// ── 태어난 곳 ────────────────────────────────────────────────────────────────
export const PLACE_IDS: readonly string[] = Object.keys(BIRTH_PLACES);
export const placeKey = (i: number): If5Key => `SAJU.input.place.p${String(i + 1).padStart(2, '0')}` as If5Key;

// ── 나이 · 날짜 검사 ─────────────────────────────────────────────────────────
export function ageOn(birthIso: string, todayIso: string): number {
  const by = Number(birthIso.slice(0, 4));
  const ty = Number(todayIso.slice(0, 4));
  return ty - by - (todayIso.slice(5) < birthIso.slice(5) ? 1 : 0);
}
export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
export const nowIso = (ms: number): string => {
  const t = new Date(ms + 9 * 3_600_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

export const currentSeason = (chart: Chart, luck: ReadyLuck, todayIso: string): LuckItem | null => {
  void chart;
  const dw = luck.daewoon;
  if (!dw) return null;
  let cur: LuckItem | null = null;
  for (const it of dw.items) if (it.startDate && it.startDate <= todayIso) cur = it;
  return cur;
};
export { current_daewoon };
