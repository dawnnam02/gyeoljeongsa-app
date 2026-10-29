// 3부-자 6단계(백엔드 0044 12-4 · 화면 요구 04 / 06 / 07 '대화형 마친 분은 08'): 대화형 설문 '내 성향'을 마친 분은
//  06 AI 정리 · 07 확인 없이 confirm_profile(null) 로 확정 → 08. 안 되면 지금 길 그대로(건 id 확정 → 07, 건 없음 → 06).
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { demoShared } from '@/demo/inflightShared';
import { TraitsScreen, type TraitsDeps } from '@/features/ai/TraitsScreen';
import { confirmFromInterview } from '@/features/ai/interviewConfirm';
import { CONSENT_CODES, type ConsentCode } from '@/content/types';
import { REQUIRED_SET } from '@/features/consent/consentLogic';
import { createAiApi } from '@/lib/aiApi';
import { createAuthApi } from '@/lib/authApi';
import { buildConsentRows, recordConsents } from '@/lib/consentApi';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { DEMO_AI_RESULT } from '@/lib/demoAiSample';
import { createDemoClient } from '@/lib/demoClient';
import type { AiRow } from '@/types/ai';

import { has, mount } from './renderHelpers';

jest.setTimeout(60_000);

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

const row: AiRow = { id: 'r1', status: 'ok', source: 'ai', retryCount: 0, createdAt: null, confirmedAt: null, original: { traits: { ...DEMO_AI_RESULT.traits }, tags: [...DEMO_AI_RESULT.tags], summary: DEMO_AI_RESULT.summary, evidence: JSON.parse(JSON.stringify(DEMO_AI_RESULT.evidence)) }, edited: null };
const navigated = () => mockRouter.replace.mock.calls.concat(mockRouter.push.mock.calls).map((c) => c[0]);

function traitsDeps(opts: { row: AiRow | null; chatDone?: boolean; confirm: (id: string | null) => boolean }) {
  const confirm = jest.fn(async (id: string | null) => (opts.confirm(id) ? { ok: true as const } : { ok: false as const, reason: 'not-ready' as const }));
  const setStage = jest.fn();
  const deps: TraitsDeps = { api: { loadLatest: async () => ({ ok: true, row: opts.row }), saveEdited: async () => ({ ok: true }), confirm, manual: async () => ({ kind: 'ok', resultId: 'r1' }) }, setStage, ...(opts.chatDone === undefined ? {} : { chatDone: async () => opts.chatDone as boolean }) };
  return { deps, confirm, setStage };
}

describe('aiApi.confirm(null) — confirm_profile 에 p_result_id null(0044 확정 길)', () => {
  test('건 id 가 있으면 그대로 · null 이면 null 을 서버에 넘긴다 · 오류 구분은 같다', async () => {
    const rpc = jest.fn(async () => ({ data: { ok: true }, error: null }));
    const api = createAiApi({ rpc } as unknown as SupabaseClient);
    expect(await api.confirm('r1')).toEqual({ ok: true });
    expect(await api.confirm(null)).toEqual({ ok: true });
    expect(rpc.mock.calls).toEqual([
      ['confirm_profile', { p_result_id: 'r1' }],
      ['confirm_profile', { p_result_id: null }],
    ]);
    const notReady = createAiApi({ rpc: async () => ({ data: null, error: { code: 'P0001', message: 'ai_not_ready' } }) } as unknown as SupabaseClient);
    expect(await notReady.confirm(null)).toEqual({ ok: false, reason: 'not-ready' });
  });
});

describe('confirmFromInterview — 마쳤으면 null 확정 · 안 되면 건 id · 그래도 안 되면 false', () => {
  test('조합 4가지', async () => {
    const calls: (string | null)[] = [];
    const mk = (okIds: (string | null)[]) => async (id: string | null) => {
      calls.push(id);
      return okIds.includes(id) ? ({ ok: true } as const) : ({ ok: false, reason: 'not-ready' } as const);
    };
    expect(await confirmFromInterview(mk([null]), async () => false)).toBe(false);
    expect(calls).toEqual([]); // 마치지 않았으면 서버를 부르지 않는다
    expect(await confirmFromInterview(mk([null]), async () => true, 'r1')).toBe(true);
    expect(calls).toEqual([null]);
    calls.length = 0;
    expect(await confirmFromInterview(mk(['r1']), async () => true, 'r1')).toBe(true); // 0044 전 서버: null 은 안 되고 건 id 는 됨
    expect(calls).toEqual([null, 'r1']);
    calls.length = 0;
    expect(await confirmFromInterview(mk([]), async () => true)).toBe(false);
    expect(calls).toEqual([null]);
    expect(await confirmFromInterview(mk([null]), async () => Promise.reject(new Error('x')))).toBe(false); // 읽기 실패 = 지금 길
  });
});

