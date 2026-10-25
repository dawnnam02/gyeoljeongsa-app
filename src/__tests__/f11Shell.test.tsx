// F11 통과 조건 1 · 2 · 3 · 4: 하단 탭 상점 · 머리 오른쪽 위 원형 프로필 사진(지름 32 · 터치 44) · 기본 프로필 그림 · 16 상점 카드 · 08 은 탭 밖
import fs from 'node:fs';
import path from 'node:path';

import { Image, StyleSheet } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ProfileButton } from '@/components/ProfileButton';
import { TabHeader } from '@/components/TabHeader';
import { A11Y, SHOP, TABS } from '@/content/copy';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { forgetMyFace, isFaceStale, refreshMyFace, useMyFaceStore, FACE_FRESH_MS, FACE_RETRY_MS } from '@/store/myFaceStore';
import { layout } from '@/theme/layout';
import { TAB_ICONS } from '@/theme/tabIcons';
import { AVATAR_ART } from '@/theme/uiAssets';
import { alpha, size } from '@/theme/tokens';

import { testOutside } from './helpers/outsideDocs';
import { allTexts, find, has, hasText, mount, must, press, textOf } from './renderHelpers';
import { makeShopRig } from './shopRig';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
const mockFace = jest.fn<Promise<string | null>, []>();
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: () => mockFace() }, shopApi: {}, gradeApi: {}, supabase: {} }));

// 켜 둔 화면은 시험마다 내린다(안 내리면 저장소가 바뀔 때 앞 시험의 화면이 다시 읽는다)
const shown: ReactTestRenderer[] = [];
async function show(element: React.ReactElement): Promise<ReactTestRenderer> {
  const tree = await mount(element);
  shown.push(tree);
  return tree;
}
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
// testID 가 겹칠 때(부품 → 안쪽 칸) 실제 칸(host 요소)을 잡는다
const host = (tree: ReactTestRenderer, id: string) => {
  const node = tree.root.findAll((n) => n.props.testID === id).at(-1);
  if (!node) throw new Error(`host "${id}" 없음`);
  return node;
};

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockFace.mockResolvedValue(null);
  act(() => forgetMyFace());
});

describe('조건 2 · 기본 프로필 그림 부품(ProfileAvatar)', () => {
  test('지름 32 원: 사진이 없으면 빛 실루엣 한 장(D42-P), 테두리 없음', async () => {
    const tree = await show(<ProfileAvatar width={size.avatar} testID="av" />);
    expect(has(tree, 'av-default')).toBe(true);
    expect(flat(host(tree, 'av').props.style)).toMatchObject({ width: 32, height: 32, borderRadius: 16 });
    expect(flat(host(tree, 'av').props.style).borderWidth).toBeUndefined();
  });

  test('사진 주소가 있으면 그 사진을 원으로 자른다 · 못 불러오면(onError) 같은 기본 그림으로 바뀐다', async () => {
    const tree = await show(<ProfileAvatar uri="https://example.test/me.jpg" width={32} testID="av" />);
    expect(has(tree, 'av-default')).toBe(false);
    const img = tree.root.findAllByType(Image)[0];
    expect(img.props.source).toEqual({ uri: 'https://example.test/me.jpg' });
    await act(async () => img.props.onError());
    expect(has(tree, 'av-default')).toBe(true);
  });

  test('기본 그림은 자리 크기 · 모양과 상관없이 칸을 꽉 채운다(cover) — 32 · 72 원 · 96×120 · 348×220 사각', async () => {
    const art = (tree: ReactTestRenderer) => host(tree, 'av-default').props;
    for (const el of [
      <ProfileAvatar key="a" width={32} testID="av" />,
      <ProfileAvatar key="b" width={72} testID="av" />,
      <ProfileAvatar key="c" width={96} height={120} round={false} radiusSize={8} testID="av" />,
      <ProfileAvatar key="d" width={348} height={220} round={false} radiusSize={12} testID="av" />,
    ]) {
      const t = await show(el);
      expect(flat(art(t).style)).toMatchObject({ width: '100%', height: '100%' });
      expect(art(t).resizeMode).toBe('cover');
      expect(art(t).source).toBe(AVATAR_ART.silhouette);
      expect(flat(host(t, 'av').props.style).backgroundColor).toBeTruthy(); // accentSoft 면
    }
    const card = await show(<ProfileAvatar width={96} height={120} round={false} radiusSize={8} testID="av" />);
    expect(flat(host(card, 'av').props.style)).toMatchObject({ borderRadius: 8 });
  });
});

