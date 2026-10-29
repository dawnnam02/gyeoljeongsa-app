// 3부-자 라운지 묶음 — 검수 QP-39(웹 화면 읽기 상태) · QP-40(위기 [닫기] 48 × 48) · 강퇴 · 나감 [돌아가기] → T4 목록 · 카피 19-13(약속 바뀜 줄) ·
//  백엔드 0044 앱 넘김(get_lounge_row_state · get_lounge_my_hidden · 실시간 closed). 서버 대신 데모 모의 서버(0042 + 0044 응답 모양)를 실서버와 같은 파서로 읽는다.
import fs from 'node:fs';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { StyleSheet } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { createDemoLounge, type LoungeFlight } from '@/demo/loungeDemo';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { ChatListScreen } from '@/features/chat/ChatListScreen';
import { createLoungeApi, type LoungeApi } from '@/features/lounge/loungeApi';
import { LOUNGE, LOUNGE_BACK_TO_LIST } from '@/features/lounge/loungeCopy';
import { LoungeScreen } from '@/features/lounge/LoungeScreen';
import type { LoungeDeps } from '@/features/lounge/loungeService';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { size } from '@/theme/tokens';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

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
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}` }));

jest.setTimeout(90_000);

const wait = (ms = 20) => act(async () => new Promise((r) => setTimeout(r, ms)));

function rig(email: string, opts: { flight?: LoungeFlight } = {}) {
  const user = { id: `u-${email}`, email };
  const demo = createDemoLounge({ flight: () => opts.flight ?? 'in', switchOn: async () => true, replyMs: 30 });
  const client = { rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args), channel: (n: string) => demo.channel(n), removeChannel: (c: unknown) => demo.removeChannel(c) } as unknown as SupabaseClient;
  const api: LoungeApi = createLoungeApi(client);
  const spy = { state: jest.spyOn(api, 'state'), rowState: jest.spyOn(api, 'rowState'), myHidden: jest.spyOn(api, 'myHidden'), hide: jest.spyOn(api, 'hide') };
  const scene = (p_scene: string) => demo.rpc(user, 'demo_lounge_scene', { p_scene });
  const deps: LoungeDeps = { api, switchOn: async () => true };
  return { demo, api, deps, spy, scene, user };
}
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => {
  mounted.push(t);
  return t;
};
async function open(email: string, opts: Parameters<typeof rig>[1] = {}) {
  const r = rig(email, opts);
  const tree = keep(await mount(<LoungeScreen deps={r.deps} toastMs={60_000} />));
  await wait();
  return { ...r, tree };
}
// 같은 testID 를 단 부품 · 눌림 요소 가운데 aria 속성이 있는 첫 값(부품 → Pressable → 바탕 요소로 내려가며 이어 받는다)
const ariaOf = (tree: ReactTestRenderer, id: string, key: string) => tree.root.findAll((n) => n.props.testID === id && n.props[key] !== undefined)[0]?.props[key];
const ids = (tree: ReactTestRenderer, re: RegExp) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
});
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((t) => t.unmount());
    reduceMotionStore.set(false);
  });
});

// ── QP-39: accessibilityState(checked · selected · expanded) 옆에 같은 값의 aria-* — 코드 전체를 훑는다(같은 꼴 전수)
const SRC = path.resolve(__dirname, '..');
const tsxFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : tsxFiles(path.join(dir, e.name))) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []));
const ARIA_OF: Record<string, RegExp> = { checked: /aria-checked/, selected: /aria-selected|ariaPressed\(|aria-pressed/, expanded: /aria-expanded/ };
function stateWithoutAria(): string[] {
  const out: string[] = [];
  for (const f of tsxFiles(SRC)) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/accessibilityState=\{/g)) {
      let depth = 1;
      let i = (m.index ?? 0) + m[0].length;
      for (; i < t.length && depth > 0; i += 1) {
        if (t[i] === '{') depth += 1;
        else if (t[i] === '}') depth -= 1;
      }
      const body = t.slice((m.index ?? 0) + m[0].length, i - 1);
      // 이 요소의 열린 태그: 거꾸로 '<대문자' 에서 앞으로 중괄호 균형이 0 인 '>' 까지
      let s = t.lastIndexOf('<', m.index ?? 0);
      while (s > 0 && !/^<[A-Za-z]/.test(t.slice(s, s + 3))) s = t.lastIndexOf('<', s - 1);
      let d = 0;
      let e = s;
      for (; e < t.length; e += 1) {
        const c = t[e];
        if (c === '{') d += 1;
        else if (c === '}') d -= 1;
        else if (c === '>' && d === 0 && t[e - 1] !== '=') break;
      }
      const tag = t.slice(s, e + 1);
      for (const [key, re] of Object.entries(ARIA_OF)) {
        if (new RegExp(`(?:^|[{,]\\s*)${key}\\s*[:,}]`).test(body) && !re.test(tag)) out.push(`${path.relative(SRC, f)}:${t.slice(0, m.index ?? 0).split('\n').length} ${key}`);
      }
    }
  }
  return out;
}

describe('QP-39 웹 화면 읽기 — 눌림 · 고름 · 펼침 상태가 aria 로도 나간다', () => {
  test('accessibilityState 의 checked · selected · expanded 마다 같은 요소에 aria-checked · aria-selected(또는 aria-pressed) · aria-expanded 가 있다 — 빠진 곳 0', () => {
    expect(stateWithoutAria()).toEqual([]);
  });

  test('공감 알약: 누르기 전 aria-pressed=false → 누른 뒤 true · 다시 누르면 false(알림 · 개수 0)', async () => {
    const { tree, api } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const idx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    const id = `lounge-post-${idx}-empathy`;
    expect(ariaOf(tree, id, 'aria-pressed')).toBe(false);
    await press(tree, id);
    await wait();
    expect(ariaOf(tree, id, 'aria-pressed')).toBe(true);
    await press(tree, id);
    await wait();
    expect(ariaOf(tree, id, 'aria-pressed')).toBe(false);
    const more = `lounge-post-${idx}-more`; // 켜고 끄는 알약이 아닌 [⋯] 는 aria-pressed 0
    expect(ariaOf(tree, more, 'aria-pressed')).toBeUndefined();
  });

  test('신고 사유 라디오: aria-checked — 고른 하나만 true', async () => {
    const { tree, api } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const idx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    await press(tree, `lounge-post-${idx}-more`);
    await press(tree, 'lounge-msg-report');
    const radios = ['RP4', 'RP5', 'RP6', 'RP7', 'RP8'].map((c) => `lounge-report-${c}`);
    for (const r of radios) expect([r, ariaOf(tree, r, 'aria-checked')]).toEqual([r, false]);
    await press(tree, 'lounge-report-RP7');
    expect(radios.map((r) => ariaOf(tree, r, 'aria-checked'))).toEqual([false, false, false, true, false]);
  });
});

describe('QP-40 위기 도움 카드 [닫기] 48 × 48', () => {
  test('[닫기] 눌리는 면 가로 · 세로 모두 48 이상', async () => {
    const { tree } = await open('loungeon@email.com');
    await typeInto(tree, 'lounge-input', '요즘 사라지고 싶다는 생각이 들어요');
    await press(tree, 'lounge-send');
    await wait();
    const crisisClose = ids(tree, /-crisis-close$/);
    expect(crisisClose).toHaveLength(1);
    const hosts = tree.root.findAll((n) => n.props.testID === crisisClose[0]);
    const style = StyleSheet.flatten(hosts[hosts.length - 1].props.style as never) as { minHeight?: number; minWidth?: number };
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(size.touchMin).toBe(48);
  });
});

describe('강퇴 · 나감 [돌아가기] → T4 목록(기획 T6 이동표 · 검수 결정 10-28)', () => {
  test('강퇴(kicked): 한 줄 + [돌아가기] → /chat · 입력 줄은 이번 회차에는 쓸 수 없어요 그대로', async () => {
    const { tree } = await open('loungekicked@email.com');
    expect(textOf(tree, 'lounge-kicked-title')).toBe(LOUNGE.kicked.title);
    expect(allTexts(tree)).toContain(LOUNGE_BACK_TO_LIST);
    expect(textOf(tree, 'lounge-composer-line-text')).toBe(LOUNGE.composer.stopped);
    await press(tree, 'lounge-kicked-button');
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/boarding');
  });

  test('나감(left): [돌아가기] → /chat · 닫힘(closed)은 그대로 [탑승권으로] → /boarding', async () => {
    const left = await open('loungeleft@email.com');
    expect(textOf(left.tree, 'lounge-left-title')).toBe(LOUNGE.left.title);
    await press(left.tree, 'lounge-left-button');
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    mockRouter.replace.mockClear();
    const closed = await open('loungeclosed@email.com');
    expect(allTexts(closed.tree)).toContain(LOUNGE.closed.back);
    await press(closed.tree, 'lounge-closed-button');
    expect(mockRouter.replace).toHaveBeenCalledWith('/boarding');
  });
});

describe('카피 19-13 T4 줄: 약속 판이 바뀐 회차(좌석은 그대로) · 0044 get_lounge_row_state', () => {
  const list = async (email: string) => {
    const r = rig(email);
    const chat = createDemoChatApi({ who: async () => ({ id: 'me', email: 'chat0@email.com' }) });
    const tree = keep(await mount(<ChatListScreen api={chat} lounge={r.deps} />));
    await wait();
    return { ...r, tree };
  };

  test('loungerules(intro + 좌석 있음): 줄 글 = 약속이 바뀌었어요 · 좌석이 정해져요 0 · 빈 좌석 칸 0 · 읽기 이름', async () => {
    const { tree, spy } = await list('loungerules@email.com');
    expect(textOf(tree, 'lounge-row-line')).toBe(LOUNGE.row.lineRulesChanged);
    expect(textOf(tree, 'lounge-row-line')).not.toMatch(/좌석이 정해/);
    expect(has(tree, 'lounge-row-seat-box')).toBe(false); // 좌석은 이미 있다
    expect(must(tree, 'lounge-row').props.accessibilityLabel).toBe(LOUNGE.row.a11y(LOUNGE.row.lineRulesChanged));
    expect(spy.rowState).toHaveBeenCalledTimes(1);
    expect(spy.state).toHaveBeenCalledTimes(1); // intro 일 때만 has_seat 를 한 번 더
    await press(tree, 'lounge-row');
    expect(mockRouter.push).toHaveBeenCalledWith('/lounge');
  });

  test('첫 입장 전(loungefirst)은 지금 글 그대로 · 빈 좌석 칸 · 그 밖 상태는 lounge_state 를 따로 부르지 않는다', async () => {
    const first = await list('loungefirst@email.com');
    expect(textOf(first.tree, 'lounge-row-line')).toBe(LOUNGE.row.lineFirst);
    expect(has(first.tree, 'lounge-row-seat-box')).toBe(true);
    expect(first.spy.state).toHaveBeenCalledTimes(1);
    const on = await list('loungeon@email.com');
    expect(textOf(on.tree, 'lounge-row-line')).toBe(LOUNGE.row.lineSeated);
    expect(on.spy.rowState).toHaveBeenCalledTimes(1);
    expect(on.spy.state).not.toHaveBeenCalled(); // 줄 전용 응답만 — 글 200개 · 좌석 · 채널을 받지 않음
    const closed = await list('loungeclosed@email.com');
    expect(has(closed.tree, 'lounge-row')).toBe(false);
  });
});

describe('0044 get_lounge_my_hidden — 숨긴 좌석 시트를 다시 들어와도 채움 · [다시 보기] = lounge_hide(post, false)', () => {
  test('응답: seats[{seat, post}] 좌석 차례 · 회원 id 0 · 자격 없으면 {ok:false, code}', async () => {
    const { api, demo, user } = await open('loungeon@email.com');
    expect(await api.myHidden()).toEqual({ ok: true, data: { seats: [] } });
    const st = await api.state();
    const others = (st.ok ? st.data.posts : []).filter((p) => p.kind !== 'captain' && !p.mine);
    const a = others[0];
    const b = others.find((p) => p.kind !== 'captain' && a.kind !== 'captain' && p.seat !== a.seat) ?? a;
    await api.hide(a.id, true);
    await api.hide(b.id, true);
    const r = await api.myHidden();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.seats.length).toBeGreaterThanOrEqual(1);
      const names = r.data.seats.map((x) => x.seat);
      expect(names).toEqual([...names].sort());
      for (const x of r.data.seats) expect(Object.keys(x).sort()).toEqual(['post', 'seat']);
    }
    expect(Object.keys((await demo.rpc(user, 'get_lounge_my_hidden', {})).data as object).sort()).toEqual(['ok', 'seats']);
    const kicked = rig('loungekicked@email.com');
    expect(await kicked.api.myHidden()).toEqual({ ok: false, code: 'kicked' });
  });

  test('이 화면을 나갔다 다시 들어와도 숨긴 좌석이 시트에 채워지고 [다시 보기] 가 서버 숨김을 거둔다', async () => {
    const r = rig('loungeon@email.com');
    const first = keep(await mount(<LoungeScreen deps={r.deps} toastMs={60_000} />));
    await wait();
    const st = await r.api.state();
    const posts = st.ok ? st.data.posts : [];
    const idx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    const target = posts[idx];
    const seat = target.kind !== 'captain' ? target.seat : '';
    await press(first, `lounge-post-${idx}-more`);
    await press(first, 'lounge-msg-hide');
    await press(first, 'lounge-hide-confirm');
    await wait();
    expect(r.demo.peek(r.user).hides).toEqual([seat]);
    await act(async () => first.unmount()); // 화면 메모리는 사라진다

    const second = keep(await mount(<LoungeScreen deps={r.deps} toastMs={60_000} />));
    await wait();
    expect(r.spy.myHidden).toHaveBeenCalled();
    await press(second, 'lounge-header-menu');
    await press(second, 'lounge-menu-hidden');
    await wait();
    expect(isOpen(second, 'lounge-hidden')).toBe(true);
    expect(allTexts(second)).toContain(LOUNGE.hidden.row(seat)); // 서버 응답으로 채움
    expect(has(second, 'lounge-hidden-empty')).toBe(false);
    await press(second, `lounge-hidden-unhide-${seat}`);
    await wait();
    expect(r.spy.hide).toHaveBeenLastCalledWith(expect.any(String), false); // lounge_hide(post, false)
    expect(textOf(second, 'lounge-toast-text')).toBe(LOUNGE.hidden.unhidden);
    expect(r.demo.peek(r.user).hides).toEqual([]);
  });
});

describe('0044 실시간 closed — 수 18:00 공개 뒤 한 번: 화면 닫힘 · 글 · 메모리 비움 · 구독 끊김', () => {
  test('열린 객실에서 closed 가 오면 닫힘 화면 · 입력 중이던 글 0 · 구독 0 · 글 0', async () => {
    const r = rig('loungeon@email.com');
    const tree = keep(await mount(<LoungeScreen deps={r.deps} toastMs={60_000} />));
    await wait();
    expect(r.demo.joinedCount()).toBe(1);
    await typeInto(tree, 'lounge-input', '쓰던 글');
    const before = r.spy.state.mock.calls.length;
    await act(async () => {
      await r.scene('closed'); // 서버 lounge_close_tick 흉내: 객실 채널에 closed 한 번
    });
    await wait(60);
    expect(has(tree, 'lounge-closed')).toBe(true);
    expect(textOf(tree, 'lounge-closed-title')).toBe(LOUNGE.closed.title);
    expect(ids(tree, /^lounge-post-\d+$/)).toEqual([]);
    expect(has(tree, 'lounge-input')).toBe(false);
    expect(r.demo.joinedCount()).toBe(0); // 구독 끊김
    expect(r.spy.state.mock.calls.length).toBeGreaterThan(before); // 서버 상태를 한 번 다시 읽어 맞춤(안전망)
  });

  test('api.subscribe 가 closed 이벤트를 onClosed 로 넘긴다(내용 {id:null …}은 읽지 않음) · onClosed 가 없어도 오류 0', async () => {
    const r = rig('loungeon@email.com');
    const st = await r.api.state();
    const channel = st.ok ? (st.data.channel as string) : '';
    let closedCount = 0;
    const off = r.api.subscribe(channel, { onPost: () => undefined, onGone: () => undefined, onClosed: () => (closedCount += 1) });
    const off2 = r.api.subscribe(channel, { onPost: () => undefined, onGone: () => undefined });
    await wait(10);
    await r.scene('closed');
    expect(closedCount).toBe(1);
    off();
    off2();
  });
});
