// F17 조건 2~5: 움직임 토큰(D25 2장 + 팀장 10-17 결정) · 바탕 bgGrad(브랜드색_v2 6장) · 햅틱 자리(D25 4장, 웹은 조용히 생략) · 동작 줄이기(투명도만 150ms)
import { Platform, StyleSheet, Text } from 'react-native';
import { act } from 'react-test-renderer';

import { Backdrop, Screen } from '@/components/Screen';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { dur, ease, haptic, Land, onHaptic, press, Rise, scene, SCRIM_ALPHA, stagger, staggerDelay, StampTile, TOAST_MS, type HapticKind } from '@/motion';
import { bgGrad, colors, motion } from '@/theme/tokens';

import { mount } from './renderHelpers';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

const Haptics = jest.requireMock<typeof import('expo-haptics')>('expo-haptics');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

afterEach(() => {
  act(() => reduceMotionStore.set(false));
  jest.clearAllMocks();
});

const flat = (node: { props: { style?: unknown } } | null) => (StyleSheet.flatten(node?.props.style as never) ?? {}) as Record<string, unknown>;
// 그려진 진짜 요소(문자열 type) 중 testID 가 맞는 첫 것 — 컴포넌트 자신(props 만 넘기는 겉)은 건너뛴다
const host = (tree: Awaited<ReturnType<typeof mount>>, id: string) => tree.root.findAll((n) => typeof n.type === 'string' && !!n.props && n.props.testID === id)[0] ?? null;

describe('F17 조건 3: 움직임 토큰 = D25 2장 · 팀장 결정', () => {
  test('시간 100 · 150 · 250 · 400 · 700, 장면의 움직임 길이는 모두 700 이하(뼈대 주기 · 머무는 시간 · 시작 시각은 길이가 아님)', () => {
    expect(dur).toEqual({ instant: 100, short: 150, base: 250, long: 400, hero: 700 });
    const lengths = [
      scene.splash.stamp, scene.splash.wordmark, scene.splash.unfold, scene.splash.backdropFade,
      scene.onboarding.slide, scene.onboarding.photoSettle, scene.onboarding.text, scene.onboarding.dot,
      scene.today.subline, scene.today.land, scene.like.heart, scene.like.mail, scene.match.pair, scene.match.text, scene.match.out,
      scene.skeleton.out, scene.buy.sheetIn, scene.buy.sheetOut, scene.buy.stamp, scene.toast.in, scene.toast.out, scene.list.dur,
    ];
    expect(Math.max(...lengths)).toBeLessThanOrEqual(dur.hero);
    // 시제품과 같은 순서 · 시간(스플래시: 찍힘 → 300 고리 → 600 글자 → 2100 펼침 · 서로 수락: 원 → 450 찍힘 → 750 글)
    expect([scene.splash.rippleDelay, scene.splash.wordmarkDelay, scene.splash.unfoldAt]).toEqual([300, 600, 2_100]);
    expect([scene.match.pair, scene.match.stampDelay, scene.match.textDelay]).toEqual([400, 450, 750]);
    expect(scene.today.tilts.every((t) => Math.abs(t) <= 3)).toBe(true);
  });

  test('이징 4종 = 시제품 CSS(out · in · std · settle)', () => {
    expect(ease).toEqual({ out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], std: [0.4, 0, 0.2, 1], settle: [0.34, 1.35, 0.5, 1] });
  });

  test('눌림 0.97(카드 0.985) · 차례 70ms 최대 4개 · 뒤 어둡게 40% · 토스트 5초 · 온보딩 사진 안착 700 — 가이드 13장 값은 tokens.ts 한 곳', () => {
    expect(press).toEqual({ button: 0.97, card: 0.985 });
    expect(motion).toMatchObject({ pressScale: 0.97, pressScaleCard: 0.985, pressInMs: 100, pressOutMs: 100, pressEase: [0.4, 0, 0.2, 1], staggerMs: 70, staggerMax: 4, sheetInMs: 400, sheetOutMs: 250, shimmerMs: 1600, colorMs: 150 });
    expect(stagger).toEqual({ step: 70, max: 4 });
    expect([0, 1, 2, 3, 9].map(staggerDelay)).toEqual([0, 70, 140, 210, 210]);
    expect(SCRIM_ALPHA).toBe(0.4);
    expect(TOAST_MS).toBe(5_000);
    expect(scene.onboarding.photoSettle).toBe(700);
  });
});

