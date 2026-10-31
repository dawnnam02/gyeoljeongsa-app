// F22 사전 오픈(K20 · 팀장/세부청사진/F22.md · D-123 후속): 규칙 함수 · 서버 응답 읽기(S18 4장 + 가정 이름) · 상태 저장소 · 데모 모의 서버 · 09 · 11 · 16 자리 분기 ·
//  대기 화면 · 미룸 공지 · 먼저 시작 · 신청 잇기 시트 · 01 출시일 줄 · 글 규칙.
//  기준: 기획/K20_사전오픈.md 2장(2-1 쓰지 않는 말 · 2-2 단계표 · 2-3 결과 · 2-4 대기 화면 · 2-5 신청 번호 · 2-6 출시일 · 2-7 잇기) · 3-4 ② · 4-1 · 4-5 · 4-6 · 4-8(TP-07 · 08 · 11 · 12 · 14)
//  · backend/S18_변경기록.md 4장(get_launch_state · link-application 모양)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON, TABS } from '@/content/copy';
import { createPrelaunchDemo, DEMO_DEFERRED_DAY, DEMO_LAUNCH_DAY, DEMO_LINK, DEMO_LINK_TAKEN, sceneOfEmail, withPrelaunchDemo } from '@/demo/prelaunchDemo';
import { createLaunchApi, parseLaunchState, type EarlyJoinResult, type LaunchLoad, type LaunchPublic, type LaunchState, type LinkResult } from '@/features/prelaunch/launchApi';
import { dayText, decideGate, decideTabGate, deferNoticeDue, firstRecWhen, monthDayText, normalizeApplicantNo, normalizeLinkCode, STEP_ORDER, timeText, todoOf, waitTasks } from '@/features/prelaunch/launchLogic';
import { createLaunchStore } from '@/features/prelaunch/launchStore';
import { OnboardingLaunchLine, onboardingLineText } from '@/features/prelaunch/OnboardingLaunchLine';
import { LINK_SHEET, PRELAUNCH, PRELAUNCH_TABS } from '@/features/prelaunch/prelaunchCopy';
import { PrelaunchGate, PrelaunchTabGate } from '@/features/prelaunch/PrelaunchGate';
import type { PrelaunchServices } from '@/features/prelaunch/prelaunchServices';
import { createFlagsStore } from '@/hooks/useFeatureFlags';
import { demoDefault, isPendingKey } from '@/config/featureKeys';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createFeatureFlagsApi, FEATURE_KEYS, parseFlags } from '@/lib/featureFlagsApi';

