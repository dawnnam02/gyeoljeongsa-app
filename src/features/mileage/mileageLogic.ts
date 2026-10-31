// 마일리지 화면의 순수 규칙(IF5-F2 ⑨ · 화면 없이 시험한다). 값(수 · 가격 · 차감표 · 규칙)은 서버 응답(get_mileage · get_mileage_cost)에서만 온다 — 여기에 마일리지 수 · 가격 0.
import { IF5_TEXT, type If5Key } from '@/content/if5Copy';

import type { CostInfo, HistoryItem, HistoryKind, MileageState } from './mileageApi';

/** 천 단위 쉼표(Intl 없이 — 안드로이드 Hermes 에서도 같게) */
export const fmt = (n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 쓰기 전에 보이는 최종 마일리지 = 기본(base) + 길이 가산(extra). 서버 cost 와 어긋나면 서버 cost 를 따른다(둘이 같다는 것은 시험이 본다) */
export const finalCost = (c: Pick<CostInfo, 'base' | 'extra' | 'cost'>): number => c.cost;
export const costParts = (c: Pick<CostInfo, 'base' | 'extra'>): number => c.base + c.extra;

/** 확인 시트가 필요한가 — 서버가 준 confirm(= cost ≥ rules.confirm_from) */
export const needsConfirm = (c: CostInfo): boolean => c.confirm;

/** 기능 이름 → 차감표 한 줄의 마일리지(버튼 옆 숫자 · 시작 시트용). 없으면 null */
export const costOf = (s: MileageState, feature: string): number | null => s.costs.find((c) => c.feature === feature)?.cost ?? null;

/** 내역 종류 → 카피 키. 충전 · 데모 충전은 같은 '충전' */
export const KIND_KEY: Readonly<Record<HistoryKind, If5Key>> = {
  charge: 'MILEAGE.log.kind.charge',
  demo: 'MILEAGE.log.kind.charge',
  gift: 'MILEAGE.log.kind.signup',
  boarding: 'MILEAGE.log.kind.boarding',
  ops: 'MILEAGE.log.kind.reward',
  use: 'MILEAGE.log.kind.spend',
  recovered: 'MILEAGE.log.kind.refundBack',
  restored: 'MILEAGE.log.kind.regrant',
};
/** 적립 줄의 무료 / 산 분 표시. 사용 · 회수 줄은 표시 0 */
export function bucketOf(kind: HistoryKind): 'free' | 'paid' | null {
  if (kind === 'gift' || kind === 'boarding' || kind === 'ops') return 'free';
  if (kind === 'charge' || kind === 'demo') return 'paid';
  return null;
}
/** 사용 줄의 기능 이름 → '쓴 곳' 카피 키 */
export function usedKey(feature: string | null): If5Key | null {
  switch (feature) {
    case 'saju_reading':
    case 'daewoon':
    case 'sinyeon':
    case 'compat':
    case 'saju_full':
      return 'MILEAGE.log.use.read';
    case 'saju_chat_turn':
      return 'MILEAGE.log.use.talk';
    case 'counsel_turn':
      return 'MILEAGE.log.use.concern';
    case 'taekil_explain':
      return 'MILEAGE.log.use.pick';
    case 'polish_short':
    case 'polish_long':
      return 'MILEAGE.log.use.polish';
    default:
      return null;
  }
}
/** 부호 붙은 수: +1,000 / −250 */
export const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

/** 날짜 한 줄(한국 시각 m월 d일) */
export function logDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + 9 * 3_600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** 쓰기 전 모자란지 — 서버 예치가 마지막 판정이고 이것은 시트를 띄울지 보는 앞 거름일 뿐이다 */
export const isLow = (s: MileageState, cost: number): boolean => s.total < cost;

/** 내역 두 묶음을 이어 붙인다(id 중복 0) */
export function mergeHistory(a: HistoryItem[], b: HistoryItem[]): HistoryItem[] {
  const seen = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !seen.has(x.id))];
}

/** '무료 {N} · 유료 {N}' — 같은 자리 이름 둘이라 차례대로 채운다(카피 24-10 MILEAGE.log.split) */
export function splitLine(free: number, paid: number): string {
  const [a, b, c] = IF5_TEXT['MILEAGE.log.split'].split('{N}');
  return `${a}${fmt(free)}${b}${fmt(paid)}${c ?? ''}`;
}
