// D46-A 만남 장면(D-205 · D-206 연출 ④ '예능 결' · 화면 T4S · 정책 P4-21 ~ P4-28 · 카피 16장)
//  ① 장소: 방이 열린 날짜(한국)로 10곳 차례 — 같은 날 같은 값 · 두 사람 같은 장소 · 다음 주 다른 장소
//  ② 판단 순서: 기록 · 실패 · 닫힘 · 내 글 · 처음 · 스위치
//  ③ 화면: 한 번만 · [건너뛰기] · 동작 줄이기(정지 그림 4.3초) · 화면 읽기(저절로 넘김 0 · [대화방으로 가기]) · 끝 줄 두 갈래 · 기억 줄 · 앱이 뒤로 감
//  ④ 시간표 · 그림 에셋 · 기록 · 스위치 키
import { AppState } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, isPendingKey, liveDefault } from '@/config/featureKeys';
import type { ChatApi, Message, Room } from '@/features/chat/chatApi';
import { CHAT } from '@/features/chat/chatCopy';
import { createDemoChatApi, DEMO_CHAT_SCENES, sceneOfEmail } from '@/features/chat/chatDemo';
import { createDemoMedia } from '@/features/chat/chatMedia';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { MEET_SCENE } from '@/features/chat/meetCopy';
import { decideMeet, endLineOf, MEET_SWITCH, meetModeOf, meetWhen, metAtLine, placeIndexOf, placeOf, weekdayOf } from '@/features/chat/meetLogic';
import { createMeetSeen, type MeetSeenMemory } from '@/features/chat/meetSeen';
import { bobY, camScale, cardKeep, cubic, cupDeg, cupShift, handoff, legDeg, lightO, seg, sitIn, standOut, walkX } from '@/features/chat/meetTimeline';
import { meetSwitchOn, type MeetDeps } from '@/features/chat/useMeetScene';
import { createFlagsStore } from '@/hooks/useFeatureFlags';
import { FLAGS_FALLBACK, parseFlags } from '@/lib/featureFlagsApi';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { screenReaderStore } from '@/lib/screenReader';
import { MEET_ART, MEET_PLACES } from '@/theme/meetArt';
import { scene2 } from '@/theme/motion';

import { allTexts, has, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({
  chatApi: () => {
    throw new Error('시험은 api 를 넣는다');
  },
  chatMedia: () => {
    throw new Error('시험은 media 를 넣는다');
  },
  CHAT_LIST_HREF: '/chat',
  chatRoomHref: (id: string) => `/chat/${id}`,
}));

jest.setTimeout(90_000);

const M = scene2.meet;
const at = (iso: string) => Date.parse(iso);
const OPENED = at('2026-12-23T18:00:00+09:00'); // 데모 1회차 = 기준 수요일
const QUIET = '옆에 앉은 분과 눈이 마주쳤어요.';
const FIRST = '옆에 앉은 분이 먼저 말을 걸어왔어요.';

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    shown.splice(0).forEach((t) => t.unmount()); // 장면 타이머 · 대화방 읽기가 시험 뒤에 돌지 않게
    reduceMotionStore.set(false);
    screenReaderStore.set(false);
  });
  jest.useRealTimers();
});

