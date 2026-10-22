// 탑승권 화면 규칙(순수 함수). 청사진 v5 초안 4-1 · 6-1 · 6-3.
//  · 시각은 한국 시간(KST) 글로만: '12월 23일 수요일 오후 6시'. 남은 때는 '날' 단위만(오늘 · n일 뒤) — 시 · 분 · 초 카운트다운 0
//  · 좌석은 '있음 · 모두 참' 둘뿐. 남은 좌석 수 · 정원 · 순번은 받지도 보이지도 않는다(재촉 0)
import type { BoardingState } from './boardingApi';

const KST = 9 * 3_600_000;
const DAY = 24 * 3_600_000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 한국 날짜 일련번호(같은 날이면 같은 값)
const kstDayNo = (ms: number) => Math.floor((ms + KST) / DAY);

export function whenText(ms: number): string {
  const d = new Date(ms + KST);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const half = h < 12 ? '오전' : '오후';
  const hh = h <= 12 ? h : h - 12;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일 ${half} ${hh}시${m ? ` ${m}분` : ''}`;
}

// 매칭 날까지 며칠(한국 달력 날짜 차이). 지났으면 0
export const daysUntil = (target: number, now: number): number => Math.max(0, kstDayNo(target) - kstDayNo(now));

export type BoardingView = 'ineligible' | 'before_sale' | 'on_sale' | 'full' | 'closed' | 'boarded' | 'matched' | 'no_match';

export function boardingView(s: BoardingState): BoardingView {
  if (s.phase === 'revealed' && s.result) return s.result.kind === 'matched' ? 'matched' : 'no_match';
  if (s.ticket && (!s.round || s.ticket.roundNo === s.round.no)) return 'boarded';
  if (s.ineligible) return 'ineligible';
  if (s.phase === 'before_sale') return 'before_sale';
  if (s.phase === 'on_sale') return s.seat === 'full' ? 'full' : 'on_sale';
  return 'closed';
}

// 다음 회차 판매 시작(매칭 다음 날 목요일 00:00 KST) — 이번 매칭 시각에서 센다
export function nextSaleOpen(matchAt: number): number {
  return (kstDayNo(matchAt) + 1) * DAY - KST;
}

// 크레딧으로 탈 수 있나
export const canUseCredit = (s: Pick<BoardingState, 'credits'>): boolean => s.credits > 0;
