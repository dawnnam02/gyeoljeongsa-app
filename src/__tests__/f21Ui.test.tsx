// F21 조건 1 · 2: UI v2 토큰 · 부품(D36 6장 · 가이드 4-4 · D-96 · D-118) + 움직임 v2 '흐르는 결정사'(D25 10장 넘김 표 17행)
//  시험 환경의 Reanimated 는 공식 대역이라 움직임은 바로 끝 값으로 가고, 그려질 때 한 번 계산된 모양을 본다(jest.setup.js).
import { Platform, StyleSheet, Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { GlanceRow, IconButton, ResultView, TimePill, VerifiedBadge } from '@/components/Badges';
import { BottomSheet, shouldDragClose } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { BottomCTA, CtaPair, Screen } from '@/components/Screen';
import { TabIcon, TabLabel } from '@/components/TabBarParts';
import { TabHeader } from '@/components/TabHeader';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { imeMark } from '@/lib/imeText';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { AnimatedRow, cancelHandoff, onHaptic, ProgressBar, returnHandoff, RollingNumber, scene, setHandoffTarget, springFollow, startHandoff, useCollapsingTitle, useHandoffStore, useWaitStage, waitStage } from '@/motion';
import { RowButton } from '@/features/likes/LikesParts';
import { SwitchRow } from '@/features/settings/SettingsParts';
import { buttonFace, buttonShadow, shadowStyle } from '@/theme/buttonLook';
import { mix, withAlpha } from '@/theme/color';
import { alpha, button, colors, motion, radius, size, space, type } from '@/theme/tokens';

import { mount, press } from './renderHelpers';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => ({ push: jest.fn() }), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('@/navigation/activeTab', () => ({ useIsActiveTab: (name: string) => name === 'recommendations' }));
jest.mock('@/components/ProfileButton', () => ({ ProfileButton: () => null }));

const hosts = (tree: ReactTestRenderer, id: string) => tree.root.findAll((n) => typeof n.type === 'string' && !!n.props && n.props.testID === id);
const host = (tree: ReactTestRenderer, id: string) => hosts(tree, id)[0] ?? null;
const flat = (node: { props: { style?: unknown } } | null) => (StyleSheet.flatten(node?.props.style as never) ?? {}) as Record<string, unknown>;
const allStyles = (tree: ReactTestRenderer) => tree.root.findAll((n) => typeof n.type === 'string' && !!n.props).map((n) => flat(n));

afterEach(() => {
  act(() => reduceMotionStore.set(false));
  jest.restoreAllMocks(); // Platform.OS · Version 바꾼 것 되돌림
});

describe('F21 조건 1 · 토큰 v2(tokens.ts = 가이드 8장, check:tokens)', () => {
  test('둥글기 · 크기 · 투명도 · 움직임 새 값', () => {
    expect([radius.xl, radius.sheet]).toEqual([20, 24]);
    expect([size.iconButton, size.badge, size.tabIndicatorW, size.tabIndicatorH, size.sheetHandleW, size.sheetHandleH, size.sheetHandleTouch, size.ctaFade, size.focusRing, size.focusOffset]).toEqual([40, 24, 56, 28, 36, 4, 44, 24, 2, 2]); // 포커스 띄움 2(버튼 v3, D-141)
    expect(alpha.dim).toBe(0.4);
    expect([motion.sheetInMs, motion.sheetOutMs, motion.shimmerMs, motion.colorMs]).toEqual([400, 250, 1600, 150]); // D-118 ①②
    expect([motion.pressScale, motion.pressScaleCard, motion.pressInMs]).toEqual([0.97, 0.985, 100]);
  });

  test('움직임 v2 토큰(D25 10-3): spring-follow 감쇠 1 · 400 · 숫자 자리 30 · 대기 단계 300 / 1000 / 10000 · 장면 시간은 700 이하', () => {
    expect(springFollow).toEqual({ duration: 400, dampingRatio: 1 });
    expect(scene.roll.digitGap).toBe(30);
    expect(waitStage).toEqual({ blank: 300, still: 1_000, long: 10_000 });
    expect([scene.fadeThrough.out, scene.fadeThrough.in, scene.collapse.range, scene.sheetDrag.closeRatio, scene.sheetDrag.closeVelocity]).toEqual([100, 200, 48, 0.4, 800]); // 탭 넘김은 2안 tab.in(100 뒤 200)
    const lengths = [scene.handoff.photo, scene.handoff.back, scene.roll.dur, scene.survey.slide, scene.toggle.revert];
    expect(Math.max(...lengths)).toBeLessThanOrEqual(700);
  });
});

// 버튼 v3 A안 '도톰한 와인'(D40 토큰표 2장 A열 · 본인 선택 D-141). hex 는 tokens.ts 밖에 쓰지 않으므로(check:tokens B) '#' 를 따로 붙여 비교한다
const hex = (v: string) => `#${v}`;

describe('F21 · 버튼 v3 A안(D-141)', () => {
  test('토큰: 모서리 16 · 좌우 20 · 눌림 1px · 혼자 놓인 버튼 160 · 32 / 눌림 면은 두 토큰을 섞은 값(주 8B384B · 위험 443C3A — 토큰표 3장)', () => {
    expect(button).toMatchObject({ radius: 16, paddingX: 20, pressY: 1, inlineMinW: 160, inlinePaddingX: 32 });
    expect(buttonFace.primaryPressed).toBe(hex('8B384B'));
    expect(buttonFace.dangerPressed).toBe(hex('443C3A'));
    expect(mix(colors.accent, colors.text, 0)).toBe(colors.accent);
    expect([buttonFace.secondary, buttonFace.secondaryPressed, buttonFace.off, buttonFace.icon]).toEqual([colors.bg, colors.card, colors.card, colors.bg]);
    expect(buttonShadow.primary).toBe(`inset 0 1px 0 ${withAlpha(colors.onAccent, 0.18)}, 0 1px 2px ${withAlpha(colors.text, 0.1)}, 0 6px 14px -6px ${withAlpha(colors.accent, 0.55)}`);
  });

  test('기본: 주 = 와인 면 + 와인빛 그림자 · Bold 흰 글자 / 보조 = 아이보리 면 + line 1 선 + 옅은 그림자 · Medium / 위험 = text 면 + 그림자 / 모서리 16', async () => {
    const tree = await mount(
      <>
        <Button label="주" testID="p" />
        <Button label="보조" variant="secondary" testID="s" />
        <Button label="위험" variant="danger" testID="d" />
      </>,
    );
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 20, boxShadow: buttonShadow.primary });
    expect(flat(host(tree, 's'))).toMatchObject({ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, boxShadow: buttonShadow.secondary });
    expect(flat(host(tree, 'd'))).toMatchObject({ backgroundColor: colors.text, boxShadow: buttonShadow.danger });
    const label = (id: string) => tree.root.findAll((n) => n.type === Text && n.props.children === id)[0];
    expect(flat(label('주')).fontFamily).toBe(type.bodyBold.fontFamily);
    expect(flat(label('보조')).fontFamily).toBe(type.bodyMedium.fontFamily);
    expect(flat(label('주')).color).toBe(colors.onAccent);
  });

  test('눌림: 물결 · 덮개 없이 전용 눌림 면 + 그림자 줄어듦 + 1px 내려감 설정, 떼면 돌아온다', async () => {
    const tree = await mount(<Button label="주" testID="p" />);
    const pressable = tree.root.findAll((n) => n.props?.testID === 'p' && typeof n.props.onPressIn === 'function')[0];
    expect(pressable.props).toMatchObject({ effect: 'scale', scaleTo: 'button', pressShift: 1, clip: false });
    await act(async () => pressable.props.onPressIn({}));
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: buttonFace.primaryPressed, boxShadow: buttonShadow.primaryPressed });
    expect(tree.root.findAll((n) => typeof n.type === 'string' && flat(n).position === 'absolute' && flat(n).borderRadius === 999 && flat(n).opacity !== undefined && n.props.pointerEvents === 'none')).toHaveLength(0); // 물결 원 없음
    await act(async () => pressable.props.onPressOut({}));
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: colors.accent, boxShadow: buttonShadow.primary });
  });

  test('보조 · 텍스트 눌림: 보조는 card 면 · 그림자 없음, 텍스트는 accentSoft 상자(크기 · 이동 없음)', async () => {
    const tree = await mount(
      <>
        <Button label="보조" variant="secondary" testID="s" />
        <Button label="텍스트" variant="text" testID="t" />
      </>,
    );
    const press = (id: string) => tree.root.findAll((n) => n.props?.testID === id && typeof n.props.onPressIn === 'function')[0];
    await act(async () => press('s').props.onPressIn({}));
    expect(flat(host(tree, 's')).backgroundColor).toBe(colors.card);
    expect(flat(host(tree, 's')).boxShadow).toBeUndefined();
    expect(press('t').props).toMatchObject({ effect: 'none', pressShift: 0 });
    await act(async () => press('t').props.onPressIn({}));
    expect(flat(host(tree, 't')).backgroundColor).toBe(colors.accentSoft);
  });

  test('비활성: 투명도 대신 색 — 주 · 위험은 card 면 + sub 글자 · 그림자 없음, 보조는 면 없이 line 선 / dimmed 는 같은 모양이지만 눌림은 받는다', async () => {
    const onPress = jest.fn();
    const tree = await mount(
      <>
        <Button label="주" disabled testID="p" />
        <Button label="보조" variant="secondary" disabled testID="s" />
        <Button label="흐림" dimmed onPress={onPress} testID="m" />
      </>,
    );
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: colors.card });
    expect(flat(host(tree, 'p')).opacity).toBeUndefined();
    expect(flat(host(tree, 'p')).boxShadow).toBeUndefined();
    expect(flat(host(tree, 's'))).toMatchObject({ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line });
    expect(flat(tree.root.findAll((n) => n.type === Text && n.props.children === '주')[0]).color).toBe(colors.sub);
    expect(flat(host(tree, 'm')).backgroundColor).toBe(colors.card);
    const dimmedNode = tree.root.findAll((n) => n.props?.testID === 'm' && typeof n.props.onPress === 'function' && n.props.disabled !== true)[0];
    await act(async () => dimmedNode.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('불러오는 중: 눌림 면 + 점 3개 · 글자는 자리만 지켜 폭 그대로 · busy', async () => {
    const tree = await mount(<Button label="결제하기" loading testID="p" />);
    expect(host(tree, 'p-dots')).not.toBeNull();
    expect(hosts(tree, 'p-dots')[0].findAll((n) => typeof n.type === 'string').length).toBeGreaterThanOrEqual(3);
    const label = tree.root.findAll((n) => n.type === Text && n.props.children === '결제하기')[0];
    expect(flat(label).opacity).toBe(0);
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: buttonFace.primaryPressed, boxShadow: buttonShadow.primaryPressed });
    expect(host(tree, 'p')?.props.accessibilityState).toMatchObject({ busy: true });
  });

  test('포커스: 키보드로 왔을 때만 와인 2px 테두리를 2px 띄워 그리고, 누른 직후의 포커스에는 그리지 않는다', async () => {
    const tree = await mount(<Button label="주" testID="p" />);
    const pressable = () => tree.root.findAll((n) => n.props?.testID === 'p' && typeof n.props.onFocus === 'function')[0];
    await act(async () => pressable().props.onFocus({}));
    expect(flat(host(tree, 'p-focus'))).toMatchObject({ borderWidth: 2, borderColor: colors.accent, top: -4, borderRadius: 20 });
    await act(async () => pressable().props.onBlur({}));
    await act(async () => pressable().props.onPressIn({}));
    await act(async () => pressable().props.onFocus({}));
    expect(host(tree, 'p-focus')).toBeNull();
  });

  test('혼자 놓인 버튼(inline): 최소 폭 160 · 좌우 32 · 가운데', async () => {
    const tree = await mount(<Button label="다시 시도" variant="secondary" inline testID="r" />);
    expect(flat(host(tree, 'r'))).toMatchObject({ minWidth: 160, paddingHorizontal: 32 });
    expect(allStyles(tree).some((st) => st.alignSelf === 'center')).toBe(true);
  });

  test('아이콘 버튼: 원 = 아이보리 면 + line 1 선 + 옅은 그림자 · 눌리면 card 면 · 그림자 없음 · 1px', async () => {
    const tree = await mount(<IconButton icon="back" accessibilityLabel="다음 사진" onPress={() => undefined} testID="i" />);
    expect(flat(host(tree, 'i-circle'))).toMatchObject({ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, boxShadow: buttonShadow.icon });
    const pressable = tree.root.findAll((n) => n.props?.testID === 'i' && typeof n.props.onPressIn === 'function')[0];
    expect(pressable.props).toMatchObject({ pressShift: 1, clip: false, effect: 'scale' });
    await act(async () => pressable.props.onPressIn({}));
    expect(flat(host(tree, 'i-circle')).backgroundColor).toBe(colors.card);
    expect(flat(host(tree, 'i-circle')).boxShadow).toBeUndefined();
  });

  test('11 받은 호감 줄의 작은 [수락]은 채움이 아닌 작은 보조(아이보리 + 선 + 옅은 그림자), [거절]은 작은 텍스트 — 한 화면 주 버튼 1', async () => {
    const tree = await mount(
      <>
        <RowButton label="수락" a11y="수락" tone="accept" busy={false} locked={false} dimmed={false} onPress={() => undefined} testID="acc" />
        <RowButton label="거절" a11y="거절" tone="decline" busy={false} locked={false} dimmed={false} onPress={() => undefined} testID="dec" />
      </>,
    );
    expect(flat(host(tree, 'acc'))).toMatchObject({ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, boxShadow: buttonShadow.secondary, borderRadius: 16 });
    expect(flat(host(tree, 'acc')).backgroundColor).not.toBe(colors.accent);
    expect(flat(host(tree, 'dec')).backgroundColor).toBeUndefined();
    expect(flat(host(tree, 'dec')).borderWidth).toBeUndefined();
  });

  test('한글 입력(D-143): 조합 중인 칸이 있으면 누르기 전에 칸을 내려 조합을 끝내고 최신 onPress 를 부른다 · 없으면 바로', async () => {
    const first = jest.fn();
    const latest = jest.fn();
    const blur = jest.fn();
    const g = globalThis as { document?: unknown };
    const saved = g.document;
    g.document = { activeElement: { blur } };
    const tree = await mount(<Button label="다음" onPress={first} testID="n" />);
    const pressable = () => tree.root.findAll((n) => n.props?.testID === 'n' && typeof n.props.onPressIn === 'function')[0];
    imeMark(1); // 글 칸이 조합 중
    await act(async () => pressable().props.onPress());
    expect(blur).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    await act(async () => tree.update(<Button label="다음" onPress={latest} testID="n" />)); // 조합이 끝나 다시 그려짐
    imeMark(-1);
    await act(async () => new Promise((r) => setTimeout(r, 60)));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    await act(async () => pressable().props.onPress()); // 조합 중인 칸이 없으면 바로
    expect(latest).toHaveBeenCalledTimes(2);
    g.document = saved;
  });

  test('그림자 대안: Android 9 미만은 boxShadow 대신 elevation', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(26);
    expect(shadowStyle('primary')).toEqual({ elevation: 3 });
    expect(shadowStyle('secondary')).toEqual({ elevation: 1 });
    version.mockReturnValue(30);
    expect(shadowStyle('primary')).toEqual({ boxShadow: buttonShadow.primary });
    expect(shadowStyle(null)).toEqual({});
  });
});

