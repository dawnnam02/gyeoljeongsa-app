// LG-F 탑승객 라운지 화면 — T4 라운지 줄 · T6(상태 12 + 불러오는 중 · 오류) · 보안 앱 시험 LGF-01 ~ 16(같은 번호) · 숫자 0 · 실시간은 T6 볼 때만 · 닫힘 · 강퇴면 구독 해제
//  서버 대신 데모 모의 서버(demo/loungeDemo — 0042 응답 모양)를 실서버와 같은 파서(loungeApi)로 읽는다. 기준: 화면 요구 T4 '라운지 줄' · T6 · 정책 L장 · 카피 19장 · 보안 LG_라운지위협 7장
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Rect } from 'react-native-svg';

import { createDemoLounge, DEMO_LOUNGE_MY_SEAT, type LoungeFlight } from '@/demo/loungeDemo';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { ChatListScreen } from '@/features/chat/ChatListScreen';
import { createLoungeApi, type LoungeApi } from '@/features/lounge/loungeApi';
import { LOUNGE } from '@/features/lounge/loungeCopy';
import { LoungeScreen } from '@/features/lounge/LoungeScreen';
import { memberA11y } from '@/features/lounge/loungeLogic';
import type { LoungeDeps } from '@/features/lounge/loungeService';
import { COMMON, CRISIS_LINE, crisisNote, REPORT_SHEET, SAFETY } from '@/content/copy';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { colors } from '@/theme/tokens';

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

function rig(email: string, opts: { flight?: LoungeFlight; switchOn?: boolean; serverOn?: boolean } = {}) {
  const user = { id: `u-${email}`, email };
  const demo = createDemoLounge({ flight: () => opts.flight ?? 'in', switchOn: async () => opts.serverOn ?? true, replyMs: 30 });
  const client = { rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args), channel: (n: string) => demo.channel(n), removeChannel: (c: unknown) => demo.removeChannel(c) } as unknown as SupabaseClient;
  const api: LoungeApi = createLoungeApi(client);
  const spy = { state: jest.spyOn(api, 'state'), getPost: jest.spyOn(api, 'getPost'), subscribe: jest.spyOn(api, 'subscribe') };
  const scene = (p_scene: string) => demo.rpc(user, 'demo_lounge_scene', { p_scene });
  const deps: LoungeDeps = { api, switchOn: async () => opts.switchOn ?? true };
  return { demo, api, deps, spy, scene };
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
const ids = (tree: ReactTestRenderer, re: RegExp) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];
const SEAT_RE = /^1[1-9][A-F]$/;
const CLOCK_RE = /^(오전|오후) \d{1,2}:\d{2}$/;
// 화면 글에서 회원 글 본문 · 좌석 꼬리표 · 때를 빼면 숫자가 없다(인원 · 순위 · 공감 수 · 객실 번호 0 — LGF-04)
const screenNumbers = (tree: ReactTestRenderer, bodies: string[]) =>
  allTexts(tree).filter((t) => !bodies.some((b) => t.includes(b)) && !SEAT_RE.test(t) && !CLOCK_RE.test(t) && !/^내 좌석 1[1-9][A-F]$/.test(t) && !t.startsWith('데모 ·') && !t.includes(CRISIS_LINE.phone) && t !== SAFETY.emergency && /\d/.test(t) && !/^1[1-9][A-F] · /.test(t));

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