import { allTexts, has, isOpen, mount, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { useRouter: () => mockRouter, useLocalSearchParams: () => ({}), useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

jest.setTimeout(120_000);

const APP = path.resolve(__dirname, '..', '..');
const T0 = Date.UTC(2026, 9, 18, 3, 0, 0); // 2026-10-18 12:00 KST
const WHEN = '12월 25일 금요일 오전 9시';

// ── 응답 모양(S18 4-1) ──────────────────────────────────────
const steps5 = (s: Record<string, string> = {}) => STEP_ORDER.map((step) => ({ step, state: s[step] ?? 'done' }));
const raw = (over: Record<string, unknown> = {}) => ({
  phase: 'prelaunch',
  launch_day: '2026-12-25',
  launch_weekday: '금요일',
  open_time: '09:00',
  launch_text: WHEN,
  deferred_count: 0,
  applicant_no: '1018-4721',
  review: { status: 'in_review', steps: steps5({ photos: 'checking', docs: 'todo', confirm: 'todo' }), decline_reason: null, vouched_by: null },
  region: null,
  ...over,
});
const stateOf = (over: Record<string, unknown> = {}): LaunchState => parseLaunchState(raw(over)) as LaunchState;
const confirmedReview = { status: 'confirmed', steps: steps5({ docs: 'todo' }), decline_reason: null, vouched_by: null };

describe('규칙 함수(launchLogic)', () => {
  test('출시일은 날짜 · 요일 · 시각 글만: 서버 launch_text 그대로, 없으면 "12월 25일 금요일 오전 9시"를 만든다', () => {
    expect(dayText('2026-12-25')).toBe('12월 25일 금요일');
    expect(dayText('2026-11-30')).toBe('11월 30일 월요일');
    expect(dayText('2026-02-30')).toBeNull();
    expect(dayText(null)).toBeNull();
    expect(timeText('09:00')).toBe('오전 9시');
    expect(timeText('13:30')).toBe('오후 1시 30분');
    expect(timeText('12:00')).toBe('오후 12시');
    expect(timeText('00:00')).toBe('오전 0시');
    expect(timeText('25:00')).toBeNull();
    expect(monthDayText('2026-12-25')).toBe('12월 25일');
    expect(firstRecWhen({ launchDay: '2026-12-25', openTime: '09:00', launchText: null })).toBe(WHEN);
    expect(firstRecWhen({ launchDay: '2027-01-01', openTime: '09:00', launchText: '1월 1일 금요일 오전 9시' })).toBe('1월 1일 금요일 오전 9시');
    expect(firstRecWhen({ launchDay: null, openTime: '09:00', launchText: WHEN })).toBeNull(); // 미정이면 날짜 줄 없음
  });

  test('09 자리: 불러오는 중 · 열림 · 대기(prelaunch · warming · 권역 기다림) · 서버 함수 없음/로그인 없음 = 지금 동작 · 인터넷 문제는 열림을 본 적이 있을 때만 열림', () => {
    const ok = (over: Record<string, unknown>): LaunchLoad => ({ ok: true, state: stateOf(over) });
    expect(decideGate(null, false)).toBe('loading');
    expect(decideGate(ok({ phase: 'open' }), false)).toBe('open');
    expect(decideGate(ok({ phase: 'open', region: { region: '수도권', state: 'open' } }), false)).toBe('open');
    expect(decideGate(ok({ phase: 'open', region: { region: '동남권', state: 'wait', reason: 'count' } }), false)).toBe('wait');
    expect(decideGate(ok({ phase: 'prelaunch' }), true)).toBe('wait');
    expect(decideGate(ok({ phase: 'warming' }), true)).toBe('wait');
    expect(decideGate({ ok: false, reason: 'missing' }, false)).toBe('open');
    expect(decideGate({ ok: false, reason: 'session' }, false)).toBe('open');
    expect(decideGate({ ok: false, reason: 'network' }, false)).toBe('error');
    expect(decideGate({ ok: false, reason: 'server' }, true)).toBe('open');
  });

  test('S18 screen 이 있으면 그것 하나로 고른다: recommend 만 오늘의 추천 · wait · review(공개 뒤 확정 전, D-123) · region_wait 는 대기 화면', () => {
    const ok = (over: Record<string, unknown>): LaunchLoad => ({ ok: true, state: stateOf(over) });
    expect(decideGate(ok({ phase: 'open', screen: 'recommend' }), false)).toBe('open');
    expect(decideGate(ok({ phase: 'open', screen: 'review' }), false)).toBe('wait'); // phase · region 만 보면 열림이지만 서버는 확정 전이라 막음
    expect(decideGate(ok({ phase: 'open', screen: 'region_wait' }), false)).toBe('wait');
    expect(decideGate(ok({ phase: 'prelaunch', screen: 'wait' }), false)).toBe('wait');
    expect(decideGate(ok({ phase: 'open', screen: 'unknown_screen' }), false)).toBe('open'); // 모르는 값은 없는 것으로(옛 규칙)
  });

  test('11 · 16 탭: 출시일 09:00 전(prelaunch · warming)에만 닫힘 · 권역 기다림 · 못 읽음 · 함수 없음은 원래 화면', () => {
    const ok = (over: Record<string, unknown>): LaunchLoad => ({ ok: true, state: stateOf(over) });
    expect(decideTabGate(null)).toBe('loading');
    expect(decideTabGate(ok({ phase: 'prelaunch' }))).toBe('closed');
    expect(decideTabGate(ok({ phase: 'warming' }))).toBe('closed');
    expect(decideTabGate(ok({ phase: 'open', region: { state: 'wait', reason: 'count' } }))).toBe('open');
    expect(decideTabGate({ ok: false, reason: 'network' })).toBe('open');
    expect(decideTabGate({ ok: false, reason: 'missing' })).toBe('open');
  });

  test('미룸 공지: 서버 미룸 횟수가 본 횟수보다 늘었을 때만', () => {
    expect(deferNoticeDue(0, 0)).toBe(false);
    expect(deferNoticeDue(1, 0)).toBe(true);
    expect(deferNoticeDue(1, 1)).toBe(false);
    expect(deferNoticeDue(2, 1)).toBe(true);
  });

  test('할 일 한 줄: 앞에서부터 처음 끝나지 않은 칸 하나(숫자 0)', () => {
    const st = (s: Record<string, string>) => steps5(s) as { step: (typeof STEP_ORDER)[number]; state: never }[];
    expect(todoOf(st({ photos: 'todo', survey: 'todo' }))).toBe('photosTodo');
    expect(todoOf(st({ survey: 'todo' }))).toBe('surveyTodo');
    expect(todoOf(st({ photos: 'fix' }))).toBe('photosFix');
    expect(todoOf(st({ photos: 'checking', docs: 'todo', confirm: 'todo' }))).toBe('checking');
    expect(todoOf(st({ docs: 'fix' }))).toBe('docsFix');
    expect(todoOf(st({ docs: 'todo', confirm: 'todo' }))).toBeNull(); // 서류는 선택 — 할 일로 재촉하지 않는다
  });

  test('기다리는 동안 할 일 ①~④: 스위치 · 확정 · 잇기 여부대로', () => {
    const all = () => true;
    const none = () => false;
    expect(waitTasks(stateOf(), all)).toEqual(['avoid', 'docs', 'link']); // 보증은 확정 뒤
    expect(waitTasks(stateOf({ review: confirmedReview }), all)).toEqual(['avoid', 'docs', 'vouch', 'link']);
    expect(waitTasks(stateOf({ application_linked: true }), none)).toEqual([]);
    expect(waitTasks(stateOf(), none)).toEqual(['link']);
  });

  test('신청 번호 · 잇기 코드 모양', () => {
    expect(normalizeApplicantNo('1018-4721')).toBe('1018-4721');
    expect(normalizeApplicantNo('10184721')).toBe('1018-4721');
    expect(normalizeApplicantNo(' 1018 4721 ')).toBe('1018-4721');
    expect(normalizeApplicantNo('1318-4721')).toBeNull(); // 13월
    expect(normalizeApplicantNo('1018-472')).toBeNull();
    expect(normalizeLinkCode('246810')).toBe('246810');
    expect(normalizeLinkCode('24681')).toBeNull();
    expect(normalizeLinkCode('24681a')).toBeNull();
  });
});

// ── 서버 응답 읽기 ───────────────────────────────────────────
type Rpc = (name: string) => { data: unknown; error: { code?: string; message: string } | null };
type Invoke = (name: string, body: unknown) => { data: unknown; error: unknown };
const fakeClient = (rpc: Rpc, invoke: Invoke = () => ({ data: null, error: null })) => {
  const calls: { kind: string; name: string; body?: unknown }[] = [];
  const client = {
    rpc: async (name: string) => {
      calls.push({ kind: 'rpc', name });
      return rpc(name);
    },
    functions: {
      invoke: async (name: string, options?: { body?: unknown }) => {
        calls.push({ kind: 'fn', name, body: options?.body });
        return invoke(name, options?.body);
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};
const httpError = (status: number, code: string) => new FunctionsHttpError(new Response(JSON.stringify({ ok: false, code }), { status }));

describe('서버 응답 읽기(launchApi — S18 4장 + 가정 이름)', () => {
  test('S18 키를 읽는다: launch_text · deferred_count · region.region · reason cell. 순번 · 인원 · 진행 % 키는 버리고, 단계는 늘 5칸 · 이 순서, 모르는 단계는 prelaunch(닫힌 쪽)', () => {
    const s = parseLaunchState({
      ...raw({ phase: 'soon', position: 12, queue_ahead: 40, percent: 70, waiting_count: 900, deferred_count: 2, region: { name: '동남권', state: 'wait', reason: 'cell', can_early_join: false, members: 480 } }),
      review: { status: 'in_review', steps: [{ step: 'photos', state: 'done' }, { step: 'rank', state: 'done' }] },
    });
    expect(s?.phase).toBe('prelaunch');
    expect(s?.launchText).toBe(WHEN);
    expect(s?.deferredCount).toBe(2);
    expect(s?.region).toEqual({ name: '동남권', state: 'wait', reason: 'cell', canEarlyJoin: false, earlyJoinOn: null });
    expect(s?.review?.steps.map((x) => x.step)).toEqual(['identity', 'photos', 'survey', 'docs', 'confirm']);
    expect(s?.review?.steps.map((x) => x.state)).toEqual(['todo', 'done', 'todo', 'todo', 'todo']);
    expect(JSON.stringify(s)).not.toMatch(/position|queue|percent|waiting|rank|members/);
    expect(Object.keys(s as object).sort()).toEqual(['applicantNo', 'deferredCount', 'launchDay', 'launchText', 'linked', 'openTime', 'phase', 'region', 'review', 'screen']);
    expect(parseLaunchState(null)).toBeNull();
    expect(parseLaunchState(raw({ applicant_no: '7' }))?.applicantNo).toBeNull(); // 모양이 아니면 보이지 않는다
    expect(parseLaunchState(raw({ launch_text: 'D-68 · 12월 25일' }))?.launchText).toBeNull(); // 날짜 · 요일 · 시각 꼴이 아니면 쓰지 않는다(앱이 만든다)
  });

  test('S18 최신 키: screen · application_linked · region.name(옛 region 도 읽음) · review.fix_reason(7개만)', () => {
    const s = parseLaunchState(raw({ screen: 'review', application_linked: true, region: { region: '수도권', state: 'open' }, review: { status: 'needs_more', steps: steps5({ photos: 'fix' }), fix_reason: 'photo_full' } })) as LaunchState;
    expect(s).toMatchObject({ screen: 'review', linked: true, region: { name: '수도권' }, review: { fixReason: 'photo_full' } });
    expect(parseLaunchState(raw({ review: { status: 'needs_more', steps: [], fix_reason: 'low_income' } }))?.review?.fixReason).toBeNull();
    expect(parseLaunchState(raw())?.screen).toBeNull(); // 옛 서버 — phase · region 으로 고른다
  });

  test('거절 사유는 4개만(under_24 · married · fake · forged). 다른 코드는 읽지 않는다', () => {
    const declined = (reason: string) => parseLaunchState(raw({ review: { status: 'declined', steps: [], decline_reason: reason } }))?.review?.declineReason;
    expect(['under_24', 'married', 'fake', 'forged'].map(declined)).toEqual(['under_24', 'married', 'fake', 'forged']);
    expect(declined('low_income')).toBeNull();
    expect(declined('education')).toBeNull();
  });

  test('불러오기: 정상 · 서버에 함수 없음(missing) · 로그인 없음(42501)/정지 · 탈퇴(null) = session · 인터넷 · 서버 · 던짐', async () => {
    const load = (rpc: Rpc) => createLaunchApi(fakeClient(rpc).client).load();
    expect(await load(() => ({ data: raw(), error: null }))).toMatchObject({ ok: true, state: { phase: 'prelaunch', applicantNo: '1018-4721' } });
    expect(await load(() => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_launch_state' } }))).toEqual({ ok: false, reason: 'missing' });
    expect(await load(() => ({ data: null, error: { code: '42501', message: 'forbidden' } }))).toEqual({ ok: false, reason: 'session' });
    expect(await load(() => ({ data: null, error: null }))).toEqual({ ok: false, reason: 'session' });
    expect(await load(() => ({ data: null, error: { code: '', message: 'Failed to fetch' } }))).toEqual({ ok: false, reason: 'network' });
    expect(await load(() => ({ data: null, error: { code: 'P0001', message: 'x' } }))).toEqual({ ok: false, reason: 'server' });
    expect(await load(() => ({ data: 'nope', error: null }))).toEqual({ ok: false, reason: 'server' });
    const throwing = { rpc: async () => { throw new Error('x'); } } as unknown as SupabaseClient;
    expect(await createLaunchApi(throwing).load()).toEqual({ ok: false, reason: 'network' });
  });

  test('잇기: Edge link-application 에 { applicant_no, code }(S18 4-2) · 오류 코드 → 틀림 · 이미 이은 계정 · 한도 · 로그인 · 인터넷 · 서버', async () => {
    const link = async (invoke: Invoke) => {
      const f = fakeClient(() => ({ data: null, error: null }), invoke);
      const r = await createLaunchApi(f.client).link('1018-4721', '246810');
      return { r, calls: f.calls };
    };
    const okCall = await link(() => ({ data: { ok: true, applicant_no: '1018-4721' }, error: null }));
    expect(okCall.r).toEqual({ ok: true, applicantNo: '1018-4721' });
    expect(okCall.calls).toEqual([{ kind: 'fn', name: 'link-application', body: { applicant_no: '1018-4721', link_code: '246810' } }]);
    expect((await link(() => ({ data: null, error: httpError(400, 'invalid_code') }))).r).toEqual({ ok: false, reason: 'invalid' });
    expect((await link(() => ({ data: null, error: httpError(409, 'already_linked') }))).r).toEqual({ ok: false, reason: 'already' });
    expect((await link(() => ({ data: null, error: httpError(429, 'rate_limited') }))).r).toEqual({ ok: false, reason: 'limit' });
    expect((await link(() => ({ data: null, error: httpError(401, 'unauthorized') }))).r).toEqual({ ok: false, reason: 'session' });
    expect((await link(() => ({ data: null, error: httpError(400, 'invalid_request') }))).r).toEqual({ ok: false, reason: 'server' }); // S18: 서버 문제 글
    expect((await link(() => ({ data: null, error: new FunctionsFetchError('x') }))).r).toEqual({ ok: false, reason: 'network' });
    expect((await link(() => ({ data: null, error: httpError(500, 'server_error') }))).r).toEqual({ ok: false, reason: 'server' });
    expect((await link(() => ({ data: { ok: true }, error: null }))).r).toEqual({ ok: false, reason: 'server' }); // 번호 없는 성공은 믿지 않는다
  });

  test('먼저 시작(early_join · 가정) · 로그인 없는 출시일(get_launch_public · 가정)', async () => {
    const api = (rpc: Rpc) => createLaunchApi(fakeClient(rpc).client);
    expect(await api(() => ({ data: { ok: true, starts_on: '2026-12-26' }, error: null })).earlyJoin()).toEqual({ ok: true, startsOn: '2026-12-26' });
    expect(await api(() => ({ data: null, error: { code: 'P0001', message: 'region_locked' } })).earlyJoin()).toEqual({ ok: false, reason: 'locked' });
    expect(await api(() => ({ data: null, error: { code: 'P0001', message: 'not_waiting' } })).earlyJoin()).toEqual({ ok: false, reason: 'not_waiting' });
    expect(await api(() => ({ data: null, error: { code: 'PGRST202', message: 'x' } })).earlyJoin()).toEqual({ ok: false, reason: 'missing' });
    expect(await api(() => ({ data: { phase: 'prelaunch', launch_day: '2026-12-25', launch_text: WHEN }, error: null })).loadPublic()).toEqual({ phase: 'prelaunch', launchDay: '2026-12-25', launchText: WHEN });
    expect(await api(() => ({ data: null, error: { code: 'PGRST202', message: 'x' } })).loadPublic()).toBeNull();
  });
});

// ── 상태 저장소 ──────────────────────────────────────────────
describe('상태 저장소(launchStore): 세 탭이 한 요청을 나눠 쓴다', () => {
  test('같은 때 두 번 불러도 요청 1번 · 열림을 받으면 seenOpen · 미룸 본 횟수는 기기 기록에서 읽고 쓴다 · 미룸이 0 으로 돌아가면 본 횟수도 낮춘다', async () => {
    let next: LaunchLoad = { ok: true, state: stateOf({ deferred_count: 1 }) };
    const load = jest.fn(async () => next);
    const written: number[] = [];
    const store = createLaunchStore({ load }, { read: async () => 0, write: async (n) => void written.push(n) });
    expect(store.get()).toEqual({ load: null, seenOpen: false, deferSeen: 0, linkedHere: false });
    await Promise.all([store.refresh(), store.refresh()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(deferNoticeDue(1, store.get().deferSeen)).toBe(true);
    store.markDeferSeen(1);
    expect(store.get().deferSeen).toBe(1);
    expect(written).toEqual([1]);
    next = { ok: true, state: stateOf({ phase: 'open', deferred_count: 0 }) };
    await store.refresh();
    expect(store.get()).toMatchObject({ seenOpen: true, deferSeen: 0 });
    store.markLinked();
    expect(store.get().linkedHere).toBe(true);
    const remembered = createLaunchStore({ load: async () => ({ ok: true, state: stateOf({ deferred_count: 1 }) }) }, { read: async () => 1, write: async () => undefined });
    await remembered.refresh();
    expect(deferNoticeDue(1, remembered.get().deferSeen)).toBe(false); // 이 기기에서 이미 봄
  });
});

// ── 데모 모의 서버 ───────────────────────────────────────────
describe('데모 모의 서버(demo/prelaunchDemo — S18 모양)', () => {
  const user = (email: string, id = `u-${email}`) => ({ id, email });

  test('이메일 장면: 그 밖 이메일은 데모 처음값(prelaunch 꺼짐 → open) · prelaunch… 는 사전 오픈 · 확인 중 · S18 키(launch_text · launch_weekday · deferred_count)', () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    expect(sceneOfEmail('plain@email.com')).toBeNull();
    expect(['prelaunch@a.b', 'prelaunchok@a.b', 'prelaunchfix@a.b', 'prelaunchno@a.b', 'prelaunchwait@a.b', 'prelaunchratio@a.b', 'prelaunchlate@a.b'].map(sceneOfEmail)).toEqual(['checking', 'confirmed', 'fix', 'declined', 'regionWait', 'regionRatio', 'deferred']);
    const plain = parseLaunchState(demo.rpc(user('plain@email.com'), 'get_launch_state').data) as LaunchState;
    expect(plain.phase).toBe('open');
    const rawPre = demo.rpc(user('prelaunch@email.com'), 'get_launch_state').data as Record<string, unknown>;
    expect(rawPre).toMatchObject({ launch_weekday: '수요일', launch_text: '12월 23일 수요일 오후 6시', deferred_count: 0 }); // V5: 첫 매칭 12-23(수) 18:00
    const pre = parseLaunchState(rawPre) as LaunchState;
    expect(pre).toMatchObject({ phase: 'prelaunch', launchDay: DEMO_LAUNCH_DAY, openTime: '18:00', linked: false, region: null, review: { status: 'in_review' } });
    expect(pre.applicantNo).toMatch(/^1018-\d{4}$/); // 접수 날짜(10-18) + 4자리
    expect(demo.rpc(null, 'get_launch_state').error?.code).toBe('42501');
  });

  test('스위치(데모): 데모 처음값 + prelaunch 는 단계가 open 이 아닐 때만 켜짐 · avoid_org · vouch · doc_verify 켜짐', () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    const flagsOf = (email: string) => parseFlags(demo.rpc(user(email), 'get_feature_flags').data);
    expect(flagsOf('plain@email.com').on.prelaunch).toBe(false);
    const pre = flagsOf('prelaunch@email.com');
    expect(pre.on.prelaunch).toBe(true);
    expect(pre.on.avoid_org && pre.on.vouch && pre.on.doc_verify).toBe(true);
    expect(pre.mode.prelaunch).toBe('demo');
  });

  test('장면 바꾸기: 확정 · 보완 · 거절(혼인) · 미룸(1월 1일 · 미룸 1) · 권역 기다림 · 끔(open) · 다시 켬 — 듣는 쪽에 알린다', () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    const u = user('prelaunch@email.com');
    const read = () => parseLaunchState(demo.rpc(u, 'get_launch_state').data) as LaunchState;
    const heard = jest.fn();
    const off = demo.subscribe(heard);
    read();
    expect(demo.sceneAccount()).toBe(true);
    demo.setScene('confirmed');
    expect(read().review?.status).toBe('confirmed');
    expect(read().review?.steps.find((s) => s.step === 'confirm')?.state).toBe('done');
    demo.setScene('fix');
    expect(read().review?.steps.find((s) => s.step === 'photos')?.state).toBe('fix');
    demo.setScene('declined');
    expect(read().review).toMatchObject({ status: 'declined', declineReason: 'married' });
    demo.setScene('deferred');
    expect(read()).toMatchObject({ phase: 'prelaunch', launchDay: DEMO_DEFERRED_DAY, launchText: '1월 1일 금요일 오후 6시', deferredCount: 1 });
    demo.setScene('regionWait');
    expect(read()).toMatchObject({ phase: 'open', region: { name: '동남권', state: 'wait', reason: 'count', canEarlyJoin: true } });
    demo.setScene('open');
    expect(decideGate({ ok: true, state: read() }, false)).toBe('open');
    demo.setScene('prelaunch');
    expect(read().phase).toBe('prelaunch');
    expect(heard).toHaveBeenCalledTimes(7);
    off();
  });

  test('S18 screen · fix_reason · 본문 키 link_code(옛 키 code 는 받지 않음 · 세지 않음)', async () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    const u = user('prelaunch@email.com');
    const screen = () => (demo.rpc(u, 'get_launch_state').data as { screen: string }).screen;
    expect(screen()).toBe('wait');
    demo.setScene('reviewOpen');
    expect(screen()).toBe('review');
    demo.setScene('regionWait');
    expect(screen()).toBe('region_wait');
    demo.setScene('open');
    expect(screen()).toBe('recommend');
    demo.setScene('fix');
    expect((demo.rpc(u, 'get_launch_state').data as { review: { fix_reason: string } }).review.fix_reason).toBe('photo_face');
    const e = demo.link(u, { applicant_no: DEMO_LINK.no, code: DEMO_LINK.code }).error as FunctionsHttpError;
    expect(((await (e.context as Response).json()) as { code: string }).code).toBe('invalid_code');
    expect((demo.peek() as { wrong_today: number }).wrong_today).toBe(0);
  });

  test('먼저 시작: 기다리는 권역에서만 · 다음 날부터 · 양보 불가면 region_locked · 로그인 없는 출시일은 마지막 계정의 단계', () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    expect(demo.rpc(null, 'get_launch_public').data).toMatchObject({ phase: 'open' }); // 데모 처음값
    const u = user('prelaunchwait@email.com');
    expect(demo.rpc(u, 'early_join').data).toEqual({ ok: true, starts_on: '2026-10-19' });
    const after = parseLaunchState(demo.rpc(u, 'get_launch_state').data) as LaunchState;
    expect(after.region).toMatchObject({ canEarlyJoin: false, earlyJoinOn: '2026-10-19' });
    expect(demo.rpc(u, 'early_join').error?.message).toBe('not_waiting');
    demo.setScene('regionLocked');
    expect(demo.rpc(u, 'early_join').error?.message).toBe('region_locked');
    demo.setScene('prelaunch');
    expect(demo.rpc(null, 'get_launch_public').data).toMatchObject({ phase: 'prelaunch', launch_day: DEMO_LAUNCH_DAY, launch_text: '12월 23일 수요일 오후 6시' });
  });

  test('잇기(S18 순서): 모양 아님 = invalid_code(안 셈) · 남이 이은 번호 = invalid_code(셈) · 하루 5번 틀리면 6번째부터 다음 날까지 rate_limited(TP-08) · 성공하면 번호가 신청 번호로 · 이은 계정은 already_linked', async () => {
    let now = T0;
    const demo = createPrelaunchDemo({ now: () => now });
    const u = user('prelaunch@email.com');
    const code = async (r: { error: unknown }) => {
      const e = r.error as FunctionsHttpError | null;
      return e ? ((await (e.context as Response).json()) as { code: string }).code : 'ok';
    };
    const wrong = () => (demo.peek() as { wrong_today: number }).wrong_today;
    expect(await code(demo.link(null, {}))).toBe('unauthorized');
    expect(await code(demo.link(u, { applicant_no: 'x', link_code: '1' }))).toBe('invalid_code');
    expect(wrong()).toBe(0);
    expect(await code(demo.link(u, { applicant_no: DEMO_LINK_TAKEN.no, link_code: DEMO_LINK_TAKEN.code }))).toBe('invalid_code');
    for (let i = 0; i < 4; i += 1) expect(await code(demo.link(u, { applicant_no: '1018-0000', link_code: '000000' }))).toBe('invalid_code');
    expect(wrong()).toBe(5);
    expect(await code(demo.link(u, { applicant_no: DEMO_LINK.no, link_code: DEMO_LINK.code }))).toBe('rate_limited'); // 맞아도 오늘은 막힘
    now += 24 * 3_600_000; // 다음 날(한국 날짜)
    expect(demo.link(u, { applicant_no: '10184721', link_code: DEMO_LINK.code }).data).toEqual({ ok: true, applicant_no: DEMO_LINK.no });
    expect(parseLaunchState(demo.rpc(u, 'get_launch_state').data)).toMatchObject({ applicantNo: DEMO_LINK.no, linked: true });
    expect(await code(demo.link(u, { applicant_no: DEMO_LINK.no, link_code: DEMO_LINK.code }))).toBe('already_linked');
    expect(await code(demo.link(user('other@email.com'), { applicant_no: DEMO_LINK.no, link_code: DEMO_LINK.code }))).toBe('invalid_code'); // 남의 번호
  });

  test('응답 어디에도 순번 · 인원 · 진행 % · 남은 날 키가 없다(TP-07)', () => {
    const demo = createPrelaunchDemo({ now: () => T0 });
    const all = JSON.stringify([demo.rpc(user('prelaunch@email.com'), 'get_launch_state').data, demo.rpc(user('prelaunchwait@email.com'), 'get_launch_state').data, demo.rpc(null, 'get_launch_public').data]);
    expect(all).not.toMatch(/rank|position|queue|order|percent|progress|members|days_left|remaining/);
  });

  test('withPrelaunchDemo: 사전 오픈 호출만 받고 나머지는 원래 클라이언트로 넘긴다', async () => {
    const base = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'prelaunch@email.com' } } } }) },
      rpc: jest.fn(async () => ({ data: 'base', error: null })),
      from: jest.fn(() => 'from'),
      functions: { invoke: jest.fn(async () => ({ data: 'base-fn', error: null })) },
    };
    const demo = createPrelaunchDemo({ now: () => T0 });
    const client = withPrelaunchDemo(base as unknown as SupabaseClient, demo);
    const api = createLaunchApi(client);
    expect((await api.load()).ok).toBe(true);
    expect(await api.loadPublic()).toMatchObject({ phase: 'prelaunch' });
    expect(await client.rpc('list_today_recommendations')).toEqual({ data: 'base', error: null });
    expect(await client.functions.invoke('photo', { body: {} })).toEqual({ data: 'base-fn', error: null });
    expect(base.rpc).toHaveBeenCalledTimes(1);
    expect((await api.link(DEMO_LINK.no, DEMO_LINK.code)).ok).toBe(true);
  });
});

