// 02 가입 · 로그인 화면의 동작: 상태기계(signInMachine) + 서버 호출 + 1초 시계.
// 서버 호출과 화면 이동은 deps 로 받는다(화면 시험 · 데모 모드에서 같은 코드가 돈다). 개인정보(이메일 · 인증번호 · 생년월일)는 로그에 남기지 않는다.
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';

import type { AuthApi, SendFailure, VerifyFailure, BirthFailure, SaveFailure } from '@/lib/authApi';
import { checkBirthShape, kstToday } from '@/lib/birthDate';
import { isValidEmail } from '@/lib/emailRules';
import { OTP_LENGTH, OTP_LOCK_SECONDS, secondsLeft } from '@/lib/otpClock';
import type { StageResult } from '@/lib/progress';
import type { ProgressStage } from '@/types/account';

import {
  confirmEnabled,
  errorOf,
  initialSignIn,
  isLocked,
  remainingSeconds,
  sendDimmed,
  sendWaiting,
  showBirth,
  signInReducer,
  type ErrorField,
  type SignInError,
  type SignInErrorKey,
  type SignInState,
} from './signInMachine';

export type SignInDeps = {
  auth: Pick<AuthApi, 'sendCode' | 'verifyCode' | 'checkBirth' | 'saveBirth' | 'signOut' | 'sessionEmail' | 'hasSession'>;
  loadStage: () => Promise<StageResult>;
  now: () => number;
  onStage: (stage: ProgressStage) => void; // 가입된 이메일: 진행 단계대로 이동(2-3 표)
  onBirthPassed: () => void; // 새 이메일 + 만 19세 통과: 03 으로
};

export type SignInOptions = {
  restore?: boolean; // 앱을 다시 켠 뒤 생년월일 칸이 바로 열린다(2-3 표 '이메일 인증만 끝나고 생년월일 없음')
  initial?: SignInState; // 화면 점검용 처음 상태(15 인증 실패)
};

const SEND_KEY: Record<SendFailure, SignInErrorKey> = {
  'invalid-email': 'email-format',
  'send-failed': 'send-failed',
  'too-many': 'too-many',
  network: 'network',
  server: 'server',
};
const VERIFY_KEY: Record<VerifyFailure, SignInErrorKey> = { wrong: 'code-wrong', locked: 'too-many', network: 'network', server: 'server' };
const BIRTH_KEY: Record<BirthFailure | SaveFailure, SignInErrorKey> = {
  underage: 'underage',
  blocked: 'email-unavailable',
  format: 'birth-format',
  session: 'session-lost',
  network: 'network',
  server: 'server',
};

const err = (key: SignInErrorKey, field: ErrorField): SignInError => ({ key, field });

