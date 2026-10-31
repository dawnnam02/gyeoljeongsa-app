// 상대 생일 맞춰 보기 — 늘 기기 안 계산(IF5-F1 ② · 설계안 M-6 · A-2 · 정책 PS-21 ~ PS-26 · 보안 IC5-46 ~ 52).
//  · 서버에 보내지 않는다(네트워크 호출 0 — 이 파일은 fetch · rpc 를 부르지 않는다). 저장 0(기기 · 서버 · 로그) · 이름 · 성별 · 별명 칸 0
//  · 만 19세 미만 상대는 맞춰 보지 않는다(S-9 · PS-25): 계산도 하지 않고 결과가 없다
//  · 입력 값은 호출한 화면의 메모리에만 있다(시트를 닫으면 사라짐). 이 모듈은 값을 쥐고 있지 않는다(순수 함수)
import { build_chart, compat } from '@/saju5/saju_calc5';
import type { Chart } from '@/saju5/saju_calc5';
import { pickCard } from '@/saju5/fragments5';

import { ageOn, isRealDate, SUPPORT_FROM_ISO, type CardView } from './sajuLogic';

export const PARTNER_MIN_AGE = 19; // 만 19세 미만은 맞춰 보지 않는다(법무 확인 줄)

export type PartnerInput = { birthDigits: string; time: { hour: number; minute: number } | null };
export type PartnerResult =
  | { kind: 'ok'; card: CardView; hourUnknown: boolean }
  | { kind: 'minor' } // 만 19세 미만 — 계산하지 않음
  | { kind: 'outOfRange' } // 1961-08-10 이전 · 존재하지 않는 날짜 · 미래 날짜
  | { kind: 'calcError' };

/** 8자리 숫자(yyyymmdd) → 날짜 글. 틀린 꼴은 null */
export function partnerIso(digits: string): string | null {
  return /^\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : null;
}

/** 내 원국(서버가 준 기둥으로 세운 것)과 상대 생일을 견준다. todayIso = 한국 오늘 */
export function matchPartner(mine: Chart, input: PartnerInput, todayIso: string): PartnerResult {
  const iso = partnerIso(input.birthDigits);
  if (!iso || !isRealDate(iso) || iso < SUPPORT_FROM_ISO || iso > todayIso) return { kind: 'outOfRange' };
  if (ageOn(iso, todayIso) < PARTNER_MIN_AGE) return { kind: 'minor' }; // 계산 전에 거른다(차감 0 · 결과 0)
  let theirs: Chart;
  try {
    theirs = build_chart({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), hour: input.time?.hour ?? null, minute: input.time?.minute ?? null });
  } catch (e) {
    return e instanceof Error && e.message === 'out_of_range' ? { kind: 'outOfRange' } : { kind: 'calcError' };
  }
  try {
    const card = pickCard('F5-10', { compat: compat(mine, theirs) });
    if (!card.one && card.three.length === 0) return { kind: 'calcError' };
    return { kind: 'ok', hourUnknown: theirs.pillars.hour === null, card: { feature: card.feature, one: card.one?.text ?? null, day: null, row: null, three: card.three.map((p) => p.text), more: card.more.map((p) => p.text) } };
  } catch {
    return { kind: 'calcError' };
  }
}
