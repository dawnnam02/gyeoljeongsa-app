// QP-A 3부-마(D-199 ~ D-202 R-A 후속): 백엔드 0037 확정 함수 이름 · 인자 · 응답에 앱을 맞춘 것.
//  ① 탑승 취소 cancel_ticket_seat(p_round_no) → result 'credited'(결제 좌석도 크레딧 1장 · T1 으로)
//  ② 계약 설명 확인 기록 ack_ticket_contract(p_round_no, p_text_version) — 결제 전, 실패하면 결제 0
//  ③ 아는 분 피하기 7개(get_contact_block_state · sync_contact_hashes · set_contact_block_options · clear_contact_links · mark_contact_prompted · set_avoid_org · clear_avoid_orgs)
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { AVOID, SETTINGS } from '@/content/settingsCopy';
import { ACK_CONTRACT_RPC, CANCEL_TICKET_RPC, createBoardingApi } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { afterCancel, contractVersion } from '@/features/boarding/boardingLogic';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { AvoidPage } from '@/features/settings/AvoidPage';
import { keyValueAvoidStore, memoryAvoidStore } from '@/lib/avoidLocal';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { AVOID_RPC, createSettingsApi, parseContactState } from '@/lib/settingsApi';

import { has, hasText, mount, press, textOf, typeInto } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

