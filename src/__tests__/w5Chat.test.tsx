// V5 W5 채팅 앱(목록 · 방 · 글 · 사진 · 음성 · 7일 · 연장 · 나가기 · 차단 · 신고 · 닫힌 방) — 규칙 · 응답 읽기 · 데모 채팅 · 화면 · 글 규칙 · 동작 줄이기
import type { ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { REPORT_SHEET } from '@/content/copy';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createChatApi, parseMessage, parseMessages, parseRoom, parseRooms, type ChatApi, type Message, type Room } from '@/features/chat/chatApi';
import { CHAT } from '@/features/chat/chatCopy';
import { createDemoChatApi, hasDemoControls, sceneOfEmail } from '@/features/chat/chatDemo';
import { ChatListScreen } from '@/features/chat/ChatListScreen';
import { MessageBubble } from '@/features/chat/ChatParts';
import { checkText, closedLine, DAY, durationText, extendedClose, isOpen, listTimeText, openLine, purgeAtOf, sortRooms, TEXT_MAX, whenText } from '@/features/chat/chatLogic';
import { createDemoMedia, type ChatMedia } from '@/features/chat/chatMedia';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { kinOrder, myReligionOf, poolFor } from '@/demo/people';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { takeToast } from '@/lib/toastBus';

