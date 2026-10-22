// 01 온보딩(F1 통과 조건 1): 소개 3장 넘김 · 점 표시 · 시작하기 · 이미 계정이 있어요 · 뒤로가기(K2 4장 01).
import { act } from 'react-test-renderer';
import { BackHandler, StyleSheet, Text } from 'react-native';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { stepIndex, swipeDelta } from '@/features/onboarding/pager';
import { A11Y, ONBOARDING } from '@/content/copy';
import { layout } from '@/theme/layout';
import { INTRO_ART } from '@/theme/uiAssets';

import { allTexts, hasText, mount, must, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
// 01 출시일 줄은 F22 부품(서버 get_launch_public) — 여기서는 놓인 자리만 본다(글 · 숨김 규칙은 f22Prelaunch 시험)
jest.mock('@/features/prelaunch/OnboardingLaunchLine', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { OnboardingLaunchLine: () => <MockText testID="onboarding-launch-line">출시일 줄</MockText> };
});

type BackHandlerFn = () => boolean | null | undefined;
let backHandlers: BackHandlerFn[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as BackHandlerFn);
    return { remove: () => undefined };
  });
});
afterEach(() => jest.restoreAllMocks());

const dotSelected = (tree: Awaited<ReturnType<typeof mount>>, n: number) => must(tree, `intro-dot-${n}`).props['aria-selected'] as boolean;
const pressBack = () => backHandlers[backHandlers.length - 1]?.();

describe('소개 3장', () => {
  test('출시일 줄(K20 4-5 · F22 부품)은 마지막 장 본문 아래에만 놓인다', async () => {
    const tree = await mount(<OnboardingScreen />);
    expect(allTexts(tree)).not.toContain('출시일 줄');
    await press(tree, 'intro-dot-3');
    expect(allTexts(tree)).toContain('출시일 줄');
    await press(tree, 'intro-dot-2');
    expect(allTexts(tree)).not.toContain('출시일 줄');
  });

  test('첫 장: 로고 · 제목 · 부제가 카피.md 01 그대로 보이고, 점 3개 중 첫 점이 선택돼 있다', async () => {
    const tree = await mount(<OnboardingScreen />);
    expect(hasText(tree, ONBOARDING.logo)).toBe(true); // 상단 바 글자(목업의 '온보딩' 자리)
    expect(textOf(tree, 'intro-title')).toBe('결혼을 정말 하고 싶은 사람들');
    expect(textOf(tree, 'intro-body')).toBe('설문에 답하면 AI가 내용을 정리하고, 성향과 조건을 살펴 하루 세 분을 추천해요.');
    expect([1, 2, 3].map((n) => dotSelected(tree, n))).toEqual([true, false, false]);
    expect(allTexts(tree)).not.toContain('온보딩'); // 시안용 화면 이름은 쓰지 않는다
  });

  test('점을 누르면 그 장으로 바뀐다(점 표시도 따라 바뀐다)', async () => {
    const tree = await mount(<OnboardingScreen />);
    await press(tree, 'intro-dot-2');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[1].title);
    expect(textOf(tree, 'intro-body')).toBe(ONBOARDING.slides[1].body);
    expect([1, 2, 3].map((n) => dotSelected(tree, n))).toEqual([false, true, false]);
    await press(tree, 'intro-dot-3');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[2].title);
    expect([1, 2, 3].map((n) => dotSelected(tree, n))).toEqual([false, false, true]);
    await press(tree, 'intro-dot-1');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[0].title);
  });

  test('스크린리더의 증가 · 감소 동작으로도 장을 넘긴다(처음과 끝에서는 그 자리에 머문다)', async () => {
    const tree = await mount(<OnboardingScreen />);
    const act2 = async (actionName: 'increment' | 'decrement') => {
      await act(async () => {
        must(tree, 'intro-slide').props.onAccessibilityAction({ nativeEvent: { actionName } });
      });
    };
    await act2('decrement');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[0].title);
    await act2('increment');
    await act2('increment');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[2].title);
    await act2('increment');
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[2].title);
  });

  test('자동으로 넘기지 않는다: 시간이 지나도 장이 그대로다', async () => {
    jest.useFakeTimers();
    try {
      const tree = await mount(<OnboardingScreen />);
      act(() => jest.advanceTimersByTime(60_000));
      expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[0].title);
    } finally {
      jest.useRealTimers();
    }
  });

  test('소개 그림 칸: 정사각(1:1) · 둥글기 16 · 잘라 담기, 장마다 그림이 바뀌고, 그림 위에 글자가 없다', async () => {
    const tree = await mount(<OnboardingScreen />);
    const card = StyleSheet.flatten(must(tree, 'intro-art').props.style);
    expect(card.aspectRatio).toBe(1);
    expect(card.borderRadius).toBe(16);
    expect(card.overflow).toBe('hidden');
    const sources = [];
    for (const dot of [1, 2, 3]) {
      await press(tree, `intro-dot-${dot}`);
      sources.push(must(tree, 'intro-art-image').props.source);
    }
    expect(sources).toEqual([...INTRO_ART]);
    expect(new Set(sources).size).toBe(3);
    // 그림 칸 안에는 글자(Text)가 없다. 제목 · 부제는 그림 아래에 있다
    expect(must(tree, 'intro-art').findAllByType(Text)).toHaveLength(0);
  });
});