// ── ① 장소 ───────────────────────────────────────────────────────────────
describe('① 장소: 방이 열린 날짜(한국)로 10곳 차례(P4-24 · K27 5-2)', () => {
  test('기준 수요일 2026-12-23 = 1번 한강 벤치 · 같은 날 같은 값(공개 늦춤 30분 · 밤 11시 59분) · 다음 주 2번 · 10주 뒤 다시 1번 · 그 전 주 10번', () => {
    expect(placeOf(OPENED)).toBe('riverBench');
    for (const t of [at('2026-12-23T00:00:00+09:00'), at('2026-12-23T18:30:00+09:00'), at('2026-12-23T23:59:59+09:00'), at('2026-12-29T23:59:00+09:00')]) expect(placeIndexOf(t)).toBe(0);
    expect(placeOf(at('2026-12-30T18:00:00+09:00'))).toBe('hanokAlley');
    expect(MEET_PLACES.map((_, w) => placeOf(OPENED + w * 7 * 86_400_000))).toEqual([...MEET_PLACES]);
    expect(placeOf(OPENED + 70 * 86_400_000)).toBe('riverBench');
    expect(placeOf(at('2026-12-16T18:00:00+09:00'))).toBe('busStop');
    // UTC 로는 전날이어도(한국 새벽) 한국 날짜로 센다
    expect(placeIndexOf(at('2026-12-30T00:30:00+09:00'))).toBe(1);
  });
  test('두 사람은 같은 방(opened_at 같음)이라 같은 장소 · 회원 값을 받지 않는다(입력은 opened_at 하나)', () => {
    expect(placeOf.length).toBe(1);
    expect(metAtLine(OPENED)).toBe('수요일 저녁, 한강 벤치에서 처음 만났어요.');
    expect(metAtLine(at('2027-01-06T18:00:00+09:00'))).toBe('수요일 저녁, 카페 테라스에서 처음 만났어요.');
    expect(weekdayOf(OPENED)).toBe('수요일');
    expect(meetWhen(OPENED)).toBe('수요일 저녁');
  });
  test('장소 이름 = 카피 16-1 글자 그대로(10곳 · 지명은 한강 · 제주 둘만)', () => {
    expect(MEET_PLACES.map((k) => MEET_SCENE.place[k])).toEqual(['한강 벤치', '한옥 골목', '카페 테라스', '제주 바닷가', '동네 밥집', '궁궐 돌담길', '공원 산책로', '기차역 대합실', '서점 창가', '버스 정류장']);
  });
});

// ── ② 판단 ───────────────────────────────────────────────────────────────
const room = (over: Partial<Room> = {}): Room => ({ id: 'r1', partner: { id: 'p', name: '김OO', age: 32, region: '서울 마포구', facePhotoId: null }, roundNo: 1, openedAt: OPENED, closesAt: OPENED + 7 * 86_400_000, closedAt: null, closedReason: null, purgeAt: null, myExtend: false, last: null, unread: 0, ...over });
const msg = (mine: boolean, kind: Message['kind'] = 'text'): Message => ({ id: `${Math.random()}`, clientId: null, mine, kind, body: kind === 'system' ? 'opened' : '안녕하세요', mediaId: null, durationMs: null, caution: false, createdAt: OPENED, purged: false });
describe('② 판단 순서(화면 T4S): 기록 → 실패 · 사라짐 → 닫힘 → 내 글 → 처음', () => {
  const base = { switchOn: true, seen: false, load: 'ready' as const, room: room(), messages: [msg(false, 'system')], now: OPENED + 60_000 };
  test('처음 · 열린 방 · 글 0 → 장면(조용한 방) + 기록', () => {
    expect(decideMeet(base)).toEqual({ kind: 'scene', plan: { place: 'riverBench', placeName: '한강 벤치', when: '수요일 저녁', endLine: 'quiet' } });
  });
  test('상대가 글 · 사진 · 음성을 먼저 → 장면(상대 먼저) · 시스템 글은 세지 않는다', () => {
    for (const k of ['text', 'photo', 'voice'] as const) expect(decideMeet({ ...base, messages: [msg(false, 'system'), msg(false, k)] })).toMatchObject({ kind: 'scene', plan: { endLine: 'partnerFirst' } });
    expect(endLineOf([msg(false, 'system'), msg(true, 'system')])).toBe('quiet');
  });
  test('기록 있음 · 불러오기 실패 · 사라진 방 → 장면 0 · 기록 0 / 닫힌 방 · 상대가 나간 방 → 장면 0 · 기록 0 / 내 글 있음 → 장면 0 · 기록 남김', () => {
    expect(decideMeet({ ...base, seen: true })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, load: 'failed', room: null })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, load: 'gone', room: null })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, room: room({ closedAt: OPENED + 7 * 86_400_000, closedReason: 'expired' }), now: OPENED + 8 * 86_400_000 })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, room: room({ closedAt: OPENED + 86_400_000, closedReason: 'partner_left' }), now: OPENED + 2 * 86_400_000 })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, messages: [msg(false), msg(true)] })).toEqual({ kind: 'none', mark: true });
  });
  test('스위치 meet_scene 꺼짐 → 장면 0 · 기록 0 / 스위치 · 기록 · 방을 아직 못 읽음 → 기다림', () => {
    expect(decideMeet({ ...base, switchOn: false })).toEqual({ kind: 'none', mark: false });
    expect(decideMeet({ ...base, switchOn: null })).toEqual({ kind: 'wait' });
    expect(decideMeet({ ...base, seen: null })).toEqual({ kind: 'wait' });
    expect(decideMeet({ ...base, load: 'loading', room: null })).toEqual({ kind: 'wait' });
  });
  test('보여 주는 법: 화면 읽기 → reader(저절로 넘김 0) · 동작 줄이기 → still · 그 밖 → play', () => {
    expect([meetModeOf(false, false), meetModeOf(true, false), meetModeOf(false, true), meetModeOf(true, true)]).toEqual(['play', 'still', 'reader', 'reader']);
  });
});

