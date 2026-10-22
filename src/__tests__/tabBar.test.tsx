// 탭바(가이드 5장 · 10-1): 현재 탭 = 채움 아이콘 + 라벨 Bold 브랜드색, 나머지 = 선형 회색 아이콘 + 라벨 Regular 회색.
//  현재 탭은 한 번에 1개이고, 13 추천 없음 · 14 호감 없음에서도 추천 · 호감 탭이 켜진다.
//  탭 칸은 ripple 만 쓰고(크기 변화 없음), 눌린 동안 아이콘 · 라벨이 85%가 된다.
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import { TabBarButton } from '@/components/TabBarButton';
import { TabIcon, TabLabel } from '@/components/TabBarParts';
import { tabRouteOf } from '@/navigation/activeTab';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { TAB_ICONS, type TabIconName } from '@/theme/tabIcons';
import { alpha, colors, font } from '@/theme/tokens';

const mockPathname = jest.fn<string, []>();
jest.mock('expo-router', () => ({ usePathname: () => mockPathname() }));

const TABS: readonly { name: TabIconName; title: string }[] = [
  { name: 'recommendations', title: '추천' },
  { name: 'likes', title: '호감' },
  { name: 'shop', title: '상점' },
  { name: 'settings', title: '설정' },
];

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

describe('주소 → 켜질 탭 (13 · 14 는 부모 화면의 탭)', () => {
  test.each([
    ['/recommendations', '/recommendations'],
    ['/recommendations-empty', '/recommendations'], // 13 추천 없음 → 추천 탭
    ['/likes', '/likes'],
    ['/likes-empty', '/likes'], // 14 호감 없음 → 호감 탭
    ['/shop', '/shop'],
    ['/profile', null], // 08 내 프로필은 탭이 아니다(탭바 없음, F11)
    ['/settings', '/settings'],
    ['/settings/', '/settings'],
  ])('%s → %s', (pathname, tab) => {
    expect(tabRouteOf(pathname)).toBe(tab);
  });

  test.each(['/', '/onboarding', '/sign-in', '/sign-in-code-error', '/survey/01', '/candidate/abc', '/nowhere'])(
    '탭이 없는 화면 %s 은 켜진 탭이 없다',
    (pathname) => {
      expect(tabRouteOf(pathname)).toBeNull();
    },
  );
});

describe('아이콘 · 라벨', () => {
  const labelStyle = (tree: ReactTestRenderer) => {
    const text = tree.root.findByType(Text);
    return StyleSheet.flatten(text.props.style);
  };

  test.each([
    ['/recommendations', 'recommendations'],
    ['/recommendations-empty', 'recommendations'],
    ['/likes', 'likes'],
    ['/likes-empty', 'likes'],
    ['/shop', 'shop'],
    ['/settings', 'settings'],
  ])('%s 에서는 %s 탭 하나만 채움 아이콘 + Bold 브랜드색이다', async (pathname, active) => {
    mockPathname.mockReturnValue(pathname);
    let activeCount = 0;
    for (const { name, title } of TABS) {
      const isActive = name === active;
      const icon = await mount(<TabIcon name={name} />);
      expect(icon.root.findByType(Image).props.source).toBe(isActive ? TAB_ICONS[name].active : TAB_ICONS[name].inactive);

      const label = labelStyle(await mount(<TabLabel name={name} title={title} />));
      expect(label).toMatchObject(
        isActive
          ? { fontFamily: font.bold, color: colors.accent, fontSize: 13 }
          : { fontFamily: font.regular, color: colors.sub, fontSize: 13 },
      );
      if (isActive) activeCount += 1;
    }
    expect(activeCount).toBe(1); // 현재 탭은 한 번에 1개
  });

  test('탭이 없는 화면에서는 네 탭 모두 선형 회색이다', async () => {
    mockPathname.mockReturnValue('/onboarding');
    for (const { name, title } of TABS) {
      const icon = await mount(<TabIcon name={name} />);
      expect(icon.root.findByType(Image).props.source).toBe(TAB_ICONS[name].inactive);
      expect(labelStyle(await mount(<TabLabel name={name} title={title} />)).fontFamily).toBe(font.regular);
    }
  });

  test('아이콘 – 라벨 간격 4, 라벨 13/18', async () => {
    mockPathname.mockReturnValue('/likes');
    expect(labelStyle(await mount(<TabLabel name="likes" title="호감" />))).toMatchObject({ marginTop: 4, fontSize: 13, lineHeight: 18 });
  });

  test('아이콘 24 × 24', async () => {
    mockPathname.mockReturnValue('/likes');
    const icon = await mount(<TabIcon name="likes" />);
    expect(StyleSheet.flatten(icon.root.findByType(Image).props.style)).toMatchObject({ width: 24, height: 24 });
  });
});

