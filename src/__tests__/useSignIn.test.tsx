// 02 가입 · 로그인의 동작(useSignIn): 상태기계 + 모의 서버 + 시계. 입력부터 03 으로 넘어가기까지 사람이 하는 순서대로 따라간다.
// 시계는 가짜 타이머로 움직인다(3분을 실제로 기다리지 않는다).
import { act, create } from 'react-test-renderer';

import { useSignIn, type SignInDeps, type SignInOptions } from '@/features/auth/useSignIn';
import { createAuthApi } from '@/lib/authApi';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { loadProgressStage, type StageResult } from '@/lib/progress';
import type { ProgressStage } from '@/types/account';

type Ui = ReturnType<typeof useSignIn>;

// 훅이 돌려준 값을 시험이 읽을 수 있게 그릴 때마다 onUi 로 내보낸다
function Harness({ deps, options, onUi }: { deps: SignInDeps; options?: SignInOptions; onUi: (ui: Ui) => void }) {
  onUi(useSignIn(deps, options));
  return null;
}

// 2026-10-14 12:00 KST
const START = Date.UTC(2026, 9, 14, 3, 0, 0);

function mount(overrides: Partial<SignInDeps> = {}, options?: SignInOptions) {
  const backend = createDemoBackend({ now: () => Date.now() });
  const client = createDemoClient(backend);
  const stages: ProgressStage[] = [];
  const passed = jest.fn();
  const deps: SignInDeps = {
    auth: createAuthApi(client),
    loadStage: () => loadProgressStage(client),
    now: () => Date.now(),
    onStage: (stage) => void stages.push(stage),
    onBirthPassed: passed,
    ...overrides,
  };
  const sink: { ui: Ui | null } = { ui: null };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <Harness
        deps={deps}
        options={options}
        onUi={(value) => {
          sink.ui = value;
        }}
      />,
    );
  });
  const ui = () => sink.ui as Ui;
  return { ui, deps, stages, passed, client, backend, tree };
}

// 비동기 작업(서버 호출)이 모두 끝날 때까지 기다린다
const flush = () => act(async () => {});
const press = async (fn: () => Promise<void>) => {
  await act(async () => {
    await fn();
  });
};
const type = (m: ReturnType<typeof mount>, field: 'setEmail' | 'setCode' | 'setBirth', value: string) => act(() => m.ui()[field](value));

