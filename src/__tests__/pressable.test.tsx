// 공통 Pressable 이 누르는 효과 규격(디자인/가이드.md 10장, D10)을 지키는지 확인한다.
//  ① scale  누르면 0.97배(카드 0.985배) 100ms → 떼면 1배 100ms (std, 가이드 13장 · F17)
//  ② ripple 가운데서 지름 0 → 대각선 250ms, 다 퍼지고 손가락도 뗀 뒤 150ms 동안 사라짐, 20%(주 버튼 위는 흰색)
//  동작 줄이기: scale 없음 · ripple 크기 변화 없이 투명도만(75ms 나타남 · 75ms 사라짐, D-124) · 농도 그대로 / 비활성: 40%
//  어느 요소에 무엇을(10-3): both · ripple(탭) · scale(카드) · none
// 애니메이션은 실제로 돌리지 않고 Animated.timing 에 넘긴 값만 본다. 눈으로 보는 확인은 에뮬레이터나 실기기에서 한다(미확인).
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { Pressable, type PressEffect } from '@/components/Pressable';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { rippleColor, withAlpha } from '@/theme/color';
import { alpha, colors, motion } from '@/theme/tokens';

// 가이드 1-1: ripple = 장미 또는 흰색 × 20%. 토큰 색에 20%를 곱한 값과 같아야 한다.
const ROSE_20 = withAlpha(colors.accent, 0.2);
const WHITE_20 = withAlpha(colors.onAccent, 0.2);
const fakeEvent = { nativeEvent: { layout: { width: 200, height: 48 } } } as never;

let timing: jest.SpyInstance;

beforeEach(() => {
  timing = jest.spyOn(Animated, 'timing').mockImplementation(
    () => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }) as unknown as Animated.CompositeAnimation,
  );
  act(() => reduceMotionStore.set(false));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const button = (
  props: { effect?: PressEffect; surface?: 'light' | 'accent'; disabled?: boolean; systemRipple?: boolean } = {},
) => (
  <Pressable {...props}>
    <Text>확인</Text>
  </Pressable>
);

// 공통 Pressable 이 react-native 에 넘긴 값을 보려고, 뿌리(공통 Pressable 자신)를 뺀 첫 누름 요소를 고른다
const target = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node !== tree.root && typeof node.props.onPressIn === 'function')[0];
const pressIn = (tree: ReactTestRenderer) => act(async () => target(tree).props.onPressIn(fakeEvent));
const pressOut = (tree: ReactTestRenderer) => act(async () => target(tree).props.onPressOut(fakeEvent));
const layout = (tree: ReactTestRenderer) => act(async () => target(tree).props.onLayout(fakeEvent));

// Animated.timing 호출 중 (값, 설정)을 고른다
const calls = (toValue: number, duration: number) =>
  timing.mock.calls.filter(([, config]) => config.toValue === toValue && config.duration === duration);
const circleStyle = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(View)
    .map((node) => StyleSheet.flatten(node.props.style))
    .find((style) => style?.position === 'absolute');

describe('토큰 값(가이드 8장 motion · alpha.ripple)', () => {
  test('가이드 10-2 · 13장(F17)의 숫자와 같다', () => {
    expect(motion).toMatchObject({ pressScale: 0.97, pressScaleCard: 0.985, pressInMs: 100, pressOutMs: 100, rippleSpreadMs: 250, rippleFadeMs: 150 });
    expect(motion.easeOut).toEqual([0, 0, 0.58, 1]);
    expect(motion.pressEase).toEqual([0.4, 0, 0.2, 1]);
    expect(motion.reduced).toEqual({ pressScale: 1, rippleMs: 75, fadeMs: 150 });
    expect(alpha.ripple).toBe(0.2);
  });

  test('퍼지는 색: 밝은 면 위는 장미 20%, 면이 장미인 요소(주 버튼)는 흰색 20%', () => {
    expect(rippleColor('light')).toBe(ROSE_20);
    expect(rippleColor('accent')).toBe(WHITE_20);
  });
});

