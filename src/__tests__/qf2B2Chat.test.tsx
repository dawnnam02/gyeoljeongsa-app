// QF2-B2 — 첫마디 길(Q2-02 · Q2-08 · Q2-13) · 마지막 날 안내(Q2-03 앱) · 안심 공유 줄(Q2-10h)
//  보는 것: 칩은 입력창만 채움(자동 전송 0) · 호감 · 저장 호출 0 · 방이 열려 있을 때만 · 주소에 글이 안 남음 · 마지막 날에 연장을 골라도 첫 줄이 그대로
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { FIRST_FROM_CARD, OPENER_PATH, PROMPT_START } from '@/content/qf2Copy';
import { CHAT } from '@/features/chat/chatCopy';
import type { Room } from '@/features/chat/chatApi';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { createDemoMedia } from '@/features/chat/chatMedia';
import { isLastDay, openLine } from '@/features/chat/chatLogic';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { cardParts, clearHandoff, frontOf, handOff, hasContactShape, peekHandoff, variantOf } from '@/features/chat/openerPath';
import { OpenerChips } from '@/features/inflight/ChatIf2';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import type { InflightApi } from '@/features/inflight/inflightApi';
import { tx } from '@/features/inflight/if2Text';
import { OpenerEntry } from '@/features/boarding/OpenerEntry';
import { PromptCards } from '@/features/recs/PromptCards';

import { has, isOpen as sheetOpen, mount, must, press, textOf } from './renderHelpers';

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
  mockRouter.push.mockClear();
  clearHandoff('r1');
});

// ── 1. 글 만들기 · 건넴 (순수) ─────────────────────────────────────────────
describe('첫마디 길: 글 만들기와 건넴', () => {
  test('답 앞부분: 14자 안이면 그대로 · 넘으면 단어 끝에서 자르고 … · 첫 단어가 14자를 넘으면 문장 없음', () => {
    expect(frontOf('주말에는 산책해요')).toBe('주말에는 산책해요');
    expect(frontOf('주말에는 근처 공원에서 오래 산책하는 걸 좋아해요')).toBe('주말에는 근처 공원에서…');
    expect(frontOf('가나다라마바사아자차카타파하하하')).toBeNull();
    expect(frontOf('   ')).toBeNull();
    expect(frontOf('첫 줄이에요\n둘째 줄은 안 써요')).toBe('첫 줄이에요');
  });
  test('연락처 · 링크 · 아이디 꼴이 섞인 답은 카드 문장을 만들지 않는다(일반 칩만)', () => {
    expect(hasContactShape('연락은 010-1234-5678로 주세요')).toBe(true);
    expect(hasContactShape('제 블로그는 www.example.com 이에요')).toBe(true);
    expect(cardParts({ question: '주말에 뭐 해요?', answer: '010 1234 5678' })).toBeNull();
    expect(cardParts({ question: '주말에 뭐 해요?', answer: '산책하고 책 읽어요' })).toEqual({ answerFront: '산책하고 책 읽어요', questionFront: '주말에 뭐 해요?' });
  });
  test('A · B 는 방 번호로 정해진다(같은 방은 늘 같은 쪽)', () => {
    expect(variantOf('room-1')).toBe(variantOf('room-1'));
    const sides = new Set(['a1', 'a2', 'a3', 'b1', 'b2', 'zz', 'room-9', 'room-10'].map(variantOf));
    expect(sides.size).toBe(2);
  });
  test('건넴: 방이 맞을 때만 읽히고 30초가 지나면 버려지며 지우면 사라진다(주소 0)', () => {
    handOff({ roomId: 'r1', draft: '안녕하세요' }, 1_000);
    expect(peekHandoff('r1', 2_000)).toMatchObject({ roomId: 'r1', draft: '안녕하세요' });
    expect(peekHandoff('r1', 2_000)).toMatchObject({ draft: '안녕하세요' }); // 읽어도 안 사라짐(개발 모드 두 번 그리기)
    expect(peekHandoff('other', 2_000)).toBeNull();
    expect(peekHandoff('r1', 1_000 + 30_001)).toBeNull();
    clearHandoff('other');
    expect(peekHandoff('r1', 2_000)).not.toBeNull();
    clearHandoff('r1');
    expect(peekHandoff('r1', 2_000)).toBeNull();
  });
  test('새 글에 점수 · 서열 · 재촉 · 마음 표현 낱말이 없다', () => {
    const all = [OPENER_PATH.entry, OPENER_PATH.carry, PROMPT_START.btn, PROMPT_START.a11y('질문'), PROMPT_START.failed, FIRST_FROM_CARD.chipA('답'), FIRST_FROM_CARD.chipB('답'), FIRST_FROM_CARD.chipA11y('칩'), FIRST_FROM_CARD.band('질문'), FIRST_FROM_CARD.bandA11y('질문')].join('\n');
    expect(all).not.toMatch(/점수|등급|순위|서둘|빨리|지금 바로|좋아요|설레|마음에 들|먼저 말|놓치|!/);
  });
});

