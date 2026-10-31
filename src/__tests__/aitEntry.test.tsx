// AIT-F ⑥ 입구 시험 — 설정 줄 · 홈 B6 셋째 칸 · 궁합 카드 시트 안 AI 칸 · 기내지 ① 쪽 AI 풀이 · 문장 다듬기 단추. 데모 판에서만 보이고 실서버 판에는 0.
//  기존 화면 시험(iffInflightUi · settingsScreen)이 입구 0인 쪽(데모 아님)을 이미 지키고, 여기서는 켜졌을 때와 꺼졌을 때를 나란히 본다. 데모 모의 서버 · 가짜 fetch · 네트워크 0.
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { AIT_TEXT } from '@/content/aitCopy';
import { createDemoBoarding } from '@/demo/boardingDemo';
import { createDemoInflight } from '@/demo/inflightDemo';
import { demoShared } from '@/demo/inflightShared';
import { createBoardingApi, type BoardingState } from '@/features/boarding/boardingApi';
import { aitStore } from '@/features/ait/aitStore';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { createInflightApi, rpcOf, type HomeState } from '@/features/inflight/inflightApi';
import { InflightHome } from '@/features/inflight/InflightHome';
import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { PreviewScreen } from '@/features/inflight/PreviewScreen';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { COMPAT_DICT } from '@/server/ait';

