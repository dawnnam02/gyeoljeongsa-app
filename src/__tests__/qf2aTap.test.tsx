// QF2-A Q2-T2 시험: 마일리지 충전(F-03) · 라운지 글 보내기(F-14) 같은 틱 연타 → 한 번만.
//  busy · sending state 는 다음 렌더에야 바뀌어 두 번째 누름을 못 막는다 → ref 로 먼저 잠근다. 서버 대신 데모 모의 서버를 부른 횟수를 센다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { createDemoLounge } from '@/demo/loungeDemo';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { isBigCharge, MileageScreen } from '@/features/mileage/MileageScreen';
import type { MileageDeps } from '@/features/mileage/mileageService';
import { createLoungeApi } from '@/features/lounge/loungeApi';
import { LoungeScreen } from '@/features/lounge/LoungeScreen';
import type { LoungeDeps } from '@/features/lounge/loungeService';

import { find, mount, must, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/features/chat/chatService', () => ({ chatApi: () => ({}), chatMedia: () => ({}), CHAT_LIST_HREF: '/chat', chatRoomHref: (id: string) => `/chat/${id}` }));
jest.setTimeout(90_000);

const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});

describe('F-03 마일리지 충전 연타', () => {
  test('상품 단추를 같은 틱에 두 번 눌러도 충전 호출 1번', async () => {
    const flags = Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])) as Record<string, boolean>;
    const demo = createDemoMileage({ flags: async () => flags, boardedRounds: async () => 0 });
    let charges = 0;
    const call = async (fn: string, args: Record<string, unknown> = {}) => {
      if (fn === 'demo_mileage_charge') charges += 1;
      return demo.rpc({ id: 'u-tap', email: 'sj@email.com' }, fn, args);
    };
    const deps: MileageDeps = { api: createMileageApi(call), edge: createLedgerEdge(call), isOn: (k) => flags[k] === true };
    const tree = keep(await mount(<MileageScreen deps={deps} />));
    await wait(60);
    const state = await deps.api.state();
    if (!state.ok) throw new Error('state');
    const small = state.data.products.find((p) => !isBigCharge(p)); // 큰 충전은 확인 시트를 거친다 — 바로 충전되는 상품으로 본다
    if (!small) throw new Error('no small product');
    await act(async () => {
      const onPress = must(tree, `mileage-product-${small.sku}`).props.onPress as () => void;
      onPress();
      onPress();
    });
    await wait(60);
    expect(charges).toBe(1);
  });
});

describe('F-14 라운지 글 보내기 연타', () => {
  test('[보내기]를 같은 틱에 두 번 눌러도 같은 글은 한 번만 올라감', async () => {
    const user = { id: 'u-loungeon@email.com', email: 'loungeon@email.com' }; // lgfLounge 와 같은 데모 계정(탑승 중 · 글 칸 열림)
    const demo = createDemoLounge({ flight: () => 'in', switchOn: async () => true, replyMs: 30 });
    const client = { rpc: (name: string, args?: Record<string, unknown>) => demo.rpc(user, name, args), channel: (n: string) => demo.channel(n), removeChannel: (c: unknown) => demo.removeChannel(c) } as unknown as SupabaseClient;
    const api = createLoungeApi(client);
    const post = jest.spyOn(api, 'post');
    const deps: LoungeDeps = { api, switchOn: async () => true };
    const tree = keep(await mount(<LoungeScreen deps={deps} toastMs={60_000} />));
    await wait();
    expect(find(tree, 'lounge-input')).not.toBeNull(); // 글 칸이 열린 장면(데모 기본)
    await typeInto(tree, 'lounge-input', '퇴근길 노을 보고 웃었어요');
    await act(async () => {
      const onPress = must(tree, 'lounge-send').props.onPress as () => void;
      onPress();
      onPress();
    });
    await wait(60);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
