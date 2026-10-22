// 11 호감 · 14 호감 없음 화면(F6 1단계, 세부청사진 F6 조건 1 · 2 · 3 · 4 · 5 · 6 · T2 · K2 11 상태 표)
//  탭 3개 · 최신순 · 수락 → 연결됨 · 거절 → 사라짐(확인창 없음) · 만료 표시(시각 조작) · 빈 상태 3종 · 연결됨 안내 · ⋯ 신고 · 차단 · 로딩 · 오류 · 오프라인 · 접근성
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON, REPORT_SHEET, SAFETY } from '@/content/copy';
import { LIKES } from '@/content/likesCopy';
import { LikesScreen, type LikesDeps, type LikesScreenApi } from '@/features/likes/LikesScreen';
import { createLikesApi, type ConnectedLike, type LikeLists, type ReceivedLike, type SentLike } from '@/lib/likesApi';
import { createDemoLikes } from '@/lib/likesDemo';
import { setToast as passToast, takeToast } from '@/lib/toastBus';
import { onHaptic, scene } from '@/motion';
import { size } from '@/theme/tokens';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때 시간 초과를 막는다(F2L · F6 통합 10-16)

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const T0 = Date.UTC(2026, 9, 15, 5, 0, 0);

const received = (over: Partial<ReceivedLike> = {}): ReceivedLike => ({ kind: 'received', likeId: 'l1', userId: 'u1', createdAt: T0 - 2 * HOUR, expiresAt: T0 - 2 * HOUR + WEEK, head: '박OO · 29 · 경기 성남', facePhotoId: 'ph1', ...over });
const sent = (over: Partial<SentLike> = {}): SentLike => ({ kind: 'sent', likeId: 's1', userId: 'u5', createdAt: T0 - 3 * DAY - HOUR, head: '문OO · 32 · 서울 마포', facePhotoId: null, ...over });
const connected = (over: Partial<ConnectedLike> = {}): ConnectedLike => ({ kind: 'connected', matchId: 'm1', userId: 'u3', createdAt: T0 - 30 * HOUR, head: '한OO · 31 · 서울 강서', facePhotoId: null, ...over });
const FULL = (): LikeLists => ({
  received: [received(), received({ likeId: 'l2', userId: 'u2', createdAt: T0 - 26 * HOUR, expiresAt: T0 - 26 * HOUR + WEEK, head: '최OO · 33 · 서울 송파', facePhotoId: null })],
  sent: [sent()],
  connected: [connected()],
});
const EMPTY = (): LikeLists => ({ received: [], sent: [], connected: [] });

// 서버 흉내: 수락 · 거절이 다음 불러오기에 반영된다
function setup(start: LikeLists | 'network' | 'server' = FULL(), over: Partial<LikesScreenApi> = {}) {
  let clock = T0;
  let state = start;
  const api = {
    loadAll: jest.fn(async () => (typeof state === 'string' ? { ok: false as const, reason: state } : { ok: true as const, data: structuredClone(state) })),
    accept: jest.fn(async (likeId: string) => {
      if (typeof state === 'string') return { ok: false as const, reason: 'network' as const };
      const hit = state.received.find((r) => r.likeId === likeId);
      if (!hit) return { ok: false as const, reason: 'unavailable' as const };
      state = { ...state, received: state.received.filter((r) => r !== hit), connected: [{ kind: 'connected', matchId: `m-${likeId}`, userId: hit.userId, createdAt: clock, head: hit.head, facePhotoId: hit.facePhotoId }, ...state.connected] };
      return { ok: true as const, data: { matchId: `m-${likeId}`, userId: hit.userId } };
    }),
    decline: jest.fn(async (likeId: string) => {
      if (typeof state === 'string') return { ok: false as const, reason: 'network' as const };
      state = { ...state, received: state.received.filter((r) => r.likeId !== likeId) };
      return { ok: true as const };
    }),
    photoUrl: jest.fn(async (id: string) => `https://example.test/${id}.jpg`),
    report: jest.fn(async () => ({ ok: true as const })),
    block: jest.fn(async (userId: string) => {
      if (typeof state !== 'string') state = { received: state.received.filter((r) => r.userId !== userId), sent: state.sent.filter((r) => r.userId !== userId), connected: state.connected.filter((r) => r.userId !== userId) };
      return { ok: true as const };
    }),
    ...over,
  } as unknown as LikesScreenApi;
  const deps: LikesDeps = { api, now: () => clock, tickMs: 20, toastMs: 2_000 };
  return {
    deps,
    api: api as unknown as Record<string, jest.Mock>,
    setNow: (t: number) => (clock = t),
    setServer: (next: LikeLists | 'network' | 'server') => (state = next),
  };
}

