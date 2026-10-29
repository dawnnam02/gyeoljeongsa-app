// 데모 모의 서버 둘(로그인 모의 서버 lib/demoBackend · 데모 채팅 features/chat/chatDemo)이 기내 서비스(IF2-F)에서 나눠 보는 메모리 값.
//  · 실서버에서는 한 DB 라 따로 할 일이 없다(0043 이 chat_access · visibility_settings · 기능 스위치를 같은 트랜잭션에서 읽음)
//  · 서버 요청 0 · 기기 저장 0. 데모 계산 키는 데모 전용(비밀 아님 — ai/IF2/check_calc.py 시험 키와 같아 시험값을 그대로 쓴다)
import { cardTopics, type DemoHobbyItem } from './funCalc';

export const DEMO_FUN_KEY = 'test-key-not-secret';

type RoomMark = 'open' | 'gone';
const rooms = new Map<string, RoomMark>(); // `${회원}|${방}` → 데모 채팅에서 나감 · 차단이면 gone
let sameHobbyOf: (userId: string) => boolean = () => true;
let flagsOf: (userId: string) => Promise<Readonly<Record<string, boolean>>> = async () => ({});
let interviewDoneOf: (userId: string) => boolean = () => false; // 3부-자: 대화형 설문 정리가 끝났나(데모 대화형 모의 서버가 등록 — 모의 confirm_profile(null)이 본다, 서버 0044 와 같은 조건)

export const demoShared = {
  markRoom(userId: string, roomId: string, mark: RoomMark) {
    rooms.set(`${userId}|${roomId}`, mark);
  },
  roomGone: (userId: string, roomId: string): boolean => rooms.get(`${userId}|${roomId}`) === 'gone',
  resetRooms(userId: string) {
    for (const k of [...rooms.keys()]) if (k.startsWith(`${userId}|`)) rooms.delete(k);
  },
  setSameHobby(fn: (userId: string) => boolean) {
    sameHobbyOf = fn;
  },
  sameHobby: (userId: string): boolean => sameHobbyOf(userId),
  setFlags(fn: (userId: string) => Promise<Readonly<Record<string, boolean>>>) {
    flagsOf = fn;
  },
  flags: (userId: string) => flagsOf(userId),
  setInterviewDone(fn: (userId: string) => boolean) {
    interviewDoneOf = fn;
  },
  interviewDone: (userId: string): boolean => interviewDoneOf(userId),
};

// 데모 짝의 같은 취미(0043 same_points 결과 꼴): 내 E11 [독서 · 여행 · 산책] ∩ 짝 [독서 · 여행 · 요리] — 독서는 그 권역에 흔해 코드 그대로,
//  여행은 k(20)명 미만이라 위 갈래 '밖에서 즐기는 일'로 묶인 장면. 두 분 모두 '같은 취미'를 켜고 스위치 same_points 가 켜졌을 때만
export const DEMO_PAIR_HOBBIES: readonly DemoHobbyItem[] = [{ code: 'reading' }, { group: 'out' }];
export async function demoPairHobbies(userId: string): Promise<DemoHobbyItem[]> {
  const flags = await flagsOf(userId);
  return flags.same_points === true && sameHobbyOf(userId) ? [...DEMO_PAIR_HOBBIES] : [];
}

// 첫마디 실마리 칩(0043 opener_chips · pair_card_topics 와 같은 계산)
export async function demoOpenerChips(userId: string, roomId: string) {
  return cardTopics(DEMO_FUN_KEY, roomId, await demoPairHobbies(userId));
}