describe('F17 조건 2: 바탕 bgGrad', () => {
  test('토큰: accentSoft → bg(새 색 아님) · 위 → 아래 · 멈춤 0 · 1 · 높이 기본 260 · 09 300 · 온보딩 · 스플래시 360 · 연결됨 460', () => {
    expect(bgGrad.colors).toEqual([colors.accentSoft, colors.bg]);
    expect([bgGrad.start, bgGrad.end]).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(bgGrad.height).toEqual({ base: 260, recommendations: 300, onboarding: 360, splash: 360, connected: 460 });
  });

  test('화면 감싸개: 맨 뒤(첫 자식)에 덮개 한 장 · 위 0 · 폭 전체 · 누름 안 받음 · 바닥은 단색 bg', async () => {
    const tree = await mount(
      <Screen backdrop="recommendations" testID="s">
        <Text testID="body">본문</Text>
      </Screen>,
    );
    const screen = host(tree, 's');
    expect(flat(screen).backgroundColor).toBe(colors.bg);
    // SafeAreaView(감싸개 안쪽)의 자식: [덮개, 본문]
    const inner = tree.root.findAll((n) => !!n.props && n.props.testID === 's' && Array.isArray(n.props.children))[0];
    const children = ([] as unknown[]).concat(inner.props.children).filter(Boolean);
    expect((children[0] as { type: unknown }).type).toBe(Backdrop);
    const backdrop = host(tree, 'screen-backdrop');
    expect(flat(backdrop)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, height: 300 });
    expect(backdrop?.props.pointerEvents).toBe('none');
  });
});

describe('F17 조건 4: 햅틱 자리 · 웹 생략', () => {
  const heard: HapticKind[] = [];
  let off: () => void = () => undefined;
  beforeEach(() => {
    heard.length = 0;
    off = onHaptic((k) => heard.push(k));
  });
  afterEach(() => off());

  test('Light · Success · Error · Warning · Selection 이 expo-haptics 의 맞는 함수로 간다', () => {
    haptic.light();
    haptic.success();
    haptic.error();
    haptic.warning();
    haptic.selection();
    expect(heard).toEqual(['light', 'success', 'error', 'warning', 'selection']);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect((Haptics.notificationAsync as jest.Mock).mock.calls.map((c) => c[0])).toEqual(['success', 'error', 'warning']);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  test('웹에서는 조용히 생략(진동 함수를 부르지 않고 오류도 없다)', () => {
    const os = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      expect(() => haptic.success()).not.toThrow();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    }
  });

  test('기기에서 햅틱이 실패해도(설정 꺼짐 등) 앱은 그대로', async () => {
    (Haptics.notificationAsync as jest.Mock).mockRejectedValueOnce(new Error('off'));
    expect(() => haptic.error()).not.toThrow();
    await Promise.resolve();
  });
});

describe('F17 조건 5: 동작 줄이기면 이동 · 크기 변화 없이 투명도만', () => {
  test('보통: 올라옴 · 놓임 · 찍힘은 처음에 자리 밖(이동 · 기울기 · 크기)에서 시작한다', async () => {
    const tree = await mount(
      <>
        <Rise testID="rise" distance={16} />
        <Land testID="land" index={0} />
        <StampTile testID="stamp" size={48} />
      </>,
    );
    const rise = flat(host(tree, 'rise'));
    expect(rise.opacity).toBe(0);
    expect(rise.transform).toEqual([{ translateY: 16 }]);
    const land = flat(host(tree, 'land'));
    expect(land.transform).toEqual([{ translateX: 10 }, { translateY: -30 }, { rotate: `${scene.today.tilts[0]}deg` }, { scale: 0.97 }]);
    // 찍힘: 위 26 · -6° · 1.2배 · 투명에서 시작 + 퍼짐 고리(테두리) 있음
    const stamp = tree.root.findAll((n) => typeof n.type === 'string' && !!n.props && JSON.stringify(n.props.style ?? null).includes('"scale":1.2'));
    expect(stamp.length).toBeGreaterThan(0);
  });

  test('줄이기: 이동 · 기울기 · 크기가 처음부터 제자리(0 · 0° · 1)이고 투명도만 바뀐다', async () => {
    act(() => reduceMotionStore.set(true));
    const tree = await mount(
      <>
        <Rise testID="rise" distance={16} />
        <Land testID="land" index={1} />
        <StampTile testID="stamp" size={48} ripple />
      </>,
    );
    expect(flat(host(tree, 'rise'))).toMatchObject({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(flat(host(tree, 'land'))).toMatchObject({ opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] });
    const styles = tree.root.findAll((n) => typeof n.type === 'string' && !!n.props).map((n) => JSON.stringify(n.props.style ?? null));
    expect(styles.some((x) => x.includes('"scale":1.2'))).toBe(false); // 찍힘도 크기 · 이동 없이
    expect(styles.some((x) => x.includes('borderWidth'))).toBe(false); // 퍼짐 고리 없음
  });
});