describe('LG-F T4 라운지 줄(정책 PL-02 · 화면 요구 T4 · 카피 19-2)', () => {
  const list = async (email: string, opts: Parameters<typeof rig>[1] = {}) => {
    const r = rig(email, opts);
    const chat = createDemoChatApi({ who: async () => ({ id: 'me', email: 'chat0@email.com' }) });
    const tree = keep(await mount(<ChatListScreen api={chat} lounge={r.deps} />));
    await wait();
    return { ...r, tree };
  };

  test('비행 중이면 목록 맨 위 한 줄: 제목 + 상태 한 줄 · 좌석 · 인원 · 미리보기 · 새 글 점 · 숫자 0 · 누르면 /lounge · 구독 0', async () => {
    const { tree, demo, spy } = await list('loungeon@email.com');
    expect(textOf(tree, 'lounge-row-title')).toBe(LOUNGE.row.title);
    expect(textOf(tree, 'lounge-row-line')).toBe(LOUNGE.row.lineSeated);
    expect(must(tree, 'lounge-row').props.accessibilityLabel).toBe(LOUNGE.row.a11y(LOUNGE.row.lineSeated));
    const rowTexts = allTexts(tree).filter((t) => t === LOUNGE.row.title || t === LOUNGE.row.lineSeated);
    expect(rowTexts).toHaveLength(2);
    for (const t of allTexts(tree)) expect([t, /1[1-9][A-F]/.test(t)]).toEqual([t, false]); // 좌석 0(LGF-14)
    expect(has(tree, 'lounge-row-seat-box')).toBe(false); // 들어간 뒤: 쪽지 칸은 › (빈 좌석 칸 0)
    expect(spy.subscribe).not.toHaveBeenCalled(); // 줄은 실시간 구독 0
    expect(demo.joinedCount()).toBe(0);
    await press(tree, 'lounge-row');
    expect(mockRouter.push).toHaveBeenCalledWith('/lounge');
  });

  test('상태별 한 줄: 첫 입장 전 · 불 끈 시간 · 착륙 준비 · 기장 안내만 · 강퇴 / 줄 없음: 닫힘 · 나감 · 탑승 아님 · 스위치 꺼짐 · 서버 꺼짐', async () => {
    const lines: [string, string][] = [
      ['loungefirst', LOUNGE.row.lineFirst],
      ['loungedark', LOUNGE.row.lineLightsOut],
      ['loungeland', LOUNGE.row.lineLanding],
      ['loungecaptain', LOUNGE.row.lineCaptainOnly],
      ['loungekicked', LOUNGE.row.lineKicked],
      ['loungepaused', LOUNGE.row.lineSeated],
      ['loungeempty', LOUNGE.row.lineSeated],
    ];
    for (const [email, line] of lines) {
      const { tree } = await list(`${email}@email.com`);
      expect([email, textOf(tree, 'lounge-row-line')]).toEqual([email, line]);
      if (email === 'loungefirst') expect(has(tree, 'lounge-row-seat-box')).toBe(true); // 1A: 빈 좌석 칸
      await act(async () => tree.unmount());
    }
    for (const [email, opts] of [
      ['loungeclosed@email.com', {}],
      ['loungeleft@email.com', {}],
      ['nobody@email.com', { flight: 'none' as const }],
      ['loungeon@email.com', { switchOn: false }],
      ['loungeon@email.com', { serverOn: false }],
    ] as const) {
      const { tree, spy } = await list(email, opts);
      expect([email, has(tree, 'lounge-row')]).toEqual([email, false]);
      expect(allTexts(tree).some((t) => /라운지/.test(t))).toBe(false); // 오류 글 0
      if ('switchOn' in opts) expect(spy.state).not.toHaveBeenCalled(); // 앱 스위치가 꺼지면 서버 호출 0
      await act(async () => tree.unmount());
    }
  });
});

