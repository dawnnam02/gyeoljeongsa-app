// 11 호감의 규칙(순수 함수). 원본: 기획/화면_요구사항.md 4장 11 · 1장 R3 · R12, 기획/정책.md 7장(P7-03 만료 7일 · P7-05 만료 표시).
//  · 이름 줄 R3 "박OO · 29 · 경기 성남시"(시 · 군 · 구는 앞 두 글자, 09 카드와 같은 모양)
//  · 둘째 줄 R12 시간: 1시간 미만 '{n}분 전'(0분은 1분) · 그 밖은 한국 시각 달력 날짜로 센다(팀장 10-15): 오늘 '{n}시간 전' · 어제 '어제' ·
//    2~6일 전 날짜 '{n}일 전' · 7일 이상 '{월}월 {일}일'. 예) 밤 0시 30분에 본 전날 23시 호감 = '어제'(지난 시간 1시간 30분이어도)
//  · 받은 호감 만료(P7-05): 남은 시간 24시간 미만 '오늘 만료' · 그 위는 '{n}일 뒤 만료'(n = 남은 날을 내림 — 실제보다 길게 말하지 않는다) · 지났으면 '만료'
//  · 정렬: 최신순(보낸 · 받은 = 호감 보낸 시각, 연결됨 = 연결된 시각). 서버도 최신순으로 주지만 같은 기준으로 한 번 더 맞춘다(시각이 같으면 서버 순서)
import { LIKES } from '@/content/likesCopy';
import { plain, regionText } from '@/features/recs/recsLogic';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const KST_OFFSET = 9 * HOUR;

export const LIKE_EXPIRY_MS = 7 * DAY; // 정책 P7-03(서버가 만료 시각을 준다. 이 값은 모의 서버 · 시험만 쓴다)

// 한국 시각 달력 날짜 번호(자정 기준). 두 시각의 날짜 차 = 며칠 전
const kstDate = (t: number): number => Math.floor((t + KST_OFFSET) / DAY);

// R12 (달력 기준)
export function timeAgo(at: number, now: number): string {
  const when = Math.min(at, now); // 기기 시계가 늦어도 미래로 보이지 않게
  const diff = now - when;
  if (diff < HOUR) return LIKES.time.minutes(Math.max(1, Math.floor(diff / MINUTE)));
  const days = kstDate(now) - kstDate(when);
  if (days === 0) return LIKES.time.hours(Math.floor(diff / HOUR));
  if (days === 1) return LIKES.time.yesterday;
  if (days < 7) return LIKES.time.days(days);
  const kst = new Date(when + KST_OFFSET);
  return LIKES.time.date(kst.getUTCMonth() + 1, kst.getUTCDate());
}

export type Expiry = { state: 'live'; label: string } | { state: 'expired'; label: string };

// P7-05 · F6 조건 4
export function expiryOf(expiresAt: number, now: number): Expiry {
  const left = expiresAt - now;
  if (left <= 0) return { state: 'expired', label: LIKES.expired };
  if (left < DAY) return { state: 'live', label: LIKES.expiresToday };
  return { state: 'live', label: LIKES.expiresIn(Math.floor(left / DAY)) };
}

export const isExpired = (expiresAt: number, now: number): boolean => expiresAt - now <= 0;

// 서버 card { name, age, region{sido,sigungu} } → "박OO · 29 · 경기 성남시". 비어 있는 칸은 뺀다
export function cardHead(card: { name?: unknown; age?: unknown; region?: unknown }): string {
  return [plain(card.name), plain(card.age), regionText(card.region)].filter((x): x is string => x !== null).join(' · ');
}

export const subLine = (time: string, label: string): string => `${time} · ${label}`;

// 최신순(안정 정렬)
export function newestFirst<T extends { createdAt: number }>(rows: readonly T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => b.row.createdAt - a.row.createdAt || a.i - b.i)
    .map((x) => x.row);
}
