// 02 가입 · 로그인 OTP 상태기계(F1 통과 조건 2). 화면 없이 값만 따라가며 모든 길을 확인한다.
//   email ─(받기)→ sent ─(확인)→ verified ─ 새 이메일 → 생년월일 칸 → 03 / 가입된 이메일 → 진행 단계 / 정지 · 탈퇴 → email
import {
  codeEditable,
  confirmEnabled,
  emailEditable,
  errorOf,
  initialSignIn,
  isLocked,
  remainingSeconds,
  sendDimmed,
  sendWaiting,
  showBirth,
  signInReducer,
  type SignInAction,
  type SignInState,
} from '@/features/auth/signInMachine';

const NOW = 1_000_000;
const run = (actions: SignInAction[], from: SignInState = initialSignIn) => actions.reduce(signInReducer, from);
const sent = (email = 'a@b.co') => run([{ type: 'email', value: email }, { type: 'send-start' }, { type: 'send-ok', now: NOW }]);

describe('입력', () => {
  test('처음에는 이메일 단계이고, 인증번호 칸은 발송 뒤에만 입력할 수 있다', () => {
    expect(initialSignIn.phase).toBe('email');
    expect(codeEditable(initialSignIn)).toBe(false);
    expect(signInReducer(initialSignIn, { type: 'code', value: '123456' }).code).toBe('');
  });

  test('인증번호는 숫자만 6자리까지 받는다', () => {
    const s = signInReducer(sent(), { type: 'code', value: '12a3-456789' });
    expect(s.code).toBe('123456');
  });

  test('생년월일 칸은 새 이메일로 확인된 뒤에만 입력할 수 있고 숫자만 8자리까지 받는다', () => {
    expect(signInReducer(sent(), { type: 'birth', value: '19950312' }).birth).toBe('');
    const verified = run([{ type: 'code', value: '123456' }, { type: 'verify-start' }, { type: 'verified' }, { type: 'resolved-new' }], sent());
    expect(showBirth(verified)).toBe(true);
    expect(signInReducer(verified, { type: 'birth', value: '1995-03-12999' }).birth).toBe('19950312');
  });

  test('이메일을 고치면 오류가 사라진다', () => {
    const failed = run([{ type: 'email', value: 'x' }, { type: 'send-fail', error: { key: 'email-format', field: 'email' } }]);
    expect(errorOf(failed, 'email')).toBe('email-format');
    expect(errorOf(signInReducer(failed, { type: 'email', value: 'x@y.co' }), 'email')).toBeNull();
  });

  test('보낸 뒤 이메일을 고치면 인증번호 칸의 오류도 함께 사라진다(보낸 번호를 버리고 처음 단계로 돌아가므로)', () => {
    const s = run([{ type: 'code', value: '123456' }, { type: 'verify-start' }, { type: 'verify-fail', error: { key: 'code-wrong', field: 'code' } }], sent());
    expect(errorOf(s, 'code')).toBe('code-wrong');
    expect(errorOf(signInReducer(s, { type: 'email', value: 'new@y.co' }), 'code')).toBeNull();
  });
});

