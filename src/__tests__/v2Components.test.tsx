// F9 색 v2 공통 부품 시험: 토큰 10개 · 둥글기 · Button 보조 · Chip 3종 · Bubble 2종 · Avatar · SendButton · Card · TextField · ScreenHeader 링크 · 대비 4.5:1.
import fs from 'node:fs';
import path from 'node:path';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';

import { Avatar } from '@/components/Avatar';
import { Bubble } from '@/components/Bubble';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { LockNote } from '@/components/LockNote';
import { LegalReader } from '@/features/consent/LegalReader';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SendButton } from '@/components/SendButton';
import { TextField } from '@/components/TextField';
import { layout } from '@/theme/layout';
import { colors, radius, size } from '@/theme/tokens';

import { mount } from './renderHelpers';
import type { ReactTestRenderer } from 'react-test-renderer';

// testID 를 가진 요소 중 style 이 있는 첫 번째(컴포넌트가 아니라 안쪽 View/TextInput)
const must = (tree: ReactTestRenderer, id: string) => {
  const found = tree.root.findAll((n) => n.props.testID === id && n.props.style !== undefined)[0] ?? tree.root.findAll((n) => n.props.testID === id)[0];
  if (!found) throw new Error(`testID ${id} 없음`);
  return found;
};

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;
// 함수형 style(눌림)도 받는다
const styleOf = (node: { props: { style?: unknown } }, pressed = false) => {
  const raw = node.props.style;
  return flat(typeof raw === 'function' ? (raw as (s: { pressed: boolean }) => unknown)({ pressed }) : raw);
};

// WCAG 상대 휘도 · 대비
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('색 v2 토큰 (브랜드색_v2 1장)', () => {
  test('색 10개가 브랜드색_v2.md 1장 표와 같다(문서가 옆에 있을 때)', () => {
    expect(Object.keys(colors)).toEqual(['bg', 'card', 'line', 'text', 'sub', 'accent', 'accentSoft', 'accentAlt', 'bubbleAi', 'onAccent']);
    const doc = path.resolve(__dirname, '..', '..', '..', '디자인', '브랜드색_v2.md');
    if (!fs.existsSync(doc)) return;
    const text = fs.readFileSync(doc, 'utf8');
    for (const [name, value] of Object.entries(colors)) {
      const row = new RegExp(String.raw`^\| ${name} \|[^\n]*?(#[0-9A-Fa-f]{6})`, 'm').exec(text);
      expect(row?.[1]?.toUpperCase()).toBe(value.toUpperCase());
    }
  });
  test('둥글기 lg 는 16', () => {
    expect(radius.lg).toBe(16);
  });
});

