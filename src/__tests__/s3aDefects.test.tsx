// 3부-아 ③(D-223): 검수 결함 — QP-10(채팅 신고 · 차단이 설정 목록에) · QP-09(성향 확인 두 번) · QP-32([설문으로] 뒤 여러 번 누름)
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { createBoardingApi, TICKET_STATE_RPC } from '@/features/boarding/boardingApi';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { TraitsScreen, type TraitsDeps } from '@/features/ai/TraitsScreen';
import { createDemoChatApi } from '@/features/chat/chatDemo';
import { createDemoV2Memory, createSurveyV2DemoClient, demoV2Seed } from '@/demo/surveyV2Backend';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import { createReligionApi } from '@/features/surveyV2/religion';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import { chunkedStorage } from '@/lib/chunkedStorage';
import { DEMO_AI_RESULT } from '@/lib/demoAiSample';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';
import type { AiRow } from '@/types/ai';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createMemoryStore } from './memoryStore';
import { has, mount, press } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]), Stack: { Screen: () => null } };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: jest.fn(), resetAll: jest.fn() }) } }));

const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
  jest.clearAllMocks();
});

describe('QP-10 채팅에서 한 신고 · 차단이 12 신고 내역 · 차단 목록에', () => {
  test('데모: 신고 → 신고 내역 1건(접수됨) · 차단 목록에도 · 차단 → 차단 목록(이름 가림) · 실서버는 같은 표(0031 → reports · block_pair)', async () => {
    const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22) }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email: 'chatsafety@email.com' } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email: 'chatsafety@email.com', token: DEMO_OTP_CODE } });
    const who = async () => {
      const u = (await client.auth.getSession()).data.session?.user;
      return u ? { id: u.id, email: u.email ?? '' } : null;
    };
    const note = async (partner: string, reason?: string) => void (await client.rpc('demo_note_chat_safety', { p_partner: partner, ...(reason ? { p_reason: reason } : {}) }));
    const chat = createDemoChatApi({ who, note, replyMs: 600_000, clock: () => 1_000_000 });
    const settings = createSettingsApi(client as unknown as SupabaseClient, 't');
    const rooms = await chat.listRooms();
    if (!rooms.ok) throw new Error('rooms');
    const room = rooms.data[0];
    expect(await chat.report(room.id, 'RP1', '')).toEqual({ ok: true });
    const reports = await settings.loadReports();
    expect(reports.ok && reports.data.map((r) => r.status)).toEqual(['received']);
    const blocked = await settings.loadBlocked();
    expect(blocked.ok && blocked.data.map((b) => b.userId)).toEqual([room.partner.id]);
    expect(blocked.ok && blocked.data[0].name).toMatch(/OO$/);
    expect((await client.rpc('demo_note_chat_safety', {})).error?.message).toBe('invalid_value');
  });
});

describe('QP-09 대화형 설문 ‘내 성향’을 마친 분은 07 을 다시 확인하지 않는다(화면 요구 F2)', () => {
  const row: AiRow = { id: 'r1', status: 'ok', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: null, original: { traits: { ...DEMO_AI_RESULT.traits }, tags: [...DEMO_AI_RESULT.tags], summary: DEMO_AI_RESULT.summary, evidence: JSON.parse(JSON.stringify(DEMO_AI_RESULT.evidence)) }, edited: null };
  const deps = (chatDone: boolean | undefined, confirmOk = true) => {
    const confirm = jest.fn(async () => (confirmOk ? { ok: true as const } : { ok: false as const, reason: 'server' as const }));
    const d: TraitsDeps = { api: { loadLatest: async () => ({ ok: true, row }), saveEdited: async () => ({ ok: true }), confirm, manual: async () => ({ kind: 'ok', resultId: 'r1' }) }, setStage: jest.fn(), ...(chatDone === undefined ? {} : { chatDone: async () => chatDone }) };
    return { d, confirm };
  };

  test('마친 분: 07 을 그리지 않고 그 결과로 확정 → 08(처음 한 번)', async () => {
    const { d, confirm } = deps(true);
    const tree = await mount(<TraitsScreen deps={d} />);
    shown.push(tree);
    await wait(30);
    expect(confirm).toHaveBeenCalledWith(null); // 3부-자(0044): 서버가 인터뷰 정리로 확정 — 건 id 를 주지 않는다
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace.mock.calls.concat(mockRouter.push.mock.calls).flat()).toContainEqual({ pathname: '/profile', params: { first: '1' } });
    expect(has(tree, 'traits-confirm')).toBe(false);
  });

  test('대화형 설문을 하지 않은 분 · 확정이 안 되면: 지금처럼 07', async () => {
    for (const [done, ok] of [[false, true], [true, false], [undefined, true]] as const) {
      const { d } = deps(done, ok);
      const tree = await mount(<TraitsScreen deps={d} />);
      shown.push(tree);
      await wait(30);
      expect(has(tree, 'traits-confirm')).toBe(true);
    }
  });
});

