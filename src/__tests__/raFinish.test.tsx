// R-A(D-199 · D-200 · D-201): 법인 전 v5 마무리 앱 몫 — 탑승권 마감 · 취소 · 계약 요약 · 크레딧 기한 없음 · 12-5 아는 분 피하기 · 멈추기 한 줄 ·
//  알림 토큰 등록(스위치 꺼짐이면 0) · 05 하단 안내. 모의 서버(데모) 위에서 실제 api 로 돈다.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { AVOID, AVOID_MAX, SETTINGS } from '@/content/settingsCopy';
import { PHOTOS_LITE } from '@/content/surveyLiteCopy';
import { SETTINGS16 } from '@/content/shopCopy';
import { createBoardingApi } from '@/features/boarding/boardingApi';
import { BOARDING, CREDITS, TICKET_PRICE } from '@/features/boarding/boardingCopy';
import { canCancel } from '@/features/boarding/boardingLogic';
import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { CreditScreen } from '@/features/boarding/CreditScreen';
import { AvoidPage } from '@/features/settings/AvoidPage';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { registerPushToken, type PushRegisterDeps } from '@/lib/pushRegistration';
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
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ profileApi: { facePhotoUrl: async () => null }, likesApi: {}, recsApi: {}, gradeApi: {}, aiApi: {}, authApi: {}, settingsApi: {}, supabase: {} }));

async function demoClient(email: string) {
  const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22, 3, 0, 0) }));
  await client.functions.invoke('otp-gate', { body: { action: 'send', email } });
  await client.functions.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return client;
}
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});
beforeEach(() => jest.clearAllMocks());

async function boarding(email: string) {
  const client = await demoClient(email);
  const api = createBoardingApi(client);
  const tree = await mount(<BoardingScreen deps={{ api, newId: () => `req-${email}`, toastMs: 5_000 }} />);
  shown.push(tree);
  await flush();
  return { tree, api, client };
}

describe('T1 · T2 판매 마감 · 탑승 취소(D-200 ④ · D-201)', () => {
  test('판매 중: 마감 안내 한 줄(남은 시간 · 카운트다운 0) · 구매 시트: 규칙 3줄 · 계약 요약 블록 · 결제 바로 위 마감 고지', async () => {
    const { tree } = await boarding('raonsale@email.com');
    expect(textOf(tree, 'boarding-sale-close')).toBe('판매는 수요일 오후 5시 30분에 마감해요.');
    await press(tree, 'boarding-buy');
    expect(BOARDING.sheet.rules).toEqual(['탑승권은 회차마다 1장이에요.', '크레딧은 기한 없이 다음 회차에 쓸 수 있어요.', '판매 마감 전에는 취소할 수 있고, 결과가 공개된 뒤에는 돌려드리지 않아요.']);
    expect(textOf(tree, 'boarding-sheet-deadline')).toBe(BOARDING.sheet.deadlineNote);
    expect(hasText(tree, BOARDING.sheet.contractSummaryTitle)).toBe(true);
    // 7줄 중 ⑦(신고번호 자리 글)은 값이 비어 숨김 — 6줄
    expect([0, 1, 2, 3, 4, 5].every((i) => has(tree, `boarding-contract-summary-${i}`))).toBe(true);
    expect(has(tree, 'boarding-contract-summary-6')).toBe(false);
    expect(textOf(tree, 'boarding-contract-summary-1')).toContain(TICKET_PRICE); // 구매 화면 가격과 같은 값
    expect(textOf(tree, 'boarding-sheet-price')).toBe(TICKET_PRICE);
    expect(allTexts(tree).some((t) => /\{[^}]+\}/.test(t))).toBe(false);
  });

  test('탄 뒤 마감 전: [탑승 취소] + 고객센터 한 줄 → 확인창(같은 무게 두 버튼) → [취소하기] → 토스트 · 판매 중으로', async () => {
    const { tree } = await boarding('raboardon@email.com');
    expect(textOf(tree, 'boarding-sale-close')).toBe(BOARDING.saleCloseNote);
    expect(textOf(tree, 'boarding-cancel-support')).toBe(BOARDING.cancel.supportNote);
    await press(tree, 'boarding-cancel');
    expect(textOf(tree, 'boarding-cancel-confirm-title')).toBe(BOARDING.cancel.title);
    expect(textOf(tree, 'boarding-cancel-confirm-body')).toBe(BOARDING.cancel.body);
    await press(tree, 'boarding-cancel-confirm-confirm');
    await flush();
    expect(hasText(tree, BOARDING.cancel.done)).toBe(true);
    expect(has(tree, 'boarding-buy')).toBe(true);
  });

  test('크레딧으로 탔다면 취소하면 크레딧 1장이 돌아오고 내역 이유는 "탑승을 취소해 돌려받음"', async () => {
    const { api } = await boarding('raboardoncredit@email.com');
    const before = await api.ledger();
    expect(before.ok && before.balance).toBe(0);
    expect(await api.cancel(1)).toEqual({ ok: true, roundNo: 1, credited: true }); // 0037 result 'credited'
    const after = await api.ledger();
    expect(after.ok && after.balance).toBe(1);
    expect(after.ok && after.items[0].reason).toBe('cancelled');
    expect(CREDITS.reasons.cancelled).toBe('탑승을 취소해 돌려받음');
  });

  test('탄 뒤 마감 지남: 버튼 없음 · "판매가 마감되어 취소할 수 없어요." · 서버도 sale_closed', async () => {
    const { tree, api } = await boarding('raboardlate@email.com');
    expect(has(tree, 'boarding-cancel')).toBe(false);
    expect(textOf(tree, 'boarding-cancel-closed')).toBe(BOARDING.cancel.closed);
    expect(await api.cancel(1)).toEqual({ ok: false, reason: 'closed' });
  });

  test('canCancel: 이번 회차 탑승 · 서버 시각이 마감 전일 때만', () => {
    const round = { no: 1, matchAt: 100, saleOpenAt: 0, saleCloseAt: 50 };
    const ticket = { roundNo: 1, boughtAt: 1, paidWith: 'store' as const };
    expect(canCancel({ ticket, round, now: 49 })).toBe(true);
    expect(canCancel({ ticket, round, now: 50 })).toBe(false);
    expect(canCancel({ ticket: null, round, now: 1 })).toBe(false);
    expect(canCancel({ ticket, round: { ...round, saleCloseAt: null }, now: 1 })).toBe(false);
  });
});

