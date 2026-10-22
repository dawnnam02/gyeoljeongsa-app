// 02 가입 · 로그인 화면(F1 통과 조건 2 · 3-1 · 6): 글 · 입력 · 오류 4종 · 재전송 타이머 · 생년월일 · 미성년 거절 · 뒤로가기.
// 서버는 모의 서버(데모 모드의 모의 클라이언트)로, 시계는 가짜 타이머로 움직인다.
import { act } from 'react-test-renderer';
import { BackHandler } from 'react-native';

import { SIGNUP_NOTICE } from '@/content/consentContent';
import { COMMON, SIGN_IN } from '@/content/copy';
import { SignInScreen } from '@/features/auth/SignInScreen';
import type { SignInDeps } from '@/features/auth/useSignIn';
import { createAuthApi } from '@/lib/authApi';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { loadProgressStage } from '@/lib/progress';
import type { ProgressStage } from '@/types/account';

import { allTexts, find, has, hasText, isOpen, mount, must, press, textOf, typeInto } from './renderHelpers';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
const mockParams: Record<string, string | undefined> = {};
const mockSetStage = jest.fn();
const mockFocusEffects: (() => void | (() => void))[] = []; // 화면이 다시 보일 때(focus) 도는 효과를 붙잡아 둔다
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockFocusEffects.push(effect);
      React.useEffect(effect, [effect]);
    },
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/store', () => ({ useSignupStore: { getState: () => ({ setStage: mockSetStage }) } }));
jest.mock('@/lib/services', () => ({ likesApi: {}, authApi: {}, supabase: {} })); // 진짜 서버 연결을 만들지 않는다
jest.mock('@/config/env', () => ({ env: { demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));

jest.setTimeout(30_000); // 화면을 통째로 그리는 시험이라 느린 PC 에서는 기본 5초가 모자란다

const START = Date.UTC(2026, 9, 14, 3, 0, 0); // 한국 2026-10-14 12:00

function setup(stageOverride?: ProgressStage) {
  const backend = createDemoBackend({ now: () => Date.now() });
  const client = createDemoClient(backend);
  const auth = createAuthApi(client);
  const stages: ProgressStage[] = [];
  const passed = jest.fn();
  const deps: SignInDeps = {
    auth,
    loadStage: stageOverride ? async () => ({ ok: true, stage: stageOverride }) : () => loadProgressStage(client),
    now: () => Date.now(),
    onStage: (stage) => void stages.push(stage),
    onBirthPassed: passed,
  };
  return { backend, auth, deps, stages, passed };
}

let backHandlers: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  jest.useFakeTimers({ now: START });
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  mockFocusEffects.length = 0;
  backHandlers = [];
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean | null | undefined);
    return { remove: () => undefined };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const renderScreen = (deps: SignInDeps) => mount(<SignInScreen deps={deps} />);
const errorOf = (tree: Awaited<ReturnType<typeof mount>>, field: 'email' | 'code' | 'birth') => textOf(tree, `signin-${field}-error`);

async function sendAndEnterCode(tree: Awaited<ReturnType<typeof mount>>, email: string, code: string) {
  await typeInto(tree, 'signin-email', email);
  await press(tree, 'signin-send');
  await typeInto(tree, 'signin-code', code);
}

describe('화면 글 (카피.md 02 · 동의문구 5-2)', () => {
  test('상단 바 · 제목 · 부제 · 입력 칸 · 버튼 · 안내가 확정 문구 그대로 있다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(hasText(tree, SIGN_IN.headerTitle)).toBe(true);
    expect(hasText(tree, '이메일로 시작해요')).toBe(true);
    expect(hasText(tree, '인증번호를 이메일로 보내드려요.')).toBe(true);
    expect(must(tree, 'signin-email').props.placeholder).toBe('example@email.com');
    expect(must(tree, 'signin-code').props.placeholder).toBe('인증번호 6자리');
    expect(hasText(tree, '인증번호 받기')).toBe(true);
    expect(hasText(tree, '확인')).toBe(true);
    expect(textOf(tree, 'signin-age-notice')).toBe('만 24세 이상만 가입할 수 있어요.'); // D-100 · D-123
  });

  test('가입 안내(동의문구 5-2)와 처리방침 링크가 입력하기 전부터 보인다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(textOf(tree, 'signin-notice')).toBe(SIGNUP_NOTICE.text);
    expect(hasText(tree, SIGNUP_NOTICE.link)).toBe(true);
    expect(allTexts(tree).some((t) => t.includes('PASS'))).toBe(false); // 시안의 PASS 문구는 쓰지 않는다
  });

  test('처음에는 [확인]이 비활성이고 인증번호 칸이 잠겨 있으며 생년월일 칸은 없다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(must(tree, 'signin-confirm').props.disabled).toBe(true);
    expect(must(tree, 'signin-code').props.disabled).toBe(true);
    expect(has(tree, 'signin-birth')).toBe(false);
    expect(has(tree, 'signin-countdown')).toBe(false);
  });

  test('개인정보 처리방침 링크를 누르면 처리방침 읽기 화면이 열린다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(isOpen(tree, 'legal-reader')).toBe(false);
    await press(tree, 'signin-privacy-link');
    expect(isOpen(tree, 'legal-reader')).toBe(true);
    expect(must(tree, 'legal-tab-privacy').props.variant).toBe('selected');
    expect(must(tree, 'legal-tab-terms').props.variant).toBe('inactive');
    await press(tree, 'legal-reader-close');
    expect(isOpen(tree, 'legal-reader')).toBe(false);
  });
});