describe('07 TraitsScreen — chatDone 이면 confirm_profile(null) → 08', () => {
  test('AI 건이 없어도(06 · 07 건너뜀) 마친 분은 null 확정 → 08 · 06 으로 안 간다', async () => {
    const { deps, confirm, setStage } = traitsDeps({ row: null, chatDone: true, confirm: (id) => id === null });
    const tree = await mount(<TraitsScreen deps={deps} />);
    shown.push(tree);
    await wait(30);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(null);
    expect(navigated()).toContainEqual({ pathname: '/profile', params: { first: '1' } });
    expect(navigated()).not.toContain('/analysis');
    expect(setStage).toHaveBeenCalledWith('traits-confirmed');
    expect(has(tree, 'traits-confirm')).toBe(false);
  });

  test('건이 없고 마치지 않았으면(또는 확정 실패) 지금처럼 06', async () => {
    for (const [chatDone, ok] of [[false, true], [true, false], [undefined, true]] as const) {
      mockRouter.replace.mockClear();
      mockRouter.push.mockClear();
      const { deps } = traitsDeps({ row: null, ...(chatDone === undefined ? {} : { chatDone }), confirm: () => ok });
      const tree = await mount(<TraitsScreen deps={deps} />);
      shown.push(tree);
      await wait(30);
      expect([chatDone, ok, navigated().includes('/analysis')]).toEqual([chatDone, ok, true]);
    }
  });

  test('건이 있는 분: null 이 안 되면 그 건으로(0004 길) → 08 · 둘 다 안 되면 지금처럼 07', async () => {
    const a = traitsDeps({ row, chatDone: true, confirm: (id) => id === 'r1' });
    shown.push(await mount(<TraitsScreen deps={a.deps} />));
    await wait(30);
    expect(a.confirm.mock.calls.map((c) => c[0])).toEqual([null, 'r1']);
    expect(navigated()).toContainEqual({ pathname: '/profile', params: { first: '1' } });
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    const b = traitsDeps({ row, chatDone: true, confirm: () => false });
    const tree = await mount(<TraitsScreen deps={b.deps} />);
    shown.push(tree);
    await wait(30);
    expect(has(tree, 'traits-confirm')).toBe(true);
    expect(navigated()).not.toContainEqual({ pathname: '/profile', params: { first: '1' } });
  });
});

describe('데모 모의 서버 confirm_profile(null) — 서버 0044 와 같은 조건(정리 done 일 때만)', () => {
  async function demoLogin() {
    const backend = createDemoBackend({ now: () => Date.UTC(2026, 9, 28, 3, 0, 0) });
    const client = createDemoClient(backend);
    const auth = createAuthApi(client);
    await auth.sendCode('iv@email.co');
    await auth.verifyCode('iv@email.co', DEMO_OTP_CODE);
    await auth.saveBirth('1995-03-12');
    const all = Object.fromEntries(CONSENT_CODES.map((c) => [c, true])) as Record<ConsentCode, boolean>;
    await recordConsents(client, buildConsentRows({ userId: (await auth.userId()) ?? '', shown: CONSENT_CODES, checked: all, required: REQUIRED_SET, appVersion: '0.1.0' }));
    return { client, ai: createAiApi(client) };
  }

  test('정리가 안 끝났으면 ai_not_ready · 끝났으면 확정 한 줄(ai_results) · 다시 불러도 같은 줄 하나', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { client, ai } = await demoLogin();
    demoShared.setInterviewDone(() => false);
    expect(await ai.confirm(null)).toEqual({ ok: false, reason: 'not-ready' });
    expect((await ai.loadLatest()).ok && (await ai.loadLatest()).ok).toBe(true);
    demoShared.setInterviewDone(() => true);
    expect(await ai.confirm(null)).toEqual({ ok: true });
    expect(await ai.confirm(null)).toEqual({ ok: true });
    const rows = await client.from('ai_results').select('id,status,confirmed_at');
    const list = (rows.data ?? []) as { id: string; status: string; confirmed_at: string | null }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: 'ok' });
    expect(list[0].confirmed_at).not.toBeNull();
    expect(list[0].id).toMatch(/^demo-interview-/);
    demoShared.setInterviewDone(() => false);
  });
});