const wait = (ms: number) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
});
// 탭 칸은 공용 Chip 'tab'(2단계 통합): 같은 testID 의 겉 요소(Chip)가 아니라 aria-selected 를 가진 누르는 요소를 본다
const selected = (tree: ReactTestRenderer, tab: string) => tree.root.findAll((n) => n.props.testID === `likes-tab-${tab}` && n.props['aria-selected'] !== undefined)[0]?.props['aria-selected'];
const rowCount = (tree: ReactTestRenderer, tab: string) => tree.root.findAll((n) => typeof n.props.testID === 'string' && new RegExp(`^like-row-${tab}-\\d+$`).test(n.props.testID) && typeof n.type === 'string').length;
// 공통 Pressable(스타일 · 접근성 이름 · disabled 를 가진 쪽): 같은 testID 의 부품 겉 요소가 아니라 그 안의 누르는 요소
const inner = (tree: ReactTestRenderer, id: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id && n.props.style !== undefined)[0];
  if (!node) throw new Error(`testID "${id}" 의 누르는 요소가 없어요`);
  return node;
};
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style) as Record<string, unknown>;
const safetyText = (tree: ReactTestRenderer) => tree.root.findAll((n) => n.props.testID === 'likes-safety' && typeof n.props.children === 'string')[0]?.props.children ?? null; // SafetyLine 안의 글
const noRankWords = (tree: ReactTestRenderer) => !/등급|점수|순위|퍼센트/.test(allTexts(tree).join('\n'));

