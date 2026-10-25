// D42-I 그림 4안 앱 적용(D-176): 장면 12 × 라이트 · 다크 등록 · 다크 모드면 다크 판 · 쓰는 곳(온보딩 · 탑승권 상태 · 오류 · 채팅 빈 목록)

import { Illustration } from '@/components/Illustration';
import { OfflineArt } from '@/components/StateArt';
import { SCENE_OF } from '@/features/boarding/boardingArt';
import { illustration, ILLUSTRATIONS, INTRO_SCENES, type IllustrationScene } from '@/theme/illustrations';

import { mount, must } from './renderHelpers';

// 색 모드는 react-native 의 useColorScheme 을 바꿔 흉내 낸다(누름 부품 규칙 때문에 * import 대신 실제 모듈을 받는다)
const RN = jest.requireActual<typeof import('react-native')>('react-native');

const SCENES: IllustrationScene[] = ['onboarding1', 'onboarding2', 'onboarding3', 'waiting', 'ticket', 'reveal', 'noMatch', 'error', 'preopen', 'chatEmpty', 'soldOut', 'organizing'];
const hostOf = (tree: Awaited<ReturnType<typeof mount>>, testID: string) => tree.root.findAll((n) => n.props.testID === testID && typeof n.type === 'string')[0];
const svgOf = (tree: Awaited<ReturnType<typeof mount>>, testID: string) =>
  must(tree, testID).findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('illustration-'))[0].props.testID as string;

describe('등록', () => {
  test('장면 12개 모두 라이트 · 다크 SVG 한 쌍(320×240 viewBox) · 필터 · 블렌드 0 · 크기 속성 0', () => {
    expect(Object.keys(ILLUSTRATIONS).sort()).toEqual([...SCENES].sort());
    for (const scene of SCENES) {
      for (const mode of ['light', 'dark'] as const) {
        const svg = ILLUSTRATIONS[scene][mode];
        expect(svg.startsWith('<svg ')).toBe(true);
        expect(svg).toContain('viewBox="0 0 320 240"');
        expect(svg).not.toMatch(/filter|mix-blend|non-scaling-stroke/);
        expect(svg).not.toMatch(/<svg [^>]*\b(width|height)=/);
      }
      expect(ILLUSTRATIONS[scene].light).not.toBe(ILLUSTRATIONS[scene].dark);
    }
  });

  test('id 는 장면 · 판마다 달라서 한 쪽에 여러 장이 있어도 겹치지 않는다', () => {
    const ids = SCENES.flatMap((s) => [ILLUSTRATIONS[s].light, ILLUSTRATIONS[s].dark]).flatMap((svg) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('온보딩은 장면 1 · 2 · 3 순서, 칸은 4:3', () => {
    expect(INTRO_SCENES).toEqual(['onboarding1', 'onboarding2', 'onboarding3']);
    expect(illustration.ratio).toBeCloseTo(320 / 240);
  });
});

describe('부품', () => {
  beforeEach(() => jest.spyOn(RN, 'useColorScheme').mockReturnValue('light'));
  afterEach(() => jest.restoreAllMocks());

  test('라이트 모드면 라이트 판, 다크 모드면 다크 판', async () => {
    const light = await mount(<Illustration scene="ticket" testID="art" />);
    expect(svgOf(light, 'art')).toBe('illustration-ticket-light');
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
    const dark = await mount(<Illustration scene="ticket" testID="art" />);
    expect(svgOf(dark, 'art')).toBe('illustration-ticket-dark');
  });

  test('꾸밈 그림이라 스크린리더가 건너뛴다 · 칸 4:3 · 둥글기 20 · 잘라 담기', async () => {
    const tree = await mount(<Illustration scene="error" testID="art" />);
    const box = hostOf(tree, 'art');
    expect(box.props.accessibilityElementsHidden).toBe(true);
    expect(box.props.importantForAccessibility).toBe('no-hide-descendants');
    const style = RN.StyleSheet.flatten(box.props.style);
    expect(style.aspectRatio).toBe(illustration.ratio);
    expect(style.borderRadius).toBe(20);
    expect(style.overflow).toBe('hidden');
  });

  test('인터넷 끊김 그림(OfflineArt)은 장면 그림 "오류"(폭 240)', async () => {
    const tree = await mount(<OfflineArt show />);
    expect(svgOf(tree, 'offline-art')).toBe('illustration-error-light');
    expect(RN.StyleSheet.flatten(hostOf(tree, 'offline-art').props.style).maxWidth).toBe(illustration.state);
  });
});

describe('탑승권 상태마다 그림', () => {
  test('판매 전 = 사전 오픈 대기 · 판매 중 = 탑승권 · 마감 둘 · 기다림 · 공개 · 못 찾음 · 살 수 없음은 그림 없음', () => {
    expect(SCENE_OF).toEqual({
      before_sale: 'preopen',
      on_sale: 'ticket',
      full: 'soldOut',
      closed: 'soldOut',
      boarded: 'waiting',
      matched: 'reveal',
      no_match: 'noMatch',
      ineligible: null,
    });
  });
});