describe('탭 칸 (TabBarButton)', () => {
  const props = { children: <Text>호감</Text>, onPress: jest.fn(), role: 'tab' as const, 'aria-label': '호감', style: { flex: 1 } };
  const target = (tree: ReactTestRenderer) =>
    tree.root.findAll((node) => node !== tree.root && typeof node.props.onPressIn === 'function')[0];
  const fakeEvent = { nativeEvent: { layout: { width: 90, height: 56 } } } as never;

  test('선택됨(aria-selected)은 현재 탭에만 켜진다', async () => {
    mockPathname.mockReturnValue('/likes-empty');
    const likes = await mount(<TabBarButton tab="likes" {...props} />);
    const profile = await mount(<TabBarButton tab="shop" {...props} />);
    expect(target(likes).props['aria-selected']).toBe(true);
    expect(target(profile).props['aria-selected']).toBe(false);
    expect(target(likes).props.role).toBe('tab');
  });

  test('ripple 만 쓰고 크기는 바꾸지 않는다. 원은 칸 안에서 가운데서 퍼진다', async () => {
    mockPathname.mockReturnValue('/likes');
    const tree = await mount(<TabBarButton tab="likes" {...props} />);
    await act(async () => target(tree).props.onLayout(fakeEvent));
    await act(async () => target(tree).props.onPressIn(fakeEvent));
    expect(timing.mock.calls.some(([, config]) => config.toValue === 0.97 || config.toValue === 0.985)).toBe(false); // scale 없음
    expect(timing.mock.calls.some(([, config]) => config.duration === 250)).toBe(true); // 250ms 퍼짐
    const circle = tree.root
      .findAllByType(View)
      .map((node) => StyleSheet.flatten(node.props.style))
      .find((style) => style?.position === 'absolute');
    expect(circle?.width).toBeCloseTo(Math.hypot(90, 56));
    expect(StyleSheet.flatten(target(tree).props.style)?.overflow).toBe('hidden'); // 칸 밖으로 나가지 않는다
  });

  test('칸 안 여백은 위 8 · 아래 0 · 좌우 0 이고 칸 전체가 터치 영역이다(가이드 5장: 아이콘은 칸 위에서 8)', async () => {
    mockPathname.mockReturnValue('/likes');
    const tree = await mount(<TabBarButton tab="likes" {...props} style={{ flex: 1, padding: 5 }} />);
    expect(StyleSheet.flatten(target(tree).props.style)).toMatchObject({ flex: 1, paddingTop: 8, paddingBottom: 0, paddingHorizontal: 0 });
  });

  test('눌린 동안 아이콘 · 라벨이 85%가 된다', async () => {
    mockPathname.mockReturnValue('/likes');
    const tree = await mount(<TabBarButton tab="likes" {...props} />);
    expect(StyleSheet.flatten(target(tree).props.style)?.opacity).toBeUndefined();
    await act(async () => target(tree).props.onPressIn(fakeEvent));
    expect(StyleSheet.flatten(target(tree).props.style)?.opacity).toBe(alpha.pressed);
    await act(async () => target(tree).props.onPressOut(fakeEvent));
    expect(StyleSheet.flatten(target(tree).props.style)?.opacity).toBeUndefined();
  });
});