// 화면마다 시계(setInterval) · 토스트 타이머가 있어 시험이 끝나면 내린다
const trees: ReactTestRenderer[] = [];
async function view(element: ReactElement): Promise<ReactTestRenderer> {
  const tree = await mount(element);
  trees.push(tree);
  return tree;
}
afterEach(async () => {
  await act(async () => {
    for (const tree of trees.splice(0)) tree.unmount();
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  takeToast();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});

describe('11 기본 (조건 1 · 6)', () => {
  test('머리 "호감" · 안전 한 줄 · 탭 3개(보낸 · 받은 · 연결됨) · 처음은 받은 호감', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(has(tree, 'screen-11')).toBe(true);
    expect(hasText(tree, LIKES.headerTitle)).toBe(true);
    expect(has(tree, 'profile-button')).toBe(true); // F11: 머리 오른쪽 위 원형 프로필 사진
    expect(safetyText(tree)).toBe(SAFETY.line);
    const tabs = ['sent', 'received', 'connected'].map((k) => inner(tree, `likes-tab-${k}`));
    expect(tabs.map((n) => n.props.accessibilityLabel)).toEqual(['보낸 호감', '받은 호감', '연결됨']);
    expect(tabs.every((n) => n.props.accessibilityRole === 'tab')).toBe(true);
    expect(tree.root.findAll((n) => typeof n.props.testID === 'string' && /^likes-tab-/.test(n.props.testID) && typeof n.type === 'string').map((n) => n.props.testID)).toEqual(['likes-tab-sent', 'likes-tab-received', 'likes-tab-connected']); // 화면 순서
    expect(must(tree, 'likes-tabs').props.accessibilityRole).toBe('tablist');
    expect([selected(tree, 'sent'), selected(tree, 'received'), selected(tree, 'connected')]).toEqual([false, true, false]);
    expect(flat(inner(tree, 'likes-tab-sent')).minHeight).toBe(size.touchMin); // 칩은 28 이지만 누르는 면은 44
  });

  test('받은 호감 행: 이름 줄 · "{시간} · 받은 호감" · [수락][거절](높이 44) · 만료까지 남은 날 · ⋯(44)', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(rowCount(tree, 'received')).toBe(2);
    expect(textOf(tree, 'like-head-received-0')).toBe('박OO · 29 · 경기 성남');
    expect(textOf(tree, 'like-sub-received-0')).toBe('2시간 전 · 받은 호감');
    expect(textOf(tree, 'like-sub-received-1')).toBe('어제 · 받은 호감');
    expect(textOf(tree, 'like-expiry-received-0')).toBe('6일 뒤 만료');
    expect(textOf(tree, 'like-expiry-received-1')).toBe('5일 뒤 만료');
    for (const id of ['like-accept-received-0', 'like-decline-received-0']) expect(flat(inner(tree, id)).minHeight).toBe(size.touchMin);
    expect(inner(tree, 'like-accept-received-0').props.accessibilityLabel).toBe('박OO · 29 · 경기 성남 호감 수락');
    expect(inner(tree, 'like-decline-received-0').props.accessibilityLabel).toBe('박OO · 29 · 경기 성남 호감 거절');
    expect(inner(tree, 'like-more-received-0').props.accessibilityLabel).toBe(REPORT_SHEET.moreA11y);
    expect(flat(inner(tree, 'like-more-received-0'))).toMatchObject({ width: size.touchMin, height: size.touchMin });
    expect(inner(tree, 'like-open-received-0').props.accessibilityLabel).toBe('박OO · 29 · 경기 성남 프로필 보기, 2시간 전 · 받은 호감');
    expect(s.api.photoUrl).toHaveBeenCalledWith('ph1');
    expect(noRankWords(tree)).toBe(true);
  });

  test('보낸 호감: "{시간} · 수락 대기"만(버튼 · 남은 시간 없음) · 연결됨: "서로 수락했어요 · 연락 방법은 준비 중이에요"(버튼 없음)', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'likes-tab-sent');
    expect(selected(tree, 'sent')).toBe(true);
    expect(rowCount(tree, 'sent')).toBe(1);
    expect(textOf(tree, 'like-sub-sent-0')).toBe('3일 전 · 수락 대기');
    expect(has(tree, 'like-accept-sent-0') || has(tree, 'like-expiry-sent-0')).toBe(false);
    expect(has(tree, 'like-more-sent-0')).toBe(true);
    await press(tree, 'likes-tab-connected');
    expect(rowCount(tree, 'connected')).toBe(1);
    expect(textOf(tree, 'like-head-connected-0')).toBe('한OO · 31 · 서울 강서');
    expect(textOf(tree, 'like-sub-connected-0')).toBe(LIKES.connectedNote);
    expect(has(tree, 'like-accept-connected-0')).toBe(false);
    expect(safetyText(tree)).toBe(SAFETY.line); // 세 탭 맨 위
    expect(noRankWords(tree)).toBe(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/\(2차\)|010-|@/); // 개발 단계 표기 · 연락처 없음
  });

  test('연결 알림으로 들어오면(?tab=connected) 연결됨 탭부터 · 행을 누르면 10', async () => {
    mockParams.tab = 'connected';
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(selected(tree, 'connected')).toBe(true);
    await press(tree, 'like-open-connected-0');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/candidate/[id]', params: { id: 'u3' } });
    await press(tree, 'likes-tab-received');
    await press(tree, 'like-open-received-1');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/candidate/[id]', params: { id: 'u2' } });
  });

  test('최신순(조건 1): 모의 서버 + 실제 서버 연결 코드로 그려도 세 탭 모두 최신이 위', async () => {
    const demo = createDemoLikes({ now: () => T0 });
    const user = { id: 'demo-u', email: 'f6@email.com' };
    demo.noteSent(user, 'demo-liker-3');
    const client = { rpc: (name: string, args: Record<string, unknown>) => demo.rpc(user, name, args) } as unknown as SupabaseClient;
    const likes = createLikesApi(client);
    const s = setup();
    const deps: LikesDeps = { ...s.deps, api: { ...s.deps.api, loadAll: likes.loadAll, accept: likes.accept, decline: likes.decline } };
    const tree = await view(<LikesScreen deps={deps} />);
    expect([textOf(tree, 'like-head-received-0'), textOf(tree, 'like-head-received-1')]).toEqual(['박OO · 29 · 경기 성남시', '윤OO · 34 · 서울 서초구']);
    await press(tree, 'likes-tab-sent');
    expect([textOf(tree, 'like-sub-sent-0'), textOf(tree, 'like-sub-sent-1')]).toEqual(['1분 전 · 수락 대기', '3일 전 · 수락 대기']);
    // 수락 → 서버(모의)에 연결이 생기고 연결됨 탭 맨 위(조건 2, 모의 · 계정 2개는 Q1)
    await press(tree, 'likes-tab-received');
    await press(tree, 'like-accept-received-0');
    await wait(30);
    expect(demo.peek(user).connected).toEqual(['demo-match-1', 'demo-liker-1']);
    await press(tree, 'likes-tab-connected');
    expect(textOf(tree, 'like-head-connected-0')).toBe('박OO · 29 · 경기 성남시');
    // 거절 → 서버(모의)에 거절이 남고 목록에서 사라진다(조건 3, 모의)
    await press(tree, 'likes-tab-received');
    await press(tree, 'like-decline-received-0');
    await wait(30);
    expect(demo.peek(user).declinedByMe).toEqual(['demo-liker-2']);
    expect(rowCount(tree, 'received')).toBe(0);
    expect(has(tree, 'screen-14')).toBe(true);
  });
});