export function useSignIn(deps: SignInDeps, options: SignInOptions = {}) {
  const [state, dispatch] = useReducer(signInReducer, options.initial ?? initialSignIn);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  // 비동기 작업이 끝난 뒤에도 '지금' 값을 읽으려고 refs 에 둔다(그리는 도중이 아니라 그린 직후에 맞춘다)
  const stateRef = useRef(state);
  const depsRef = useRef(deps);
  useLayoutEffect(() => {
    stateRef.current = state;
    depsRef.current = deps;
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // 요청이 끝나기 전에 같은 버튼이 다시 눌려도 요청은 한 번만 간다(R9). 상태(state.busy)는 다음 그리기에서야 바뀌므로 연달아 눌린 두 번을 이 표지가 막는다
  const inFlight = useRef(false);

  const now = deps.now();
  const remaining = remainingSeconds(state, now);

  // 1초 시계: 남은 시간 · 잠금이 화면에 보이는 동안만 돈다
  const ticking = state.phase === 'sent' || state.lockedUntil !== null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => forceRender(), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  // 3분이 지나면 '시간 지남' 오류를 보인다(이미 다른 오류가 있거나 요청 중이면 건드리지 않는다)
  useEffect(() => {
    if (state.phase === 'sent' && remaining === 0 && !state.error && !state.busy) dispatch({ type: 'expire' });
  }, [state.phase, state.error, state.busy, remaining]);

  // 앱을 다시 켠 뒤: 이미 로그인한 이메일로 생년월일 칸을 바로 연다
  useEffect(() => {
    if (!options.restore) return;
    void (async () => {
      const email = await depsRef.current.auth.sessionEmail();
      if (email && alive.current) dispatch({ type: 'restore', email });
    })();
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 인증을 마친 뒤 이어서: 진행 단계를 서버에서 읽어 새 이메일이면 생년월일 칸을 열고, 가입된 이메일이면 그 단계로 간다
  const resolve = useCallback(async () => {
    const d = depsRef.current;
    const result = await d.loadStage();
    if (!alive.current) return;
    if (!result.ok) {
      dispatch({ type: 'resolve-fail', error: err(result.reason, stateRef.current.needsBirth ? 'birth' : 'code') });
      return;
    }
    switch (result.stage) {
      case 'email-verified':
        dispatch({ type: 'resolved-new' });
        return;
      case 'blocked':
      case 'withdrawn':
        await d.auth.signOut(); // 이용할 수 없는 계정: 로그인 상태를 끊고 이메일 입력부터 다시. 이유는 밝히지 않는다(NK09 · NK10)
        if (alive.current) dispatch({ type: 'reset', keepEmail: true, error: err(result.stage === 'blocked' ? 'account-blocked' : 'email-unavailable', 'email') });
        return;
      default:
        dispatch({ type: 'idle' });
        d.onStage(result.stage);
    }
  }, []);

  const submitBirth = useCallback(async () => {
    const d = depsRef.current;
    const s = stateRef.current;
    const shape = checkBirthShape(s.birth, kstToday(d.now()));
    if (shape.result !== 'ok' || !shape.iso) {
      dispatch({ type: 'birth-fail', error: err('birth-format', 'birth') });
      return;
    }
    dispatch({ type: 'birth-start' });
    const checked = await d.auth.checkBirth(shape.iso);
    if (!alive.current) return;
    if (!checked.ok) {
      if (checked.reason === 'session') await d.auth.signOut();
      dispatch(checked.reason === 'session' ? { type: 'reset', keepEmail: true, error: err('session-lost', 'email') } : { type: 'birth-fail', error: err(BIRTH_KEY[checked.reason], 'birth') });
      return;
    }
    const saved = await d.auth.saveBirth(shape.iso);
    if (!alive.current) return;
    if (!saved.ok) {
      if (saved.reason === 'session') await d.auth.signOut();
      dispatch(saved.reason === 'session' ? { type: 'reset', keepEmail: true, error: err('session-lost', 'email') } : { type: 'birth-fail', error: err(BIRTH_KEY[saved.reason], 'birth') });
      return;
    }
    dispatch({ type: 'idle' });
    d.onBirthPassed();
  }, []);

  const runSend = useCallback(async () => {
    const d = depsRef.current;
    const s = stateRef.current;
    if (s.busy || s.phase === 'verified') return; // 같은 버튼을 두 번 눌러도 요청은 한 번만 간다(R9)
    const t = d.now();
    if (!isValidEmail(s.email)) {
      dispatch({ type: 'send-fail', error: err('email-format', 'email') }); // 흐린 모양으로 눌렸을 때 이유 문구(R7)
      return;
    }
    if (isLocked(s, t)) {
      dispatch({ type: 'send-fail', error: err('too-many', 'email') });
      return;
    }
    if (secondsLeft(s.sentAt, t) > 0) return; // 다시 받을 수 있을 때까지는 아무 일도 하지 않는다(남은 시간이 이미 보인다)
    dispatch({ type: 'send-start' });
    const sent = await d.auth.sendCode(s.email);
    if (!alive.current) return;
    if (sent.ok) dispatch({ type: 'send-ok', now: d.now() });
    else dispatch({ type: 'send-fail', error: err(SEND_KEY[sent.reason], 'email') });
  }, []);

  const pressSend = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await runSend();
    } finally {
      inFlight.current = false;
    }
  }, [runSend]);

  const runConfirm = useCallback(async () => {
    const d = depsRef.current;
    const s = stateRef.current;
    if (s.busy) return;
    if (s.phase === 'sent') {
      if (s.code.length !== OTP_LENGTH) return;
      if (secondsLeft(s.sentAt, d.now()) === 0) {
        dispatch({ type: 'expire' }); // 3분이 지난 번호는 서버에 보내지 않는다(틀린 횟수에 세지 않는다)
        return;
      }
      dispatch({ type: 'verify-start' });
      const verified = await d.auth.verifyCode(s.email, s.code);
      if (!alive.current) return;
      if (!verified.ok) {
        const lockUntil = verified.reason === 'locked' ? d.now() + OTP_LOCK_SECONDS * 1000 : undefined;
        dispatch({ type: 'verify-fail', error: err(VERIFY_KEY[verified.reason], 'code'), lockUntil });
        return;
      }
      dispatch({ type: 'verified' });
      await resolve();
      return;
    }
    if (s.phase === 'verified') {
      if (s.needsBirth === null) {
        dispatch({ type: 'verified' }); // 진행 단계를 다시 읽는다(인터넷이 끊겨 단계를 알지 못한 채 남은 경우)
        await resolve();
      } else {
        await submitBirth();
      }
    }
  }, [resolve, submitBirth]);

  const pressConfirm = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await runConfirm();
    } finally {
      inFlight.current = false;
    }
  }, [runConfirm]);

  // 뒤로 갈 때: 입력값과 인증 상태를 버린다(확인창 없음, K2 02 뒤로가기). 로그인 상태도 끊는다.
  const discard = useCallback(async () => {
    await depsRef.current.auth.signOut();
    if (alive.current) dispatch({ type: 'reset' });
  }, []);

  // 03 에서 돌아왔을 때: 로그인이 끊겼다면 이메일 입력부터 다시 시작한다(K2 03 뒤로가기)
  const syncSession = useCallback(async () => {
    if (stateRef.current.phase !== 'verified') return;
    const has = await depsRef.current.auth.hasSession();
    if (!has && alive.current) dispatch({ type: 'reset' });
  }, []);

  return {
    state,
    now,
    remaining,
    sendDimmed: sendDimmed(state, now),
    sendWaiting: sendWaiting(state, now),
    confirmEnabled: confirmEnabled(state),
    showBirth: showBirth(state),
    errorOf: (field: ErrorField) => errorOf(state, field),
    setEmail: useCallback((value: string) => dispatch({ type: 'email', value }), []),
    setCode: useCallback((value: string) => dispatch({ type: 'code', value }), []),
    setBirth: useCallback((value: string) => dispatch({ type: 'birth', value }), []),
    pressSend,
    pressConfirm,
    discard,
    syncSession,
  };
}