// ── 2. 대화방 칩 ─────────────────────────────────────────────────────────
const noChipsApi = { openerChips: async () => ({ ok: true as const, data: { show: true, chips: [] } }) } as unknown as InflightApi;
const chipsDeps = (isOn: (k: string) => boolean = () => true) => ({ api: noChipsApi, isOn, notes: createDeviceNotes() });

describe('첫마디 길: 대화방 칩', () => {
  test('카드에서 온 길: 확인 띠 + 첫 칩이 카드 답 문장 · 누르면 입력창에 넣을 글만 돌려주고 보내지 않는다', async () => {
    const onChip = jest.fn();
    const send = jest.fn();
    const tree = await mount(<OpenerChips roomId="r1" roundNo={1} wrote={false} deps={chipsDeps()} onChip={onChip} onPostcard={send} card={{ question: '주말에는 뭐 하세요?', answer: '산책하고 책 읽어요' }} />);
    mounted.push(tree);
    await flush();
    const text = (variantOf('r1') === 'a' ? FIRST_FROM_CARD.chipA : FIRST_FROM_CARD.chipB)('산책하고 책 읽어요');
    expect(textOf(tree, 'if2-chips-band')).toBe(FIRST_FROM_CARD.band('주말에는 뭐 하세요?'));
    expect(must(tree, 'if2-chips-band').props.accessibilityLabel).toBe(FIRST_FROM_CARD.bandA11y('주말에는 뭐 하세요?'));
    expect(must(tree, 'if2-chips-card').props.label ?? must(tree, 'if2-chips-card').props.accessibilityLabel).toBeTruthy();
    await press(tree, 'if2-chips-card');
    expect(onChip).toHaveBeenCalledWith(text);
    expect(send).not.toHaveBeenCalled(); // 엽서 · 전송 길을 안 지남
  });
  test('칩 문장을 못 만들면(연락처 꼴) 띠도 카드 칩도 없다 · 내 첫 글 뒤에는 칩과 띠가 함께 사라진다', async () => {
    const bad = await mount(<OpenerChips roomId="r1" roundNo={1} wrote={false} deps={chipsDeps()} onChip={jest.fn()} onPostcard={jest.fn()} card={{ question: '연락처가 뭐예요?', answer: '010-1234-5678' }} />);
    mounted.push(bad);
    await flush();
    expect(has(bad, 'if2-chips')).toBe(false);
    const wrote = await mount(<OpenerChips roomId="r1" roundNo={1} wrote deps={chipsDeps()} onChip={jest.fn()} onPostcard={jest.fn()} card={{ question: '주말에는 뭐 하세요?', answer: '산책해요' }} />);
    mounted.push(wrote);
    await flush();
    expect(has(wrote, 'if2-chips')).toBe(false);
    expect(has(wrote, 'if2-chips-band')).toBe(false);
  });
  test('opener_chips 가 꺼져 있어도 카드에서 온 칩은 보이고 서버 칩은 부르지 않는다', async () => {
    const api = { openerChips: jest.fn(async () => ({ ok: true as const, data: { show: true, chips: [] } })) } as unknown as InflightApi;
    const tree = await mount(<OpenerChips roomId="r1" roundNo={1} wrote={false} deps={{ api, isOn: () => false, notes: createDeviceNotes() }} onChip={jest.fn()} onPostcard={jest.fn()} card={{ question: '주말에는 뭐 하세요?', answer: '산책해요' }} />);
    mounted.push(tree);
    await flush();
    expect(has(tree, 'if2-chips-card')).toBe(true);
    expect((api as unknown as { openerChips: jest.Mock }).openerChips).not.toHaveBeenCalled();
  });
});

// ── 3. 공개 순간 입구 ────────────────────────────────────────────────────
const chipsApi = (over: Partial<{ ok: boolean; show: boolean }> = {}) =>
  ({
    openerChips: jest.fn(async () => (over.ok === false ? { ok: false as const, code: 'failed' as const } : { ok: true as const, data: { show: over.show ?? true, chips: [{ id: 'ch-01', hobby: null }] } })),
  }) as unknown as InflightApi;

