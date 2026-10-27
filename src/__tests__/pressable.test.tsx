// 공통 Pressable 이 누르는 효과 규격(2안 '지면' D42-M 명세 4-1 press · 5-3 · 7장, 앱 적용 D-176)을 지키는지 확인한다.
//  ① scale  누르면 0.985배(버튼 · 카드) · 0.92배(아이콘) 100ms std → 떼면 1배 200ms edOut
//  ② 덮개   text 색 6% 덮개가 투명도 0 → 1 로 100ms, 떼면 200ms 로 0. 퍼지는 물결은 지웠다
//  동작 줄이기: scale · 내려감 없음 · 덮개(투명도)만 / 비활성: 40%
//  어느 요소에 무엇을: both(크기 + 덮개) · ripple(덮개만, 탭 칸) · scale(크기만) · none
// 애니메이션은 실제로 돌리지 않고 Animated.timing 에 넘긴 값만 본다. 눈으로 보는 확인은 에뮬레이터나 실기기에서 한다(미확인).
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { Pressable, type PressEffect } from '@/components/Pressable';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { rippleColor, withAlpha } from '@/theme/color';
import { press } from '@/theme/motion';
import { alpha, colors } from '@/theme/tokens';

const INK_6 = withAlpha(colors.text, 0.06);
const ROSE_20 = withAlpha(colors.accent, 0.2);
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
  props: { effect?: PressEffect; surface?: 'light' | 'accent'; disabled?: boolean; systemRipple?: boolean; scaleTo?: 'button' | 'card' | 'icon'; clip?: boolean } = {},
) => (
  <Pressable {...props}>
    <Text>확인</Text>
  </Pressable>
);

const target = (tree: ReactTestRenderer) =>
  tree.root.findAll((node) => node !== tree.root && typeof node.props.onPressIn === 'function')[0];
const pressIn = (tree: ReactTestRenderer) => act(async () => target(tree).props.onPressIn(fakeEvent));
const pressOut = (tree: ReactTestRenderer) => act(async () => target(tree).props.onPressOut(fakeEvent));

const calls = (toValue: number, duration: number) =>
  timing.mock.calls.filter(([, config]) => config.toValue === toValue && config.duration === duration);
const overlayStyle = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(View)
    .map((node) => StyleSheet.flatten(node.props.style))
    .find((style) => style?.position === 'absolute' && style?.backgroundColor === INK_6);

describe('토큰 값(theme/motion press)', () => {
  test('2안 명세 4-1 의 숫자와 같다', () => {
    expect(press).toEqual({ button: 0.985, card: 0.985, icon: 0.92, overlay: 0.06, downMs: 100, upMs: 200 });
  });
});

describe('① scale', () => {
  test('누르면 0.985배 100ms(std), 떼면 1배 200ms(edOut)', async () => {
    const tree = await mount(button());
    await pressIn(tree);
    const down = calls(0.985, 100);
    expect(down).toHaveLength(1);
    expect(down[0][0]).toBeInstanceOf(Animated.Value);
    expect(down[0][1].easing(0.5)).toBeGreaterThan(0.5);
    await pressOut(tree);
    expect(calls(1, 200).length).toBeGreaterThanOrEqual(1);
  });

  test('아이콘은 0.92배', async () => {
    const tree = await mount(button({ scaleTo: 'icon' }));
    await pressIn(tree);
    expect(calls(0.92, 100)).toHaveLength(1);
  });

  test("'동작 줄이기'를 켜면 크기를 바꾸지 않는다(덮개만)", async () => {
    const tree = await mount(button());
    await act(async () => reduceMotionStore.set(true));
    await pressIn(tree);
    await pressOut(tree);
    expect(calls(0.985, 100)).toHaveLength(0);
    expect(calls(1, 100)).toHaveLength(1); // 덮개 투명도 0 → 1
    expect(calls(0, 200)).toHaveLength(1); // 덮개 → 0
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
    // QP-14: 웹에서 포커스를 놓으려고 감싸 넘기므로 같은 함수가 아니라, 부르면 원래 함수가 한 번 불리는지 본다
    act(() => target(tree).props.onPress({ nativeEvent: {} }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});

describe('② 눌림 덮개(물결 대신)', () => {
  test('요소를 다 덮는 text 6% 덮개가 내용 위에 있고, 누르면 100ms 로 나타나고 떼면 200ms 로 사라진다', async () => {
    const tree = await mount(button());
    expect(target(tree).props.android_ripple).toBeUndefined();
    const lid = overlayStyle(tree);
    expect(lid).toMatchObject({ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: INK_6 });
    await pressIn(tree);
    expect(calls(1, 100)).toHaveLength(1);
    await pressOut(tree);
    expect(calls(0, 200)).toHaveLength(1);
  });

  test('퍼지는 원(물결)은 없다', async () => {
    const tree = await mount(button());
    const round = tree.root.findAllByType(View).map((n) => StyleSheet.flatten(n.props.style)).filter((st) => typeof st?.borderRadius === 'number' && st?.position === 'absolute');
    expect(round).toHaveLength(0);
  });

  test('systemRipple 을 주면 Android 에서만 시스템 ripple 을 쓰고 덮개는 그리지 않는다', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const system = await mount(button({ systemRipple: true }));
    expect(target(system).props.android_ripple).toEqual({ color: rippleColor('light'), borderless: false });
    expect(rippleColor('light')).toBe(ROSE_20);
    expect(overlayStyle(system)).toBeUndefined();
  });

  test('자르지 않는 요소(clip=false, 버튼 v3)는 덮개가 밖으로 나가지 않게 덮개를 그리지 않는다', async () => {
    const tree = await mount(button({ clip: false }));
    expect(overlayStyle(tree)).toBeUndefined();
  });
});

describe('어느 요소에 무엇을', () => {
  const run = async (effect: PressEffect) => {
    const tree = await mount(button({ effect }));
    await pressIn(tree);
    await pressOut(tree);
    return { scale: calls(0.985, 100).length > 0, overlay: overlayStyle(tree) !== undefined };
  };

  test('both 는 크기 + 덮개', async () => {
    expect(await run('both')).toEqual({ scale: true, overlay: true });
  });
  test('ripple(탭 칸)은 크기를 바꾸지 않고 덮개만', async () => {
    expect(await run('ripple')).toEqual({ scale: false, overlay: true });
  });
  test('scale 은 덮개 없이 크기만', async () => {
    expect(await run('scale')).toEqual({ scale: true, overlay: false });
  });
  test('none 은 아무 효과가 없다', async () => {
    expect(await run('none')).toEqual({ scale: false, overlay: false });
    expect(timing).not.toHaveBeenCalled();
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
