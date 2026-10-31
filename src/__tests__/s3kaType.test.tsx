// 3부-카 ② — 내 여행 타입 서버 연결(백엔드 0047 get_my_travel_type) · 상태 다섯 화면 · 실서버에서 앱 안 계산 0
//  기준: backend R_변경기록 15-2(응답 모양) · 정책 PF-31 ~ PF-33 · 카피 21-5(TYPE_CARD) · 기기 저장 0
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { IF3_TEXT } from '@/content/if3Copy';
import { createDeviceNotes } from '@/features/inflight/deviceNotes';
import { tx } from '@/features/inflight/if2Text';
import { TypeCardScreen } from '@/features/inflight/TypeCardScreen';
import { createTypeSource, parseTypeState, TYPE_IDS, typeStateOf, type TypeSource } from '@/features/inflight/typeApi';
import { COMMON } from '@/content/copy';

import { allTexts, has, mount, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

jest.setTimeout(60_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});

const err = (message: string, code?: string) => ({ data: null, error: { message, code } });
const BAG = ['thermos', 'paper_map', 'umbrella', 'postcard', 'notebook', 'plant', 'stamp_book'];

describe('get_my_travel_type 응답 읽기 — 상태 다섯(0047)', () => {
  test('ready(tt-01 ~ tt-12) · none · not_ready · feature_off · forbidden', () => {
    for (const id of TYPE_IDS) expect(parseTypeState({ ok: true, state: 'ready', type: id }, null)).toEqual({ state: 'ready', type: id });
    expect(TYPE_IDS).toHaveLength(12);
    expect(parseTypeState({ ok: true, state: 'none' }, null)).toEqual({ state: 'none' });
    expect(parseTypeState({ ok: false, code: 'not_ready' }, null)).toEqual({ state: 'not_ready' });
    expect(parseTypeState(null, { message: 'feature_off', code: '42501' })).toEqual({ state: 'feature_off' });
    expect(parseTypeState(null, { message: 'forbidden', code: '42501' })).toEqual({ state: 'forbidden' });
    expect(parseTypeState(null, { message: 'permission denied', code: '42501' })).toEqual({ state: 'forbidden' });
  });
  test('모르는 모양 · 없는 타입 · 12 밖 · 네트워크 끊김은 not_ready(타입 0) · 숫자 칸은 읽지 않는다', () => {
    for (const bad of [null, 'x', [], {}, { ok: true }, { ok: true, state: 'ready' }, { ok: true, state: 'ready', type: 'tt-13' }, { ok: true, state: 'ready', type: 'tt-00' }, { ok: true, state: 'ready', type: 1 }, { ok: false, code: 'weird' }]) {
      expect(parseTypeState(bad, null)).toEqual({ state: 'not_ready' });
    }
    expect(parseTypeState(null, { message: 'Failed to fetch' })).toEqual({ state: 'not_ready' });
    const withAxes = parseTypeState({ ok: true, state: 'ready', type: 'tt-05', axes: { extraversion: 70 }, score: 9 }, null);
    expect(withAxes).toEqual({ state: 'ready', type: 'tt-05' });
  });
  test('createTypeSource: 인자 없는 get_my_travel_type 한 번 · mine 은 ready 때만 id · 던져도 not_ready', async () => {
    const seen: [string, unknown][] = [];
    const mk = (res: unknown) => createTypeSource(async (fn, args) => (seen.push([fn, args]), res as never));
    const ready = mk({ data: { ok: true, state: 'ready', type: 'tt-07' }, error: null });
    expect(await ready.mine()).toBe('tt-07');
    expect(seen).toEqual([['get_my_travel_type', {}]]);
    expect(await mk({ data: { ok: true, state: 'none' }, error: null }).mine()).toBeNull();
    expect(await mk(err('feature_off', '42501')).mine()).toBeNull();
    const boom = createTypeSource(async () => {
      throw new Error('x');
    });
    expect(await boom.state?.()).toEqual({ state: 'not_ready' });
  });
  test('typeStateOf: state() 가 없는 옛 원천은 mine 으로 갈음', async () => {
    expect(await typeStateOf({ mine: async () => 'tt-02' })).toEqual({ state: 'ready', type: 'tt-02' });
    expect(await typeStateOf({ mine: async () => null })).toEqual({ state: 'none' });
  });
});

describe('IF-TYPE 화면 — 상태 다섯 · 서버 값만 · 숫자 0', () => {
  const screen = async (source: TypeSource) => {
    const notes = createDeviceNotes();
    notes.set('typeBag', BAG); // 짐은 이미 쌈(기기에만)
    const tree = keep(await mount(<TypeCardScreen source={source} notes={notes} />));
    await wait();
    return tree;
  };
  test('ready: 서버가 준 id 의 엽서(앱 안 계산 0) · 숫자 퍼센트 0', async () => {
    const tree = await screen({ mine: async () => 'tt-01', state: async () => ({ state: 'ready', type: 'tt-01' }) });
    expect(textOf(tree, 'type-name')).toBe('기차 창가 여행자');
    expect(allTexts(tree).join(' ')).not.toMatch(/\d+\s*%|점수|등급/);
  });
  test('none · not_ready · feature_off · forbidden: 엽서 0 · 서로 다른 칸 · not_ready 만 [다시 시도]', async () => {
    for (const s of ['none', 'not_ready', 'feature_off', 'forbidden'] as const) {
      const tree = await screen({ mine: async () => null, state: async () => ({ state: s }) });
      expect(has(tree, `type-state-${s}`)).toBe(true);
      expect(has(tree, 'type-name')).toBe(false);
      // 22-14(F0-M): not_ready 만 '불러오지 못했어요 + 다시 시도', 나머지 셋은 사실 한 문장 · 단추 0
      const want = { none: IF3_TEXT['TYPE_CARD.state.none'], not_ready: tx('TYPE_CARD.loadFailed'), feature_off: IF3_TEXT['TYPE_CARD.state.featureOff'], forbidden: IF3_TEXT['TYPE_CARD.state.forbidden'] }[s];
      expect(textOf(tree, 'type-none')).toBe(want);
      expect(has(tree, 'type-retry')).toBe(s === 'not_ready');
    }
  });
  test('not_ready [다시 시도] → 서버를 한 번 더 불러 ready 가 되면 엽서', async () => {
    let n = 0;
    const tree = await screen({ mine: async () => null, state: async () => (n++ === 0 ? { state: 'not_ready' } : { state: 'ready', type: 'tt-03' }) });
    expect(has(tree, 'type-retry')).toBe(true);
    expect(allTexts(tree)).toContain(COMMON.retry);
    await press(tree, 'type-retry');
    await wait();
    expect(n).toBe(2);
    expect(has(tree, 'type-name')).toBe(true);
    expect(has(tree, 'type-retry')).toBe(false);
  });
  test('ready 인데 라이브러리에 없는 id 면 not_ready 칸(깨지지 않음)', async () => {
    const tree = await screen({ mine: async () => 'tt-99', state: async () => ({ state: 'ready', type: 'tt-99' }) });
    expect(has(tree, 'type-state-not_ready')).toBe(true);
  });
});
