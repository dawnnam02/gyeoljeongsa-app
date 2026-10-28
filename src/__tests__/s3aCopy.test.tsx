// 3부-아 카피 묶음(마케팅 '3부-아 카피 끝' · 카피.md 20장 · 13-1 · 12-Q): 앱이 같은 커밋으로 바꾼 글과 그 글이 나오는 조건
//  · T1 사유 profile_missing · grade_pending(QP-36) · 기다리는 동안 아는 분 피하기 · 답 확인 결과 말 '답하지 않음'(QP-35)
//  · 동의 관리 CK4 · CK15 끄기 확인창의 탑승 줄(판매 마감 전 · 이번 회차 탑승권이 있을 때만) · 동의 기록 상한 글(tooMany) · 고객센터 연락처 준비 중 줄
//  · 12-5 [더하기] 점 셋 읽기 이름 '저장하는 중' · 설문 정치 동의 카드 상한 글
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { SUPPORT } from '@/content/copy';
import { AVOID, CONSENT_MANAGE } from '@/content/settingsCopy';
import { createBoardingApi, TICKET_STATE_RPC } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { AvoidPage } from '@/features/settings/AvoidPage';
import { ConsentManagePage } from '@/features/settings/ConsentManagePage';
import { SupportPage } from '@/features/settings/InfoPages';
import { createDemoV2Memory, createSurveyV2DemoClient, demoV2Seed } from '@/demo/surveyV2Backend';
import { createSurveyV2Api } from '@/features/surveyV2/api';
import { SV2 } from '@/features/surveyV2/copy';
import { createLocalDraftStore } from '@/features/surveyV2/localDraft';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import { SurveyV2Screen } from '@/features/surveyV2/SurveyV2Screen';
import { chunkedStorage } from '@/lib/chunkedStorage';
import { answerText, qOf, reviewAnswerText } from '@/features/surveyV2/model';
import { POL } from '@/features/surveyV2/politicsCopy';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi, type SettingsApi } from '@/lib/settingsApi';

import { createMemoryStore } from './memoryStore';
import { allTexts, has, hasText, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

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
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));

const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));
const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
  jest.clearAllMocks();
});
const keep = async (el: React.ReactElement) => {
  const t = await mount(el);
  shown.push(t);
  await wait(20);
  return t;
};

describe('T1 사유 글(카피 20장 · QP-36)', () => {
  const TICKET = { price_krw: 26900, payment_mode: 'demo', round: { round_no: 3, match_day: '2027-01-06', match_time: '18:00', sale_open_at: '2026-12-30T15:00:00Z', sale_close_at: '2027-01-06T08:30:00Z', sale_state: 'open' }, seat: null, region: '수도권', can_board: false, reason: 'profile_incomplete', credit: { balance: 0 } };
  const t1 = (detail: string) => keep(<BoardingScreen deps={{ api: createBoardingApi({ rpc: async (name: string) => ({ data: name === TICKET_STATE_RPC ? { ...TICKET, reason_detail: detail } : { state: 'none' }, error: null }) } as never), newId: () => 'r', toastMs: 10 }} />);

  test('profile_missing: 설문 기본 문항 글 + [설문으로] = 설문 v2 빠진 문항(missing 입구)', async () => {
    const tree = await t1('profile_missing');
    expect(textOf(tree, 'boarding-status-title')).toBe('설문 기본 문항이 남았어요');
    expect(textOf(tree, 'boarding-status-body')).toBe('성별과 사는 지역에 답하면 탑승권을 살 수 있어요.');
    await press(tree, 'boarding-ineligible-action');
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/survey/[step]', params: { step: 'v2', notice: 'missing' } });
  });

  test("grade_pending(데모 gradenew): '확정을 마치면…' 대신 등급 계산 기다림 글 · 버튼 없음 · 시각 숫자 0", async () => {
    const tree = await t1('grade_pending');
    expect(textOf(tree, 'boarding-status-title')).toBe('등급 계산을 기다리고 있어요');
    expect(textOf(tree, 'boarding-status-body')).toBe('새벽에 등급 계산이 끝나면 탑승권을 살 수 있어요.');
    expect(has(tree, 'boarding-ineligible-action')).toBe(false);
    expect(hasText(tree, BOARDING.ineligible.not_confirmed.title)).toBe(false);
    expect(BOARDING.ineligible.grade_pending.body).not.toMatch(/\d/);
  });
});