// ── 화면 ────────────────────────────────────────────────────
type FakeApi = PrelaunchServices['api'] & { load: jest.Mock; link: jest.Mock; earlyJoin: jest.Mock; loadPublic: jest.Mock };
const flagsOn = (on: Record<string, boolean> = { avoid_org: true, doc_verify: true, vouch: true }) => createFlagsStore(async () => parseFlags({ flags: on, modes: {} }));
const depsWith = (
  load: () => LaunchLoad,
  opts: { link?: (no: string, code: string) => LinkResult; early?: () => EarlyJoinResult; flags?: ReturnType<typeof createFlagsStore>; deferSeen?: number } = {},
): PrelaunchServices & { api: FakeApi } => {
  const api = {
    load: jest.fn(async () => load()),
    link: jest.fn(async (no: string, code: string) => (opts.link ?? (() => ({ ok: true, applicantNo: '1018-4721' })))(no, code)),
    earlyJoin: jest.fn(async () => (opts.early ?? (() => ({ ok: true, startsOn: '2026-12-26' })))()),
    loadPublic: jest.fn(async (): Promise<LaunchPublic | null> => null),
  } as FakeApi;
  return { api, store: createLaunchStore(api, { read: async () => opts.deferSeen ?? 0, write: async () => undefined }), flags: opts.flags ?? flagsOn(), demo: null };
};
const okLoad = (over: Record<string, unknown> = {}) => (): LaunchLoad => ({ ok: true, state: stateOf(over) });
const mounted: ReactTestRenderer[] = [];
const keep = (tree: ReactTestRenderer) => {
  mounted.push(tree);
  return tree;
};
const render = async (deps: PrelaunchServices) => {
  const tree = await mount(
    <PrelaunchGate deps={deps}>
      <Text testID="recs">09 오늘의 추천</Text>
    </PrelaunchGate>,
  );
  await act(async () => undefined);
  return keep(tree);
};
const renderTab = async (kind: 'likes' | 'shop', deps: PrelaunchServices) => {
  const tree = await mount(
    <PrelaunchTabGate kind={kind} deps={deps}>
      <Text testID="tab-original">원래 화면</Text>
    </PrelaunchTabGate>,
  );
  await act(async () => undefined);
  return keep(tree);
};
// 시험이 끝나면 화면을 내린다(토스트 · 뼈대 타이머가 시험 밖에서 돌지 않게)
afterEach(async () => {
  while (mounted.length) {
    const tree = mounted.pop() as ReactTestRenderer;
    await act(async () => tree.unmount());
  }
});

