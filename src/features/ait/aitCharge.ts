// 시험판 AI 단발 기능(궁합 한눈에 · 별자리 · 연애 풀이 · 고민 정리 한 번)의 마일리지 차감 틀 — 서버 차감표의 새 기능 키로 예치 → 답이 나가면 확정 · 못 받으면 해제(차감 0).
//  서버 차감표(백엔드 0058, S21_변경기록 7장): love_reading · counsel_turn · compat_glance · zodiac. 값(수)은 앱에 없다 — get_mileage.costs 응답에서 읽는다(costOf).
//  · 스위치가 꺼져 있으면(hold 가 'off' · 장부가 없는 판) 차감 경로가 열리지 않는다: 부르기 0 · 확정 0 · 'maint' 로 끝난다.
//  · 잔액이 모자라면(low) 부르기 0. 위기 · 거절 카드는 확정하지 않고 해제(차감 0). 앱 자동 재시도 0 — 같은 요청 번호는 같은 결과(이중 차감 0, 서버가 보장).
//  · 이 파일은 화면(useAitRun)에 아직 연결돼 있지 않다 — 가격 표시 · 잔액 부족 안내는 화면 설계가 정한 뒤 연결한다. 결제 호출 0 · 금액 인자 0.
import type { LedgerEdge } from '@/features/mileage/ledgerEdge';
import type { CostInfo } from '@/features/mileage/mileageApi';

import type { AitFeature, AitResult } from './aitTypes';

/** AI 기능 → 서버 차감표 기능 키. love_reading 은 연애 풀이(값은 본인 결정 대기 — 키만 맞춰 둠) */
export const AIT_COST_KEY: Readonly<Record<'chat' | 'compat' | 'horoscope' | 'love_reading', string>> = { chat: 'counsel_turn', compat: 'compat_glance', horoscope: 'zodiac', love_reading: 'love_reading' };
export const aitCostKey = (feature: AitFeature | 'love_reading'): string | null => (feature in AIT_COST_KEY ? AIT_COST_KEY[feature as keyof typeof AIT_COST_KEY] : null);

/** get_mileage.costs 에서 키의 값을 읽는다. 서버가 안 준 키는 null — 그 기능은 차감 경로를 열지 않는다 */
export function costOf(costs: readonly Pick<CostInfo, 'feature' | 'cost'>[], key: string): number | null {
  const row = costs.find((c) => c.feature === key);
  return row && Number.isInteger(row.cost) && row.cost >= 0 ? row.cost : null;
}

/** 서버 답 → 차감 결과. 답이 화면에 나가는 경우(code 'ok'이고 읽힌 글이 있음)만 'ok' = 확정. 위기 · 거절 카드는 'card'(차감 0).
 *  그 밖은 모두 'failed'(해제 · 차감 0): 오류 코드 · 출력 검사나 심사 탈락과 판정 실패(blocked_output · timeout · upstream …) · 끊김(offline) · 읽을 수 없는 글.
 *  서버 쪽 표(codes.ts CHARGE_OF_CODE)와 같은 규칙이다 — 앱은 서버 폴더를 가져오지 않아 여기에 따로 두고 시험이 두 표를 대조한다. */
export function outcomeOfReply<T>(res: AitResult, parse: (display: unknown) => T | null): { outcome: 'ok' | 'card' | 'failed'; value: T | null } {
  if (res.kind !== 'reply') return { outcome: 'failed', value: null };
  const r = res.reply;
  if ((r.code === 'crisis' || r.code === 'refused_intent') && r.card) return { outcome: 'card', value: null };
  if (r.code !== 'ok' || !r.ok) return { outcome: 'failed', value: null };
  const value = parse(r.display);
  return value === null ? { outcome: 'failed', value: null } : { outcome: 'ok', value };
}

export type ChargedOutcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'card'; value: T } // 위기 · 거절 카드 — 차감 0
  | { kind: 'low'; need: number; have: number }
  | { kind: 'maint' } // 스위치 꺼짐 · 장부 없음 · 값 모름 · 예치 실패 — 부르기 0, 차감 0
  | { kind: 'failed'; value: T }; // 부른 뒤 못 받음 — 해제(차감 0)

/** 예치 → 부르기 → 확정 · 해제. call 은 서버 호출 한 번(앱 자동 재시도 0). outcome 이 'ok' 일 때만 확정한다 */
export async function runCharged<T>(
  edge: LedgerEdge,
  a: { feature: AitFeature | 'love_reading'; requestId: string; chars: number; costs: readonly Pick<CostInfo, 'feature' | 'cost'>[] },
  call: () => Promise<{ outcome: 'ok' | 'card' | 'failed'; value: T }>,
): Promise<ChargedOutcome<T>> {
  const key = aitCostKey(a.feature);
  if (!key || costOf(a.costs, key) === null) return { kind: 'maint' }; // 키가 없거나 서버가 값을 안 줬다 → 차감 경로 닫힘
  const h = await edge.hold({ feature: key, chars: a.chars, requestId: a.requestId });
  if (h.kind === 'low') return { kind: 'low', need: h.need, have: h.have };
  if (h.kind !== 'held') return { kind: 'maint' }; // off · fail · tooLarge · free
  let r: Awaited<ReturnType<typeof call>>;
  try {
    r = await call();
  } catch {
    await edge.release(h.holdId, 'provider_error');
    return { kind: 'maint' };
  }
  if (r.outcome === 'ok') {
    await edge.settle(h.holdId);
    return { kind: 'ok', value: r.value };
  }
  await edge.release(h.holdId, r.outcome === 'card' ? 'user_cancel' : 'check_failed');
  return r.outcome === 'card' ? { kind: 'card', value: r.value } : { kind: 'failed', value: r.value };
}
