// 06 AI 정리 중 화면(F3 통과 조건 1 · 2 · 6): 상태 읽기(3초) · 평균 대기 안내 · 60초 안내 · 120초 실패 · 실패 + 다시 시도 + 직접 입력 · 등급 · 점수 0
import { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';

import { ANALYSIS, COMMON } from '@/content/copy';
import { AnalysisScreen } from '@/features/ai/AnalysisScreen';
import { manualOfferStore } from '@/features/ai/manualOffer';
import type { AnalysisDeps } from '@/features/ai/useAnalysis';
import type { LoadLatest, RunOutcome } from '@/lib/aiApi';
import type { AiRow } from '@/types/ai';

import { allTexts, has, hasText, mount, must, press } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: jest.fn() }) } }));
jest.mock('@/lib/services', () => ({ likesApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(30_000);

const row = (over: Partial<AiRow> = {}): AiRow => ({ id: 'r1', status: 'pending', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: null, original: null, edited: null, ...over });
const ok = (r: AiRow | null): LoadLatest => ({ ok: true, row: r });

function setup(first: LoadLatest, extra: Partial<AnalysisDeps['api']> = {}) {
  const clock = { now: 1_000_000 };
  const loadLatest = jest.fn<Promise<LoadLatest>, []>(async () => first);
  const retry = jest.fn<Promise<RunOutcome>, [string]>(() => new Promise(() => undefined));
  const start = jest.fn<Promise<RunOutcome>, []>(async () => ({ kind: 'pending', resultId: null }));
  const setStage = jest.fn();
  const deps: AnalysisDeps = { api: { loadLatest, retry, start, ...extra }, now: () => clock.now, setStage };
  const pass = async (ms: number) => {
    clock.now += ms;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });
  };
  return { deps, loadLatest, retry, start, setStage, pass, clock };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  manualOfferStore.clear();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('처리 중 (조건 1)', () => {
  test('제목 · 부제(1분쯤 걸려요) · AI 이용 고지 · 단계 글이 카피.md 06 그대로 보이고, 오래 걸림 안내 · 다시 시도는 없다', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    expect(hasText(tree, ANALYSIS.headerTitle)).toBe(true);
    expect(hasText(tree, ANALYSIS.title)).toBe(true);
    expect(hasText(tree, ANALYSIS.subtitle)).toBe(true);
    expect(hasText(tree, ANALYSIS.aiNotice)).toBe(true);
    expect(allTexts(tree).filter((t) => ANALYSIS.steps.includes(t as never)).length).toBe(3); // 정리 · 성향 파악 · 중요도 제안
    expect(has(tree, 'analysis-slow')).toBe(false);
    expect(has(tree, 'analysis-retry')).toBe(false);
    expect(has(tree, 'analysis-header-back')).toBe(false); // 상단 바에 ‹ 없음
    // F21: 진행 막대는 공통 ProgressBar — 역할은 안쪽 그려진 요소에 있다
    expect(tree.root.findAll((n) => typeof n.type === 'string' && n.props.testID === 'analysis-progress')[0].props.accessibilityRole).toBe('progressbar');
  });

  test('상태를 3초 간격으로 읽는다', async () => {
    const s = setup(ok(row()));
    await mount(<AnalysisScreen deps={s.deps} />);
    expect(s.loadLatest).toHaveBeenCalledTimes(1);
    await s.pass(3000);
    expect(s.loadLatest).toHaveBeenCalledTimes(2);
    await s.pass(6000);
    expect(s.loadLatest).toHaveBeenCalledTimes(4);
  });

  test('단계 글은 시간에 맞춰 진해지는 단계가 바뀐다(0~20초 정리 · 20~40초 성향 파악 · 40초 뒤 중요도 제안)', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    const stepVariants = () => tree.root.findAll((n) => n.props.testID === 'analysis-steps')[0];
    expect(stepVariants()).toBeDefined();
    await s.pass(25_000);
    expect(must(tree, 'analysis-progress').props.accessibilityLabel).toContain(ANALYSIS.steps[1]);
    await s.pass(20_000);
    expect(must(tree, 'analysis-progress').props.accessibilityLabel).toContain(ANALYSIS.steps[2]);
  });

  test('60초가 되기 전에는 안내가 없고, 60초가 넘으면 카피.md 06 의 "평소보다 오래 걸리고 있어요…" 가 나온다', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await s.pass(59_000);
    expect(has(tree, 'analysis-slow')).toBe(false);
    await s.pass(2_000);
    expect(has(tree, 'analysis-slow')).toBe(true);
    expect(hasText(tree, ANALYSIS.slow)).toBe(true);
  });

  test('끝났으면(ok) 07 로 간다', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    s.loadLatest.mockResolvedValue(ok(row({ status: 'ok' })));
    await s.pass(3000);
    expect(mockRouter.replace).toHaveBeenCalledWith('/traits');
    expect(has(tree, 'analysis-retry')).toBe(false);
    expect(s.setStage).toHaveBeenCalledWith('traits-pending');
  });

  test('앱을 다시 열었을 때 이미 끝나 있으면 바로 07 로 간다', async () => {
    const s = setup(ok(row({ status: 'ok' })));
    await mount(<AnalysisScreen deps={s.deps} />);
    expect(mockRouter.replace).toHaveBeenCalledWith('/traits');
  });

  test('연결이 끊기면 처리 중 화면은 그대로 두고 인터넷 안내를 보이며, 돌아오면 이어간다', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    s.loadLatest.mockResolvedValue({ ok: false, reason: 'network' });
    await s.pass(3000);
    expect(hasText(tree, COMMON.offline)).toBe(true);
    expect(has(tree, 'analysis-title')).toBe(true);
    s.loadLatest.mockResolvedValue(ok(row()));
    await s.pass(3000);
    expect(has(tree, 'analysis-offline')).toBe(false);
  });

  test('건이 하나도 없으면 정리를 시작한다', async () => {
    const s = setup(ok(null));
    await mount(<AnalysisScreen deps={s.deps} />);
    expect(s.start).toHaveBeenCalledTimes(1);
  });

  test('120초 안에 결과가 없으면 실패로 보고 오류 상태 + 다시 시도', async () => {
    const s = setup(ok(row()));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await s.pass(119_000);
    expect(has(tree, 'analysis-retry')).toBe(false);
    await s.pass(2_000);
    expect(has(tree, 'analysis-retry')).toBe(true);
    expect(hasText(tree, ANALYSIS.failTitle)).toBe(true);
  });
});

