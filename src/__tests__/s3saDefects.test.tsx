// 3부-사 ④(D-219): 검수 Q9 새로 찾은 것 N1 · N3 · N4 · N5 · N6 고침
//  N1 08 알약(아이콘 + 글자 한 줄) · N3 16-G 웹 가로 넘침(들어오는 움직임을 틀 안에서) · N4 웹 화면 읽기 값(aria-valuenow) ·
//  N5 대기 링(Reanimated — 웹에서도 돎) · N6 고객센터 '아래 연락처' 문장(연락처 값이 없으면 뺌)
import fs from 'node:fs';
import path from 'node:path';

import { StyleSheet, type ViewStyle } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { Chip } from '@/components/Chip';
import { CHILD_SAFETY } from '@/content/copy';
import { TraitBar, TraitSlider } from '@/features/ai/TraitBar';
import { MyGradeScreen } from '@/features/grade/MyGradeScreen';
import { childSafetyBody } from '@/features/settings/settingsLogic';
import { ProgressBar } from '@/motion';

import { has, mount } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});
const open = async (el: React.ReactElement) => {
  const t = await mount(el);
  shown.push(t);
  return t;
};
const SRC = path.join(__dirname, '..');
// 화면에 그려지는 요소(호스트 View)의 props — 같은 testID 를 받은 부품 자신이 아니라
const host = (tree: ReactTestRenderer, id: string) => {
  const n = tree.root.findAll((x) => typeof x.type === 'string' && x.props.testID === id)[0];
  if (!n) throw new Error(`없음: ${id}`);
  return n.props as Record<string, unknown> & { style?: unknown };
};

describe('N1 08 알약: 앞 아이콘과 글자가 한 줄', () => {
  test('lead 아이콘이 있는 칩(누름 · 안 누름)은 가로 줄 · 체크 칩과 같은 여백', async () => {
    const plain = await open(<Chip label="인증 대기" lead="verified" testID="pill" />);
    expect(StyleSheet.flatten(host(plain, 'pill').style as ViewStyle)).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
    expect(has(plain, 'pill-lead')).toBe(true);
    const pressable = await open(<Chip label="사진 확인 중" lead="photo_checking" variant="tag" onPress={() => undefined} testID="pill2" />);
    const body = pressable.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.minHeight !== undefined && StyleSheet.flatten(n.props.style)?.borderRadius !== undefined);
    expect(body.some((n) => StyleSheet.flatten(n.props.style).flexDirection === 'row')).toBe(true);
    const noLead = await open(<Chip label="태그" testID="pill3" />);
    expect(StyleSheet.flatten(host(noLead, 'pill3').style as ViewStyle).flexDirection).toBeUndefined(); // 아이콘 없는 칩은 그대로
  });
});

describe('N4 웹 화면 읽기 값: accessibilityValue 와 같은 aria-value*', () => {
  test('07 막대 · 고치는 막대 · 진행 막대', async () => {
    const bar = await open(<TraitBar name="외향성" value={45} testID="bar" />);
    expect(host(bar, 'bar')).toMatchObject({ 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 45 });
    const slider = await open(<TraitSlider name="계획성" value={70} onChange={() => undefined} testID="slider" />);
    expect(host(slider, 'slider')).toMatchObject({ 'aria-valuenow': 70, 'aria-valuetext': '70' });
    const prog = await open(<ProgressBar ratio={0.3} accessibilityValue={{ min: 0, max: 10, now: 3 }} testID="prog" />);
    expect(host(prog, 'prog')).toMatchObject({ 'aria-valuemin': 0, 'aria-valuemax': 10, 'aria-valuenow': 3 });
  });
});

describe('N3 16-G: 들어오는 움직임이 화면 폭을 넘지 않게 가로를 자른다', () => {
  test('MyGradeScreen 틀 = flex 1 · overflow hidden', async () => {
    const deps = { grade: { loadMine: async () => ({ ok: true as const, data: { kind: 'pending' as const, reason: 'not_computed' as const, firstReadyAt: null } }), loadHistory: async () => ({ ok: true as const, data: { kind: 'locked' as const } }), requestAccess: async () => ({ ok: false as const, reason: 'server' as const }) }, now: () => Date.UTC(2026, 9, 27) };
    const t = await open(<MyGradeScreen deps={deps as never} />);
    expect(StyleSheet.flatten(host(t, 'my-grade-clip').style as ViewStyle)).toMatchObject({ flex: 1, overflow: 'hidden' });
    expect(has(t, 'my-grade')).toBe(true);
  });
});

describe('N5 대기 링: 웹에서도 도는 Reanimated', () => {
  test('Ring 은 RN Animated(useNativeDriver)를 쓰지 않고 withRepeat 로 돈다', () => {
    const src = fs.readFileSync(path.join(SRC, 'components', 'Ring.tsx'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(src).not.toMatch(/useNativeDriver|Animated\.loop/);
    expect(src).toMatch(/withRepeat\(withTiming\(1/);
  });
});

describe('N6 고객센터: 연락처 값이 없으면 ‘아래 연락처’ 문장을 뺀다', () => {
  test('원본 문장 그대로 · 연락처가 있으면 전부', () => {
    expect(childSafetyBody(CHILD_SAFETY.body, true)).toBe(CHILD_SAFETY.body);
    const without = childSafetyBody(CHILD_SAFETY.body, false);
    expect(without).not.toMatch(/아래 연락처/);
    expect(without.length).toBeGreaterThan(0);
    expect(CHILD_SAFETY.body.includes(without)).toBe(true);
  });
});
