// 12 탈퇴(F7 통과 조건 3): 확인창(법무 5-6) → 인증번호 재확인(N31) → 확정 → 로그인 정보를 지우고 01.
// 맞게 입력하기 전에는 탈퇴가 아니다: 틀림(칸만 비움) · 3분 지남 · 횟수 초과 · 발송 실패 · 취소 · 뒤로가기.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { SIGN_IN } from '@/content/copy';
import { WITHDRAW } from '@/content/settingsCopy';
import { SettingsScreen, type SettingsDeps } from '@/features/settings/SettingsScreen';
import type { SettingsApi } from '@/lib/settingsApi';

import { allTexts, has, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

jest.setTimeout(90_000); // 전체 시험이 함께 돌 때(npm run check) 첫 화면 그리기가 30초를 넘는 일이 있었다

// 같은 testID 가 겹쳐 있을 때(부품 → 안쪽 요소) 그 값을 가진 첫 요소의 값
const propOf = (tree: ReactTestRenderer, id: string, key: string): any => tree.root.findAll((n) => n.props.testID === id && n.props[key] !== undefined)[0]?.props[key];

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => true), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ likesApi: {}, settingsApi: {}, recsApi: {}, profileApi: {}, aiApi: {}, authApi: {}, supabase: {} }));

let clock = Date.UTC(2026, 9, 15, 3, 0, 0);

function setup(over: Partial<SettingsApi> = {}) {
  const api = {
    startWithdraw: jest.fn(async () => ({ ok: true as const })),
    confirmWithdraw: jest.fn(async () => ({ ok: true as const })),
    signOut: jest.fn(async () => undefined),
    ...over,
  } as unknown as jest.Mocked<SettingsApi>;
  const deps: SettingsDeps = {
    api,
    now: () => clock,
    resetLocal: jest.fn(),
    pushStatus: async () => 'granted',
    requestPush: async () => 'granted',
    copyText: async () => true,
    openMail: async () => undefined,
  };
  return { api, deps };
}

async function openOtp(over: Partial<SettingsApi> = {}) {
  const s = setup(over);
  const tree = await mount(<SettingsScreen deps={s.deps} />);
  trees.push(tree);
  await press(tree, 'settings-withdraw');
  return { ...s, tree };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  clock = Date.UTC(2026, 9, 15, 3, 0, 0);
});
const trees: ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => trees.splice(0).forEach((t) => t.unmount()));
  jest.useRealTimers();
});