async function demoClient(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
// 이름 · 인자만 받아 적는 가짜 클라이언트(응답은 표에서)
function fakeClient(answer: (name: string, args: unknown) => { data: unknown; error: { code?: string; message: string } | null } = () => ({ data: { ok: true }, error: null })) {
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

describe('① 탑승 취소 — 0037 cancel_ticket_seat(p_round_no) → result credited', () => {
  test('이름 · 인자 · 응답 읽기 · 오류 closed · not_found → 마감 글, forbidden → 실패, 인터넷 → network', async () => {
    const ok = fakeClient(() => ({ data: { ok: true, round_no: 3, paid_by: 'purchase', result: 'credited', lot_id: 9 }, error: null }));
    expect(await createBoardingApi(ok.client).cancel(3)).toEqual({ ok: true, roundNo: 3, credited: true });
    expect(ok.calls).toEqual([{ name: CANCEL_TICKET_RPC, args: { p_round_no: 3 } }]);
    expect(CANCEL_TICKET_RPC).toBe('cancel_ticket_seat');
    const err = (message: string, code = 'P0001') => createBoardingApi(fakeClient(() => ({ data: null, error: { code, message } })).client).cancel(1);
    expect(await err('closed')).toEqual({ ok: false, reason: 'closed' });
    expect(await err('not_found')).toEqual({ ok: false, reason: 'closed' });
    expect(await err('forbidden', '42501')).toEqual({ ok: false, reason: 'server' });
    expect(await err('Failed to fetch', '')).toEqual({ ok: false, reason: 'network' });
  });

  test('afterCancel: 탑승권을 내려놓고 크레딧 +1(credited) — 판매 중(T1) 모습', () => {
    const s = { now: 1, offset: 0, round: { no: 1, matchAt: 100, saleOpenAt: 0, saleCloseAt: 50 }, phase: 'on_sale' as const, regionName: null, seat: 'open' as const, ticket: { roundNo: 1, boughtAt: 1, paidWith: 'store' as const }, credits: 0, ineligible: null, result: null, past: [] };
    expect(afterCancel(s, true)).toMatchObject({ ticket: null, credits: 1, phase: 'on_sale' });
    expect(afterCancel(s, false).credits).toBe(0);
  });

  test('결제로 탄 좌석(데모)도 취소하면 크레딧 1장 · 탑승권 화면은 판매 중(T1) + 크레딧 줄', async () => {
    const client = await demoClient('r37boardon@email.com');
    const api = createBoardingApi(client);
    const tree = await mount(<BoardingScreen deps={{ api, newId: () => 'req-r37', toastMs: 5_000 }} />);
    shown.push(tree);
    await flush();
    expect(has(tree, 'boarding-credits')).toBe(false);
    await press(tree, 'boarding-cancel');
    await press(tree, 'boarding-cancel-confirm-confirm');
    await flush();
    expect(hasText(tree, BOARDING.cancel.done)).toBe(true);
    expect(has(tree, 'boarding-buy')).toBe(true);
    expect(has(tree, 'boarding-credits') && hasText(tree, BOARDING.creditsLink(1))).toBe(true);
    const ledger = await api.ledger();
    expect(ledger.ok && ledger.balance).toBe(1);
    expect(ledger.ok && ledger.items[0].reason).toBe('cancelled');
  });
});

describe('② 계약 설명 확인 기록 — 0037 ack_ticket_contract(p_round_no, p_text_version)', () => {
  test('이름 · 인자 · 응답 { ok } · 오류는 결제 오류 글로(network · server)', async () => {
    const ok = fakeClient();
    expect(await createBoardingApi(ok.client).ackContract(2, 'contract-5-8-0000abcd')).toEqual({ ok: true });
    expect(ok.calls).toEqual([{ name: ACK_CONTRACT_RPC, args: { p_round_no: 2, p_text_version: 'contract-5-8-0000abcd' } }]);
    expect(ACK_CONTRACT_RPC).toBe('ack_ticket_contract');
    const bad = fakeClient(() => ({ data: null, error: { code: 'P0001', message: 'invalid_value' } }));
    expect(await createBoardingApi(bad.client).ackContract(2, 'x')).toEqual({ ok: false, reason: 'server' });
    const off = fakeClient(() => ({ data: null, error: { code: '', message: 'Failed to fetch' } }));
    expect(await createBoardingApi(off.client).ackContract(2, 'contract-5-8-0000abcd')).toEqual({ ok: false, reason: 'network' });
  });

  test('판: 보인 글의 지문(4 ~ 60자) — 같은 글이면 같고, 한 자라도 다르면 다르다', () => {
    const v = contractVersion(['제목', '줄 1', '줄 2']);
    expect(v).toMatch(/^contract-5-8-[0-9a-f]{8}$/);
    expect(v.length).toBeGreaterThanOrEqual(4);
    expect(v.length).toBeLessThanOrEqual(60);
    expect(contractVersion(['제목', '줄 1', '줄 2'])).toBe(v);
    expect(contractVersion(['제목', '줄 1', '줄 3'])).not.toBe(v);
  });

  test('결제 버튼: 요약 블록을 보인 시트에서 ack 먼저 → 결제', async () => {
    const client = await demoClient('r37onsale@email.com');
    const api = createBoardingApi(client);
    const ack = jest.spyOn(api, 'ackContract');
    const buy = jest.spyOn(api, 'buy');
    const tree = await mount(<BoardingScreen deps={{ api, newId: () => 'req-r37-buy', toastMs: 5_000 }} />);
    shown.push(tree);
    await flush();
    await press(tree, 'boarding-buy');
    expect(has(tree, 'boarding-contract-summary')).toBe(true);
    await press(tree, 'boarding-pay');
    await flush();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack.mock.calls[0][0]).toBe(1);
    expect(ack.mock.calls[0][1]).toMatch(/^contract-5-8-[0-9a-f]{8}$/);
    expect(buy).toHaveBeenCalledTimes(1);
    expect(ack.mock.invocationCallOrder[0]).toBeLessThan(buy.mock.invocationCallOrder[0]);
    expect(hasText(tree, BOARDING.bought)).toBe(true);
  });

  test('기록이 남지 않으면 결제하지 않고 시트에 오류 한 줄', async () => {
    const client = await demoClient('r37onsale2@email.com');
    const api = createBoardingApi(client);
    const failing = { ...api, ackContract: jest.fn(async () => ({ ok: false as const, reason: 'network' as const })), buy: jest.fn(api.buy) };
    const tree = await mount(<BoardingScreen deps={{ api: failing, newId: () => 'req-r37-fail', toastMs: 5_000 }} />);
    shown.push(tree);
    await flush();
    await press(tree, 'boarding-buy');
    await press(tree, 'boarding-pay');
    await flush();
    expect(failing.ackContract).toHaveBeenCalledTimes(1);
    expect(failing.buy).not.toHaveBeenCalled();
    expect(textOf(tree, 'boarding-sheet-error')).toBe(BOARDING.buyErrors.network);
  });
});

describe('③ 아는 분 피하기 — 0037 앱 함수 7개', () => {
  const HASH = 'a'.repeat(64);

  test('이름 · 인자: 상태 · 회사 · 학교 · 이메일 비교 · 묶음 설정 · 동기화 · 지우기 · 안내 시각', async () => {
    const state = { on: false, avoid_org_on: true, enabled: true, avoid_on: true, auto_sync: false, share_my_key: true, last_synced_at: null, avoid_company: 0, avoid_school: 0, can_sync_today: true };
    const f = fakeClient((name) => ({ data: name === AVOID_RPC.state ? state : { ok: true }, error: null }));
    const api = createSettingsApi(f.client, 'test');
    expect(await api.loadAvoid()).toEqual({ ok: true, data: { companies: [], schools: [], shareEmail: true, orgOn: true, otherCount: 0, contactOn: false } });
    await api.setAvoidCompany(' (주)한빛 ', true);
    await api.setAvoidSchool({ key: 'K0001', name: '가야대학교(고령)' }, false);
    await api.setShareEmail(false);
    await api.setContactOptions({ autoSync: true, avoidOn: false });
    await api.syncContacts('11111111-1111-4111-8111-111111111111', [HASH], 'replace', true);
    await api.clearContacts();
    await api.markContactPrompted();
    await api.clearAvoidOrgs();
    expect(f.calls).toEqual([
      { name: 'get_contact_block_state', args: undefined },
      { name: 'set_avoid_org', args: { p_kind: 'company', p_name: '(주)한빛', p_on: true } },
      { name: 'set_avoid_org', args: { p_kind: 'school', p_name: '가야대학교(고령)', p_on: false } },
      { name: 'set_contact_block_options', args: { p_share_my_key: false } },
      { name: 'set_contact_block_options', args: { p_auto_sync: true, p_avoid_on: false } },
      { name: 'sync_contact_hashes', args: { p_sync_id: '11111111-1111-4111-8111-111111111111', p_hashes: [HASH], p_mode: 'replace', p_final: true } },
      { name: 'clear_contact_links', args: undefined },
      { name: 'mark_contact_prompted', args: undefined },
      { name: 'clear_avoid_orgs', args: undefined },
    ]);
    expect(Object.values(AVOID_RPC).sort()).toEqual(['clear_avoid_orgs', 'clear_contact_links', 'get_contact_block_state', 'mark_contact_prompted', 'set_avoid_org', 'set_contact_block_options', 'sync_contact_hashes']);
  });

  test('동기화: 모양이 틀린 키 · 500개 넘음은 보내지 않음 · 서버 오류 코드 → off · consent · limit · invalid', async () => {
    const none = fakeClient();
    const api = createSettingsApi(none.client, 'test');
    expect(await api.syncContacts('s', ['ABC'], 'add', true)).toEqual({ ok: false, reason: 'invalid' });
    expect(await api.syncContacts('s', Array.from({ length: 501 }, () => HASH), 'add', true)).toEqual({ ok: false, reason: 'invalid' });
    expect(none.calls).toEqual([]);
    const err = async (message: string, code = 'P0001') => createSettingsApi(fakeClient(() => ({ data: null, error: { code, message } })).client, 'test').syncContacts('s', [HASH], 'add', true);
    expect(await err('feature_off', '42501')).toEqual({ ok: false, reason: 'off' });
    expect(await err('consent_required')).toEqual({ ok: false, reason: 'consent' });
    expect(await err('rate_limited')).toEqual({ ok: false, reason: 'limit' });
    expect(await err('too_large')).toEqual({ ok: false, reason: 'invalid' });
  });

  test('상태 읽기: 스위치는 true 일 때만 켜짐 · 회원 설정 처음값 켜짐 · 개수만(이름 없음)', () => {
    expect(parseContactState(null)).toBeNull();
    expect(parseContactState({})).toEqual({ contactOn: false, orgOn: false, enabled: true, avoidOn: true, autoSync: false, shareMyKey: true, companyCount: 0, schoolCount: 0, canSyncToday: true });
    expect(parseContactState({ on: true, avoid_org_on: true, share_my_key: false, avoid_company: 2, avoid_school: -1, can_sync_today: false })).toMatchObject({ contactOn: true, orgOn: true, shareMyKey: false, companyCount: 2, schoolCount: 0, canSyncToday: false });
  });

  test('기기 목록: 회원마다 따로 · 깨진 값은 빈 목록 · 5곳까지', async () => {
    const box = new Map<string, string>();
    const store = keyValueAvoidStore({ getItem: async (k) => box.get(k) ?? null, setItem: async (k, v) => void box.set(k, v) });
    await store.write('a', { companies: ['한빛', '한빛', ' ', '1', '2', '3', '4', '5'], schools: [{ key: 'K1', name: '가' }] });
    expect(await store.read('a')).toEqual({ companies: ['한빛', '1', '2', '3', '4'], schools: [{ key: 'K1', name: '가' }] });
    expect(await store.read('b')).toEqual({ companies: [], schools: [] });
    box.set('settings.avoidOrgs.v1_c', '{깨짐'); // 3부-바: SecureStore 열쇠 꼴('_' 로 이음)
    expect(await store.read('c')).toEqual({ companies: [], schools: [] });
    const mem = memoryAvoidStore();
    await mem.write('a', { companies: ['x'], schools: [] });
    expect(await mem.read('a')).toEqual({ companies: ['x'], schools: [] });
  });

  test('데모: 서버는 개수만 · 이름은 기기 목록 · 같은 이름(기호 · (주) 차이)은 한 곳 · 5곳 넘으면 too_many', async () => {
    const client = await demoClient('r37avoid@email.com');
    const api = createSettingsApi(client, 'test');
    expect((await api.setAvoidCompany('(주)한빛', true)).ok).toBe(true);
    expect((await api.setAvoidCompany('한 빛', true)).ok).toBe(true);
    const st = await api.loadContactState();
    expect(st.ok && st.data.companyCount).toBe(1);
    const raw = await client.rpc('get_contact_block_state');
    expect(JSON.stringify(raw.data)).not.toMatch(/한빛|한 빛/);
    for (const n of ['b', 'c', 'd', 'e']) expect((await api.setAvoidCompany(n, true)).ok).toBe(true);
    const full = await client.rpc('set_avoid_org', { p_kind: 'company', p_name: 'f', p_on: true });
    expect(full.error?.message).toBe('too_many');
    const loaded = await api.loadAvoid();
    expect(loaded.ok && loaded.data.companies).toEqual(['한 빛', 'b', 'c', 'd', 'e']); // 서버에서 한 곳인 이름은 기기 목록에서도 한 줄(나중 이름)
    expect((await api.setAvoidSchool({ key: 'K0001', name: '가야대학교(고령)' }, true)).ok).toBe(true);
    const after = await api.loadContactState();
    expect(after.ok && after.data.schoolCount).toBe(1);
  });

  test("12-5 스위치 avoid_org 꺼짐(데모 avoidoff): 회사 · 학교 자리는 '준비 중' 줄 · 입력 없음 · 서버도 feature_off · 이메일 비교 스위치는 그대로", async () => {
    const client = await demoClient('avoidoff@email.com');
    const api = createSettingsApi(client, 'test');
    const toast = jest.fn();
    const tree = await mount(<AvoidPage api={api} onBack={() => undefined} onToast={toast} />);
    shown.push(tree);
    await flush();
    expect(has(tree, 'settings-avoid-company-soon')).toBe(true);
    expect(has(tree, 'settings-avoid-school-soon')).toBe(true);
    expect(has(tree, 'settings-avoid-company-input')).toBe(false);
    expect(has(tree, 'settings-avoid-school-input')).toBe(false);
    await press(tree, 'settings-avoid-company-soon');
    expect(toast).toHaveBeenCalledWith(SETTINGS.verificationToast);
    expect(hasText(tree, AVOID.companyTitle)).toBe(true);
    expect((await api.setAvoidCompany('한빛', true)).ok).toBe(false);
    await press(tree, 'settings-avoid-share-email');
    await flush();
    const saved = await api.loadAvoid();
    expect(saved.ok && saved.data.shareEmail).toBe(false);
  });

  test('12-5 켜짐: 회사를 넣고 지우면 서버 개수와 기기 목록이 같이 움직인다', async () => {
    const client = await demoClient('r37avoidui@email.com');
    const api = createSettingsApi(client, 'test');
    const tree = await mount(<AvoidPage api={api} onBack={() => undefined} onToast={() => undefined} />);
    shown.push(tree);
    await flush();
    await typeInto(tree, 'settings-avoid-company-input', '한빛');
    await press(tree, 'settings-avoid-company-add');
    await flush();
    let st = await api.loadContactState();
    expect(st.ok && st.data.companyCount).toBe(1);
    expect(has(tree, 'settings-avoid-company-0') && hasText(tree, '한빛')).toBe(true);
    await press(tree, 'settings-avoid-company-0-remove');
    await flush();
    st = await api.loadContactState();
    expect(st.ok && st.data.companyCount).toBe(0);
    const loaded = await api.loadAvoid();
    expect(loaded.ok && loaded.data.companies).toEqual([]);
  });

  test('옛 앱 제안 이름(get_avoid_settings · set_avoid_orgs · set_share_email)을 부르는 코드 0', () => {
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
    const hits = files.filter((p) => /['"](get_avoid_settings|set_avoid_orgs|set_share_email)['"]/.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
});
