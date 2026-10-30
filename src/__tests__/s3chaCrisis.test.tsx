// 3부-차 B ② ③ ⑥ — 위기 도움 카드(라운지 · 대화방 · 12 안전 안내 공용) · 하루 3번 · 다시 열어도 안 뜸 · 0045 rate_limited
//  기준: 정책 P4-29 ~ 36 · 화면 요구 T4 '위기 도움 카드' · 카피 19-14 · 점검일지 442 · backend R_변경기록 13-3(0045)
//  서버 대신 데모 모의 서버(chatDemo · inflightChatDemo · loungeDemo)를 실서버와 같은 파서로 읽는다. 기기 저장 0
import type { SupabaseClient } from '@supabase/supabase-js';
import { StyleSheet, Text } from 'react-native';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { CRISIS, CRISIS_LINE, crisisNote, SAFETY, SAFETY_GUIDE } from '@/content/copy';
import { demoShared } from '@/demo/inflightShared';
import { createDemoLounge } from '@/demo/loungeDemo';
import { createChatApi, type ChatApi, type Message } from '@/features/chat/chatApi';
import { CHAT } from '@/features/chat/chatCopy';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { createDemoMedia } from '@/features/chat/chatMedia';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { createInflightApi, type InflightApi } from '@/features/inflight/inflightApi';
import { createLoungeApi } from '@/features/lounge/loungeApi';
import { LoungeScreen } from '@/features/lounge/LoungeScreen';
import type { LoungeDeps } from '@/features/lounge/loungeService';
import { CrisisCard } from '@/features/safety/CrisisCard';
import { CRISIS_CARDS_PER_DAY, resetCrisisCards, takeCrisisCard } from '@/features/safety/crisisBudget';
import { size } from '@/theme/tokens';