describe('수락 · 거절 (조건 2 · 3, K2 11 입력 검증)', () => {
  test('[수락] → 받은 호감에서 사라지고 연결됨 탭 맨 위에 생긴다 · 토스트 · 탭은 그대로', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'like-accept-received-0');
    expect(s.api.accept).toHaveBeenCalledWith('l1');
    expect(hasText(tree, LIKES.acceptDone)).toBe(true);
    expect(selected(tree, 'received')).toBe(true);
    expect(rowCount(tree, 'received')).toBe(1);
    expect(textOf(tree, 'like-head-received-0')).toBe('최OO · 33 · 서울 송파');
    await press(tree, 'likes-tab-connected');
    expect(rowCount(tree, 'connected')).toBe(2);
    expect(textOf(tree, 'like-head-connected-0')).toBe('박OO · 29 · 경기 성남');
    expect(textOf(tree, 'like-sub-connected-0')).toBe(LIKES.connectedNote);
  });

  test('F17 서로 수락 순간(D25 장면 5): Success 햅틱 · 두 원 + 로고 타일 + 같은 글 · 바탕 460 → 머문 뒤(2.2초 + 0.25초) 걷힌다 · 실패는 Error', async () => {
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'like-accept-received-0');
    expect(heard).toEqual(['success']);
    expect(has(tree, 'match-moment')).toBe(true);
    expect(has(tree, 'match-moment-tile')).toBe(true);
    expect(textOf(tree, 'match-moment-text')).toBe(LIKES.acceptDone);
    const backdrop = tree.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'match-moment-backdrop')[0];
    expect(StyleSheet.flatten(backdrop.props.style).height).toBe(460);
    await wait(scene.match.hold - 300);
    expect(has(tree, 'match-moment')).toBe(true); // 2.2초 동안은 머문다
    await wait(500); // 머문 시간이 끝나 걷히기 시작(act 안의 상태 바뀜은 act 가 끝날 때 반영된다)
    await wait(scene.match.out + 300); // 걷힘(250)이 끝나면 사라진다
    expect(has(tree, 'match-moment')).toBe(false);
    off();
  });

  test('같은 버튼을 두 번 눌러도 요청은 한 번(R9)', async () => {
    let release: () => void = () => undefined;
    const s = setup(FULL(), { accept: jest.fn(() => new Promise((r) => (release = () => r({ ok: true, data: { matchId: 'm', userId: 'u1' } })))) as never });
    const tree = await view(<LikesScreen deps={s.deps} />);
    const button = must(tree, 'like-accept-received-0');
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(inner(tree, 'like-accept-received-0').props.disabled).toBe(true);
    expect(inner(tree, 'like-decline-received-0').props.disabled).toBe(true);
    await act(async () => release());
    expect(s.api.accept).toHaveBeenCalledTimes(1);
  });

  test('[거절] → 확인창 없이 사라지고 "거절했어요." · 서버에 거절이 간다(되돌리기 없음)', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'like-decline-received-0');
    expect(s.api.decline).toHaveBeenCalledWith('l1');
    expect(hasText(tree, LIKES.declineDone)).toBe(true);
    expect(rowCount(tree, 'received')).toBe(1);
    expect(allTexts(tree)).not.toContain('박OO · 29 · 경기 성남');
    expect(tree.root.findAll((n) => n.props.visible === true && n.props.transparent === true)).toHaveLength(0); // 열린 확인창 없음
  });

  test('연결할 수 없는 상대(not_available): 행이 흐려지고 "이분과는 더 이상 연결할 수 없어요." · 누르면 10 대신 같은 글', async () => {
    const s = setup(FULL(), { accept: jest.fn(async () => ({ ok: false, reason: 'unavailable' })) as never });
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'like-accept-received-0');
    expect(textOf(tree, 'like-note-received-0')).toBe(LIKES.unavailable);
    expect(flat(must(tree, 'like-photo-received-0')).opacity).toBeLessThan(1);
    await press(tree, 'like-open-received-0');
    expect(mockRouter.push).not.toHaveBeenCalled();
    await press(tree, 'like-decline-received-0');
    expect(s.api.decline).not.toHaveBeenCalled();
    expect(textOf(tree, 'like-note-received-0')).toBe(LIKES.unavailable);
  });

  test('수락 실패: 인터넷 → 공통 오프라인 글 · 그 밖 → "수락하지 못했어요. 다시 시도해 주세요." (행은 그대로)', async () => {
    const accept = jest.fn().mockResolvedValueOnce({ ok: false, reason: 'network' }).mockResolvedValueOnce({ ok: false, reason: 'server' });
    const s = setup(FULL(), { accept: accept as never });
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'like-accept-received-0');
    expect(textOf(tree, 'like-note-received-0')).toBe(COMMON.offline);
    await press(tree, 'like-accept-received-0');
    expect(textOf(tree, 'like-note-received-0')).toBe(LIKES.acceptFailed);
    expect(rowCount(tree, 'received')).toBe(2);
  });
});

