// V5 파도 1 W10(D-152 결정 22): 09 하루 세 분 · 11 호감 · 16 상점 · 등급 구독 · 1회 매칭을 스위치로 숨긴다(코드 · 시험 유지).
//  ① 스위치 키(group V5) · live · demo 꺼짐 · 데모 v4on 장면 ② V4Gate: 읽는 동안 빈 화면 → 꺼짐이면 그리지 않고 V5_HOME, 켜짐이면 그대로
//  ③ 들어가는 길: 12 '구매 · 등급 구독' 줄 · 탭바 칸은 꺼짐이면 없다
import { Text } from 'react-native';
import { act } from 'react-test-renderer';

import { demoDefault, demoSceneDefault, liveDefault, V5_HIDE_KEYS } from '@/config/featureKeys';
import { createFlagsStore } from '@/hooks/useFeatureFlags';
import { FLAGS_FALLBACK, parseFlags } from '@/lib/featureFlagsApi';

import { mount } from './renderHelpers';

// jest.setup 의 공통 대역(켜짐) 대신 진짜 숨김 동작
jest.unmock('@/navigation/v5Hide');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { V4Gate, useV4Screens, v4ScreenOn, V5_HOME } = require('@/navigation/v5Hide') as typeof import('@/navigation/v5Hide');

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => <MockText testID="redirect">{String(href)}</MockText> };
});

const storeWith = (on: Record<string, boolean>) => createFlagsStore(async () => parseFlags({ flags: on, modes: {} }));
const texts = (tree: Awaited<ReturnType<typeof mount>>) => tree.root.findAllByType(Text).map((n) => String(n.props.children));

describe('W10 ① 스위치', () => {
  test('키 3개(v4_daily_recs · v4_likes · v4_shop) — live · demo 모두 꺼짐, 데모 이메일에 v4on 이 있으면 켜짐', () => {
    expect(Object.values(V5_HIDE_KEYS)).toEqual(['v4_daily_recs', 'v4_likes', 'v4_shop']);
    for (const k of Object.values(V5_HIDE_KEYS)) {
      expect(liveDefault(k)).toBe(false);
      expect(demoDefault(k)).toBe(false);
      expect(demoSceneDefault(k, 'kim@email.com')).toBe(false);
      expect(demoSceneDefault(k, 'f5okv4on@email.com')).toBe(true);
    }
    expect(demoSceneDefault('avoid_org', 'x@email.com')).toBe(true); // 다른 키는 데모 처음값 그대로
    expect(v4ScreenOn(FLAGS_FALLBACK, 'dailyRecs')).toBe(false); // 못 읽으면 꺼짐(닫힌 쪽)
  });
});

describe('W10 ② 숨긴 화면 라우트(V4Gate)', () => {
  test('꺼짐: 화면을 그리지 않고 V5_HOME(12 설정)으로', async () => {
    const tree = await mount(
      <V4Gate screen="dailyRecs" store={storeWith({ v4_daily_recs: false })}>
        <Text>오늘의 추천</Text>
      </V4Gate>,
    );
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(texts(tree)).toEqual([String(V5_HOME)]);
    expect(texts(tree)).not.toContain('오늘의 추천');
  });

  test('읽는 동안은 빈 화면(숨긴 화면이 한 번도 비치지 않음) → 켜짐이면 그대로', async () => {
    let release!: () => void;
    const slow = createFlagsStore(() => new Promise((r) => (release = () => r(parseFlags({ flags: { v4_shop: true }, modes: {} })))));
    const tree = await mount(
      <V4Gate screen="shop" store={slow}>
        <Text>상점</Text>
      </V4Gate>,
    );
    expect(tree.root.findAll((n) => n.props?.testID === 'v4-gate-wait').length).toBeGreaterThan(0);
    expect(texts(tree)).toEqual([]);
    await act(async () => release());
    expect(texts(tree)).toEqual(['상점']);
  });

  test('스위치를 못 읽으면(서버 오류) 꺼짐으로 보고 보내 준다', async () => {
    const broken = createFlagsStore(async () => {
      throw new Error('down');
    });
    const tree = await mount(
      <V4Gate screen="likes" store={broken}>
        <Text>호감</Text>
      </V4Gate>,
    );
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(texts(tree)).toEqual([String(V5_HOME)]);
  });
});

describe('W10 ③ 들어가는 길', () => {
  test('useV4Screens: 켠 것만 true', async () => {
    const seen: ReturnType<typeof useV4Screens>[] = [];
    const store = storeWith({ v4_daily_recs: false, v4_likes: true, v4_shop: false });
    function Probe() {
      seen.push(useV4Screens(store));
      return null;
    }
    await mount(<Probe />);
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(seen[seen.length - 1]).toEqual({ ready: true, dailyRecs: false, likes: true, shop: false });
  });
});
