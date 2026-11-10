// QF2-B6 — 서버 0057(Q2-13 연장 · Q2-03 마지막 날 알림) 뒤의 대화방.
//  보는 것: ① 서버가 이제 extend.partner 키와 상대의 extend_requested 시스템 글을 보내지 않는다 — 앱이 그 값 없이도 안 깨지고, 옛 값이 와도 상대가 연장을 골랐는지 화면에 드러나지 않는다
//          ② 마지막 날 알림의 서버 고정 글(글표 Q2-03-05 · 06)과 앱 안내(띠 · 메뉴 · 설정 줄)가 같은 말을 한다 · notify_chat 을 끄면 두 알림이 멈춘다는 설명이 맞다
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { NOTIFY } from '@/content/settingsCopy';
import { CHAT } from '@/features/chat/chatCopy';
import { parseRoom, parseMessage, type ChatApi, type Message, type Room } from '@/features/chat/chatApi';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { createDemoMedia } from '@/features/chat/chatMedia';
import { isLastDay, openLine, systemLine } from '@/features/chat/chatLogic';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import type { InflightApi } from '@/features/inflight/inflightApi';

import { allTexts, has, mount, press, textOf } from './renderHelpers';

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

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});

const at = (iso: string) => Date.parse(iso);
const OPENED = at('2026-12-23T18:00:00+09:00');
const CLOSES = at('2026-12-30T18:00:00+09:00');

// ── 서버 응답 읽기 ───────────────────────────────────────────────────────────
describe('Q2-13 연장: 서버가 상대 선택을 더는 보내지 않는다', () => {
  const room = (extend: unknown) => ({
    room_id: 'r1', state: 'open', opened_at: new Date(OPENED).toISOString(), closes_at: new Date(CLOSES).toISOString(), close_reason: null,
    ...(extend === undefined ? {} : { extend }), extend_count: 0, partner: { user_id: 'u2', name: '문OO' },
    last_message: { kind: 'text', mine: false, preview: '안녕하세요', created_at: new Date(OPENED).toISOString() }, unread: 0,
  });

  test('방 읽기: extend 에 me 만 있어도 · extend 키가 통째로 없어도 안 깨지고, 내 선택(myExtend)만 읽는다', () => {
    expect(parseRoom(room({ me: true }))).toMatchObject({ id: 'r1', myExtend: true, partner: { id: 'u2' } });
    expect(parseRoom(room({ me: false }))).toMatchObject({ myExtend: false });
    expect(parseRoom(room(undefined))).toMatchObject({ myExtend: false });
    expect(parseRoom(room({}))).toMatchObject({ myExtend: false });
    expect(parseRoom(room(null))).toMatchObject({ myExtend: false });
  });

  test('옛 응답(extend.partner 가 실린 모양)이 와도 상대 선택을 쥐지 않는다 — 방 값 어디에도 상대 연장이 없다', () => {
    const old = parseRoom(room({ me: false, partner: true })) as Room;
    const none = parseRoom(room({ me: false })) as Room;
    expect(old).toEqual(none); // 있어도 없어도 같은 값
    expect(JSON.stringify(old)).not.toMatch(/partnerExtend|theirExtend|extend_requested|"partner":true/);
    expect(Object.keys(old)).not.toEqual(expect.arrayContaining(['partnerExtend']));
  });

  test('시스템 글: 상대의 extend_requested · extend_cancelled 는 그리지 않는다(내 쪽만 한 줄) · 열림 · 연장됨 · 닫힘 · 나감만 가운데 줄', () => {
    expect(systemLine('extend_requested', false)).toBeNull();
    expect(systemLine('extend_cancelled', false)).toBeNull();
    expect(systemLine('extend_requested', true)).toBe(CHAT.system.extendRequested);
    expect(systemLine('extend_cancelled', true)).toBe(CHAT.system.extendCancelled);
    expect(systemLine('extended', true)).toBe(CHAT.system.extended);
    expect(systemLine('extended', false)).toBe(CHAT.system.extended); // 둘 다 고른 뒤에야 알려진다 — 서버가 두 분 모두에게 보낸다
    expect(parseMessage({ id: 21, kind: 'system', body: 'extend_requested', mine: false, created_at: new Date(OPENED).toISOString() })).toMatchObject({ kind: 'system', mine: false });
  });
});