describe('LG-F T6 첫 입장(LGF-05 · PL-03a · PL-04)', () => {
  test('약속 동의는 버튼 하나(체크 칸 0) + [나중에] · 짝 안내 · 약속 세 줄 → 쪽지 [입장권 뜯기] → 좌석 배정 · 좌석표(내 자리만 점)', async () => {
    const { tree, demo } = await open('loungefirst@email.com');
    expect(has(tree, 'lounge-intro')).toBe(true);
    expect(textOf(tree, 'lounge-intro-pair')).toBe(LOUNGE.intro.pairNote);
    expect(textOf(tree, 'lounge-header-sub')).toBe(LOUNGE.header.subtitle('경주'));
    expect(must(tree, 'lounge-intro-agree').props.label ?? textOf(tree, 'lounge-intro-agree')).toBeDefined();
    expect(allTexts(tree)).toContain(LOUNGE.intro.agreeEnter);
    expect(allTexts(tree)).not.toContain('들어가기');
    expect(tree.root.findAll((n) => n.props.accessibilityRole === 'checkbox')).toHaveLength(0);
    expect(LOUNGE.intro.promise).toHaveLength(4); // 3부-차: 약관 제9조의4 ⑥ 1 ~ 5호를 담은 네 줄
    for (let i = 0; i < 4; i += 1) expect(textOf(tree, `lounge-intro-promise-${i}`)).toBe(LOUNGE.intro.promise[i]);
    expect(demo.joinedCount()).toBe(0); // 좌석 전: 구독 0
    await press(tree, 'lounge-intro-agree');
    await wait();
    expect(has(tree, 'lounge-stub')).toBe(true);
    expect(textOf(tree, 'lounge-stub-body')).toBe(LOUNGE.stub.body);
    await press(tree, 'lounge-stub-tear');
    await wait(500);
    expect(isOpen(tree, 'lounge-seat-sheet')).toBe(true);
    expect(textOf(tree, 'lounge-seat-assigned')).toBe(LOUNGE.seat.assigned(DEMO_LOUNGE_MY_SEAT));
    // LGF-06 좌석표: 54자리 같은 선 · 내 자리만 와인 테두리 + 점 하나 · 읽기 이름 한 줄
    const map = must(tree, 'lounge-seatmap');
    expect(map.props.accessibilityLabel).toBe(LOUNGE.a11y.seatMap(DEMO_LOUNGE_MY_SEAT));
    expect(map.findAllByType(Circle)).toHaveLength(1);
    const rects = map.findAllByType(Rect);
    expect(rects).toHaveLength(55); // 기체 윤곽 1 + 54자리
    expect(rects.filter((r) => r.props.stroke === colors.accent)).toHaveLength(1);
    expect(allTexts(tree).some((t) => /창가|통로|가운데/.test(t))).toBe(false);
    expect(has(tree, 'lounge-messages')).toBe(true);
    expect(demo.joinedCount()).toBe(1);
  });

  test('[나중에] · ✕ = 들어가지 않음(기록 · 좌석 0) → T4 목록 / 약속이 바뀌면 다시 받음(좌석 그대로)', async () => {
    const a = await open('loungefirst@email.com');
    await press(a.tree, 'lounge-intro-later');
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    expect(a.demo.peek({ id: 'u-loungefirst@email.com', email: 'loungefirst@email.com' })).toMatchObject({ acked: null, seat: null });
    const b = await open('loungerules@email.com');
    expect(textOf(b.tree, 'lounge-intro-rules-changed')).toBe(LOUNGE.intro.rulesChanged);
    await press(b.tree, 'lounge-intro-agree');
    await wait();
    expect(has(b.tree, 'lounge-messages')).toBe(true);
    expect(allTexts(b.tree)).toContain(LOUNGE.header.mySeat(DEMO_LOUNGE_MY_SEAT));
  });
});

