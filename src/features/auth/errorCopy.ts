// 02 오류 종류 → 화면 문구. 글은 content/copy.ts(카피.md 02 · 공통 문구 4장)에서만 가져온다.
import { COMMON, SIGN_IN } from '@/content/copy';

import type { SignInErrorKey } from './signInMachine';

const TEXT: Record<SignInErrorKey, string> = {
  'email-format': SIGN_IN.errors.emailFormat,
  'send-failed': SIGN_IN.errors.sendFailed,
  'too-many': SIGN_IN.errors.tooMany,
  'code-wrong': SIGN_IN.errors.codeWrong,
  'code-expired': SIGN_IN.errors.codeExpired,
  'birth-format': SIGN_IN.errors.birthFormat,
  underage: SIGN_IN.errors.underage,
  'email-unavailable': SIGN_IN.errors.emailUnavailable,
  'account-blocked': SIGN_IN.errors.accountBlocked,
  network: COMMON.offline,
  server: COMMON.server,
  'session-lost': COMMON.sessionLost,
};

export const errorText = (key: SignInErrorKey): string => TEXT[key];
