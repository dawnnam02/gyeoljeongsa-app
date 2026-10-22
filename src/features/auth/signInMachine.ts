// 02 가입 · 로그인 화면의 상태기계. 화면 · 서버 호출 없이 값만 바꾸는 순수 함수라서 시험으로 모든 길을 따라가 볼 수 있다.
//
//   email ──[인증번호 받기]──▶ sent ──[확인: 인증번호 맞음]──▶ verified ─┬─ 새 이메일 ─▶ 생년월일 칸 열림(needsBirth) ─[확인]─▶ 03
//     ▲                          │                                         ├─ 가입된 이메일 ─▶ 진행 단계대로 이동(2-3 표)
//     └── 이메일을 고치면 ◀────────┘                                         └─ 정지 · 탈퇴 ─▶ email(안내 문구)
//
//  · 인증번호는 보낸 뒤 3분 안에 입력한다. 3분이 지나면 '시간 지남' 오류가 나고 [인증번호 받기]가 다시 켜진다(K2 02, 정책 P3-03)
//  · 틀리면 인증번호 칸만 비우고 이메일은 남긴다. 5번 틀리면(서버가 알려 준다) 10분 동안 [인증번호 받기]를 막는다(K2 분기 ①)
//  · 오류 문구는 그 칸 아래에 보인다(error.field). 칸을 고치면 그 칸의 오류가 사라진다
import { EMAIL_MAX_LENGTH, isValidEmail } from '@/lib/emailRules';
import { OTP_LENGTH, secondsLeft } from '@/lib/otpClock';
import { BIRTH_DIGITS } from '@/lib/birthDate';

export type SignInPhase = 'email' | 'sent' | 'verified';
export type ErrorField = 'email' | 'code' | 'birth';

// 오류 종류. 화면 문구는 content/copy.ts 의 SIGN_IN.errors · COMMON 에서 고른다(errorCopyKey)
export type SignInErrorKey =
  | 'email-format' // N23
  | 'send-failed' // 발송 실패
  | 'too-many' // 횟수 초과(24시간 5번 · IP 한도 · 틀림 5번 잠금)
  | 'code-wrong' // 인증번호 틀림
  | 'code-expired' // 시간 지남
  | 'birth-format' // N02
  | 'underage' // 가입 나이(만 24세, D-100 · F22) 미만
  | 'email-unavailable' // 탈퇴 30일 · 가입 나이 미만 잠금 · 영구 정지 이메일(NK10)
  | 'account-blocked' // 정지된 계정(NK09)
  | 'network' // 인터넷 끊김(공통)
  | 'server' // 서버 문제(공통)
  | 'session-lost'; // 로그인 풀림(공통, 분기 ⑦)

export type SignInError = { readonly key: SignInErrorKey; readonly field: ErrorField };

export type SignInState = {
  readonly phase: SignInPhase;
  readonly email: string;
  readonly code: string; // 숫자 0~6자리
  readonly birth: string; // 숫자 0~8자리
  readonly needsBirth: boolean | null; // 인증을 마친 뒤: 새 이메일이라 생년월일이 필요하다(true) · 아직 모른다(null)
  readonly sentAt: number | null; // 인증번호를 보낸 시각(ms)
  readonly lockedUntil: number | null; // 틀려서 잠긴 때까지(ms). 이때까지 [인증번호 받기]를 막는다
  readonly busy: 'send' | 'verify' | 'birth' | null; // 서버에 요청하는 중(같은 버튼을 두 번 눌러도 한 번만 간다, R9)
  readonly error: SignInError | null;
};

export const initialSignIn: SignInState = {
  phase: 'email',
  email: '',
  code: '',
  birth: '',
  needsBirth: null,
  sentAt: null,
  lockedUntil: null,
  busy: null,
  error: null,
};

export type SignInAction =
  | { type: 'email'; value: string }
  | { type: 'code'; value: string }
  | { type: 'birth'; value: string }
  | { type: 'send-start' }
  | { type: 'send-ok'; now: number }
  | { type: 'send-fail'; error: SignInError }
  | { type: 'verify-start' }
  | { type: 'verify-fail'; error: SignInError; lockUntil?: number }
  | { type: 'verified' } // 인증번호가 맞았다(세션 저장됨). 이어서 진행 단계를 알아본다
  | { type: 'resolved-new' } // 새 이메일: 생년월일 칸이 열린다
  | { type: 'resolve-fail'; error: SignInError }
  | { type: 'birth-start' }
  | { type: 'birth-fail'; error: SignInError }
  | { type: 'idle' } // 요청이 끝났다(다른 화면으로 넘어가기 직전)
  | { type: 'expire' } // 3분이 지났다
  | { type: 'restore'; email: string } // 앱을 다시 켠 뒤 02 의 생년월일 칸이 바로 열린 상태(2-3 표)
  | { type: 'reset'; keepEmail?: boolean; error?: SignInError | null };

