// F13a 통과 조건 1 · 2 · 3: H1 그림 파일 · 등록 · 연결 · 원형 프로필 모양
import fs from 'node:fs';
import path from 'node:path';

import { Image, StyleSheet } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { ProfileAvatar } from '@/components/ProfileAvatar';
import { LikesEmpty } from '@/features/likes/LikesParts';
import { LoadState } from '@/features/settings/SettingsParts';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { forgetMyFace } from '@/store/myFaceStore';
import { colors } from '@/theme/tokens';
import { Icon } from '@/components/Icon';
import { ICON_PATHS } from '@/components/iconPaths';
import { H2_DONE_ART, H2_EMPTY_ART, H2_INFO_ART, H2_LINK_ART, H2_PHOTO_GUIDE, H2_SETTING_ICONS, H2_STATE_ART, SHOP_ICONS, STATE_ART } from '@/theme/uiAssets';

import { testOutside } from './helpers/outsideDocs';
import { has, mount } from './renderHelpers';
import { makeShopRig } from './shopRig';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: () => Promise.resolve(null) }, shopApi: {}, gradeApi: {}, supabase: {} }));

const APP = path.resolve(__dirname, '..', '..');
const ICONS = path.join(APP, 'assets', 'icons');
const DESIGN = path.resolve(APP, '..', '디자인', '아이콘');

// [폴더, 이름, 기준 dp] — 상점 · 등급 관리 아이콘 10 · 등급 배지 10 은 D42-C 에서 공용 아이콘(1안)으로 바뀌어 PNG 를 지웠다. 남은 것은 상태 그림 3
const FILES: [string, string, number][] = [...['empty-error-15', 'empty-shop-fail', 'empty-no-tier'].map((n): [string, string, number] => ['state', n, 144])];

function pngSize(file: string): { w: number; h: number; alpha: boolean } {
  const b = fs.readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: b[25] === 6 };
}

describe('조건 1 · 그림 파일 3종 × 밀도 3', () => {
  test('이름.png · @2x · @3x 가 기준 dp 의 1 · 2 · 3배 정사각 PNG(알파 있음)다', () => {
    expect(FILES).toHaveLength(3);
    for (const [dir, name, base] of FILES) {
      for (const [suffix, k] of [['', 1], ['@2x', 2], ['@3x', 3]] as const) {
        const info = pngSize(path.join(ICONS, dir, `${name}${suffix}.png`));
        expect(info).toEqual({ w: base * k, h: base * k, alpha: true });
      }
    }
  });

  testOutside(['디자인/아이콘'])('디자인 원본(투명 25~37 · 등급)이 옆에 있으면 앱 그림이 그 원본을 줄인 것이다: 원본 개수 일치', () => {
    if (!fs.existsSync(DESIGN)) return;
    const transparent = fs.readdirSync(path.join(DESIGN, '투명')).filter((f) => /^(2[5-9]|3[0-7])_/.test(f));
    expect(transparent).toHaveLength(13);
    const grades = fs.readdirSync(path.join(DESIGN, '등급')).filter((f) => /^등급_(\d|잠김)\.png$/.test(f));
    expect(grades).toHaveLength(10);
  });
});

describe('조건 1 · uiAssets 등록', () => {
  test('상품 · 관리 10(1안 아이콘 이름) · 상태 3 이 이름 붙여 등록돼 있고, 숫자 등급 배지(TIER_BADGES)는 없다', () => {
    expect(Object.keys(SHOP_ICONS)).toHaveLength(10);
    for (const name of Object.values(SHOP_ICONS)) expect(Object.keys(ICON_PATHS)).toContain(name);
    expect(Object.keys(STATE_ART)).toEqual(['error15', 'shopFail', 'noTier']);
    const source = fs.readFileSync(path.join(APP, 'src', 'theme', 'uiAssets.ts'), 'utf8');
    expect(source).not.toMatch(/export const TIER_BADGE/);
    for (const [dir, name] of FILES) expect(source).toContain(`../../assets/icons/${dir}/${name}.png`);
  });
});

describe('조건 2 · 16 상점 카드 상품 아이콘', () => {
  const shown: ReactTestRenderer[] = [];
  afterEach(() => act(() => shown.splice(0).forEach((t) => t.unmount())));

  test("16 상점: ④ 무료 '내 성향 리포트' 줄에 27 · '내 등급 알려 주세요'에 28 · 등급 구독 카드에 25 · 1회 매칭 카드에 26 · 살 수 있는 상품 줄에 29 · 30 그림이 붙는다", async () => {
    const { deps } = await makeShopRig();
    const tree = await mount(<ShopScreen deps={deps} />);
    shown.push(tree);
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    const icons = tree.root.findAllByType(Icon);
    const report = icons.find((n) => n.props.testID === 'shop-report-icon')!;
    expect(report.props).toMatchObject({ name: SHOP_ICONS.traitReport, size: 28 });
    const names = icons.map((i) => i.props.name);
    for (const icon of [SHOP_ICONS.tierSubscription, SHOP_ICONS.oneMatch, SHOP_ICONS.myTierView, SHOP_ICONS.pastRecsPass, SHOP_ICONS.likeLetter]) expect(names).toContain(icon);
  });
});