describe('F21 조건 1 · 그 밖 부품 v2', () => {
  test('칩 선택됨 = accentSoft 면 + accent 1 선 + 체크', async () => {
    const tree = await mount(<Chip label="고름" variant="selected" testID="c" />);
    expect(flat(host(tree, 'c'))).toMatchObject({ backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent });
    expect(tree.root.findAllByType(Icon).find((n) => n.props.testID === 'c-check')?.props).toMatchObject({ name: 'check', size: 16, color: colors.accent });
  });

  test('카드: 면 = card · 16 / 종이 = bg + line 1 · 20', async () => {
    const tree = await mount(
      <>
        <Card testID="f" />
        <Card variant="paper" testID="p" />
      </>,
    );
    expect(flat(host(tree, 'f'))).toMatchObject({ backgroundColor: colors.card, borderRadius: 16 });
    expect(flat(host(tree, 'p'))).toMatchObject({ backgroundColor: colors.bg, borderRadius: 20, borderWidth: 1, borderColor: colors.line });
  });

  test('하단 고정: 위 24 흐림 · 선 없음 · 위 8 · 좌우 20 · 아래 16 · 둘이면 보조 1 : 주 2', async () => {
    const tree = await mount(
      <BottomCTA testID="cta">
        <CtaPair secondary={<Button label="넘기기" variant="secondary" />} primary={<Button label="호감 보내기" />} />
      </BottomCTA>,
    );
    expect(flat(host(tree, 'cta'))).toMatchObject({ paddingTop: space.s8, paddingHorizontal: 20, paddingBottom: space.s16, backgroundColor: colors.bg });
    expect(flat(host(tree, 'cta')).borderTopWidth).toBeUndefined();
    expect(allStyles(tree).some((st) => st.top === -24 && st.height === 24)).toBe(true);
    expect(allStyles(tree).filter((st) => st.flex === 1 || st.flex === 2).map((st) => st.flex)).toEqual([1, 2]);
  });

  test('입력: 둥글기 12 · 포커스면 accent 2 테두리', async () => {
    const tree = await mount(<TextField label="이메일" value="" onChangeText={() => undefined} testID="t" />);
    expect(flat(host(tree, 't')).borderRadius).toBe(12);
    await act(async () => host(tree, 't')?.props.onFocus());
    expect(flat(host(tree, 't'))).toMatchObject({ borderWidth: 2, borderColor: colors.accent });
  });

  test('탭바 현재 탭(D42-C 1안 다): 알약 대신 닫힌 면 accentSoft(on) + 라벨 아래 20 × 3 막대, 다른 탭은 없음', async () => {
    const tree = await mount(
      <>
        <TabIcon name="recommendations" />
        <TabIcon name="likes" />
        <TabLabel name="recommendations" title="추천" />
        <TabLabel name="likes" title="호감" />
      </>,
    );
    const icons = tree.root.findAllByType(Icon);
    expect(icons.map((n) => n.props.on)).toEqual([true, false]);
    expect(flat(host(tree, 'tab-bar-recommendations'))).toMatchObject({ width: 20, height: 3, backgroundColor: colors.accent });
    expect(host(tree, 'tab-bar-likes')).toBeNull();
    expect(host(tree, 'tab-pill-recommendations')).toBeNull();
  });

  test('인증 표시는 확인된 항목만(없으면 아무것도 없음) · 한눈에 줄은 값 있는 칸만 · 기한 알약 · 결과 틀', async () => {
    const empty = await mount(<VerifiedBadge labels={[]} testID="v" />);
    expect(host(empty, 'v')).toBeNull();
    const tree = await mount(
      <>
        <VerifiedBadge labels={['사진 확인']} testID="v" />
        <GlanceRow cells={[{ label: '나이', value: '32' }, { label: '키', value: null }, { label: '지역', value: '서울 강남구' }]} testID="g" />
        <GlanceRow cells={[{ label: '결혼 시기', value: null }]} testID="none" />
        <TimePill testID="pill">다음 추천까지 3시간</TimePill>
        <ResultView title="추천이 없어요" testID="r" />
        <IconButton icon="back" accessibilityLabel="다음 사진" onPress={() => undefined} testID="i" />
      </>,
    );
    expect(hosts(tree, 'v-item')).toHaveLength(1);
    expect(flat(hosts(tree, 'v-item')[0])).toMatchObject({ minHeight: 24, backgroundColor: colors.accentSoft });
    expect(host(tree, 'g-0')?.props.accessibilityLabel).toBe('나이 32');
    expect(host(tree, 'g-1')?.props.accessibilityLabel).toBe('지역 서울 강남구');
    expect(host(tree, 'none')).toBeNull();
    expect(host(tree, 'pill')?.props.children).toBe('다음 추천까지 3시간');
    expect(host(tree, 'r')).not.toBeNull();
    expect(tree.root.findAll((n) => n.props?.testID === 'i')[0].props.accessibilityLabel).toBe('다음 사진');
  });
});