import { allTexts, has, isOpen as sheetOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

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

const at = (iso: string) => Date.parse(iso);
const OPENED = at('2026-12-23T18:00:00+09:00');
const CLOSES = at('2026-12-30T18:00:00+09:00');

// ── 1. 규칙 ─────────────────────────────────────────────────────────────
describe('W5 규칙(chatLogic): 7일 · 날짜 글 · 연장 · 닫힌 방 30일', () => {
  test('닫는 시각 글은 한국 시간 날짜 · 요일 · 시각(카운트다운 0)', () => {
    expect(whenText(CLOSES)).toBe('12월 30일 수요일 오후 6시');
    expect(openLine(CLOSES, at('2026-12-25T20:00:00+09:00'))).toBe('12월 30일 수요일 오후 6시까지 열려 있어요.');
    expect(openLine(CLOSES, at('2026-12-30T10:00:00+09:00'))).toBe(CHAT.room.lastDay);
    for (const t of [at('2026-12-24T00:00:00+09:00'), at('2026-12-30T17:59:00+09:00')]) expect(openLine(CLOSES, t)).not.toMatch(/\d+\s*(시간|분|초)\s*(남|뒤)|남았|곧|서두르|마감/);
  });
  test('열림 판정: 닫는 시각 전 + 닫힘 기록 없음', () => {
    expect(isOpen({ closesAt: CLOSES, closedAt: null }, CLOSES - 1)).toBe(true);
    expect(isOpen({ closesAt: CLOSES, closedAt: null }, CLOSES)).toBe(false);
    expect(isOpen({ closesAt: CLOSES, closedAt: CLOSES - DAY }, CLOSES - 2 * DAY)).toBe(false);
  });
  test('닫힌 방: 닫힌 뒤 30일에 지움 · 이유마다 글(만료 · 내가 나감 · 상대가 마침)', () => {
    const base = { closesAt: CLOSES, closedAt: CLOSES, purgeAt: null } as const;
    expect(purgeAtOf({ ...base, closedReason: 'expired' })).toBe(CLOSES + 30 * DAY);
    expect(closedLine({ ...base, closedReason: 'expired' })).toBe(CHAT.room.closedExpired('1월 29일 금요일'));
    expect(closedLine({ ...base, closedReason: 'partner_left' })).toContain('상대가 대화를 마쳤어요.');
  });
  test('연장: 둘 다 원할 때만 7일 더(한쪽만이면 그대로) · 횟수 제한 없음', () => {
    expect(extendedClose(CLOSES, true, false)).toBe(CLOSES);
    expect(extendedClose(CLOSES, false, true)).toBe(CLOSES);
    expect(extendedClose(CLOSES, true, true)).toBe(CLOSES + 7 * DAY);
    expect(extendedClose(extendedClose(CLOSES, true, true), true, true)).toBe(CLOSES + 14 * DAY);
  });
  test('글 검사: 빈 글 · 공백은 보내지 않음 · 1000자까지(글자 단위)', () => {
    expect(checkText('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkText(' 안녕하세요 ')).toEqual({ ok: true, text: '안녕하세요' });
    expect(checkText('가'.repeat(TEXT_MAX)).ok).toBe(true);
    expect(checkText('가'.repeat(TEXT_MAX + 1))).toEqual({ ok: false, reason: 'long' });
  });
  test('때 글: 오늘 = 시각 · 어제 · 그 전 = 날짜 / 음성 길이', () => {
    const now = at('2026-12-25T20:00:00+09:00');
    expect(listTimeText(at('2026-12-25T09:05:00+09:00'), now)).toBe('오전 9:05');
    expect(listTimeText(at('2026-12-24T23:00:00+09:00'), now)).toBe('어제');
    expect(listTimeText(at('2026-12-23T18:24:00+09:00'), now)).toBe('12월 23일');
    expect(durationText(7_000)).toBe('0:07');
    expect(durationText(60_000)).toBe('1:00');
  });
  test('목록 순서: 열린 방(마지막 글 최신순) → 닫힌 방', () => {
    const r = (id: string, open: boolean, lastAt: number) => ({ id, open, lastAt, closedAt: open ? null : lastAt, closesAt: CLOSES });
    expect(sortRooms([r('c1', false, 5), r('o1', true, 1), r('o2', true, 3)]).map((x) => x.id)).toEqual(['o2', 'o1', 'c1']);
  });
});

// ── 2. 응답 읽기(가정 이름 0031) ───────────────────────────────────────────
describe('W5 응답 읽기: 아는 키만 · 모르는 모양은 버림', () => {
  const ROOM = {
    room_id: 'r1', state: 'open', opened_at: new Date(OPENED).toISOString(), closes_at: new Date(CLOSES).toISOString(), close_reason: null,
    extend: { me: true, partner: true }, extend_count: 0, partner: { user_id: 'u2', name: '문OO' },
    last_message: { kind: 'voice', mine: false, preview: null, created_at: new Date(OPENED).toISOString() }, unread: 2, tier: 3,
  };
  test('방(0031 키): 상대 · 7일 · 내 연장 · 마지막 글 · 읽지 않음 — 상대 연장 · 점수 · 등급 키는 읽지 않는다', () => {
    const room = parseRoom(ROOM);
    expect(room).toMatchObject({ id: 'r1', partner: { id: 'u2', name: '문OO' }, myExtend: true, unread: 2, last: { kind: 'voice' }, closedAt: null });
    expect(Object.keys(room as Room)).not.toContain('partnerExtend');
    expect(JSON.stringify(room)).not.toContain('tier');
    expect(parseRoom({ room_id: 'r1' })).toBeNull();
    expect(parseRooms({ rooms: [ROOM] })?.length).toBe(1);
    expect(parseRooms({ off: true })).toEqual([]);
  });
  test('닫힌 방(0031): closes_at = 닫힌 때 · close_reason partner_left', () => {
    expect(parseRoom({ ...ROOM, state: 'closed', close_reason: 'partner_left' })).toMatchObject({ closedAt: CLOSES, closedReason: 'partner_left' });
  });
  test('글(0031 키): 숫자 id · attachment_id · caution · system', () => {
    expect(parseMessage({ id: 12, kind: 'photo', created_at: new Date(OPENED).toISOString(), attachment_id: 'a1', mine: true })).toMatchObject({ id: '12', kind: 'photo', mediaId: 'a1', mine: true });
    expect(parseMessage({ id: 13, kind: 'text', body: 'www.x.kr', caution: true, created_at: new Date(OPENED).toISOString() })).toMatchObject({ caution: true });
    expect(parseMessage({ id: 14, kind: 'system', body: 'extended', created_at: new Date(OPENED).toISOString() })).toMatchObject({ kind: 'system', body: 'extended' });
    expect(parseMessage({ id: 'm', kind: 'video', created_at: new Date(OPENED).toISOString() })).toBeNull();
    expect(parseMessages({ messages: [{ id: 2, kind: 'text', created_at: new Date(OPENED).toISOString() }], has_more: false })?.length).toBe(1);
  });
  test('서버 호출 이름 · 인자(0031): 방 id 로 신고 · 차단 · 연장 요청/거둠 · 나가기 · 읽음 · 보내기', async () => {
    const calls: [string, unknown][] = [];
    const answer = (name: string): unknown =>
      name === 'request_chat_extension' ? { extended: false, room: ROOM } : name === 'cancel_chat_extension' ? ROOM : name === 'send_chat_message' ? { ok: false, code: 'text_blocked', codes: ['money'] } : null;
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: answer(name), error: null };
      },
    } as unknown as SupabaseClient;
    const api = createChatApi(client);
    await api.setExtend('r1', true);
    await api.setExtend('r1', false);
    await api.leave('r1');
    await api.block('r1');
    await api.report('r1', 'RP4', '');
    await api.markRead('r1', '42');
    expect(await api.send('r1', { clientId: 'c', kind: 'text', body: '송금' })).toEqual({ ok: false, reason: 'blocked' });
    expect(calls.map((c) => c[0])).toEqual(['request_chat_extension', 'cancel_chat_extension', 'leave_chat_room', 'block_chat_partner', 'report_chat_partner', 'mark_chat_read', 'send_chat_message']);
    expect(calls[4][1]).toEqual({ p_room: 'r1', p_reason: 'RP4', p_description: null, p_message: null });
    expect(calls[5][1]).toEqual({ p_room: 'r1', p_upto: 42 });
    expect(calls[6][1]).toEqual({ p_room: 'r1', p_body: '송금' });
  });
});