describe('만료 (조건 4, 시각 조작)', () => {
  test('화면을 연 채로 7일이 지나면 "오늘 만료" → "만료"(버튼 없음, 누르면 연결할 수 없음) · 다시 불러오면 서버가 뺀다', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    const older = T0 - 26 * HOUR + WEEK; // 둘째 행(어제 받은 호감)의 만료 시각
    s.setNow(older - 3 * HOUR);
    await wait(60);
    expect(textOf(tree, 'like-expiry-received-1')).toBe(LIKES.expiresToday);
    expect(textOf(tree, 'like-expiry-received-0')).toBe('1일 뒤 만료');
    s.setNow(older + MIN); // 지남
    await wait(60);
    expect(has(tree, 'like-expired-received-1')).toBe(true);
    expect(hasText(tree, LIKES.expired)).toBe(true);
    expect(has(tree, 'like-accept-received-1') || has(tree, 'like-decline-received-1')).toBe(false);
    expect(has(tree, 'like-accept-received-0')).toBe(true); // 첫 행은 아직 살아 있다
    expect(textOf(tree, 'like-expiry-received-0')).toBe(LIKES.expiresToday);
    expect(flat(must(tree, 'like-photo-received-1')).opacity).toBeLessThan(1);
    await press(tree, 'like-open-received-1');
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(textOf(tree, 'like-note-received-1')).toBe(LIKES.unavailable);
    // 다시 불러오기(서버는 만료를 목록에서 뺀다, P7-04)
    s.setServer({ ...FULL(), received: [FULL().received[0]] });
    await act(async () => {
      await find(tree, 'screen-11')?.props.refreshControl.props.onRefresh();
    });
    expect(rowCount(tree, 'received')).toBe(1);
    expect(textOf(tree, 'like-head-received-0')).toBe('박OO · 29 · 경기 성남');
  });
});

describe('빈 상태 3종 (조건 5) · 14', () => {
  test('받은 0건 = 14: 제목 · 본문 · [오늘의 추천 보기] → 09 · 탭은 그대로', async () => {
    const s = setup(EMPTY());
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(has(tree, 'screen-14')).toBe(true);
    expect(hasText(tree, LIKES.emptyReceivedTitle) && hasText(tree, LIKES.emptyReceivedBody)).toBe(true);
    expect(has(tree, 'likes-tabs')).toBe(true);
    await press(tree, 'likes-empty-recs');
    expect(mockRouter.push).toHaveBeenCalledWith('/recommendations');
  });

  test('보낸 0건 한 줄 · 연결 0건 제목 · 본문', async () => {
    const s = setup(EMPTY());
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'likes-tab-sent');
    expect(has(tree, 'likes-empty-sent')).toBe(true);
    expect(hasText(tree, LIKES.emptySent)).toBe(true);
    expect(has(tree, 'screen-11')).toBe(true);
    await press(tree, 'likes-tab-connected');
    expect(hasText(tree, LIKES.emptyConnectedTitle) && hasText(tree, LIKES.emptyConnectedBody)).toBe(true);
    expect(has(tree, 'likes-empty-recs')).toBe(false);
  });

  test('14 라우트(forceEmpty)는 받은 호감 0건 상태다(다른 탭은 그대로)', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} forceEmpty />);
    expect(has(tree, 'screen-14')).toBe(true);
    expect(hasText(tree, LIKES.emptyReceivedTitle)).toBe(true);
    await press(tree, 'likes-tab-connected');
    expect(rowCount(tree, 'connected')).toBe(1);
  });
});

