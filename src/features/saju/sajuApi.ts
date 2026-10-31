// 사주 마당이 서버와 주고받는 일(IF5-F1 · D-237). 서버 = backend/migrations/0048_mileage_saju.sql(앱 함수 · 응답 모양 = backend/R_변경기록.md 16-2 · 16-3).
//   get_my_saju(p_hour, p_minute, p_place)                → {ok, state ready, hour_known, day{stem,branch}, hour{stem,branch}|null, options[{year,month}] 한두 개, flags[]} | {ok, state none | out_of_range}
//   get_my_luck(p_hour, p_minute, p_place, p_year)        → {ok, state ready, daewoon{direction, daewoon_su, start_age{years,months}, approx, items[9]}|null, seun{…}, wolun[12]}
//   get_my_day(p_hour, p_minute, p_place, p_date)         → {ok, state ready, date, iljin{…}, wolun{…}, officer} | {ok, state out_of_range}
//   get_taekil(p_purpose, p_start, p_end, p_personal, p_hour, p_minute, p_place) → {ok, state ready, purpose, days[{date, weekday, stem, branch, officer, tone, label, clash_with_me?, lowered?}]}
//   오류: {ok:false, code consent_required | invalid_value | invalid_time | not_ready} · DB 오류 forbidden(42501) · feature_off(42501)
//  · 시각 · 곳은 기기에서 요청 인자로만 보낸다(서버 저장 0 · 로그 0). 생년월일 원값은 앱에 오지 않는다 — 서버가 기둥 번호(stem · branch)만 준다
//  · 상대 생일은 이 파일에 오지 않는다(상대는 늘 기기 계산 — partnerLocal.ts · 서버 전송 0)
//  · 앱 자동 재시도 0(IFF5-06). 로그에는 이벤트 이름과 코드만(입력 값 0 — IFF5-24)
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

import type { RpcCall } from '@/features/inflight/inflightApi';

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** 화면이 가르는 오류 일곱 — 서버 코드 4(consent_required · invalid_value · invalid_time · not_ready) + 스위치 꺼짐 + 로그인 · 계정 + 끊김. 그 밖은 not_ready 로 묶는다 */
export const SAJU_FAIL_CODES = ['consent_required', 'invalid_value', 'invalid_time', 'not_ready', 'feature_off', 'forbidden', 'network'] as const;
export type SajuFailCode = (typeof SAJU_FAIL_CODES)[number];
export type SajuFail = { ok: false; code: SajuFailCode };
export type SajuResult<T> = { ok: true; data: T } | SajuFail;

/** 내 시각 · 곳 (기기에서 가져와 요청 인자로만 보낸다) */
export type MyInput = { hour: number | null; minute: number | null; place: string | null };

/** 기둥 하나: 천간 0~9 · 지지 0~11 (서버가 60갑자 번호에서 나눈 나머지) */
export type Pair = { stem: number; branch: number };
export type MyChart =
  | { state: 'ready'; hourKnown: boolean; day: Pair; hour: Pair | null; options: { year: Pair; month: Pair }[]; flags: string[] }
  | { state: 'none' | 'out_of_range' };

export type LuckItem = { stem: number; branch: number; startAgeYears: number | null; startAgeMonths: number | null; startDate: string | null; endDate: string | null };
export type MyLuck =
  | { state: 'ready'; daewoon: { forward: boolean; items: LuckItem[]; approx: boolean } | null; seun: { year: number; stem: number; branch: number; sam: number | null } | null; wolun: { monthK: number; stem: number; branch: number }[] }
  | { state: 'none' | 'out_of_range' };
export type MyDay =
  | { state: 'ready'; date: string; stem: number | null; branch: number | null; month: { stem: number; branch: number } | null; officer: string | null }
  | { state: 'none' | 'out_of_range' };

export type TaekilDay = { date: string; weekday: string; stem: number | null; branch: number | null; officer: string; tone: 'good' | 'neutral' | 'rest'; label: string; lowered: boolean; clash: boolean };
export type Taekil = { purpose: string; days: TaekilDay[] };
export type TaekilArgs = { purpose: string; start: string; end: string; personal: boolean } & MyInput;

export const PURPOSES = ['moving', 'business', 'new_start', 'important_talk', 'travel', 'wedding', 'cleanup'] as const;

const pairOf = (v: unknown): Pair | null => {
  if (!isRecord(v)) return null;
  const stem = int(v.stem);
  const branch = int(v.branch);
  return stem !== null && branch !== null && stem >= 0 && stem <= 9 && branch >= 0 && branch <= 11 ? { stem, branch } : null;
};

export function parseMyChart(raw: unknown): MyChart | null {
  if (!isRecord(raw)) return null;
  if (raw.state === 'none' || raw.state === 'out_of_range') return { state: raw.state };
  const day = pairOf(raw.day);
  if (raw.state !== 'ready' || !day) return null;
  const options = arr(raw.options).flatMap((o) => {
    const y = isRecord(o) ? pairOf(o.year) : null;
    const m = isRecord(o) ? pairOf(o.month) : null;
    return y && m ? [{ year: y, month: m }] : [];
  });
  if (options.length === 0) return null;
  const hour = pairOf(raw.hour);
  return { state: 'ready', hourKnown: raw.hour_known === true && hour !== null, day, hour, options: options.slice(0, 2), flags: arr(raw.flags).filter((f): f is string => typeof f === 'string') };
}

