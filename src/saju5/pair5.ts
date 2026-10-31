// IF5-F1c · A-F1c — 날짜 고르기 '상대와 합쳐 보기' 규칙(역술 자문 전 가안). 파이썬 기준: pair5.py
//
//   규칙: 두 사람 모두 '그날 일진의 지지'가 '자기 일지'와 마주 보지(충) 않고, 그날이 쉬어 가는 날(rest)도 아닌 날 = both_ok(함께 무난한 날).
//   · 쉬어 가는 날 · 충 판정은 서버 get_taekil 과 같은 식이다: 쉬어 가는 날 = taekil() 의 tone 'rest'(건제 12신 위 · 폐 · 파, 정리 · 청소 목적은 없음 — 모두에게 같음),
//     충 = 날 지지와 자기 일지의 차가 6(서버 clash_with_me 중 '일지' 칸). 사람마다 달라지는 것은 '자기 일지와의 충' 하나뿐이다.
//   · 상대는 일지(0 ~ 11) 하나만 쓴다. 생일 → 일지는 partner_day_branch()가 기기 안에서 계산하고, 돌려주는 것은 숫자 하나뿐이다(기둥 · 간지 · 생일 원값 0).
//     상대 시각은 선택이다. 일지는 시각에 거의 흔들리지 않는다(서머타임 창 1987-05-10 ~ 10-11 · 1988-05-08 ~ 10-09의 밤 ~ 새벽 시각처럼 드문 경우만).
//   · 점수 · 순위 · 판정 0. 날마다 {date, both_ok} 하나. 상대 일지를 주지 않으면 '나 혼자 기준'(상대 칸 건너뜀)이다.
//   · 이 파일은 네트워크 · 저장 호출이 없다(순수 함수) — 상대 값은 호출한 화면 메모리에서만 쓰인다.
import { build_chart, dayNumOf, day_idx, isoDate, taekil } from './saju_calc5.ts';
import type { BirthInput } from './saju_calc5.ts';

/** 서버 get_taekil 과 같은 최대 범위(p_end - p_start <= 61 → 62일) */
export const PAIR_MAX_SPAN_DAYS = 61;

export interface PairDay { date: string; both_ok: boolean }

const isBranch = (b: unknown): b is number => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 11;

/** 생일(+선택 시각)에서 일지 0 ~ 11 (자 = 0). 범위 밖 · 없는 날 · 없는 시각은 던진다(앱은 '계산 못 함'으로 처리). 자시는 야자시(앱 기본)와 같다. */
export function partner_day_branch(input: Pick<BirthInput, 'year' | 'month' | 'day' | 'hour' | 'minute'>): number {
  const ch = build_chart({ year: input.year, month: input.month, day: input.day, hour: input.hour ?? null, minute: input.minute ?? null });
  return ch.pillars.day % 12;
}

/** 내 일지 — 원국의 일주(0 ~ 59)에서. */
export const day_branch_of_pillar = (dayPillar: number): number => ((dayPillar % 12) + 12) % 12;

/** 날 지지가 자기 일지와 마주 보는가(충) — 서버 (v_db - v_pb + 12) % 12 = 6 과 같음 */
const clashes = (dayBranch: number, own: number): boolean => (((dayBranch - own) % 12) + 12) % 12 === 6;

/** 날마다 {date, both_ok}. 날 번호(dn) 범위 · 서버와 같은 목적 코드 · 내 일지 · 상대 일지(없으면 null). */
export function pair_ok_days(startDn: number, endDn: number, purpose: string, myBranch: number, partnerBranch: number | null = null): PairDay[] {
  if (!isBranch(myBranch) || (partnerBranch !== null && !isBranch(partnerBranch))) throw new Error('invalid_branch');
  if (!Number.isInteger(startDn) || !Number.isInteger(endDn) || endDn < startDn || endDn - startDn > PAIR_MAX_SPAN_DAYS) throw new Error('invalid_range');
  const base = taekil(startDn, endDn, purpose, null);   // 모르는 목적은 여기서 던진다(unknown_purpose). 개인 칸 없이 쉬어 가는 날만 본다
  const out: PairDay[] = [];
  for (let i = 0; i < base.length; i++) {
    const dn = startDn + i;
    const db = day_idx(dn) % 12;
    const ok = base[i].tone !== 'rest' && !clashes(db, myBranch) && (partnerBranch === null || !clashes(db, partnerBranch));
    out.push({ date: isoDate(dn), both_ok: ok });
  }
  return out;
}

/** 날짜 글(yyyy-mm-dd) 범위용 겉옷 */
export function pair_ok_days_iso(startIso: string, endIso: string, purpose: string, myBranch: number, partnerBranch: number | null = null): PairDay[] {
  const dn = (iso: string): number => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) throw new Error('invalid_range');
    return dayNumOf(Number(m[1]), Number(m[2]), Number(m[3]));
  };
  return pair_ok_days(dn(startIso), dn(endIso), purpose, myBranch, partnerBranch);
}
