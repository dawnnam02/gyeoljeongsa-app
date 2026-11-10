// TAB-1 하단 탭: 탑승권 · 채팅 · 사주 마당 · 설정(스위치 saju_yard 가 켜졌을 때만 — 꺼지면 3칸 · 빈자리 0) · 시작 화면은 탑승권 그대로 · 탭에 점 · 숫자 배지 0.
//  진짜 expo-router(뿌리 Stack + 실제 탭 레이아웃)로 돈다(f18Back 과 같은 틀).
import fs from 'node:fs';
import path from 'node:path';

import { Stack, router } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { store } from 'expo-router/build/global-state/router-store';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import TabsLayout from '@/app/(tabs)/_layout';
import { ICON_PATHS } from '@/components/iconPaths';
import { ICON_PATHS_EXTRA } from '@/components/iconPathsExtra';
import { IF5_TEXT } from '@/content/if5Copy';
import { TAB_ICONS } from '@/theme/tabIcons';

import { allTexts } from './renderHelpers';

jest.setTimeout(300_000);

jest.mock('expo-linking', () => ({
  ...jest.requireActual<object>('expo-linking'),
  createURL: (p: string) => `gjs://${p}`,
  resolveScheme: () => 'gjs',
  addEventListener: () => ({ remove() {} }),
}));
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, gradeApi: {}, settingsApi: {}, shopApi: {}, aiApi: {}, authApi: {}, profileApi: { facePhotoUrl: async () => null }, supabase: {} }));
// 탭 레이아웃이 읽는 스위치: saju_yard 만 시험이 바꾼다(추천 · 호감 · 상점은 V5 에서 숨김 그대로)
let mockYard = true;
jest.mock('@/navigation/v5Hide', () => ({
  ...jest.requireActual<object>('@/navigation/v5Hide'),
  useV4Screens: () => ({ ready: true, dailyRecs: false, likes: false, shop: false, sajuYard: mockYard }),
}));

const trees: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
  mockYard = true;
});

const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await flush();
};
const pathname = () => store.getRouteInfo().pathname;
const screen = (id: string) =>
  function TestScreen() {
    return <Text testID={`screen-${id}`}>{id}</Text>;
  };

async function renderTabs(initial: string) {
  const context = inMemoryContext({
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    '(tabs)/_layout': TabsLayout,
    '(tabs)/boarding': screen('boarding'),
    '(tabs)/chat': screen('chat'),
    '(tabs)/saju': screen('saju'),
    '(tabs)/settings': screen('settings'),
    '(tabs)/recommendations': screen('09'),
    '(tabs)/likes': screen('11'),
    '(tabs)/shop': screen('16'),
    '(tabs)/recommendations-empty': screen('13'),
    '(tabs)/likes-empty': screen('14'),
  });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExpoRoot context={context as never} location={initial} />);
  });
  trees.push(tree);
  await settle();
  return tree;
}

const tabIconIds = (tree: ReactTestRenderer) => {
  const ids = tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('tab-icon-')).map((n) => n.props.testID as string);
  return [...new Set(ids)];
};
const activeTabs = (tree: ReactTestRenderer) => [...new Set(tree.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('tab-bar-')).map((n) => n.props.testID as string))];

describe('TAB-1 하단 탭 4칸 · 3칸', () => {
  test('스위치 saju_yard 켜짐: 탑승권 · 채팅 · 사주 마당 · 설정 네 칸이 이 차례로 — 시작 화면은 탑승권', async () => {
    const tree = await renderTabs('/boarding');
    expect(tabIconIds(tree)).toEqual(['tab-icon-boarding', 'tab-icon-chat', 'tab-icon-saju', 'tab-icon-settings']);
    expect(pathname()).toBe('/boarding');
    expect(activeTabs(tree)).toEqual(['tab-bar-boarding']); // 켜진 탭은 탑승권 하나
    const texts = allTexts(tree);
    for (const label of ['탑승권', '채팅', IF5_TEXT['SAJU.madang.title'], '설정']) expect(texts).toContain(label);
    expect(IF5_TEXT['SAJU.madang.title']).toBe('사주 마당'); // 탭 이름(앱 안 글에 운세 · 타로 · 궁합 · 점 낱말 0)
  });
  test('스위치 saju_yard 꺼짐: 지금처럼 세 칸 · 사주 마당 칸 자리(빈자리) 0', async () => {
    mockYard = false;
    const tree = await renderTabs('/boarding');
    expect(tabIconIds(tree)).toEqual(['tab-icon-boarding', 'tab-icon-chat', 'tab-icon-settings']);
    expect(allTexts(tree)).not.toContain(IF5_TEXT['SAJU.madang.title']);
  });
  test('사주 마당 칸을 누르면(주소 /saju) 그 칸이 켜지고 탑승권 칸은 꺼진다 · 설정 탭 옆', async () => {
    const tree = await renderTabs('/boarding');
    await act(async () => router.navigate('/saju' as never));
    await settle();
    expect(pathname()).toBe('/saju');
    expect(activeTabs(tree)).toEqual(['tab-bar-saju']);
    await act(async () => router.navigate('/settings' as never));
    await settle();
    expect(activeTabs(tree)).toEqual(['tab-bar-settings']);
  });
  test('탭에 빨간 점 · 숫자 배지 · 새 글 표시가 없다 · 아이콘은 사주 마당 하나가 더해졌을 뿐이다', () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '..', 'app', '(tabs)', '_layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/tabBarBadge|Badge/);
    expect(layout).toContain("tabOptions('saju'");
    expect(TAB_ICONS.saju).toBe('saju');
    expect(Object.keys(TAB_ICONS)).toEqual(['boarding', 'chat', 'saju', 'recommendations', 'likes', 'shop', 'settings']);
  });
});

describe('TAB-1 탭 아이콘(공용 아이콘 규격 하나 더)', () => {
  test('saju 는 1안 원본 아이콘 이름과 겹치지 않고(원본 61개 그대로), 24 격자 안의 닫힌 면 네 개(네 기둥) — 켜진 탭에서 면이 채워지는 shape 뿐', () => {
    expect(Object.keys(ICON_PATHS)).not.toContain('saju');
    const parts = ICON_PATHS_EXTRA.saju.parts;
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(p.role).toBe('shape');
      expect(p.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/);
      expect(p.d.endsWith('z')).toBe(true);
      const nums = (p.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0); // 24 격자 밖 좌표 0
      expect(Math.max(...nums)).toBeLessThanOrEqual(24);
    }
  });
});
