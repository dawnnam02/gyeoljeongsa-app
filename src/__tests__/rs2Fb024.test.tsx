// RS2-01 [마]1 FB-024 — 탑승권 탭 기내 홈의 '오늘 하루' 띠: 사주 마당 탭에서 동의(CK17A)를 마치고 돌아와도 안 보이던 것.
//  원인: 하단 탭 화면은 다른 탭에 갔다 와도 그대로 떠 있어(다시 열리지 않아) 홈이 동의를 '열 때 한 번'만 읽었다.
//  고침: 탭으로 돌아올 때(포커스)마다 동의를 다시 읽는다. 처음 포커스 = 홈을 열 때는 원래 읽기가 하므로 중복 호출 0. 서버 호출은 여전히 동의 읽기뿐.
//  포커스는 진짜 expo-router 대신 시험이 손으로 돌린다: 열 때 한 번 부르고, 이 시험이 '탭에 돌아옴'을 흉내 낼 때 가장 최근 콜백을 다시 부른다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { parseHomeState } from '@/features/inflight/inflightApi';
import { InflightHome } from '@/features/inflight/InflightHome';
import type { Ck17Api } from '@/features/inflight/inflightService';

import { has, mount } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
const mockFocus: { cbs: (() => void | (() => void))[] } = { cbs: [] };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    // 열릴 때(첫 포커스) 한 번 부르고, 가장 최근 콜백만 기억한다 — 시험이 '탭에 돌아옴'을 흉내 내려고 다시 부른다
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockFocus.cbs.push(effect);
      React.useEffect(effect, []); // eslint-disable-line react-hooks/exhaustive-deps
    },
    Redirect: () => null,
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}`, inflightChatApi: () => ({}) }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));

jest.setTimeout(60_000);
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  mockFocus.cbs = [];
});

const NOW = Date.parse('2027-03-20T03:00:00Z');
const flags = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;
const boarding = { past: [], ticket: null, round: null, phase: 'on_sale' } as unknown as BoardingState;

async function open(answers: boolean[], over: Record<string, boolean> = {}) {
  const f = flags(over);
  let reads = 0;
  const ck17: Ck17Api = {
    load: async () => {
      const a = answers[Math.min(reads, answers.length - 1)];
      reads += 1;
      return { ok: true, data: { a, b: false } };
    },
    record: async () => ({ ok: true }),
    revoke: async () => ({ ok: true }),
  };
  const api = { home: async () => ({ ok: true as const, data: home as never }), pairCard: async () => ({ ok: false as const, code: 'x' }), preQuestions: async () => ({ ok: false as const, code: 'x' }) } as unknown;
  const home = parseHomeState({ stage: 'inflight', blocks: ['B6', 'B7'], me: { cells: ['preview'] } });
  if (!home) throw new Error('home');
  const nav = { open: jest.fn(), chat: jest.fn(), settings: jest.fn() };
  const tree = await mount(
    <InflightHome deps={{ api, ck17, type: { mine: async () => null }, isOn: (k) => f[k] === true, notes: createDeviceNotes(), now: () => NOW, ait: false }} home={home} boarding={boarding} nav={nav} onToast={() => undefined} />,
  );
  mounted.push(tree);
  await wait(50);
  /** 다른 탭에 갔다 돌아옴 = 포커스 콜백을 다시 부른다 */
  const comeBack = async () => {
    await act(async () => {
      mockFocus.cbs[mockFocus.cbs.length - 1]?.();
      await new Promise((r) => setTimeout(r, 40));
    });
  };
  return { tree, comeBack, reads: () => reads };
}

describe('FB-024 홈 오늘 하루 띠: 탭에 돌아올 때 동의를 다시 읽는다', () => {
  test('열 때 동의가 없어 띠가 없다 → 사주 마당 탭에서 동의를 마치고 돌아오면 띠가 보인다', async () => {
    const r = await open([false, true]);
    expect(has(r.tree, 'home-today')).toBe(false);
    expect(r.reads()).toBe(1); // 열 때 한 번(첫 포커스는 건너뛴다 — 중복 호출 0)
    await r.comeBack();
    expect(r.reads()).toBe(2);
    expect(has(r.tree, 'home-today')).toBe(true);
  });

  test('반대로 돌아오기 전에 동의를 거뒀다면 띠가 사라진다(동의 관리에서 끈 경우)', async () => {
    const r = await open([true, false]);
    expect(has(r.tree, 'home-today')).toBe(true);
    await r.comeBack();
    expect(has(r.tree, 'home-today')).toBe(false);
  });

  test('스위치가 꺼진 홈은 돌아와도 동의를 읽지 않는다(서버 호출 0) · 열 때 읽기는 그대로 한 번', async () => {
    const r = await open([true, true], { saju_home: false });
    expect(r.reads()).toBe(0);
    await r.comeBack();
    expect(r.reads()).toBe(0);
    expect(has(r.tree, 'home-today')).toBe(false);
  });

  test('돌아올 때마다 읽지만 서버 호출은 동의 읽기뿐(홈 상태 · 사주 계산 · AI 추가 호출 0)', async () => {
    const calls: string[] = [];
    const f = flags();
    const ck17: Ck17Api = { load: async () => (calls.push('ck17'), { ok: true, data: { a: true, b: false } }), record: async () => ({ ok: true }), revoke: async () => ({ ok: true }) };
    const home = parseHomeState({ stage: 'inflight', blocks: ['B6', 'B7'], me: { cells: ['preview'] } });
    const api = { home: async () => (calls.push('home'), { ok: true as const, data: home as never }) } as unknown;
    const tree = await mount(
      <InflightHome deps={{ api, ck17, type: { mine: async () => null }, isOn: (k) => f[k] === true, notes: createDeviceNotes(), now: () => NOW, ait: false }} home={home!} boarding={boarding} nav={{ open: jest.fn(), chat: jest.fn(), settings: jest.fn() }} onToast={() => undefined} />,
    );
    mounted.push(tree);
    await wait(50);
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        mockFocus.cbs[mockFocus.cbs.length - 1]?.();
        await new Promise((r) => setTimeout(r, 40));
      });
    }
    expect(calls.filter((c) => c !== 'ck17')).toEqual([]); // 이 부품이 부른 서버 함수는 동의 읽기뿐
    expect(calls.filter((c) => c === 'ck17')).toHaveLength(3); // 열 때 1 + 돌아올 때 2
  });
});