// ── 화면 ────────────────────────────────────────────────────────────────────
const NOW = at('2026-12-30T10:00:00+09:00'); // 마지막 날(닫는 날 18:00 정각)
function demoApi(email: string, now = NOW) {
  return createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: 60_000, clock: () => now });
}
async function mountRoom(api: ChatApi) {
  const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
  const id = rooms.data[0].id;
  const if2 = { api: { openerChips: async () => ({ ok: true as const, data: { show: false, chips: [] } }) } as unknown as InflightApi, isOn: () => false, notes: createDeviceNotes() };
  const media = createDemoMedia({ email: () => '', now: () => 0 });
  const tree = await mount(<ChatRoomScreen id={id} api={api} media={media} pollMs={600_000} toastMs={60_000} if2={if2} />);
  mounted.push(tree);
  await flush();
  return { tree, id };
}
// 옛 서버가 상대 쪽에서 보내던 시스템 글(extend_requested, mine=false) — 지금 서버는 안 보내지만 옛 방 · 옛 응답에 남아 있어도 화면은 같아야 한다
const OLD_PARTNER_EXTEND: Message = { id: '9001', clientId: null, mine: false, kind: 'system', body: 'extend_requested', mediaId: null, durationMs: null, caution: false, createdAt: at('2026-12-25T19:45:00+09:00'), purged: false }; // 데모 방의 마지막 글(12월 25일) 같은 날 — 날짜 줄이 새로 생기지 않게
function withOldLine(api: ChatApi): ChatApi {
  return { ...api, listMessages: async (id, before) => { const r = await api.listMessages(id, before); return r.ok ? { ok: true as const, data: [...r.data, OLD_PARTNER_EXTEND] } : r; } };
}

describe('대화방 화면: 상대가 연장을 골랐는지 드러나지 않는다', () => {
  test('상대가 이미 원한 장면(chatext): 서버 모양 그대로 — 글 목록에 상대의 extend_requested 가 없고 띠 · 시트 어디에도 상대 선택 말이 없다', async () => {
    const api = demoApi('chatext@email.com', at('2026-12-29T21:00:00+09:00'));
    const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
    const msgs = (await api.listMessages(rooms.data[0].id)) as { ok: true; data: Message[] };
    expect(msgs.data.filter((m) => m.kind === 'system' && m.body === 'extend_requested')).toEqual([]); // 서버가 안 보낸다
    const { tree } = await mountRoom(api);
    expect(textOf(tree, 'chat-room-banner-text')).not.toBe(CHAT.extend.wantNote); // 내가 안 골랐으면 내 안내도 없다
    await press(tree, 'chat-room-banner-action');
    expect(textOf(tree, 'chat-extend-body')).toBe(CHAT.extend.body);
    expect(allTexts(tree).join(' ')).not.toMatch(/상대(가|는)[^.]*(원했|골랐|원한다고)|연장을 원한다고 골랐/); // 시트 설명의 "상대가 원하는지는 둘 다 고른 뒤에 알 수 있어요"는 사실 안내라 걸리지 않는다
    expect(allTexts(tree)).not.toContain(CHAT.system.extendRequested);
  });

  test('옛 시스템 글이 목록에 섞여 와도 화면 글이 한 글자도 달라지지 않는다(있을 때 = 없을 때)', async () => {
    const plain = await mountRoom(demoApi('chatext@email.com', at('2026-12-29T21:00:00+09:00')));
    const withOld = await mountRoom(withOldLine(demoApi('chatext@email.com', at('2026-12-29T21:00:00+09:00'))));
    expect(allTexts(withOld.tree)).toEqual(allTexts(plain.tree));
    expect(allTexts(withOld.tree)).not.toContain(CHAT.system.extendRequested);
  });

  test('서버가 extend 키 없이 준 방(0057 모양)을 그대로 읽어도 방이 열리고 [연장 알아보기] · 메뉴 연장 줄이 그대로 있다', async () => {
    const base = demoApi('chatopen@email.com', at('2026-12-26T10:00:00+09:00'));
    const via: ChatApi = {
      ...base,
      getRoom: async (id) => {
        const r = await base.getRoom(id);
        if (!r.ok) return r;
        const raw = { room_id: r.data.id, state: 'open', opened_at: new Date(r.data.openedAt).toISOString(), closes_at: new Date(r.data.closesAt).toISOString(), close_reason: null, extend_count: 0, partner: { user_id: r.data.partner.id, name: r.data.partner.name }, unread: 0 };
        const parsed = parseRoom(raw);
        return parsed ? { ok: true as const, data: { ...parsed, partner: r.data.partner } } : { ok: false as const, reason: 'server' as const };
      },
    };
    const { tree } = await mountRoom(via);
    expect(has(tree, 'chat-room-banner-action')).toBe(true);
    await press(tree, 'chat-room-banner-action');
    expect(textOf(tree, 'chat-extend-body')).toBe(CHAT.extend.body); // 내가 안 골랐다 — 상대 쪽은 알 길이 없다
    expect(has(tree, 'chat-extend-want')).toBe(true);
    expect(has(tree, 'chat-extend-undo')).toBe(false);
  });

  test('연장 시트의 설명이 "상대가 원하는지는 둘 다 고른 뒤에 알 수 있어요"를 밝힌다 · 둘 다 고르면 그때 "둘 다 원해서 7일 더 열렸어요"', () => {
    expect(CHAT.extend.body).toContain('상대가 원하는지는 둘 다 고른 뒤에 알 수 있어요');
    expect(CHAT.room.extendedNote).toBe('둘 다 원해서 7일 더 열렸어요.');
  });
});