describe('답 확인 결과 말(QP-35)', () => {
  test("답하지 않은 칸(null · 'decline')은 '답하지 않음' · 고르는 보기와 대화형 설문 내 말 풍선은 '말하고 싶지 않아요' 그대로", () => {
    const name = () => null;
    expect(SV2.common.declinedValue).toBe('답하지 않음');
    expect(reviewAnswerText(qOf('A06'), null, name)).toBe('답하지 않음');
    expect(reviewAnswerText(qOf('A07'), 'decline', name)).toBe('답하지 않음');
    expect(reviewAnswerText(qOf('A07'), 'never', name)).toBe(answerText(qOf('A07'), 'never', name));
    expect(SV2.common.decline).toBe('말하고 싶지 않아요');
    expect(answerText(qOf('C05'), null, name)).toBe('말하고 싶지 않아요'); // 대화형 설문 내 말 풍선(surveyChat/model buildPart1)이 쓰는 글
  });
});

describe('동의 관리(카피 12-Q)', () => {
  const api = (on: Partial<Record<string, boolean>>, setOptional: SettingsApi['setOptional'] = async () => ({ ok: true })) =>
    ({ loadConsents: async () => ({ ok: true as const, data: { CK4: false, CK9: false, CK11: false, CK12: false, CK13: false, CK14: false, CK15: false, CK16: false, ...on } }), setOptional }) as unknown as Pick<SettingsApi, 'loadConsents' | 'setOptional'>;
  const page = (a: Pick<SettingsApi, 'loadConsents' | 'setOptional'>, boarded?: () => Promise<boolean>) => keep(<ConsentManagePage api={a} boarded={boarded} onBack={() => undefined} onToast={() => undefined} />);

  test('이번 회차 탑승권이 있으면(판매 마감 전) CK4 끄기 · CK15 거두기 확인창 본문 아래 한 줄 · 본문은 그대로', async () => {
    const tree = await page(api({ CK4: true, CK15: true }), async () => true);
    await press(tree, 'settings-consent-CK4');
    await wait(10);
    expect(isOpen(tree, 'settings-ck4-off')).toBe(true);
    expect(textOf(tree, 'settings-ck4-off-note-text')).toBe('판매 마감 전에 끄면, 이미 탄 이번 회차는 짝을 정하지 않고 크레딧 1장으로 돌려드려요.');
    expect(hasText(tree, CONSENT_MANAGE.ck4OffBody)).toBe(true);
    await press(tree, 'settings-ck4-off-cancel');
    await press(tree, 'settings-consent-CK15');
    await wait(10);
    expect(textOf(tree, 'settings-later-off-note-text')).toBe('판매 마감 전에 거두면, 이미 탄 이번 회차는 짝을 정하지 않고 크레딧 1장으로 돌려드려요.');
  });

  test('탑승권이 없거나 · 못 읽거나 · 다른 칸(CK16)이면 그 줄 없음', async () => {
    for (const boarded of [async () => false, async () => Promise.reject(new Error('x')), undefined]) {
      const tree = await page(api({ CK4: true, CK15: true }), boarded);
      await press(tree, 'settings-consent-CK4');
      await wait(10);
      expect(has(tree, 'settings-ck4-off-note')).toBe(false);
    }
    const tree = await page(api({ CK16: true }), async () => true);
    await press(tree, 'settings-consent-CK16');
    await wait(10);
    expect(isOpen(tree, 'settings-later-off')).toBe(true);
    expect(has(tree, 'settings-later-off-note')).toBe(false);
  });

  test("동의 기록 상한(0041 too_many_consents → limit): '다시 시도' 대신 고객센터 안내 글", async () => {
    const tree = await page(api({}, async () => ({ ok: false, reason: 'limit' })));
    await press(tree, 'settings-consent-CK9');
    await wait(10);
    expect(textOf(tree, 'settings-consents-error')).toBe('동의 기록이 가득 차서 저장하지 못했어요. 설정의 고객센터로 알려 주시면 도와 드릴게요.');
    expect(CONSENT_MANAGE.tooMany).not.toMatch(/\d/);
  });
});

