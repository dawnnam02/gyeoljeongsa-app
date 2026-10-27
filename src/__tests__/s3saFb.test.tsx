// 3부-사 ⑤(D-219): 테스트웹 피드백 FB-014 ~ 016
//  FB-016 데모 기본 방 = 막 열린 방(글 0) → 짧은 길(공개 → [대화 시작하기])에서 만남 장면(실서버 규칙 '내 글 있으면 장면 0'은 그대로)
//  FB-015 '아는 분 피하기' 입구 = 12 줄 · T2 할 일 · 사전 오픈 단계표 할 일(화면 요구 12-5)
//  FB-014 데모 장면마다 방이 열린 주를 달리해 장소 차례가 보인다
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { createDemoBoarding } from '@/demo/boardingDemo';
import { createBoardingApi } from '@/features/boarding/boardingApi';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { createDemoChatApi, DEMO_CHAT_SCENES, sceneOfEmail } from '@/features/chat/chatDemo';
import { meetPlaceName } from '@/features/chat/meetLogic';
import { PRELAUNCH } from '@/features/prelaunch/prelaunchCopy';
import { openSettingsPage, takeSettingsPage } from '@/features/settings/settingsIntent';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';

import { has, mount, must, press } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
  takeSettingsPage();
  jest.clearAllMocks();
});
async function signIn(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
const chatFor = (email: string) => createDemoChatApi({ who: async () => ({ id: `u-${email}`, email }), photoUri: (k) => `file:///${k}.webp`, replyMs: 600_000, clock: () => 1_000_000 });

describe('FB-016 데모 기본 방 = 막 열린 방(글 0)', () => {
  test('장면 낱말 없는 이메일 → fresh · 열림 시스템 글 하나 · 방 id 는 탑승권 데모 공개(room_id)와 같다 · 대화가 이어진 방은 chatopen', async () => {
    expect(sceneOfEmail('tester@email.com')).toBe('fresh');
    expect(sceneOfEmail('chatopen@email.com')).toBe('open');
    expect(DEMO_CHAT_SCENES[0]).toBe('fresh');
    const api = chatFor('tester@email.com');
    const rooms = await api.listRooms();
    expect(rooms.ok && rooms.data.length).toBe(1);
    if (!rooms.ok) return;
    const msgs = await api.listMessages(rooms.data[0].id);
    expect(msgs.ok && msgs.data.map((m) => [m.kind, m.mine])).toEqual([['system', false]]); // 내 글 0 · 상대 글 0
    const d = createDemoBoarding();
    const w = await d.rpc({ id: 'u-x', email: 'boardmatch-tester@email.com' }, 'get_weekly_match');
    expect((w.data as { room_id: string }).room_id).toBe(rooms.data[0].id); // 공개 → [대화 시작하기] 가 이 방을 연다
  });
});

describe('FB-014 데모 장면마다 열린 주 → 장소 차례', () => {
  test('막 열린 방 · 상대가 먼저 · 상대가 나감 · 닫힌 방의 장소가 서로 다르다(열린 방 · 마지막 날 · 연장은 날짜 글 때문에 1회차 그대로)', async () => {
    const places: string[] = [];
    for (const email of ['chatnew@email.com', 'chatfirst@email.com', 'chatleft@email.com', 'chatclosed@email.com', 'chatopen@email.com']) {
      const rooms = await chatFor(email).listRooms();
      if (!rooms.ok) throw new Error('rooms');
      places.push(meetPlaceName(rooms.data[0].openedAt));
    }
    expect(places).toEqual(['한강 벤치', '한옥 골목', '카페 테라스', '제주 바닷가', '한강 벤치']);
  });
});

describe('FB-015 아는 분 피하기 입구 셋', () => {
  test('T2 할 일에 아는 분 피하기(사전 오픈 할 일과 같은 글) → 설정 탭으로 가며 12-5 쪽을 남긴다', async () => {
    const client = await signIn('boardon-fb15@email.com');
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'r', toastMs: 10 }} />);
    shown.push(tree);
    await flush();
    expect(has(tree, 'boarding-task-avoid')).toBe(true);
    expect(must(tree, 'boarding-task-avoid').props.accessibilityLabel).toBe(`${PRELAUNCH.tasks.avoid.name}, ${PRELAUNCH.tasks.avoid.line}`);
    await press(tree, 'boarding-task-avoid');
    expect(mockRouter.navigate).toHaveBeenCalledWith('/settings');
    expect(takeSettingsPage()).toBe('avoid');
    expect(takeSettingsPage()).toBeNull(); // 한 번만
  });

  test('설정 화면이 초점을 받을 때 남긴 쪽을 연다(12-5) · 없으면 목록', async () => {
    const client = await signIn('fb15-settings@email.com');
    const deps: SettingsDeps = { api: createSettingsApi(client, 'test'), now: () => Date.UTC(2026, 9, 22), resetLocal: jest.fn(), pushStatus: async () => 'granted', requestPush: async () => 'granted', copyText: async () => true, openMail: async () => undefined };
    openSettingsPage(mockRouter, 'avoid');
    const tree = await mount(<SettingsScreen deps={deps} />);
    shown.push(tree);
    await flush();
    expect(has(tree, 'settings-avoid')).toBe(true);
    const plain = await mount(<SettingsScreen deps={deps} />);
    shown.push(plain);
    await flush();
    expect(has(plain, 'settings-avoid')).toBe(false);
    expect(has(plain, 'settings-rows')).toBe(true);
  });
});