describe('조건 2 · 원형 프로필 버튼(ProfileButton)', () => {
  test('터치 48 × 48 · 원 32 가운데 · 이름 "내 프로필" · 역할 버튼 · 눌림 85%(scale 없음)', async () => {
    const tree = await show(<ProfileButton />);
    const btn = must(tree, 'profile-button');
    expect(btn.props.accessibilityLabel).toBe(A11Y.myProfile);
    expect(A11Y.myProfile).toBe('내 프로필');
    expect(btn.props.accessibilityRole).toBe('button');
    const rest = flat(typeof btn.props.style === 'function' ? btn.props.style({ pressed: false }) : btn.props.style);
    expect(rest).toMatchObject({ width: size.avatarTouch, height: size.avatarTouch, alignItems: 'center', justifyContent: 'center' });
    const down = flat(btn.props.style({ pressed: true }));
    expect(down.opacity).toBe(alpha.pressed);
    expect(flat(host(tree, 'profile-button-avatar').props.style)).toMatchObject({ width: size.avatar, height: size.avatar });
    expect([size.avatar, size.avatarTouch]).toEqual([32, 48]);
  });

  test('누르면 08(/profile)로 간다', async () => {
    const tree = await show(<ProfileButton />);
    await press(tree, 'profile-button');
    expect(mockRouter.push).toHaveBeenCalledWith('/profile');
  });

  test('사진이 없으면(읽기 null) 기본 프로필 그림, 있으면 그 사진', async () => {
    const none = await show(<ProfileButton />);
    expect(has(none, 'profile-button-avatar-default')).toBe(true);
    act(() => none.unmount()); // 앞 화면을 내린 뒤 저장소를 비운다
    act(() => forgetMyFace());
    mockFace.mockResolvedValue('https://example.test/face.jpg');
    const photo = await show(<ProfileButton />);
    expect(has(photo, 'profile-button-avatar-default')).toBe(false);
    expect(photo.root.findAllByType(Image).some((i) => (i.props.source as { uri?: string })?.uri === 'https://example.test/face.jpg')).toBe(true);
  });

  test('머리(TabHeader): 제목 + 오른쪽 위 버튼, 버튼의 터치 끝이 화면 끝에서 12', async () => {
    const tree = await show(<TabHeader title="상점" testID="h" />);
    expect(has(tree, 'profile-button')).toBe(true);
    expect(hasText(tree, '상점')).toBe(true);
    expect(layout.profileButtonInset).toBe(12);
    expect(flat(host(tree, 'h').props.style)).toMatchObject({ minHeight: size.header, paddingLeft: 20, paddingRight: 12 });
  });
});

describe('내 얼굴 사진 주소 저장소(myFaceStore)', () => {
  test('여섯 화면이 동시에 물어도 읽기는 한 번이고, 4분 안에는 다시 읽지 않는다', async () => {
    mockFace.mockResolvedValue('https://example.test/a.jpg');
    const source = { facePhotoUrl: () => mockFace() };
    await Promise.all([1, 2, 3, 4, 5, 6].map(() => refreshMyFace(source)));
    await refreshMyFace(source);
    expect(mockFace).toHaveBeenCalledTimes(1);
    expect(useMyFaceStore.getState().uri).toBe('https://example.test/a.jpg');
  });

  test('못 받으면 null 을 두고 30초 뒤 다시 확인 · 받았으면 4분 · 비우면 바로', () => {
    expect(isFaceStale({ uri: null, checkedAt: 1000 }, 1000 + FACE_RETRY_MS - 1)).toBe(false);
    expect(isFaceStale({ uri: null, checkedAt: 1000 }, 1000 + FACE_RETRY_MS)).toBe(true);
    expect(isFaceStale({ uri: 'x', checkedAt: 1000 }, 1000 + FACE_RETRY_MS)).toBe(false);
    expect(isFaceStale({ uri: 'x', checkedAt: 1000 }, 1000 + FACE_FRESH_MS)).toBe(true);
    expect(isFaceStale({ uri: 'x', checkedAt: 0 }, 5)).toBe(true);
  });

  test('읽기가 터져도 기본 그림(null)으로 계속 · 읽는 동안 비우면(로그아웃) 늦게 온 주소는 버린다', async () => {
    await refreshMyFace({ facePhotoUrl: () => Promise.reject(new Error('x')) });
    expect(useMyFaceStore.getState().uri).toBeNull();
    expect(useMyFaceStore.getState().checkedAt).toBeGreaterThan(0);
    act(() => forgetMyFace());
    let release!: (v: string) => void;
    const slow = refreshMyFace({ facePhotoUrl: () => new Promise<string>((r) => (release = r)) });
    act(() => forgetMyFace());
    release('https://example.test/old.jpg');
    await slow;
    expect(useMyFaceStore.getState().uri).toBeNull();
    expect(useMyFaceStore.getState().checkedAt).toBe(0);
  });
});

