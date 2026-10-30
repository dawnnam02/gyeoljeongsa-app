// IF2-F 기내 서비스 · 연애 기능 화면 — 홈 새 구성 · 기내지 · 이번 주 카드 · 내 여행 타입 · 짝에게 보이는 내 모습 · 시트 · 대화방 칸 · 08 같은 취미 · 재미 정보 동의
//  보안 앱 시험 IFF-01 ~ 16(같은 번호) 가운데 화면 몫 + 홈 숫자 0 · 상대 정보 0. 서버 대신 데모 모의 서버(0043 모양)를 같은 파서로 읽는다
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { SAFETY_GUIDE } from '@/content/copy';
import { CK17 } from '@/content/ck17Content';
import lib from '@/content/if2Library.json';
import { createDemoBoarding } from '@/demo/boardingDemo';
import { createDemoInflight } from '@/demo/inflightDemo';
import { demoShared } from '@/demo/inflightShared';
import { createBoardingApi, type BoardingState } from '@/features/boarding/boardingApi';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import type { Room } from '@/features/chat/chatApi';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { createDemoMedia } from '@/features/chat/chatMedia';
import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { createDeviceNotes, type DeviceNotes } from '@/features/inflight/deviceNotes';
import { createInflightApi, rpcOf, type HomeState } from '@/features/inflight/inflightApi';
import { InflightHome } from '@/features/inflight/InflightHome';
import { Ck17Sheet, MeetPrepSheet, PairCardSheet } from '@/features/inflight/If2Sheets';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { PreviewScreen } from '@/features/inflight/PreviewScreen';
import { TypeCardScreen } from '@/features/inflight/TypeCardScreen';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { tx } from '@/features/inflight/if2Text';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { initialToggles } from '@/features/profile/profileLogic';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}`, inflightChatApi: () => ({}) }));
const mockCapture = jest.fn();
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => mockCapture() }));

jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const SIGN_NAMES = lib.codes.signs.map((s) => s.name);
const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockRouter.push.mockClear();
  mockRouter.navigate.mockClear();
  mockCapture.mockClear();
  for (const k of Object.keys(mockParams)) delete mockParams[k];
});

function rig(email: string, over: Record<string, boolean> = {}) {
  const user = { id: `u-${email.split('@')[0]}`, email };
  const consents = new Set(['CK17A', 'CK17B']);
  const flags = async () => flagsAll(over);
  const boarding = createDemoBoarding();
  const demo = createDemoInflight({ boarding, flags, account: () => ({ birthDate: '1997-03-12', consentOn: (c) => consents.has(c), sameHobby: true, previewAnswers: { A12: '이OO', A01: 29, A03: { sido: '서울', sigungu: '마포구' }, A06: '무교' } }) });
  demoShared.setFlags(flags);
  demoShared.setSameHobby(() => true);
  const calls: string[] = [];
  const client = { rpc: async (n: string, a?: Record<string, unknown>) => (calls.push(n), demo.handles(n) ? demo.rpc(user, n, a) : boarding.rpc(user, n, a)) } as unknown as SupabaseClient;
  const api = createInflightApi(rpcOf(client));
  const boardingApi = createBoardingApi(client);
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: consents.has('CK17A'), b: consents.has('CK17B') } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const notes = createDeviceNotes();
  const scene = (p_scene: string) => demo.rpc(user, 'demo_inflight_scene', { p_scene });
  return { user, api, boardingApi, client, calls, ck17, notes, scene, consents, isOn: (k: string) => flagsAll(over)[k] === true };
}
async function home(email: string, sc: string, over: Record<string, boolean> = {}, typeId: string | null = null) {
  const r = rig(email, over);
  await r.scene(sc);
  const b = await r.boardingApi.load();
  const h = await r.api.home();
  if (!b.ok || !h.ok) throw new Error('불러오지 못함');
  const nav = { open: jest.fn(), chat: jest.fn(), settings: jest.fn(), profileSameHobby: jest.fn() };
  const tree = keep(await mount(<InflightHome deps={{ api: r.api, ck17: r.ck17, type: { mine: async () => typeId }, isOn: r.isOn, notes: r.notes }} home={h.data} boarding={b.state as BoardingState} nav={nav} onToast={() => undefined} />));
  await wait();
  return { ...r, tree, nav, home: h.data as HomeState };
}
// 같은 testID 가 겹치면(컴포넌트 → 안쪽 요소) 가장 안쪽 것 — 실제로 그려진 요소의 글 · 읽기 상태
const inner = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id).at(-1);
const say = (tree: ReactTestRenderer, id: string) => { const c = inner(tree, id)?.props.children as unknown; return Array.isArray(c) ? c.join('') : typeof c === 'string' ? c : ''; };
const state = (tree: ReactTestRenderer, id: string) => (inner(tree, id)?.props.accessibilityState ?? {}) as { checked?: boolean; disabled?: boolean };
const ids = (tree: ReactTestRenderer, re: RegExp) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && re.test(n.props.testID)).map((n) => n.props.testID as string))];

describe('IFF-04 홈 새 구성 — 상대 정보 0 · 숫자 0 · 접힌 채 시작 · 블록 자리 고정', () => {
  test('짝 있음: B2 이번 짝(길 안내 한 줄 + [대화방으로] · 궁합 카드 · 꼭 나눌 이야기) · B4 만남 준비 · B7 · 상대 이름 · 숫자 0 · 궁합 카드 시트는 닫힌 채', async () => {
    const { tree, nav } = await home('h1@email.com', 'matched');
    expect(has(tree, 'home-state-matched')).toBe(true);
    expect(ids(tree, /^home-B\d$/)).toEqual(['home-B2', 'home-B4', 'home-B7']);
    expect(textOf(tree, 'home-B2-line')).toBe(tx('HOME.pair.chatLine'));
    const texts = allTexts(tree);
    expect(texts.filter((t) => /\d/.test(t))).toEqual([]);
    expect(texts.join(' ')).not.toMatch(/[가-힣]OO|님/);
    for (const n of SIGN_NAMES) expect(texts.join(' ')).not.toContain(n);
    expect(isOpen(tree, 'if2-pair')).toBe(false); // 접힌 채 시작
    await press(tree, 'home-B2-chat');
    expect(nav.chat).toHaveBeenCalledWith(expect.stringMatching(/^demo-chat-1-\d+$/));
  });
  test('비행 중: B3 좌석 앞 주머니(기내지 · 이번 주 카드) · B4 도착 준비 · 첫 회차 같은 취미 띠 → [그대로 두기]면 닫히고 다시 0', async () => {
    const { tree, notes } = await home('h2@email.com', 'inflight');
    expect(ids(tree, /^home-B\d$/)).toEqual(['home-B3', 'home-B4', 'home-B7']);
    expect(textOf(tree, 'home-B3-mag-line')).toBe(tx('HOME.pocket.magLine', { 여행지: '경주' }));
    expect(textOf(tree, 'home-B3-card-line')).toBe(tx('HOME.pocket.cardBefore'));
    expect(must(tree, 'home-B3-title').props.accessibilityLabel).toBe(tx('HOME.blockA11y', { '블록 머리': tx('HOME.pocket.title'), '칸 이름 차례': [tx('HOME.pocket.mag'), tx('HOME.pocket.card')].join(', ') }));
    expect(has(tree, 'home-hobby-notice')).toBe(true);
    await press(tree, 'home-hobby-keep');
    expect(has(tree, 'home-hobby-notice')).toBe(false);
    expect(notes.get().hobbyNotice).toBe(true);
    expect(allTexts(tree).filter((t) => /\d/.test(t))).toEqual([]);
  });
  test('착륙 준비: 머리만 바뀌고(착륙 준비 중이에요) 자리 그대로 · 두 칸은 보기만 글', async () => {
    const { tree } = await home('h3@email.com', 'landing');
    expect(ids(tree, /^home-B\d$/)).toEqual(['home-B3', 'home-B4', 'home-B7']);
    expect(textOf(tree, 'home-B4-title')).toBe(tx('HOME.status.landing'));
    expect(textOf(tree, 'home-B4-postcard-line')).toBe(tx('HELLO_POSTCARD.home.lineLanding'));
    expect(has(tree, 'home-hobby-notice')).toBe(false); // 착륙 준비부터 0
  });
  test('탑승 전: B6 나를 알기(타입 없음 → 칸 0, 미리 보기만) · B7 접힘 줄 펼치면 끝 있는 줄 목록 · 탑승 전 맛보기(주머니 · 기내지) 0', async () => {
    const { tree, notes } = await home('h4@email.com', 'before');
    expect(ids(tree, /^home-B\d$/)).toEqual(['home-B6', 'home-B7']);
    expect(has(tree, 'home-B6-preview')).toBe(true);
    expect(has(tree, 'home-B6-type')).toBe(false);
    expect(has(tree, 'home-B3')).toBe(false);
    await press(tree, 'home-B7-toggle');
    expect(ids(tree, /^home-B7-row-/)).toEqual(['home-B7-row-profile', 'home-B7-row-survey', 'home-B7-row-avoid']);
    expect(notes.get().homeFold).toBe(true); // 펼침은 기기에만
  });
  test('내 여행 타입 칸(B6): 타입이 있어도 짐을 안 쌌으면 "짐을 싸면 엽서가 나와요" · 짐 일곱을 쌌으면 타입 이름 · 누르면 /type-card (3부-자)', async () => {
    const a = await home('h6@email.com', 'before', {}, 'tt-04');
    expect(has(a.tree, 'home-B6-type')).toBe(true);
    expect(textOf(a.tree, 'home-B6-type-line')).toBe(tx('TYPE_CARD.home.lineNone'));
    await act(async () => a.notes.set('typeBag', ['thermos', 'paper_map', 'umbrella', 'postcard', 'notebook', 'plant', 'stamp_book']));
    await wait();
    expect(textOf(a.tree, 'home-B6-type-line')).toBe(tx('TYPE_CARD.home.line', { '타입 이름': '골목 산책 여행자' }));
    expect(allTexts(a.tree).filter((t) => /\d/.test(t))).toEqual([]);
    await press(a.tree, 'home-B6-type');
    expect(a.nav.open).toHaveBeenCalledWith('/type-card');
  });
  test('겹칠 때: B3 · B4 도착 준비 · B5 지난 회차 짝(궁합 카드 · 첫 만남 준비 · 돌아보기 메모) — 블록 5', async () => {
    const { tree } = await home('h5@email.com', 'overlap');
    expect(ids(tree, /^home-B\d$/)).toEqual(['home-B3', 'home-B4', 'home-B5', 'home-B7']);
    expect(ids(tree, /^home-B5-(pair|prep|memo)$/)).toEqual(['home-B5-pair', 'home-B5-prep', 'home-B5-memo']);
    expect(textOf(tree, 'home-B5-title')).toBe(tx('HOME.pair.titlePrev'));
  });
  test('스위치 inflight_home 이 꺼지면 홈은 지금 T1 · T2 그대로(할 일 줄) · 켜면 블록', async () => {
    const r = rig('h6@email.com');
    await r.scene('inflight');
    const base = { api: { load: () => r.boardingApi.load(), buy: async () => ({ ok: false as const, reason: 'server' as const }) }, newId: () => 'x', toastMs: 60_000 };
    const off = keep(await mount(<BoardingScreen deps={{ ...base, inflight: { api: r.api, ck17: r.ck17, type: { mine: async () => null }, isOn: () => false, notes: r.notes } }} />));
    await wait();
    expect(has(off, 'boarding-tasks')).toBe(true);
    expect(has(off, 'home-blocks')).toBe(false);
    const on = keep(await mount(<BoardingScreen deps={{ ...base, inflight: { api: r.api, ck17: r.ck17, type: { mine: async () => null }, isOn: r.isOn, notes: r.notes } }} />));
    await wait(60);
    expect(has(on, 'home-blocks')).toBe(true);
    expect(has(on, 'boarding-tasks')).toBe(false);
  });
});

describe('IFF-01 · IFF-15 궁합 카드 시트', () => {
  test('두 분 다(같은 취미 이름) · 사주로 보면 · 별자리로 보면(원소 관계 문장) · 끝줄 · 별자리 이름 · 일간 · 띠 0 · 열린 동안 캡처 막기 훅', async () => {
    const r = rig('p1@email.com');
    await r.scene('matched');
    const h = await r.api.home();
    const room = h.ok ? String(h.data.pair?.roomId) : '';
    const tree = keep(await mount(<PairCardSheet visible roomId={room} api={r.api} overlap={false} onClose={() => undefined} onChat={() => undefined} onTalk={() => undefined} onCk17={() => undefined} />));
    await wait();
    // QP-49: 머리 '두 분 다' 한 번 + 줄은 '…을 좋아해요' 틀 · 코드 줄과 갈래 문장은 따로 한 줄(두 줄까지) · 줄 안 '두 분 다' 0
    expect(textOf(tree, 'if2-pair-same-line')).toBe('독서·공부를 좋아해요');
    expect(textOf(tree, 'if2-pair-same-line-1')).toBe(tx('PAIR_CARD.hobbyGroup.out'));
    expect(textOf(tree, 'if2-pair-same-line')).not.toContain('두 분 다');
    expect(has(tree, 'if2-pair-saju') && has(tree, 'if2-pair-star')).toBe(true);
    expect(say(tree, 'if2-pair-footer')).toBe(tx('PAIR_CARD.footer'));
    const all = allTexts(tree).join(' ');
    for (const n of SIGN_NAMES) expect(all).not.toContain(n);
    for (const w of ['일간', '일주', '띠 ', '갑목', '을목']) expect(all).not.toContain(w);
    expect(mockCapture).toHaveBeenCalled();
  });
  test('내가 CK17B 를 꺼 둔 경우에만 안내 한 줄 + [사주 · 별자리 줄 켜기] · 상대가 꺼 둔 경우 칸째 0(글 0)', async () => {
    const r = rig('p2@email.com');
    await r.scene('matched');
    r.consents.delete('CK17B');
    const h = await r.api.home();
    const room = h.ok ? String(h.data.pair?.roomId) : '';
    const onCk17 = jest.fn();
    const tree = keep(await mount(<PairCardSheet visible roomId={room} api={r.api} overlap={false} onClose={() => undefined} onChat={() => undefined} onTalk={() => undefined} onCk17={onCk17} />));
    await wait();
    expect(has(tree, 'if2-pair-saju')).toBe(false);
    expect(has(tree, 'if2-pair-mine-off')).toBe(true);
    await press(tree, 'if2-pair-ck17');
    expect(onCk17).toHaveBeenCalled();
  });
});

describe('IFF-10 · IFF-12 기내지 · 이번 주 카드', () => {
  test('표지 + 6쪽 · 쪽 이름만(쪽 번호 0) · ①하늘과 결 · ②카드 · ③연애 이야기 · ④질문 · ⑤여행지 · ⑥뒤표지 끝줄 · 끝 쪽 뒤 넘김 0', async () => {
    const r = rig('m1@email.com');
    await r.scene('inflight');
    const tree = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17, preOn: true }} />));
    await wait();
    expect(has(tree, 'mag-cover')).toBe(true);
    const footers: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await press(tree, 'mag-next');
      footers.push(textOf(tree, 'mag-page-name') ?? '');
    }
    expect(footers).toEqual([tx('MAGAZINE.page.skyGrain'), tx('MAGAZINE.page.card'), tx('MAGAZINE.page.love'), tx('MAGAZINE.page.question'), tx('MAGAZINE.page.place'), tx('MAGAZINE.page.back')]);
    expect(has(tree, 'mag-next')).toBe(false); // 끝 쪽 뒤로는 넘김 0
    const texts = allTexts(tree);
    expect(texts.filter((t) => /^\d+\s*\/\s*\d+$|\d+쪽/.test(t))).toEqual([]);
    expect(say(tree, 'mag-ai-note')).toBe(tx('MAGAZINE.back.aiNote'));
    expect(say(tree, 'mag-love-footer')).toBe(tx('MAGAZINE.love.footer'));
    expect(say(tree, 'mag-sky-footer')).toBe(tx('FUN.footer'));
  });
  test('이번 주 카드: 뒤집힌 세 장 → 하나를 누르면 그 장만 · 다시 뽑기 단추 0 · 다시 열면 같은 장', async () => {
    const r = rig('m2@email.com');
    await r.scene('inflight');
    mockParams.page = 'card';
    const tree = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17 }} />));
    await wait();
    expect(ids(tree, /^card-slot-\d$/)).toEqual(['card-slot-0', 'card-slot-1', 'card-slot-2']);
    expect(must(tree, 'card-slot-0').props.accessibilityLabel).toBe(tx('WEEK_CARD.slotA11y.left'));
    await press(tree, 'card-slot-2');
    await wait();
    expect(ids(tree, /^card-slot-\d$/)).toEqual([]);
    const name = textOf(tree, 'card-name');
    expect(lib.tarot.some((t) => t.name === name)).toBe(true);
    expect(allTexts(tree).join(' ')).not.toMatch(/다시 뽑|한 장 더/);
    const again = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17 }} />));
    await wait();
    expect(textOf(again, 'card-name')).toBe(name);
  });
  test('CK17A 를 켜지 않은 분: ① 쪽 자리에 안내 한 줄 + [동의하고 보기] · 쪽에 닿아도 동의 시트는 저절로 안 뜸(누를 때만 · 되풀이 0) — QP-46', async () => {
    const r = rig('m3@email.com');
    r.consents.clear();
    await r.scene('inflight');
    const tree = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17 }} />));
    await wait();
    await press(tree, 'mag-next');
    expect(has(tree, 'mag-ck17-off')).toBe(true);
    expect(must(tree, 'mag-ck17-agree').props.label).toBe(tx('FUN.ck17.agreeView'));
    expect(isOpen(tree, 'if2-ck17')).toBe(false); // 쪽에 닿았다고 시트가 뜨지 않는다
    await press(tree, 'mag-prev');
    await press(tree, 'mag-next');
    expect(isOpen(tree, 'if2-ck17')).toBe(false);
    await press(tree, 'mag-ck17-agree');
    expect(isOpen(tree, 'if2-ck17')).toBe(true);
    await press(tree, 'if2-ck17-close');
    expect(isOpen(tree, 'if2-ck17')).toBe(false);
  });
});

describe('IFF-08 내 여행 타입 · IFF-13 짝에게 보이는 내 모습 · IFF-14 첫 만남 준비', () => {
  test('타입 엽서: 앞(타입 이름) → 뒤(설명 · 노선도 · 끝줄) · 공유 단추 0 · 타입이 없으면 한 줄', async () => {
    const notes = createDeviceNotes();
    notes.set('typeBag', ['thermos', 'paper_map', 'umbrella', 'postcard', 'notebook', 'plant', 'stamp_book']); // 짐을 이미 쌈(기기에만)
    const tree = keep(await mount(<TypeCardScreen source={{ mine: async () => 'tt-01' }} notes={notes} />));
    await wait();
    expect(textOf(tree, 'type-name')).toBe('기차 창가 여행자');
    await press(tree, 'type-flip');
    expect(say(tree, 'type-footer')).toBe(tx('TYPE_CARD.footer'));
    expect(allTexts(tree)).not.toContain(tx('TYPE_CARD.share'));
    const none = keep(await mount(<TypeCardScreen source={{ mine: async () => null }} notes={notes} />));
    await wait();
    expect(textOf(none, 'type-none')).toBe(tx('TYPE_CARD.loadFailed'));
  });
  test('미리 보기는 서버 응답 그대로 그린다(앱 공개 범위 필터 0) · 등급 · 신고 · 차단 0 · CK17B · 같은 취미 한 줄', async () => {
    const r = rig('v1@email.com');
    const tree = keep(await mount(<PreviewScreen api={r.api} />));
    await wait();
    expect(textOf(tree, 'preview-head')).toContain('이OO');
    expect(allTexts(tree)).toContain('무교'); // 서버가 보이게 둔 칸
    expect(has(tree, 'preview-ck17') && has(tree, 'preview-hobby')).toBe(true);
    expect(ids(tree, /grade|report|block/)).toEqual([]);
  });
  test('첫 만남 준비: 먼저 챙길 것 = 12 안전 안내 1 ~ 6줄 원문(같은 키) · [챙겼어요]는 기기에만(개수 0) · 만남 계획 공유는 safe_share 일 때만', async () => {
    const notes: DeviceNotes = createDeviceNotes();
    await notes.load();
    const onShare = jest.fn();
    const tree = keep(await mount(<MeetPrepSheet visible roomId="r1" shareOn onClose={() => undefined} onShare={onShare} onGuide={() => undefined} notes={notes} />));
    for (let i = 0; i < 6; i += 1) expect(must(tree, `if2-prep-safety-${i}`).findAll((n) => n.props.children === SAFETY_GUIDE.lines[i]).length).toBeGreaterThan(0);
    await press(tree, 'if2-prep-mark-s-0');
    expect(notes.get().meetPrep).toEqual({ r1: ['s'] });
    expect(allTexts(tree).filter((t) => /\d/.test(t))).toEqual([]);
    await press(tree, 'if2-prep-share');
    expect(onShare).toHaveBeenCalled();
    const noShare = keep(await mount(<MeetPrepSheet visible roomId="r1" shareOn={false} onClose={() => undefined} onShare={onShare} onGuide={() => undefined} notes={notes} />));
    expect(has(noShare, 'if2-prep-share')).toBe(false);
  });
});

describe('재미 정보 동의 시트(정책 PF-16 · 동의문구 4-17)', () => {
  test('미리 체크 0 · ②는 ① 뒤에만 · ①을 풀면 ②도 풀림 · 아무것도 안 골라도 [이어 가기](거부 기록)', async () => {
    const onSave = jest.fn(async () => true);
    const tree = keep(await mount(<Ck17Sheet visible onClose={() => undefined} onSave={onSave} />));
    expect(state(tree, 'if2-ck17-a').checked).toBe(false);
    expect(state(tree, 'if2-ck17-b').disabled).toBe(true);
    await press(tree, 'if2-ck17-a');
    await press(tree, 'if2-ck17-b');
    expect(state(tree, 'if2-ck17-b').checked).toBe(true);
    await press(tree, 'if2-ck17-a');
    expect(state(tree, 'if2-ck17-b').checked).toBe(false);
    await press(tree, 'if2-ck17-go');
    expect(onSave).toHaveBeenCalledWith(false, false);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CK17.title, CK17.lead, CK17.checkA, CK17.checkB]));
  });
});

describe('대화방 칸(IFF-05 · IFF-06 · IFF-07 · IFF-09)', () => {
  async function room(email: string, over: Record<string, boolean> = {}) {
    const r = rig(email, over);
    const chat = createDemoChatApi({ who: async () => r.user, replyMs: 40 });
    const a = createInflightApi(chat.if2Rpc);
    const rooms = (await chat.listRooms()) as { ok: true; data: Room[] };
    const id = rooms.data[0]?.id ?? 'none';
    const media = createDemoMedia({ email: () => email, now: () => 0 });
    const tree = keep(await mount(<ChatRoomScreen id={id} api={chat} media={media} pollMs={600_000} toastMs={60_000} if2={{ api: a, isOn: r.isOn, notes: r.notes }} />));
    await wait();
    return { ...r, tree, chat, id };
  }
  test('첫마디 실마리: 입력창 위 칩 3(같은 취미 소재) · 누르면 입력창에 들어감(바로 보내지 않음) · 내 첫 글 뒤 사라짐 · 맨 위 순서에 더한 것 0', async () => {
    const { tree, chat, id } = await room('c1@email.com');
    expect(ids(tree, /^if2-chips-\d$/)).toHaveLength(2); // 서버 칩 3 가운데 갈래(group) 소재 칩 하나는 이름 글이 없어 그리지 않는다(3부-자 QP-49 — 갈래는 문장 하나, 소재 틀 {v}에 못 넣음)
    const first = (must(tree, 'if2-chips-0').props.label as string) ?? '';
    await press(tree, 'if2-chips-0');
    expect(must(tree, 'chat-composer-input').props.value).toBe(first);
    const before = await chat.listMessages(id);
    expect(before.ok && before.data.filter((m) => m.mine)).toHaveLength(0);
    await press(tree, 'chat-composer-send');
    await wait(60);
    expect(has(tree, 'if2-chips')).toBe(false);
    expect(ids(tree, /^chat-(room-start|room-met-at|room-banner)/).length).toBeGreaterThan(0); // 기존 맨 위 줄은 그대로
  });
  test('이야깃거리 시트: 그날 열린 칸만(1일째 가볍게) · [대화방에 놓기] → 이야깃거리 꼬리표 글 · 데모 짝의 같이 열어 보는 질문 → [답 적기] → 함께 펼침', async () => {
    const { tree } = await room('c2@email.com');
    await press(tree, 'chat-topics');
    expect(isOpen(tree, 'if2-topics')).toBe(true);
    expect(ids(tree, /^if2-topics-depth-/)).toEqual(['if2-topics-depth-light']);
    expect(allTexts(tree).join(' ')).not.toMatch(/\d일째|자물쇠/);
    await press(tree, 'if2-topics-place-0');
    await wait(120);
    expect(ids(tree, /^chat-msg-\d+-tag$/).length).toBeGreaterThan(0);
    const card = ids(tree, /^chat-together-\d+$/)[0];
    expect(card).toBeTruthy();
    expect(textOf(tree, `${card}-line`)).toBe(tx('OPEN_TOGETHER.card.theirs'));
    expect(allTexts(tree).join(' ')).not.toMatch(/상대가 (아직|답했)|먼저 답/);
    await press(tree, `${card}-answer`);
    await typeInto(tree, `${card}-input`, '천천히 걷는 저녁이 좋아요.');
    await press(tree, `${card}-submit`);
    await wait(60);
    expect(has(tree, `${ids(tree, /^chat-together-\d+$/)[0]}-opened`)).toBe(true);
  });
  test('안전 안내 카드: 받은 글에 돈 · 투자 꼴이면 그 말풍선 아래 나에게만 · [닫기]면 그 방 다시 0(본 기록만 기기)', async () => {
    const { tree, notes, id } = await room('c3@email.com');
    await typeInto(tree, 'chat-composer-input', '데모안전 안녕하세요');
    await press(tree, 'chat-composer-send');
    await wait(150);
    expect(has(tree, 'if2-money')).toBe(true);
    expect(textOf(tree, 'if2-money-body')).toBe(SAFETY_GUIDE.lines[3]);
    await press(tree, 'if2-money-close');
    expect(has(tree, 'if2-money')).toBe(false);
    expect(notes.get().wordSafety).toEqual([id]);
  });
  test('작별 엽서: [엽서 남기고 나가기] · [그냥 나가기] 같은 크기 · 고르기 전엔 고침 칸 0 · 고른 뒤 한 줄 고침 · 보내면 나감', async () => {
    const { tree, chat } = await room('c4@email.com');
    await press(tree, 'chat-room-more');
    await press(tree, 'chat-menu-leave');
    expect(isOpen(tree, 'if2-farewell')).toBe(true);
    expect(must(tree, 'if2-farewell-with-card').props.variant).toBe(must(tree, 'if2-farewell-plain').props.variant);
    await press(tree, 'if2-farewell-with-card');
    expect(has(tree, 'if2-farewell-edit')).toBe(false);
    await press(tree, 'if2-farewell-line-1');
    expect(must(tree, 'if2-farewell-edit').props.value).toBe(tx('FAREWELL.pick.lines[1]'));
    await typeInto(tree, 'if2-farewell-edit', '함께 나눈 대화 즐거웠어요.');
    await press(tree, 'if2-farewell-send');
    await wait();
    expect(mockRouter.back).toHaveBeenCalled();
    const left = await chat.listRooms();
    expect(left.ok && left.data).toHaveLength(0);
  });
  test('닫힌 방: 첫마디 실마리 · [이야깃거리] · 작별 엽서 0(열린 방에서만 — 정책 PF-59)', async () => {
    const { tree } = await room('chatclosed@email.com');
    expect(has(tree, 'if2-chips')).toBe(false);
    expect(has(tree, 'chat-topics')).toBe(false);
    expect(has(tree, 'if2-farewell')).toBe(false);
  });
  test('스위치가 꺼지면 그 칸 0 · 방 그대로(정책 PF-93)', async () => {
    const { tree } = await room('c5@email.com', { opener_chips: false, talk_depth: false, farewell: false, word_safety: false });
    expect(has(tree, 'if2-chips')).toBe(false);
    expect(has(tree, 'chat-topics')).toBe(false);
    expect(has(tree, 'chat-composer')).toBe(true);
  });
});

describe('IFF-16 08 같은 취미 줄', () => {
  test('처음 켜짐 · 누르면 바로 저장(끔) · 끈 때만 아래 한 줄 · 스위치 same_points 가 꺼지면 줄 0', async () => {
    const data = { name: '이하나', birthDate: '1995-03-12', region: '서울 마포구', verification: 'unverified' as const, photos: [], visibility: initialToggles(), answers: {}, sameHobby: true };
    const save = jest.fn(async () => ({ ok: true as const }));
    const api = { load: async () => ({ ok: true as const, data }), saveVisibility: async () => ({ ok: true as const }), photoUrl: async () => null, ackReview: async () => undefined, saveSameHobby: save };
    const tree = keep(await mount(<ProfileScreen deps={{ api, now: () => Date.UTC(2026, 9, 28), if2: { isOn: (k) => k === 'same_points' || k === 'profile_preview' } }} />));
    await wait();
    expect(state(tree, 'toggle-sameHobby').checked).toBe(true);
    expect(textOf(tree, 'profile-same-hobby-desc')).toBe(tx('PROFILE.sameHobby.desc'));
    await press(tree, 'toggle-sameHobby');
    expect(save).toHaveBeenCalledWith(false);
    expect(has(tree, 'profile-same-hobby-off')).toBe(true);
    expect(has(tree, 'profile-preview')).toBe(true);
    const off = keep(await mount(<ProfileScreen deps={{ api, now: () => Date.UTC(2026, 9, 28), if2: { isOn: () => false } }} />));
    await wait();
    expect(has(off, 'profile-same-hobby')).toBe(false);
  });
});