beforeEach(() => {
  jest.useFakeTimers({ now: START });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('이메일 → 인증번호 받기', () => {
  test('이메일 형식이 맞기 전에는 흐리고, 누르면 이유 문구(N23)가 이메일 칸 아래에 보인다', async () => {
    const m = mount();
    type(m, 'setEmail', 'abc');
    expect(m.ui().sendDimmed).toBe(true);
    await press(m.ui().pressSend);
    expect(m.ui().errorOf('email')).toBe('email-format');
    expect(m.ui().state.phase).toBe('email');
  });

  test('받기를 누르면 인증번호 칸이 열리고 3분 시계가 시작한다(03:00)', async () => {
    const m = mount();
    type(m, 'setEmail', 'hello@email.com');
    expect(m.ui().sendDimmed).toBe(false);
    await press(m.ui().pressSend);
    expect(m.ui().state.phase).toBe('sent');
    expect(m.ui().remaining).toBe(180);
    expect(m.ui().sendDimmed).toBe(true); // 다시 받을 수 있을 때까지 흐리다
  });

  test('1초마다 남은 시간이 줄어든다(02:59 → 02:58)', async () => {
    const m = mount();
    type(m, 'setEmail', 'hello@email.com');
    await press(m.ui().pressSend);
    act(() => jest.advanceTimersByTime(1000));
    expect(m.ui().remaining).toBe(179);
    act(() => jest.advanceTimersByTime(1000));
    expect(m.ui().remaining).toBe(178);
  });

  test('같은 버튼을 두 번 눌러도 서버 요청은 한 번이다(R9)', async () => {
    let calls = 0;
    const slow = {
      sendCode: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { ok: true } as const;
      },
    };
    const m = mount({ auth: { ...createAuthApi(createDemoClient()), ...slow } });
    type(m, 'setEmail', 'hello@email.com');
    await act(async () => {
      const first = m.ui().pressSend();
      const second = m.ui().pressSend();
      jest.advanceTimersByTime(600);
      await Promise.all([first, second]);
    });
    expect(calls).toBe(1);
  });

  test.each([
    ['send-failed', 'fail@email.com'], // 발송 실패
  ])('발송 실패(%s)는 이메일 칸 아래에 문구가 보이고 이메일은 남는다', async (key, email) => {
    const m = mount();
    type(m, 'setEmail', email);
    await press(m.ui().pressSend);
    expect(m.ui().errorOf('email')).toBe(key);
    expect(m.ui().state.email).toBe(email);
    expect(m.ui().state.phase).toBe('email');
  });

  test('보내기 전에는 인증번호를 입력할 수 없다', async () => {
    const m = mount();
    type(m, 'setCode', '123456');
    expect(m.ui().state.code).toBe('');
  });
});

describe('인증번호 입력 → 확인', () => {
  const sendTo = async (m: ReturnType<typeof mount>, email = 'new@email.co') => {
    type(m, 'setEmail', email);
    await press(m.ui().pressSend);
  };

  test('틀리면 인증번호 칸만 비우고 오류가 보인다(이메일 유지) — 15 인증 실패 모양', async () => {
    const m = mount();
    await sendTo(m);
    type(m, 'setCode', '000000');
    expect(m.ui().confirmEnabled).toBe(true);
    await press(m.ui().pressConfirm);
    expect(m.ui().errorOf('code')).toBe('code-wrong');
    expect(m.ui().state).toMatchObject({ phase: 'sent', email: 'new@email.co', code: '' });
  });

  test('3분이 지나면 시간 지남 오류가 인증번호 칸 아래에 보이고 [인증번호 받기]가 다시 켜진다', async () => {
    const m = mount();
    await sendTo(m);
    act(() => jest.advanceTimersByTime(180_000));
    expect(m.ui().remaining).toBe(0);
    expect(m.ui().errorOf('code')).toBe('code-expired');
    expect(m.ui().sendDimmed).toBe(false);
    // 다시 받으면 시계가 다시 시작하고 오류가 사라진다
    await press(m.ui().pressSend);
    expect(m.ui().state.phase).toBe('sent');
    expect(m.ui().errorOf('code')).toBeNull();
    expect(m.ui().remaining).toBe(180);
  });

  test('3분이 지난 번호로 [확인]을 눌러도 서버에 보내지 않는다(틀린 횟수에 세지 않는다)', async () => {
    const m = mount();
    await sendTo(m);
    type(m, 'setCode', DEMO_OTP_CODE);
    const verify = jest.spyOn(m.deps.auth, 'verifyCode');
    act(() => jest.advanceTimersByTime(181_000));
    await press(m.ui().pressConfirm);
    expect(verify).not.toHaveBeenCalled();
    expect(m.ui().errorOf('code')).toBe('code-expired');
  });

  test('5번 틀리면 횟수 초과 오류가 나고 10분 동안 [인증번호 받기]가 막힌다', async () => {
    const m = mount();
    await sendTo(m);
    for (let i = 0; i < 5; i += 1) {
      type(m, 'setCode', '111111');
      await press(m.ui().pressConfirm);
    }
    expect(m.ui().errorOf('code')).toBe('too-many');
    act(() => jest.advanceTimersByTime(181_000)); // 3분이 지나도(보낸 시계가 끝나도) 잠금이 남아 있다
    expect(m.ui().sendDimmed).toBe(true);
    await press(m.ui().pressSend);
    expect(m.ui().errorOf('email')).toBe('too-many'); // 눌러도 보내지 않고 이유를 보인다
    act(() => jest.advanceTimersByTime(10 * 60_000));
    expect(m.ui().sendDimmed).toBe(false);
  });
});

describe('새 이메일: 생년월일 → 만 19세 판정 → 03', () => {
  const toBirth = async (m: ReturnType<typeof mount>) => {
    type(m, 'setEmail', 'new@email.co');
    await press(m.ui().pressSend);
    type(m, 'setCode', DEMO_OTP_CODE);
    await press(m.ui().pressConfirm);
  };

  test('인증번호가 맞으면 새 이메일이라 생년월일 칸이 열리고, 8자리가 차야 [확인]이 눌린다', async () => {
    const m = mount();
    await toBirth(m);
    expect(m.ui().state.phase).toBe('verified');
    expect(m.ui().showBirth).toBe(true);
    expect(m.ui().confirmEnabled).toBe(false);
    type(m, 'setBirth', '1995031');
    expect(m.ui().confirmEnabled).toBe(false);
    type(m, 'setBirth', '19950312');
    expect(m.ui().confirmEnabled).toBe(true);
    expect(m.stages).toEqual([]); // 아직 어디로도 가지 않았다
  });

  test('만 19세 통과: A01 을 저장하고 03 으로 간다', async () => {
    const m = mount();
    await toBirth(m);
    type(m, 'setBirth', '19950312');
    await press(m.ui().pressConfirm);
    expect(m.passed).toHaveBeenCalledTimes(1);
    expect(m.backend.peek.birthDate('new@email.co')).toBe('1995-03-12');
  });

  // F22: 가입 나이 만 24세(D-100 · K20 5장) — 경계 날짜를 24년으로 옮겼다
  test('경계: 만 24세 생일 당일은 통과한다(2002-10-14)', async () => {
    const m = mount();
    await toBirth(m);
    type(m, 'setBirth', '20021014');
    await press(m.ui().pressConfirm);
    expect(m.passed).toHaveBeenCalledTimes(1);
  });

  test('경계: 생일 하루 전(2002-10-15)은 가입 나이 미달(underage) 오류가 생년월일 칸 아래에 보이고 03 으로 가지 않는다', async () => {
    const m = mount();
    await toBirth(m);
    type(m, 'setBirth', '20021015');
    await press(m.ui().pressConfirm);
    expect(m.ui().errorOf('birth')).toBe('underage');
    expect(m.passed).not.toHaveBeenCalled();
    expect(m.backend.peek.birthDate('new@email.co')).toBeNull(); // 저장하지 않는다
    expect(m.ui().state.birth).toBe('20021015'); // 입력은 남는다
  });

  test('없는 날짜 · 1950 이전 · 미래는 생년월일 형식 오류(N02)이고 서버에 보내지 않는다', async () => {
    const m = mount();
    await toBirth(m);
    const check = jest.spyOn(m.deps.auth, 'checkBirth');
    for (const bad of ['19950230', '19491231', '20261015', '20991231']) {
      type(m, 'setBirth', bad);
      await press(m.ui().pressConfirm);
      expect(m.ui().errorOf('birth')).toBe('birth-format');
    }
    expect(check).not.toHaveBeenCalled();
    expect(m.passed).not.toHaveBeenCalled();
  });

  test('날짜를 바꿔 다시 시도하면 통과한다(1번째 · 2번째 거절은 바로 다시 입력할 수 있다)', async () => {
    const m = mount();
    await toBirth(m);
    type(m, 'setBirth', '20150101');
    await press(m.ui().pressConfirm);
    expect(m.ui().errorOf('birth')).toBe('underage');
    type(m, 'setBirth', '19950312');
    expect(m.ui().errorOf('birth')).toBeNull();
    await press(m.ui().pressConfirm);
    expect(m.passed).toHaveBeenCalledTimes(1);
  });

  test('3번 거절되면 30일 잠금: 다음부터는 이유를 밝히지 않는 가입 불가 문구(NK10)다', async () => {
    const m = mount();
    await toBirth(m);
    for (const birth of ['20150101', '20150102', '20150103']) {
      type(m, 'setBirth', birth);
      await press(m.ui().pressConfirm);
      expect(m.ui().errorOf('birth')).toBe('underage');
    }
    type(m, 'setBirth', '19950312');
    await press(m.ui().pressConfirm);
    expect(m.ui().errorOf('birth')).toBe('email-unavailable');
    expect(m.passed).not.toHaveBeenCalled();
  });
});

describe('가입된 이메일 · 정지 · 탈퇴 · 인터넷 끊김', () => {
  const stageDeps = (stage: StageResult): Partial<SignInDeps> => ({ loadStage: async () => stage });
  const login = async (m: ReturnType<typeof mount>) => {
    type(m, 'setEmail', 'old@email.co');
    await press(m.ui().pressSend);
    type(m, 'setCode', DEMO_OTP_CODE);
    await press(m.ui().pressConfirm);
  };

  test.each<ProgressStage>(['birthdate-passed', 'consent-changed', 'consented', 'survey-complete', 'traits-confirmed'])(
    '가입된 이메일이면 진행 단계(%s)대로 이동하고 생년월일 칸은 열리지 않는다',
    async (stage) => {
      const m = mount(stageDeps({ ok: true, stage }));
      await login(m);
      expect(m.stages).toEqual([stage]);
      expect(m.ui().showBirth).toBe(false);
    },
  );

  test('정지된 계정: 로그인을 끊고 이메일 입력부터 다시, 이유 문구(NK09)를 이메일 칸 아래에 보인다', async () => {
    const m = mount(stageDeps({ ok: true, stage: 'blocked' }));
    await login(m);
    expect(m.ui().state).toMatchObject({ phase: 'email', email: 'old@email.co', code: '' });
    expect(m.ui().errorOf('email')).toBe('account-blocked');
    expect(await m.deps.auth.hasSession()).toBe(false);
    expect(m.stages).toEqual([]);
  });

  test('탈퇴한 이메일: 로그인을 끊고 가입 불가 문구(NK10)를 보인다', async () => {
    const m = mount(stageDeps({ ok: true, stage: 'withdrawn' }));
    await login(m);
    expect(m.ui().errorOf('email')).toBe('email-unavailable');
    expect(await m.deps.auth.hasSession()).toBe(false);
  });

  test('인증번호는 맞았는데 진행 단계를 알아보다 인터넷이 끊기면: 번호를 다시 보내지 않고 [확인]을 다시 눌러 이어 간다', async () => {
    let calls = 0;
    const m = mount({
      loadStage: async () => {
        calls += 1;
        return calls === 1 ? { ok: false, reason: 'network' } : { ok: true, stage: 'consented' };
      },
    });
    await login(m);
    expect(m.ui().errorOf('code')).toBe('network');
    expect(m.ui().state.phase).toBe('verified');
    expect(m.ui().confirmEnabled).toBe(true);
    const verify = jest.spyOn(m.deps.auth, 'verifyCode');
    await press(m.ui().pressConfirm);
    expect(verify).not.toHaveBeenCalled(); // 이미 쓴 번호를 다시 보내지 않는다
    expect(m.stages).toEqual(['consented']);
  });

  test('인증번호를 확인하다 서버가 닿지 않으면: 인증번호 칸 아래에 공통 문구가 보이고 이메일은 남는다', async () => {
    const m = mount();
    type(m, 'setEmail', 'old@email.co');
    await press(m.ui().pressSend);
    type(m, 'setCode', DEMO_OTP_CODE);
    jest.spyOn(m.deps.auth, 'verifyCode').mockResolvedValue({ ok: false, reason: 'network' });
    await press(m.ui().pressConfirm);
    expect(m.ui().errorOf('code')).toBe('network');
    expect(m.ui().state.email).toBe('old@email.co');
  });
});

describe('뒤로가기 · 다시 돌아왔을 때 · 다시 켰을 때', () => {
  test('뒤로가기: 입력값과 인증 상태를 버리고 로그인 상태를 끊는다(생년월일 칸이 열린 뒤에도 같다)', async () => {
    const m = mount();
    type(m, 'setEmail', 'new@email.co');
    await press(m.ui().pressSend);
    type(m, 'setCode', DEMO_OTP_CODE);
    await press(m.ui().pressConfirm);
    type(m, 'setBirth', '1995');
    expect(await m.deps.auth.hasSession()).toBe(true);
    await press(m.ui().discard);
    expect(m.ui().state).toMatchObject({ phase: 'email', email: '', code: '', birth: '', sentAt: null });
    expect(await m.deps.auth.hasSession()).toBe(false);
  });

  test('03 에서 돌아왔을 때 로그인이 끊겨 있으면 이메일 입력부터 다시 시작한다', async () => {
    const m = mount();
    type(m, 'setEmail', 'new@email.co');
    await press(m.ui().pressSend);
    type(m, 'setCode', DEMO_OTP_CODE);
    await press(m.ui().pressConfirm);
    await m.deps.auth.signOut(); // 03 의 뒤로가기가 로그인 상태를 끊었다
    await press(m.ui().syncSession);
    expect(m.ui().state).toMatchObject({ phase: 'email', email: '' });
  });

  test('앱을 다시 켠 뒤(이메일 인증만 끝나고 생년월일 없음): 생년월일 칸이 바로 열린다', async () => {
    const m0 = mount();
    type(m0, 'setEmail', 'half@email.co');
    await press(m0.ui().pressSend);
    type(m0, 'setCode', DEMO_OTP_CODE);
    await press(m0.ui().pressConfirm);
    // 같은 서버 · 같은 로그인으로 02 를 새로 연다
    const m = mount({ auth: m0.deps.auth, loadStage: m0.deps.loadStage }, { restore: true });
    await flush();
    expect(m.ui().state).toMatchObject({ phase: 'verified', email: 'half@email.co', needsBirth: true });
    expect(m.ui().showBirth).toBe(true);
  });
});