describe('LG-F T6 객실(open) — LGF-04 · 07 · 08 · 11 · 12 · 13 · 15 · 16', () => {
  test('말풍선: 좌석 꼬리표(읽기 이름 13A 좌석 · 누를 수 없음) · 남의 글 한 색 · 내 글 강조 + 나 · 공감받았어요(내 글만) · 숫자 0 · 접속 · 입력 중 · 읽음 0', async () => {
    const { tree, api } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const bodies = posts.flatMap((p) => (p.kind !== 'captain' ? [p.body] : []));
    expect(screenNumbers(tree, bodies)).toEqual([]);
    for (const t of allTexts(tree)) expect(t).not.toMatch(/접속 중|입력 중|읽음|명 접속|\d+\s*명|\d+\s*개/);
    const tags = tree.root.findAll((n) => typeof n.props.testID === 'string' && /^lounge-post-\d+-seat$/.test(n.props.testID) && n.props.accessibilityLabel);
    expect(tags.length).toBeGreaterThan(5);
    for (const t of tags) {
      expect(t.props.accessibilityLabel).toMatch(/^1[1-9][A-F] 좌석$/); // LGF-13
      expect(t.props.onPress).toBeUndefined(); // LGF-12 좌석 지목 0
    }
    const mineIdx = posts.findIndex((p) => p.kind !== 'captain' && p.mine);
    expect(textOf(tree, `lounge-post-${mineIdx}-me`)).toBe(LOUNGE.msg.me);
    expect(textOf(tree, `lounge-post-${mineIdx}-received`)).toBe(LOUNGE.empathy.received); // 글쓴이에게만(개수 0)
    expect(has(tree, `lounge-post-${mineIdx}-empathy`)).toBe(false); // 내 글엔 공감 단추 0
    const otherIdx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    const other = posts[otherIdx];
    expect(must(tree, `lounge-post-${otherIdx}-bubble`).props.accessibilityLabel).toBe(other.kind !== 'captain' ? memberA11y(other) : ''); // '13A 좌석, 오늘 질문에 답한 글, {글}' — 좌석 밖 정보 0
    const plain = posts.find((p) => p.kind === 'member' && !p.mine && p.quote === null);
    if (plain && plain.kind !== 'captain') expect(memberA11y(plain)).toBe(LOUNGE.a11y.msg(plain.seat, plain.body));
    expect(has(tree, `lounge-post-${otherIdx}-received`)).toBe(false);
    const bg = (i: number) => [must(tree, `lounge-post-${i}-bubble`).props.style].flat(3).find((x: { backgroundColor?: string } | undefined) => x?.backgroundColor)?.backgroundColor;
    expect(bg(mineIdx)).toBe(colors.accentAlt);
    const others = posts.map((p, i) => (p.kind !== 'captain' && !p.mine ? i : -1)).filter((i) => i >= 0);
    expect(new Set(others.map(bg))).toEqual(new Set([colors.bubbleAi])); // 남의 글은 모두 한 색
    // LGF-07 공감: 누른 표시는 나에게만 · 개수 0
    await press(tree, `lounge-post-${otherIdx}-empathy`);
    await wait();
    expect(must(tree, `lounge-post-${otherIdx}-empathy`).props.selected).toBe(true);
    expect(tree.root.findAll((n) => n.props.testID === `lounge-post-${otherIdx}-empathy` && n.props.accessibilityState)[0]?.props.accessibilityState).toEqual({ selected: true }); // 읽기: 상태 속성(개수 0)
    expect(allTexts(tree).filter((t) => /공감/.test(t) && /\d/.test(t))).toEqual([]);
    // LGF-11 최근 200개 · 더 불러오기 0
    expect(textOf(tree, 'lounge-top-note')).toBe(LOUNGE.room.topNote);
    expect(must(tree, 'lounge-messages').props.onEndReached).toBeUndefined();
    expect(allTexts(tree).some((t) => /더 (보기|불러오기)/.test(t))).toBe(false);
    // 첨부 · 이모지 · 1:1 · 프로필 0(LGF-12): 입력창은 글 칸 + 보내기뿐
    expect(ids(tree, /^lounge-composer-(photo|voice|file|emoji)/)).toEqual([]);
  });

  test('글 메뉴(LGF-12): 남의 글 = 인용 · 숨기기 · 신고 / 내 글 = 지우기 · 프로필 · 1:1 0 · 인용 답장(LGF-08 — 알림 · 멘션 0)', async () => {
    const { tree, api } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const otherIdx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    const other = posts[otherIdx];
    await press(tree, `lounge-post-${otherIdx}-more`);
    expect(isOpen(tree, 'lounge-msg-menu')).toBe(true);
    expect(textOf(tree, 'lounge-msg-menu-title')).toBe(other.kind !== 'captain' ? LOUNGE.msgMenu.title(other.seat) : '');
    expect(ids(tree, /^lounge-msg-/).filter((x) => !x.endsWith('-title') && x !== 'lounge-msg-menu' && !x.startsWith('lounge-msg-menu-')).sort()).toEqual(['lounge-msg-close', 'lounge-msg-hide', 'lounge-msg-quote', 'lounge-msg-report']);
    await press(tree, 'lounge-msg-quote');
    expect(textOf(tree, 'lounge-composer-mode-text')).toBe(other.kind !== 'captain' ? LOUNGE.quote.composing(other.seat) : '');
    await typeInto(tree, 'lounge-input', '저도 그렇게 생각해요');
    await press(tree, 'lounge-send');
    await wait();
    const after = await api.state();
    const mine = (after.ok ? after.data.posts : []).filter((p) => p.kind !== 'captain' && p.mine && p.body === '저도 그렇게 생각해요');
    expect(mine).toHaveLength(1);
    expect(mine[0].kind !== 'captain' && mine[0].quote?.id).toBe(other.id);
    expect(has(tree, 'lounge-composer-mode')).toBe(false);
    expect(allTexts(tree).some((t) => t.startsWith('@'))).toBe(false);
    const myIdx = posts.findIndex((p) => p.kind !== 'captain' && p.mine);
    await press(tree, `lounge-post-${myIdx}-more`);
    expect(ids(tree, /^lounge-msg-(delete|quote|hide|report)$/)).toEqual(['lounge-msg-delete']);
  });

  test('LGF-15 신고: 사유 5(RP4 ~ RP8 · RP1 ~ RP3 0) · RP6 아래 안내 · 접수 한 줄(결과 · 상대 · 신고 수 0) → 이 좌석도 숨길까요 → 숨김(나에게만 · 인용 상자 가림) → 숨긴 좌석 · 다시 보기', async () => {
    const { tree, api, demo } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const otherIdx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
    const seat = posts[otherIdx].kind !== 'captain' ? (posts[otherIdx] as { seat: string }).seat : '';
    await press(tree, `lounge-post-${otherIdx}-more`);
    await press(tree, 'lounge-msg-report');
    expect(isOpen(tree, 'lounge-report')).toBe(true);
    expect(ids(tree, /^lounge-report-RP\d$/).sort()).toEqual(['lounge-report-RP4', 'lounge-report-RP5', 'lounge-report-RP6', 'lounge-report-RP7', 'lounge-report-RP8']);
    expect(textOf(tree, 'lounge-report-target')).toBe(LOUNGE.report.target(seat));
    await press(tree, 'lounge-report-RP6');
    expect(textOf(tree, 'lounge-report-minor')).toBe(REPORT_SHEET.reasonRP6Note);
    await press(tree, 'lounge-report-submit');
    await wait();
    expect(textOf(tree, 'lounge-toast-text')).toBe(LOUNGE.report.done);
    expect(isOpen(tree, 'lounge-report-hide')).toBe(true);
    expect(textOf(tree, 'lounge-report-hide-sub')).toBe(LOUNGE.report.pairNote); // 0043 get_lounge_report_note no_pair(RP6 · 17:30 전) — 신고자에게만
    await press(tree, 'lounge-report-hide-confirm');
    await wait();
    expect(textOf(tree, 'lounge-toast-text')).toBe(LOUNGE.hide.done);
    expect(allTexts(tree)).toContain(LOUNGE.hidden.unhide);
    const shownSeats = new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && /^lounge-post-\d+-seat$/.test(n.props.testID) && n.props.accessibilityLabel).map((n) => n.props.accessibilityLabel));
    expect(shownSeats.has(LOUNGE.a11y.seat(seat))).toBe(false);
    expect(demo.peek({ id: 'u-loungeon@email.com', email: 'loungeon@email.com' })).toMatchObject({ reports: 1, hides: [seat] });
    await press(tree, 'lounge-header-menu');
    await press(tree, 'lounge-menu-hidden');
    expect(allTexts(tree)).toContain(LOUNGE.hidden.row(seat));
    await press(tree, `lounge-hidden-unhide-${seat}`);
    await wait();
    expect(textOf(tree, 'lounge-toast-text')).toBe(LOUNGE.hidden.unhidden);
    expect(demo.peek({ id: 'u-loungeon@email.com', email: 'loungeon@email.com' }).hides).toEqual([]);
  });

  test('신고 쌍 안내(0043): 짝 제외 쌍이 아닌 사유(RP5)면 줄째 없음 · 이미 숨긴 좌석이면 토스트 둘째 줄', async () => {
    const { tree, api } = await open('loungeon@email.com');
    const st = await api.state();
    const posts = st.ok ? st.data.posts : [];
    const idx = posts.map((p, i) => (p.kind !== 'captain' && !p.mine ? i : -1)).filter((i) => i >= 0);
    await press(tree, `lounge-post-${idx[0]}-more`);
    await press(tree, 'lounge-msg-report');
    await press(tree, 'lounge-report-RP5');
    await press(tree, 'lounge-report-submit');
    await wait();
    expect(isOpen(tree, 'lounge-report-hide')).toBe(true);
    expect(has(tree, 'lounge-report-hide-sub')).toBe(false);
    expect(allTexts(tree)).not.toContain(LOUNGE.report.pairNote);
  });

  test('내 글 지우기 · 나도 답하기(오늘 질문 꼬리표) · 둘 중 하나(같은 크기 두 버튼 → 내가 고른 쪽 · 숫자 0) · 보내기 실패는 입력칸 아래 한 줄(글 남김) · LGF-16 위기 안내는 쓴 사람에게만', async () => {
    const { tree, api } = await open('loungeon@email.com');
    let st = await api.state();
    let posts = st.ok ? st.data.posts : [];
    const noonIdx = posts.findIndex((p) => p.kind === 'captain' && p.captainKind === 'noon');
    await press(tree, `lounge-post-${noonIdx}-answer`);
    expect(textOf(tree, 'lounge-composer-mode-text')).toBe(LOUNGE.answer.composing);
    await typeInto(tree, 'lounge-input', '퇴근길 노을 보고 웃었어요');
    await press(tree, 'lounge-send');
    await wait();
    st = await api.state();
    posts = st.ok ? st.data.posts : [];
    const ansIdx = posts.findIndex((p) => p.kind !== 'captain' && p.body === '퇴근길 노을 보고 웃었어요');
    expect(textOf(tree, `lounge-post-${ansIdx}-answer-tag`)).toBe(LOUNGE.answer.tag);
    const balIdx = posts.findIndex((p) => p.kind === 'captain' && p.captainKind === 'balance' && p.pickOpen);
    expect(has(tree, `lounge-post-${balIdx}-pick-a`) && has(tree, `lounge-post-${balIdx}-pick-b`)).toBe(true);
    await press(tree, `lounge-post-${balIdx}-pick-a`);
    await wait();
    expect(textOf(tree, `lounge-post-${balIdx}-mine`)).toBe(LOUNGE.balance.mine);
    expect(textOf(tree, `lounge-post-${balIdx}-waiting`)).toBe(LOUNGE.balance.waiting);
    // 보내기 실패: 거르기 → 입력칸 아래 한 줄 · 글은 칸에 남음
    await typeInto(tree, 'lounge-input', '제 번호는 010-1234-5678 이에요');
    await press(tree, 'lounge-send');
    await wait();
    expect(textOf(tree, 'lounge-send-error')).toBe(LOUNGE.error.contact);
    expect(must(tree, 'lounge-input').props.value).toBe('제 번호는 010-1234-5678 이에요');
    // 위기 낱말: 보내지고, 쓴 사람 글 아래에만 안내(닫기)
    await typeInto(tree, 'lounge-input', '요즘 사라지고 싶다는 생각이 들어요');
    await press(tree, 'lounge-send');
    await wait();
    st = await api.state();
    posts = st.ok ? st.data.posts : [];
    const helpIdx = posts.findIndex((p) => p.kind !== 'captain' && p.body === '요즘 사라지고 싶다는 생각이 들어요');
    expect(textOf(tree, `lounge-post-${helpIdx}-crisis-text`)).toBe(crisisNote()); // 공용 CRISIS.note(상담전화 109)
    expect(textOf(tree, `lounge-post-${helpIdx}-crisis-emergency`)).toBe(SAFETY.emergency); // 둘째 줄 112 · 119
    expect(ids(tree, /-crisis$/)).toHaveLength(1);
    await press(tree, `lounge-post-${helpIdx}-crisis-close`);
    expect(ids(tree, /-crisis$/)).toHaveLength(0);
    // 지우기
    await press(tree, `lounge-post-${helpIdx}-more`);
    await press(tree, 'lounge-msg-delete');
    expect(isOpen(tree, 'lounge-delete')).toBe(true);
    await press(tree, 'lounge-delete-confirm');
    await wait();
    expect(textOf(tree, 'lounge-toast-text')).toBe(LOUNGE.delete.done);
    expect(allTexts(tree)).not.toContain('요즘 사라지고 싶다는 생각이 들어요');
  });

  test('실시간: 새 글은 그 글 하나만 다시 읽기(lounge_get_post) · 목록 전체 다시 읽기 0 · 이벤트는 넷만', async () => {
    const { tree, spy } = await open('loungeon@email.com');
    const statesBefore = spy.state.mock.calls.length;
    await typeInto(tree, 'lounge-input', '반가워요');
    await press(tree, 'lounge-send');
    await wait(120); // 가상 탑승객 답(30ms) → 방송
    // 3부-카(FB-020): 새 글(1) + 그 글이 내 글을 인용하면 내 글의 상태 한 번(2) — 목록 전체 다시 읽기는 여전히 0
    expect(spy.getPost).toHaveBeenCalledTimes(2);
    expect(spy.state.mock.calls.length).toBe(statesBefore);
    expect(allTexts(tree)).toContain('반가워요. 천천히 이야기 나눠요.');
    expect(allTexts(tree)).toContain(LOUNGE.empathy.received); // 같은 화면에서 내 글에 '공감받았어요'(나에게만)
  });
});