describe('이메일 · 인증번호 받기', () => {
  test('형식이 틀린 이메일로 누르면 "이메일 주소를 다시 확인해 주세요."가 이메일 칸 아래에 보인다(흐린 버튼도 눌린다)', async () => {
    const tree = await renderScreen(setup().deps);
    await typeInto(tree, 'signin-email', 'abc');
    expect(must(tree, 'signin-send').props.dimmed).toBe(true);
    await press(tree, 'signin-send');
    expect(errorOf(tree, 'email')).toBe(SIGN_IN.errors.emailFormat);
    await typeInto(tree, 'signin-email', 'abc@def.co'); // 고치면 사라진다
    expect(errorOf(tree, 'email')).toBeNull();
  });

  test('받으면 인증번호 칸이 열리고 "03:00 뒤에 다시 받을 수 있어요"가 줄어든다', async () => {
    const tree = await renderScreen(setup().deps);
    await typeInto(tree, 'signin-email', 'hello@email.com');
    expect(must(tree, 'signin-send').props.dimmed).toBe(false);
    await press(tree, 'signin-send');
    expect(textOf(tree, 'signin-countdown')).toBe('03:00 뒤에 다시 받을 수 있어요');
    expect(must(tree, 'signin-code').props.disabled).toBe(false);
    expect(must(tree, 'signin-send').props.dimmed).toBe(true);
    act(() => jest.advanceTimersByTime(1000));
    expect(textOf(tree, 'signin-countdown')).toBe('02:59 뒤에 다시 받을 수 있어요');
    act(() => jest.advanceTimersByTime(60_000));
    expect(textOf(tree, 'signin-countdown')).toBe('01:59 뒤에 다시 받을 수 있어요');
  });

  test('3분이 지나면 안내가 사라지고 [인증번호 받기]가 다시 켜지며 "입력 시간이 지났어요…"가 보인다', async () => {
    const tree = await renderScreen(setup().deps);
    await typeInto(tree, 'signin-email', 'hello@email.com');
    await press(tree, 'signin-send');
    act(() => jest.advanceTimersByTime(180_000));
    expect(has(tree, 'signin-countdown')).toBe(false);
    expect(must(tree, 'signin-send').props.dimmed).toBe(false);
    expect(errorOf(tree, 'code')).toBe(SIGN_IN.errors.codeExpired);
  });

  test('발송 실패는 "인증번호를 보내지 못했어요. …"가 보이고 인증번호 칸은 계속 잠겨 있다', async () => {
    const tree = await renderScreen(setup().deps);
    await typeInto(tree, 'signin-email', 'fail@email.com');
    await press(tree, 'signin-send');
    expect(errorOf(tree, 'email')).toBe(SIGN_IN.errors.sendFailed);
    expect(must(tree, 'signin-code').props.disabled).toBe(true);
  });

  test('인터넷이 끊기면 공통 문구가 보인다', async () => {
    const s = setup();
    jest.spyOn(s.auth, 'sendCode').mockResolvedValue({ ok: false, reason: 'network' });
    const tree = await renderScreen(s.deps);
    await typeInto(tree, 'signin-email', 'hello@email.com');
    await press(tree, 'signin-send');
    expect(errorOf(tree, 'email')).toBe(COMMON.offline);
  });

  test('서버 문제는 공통 문구가 보인다', async () => {
    const s = setup();
    jest.spyOn(s.auth, 'sendCode').mockResolvedValue({ ok: false, reason: 'server' });
    const tree = await renderScreen(s.deps);
    await typeInto(tree, 'signin-email', 'hello@email.com');
    await press(tree, 'signin-send');
    expect(errorOf(tree, 'email')).toBe(COMMON.server);
  });
});

