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

// 도착 화면 날짜 알약(D-178): '12월 23일(수) 18:00' — 정해진 공개 시각 한 줄(남은 시간 · 카운트다운 아님)
export function arriveWhen(ms: number): string {
  const d = new Date(ms + KST);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAYS[d.getUTCDay()]}) ${hh}:${mm}`;
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

// T2 [탑승 취소]를 보이나(D-200 ④ · 정책 P1-08): 이번 회차에 탔고, 서버 시각이 판매 마감(수 17:30) 전일 때만
export const canCancel = (s: Pick<BoardingState, 'ticket' | 'round' | 'now'>): boolean =>
  !!s.ticket && !!s.round && s.ticket.roundNo === s.round.no && s.round.saleCloseAt !== null && s.now < s.round.saleCloseAt;

// 탑승 취소가 받아들여진 바로 뒤(0037 result 'credited'): 탑승권을 내려놓고 크레딧 1장을 더한다 → T1(판매 중)으로.
//  서버 값을 다시 읽기 전 한순간만 쓰는 값이라 다른 칸은 그대로 둔다
export const afterCancel = (s: BoardingState, credited: boolean): BoardingState => ({ ...s, ticket: null, credits: s.credits + (credited ? 1 : 0) });

// 계약 설명 확인 기록(R40)의 판: 화면에 실제로 보인 요약 블록 글(제목 + 줄)의 지문. 글이 한 자라도 바뀌면 판이 바뀐다.
//  'contract-5-8-' + FNV-1a 32비트 16진 8자(서버 p_text_version 4 ~ 60자). 법무 판_관리에 5-8 판 이름이 정해지면 그 값으로 바꾼다
export function contractVersion(lines: readonly string[]): string {
  let h = 0x811c9dc5;
  const text = lines.join('\n');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `contract-5-8-${h.toString(16).padStart(8, '0')}`;
}

// 크레딧으로 탈 수 있나
export const canUseCredit = (s: Pick<BoardingState, 'credits'>): boolean => s.credits > 0;
