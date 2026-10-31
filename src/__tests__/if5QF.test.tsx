// IF5-QF 검수 찾은 것 고치기 — F-06 만난 날의 하늘 날 칸 터치 48(360폭) · F-07 탈퇴 확인창 잔액이 마일리지 화면과 같은 읽기.
//  (F-01 · F-02 · F-04 · 데모 사전은 if5F2Ui · aitScreens 시험에 같이 있다)
import fs from 'node:fs';
import path from 'node:path';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

import { IF5_TEXT } from '@/content/if5Copy';
import { MeetSky } from '@/features/inflight/MeetSky';
import { createMileageApi, type MileageApi } from '@/features/mileage/mileageApi';
import { createDemoMileage } from '@/demo/mileageDemo';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import type { SettingsApi } from '@/lib/settingsApi';
import { size, space } from '@/theme/tokens';

import { has, mount, must, press, textOf } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, settingsApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

// 설정 화면이 열 때 부르는 마일리지 읽기(mileageServices) — 시험이 바꿀 수 있는 모의 장부 하나
let mockLedgerApi: MileageApi;
jest.mock('@/features/mileage/mileageService', () => ({ mileageServices: () => ({ api: mockLedgerApi, edge: {} }) }));

const mounted: ReactTestRenderer[] = [];
const keep = (t: ReactTestRenderer) => (mounted.push(t), t);
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((t) => t.unmount()));
});
const wait = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));

describe('IF5-QF F-06 만난 날의 하늘 날짜 고르기: 360폭에서도 터치 48 이상', () => {
  const NOW = Date.UTC(2027, 2, 20, 3, 0, 0);
  test('날 칸 너비 = 7등분(14.2857%) · 줄이 시트 여백으로 12씩 나와 360 − 2×20 + 2×12 = 344 → 칸 49 이상 · 높이 48', async () => {
    const tree = keep(await mount(<MeetSky day={null} onChange={() => undefined} now={() => NOW} />));
    await press(tree, 'meet-sky-pick');
    const day = must(tree, 'meet-sky-day-5');
    const style = StyleSheet.flatten(typeof day.props.style === 'function' ? day.props.style({ pressed: false }) : day.props.style) as { width?: string; minHeight?: number };
    expect(style.width).toBe('14.2857%');
    expect(style.minHeight).toBeGreaterThanOrEqual(size.touchMin);
    const rowWidth360 = 360 - 2 * size.screenPadding + 2 * space.s12; // 메모 시트(FullSheet) 안쪽 폭 + 줄이 나온 만큼
    expect(rowWidth360 / 7).toBeGreaterThanOrEqual(size.touchMin);
    // 예전 방식(여백 안쪽만)이면 46 — 이 시험이 값을 지킨다
    expect((360 - 2 * size.screenPadding) / 7).toBeLessThan(size.touchMin);
  });
  test('소스: 줄 바깥 여백(음수) 한 곳 · 칸에 flex:1 로 되돌리지 않았다', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features', 'inflight', 'MeetSky.tsx'), 'utf8');
    expect(src).toMatch(/marginHorizontal: -space\.s12/);
    expect(src).toMatch(/cell: \{ width: '14\.2857%'/);
    expect(src).not.toMatch(/cell: \{ flex: 1/);
  });
});

describe('IF5-QF F-07 탈퇴 확인창 잔액: 마일리지 화면과 같은 읽기 · 지난번 값이 먼저 비치지 않는다', () => {
  const NOW = Date.UTC(2026, 9, 15, 3, 0, 0);
  const user = { id: 'u-wd', email: 'wd@email.com' };
  function ledger(rounds: { n: number }) {
    const demo = createDemoMileage({ flags: async () => ({ mileage: true, mileage_charge: true, mileage_spend: true }), boardedRounds: async () => rounds.n });
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc(user, fn, args) as never;
    return createMileageApi(call);
  }
  function deps(): SettingsDeps {
    const api = {
      loadBlocked: jest.fn(async () => ({ ok: true as const, data: [] })),
      unblock: jest.fn(async () => ({ ok: true as const })),
      loadReports: jest.fn(async () => ({ ok: true as const, data: [] })),
      loadNotify: jest.fn(async () => ({ ok: true as const, data: { recommendation: true, like: true, match: true, chat: true } })),
      saveNotify: jest.fn(async () => ({ ok: true as const })),
      loadConsents: jest.fn(async () => ({ ok: true as const, data: {} })),
      setOptional: jest.fn(async () => ({ ok: true as const })),
      startWithdraw: jest.fn(async () => ({ ok: true as const })),
      confirmWithdraw: jest.fn(async () => ({ ok: true as const })),
      signOut: jest.fn(async () => undefined),
    } as unknown as SettingsApi;
    return { api, now: () => NOW, resetLocal: jest.fn(), pushStatus: jest.fn(async () => 'granted' as const), requestPush: jest.fn(async () => 'granted' as const), copyText: jest.fn(async () => true), openMail: jest.fn(async () => undefined), mileage: () => true };
  }

  test('열 때마다 서버에서 새로 읽는다 — 다시 열면 지난번 3,300 이 아니라 지금 값, 읽기 전에는 옛 값 줄 0', async () => {
    const rounds = { n: 0 };
    mockLedgerApi = ledger(rounds);
    await mockLedgerApi.charge('mileage_3300'); // 1,000 + 3,300 = 4,300
    const tree = keep(await mount(<SettingsScreen deps={deps()} />));
    await wait(60);
    await press(tree, 'settings-withdraw');
    await wait(60);
    expect(has(tree, 'withdraw-confirm')).toBe(true);
    const text = (): string => tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');
    expect(text()).toContain('마일리지 잔액 4,300');
    await press(tree, 'withdraw-confirm-cancel');
    await wait(30);
    rounds.n = 1; // 장면 단추처럼 탑승 회차가 늘어 다음 읽기에서 탑승 적립 +200 이 붙는다
    const s = await mockLedgerApi.state(); // 마일리지 화면이 여는 읽기
    expect(s.ok && s.data.total).toBe(4500);
    // 느린 읽기로 바꿔, 읽는 동안 옛 값(4,300)이 비치지 않는지 본다
    const real = mockLedgerApi.state;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    mockLedgerApi = { ...mockLedgerApi, state: async () => (await gate, real()) };
    await press(tree, 'settings-withdraw');
    await wait(30);
    expect(text()).not.toContain('마일리지 잔액 4,300');
    release();
    await wait(60);
    expect(text()).toContain('마일리지 잔액 4,500'); // 마일리지 화면(같은 get_mileage)과 같은 값
    expect(textOf(tree, 'withdraw-confirm-note-text')).toContain('마일리지 잔액 4,500');
  });

  test('탈퇴 확인창 줄 = 마일리지 화면 total (같은 읽기) — 무료 탑승 적립이 붙은 뒤에도', async () => {
    const rounds = { n: 2 };
    mockLedgerApi = ledger(rounds);
    const tree = keep(await mount(<SettingsScreen deps={deps()} />));
    await wait(60);
    await press(tree, 'settings-withdraw');
    await wait(60);
    const s = await mockLedgerApi.state();
    const total = s.ok ? s.data.total : -1;
    expect(total).toBe(1400);
    const joined = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string).join(' | ');
    expect(joined).toContain(`마일리지 잔액 ${total.toLocaleString('en-US')}`);
    expect(IF5_TEXT['MILEAGE.free.leave.bal']).toContain('{N}');
  });
});
