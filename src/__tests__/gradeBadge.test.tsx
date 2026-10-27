// F13 조건 3 · 4 → D-197(CK10 폐지): 09 추천 카드 · 10 상대 프로필의 등급 배지는 누구에게도 없다. 옛 규칙: 구독자 + 상대가 CK10 에 동의한 분만 "{n}등급" + 배지, 미동의는 표시 없음, 비구독자는 아무것도 없음(NV47 한 줄만),
//  말풍선 NV82 · 10 상세 NV55 · NV81 · NV85 · 한계 문구 · 09 '추가로 받은 추천' 구역(NV63). 실제 recsApi · gradeApi 를 모의 서버(lib/shopDemo · demoRecs) 위에서 돌린다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { BADGE16, SHOP16 } from '@/content/shopCopy';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { RecommendationsScreen, type RecsDeps } from '@/features/recs/RecommendationsScreen';
import { createGradeApi } from '@/lib/gradeApi';
import { createLikesApi } from '@/lib/likesApi';
import { createRecsApi } from '@/lib/recsApi';
import { newRequestId } from '@/lib/requestId';
import { createShopApi } from '@/lib/shopApi';

import { allTexts, has, hasText, mount, textOf } from './renderHelpers';
import { makeShopRig } from './shopRig';

jest.setTimeout(90_000);

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
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
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: {}, profileApi: { facePhotoUrl: async () => null }, supabase: {} }));

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

async function openRecs(scene: string, before?: (r: Awaited<ReturnType<typeof makeShopRig>>) => Promise<void>) {
  const rig = await makeShopRig(scene);
  if (before) await before(rig);
  const api = createRecsApi(rig.client, rig.deps.now);
  const deps: RecsDeps = { api, now: rig.deps.now, tickMs: 3_600_000, toastMs: 50 };
  const tree = await mount(<RecommendationsScreen deps={deps} />);
  shown.push(tree);
  await flush();
  return { tree, ...rig };
}
async function openCandidate(scene: string, id: string) {
  const rig = await makeShopRig(scene);
  mockParams.id = id;
  const deps: CandidateDeps = { api: createRecsApi(rig.client, rig.deps.now), likes: createLikesApi(rig.client), grade: createGradeApi(rig.client), toastMs: 50 };
  const tree = await mount(<CandidateScreen deps={deps} />);
  shown.push(tree);
  await flush();
  return { tree, ...rig };
}

describe('조건 3 · 09 추천 카드 배지', () => {
  test('비구독자: 칩 · 등급 글 · 자물쇠가 하나도 없다(흐린 배지 · 힌트 금지)', async () => {
    const { tree } = await openRecs('plain');
    expect([0, 1, 2].map((i) => has(tree, `rec-grade-${i}`))).toEqual([false, false, false]);
    expect(allTexts(tree).join(' ')).not.toMatch(/등급|점수|순위/);
    expect(has(tree, 'recs-extra-title')).toBe(false);
  });

  test('D-197(CK10 폐지 · 청사진 6-2): 구독자에게도 상대 등급 칩이 없다 · 서버 순서는 그대로', async () => {
    const { tree } = await openRecs('shopsub');
    expect([0, 1, 2].map((i) => textOf(tree, `rec-head-${i}`)?.slice(0, 2))).toEqual(['김O', '최O', '박O']); // 서버 순서: cand-1 · cand-3 · cand-2
    expect([0, 1, 2].map((i) => has(tree, `rec-grade-${i}`))).toEqual([false, false, false]);
    expect(has(tree, 'rec-grade-0-bubble')).toBe(false);
    expect(allTexts(tree).filter((t) => /\d\s*등급|점수/.test(t))).toEqual([]);
  });

  test('등급 계산을 멈춘 구독자는 서버 순서가 비구독자와 같다(앱은 순서를 바꾸지 않는다)', async () => {
    const { tree } = await openRecs('shopsub', async (r) => void (await r.gradeApi.setProcessing(false)));
    expect([0, 1, 2].map((i) => textOf(tree, `rec-head-${i}`)?.slice(0, 2))).toEqual(['김O', '박O', '최O']);
  });
});

