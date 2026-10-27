// 3부-사 ②(D-219): 0039 응답 5종을 앱이 읽는다 — backend/R_변경기록.md 8-4 표
//  grade_icon(16-G 내 등급 = 풍경 키 하나 · 숫자 0) · reason_detail(T1 살 수 없음 사유) · held(T5 내역) · contract_ack_required(잡기 · 결제 · 크레딧 탑승 관문) · org_key_missing(아는 분 피하기)
//  모르는 사유는 일반 안내로(빈 화면 0) · 데모 모의 서버도 같은 모양
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { SETTINGS } from '@/content/settingsCopy';
import { createDemoBoarding } from '@/demo/boardingDemo';
import { createBoardingApi, ineligibleOf, parseHistory, TICKET_STATE_RPC } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { AvoidPage } from '@/features/settings/AvoidPage';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';

import { has, mount, press, textOf, typeInto } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

const backend = createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) });
async function signIn(email: string) {
  const client = createDemoClient(backend);
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
type Answer = { data: unknown; error: { code?: string; message: string } | null };
function fakeClient(answer: (name: string, args: unknown) => Answer) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return answer(name, args);
    },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});
const TICKET = {
  price_krw: 26900,
  payment_mode: 'demo',
  round: { round_no: 3, match_day: '2027-01-06', match_weekday: '수요일', match_time: '18:00', match_text: '', sale_open_at: '2026-12-30T15:00:00Z', sale_close_at: '2027-01-06T08:30:00Z', close_text: '', sale_state: 'open' },
  seat: null,
  region: '수도권',
  can_board: true,
  reason: null,
  credit: { balance: 0 },
};

describe('reason_detail → T1 살 수 없음 사유(모르는 상세는 일반 안내)', () => {
  test('상세 5종 + 모름 + 없음 → 화면 글 키', () => {
    const table: [unknown, string][] = [
      ['politics_missing', 'politics_missing'],
      ['grade_paused', 'paused'],
      ['profile_missing', 'not_confirmed'],
      ['grade_pending', 'not_confirmed'],
      ['religion_missing', 'religion_missing'], // ① 카피 17-2 '종교 문항에 답하면…'
      ['weird_new_code', 'not_confirmed'],
      [null, 'not_confirmed'],
      [undefined, 'not_confirmed'],
    ];
    for (const [detail, want] of table) expect(ineligibleOf('profile_incomplete', detail)).toBe(want);
    expect(ineligibleOf('review_pending', null)).toBe('not_confirmed');
    expect(ineligibleOf(null, 'politics_missing')).toBeNull(); // 사유가 없으면 상세는 보지 않는다
    expect(ineligibleOf('full', null)).toBeNull();
  });

  test('T1 화면: grade_paused → 등급 계산 멈춤 카드 + [설정으로] · 모르는 상세 → 일반 안내 카드(빈 화면 0)', async () => {
    for (const [detail, title, action] of [
      ['grade_paused', BOARDING.ineligible.paused.title, true],
      ['something_new', BOARDING.ineligible.not_confirmed.title, false],
    ] as const) {
      const f = fakeClient((name) => ({ data: name === TICKET_STATE_RPC ? { ...TICKET, can_board: false, reason: 'profile_incomplete', reason_detail: detail } : { state: 'none' }, error: null }));
      const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(f.client), newId: () => 'r', toastMs: 10 }} />);
      shown.push(tree);
      await flush();
      expect(has(tree, 'boarding-status-ineligible')).toBe(true);
      expect(textOf(tree, 'boarding-status-title')).toBe(title);
      expect(has(tree, 'boarding-ineligible-action')).toBe(action);
      expect(has(tree, 'boarding-buy')).toBe(false);
    }
  });

  test('데모: 등급 계산을 멈추면 실서버처럼 profile_incomplete + grade_paused(탑승 0) · 다시 켜면 탈 수 있다 · 이메일 gradenew = grade_pending', async () => {
    const client = await signIn('s3sa-grade@email.com');
    expect((await client.rpc('set_grade_processing', { p_on: false })).error).toBeNull();
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: false, reason: 'profile_incomplete', reason_detail: 'grade_paused' });
    expect((await client.rpc('hold_ticket_seat', { p_round_no: 1 })).data).toMatchObject({ ok: false, reason: 'profile_incomplete', reason_detail: 'grade_paused' });
    const load = await createBoardingApi(client).load();
    expect(load.ok && load.state.ineligible).toBe('paused');
    expect((await client.rpc('set_grade_processing', { p_on: true })).error).toBeNull();
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true, reason: null, reason_detail: null });
    const fresh = await signIn('s3sa-gradenew@email.com');
    expect((await fresh.rpc('get_ticket_state')).data).toMatchObject({ reason: 'profile_incomplete', reason_detail: 'grade_pending' });
  });
});

