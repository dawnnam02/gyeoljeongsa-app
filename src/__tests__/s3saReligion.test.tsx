// 3부-사 ①(D-219 · 본인 결정 '정치 CK15 와 같은 방식' · 카피 17장 · 법무 L22): 설문 A06 앞 종교 동의 카드
//  유효한 CK4 가 없으면 카드 → 동의 = CK4 기록(판 CONSENT_TEXT_VERSIONS.CK4) → A06 저장 / 거절 = '동의 안 함' 기록 + A06 '답하지 않음' → T1 종교 사유 · 탑승 0
//  데모: 설정에서 CK4 끄기 → 설문 모의 서버 종교 지움 → 탑승 0(실서버와 같은 판정) · 동의 관리: 설문에서 받은 CK15 · CK4 가 '켜짐'(끌 수 있음)
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { CONSENT_ITEMS } from '@/content/consentContent';
import { CONSENT_MANAGE } from '@/content/settingsCopy';
import { createDemoChatMemory, createSurveyChatDemoClient } from '@/demo/surveyChatBackend';
import { createBoardingApi } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { ConsentManagePage } from '@/features/settings/ConsentManagePage';
import { createSurveyChatApi } from '@/features/surveyChat/api';
import type { SurveyChatDeps } from '@/features/surveyChat/deps';
import { createLocalChatStore } from '@/features/surveyChat/localChat';
import { REL } from '@/features/surveyChat/relCopy';
import { SurveyChatScreen } from '@/features/surveyChat/SurveyChatScreen';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import { createReligionApi } from '@/features/surveyV2/religion';
import type { V2Value } from '@/features/surveyV2/types';
import { chunkedStorage } from '@/lib/chunkedStorage';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';

import { createMemoryStore } from './memoryStore';
import { allTexts, has, isOpen, mount, press, textOf } from './renderHelpers';

jest.setTimeout(120_000);

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
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));

type Tree = ReactTestRenderer;
const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const tap = async (tree: Tree, id: string) => {
  await press(tree, id);
  await wait(20);
};
const shown: Tree[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});

const backend = createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) });
async function signIn(email: string, ck4: boolean) {
  const client = createDemoClient(backend);
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  if (ck4) {
    const { data } = await client.auth.getSession();
    expect((await client.from('consents').insert([{ user_id: data.session?.user?.id, item_code: 'CK4', agreed: true, text_version: CONSENT_TEXT_VERSIONS.CK4, app_version: 't' }])).error).toBeNull(); // 03 에서 CK4 를 고름
  }
  return client;
}
// 대화형 설문(데모 로그인 위 모의 서버 — 동의 기록은 demoBackend 가 원본) · A06 바로 앞까지 답이 있는 회원
const BEFORE_A06: Record<string, V2Value> = { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165 };
// 설문 모의 서버는 공유 기록(demoBackend 탑승 관문 · 설정 철회가 보는 곳)을 쓴다
async function survey(email: string, ck4: boolean) {
  const client = await signIn(email, ck4);
  const chatClient = createSurveyChatDemoClient(client, { scriptScale: 0 });
  const api = createSurveyV2Api(chatClient, { demo: true, proofUpload: false, schoolSearch: 'server' });
  expect(await api.save({ answers: BEFORE_A06 })).toEqual({ ok: true });
  const store = createMemoryStore();
  const deps: SurveyChatDeps = {
    v2: { api, local: createLocalDraftStore(chunkedStorage(store.store)), now: () => 1_761_000_000_000, politics: createPoliticsApi(chatClient, 'test'), religion: createReligionApi(chatClient, 'test') },
    chat: createSurveyChatApi(chatClient, 'test'),
    store: createLocalChatStore(chunkedStorage(store.store)),
    device: 'phone',
    slowMs: 5_000,
  };
  const tree = await mount(<SurveyChatScreen deps={deps} />);
  shown.push(tree);
  await wait(60);
  if (has(tree, 'chat-resume-go')) await tap(tree, 'chat-resume-go');
  await wait(30);
  const a06 = async (): Promise<unknown> => {
    const r = (await (chatClient.from('survey_answers') as unknown as { select: () => { in: (c: string, ids: string[]) => Promise<{ data: { question_id: string; value: unknown }[] }> } }).select().in('question_id', ['A06'])).data;
    return r.length ? r[0].value : undefined;
  };
  return { client, chatClient, tree, a06 };
}
const card = (tree: Tree) => has(tree, 'chat-card-REL');
const ck4Rows = async (client: Awaited<ReturnType<typeof signIn>>) => ((await client.from('consents').select('item_code,agreed,text_version,revoked_at')) as unknown as { data: { item_code: string; agreed: boolean; text_version: string; revoked_at: string | null }[] }).data.filter((r) => r.item_code === 'CK4');

