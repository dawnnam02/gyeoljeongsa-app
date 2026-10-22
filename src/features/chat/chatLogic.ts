// 채팅 규칙(순수 함수 — 화면 없이 시험). 청사진 v5 초안 5장 8 · 재계획 Q12 · 결정 T-18 · T-19 · T-20 · T-27.
//  · 대화방은 열린 뒤 7일(매칭 수요일 18:00 → 다음 수요일 18:00). 둘 다 연장을 고르면 7일씩 더(횟수 제한 없음, Q12)
//  · 닫힌 방은 읽기만, 닫힌 뒤 30일에 글 · 사진 · 음성을 지운다(T-27 · Q12) — 화면은 지우는 날을 날짜로만 보인다
//  · 남은 기간은 '날짜까지' 글로만. 시 · 분 · 초 카운트다운 0 · 남은 날 숫자를 크게 세지 않는다(재촉 0, 척추 ④)
//  · 시각은 한국 시간(KST) 글(boarding 과 같은 꼴: '12월 30일 수요일 오후 6시')
import { CHAT } from './chatCopy';

export const KST = 9 * 3_600_000;
export const DAY = 24 * 3_600_000;
export const ROOM_DAYS = 7;
export const PURGE_DAYS = 30;
export const TEXT_MAX = 1000; // 한 번에 보내는 글(0031 과 같음)
export const VOICE_MAX_MS = 60_000; // 음성 한 개 최대 60초(0031 · 팀장 결정)
export const VOICE_MAX_BYTES = 3 * 1024 * 1024; // 음성 3MB(0031 · 팀장 결정)
export const VOICE_MIN_MS = 1_000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const kst = (ms: number) => new Date(ms + KST);
export const kstDayNo = (ms: number) => Math.floor((ms + KST) / DAY);

// '12월 30일 수요일 오후 6시'
export function whenText(ms: number): string {
  const d = kst(ms);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const half = h < 12 ? CHAT.time.am : CHAT.time.pm;
  const hh = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일 ${half} ${hh}시${m ? ` ${m}분` : ''}`;
}

// '12월 30일 수요일'(날짜만 — 지우는 날)
export function dayText(ms: number): string {
  const d = kst(ms);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS[d.getUTCDay()]}요일`;
}

// 말풍선 옆 시각 '오후 3:05'
export function clockText(ms: number): string {
  const d = kst(ms);
  const h = d.getUTCHours();
  const hh = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return `${h < 12 ? CHAT.time.am : CHAT.time.pm} ${hh}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// 목록 줄의 때: 오늘이면 시각, 어제면 '어제', 그 밖은 '12월 24일'
export function listTimeText(ms: number, now: number): string {
  const diff = kstDayNo(now) - kstDayNo(ms);
  if (diff <= 0) return clockText(ms);
  if (diff === 1) return CHAT.time.yesterday;
  const d = kst(ms);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

// 날짜 나눔 줄: 같은 한국 날짜면 같은 열쇠
export const dayKey = (ms: number) => kstDayNo(ms);

// 음성 길이 '0:07' · '1:00'
export function durationText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type ClosedReason = 'expired' | 'partner_left'; // 내가 나간 방은 내 목록에서 사라진다(0031)
export type RoomTimes = { closesAt: number; closedAt: number | null; closedReason: ClosedReason | null; purgeAt: number | null };

// 방이 지금 열려 있나(서버 상태가 열림이어도 닫는 시각이 지났으면 닫힌 것으로 그린다 — 서버가 곧 같은 답을 준다)
export function isOpen(room: Pick<RoomTimes, 'closesAt' | 'closedAt'>, now: number): boolean {
  return room.closedAt === null && now < room.closesAt;
}

// 지우는 날: 서버 값이 있으면 그것, 없으면 닫힌 때(또는 닫는 시각) + 30일
export function purgeAtOf(room: RoomTimes): number {
  if (room.purgeAt !== null) return room.purgeAt;
  return (room.closedAt ?? room.closesAt) + PURGE_DAYS * DAY;
}

// 방 위 안내 한 줄(재촉 0): 열림 = '…까지 열려 있어요.' · 마지막 날 = '오늘 오후 6시까지 열려 있어요.'
export function openLine(closesAt: number, now: number): string {
  if (kstDayNo(closesAt) === kstDayNo(now)) {
    const h = kst(closesAt).getUTCHours();
    if (h === 18 && kst(closesAt).getUTCMinutes() === 0) return CHAT.room.lastDay;
  }
  return CHAT.room.openUntil(whenText(closesAt));
}

// 닫힌 방 안내 글
export function closedLine(room: RoomTimes): string {
  const until = dayText(purgeAtOf(room));
  if (room.closedReason === 'partner_left') return CHAT.room.closedPartnerLeft(until);
  return CHAT.room.closedExpired(until);
}

// 보내기 전 글 검사: 빈 글은 보내지 않음(버튼 꺼짐) · 너무 길면 이유
export function checkText(text: string): { ok: true; text: string } | { ok: false; reason: 'empty' | 'long' } {
  const t = text.trim();
  if (t === '') return { ok: false, reason: 'empty' };
  if (Array.from(t).length > TEXT_MAX) return { ok: false, reason: 'long' };
  return { ok: true, text: t };
}

// 연장: 둘 다 원하면 closesAt + 7일. 한쪽만이면 그대로(상대 쪽 선택은 앱에 오지 않는다)
export function extendedClose(closesAt: number, mine: boolean, theirs: boolean): number {
  return mine && theirs ? closesAt + ROOM_DAYS * DAY : closesAt;
}

// 목록 정렬: 열린 방 먼저(마지막 글 최신순), 그다음 닫힌 방(닫힌 때 최신순)
export function sortRooms<T extends { open: boolean; lastAt: number; closedAt: number | null; closesAt: number }>(rooms: readonly T[]): T[] {
  return [...rooms].sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    if (a.open) return b.lastAt - a.lastAt;
    return (b.closedAt ?? b.closesAt) - (a.closedAt ?? a.closesAt);
  });
}

// 시스템 글(0031 kind 'system', body = 사건 이름) → 방 가운데 한 줄. null = 그리지 않음
//  · 상대의 연장 요청 · 거둠은 그리지 않는다(재촉 · 거절 부담 0 — 판단). 열림은 맨 위 안내 글이 대신한다
export function systemLine(event: string, mine: boolean): string | null {
  switch (event) {
    case 'extend_requested':
      return mine ? CHAT.system.extendRequested : null;
    case 'extend_cancelled':
      return mine ? CHAT.system.extendCancelled : null;
    case 'extended':
      return CHAT.system.extended;
    case 'closed_expired':
      return CHAT.system.closedExpired;
    case 'partner_left':
      return mine ? null : CHAT.system.partnerLeft;
    default:
      return null;
  }
}