describe('행 ⋯ 신고 · 차단 (N33, 공용 시트)', () => {
  test('⋯ → 시트 · 차단 확인 → 그 사람이 세 탭 어디에서도 사라지고 "차단했어요." · 이 화면에 머문다', async () => {
    const s = setup({ ...FULL(), sent: [sent(), sent({ likeId: 's2', userId: 'u1', head: '박OO · 29 · 경기 성남' })] });
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(isOpen(tree, 'report-menu')).toBe(false);
    await press(tree, 'like-more-received-0');
    expect(isOpen(tree, 'report-menu')).toBe(true);
    await press(tree, 'report-menu-block');
    expect(isOpen(tree, 'report-block-confirm')).toBe(true);
    await press(tree, 'report-block-confirm-confirm');
    expect(s.api.block).toHaveBeenCalledWith('u1');
    expect(hasText(tree, REPORT_SHEET.blockDone)).toBe(true);
    expect(rowCount(tree, 'received')).toBe(1);
    await press(tree, 'likes-tab-sent');
    expect(rowCount(tree, 'sent')).toBe(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('⋯ → 신고하기 → 사유 → 제출 → 이 화면에 머물고 "신고했어요. 확인한 뒤에 처리할게요."', async () => {
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    await press(tree, 'likes-tab-connected');
    await press(tree, 'like-more-connected-0');
    await press(tree, 'report-menu-report');
    expect(isOpen(tree, 'report-reasons')).toBe(true);
    await press(tree, 'report-reason-RP5');
    await press(tree, 'report-submit');
    expect(s.api.report).toHaveBeenCalledWith('u3', 'RP5', '');
    expect(hasText(tree, REPORT_SHEET.done)).toBe(true);
    expect(isOpen(tree, 'report-reasons')).toBe(false);
    expect(selected(tree, 'connected')).toBe(true);
  });
});

describe('상태: 로딩 · 오류 · 오프라인 · 10 에서 돌아옴', () => {
  test('불러오는 동안 "불러오는 중이에요" · 인터넷 실패 → 공통 글 + [다시 시도] → 목록', async () => {
    let release: (v: unknown) => void = () => undefined;
    const s = setup();
    const first = new Promise((r) => (release = r));
    (s.api.loadAll as jest.Mock).mockImplementationOnce(() => first);
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(has(tree, 'screen-11-loading')).toBe(true);
    expect(hasText(tree, COMMON.loading)).toBe(true);
    expect(has(tree, 'likes-tabs') && has(tree, 'likes-safety')).toBe(true);
    await act(async () => release({ ok: false, reason: 'network' }));
    expect(textOf(tree, 'likes-error')).toBe(COMMON.offline);
    await press(tree, 'likes-retry');
    expect(rowCount(tree, 'received')).toBe(2);
  });

  test('서버 오류 → 공통 서버 글 · 목록이 있는 뒤의 실패는 목록을 두고 위에 한 줄', async () => {
    const s = setup('server');
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(textOf(tree, 'likes-error')).toBe(COMMON.server);
    s.setServer(FULL());
    await press(tree, 'likes-retry');
    s.setServer('network');
    await act(async () => {
      await find(tree, 'screen-11')?.props.refreshControl.props.onRefresh();
    });
    expect(textOf(tree, 'likes-reload-error')).toBe(COMMON.offline);
    expect(rowCount(tree, 'received')).toBe(2);
  });

  test('10 이 남긴 토스트(예: 10 에서 수락)를 보인다', async () => {
    passToast(LIKES.acceptDone);
    const s = setup();
    const tree = await view(<LikesScreen deps={s.deps} />);
    expect(hasText(tree, LIKES.acceptDone)).toBe(true);
  });
});
