// 데모 모드 모의 서버의 사주 마당 부분(IF5-F1). 이름 · 인자 · 응답 모양 = 서버 0048(backend/R_변경기록.md 16-2 · 16-3):
//  get_my_saju(p_hour, p_minute, p_place) · get_my_luck(…, p_year) · get_my_day(…, p_date) · get_taekil(p_purpose, p_start, p_end, p_personal, p_hour, p_minute, p_place)
//  · 계산은 saju5/saju_calc5(ai/IF5 사본 · calc5.py 와 같은 값)로 기기 안에서 한다. 데모 계정의 생년월일만 쓰고(가상 사람) 응답에는 생년월일 원값 0 · 시각 · 곳은 요청 인자(저장 0)
//  · 스위치 saju_yard 가 꺼지면 feature_off(42501, 서버 require_feature 와 같음) · CK17A 가 꺼져 있으면 {ok:false, code:'consent_required'}
//  · 성별은 서버가 profiles 에서 읽는다 — 데모 계정은 성별 칸이 없어 여성으로 두고, 이메일 앞부분에 sjm 이 있으면 남성 · sjnog 가 있으면 성별 없음(대운 칸 없음)
//  · 서버 요청 0 · 기기 저장 0 · 로그 0
import { BIRTH_PLACES, BRANCHES, STEMS, build_chart, daewoon, day_idx, dayNumOf, iljin, officer_of, seun, taekil, wolun, wolun_at } from '@/saju5/saju_calc5';
import type { Chart, Gender, Rec } from '@/saju5/saju_calc5';

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
export type DemoSajuUser = { id: string; email: string };
export type DemoSajuOptions = {
  flags: (u: DemoSajuUser) => Promise<Readonly<Record<string, boolean>>>;
  account: (u: DemoSajuUser) => { birthDate: string | null; consentOn: (code: string) => boolean };
  today?: () => string; // 한국 오늘(yyyy-mm-dd) — 시험이 바꾼다
};

const ok = (data: unknown): DbResult => ({ data, error: null });
const off = (): DbResult => ({ data: null, error: { code: '42501', message: 'feature_off' } });
const fail = (code: string): DbResult => ok({ ok: false, code });

const idxOfName = (name: string): number => {
  const s = STEMS.indexOf(name[0] as (typeof STEMS)[number]);
  const b = BRANCHES.indexOf(name[1] as (typeof BRANCHES)[number]);
  for (let i = 0; i < 60; i += 1) if (i % 10 === s && i % 12 === b) return i;
  return 0;
};
const pair = (idx: number | null): { stem: number; branch: number } | null => (idx === null ? null : { stem: idx % 10, branch: idx % 12 });