describe('F21 조건 2 · 움직임 v2', () => {
  test('시트 끌어 닫기 판단: 높이 40% 넘게 끌었거나 초당 800 넘게 튕기면 닫힘', () => {
    expect(shouldDragClose(41, 100, 0)).toBe(true);
    expect(shouldDragClose(39, 100, 700)).toBe(false);
    expect(shouldDragClose(10, 100, 801)).toBe(true);
    expect(shouldDragClose(500, 0, 900)).toBe(true);
  });

  test('시트 v2: 위 모서리 24 · 손잡이 36 × 4(터치 44) · 열고 닫기(닫힘이 끝나면 Modal 이 내려감)', async () => {
    const close = jest.fn();
    const tree = await mount(
      <BottomSheet visible onClose={close} testID="sheet">
        <Text>내용</Text>
      </BottomSheet>,
    );
    expect(tree.root.findAll((n) => n.props?.testID === 'sheet')[0].props.visible).toBe(true);
    expect(allStyles(tree).some((st) => st.borderTopLeftRadius === 24)).toBe(true);
    expect(allStyles(tree).some((st) => st.width === 36 && st.height === 4)).toBe(true);
    expect(flat(host(tree, 'sheet-handle')).height).toBe(44);
    await press(tree, 'sheet-scrim');
    expect(close).toHaveBeenCalledTimes(1);
    await act(async () => {
      tree.update(
        <BottomSheet visible={false} onClose={close} testID="sheet">
          <Text>내용</Text>
        </BottomSheet>,
      );
    });
    expect(tree.root.findAll((n) => n.props?.testID === 'sheet')[0].props.visible).toBe(false);
  });

  test('숫자 굴림: 자리마다 세로 열이 그 숫자 자리에 있고 스크린리더는 전체를 한 번에 읽는다', async () => {
    const tree = await mount(<RollingNumber value={10} suffix="통" testID="n" />);
    expect(host(tree, 'n')?.props.accessibilityLabel).toBe('10통');
    const columns = tree.root.findAll((n) => typeof n.type === 'string' && JSON.stringify(flat(n).transform ?? null).includes('translateY'));
    const lh = type.bodyBold.lineHeight;
    expect(columns.map((c) => (flat(c).transform as { translateY: number }[])[0].translateY)).toEqual([-1 * lh, -0 * lh]);
  });

  test('진행 막대: 안쪽을 scaleX 로 채운다(너비를 움직이지 않음)', async () => {
    const tree = await mount(<ProgressBar ratio={0.25} testID="bar" fillTestID="fill" />);
    expect(flat(host(tree, 'fill'))).toMatchObject({ width: '100%', transform: [{ scaleX: 0.25 }] });
  });

  test('대기 단계표: 0.3초 안 0 → 1 정지 뼈대 → 1초 2 반짝임 → 10초 3 멈춤 + 글, 기다림이 끝나면 0', async () => {
    jest.useFakeTimers();
    const seen: number[] = [];
    function Probe({ waiting }: { waiting: boolean }) {
      seen.push(useWaitStage(waiting));
      return null;
    }
    const tree = await mount(<Probe waiting />);
    const at = () => seen[seen.length - 1];
    expect(at()).toBe(0);
    await act(async () => jest.advanceTimersByTime(300));
    expect(at()).toBe(1);
    await act(async () => jest.advanceTimersByTime(700));
    expect(at()).toBe(2);
    await act(async () => jest.advanceTimersByTime(9_000));
    expect(at()).toBe(3);
    await act(async () => tree.update(<Probe waiting={false} />));
    expect(at()).toBe(0);
    jest.useRealTimers();
  });

  test('스위치: 켜짐이면 손잡이가 오른쪽 끝(44 − 2×2 − 20 = 20)', async () => {
    const tree = await mount(
      <>
        <Toggle on testID="on" />
        <Toggle on={false} testID="off" />
      </>,
    );
    const x = (id: string) => hosts(tree, id)[0].findAll((n) => typeof n.type === 'string' && JSON.stringify(flat(n).transform ?? null).includes('translateX')).map((n) => (flat(n).transform as { translateX: number }[])[0].translateX)[0];
    expect(x('on')).toBe(20);
    expect(x('off')).toBe(0);
  });

  test('스위치 줄을 누르면 Selection 햅틱(D25 10-5 새 자리)', async () => {
    const heard: string[] = [];
    const off = onHaptic((k) => heard.push(k));
    const onPress = jest.fn();
    const tree = await mount(<SwitchRow label="알림" on={false} onPress={onPress} testID="sw" />);
    // 바깥 SwitchRow 가 아니라 안쪽 누름 요소(스위치 역할)를 누른다
    const row = tree.root.findAll((n) => n.props?.testID === 'sw' && n.props.accessibilityRole === 'switch')[0];
    await act(async () => row.props.onPress());
    expect(heard).toEqual(['selection']);
    expect(onPress).toHaveBeenCalled();
    off();
  });

  test('큰 제목 줄어듦: collapse 를 주면 머리 가운데 작은 제목(16 Bold)과 48 에서 생기는 아래 선이 있다(처음엔 투명)', async () => {
    function Head() {
      const collapse = useCollapsingTitle();
      return <TabHeader title="오늘의 추천" collapse={collapse} testID="h" />;
    }
    const tree = await mount(<Head />);
    const small = host(tree, 'h-small');
    expect(flat(small).fontFamily).toBe(type.bodyBold.fontFamily);
    expect(flat(host(tree, 'h-line')).opacity).toBe(0);
  });

  test('화면 넘김(2안): enter=depth 는 화면 안에서 옆 이동이 없다(native-stack fade 320 이 맡음) · 줄이기여도 같다', async () => {
    const tree = await mount(
      <Screen enter="depth" testID="s">
        <Text>본문</Text>
      </Screen>,
    );
    expect(allStyles(tree).some((st) => JSON.stringify(st.transform ?? null).includes('translateX'))).toBe(false);
    act(() => reduceMotionStore.set(true));
    const calm = await mount(
      <Screen enter="depth" testID="s2">
        <Text>본문</Text>
      </Screen>,
    );
    expect(allStyles(calm).some((st) => JSON.stringify(st.transform ?? null).includes('translateX'))).toBe(false);
  });

  test('레이아웃 메움 줄(AnimatedRow)은 안의 줄을 그대로 그린다', async () => {
    const tree = await mount(
      <AnimatedRow testID="row">
        <Text>줄</Text>
      </AnimatedRow>,
    );
    expect(tree.root.findAll((n) => n.type === Text && n.props.children === '줄')).toHaveLength(1);
  });

  test('사진 이어 붙임(09 → 10): 시작 → 도착 자리 → 되돌아감 · 잴 수 없거나 동작 줄이기면 하지 않음 · 10 을 떠나면 버림', () => {
    const rect = { x: 20, y: 200, width: 96, height: 120 };
    startHandoff('c1', 'https://x/p.jpg', rect);
    expect(useHandoffStore.getState()).toMatchObject({ phase: 'going', id: 'c1', from: rect });
    setHandoffTarget('c1', { x: 20, y: 100, width: 350, height: 400 });
    expect(useHandoffStore.getState().to).toEqual({ x: 20, y: 100, width: 350, height: 400 });
    useHandoffStore.setState({ phase: 'arrived' });
    returnHandoff('c1', { x: 20, y: 100, width: 350, height: 400 });
    expect(useHandoffStore.getState()).toMatchObject({ phase: 'returning', to: rect });
    startHandoff('c2', null, null);
    expect(useHandoffStore.getState().phase).toBe('idle');
    startHandoff('c3', null, rect);
    cancelHandoff('c3');
    expect(useHandoffStore.getState().phase).toBe('idle');
    act(() => reduceMotionStore.set(true));
    startHandoff('c4', null, rect);
    expect(useHandoffStore.getState().phase).toBe('idle');
  });
});