describe('대비 4.5:1 이상 (토큰 쌍 6개)', () => {
  const pairs: [string, string, string][] = [
    ['text / bg', colors.text, colors.bg],
    ['sub / bg', colors.sub, colors.bg],
    ['accent / bg', colors.accent, colors.bg],
    ['onAccent / accent', colors.onAccent, colors.accent],
    ['onAccent / accentAlt', colors.onAccent, colors.accentAlt],
    ['accent / accentSoft', colors.accent, colors.accentSoft],
  ];
  test.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  test('쓰이는 나머지 쌍도 4.5 이상: text / card · text / bubbleAi · sub / card 는 제외(sub 는 bg 위에서만 쓴다)', () => {
    expect(contrast(colors.text, colors.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.text, colors.bubbleAi)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Button', () => {
  test('보조 변형은 아이보리(bg) 면 + line 1 선 · 모서리 16(버튼 v3 A안, D-141)', async () => {
    const tree = await mount(<Button label="수정하기" variant="secondary" testID="b" />);
    const s = styleOf(must(tree, 'b'));
    expect(s.backgroundColor).toBe(colors.bg);
    expect(s.borderWidth).toBe(1);
    expect(s.borderColor).toBe(colors.line);
    expect(s.borderRadius).toBe(radius.lg);
    expect(s.minHeight).toBe(size.button);
  });
  test('주 변형은 accent 채움', async () => {
    const tree = await mount(<Button label="시작" testID="b" />);
    expect(styleOf(must(tree, 'b')).backgroundColor).toBe(colors.accent);
  });
});

describe('Chip 3종', () => {
  test('선택: accentSoft 면 + accent 1px 선 + 체크(UI v2 · 가이드 4-4, F21)', async () => {
    const tree = await mount(<Chip label="a" variant="selected" testID="c" />);
    const s = styleOf(must(tree, 'c'));
    expect(s).toMatchObject({ backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.pill, minHeight: size.chip });
    expect(tree.root.findAll((n) => n.props.testID === 'c-check').length).toBeGreaterThan(0);
  });
  test('태그: accentSoft 채움', async () => {
    const tree = await mount(<Chip label="a" variant="tag" testID="c" />);
    expect(styleOf(must(tree, 'c')).backgroundColor).toBe(colors.accentSoft);
  });
  test('비활성: bg + line 선', async () => {
    const tree = await mount(<Chip label="a" variant="inactive" testID="c" />);
    expect(styleOf(must(tree, 'c'))).toMatchObject({ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line });
  });
  test('누르는 칩은 터치 영역이 44 이상이고 onPress 를 부른다', async () => {
    const onPress = jest.fn();
    const tree = await mount(<Chip label="a" variant="selected" onPress={onPress} testID="c" />);
    expect(styleOf(must(tree, 'c')).minHeight).toBeGreaterThanOrEqual(size.touchMin);
    await act(async () => {
      must(tree, 'c').props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('D8 M1: 읽기 화면(LegalReader) 탭 칩이 공통 Chip 이다', () => {
  jest.mock('react-native-safe-area-context', () => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
  });

  test('고른 문서는 selected(accentSoft + accent 1px 선 — UI v2), 다른 문서는 inactive(bg + line 1px 선), 높이 32 · pill · 터치 48', async () => {
    const tree = await mount(<LegalReader visible initial="privacy" onClose={() => undefined} />);
    const privacy = tree.root.findAll((n) => n.props.testID === 'legal-tab-privacy' && n.props.variant !== undefined)[0];
    const terms = tree.root.findAll((n) => n.props.testID === 'legal-tab-terms' && n.props.variant !== undefined)[0];
    expect(privacy.type).toBe(Chip);
    expect(privacy.props.variant).toBe('selected');
    expect(terms.props.variant).toBe('inactive');
    const body = (chip: typeof privacy) => styleOf(chip.findAll((n) => typeof n.type === 'string' && n.props.style !== undefined && flat(n.props.style).borderRadius === radius.pill)[0]);
    expect(body(privacy)).toMatchObject({ backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, minHeight: size.chip });
    expect(body(terms)).toMatchObject({ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, minHeight: size.chip });
  });
});

describe('Bubble 2종', () => {
  test('AI: bubbleAi · 최대 폭 264 · 둥글기 16', async () => {
    const tree = await mount(<Bubble role="ai" text="안녕" testID="x" />);
    expect(styleOf(must(tree, 'x'))).toMatchObject({ backgroundColor: colors.bubbleAi, maxWidth: 264, borderRadius: 16 });
  });
  test('내: accentAlt', async () => {
    const tree = await mount(<Bubble role="me" text="안녕" testID="x" />);
    expect(styleOf(must(tree, 'x'))).toMatchObject({ backgroundColor: colors.accentAlt, maxWidth: layout.bubbleMaxWidth });
  });
});

describe('Avatar · SendButton · Card · LockNote', () => {
  test('아바타: accentSoft 원 32', async () => {
    const tree = await mount(<Avatar testID="a" />);
    expect(styleOf(must(tree, 'a'))).toMatchObject({ width: 32, height: 32, backgroundColor: colors.accentSoft, borderRadius: radius.pill });
  });
  test('보내기: accent 원 40 · 누르면 onPress', async () => {
    const onPress = jest.fn();
    const tree = await mount(<SendButton accessibilityLabel="보내기" onPress={onPress} testID="s" />);
    expect(styleOf(must(tree, 's'))).toMatchObject({ width: 40, height: 40, backgroundColor: colors.accent });
    await act(async () => {
      must(tree, 's').props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  test('카드: card 채움 · 둥글기 16 · 안쪽 20', async () => {
    const tree = await mount(<Card testID="k" />);
    expect(styleOf(must(tree, 'k'))).toMatchObject({ backgroundColor: colors.card, borderRadius: 16, padding: 20 });
  });
  test('하단 안내 글이 그대로 보인다', async () => {
    const tree = await mount(<LockNote text="안내 글" textTestID="n" />);
    expect(must(tree, 'n').props.children).toBe('안내 글');
  });
});

describe('TextField · ScreenHeader', () => {
  test('입력: 둥글기 12(UI v2 — 알약 대신) · card 채움 · 자리표시 sub', async () => {
    const tree = await mount(<TextField label="e" value="" onChangeText={() => {}} placeholder="p" testID="t" />);
    const node = must(tree, 't');
    expect(styleOf(node)).toMatchObject({ borderRadius: radius.md, backgroundColor: colors.card, minHeight: size.input });
    expect(node.props.placeholderTextColor).toBe(colors.sub);
  });
  test('머리: 오른쪽 글자 링크가 눌린다', async () => {
    const onRight = jest.fn();
    const tree = await mount(<ScreenHeader title="제목" onBack={() => {}} rightLabel="링크" onRight={onRight} testID="h" />);
    await act(async () => {
      must(tree, 'h-right').props.onPress();
    });
    expect(onRight).toHaveBeenCalledTimes(1);
  });
});