// ── ③ 화면 ───────────────────────────────────────────────────────────────
const fakeMedia = () => createDemoMedia({ email: () => '', now: () => 0 });
const demoFor = (email: string) => createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: 600_000, clock: () => 1_000_000 });
const deps = (over: Partial<MeetDeps> = {}): MeetDeps => ({ switchOn: async () => true, seen: createMeetSeen(), ...over });
const settle = async (fake = false) => {
  for (let i = 0; i < 4; i += 1)
    await act(async () => {
      if (fake) await jest.advanceTimersByTimeAsync(0);
      else await new Promise((r) => setTimeout(r, 0));
    });
};
async function openRoom(email: string, meet: MeetDeps | null = deps(), api: ChatApi = demoFor(email), fake = false) {
  const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
  const id = rooms.data[0]?.id ?? 'none';
  const tree = await mount(<ChatRoomScreen id={id} api={api} media={fakeMedia()} pollMs={600_000} toastMs={60_000} meet={meet ?? undefined} />);
  shown.push(tree);
  await settle(fake);
  return { tree, id };
}
const skipLabel = (tree: ReactTestRenderer) => must(tree, 'chat-meet-skip').findAll((n) => n.props.children === MEET_SCENE.skip).length > 0;
const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};
const sceneText = (tree: ReactTestRenderer) => allTexts(tree).join('\n');