describe('① scale', () => {
  test('누르면 0.97배 100ms, 떼면 1배 100ms 이고 std 곡선을 쓴다(13장)', async () => {
    const tree = await mount(button());

    await pressIn(tree);
    const down = calls(0.97, 100);
    expect(down).toHaveLength(1);
    expect(down[0][0]).toBeInstanceOf(Animated.Value);
    expect(typeof down[0][1].easing).toBe('function');
    expect(down[0][1].easing(0.5)).toBeGreaterThan(0.5); // std 도 가운데에서 절반을 넘는다

    await pressOut(tree);
    expect(calls(1, 100)).toHaveLength(1);
  });

  test("'동작 줄이기'를 켜면 크기를 바꾸지 않는다", async () => {
    const tree = await mount(button());
    await act(async () => reduceMotionStore.set(true));

    await pressIn(tree);
    await pressOut(tree);

    expect(calls(0.97, 100)).toHaveLength(0);
    expect(calls(1, 100)).toHaveLength(0);
  });

  test('누른 손가락 처리는 그대로 넘긴다(onPress · onPressIn · onPressOut)', async () => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    const tree = await mount(
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Text>확인</Text>
      </Pressable>,
    );
    await pressIn(tree);
    await pressOut(tree);
    expect(target(tree).props.onPress).toBe(onPress);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});

describe('② ripple (iOS · 웹: 가운데서 퍼지는 원)', () => {
  test('android_ripple 없이 요소 가운데에 대각선 지름의 원이 있고 색은 장미 20%다', async () => {
    expect(Platform.OS).toBe('ios'); // jest-expo 기본
    const tree = await mount(button());
    expect(target(tree).props.android_ripple).toBeUndefined();

    await layout(tree); // 원의 크기는 요소 크기에서 나온다
    const circle = circleStyle(tree);
    const diagonal = Math.hypot(200, 48);
    expect(circle?.backgroundColor).toBe(ROSE_20);
    expect(circle?.width).toBeCloseTo(diagonal);
    expect(circle?.height).toBeCloseTo(diagonal);
    expect(circle?.left).toBeCloseTo((200 - diagonal) / 2); // 가운데
    expect(circle?.top).toBeCloseTo((48 - diagonal) / 2);
  });

  test('면이 장미인 요소(surface="accent")는 흰색 20%다', async () => {
    const tree = await mount(button({ surface: 'accent' }));
    await layout(tree);
    expect(circleStyle(tree)?.backgroundColor).toBe(WHITE_20);
  });

  test('누르면 250ms 동안 0 → 1 로 퍼진다', async () => {
    const tree = await mount(button());
    await pressIn(tree);
    expect(calls(1, 250)).toHaveLength(1);
  });

  test('다 퍼지고 손가락도 뗀 뒤 150ms 동안 사라진다: 빨리 떼면 퍼짐이 끝날 때까지 기다린다', async () => {
    const now = jest.spyOn(Date, 'now');
    const tree = await mount(button());

    now.mockReturnValue(1000);
    await pressIn(tree);
    now.mockReturnValue(1100); // 100ms 만에 뗌 → 퍼짐이 150ms 남았다
    await pressOut(tree);
    const quick = timing.mock.calls.find(([, config]) => config.toValue === 0 && config.duration === 150);
    expect(quick?.[1].delay).toBe(150);

    timing.mockClear();
    now.mockReturnValue(2000);
    await pressIn(tree);
    now.mockReturnValue(2600); // 600ms 눌렀다 뗌 → 퍼짐은 이미 끝났다
    await pressOut(tree);
    const slow = timing.mock.calls.find(([, config]) => config.toValue === 0 && config.duration === 150);
    expect(slow?.[1].delay).toBe(0);
  });

  test("'동작 줄이기'(D-124): 원은 크기가 변하지 않고 투명도만 75ms 나타남 · 75ms 사라짐(합 150 이하), 농도는 그대로다", async () => {
    const tree = await mount(button());
    await act(async () => reduceMotionStore.set(true));
    await layout(tree);

    await pressIn(tree);
    expect(calls(1, 75)).toHaveLength(1); // 투명도 0 → 1, 75ms
    expect(timing.mock.calls.filter(([, config]) => config.toValue !== 1 && config.toValue !== 0)).toHaveLength(0); // 크기(0.5 · 0.97 등)로 가는 움직임 없음
    const grown = (circleStyle(tree)?.transform as { scale: number | { __getValue: () => number } }[] | undefined)?.[0]?.scale;
    expect(typeof grown === 'number' ? grown : grown?.__getValue()).toBe(1); // 처음부터 다 덮는 크기
    await pressOut(tree);
    expect(calls(0, 75)).toHaveLength(1); // 사라지는 데 75ms
    expect(circleStyle(tree)?.backgroundColor).toBe(ROSE_20); // 20% 그대로
  });
});

describe('② ripple (Android: 기본은 iOS · 웹과 같은 가운데서 퍼지는 원)', () => {
  test('Android 도 android_ripple 없이 가운데서 퍼지는 원을 그린다(팀장 결정 2026-10-14)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const tree = await mount(button());
    expect(target(tree).props.android_ripple).toBeUndefined();
    await layout(tree);
    const circle = circleStyle(tree);
    expect(circle?.backgroundColor).toBe(ROSE_20);
    expect(circle?.left).toBeCloseTo((200 - Math.hypot(200, 48)) / 2); // 가운데
    await pressIn(tree);
    expect(calls(1, 250)).toHaveLength(1); // iOS 와 같은 250ms 퍼짐
    await pressOut(tree);
    expect(calls(0, 150)).toHaveLength(1); // 150ms 사라짐
  });

  test('Android 의 주 버튼(surface="accent")도 흰색 20%다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const tree = await mount(button({ surface: 'accent' }));
    await layout(tree);
    expect(circleStyle(tree)?.backgroundColor).toBe(WHITE_20);
  });

  test('systemRipple 을 주면 Android 에서만 시스템 ripple(경계 안, 20%)을 쓰고 원은 그리지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const system = await mount(button({ systemRipple: true }));
    expect(target(system).props.android_ripple).toEqual({ color: ROSE_20, borderless: false });
    expect(circleStyle(system)).toBeUndefined();

    jest.replaceProperty(Platform, 'OS', 'ios'); // iOS 에서는 무시한다
    const ios = await mount(button({ systemRipple: true }));
    expect(target(ios).props.android_ripple).toBeUndefined();
    await layout(ios);
    expect(circleStyle(ios)).toBeDefined();
  });
});