describe('QP-32 T1 [설문으로] = 남은 그 문항으로 바로', () => {
  test('정치 → 설문 v2 정치 단계(notice politics) · 종교 → A06(notice religion)', async () => {
    const TICKET = { price_krw: 26900, payment_mode: 'demo', round: { round_no: 3, match_day: '2027-01-06', match_time: '18:00', sale_open_at: '2026-12-30T15:00:00Z', sale_close_at: '2027-01-06T08:30:00Z', sale_state: 'open' }, seat: null, region: '수도권', can_board: false, reason: 'profile_incomplete', credit: { balance: 0 } };
    for (const [detail, notice] of [['politics_missing', 'politics'], ['religion_missing', 'religion']] as const) {
      const client = { rpc: async (name: string) => ({ data: name === TICKET_STATE_RPC ? { ...TICKET, reason_detail: detail } : { state: 'none' }, error: null }) } as never;
      const tree = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'r', toastMs: 10 }} />);
      shown.push(tree);
      await wait(20);
      await press(tree, 'boarding-ineligible-action');
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/survey/[step]', params: { step: 'v2', notice } });
    }
  });
});

describe('QP-32 설문 v2 한 문항 입구(politics · religion) — 그 문항만 하고 T1 로', () => {
  const rig = (ck4: boolean) => {
    const memory = createDemoV2Memory();
    demoV2Seed(memory, 'u1', { ck4 });
    const base = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'qp32@email.com' } } }, error: null }) } } as never;
    const client = createSurveyV2DemoClient(base, { memory });
    const api = createSurveyV2Api(client, { demo: true, proofUpload: false, schoolSearch: 'server' });
    return { api, deps: { api, local: createLocalDraftStore(chunkedStorage(createMemoryStore().store)), now: () => 1, politics: createPoliticsApi(client), religion: createReligionApi(client, 't') } };
  };
  const SOME = { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165 } as const;

  test('politics: 처음 화면 · 흐름 없이 정치 막대 단계 → [나중에 할게요] = 돌아가기(T1)', async () => {
    const { api, deps } = rig(true);
    expect(await api.save({ answers: { ...SOME } })).toEqual({ ok: true });
    const tree = await mount(<SurveyV2Screen deps={deps} entry="politics" />);
    shown.push(tree);
    await wait(80);
    expect(has(tree, 'v2-politics')).toBe(true);
    expect(has(tree, 'v2-start')).toBe(false);
    await press(tree, 'v2-pol-later');
    await wait(20);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('religion: A06(동의 없으면 카드) → 거절 · 저장 → 다음 문항(A07) 대신 T1 로', async () => {
    const { api, deps } = rig(false);
    expect(await api.save({ answers: { ...SOME } })).toEqual({ ok: true });
    const tree = await mount(<SurveyV2Screen deps={deps} entry="religion" />);
    shown.push(tree);
    await wait(80);
    expect(has(tree, 'chat-card-REL')).toBe(true);
    await press(tree, 'chat-rel-decline');
    await wait(1_200);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(has(tree, 'v2-block-A07')).toBe(false);
  });
});
