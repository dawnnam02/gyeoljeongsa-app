// QP-A 3부-바(D-199 ~ D-204 R-A 후속, 10-27): 서버 확정 정의에 앱을 맞춘 것.
//  ① 탑승권 이름 · 인자 · 응답(0030 get_ticket_state · hold_ticket_seat · release_ticket_hold · demo_buy_ticket · board_with_credit · list_ticket_history · 0032 get_weekly_match)
//     + 장부 사유(0037 cancel_return · cancel_credit · refund_reversed · store_refund · 0038 age_*) → T5 글 키 · 끝나는 날 칸 0 · 크레딧 좌석 취소 확인창
//  ③ 탈퇴 · [모두 지우기] 때 기기에 둔 피할 회사 · 학교 목록 지움 · 12-Q AVOID 새 9줄 · SecureStore 열쇠 꼴
//  ④ 지인 차단: 주소록 → 기기 해시 SHA-256("kjs1|" + 소문자 이메일) → sync_contact_hashes(500개씩 · replace · 마지막 final) · 스위치 꺼짐이면 '준비 중'
import { createHash, createHmac } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { businessRows, CONTACT_EMAIL } from '@/content/businessInfo';
import { FILL_INS } from '@/content/fillIns';
import { fillText, LEGAL_FILL_VALUES } from '@/content/fillLegal';
import { AVOID, CONTACT_BLOCK } from '@/content/settingsCopy';
import { SUPPORT_CONTACT } from '@/content/supportContact';
import {
  BOARD_CREDIT_RPC,
  createBoardingApi,
  DEMO_BUY_RPC,
  HOLD_SEAT_RPC,
  LOT_REASON,
  LOT_REASON_COPY_PENDING,
  parseHistory,
  RELEASE_HOLD_RPC,
  TICKET_HISTORY_RPC,
  TICKET_STATE_RPC,
  WEEKLY_MATCH_RPC,
} from '@/features/boarding/boardingApi';
import { BOARDING, CREDITS } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { CreditScreen } from '@/features/boarding/CreditScreen';
import { AvoidPage, CK11_LABEL, contactResultText } from '@/features/settings/AvoidPage';
import { avoidKeyOf, keyValueAvoidStore, memoryAvoidStore } from '@/lib/avoidLocal';
import { CONTACT_BATCH, contactHashes, normalizeEmail, runContactSync, type ContactsPort, type ContactSyncDeps } from '@/lib/contactSync';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';

import { allTexts, has, hasText, mount, press, textOf, typeInto } from './renderHelpers';

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