describe('발송 → 3분 안에 입력 (K2 02 · 정책 P3-03)', () => {
  test('받기를 누르면 요청 중 → 발송 성공: 단계가 sent 가 되고 인증번호 칸이 열린다', () => {
    const s0 = run([{ type: 'email', value: 'a@b.co' }, { type: 'send-start' }]);
    expect(s0.busy).toBe('send');
    const s1 = signInReducer(s0, { type: 'send-ok', now: NOW });
    expect(s1).toMatchObject({ phase: 'sent', busy: null, sentAt: NOW, error: null });
    expect(codeEditable(s1)).toBe(true);
  });

  test('남은 시간: 보낸 직후 180초 → 1초 뒤 179초 → 3분 뒤 0', () => {
    const s = sent();
    expect(remainingSeconds(s, NOW)).toBe(180);
    expect(remainingSeconds(s, NOW + 1000)).toBe(179);
    expect(remainingSeconds(s, NOW + 180_000)).toBe(0);
    expect(remainingSeconds(initialSignIn, NOW)).toBe(0);
  });

  test('[인증번호 받기]: 이메일 형식이 맞기 전에는 흐리다 · 3분 동안은 기다리는 중 · 0 이 되면 다시 켜진다', () => {
    expect(sendDimmed(initialSignIn, NOW)).toBe(true); // 이메일 없음
    const typed = signInReducer(initialSignIn, { type: 'email', value: 'a@b.co' });
    expect(sendDimmed(typed, NOW)).toBe(false);
    const s = sent();
    expect(sendWaiting(s, NOW + 1000)).toBe(true);
    expect(sendDimmed(s, NOW + 1000)).toBe(true);
    expect(sendWaiting(s, NOW + 180_000)).toBe(false); // 0 이 되면 다시 켜진다
    expect(sendDimmed(s, NOW + 180_000)).toBe(false);
  });

  test('요청 중에는 [인증번호 받기]가 기다리는 중이다(같은 버튼을 두 번 눌러도 요청은 한 번)', () => {
    const busy = run([{ type: 'email', value: 'a@b.co' }, { type: 'send-start' }]);
    expect(sendWaiting(busy, NOW)).toBe(true);
  });

  test('발송 뒤 이메일을 고치면 처음 단계로 돌아가 인증번호를 다시 받아야 한다', () => {
    const s = signInReducer(sent(), { type: 'email', value: 'other@b.co' });
    expect(s).toMatchObject({ phase: 'email', email: 'other@b.co', code: '', sentAt: null });
    expect(remainingSeconds(s, NOW)).toBe(0);
  });

  test('발송 실패 4종: 오류가 이메일 칸 아래에 남고 이메일은 그대로다', () => {
    for (const key of ['send-failed', 'too-many', 'network', 'server'] as const) {
      const s = run([{ type: 'email', value: 'a@b.co' }, { type: 'send-start' }, { type: 'send-fail', error: { key, field: 'email' } }]);
      expect(s).toMatchObject({ phase: 'email', email: 'a@b.co', busy: null });
      expect(errorOf(s, 'email')).toBe(key);
    }
  });
});

describe('확인: 오류 4종 (틀림 · 시간 지남 · 횟수 초과 · 발송 실패)', () => {
  test('[확인]은 인증번호 6자리가 차야 눌린다', () => {
    const s = sent();
    expect(confirmEnabled(s)).toBe(false);
    expect(confirmEnabled(signInReducer(s, { type: 'code', value: '12345' }))).toBe(false);
    expect(confirmEnabled(signInReducer(s, { type: 'code', value: '123456' }))).toBe(true);
    expect(confirmEnabled(initialSignIn)).toBe(false);
  });

  test('① 틀림: 인증번호 칸만 비우고 이메일은 남긴다', () => {
    const s = run([{ type: 'code', value: '000000' }, { type: 'verify-start' }, { type: 'verify-fail', error: { key: 'code-wrong', field: 'code' } }], sent('keep@me.co'));
    expect(s).toMatchObject({ phase: 'sent', email: 'keep@me.co', code: '', busy: null });
    expect(errorOf(s, 'code')).toBe('code-wrong');
  });

  test('② 시간 지남: 3분이 지나면 시간 지남 오류가 인증번호 칸 아래에 보인다', () => {
    const s = signInReducer(sent(), { type: 'expire' });
    expect(errorOf(s, 'code')).toBe('code-expired');
    expect(s.code).toBe('');
    expect(remainingSeconds(s, NOW + 180_000)).toBe(0);
  });

  test('시간 지남은 이미 다른 오류가 있거나 요청 중이면 덮어쓰지 않는다', () => {
    const wrong = run([{ type: 'verify-fail', error: { key: 'code-wrong', field: 'code' } }], sent());
    expect(signInReducer(wrong, { type: 'expire' })).toBe(wrong);
    const busy = signInReducer(sent(), { type: 'verify-start' });
    expect(signInReducer(busy, { type: 'expire' })).toBe(busy);
    expect(signInReducer(initialSignIn, { type: 'expire' })).toBe(initialSignIn); // 보낸 적 없음
  });

  test('③ 횟수 초과(5번 틀려 잠김): 오류와 함께 10분 동안 [인증번호 받기]를 막는다', () => {
    const lockUntil = NOW + 600_000;
    const s = run([{ type: 'code', value: '999999' }, { type: 'verify-start' }, { type: 'verify-fail', error: { key: 'too-many', field: 'code' }, lockUntil }], sent());
    expect(errorOf(s, 'code')).toBe('too-many');
    expect(isLocked(s, NOW + 1000)).toBe(true);
    expect(sendDimmed(s, NOW + 599_999)).toBe(true);
    expect(isLocked(s, lockUntil)).toBe(false);
    expect(sendDimmed(signInReducer(s, { type: 'email', value: 'a@b.co' }), lockUntil + 1)).toBe(false);
  });

  test('틀림 → 다시 입력하면 오류가 사라진다', () => {
    const wrong = run([{ type: 'verify-fail', error: { key: 'code-wrong', field: 'code' } }], sent());
    expect(errorOf(signInReducer(wrong, { type: 'code', value: '1' }), 'code')).toBeNull();
  });
});