// ── 3. 데모 채팅 ─────────────────────────────────────────────────────────
const demoFor = (email: string, over: { replyMs?: number } = {}) => {
  let clock = 1_000_000;
  const api = createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: over.replyMs ?? 50, clock: () => clock });
  return { api, tick: (ms: number) => (clock += ms) };
};

describe('W5 데모 채팅: 데모 인물과 대화 장면', () => {
  test('기본: 열린 방 1개 · 상대 = 탑승권 데모와 같은 분(끼리끼리 첫 분) · 같은 방 id · 읽지 않은 글 1', async () => {
    const { api } = demoFor('w5a@email.com');
    const r = await api.listRooms();
    const p = kinOrder(poolFor('w5a@email.com'), 4, myReligionOf('w5a@email.com'))[0];
    expect(r.ok && r.data.length).toBe(1);
    if (!r.ok) return;
    expect(r.data[0]).toMatchObject({ id: `demo-chat-1-${p.n}`, partner: { id: `demo-cand-${p.n}`, name: p.name }, closesAt: CLOSES, unread: 1 });
    const m = await api.listMessages(r.data[0].id);
    expect(m.ok && m.data.map((x) => x.kind)).toEqual(expect.arrayContaining(['text', 'photo', 'voice']));
    expect(await api.faceUrl(`demo-ph-${p.n}-face`)).toBe(`file:///${p.key}_face.webp`);
  });
  test('장면: 이메일 앞부분(chatlast · chatext · chatclosed · chat0) · 데모 줄로 다음 장면', async () => {
    expect(['x', 'chatlast', 'chatext', 'chatleft', 'chatclosed', 'chat0'].map((l) => sceneOfEmail(`${l}@email.com`))).toEqual(['open', 'lastDay', 'extendWait', 'partnerLeft', 'closed', 'empty']);
    const { api } = demoFor('w5b@email.com');
    expect(hasDemoControls(api)).toBe(true);
    if (!hasDemoControls(api)) return;
    expect(await api.demo.next()).toBe('lastDay');
    expect(await api.demo.next()).toBe('extendWait');
    expect(await api.demo.next()).toBe('partnerLeft');
    const left = await api.listRooms();
    expect(left.ok && left.data[0].closedReason).toBe('partner_left');
    expect(await api.demo.next()).toBe('closed');
    const closed = await api.listRooms();
    expect(closed.ok && closed.data[0].closedReason).toBe('expired');
    expect(await api.demo.next()).toBe('empty');
    const empty = await api.listRooms();
    expect(empty.ok && empty.data).toEqual([]);
  });
  test('보내기: 글 · 연락처는 자유(T-20) · 금전 요구 · 욕설은 막음 · 데모실패는 처음 한 번 인터넷 실패', async () => {
    const { api } = demoFor('w5c@email.com');
    const room = (await api.listRooms()) as { ok: true; data: Room[] };
    const id = room.data[0].id;
    expect((await api.send(id, { clientId: 'a', kind: 'text', body: '제 번호는 010-1234-5678이에요.' })).ok).toBe(true);
    expect(await api.send(id, { clientId: 'b', kind: 'text', body: '계좌로 송금해 주세요' })).toEqual({ ok: false, reason: 'blocked' });
    expect(await api.send(id, { clientId: 'c', kind: 'text', body: '데모실패 확인' })).toEqual({ ok: false, reason: 'network' });
    expect((await api.send(id, { clientId: 'c', kind: 'text', body: '데모실패 확인' })).ok).toBe(true);
    expect(await api.send(id, { clientId: 'd', kind: 'text', body: '가'.repeat(TEXT_MAX + 1) })).toEqual({ ok: false, reason: 'long' });
    const v = await api.send(id, { clientId: 'e', kind: 'voice', bytes: new Uint8Array(0), contentType: 'audio/webm', durationMs: 4_000 });
    expect(v.ok && v.data).toMatchObject({ kind: 'voice', durationMs: 4_000, mine: true });
  });
  test('실시간 흉내: 처음 보낸 뒤 상대가 한 번 답하고 구독자에게 알린다', async () => {
    jest.useFakeTimers();
    try {
      const { api } = demoFor('w5d@email.com', { replyMs: 1_500 });
      const id = ((await api.listRooms()) as { ok: true; data: Room[] }).data[0].id;
      const seen = jest.fn();
      const off = api.subscribe(id, seen);
      await api.send(id, { clientId: 'a', kind: 'text', body: '안녕하세요' });
      await api.send(id, { clientId: 'b', kind: 'text', body: '두 번째' });
      jest.advanceTimersByTime(1_500);
      expect(seen).toHaveBeenCalledTimes(1);
      const m = (await api.listMessages(id)) as { ok: true; data: Message[] };
      expect(m.data.filter((x) => !x.mine).pop()?.body).toBe('네, 좋아요. 천천히 이야기 나눠요.');
      off();
    } finally {
      jest.useRealTimers();
    }
  });
  test('연장: 상대가 이미 원한 장면에서 내가 원하면 7일 더 · 혼자면 그대로(상대 선택은 응답에 없음)', async () => {
    const solo = demoFor('w5e@email.com').api;
    const id1 = ((await solo.listRooms()) as { ok: true; data: Room[] }).data[0].id;
    expect(await solo.setExtend(id1, true)).toEqual({ ok: true, data: { closesAt: CLOSES, extended: false } });
    expect(((await solo.getRoom(id1)) as { ok: true; data: Room }).data.myExtend).toBe(true);
    const both = demoFor('chatext@email.com').api;
    const id2 = ((await both.listRooms()) as { ok: true; data: Room[] }).data[0].id;
    expect(await both.setExtend(id2, true)).toEqual({ ok: true, data: { closesAt: CLOSES + 7 * DAY, extended: true } });
  });
  test('신고는 한 번 · 나가기 → 내 목록에서 방이 사라짐(0031) / 차단 → 방이 사라짐', async () => {
    const { api } = demoFor('w5f@email.com');
    const room = ((await api.listRooms()) as { ok: true; data: Room[] }).data[0];
    expect(await api.report(room.id, 'RP4', '')).toEqual({ ok: true });
    expect(await api.report(room.id, 'RP4', '')).toEqual({ ok: false, reason: 'already' });
    expect((await api.leave(room.id)).ok).toBe(true);
    expect(await api.listRooms()).toEqual({ ok: true, data: [] });
    expect((await api.getRoom(room.id)).ok).toBe(false);
    const other = demoFor('w5f2@email.com').api;
    const r2 = ((await other.listRooms()) as { ok: true; data: Room[] }).data[0];
    expect(await other.block(r2.id)).toEqual({ ok: true });
    expect(await other.listRooms()).toEqual({ ok: true, data: [] });
  });
  test('링크는 보내되 주의 표시(caution) · 음성 3MB 넘으면 size', async () => {
    const { api } = demoFor('w5h@email.com');
    const id = ((await api.listRooms()) as { ok: true; data: Room[] }).data[0].id;
    const r = await api.send(id, { clientId: 'a', kind: 'text', body: 'https://example.com 여기 보세요' });
    expect(r.ok && r.data.caution).toBe(true);
    expect(await api.send(id, { clientId: 'b', kind: 'voice', bytes: new Uint8Array(3 * 1024 * 1024 + 1), contentType: 'audio/webm', durationMs: 5_000 })).toEqual({ ok: false, reason: 'size' });
  });
  test('7일이 지나면 데모 시계로 닫힌다(서버 크론 흉내)', async () => {
    const { api, tick } = demoFor('chatlast@email.com');
    const id = ((await api.listRooms()) as { ok: true; data: Room[] }).data[0].id;
    tick(9 * 3_600_000); // 12-30 10:00 → 19:00
    const r = (await api.getRoom(id)) as { ok: true; data: Room };
    expect(r.data.closedReason).toBe('expired');
    expect(r.data.purgeAt).toBe(CLOSES + 30 * DAY);
  });
});