describe('조건 4 · 09 "추가로 받은 추천" 구역 (1회 매칭)', () => {
  test('1회 매칭을 쓴 날: 무료 3장 아래 제목 NV63 + 추가 카드 3장(같은 카드 모양)', async () => {
    const { tree } = await openRecs('moslot', async (r) => void (await createShopApi(r.client).useMatchOnce(newRequestId())));
    expect(textOf(tree, 'recs-extra-title')).toBe(SHOP16.extraTitle);
    expect(SHOP16.extraTitle).toBe('추가로 받은 추천');
    for (const i of [0, 1, 2, 3, 4, 5]) expect(has(tree, `rec-card-${i}`)).toBe(true);
    // 제목은 무료 3장 뒤, 추가 3장 앞
    const order = tree.root.findAll((n) => typeof n.props.testID === 'string' && /^(rec-card-\d|recs-extra-title)$/.test(n.props.testID)).map((n) => n.props.testID as string);
    expect([...new Set(order)]).toEqual(['rec-card-0', 'rec-card-1', 'rec-card-2', 'recs-extra-title', 'rec-card-3', 'rec-card-4', 'rec-card-5']);
    expect(allTexts(tree).join(' ')).not.toMatch(/등급/); // 비구독자 추가 카드에도 배지가 없다
  });

  test('D-197: 구독자의 추가 카드에도 상대 등급 칩이 없다', async () => {
    const { tree } = await openRecs('shopsub-moslot', async (r) => void (await createShopApi(r.client).useMatchOnce(newRequestId())));
    expect(has(tree, 'recs-extra-title')).toBe(true);
    expect([3, 4, 5].map((i) => has(tree, `rec-grade-${i}`))).toEqual([false, false, false]);
  });

  test('추가 카드에 보낸 호감은 무료 3건 한도에 세지 않는다', async () => {
    const rig = await makeShopRig('moslot');
    await createShopApi(rig.client).useMatchOnce(newRequestId());
    const recs = createRecsApi(rig.client, rig.deps.now);
    for (const id of ['demo-cand-1', 'demo-cand-2', 'demo-cand-3']) expect((await recs.sendLike(id)).ok).toBe(true);
    expect(await recs.sendLike('demo-cand-7')).toMatchObject({ ok: true });
    expect((await recs.pairState('demo-cand-8'))?.likesLeft).toBe(0);
  });
});

describe('조건 3 · 10 상대 프로필 등급', () => {
  test('D-197: 구독자가 보는 10 상대 프로필에도 등급 배지 · NV55 · 한계 문구가 없다', async () => {
    const { tree } = await openCandidate('shopsub', 'demo-cand-1');
    expect(has(tree, 'candidate-grade')).toBe(false);
    expect(has(tree, 'candidate-grade-subscribe')).toBe(false);
    expect(allTexts(tree).filter((t) => /\d\s*등급/.test(t))).toEqual([]);
  });

  test('구독자 + 동의하지 않은 상대: 배지 자리도 "비공개" 글자도 없다 · NV47 도 없다', async () => {
    const { tree } = await openCandidate('shopsub', 'demo-cand-3');
    expect(has(tree, 'candidate-grade')).toBe(false);
    expect(has(tree, 'candidate-grade-subscribe')).toBe(false);
    expect(allTexts(tree).filter((t) => /등급/.test(t))).toEqual([]);
  });

  test('비구독자: 등급 자리 없음 · v5(QP-A, 카피 14-1)는 구독 권유 한 줄 NV47 도 없다', async () => {
    const { tree } = await openCandidate('plain', 'demo-cand-1');
    expect(has(tree, 'candidate-grade')).toBe(false);
    expect(has(tree, 'candidate-grade-subscribe')).toBe(false);
    expect(hasText(tree, '등급 구독을 하면 등급을 공개한 분의 등급을 볼 수 있어요.')).toBe(false);
    expect(allTexts(tree).filter((t) => /\d등급|구독/.test(t))).toEqual([]);
    expect('nonSubscriber' in BADGE16).toBe(false);
  });

  test('상대 등급을 못 읽어도(네트워크) 화면은 그대로 뜨고 NV47 은 만들지 않는다', async () => {
    const rig = await makeShopRig('plain');
    mockParams.id = 'demo-cand-1';
    const deps: CandidateDeps = { api: createRecsApi(rig.client, rig.deps.now), likes: createLikesApi(rig.client), grade: { partnerGrade: async () => null }, toastMs: 50 };
    const tree = await mount(<CandidateScreen deps={deps} />);
    shown.push(tree);
    await flush();
    expect(has(tree, 'screen-10')).toBe(true);
    expect(has(tree, 'candidate-grade-subscribe')).toBe(false);
    expect(has(tree, 'candidate-grade')).toBe(false);
  });
});