describe('① 설문 A06 앞 종교 동의 카드', () => {
  test('CK4 가 없으면 A06 질문 대신 카드: 제목 · 본문 · 네 줄 상자 · 공개 · 거두기 · 보기 › · 체크 줄(미리 체크 0) · 같은 무게 버튼 둘', async () => {
    const { tree } = await survey('rel-card@email.com', false);
    expect(card(tree)).toBe(true);
    expect(has(tree, 'v2-A06-opt-none')).toBe(false); // 동의 전에는 입력칸 0(L22 1-2 #4)
    expect(allTexts(tree)).toContain(REL.consent);
    for (const k of ['what', 'use', 'keep', 'consentNote', 'vis', 'withdraw'] as const) expect(textOf(tree, `chat-rel-${k}`)).toBe(REL[k]);
    expect(REL.consentCheck).toBe(CONSENT_ITEMS.find((i) => i.code === 'CK4')?.label); // 체크 줄 = 4-4 체크 문구(생성 파일)
    expect(tree.root.findAll((n) => n.props.testID === 'chat-rel-check' && n.props.accessibilityRole === 'checkbox')[0]?.props['aria-checked']).toBe(false);
    const agree = tree.root.findAll((n) => n.props.testID === 'chat-rel-agree')[0];
    const decline = tree.root.findAll((n) => n.props.testID === 'chat-rel-decline')[0];
    expect([agree?.props.variant, decline?.props.variant]).toEqual(['secondary', 'secondary']);
    expect(allTexts(tree).join(' ')).not.toMatch(/[!！]|지금 바로|놓치|서두르/);
  });

  test('동의: 체크 없이 누르면 이유 한 줄(기록 0) → 체크 + [동의하고 답할게요] → CK4 동의 줄(지금 판) → A06 질문 → 종교 저장 → T1 탈 수 있음', async () => {
    const { tree, client, a06 } = await survey('rel-agree@email.com', false);
    await tap(tree, 'chat-rel-agree');
    expect(textOf(tree, 'chat-rel-error')).toBe(REL.needCheck);
    expect(await ck4Rows(client)).toEqual([]);
    await tap(tree, 'chat-rel-check');
    await tap(tree, 'chat-rel-agree');
    const rows = await ck4Rows(client);
    expect(rows).toEqual([expect.objectContaining({ agreed: true, text_version: CONSENT_TEXT_VERSIONS.CK4, revoked_at: null })]);
    expect(card(tree)).toBe(false);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([REL.agree, REL.consentDone]));
    await tap(tree, 'v2-A06-opt-none');
    await wait(60);
    expect(await a06()).toBe('none');
    // 설정 '동의 관리' = 켜짐(받은 곳과 상관없이 — L22 C1)
    const settings = await createSettingsApi(client, 'test').loadConsents();
    expect(settings.ok && settings.data.CK4).toBe(true);
  });

  test('거절: \'동의 안 함\' 줄 + A06 \'답하지 않음\'(null) → 다음 문항 · 같은 설문에서 다시 묻지 않음 · 데모 탑승 관문 religion_missing → T1 종교 사유 · 탑승 0', async () => {
    const { tree, client, chatClient, a06 } = await survey('rel-decline@email.com', false);
    await tap(tree, 'chat-rel-decline');
    await wait(60);
    expect(await ck4Rows(client)).toEqual([expect.objectContaining({ agreed: false, text_version: CONSENT_TEXT_VERSIONS.CK4 })]);
    expect(await a06()).toBeNull();
    expect(card(tree)).toBe(false);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([REL.decline, REL.ack.decline]));
    expect(has(tree, 'v2-A07-opt-never') || has(tree, 'chat-card-A07')).toBe(true); // 다음 문항(혼인 이력)
    // 탑승 관문: 데모 줄 없이 설문을 연 회원 — 정치 · 종교가 비면 서버 차례대로 정치 먼저, 정치를 채우면 종교
    const pol = createPoliticsApi(chatClient, 'test');
    expect(await pol.agree()).toEqual({ ok: true, data: true });
    expect((await pol.save(50)).ok).toBe(true);
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: false, reason: 'profile_incomplete', reason_detail: 'religion_missing' });
    const t1 = await mount(<BoardingScreen deps={{ api: createBoardingApi(client), newId: () => 'r', toastMs: 10 }} />);
    shown.push(t1);
    await wait(30);
    expect(textOf(t1, 'boarding-status-title')).toBe(BOARDING.ineligible.religion_missing.title);
    expect(textOf(t1, 'boarding-status-body')).toBe('종교 문항에 답하면 탑승권을 살 수 있어요.');
    expect(has(t1, 'boarding-buy')).toBe(false);
    await tap(t1, 'boarding-ineligible-action');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/survey/[step]', params: { step: 'v2', notice: 'religion' } });
  });

  test('03 에서 CK4 를 고른 회원은 카드 없이 A06 질문', async () => {
    const { tree } = await survey('rel-on@email.com', true);
    expect(card(tree)).toBe(false);
    expect(has(tree, 'v2-A06-opt-none')).toBe(true);
  });

  test('거절 말풍선을 누르면(고치기) 카드가 다시 — 동의하면 그 자리에서 종교를 고른다', async () => {
    const { tree, a06 } = await survey('rel-edit@email.com', false);
    await tap(tree, 'chat-rel-decline');
    await wait(60);
    await tap(tree, 'chat-me-REL'); // 거절 말풍선(내 말) — 누르면 고치기
    await wait(30);
    expect(card(tree)).toBe(true);
    await tap(tree, 'chat-rel-check');
    await tap(tree, 'chat-rel-agree');
    await wait(30);
    expect(card(tree)).toBe(false);
    await tap(tree, 'v2-A06-opt-catholic');
    await tap(tree, 'chat-edit-change');
    await wait(60);
    expect(await a06()).toBe('catholic');
  });
});