// ── 4. 화면 ─────────────────────────────────────────────────────────────
const fakeMedia = (over: Partial<ChatMedia> = {}): ChatMedia => {
  let t = 0;
  const base = createDemoMedia({ email: () => '', now: () => t });
  return { ...base, ...over, startRecording: over.startRecording ?? (async () => ((t = 0), 'ok')), stopRecording: over.stopRecording ?? (async () => ({ bytes: new Uint8Array(0), contentType: 'audio/webm', durationMs: 5_000, uri: '' })) };
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
async function openRoom(email = 'w5s@email.com', media: ChatMedia = fakeMedia()) {
  const { api } = demoFor(email, { replyMs: 60_000 });
  const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
  const id = rooms.data[0]?.id ?? 'none';
  const tree = await mount(<ChatRoomScreen id={id} api={api} media={media} pollMs={600_000} toastMs={60_000} />);
  await flush();
  return { tree, api, id };
}
const texts = (tree: ReactTestRenderer) => allTexts(tree).join('\n');
// 같은 testID 가 겹쳐 잡히므로(부품 → 안쪽 요소) 이름만 센다
const ids = (tree: ReactTestRenderer, re: RegExp): string[] => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];

describe('W5 화면: 목록', () => {
  test('열린 방 줄: 이름 · 나이 · 지역 · 마지막 글 · 읽지 않은 수 · 누르면 /chat/{id}', async () => {
    const { api } = demoFor('w5l@email.com');
    const tree = await mount(<ChatListScreen api={api} />);
    await flush();
    expect(textOf(tree, 'chat-row-0-head')).toMatch(/^[가-힣]OO · \d+ · /);
    expect(textOf(tree, 'chat-row-0-last')).toBe('주말에 시간이 괜찮으시면 차 한잔 어떠세요. 편하실 때 알려 주세요.');
    expect(has(tree, 'chat-row-0-unread')).toBe(true);
    expect(must(tree, 'chat-row-0-unread').findAll((n) => n.props.children === '1').length).toBeGreaterThan(0);
    await press(tree, 'chat-row-0');
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\/demo-chat-1-\d+$/));
  });
  test('빈 목록 · 불러오기 실패(인터넷) + 다시 시도', async () => {
    const { api } = demoFor('chat0@email.com');
    const empty = await mount(<ChatListScreen api={api} />);
    await flush();
    expect(has(empty, 'chat-list-empty')).toBe(true);
    expect(texts(empty)).toContain(CHAT.list.emptyTitle);
    let fail = true;
    const flaky = { ...api, listRooms: jest.fn(async () => (fail ? { ok: false as const, reason: 'network' as const } : api.listRooms())) } as unknown as ChatApi;
    const tree = await mount(<ChatListScreen api={flaky} />);
    await flush();
    expect(has(tree, 'chat-list-failed')).toBe(true);
    fail = false;
    await press(tree, 'chat-list-retry');
    await flush();
    expect(has(tree, 'chat-list-empty')).toBe(true);
  });
  test('데모 줄: 누르면 다음 장면(마지막 날)', async () => {
    const { api } = demoFor('w5m@email.com');
    const tree = await mount(<ChatListScreen api={api} />);
    await flush();
    expect(texts(tree)).toContain(CHAT.demo.sceneLine(CHAT.demo.scenes.open));
    await press(tree, 'chat-demo-scene');
    await flush();
    expect(texts(tree)).toContain(CHAT.demo.sceneLine(CHAT.demo.scenes.lastDay));
  });
});