describe('contract_ack_required — 결제 전 확인 기록 관문(앱이 ack_ticket_contract 를 먼저 부른다)', () => {
  test('데모 관문: 확인 기록 없이 잡기 · 크레딧 탑승 = contract_ack_required · 데모 결제 = 오류 · 판 형식이 틀리면 invalid_value', async () => {
    const d = createDemoBoarding();
    const me = { id: 'u-ack', email: 'boardcredit@email.com' };
    expect((await d.rpc(me, 'hold_ticket_seat', { p_round_no: 2 })).data).toEqual({ ok: false, reason: 'contract_ack_required', round_no: 2, hold_until: null });
    expect((await d.rpc(me, 'board_with_credit', { p_round_no: 2 })).data).toEqual({ ok: false, reason: 'contract_ack_required', round_no: 2, paid_by: null });
    expect((await d.rpc(me, 'ack_ticket_contract', { p_round_no: 2, p_text_version: 'zzzz' })).error?.message).toBe('invalid_value'); // 0039 판 값 형식
    expect((await d.rpc(me, 'ack_ticket_contract', { p_round_no: 2, p_text_version: 'contract-5-8-ABCDEF12' })).error?.message).toBe('invalid_value'); // 16진 소문자 8자만
    expect((await d.rpc(me, 'ack_ticket_contract', { p_round_no: 2, p_text_version: 'contract-5-8-abcdef12' })).data).toEqual({ ok: true });
    expect((await d.rpc(me, 'hold_ticket_seat', { p_round_no: 2 })).data).toMatchObject({ ok: true });
    const other = { id: 'u-ack2', email: 'a@email.com' };
    expect((await d.rpc(other, 'ack_ticket_contract', { p_round_no: 2, p_text_version: 'contract-5-8-abcdef12' })).data).toEqual({ ok: true }); // 다른 회차(2)만 확인
    // 잡은 자리 없이 결제 → no_hold 먼저(서버 차례). 회차 1 확인 없이 잡기는 막힘
    expect((await d.rpc(other, 'demo_buy_ticket', { p_request_id: 'x' })).error?.message).toBe('no_hold');
    expect((await d.rpc(other, 'hold_ticket_seat', { p_round_no: 1 })).data).toMatchObject({ ok: false, reason: 'contract_ack_required' });
  });

  test('앱 차례: 결제 버튼 → ack_ticket_contract(판 contract-5-8-xxxxxxxx) → hold_ticket_seat → demo_buy_ticket', async () => {
    const f = fakeClient((name) => {
      if (name === TICKET_STATE_RPC) return { data: TICKET, error: null };
      if (name === 'hold_ticket_seat') return { data: { ok: true, round_no: 3, hold_until: 'x' }, error: null };
      if (name === 'demo_buy_ticket') return { data: { result: 'boarded', round_no: 3, tx_id: 't' }, error: null };
      return { data: name === 'get_weekly_match' ? { state: 'none' } : { ok: true }, error: null };
    });
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(f.client), newId: () => 'r1', toastMs: 10 }} />);
    shown.push(tree);
    await flush();
    await press(tree, 'boarding-buy');
    await press(tree, 'boarding-pay');
    await flush();
    const pay = f.calls.filter((c) => !['get_ticket_state', 'get_weekly_match'].includes(c.name));
    expect(pay.map((c) => c.name)).toEqual(['ack_ticket_contract', 'hold_ticket_seat', 'demo_buy_ticket']);
    expect((pay[0].args as { p_text_version: string }).p_text_version).toMatch(/^contract-5-8-[0-9a-f]{8}$/);
  });

  test('서버가 contract_ack_required 를 돌려주면 확인 기록을 다시 남기고 한 번만 다시 — 두 번째도 막히면 일반 결제 오류 글(결제 0)', async () => {
    let holds = 0;
    const once = fakeClient((name) => {
      if (name === TICKET_STATE_RPC) return { data: TICKET, error: null };
      if (name === 'hold_ticket_seat') return { data: (holds += 1) === 1 ? { ok: false, reason: 'contract_ack_required', round_no: 3, hold_until: null } : { ok: true, round_no: 3 }, error: null };
      if (name === 'demo_buy_ticket') return { data: { result: 'boarded', round_no: 3 }, error: null };
      return { data: name === 'get_weekly_match' ? { state: 'none' } : { ok: true }, error: null };
    });
    const a = await mount(<BoardingScreen deps={{ api: createBoardingApi(once.client), newId: () => 'r', toastMs: 10 }} />);
    shown.push(a);
    await flush();
    await press(a, 'boarding-buy');
    await press(a, 'boarding-pay');
    await flush();
    expect(once.calls.filter((c) => !['get_ticket_state', 'get_weekly_match'].includes(c.name)).map((c) => c.name)).toEqual(['ack_ticket_contract', 'hold_ticket_seat', 'ack_ticket_contract', 'hold_ticket_seat', 'demo_buy_ticket']);
    expect(has(a, 'boarding-sheet-error')).toBe(false);

    const always = fakeClient((name) => {
      if (name === TICKET_STATE_RPC) return { data: TICKET, error: null };
      if (name === 'hold_ticket_seat' || name === 'board_with_credit') return { data: { ok: false, reason: 'contract_ack_required', round_no: 3 }, error: null };
      return { data: name === 'get_weekly_match' ? { state: 'none' } : { ok: true }, error: null };
    });
    const b = await mount(<BoardingScreen deps={{ api: createBoardingApi(always.client), newId: () => 'r', toastMs: 10 }} />);
    shown.push(b);
    await flush();
    await press(b, 'boarding-buy');
    await press(b, 'boarding-pay');
    await flush();
    expect(always.calls.filter((c) => c.name === 'hold_ticket_seat')).toHaveLength(2);
    expect(always.calls.some((c) => c.name === 'demo_buy_ticket')).toBe(false);
    expect(textOf(b, 'boarding-sheet-error')).toBe(BOARDING.buyErrors.server);
  });

  test('데모 결제가 오류 contract_ack_required 로 오면 ack_required(화면이 다시 확인)', async () => {
    const f = fakeClient((name) => (name === 'hold_ticket_seat' ? { data: { ok: true, round_no: 3 }, error: null } : { data: null, error: { code: 'P0001', message: 'contract_ack_required' } }));
    expect(await createBoardingApi(f.client).buy('r', false, 3)).toEqual({ ok: false, reason: 'ack_required' });
  });
});