describe('T5 크레딧 기한 없음(D-200 ③)', () => {
  test("'기한 없이' 한 줄 · '1년' · 끝나는 날 0", async () => {
    const client = await demoClient('raboardcredit@email.com');
    const tree = await mount(<CreditScreen deps={{ api: createBoardingApi(client) }} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'credits-no-expiry')).toBe('크레딧은 기한 없이 쓸 수 있어요. 탈퇴하면 남은 크레딧은 쓸 수 없어요.');
    expect(allTexts(tree).join(' ')).not.toMatch(/1년|만료|까지 쓸 수/);
    expect(CREDITS.note).toBe('크레딧 1장으로 다음 회차 탑승권 1장을 탈 수 있어요.');
  });
});

describe('12-5 아는 분 피하기(D-200 ① · D-201)', () => {
  async function avoid(email = 'raavoid@email.com') {
    const client = await demoClient(email);
    const api = createSettingsApi(client, 'test');
    const toast = jest.fn();
    const tree = await mount(<AvoidPage api={api} onBack={() => undefined} onToast={toast} />);
    shown.push(tree);
    await flush();
    return { tree, api, toast };
  }

  test('처음: 한 줄 안내 · 빈 회사 · 학교 · 지인 차단(준비 중) · 이메일 비교 스위치 처음 켜짐 + 아래 글 · 숫자 0', async () => {
    const { tree } = await avoid();
    expect(textOf(tree, 'settings-avoid-intro')).toBe(AVOID.intro);
    expect(hasText(tree, AVOID.contactTitle)).toBe(true);
    expect(hasText(tree, SETTINGS.verificationSoon)).toBe(true);
    expect(tree.root.findAll((n) => n.props.testID === 'settings-avoid-share-email' && n.props.accessibilityState?.checked === true).length).toBeGreaterThan(0);
    expect(hasText(tree, AVOID.shareEmailNote)).toBe(true);
    expect(allTexts(tree).some((t) => /\d+(명|곳)/.test(t) && t !== AVOID.full)).toBe(false);
  });

  test('회사: 더하면 바로 저장 · 5곳이 차면 입력 대신 한 줄 · 지우면 다시 넣을 수 있다', async () => {
    const { tree, api, toast } = await avoid('raavoidco@email.com');
    for (let i = 0; i < AVOID_MAX; i += 1) {
      await typeInto(tree, 'settings-avoid-company-input', `회사${i}`);
      await press(tree, 'settings-avoid-company-add');
      await flush();
    }
    const saved = await api.loadAvoid();
    expect(saved.ok && saved.data.companies).toEqual(['회사0', '회사1', '회사2', '회사3', '회사4']);
    expect(toast).toHaveBeenCalled();
    expect(textOf(tree, 'settings-avoid-company-full')).toBe(AVOID.full);
    expect(has(tree, 'settings-avoid-company-input')).toBe(false);
    await press(tree, 'settings-avoid-company-0-remove');
    await flush();
    expect(has(tree, 'settings-avoid-company-input')).toBe(true);
  });

  test('학교: 내장 학교 검색(2자부터)에서 고르면 저장 · 이름으로 보인다', async () => {
    const { tree, api } = await avoid('raavoidsch@email.com');
    await typeInto(tree, 'settings-avoid-school-input', '서울대');
    await flush();
    expect(has(tree, 'settings-avoid-school-hit-0')).toBe(true);
    await press(tree, 'settings-avoid-school-hit-0');
    await flush();
    const saved = await api.loadAvoid();
    expect(saved.ok && saved.data.schools.length).toBe(1);
    expect(has(tree, 'settings-avoid-school-0')).toBe(true);
  });

  test('이메일 비교 스위치를 끄면 서버에 끔(내 비교 키 지움 요청)', async () => {
    const { tree, api } = await avoid('raavoidsh@email.com');
    await press(tree, 'settings-avoid-share-email');
    await flush();
    const saved = await api.loadAvoid();
    expect(saved.ok && saved.data.shareEmail).toBe(false);
  });
});