describe('③ 화면: 대화방 첫 상태로 한 번(T4S)', () => {
  test('데모 장면: chatnew = 막 열린 방(글 0) · chatfirst = 상대가 먼저 · 기본 open 은 내 글이 있어 장면 0 · 목록 데모 줄 끝에 둘', () => {
    expect(['chatnew', 'chatfirst', 'x'].map((l) => sceneOfEmail(`${l}@email.com`))).toEqual(['fresh', 'partnerFirst', 'open']);
    expect(DEMO_CHAT_SCENES.slice(-2)).toEqual(['fresh', 'partnerFirst']);
    expect(CHAT.demo.scenes.fresh).toBe('막 열린 방');
  });

  test('처음: 장면(카드 두 줄 · 끝 줄 · 건너뛰기 48) → [건너뛰기] → 대화방 · 맨 위 기억 한 줄 · 두 번째는 바로 대화방(같은 기기 기록)', async () => {
    const meet = deps();
    const first = await openRoom('chatnew@email.com', meet);
    expect(has(first.tree, 'chat-meet')).toBe(true);
    expect(textOf(first.tree, 'chat-meet-place')).toBe('한강 벤치');
    expect(textOf(first.tree, 'chat-meet-when')).toBe('수요일 저녁');
    expect(textOf(first.tree, 'chat-meet-line')).toBe(QUIET);
    expect(must(first.tree, 'chat-meet-block').props.accessibilityLabel).toBe('한강 벤치, 수요일 저녁. 우연히 옆자리에 앉게 됐어요. 옆에 앉은 분과 눈이 마주쳤어요.');
    expect(must(first.tree, 'chat-meet-skip').props.accessibilityLabel).toBe(MEET_SCENE.skipA11y);
    expect(skipLabel(first.tree)).toBe(true);
    expect(has(first.tree, 'chat-meet-go')).toBe(false);
    expect(meet.seen.has(first.id)).toBe(true); // 장면이 시작될 때 기록
    // 장면 글에 숫자 · 느낌표 · 이름 0(상대 이름은 아래 대화방 머리에만)
    const words = [textOf(first.tree, 'chat-meet-place'), textOf(first.tree, 'chat-meet-when'), textOf(first.tree, 'chat-meet-line'), MEET_SCENE.skip].join(' ');
    expect(words).not.toMatch(/\d|[!！]|OO/);
    await press(first.tree, 'chat-meet-skip');
    expect(has(first.tree, 'chat-meet')).toBe(false);
    expect(textOf(first.tree, 'chat-room-met-at')).toBe('수요일 저녁, 한강 벤치에서 처음 만났어요.');
    expect(has(first.tree, 'chat-composer')).toBe(true);
    act(() => first.tree.unmount());
    shown.splice(shown.indexOf(first.tree), 1);
    const again = await openRoom('chatnew@email.com', meet);
    expect(has(again.tree, 'chat-meet')).toBe(false);
    expect(has(again.tree, 'chat-meet-wait')).toBe(false);
    expect(textOf(again.tree, 'chat-room-met-at')).toBe('수요일 저녁, 한강 벤치에서 처음 만났어요.');
  });

  test('끝 줄 두 갈래: 상대가 먼저 보낸 방 → "먼저 말을 걸어왔어요" · 그림은 같다', async () => {
    const { tree } = await openRoom('chatfirst@email.com');
    expect(textOf(tree, 'chat-meet-line')).toBe(FIRST);
    expect(must(tree, 'chat-meet-block').props.accessibilityLabel).toBe(MEET_SCENE.a11y('한강 벤치', '수요일 저녁', FIRST));
    expect(has(tree, 'chat-meet-art-walker')).toBe(true);
  });

  test('재생: 6.24초 뒤 저절로 대화방 · 그 전에는 장면 그대로(진행 막대 · 남은 초 0)', async () => {
    jest.useFakeTimers();
    const { tree } = await openRoom('chatnew@email.com', deps(), demoFor('chatnew@email.com'), true);
    expect(has(tree, 'chat-meet')).toBe(true);
    await advance(M.total - 50);
    expect(has(tree, 'chat-meet')).toBe(true);
    expect(sceneText(tree)).not.toMatch(/\d+초|남은/);
    await advance(60);
    expect(has(tree, 'chat-meet')).toBe(false);
    expect(M.total).toBe(6_240);
  });

  test('동작 줄이기: 정지 그림(걸어오는 사람 칸 0) + 카드 + 끝 줄 → 4.3초 뒤 대화방', async () => {
    act(() => reduceMotionStore.set(true));
    jest.useFakeTimers();
    const { tree } = await openRoom('chatnew@email.com', deps(), demoFor('chatnew@email.com'), true);
    expect(has(tree, 'chat-meet')).toBe(true);
    expect(has(tree, 'chat-meet-art-walker')).toBe(false);
    expect(textOf(tree, 'chat-meet-line')).toBe(QUIET);
    expect(has(tree, 'chat-meet-skip')).toBe(true);
    await advance(M.reducedIn + M.reducedHold + M.reducedOut - 50);
    expect(has(tree, 'chat-meet')).toBe(true);
    await advance(60);
    expect(has(tree, 'chat-meet')).toBe(false);
    expect(M.reducedIn + M.reducedHold + M.reducedOut).toBe(4_300);
  });

  test('화면 읽기: 저절로 넘기지 않음 · 장면 한 덩이 이름 · 버튼은 [대화방으로 가기] 하나', async () => {
    act(() => screenReaderStore.set(true));
    jest.useFakeTimers();
    const { tree } = await openRoom('chatnew@email.com', deps(), demoFor('chatnew@email.com'), true);
    expect(has(tree, 'chat-meet')).toBe(true);
    expect(has(tree, 'chat-meet-skip')).toBe(false);
    expect(must(tree, 'chat-meet-block').props.accessible).toBe(true);
    await advance(60_000);
    expect(has(tree, 'chat-meet')).toBe(true);
    expect(must(tree, 'chat-meet-go').props.label).toBe('대화방으로 가기');
    await press(tree, 'chat-meet-go');
    expect(has(tree, 'chat-meet')).toBe(false);
  });

  test('장면 중 앱이 뒤로 가면(홈 · 전화) 장면을 끝낸다 → 돌아오면 대화방', async () => {
    const handlers: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handlers.push(h);
      return { remove: () => undefined };
    }) as never);
    const { tree } = await openRoom('chatnew@email.com');
    expect(has(tree, 'chat-meet')).toBe(true);
    act(() => handlers.forEach((h) => h('background')));
    expect(has(tree, 'chat-meet')).toBe(false);
    spy.mockRestore();
  });

  test('내 글이 있는 방(데모 기본 open): 장면 0 · 기록은 남김 · 기억 줄은 보임', async () => {
    const meet = deps();
    const { tree, id } = await openRoom('w5open@email.com', meet);
    expect(has(tree, 'chat-meet')).toBe(false);
    expect(meet.seen.has(id)).toBe(true);
    expect(textOf(tree, 'chat-room-met-at')).toBe('수요일 저녁, 한강 벤치에서 처음 만났어요.');
  });

  test('닫힌 방 · 상대가 나간 방: 장면 0(읽기 전용) · 기록 0 · 기억 줄은 보임(두 사람 같은 글)', async () => {
    for (const email of ['chatclosed@email.com', 'chatleft@email.com']) {
      const meet = deps();
      const { tree, id } = await openRoom(email, meet);
      expect(has(tree, 'chat-meet')).toBe(false);
      expect(has(tree, 'chat-room-closed')).toBe(true);
      expect(meet.seen.has(id)).toBe(false);
      expect(textOf(tree, 'chat-room-met-at')).toBe('수요일 저녁, 한강 벤치에서 처음 만났어요.');
    }
  });

  test('스위치 meet_scene 꺼짐: 장면 0 · 기억 줄 0 · 기록 0 / meet 를 주지 않으면(다른 길 · 옛 시험) 기능 0', async () => {
    const meet = deps({ switchOn: async () => false });
    const { tree, id } = await openRoom('chatnew@email.com', meet);
    expect(has(tree, 'chat-meet')).toBe(false);
    expect(has(tree, 'chat-room-met-at')).toBe(false);
    expect(meet.seen.has(id)).toBe(false);
    const plain = await openRoom('chatnew@email.com', null);
    expect(has(plain.tree, 'chat-meet')).toBe(false);
    expect(has(plain.tree, 'chat-room-met-at')).toBe(false);
  });

  test('방을 불러오지 못함: 장면 0 · 기록 0(다음 진입 때 다시 판단)', async () => {
    const api = demoFor('chatnew@email.com');
    const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
    const broken = { ...api, getRoom: async () => ({ ok: false as const, reason: 'network' as const }) } as ChatApi;
    const meet = deps();
    const { tree } = await openRoom('chatnew@email.com', meet, broken);
    expect(has(tree, 'chat-room-failed')).toBe(true);
    expect(has(tree, 'chat-meet')).toBe(false);
    expect(meet.seen.has(rooms.data[0].id)).toBe(false);
  });

  test('판단하는 동안은 바탕만(글 · 뼈대 깜빡임 0) · 1초를 넘기면 대화방 뼈대', async () => {
    jest.useFakeTimers();
    const meet = deps({ switchOn: () => new Promise<boolean>(() => undefined) });
    const { tree } = await openRoom('chatnew@email.com', meet, demoFor('chatnew@email.com'), true);
    expect(has(tree, 'chat-meet-wait')).toBe(true);
    await advance(M.waitCover + 10);
    expect(has(tree, 'chat-meet-wait')).toBe(false);
    expect(has(tree, 'chat-meet')).toBe(false);
  });
});