export function parseMyLuck(raw: unknown): MyLuck | null {
  if (!isRecord(raw)) return null;
  if (raw.state === 'none' || raw.state === 'out_of_range') return { state: raw.state };
  if (raw.state !== 'ready') return null;
  let daewoon: Extract<MyLuck, { state: 'ready' }>['daewoon'] = null;
  if (isRecord(raw.daewoon)) {
    const items = arr(raw.daewoon.items).flatMap((it) => {
      if (!isRecord(it)) return [];
      const stem = int(it.stem);
      const branch = int(it.branch);
      if (stem === null || branch === null) return [];
      const age = isRecord(it.start_age) ? it.start_age : {};
      return [{ stem, branch, startAgeYears: int(it.start_age_years) ?? int(age.years), startAgeMonths: int(it.start_age_months) ?? int(age.months), startDate: str(it.start_date), endDate: str(it.end_date) }];
    });
    if (items.length > 0) daewoon = { forward: raw.daewoon.direction === '순행', items, approx: raw.daewoon.approx === true };
  }
  let seun: Extract<MyLuck, { state: 'ready' }>['seun'] = null;
  if (isRecord(raw.seun) && int(raw.seun.year) !== null && int(raw.seun.stem) !== null && int(raw.seun.branch) !== null) {
    seun = { year: int(raw.seun.year) as number, stem: int(raw.seun.stem) as number, branch: int(raw.seun.branch) as number, sam: int(raw.seun.samjae_step) };
  }
  const wolun = arr(raw.wolun).flatMap((w) => (isRecord(w) && int(w.month_k) !== null && int(w.stem) !== null && int(w.branch) !== null ? [{ monthK: int(w.month_k) as number, stem: int(w.stem) as number, branch: int(w.branch) as number }] : []));
  return { state: 'ready', daewoon, seun, wolun };
}

export function parseMyDay(raw: unknown): MyDay | null {
  if (!isRecord(raw)) return null;
  if (raw.state === 'none' || raw.state === 'out_of_range') return { state: raw.state };
  const date = str(raw.date);
  if (raw.state !== 'ready' || !date) return null;
  const il = isRecord(raw.iljin) ? raw.iljin : {};
  const wl = isRecord(raw.wolun) ? raw.wolun : {};
  const ms = int(wl.stem);
  const mb = int(wl.branch);
  return { state: 'ready', date, stem: int(il.stem), branch: int(il.branch), month: ms !== null && mb !== null ? { stem: ms, branch: mb } : null, officer: str(raw.officer) };
}

export function parseTaekil(raw: unknown): Taekil | null {
  if (!isRecord(raw) || raw.state !== 'ready') return null;
  const days = arr(raw.days).flatMap((d) => {
    if (!isRecord(d)) return [];
    const date = str(d.date);
    const officer = str(d.officer);
    const tone: TaekilDay['tone'] | null = d.tone === 'good' || d.tone === 'neutral' || d.tone === 'rest' ? d.tone : null;
    if (!date || !officer || !tone) return [];
    return [{ date, weekday: str(d.weekday) ?? '', stem: int(d.stem), branch: int(d.branch), officer, tone, label: str(d.label) ?? '', lowered: d.lowered === true, clash: arr(d.clash_with_me).length > 0 }];
  });
  return { purpose: str(raw.purpose) ?? '', days };
}

export type SajuApi = {
  chart(i: MyInput): Promise<SajuResult<MyChart>>;
  luck(i: MyInput, year?: number): Promise<SajuResult<MyLuck>>;
  day(i: MyInput, date?: string): Promise<SajuResult<MyDay>>;
  taekil(a: TaekilArgs): Promise<SajuResult<Taekil>>;
};

const inputArgs = (i: MyInput): Rec => ({ p_hour: i.hour, p_minute: i.hour === null ? null : i.minute ?? 0, p_place: i.place });

export function createSajuApi(call: RpcCall): SajuApi {
  async function read<T>(fn: string, args: Rec, parse: (d: unknown) => T | null, event: string): Promise<SajuResult<T>> {
    let res: Awaited<ReturnType<RpcCall>>;
    try {
      res = await call(fn, args);
    } catch {
      return { ok: false, code: 'network' };
    }
    if (res.error) {
      const f = readDbFailure(res.error);
      safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
      if (f.network) return { ok: false, code: 'network' };
      const head = String(res.error.message ?? '').split(':')[0].trim();
      if (head === 'feature_off') return { ok: false, code: 'feature_off' };
      if (f.code === '42501' || head === 'forbidden') return { ok: false, code: 'forbidden' };
      return { ok: false, code: 'not_ready' };
    }
    const d = res.data;
    if (isRecord(d) && d.ok === false) {
      const code = SAJU_FAIL_CODES.find((c) => c === d.code);
      return { ok: false, code: code ?? 'not_ready' };
    }
    const v = parse(d);
    return v === null ? { ok: false, code: 'not_ready' } : { ok: true, data: v };
  }
  return {
    chart: (i) => read('get_my_saju', inputArgs(i), parseMyChart, 'saju.chart.fail'),
    luck: (i, year) => read('get_my_luck', { ...inputArgs(i), p_year: year ?? null }, parseMyLuck, 'saju.luck.fail'),
    day: (i, date) => read('get_my_day', { ...inputArgs(i), p_date: date ?? null }, parseMyDay, 'saju.day.fail'),
    taekil: (a) =>
      read('get_taekil', { p_purpose: a.purpose, p_start: a.start, p_end: a.end, p_personal: a.personal, ...inputArgs(a) }, parseTaekil, 'saju.taekil.fail'),
  };
}