describe('W5 화면: 대화방', () => {
  beforeEach(() => {
    mockRouter.back.mockClear();
    takeToast();
  });

  test('열린 방: 위 띠 = 날짜까지(카운트다운 0) · 글 · 사진 · 음성 말풍선 · 글쓰기 줄(사진 · 마이크 · 보내기)', async () => {
    const { tree } = await openRoom();
    expect(textOf(tree, 'chat-room-banner-text')).toBe('12월 30일 수요일 오후 6시까지 열려 있어요.');
    expect(texts(tree)).not.toMatch(/시간 남|분 남|남았어요|서두르|곧 닫/);
    expect(ids(tree, /^chat-msg-\d+-photo$/).length).toBeGreaterThan(0);
    expect(ids(tree, /^chat-msg-\d+-voice$/).length).toBe(1);
    for (const id of ['chat-composer-photo', 'chat-composer-voice', 'chat-composer-input', 'chat-composer-send']) expect(has(tree, id)).toBe(true);
    expect(must(tree, 'chat-composer-send').props.disabled).toBe(true); // 빈 글
  });

  test('글 보내기 → 내 말풍선이 생기고 칸이 비워진다 · 막힌 표현은 이유 + 다시 보내기 · 지우기', async () => {
    const { tree } = await openRoom();
    const before = ids(tree, /^chat-msg-\d+$/).length;
    await typeInto(tree, 'chat-composer-input', '안녕하세요. 토요일 오후 괜찮아요.');
    await press(tree, 'chat-composer-send');
    await flush();
    expect(texts(tree)).toContain('안녕하세요. 토요일 오후 괜찮아요.');
    expect(must(tree, 'chat-composer-input').props.value).toBe('');
    await typeInto(tree, 'chat-composer-input', '계좌로 송금해 주세요');
    await press(tree, 'chat-composer-send');
    await flush();
    const failed = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.endsWith('-fail-text'));
    expect(failed.map((n) => textOf(tree, n.props.testID))).toContain(CHAT.send.blocked);
    const discard = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.endsWith('-discard'))[0];
    await press(tree, discard.props.testID);
    const after = ids(tree, /^chat-msg-\d+$/).length;
    expect(after).toBe(before + 1);
  });

  test('너무 긴 글은 보내지 않고 칸 아래 이유', async () => {
    const { tree } = await openRoom();
    await typeInto(tree, 'chat-composer-input', '가'.repeat(TEXT_MAX + 1));
    await press(tree, 'chat-composer-send');
    expect(textOf(tree, 'chat-composer-error')).toBe(CHAT.composer.tooLong(TEXT_MAX));
  });

  test('음성: 마이크 → 녹음 줄(취소 · 시간 · 보내기) → 보내기 → 음성 말풍선 하나 더 / 1초 미만은 보내지 않음', async () => {
    const { tree } = await openRoom();
    await press(tree, 'chat-composer-voice');
    expect(has(tree, 'chat-composer-recording')).toBe(true);
    expect(textOf(tree, 'chat-composer-rec-time')).toBe('녹음 중 0:00');
    await press(tree, 'chat-composer-rec-send');
    await flush();
    expect(ids(tree, /^chat-msg-\d+-voice$/).length).toBe(2);
    const short = await openRoom('w5t@email.com', fakeMedia({ stopRecording: async () => ({ bytes: new Uint8Array(0), contentType: 'audio/webm', durationMs: 400, uri: '' }) }));
    await press(short.tree, 'chat-composer-voice');
    await press(short.tree, 'chat-composer-rec-send');
    await flush();
    expect(texts(short.tree)).toContain(CHAT.voice.tooShort);
  });

  test('음성 재생: 누르면 멈춤 단추로 · 다시 누르면 멈춤', async () => {
    const { tree } = await openRoom();
    const play = tree.root.findAll((n) => typeof n.props.testID === 'string' && /^chat-msg-\d+-play$/.test(n.props.testID))[0];
    expect(play.props.accessibilityLabel).toBe(CHAT.voice.play);
    await press(tree, play.props.testID);
    expect(must(tree, play.props.testID).props.accessibilityLabel).toBe(CHAT.voice.pause);
    await press(tree, play.props.testID);
    expect(must(tree, play.props.testID).props.accessibilityLabel).toBe(CHAT.voice.play);
  });

  test('사진: 고르면 바로 보냄 · 누르면 크게 보기', async () => {
    const { tree } = await openRoom();
    const count = () => ids(tree, /^chat-msg-\d+-photo$/).length;
    const n0 = count();
    await press(tree, 'chat-composer-photo');
    await flush();
    expect(count()).toBe(n0 + 1);
    await press(tree, ids(tree, /^chat-msg-\d+-photo$/)[0]);
    expect(sheetOpen(tree, 'chat-viewer')).toBe(true);
  });

  test('사진 · 음성을 할 수 없는 기기(패키지 설치 전 iOS · Android)는 단추가 없고 글은 된다', async () => {
    const { tree } = await openRoom('w5u@email.com', { ...fakeMedia(), photo: false, voice: false });
    expect(has(tree, 'chat-composer-photo')).toBe(false);
    expect(has(tree, 'chat-composer-voice')).toBe(false);
    expect(has(tree, 'chat-composer-input')).toBe(true);
  });

  test('연장: 메뉴 → 7일 연장하기 → [연장을 원해요] → 혼자면 안내 · 띠가 바뀌고 [연장 원하지 않기]', async () => {
    const { tree } = await openRoom();
    await press(tree, 'chat-room-more');
    expect(sheetOpen(tree, 'chat-menu')).toBe(true);
    await press(tree, 'chat-menu-extend');
    expect(textOf(tree, 'chat-extend-body')).toBe(CHAT.extend.body);
    await press(tree, 'chat-extend-want');
    await flush();
    expect(texts(tree)).toContain(CHAT.extend.wantNote);
    expect(textOf(tree, 'chat-room-banner-text')).toBe(CHAT.extend.wantNote);
    await press(tree, 'chat-room-banner-action');
    expect(has(tree, 'chat-extend-undo')).toBe(true);
  });

  test('연장: 상대도 원한 장면이면 7일 더 열리고 띠 날짜가 1월 6일로', async () => {
    const { tree } = await openRoom('chatext@email.com');
    await press(tree, 'chat-room-banner-action');
    await press(tree, 'chat-extend-want');
    await flush();
    expect(texts(tree)).toContain(CHAT.extend.extendedToast);
    expect(textOf(tree, 'chat-room-banner-text')).toBe('1월 6일 수요일 오후 6시까지 열려 있어요.');
  });

  test('나가기: 확인창 → 목록으로(내 목록에서 방이 사라짐) · 토스트를 넘긴다', async () => {
    mockRouter.back.mockClear();
    const { tree, api } = await openRoom();
    await press(tree, 'chat-room-more');
    await press(tree, 'chat-menu-leave');
    expect(sheetOpen(tree, 'chat-leave')).toBe(true);
    await press(tree, 'chat-leave-confirm');
    await flush();
    expect(mockRouter.back).toHaveBeenCalled();
    expect(takeToast()).toBe(CHAT.leave.done);
    expect(await api.listRooms()).toEqual({ ok: true, data: [] });
  });

  test('상대가 나간 방: 가운데 줄 "상대가 대화를 마쳤어요." · 읽기만', async () => {
    const { tree } = await openRoom('chatleft@email.com');
    expect(texts(tree)).toContain(CHAT.system.partnerLeft);
    expect(has(tree, 'chat-composer')).toBe(false);
    expect(textOf(tree, 'chat-room-closed-body')).toContain('상대가 대화를 마쳤어요.');
  });

  test('상대의 연장 요청 시스템 글은 그리지 않는다(재촉 0)', async () => {
    const { tree } = await openRoom('chatext@email.com');
    expect(texts(tree)).not.toContain(CHAT.system.extendRequested);
  });

  test('받은 링크 글 아래 주의 한 줄(내 글에는 없음)', async () => {
    const base: Message = { id: '9', clientId: null, mine: false, kind: 'text', body: 'www.example.com', mediaId: null, durationMs: null, caution: true, createdAt: OPENED, purged: false };
    const theirs = await mount(<MessageBubble message={base} mediaUri={null} testID="m" />);
    expect(textOf(theirs, 'm-caution')).toBe(CHAT.send.caution);
    const mine = await mount(<MessageBubble message={{ ...base, mine: true }} mediaUri={null} testID="m" />);
    expect(has(mine, 'm-caution')).toBe(false);
  });

  test('닫힌 방(7일 지남): 읽기만 · 위 띠 없음 · 메뉴는 신고 · 차단만', async () => {
    const { tree } = await openRoom('chatclosed@email.com');
    expect(has(tree, 'chat-composer')).toBe(false);
    expect(has(tree, 'chat-room-banner')).toBe(false);
    expect(textOf(tree, 'chat-room-closed-body')).toBe(CHAT.room.closedExpired('1월 29일 금요일'));
    await press(tree, 'chat-room-more');
    expect(has(tree, 'chat-menu-extend')).toBe(false);
    expect(has(tree, 'chat-menu-leave')).toBe(false);
    expect(has(tree, 'chat-menu-safety')).toBe(true);
  });

  test('차단: 공용 신고 · 차단 시트 → 차단하기 → 목록으로 돌아가며 토스트를 넘긴다', async () => {
    const { tree, api } = await openRoom();
    await press(tree, 'chat-room-more');
    await press(tree, 'chat-menu-safety');
    expect(sheetOpen(tree, 'chat-report-menu')).toBe(true);
    await press(tree, 'chat-report-menu-block');
    await press(tree, 'chat-report-block-confirm-confirm');
    await flush();
    expect(mockRouter.back).toHaveBeenCalled();
    expect(takeToast()).toBe(REPORT_SHEET.blockDone);
    expect(await api.listRooms()).toEqual({ ok: true, data: [] });
  });

  test('없는 방(차단됨 · 남의 방)은 "더 이상 볼 수 없어요"', async () => {
    const { api } = demoFor('w5g@email.com');
    const tree = await mount(<ChatRoomScreen id="demo-chat-x" api={api} media={fakeMedia()} pollMs={600_000} />);
    await flush();
    expect(has(tree, 'chat-room-gone')).toBe(true);
  });
});