describe('고객센터 연락처 준비 중(카피 12-Q SUPPORT.contactPending · QP-31)', () => {
  const deps = { copyText: jest.fn(async () => true), openMail: jest.fn(async () => undefined) };
  test('이메일 값이 없으면 이메일 · 운영 시간 줄 · 버튼 대신 한 줄(운영 시간만 있어도) · 값이 있으면 그 줄 없음', async () => {
    for (const hours of [null, '평일 10시 ~ 17시']) {
      const tree = await keep(<SupportPage deps={deps} contact={{ email: null, hours }} onBack={() => undefined} onToast={() => undefined} />);
      expect(textOf(tree, 'settings-support-pending')).toBe(SUPPORT.contactPending);
      for (const id of ['settings-support-card', 'settings-support-hours', 'settings-support-copy', 'settings-support-mail']) expect(has(tree, id)).toBe(false);
    }
    const tree = await keep(<SupportPage deps={deps} contact={{ email: 'help@example.com', hours: '평일 10시 ~ 17시' }} onBack={() => undefined} onToast={() => undefined} />);
    expect(has(tree, 'settings-support-pending')).toBe(false);
    expect(has(tree, 'settings-support-hours')).toBe(true);
    expect(allTexts(tree).some((t) => t === SUPPORT.contactPending)).toBe(false);
  });
});

describe('12-5 [더하기] 저장하는 중(카피 20장 AVOID.saving)', () => {
  test('보내는 동안 점 셋 · 읽기 이름 저장하는 중 → 끝나면 [더하기]', async () => {
    const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email: 's3asaving@email.com' } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email: 's3asaving@email.com', token: DEMO_OTP_CODE } });
    const real = createSettingsApi(client, 'test');
    let release: () => void = () => undefined;
    const api = { ...real, setAvoidCompany: (name: string, on: boolean) => new Promise<Awaited<ReturnType<typeof real.setAvoidCompany>>>((done) => (release = () => void real.setAvoidCompany(name, on).then(done))) };
    const tree = await keep(<AvoidPage api={api} onBack={() => undefined} onToast={() => undefined} />);
    await wait(30);
    await typeInto(tree, 'settings-avoid-company-input', 'OO상사');
    await press(tree, 'settings-avoid-company-add');
    const btn = () => tree.root.findAll((n) => n.props.testID === 'settings-avoid-company-add' && n.props.accessibilityLabel !== undefined)[0]?.props;
    expect(btn()?.accessibilityLabel).toBe(AVOID.saving);
    expect(has(tree, 'settings-avoid-company-add-dots')).toBe(true);
    await act(async () => release());
    await wait(30);
    expect(btn()?.accessibilityLabel).toBe(AVOID.add);
    expect(hasText(tree, 'OO상사')).toBe(true);
  });
});

describe('13-1 정치 카드 글(POL14)', () => {
  test("[다음] 막힘 이유 = '동의 칸을 눌러야 답을 저장할 수 있어요.' · POL7 그대로", () => {
    expect(POL.needConsent).toBe('동의 칸을 눌러야 답을 저장할 수 있어요.');
    expect(POL.unset).toBe('아직 정하지 않았어요');
  });
});

describe('설문 정치 동의 카드 · 동의 기록 상한(카피 12-Q tooMany — 설문 동의 카드에서도 같은 글)', () => {
  test("CK15 기록이 상한에 걸리면 '다시 시도' 대신 고객센터 안내 글", async () => {
    const memory = createDemoV2Memory();
    demoV2Seed(memory, 'u1', { ck4: true });
    const base = { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'lim@email.com' } } }, error: null }) } } as never;
    const client = createSurveyV2DemoClient(base, { memory });
    const api = createSurveyV2Api(client, { demo: true, proofUpload: false, schoolSearch: 'server' });
    expect(await api.save({ answers: { A12: '김하나', A02: 'female', A03: { sido: 'seoul', sigungu: '강남구' }, A05: 165 } })).toEqual({ ok: true });
    const politics = { ...createPoliticsApi(client), agree: async () => ({ ok: false as const, reason: 'limit' as const }) };
    const tree = await keep(<SurveyV2Screen deps={{ api, local: createLocalDraftStore(chunkedStorage(createMemoryStore().store)), now: () => 1, politics }} entry="politics" />);
    await wait(60);
    await press(tree, 'v2-pol-check');
    await act(async () => must(tree, 'v2-pol-slider-track').props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    await press(tree, 'v2-next');
    await wait(20);
    expect(textOf(tree, 'v2-save-error')).toBe(CONSENT_MANAGE.tooMany);
    expect(mockRouter.back).not.toHaveBeenCalled(); // 저장이 안 됐으니 T1 로 돌아가지 않는다
  });
});