describe('어느 요소에 무엇을(가이드 10-3)', () => {
  const run = async (effect: PressEffect) => {
    const tree = await mount(button({ effect }));
    await layout(tree);
    await pressIn(tree);
    await pressOut(tree);
    return { scale: calls(0.97, 100).length > 0 || calls(0.985, 100).length > 0, circle: circleStyle(tree) !== undefined };
  };

  test('both(기본 버튼)는 scale 과 ripple 둘 다', async () => {
    expect(await run('both')).toEqual({ scale: true, circle: true });
  });
  test('ripple(탭 칸)은 크기를 바꾸지 않고 원만 퍼진다', async () => {
    expect(await run('ripple')).toEqual({ scale: false, circle: true });
  });
  test('scale(카드)은 원 없이 크기만 바뀐다', async () => {
    expect(await run('scale')).toEqual({ scale: true, circle: false });
  });
  test('none(그 밖의 요소)은 아무 효과가 없다', async () => {
    expect(await run('none')).toEqual({ scale: false, circle: false });
    expect(timing).not.toHaveBeenCalled();
  });
  test('Android 에서도 같다: scale · none 은 원이 없고, 시스템 ripple 을 골라도 scale · none 에는 붙지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    for (const effect of ['scale', 'none'] as const) {
      const tree = await mount(button({ effect, systemRipple: true }));
      await layout(tree);
      expect(target(tree).props.android_ripple).toBeUndefined();
      expect(circleStyle(tree)).toBeUndefined();
    }
    const tab = await mount(button({ effect: 'ripple', systemRipple: true }));
    expect(target(tab).props.android_ripple).toEqual({ color: ROSE_20, borderless: false });
  });
});

describe('모양', () => {
  test('눌린 동안의 모양을 함수로 줄 수 있다', async () => {
    const tree = await mount(
      <Pressable style={({ pressed }) => ({ backgroundColor: pressed ? 'white' : 'black' })}>
        <Text>확인</Text>
      </Pressable>,
    );
    const color = () => StyleSheet.flatten(target(tree).props.style)?.backgroundColor;
    expect(color()).toBe('black');
    await pressIn(tree);
    expect(color()).toBe('white');
    await pressOut(tree);
    expect(color()).toBe('black');
  });

  test('비활성이면 전체 40%이고 누를 수 없다고 알린다', async () => {
    const tree = await mount(button({ disabled: true }));
    const flat = StyleSheet.flatten(target(tree).props.style);
    expect(flat?.opacity).toBe(alpha.disabled);
    expect(target(tree).props.disabled).toBe(true);
  });

  test('둥근 모서리 안으로 효과를 자르고, 기본 접근성 역할은 button 이다', async () => {
    const tree = await mount(button());
    expect(StyleSheet.flatten(target(tree).props.style)?.overflow).toBe('hidden');
    expect(target(tree).props.accessibilityRole).toBe('button');
  });
});