import { has, isOpen, mount, press } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Redirect: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}`, inflightChatApi: () => ({}) }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined }));
const mockMem = new Map<string, string>();
jest.mock('@/lib/secureStorage', () => ({
  secureStore: { get: async (k: string) => mockMem.get(k) ?? null, set: async (k: string, v: string) => void mockMem.set(k, v), del: async (k: string) => void mockMem.delete(k) },
}));
jest.setTimeout(90_000);
beforeAll(() => {
  process.env.EXPO_PUBLIC_DEMO_MODE = '1'; // 데모 판 표시(기존 변수) — 입구가 보이는 쪽
});
afterAll(() => {
  delete process.env.EXPO_PUBLIC_DEMO_MODE;
});

const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
const realFetch = global.fetch;
const allText = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map((n) => [n.props.children].flat().join(''));
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  global.fetch = realFetch;
  mockMem.clear();
  aitStore.reset();
  mockRouter.navigate.mockClear();
});

function rig(email: string, birth = '1997-03-12') {
  const user = { id: `u-${email.split('@')[0]}`, email };
  const consents = new Set(['CK17A', 'CK17B']);
  const flags = async () => flagsAll();
  const boarding = createDemoBoarding();
  const demo = createDemoInflight({ boarding, flags, account: () => ({ birthDate: birth, consentOn: (c) => consents.has(c), sameHobby: true, previewAnswers: { A12: '이OO', A01: 29, A03: { sido: '서울', sigungu: '마포구' }, A06: '무교' } }) });
  demoShared.setFlags(flags);
  demoShared.setSameHobby(() => true);
  const client = { rpc: async (n: string, a?: Record<string, unknown>) => (demo.handles(n) ? demo.rpc(user, n, a) : boarding.rpc(user, n, a)) } as unknown as SupabaseClient;
  const api = createInflightApi(rpcOf(client));
  const boardingApi = createBoardingApi(client);
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: true } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const notes = createDeviceNotes();
  return { api, boardingApi, ck17, notes, scene: (p_scene: string) => demo.rpc(user, 'demo_inflight_scene', { p_scene }), isOn: (k: string) => flagsAll()[k] === true };
}
async function home(email: string, sc: string, ait?: boolean, typeId: string | null = null) {
  const r = rig(email);
  await r.scene(sc);
  const b = await r.boardingApi.load();
  const h = await r.api.home();
  if (!b.ok || !h.ok) throw new Error('불러오지 못함');
  const nav = { open: jest.fn(), chat: jest.fn(), settings: jest.fn(), profileSameHobby: jest.fn() };
  const tree = keep(await mount(<InflightHome deps={{ api: r.api, ck17: r.ck17, type: { mine: async () => typeId }, isOn: r.isOn, notes: r.notes, ait }} home={h.data as HomeState} boarding={b.state as BoardingState} nav={nav} onToast={() => undefined} />));
  await wait();
  return { ...r, tree, nav };
}
function serve(...replies: Record<string, unknown>[]) {
  const f = jest.fn();
  for (const r of replies) f.mockResolvedValueOnce({ json: async () => r });
  f.mockResolvedValue({ json: async () => ({ ok: false, code: 'unavailable', mode: 'mock' }) });
  global.fetch = f as unknown as typeof fetch;
  return f;
}

describe('AIT-F 입구 — 홈 B6 셋째 칸 · 궁합 카드 시트 안 AI 칸', () => {
  test('켜짐: B6 에 [연애 고민 정리] 셋째 칸 → 누르면 시트(첫 화면) · 읽기 이름에 칸 이름 포함 · 코드 없이 열어도 서버 요청 0', async () => {
    const f = serve();
    const { tree } = await home('a1@email.com', 'before', true, 'tt-04');
    expect(has(tree, 'home-B6-concern')).toBe(true);
    expect(has(tree, 'home-B6-preview')).toBe(true);
    expect(allText(tree)).toContain(AIT_TEXT['CONCERN.name']);
    expect(allText(tree)).toContain(AIT_TEXT['CONCERN.home.line']);
    expect(isOpen(tree, 'concern')).toBe(false);
    await press(tree, 'home-B6-concern');
    expect(isOpen(tree, 'concern')).toBe(true);
    expect(has(tree, 'concern-intro')).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  test('꺼짐(실서버 판): B6 에 칸 0 · 시트 0 · 기존 칸 그대로', async () => {
    const { tree } = await home('a2@email.com', 'before', false, 'tt-04');
    expect(has(tree, 'home-B6-concern')).toBe(false);
    expect(has(tree, 'concern')).toBe(false);
    expect(has(tree, 'home-B6-preview')).toBe(true);
  });

  test('궁합 카드 시트 안에 AI 칸 — 방 id · 회원 정보 없이 같은 취미 코드만 보낸다 (ATF-27)', async () => {
    await aitStore.load();
    await aitStore.setCode(CODE);
    await aitStore.setConsent();
    const f = serve({ ok: true, code: 'ok', mode: 'mock', display: { same_line: '두 분 다 책 읽기를 좋아해요.', topics: ['요즘 읽는 책이 있나요?', '추천하고 싶은 책이 있나요?'], notes: [] } });
    const { tree } = await home('a3@email.com', 'matched', true);
    await press(tree, 'home-B2-pair');
    await wait();
    expect(isOpen(tree, 'if2-pair')).toBe(true);
    expect(has(tree, 'pair-ai-go')).toBe(true);
    await press(tree, 'pair-ai-go');
    await wait();
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body) as { feature: string; shared: { k: string; v: string }[] };
    expect(body.feature).toBe('compat');
    expect(body.shared.length).toBeGreaterThan(0);
    for (const s of body.shared) expect(Object.keys(COMPAT_DICT.hobby.values)).toContain(s.v);
    expect(Object.keys(body)).toEqual(['feature', 'shared']);
    expect(JSON.stringify(body)).not.toMatch(/demo-chat|u-a3|roomId|room/);
    expect(has(tree, 'pair-ai-same')).toBe(true);
    // 0원판(미리 쓴 글)은 그대로 위에 있다
    expect(has(tree, 'if2-pair-same-line')).toBe(true);
  });

  test('꺼짐이면 궁합 카드 시트에 AI 칸 0', async () => {
    const { tree } = await home('a4@email.com', 'matched', false);
    await press(tree, 'home-B2-pair');
    await wait();
    expect(has(tree, 'if2-pair')).toBe(true);
    expect(has(tree, 'pair-ai-go')).toBe(false);
  });

  test('앱의 취미 코드(설문 E11 보기)는 모두 서버 허용 사전(COMPAT_DICT)에 있다 — 어긋나면 bad_request', () => {
    const app = Object.keys(QUESTION_COPY.E11?.opt ?? {});
    expect(app.length).toBeGreaterThan(0);
    for (const c of app) expect(Object.keys(COMPAT_DICT.hobby.values)).toContain(c);
  });
});

describe('AIT-F 입구 — 기내지 ① 쪽 AI 풀이 · 문장 다듬기', () => {
  test('기내지 ① 쪽: [AI가 쓴 풀이 보기] → 별자리 코드 + 오행 코드만 보낸다', async () => {
    await aitStore.load();
    await aitStore.setCode(CODE);
    await aitStore.setConsent();
    const f = serve({ ok: true, code: 'ok', mode: 'mock', display: { star: '별자리 풀이 글이에요. 가볍게 읽어요.', saju: '사주 풀이 글이에요. 가볍게 읽어요.', notes: [] } });
    const r = rig('b1@email.com');
    await r.scene('inflight');
    const tree = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17, preOn: true }} />));
    await wait();
    await press(tree, 'mag-next'); // ① 하늘과 결
    expect(has(tree, 'star-ai-go')).toBe(true);
    await press(tree, 'star-ai-go');
    await wait();
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['day_element', 'feature', 'sun_sign']);
    expect(body.sun_sign).toBe('pisces');
    expect(['wood', 'fire', 'earth', 'metal', 'water']).toContain(body.day_element);
    expect(has(tree, 'star-ai-saju-text')).toBe(true);
    expect(has(tree, 'mag-sky-footer')).toBe(true); // 기존 끝줄은 그대로
  });

  test('경계 날(3월 20일 ~ 22일) 태어난 분은 AI 칸 대신 안내 글 · 서버 요청 0', async () => {
    const f = serve();
    const r = rig('b2@email.com', '1997-03-21');
    await r.scene('inflight');
    const tree = keep(await mount(<MagazineScreen deps={{ api: r.api, ck17: r.ck17 }} />));
    await wait();
    await press(tree, 'mag-next');
    expect(has(tree, 'mag-cusp')).toBe(true);
    expect(has(tree, 'star-ai-cusp')).toBe(true);
    expect(has(tree, 'star-ai-go')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  test('프로필 미리보기 [문장 다듬기] 단추 → 시트가 열린다 · 코드 없이 열어도 서버 요청 0', async () => {
    const f = serve();
    const r = rig('c1@email.com');
    await r.scene('before');
    const tree = keep(await mount(<PreviewScreen api={r.api} />));
    await wait();
    expect(has(tree, 'preview-coach')).toBe(true);
    expect(isOpen(tree, 'coach')).toBe(false);
    await press(tree, 'preview-coach');
    expect(isOpen(tree, 'coach')).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('AIT-F 입구 — 설정 줄', () => {
  const deps = (ait?: () => boolean): SettingsDeps => ({
    api: {} as SettingsDeps['api'],
    now: Date.now,
    resetLocal: jest.fn(),
    pushStatus: async () => 'undetermined',
    requestPush: async () => 'undetermined',
    copyText: async () => true,
    openMail: async () => undefined,
    ait,
  });

  test('켜짐: [시험용 AI 코드] 줄 → 쪽 · 꺼짐/없음: 줄 0', async () => {
    const on = keep(await mount(<SettingsScreen deps={deps(() => true)} />));
    await wait();
    expect(has(on, 'settings-row-ait-code')).toBe(true);
    await press(on, 'settings-row-ait-code');
    await wait();
    expect(has(on, 'settings-ait')).toBe(true);
    const off = keep(await mount(<SettingsScreen deps={deps(() => false)} />));
    expect(has(off, 'settings-row-ait-code')).toBe(false);
    const none = keep(await mount(<SettingsScreen deps={deps()} />));
    expect(has(none, 'settings-row-ait-code')).toBe(false);
  });
});
