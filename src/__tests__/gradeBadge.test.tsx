// F13 조건 3 · 4: 09 추천 카드 · 10 상대 프로필의 등급 배지 — 구독자 + 상대가 CK10 에 동의한 분만 "{n}등급" + 배지, 미동의는 표시 없음, 비구독자는 아무것도 없음(NV47 한 줄만),
//  말풍선 NV82 · 10 상세 NV55 · NV81 · NV85 · 한계 문구 · 09 '추가로 받은 추천' 구역(NV63). 실제 recsApi · gradeApi 를 모의 서버(lib/shopDemo · demoRecs) 위에서 돌린다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { BADGE16, GRADE16, SHOP16 } from '@/content/shopCopy';
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
// 칩처럼 testID 가 부품 → 안쪽 누름 요소로 겹칠 때, 실제 누를 수 있는 요소
const tapInner = async (tree: ReactTestRenderer, id: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
  await act(async () => void node.props.onPress());
  await flush();
};

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

  test('구독자: 서버 순서 그대로 · CK10 동의한 분만 칩(W9: 풍경 아이콘만, 숫자 글 없음), 동의 안 한 분은 칩 자리도 없다', async () => {
    const { tree } = await openRecs('shopsub');
    expect([0, 1, 2].map((i) => textOf(tree, `rec-head-${i}`)?.slice(0, 2))).toEqual(['김O', '최O', '박O']); // 서버 순서: cand-1(2등급) · cand-3 · cand-2(6등급)
    expect([has(tree, 'rec-grade-0'), has(tree, 'rec-grade-2')]).toEqual([true, true]);
    expect(has(tree, 'rec-grade-0-text')).toBe(false);
    expect(has(tree, 'rec-grade-1')).toBe(false);
    expect(has(tree, 'rec-grade-1-wrap')).toBe(false);
    const chip = tree.root.findAll((n) => n.props.testID === 'rec-grade-0').at(-1)!;
    expect(chip.props.accessibilityLabel).toBe('이분의 등급 아이콘'); // GI2(숫자 없음)
    expect(has(tree, 'rec-grade-0-image')).toBe(true);
    // 등급 숫자 글이 카드에 없다
    expect(allTexts(tree).filter((t) => /\d\s*등급|점수/.test(t))).toEqual([]);
  });

  test('칩을 누르면 말풍선(W9: NV85 한 줄, 숫자 · 방향 문구 없음), 다시 누르면 닫힌다', async () => {
    const { tree } = await openRecs('shopsub');
    expect(has(tree, 'rec-grade-0-bubble')).toBe(false);
    await tapInner(tree, 'rec-grade-0');
    expect(has(tree, 'rec-grade-0-bubble-title')).toBe(false);
    expect(textOf(tree, 'rec-grade-0-bubble-note')).toBe(BADGE16.notLife);
    await tapInner(tree, 'rec-grade-0');
    expect(has(tree, 'rec-grade-0-bubble')).toBe(false);
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

  test('구독자의 추가 카드에도 CK10 동의 상대만 칩이 붙는다', async () => {
    const { tree } = await openRecs('shopsub-moslot', async (r) => void (await createShopApi(r.client).useMatchOnce(newRequestId())));
    expect(has(tree, 'recs-extra-title')).toBe(true);
    expect(has(tree, 'rec-grade-3')).toBe(true); // 이OO(동의)
    expect(has(tree, 'rec-grade-4')).toBe(false); // 장OO(미동의)
    expect(has(tree, 'rec-grade-5')).toBe(true);
    expect(has(tree, 'rec-grade-5-text')).toBe(false);
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
  test('구독자 + 동의한 상대: NV55 + 배지 그림 + NV81 + NV85 + 한계 문구(C6)', async () => {
    const { tree } = await openCandidate('shopsub', 'demo-cand-1');
    expect(textOf(tree, 'candidate-grade-text')).toBe('9단계 중 2등급 · 이분 나이대 기준이에요.');
    expect(textOf(tree, 'candidate-grade-direction')).toBe('숫자가 작을수록 계산 점수가 높은 쪽이에요.');
    expect(textOf(tree, 'candidate-grade-notlife')).toBe('등급은 이분의 인생을 대변하지 않아요.');
    expect(textOf(tree, 'candidate-grade-limits')).toBe(GRADE16.limits);
    expect(tree.root.findAll((n) => n.props.testID === 'candidate-grade-badge-image').length + tree.root.findAll((n) => n.props.testID === 'candidate-grade-badge').length).toBeGreaterThan(0);
    expect(has(tree, 'candidate-grade-subscribe')).toBe(false); // 구독자에게 NV47 은 없다
    // 박스 '왜 추천했나요'의 둘째 문장은 점수 말 하나뿐, 등급 말이 아니다
    expect(textOf(tree, 'candidate-why-note')).toBe('추천 점수는 보여주지 않아요.');
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