describe('인증번호 확인: 오류 4종 + 성공', () => {
  test('① 틀림: "인증번호가 맞지 않아요. 다시 확인해 주세요." — 칸은 비워지고 이메일은 남는다(15 인증 실패 모양)', async () => {
    const tree = await renderScreen(setup().deps);
    await sendAndEnterCode(tree, 'hello@email.com', '000000');
    expect(must(tree, 'signin-confirm').props.disabled).toBe(false);
    await press(tree, 'signin-confirm');
    expect(errorOf(tree, 'code')).toBe(SIGN_IN.errors.codeWrong);
    expect(must(tree, 'signin-code').props.value).toBe('');
    expect(must(tree, 'signin-email').props.value).toBe('hello@email.com');
    expect(has(tree, 'signin-birth')).toBe(false);
  });

  test('[확인]은 인증번호 6자리가 차야 눌린다(5자리까지는 비활성)', async () => {
    const tree = await renderScreen(setup().deps);
    await sendAndEnterCode(tree, 'hello@email.com', '12345');
    expect(must(tree, 'signin-confirm').props.disabled).toBe(true);
    await typeInto(tree, 'signin-code', '123456');
    expect(must(tree, 'signin-confirm').props.disabled).toBe(false);
  });

  test('③ 횟수 초과: 5번 틀리면 "인증을 너무 많이 시도했어요. 잠시 뒤에 다시 해 주세요."', async () => {
    const tree = await renderScreen(setup().deps);
    await sendAndEnterCode(tree, 'hello@email.com', '111111');
    for (let i = 0; i < 5; i += 1) {
      await typeInto(tree, 'signin-code', '111111');
      await press(tree, 'signin-confirm');
    }
    expect(errorOf(tree, 'code')).toBe(SIGN_IN.errors.tooMany);
    expect(must(tree, 'signin-send').props.dimmed).toBe(true); // 10분 동안 [인증번호 받기]를 막는다
  });

  test('맞으면 새 이메일이라 생년월일 칸이 열리고 이메일 · 인증번호 칸은 잠긴다', async () => {
    const tree = await renderScreen(setup().deps);
    await sendAndEnterCode(tree, 'new@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    expect(has(tree, 'signin-birth')).toBe(true);
    expect(must(tree, 'signin-birth').props.placeholder).toBe('생년월일 8자리 (예: 19950312)');
    expect(must(tree, 'signin-email').props.disabled).toBe(true);
    expect(must(tree, 'signin-code').props.disabled).toBe(true);
    expect(must(tree, 'signin-confirm').props.disabled).toBe(true); // 생년월일 8자리가 차야 눌린다
  });
});

// F22: 가입 나이 만 24세(D-100). 경계 날짜만 24년으로 옮겼다. 거절 글은 copy.ts SIGN_IN.errors.underage(카피.md 02 가 바뀌면 함께 바뀜 — app/F22_변경기록.md 6장)
describe('생년월일 → 가입 나이(만 24세) 판정 (F1 3-1 · K20 5장)', () => {
  async function toBirth(s: ReturnType<typeof setup>) {
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'new@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    return tree;
  }

  test('만 24세 통과(생일 당일 2002-10-14): 03 으로 간다', async () => {
    const s = setup();
    const tree = await toBirth(s);
    await typeInto(tree, 'signin-birth', '20021014');
    await press(tree, 'signin-confirm');
    expect(s.passed).toHaveBeenCalledTimes(1);
    expect(s.backend.peek.birthDate('new@email.co')).toBe('2002-10-14');
  });

  test('가입 나이 미달(생일 하루 전 2002-10-15): 거절 글이 칸 아래에 보이고 03 으로 가지 않는다', async () => {
    const s = setup();
    const tree = await toBirth(s);
    await typeInto(tree, 'signin-birth', '20021015');
    await press(tree, 'signin-confirm');
    expect(errorOf(tree, 'birth')).toBe(SIGN_IN.errors.underage);
    expect(s.passed).not.toHaveBeenCalled();
    expect(s.backend.peek.birthDate('new@email.co')).toBeNull();
  });

  test('없는 날짜는 "생년월일을 다시 확인해 주세요."', async () => {
    const s = setup();
    const tree = await toBirth(s);
    await typeInto(tree, 'signin-birth', '19951345');
    await press(tree, 'signin-confirm');
    expect(errorOf(tree, 'birth')).toBe(SIGN_IN.errors.birthFormat);
  });

  test('생년월일 칸은 숫자만 8자리까지 받는다', async () => {
    const tree = await toBirth(setup());
    await typeInto(tree, 'signin-birth', '1995-03-12 99');
    expect(must(tree, 'signin-birth').props.value).toBe('19950312');
  });
});

describe('가입된 이메일 · 정지', () => {
  test('가입된 이메일이면 진행 단계(동의 전)대로 이동하고 생년월일 칸은 열리지 않는다', async () => {
    const s = setup('birthdate-passed');
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'old@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    expect(s.stages).toEqual(['birthdate-passed']);
    expect(has(tree, 'signin-birth')).toBe(false);
  });

  test('정지된 계정으로 로그인하면 이메일 칸 아래에 이용 정지 안내(NK09)가 보인다', async () => {
    const s = setup('blocked');
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'old@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    expect(errorOf(tree, 'email')).toBe(SIGN_IN.errors.accountBlocked);
    expect(await s.auth.hasSession()).toBe(false);
  });

  test('02 로 돌아온 이유가 정지(reason=blocked)이면 처음부터 안내를 보인다', async () => {
    mockParams.reason = 'blocked';
    const tree = await renderScreen(setup().deps);
    expect(errorOf(tree, 'email')).toBe(SIGN_IN.errors.accountBlocked);
  });

  test('로그인 풀림(reason=session)이면 "로그인이 풀렸어요. 다시 로그인해 주세요." 를 보인다(분기 ⑦)', async () => {
    mockParams.reason = 'session';
    const tree = await renderScreen(setup().deps);
    expect(errorOf(tree, 'email')).toBe(COMMON.sessionLost);
  });
});

describe('15 인증 실패 화면(점검용): 02 의 인증번호 틀림 모양', () => {
  test('인증번호 칸이 오류 모양이고 아래에 문구가 있고 02:59 가 멈춰 있다', async () => {
    const tree = await mount(<SignInScreen preview="code-error" />);
    expect(errorOf(tree, 'code')).toBe('인증번호가 맞지 않아요. 다시 확인해 주세요.');
    expect(textOf(tree, 'signin-countdown')).toBe('02:59 뒤에 다시 받을 수 있어요');
    expect(must(tree, 'signin-email').props.value).toBe('hello@email.com');
    expect(must(tree, 'signin-code').props.value).toBe('123456');
    expect(has(tree, 'signin-birth')).toBe(false);
  });

  test('[확인]을 누르면 서버에 보내지 않고 02 처음 모양으로 간다(flow.ts: 15 → 02)', async () => {
    const tree = await mount(<SignInScreen preview="code-error" />);
    await press(tree, 'signin-confirm');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });
});

describe('뒤로가기 (K2 4장 02: 01 로 간다, 입력값과 인증 상태는 버린다)', () => {
  test('‹ 를 누르면 로그인 상태를 끊고 한 칸 뒤(01)로 간다', async () => {
    const s = setup();
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'new@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm'); // 인증 완료(생년월일 칸이 열림)
    expect(await s.auth.hasSession()).toBe(true);
    await press(tree, 'signin-header-back');
    expect(await s.auth.hasSession()).toBe(false);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockSetStage).toHaveBeenLastCalledWith(null);
    expect(find(tree, 'signin-birth')).toBeNull(); // 입력 상태도 처음으로
    expect(must(tree, 'signin-email').props.value).toBe('');
  });

  test('쌓인 화면이 없으면(앱을 다시 켜서 바로 02 가 열린 경우) 01 로 갈아 끼운다', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    const tree = await renderScreen(setup().deps);
    await press(tree, 'signin-header-back');
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('Android 뒤로가기도 같다(앱이 가로채서 ‹ 와 같은 일을 한다)', async () => {
    const s = setup();
    await renderScreen(s.deps);
    let handled: boolean | null | undefined;
    await act(async () => {
      handled = backHandlers[backHandlers.length - 1]();
    });
    await act(async () => {}); // 뒤로가기가 시작한 비동기 작업을 끝까지 기다린다
    expect(handled).toBe(true);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  test('03 에서 돌아와 02 가 다시 보일 때 로그인이 끊겨 있으면 이메일 입력부터 다시 시작한다', async () => {
    const s = setup();
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'new@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    expect(has(tree, 'signin-birth')).toBe(true);
    await s.auth.signOut(); // 03 의 뒤로가기가 로그인 상태를 끊었다
    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1](); // 02 가 다시 보이는 순간(focus)
    });
    await act(async () => {});
    expect(has(tree, 'signin-birth')).toBe(false);
    expect(must(tree, 'signin-email').props.value).toBe('');
    expect(must(tree, 'signin-email').props.disabled).toBe(false);
  });

  test('로그인이 살아 있으면(03 으로 가지 않고 02 에 머문 경우) 다시 보여도 입력 상태를 지우지 않는다', async () => {
    const s = setup();
    const tree = await renderScreen(s.deps);
    await sendAndEnterCode(tree, 'new@email.co', DEMO_OTP_CODE);
    await press(tree, 'signin-confirm');
    await act(async () => {
      mockFocusEffects[mockFocusEffects.length - 1]();
    });
    await act(async () => {});
    expect(has(tree, 'signin-birth')).toBe(true);
  });
});

describe('접근성 · 입력 힌트', () => {
  test('이메일 칸은 이메일 자판을, 인증번호 · 생년월일 칸은 숫자판을 연다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(must(tree, 'signin-email').props.keyboardType).toBe('email-address');
    expect(must(tree, 'signin-email').props.autoCapitalize).toBe('none');
    expect(must(tree, 'signin-code').props.keyboardType).toBe('number-pad');
    expect(must(tree, 'signin-code').props.maxLength).toBe(6);
  });

  test('입력 칸마다 스크린리더 이름이 있다', async () => {
    const tree = await renderScreen(setup().deps);
    expect(must(tree, 'signin-email').props.label).toBe(SIGN_IN.emailLabel);
    expect(must(tree, 'signin-code').props.label).toBe(SIGN_IN.codePlaceholder);
  });
});