describe('W5 동작 줄이기', () => {
  afterEach(() => act(() => reduceMotionStore.set(false)));
  test('새로 온 말풍선은 8 올라오며 나타남 · 동작 줄이기면 이동 0(투명도만)', async () => {
    const transformOf = (tree: ReactTestRenderer) => {
      const bubbles = tree.root.findAll((n) => typeof n.props.testID === 'string' && /^chat-msg-\d+$/.test(n.props.testID));
      const last = bubbles[bubbles.length - 1];
      let node = last.parent;
      while (node && !(node.props.style && StyleSheet.flatten(node.props.style)?.transform)) node = node.parent;
      return node ? StyleSheet.flatten(node.props.style).transform : null;
    };
    const normal = await openRoom();
    await typeInto(normal.tree, 'chat-composer-input', '움직임 확인');
    await press(normal.tree, 'chat-composer-send');
    await flush();
    expect(JSON.stringify(transformOf(normal.tree))).toContain('translateY');
    act(() => reduceMotionStore.set(true));
    const calm = await openRoom('w5r@email.com');
    await typeInto(calm.tree, 'chat-composer-input', '움직임 확인');
    await press(calm.tree, 'chat-composer-send');
    await flush();
    expect(JSON.stringify(transformOf(calm.tree))).toBe('[{"translateY":0}]');
  });
});

// ── 5. 글 규칙 ───────────────────────────────────────────────────────────
describe('W5 글 규칙: 해요체 · 느낌표 0 · 재촉 0 · 점수 말 0', () => {
  const strings: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') strings.push(v);
    else if (typeof v === 'function') {
      const out = (v as (...a: unknown[]) => unknown)('○', '○');
      if (typeof out === 'string') strings.push(out);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(CHAT);
  test('느낌표 0 · 재촉 말 0 · 점수 · 순위 · 등급 말 0', () => {
    for (const s of strings) {
      expect(s).not.toMatch(/!|！/);
      expect(s).not.toMatch(/서두르|마감 임박|곧 닫|남았어요|놓치지|지금 바로|점수|순위|등급/);
    }
  });
  test('문장은 해요체로 끝난다(마침표 · 물음 없는 짧은 이름 · 버튼 글은 제외)', () => {
    const sentences = strings.flatMap((s) => s.split(/(?<=[.?])\s+/)).filter((s) => /[.?]$/.test(s));
    for (const s of sentences) expect(s).toMatch(/(요|요\?)[.]?$|요\.$/);
  });
});