// 화면 글 규칙(K20 2-1 · 2-6 · P-11 · TP-11 · D-112): 느낌표 0 · 남은 날 · 시간 · 초 · D-n 0 · 쓰지 않는 말 15개 0 · '소개' 0(사용자 글은 '추천') · 사과 말 0
const BANNED = /[!！]|D-\d|남은 (날|시간|자리)|\d+일 남|초 후|\d+:\d\d:\d\d|제작진|시즌|회차|\d+기\b|합격|불합격|탈락|선발|최종|마감 임박|한정|경쟁률|소개|순위|등수|번째|죄송|미안|양해/;
const screenTexts = (tree: ReactTestRenderer) => allTexts(tree).join('\n');

describe('09 자리 분기(PrelaunchGate) · 대기 화면', () => {
  beforeEach(() => jest.clearAllMocks());

  test('열림이면 오늘의 추천(children)을 그대로 · 서버 함수가 없으면(S18 전) 지금 동작 그대로', async () => {
    const open = await render(depsWith(okLoad({ phase: 'open' })));
    expect(has(open, 'recs')).toBe(true);
    expect(has(open, 'prelaunch-screen')).toBe(false);
    const missing = await render(depsWith(() => ({ ok: false, reason: 'missing' })));
    expect(has(missing, 'recs')).toBe(true);
  });

  test('사전 오픈이면 대기 화면: 머리 · 신청 번호 + 순서 뜻 0 · 단계표 5칸 · 첫 추천 날짜 · 요일 · 시각 · 할 일 · 고지(TP-14)', async () => {
    const tree = await render(depsWith(okLoad()));
    expect(has(tree, 'recs')).toBe(false);
    expect(textOf(tree, 'prelaunch-no')).toBe('신청 번호 1018-4721');
    expect(textOf(tree, 'prelaunch-no-note')).toBe('순서를 뜻하는 번호는 아니에요.');
    expect(STEP_ORDER.map((s) => textOf(tree, `prelaunch-steps-${s}-state`))).toEqual(['확인됨', '확인 중', '확인됨', '아직', '아직']);
    expect(textOf(tree, 'prelaunch-first-rec-when')).toBe(WHEN);
    expect(textOf(tree, 'prelaunch-notice')).toBe(PRELAUNCH.notice);
    expect(has(tree, 'prelaunch-todo')).toBe(true);
    expect(screenTexts(tree)).toContain(PRELAUNCH.todo.checking);
    expect(['avoid', 'docs', 'vouch', 'link'].map((t) => has(tree, `prelaunch-task-${t}`))).toEqual([true, true, false, true]); // 보증은 확정 뒤
    expect(has(tree, 'prelaunch-stamp')).toBe(false);
    expect(has(tree, 'prelaunch-defer')).toBe(false);
    expect(screenTexts(tree)).not.toMatch(BANNED);
    expect(screenTexts(tree)).not.toMatch(/\d+%|\d+명/); // 진행 % · 인원 0
  });

  test('warming(출시일 03:00~09:00)도 대기 화면 · 날짜 미정이면 날짜 줄 대신 안내', async () => {
    const tree = await render(depsWith(okLoad({ phase: 'warming', launch_day: null })));
    expect(has(tree, 'prelaunch-screen')).toBe(true);
    expect(textOf(tree, 'prelaunch-first-rec-when')).toBe(PRELAUNCH.firstRecUnknown);
  });

  test('확정: 확정 카드(날짜 · 요일 · 시각 · 하루 세 분 추천) + 고지는 카드 안 한 번 · 로고 타일 찍힘 · 보증 할 일이 열린다', async () => {
    const tree = await render(depsWith(okLoad({ review: confirmedReview })));
    expect(textOf(tree, 'prelaunch-confirmed-body')).toBe(`확정됐어요. 첫 매칭은 ${WHEN}에 열려요. 탑승권을 사면 그날 나와 수준이 가장 잘 맞는 한 분과 이어져요.`);
    expect(textOf(tree, 'prelaunch-confirmed-notice')).toBe(PRELAUNCH.notice);
    expect(has(tree, 'prelaunch-notice')).toBe(false);
    expect(allTexts(tree).filter((t) => t === PRELAUNCH.notice)).toHaveLength(1);
    expect(has(tree, 'prelaunch-stamp')).toBe(true);
    expect(has(tree, 'prelaunch-task-vouch')).toBe(true);
    expect(has(tree, 'prelaunch-todo')).toBe(false);
    expect(screenTexts(tree)).not.toMatch(BANNED);
  });

  test('보완 이유(S18 fix_reason)가 오면 그 칸 이름으로 한 줄(전신 사진 · 생년월일)', async () => {
    const full = await render(depsWith(okLoad({ review: { status: 'needs_more', steps: steps5({ photos: 'fix', docs: 'todo', confirm: 'todo' }), fix_reason: 'photo_full' } })));
    expect(screenTexts(full)).toContain('전신 사진에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.');
    expect(allTexts(full)).not.toContain(PRELAUNCH.todo.photosFix); // 칸 이름 없는 글(한 줄 전체)은 나오지 않는다
    const age = await render(depsWith(okLoad({ review: { status: 'needs_more', steps: steps5({ identity: 'fix', docs: 'todo', confirm: 'todo' }), fix_reason: 'identity_age' } })));
    expect(textOf(age, 'prelaunch-steps-identity-state')).toBe('보완 필요');
    expect(screenTexts(age)).toContain(PRELAUNCH.fixReason.identity_age);
  });

  test('공개 뒤 확정 전(screen review, D-123): 대기 화면 그대로 · 지난 출시일 줄은 숨김 · 단계표', async () => {
    const tree = await render(depsWith(okLoad({ screen: 'review', phase: 'open' })));
    expect(has(tree, 'prelaunch-screen')).toBe(true);
    expect(has(tree, 'recs')).toBe(false);
    expect(has(tree, 'prelaunch-first-rec')).toBe(false);
    expect(screenTexts(tree)).not.toContain('12월 25일');
    expect(has(tree, 'prelaunch-steps')).toBe(true);
  });

  test('보완 요청: 할 일 한 줄(이유 + 다시 올려 주시면 이어서 확인할게요) · 기한 말 0', async () => {
    const tree = await render(depsWith(okLoad({ review: { status: 'needs_more', steps: steps5({ photos: 'fix', docs: 'todo', confirm: 'todo' }) } })));
    expect(screenTexts(tree)).toContain(PRELAUNCH.todo.photosFix);
    expect(textOf(tree, 'prelaunch-steps-photos-state')).toBe('보완 필요');
    expect(screenTexts(tree)).not.toMatch(/기한|며칠|\d+일 안|까지 (다시|올려)/);
  });

  test('함께하기 어려워요: 사유 글 + 정정 길 · 단계표 · 할 일 없음 · 수준 말 0', async () => {
    for (const reason of ['under_24', 'married', 'fake', 'forged'] as const) {
      const tree = await render(depsWith(okLoad({ review: { status: 'declined', steps: [], decline_reason: reason } })));
      expect(textOf(tree, 'prelaunch-declined-reason')).toBe(PRELAUNCH.declined[reason]);
      expect(has(tree, 'prelaunch-steps')).toBe(false);
      expect(has(tree, 'prelaunch-tasks')).toBe(false);
      expect(screenTexts(tree)).not.toMatch(/학력|연봉|소득|자산|외모|직업|수준/);
    }
  });

  test('미룸 공지: 서버 미룸 횟수가 본 것보다 늘면 맨 위 카드 한 번(새 날짜 · 고마워요 · 사과 말 0) → [확인했어요] 뒤 사라지고 날짜 줄은 새 날짜', async () => {
    const deferred = okLoad({ launch_day: '2027-01-01', launch_text: '1월 1일 금요일 오전 9시', deferred_count: 1 });
    const tree = await render(depsWith(deferred));
    expect(textOf(tree, 'prelaunch-defer-body')).toBe('첫 매칭을 1월 1일 금요일 오전 9시로 미뤘어요. 잘 맞는 분과 이어 드리려고 회원이 조금 더 모일 때까지 기다리기로 했어요. 기다려 주셔서 고마워요.');
    expect(textOf(tree, 'prelaunch-first-rec-when')).toBe('1월 1일 금요일 오전 9시');
    expect(screenTexts(tree)).not.toMatch(BANNED);
    await press(tree, 'prelaunch-defer-ok');
    expect(has(tree, 'prelaunch-defer')).toBe(false);
    const seenBefore = await render(depsWith(deferred, { deferSeen: 1 })); // 이 기기에서 이미 봄
    expect(has(seenBefore, 'prelaunch-defer')).toBe(false);
  });

  test('출시 뒤 권역 기다림: 내 지역 안내(이름) · 칸 · 판정 전도 인원 글 · 성비는 이유 한 줄 · 인원 · 게이지 · 예상 날짜 0', async () => {
    const wait = (reason: string | null, extra: Record<string, unknown> = {}) => okLoad({ phase: 'open', review: confirmedReview, region: { name: '동남권', state: 'wait', reason, can_early_join: false, ...extra } });
    const count = await render(depsWith(wait('count')));
    expect(textOf(count, 'prelaunch-region-text')).toBe('동남권은 함께 시작할 분들을 모으고 있어요. 시작하면 이 화면에 탑승권이 열려요.');
    expect(has(count, 'prelaunch-first-rec')).toBe(false);
    expect(has(count, 'prelaunch-early')).toBe(false); // 서버가 can_early_join 이 아니면 버튼 0
    const cell = await render(depsWith(wait('cell')));
    expect(textOf(cell, 'prelaunch-region-text')).toBe(PRELAUNCH.region.count('동남권'));
    const ratio = await render(depsWith(wait('ratio')));
    expect(textOf(ratio, 'prelaunch-region-text')).toBe(PRELAUNCH.region.ratio);
    expect(screenTexts(ratio)).not.toMatch(/\d+명|%|예상/);
    const joined = await render(depsWith(wait('count', { early_join_on: '2026-12-26' })));
    expect(textOf(joined, 'prelaunch-early-joined')).toBe('12월 26일 토요일부터 다른 지역 분과도 매칭될 수 있어요.');
  });

  test('[지역 넓혀 먼저 시작하기]: 확인 한 줄("다른 지역 분과 매칭될 수 있어요.") 뒤 본인이 누를 때만 early_join · 양보 불가면 안내만(서버가 풀지 않음)', async () => {
    const waitEarly = okLoad({ phase: 'open', review: confirmedReview, region: { name: '동남권', state: 'wait', reason: 'count', can_early_join: true } });
    const deps = depsWith(waitEarly);
    const tree = await render(deps);
    await press(tree, 'prelaunch-early');
    expect(isOpen(tree, 'prelaunch-early-confirm')).toBe(true);
    expect(screenTexts(tree)).toContain('다른 지역 분과 매칭될 수 있어요.');
    expect(deps.api.earlyJoin).not.toHaveBeenCalled(); // 확인 전에는 부르지 않는다
    const before = deps.api.load.mock.calls.length;
    await press(tree, 'prelaunch-early-confirm-confirm');
    await act(async () => undefined);
    expect(deps.api.earlyJoin).toHaveBeenCalledTimes(1);
    expect(deps.api.load.mock.calls.length).toBeGreaterThan(before); // 다시 읽는다
    const locked = depsWith(waitEarly, { early: () => ({ ok: false, reason: 'locked' }) });
    const t2 = await render(locked);
    await press(t2, 'prelaunch-early');
    await press(t2, 'prelaunch-early-confirm-confirm');
    await act(async () => undefined);
    expect(textOf(t2, 'prelaunch-early-locked')).toBe(PRELAUNCH.region.earlyLocked);
  });

  test('못 읽으면 틀만(날짜 숨김) + [다시 시도] → 다시 불러 대기 화면', async () => {
    let fail = true;
    const stateLoad = okLoad();
    const deps = depsWith(() => (fail ? { ok: false, reason: 'network' } : stateLoad()));
    const tree = await render(deps);
    expect(has(tree, 'prelaunch-error')).toBe(true);
    expect(screenTexts(tree)).toContain(COMMON.offline);
    expect(has(tree, 'prelaunch-first-rec')).toBe(false);
    expect(has(tree, 'recs')).toBe(false);
    fail = false;
    await press(tree, 'prelaunch-retry');
    await act(async () => undefined);
    expect(has(tree, 'prelaunch-error')).toBe(false);
    expect(textOf(tree, 'prelaunch-first-rec-when')).toBe(WHEN);
  });

  test('신청 잇기 시트: 모양이 맞을 때만 [잇기] · 오류 글 · 성공이면 시트 닫힘 + 토스트 + 다시 읽기 + 잇기 줄 숨김 · 고지 한 줄(TP-12 셋째 자리)', async () => {
    const results: LinkResult[] = [{ ok: false, reason: 'invalid' }, { ok: false, reason: 'limit' }, { ok: true, applicantNo: '1018-4721' }];
    const deps = depsWith(okLoad(), { link: () => results.shift() as LinkResult });
    const tree = await render(deps);
    await press(tree, 'prelaunch-link-open');
    expect(isOpen(tree, 'prelaunch-link')).toBe(true);
    expect(textOf(tree, 'prelaunch-link-notice')).toBe(PRELAUNCH.notice);
    expect(textOf(tree, 'prelaunch-link-same')).toBe(LINK_SHEET.same);
    await typeInto(tree, 'prelaunch-link-no', '1018472');
    await typeInto(tree, 'prelaunch-link-code', '246810');
    await press(tree, 'prelaunch-link-submit'); // 7자리 — 눌리지 않음
    expect(deps.api.link).not.toHaveBeenCalled();
    await typeInto(tree, 'prelaunch-link-no', '10184721');
    await press(tree, 'prelaunch-link-submit');
    expect(deps.api.link).toHaveBeenLastCalledWith('1018-4721', '246810');
    expect(textOf(tree, 'prelaunch-link-error')).toBe(LINK_SHEET.errors.invalid);
    await press(tree, 'prelaunch-link-submit');
    expect(textOf(tree, 'prelaunch-link-error')).toBe(LINK_SHEET.errors.limit);
    const before = deps.api.load.mock.calls.length;
    await press(tree, 'prelaunch-link-submit');
    await act(async () => undefined);
    expect(isOpen(tree, 'prelaunch-link')).toBe(false);
    expect(screenTexts(tree)).toContain('신청 번호 1018-4721로 이었어요.');
    expect(deps.api.load.mock.calls.length).toBeGreaterThan(before);
    expect(has(tree, 'prelaunch-task-link')).toBe(false); // 서버 응답에 이은 여부 키가 없어도(S18 지금) 이 실행에서는 숨김
  });

  test('서버가 "이미 이은 계정"(already_linked)이라 하면 오류 글 + 잇기 줄 숨김', async () => {
    const deps = depsWith(okLoad(), { link: () => ({ ok: false, reason: 'already' }) });
    const tree = await render(deps);
    await press(tree, 'prelaunch-link-open');
    await typeInto(tree, 'prelaunch-link-no', '1018-4721');
    await typeInto(tree, 'prelaunch-link-code', '246810');
    await press(tree, 'prelaunch-link-submit');
    expect(textOf(tree, 'prelaunch-link-error')).toBe(LINK_SHEET.errors.already);
    expect(has(tree, 'prelaunch-task-link')).toBe(false);
  });

  test('이미 이었으면 잇기 줄이 없다 · 스위치가 꺼져 있으면 ①~③ 없음', async () => {
    const tree = await render(depsWith(okLoad({ application_linked: true }), { flags: flagsOn({}) }));
    expect(has(tree, 'prelaunch-tasks')).toBe(false);
  });
});