import { allTexts, has, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}`, inflightChatApi: () => ({}) }));

jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
// 데모 모의 서버의 기능 스위치(기내 서비스 칸) — 데모 처음값 그대로 켠다
const flagsAll = async () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;
const isOnAll = (k: string) => demoDefault(k as never) === true;
beforeEach(() => {
  demoShared.setFlags(flagsAll);
  demoShared.setSameHobby(() => true);
});
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
});
const ids = (tree: ReactTestRenderer, re: RegExp) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];

const HELP_TEXT = '요즘 사라지고 싶다는 생각이 들어요';
const KST_DAY = 86_400_000;

// ── 하루 3번 셈(화면 메모리) ─────────────────────────────────────────────
describe('위기 도움 카드 하루 3번(정책 P4-34) — 라운지 · 대화방 합쳐 한국 날짜 기준 · 화면 메모리뿐', () => {
  const noon = Date.UTC(2026, 9, 30, 3, 0); // 한국 12:00
  test('세 번까지 true · 네 번째부터 false(세지 않음) · 한국 자정이 지나면 다시 3번', () => {
    expect(CRISIS_CARDS_PER_DAY).toBe(3);
    expect([1, 2, 3, 4, 5].map(() => takeCrisisCard(noon))).toEqual([true, true, true, false, false]);
    expect(takeCrisisCard(noon + 11 * 3_600_000)).toBe(false); // 한국 22:59 — 아직 같은 날
    expect(takeCrisisCard(noon + 12 * 3_600_000 + 1)).toBe(true); // 한국 자정 직후 — 새 날
    expect([1, 2].map(() => takeCrisisCard(noon + 13 * 3_600_000))).toEqual([true, true]);
    expect(takeCrisisCard(noon + 14 * 3_600_000)).toBe(false);
  });
  test('날짜 경계는 UTC 가 아니라 한국 시각(UTC 15:00 = 한국 00:00)', () => {
    const lastMinute = Date.UTC(2026, 9, 30, 14, 59);
    expect([1, 2, 3].map(() => takeCrisisCard(lastMinute))).toEqual([true, true, true]);
    expect(takeCrisisCard(lastMinute)).toBe(false);
    expect(takeCrisisCard(Date.UTC(2026, 9, 30, 15, 0))).toBe(true);
    expect(takeCrisisCard(lastMinute + KST_DAY * 2)).toBe(true); // 며칠 뒤도 새로
  });
  test('비우면(로그아웃 · 탈퇴) 처음부터', () => {
    [1, 2, 3].forEach(() => takeCrisisCard(noon));
    expect(takeCrisisCard(noon)).toBe(false);
    resetCrisisCards();
    expect(takeCrisisCard(noon)).toBe(true);
  });
  test('저장 0: 모듈은 저장소 · 네트워크를 쓰지 않는다(메모리 변수 둘뿐)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = (require('node:fs') as typeof import('node:fs')).readFileSync(require.resolve('@/features/safety/crisisBudget'), 'utf8');
    expect(src).not.toMatch(/AsyncStorage|SecureStore|localStorage|sessionStorage|fetch\(|supabase|rpc\(/);
  });
});

// ── 공용 카드 부품 ─────────────────────────────────────────────────────────
describe('CrisisCard — 줄 둘 + [닫기] 하나 · 전화 걸기 · 신고 단추 0', () => {
  test('첫째 줄 = CRISIS.note(상담전화 109) · 둘째 줄 = SAFETY.emergency(112 · 119 먼저) · 단추는 닫기 하나 · 읽기 이름 한 덩어리', async () => {
    const onClose = jest.fn();
    const tree = keep(await mount(<CrisisCard onClose={onClose} testID="cc" />));
    expect(textOf(tree, 'cc-text')).toBe(crisisNote());
    expect(textOf(tree, 'cc-text')).toBe(CRISIS.note(CRISIS_LINE.agency, CRISIS_LINE.phone));
    expect(CRISIS_LINE).toEqual({ agency: '자살예방 상담전화', phone: '109' });
    expect(textOf(tree, 'cc-emergency')).toBe(SAFETY.emergency);
    expect(SAFETY.emergency).toBe('위급한 상황이면 112나 119에 먼저 연락해 주세요.');
    expect(must(tree, 'cc-lines').props.accessibilityLabel).toBe(CRISIS.a11y(`${crisisNote()} ${SAFETY.emergency}`));
    expect(must(tree, 'cc-lines').props.accessibilityLiveRegion).toBe('polite');
    expect(allTexts(tree)).toEqual([crisisNote(), SAFETY.emergency, CRISIS.close]);
    expect([...new Set(tree.root.findAll((n) => n.props.accessibilityRole === 'button').map((n) => n.props.testID).filter(Boolean))]).toEqual(['cc-close']); // 단추는 닫기 하나 — 전화 걸기 · 신고 · 복사 0
    expect(tree.root.findAll((n) => typeof n.props.href === 'string' || typeof n.props.url === 'string')).toHaveLength(0);
    await press(tree, 'cc-close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  test('[닫기] 눌리는 면 가로 · 세로 48 이상(C8)', async () => {
    const tree = keep(await mount(<CrisisCard onClose={() => undefined} testID="cc" />));
    const hosts = tree.root.findAll((n) => n.props.testID === 'cc-close');
    const style = StyleSheet.flatten(hosts[hosts.length - 1].props.style as never) as { minHeight?: number; minWidth?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(size.touchMin);
    expect(style.minWidth).toBeGreaterThanOrEqual(size.touchMin);
  });
  test('글에 되풀이 · 상대 · 신고 · 라운지 말 · 숫자(번호 말고) 0 — 12 안전 안내 맨 위 두 줄과 같은 글', () => {
    const t = `${crisisNote()} ${SAFETY.emergency}`;
    expect(t).not.toMatch(/또|다시|이미|이번에도|오늘|번째|횟수|더 이상|신고|상대|운영|알림|객실|좌석|탑승객|라운지|바로 연결|언제든|지켜보고|비밀|[!！]|1577|1366|1393|문자로도/);
    expect(SAFETY_GUIDE.emergency).toBe(SAFETY.emergency);
    expect(SAFETY_GUIDE.crisis).toBe(crisisNote());
  });
});

// ── 대화방 ───────────────────────────────────────────────────────────────
describe('대화방 위기 도움 카드(정책 P4-29 ~ 36) — 보낸 직후 · 내 말풍선 아래 · 나에게만 · 다시 열어도 안 뜸 · 받은 글 0', () => {
  async function room(email: string, wrap?: (api: ChatApi) => ChatApi) {
    const user = { id: `u-${email.split('@')[0]}`, email };
    const demo = createDemoChatApi({ who: async () => user, replyMs: 40 });
    const chat = wrap ? wrap(demo) : demo;
    const rooms = (await demo.listRooms()) as { ok: true; data: { id: string }[] };
    const id = rooms.data[0]?.id ?? 'none';
    const media = createDemoMedia({ email: () => email, now: () => 0 });
    const notes = createDeviceNotes();
    const mountRoom = async () => keep(await mount(<ChatRoomScreen id={id} api={chat} media={media} pollMs={600_000} toastMs={60_000} if2={{ api: createInflightApi(demo.if2Rpc), isOn: isOnAll, notes }} />));
    const tree = await mountRoom();
    await wait();
    return { tree, demo, chat, id, mountRoom };
  }
  const send = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'chat-composer-input', text);
    await press(tree, 'chat-composer-send');
    await wait(120);
  };
  // 카드가 붙은 줄(<View key=글>)의 글들 — 말풍선 본문 · 시각 · 카드 두 줄. 줄에는 말풍선이 정확히 하나(그 글 바로 아래)
  const textsIn = (node: ReactTestInstance) => node.findAllByType(Text).map((n) => [n.props.children].flat().join('')).filter(Boolean);
  const cardRow = (tree: ReactTestRenderer) => {
    let row: ReactTestInstance | null = must(tree, 'chat-crisis').parent;
    while (row && row.findAll((n) => /^chat-(msg|together)-\d+$/.test(String(n.props.testID))).length === 0) row = row.parent;
    if (!row) throw new Error('카드가 붙은 줄이 없어요');
    expect(new Set(row.findAll((n) => /^chat-(msg|together)-\d+$/.test(String(n.props.testID))).map((n) => n.props.testID)).size).toBe(1);
    return row;
  };
  const cardRowTexts = (tree: ReactTestRenderer) => textsIn(cardRow(tree));

  test('내 위기 낱말 글을 보내면 그 말풍선 바로 아래에 한 장 · 글은 그대로 보내짐 · 줄 둘 + [닫기] · 받은 글(상대 답) 아래에는 0', async () => {
    const { tree, chat, id } = await room('cr1@email.com');
    await send(tree, HELP_TEXT);
    expect(ids(tree, /^chat-crisis$/)).toEqual(['chat-crisis']);
    expect(textOf(tree, 'chat-crisis-text')).toBe(crisisNote());
    expect(textOf(tree, 'chat-crisis-emergency')).toBe(SAFETY.emergency);
    expect(cardRowTexts(tree)).toContain(HELP_TEXT); // 카드가 붙은 줄의 말풍선은 방금 보낸 내 글 하나
    const list = await chat.listMessages(id);
    expect(list.ok && list.data.filter((m) => m.mine && m.body === HELP_TEXT)).toHaveLength(1); // 글은 막히지 않았다
    await wait(120); // 데모 짝의 답이 와도
    expect(ids(tree, /^chat-crisis$/)).toEqual(['chat-crisis']);
    expect(cardRowTexts(tree)).toContain(HELP_TEXT);
    expect(cardRowTexts(tree)).not.toContain('네, 좋아요. 천천히 이야기 나눠요.');
    // 받은 글에는 판정 · 표시 0 — 화면 글에도 '상대'를 가리키는 말이 없다
    expect(allTexts(tree).join(' ')).not.toMatch(/상대가.*(힘들|위험)|신고하기.*도움/);
  });
  test('[닫기] → 걷힘 · 닫은 기록은 기기에 남기지 않음 · 방을 다시 열면(목록을 다시 불러오면) 지난 글 아래에 다시 뜨지 않음', async () => {
    const { tree, mountRoom, chat, id } = await room('cr2@email.com');
    await send(tree, HELP_TEXT);
    expect(has(tree, 'chat-crisis')).toBe(true);
    await press(tree, 'chat-crisis-close');
    expect(has(tree, 'chat-crisis')).toBe(false);
    // 닫지 않은 채 방을 다시 여는 경우도: 새 화면은 목록(help 칸 없음)에서 읽으니 카드 0
    await send(tree, '사라지고 싶은 마음이 또 들어요');
    expect(has(tree, 'chat-crisis')).toBe(true);
    const again = await mountRoom();
    await wait();
    expect(allTexts(again)).toContain(HELP_TEXT); // 글은 목록에 그대로 있다
    expect(has(again, 'chat-crisis')).toBe(false);
    const list = await chat.listMessages(id);
    expect(list.ok && list.data.some((m) => 'help' in m)).toBe(false); // 목록 응답에는 위기 표시 칸이 없다
  });
  test('새 카드가 뜨면 앞 카드는 걷힘(한 번에 한 장) · 글이 걸러져 못 보내면 카드 0 · 보통 글에도 0', async () => {
    const { tree } = await room('cr3@email.com');
    await send(tree, '안녕하세요 반가워요');
    expect(has(tree, 'chat-crisis')).toBe(false);
    await send(tree, HELP_TEXT);
    expect(cardRowTexts(tree)).toContain(HELP_TEXT);
    await send(tree, '살기 싫은 날이 길어요');
    expect(ids(tree, /^chat-crisis$/)).toEqual(['chat-crisis']); // 한 장
    expect(cardRowTexts(tree)).toContain('살기 싫은 날이 길어요');
    expect(cardRowTexts(tree)).not.toContain(HELP_TEXT);
    await press(tree, 'chat-crisis-close');
    await send(tree, '죽고 싶어요 송금해 주세요'); // 돈 요구로 걸러져 보내지지 않음 → 카드도 0
    expect(has(tree, 'chat-crisis')).toBe(false);
    expect(allTexts(tree)).toContain(CHAT.send.blocked);
  });
  test('하루 3번까지 — 4번째부터는 글만 보내고 화면 변화 0 · 안내 글 0(데모 서버가 3 뒤에는 칸을 안 줌)', async () => {
    const { tree, chat, id } = await room('cr4@email.com');
    const seen: boolean[] = [];
    for (const t of ['사라지고 싶어요 하나', '사라지고 싶어요 둘', '사라지고 싶어요 셋', '사라지고 싶어요 넷', '사라지고 싶어요 다섯']) {
      await send(tree, t);
      seen.push(has(tree, 'chat-crisis'));
      if (has(tree, 'chat-crisis')) await press(tree, 'chat-crisis-close');
    }
    expect(seen).toEqual([true, true, true, false, false]);
    expect(allTexts(tree)).toContain('사라지고 싶어요 다섯'); // 글은 모두 보내졌다
    const list = await chat.listMessages(id);
    expect(list.ok && list.data.filter((m) => m.mine && /사라지고 싶어요/.test(m.body))).toHaveLength(5);
  });
  test('서버 칸과 따로 앱 셈도 막는다(서버가 계속 참을 줘도 화면은 하루 3번) — 라운지에서 쓴 장수까지 합쳐', async () => {
    takeCrisisCard(); // 라운지에서 이미 한 장 보였다고 치면
    const force = (api: ChatApi): ChatApi => ({ ...api, send: async (rid, out) => { const r = await api.send(rid, out); return r.ok ? { ok: true, data: { ...r.data, help: true as const } } : r; } });
    const { tree } = await room('cr5@email.com', force);
    const seen: boolean[] = [];
    for (const t of ['첫 글', '둘째 글', '셋째 글', '넷째 글']) {
      await send(tree, t);
      seen.push(has(tree, 'chat-crisis'));
      if (has(tree, 'chat-crisis')) await press(tree, 'chat-crisis-close');
    }
    expect(seen).toEqual([true, true, false, false]); // 앞서 1장 + 이 방 2장 = 3
  });
  test('보내기 응답에 칸이 없으면(백엔드 0047 전) 카드 0 · 글은 그대로', async () => {
    const strip = (api: ChatApi): ChatApi => ({ ...api, send: async (rid, out) => { const r = await api.send(rid, out); if (!r.ok) return r; const { help: _help, ...rest } = r.data; void _help; return { ok: true, data: rest as Message }; } });
    const { tree } = await room('cr6@email.com', strip);
    await send(tree, HELP_TEXT);
    expect(has(tree, 'chat-crisis')).toBe(false);
    expect(allTexts(tree)).toContain(HELP_TEXT);
  });
  test('같이 열어 보는 질문의 내 답: 응답에 위기 표시가 참이면 그 질문 카드 바로 아래 한 장', async () => {
    const user = { id: 'u-cr7', email: 'cr7@email.com' };
    const demo = createDemoChatApi({ who: async () => user, replyMs: 40 });
    const rooms = (await demo.listRooms()) as { ok: true; data: { id: string }[] };
    const id = rooms.data[0].id;
    const media = createDemoMedia({ email: () => 'cr7@email.com', now: () => 0 });
    const tree = keep(await mount(<ChatRoomScreen id={id} api={demo} media={media} pollMs={600_000} toastMs={60_000} if2={{ api: createInflightApi(demo.if2Rpc), isOn: isOnAll, notes: createDeviceNotes() }} />));
    await wait();
    await press(tree, 'chat-topics');
    await press(tree, 'if2-topics-tab-together');
    await press(tree, 'if2-topics-together-q-0');
    await typeInto(tree, 'if2-topics-answer', '요즘 죽고 싶다는 생각까지 들어요');
    await press(tree, 'if2-topics-together-send');
    await wait(100);
    const card = ids(tree, /^chat-together-\d+$/)[0];
    expect(card).toBeTruthy();
    expect(has(tree, 'chat-crisis')).toBe(true);
    expect(cardRow(tree).findAll((n) => n.props.testID === card).length).toBeGreaterThan(0); // 질문 카드와 같은 줄
  });
});

// ── 실서버 응답 읽기(0045 · 0047 칸) ─────────────────────────────────────────
describe('응답 읽기: send_chat_message help 한 칸 · together_send / together_answer rate_limited(0045) · opened:false', () => {
  const msg = { id: 9, mine: true, kind: 'text', body: '안녕', created_at: '2026-12-24T01:00:00Z' };
  const clientOf = (answer: (name: string) => { data: unknown; error: { code?: string; message: string } | null }) => ({ rpc: async (name: string) => answer(name) }) as unknown as SupabaseClient;

  test('send_chat_message: help 가 참일 때만 help true · 칸이 없거나 거짓이면 키 자체가 없다(0)', async () => {
    const mk = (data: unknown) => createChatApi(clientOf(() => ({ data, error: null })));
    const t = await mk({ ok: true, message: msg, help: true }).send('r1', { clientId: 'c1', kind: 'text', body: '안녕' });
    expect(t.ok && t.data.help).toBe(true);
    for (const data of [{ ok: true, message: msg }, { ok: true, message: msg, help: false }, { ok: true, message: msg, help: 'yes' }]) {
      const r = await mk(data).send('r1', { clientId: 'c1', kind: 'text', body: '안녕' });
      expect(r.ok && 'help' in r.data).toBe(false);
    }
  });
  test('together_send / together_answer: {ok:false, code:rate_limited} 를 그대로 · DB 오류 rate_limited(send_chat_card 등 P0001)도 같은 코드', async () => {
    const json = createInflightApi((async () => ({ data: { ok: false, code: 'rate_limited' }, error: null })) as never);
    expect(await json.togetherSend('r1', 'q-1-01', '질문', '답')).toEqual({ ok: false, code: 'rate_limited' });
    expect(await json.togetherAnswer('5', '답')).toEqual({ ok: false, code: 'rate_limited' });
    const dbErr = createInflightApi((async () => ({ data: null, error: { code: 'P0001', message: 'rate_limited' } })) as never);
    expect(await dbErr.sendCard('r1', 'farewell', '안녕히', 'f1')).toEqual({ ok: false, code: 'rate_limited' });
    expect(await dbErr.togetherSend('r1', 'q-1-01', '질문', '답')).toEqual({ ok: false, code: 'rate_limited' });
  });
  test('together_answer opened:false(열기 직전 검사에 걸림) = 응답 모양 그대로 ok · opened false · 카드는 waiting 그대로', async () => {
    const waiting = { id: 21, mine: true, kind: 'text', body: '', created_at: '2026-12-24T01:00:00Z', tag: 'together_q', ref: 'q-1-01', together: { state: 'waiting', my_answer: '내 답', can_withdraw: false } };
    const api = createInflightApi((async () => ({ data: { ok: true, opened: false, message: waiting }, error: null })) as never);
    const r = await api.togetherAnswer('21', '내 답');
    expect(r.ok && r.opened).toBe(false);
    expect(r.ok && r.message?.together).toEqual({ state: 'waiting', myAnswer: '내 답', canWithdraw: false });
    expect(r.ok && 'help' in r).toBe(false);
    const helped = createInflightApi((async () => ({ data: { ok: true, opened: false, message: waiting, help: true }, error: null })) as never);
    const h = await helped.togetherAnswer('21', '내 답');
    expect(h.ok && h.help).toBe(true);
  });
});

describe('0045 rate_limited 화면: 채팅 글 한도(14-5-2)와 같은 글 · 시트가 닫히지 않고 한 줄', () => {
  test('같이 열어 보기 보내기: rate_limited → TopicsSheet 오류 한 줄 = CHAT.send.limited · 시트 그대로', async () => {
    const user = { id: 'u-rl1', email: 'rl1@email.com' };
    const demo = createDemoChatApi({ who: async () => user, replyMs: 40 });
    const rooms = (await demo.listRooms()) as { ok: true; data: { id: string }[] };
    const base = createInflightApi(demo.if2Rpc);
    const limited: InflightApi = { ...base, togetherSend: async () => ({ ok: false, code: 'rate_limited' }), sendCard: async () => ({ ok: false, code: 'rate_limited' }) };
    const media = createDemoMedia({ email: () => user.email, now: () => 0 });
    const tree = keep(await mount(<ChatRoomScreen id={rooms.data[0].id} api={demo} media={media} pollMs={600_000} toastMs={60_000} if2={{ api: limited, isOn: isOnAll, notes: createDeviceNotes() }} />));
    await wait();
    await press(tree, 'chat-topics');
    await press(tree, 'if2-topics-tab-together');
    await press(tree, 'if2-topics-together-q-0');
    await typeInto(tree, 'if2-topics-answer', '천천히 걷는 저녁이 좋아요.');
    await press(tree, 'if2-topics-together-send');
    await wait();
    expect(textOf(tree, 'if2-topics-error')).toBe(CHAT.send.limited);
    expect(has(tree, 'if2-topics-together-send')).toBe(true); // 시트가 닫히지 않음
    // 이야깃거리 놓기(sendCard)도 같은 글
    await press(tree, 'if2-topics-tab-topics');
    await press(tree, 'if2-topics-place-0');
    await wait();
    expect(textOf(tree, 'if2-topics-error')).toBe(CHAT.send.limited);
  });
  test('받은 질문에 답하기: rate_limited → 답 시트 오류 한 줄 = CHAT.send.limited · opened:false 는 오류 없이 닫힘(카드 그대로)', async () => {
    const user = { id: 'u-rl2', email: 'rl2@email.com' };
    const demo = createDemoChatApi({ who: async () => user, replyMs: 40 });
    const rooms = (await demo.listRooms()) as { ok: true; data: { id: string }[] };
    const base = createInflightApi(demo.if2Rpc);
    let mode: 'limited' | 'unopened' = 'limited';
    const api: InflightApi = {
      ...base,
      togetherAnswer: async (cardId, answer) => (mode === 'limited' ? { ok: false, code: 'rate_limited' } : base.togetherAnswer(cardId, answer).then((r) => (r.ok ? { ...r, opened: false } : r))),
    };
    const media = createDemoMedia({ email: () => user.email, now: () => 0 });
    const tree = keep(await mount(<ChatRoomScreen id={rooms.data[0].id} api={demo} media={media} pollMs={600_000} toastMs={60_000} if2={{ api, isOn: isOnAll, notes: createDeviceNotes() }} />));
    await wait();
    await press(tree, 'chat-topics');
    await press(tree, 'if2-topics-place-0'); // 이야깃거리를 놓으면 데모 짝이 질문 카드를 보낸다
    await wait(150);
    const card = ids(tree, /^chat-together-\d+$/)[0];
    await press(tree, `${card}-answer`);
    await typeInto(tree, `${card}-input`, '천천히 걷는 저녁이 좋아요.');
    await press(tree, `${card}-submit`);
    await wait();
    expect(textOf(tree, `${card}-error`)).toBe(CHAT.send.limited);
    mode = 'unopened';
    await press(tree, `${card}-submit`);
    await wait();
    expect(has(tree, `${card}-error`)).toBe(false);
  });
});

// ── 라운지 ───────────────────────────────────────────────────────────────
describe('라운지 위기 도움 카드 — 계정 기준 하루 3번(대화방과 합쳐) · 다시 열어도 안 뜸 · 화면 메모리뿐', () => {
  function rig(email: string) {
    const user = { id: `u-${email}`, email };
    const demo = createDemoLounge({ flight: () => 'in', switchOn: async () => true, replyMs: 30 });
    const client = { rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args), channel: (n: string) => demo.channel(n), removeChannel: (c: unknown) => demo.removeChannel(c) } as unknown as SupabaseClient;
    const api = createLoungeApi(client);
    const deps: LoungeDeps = { api, switchOn: async () => true };
    return { api, deps };
  }
  const open = async (r: ReturnType<typeof rig>) => {
    const tree = keep(await mount(<LoungeScreen deps={r.deps} toastMs={60_000} />));
    await wait();
    return tree;
  };
  const sendPost = async (tree: ReactTestRenderer, text: string) => {
    await typeInto(tree, 'lounge-input', text);
    await press(tree, 'lounge-send');
    await wait();
  };

  test('보낸 직후 한 장(줄 둘 + [닫기]) · 닫으면 걷힘 · 라운지를 다시 열면 목록에 그 글이 있어도 카드 0', async () => {
    const r = rig('loungeon@email.com');
    const tree = await open(r);
    await sendPost(tree, HELP_TEXT);
    const crisis = ids(tree, /-crisis$/);
    expect(crisis).toHaveLength(1);
    expect(textOf(tree, `${crisis[0]}-text`)).toBe(crisisNote());
    expect(textOf(tree, `${crisis[0]}-emergency`)).toBe(SAFETY.emergency);
    // 서버 목록에는 내 글 help 가 계속 참으로 오지만(0042 lounge_post_json) 화면은 다시 열면 쓰지 않는다
    const st = await r.api.state();
    expect(st.ok && st.data.posts.some((p) => p.kind !== 'captain' && p.mine && p.body === HELP_TEXT && p.help)).toBe(true);
    const again = await open(r);
    expect(allTexts(again)).toContain(HELP_TEXT);
    expect(ids(again, /-crisis$/)).toHaveLength(0);
    // 닫기
    await press(tree, `${crisis[0]}-close`);
    expect(ids(tree, /-crisis$/)).toHaveLength(0);
  });
  test('하루 3번(대화방과 합쳐): 이미 두 장을 보였으면 라운지는 한 장 더 · 그다음부터 글만', async () => {
    takeCrisisCard();
    takeCrisisCard(); // 대화방에서 두 장 보였다고 치면
    const r = rig('loungeon@email.com');
    const tree = await open(r);
    const seen: number[] = [];
    for (const t of ['요즘 사라지고 싶어요 하나', '요즘 사라지고 싶어요 둘', '요즘 사라지고 싶어요 셋']) {
      await sendPost(tree, t);
      const c = ids(tree, /-crisis$/);
      seen.push(c.length);
      if (c.length) await press(tree, `${c[0]}-close`);
    }
    expect(seen).toEqual([1, 0, 0]);
    expect(allTexts(tree)).toContain('요즘 사라지고 싶어요 셋'); // 글은 모두 보내졌다
  });
  test('보통 글에는 카드 0 · 라운지 약속은 네 줄', async () => {
    const r = rig('loungeon@email.com');
    const tree = await open(r);
    await sendPost(tree, '오늘 노을이 예뻤어요');
    expect(ids(tree, /-crisis$/)).toHaveLength(0);
  });
});