describe('조건 3 · 원형 프로필 모양', () => {
  const shown: ReactTestRenderer[] = [];
  beforeEach(() => act(() => forgetMyFace()));
  afterEach(() => act(() => shown.splice(0).forEach((t) => t.unmount())));

  test('기본 그림 원과 사진 원이 같은 크기 · 같은 둥글기 · 같은 accentSoft 바탕이다(색이 다른 빈 원이 되지 않는다)', async () => {
    const def = await mount(<ProfileAvatar width={32} testID="d" />);
    const photo = await mount(<ProfileAvatar uri="data:image/png;base64,AAAA" width={32} testID="p" />);
    shown.push(def, photo);
    const of = (tree: ReactTestRenderer, id: string) => StyleSheet.flatten(tree.root.findAll((n) => n.props.testID === id).at(-1)!.props.style) as Record<string, unknown>;
    const a = of(def, 'd');
    const b = of(photo, 'p');
    expect(b).toMatchObject({ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.accentSoft });
    expect(a).toMatchObject({ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' });
    expect(photo.root.findAllByType(Image)[0].props.source).toEqual({ uri: 'data:image/png;base64,AAAA' });
  });
});

describe('조건 5 · H2 새 그림 38~75', () => {
  const ART = ['connected-mutual', 'done-card-check', 'done-like-sent', 'wait-checking', 'empty-blocked', 'empty-reports', 'empty-sent-likes', 'empty-pass', 'empty-history', 'empty-recs-end', 'empty-restore', 'empty-notifications', 'state-maintenance', 'state-update', 'state-offline', 'state-photo-permission', 'photo-guide-face', 'photo-guide-full', 'photo-guide-free', 'photo-guide-approved', 'info-analyzing', 'info-traits-adjust', 'info-verify-soon', 'info-notify-permission', 'done-withdraw', 'done-report', 'state-like-expired', 'done-pass-restore', 'done-data-delete', 'state-delete-scheduled', 'info-get-my-data', 'info-security'];
  const SETTING = ['setting-visibility', 'setting-security', 'setting-consent', 'photo-delete', 'photo-reupload', 'setting-safety'];
  const shown: ReactTestRenderer[] = [];
  afterEach(() => act(() => shown.splice(0).forEach((t) => t.unmount())));

  test('그림 32종은 기준 144 · 각 밀도 1 · 2 · 3배 PNG(알파 있음) — 설정 아이콘 6종은 D42-C 에서 1안 아이콘이 되어 PNG 를 지웠다', () => {
    expect(ART).toHaveLength(32);
    for (const name of ART) for (const [suffix, k] of [['', 1], ['@2x', 2], ['@3x', 3]] as const) expect(pngSize(path.join(ICONS, 'art', `${name}${suffix}.png`))).toEqual({ w: 144 * k, h: 144 * k, alpha: true });
    for (const name of SETTING) expect(fs.existsSync(path.join(ICONS, 'settings', `${name}.png`))).toBe(false);
  });

  test('uiAssets 에 38개 모두 이름 붙여 등록돼 있다', () => {
    const groups = [H2_LINK_ART, H2_EMPTY_ART, H2_STATE_ART, H2_PHOTO_GUIDE, H2_INFO_ART, H2_DONE_ART];
    expect(groups.reduce((n, g) => n + Object.keys(g).length, 0)).toBe(32);
    expect(Object.keys(H2_SETTING_ICONS)).toHaveLength(6);
    const source = fs.readFileSync(path.join(APP, 'src', 'theme', 'uiAssets.ts'), 'utf8');
    for (const name of ART) expect(source).toContain(`../../assets/icons/art/${name}.png`);
    for (const name of Object.values(H2_SETTING_ICONS)) expect(Object.keys(ICON_PATHS)).toContain(name);
  });

  test('12 목록 빈 상태: 그림이 붙는다(art 를 주면), 안 주면 글만', async () => {
    const withArt = await mount(<LoadState state="empty" empty="비었어요" art={H2_EMPTY_ART.emptyBlocked} onRetry={() => {}} testID="x" />);
    const plain = await mount(<LoadState state="empty" empty="비었어요" onRetry={() => {}} testID="y" />);
    shown.push(withArt, plain);
    expect(has(withArt, 'x-empty-art')).toBe(true);
    expect(has(plain, 'y-empty-art')).toBe(false);
  });

  test('불러오기 실패: 인터넷 끊김(network)일 때만 52 그림, 서버 오류는 그림 없음', async () => {
    const net = await mount(<LoadState state="network" onRetry={() => {}} testID="n" />);
    const srv = await mount(<LoadState state="server" onRetry={() => {}} testID="s" />);
    shown.push(net, srv);
    expect(has(net, 'offline-art')).toBe(true);
    expect(has(srv, 'offline-art')).toBe(false);
  });

  test('11 보낸 호감 빈 상태에 44 그림 · 연결됨 빈 상태에는 새 그림을 붙이지 않았다', async () => {
    const sent = await mount(<LikesEmpty tab="sent" onRecs={() => {}} />);
    shown.push(sent);
    expect(has(sent, 'likes-empty-sent-art')).toBe(true);
  });

  test('화면 코드가 그림을 가리킨다: 05 사진 칸 가이드 54~56 · 09 목록 끝 47 · 불러오기 실패 52', () => {
    const read = (f: string) => fs.readFileSync(path.join(APP, 'src', f), 'utf8');
    expect(read('features/photosLite/PhotosLiteScreen.tsx')).toContain('H2_PHOTO_GUIDE.photoGuideFace');
    expect(read('features/recs/RecommendationsScreen.tsx')).toContain('H2_EMPTY_ART.emptyRecsEnd');
    for (const f of ['likes/LikesScreen', 'profile/ProfileScreen', 'recs/CandidateScreen', 'recs/RecommendationsScreen', 'ai/TraitsScreen', 'consent/ConsentScreen', 'photosLite/PhotosLiteScreen']) expect(read(`features/${f}.tsx`)).toContain('<OfflineArt');
    expect(read('features/settings/ListPages.tsx')).toContain('H2_EMPTY_ART.emptyBlocked');
    expect(read('features/settings/ListPages.tsx')).toContain('H2_EMPTY_ART.emptyReports');
  });
});