describe('11 호감 · 16 상점(+16-G) 탭 분기(PrelaunchTabGate)', () => {
  test('출시 전: 머리는 원래 탭 이름 · v5(QP-A, 카피 14-1) 호감 한 줄 · "상점은 … 열려요" 없음 · 상점은 등급 첫 계산 한 줄만 · 상품 목록 · 숫자 0', async () => {
    const likes = await renderTab('likes', depsWith(okLoad()));
    expect(has(likes, 'tab-original')).toBe(false);
    expect(has(likes, 'prelaunch-tab-likes-line-0')).toBe(false);
    expect(screenTexts(likes)).toContain(TABS.likes);
    const shop = await renderTab('shop', depsWith(okLoad()));
    expect(textOf(shop, 'prelaunch-tab-shop-line-0')).toBe(PRELAUNCH_TABS.firstCalc);
    expect(has(shop, 'prelaunch-tab-shop-line-1')).toBe(false);
    expect(screenTexts(shop)).toContain(TABS.shop);
    expect(screenTexts(shop)).not.toMatch(/원|구매|이용권|구독|상점은|\d+등급/);
    const noDay = await renderTab('shop', depsWith(okLoad({ launch_day: null })));
    expect(textOf(noDay, 'prelaunch-tab-shop-line-0')).toBe(PRELAUNCH_TABS.firstCalc);
    expect(screenTexts(likes) + screenTexts(shop)).not.toMatch(BANNED);
  });

  test('출시 뒤(권역 기다림이어도) · 못 읽음 · 함수 없음 · warming 아님이면 원래 화면', async () => {
    for (const load of [okLoad({ phase: 'open' }), okLoad({ phase: 'open', region: { region: '동남권', state: 'wait', reason: 'count' } }), (): LaunchLoad => ({ ok: false, reason: 'network' }), (): LaunchLoad => ({ ok: false, reason: 'missing' })]) {
      const tree = await renderTab('likes', depsWith(load));
      expect(has(tree, 'tab-original')).toBe(true);
    }
    const warming = await renderTab('shop', depsWith(okLoad({ phase: 'warming' })));
    expect(has(warming, 'tab-original')).toBe(false);
  });

  test('세 탭이 한 저장소를 나눠 쓰면 요청은 한 번(이미 읽은 값을 쓴다)', async () => {
    const deps = depsWith(okLoad());
    await render(deps);
    await renderTab('likes', { ...deps });
    await renderTab('shop', { ...deps });
    expect(deps.api.load.mock.calls.length).toBeLessThanOrEqual(3); // 처음 + 포커스 때만(타이머 0)
    expect(deps.store.get().load).not.toBeNull();
  });
});

