// 3부-카 ③ — 데모 모의 서버의 get_my_ways · get_my_birth_week(0046 응답 모양) + 12 설정 '하늘 도감' 줄(스위치 sky_book)
//  데모 값은 모의(실제 천문 값 아님). 서버 요청 0 · 기기 저장 0
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoDefault, FEATURE_KEYS } from '@/config/featureKeys';
import { createDemoBoarding } from '@/demo/boardingDemo';
import { createDemoInflight, DEMO_SKY_ISSUE } from '@/demo/inflightDemo';
import { demoShared } from '@/demo/inflightShared';
import { createInflightApi, rpcOf } from '@/features/inflight/inflightApi';
import { venusText } from '@/features/inflight/if3Logic';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';

import { has, mount, press, textOf } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, settingsApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));
jest.setTimeout(60_000);

const flagsAll = (over: Record<string, boolean> = {}) => ({ ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, demoDefault(k)])), ...over }) as Record<string, boolean>;

function rig(email: string, over: Record<string, boolean> = {}, birth: string | null = '1997-03-12', consent = true) {
  const user = { id: `u-${email.split('@')[0]}`, email };
  const flags = async () => flagsAll(over);
  const boarding = createDemoBoarding();
  const demo = createDemoInflight({ boarding, flags, account: () => ({ birthDate: birth, consentOn: (c) => consent && (c === 'CK17A' || c === 'CK17B'), sameHobby: true, previewAnswers: {} }) });
  demoShared.setFlags(flags);
  const client = { rpc: async (n: string, a?: Record<string, unknown>) => (demo.handles(n) ? demo.rpc(user, n, a) : boarding.rpc(user, n, a)) } as unknown as SupabaseClient;
  return { api: createInflightApi(rpcOf(client)), demo, user };
}

describe('데모 get_my_ways (G-04)', () => {
  test('탑승 중 CK17A 켠 분: 별자리 코드 하나씩 · 태양 별자리 곁 · 라이브러리 글이 모두 있다', async () => {
    const r = rig('if3a@email.com');
    await r.demo.rpc(r.user, 'demo_inflight_scene', { p_scene: 'inflight' });
    const w = await r.api.myWays();
    expect(w.ok && w.data.state).toBe('ready');
    if (w.ok && w.data.state === 'ready') {
      expect(venusText(w.data.venus)).not.toBeNull();
      expect(venusText(w.data.mercury)).not.toBeNull();
    }
  });
  test('동의 꺼짐 → consent_required · 스위치 꺼짐 → off · 표 밖(1965년생) · 생년월일 없음 → none', async () => {
    expect(await rig('if3b@email.com', {}, '1997-03-12', false).api.myWays()).toEqual({ ok: false, code: 'consent_required' });
    expect(await rig('if3c@email.com', { my_ways: false }).api.myWays()).toEqual({ ok: false, code: 'off' });
    expect(await rig('if3d@email.com', {}, '1965-03-12').api.myWays()).toEqual({ ok: true, data: { state: 'none' } });
    expect(await rig('if3e@email.com', {}, null).api.myWays()).toEqual({ ok: true, data: { state: 'none' } });
  });
});

describe('데모 get_my_birth_week (G-07)', () => {
  test('발행 호(목 ~ 수) 안에 생일이 있으면 참 · 없으면 거짓 · 이메일에 if3birth 면 늘 참 · 탑승 중 아님 → none · 스위치 꺼짐 → off', async () => {
    const issue = new Date(`${DEMO_SKY_ISSUE}T00:00:00Z`);
    const md = (add: number) => {
      const d = new Date(issue.getTime() + add * 86_400_000);
      return `1990-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };
    const inWeek = rig('if3f@email.com', {}, md(3));
    await inWeek.demo.rpc(inWeek.user, 'demo_inflight_scene', { p_scene: 'inflight' });
    expect(await inWeek.api.birthWeek()).toEqual({ ok: true, data: { state: 'ready', birthdayWeek: true } });
    const outWeek = rig('if3g@email.com', {}, md(9));
    await outWeek.demo.rpc(outWeek.user, 'demo_inflight_scene', { p_scene: 'inflight' });
    expect(await outWeek.api.birthWeek()).toEqual({ ok: true, data: { state: 'ready', birthdayWeek: false } });
    const force = rig('if3birth@email.com', {}, '1990-06-15');
    await force.demo.rpc(force.user, 'demo_inflight_scene', { p_scene: 'inflight' });
    expect(await force.api.birthWeek()).toEqual({ ok: true, data: { state: 'ready', birthdayWeek: true } });
    const before = rig('if3h@email.com', {}, md(3));
    await before.demo.rpc(before.user, 'demo_inflight_scene', { p_scene: 'before' });
    expect(await before.api.birthWeek()).toEqual({ ok: true, data: { state: 'none' } });
    expect(await rig('if3i@email.com', { birth_card: false }).api.birthWeek()).toEqual({ ok: false, code: 'off' });
  });
});

describe('12 설정 정보 묶음 — 하늘 도감 줄(스위치 sky_book)', () => {
  const trees: ReactTestRenderer[] = [];
  afterEach(async () => {
    await act(async () => trees.splice(0).forEach((t) => t.unmount()));
    mockRouter.push.mockClear();
  });
  const deps = (skyBook?: () => boolean): SettingsDeps =>
    ({
      api: { loadConsents: jest.fn(async () => ({ ok: true, data: {} })) },
      now: () => Date.UTC(2026, 9, 15),
      resetLocal: jest.fn(),
      pushStatus: jest.fn(async () => 'granted'),
      requestPush: jest.fn(async () => 'granted'),
      copyText: jest.fn(async () => true),
      openMail: jest.fn(async () => undefined),
      skyBook,
    }) as unknown as SettingsDeps;
  const show = async (d: SettingsDeps) => {
    const tree = await mount(<SettingsScreen deps={d} />);
    trees.push(tree);
    return tree;
  };
  test('켜짐: 정보 묶음에 [하늘 도감] 줄 → /sky-book / 꺼짐 · 없음 → 줄 0', async () => {
    const on = await show(deps(() => true));
    expect(has(on, 'settings-row-sky-book')).toBe(true);
    await press(on, 'settings-row-sky-book');
    expect(mockRouter.push).toHaveBeenCalledWith('/sky-book');
    expect(has(await show(deps(() => false)), 'settings-row-sky-book')).toBe(false);
    expect(has(await show(deps()), 'settings-row-sky-book')).toBe(false);
    expect(textOf(on, 'settings-info-label')).not.toBeNull();
  });
});