describe('① 데모 = 실서버 판정 · 동의 관리 표시', () => {
  test('설정에서 CK4 끄기 → 설문 모의 서버 종교 지움 → 탑승 0(religion_missing) · 다시 켜면(카드) 종교를 다시 답하기 전까지 그대로 0', async () => {
    const { client, chatClient, tree, a06 } = await survey('rel-off@email.com', true);
    await tap(tree, 'v2-A06-opt-buddhist');
    await wait(60);
    expect(await a06()).toBe('buddhist');
    const pol = createPoliticsApi(chatClient, 'test');
    expect(await pol.agree()).toEqual({ ok: true, data: true });
    expect((await pol.save(40)).ok).toBe(true);
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true, reason_detail: null });
    const settings = createSettingsApi(client, 'test');
    expect(await settings.setOptional('CK4', false)).toEqual({ ok: true }); // 확인창 뒤 revoke_consent
    expect(await a06()).toBeNull(); // 실서버 0037 revoke_consent 처럼 바로 '답하지 않음'
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: false, reason: 'profile_incomplete', reason_detail: 'religion_missing' });
    expect((await client.rpc('hold_ticket_seat', { p_round_no: 1 })).data).toMatchObject({ ok: false, reason: 'profile_incomplete', reason_detail: 'religion_missing' });
    const c = await settings.loadConsents();
    expect(c.ok && c.data.CK4).toBe(false);
    expect(await settings.setOptional('CK4', true)).toEqual({ ok: true }); // 다시 동의(새 줄 — L22 C9)
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ reason_detail: 'religion_missing' }); // 종교를 다시 답하기 전까지
    expect((await chatClient.rpc('save_answers', { p_answers: { A06: 'buddhist' } })).error).toBeNull();
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true });
  });

  test('데모 줄로 설문을 건너뛴 계정도 CK4 를 거두면 탑승 0(religion_missing) — 실서버와 같은 판정', async () => {
    const client = await signIn('rel-skip@email.com', true);
    await client.functions.invoke('ai-profile', { body: { action: 'start', demo_scenario: 'ok' } }); // 데모 줄 '설문 완료 · 정상 응답'
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: true });
    expect(await createSettingsApi(client, 'test').setOptional('CK4', false)).toEqual({ ok: true });
    expect((await client.rpc('get_ticket_state')).data).toMatchObject({ can_board: false, reason_detail: 'religion_missing' });
  });

  test('동의 관리: 설문에서 받은 CK15 · CK4 가 켜짐 · CK15 아래 거두면 일어나는 일 · CK4 켜짐 줄(M9) · 끌 수 있음', async () => {
    const { client } = await survey('rel-manage@email.com', false);
    const chatClient = createSurveyChatDemoClient(client, { memory: createDemoChatMemory() });
    expect(await createPoliticsApi(chatClient, 'test').agree()).toEqual({ ok: true, data: true });
    expect(await createReligionApi(chatClient, 'test').record(true)).toEqual({ ok: true });
    const api = createSettingsApi(client, 'test');
    const toast = jest.fn();
    const tree = await mount(<ConsentManagePage api={api} onBack={() => undefined} onToast={toast} />);
    shown.push(tree);
    await wait(40);
    const on = (code: string) => tree.root.findAll((n) => n.props.testID === `settings-consent-${code}` && n.props.accessibilityState)[0]?.props.accessibilityState.checked;
    expect([on('CK15'), on('CK4')]).toEqual([true, true]);
    expect(allTexts(tree)).toEqual(expect.arrayContaining([CONSENT_MANAGE.ck15OffBody, CONSENT_MANAGE.ck4OnNote]));
    const row15 = tree.root.findAll((n) => n.props.testID === 'settings-consent-CK15' && n.props.accessibilityState)[0];
    expect(row15?.props.accessibilityState.disabled).toBe(false); // 잠긴 줄('처음 쓸 때 따로 물어요')이 아니라 끌 수 있는 줄(L22 C4)
    await tap(tree, 'settings-consent-CK15');
    expect(isOpen(tree, 'settings-later-off')).toBe(true);
    await tap(tree, 'settings-later-off-confirm');
    await wait(30);
    expect(on('CK15')).toBe(false);
    const after = await api.loadConsents();
    expect(after.ok && after.data.CK15).toBe(false);
  });
});