describe('01 온보딩 출시일 줄(OnboardingLaunchLine — 놓을 자리는 F21 파일)', () => {
  test('사전 오픈이면 "지금은 출시 전이에요. 첫 추천은 {12월 25일}부터 시작해요." · 출시 뒤 · 못 읽음 · 날짜 없음이면 그리지 않는다', async () => {
    expect(onboardingLineText({ phase: 'prelaunch', launchDay: '2026-12-25', launchText: WHEN })).toBe('지금은 출시 전이에요. 첫 매칭은 12월 25일에 시작해요.');
    expect(onboardingLineText({ phase: 'open', launchDay: '2026-12-25', launchText: WHEN })).toBeNull();
    expect(onboardingLineText({ phase: 'prelaunch', launchDay: null, launchText: null })).toBeNull();
    expect(onboardingLineText(null)).toBeNull();
    const shown = keep(await mount(<OnboardingLaunchLine api={{ loadPublic: async () => ({ phase: 'warming', launchDay: '2026-12-25', launchText: WHEN }) }} />));
    await act(async () => undefined);
    expect(textOf(shown, 'onboarding-launch-line')).toBe('지금은 출시 전이에요. 첫 매칭은 12월 25일에 시작해요.');
    const hidden = keep(await mount(<OnboardingLaunchLine api={{ loadPublic: async () => null }} />));
    await act(async () => undefined);
    expect(has(hidden, 'onboarding-launch-line')).toBe(false);
  });
});

