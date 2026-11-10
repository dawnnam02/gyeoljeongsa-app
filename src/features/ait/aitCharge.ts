// 시험판 AI 단발 기능(궁합 한눈에 · 별자리 · 연애 풀이 · 고민 정리 한 번)의 마일리지 차감 읽기.
//  RS2-01(D-253): 예치 · 확정 · 해제는 서버(Edge 함수 ai-run)가 한다 — 이 파일에서 앱이 장부(hold · settle · release)를 부르는 길을 없앴다(runCharged 삭제).
//  앱은 응답의 code 와 charge.state 만 읽는다: settled 일 때만 잔액을 다시 읽고(shouldReloadBalance), none · off · low 는 잔액이 달라지지 않았다.
//  서버 차감표 키: love_reading · counsel_turn · compat_glance · zodiac(백엔드 0058). 값(수)은 앱에 없다 — get_mileage.costs 응답에서 읽는다(costOf). 결제 호출 0 · 금액 인자 0.
import type { CostInfo } from '@/features/mileage/mileageApi';

import type { AitFeature, AitReply, AitResult } from './aitTypes';

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

/** 응답의 차감 정보 → 잔액을 다시 읽을지. settled(이 요청에서 마일리지가 확정됨)만 true. none(차감 0) · off(스위치 꺼짐) · low(모자람)와 charge 없는 답(모의 · EAS 길)은 false.
 *  'low' 일 때 need · have 는 모자람 사실을 보이는 데만 쓴다 */
export const shouldReloadBalance = (reply: AitReply): boolean => reply.charge?.state === 'settled';