describe('첫마디 길: 공개 순간(T3) 입구', () => {
  test('입구 글자 단추 → 시트(이야깃거리 · 안내 한 줄) → 칸을 누르면 글만 넘기고 닫힌다(보내지 않음)', async () => {
    const onPick = jest.fn();
    const tree = await mount(<OpenerEntry roomId="r1" deps={{ api: chipsApi(), isOn: () => true }} onPick={onPick} />);
    mounted.push(tree);
    await flush();
    expect(has(tree, 'reveal-opener-entry')).toBe(true);
    expect(must(tree, 'reveal-opener-entry').props.label).toBe(OPENER_PATH.entry);
    await press(tree, 'reveal-opener-entry');
    await flush();
    expect(sheetOpen(tree, 'reveal-opener-sheet')).toBe(true);
    expect(textOf(tree, 'reveal-opener-carry')).toBe(OPENER_PATH.carry);
    await press(tree, 'reveal-opener-pick-0');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(typeof onPick.mock.calls[0][0]).toBe('string');
    expect(sheetOpen(tree, 'reveal-opener-sheet')).toBe(false);
  });
  test('스위치 꺼짐 · 서버가 줄을 안 줌(show false) · 못 불러옴이면 입구가 없다', async () => {
    for (const [isOn, over] of [[() => false, {}], [() => true, { show: false }], [() => true, { ok: false }]] as const) {
      const tree = await mount(<OpenerEntry roomId="r1" deps={{ api: chipsApi(over), isOn }} onPick={jest.fn()} />);
      mounted.push(tree);
      await flush();
      expect(has(tree, 'reveal-opener-entry')).toBe(false);
    }
  });
});

// ── 4. 프로필 질문 카드 단추 ────────────────────────────────────────────
describe('첫마디 길: 상대 프로필 질문 카드 단추', () => {
  const cards = [
    { code: 'Q01', question: '주말에는 뭐 하세요?', answer: '산책해요' },
    { code: 'Q02', question: '요즘 빠진 것은요?', answer: '커피 내리기' },
  ];
  test('onStart 가 없으면(방 없음 · 닫힘 · 이미 첫 글 · 스위치 꺼짐) 단추가 없다', async () => {
    const tree = await mount(<PromptCards prompts={cards} noteHidden />);
    mounted.push(tree);
    expect(has(tree, 'candidate-prompts-0-start')).toBe(false);
  });
  test('onStart 가 있으면 카드마다 같은 글 · 같은 자리 단추 · 누르면 그 카드를 넘기고 카드에는 표시가 남지 않는다', async () => {
    const onStart = jest.fn();
    const tree = await mount(<PromptCards prompts={cards} noteHidden onStart={onStart} />);
    mounted.push(tree);
    expect(must(tree, 'candidate-prompts-0-start').props.label).toBe(PROMPT_START.btn);
    expect(must(tree, 'candidate-prompts-1-start').props.label).toBe(PROMPT_START.btn);
    expect(must(tree, 'candidate-prompts-1-start').props.accessibilityLabel).toBe(PROMPT_START.a11y('요즘 빠진 것은요?'));
    await press(tree, 'candidate-prompts-1-start');
    expect(onStart).toHaveBeenCalledWith(cards[1]);
    expect(textOf(tree, 'candidate-prompts-1-a')).toBe('커피 내리기'); // 선택됨 표시 0
  });
});

// ── 5. 마지막 날 안내 · 연장 · 안심 공유 (대화방) ───────────────────────────
const at = (iso: string) => Date.parse(iso);
const demoRoom = async (email: string, flags: Record<string, boolean> = { safe_share: true }) => {
  const clock = at('2026-12-30T10:00:00+09:00');
  const api = createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: 60_000, clock: () => clock });
  const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
  const id = rooms.data[0].id;
  const if2 = { api: { openerChips: async () => ({ ok: true as const, data: { show: false, chips: [] } }) } as unknown as InflightApi, isOn: (k: string) => !!flags[k], notes: createDeviceNotes() };
  const media = createDemoMedia({ email: () => '', now: () => 0 });
  const tree = await mount(<ChatRoomScreen id={id} api={api} media={media} pollMs={600_000} toastMs={60_000} if2={if2} />);
  mounted.push(tree);
  await flush();
  return { tree, api, id };
};