describe('글(prelaunchCopy)', () => {
  test('모든 글: 느낌표 0 · 남은 날 · 카운트다운 · 순번 0 · 쓰지 않는 말 0 · 소개 0 · 사과 말 0 · 해요체(합니다체 0) · 방송 · 촬영은 고지 한 줄에만', () => {
    const strings: string[] = [];
    const sample = (fn: (...a: string[]) => string) => fn(WHEN, '오전 9시');
    (function collect(v: unknown) {
      if (typeof v === 'string') strings.push(v);
      else if (typeof v === 'function') strings.push(sample(v as (...a: string[]) => string));
      else if (v && typeof v === 'object') Object.values(v).forEach(collect);
    })({ PRELAUNCH, PRELAUNCH_TABS, LINK_SHEET });
    expect(strings.length).toBeGreaterThan(60);
    for (const s of strings) {
      expect(s).not.toMatch(BANNED);
      expect(s).not.toMatch(/(습니다|십시오|합니다|입니다)\.?$/);
    }
    expect(strings.filter((s) => /방송|촬영/.test(s))).toEqual([PRELAUNCH.notice]);
    expect(PRELAUNCH.notice).toBe("'출연'은 결정사에서 쓰는 말이에요. 방송이나 촬영은 없어요."); // NP-08 그대로
    expect(Array.from(LINK_SHEET.linkedToast('1018-4721')).length).toBeLessThanOrEqual(40); // 토스트 40자
  });

  test('앱 글 규칙 도구(check-copy-rules T04 · K11)로 돌리면 R12(보증 말)만 걸린다 — 기능 이름 "지인 보증"(D-123: "지인 확인"으로 바뀜 · C① 확정 뒤 맞춤)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f22-copy-'));
    fs.copyFileSync(path.join(APP, 'src', 'features', 'prelaunch', 'prelaunchCopy.ts'), path.join(dir, 'prelaunchCopy.ts'));
    let out = '';
    try {
      out = execFileSync(process.execPath, [path.join(APP, 'scripts', 'check-copy-rules.mjs'), '--json', '--content', dir, '--copy', path.join(dir, 'none.md')], { cwd: APP, encoding: 'utf8' });
    } catch (e) {
      out = (e as { stdout?: string }).stdout ?? '';
    }
    fs.rmSync(dir, { recursive: true, force: true });
    const r = JSON.parse(out) as { results: { title: string; ok: boolean; detail: string }[]; counts: { all: number } };
    expect(r.counts.all).toBeGreaterThan(40);
    const failed = r.results.filter((x) => !x.ok);
    expect(failed.map((x) => x.title.split(' ')[0]).filter((t) => t !== 'R12')).toEqual([]);
    for (const f of failed) expect(f.detail.split('\n').every((line) => /vouch/.test(line))).toBe(true);
  });
});