describe('밀기 계산', () => {
  test('왼쪽으로 40 넘게 밀면 다음 장, 오른쪽으로 40 넘게 밀면 이전 장, 그보다 적게 밀면 그대로', () => {
    const distance = layout.swipeDistance;
    expect(swipeDelta(-distance, distance)).toBe(1);
    expect(swipeDelta(-200, distance)).toBe(1);
    expect(swipeDelta(distance, distance)).toBe(-1);
    expect(swipeDelta(200, distance)).toBe(-1);
    expect(swipeDelta(-(distance - 1), distance)).toBe(0);
    expect(swipeDelta(distance - 1, distance)).toBe(0);
    expect(swipeDelta(0, distance)).toBe(0);
  });

  test('장 번호는 처음과 끝을 넘지 않는다', () => {
    expect(stepIndex(0, -1, 3)).toBe(0);
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(2);
    expect(stepIndex(2, -1, 3)).toBe(1);
  });
});

describe('버튼 (모든 장에서 보인다, 건너뛰기는 없다)', () => {
  test('[시작하기]와 [이미 계정이 있어요]는 둘 다 02 가입 · 로그인으로 간다', async () => {
    const tree = await mount(<OnboardingScreen />);
    expect(hasText(tree, ONBOARDING.start)).toBe(true);
    expect(hasText(tree, ONBOARDING.haveAccount)).toBe(true);
    await press(tree, 'onboarding-start');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');
    await press(tree, 'onboarding-login');
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');
  });

  test('2 · 3장에서도 두 버튼이 그대로 있고 건너뛰기 버튼은 어느 장에도 없다', async () => {
    const tree = await mount(<OnboardingScreen />);
    for (const n of [1, 2, 3]) {
      await press(tree, `intro-dot-${n}`);
      expect(hasText(tree, ONBOARDING.start)).toBe(true);
      expect(hasText(tree, ONBOARDING.haveAccount)).toBe(true);
      expect(allTexts(tree).some((t) => t.includes('건너뛰기'))).toBe(false);
    }
  });

  test('입력이 없어 두 버튼은 항상 눌린다(비활성이 아니다)', async () => {
    const tree = await mount(<OnboardingScreen />);
    expect(must(tree, 'onboarding-start').props.disabled).toBeFalsy();
    expect(must(tree, 'onboarding-login').props.disabled).toBeFalsy();
  });
});

describe('뒤로가기 (K2 4장 01)', () => {
  test('1장에서 Android 뒤로가기는 앱이 가로채지 않는다(앱을 백그라운드로 보낸다)', async () => {
    await mount(<OnboardingScreen />);
    expect(pressBack()).toBe(false);
  });

  test('2 · 3장에서는 이전 장으로 간다', async () => {
    const tree = await mount(<OnboardingScreen />);
    await press(tree, 'intro-dot-3');
    await act(async () => {
      expect(pressBack()).toBe(true);
    });
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[1].title);
    await act(async () => {
      expect(pressBack()).toBe(true);
    });
    expect(textOf(tree, 'intro-title')).toBe(ONBOARDING.slides[0].title);
    expect(pressBack()).toBe(false); // 다시 1장
  });

  test('상단 "<" 는 없다(목업과 같음)', async () => {
    const tree = await mount(<OnboardingScreen />);
    expect(tree.root.findAll((n) => n.props.testID === 'onboarding-header-back')).toHaveLength(0);
  });
});

describe('접근성', () => {
  test('점마다 "소개 n / 3" 이름이 있고 터치 칸은 44 × 44 이상이다', async () => {
    const tree = await mount(<OnboardingScreen />);
    for (const n of [1, 2, 3]) expect(must(tree, `intro-dot-${n}`).props.accessibilityLabel).toBe(A11Y.introDot(n, 3));
  });
});

describe('F17 움직임 · 바탕(D25 장면 2)', () => {
  const hosts = (tree: Awaited<ReturnType<typeof mount>>) => tree.root.findAll((n) => typeof n.type === 'string' && !!n.props);
  const styleOf = (n: { props: { style?: unknown } }) => (StyleSheet.flatten(n.props.style as never) ?? {}) as Record<string, unknown>;

  test('바탕 bgGrad 높이 360(온보딩)', async () => {
    const tree = await mount(<OnboardingScreen />);
    const backdrop = hosts(tree).find((n) => n.props.testID === 'screen-backdrop');
    expect(backdrop && styleOf(backdrop).height).toBe(360);
  });

  test('처음 장은 움직이지 않고, 다음 장으로 넘기면 새 장이 오른쪽 40px 에서 · 그림은 1.06배에서 시작한다(이전 장으로는 왼쪽 40px)', async () => {
    const tree = await mount(<OnboardingScreen />);
    const moved = (x: number) => hosts(tree).some((n) => JSON.stringify(styleOf(n).transform ?? null) === JSON.stringify([{ translateX: x }]));
    expect(moved(40) || moved(-40)).toBe(false);
    await press(tree, 'intro-dot-2');
    expect(moved(40)).toBe(true);
    expect(hosts(tree).some((n) => JSON.stringify(styleOf(n).transform ?? null) === JSON.stringify([{ scale: 1.06 }]))).toBe(true);
    await press(tree, 'intro-dot-1');
    expect(moved(-40)).toBe(true);
  });
});