describe('list_ticket_history 의 held(B안 해지로 R41 에 옮긴 장)', () => {
  test('held 장은 받은 줄 · 옮긴 줄 모두 그리지 않는다(해지 계정 — 화면 0) · 잔액은 서버 값 · 모르는 state 는 받은 줄만', () => {
    const p = parseHistory({
      tickets: [],
      credits: [
        { id: 3, reason: 'no_match', round_no: 2, created_at: '2026-12-30T09:00:00Z', state: 'held' },
        { id: 2, reason: 'unbalanced', round_no: 1, created_at: '2026-12-23T09:00:00Z', state: 'open' },
        { id: 1, reason: 'no_match', round_no: 1, created_at: '2026-12-16T09:00:00Z', state: 'weird' },
      ],
      balance: 2,
    });
    expect(p?.balance).toBe(2);
    expect(p?.items.map((i) => [i.delta, i.reason, i.roundNo])).toEqual([
      [1, 'balance', 1],
      [1, 'no_fit', 1],
    ]);
  });
});

describe('org_key_missing — 아는 분 피하기 더하기(서버 비밀 키 없음)', () => {
  test("settingsApi: org_key_missing · feature_off → 'off' · 그 밖 오류는 그대로", async () => {
    for (const [message, want] of [['org_key_missing', 'off'], ['feature_off', 'off'], ['too_many', 'server']] as const) {
      const f = fakeClient(() => ({ data: null, error: { code: 'P0001', message } }));
      expect(await createSettingsApi(f.client, 'test').setAvoidCompany('한빛', true)).toEqual({ ok: false, reason: want });
    }
  });

  test("12-5 화면(데모 장면 avoidnokey): [더하기] → 목록 되돌림 · '준비 중이에요' 한 줄 · 다시 시도 글 0 · 빼기는 그대로 된다", async () => {
    const client = await signIn('avoidnokey@email.com');
    expect((await client.rpc('set_avoid_org', { p_kind: 'company', p_name: '한빛', p_on: true })).error?.message).toBe('org_key_missing');
    expect((await client.rpc('set_avoid_org', { p_kind: 'company', p_name: '한빛', p_on: false })).error).toBeNull();
    const toast = jest.fn();
    const tree = await mount(<AvoidPage api={createSettingsApi(client, 'test')} onBack={() => undefined} onToast={toast} />);
    shown.push(tree);
    await flush();
    await typeInto(tree, 'settings-avoid-company-input', '한빛');
    await press(tree, 'settings-avoid-company-add');
    await flush();
    expect(toast).toHaveBeenLastCalledWith(SETTINGS.verificationToast);
    expect(has(tree, 'settings-avoid-company-0')).toBe(false);
    expect(has(tree, 'settings-avoid-error')).toBe(false);
  });
});