describe('데모 모의 서버의 기능 스위치(D-134): get_feature_flags 가 87키 데모 처음값을 낸다', () => {
  const signedIn = async (email: string) => {
    const client = createDemoClient(createDemoBackend({ now: () => T0 }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
    return client;
  };

  test('로그인한 데모 계정: 읽힘(loaded) · 모든 키가 데모 처음값(review_required · prelaunch 만 꺼짐 · survey_v2 켜짐) · 모드 demo', async () => {
    const flags = await createFeatureFlagsApi(await signedIn('flags@email.com')).load();
    expect(flags.loaded).toBe(true);
    expect(FEATURE_KEYS.length).toBeGreaterThanOrEqual(87); // V5(A W10)가 숨김 키를 더함
    expect(FEATURE_KEYS.filter((k) => !isPendingKey(k)).every((k) => flags.on[k] === demoDefault(k) && flags.mode[k] === 'demo')).toBe(true);
    expect(FEATURE_KEYS.filter((k) => !flags.on[k] && !k.startsWith('v4_'))).toEqual(['review_required', 'prelaunch', 'chat_push', 'type_card_share', 'pair_card_ai', 'saju_ai', 'saju_talk', 'mileage_charge']); // IF2-F: 바깥 공유 · AI판은 데모도 꺼짐(PF-91) // R-A: chat_push 데모도 꺼짐(토큰 등록 0) // V5 숨김 키(v4_*)는 A 몫 — 데모에서도 꺼짐
    expect(flags.on.survey_v2).toBe(true);
  });

  test('v4off 장면은 live 처음값(E 7 · review_required · prelaunch 켜짐, 새 기능 꺼짐) · 로그인 없으면 못 읽음(live 값)', async () => {
    const off = await createFeatureFlagsApi(await signedIn('v4off@email.com')).load();
    expect(FEATURE_KEYS.filter((k) => off.on[k])).toEqual(['grade_engine', 'grade_view', 'grade_badge', 'grade_pause', 'sub_uprank', 'region_widen', 'appearance_score', 'review_required', 'prelaunch']);
    const anon = await createFeatureFlagsApi(createDemoClient(createDemoBackend({ now: () => T0 }))).load();
    expect(anon.loaded).toBe(false);
  });
});

describe('라우트 분기', () => {
  test('09 · 11 · 16 라우트 파일만 감싼다(화면 파일은 그대로)', () => {
    const read = (name: string) => fs.readFileSync(path.join(APP, 'src', 'app', '(tabs)', name), 'utf8');
    expect(read('recommendations.tsx')).toContain('<PrelaunchGate>');
    expect(read('recommendations.tsx')).toContain('<RecommendationsScreen />');
    expect(read('likes.tsx')).toContain('<PrelaunchTabGate kind="likes">');
    expect(read('likes.tsx')).toContain('<LikesScreen />');
    expect(read('shop.tsx')).toContain('<PrelaunchTabGate kind="shop">');
    expect(read('shop.tsx')).toContain('<ShopScreen />');
  });
});