describe('알림 토큰 등록(D-199): 스위치 꺼짐이면 0', () => {
  const deps = (over: Partial<PushRegisterDeps> = {}) => {
    const rpc = jest.fn(async () => ({ data: 'id', error: null }));
    const d: PushRegisterDeps = {
      flagOn: async () => true,
      permission: async () => 'granted',
      token: async () => 'ExponentPushToken[abcdefghij]',
      platform: 'android',
      osVersion: '14',
      appVersion: '1.0.0',
      client: { rpc } as unknown as PushRegisterDeps['client'],
      ...over,
    };
    return { d, rpc };
  };
  test('스위치 꺼짐 → 토큰을 얻지도 보내지도 않는다', async () => {
    const token = jest.fn(async () => 'ExponentPushToken[abcdefghij]');
    const { d, rpc } = deps({ flagOn: async () => false, token });
    expect(await registerPushToken(d)).toBe('flag-off');
    expect(token).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  test('권한이 없거나 웹이면 0', async () => {
    const a = deps({ permission: async () => 'undetermined' });
    expect(await registerPushToken(a.d)).toBe('no-permission');
    expect(a.rpc).not.toHaveBeenCalled();
    const w = deps({ platform: 'web' });
    expect(await registerPushToken(w.d)).toBe('web');
  });
  test('켜짐 + 권한 → register_device(p_platform · p_os_version · p_app_version · p_push_token)', async () => {
    const { d, rpc } = deps();
    expect(await registerPushToken(d)).toBe('registered');
    expect(rpc).toHaveBeenCalledWith('register_device', { p_platform: 'android', p_os_version: '14', p_app_version: '1.0.0', p_push_token: 'ExponentPushToken[abcdefghij]' });
  });
});

describe('그 밖 글(D-199)', () => {
  test('멈추기 확인창 한 줄 · 다시 켠 뒤 한 줄 · 05 하단 안내(법무 5-4)', () => {
    expect(SETTINGS16.stopConfirm.boarded).toBe('탑승권이 있으면 이번 회차는 짝을 고르지 못할 수 있어요. 그때는 크레딧 1장으로 돌려드려요.');
    expect(SETTINGS16.resumeNote).toBe('다음 날 새벽에 다시 계산해요.');
    expect(PHOTOS_LITE.internalNote).toBe('운영팀은 사진이 안내에 맞는지만 확인해요. 외모를 평가하거나 점수를 매기지 않아요. AI는 사진을 보지 않아요.');
    expect(PHOTOS_LITE.internalNote).not.toMatch(/추천/);
  });
});