describe('12 탈퇴', () => {
  test('확인창: 제목 · 본문 · 보조(법무 5-6 글자 그대로) · [탈퇴하기] [취소] — 아직 서버에 아무것도 보내지 않는다', async () => {
    const { tree, api } = await openOtp();
    expect(isOpen(tree, 'withdraw-confirm')).toBe(true);
    expect(textOf(tree, 'withdraw-confirm-title')).toBe('정말 탈퇴할까요?');
    expect(textOf(tree, 'withdraw-confirm-body')).toBe(WITHDRAW.body);
    expect(textOf(tree, 'withdraw-confirm-sub')).toBe(WITHDRAW.sub);
    expect(api.startWithdraw).not.toHaveBeenCalled();
    await press(tree, 'withdraw-confirm-cancel');
    expect(has(tree, 'withdraw-otp-title')).toBe(false);
    expect(api.startWithdraw).not.toHaveBeenCalled();
  });

  test('[탈퇴하기] → 인증번호 발송 → 같은 자리에서 재확인 단계(N31): 제목 · 안내 · 칸 · 다시 받기 안내 02:59 · [탈퇴 확정](6자리 전엔 꺼짐) · [취소]', async () => {
    const { tree, api } = await openOtp();
    await press(tree, 'withdraw-confirm-confirm');
    expect(api.startWithdraw).toHaveBeenCalledTimes(1);
    expect(isOpen(tree, 'withdraw-otp')).toBe(true);
    expect(textOf(tree, 'withdraw-otp-title')).toBe('이메일로 받은 인증번호를 입력해 주세요');
    expect(textOf(tree, 'withdraw-otp-body')).toBe('가입한 이메일로 인증번호 6자리를 보냈어요. 인증번호를 입력하면 탈퇴가 확정돼요.');
    expect(propOf(tree, 'withdraw-code', 'placeholder')).toBe('인증번호 6자리');
    expect(textOf(tree, 'withdraw-retry-after')).toBe('03:00 뒤에 다시 받을 수 있어요');
    clock += 1000;
    await act(async () => jest.advanceTimersByTime(1000));
    expect(textOf(tree, 'withdraw-retry-after')).toBe('02:59 뒤에 다시 받을 수 있어요');
    expect(propOf(tree, 'withdraw-submit', 'disabled')).toBe(true);
    await typeInto(tree, 'withdraw-code', '12a34');
    expect(propOf(tree, 'withdraw-code', 'value')).toBe('1234');
    await typeInto(tree, 'withdraw-code', '123456');
    expect(propOf(tree, 'withdraw-submit', 'disabled')).toBe(false);
  });

  test('맞는 번호 → 서버가 확정 → 로그인 정보 · 임시 저장 지우고 01(쌓인 화면 없이)', async () => {
    const { tree, api, deps } = await openOtp();
    await press(tree, 'withdraw-confirm-confirm');
    await typeInto(tree, 'withdraw-code', '123456');
    await press(tree, 'withdraw-submit');
    expect(api.confirmWithdraw).toHaveBeenCalledWith('123456');
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(deps.resetLocal).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissAll).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
  });

  test('틀린 번호 → 02 와 같은 글, 칸만 비우고 머문다 · 탈퇴 아님', async () => {
    const { tree, api } = await openOtp({ confirmWithdraw: jest.fn(async () => ({ ok: false as const, reason: 'wrong' as const })) });
    await press(tree, 'withdraw-confirm-confirm');
    await typeInto(tree, 'withdraw-code', '000000');
    await press(tree, 'withdraw-submit');
    expect(propOf(tree, 'withdraw-code', 'error')).toBe(SIGN_IN.errors.codeWrong);
    expect(propOf(tree, 'withdraw-code', 'value')).toBe('');
    expect(isOpen(tree, 'withdraw-otp')).toBe(true);
    expect(api.signOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('3분 지남 → "입력 시간이 지났어요…" · [인증번호 다시 받기]가 켜지고 다시 보내면 시계가 새로', async () => {
    const { tree, api } = await openOtp();
    await press(tree, 'withdraw-confirm-confirm');
    clock += 180_000;
    await act(async () => jest.advanceTimersByTime(1000));
    expect(propOf(tree, 'withdraw-code', 'error')).toBe(SIGN_IN.errors.codeExpired);
    await typeInto(tree, 'withdraw-code', '123456');
    await press(tree, 'withdraw-submit');
    expect(api.confirmWithdraw).not.toHaveBeenCalled();
    await press(tree, 'withdraw-resend');
    expect(api.startWithdraw).toHaveBeenCalledTimes(2);
    expect(textOf(tree, 'withdraw-retry-after')).toBe('03:00 뒤에 다시 받을 수 있어요');
    expect(propOf(tree, 'withdraw-code', 'error') ?? null).toBe(null);
  });

  test('횟수 초과(잠금) → 02 횟수 초과 글 · 발송 실패 → N31 발송 실패 글, 둘 다 재확인 단계에 머문다', async () => {
    const locked = await openOtp({ confirmWithdraw: jest.fn(async () => ({ ok: false as const, reason: 'limit' as const })) });
    await press(locked.tree, 'withdraw-confirm-confirm');
    await typeInto(locked.tree, 'withdraw-code', '111111');
    await press(locked.tree, 'withdraw-submit');
    expect(must(locked.tree, 'withdraw-code').props.error).toBe(SIGN_IN.errors.tooMany);
    expect(locked.api.signOut).not.toHaveBeenCalled();

    const sendFail = await openOtp({ startWithdraw: jest.fn(async () => ({ ok: false as const, reason: 'send' as const })) });
    await press(sendFail.tree, 'withdraw-confirm-confirm');
    expect(isOpen(sendFail.tree, 'withdraw-otp')).toBe(true);
    expect(must(sendFail.tree, 'withdraw-code').props.error).toBe('인증번호를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    expect(has(sendFail.tree, 'withdraw-resend')).toBe(true);
  });

  test('[취소] · ‹ → 탈퇴 없이 12 목록, 다시 열면 확인창부터', async () => {
    const { tree, api } = await openOtp();
    await press(tree, 'withdraw-confirm-confirm');
    await press(tree, 'withdraw-cancel');
    expect(has(tree, 'withdraw-otp-title')).toBe(false);
    expect(has(tree, 'settings-rows')).toBe(true);
    await press(tree, 'settings-withdraw');
    expect(isOpen(tree, 'withdraw-confirm')).toBe(true);
    await press(tree, 'withdraw-confirm-confirm');
    await press(tree, 'withdraw-otp-header-back');
    expect(has(tree, 'withdraw-otp-title')).toBe(false);
    expect(api.confirmWithdraw).not.toHaveBeenCalled();
    expect(api.signOut).not.toHaveBeenCalled();
  });

  test('글에 "모든 데이터 삭제" · 등급 · 점수 말이 없다', async () => {
    const { tree } = await openOtp();
    const seen = allTexts(tree);
    await press(tree, 'withdraw-confirm-confirm');
    const all = [...seen, ...allTexts(tree)];
    // v5(QP-A, 12-Q): 목록 줄은 '크레딧 · 구매 내역'이라 등급 말이 없다. 탈퇴 확인창 아래 줄은 크레딧 줄 하나(구독 안내 NV36 없음)
    expect(all.filter((t) => /모든 데이터 삭제|등급|점수|구독/.test(t))).toEqual([]);
  });
});