async function demoClient(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
type Answer = { data: unknown; error: { code?: string; message: string } | null };
function fakeClient(answer: (name: string, args: unknown) => Answer = () => ({ data: { ok: true }, error: null }), invoke: () => Answer = () => ({ data: { ok: true }, error: null })) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return answer(name, args);
    },
    functions: { invoke: async () => invoke() },
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
const nodeSha = async (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

// 서버 0030 get_ticket_state 모양(판매 중 · 회차 3 · 크레딧 2장 · 끝나는 날 키는 0037 뒤 비지만 와도 읽지 않는다)
const TICKET = {
  price_krw: 26900,
  payment_mode: 'demo',
  round: { round_no: 3, match_day: '2027-01-06', match_weekday: '수요일', match_time: '18:00', match_text: '1월 6일 수요일 오후 6시', sale_open_at: '2026-12-30T15:00:00Z', sale_close_at: '2027-01-06T08:30:00Z', close_text: '오후 5시 30분', sale_state: 'open' },
  seat: null,
  region: '수도권',
  can_board: true,
  reason: null,
  credit: { balance: 2, next_expire_on: '2027-12-23' },
};

describe('① 탑승권 — 서버 확정 이름 · 인자 · 응답', () => {
  test('load = get_ticket_state + get_weekly_match(인자 없음) · 회차 시각 = match_day + match_time(KST) · 크레딧 끝나는 날은 읽지 않는다', async () => {
    const f = fakeClient((name) => ({ data: name === TICKET_STATE_RPC ? TICKET : { state: 'none' }, error: null }));
    const l = await createBoardingApi(f.client).load();
    expect(f.calls.map((c) => c.name).sort()).toEqual([TICKET_STATE_RPC, WEEKLY_MATCH_RPC].sort());
    expect(f.calls.every((c) => c.args === undefined)).toBe(true);
    expect(l.ok && l.state).toMatchObject({ phase: 'on_sale', regionName: '수도권', credits: 2, ticket: null, round: { no: 3, matchAt: Date.parse('2027-01-06T18:00:00+09:00') } });
    expect(JSON.stringify(l)).not.toMatch(/2027-12-23|expire/);
    expect([TICKET_STATE_RPC, WEEKLY_MATCH_RPC]).toEqual(['get_ticket_state', 'get_weekly_match']);
  });

  test('공개 결과를 못 읽어도(get_weekly_match 오류) 탑승권 화면은 그린다 · 좌석 held(잡기만)는 탑승권이 아니다 · 사유 → 화면 글', async () => {
    const f = fakeClient((name) => (name === TICKET_STATE_RPC ? { data: { ...TICKET, seat: { state: 'held', paid_by: null, hold_until: '2027-01-01T00:00:00Z' }, reason: 'review_pending' }, error: null } : { data: null, error: { code: 'PGRST202', message: 'missing' } }));
    const l = await createBoardingApi(f.client).load();
    expect(l.ok && [l.state.ticket, l.state.result, l.state.ineligible]).toEqual([null, null, 'not_confirmed']);
    const inc = fakeClient((name) => ({ data: name === TICKET_STATE_RPC ? { ...TICKET, reason: 'profile_incomplete' } : { off: true }, error: null }));
    const l2 = await createBoardingApi(inc.client).load();
    expect(l2.ok && l2.state.ineligible).toBe('politics_missing');
  });

  test('[결제하기] = hold_ticket_seat(p_round_no) → demo_buy_ticket(p_request_id) · boarded → 탑승 · 같은 요청 already_granted(seat)도 탑승', async () => {
    const f = fakeClient((name) => ({ data: name === HOLD_SEAT_RPC ? { ok: true, reason: null, round_no: 3, hold_until: 'x' } : { result: 'boarded', round_no: 3, tx_id: 't' }, error: null }));
    expect(await createBoardingApi(f.client).buy('rid-1', false, 3)).toEqual({ ok: true, roundNo: 3 });
    expect(f.calls).toEqual([
      { name: 'hold_ticket_seat', args: { p_round_no: 3 } },
      { name: 'demo_buy_ticket', args: { p_request_id: 'rid-1' } },
    ]);
    const again = fakeClient((name) => ({ data: name === HOLD_SEAT_RPC ? { ok: true } : { result: 'already_granted', round_no: 3, outcome: 'seat' }, error: null }));
    expect(await createBoardingApi(again.client).buy('rid-1', false, 3)).toEqual({ ok: true, roundNo: 3 });
  });

  test('자리 잡기 사유 → 결제 오류 글 키(full · already_boarded · region_closed · payment_closed · profile_incomplete · review_pending) · 결제는 부르지 않는다', async () => {
    const table: [string, string][] = [
      ['full', 'sold_out'],
      ['already_boarded', 'already'],
      ['closed', 'closed'],
      ['region_closed', 'closed'],
      ['payment_closed', 'closed'],
      ['profile_incomplete', 'not_eligible'],
      ['review_pending', 'not_eligible'],
      ['weird', 'server'],
    ];
    for (const [reason, want] of table) {
      const f = fakeClient(() => ({ data: { ok: false, reason, round_no: 3, hold_until: null }, error: null }));
      expect(await createBoardingApi(f.client).buy('r', false, 3)).toEqual({ ok: false, reason: want });
      expect(f.calls.map((c) => c.name)).toEqual([HOLD_SEAT_RPC]);
    }
  });

  test('결제가 실패하면 잡은 자리를 놓는다(release_ticket_hold) · 결제 뒤 자리 없음(credited) → credited', async () => {
    const fail = fakeClient((name) => (name === HOLD_SEAT_RPC ? { data: { ok: true }, error: null } : name === DEMO_BUY_RPC ? { data: null, error: { code: '42501', message: 'closed' } } : { data: { released: true }, error: null }));
    expect(await createBoardingApi(fail.client).buy('r', false, 3)).toEqual({ ok: false, reason: 'closed' });
    await flush();
    expect(fail.calls.map((c) => c.name)).toEqual([HOLD_SEAT_RPC, DEMO_BUY_RPC, RELEASE_HOLD_RPC]);
    const credited = fakeClient((name) => ({ data: name === HOLD_SEAT_RPC ? { ok: true } : { result: 'credited', reason: 'full', round_no: 3, tx_id: 't' }, error: null }));
    expect(await createBoardingApi(credited.client).buy('r', false, 3)).toEqual({ ok: false, reason: 'credited' });
  });

  test('[크레딧 1장으로 타기] = board_with_credit(p_round_no) 하나 · no_credit · full', async () => {
    const ok = fakeClient(() => ({ data: { ok: true, reason: null, round_no: 2, paid_by: 'credit' }, error: null }));
    expect(await createBoardingApi(ok.client).buy('r', true, 2)).toEqual({ ok: true, roundNo: 2 });
    expect(ok.calls).toEqual([{ name: BOARD_CREDIT_RPC, args: { p_round_no: 2 } }]);
    for (const [reason, want] of [['no_credit', 'no_credit'], ['full', 'sold_out']] as const) {
      const f = fakeClient(() => ({ data: { ok: false, reason, round_no: 2, paid_by: null }, error: null }));
      expect(await createBoardingApi(f.client).buy('r', true, 2)).toEqual({ ok: false, reason: want });
    }
  });

  test('T5 = list_ticket_history: 서버 장부 사유 → 글 키(cancel_return · cancel_credit → 취소, refund_reversed → 다시 받음) · 쓴 장(used) −1 · 스토어 환불 회수(revoked) −1 · 카피 14-7 확정 4사유(paid_no_seat · round_cancelled · admin · age_rejoin_restore)도 그림 · 해지(age_terminate)만 그리지 않음 · 끝나는 날 0', async () => {
    const f = fakeClient(() => ({
      data: {
        tickets: [{ round_no: 4, match_day: '2027-01-13', state: 'boarded', paid_by: 'credit', price_krw: null, boarded_at: '2027-01-08T01:00:00Z', return_reason: null }],
        credits: [
          { id: 9, reason: 'admin', round_no: null, created_at: '2027-01-09T00:00:00Z', expires_on: null, state: 'open', used_round_no: null },
          { id: 8, reason: 'age_rejoin_restore', round_no: null, created_at: '2027-01-09T00:00:00Z', expires_on: null, state: 'open', used_round_no: null },
          { id: 7, reason: 'refund_reversed', round_no: 3, created_at: '2027-01-07T00:00:00Z', expires_on: null, state: 'open', used_round_no: null },
          { id: 6, reason: 'cancel_credit', round_no: 3, created_at: '2027-01-05T00:00:00Z', expires_on: '2099-12-31', state: 'revoked', used_round_no: null },
          { id: 5, reason: 'cancel_return', round_no: 2, created_at: '2027-01-02T00:00:00Z', expires_on: null, state: 'used', used_round_no: 4 },
          { id: 4, reason: 'paid_no_seat', round_no: 1, created_at: '2027-01-01T00:00:00Z', expires_on: null, state: 'used', used_round_no: 2 },
          { id: 3, reason: 'age_terminate', round_no: null, created_at: '2027-01-10T00:00:00Z', expires_on: null, state: 'open', used_round_no: null },
        ],
        balance: 3,
      },
      error: null,
    }));
    const l = await createBoardingApi(f.client).ledger();
    expect(f.calls).toEqual([{ name: TICKET_HISTORY_RPC, args: undefined }]);
    expect(l.ok && l.items.map((x) => [x.reason, x.delta, x.roundNo])).toEqual([
      ['admin', 1, null],
      ['age_rejoin_restore', 1, null],
      ['used', -1, 4],
      ['refund_restored', 1, 3],
      ['refund_taken', -1, 3],
      ['cancelled', 1, 3],
      ['cancelled', 1, 2],
      ['used', -1, 2],
      ['paid_no_seat', 1, 1],
    ]);
    expect(l.ok && l.items[2].at).toBe(Date.parse('2027-01-08T01:00:00Z')); // 쓴 날 = 그 회차에 크레딧으로 탄 시각
    expect(l.ok && l.items[4].at).toBeNull(); // 회수한 날은 서버가 주지 않는다 — 날짜 없이 회차만
    expect(l.ok && l.items.map((x) => CREDITS.reasons[x.reason]).slice(0, 2)).toEqual(['고객센터에서 바로잡음', '다시 가입해 이어받음']); // 카피 14-7
    expect(JSON.stringify(l)).not.toMatch(/2099|expire/);
    expect(LOT_REASON).toMatchObject({ unbalanced: 'balance', no_match: 'no_fit', grade_gap: 'gap', cancel_return: 'cancelled', cancel_credit: 'cancelled', refund_reversed: 'refund_restored', paid_no_seat: 'paid_no_seat', round_cancelled: 'round_cancelled', admin: 'admin', age_rejoin_restore: 'age_rejoin_restore' });
    expect([...LOT_REASON_COPY_PENDING]).toEqual(['age_terminate']); // D46-A 덧붙임: 카피 14-7 확정 4사유는 그림
    for (const key of new Set(Object.values(LOT_REASON))) expect(typeof CREDITS.reasons[key]).toBe('string'); // 글 키는 카피 14-5-2 · 14-7 에 있다
    expect(parseHistory({ balance: 1 })).toBeNull();
  });

  test('옛 가정 이름(get_boarding_state · buy_ticket · list_credit_ledger)을 부르는 코드 0', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) {
          if (n !== '__tests__') walk(p);
        } else if (/\.(ts|tsx)$/.test(n)) files.push(p);
      }
    };
    walk(root);
    expect(files.filter((p) => /['"](get_boarding_state|buy_ticket|list_credit_ledger)['"]/.test(readFileSync(p, 'utf8')))).toEqual([]);
  });
});