describe('마지막 날 안내 · 안심 공유 줄', () => {
  test('마지막 날 판정: 닫는 날이 오늘이고 18:00 정각일 때만', () => {
    const closes = at('2026-12-30T18:00:00+09:00');
    expect(isLastDay(closes, at('2026-12-30T10:00:00+09:00'))).toBe(true);
    expect(isLastDay(closes, at('2026-12-29T10:00:00+09:00'))).toBe(false);
    expect(isLastDay(at('2026-12-30T17:30:00+09:00'), at('2026-12-30T10:00:00+09:00'))).toBe(false);
    expect(openLine(closes, at('2026-12-30T10:00:00+09:00'))).toBe(CHAT.room.lastDay);
  });
  test('마지막 날에 내가 연장을 골라도 첫 줄(마지막 날 글)이 그대로고 둘째 줄이 함께 보인다 · 시 · 분 카운트다운 0', async () => {
    const { tree } = await demoRoom('chatlast@email.com');
    expect(textOf(tree, 'chat-room-banner-text')).toBe(CHAT.room.lastDay);
    expect(has(tree, 'chat-room-banner-extra')).toBe(false);
    expect(must(tree, 'chat-room-banner-text').props.accessibilityLabel).toBe(CHAT.room.lastDayA11y);
    await press(tree, 'chat-room-banner-action');
    expect(textOf(tree, 'chat-extend-lastday')).toBe(CHAT.extend.lastDayNote);
    await press(tree, 'chat-extend-want');
    await flush();
    expect(textOf(tree, 'chat-room-banner-text')).toBe(CHAT.room.lastDay); // 연장 안내로 덮이지 않는다
    expect(textOf(tree, 'chat-room-banner-extra')).toBe(CHAT.room.lastDayChosen);
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/남았|분 뒤|초 뒤|서두르|곧 닫/);
  });
  test('마지막 날이 아니면 기존 그대로: 연장을 고르면 띠가 연장 안내로 바뀌고 둘째 줄 · 마지막 날 시트 줄은 없다', async () => {
    const { tree } = await demoRoom('chatopen@email.com');
    await press(tree, 'chat-room-banner-action');
    expect(has(tree, 'chat-extend-lastday')).toBe(false);
    await press(tree, 'chat-extend-want');
    await flush();
    expect(textOf(tree, 'chat-room-banner-text')).toBe(CHAT.extend.wantNote);
    expect(has(tree, 'chat-room-banner-extra')).toBe(false);
  });
  test('안심 공유 줄: 메뉴 연장 아래 · 힌트 한 줄 · 누르면 시트 · safe_share 꺼짐이면 줄 없음', async () => {
    const on = await demoRoom('chatopen@email.com', { safe_share: true });
    await press(on.tree, 'chat-room-more');
    expect(has(on.tree, 'chat-menu-share')).toBe(true);
    expect(must(on.tree, 'chat-menu-share').props).toMatchObject({ label: '만남 계획 공유', hint: CHAT.menu.safeShareHint });
    await press(on.tree, 'chat-menu-share');
    expect(sheetOpen(on.tree, 'chat-share')).toBe(true);
    const off = await demoRoom('chatopen@email.com', {});
    await press(off.tree, 'chat-room-more');
    expect(has(off.tree, 'chat-menu-share')).toBe(false);
    expect(has(off.tree, 'chat-menu-extend')).toBe(true);
  });
  test('카드에서 온 길로 열면 대화방 칩 줄에 확인 띠와 칩이 있고 입력창은 비어 있다(자동 전송 0)', async () => {
    const email = 'chatfirst@email.com';
    const clock = at('2026-12-23T19:00:00+09:00');
    const api = createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: 60_000, clock: () => clock });
    const rooms = (await api.listRooms()) as { ok: true; data: Room[] };
    const id = rooms.data[0].id;
    const sendSpy = jest.spyOn(api, 'send');
    const if2 = { api: { openerChips: async () => ({ ok: true as const, data: { show: false, chips: [] } }) } as unknown as InflightApi, isOn: (k: string) => k === 'profile_prompts', notes: createDeviceNotes() };
    const media = createDemoMedia({ email: () => '', now: () => 0 });
    const tree = await mount(<ChatRoomScreen id={id} api={api} media={media} pollMs={600_000} toastMs={60_000} if2={if2} fromCard={{ question: '주말에는 뭐 하세요?', answer: '산책해요' }} />);
    mounted.push(tree);
    await flush();
    if (has(tree, 'chat-room-banner')) expect(true).toBe(true);
    // 첫 글 전인 방에서만 칩이 보인다(데모 방에 이미 내 글이 있으면 일반 규칙대로 사라진다)
    const wrote = ((await api.listMessages(id)) as { ok: true; data: { mine: boolean; kind: string }[] }).data.some((m) => m.mine && m.kind !== 'system');
    expect(has(tree, 'if2-chips-card')).toBe(!wrote);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(tx('FIRST_HINT.label')).toBe('첫마디 실마리');
  });
});
