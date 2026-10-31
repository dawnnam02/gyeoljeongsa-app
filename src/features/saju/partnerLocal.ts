// 상대 생일 맞춰 보기 — 늘 기기 안 계산(IF5-F1 ② · 설계안 M-6 · A-2 · 정책 PS-21 ~ PS-26 · 보안 IC5-46 ~ 52).
//  · 서버에 보내지 않는다(네트워크 호출 0 — 이 파일은 fetch · rpc 를 부르지 않는다). 저장 0(기기 · 서버 · 로그) · 이름 · 성별 · 별명 칸 0
//  · 만 19세 미만 상대는 맞춰 보지 않는다(S-9 · PS-25): 계산도 하지 않고 결과가 없다
//  · 입력 값은 호출한 화면의 메모리에만 있다(시트를 닫으면 사라짐). 이 모듈은 값을 쥐고 있지 않는다(순수 함수)
import { build_chart, compat, facts_compat } from '@/saju5/saju_calc5';
import { partner_day_branch } from '@/saju5/pair5';
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

/** AI 맞춤(둘이 맞춰 보기)으로 보낼 사실 — 상대 쪽은 **간지 없는 2단계**(일간의 오행 · 음양 + 시각을 아는지뿐)로 줄인다(설계안 A-3 · 법무 4-18 · 서버 partner5 guardCompatFacts 가 다시 본다).
 *  상대 생일 원값 · 기둥 · 간지는 이 함수 밖으로 나가지 않는다(상대 차트는 이 안에서만 만들고 버린다). 만 19세 미만 · 범위 밖이면 null(보내지 않는다). */
export function partnerAiFacts(mine: Chart, input: PartnerInput, todayIso: string): Record<string, unknown> | null {
  const iso = partnerIso(input.birthDigits);
  if (!iso || !isRealDate(iso) || iso < SUPPORT_FROM_ISO || iso > todayIso || ageOn(iso, todayIso) < PARTNER_MIN_AGE) return null;
  try {
    const theirs = build_chart({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), hour: input.time?.hour ?? null, minute: input.time?.minute ?? null });
    return facts_compat(mine, theirs, 2);
  } catch {
    return null;
  }
}

/** 날짜 고르기 '상대와 함께 보기'(IF5-F1c · 카피 24-15-4): 상대의 '일지' 숫자 하나(0 ~ 11)만 기기 안에서 구한다.
 *  · 상대 생일은 화면 메모리에서 이 함수로만 들어오고, 돌려주는 것은 일지 숫자 하나뿐이다(기둥 · 간지 · 생일 원값 · 쉬어 가는 날 가르개를 쥐지 않는다). 서버 전송 0 · 저장 0 · 이름 0
 *  · 나이 · 범위 거름은 그대로다: 만 19세 미만은 계산하지 않는다(PS-25), 1961-08-10 이전 · 없는 날 · 미래는 범위 밖
 *  · 점수 · 판정 · 순위 0. 날마다 '함께 무난한 날인가'는 화면이 pair5.pair_ok_days_iso(내 일지, 상대 일지)로 가른다 */
export type PartnerBranch = { kind: 'ok'; branch: number } | { kind: 'minor' } | { kind: 'outOfRange' } | { kind: 'calcError' };
export function partnerBranch(input: PartnerInput, todayIso: string): PartnerBranch {
  const iso = partnerIso(input.birthDigits);
  if (!iso || !isRealDate(iso) || iso < SUPPORT_FROM_ISO || iso > todayIso) return { kind: 'outOfRange' };
  if (ageOn(iso, todayIso) < PARTNER_MIN_AGE) return { kind: 'minor' };
  try {
    const branch = partner_day_branch({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), hour: input.time?.hour ?? null, minute: input.time?.minute ?? null });
    return Number.isInteger(branch) && branch >= 0 && branch <= 11 ? { kind: 'ok', branch } : { kind: 'calcError' };
  } catch (e) {
    return e instanceof Error && e.message === 'out_of_range' ? { kind: 'outOfRange' } : { kind: 'calcError' };
  }
}