describe('실패 (조건 2)', () => {
  test('오류 상태: 제목 · 본문 · [다시 시도]가 카피 그대로, 1번째 실패에는 [직접 입력하기]가 없다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 0 })));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    expect(hasText(tree, ANALYSIS.failTitle)).toBe(true);
    expect(hasText(tree, ANALYSIS.failBody)).toBe(true);
    expect(hasText(tree, ANALYSIS.retry)).toBe(true);
    expect(has(tree, 'analysis-manual')).toBe(false);
    expect(has(tree, 'analysis-title')).toBe(false);
    expect(s.setStage).toHaveBeenCalledWith('ai-failed');
  });

  test('[다시 시도]: 서버에 다시 시도를 부르고 처리 중 화면으로 돌아간다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 0 })));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await press(tree, 'analysis-retry');
    expect(s.retry).toHaveBeenCalledTimes(1);
    expect(s.retry).toHaveBeenCalledWith('r1');
    expect(has(tree, 'analysis-title')).toBe(true);
    expect(has(tree, 'analysis-retry')).toBe(false);
  });

  test('눌린 뒤 3초 동안은 다시 눌러도 요청이 늘지 않는다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 0 })));
    s.retry.mockResolvedValue({ kind: 'failed', info: { stage: 2, retriesLeft: 2, showRetry: true, showManual: false, manual: null } });
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await press(tree, 'analysis-retry');
    await s.pass(10);
    await press(tree, 'analysis-retry'); // 곧바로 실패해 버튼이 돌아왔지만 3초 안이다
    expect(s.retry).toHaveBeenCalledTimes(1);
    await s.pass(3000);
    await press(tree, 'analysis-retry');
    expect(s.retry).toHaveBeenCalledTimes(2);
  });

  test('다시 시도가 3번째 실패로 끝나면 [직접 입력하기]와 안내(N13)가 더해진다. 누르면 07 직접 입력 상태로 가고 서버가 준 재료를 넘긴다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 1 })));
    const offer = { initialTraits: { extraversion: 30, planning: 70, family: 80, economy: 60, conflict: 70 }, tagCandidates: ['차분함', '계획적'] };
    s.retry.mockResolvedValue({ kind: 'failed', info: { stage: 3, retriesLeft: 1, showRetry: true, showManual: true, manual: offer } });
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    expect(has(tree, 'analysis-manual')).toBe(false); // 2번째 실패
    await press(tree, 'analysis-retry');
    await s.pass(10);
    expect(has(tree, 'analysis-manual')).toBe(true);
    expect(hasText(tree, ANALYSIS.manual)).toBe(true);
    expect(hasText(tree, ANALYSIS.manualNote)).toBe(true);
    expect(has(tree, 'analysis-retry')).toBe(true);
    await press(tree, 'analysis-manual');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/traits', params: { mode: 'manual' } });
    expect(manualOfferStore.get()).toEqual({ resultId: 'r1', value: offer });
  });

  test('4번째 실패에는 [다시 시도]를 감추고 [직접 입력하기]만 보인다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 3 })));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    expect(has(tree, 'analysis-retry')).toBe(false);
    expect(has(tree, 'analysis-manual')).toBe(true);
  });

  test('다시 시도 응답이 한도(limit)이면 [직접 입력하기]만 보인다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 2 })));
    s.retry.mockResolvedValue({ kind: 'limit' });
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await press(tree, 'analysis-retry');
    await s.pass(10);
    expect(has(tree, 'analysis-retry')).toBe(false);
    expect(has(tree, 'analysis-manual')).toBe(true);
  });

  test('다시 시도가 통했으면(ok) 07 로 간다', async () => {
    const s = setup(ok(row({ status: 'failed' })));
    s.retry.mockResolvedValue({ kind: 'ok', resultId: 'r1' });
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    await press(tree, 'analysis-retry');
    await s.pass(10);
    expect(mockRouter.replace).toHaveBeenCalledWith('/traits');
  });
});

describe('조건 6 · 뒤로가기', () => {
  test('화면의 모든 글에 등급 · 점수 말이 없다', async () => {
    const s = setup(ok(row({ status: 'failed', retryCount: 2 })));
    const tree = await mount(<AnalysisScreen deps={s.deps} />);
    for (const text of allTexts(tree)) expect(text).not.toMatch(/등급|점수|순위|%/);
  });

  test('Android 뒤로가기: 정리 중에는 무시하고, 오류 상태에서는 앱을 백그라운드로 보낸다', async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as () => boolean);
      return { remove: () => undefined };
    });
    const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const s = setup(ok(row()));
    await mount(<AnalysisScreen deps={s.deps} />);
    expect(handlers[handlers.length - 1]()).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    s.loadLatest.mockResolvedValue(ok(row({ status: 'failed' })));
    await s.pass(3000);
    expect(handlers[handlers.length - 1]()).toBe(true);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