describe('LG-F T6 상태별(셈표) · 소등 · 착륙 준비(LGF-07 · 15) · 닫힘 · 강퇴 · 나감(LGF-10) · 스위치(LGF-09)', () => {
  test('불 끈 시간 · 착륙 준비: 띠 + 입력 줄 한 줄 · 공감 단추 · 공감받았어요 0 · 인용 0 · 숨김 · 신고는 됨 · 남은 시간 0', async () => {
    for (const [email, band, line] of [
      ['loungedark', LOUNGE.state.lightsOut, LOUNGE.composer.lightsOut],
      ['loungeland', LOUNGE.state.landing, LOUNGE.composer.landing],
    ] as const) {
      const { tree, api } = await open(`${email}@email.com`);
      expect(textOf(tree, 'lounge-band-title')).toBe(band);
      expect(textOf(tree, 'lounge-band-note')).toBe(LOUNGE.state.safetyNote);
      expect(textOf(tree, 'lounge-composer-line-text')).toBe(line);
      expect(has(tree, 'lounge-input')).toBe(false);
      expect(ids(tree, /-empathy$/)).toEqual([]);
      expect(ids(tree, /-received$/)).toEqual([]);
      expect(ids(tree, /-answer$/)).toEqual([]);
      for (const t of allTexts(tree)) expect(t).not.toMatch(/\d+\s*(분|시간|초)\s*(남|뒤)|남았|곧/);
      const st = await api.state();
      const posts = st.ok ? st.data.posts : [];
      const otherIdx = posts.findIndex((p) => p.kind !== 'captain' && !p.mine);
      await press(tree, `lounge-post-${otherIdx}-more`);
      expect(ids(tree, /^lounge-msg-(quote|hide|report|delete)$/).sort()).toEqual(['lounge-msg-hide', 'lounge-msg-report']);
      await act(async () => tree.unmount());
    }
  });

  test('아침(어제 둘 중 하나 결과 — 말 세 단계) · 기장 안내만(좌석 · 입력 0 · 창 그림) · 빈 객실(읽기만) · 쓰기 멈춤(내 글도 가림)', async () => {
    const m = await open('loungemorning@email.com');
    expect(allTexts(m.tree)).toContain(LOUNGE.balance.even);
    expect(allTexts(m.tree)).toContain(LOUNGE.balance.resultTitle);
    const c = await open('loungecaptain@email.com');
    expect(textOf(c.tree, 'lounge-captain-only-title')).toBe(LOUNGE.captainOnly.title);
    expect(has(c.tree, 'lounge-window-art')).toBe(true);
    expect(has(c.tree, 'lounge-input') || has(c.tree, 'lounge-header-seat')).toBe(false);
    expect(ids(c.tree, /^lounge-captain-\d+$/).length).toBeGreaterThan(0);
    expect(c.demo.joinedCount()).toBe(0);
    const e = await open('loungeempty@email.com');
    expect(textOf(e.tree, 'lounge-room-gathering')).toBe(LOUNGE.room.gathering);
    expect(textOf(e.tree, 'lounge-composer-line-text')).toBe(LOUNGE.composer.gathering);
    const p = await open('loungepaused@email.com');
    expect(textOf(p.tree, 'lounge-band-title')).toBe(LOUNGE.stopped.title);
    expect(textOf(p.tree, 'lounge-composer-line-text')).toBe(LOUNGE.composer.stopped);
    expect(ids(p.tree, /-me$/)).toEqual([]);
  });

  test('LGF-10 닫힘 · 강퇴 · 나감 화면(직접 장면): 글 0 · 구독 0 · 버튼', async () => {
    const closed = await open('loungeclosed@email.com');
    expect(textOf(closed.tree, 'lounge-closed-title')).toBe(LOUNGE.closed.title);
    expect(textOf(closed.tree, 'lounge-closed-body')).toBe(LOUNGE.closed.body);
    expect(ids(closed.tree, /^lounge-post-/)).toEqual([]);
    expect(closed.demo.joinedCount()).toBe(0);
    await press(closed.tree, 'lounge-closed-button');
    expect(mockRouter.replace).toHaveBeenCalledWith('/boarding');
    const kicked = await open('loungekicked@email.com');
    expect(textOf(kicked.tree, 'lounge-kicked-title')).toBe(LOUNGE.kicked.title);
    expect(textOf(kicked.tree, 'lounge-composer-line-text')).toBe(LOUNGE.composer.stopped);
    expect(kicked.demo.joinedCount()).toBe(0);
    const left = await open('loungeleft@email.com');
    expect(textOf(left.tree, 'lounge-left-title')).toBe(LOUNGE.left.title);
    expect(left.demo.joinedCount()).toBe(0);
  });

  test('열린 객실에서 닫힘 · 강퇴로 바뀌면 구독을 끊고 글 · 화면 메모리를 비운다(데모 줄 = 다시 읽기)', async () => {
    const r = rig('loungeon@email.com');
    const deps: LoungeDeps = { ...r.deps, demo: { scene: async () => null, next: async () => null, line: () => '데모 · 다음 장면' } };
    const tree = keep(await mount(<LoungeScreen deps={deps} toastMs={60_000} />));
    await wait();
    expect(r.demo.joinedCount()).toBe(1);
    await typeInto(tree, 'lounge-input', '쓰던 글');
    for (const sc of ['closed', 'kicked']) {
      await act(async () => {
        await r.scene('open');
      });
      await press(tree, 'lounge-demo-scene');
      await wait();
      expect(r.demo.joinedCount()).toBe(1);
      await act(async () => {
        await r.scene(sc);
      });
      await press(tree, 'lounge-demo-scene'); // deps.demo.next → 다시 읽기
      await wait();
      expect([sc, r.demo.joinedCount()]).toEqual([sc, 0]);
      expect(ids(tree, /^lounge-post-\d+$/)).toEqual([]);
      expect(has(tree, 'lounge-input')).toBe(false);
    }
    await act(async () => tree.unmount());
  });

  test('화면을 떠나면(언마운트) 구독을 끊는다 · LGF-09 스위치 꺼짐 · 서버 꺼짐 · 처음부터 탑승 아님 = T4 목록으로(PL-35) · 불러오기 실패 = 한 줄 + 다시 시도', async () => {
    const a = await open('loungeon@email.com');
    expect(a.demo.joinedCount()).toBe(1);
    await act(async () => a.tree.unmount());
    expect(a.demo.joinedCount()).toBe(0);
    const off = await open('loungeon@email.com', { switchOn: false });
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    expect(off.spy.state).not.toHaveBeenCalled();
    mockRouter.replace.mockClear();
    await open('loungeon@email.com', { serverOn: false });
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    mockRouter.replace.mockClear();
    await open('nobody@email.com', { flight: 'none' });
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    const failing: LoungeApi = { ...createLoungeApi({ rpc: async () => ({ data: null, error: { code: null, message: 'Failed to fetch' } }) } as unknown as SupabaseClient) };
    const t = keep(await mount(<LoungeScreen deps={{ api: failing, switchOn: async () => true }} />));
    await wait();
    expect(has(t, 'lounge-error')).toBe(true);
    expect(allTexts(t)).toContain(COMMON.offline);
  });

  test('동작 줄이기: 쪽지 뜯기는 투명도만(이동 · 회전 0)이고 같은 흐름으로 좌석이 정해진다', async () => {
    act(() => reduceMotionStore.set(true));
    const { tree } = await open('loungefirst@email.com');
    await press(tree, 'lounge-intro-agree');
    await wait();
    await press(tree, 'lounge-stub-tear');
    await wait(300);
    expect(textOf(tree, 'lounge-seat-assigned')).toBe(LOUNGE.seat.assigned(DEMO_LOUNGE_MY_SEAT));
  });
});