describe('① 화면 — 크레딧 좌석 취소 확인창 · 끝나는 날 칸 0 · 결제 뒤 자리 없음', () => {
  test('크레딧으로 탄 좌석: 확인창 본문 = cancel.bodyCredit(스토어 환불 문장 없음) · 결제 좌석은 cancel.body', async () => {
    const credit = await mount(<BoardingScreen deps={{ api: createBoardingApi(await demoClient('r3boardoncredit@email.com')), newId: () => 'x', toastMs: 5_000 }} />);
    shown.push(credit);
    await flush();
    await press(credit, 'boarding-cancel');
    expect(textOf(credit, 'boarding-cancel-confirm-body')).toBe(BOARDING.cancel.bodyCredit);
    expect(BOARDING.cancel.bodyCredit).toBe('자리를 바로 풀고, 크레딧 1장을 다시 드려요. 크레딧은 기한 없이 다음 회차에 쓸 수 있어요.');
    expect(textOf(credit, 'boarding-cancel-confirm-body')).not.toMatch(/스토어/);
    const paid = await mount(<BoardingScreen deps={{ api: createBoardingApi(await demoClient('r3boardon@email.com')), newId: () => 'y', toastMs: 5_000 }} />);
    shown.push(paid);
    await flush();
    await press(paid, 'boarding-cancel');
    expect(textOf(paid, 'boarding-cancel-confirm-body')).toBe(BOARDING.cancel.body);
  });

  test('T1: 서버가 next_expire_on 을 보내도 날짜 칸 0 · T5: expires_on 이 와도 날짜 칸 0', async () => {
    const f = fakeClient((name) => {
      if (name === TICKET_STATE_RPC) return { data: TICKET, error: null };
      if (name === TICKET_HISTORY_RPC) return { data: { tickets: [], credits: [{ id: 1, reason: 'unbalanced', round_no: 2, created_at: '2027-01-01T00:00:00Z', expires_on: '2027-12-31', state: 'open' }], balance: 1 }, error: null };
      return { data: { state: 'none' }, error: null };
    });
    const t1 = await mount(<BoardingScreen deps={{ api: createBoardingApi(f.client), newId: () => 'x' }} />);
    shown.push(t1);
    await flush();
    expect(has(t1, 'boarding-credits') && hasText(t1, BOARDING.creditsLink(2))).toBe(true);
    expect(allTexts(t1).join(' ')).not.toMatch(/2027년 12월|12월 23일|만료|까지 쓸 수/);
    const t5 = await mount(<CreditScreen deps={{ api: createBoardingApi(f.client) }} />);
    shown.push(t5);
    await flush();
    expect(textOf(t5, 'credits-row-0-when')).toBe('2027년 1월 1일 · 2회차');
    expect(allTexts(t5).join(' ')).not.toMatch(/12월 31일|만료|까지 쓸 수/);
    expect(textOf(t5, 'credits-no-expiry')).toBe(CREDITS.noExpiry);
  });

  test('결제는 됐지만 자리를 못 받음(credited): 시트에 전용 글 한 줄(buyErrors.credited, 카피 14-7) · 다시 읽기', async () => {
    let state = TICKET;
    const f = fakeClient((name) => {
      if (name === TICKET_STATE_RPC) return { data: state, error: null };
      if (name === HOLD_SEAT_RPC) return { data: { ok: true }, error: null };
      if (name === DEMO_BUY_RPC) {
        state = { ...TICKET, credit: { balance: 3, next_expire_on: '' } };
        return { data: { result: 'credited', reason: 'full', round_no: 3, tx_id: 't' }, error: null };
      }
      return { data: { ok: true }, error: null };
    });
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(f.client), newId: () => 'rid', toastMs: 5_000 }} />);
    shown.push(tree);
    await flush();
    await press(tree, 'boarding-buy');
    await press(tree, 'boarding-pay');
    await flush();
    expect(textOf(tree, 'boarding-sheet-error')).toBe(BOARDING.buyErrors.credited);
    expect(BOARDING.buyErrors.credited).toBe('결제는 됐지만 그사이 자리가 모두 차서 크레딧 1장으로 돌려드렸어요. 다음 회차에 쓸 수 있어요.');
    expect(f.calls.filter((c) => c.name === TICKET_STATE_RPC).length).toBeGreaterThanOrEqual(2);
  });

  test('데모(서버 모양): 크레딧으로 탄 자리를 취소하면 내역에 +1 "탑승을 취소해 돌려받음" · 처음 쓴 장 −1 은 날짜 없이 회차만', async () => {
    const client = await demoClient('r3boardoncredit2@email.com');
    const api = createBoardingApi(client);
    expect(await api.cancel(1)).toEqual({ ok: true, roundNo: 1, credited: true });
    const raw = await client.rpc('list_ticket_history');
    expect((raw.data as { credits: { reason: string }[] }).credits.map((c) => c.reason)).toEqual(['cancel_return', 'unbalanced']);
    const tree = await mount(<CreditScreen deps={{ api }} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'credits-balance')).toBe('1장');
    expect(allTexts(tree)).toContain(CREDITS.reasons.cancelled);
    expect(textOf(tree, 'credits-row-1-when')).toBe('1회차'); // 쓴 자리를 취소해서 쓴 날은 모름
  });
});

