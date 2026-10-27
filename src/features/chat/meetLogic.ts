// 만남 장면 규칙(순수 함수 — 화면 없이 시험). D-205 · D-206 · 기획 K27 · 정책 P4-21 ~ P4-28 · 화면 T4S
//  · 장소: 방이 열린 한국 날짜가 기준 수요일에서 몇 주 지났는지로 10곳을 차례로 돌린다(P4-24). 회원 값 0 · 같은 방 두 사람은 opened_at 이 같아 같은 장소
//  · 판단 순서(화면 T4S): ① 기록 있음 → 대화방 ② 첫 읽기 실패 · 사라짐 → 대화방(기록 0) ③ 닫힘 · 상대 나감 → 대화방 ④ 내 글 있음 → 기록 + 대화방 ⑤ 열린 방 처음 → 기록 + 장면
//  · 스위치 meet_scene 이 꺼지면 장면 · 기억 줄 모두 0(P4-28)
import { MEET_PLACES, type MeetPlaceKey } from '@/theme/meetArt';

import type { Message, Room } from './chatApi';
import { CHAT } from './chatCopy';
import { isOpen, KST, kstDayNo } from './chatLogic';
import { MEET_SCENE } from './meetCopy';

export const MEET_SWITCH = 'meet_scene'; // 기능 스위치 키(config/featureKeys.json — live 꺼짐 · 데모 켜짐). 서버 스위치 행은 백엔드 몫
// 기준 수요일(K27 5-2 #2 가안 = 데모 1회차 · 출시 첫 회차 2026-12-23) — 이 날 열린 방이 장소 표 1번(강변 벤치)
export const MEET_BASE_DAY = kstDayNo(Date.parse('2026-12-23T18:00:00+09:00'));

export const placeIndexOf = (openedAt: number): number => {
  const week = Math.floor((kstDayNo(openedAt) - MEET_BASE_DAY) / 7);
  const n = MEET_PLACES.length;
  return ((week % n) + n) % n;
};
export const placeOf = (openedAt: number): MeetPlaceKey => MEET_PLACES[placeIndexOf(openedAt)];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayOf = (ms: number): string => `${WEEKDAYS[new Date(ms + KST).getUTCDay()]}요일`;

// 자막 카드 두 줄 · 기억 한 줄 · 읽기 이름
export const meetWhen = (openedAt: number): string => MEET_SCENE.when(weekdayOf(openedAt));
export const meetPlaceName = (openedAt: number): string => MEET_SCENE.place[placeOf(openedAt)];
export const metAtLine = (openedAt: number): string => CHAT.room.metAt(meetWhen(openedAt), meetPlaceName(openedAt));

// 끝 줄 두 갈래: 상대가 글 · 사진 · 음성을 먼저 보냈으면 '먼저 말을 걸어왔어요'(시스템 글은 세지 않는다)
export type EndLine = 'quiet' | 'partnerFirst';
export const endLineOf = (messages: readonly Message[]): EndLine => (messages.some((m) => !m.mine && m.kind !== 'system') ? 'partnerFirst' : 'quiet');
export const hasMine = (messages: readonly Message[]): boolean => messages.some((m) => m.mine && m.kind !== 'system');

export type MeetLoad = 'loading' | 'failed' | 'gone' | 'ready';
export type MeetInput = {
  switchOn: boolean | null; // null = 아직 못 읽음
  seen: boolean | null; // 이 방을 이 기기에서 본 적 있나(null = 기록을 아직 못 읽음)
  load: MeetLoad;
  room: Room | null;
  messages: readonly Message[];
  now: number;
};
export type MeetScenePlan = { place: MeetPlaceKey; placeName: string; when: string; endLine: EndLine };
export type MeetDecision = { kind: 'wait' } | { kind: 'none'; mark: boolean } | { kind: 'scene'; plan: MeetScenePlan };

export function decideMeet({ switchOn, seen, load, room, messages, now }: MeetInput): MeetDecision {
  if (seen === true) return { kind: 'none', mark: false }; // ① 다시 열면 바로 대화방
  if (load === 'failed' || load === 'gone') return { kind: 'none', mark: false }; // ② 불러오기 실패 · 사라진 방(기록 0 — 다음 진입 때 다시 판단)
  if (seen === null || switchOn === null || load === 'loading' || !room) return { kind: 'wait' };
  if (!switchOn) return { kind: 'none', mark: false }; // 스위치 꺼짐
  if (!isOpen(room, now)) return { kind: 'none', mark: false }; // ③ 닫힌 방 · 상대가 나간 방(읽기 전용)
  if (hasMine(messages)) return { kind: 'none', mark: true }; // ④ 내 글이 이미 있음(휴대폰을 바꿨을 때)
  return { kind: 'scene', plan: { place: placeOf(room.openedAt), placeName: meetPlaceName(room.openedAt), when: meetWhen(room.openedAt), endLine: endLineOf(messages) } }; // ⑤
}

// 장면을 어떻게 보여 주나: 화면 읽기 → 저절로 넘김 0 · 동작 줄이기 → 정지 그림 4초 · 그 밖 → 6.24초 재생
export type MeetMode = 'play' | 'still' | 'reader';
export const meetModeOf = (reduceMotion: boolean, screenReader: boolean): MeetMode => (screenReader ? 'reader' : reduceMotion ? 'still' : 'play');
