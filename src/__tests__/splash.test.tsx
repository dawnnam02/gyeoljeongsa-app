// 앱 안 스플래시(D15 · F17 D25 장면 1) · 도는 원(D8 2차): 로고 타일 찍힘 + 글자 로고 + 한 줄 · 3초 넘으면 링 + "불러오는 중이에요" · 2100ms 뒤(준비가 끝나면) 종이 펼침으로 걷힘 ·
// 동작 줄이기에서 링 정지 · 투명도만 150 ·
// 바탕 원은 line 토큰, 호는 accent(accent 20% 아님)
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';

import { Ring } from '@/components/Ring';
import { COMMON, ONBOARDING } from '@/content/copy';
import { AppSplash, SPLASH_REDUCED_WAIT } from '@/features/splash/AppSplash';
import { scene } from '@/motion';
import { reduceMotionStore } from '@/lib/reduceMotion';
import { layout } from '@/theme/layout';
import { colors } from '@/theme/tokens';

import { APP_DIR, outsidePath, testOutside } from './helpers/outsideDocs';
import { find, has, hasText, mount as mountRaw, must } from './renderHelpers';

// 시험이 끝나면 그린 것을 모두 치운다(남은 애니메이션이 다음 시험으로 새지 않게)
const mounted: Awaited<ReturnType<typeof mountRaw>>[] = [];
const mount: typeof mountRaw = async (element) => {
  const tree = await mountRaw(element);
  mounted.push(tree);
  return tree;
};

const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotionStore.set(false);
});
afterEach(async () => {
  await act(async () => {
    for (const tree of mounted.splice(0)) tree.unmount();
  });
  jest.useRealTimers();
  reduceMotionStore.set(false);
});