describe('③ 탈퇴 · 모두 지우기 때 기기 목록 지움 · SecureStore 열쇠', () => {
  const box = () => {
    const m = new Map<string, string>();
    return { m, kv: { getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v), removeItem: async (k: string) => void m.delete(k) } };
  };

  test('열쇠 꼴은 SecureStore 가 받는 글자만(영문 · 숫자 · . - _) · 회원마다 따로', () => {
    expect(avoidKeyOf('2f1c9a52-1111-4111-8111-111111111111')).toBe('settings.avoidOrgs.v1_2f1c9a52-1111-4111-8111-111111111111');
    expect(avoidKeyOf('a:b/c')).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  test('탈퇴 확정(confirmWithdraw ok) → 이 회원의 기기 목록 통째로 지움 · 확정 실패면 그대로', async () => {
    const b = box();
    const store = keyValueAvoidStore(b.kv);
    await store.write('u-1', { companies: ['한빛'], schools: [{ key: 'K1', name: '가' }] });
    const failing = createSettingsApi(fakeClient(undefined, () => ({ data: { ok: false }, error: null })).client, 'test', store);
    expect((await failing.confirmWithdraw('123456')).ok).toBe(false);
    expect(b.m.has(avoidKeyOf('u-1'))).toBe(true);
    const api = createSettingsApi(fakeClient().client, 'test', store);
    expect(await api.confirmWithdraw('123456')).toEqual({ ok: true });
    expect(b.m.has(avoidKeyOf('u-1'))).toBe(false);
    expect(await store.read('u-1')).toEqual({ companies: [], schools: [] });
  });

  test('[모두 지우기] = clear_avoid_orgs + 기기 목록 지움(remove) · 메모리 저장소도 지움', async () => {
    const b = box();
    const store = keyValueAvoidStore(b.kv);
    await store.write('u-1', { companies: ['한빛'], schools: [] });
    const f = fakeClient();
    expect(await createSettingsApi(f.client, 'test', store).clearAvoidOrgs()).toEqual({ ok: true });
    expect(f.calls).toEqual([{ name: 'clear_avoid_orgs', args: undefined }]);
    expect(b.m.size).toBe(0);
    const mem = memoryAvoidStore();
    await mem.write('u-1', { companies: ['x'], schools: [] });
    await mem.remove('u-1');
    expect(await mem.read('u-1')).toEqual({ companies: [], schools: [] });
  });

  test('12-Q 새 9줄 글자 그대로', () => {
    expect(AVOID.localNote).toBe('이름은 이 기기에만 보관해요. 기기를 바꾸면 이름은 안 보이지만 피하기는 그대로 돼요.');
    expect(AVOID.otherDevice(2)).toBe('다른 기기에서 넣은 2곳도 피하고 있어요.');
    expect(AVOID.clearAll).toBe('모두 지우기');
    expect(AVOID.clearConfirm).toEqual({
      title: '피할 회사 · 학교를 모두 지울까요?',
      body: '이 기기와 다른 기기에서 넣은 회사 · 학교가 모두 지워져요. 지운 뒤에는 그 회사 · 학교의 분과도 이어질 수 있어요.',
      confirm: '모두 지우기',
      cancel: '취소',
    });
    expect([AVOID.cleared, AVOID.clearFailed]).toEqual(['모두 지웠어요.', '지우지 못했어요. 다시 시도해 주세요.']);
  });

  test('12-5 화면: 목록 아래 한 줄 · 다른 기기에서 넣은 n곳(서버 개수 > 기기 목록) · [모두 지우기] → 확인창 → 토스트 · 서버 0 · 기기 0', async () => {
    const client = await demoClient('r3avoidclear@email.com');
    expect((await client.rpc('set_avoid_org', { p_kind: 'company', p_name: '다른기기회사', p_on: true })).error).toBeNull(); // 기기 목록 밖(다른 기기에서 넣은 곳)
    const api = createSettingsApi(client, 'test');
    const toast = jest.fn();
    const tree = await mount(<AvoidPage api={api} onBack={() => undefined} onToast={toast} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'settings-avoid-local-note')).toBe(AVOID.localNote);
    expect(textOf(tree, 'settings-avoid-other-device')).toBe(AVOID.otherDevice(1));
    await typeInto(tree, 'settings-avoid-company-input', '한빛');
    await press(tree, 'settings-avoid-company-add');
    await flush();
    expect(textOf(tree, 'settings-avoid-other-device')).toBe(AVOID.otherDevice(1)); // 이 기기에서 넣은 곳은 세지 않는다
    await press(tree, 'settings-avoid-clear-all');
    expect(textOf(tree, 'settings-avoid-clear-confirm-title')).toBe(AVOID.clearConfirm.title);
    expect(textOf(tree, 'settings-avoid-clear-confirm-body')).toBe(AVOID.clearConfirm.body);
    await press(tree, 'settings-avoid-clear-confirm-confirm');
    await flush();
    expect(toast).toHaveBeenLastCalledWith(AVOID.cleared);
    expect(has(tree, 'settings-avoid-other-device') || has(tree, 'settings-avoid-company-0') || has(tree, 'settings-avoid-clear-all')).toBe(false);
    const st = await api.loadContactState();
    expect(st.ok && [st.data.companyCount, st.data.schoolCount]).toEqual([0, 0]);
    const loaded = await api.loadAvoid();
    expect(loaded.ok && [loaded.data.companies, loaded.data.otherCount]).toEqual([[], 0]);
  });

  test('[모두 지우기] 실패: 확인창 닫고 실패 한 줄 · 목록 그대로', async () => {
    const state = { on: false, avoid_org_on: true, avoid_company: 1, avoid_school: 0 };
    const f = fakeClient((name) => (name === 'clear_avoid_orgs' ? { data: null, error: { code: 'P0001', message: 'boom' } } : { data: name === 'get_contact_block_state' ? state : { ok: true }, error: null }));
    const tree = await mount(<AvoidPage api={createSettingsApi(f.client, 'test')} onBack={() => undefined} onToast={() => undefined} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'settings-avoid-other-device')).toBe(AVOID.otherDevice(1));
    await press(tree, 'settings-avoid-clear-all');
    await press(tree, 'settings-avoid-clear-confirm-confirm');
    await flush();
    expect(textOf(tree, 'settings-avoid-error')).toBe(AVOID.clearFailed);
    expect(has(tree, 'settings-avoid-other-device')).toBe(true);
  });

  test('보안 T126: 앱 코드(주석 제외)에서 피할 회사 · 학교 목록은 AsyncStorage 를 쓰지 않는다', () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const f of ['lib/services.ts', 'lib/avoidLocal.ts', 'lib/settingsApi.ts']) expect(strip(readFileSync(join(__dirname, '..', f), 'utf8'))).not.toMatch(/AsyncStorage/);
    expect(readFileSync(join(__dirname, '..', 'lib/services.ts'), 'utf8')).toMatch(/keyValueAvoidStore\(avoidStorage\)/);
  });
});