describe('① 설문 v2(답 확인 화면에서 A06 을 열 때도) 같은 카드', () => {
  test('CK4 가 없으면 A06 자리에 카드 · [다음] 0 · 거절 → 답하지 않음(null) 저장 → 다음 문항', async () => {
    const client = await signIn('rel-v2@email.com', false);
    const chatClient = createSurveyChatDemoClient(client, { scriptScale: 0 });
    const api = createSurveyV2Api(chatClient, { demo: true, proofUpload: false, schoolSearch: 'server' });
    expect(await api.save({ answers: BEFORE_A06 })).toEqual({ ok: true });
    const deps = { api, local: createLocalDraftStore(chunkedStorage(createMemoryStore().store)), now: () => 1, religion: createReligionApi(chatClient, 'test') };
    const tree = await mount(<SurveyV2Screen deps={deps} entry="missing" />);
    shown.push(tree);
    await wait(80);
    if (has(tree, 'v2-start')) await tap(tree, 'v2-start');
    await wait(40);
    expect(has(tree, 'chat-card-REL')).toBe(true);
    expect(has(tree, 'v2-A06-opt-none')).toBe(false);
    expect(has(tree, 'v2-next')).toBe(false);
    await tap(tree, 'chat-rel-decline');
    await wait(1_200); // 고른 뒤 넘김과 같은 길(저장 → 다음 문항)
    expect(has(tree, 'chat-card-REL')).toBe(false);
    expect(has(tree, 'v2-block-A07')).toBe(true);
    const r = (await (chatClient.from('survey_answers') as unknown as { select: () => { in: (c: string, ids: string[]) => Promise<{ data: { question_id: string; value: unknown }[] }> } }).select().in('question_id', ['A06'])).data;
    expect(r).toEqual([{ question_id: 'A06', value: null }]);
  });
});