describe('스플래시', () => {
  test('로고 타일(D31) · 글자 로고 · 브랜드 한 줄(카피.md 01 제목과 같은 글) · 바탕 bgGrad 360 이 있고, 처음에는 링 · 안내가 없다(움직이는 주인공은 타일 하나)', async () => {
    const tree = await mount(<AppSplash ready={false} />);
    expect(has(tree, 'splash')).toBe(true);
    expect(has(tree, 'splash-tile')).toBe(true);
    expect(has(tree, 'splash-wordmark')).toBe(true);
    expect(has(tree, 'splash-backdrop')).toBe(true);
    expect(StyleSheet.flatten(tree.root.findAll((n) => typeof n.type === 'string' && n.props?.testID === 'splash-backdrop')[0].props.style).height).toBe(360);
    expect(hasText(tree, ONBOARDING.brandLine)).toBe(true);
    expect(ONBOARDING.brandLine).toBe(ONBOARDING.slides[0].title);
    expect(has(tree, 'splash-ring')).toBe(false);
    expect(has(tree, 'splash-slow')).toBe(false);
    expect(must(tree, 'splash').props.accessibilityLabel).toBe(COMMON.loading); // 스크린리더에는 "불러오는 중이에요" 하나
  });

  test('3초(3000ms)가 넘도록 준비가 안 끝나면 "불러오는 중이에요"를 더한다. 그 전에는 없다', async () => {
    const tree = await mount(<AppSplash ready={false} />);
    await tick(layout.splashSlowMs - 1);
    expect(has(tree, 'splash-slow')).toBe(false);
    await tick(2);
    expect(has(tree, 'splash-slow')).toBe(true);
    expect(has(tree, 'splash-ring')).toBe(true);
    expect(hasText(tree, COMMON.loading)).toBe(true);
  });

  test('준비가 3초 안에 끝나면 안내 없이 걷힌다: 2100ms 전에는 펼치지 않고, 펼침(700ms)이 끝나면 사라진다', async () => {
    const tree = await mount(<AppSplash ready={false} />);
    await tick(1000);
    await act(async () => {
      tree.update(<AppSplash ready />);
    });
    await tick(scene.splash.unfoldAt - 1000 - 10);
    expect(find(tree, 'splash')).not.toBeNull(); // 찍힘 · 글자가 다 보일 때까지는 남는다
    await tick(20);
    await tick(scene.splash.unfold - 10);
    expect(find(tree, 'splash')).not.toBeNull(); // 펼치는 중
    await tick(20);
    expect(has(tree, 'splash-slow')).toBe(false);
    expect(find(tree, 'splash')).toBeNull();
  });

  test('준비가 늦으면(3초 넘음) 준비가 끝나는 때 바로 펼친다', async () => {
    const tree = await mount(<AppSplash ready={false} />);
    await tick(4000);
    expect(has(tree, 'splash-slow')).toBe(true);
    await act(async () => {
      tree.update(<AppSplash ready />);
    });
    await tick(scene.splash.unfold + 10);
    expect(find(tree, 'splash')).toBeNull();
  });

  test('시스템 스플래시를 걷어도 되는 때(처음 그려졌을 때) 알린다', async () => {
    const onShown = jest.fn();
    const tree = await mount(<AppSplash ready={false} onShown={onShown} />);
    await act(async () => {
      must(tree, 'splash').props.onLayout?.({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    });
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  test('동작 줄이기: 펼침 없이 투명도만 150ms 로 사라지고, 기다림도 0.35배', async () => {
    reduceMotionStore.set(true);
    const tree = await mount(<AppSplash ready={false} />);
    await act(async () => {
      tree.update(<AppSplash ready />);
    });
    await tick(Math.round(scene.splash.unfoldAt * SPLASH_REDUCED_WAIT) + 10);
    await tick(160);
    expect(find(tree, 'splash')).toBeNull();
  });

  test('규격 값: 로고 160 · 링 24 두께 3 · 안내 3000ms · 페이드 200ms', () => {
    expect(layout.splashLogoWidth).toBe(160);
    expect(layout.splashLogoHeight).toBeCloseTo(70.0, 0); // D17 B1: 여백 없는 로고 160 ÷ 2.287
    expect(layout.logoHeight).toBeCloseTo(52.5, 0); // D17 B2: 01 120 ÷ 2.287
    expect(layout.splashRing).toBe(24);
    expect(layout.splashRingStroke).toBe(3);
    expect(layout.splashSlowMs).toBe(3000);
    expect(layout.splashFadeMs).toBe(200);
  });
});

describe('도는 원(Ring)', () => {
  const borderOf = (tree: Awaited<ReturnType<typeof mount>>, id: string) => StyleSheet.flatten(must(tree, id).props.style);

  test('바탕 원은 line 토큰, 호는 accent 이다(accent 20% 가 아니다)', async () => {
    const tree = await mount(<Ring size={96} stroke={8} testID="ring" />);
    const base = tree.root.findAll((n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.borderColor === colors.line);
    expect(base.length).toBeGreaterThan(0);
    expect(borderOf(tree, 'ring-arc').borderTopColor).toBe(colors.accent);
    expect(borderOf(tree, 'ring-arc').borderColor).not.toBe(colors.accent); // 호 말고 나머지 둘레는 칠하지 않는다
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/rgba\(155, ?59, ?82, ?0\.2\)/);
  });

  test('호는 시계 방향으로 돈다(transform rotate). 동작 줄이기에서는 회전 값이 0도에 멈춘다', async () => {
    const tree = await mount(<Ring size={24} stroke={3} testID="ring" />);
    expect(JSON.stringify(borderOf(tree, 'ring-arc').transform)).toContain('rotate');
    await act(async () => {
      reduceMotionStore.set(true);
    });
    await tick(500);
    const stopped = JSON.stringify(borderOf(tree, 'ring-arc').transform);
    await tick(450);
    expect(JSON.stringify(borderOf(tree, 'ring-arc').transform)).toBe(stopped);
    expect(stopped).toContain('0deg');
  });
});

describe('이미지 파일(D15)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  const same = (from: string, to: string) => fs.readFileSync(outsidePath(from)).equals(fs.readFileSync(path.join(APP_DIR, to)));

  testOutside(['디자인/스플래시', '디자인/온보딩'])('스플래시 3개 · 소개 그림 3장(+@2x)이 디자인 원본과 같다', () => {
    expect(same('디자인/스플래시/splash_1284x2778.png', 'assets/splash/splash_1284x2778.png')).toBe(true);
    expect(same('디자인/스플래시/splash_android_1080x1920.png', 'assets/splash/splash_android_1080x1920.png')).toBe(true);
    expect(same('디자인/스플래시/splash_icon_288.png', 'assets/splash/splash_icon.png')).toBe(true);
    for (const n of [1, 2, 3]) {
      expect(same(`디자인/온보딩/intro_${n}.png`, `assets/onboarding/intro_${n}.png`)).toBe(true);
      expect(same(`디자인/온보딩/intro_${n}@2x.png`, `assets/onboarding/intro_${n}@2x.png`)).toBe(true);
    }
  });

  test('app.json 스플래시: 배경 bg 토큰 · contain · Android 12 아이콘(drawable.icon)이 288 아이콘', () => {
    const config = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'app.json'), 'utf8')) as { expo: { plugins: unknown[] } };
    const entry = config.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>];
    expect(entry[1].backgroundColor).toBe(colors.bg);
    expect(entry[1].resizeMode).toBe('contain');
    expect(entry[1].image).toBe('./assets/splash/splash_icon.png');
    expect((entry[1].android as { drawable: { icon: string } }).drawable.icon).toBe('./assets/splash/splash_icon.png');
    for (const file of ['splash_icon.png', 'splash_1284x2778.png', 'splash_android_1080x1920.png']) expect(fs.existsSync(path.join(APP_DIR, 'assets', 'splash', file))).toBe(true);
  });
});