describe('법무 L21 10-2(팀장 덧붙임): 사업자 정보 전자우편주소 줄 · {전자우편주소} = {고객센터 이메일} 같은 값 하나', () => {
  const FULL = { name: '결정사', ceo: '홍OO', reportNo: '제2027-1호', bizRegNo: '123-45-67890', address: '서울', phone: '02-000-0000' };
  test('전화번호 다음 줄 · 비면 그 줄만 숨김(법정 6줄은 그대로)', () => {
    expect(businessRows({ ...FULL, email: 'help@example.com' })?.map((r) => [r.key, r.label])).toEqual([
      ['name', '상호'],
      ['ceo', '대표자'],
      ['reportNo', '국내결혼중개업 신고번호'],
      ['bizRegNo', '사업자등록번호'],
      ['address', '사무소 주소'],
      ['phone', '전화번호'],
      ['email', '전자우편주소'],
    ]);
    expect(businessRows({ ...FULL, email: null })?.map((r) => r.key)).toEqual(['name', 'ceo', 'reportNo', 'bizRegNo', 'address', 'phone']);
    expect(businessRows({ ...FULL, phone: null, email: 'help@example.com' })).toBeNull();
  });

  test('값 한 곳: 고객센터 화면 · 법무 글 자리 두 이름이 모두 CONTACT_EMAIL · 생성물 FILL_INS 에 {전자우편주소} 자리(19개)', () => {
    expect(SUPPORT_CONTACT.email).toBe(CONTACT_EMAIL);
    expect(LEGAL_FILL_VALUES['전자우편주소']).toBe(CONTACT_EMAIL);
    expect(LEGAL_FILL_VALUES['고객센터 이메일']).toBe(CONTACT_EMAIL);
    expect('전자우편주소' in FILL_INS).toBe(true);
    expect(Object.keys(FILL_INS)).toHaveLength(19);
    expect(fillText('전자우편주소: {전자우편주소}', { ...LEGAL_FILL_VALUES, '전자우편주소': 'help@example.com' }).text).toBe('전자우편주소: help@example.com');
    expect(fillText('{전자우편주소}').missing).toBe(CONTACT_EMAIL === null); // 지금은 값이 비어 그 줄을 숨긴다
  });
});

