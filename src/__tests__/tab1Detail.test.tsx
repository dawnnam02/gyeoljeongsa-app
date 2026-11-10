// TAB-1 내 사주 자세히(/saju-detail = 옛 사주 마당 긴 풀이 화면): 메뉴 줄이 건넨 구역이 맨 위에 오게 열린다 · 손으로 밀면 멈춘다 · 건넨 것은 화면을 떠나면 지운다 · 뒤로 = 사주 마당 탭.
import { ScrollView } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createIf5ConsentStore } from '@/features/consent/if5Consent';
import type { Ck17Api } from '@/features/inflight/inflightService';
import { createInputStore, memoryInputStorage, type InputStore } from '@/features/saju/deviceInput';
import { createSajuApi } from '@/features/saju/sajuApi';
import { SAJU_DETAIL_HREF, SAJU_HREF, SajuMadangScreen } from '@/features/saju/SajuMadangScreen';
import { clearSajuSection, handOffSajuSection, peekSajuSection } from '@/features/saju/sajuSection';
import type { SajuDeps } from '@/features/saju/sajuService';

import { has, mount, must, press } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: () => undefined, Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/lib/captureBlock', () => ({ useCaptureBlock: () => undefined, useAlwaysCaptureBlock: () => undefined }));

jest.setTimeout(90_000);

const NOW = Date.parse('2027-03-20T03:00:00Z');
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
  for (const fn of Object.values(mockRouter)) (fn as jest.Mock).mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  clearSajuSection();
});

function rig(flagOver: Record<string, boolean> = {}) {
  const flags = { ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...flagOver } as Record<string, boolean>;
  const user = { id: 'u-detail', email: 'detail@email.com' };
  const demo = createDemoSaju({ flags: async () => flags, account: () => ({ birthDate: '1994-03-14', consentOn: (c) => c === 'CK17A' }), today: () => '2027-03-20' });
  const api = createSajuApi(async (fn: string, args: Record<string, unknown> = {}) => demo.rpc(user, fn, args));
  const ck17: Ck17Api = { load: async () => ({ ok: true, data: { a: true, b: false } }), record: jest.fn(async () => ({ ok: true as const })), revoke: jest.fn(async () => ({ ok: true as const })) };
  const consent = createIf5ConsentStore();
  void consent.setItems({ time: true, gender: true });
  const deps: SajuDeps = { api, ck17, isOn: (k) => flags[k] === true, now: () => NOW, birthDate: async () => '1994-03-14', consent };
  return deps;
}
const answered = (): InputStore => {
  const s = createInputStore(memoryInputStorage());
  void s.save({ time: null, saveTime: false });
  return s;
};
const layoutAt = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 360, height: 200 } } });

async function openDetail(deps: SajuDeps) {
  const tree = await mount(<SajuMadangScreen deps={deps} store={answered()} />);
  mounted.push(tree);
  await wait(120);
  // 시험용 틀에는 스크롤 몸체가 없어서 scrollTo 를 대역으로 건다
  const scroller = tree.root.findByType(ScrollView);
  const scrollTo = jest.fn();
  (scroller.instance as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
  return { tree, scroller, scrollTo };
}

describe('TAB-1 내 사주 자세히 — 구역을 맨 위로', () => {
  test('주소 상수: 탭 = /saju(메뉴) · 이 화면 = /saju-detail', () => {
    expect(SAJU_HREF).toBe('/saju');
    expect(SAJU_DETAIL_HREF).toBe('/saju-detail');
  });
  test('메뉴가 건넨 구역(year)의 카드가 나타나 자리가 재어지면 그 자리가 맨 위로 오게 스크롤한다 · 늦게 바뀐 자리는 다시 맞춘다', async () => {
    handOffSajuSection('year');
    const { tree, scrollTo } = await openDetail(rig());
    expect(has(tree, 'saju-year')).toBe(true);
    const anchor = must(tree, 'saju-anchor-year');
    await act(async () => anchor.props.onLayout(layoutAt(640)));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 640, animated: false });
    await act(async () => anchor.props.onLayout(layoutAt(700))); // 위 카드가 늦게 자라 자리가 밀림
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700, animated: false });
    // 다른 구역의 자리가 재어져도 움직이지 않는다
    const before = scrollTo.mock.calls.length;
    await act(async () => must(tree, 'saju-anchor-love').props.onLayout(layoutAt(900)));
    expect(scrollTo.mock.calls.length).toBe(before);
  });
  test('사용자가 손으로 밀면(onScrollBeginDrag) 다시 맞추지 않는다', async () => {
    handOffSajuSection('season');
    const { tree, scroller, scrollTo } = await openDetail(rig());
    const anchor = must(tree, 'saju-anchor-season');
    await act(async () => anchor.props.onLayout(layoutAt(1200)));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await act(async () => scroller.props.onScrollBeginDrag());
    await act(async () => anchor.props.onLayout(layoutAt(1300)));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
  test('건넨 구역이 없으면(주소로 바로 열림 · 옛 길) 처음 그대로 — 스크롤 0', async () => {
    const { tree, scrollTo } = await openDetail(rig());
    await act(async () => must(tree, 'saju-anchor-year').props.onLayout(layoutAt(640)));
    expect(scrollTo).not.toHaveBeenCalled();
  });
  test('네 기둥 스위치(three_pillars)가 꺼져 있으면 pillars 구역은 결 읽기 카드가 맡는다', async () => {
    handOffSajuSection('pillars');
    const { tree, scrollTo } = await openDetail(rig({ three_pillars: false }));
    expect(has(tree, 'saju-pillars')).toBe(false);
    expect(has(tree, 'saju-kyeol')).toBe(true);
    await act(async () => must(tree, 'saju-anchor-pillars').props.onLayout(layoutAt(300)));
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 300, animated: false });
  });
  test('읽는 법 · 둘이 맞춰 보기 구역도 표시가 있다 · 건넨 것은 화면을 떠나면 지워진다', async () => {
    handOffSajuSection('guide');
    const { tree } = await openDetail(rig());
    expect(has(tree, 'saju-anchor-guide')).toBe(true);
    expect(has(tree, 'saju-anchor-partner')).toBe(true);
    expect(peekSajuSection()).toBe('guide'); // 보는 동안은 그대로(개발 모드가 두 번 그려도 같은 값)
    await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
    expect(peekSajuSection()).toBeNull();
  });
  test('뒤로: 쌓인 화면이 있으면 한 칸 뒤로(= 사주 마당 탭) · 주소로 바로 열렸으면 사주 마당 탭(/saju)으로', async () => {
    const { tree } = await openDetail(rig());
    await press(tree, 'saju-header-back');
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    mockRouter.canGoBack.mockReturnValue(false);
    await press(tree, 'saju-header-back');
    expect(mockRouter.replace).toHaveBeenCalledWith('/saju');
  });
});
