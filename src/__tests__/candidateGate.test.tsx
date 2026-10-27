// 3부-바 ②(QP-01 후속): 10 상대 프로필 라우트 /candidate/[id] 의 문(navigation/v5Hide CandidateGate).
//  · 공개 순간에서 온 길(from=reveal)은 v4 스위치가 모두 꺼져 있어도 연다
//  · 그 밖(09 카드 · 11 호감 행 · 웹 주소 직접)은 v4_daily_recs · v4_likes 중 하나라도 켜져 있을 때만, 아니면 그리지 않고 V5_HOME(탑승권)으로
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';

import { createFlagsStore, type FlagsStore } from '@/hooks/useFeatureFlags';
import { parseFlags } from '@/lib/featureFlagsApi';

import { mount } from './renderHelpers';

jest.unmock('@/navigation/v5Hide'); // jest.setup 의 공통 대역(늘 열림) 대신 진짜 문

let mockParams: Record<string, string> = {};
let mockStore: FlagsStore | null = null;
jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <MockText testID="redirect">{String(href)}</MockText>,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => mockParams,
  };
});
jest.mock('@/features/recs/CandidateScreen', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { CandidateScreen: () => <MockText testID="candidate">상대 프로필</MockText> };
});
jest.mock('@/hooks/useFeatureFlags', () => {
  const actual = jest.requireActual<typeof import('@/hooks/useFeatureFlags')>('@/hooks/useFeatureFlags');
  return { ...actual, appFlagsStore: () => mockStore };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CandidateGate, CANDIDATE_V4_SCREENS, V4Gate, V5_HOME } = require('@/navigation/v5Hide') as typeof import('@/navigation/v5Hide');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CandidateRoute = (require('@/app/candidate/[id]') as { default: () => ReactElement }).default;

const storeWith = (on: Record<string, boolean>) => createFlagsStore(async () => parseFlags({ flags: on, modes: {} }));
const texts = (tree: Awaited<ReturnType<typeof mount>>) => tree.root.findAllByType(Text).map((n) => String(n.props.children));
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe('3부-바 ② 10 상대 프로필 라우트 문', () => {
  const ALL_OFF = { v4_daily_recs: false, v4_likes: false, v4_shop: false };

  test('라우트: from=reveal 은 v4 스위치가 모두 꺼져 있어도 상대 프로필을 그린다', async () => {
    mockParams = { id: 'demo-cand-4', from: 'reveal', chat: 'demo-chat-1-4' };
    mockStore = storeWith(ALL_OFF);
    const tree = await mount(<CandidateRoute />);
    await settle();
    expect(texts(tree)).toEqual(['상대 프로필']);
  });

  test('라우트: from 없이(09 · 11 · 주소 직접) v4 스위치가 모두 꺼져 있으면 그리지 않고 탑승권 탭으로', async () => {
    mockParams = { id: 'demo-cand-4' };
    mockStore = storeWith(ALL_OFF);
    const tree = await mount(<CandidateRoute />);
    await settle();
    expect(texts(tree)).toEqual([String(V5_HOME)]);
    expect(String(V5_HOME)).toBe('/boarding');
  });

  test('라우트: from 이 reveal 이 아닌 다른 값이어도 문은 닫힌다(꺼짐)', async () => {
    mockParams = { id: 'demo-cand-4', from: 'chat' };
    mockStore = storeWith(ALL_OFF);
    const tree = await mount(<CandidateRoute />);
    await settle();
    expect(texts(tree)).toEqual([String(V5_HOME)]);
  });

  test('09 또는 11 스위치 중 하나라도 켜져 있으면 연다(10 은 두 화면 모두에서 들어온다)', async () => {
    expect(CANDIDATE_V4_SCREENS).toEqual(['dailyRecs', 'likes']);
    for (const on of [{ v4_likes: true }, { v4_daily_recs: true }]) {
      const tree = await mount(
        <CandidateGate store={storeWith({ ...ALL_OFF, ...on })}>
          <Text>상대 프로필</Text>
        </CandidateGate>,
      );
      await settle();
      expect(texts(tree)).toEqual(['상대 프로필']);
      act(() => tree.unmount());
    }
    const shopOnly = await mount(
      <CandidateGate store={storeWith({ ...ALL_OFF, v4_shop: true })}>
        <Text>상대 프로필</Text>
      </CandidateGate>,
    );
    await settle();
    expect(texts(shopOnly)).toEqual([String(V5_HOME)]); // 상점 스위치는 10 과 상관없다
  });

  test('V4Gate 여러 화면: 하나라도 켜짐이면 열림 · 읽는 동안 빈 화면', async () => {
    let release!: () => void;
    const slow = createFlagsStore(() => new Promise((r) => (release = () => r(parseFlags({ flags: { v4_likes: true }, modes: {} })))));
    const tree = await mount(
      <V4Gate screen={['dailyRecs', 'likes']} store={slow}>
        <Text>열림</Text>
      </V4Gate>,
    );
    expect(tree.root.findAll((n) => n.props?.testID === 'v4-gate-wait').length).toBeGreaterThan(0);
    await act(async () => release());
    expect(texts(tree)).toEqual(['열림']);
  });
});
