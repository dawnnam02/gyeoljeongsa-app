// F18 조건 2 (Q5A-14 · Q6 N2): 다른 화면이 연 16 상점 쪽의 ‹ 는 그 화면으로 돌아간다 — 모의 router 가 아니라 진짜 expo-router(스택 + 탭 묶음)로 돈다.
//  앱과 같은 모양: 뿌리 Stack 위에 (tabs)(실제 탭 레이아웃, backBehavior initialRoute) · candidate/[id](10, 탭 밖) — 화면은 실제 CandidateScreen · ShopScreen · SettingsScreen 을
//  데모 모의 서버 위에서 그린다. v5(QP-A, 카피.md 12-Q · 14-1): 10 의 등급 구독 안내 줄 · 12 의 '구매 · 등급 구독' 줄은 없다 —
//  10 에는 그 줄이 없음을 보고, 12 → [크레딧 · 구매 내역] → T5(/credits) → ‹ = 12 를 본다.
//  Q6 에서 웹으로 본 실패: 10 위에 탭 묶음이 하나 더 쌓이고, 탭의 '뒤로'가 첫 탭(09)으로 가 버렸다. 시험 도구는 expo-router 의 시험 틀(ExpoRoot + 메모리 라우트)만 쓴다.
import { Stack, router } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { store } from 'expo-router/build/global-state/router-store';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import TabsLayout from '@/app/(tabs)/_layout';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { createGradeApi } from '@/lib/gradeApi';
import { createLikesApi } from '@/lib/likesApi';
import { createRecsApi } from '@/lib/recsApi';
import { createSettingsApi } from '@/lib/settingsApi';

import { makeShopRig } from './shopRig';

jest.setTimeout(900_000); // 진짜 router + 실제 화면 세 개를 그린다 — 기계가 바쁠 때(여러 작업이 함께 시험을 돌릴 때) 한 시험이 2분을 넘은 적이 있다

jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (p: string) => `gjs://${p}`,
  resolveScheme: () => 'gjs',
  addEventListener: () => ({ remove() {} }),
}));
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: {}, settingsApi: {}, shopApi: {}, aiApi: {}, authApi: {}, profileApi: { facePhotoUrl: async () => null }, supabase: {} }));

const trees: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
});

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await flush();
};
const pathname = () => store.getRouteInfo().pathname;

// 화면이 여러 겹 쌓여 있으면 같은 testID 가 여러 번 나온다 — 가장 나중(맨 위)에 그려진 것을 누른다
async function tap(tree: ReactTestRenderer, id: string) {
  const nodes = tree.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function');
  if (nodes.length === 0) throw new Error(`testID "${id}" 누를 요소가 없어요`);
  await act(async () => {
    await nodes[nodes.length - 1].props.onPress();
  });
  await settle();
}
const visibleIds = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => n.props.testID === id).length;

async function renderApp(scene: string, initial: string) {
  const rig = await makeShopRig(scene);
  const candidateDeps: CandidateDeps = { api: createRecsApi(rig.client, rig.deps.now), likes: createLikesApi(rig.client), grade: createGradeApi(rig.client), toastMs: 50 };
  const settingsDeps: SettingsDeps = {
    api: createSettingsApi(rig.client, 'test'),
    grade: rig.gradeApi,
    now: rig.deps.now,
    resetLocal: () => undefined,
    pushStatus: async () => 'granted',
    requestPush: async () => 'granted',
    copyText: async () => true,
    openMail: async () => undefined,
  };
  const context = inMemoryContext({
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/recommendations': () => <Text testID="screen-09">09</Text>,
    '(tabs)/likes': () => <Text testID="screen-11">11</Text>,
    '(tabs)/shop': () => <ShopScreen deps={rig.deps} />,
    '(tabs)/settings': () => <SettingsScreen deps={settingsDeps} />,
    '(tabs)/recommendations-empty': () => <Text>13</Text>,
    '(tabs)/likes-empty': () => <Text>14</Text>,
    'candidate/[id]': () => <CandidateScreen deps={candidateDeps} />,
    credits: () => <Text testID="screen-T5">T5</Text>,
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExpoRoot context={context as never} location={initial} />);
  });
  trees.push(tree);
  await settle();
  return tree;
}

describe('F18 조건 2: 다른 화면이 연 상점 쪽의 ‹ (진짜 router)', () => {
  test('09 → 10: v5 에는 등급 구독 안내 줄이 없고, ‹ 를 누르면 처음 들어온 09 로 간다', async () => {
    const tree = await renderApp('plain', '/recommendations');
    await act(async () => router.push('/candidate/demo-cand-1'));
    await settle();
    expect(pathname()).toBe('/candidate/demo-cand-1');
    expect(visibleIds(tree, 'candidate-grade-subscribe')).toBe(0);
    await tap(tree, 'candidate-header-back');
    expect(pathname()).toBe('/recommendations');
  });

  test('12 → [크레딧 · 구매 내역] → T5(/credits) → 뒤로 가면 12 로 돌아온다', async () => {
    const tree = await renderApp('plain', '/recommendations');
    await act(async () => router.navigate('/settings'));
    await settle();
    expect(pathname()).toBe('/settings');
    await tap(tree, 'settings-row-credits');
    expect(pathname()).toBe('/credits');
    expect(visibleIds(tree, 'screen-T5')).toBeGreaterThan(0);
    await act(async () => router.back());
    await settle();
    expect(pathname()).toBe('/settings');
  });

  test('상점 탭 안에서 연 쪽(목록 → 상세)의 ‹ 는 전처럼 상점 목록으로(탭을 떠나지 않는다)', async () => {
    const tree = await renderApp('plain', '/shop');
    await tap(tree, 'shop-grade-detail');
    expect(visibleIds(tree, 'shop-page-product')).toBeGreaterThan(0);
    await tap(tree, 'shop-sub-header-back');
    expect(pathname()).toBe('/shop');
    expect(visibleIds(tree, 'screen-16')).toBeGreaterThan(0);
  });
});
