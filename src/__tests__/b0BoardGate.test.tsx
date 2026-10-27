// 검수 B0(척추 Q2 위반 후보, 10-27 팀장 덧붙임): 데모 서버의 탑승 판정을 실서버 관문과 같게.
//  실서버 ticket_board_check → ticket_profile_ready(0030 · 0036 [8]) = politics_ready(유효한 CK15 + 정치 답) · 등급 행 · 종교 답(7코드).
//  데모: 설문 모의 서버(surveyV2Backend 공유 기록)의 CK15 · 정치 · 종교 A06 을 본다 — 하나라도 없으면 'profile_incomplete' →
//  T1 '살 수 없음'(BOARDING.ineligible) · 자리 잡기 · 결제 · 크레딧 탑승 모두 0. 데모 줄 '설문 완료 · 정상 응답'으로 건너뛴 계정은 다 마친 사람으로 본다
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react-test-renderer';

import { createSurveyV2DemoClient } from '@/demo/surveyV2Backend';
import { createBoardingApi } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';

import { has, mount, textOf } from './renderHelpers';

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

// 한 모의 서버에 여러 계정(계정 id 가 겹치지 않게) — 설문 모의 서버 기록은 계정 id 로 나뉜다
const backend = createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) });
async function signIn(email: string) {
  const client = createDemoClient(backend);
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  const survey = createSurveyV2DemoClient(client);
  return { client, survey };
}
type Steps = { ck15?: boolean; politics?: boolean; religion?: boolean };
async function answer(survey: SupabaseClient, s: Steps) {
  if (s.ck15) expect((await survey.from('consents').insert([{ item_code: 'CK15', agreed: true }])).error).toBeNull();
  if (s.politics) {
    const r = await survey.rpc('set_politics', { p_position: 50 });
    if (s.ck15) expect(r.error).toBeNull();
    else expect(r.error?.message).toBe('consent_required: CK15'); // CK15 없이는 정치 답을 저장할 수도 없다
  }
  if (s.religion) expect((await survey.rpc('save_answers', { p_answers: { A06: 'none' } })).error).toBeNull();
  else expect((await survey.rpc('get_progress')).error).toBeNull(); // 설문을 연 계정(기록 있음)
}
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

describe('B0 탑승 관문 = 실서버 ticket_profile_ready(CK15 + 정치 답 + 종교 답)', () => {
  const cases: [string, Steps][] = [
    ['정치 빈칸(정치 카드 [나중에] → 제출)', { ck15: true, religion: true }],
    ['CK15 없음', { politics: true, religion: true }],
    ['종교 빈칸', { ck15: true, politics: true }],
  ];
  test.each(cases)('%s → 탑승 0: can_board false · profile_incomplete · 자리 잡기 · 결제 · 크레딧 탑승 0', async (_name, steps) => {
    const { client, survey } = await signIn(`b0-${Object.keys(steps).join('-')}@email.com`);
    await answer(survey, steps);
    const st = await client.rpc('get_ticket_state');
    expect(st.data).toMatchObject({ can_board: false, reason: 'profile_incomplete' });
    const api = createBoardingApi(client);
    expect(await api.buy('rq-1', false, 1)).toEqual({ ok: false, reason: 'not_eligible' });
    expect(await api.buy('rq-2', true, 1)).toEqual({ ok: false, reason: 'not_eligible' });
    expect((await client.rpc('hold_ticket_seat', { p_round_no: 1 })).data).toMatchObject({ ok: false, reason: 'profile_incomplete' });
    expect((await client.rpc('demo_buy_ticket', { p_request_id: 'rq-3' })).error?.message).toBe('no_hold'); // 잡은 자리가 없으니 결제도 0
    const w = await client.rpc('get_weekly_match');
    expect(w.data).toEqual({ state: 'none' }); // 탄 회차 0
  });

  test('셋 다 있으면 탈 수 있다(판매 중 → 결제 → 탑승)', async () => {
    const { client, survey } = await signIn('b0-ready@email.com');
    await answer(survey, { ck15: true, politics: true, religion: true });
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true, reason: null });
    expect(await createBoardingApi(client).buy('ok-1', false, 1)).toEqual({ ok: true, roundNo: 1 });
  });

  test("데모 줄 '설문 완료 · 정상 응답'(건너뛰기)은 다 마친 사람 · 설문을 열지 않은 장면 계정도 그대로(웹 점검 · 장면)", async () => {
    const skip = await signIn('b0-skip@email.com');
    await answer(skip.survey, {}); // 설문을 열었지만 답 0
    expect((await skip.client.rpc('get_ticket_state')).data).toMatchObject({ can_board: false });
    await skip.client.functions.invoke('ai-profile', { body: { action: 'start', demo_scenario: 'ok' } });
    expect((await skip.client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true });
    const plain = await signIn('b0-plain@email.com');
    expect((await plain.client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true });
  });

  test("T1: '살 수 없음' 안내(카피 14-5 ineligible — 서버 사유가 하나라 정치 문항 글) · [탑승권 사기] 0", async () => {
    const { client, survey } = await signIn('b0-t1@email.com');
    await answer(survey, { ck15: true, religion: true });
    const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'rid', toastMs: 5_000 }} />);
    await flush();
    await flush();
    expect(has(tree, 'boarding-status-ineligible')).toBe(true);
    expect(textOf(tree, 'boarding-status-title')).toBe(BOARDING.ineligible.politics_missing.title);
    expect(has(tree, 'boarding-buy')).toBe(false);
    act(() => tree.unmount());
  });
});
