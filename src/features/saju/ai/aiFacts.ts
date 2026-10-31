// AI 맞춤으로 보내는 사실 묶음 만들기(IF5-F2 ⑩ · 설계안 A-2 ~ A-4 · S-3 · 법무 4-18). 쓰는 재료는 서버 읽기 응답(get_my_saju · get_my_luck · get_taekil)과 saju5 계산 모듈뿐 — 생년월일 원값은 앱에 없다.
//  · 내 쪽: 간지 · 십성 · 오행 같은 사실 묶음(회원 식별값 0 · 날짜 0). **대운 날짜(start_date · end_date) 전송 0**: 대운 사실은 나이(년 · 개월)와 순서만 싣는다 — 응답에서 날짜는 지금 대운을 고르는 데만 쓰고 버린다
//  · 상대 쪽: 간지 없는 2단계(partnerLocal.partnerAiFacts — 일간의 오행 · 음양 + 시각을 아는지). 상대 생일 · 기둥 · 간지 전송 0
//  · 관계 말(label)은 이 사실에 내부 말로 들어가고, **업체 요청을 만드는 순간 서버가 화면 말로 바꾼다**(ai_facts5.screenRelationLabels — 보내는 쪽 치환). 이 파일은 글을 만들지 않는다
//  · code · idx · 날짜 꼴 칸은 strip 으로 걷는다(서버 guardFacts 가 한 번 더 막는다)
import { SINSAL_NEUTRAL, chart_public, facts_reading, gj, luck_facts, PURPOSES } from '@/saju5/saju_calc5';
import type { Chart, Rec } from '@/saju5/saju_calc5';

import type { LuckItem, Taekil } from '../sajuApi';
import { idx60, type ReadyLuck } from '../sajuLogic';

const DROP = new Set(['code', 'idx', 'date_exact', 'start_date', 'end_date']);
/** 코드 · 번호 · 날짜 칸을 깊이 걷어낸 사본 */
export function strip<T>(v: T): T {
  if (Array.isArray(v)) return v.map(strip) as T;
  if (v !== null && typeof v === 'object') {
    const o: Rec = {};
    for (const [k, x] of Object.entries(v as Rec)) if (!DROP.has(k)) o[k] = strip(x);
    return o as T;
  }
  return v;
}

/** 풀이(F5-02 ~ 04): 원국 사실 하나 */
export const readingFacts = (chart: Chart): Rec => facts_reading(chart);

/** 지금 대운 번호: 시작일이 오늘 이전인 것 가운데 마지막 (날짜는 여기서만 쓰고 사실에는 싣지 않는다) */
export function currentDaewoonIndex(items: readonly LuckItem[], todayIso: string): number {
  let cur = -1;
  items.forEach((it, i) => {
    if (it.startDate !== null && it.startDate <= todayIso) cur = i;
  });
  return cur;
}

/** 대운(F5-05): 지금 대운 앞 1 · 뒤 2 만(없으면 처음 3). 성별을 안 쓰는 분(대운 칸 없음)이면 null */
export function daewoonFacts(chart: Chart, luck: ReadyLuck, todayIso: string): Rec | null {
  const dw = luck.daewoon;
  if (!dw || dw.items.length === 0) return null;
  const ci = currentDaewoonIndex(dw.items, todayIso);
  const lo = ci >= 0 ? Math.max(0, ci - 1) : 0;
  const hi = ci >= 0 ? ci + 3 : 3;
  const rows = dw.items.map((it, i) => {
    const idx = idx60(it.stem, it.branch);
    return idx < 0 ? null : { order: i + 1, ganji: gj(idx), start_age_years: it.startAgeYears, start_age_months: it.startAgeMonths, ...luck_facts(chart, it.stem, it.branch) };
  });
  if (rows.some((r) => r === null)) return null;
  const items = rows as Rec[];
  const first = dw.items[0];
  return strip({
    kind: 'daewoon',
    chart: chart_public(chart),
    direction: dw.forward ? '순행' : '역행',
    start_age: { years: first.startAgeYears ?? 0, months: first.startAgeMonths ?? 0 },
    approx: dw.approx,
    current: ci >= 0 ? items[ci] : null,
    items: items.slice(lo, hi),
    total_periods: items.length,
  });
}

const seunRow = (chart: Chart, s: NonNullable<ReadyLuck['seun']>): Rec => ({ year: s.year, ganji: gj(idx60(s.stem, s.branch)), starts: s.starts, ...luck_facts(chart, s.stem, s.branch) });
const restPeriod = (sam: number | null | undefined): Rec | null => {
  if (sam === null || sam === undefined) return null;
  const [name, hint] = SINSAL_NEUTRAL.samjae;
  return { name, hint, step_of_three: sam + 1 };
};

/** 올해(F5-06): 세운 + 열두 달 */
export function sinyeonFacts(chart: Chart, luck: ReadyLuck): Rec | null {
  if (!luck.seun || luck.wolun.length === 0 || luck.wolun.some((w) => idx60(w.stem, w.branch) < 0)) return null;
  return strip({
    kind: 'sinyeon',
    year: luck.seun.year,
    chart: chart_public(chart),
    seun: seunRow(chart, luck.seun),
    rest_period: restPeriod(luck.seun.sam),
    wolun: luck.wolun.map((w) => ({ month_k: w.monthK, ganji: gj(idx60(w.stem, w.branch)), starts: w.starts, ...luck_facts(chart, w.stem, w.branch) })),
  });
}

/** 사주 이야기(F5-17) 시작 사실: 원국 + 올해 세운 + (대운 칸이 있으면) 지금 대운 */
export function chatFacts(chart: Chart, luck: ReadyLuck | null, todayIso: string): Rec | null {
  const year = Number(todayIso.slice(0, 4));
  const seun = luck?.seun && luck.seun.year === year ? seunRow(chart, luck.seun) : null;
  const dw = luck ? daewoonFacts(chart, luck, todayIso) : null;
  return strip({ kind: 'chat', year, chart: chart_public(chart), seun, rest_period: restPeriod(luck?.seun?.sam), now_daewoon: dw ? (dw.current ?? null) : null });
}

/** 날짜 고르기 설명(F5-09): 고른 용도 + 기간의 날짜별 사실(점수 0) — 공개 달력 날짜뿐 */
export function taekilFacts(purpose: string, t: Taekil): Rec | null {
  const p = PURPOSES[purpose];
  if (!p || t.days.length === 0) return null;
  const rows = t.days.map((d) => {
    const idx = d.stem !== null && d.branch !== null ? idx60(d.stem, d.branch) : -1;
    return { date: d.date, weekday: d.weekday, ...(idx >= 0 ? { ganji: gj(idx) } : {}), officer: d.officer, tone: d.tone, label: d.label };
  });
  const days = rows.length <= 31 ? rows : rows.filter((r) => r.tone !== 'neutral').slice(0, 62);
  return strip({ kind: 'taekil', purpose: p[0], days, has_chart: false });
}