// ── 마지막 날 알림 ───────────────────────────────────────────────────────────
// 서버 고정 글: backend/S21_변경기록.md 6-1 Q2-03 · 글표 Q2-03-05 · 06 — DB 에 고정돼 있어 바꾸려면 새 이관이다. 여기에 글자 그대로 적어 어긋나면 잡는다
const SERVER_PUSH = { title: '대화방이 오늘 닫혀요', body: '오늘 오후 6시까지 열려 있어요. 연장은 대화방 메뉴에서 고를 수 있어요.' } as const;

describe('Q2-03 마지막 날: 서버 알림 글 ↔ 앱 안내', () => {
  test('서버 알림 제목 · 본문 = 앱 띠 글과 같은 말 — 띠 읽기 이름은 제목 + "오후 6시까지 열려 있어요", 띠 첫 줄은 본문 앞 문장 그대로', () => {
    expect(CHAT.room.lastDayA11y).toBe(`${SERVER_PUSH.title}. 오후 6시까지 열려 있어요.`);
    expect(SERVER_PUSH.body.startsWith(CHAT.room.lastDay)).toBe(true);
    expect(SERVER_PUSH.body.slice(CHAT.room.lastDay.length).trim()).toBe('연장은 대화방 메뉴에서 고를 수 있어요.');
    expect([...SERVER_PUSH.title].length).toBeLessThanOrEqual(20);
    expect([...SERVER_PUSH.body].length).toBeLessThanOrEqual(60);
    expect(`${SERVER_PUSH.title} ${SERVER_PUSH.body}`).not.toMatch(/[!！]|서둘|서두르|곧|마지막|남았|분 뒤|상대|이름|님/); // 겁주기 · 카운트다운 · 상대 이름 · 글 내용 0
  });

  test('알림 본문이 가리키는 "대화방 메뉴"에 연장 줄이 실제로 있다 — 마지막 날에 ⋯ 메뉴를 열면 [7일 연장하기]', async () => {
    expect(isLastDay(CLOSES, NOW)).toBe(true);
    expect(openLine(CLOSES, NOW)).toBe(CHAT.room.lastDay);
    const { tree } = await mountRoom(demoApi('chatlast@email.com'));
    expect(textOf(tree, 'chat-room-banner-text')).toBe(CHAT.room.lastDay);
    await press(tree, 'chat-room-more');
    expect(has(tree, 'chat-menu-extend')).toBe(true);
    expect(allTexts(tree)).toContain(CHAT.menu.extend);
    expect(CHAT.room.headerA11yMore).toBe('대화방 메뉴');
  });

  test('설정 알림 줄: "대화방 알림" 하나가 새 글 알림과 마지막 날 알림을 함께 끈다고 말한다(서버: notify_chat 끈 사람은 마지막 날 알림에서도 빠짐) · 줄을 새로 늘리지 않는다', () => {
    expect(NOTIFY.chat).toBe('대화방 알림');
    expect(NOTIFY.chatNote).toContain('새 글이 왔을 때');
    expect(NOTIFY.chatNote).toContain('대화방이 닫히는 날 아침');
    expect(NOTIFY.chatNote).toContain('글 내용은 알림에 보이지 않아요');
    expect(NOTIFY.pushPrime).toContain('대화방이 닫히는 날 아침에 알려 드려요'); // 동의문구 5-5 — 알림 권한을 처음 묻기 전 안내
    expect(NOTIFY.pushPrime).toContain('알림에는 글 내용을 보여 주지 않아요');
    expect(Object.keys(NOTIFY).filter((k) => /last|closing/i.test(k))).toEqual([]); // 마지막 날 알림만의 켜고 끄는 줄은 없다
    expect(NOTIFY.chat).not.toMatch(/새 글만|마지막/);
  });
});