const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);
const clearFor = (state: SignInState, field: ErrorField): SignInError | null => (state.error?.field === field ? null : state.error);

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case 'email': {
      if (state.phase === 'verified' || state.busy) return state; // 인증을 마친 뒤에는 이메일을 고치지 않는다
      const email = action.value.slice(0, EMAIL_MAX_LENGTH);
      // 보낸 뒤 이메일을 고치면 보낸 인증번호는 쓸 수 없다: 처음 단계로 돌아가 다시 받게 한다
      if (state.phase === 'sent') return { ...state, phase: 'email', email, code: '', sentAt: null, error: null };
      return { ...state, email, error: clearFor(state, 'email') };
    }
    case 'code':
      if (state.phase !== 'sent' || state.busy) return state; // 발송 뒤에만 입력할 수 있다
      return { ...state, code: digits(action.value, OTP_LENGTH), error: clearFor(state, 'code') };
    case 'birth':
      if (state.phase !== 'verified' || state.needsBirth !== true || state.busy) return state;
      return { ...state, birth: digits(action.value, BIRTH_DIGITS), error: clearFor(state, 'birth') };
    case 'send-start':
      return { ...state, busy: 'send', error: null };
    case 'send-ok':
      return { ...state, phase: 'sent', sentAt: action.now, code: '', busy: null, error: null };
    case 'send-fail':
      return { ...state, busy: null, error: action.error };
    case 'verify-start':
      return { ...state, busy: 'verify', error: null };
    case 'verify-fail':
      // 틀리면 인증번호 칸만 비우고 이메일은 남긴다(분기 ①)
      return { ...state, busy: null, code: '', error: action.error, lockedUntil: action.lockUntil ?? state.lockedUntil };
    case 'verified':
      return { ...state, phase: 'verified', needsBirth: null, busy: 'verify', error: null };
    case 'resolved-new':
      return { ...state, needsBirth: true, birth: '', busy: null, error: null };
    case 'resolve-fail':
    case 'birth-fail':
      return { ...state, busy: null, error: action.error };
    case 'birth-start':
      return { ...state, busy: 'birth', error: null };
    case 'idle':
      return { ...state, busy: null };
    case 'expire':
      if (state.phase !== 'sent' || state.busy || state.error) return state;
      return { ...state, code: '', error: { key: 'code-expired', field: 'code' } };
    case 'restore':
      return { ...initialSignIn, phase: 'verified', email: action.email, needsBirth: true };
    case 'reset':
      return { ...initialSignIn, email: action.keepEmail ? state.email : '', error: action.error ?? null };
  }
}

// ── 화면이 묻는 것(지금 시각 now 는 ms) ───────────────────────────────

// 인증번호를 다시 받을 때까지 남은 초(보낸 뒤 3분). 보내지 않았거나 3분이 지났으면 0
export const remainingSeconds = (state: SignInState, now: number): number => (state.phase === 'sent' ? secondsLeft(state.sentAt, now) : 0);

export const isLocked = (state: SignInState, now: number): boolean => state.lockedUntil !== null && now < state.lockedUntil;

// [인증번호 받기]가 '기다리는 중'인가: 보낸 뒤 3분 · 틀려서 잠김 · 인증을 이미 마침 · 요청 중
export const sendWaiting = (state: SignInState, now: number): boolean =>
  state.busy !== null || state.phase === 'verified' || remainingSeconds(state, now) > 0 || isLocked(state, now);

// [인증번호 받기]가 흐린 모양인가(이메일 형식이 맞기 전에도 흐리다). 흐려도 누르면 이유 문구를 보인다(R7)
export const sendDimmed = (state: SignInState, now: number): boolean => !isValidEmail(state.email) || sendWaiting(state, now);

// [확인]이 눌릴 수 있는가: 발송 뒤에는 인증번호 6자리, 인증 뒤 새 이메일이면 생년월일 8자리까지(K2 02 입력 검증)
export function confirmEnabled(state: SignInState): boolean {
  if (state.busy !== null) return false;
  if (state.phase === 'sent') return state.code.length === OTP_LENGTH;
  if (state.phase === 'verified') return state.needsBirth === null || state.birth.length === BIRTH_DIGITS;
  return false;
}

export const showBirth = (state: SignInState): boolean => state.phase === 'verified' && state.needsBirth === true;
export const codeEditable = (state: SignInState): boolean => state.phase === 'sent' && state.busy === null;
export const emailEditable = (state: SignInState): boolean => state.phase !== 'verified' && state.busy === null;
export const errorOf = (state: SignInState, field: ErrorField): SignInErrorKey | null => (state.error?.field === field ? state.error.key : null);