describe('조건 3 · 16 상점', () => {
  test('머리 "상점" + 오른쪽 위 원형 사진 · 무료 구역 "내 성향 리포트"(태그 "무료" + 한 줄 설명) · 목록 화면은 탭 화면이다', async () => {
    const { deps } = await makeShopRig();
    const tree = await show(<ShopScreen deps={deps} />);
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    expect(has(tree, 'screen-16')).toBe(true);
    expect(hasText(tree, '상점')).toBe(true);
    expect(textOf(tree, 'shop-report-title')).toBe('내 성향 리포트');
    expect(textOf(tree, 'shop-report-body')).toBe('AI가 정리한 내 성향을 한눈에 다시 볼 수 있어요.');
    expect(hasText(tree, '무료')).toBe(true);
    expect(find(tree, 'shop-report')?.props.accessibilityLabel).toContain('내 성향 리포트');
    expect(has(tree, 'profile-button')).toBe(true); // 머리 오른쪽 위 원형 사진
    expect(SHOP).toMatchObject({ headerTitle: '상점', reportTitle: '내 성향 리포트', reportFree: '무료' });
    expect(allTexts(tree).length).toBeGreaterThan(10); // 결제 전(0단계)의 카드 하나뿐인 화면은 F13 에서 상품 목록으로 바뀌었다
  });

  test('탭 이름은 추천 · 호감 · 상점 · 설정', () => {
    expect(Object.values(TABS)).toEqual(['추천', '호감', '상점', '설정']);
  });
});

describe('조건 1 · 4 · 파일', () => {
  const APP = path.resolve(__dirname, '..', '..');

  test('상점 탭 아이콘은 공용 아이콘(1안 shop)이고 옛 PNG(tab/shop-off · shop-on-filled)는 지웠다(D42-C)', () => {
    expect(TAB_ICONS.shop).toBe('shop');
    expect(fs.existsSync(path.join(APP, 'assets', 'icons', 'tab'))).toBe(false);
  });

  testOutside(['디자인/D42_새판'])('기본 그림 = D42-P 빛 실루엣(원본과 바이트까지 같다) · 옛 default-profile · default-person 은 지웠다', () => {
    const avatar = path.join(APP, 'assets', 'icons', 'avatar');
    expect(fs.readdirSync(avatar)).toEqual(['default-silhouette.webp']);
    const src = path.resolve(APP, '..', '디자인', 'D42_새판', '인물', '1안_원본', 'webp', '기본이미지_실루엣.webp');
    if (!fs.existsSync(src)) return;
    expect(fs.readFileSync(path.join(avatar, 'default-silhouette.webp')).equals(fs.readFileSync(src))).toBe(true);
  });

  test('프로필 탭 아이콘은 지웠고, 08 은 (tabs) 밖 · 16 은 (tabs) 안에 있다', () => {
    expect(fs.existsSync(path.join(APP, 'assets', 'icons', 'tab', 'profile-off.png'))).toBe(false);
    expect(fs.existsSync(path.join(APP, 'src', 'app', 'profile.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(APP, 'src', 'app', '(tabs)', 'shop.tsx'))).toBe(true);
  });

  test('머리 오른쪽 위 원형 사진은 09 · 11 · 12 · 16(13 · 14 는 같은 화면)에 있고 08 · 10 에는 없다', () => {
    const src = (f: string) => fs.readFileSync(path.join(APP, 'src', ...f.split('/')), 'utf8');
    for (const f of ['features/recs/RecommendationsScreen.tsx', 'features/likes/LikesScreen.tsx', 'features/settings/SettingsScreen.tsx', 'features/shop/ShopScreen.tsx']) {
      expect(src(f)).toContain('<TabHeader');
    }
    for (const f of ['features/profile/ProfileScreen.tsx', 'features/recs/CandidateScreen.tsx']) {
      expect(src(f)).not.toContain('TabHeader');
      expect(src(f)).not.toContain('ProfileButton');
    }
  });
});