export function createDemoSaju(o: DemoSajuOptions) {
  const todayIso = (): string => o.today?.() ?? new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const genderOf = (u: DemoSajuUser): Gender | null => {
    const local = u.email.split('@')[0]?.toLowerCase() ?? '';
    return local.includes('sjnog') ? null : local.includes('sjm') ? 'M' : 'F';
  };
  const intOrNull = (v: unknown): number | null | 'bad' => (v === null || v === undefined ? null : typeof v === 'number' && Number.isInteger(v) ? v : 'bad');

  // 서버 saju5_my 와 같은 순서: 동의 → 입력 검사 → 생년월일 없음 → 계산
  async function mine(u: DemoSajuUser, args: Row): Promise<{ chart: Chart } | { resp: DbResult }> {
    const flags = await o.flags(u);
    if (!flags.saju_yard) return { resp: off() };
    const acct = o.account(u);
    if (!acct.consentOn('CK17A')) return { resp: fail('consent_required') };
    const hour = intOrNull(args.p_hour);
    const minute = intOrNull(args.p_minute);
    const place = args.p_place === null || args.p_place === undefined ? null : args.p_place;
    if (hour === 'bad' || minute === 'bad' || (hour === null && minute !== null) || (hour !== null && (hour < 0 || hour > 23)) || (minute !== null && (minute < 0 || minute > 59))) return { resp: fail('invalid_value') };
    if (place !== null && (typeof place !== 'string' || !(place in BIRTH_PLACES))) return { resp: fail('invalid_value') };
    if (!acct.birthDate) return { resp: ok({ ok: true, state: 'none' }) };
    try {
      const chart = build_chart({ year: Number(acct.birthDate.slice(0, 4)), month: Number(acct.birthDate.slice(5, 7)), day: Number(acct.birthDate.slice(8, 10)), hour, minute: minute ?? 0, gender: genderOf(u), place: hour === null ? null : place });
      return { chart };
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      if (m === 'out_of_range') return { resp: ok({ ok: true, state: 'out_of_range' }) };
      return { resp: fail('not_ready') };
    }
  }

  async function getSaju(u: DemoSajuUser, args: Row): Promise<DbResult> {
    const r = await mine(u, args);
    if ('resp' in r) return r.resp;
    const c = r.chart;
    return ok({
      ok: true,
      state: 'ready',
      hour_known: c.pillars.hour !== null,
      day: pair(c.pillars.day),
      hour: pair(c.pillars.hour),
      options: c.combos.map((x) => ({ year: pair(idxOfName(x.year)), month: pair(idxOfName(x.month)) })),
      flags: c.flags,
    });
  }

  const luckRow = (it: Rec): Row => ({ ...it, stem: (it.idx as number) % 10, branch: (it.idx as number) % 12 });

  async function getLuck(u: DemoSajuUser, args: Row): Promise<DbResult> {
    const r = await mine(u, args);
    if ('resp' in r) return r.resp;
    const year = typeof args.p_year === 'number' ? args.p_year : Number(todayIso().slice(0, 4));
    if (year < 1962 || year > 2050) return fail('invalid_value');
    const c = r.chart;
    const dw = daewoon(c);
    return ok({
      ok: true,
      state: 'ready',
      daewoon: dw
        ? {
            direction: dw.direction,
            daewoon_su: dw.daewoon_su,
            start_age: dw.start_age,
            approx: dw.approx,
            items: (dw.items as Rec[]).map((it) => luckRow(it)),
          }
        : null,
      seun: luckRow(seun(c, year)),
      wolun: wolun(c, year).map((w) => luckRow(w)),
    });
  }

  async function getDay(u: DemoSajuUser, args: Row): Promise<DbResult> {
    const date = typeof args.p_date === 'string' ? args.p_date : todayIso();
    if (date < '1961-08-10' || date > '2050-12-31') {
      const flags = await o.flags(u);
      return flags.saju_yard ? ok({ ok: true, state: 'out_of_range' }) : off();
    }
    const r = await mine(u, args);
    if ('resp' in r) return r.resp;
    const dn = dayNumOf(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
    return ok({ ok: true, state: 'ready', date, iljin: luckRow(iljin(r.chart, dn)), wolun: luckRow(wolun_at(r.chart, dn)), officer: officer_of(dn) });
  }

  async function getTaekil(u: DemoSajuUser, args: Row): Promise<DbResult> {
    const flags = await o.flags(u);
    if (!flags.saju_yard) return off();
    const purpose = args.p_purpose;
    const start = args.p_start;
    const end = args.p_end;
    const dn = (iso: string) => dayNumOf(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
    if (typeof purpose !== 'string' || typeof start !== 'string' || typeof end !== 'string' || end < start || dn(end) - dn(start) > 61) return fail('invalid_value');
    if (start < '1961-08-10' || end > '2050-12-31') return ok({ ok: true, state: 'out_of_range' });
    let chart: Chart | null = null;
    if (args.p_personal === true) {
      const r = await mine(u, args);
      if ('resp' in r) return r.resp;
      chart = r.chart;
    }
    try {
      const days = taekil(dn(start), dn(end), purpose, chart).map((d) => {
        const idx = day_idx(dn(String(d.date)));
        return { date: d.date, weekday: d.weekday, stem: idx % 10, branch: idx % 12, officer: d.officer, tone: d.tone, label: d.label, ...(d.clash_with_me !== undefined ? { clash_with_me: d.clash_with_me } : {}), ...(d.note ? { lowered: true } : {}) };
      });
      return ok({ ok: true, state: 'ready', purpose, days });
    } catch {
      return fail('invalid_value');
    }
  }

  const handlers: Record<string, (u: DemoSajuUser, args: Row) => Promise<DbResult>> = { get_my_saju: getSaju, get_my_luck: getLuck, get_my_day: getDay, get_taekil: getTaekil };
  return {
    handles: (name: string) => name in handlers,
    rpc: (u: DemoSajuUser, name: string, args: Row = {}): Promise<DbResult> => handlers[name](u, args),
  };
}

export type DemoSaju = ReturnType<typeof createDemoSaju>;