describe('④ 지인 차단 — 기기 해시 → sync_contact_hashes', () => {
  test('해시 꼴 = 서버 정의: SHA-256("kjs1|" + 앞뒤 빈칸 뗀 소문자 이메일) 16진 64자 · 겹침 · 모양 아닌 값 버림', async () => {
    expect(normalizeEmail('  Friend.Two@Example.com ')).toBe('friend.two@example.com');
    expect(normalizeEmail('없음')).toBeNull();
    const hashes = await contactHashes(['friend.one@example.com', ' FRIEND.ONE@example.com', '전화만', 'friend.two@example.com'], nodeSha);
    expect(hashes).toEqual([createHash('sha256').update('kjs1|friend.one@example.com').digest('hex'), createHash('sha256').update('kjs1|friend.two@example.com').digest('hex')]);
    expect(hashes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  test('서버 쪽 맞춤(0037): HMAC(pepper, 기기가 보낸 32바이트) = 회원 키 HMAC(pepper, SHA-256("kjs1|" + lower(btrim(가입 이메일)))) — 앱은 pepper 를 모른다', async () => {
    const pepper = Buffer.from('test-pepper-0123456789-abcdefghij-klmn');
    const [sent] = await contactHashes(['Kim.Hana@Example.com'], nodeSha);
    const serverSide = createHmac('sha256', pepper).update(Buffer.from(sent, 'hex')).digest('hex');
    const memberKey = createHmac('sha256', pepper).update(createHash('sha256').update(`kjs1|${' kim.hana@example.com '.trim().toLowerCase()}`, 'utf8').digest()).digest('hex');
    expect(serverSide).toBe(memberKey);
  });

  const port = (over: Partial<ContactsPort> = {}): ContactsPort => ({ available: async () => true, request: async () => 'granted', emails: async () => ['a@x.com'], ...over });
  const syncApi = (over: Partial<ContactSyncDeps['api']> = {}) => {
    const calls: { syncId: string; n: number; mode: string; final: boolean }[] = [];
    const consents: string[] = [];
    const api: ContactSyncDeps['api'] = {
      syncContacts: async (syncId, hashes, mode, final) => {
        calls.push({ syncId, n: hashes.length, mode, final });
        return { ok: true };
      },
      loadConsents: async () => ({ ok: true, data: { CK4: false, CK9: false, CK11: false, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false } }),
      setOptional: async (code) => {
        consents.push(code);
        return { ok: true };
      },
      markContactPrompted: async () => ({ ok: true }),
      ...over,
    };
    return { api, calls, consents };
  };

  test('흐름: CK11 동의(없으면 기록) → 권한 → 이메일만 해시 → 500개씩 같은 동기화 ID · replace · 마지막 묶음만 final', async () => {
    const s = syncApi();
    const emails = Array.from({ length: 1_201 }, (_, i) => `p${i}@x.com`);
    const r = await runContactSync({ contacts: port({ emails: async () => emails }), sha256: nodeSha, newId: () => 'sync-1', api: s.api });
    expect(r).toEqual({ ok: true, kind: 'done' });
    expect(s.consents).toEqual(['CK11']);
    expect(s.calls).toEqual([
      { syncId: 'sync-1', n: CONTACT_BATCH, mode: 'replace', final: false },
      { syncId: 'sync-1', n: CONTACT_BATCH, mode: 'replace', final: false },
      { syncId: 'sync-1', n: 201, mode: 'replace', final: true },
    ]);
  });

  test('갈림길: 주소록 없음(웹) · 거부 · 다시 묻지 않음 · 연락처 0 · 동의 저장 실패 · 첫 묶음 실패 · 둘째 묶음 실패(일부) — 결과 글', async () => {
    const run = (contacts: ContactsPort, api = syncApi().api) => runContactSync({ contacts, sha256: nodeSha, newId: () => 's', api });
    expect(await run(port({ available: async () => false }))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await run(port({ request: async () => 'denied' }))).toEqual({ ok: false, reason: 'denied' });
    expect(await run(port({ request: async () => 'blocked' }))).toEqual({ ok: false, reason: 'blocked' });
    expect(await run(port({ emails: async () => ['번호만'] }))).toEqual({ ok: true, kind: 'none' });
    expect(await run(port(), syncApi({ setOptional: async () => ({ ok: false, reason: 'server' }) }).api)).toEqual({ ok: false, reason: 'consent_save' });
    expect(await run(port(), syncApi({ syncContacts: async () => ({ ok: false, reason: 'limit' }) }).api)).toEqual({ ok: false, reason: 'limit' });
    let n = 0;
    const second = syncApi({ syncContacts: async () => (++n === 2 ? { ok: false, reason: 'network' } : { ok: true }) });
    expect(await run(port({ emails: async () => Array.from({ length: 600 }, (_, i) => `q${i}@x.com`) }), second.api)).toEqual({ ok: false, reason: 'partial' });
    const already = syncApi({ loadConsents: async () => ({ ok: true, data: { CK4: false, CK9: false, CK11: true, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false } }) });
    await run(port(), already.api);
    expect(already.consents).toEqual([]); // 이미 동의했으면 다시 기록하지 않는다
    expect(contactResultText({ ok: true, kind: 'done' })).toBe(CONTACT_BLOCK.done);
    expect(contactResultText({ ok: true, kind: 'none' })).toBe(CONTACT_BLOCK.noContacts);
    expect(contactResultText({ ok: false, reason: 'blocked' })).toBe(CONTACT_BLOCK.deniedForever);
    expect(contactResultText({ ok: false, reason: 'partial' })).toBe(CONTACT_BLOCK.partialFail);
    expect(contactResultText({ ok: false, reason: 'limit' })).toBe(AVOID.saveFailed);
  });

  test("데모 경로(스위치 contact_block 켜짐): 12-5 [지인 차단] → 시트 → [주소록 허용하기] → CK11 기록 · 해시만 서버로 · '끝났어요' 토스트", async () => {
    const client = await demoClient('r3contact@email.com');
    const api = createSettingsApi(client, 'test');
    const sent: string[][] = [];
    const rpc = client.rpc.bind(client);
    (client as unknown as { rpc: typeof rpc }).rpc = ((name: string, args?: Record<string, unknown>) => {
      if (name === 'sync_contact_hashes') sent.push((args?.p_hashes as string[]) ?? []);
      return rpc(name, args);
    }) as typeof rpc;
    const toast = jest.fn();
    const contact = () => ({ contacts: port({ emails: async () => ['friend.one@example.com', ' Friend.Two@Example.com '] }), sha256: nodeSha, newId: () => '11111111-1111-4111-8111-111111111111' });
    const tree = await mount(<AvoidPage api={api} onBack={() => undefined} onToast={toast} contact={contact} />);
    shown.push(tree);
    await flush();
    await press(tree, 'settings-avoid-contact');
    expect(textOf(tree, 'settings-contact-sheet-title')).toBe(CONTACT_BLOCK.sheetTitle);
    expect(textOf(tree, 'settings-contact-email-only')).toBe(CONTACT_BLOCK.emailOnly);
    expect(CK11_LABEL).toMatch(/^\[선택\] 주소록/);
    expect(textOf(tree, 'settings-contact-ck11')).toBe(CK11_LABEL); // 법무 4-11 생성물 그대로
    // D46-A 덧붙임(카피 14-7 12-5 확정): 체크 글 아래 두 줄 늘 보임 · 버튼 '동의하고 주소록 허용하기' · 시트 글 v5
    expect(textOf(tree, 'settings-contact-optional-note')).toBe('동의하지 않아도 모든 기능을 똑같이 쓸 수 있어요.');
    expect(textOf(tree, 'settings-contact-withdraw-note')).toBe('설정에서 언제든 동의를 거둘 수 있어요.');
    expect(CONTACT_BLOCK.allow).toBe('동의하고 주소록 허용하기');
    expect([CONTACT_BLOCK.sheetTitle, CONTACT_BLOCK.done, CONTACT_BLOCK.deniedForever]).toEqual(['아는 분과 이어지고 싶지 않다면', '비교를 마쳤어요. 맞은 분과는 서로 이어지지 않아요.', '주소록은 기기 설정에서 허용할 수 있어요.']);
    await press(tree, 'settings-contact-allow');
    await flush();
    expect(toast).toHaveBeenLastCalledWith(CONTACT_BLOCK.done);
    expect(sent).toEqual([[createHash('sha256').update('kjs1|friend.one@example.com').digest('hex'), createHash('sha256').update('kjs1|friend.two@example.com').digest('hex')]]);
    expect(JSON.stringify(sent)).not.toMatch(/friend|example/);
    const consents = await api.loadConsents();
    expect(consents.ok && consents.data.CK11).toBe(true);
    const st = await api.loadContactState();
    expect(st.ok && st.data.contactOn).toBe(true);
  });

  test("스위치 contact_block 꺼짐(데모 avoidoff) · 기기 연결 없음: 지인 차단 줄은 '준비 중' 그대로 · 시트 없음", async () => {
    const off = await mount(<AvoidPage api={createSettingsApi(await demoClient('avoidoff3b@email.com'), 'test')} onBack={() => undefined} onToast={() => undefined} contact={() => ({ contacts: port(), sha256: nodeSha, newId: () => 's' })} />);
    shown.push(off);
    await flush();
    await press(off, 'settings-avoid-contact');
    expect(has(off, 'settings-contact-sheet-title')).toBe(false);
    const noPorts = await mount(<AvoidPage api={createSettingsApi(await demoClient('r3contact2@email.com'), 'test')} onBack={() => undefined} onToast={() => undefined} />);
    shown.push(noPorts);
    await flush();
    await press(noPorts, 'settings-avoid-contact');
    expect(has(noPorts, 'settings-contact-sheet-title')).toBe(false);
  });
});