describe('인증 뒤: 새 이메일 · 가입된 이메일 · 정지 · 탈퇴', () => {
  const verified = () => run([{ type: 'code', value: '123456' }, { type: 'verify-start' }, { type: 'verified' }], sent());

  test('인증번호가 맞으면 단계가 verified 가 되고 이메일 · 인증번호 칸은 잠긴다', () => {
    const s = verified();
    expect(s).toMatchObject({ phase: 'verified', needsBirth: null, busy: 'verify' });
    expect(emailEditable(s)).toBe(false);
    expect(codeEditable(s)).toBe(false);
    expect(signInReducer(s, { type: 'email', value: 'x@y.co' })).toBe(s);
    expect(sendWaiting(s, NOW)).toBe(true); // [인증번호 받기]도 더는 눌리지 않는다
  });

  test('새 이메일: 생년월일 칸이 열리고 [확인]은 8자리가 차야 눌린다', () => {
    const s = signInReducer(verified(), { type: 'resolved-new' });
    expect(showBirth(s)).toBe(true);
    expect(s.busy).toBeNull();
    expect(confirmEnabled(s)).toBe(false);
    expect(confirmEnabled(signInReducer(s, { type: 'birth', value: '1995031' }))).toBe(false);
    expect(confirmEnabled(signInReducer(s, { type: 'birth', value: '19950312' }))).toBe(true);
  });

  test('진행 단계를 알아보다 인터넷이 끊기면 [확인]을 다시 눌러 이어 갈 수 있다(번호는 다시 보내지 않는다)', () => {
    const s = run([{ type: 'resolve-fail', error: { key: 'network', field: 'code' } }], verified());
    expect(s).toMatchObject({ phase: 'verified', needsBirth: null, busy: null });
    expect(confirmEnabled(s)).toBe(true);
    expect(errorOf(s, 'code')).toBe('network');
  });

  test('정지 · 탈퇴 계정: 이메일 입력부터 다시, 이메일은 남기고 이유 문구만 이메일 칸 아래에 보인다', () => {
    const s = signInReducer(verified(), { type: 'reset', keepEmail: true, error: { key: 'email-unavailable', field: 'email' } });
    expect(s).toMatchObject({ phase: 'email', email: 'a@b.co', code: '', busy: null, sentAt: null });
    expect(errorOf(s, 'email')).toBe('email-unavailable');
  });

  test('앱을 다시 켠 뒤 생년월일 칸이 바로 열린다(2-3 표: 이메일 인증만 끝나고 생년월일 없음)', () => {
    const s = signInReducer(initialSignIn, { type: 'restore', email: 'a@b.co' });
    expect(s).toMatchObject({ phase: 'verified', email: 'a@b.co', needsBirth: true });
    expect(showBirth(s)).toBe(true);
  });
});

describe('생년월일 오류와 뒤로가기', () => {
  const birthStep = () => run([{ type: 'resolved-new' }, { type: 'birth', value: '20100101' }], run([{ type: 'verified' }], sent()));

  test('만 19세 미만 · 날짜 모양 · 가입 불가 이메일 오류는 생년월일 칸 아래에 보이고 입력은 남는다', () => {
    for (const key of ['underage', 'birth-format', 'email-unavailable'] as const) {
      const s = run([{ type: 'birth-start' }, { type: 'birth-fail', error: { key, field: 'birth' } }], birthStep());
      expect(errorOf(s, 'birth')).toBe(key);
      expect(s.birth).toBe('20100101');
      expect(s.busy).toBeNull();
    }
  });

  test('생년월일을 고치면 오류가 사라진다', () => {
    const s = run([{ type: 'birth-fail', error: { key: 'underage', field: 'birth' } }, { type: 'birth', value: '19950312' }], birthStep());
    expect(errorOf(s, 'birth')).toBeNull();
  });

  test('뒤로가기: 입력값과 인증 상태를 모두 버린다(생년월일 칸이 열린 뒤에도 같다)', () => {
    expect(signInReducer(birthStep(), { type: 'reset' })).toEqual(initialSignIn);
    expect(signInReducer(sent(), { type: 'reset' })).toEqual(initialSignIn);
  });
});
