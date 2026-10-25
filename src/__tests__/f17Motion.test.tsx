// F17 조건 2~5(D42-M 2안 '지면'으로 값 갱신, D-176): 움직임 토큰(2안 명세 3 · 4장 + D-175) · 바탕 bgGrad(브랜드색_v2 6장) · 햅틱 자리(D25 4장, 웹은 조용히 생략) · 동작 줄이기(투명도만 150ms)
import { Platform, StyleSheet, Text } from 'react-native';
import { act } from 'react-test-renderer';

import { Backdrop, Screen } from '@/components/Screen';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { COVER_LID, CoverTurn, dur, ease, haptic, InkTile, Land, MaskLine, onHaptic, press, Rise, scene, scene2, SCRIM_ALPHA, stagger, staggerDelay, TOAST_MS, Wipe, type HapticKind } from '@/motion';
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

describe('F17 조건 3: 움직임 토큰 = 2안 명세 3 · 4장 · D-175', () => {
  test('시간 100 · 150 · 250 · 400 · 700, 장면의 움직임 길이는 모두 700 이하(로딩 선 왕복 · 머무는 시간 · 시작 시각은 길이가 아님)', () => {
    expect(dur).toEqual({ instant: 100, short: 150, base: 250, long: 400, hero: 700 });
    const lengths = [
      scene2.nav.in, scene2.nav.title, scene2.tab.in, scene2.list.dur, scene2.card.dur, scene2.toast.in, scene2.sheet.in, scene2.bubble.in,
      scene2.ticket.sheetIn, scene2.ticket.stamp, scene2.ticket.sub, scene2.reveal.cover, scene2.reveal.photo, scene2.chat.first,
      scene2.splash.rule, scene2.splash.logo, scene2.splash.letters, scene2.splash.next,
      scene.onboarding.slide, scene.onboarding.photoSettle, scene.like.mail, scene.match.pair, scene.handoff.photo,
    ];
    expect(Math.max(...lengths)).toBeLessThanOrEqual(dur.hero);
    // 일상은 100 ~ 360, 핵심은 420 ~ 700
    expect([scene2.nav.in, scene2.nav.title, scene2.sheet.in, scene2.toast.in, scene2.bubble.in].every((ms) => ms >= 100 && ms <= 360)).toBe(true);
    expect([scene2.ticket.sheetIn, scene2.ticket.stamp, scene2.reveal.title, scene2.chat.first, scene2.splash.letters].every((ms) => ms >= 420 && ms <= 700)).toBe(true);
    // 표지 넘김 700(D-175) · 공개 합계 약 1초(마지막 버튼 700 뒤 300)
    expect(scene2.reveal.cover).toBe(700);
    expect(scene2.reveal.cta2Delay + scene2.reveal.cta).toBeLessThanOrEqual(1_000);
    expect([scene2.splash.ruleDelay, scene2.splash.logoDelay, scene2.splash.lettersDelay, scene2.splash.nextAt]).toEqual([100, 250, 450, 1_900]);
  });

  test('곡선: edOut · edInOut 추가 · settle(튕김) 삭제', () => {
    expect(ease).toEqual({ edOut: [0.16, 1, 0.3, 1], edInOut: [0.77, 0, 0.18, 1], out: [0.2, 0.8, 0.2, 1], in: [0.4, 0, 1, 1], std: [0.4, 0, 0.2, 1] });
    expect('settle' in ease).toBe(false);
  });

  test('눌림 0.985(아이콘 0.92) + 덮개 6% · 차례 50ms 최대 4개 · 뒤 어둡게 40% · 토스트 5초', () => {
    expect(press).toEqual({ button: 0.985, card: 0.985, icon: 0.92, overlay: 0.06, downMs: 100, upMs: 200 });
    expect(motion.reduced.fadeMs).toBe(150);
    expect(stagger).toEqual({ step: 50, max: 4 });
    expect([0, 1, 2, 3, 9].map(staggerDelay)).toEqual([0, 50, 100, 150, 150]);
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
  test('보통: 올라옴 · 놓임은 8 아래 · 잉크 번짐은 0.02 · 줄 가림은 110% 아래에서 시작한다(기울기 · 튕김 · 고리 0)', async () => {
    const tree = await mount(
      <>
        <Rise testID="rise" distance={16} />
        <Land testID="land" index={0} />
        <InkTile testID="ink" size={52} />
        <MaskLine testID="mask">탑승권을 받았어요</MaskLine>
      </>,
    );
    const rise = flat(host(tree, 'rise'));
    expect(rise.opacity).toBe(0);
    expect(rise.transform).toEqual([{ translateY: 16 }]);
    expect(flat(host(tree, 'land')).transform).toEqual([{ translateY: 8 }]);
    const styles = tree.root.findAll((n) => typeof n.type === 'string' && !!n.props).map((n) => JSON.stringify(n.props.style ?? null));
    expect(styles.some((x) => x.includes('"scale":0.02'))).toBe(true); // 잉크 번짐 시작
    expect(styles.some((x) => x.includes('"translateY":"110%"'))).toBe(true); // 줄 가림 시작
    expect(styles.some((x) => x.includes('rotate'))).toBe(false); // 기울기 0
    expect(styles.some((x) => x.includes('borderWidth'))).toBe(false); // 퍼짐 고리 없음
  });

  test('보통: 표지는 왼쪽 축 · 뒷면 숨김이고 넘긴 뒤 치운다, 걷힘(역이동)은 잘린 틀이 -100% 에서', async () => {
    expect(COVER_LID).toEqual({ transformOrigin: 'left center', backfaceVisibility: 'hidden' });
    const tree = await mount(
      <>
        <CoverTurn testID="cover" />
        <Wipe testID="wipe" />
      </>,
    );
    expect(host(tree, 'cover-cover')).toBeNull(); // 시험에서는 움직임이 바로 끝나 표지가 치워진다
    expect(flat(host(tree, 'wipe'))).toMatchObject({ overflow: 'hidden', transform: [{ translateY: '-100%' }] });
  });

  test('줄이기: 이동 · 크기 · 회전 · 덮개 없이 투명도만 바뀐다', async () => {
    act(() => reduceMotionStore.set(true));
    const tree = await mount(
      <>
        <Rise testID="rise" distance={16} />
        <Land testID="land" index={1} />
        <InkTile testID="ink" size={48} />
        <MaskLine testID="mask">제목</MaskLine>
        <CoverTurn testID="cover" />
        <Wipe testID="wipe" cover={colors.bg} />
      </>,
    );
    expect(flat(host(tree, 'rise'))).toMatchObject({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(flat(host(tree, 'land'))).toMatchObject({ opacity: 0, transform: [{ translateY: 0 }] });
    expect(host(tree, 'cover-cover')).toBeNull(); // 표지 없음
    expect(flat(host(tree, 'wipe')).opacity).toBe(0);
    const styles = tree.root.findAll((n) => typeof n.type === 'string' && !!n.props).map((n) => JSON.stringify(n.props.style ?? null));
    expect(styles.some((x) => x.includes('"scale":0.02') || /"translate[XY]":"/.test(x) || x.includes('rotateY') || x.includes('scaleY'))).toBe(false);
  });
});