// ── ④ 시간표 · 그림 · 기록 · 스위치 ─────────────────────────────────────────
describe('④ 시간표(page.js cine 그대로) · 그림 에셋 · 기기 기록 · 스위치', () => {
  test('박자: 0 장소 · 0.6 카드 · 1.2 걸어옴 · 2.7 앉음 · 2.95 컵 · 3.1 · 3.4 시선 · 3.8 끝 줄 · 빛 · 5.0 여운 · 6.0 대화방 0.24 = 6.24초', () => {
    expect([M.card, M.walk, M.sit, M.cup, M.lookB, M.lookA, M.line, M.linger, M.handoff, M.handoff + M.handoffFor]).toEqual([600, 1_200, 2_700, 2_950, 3_100, 3_400, 3_800, 5_000, 6_000, M.total]);
    expect(M.total).toBeGreaterThanOrEqual(4_000);
    expect(M.total).toBeLessThanOrEqual(8_000); // 세부청사진 4 ~ 8초
    expect(M.rest).toBeGreaterThan(M.linger);
    expect(M.rest).toBeLessThan(M.handoff);
  });
  test('곡선: std · edOut 값 · 구간 밖 0 · 1', () => {
    // 매개변수 u 를 촘촘히 훑은 값과 같다(std · edOut · edInOut)
    const brute = (x1: number, y1: number, x2: number, y2: number, x: number) => {
      let best = 0;
      let gap = 9;
      for (let i = 0; i <= 20_000; i += 1) {
        const u = i / 20_000;
        const bx = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3;
        if (Math.abs(bx - x) < gap) {
          gap = Math.abs(bx - x);
          best = 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3;
        }
      }
      return best;
    };
    for (const [a, b, c, d] of [[0.4, 0, 0.2, 1], [0.16, 1, 0.3, 1], [0.77, 0, 0.18, 1]]) for (const x of [0.1, 0.5, 0.9]) expect(cubic(a, b, c, d, x)).toBeCloseTo(brute(a, b, c, d, x), 3);
    expect(seg(0, 600, 360)).toBe(0);
    expect(seg(960, 600, 360)).toBe(1);
    expect(seg(780, 600, 360)).toBeGreaterThan(0.5);
  });
  test('카메라 1 → 1.1(5초에 멈춤) · 걸어옴 230 → 0 · 몸 위아래 · 다리 ±7° · 앉음 · 컵 -109.5° → 0 · 빛 0.3 → 1 · 대화방 걷힘', () => {
    expect([camScale(0), camScale(M.cam), camScale(M.rest)]).toEqual([1, 1.1, 1.1]);
    expect([walkX(0), walkX(M.walk), walkX(M.sit)]).toEqual([230, 230, 0]);
    // 몸 위아래: 걸음마다 가장 높이 -2.5(원본 WAAPI: 걸음 전체에 std 곡선, 가운데 키 -2.5)
    const lifts = Array.from({ length: 500 }, (_, i) => bobY(M.walk + i));
    expect(Math.min(...lifts)).toBeCloseTo(-2.5, 2);
    expect(Math.max(...lifts)).toBe(0);
    expect([bobY(0), bobY(M.sit + 1)]).toEqual([0, 0]);
    expect(legDeg(M.walk + 250, 7)).toBeCloseTo(7, 5);
    expect(legDeg(M.walk + 750, 7)).toBeCloseTo(-7, 5);
    expect([legDeg(0, 7), legDeg(M.sit, 7)]).toEqual([0, 0]);
    expect([standOut(M.sit), standOut(M.sit + M.standOut)]).toEqual([0, 1]);
    expect([sitIn(M.sit), sitIn(M.sit + M.sitDelay + M.sitIn)]).toEqual([0, 1]);
    expect([cupDeg(0), cupDeg(M.cup + M.cupFor)]).toEqual([-109.5, 0]);
    expect(cupShift(0, 15, 22).map((v) => Math.abs(v))).toEqual([0, 0]);
    const [dx, dy] = cupShift(-109.5, 15, 22);
    expect([dx, dy].map((v) => Math.round(v * 10) / 10)).toEqual([0.7, -43.5]);
    expect([lightO(0), lightO(M.light + M.lightFor)]).toEqual([0.3, 1]);
    expect([cardKeep(M.rest, false), cardKeep(M.rest, true), cardKeep(1_000, false)]).toEqual([0, 1, 1]);
    expect([handoff(M.handoff), handoff(M.total)]).toEqual([0, 1]);
  });
  test('그림 에셋: 장소 10곳(차례 = 카피 16-1) · 사람 부품 9 · 글자 · filter · blend 0 · 색은 에셋 안에만', () => {
    expect(MEET_ART.order).toEqual([...MEET_PLACES]);
    expect(Object.keys(MEET_ART.people).sort()).toEqual(['aCup_book', 'aCup_cup', 'aFace', 'aFore', 'bBody', 'bFace', 'bLegL', 'bLegR', 'bSit']);
    const all = [MEET_ART.light, ...Object.values(MEET_ART.people), ...MEET_PLACES.flatMap((k) => [MEET_ART.places[k].base, MEET_ART.places[k].fore ?? ''])].join('');
    expect(all).not.toMatch(/<text|filter|mix-blend|<image|href="http/);
    expect(MEET_ART.places.bookWindow.prop).toBe('book');
    expect(MEET_PLACES.filter((k) => MEET_ART.places[k].prop === 'cup')).toHaveLength(9);
    // 도는 축 = 칸 가운데(팔꿈치 · 엉덩이)
    for (const p of [MEET_ART.parts.aFore, MEET_ART.parts.bLegL, MEET_ART.parts.bLegR]) expect([p.box[0] + p.box[2] / 2, p.box[1] + p.box[3] / 2]).toEqual([...(p.pivot ?? [])]);
  });
  test('기기 기록: 방 id 최근 20개 · 다시 읽어도 남음 · 지우기(로그아웃 · 탈퇴) · 읽기 전에는 모름(null)', async () => {
    let saved: string[] | null = ['old-room'];
    const memory: MeetSeenMemory = { read: async () => saved, write: async (ids) => void (saved = ids) };
    const s = createMeetSeen(memory);
    expect(s.has('old-room')).toBeNull();
    await s.load();
    expect(s.has('old-room')).toBe(true);
    for (let i = 0; i < 25; i += 1) s.mark(`r${i}`);
    expect(s.get().ids).toHaveLength(20);
    expect(s.has('old-room')).toBe(false);
    expect(saved).toHaveLength(20);
    s.clear();
    expect(s.get().ids).toEqual([]);
    expect(saved).toEqual([]);
  });
  test('스위치 meet_scene: 키 목록 D46 · live 꺼짐(서버가 켜기 전) · 데모 켜짐 · 못 읽으면 꺼짐', async () => {
    expect(MEET_SWITCH).toBe('meet_scene');
    expect([liveDefault(MEET_SWITCH), demoDefault(MEET_SWITCH), isPendingKey(MEET_SWITCH)]).toEqual([false, true, false]);
    expect(await meetSwitchOn(createFlagsStore(async () => parseFlags({ flags: { meet_scene: true }, modes: {} })))).toBe(true);
    expect(await meetSwitchOn(createFlagsStore(async () => parseFlags({ flags: {}, modes: {} })))).toBe(false);
    expect(await meetSwitchOn(createFlagsStore(async () => FLAGS_FALLBACK))).toBe(false);
  });
  test('글: 카피 16장 키 18개 · 해요체 · 느낌표 · 숫자 · 재촉 0', () => {
    const texts = [...Object.values(MEET_SCENE.place), MEET_SCENE.when('수요일'), MEET_SCENE.line.quiet, MEET_SCENE.line.partnerFirst, MEET_SCENE.skip, MEET_SCENE.skipA11y, MEET_SCENE.go, MEET_SCENE.a11y('가', '나', '다'), CHAT.room.metAt('가', '나')];
    expect(texts).toHaveLength(18);
    for (const t of texts) expect(t).not.toMatch(/[!！]|\d|지금|곧|놓치지|먼저 말을 걸어 보세요/);
    expect([MEET_SCENE.line.quiet, MEET_SCENE.line.partnerFirst]).toEqual([QUIET, FIRST]);
  });
});
