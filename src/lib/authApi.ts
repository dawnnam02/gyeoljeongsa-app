// 02 가입 · 로그인이 서버와 주고받는 일(이메일 인증번호 · 생년월일 확인). 결정 D-3(이메일 OTP 6자리) · D-23 BD-2(6자리 + 관문).
//
// 앱은 Supabase Auth 의 /otp · /verify 를 직접 부르지 않고 서버 함수 otp-gate 를 거친다(backend/스키마.md 9-7 · 보안/구성.md 3장):
//   같은 이메일 24시간 5번 · 60초 간격 · IP 시간당 20번 발송 한도와 5번 틀리면 10분 잠금은 이 관문에만 있다.
//   signInWithOtp 를 직접 부르면 이 한도를 건너뛴다(보안/구성.md 3-3 · 설정.md 0장 2번).
//   otp-gate  POST { action: 'send', email }  /  { action: 'verify', email, token }  → 성공하면 세션 토큰만 돌려준다
//   underage-reject  POST { birth_date }  (로그인한 세션) → 200 { ok } · 403 { code: 'underage' | 'blocked' } · 400 { code: 'invalid_birth_date' }
//   save_answers(RPC)  { A01: 'YYYY-MM-DD' } → 통과한 생년월일을 A01 답으로 저장
// 로그에는 이벤트 이름과 오류 코드만 남긴다(이메일 · 인증번호 · 생년월일 · 토큰 금지).
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeEmail } from './emailRules';
import { safeLog } from './log';
import { readDbFailure, readFunctionFailure, type Failure } from './serverError';

export type SendFailure = 'invalid-email' | 'send-failed' | 'too-many' | 'network' | 'server';
export type VerifyFailure = 'wrong' | 'locked' | 'network' | 'server';
export type BirthFailure = 'underage' | 'blocked' | 'format' | 'session' | 'network' | 'server';
export type SaveFailure = 'session' | 'network' | 'server';
export type Outcome<F extends string> = { readonly ok: true } | { readonly ok: false; readonly reason: F };

const TOO_MANY = new Set(['rate_limited', 'locked', 'daily_limit', 'too_soon']);

function mapSend(f: Failure): SendFailure {
  if (f.network) return 'network';
  if (f.code && TOO_MANY.has(f.code)) return 'too-many';
  if (f.status === 429) return 'too-many';
  if (f.code === 'invalid_email') return 'invalid-email';
  if (f.code === 'send_failed') return 'send-failed';
  return 'server';
}

function mapVerify(f: Failure): VerifyFailure {
  if (f.network) return 'network';
  if (f.code === 'invalid_token') return 'wrong'; // 틀렸는지 · 시간이 지났는지 · 가입한 적이 없는지 서버가 구분하지 않는다
  if (f.code === 'locked' || f.status === 429) return 'locked';
  return 'server';
}

function mapBirth(f: Failure): BirthFailure {
  if (f.network) return 'network';
  if (f.code === 'underage') return 'underage';
  if (f.code === 'blocked') return 'blocked'; // 탈퇴 30일 · 영구 정지 · 만 19세 미만 잠금: 이유를 밝히지 않는다(NK10)
  if (f.code === 'invalid_birth_date') return 'format';
  if (f.status === 401) return 'session';
  return 'server';
}

export function createAuthApi(client: SupabaseClient) {
  return {
    // 인증번호 발송. 가입 여부와 관계없이 같은 응답이다.
    async sendCode(email: string): Promise<Outcome<SendFailure>> {
      const { data, error } = await client.functions.invoke('otp-gate', { body: { action: 'send', email: normalizeEmail(email) } });
      if (error) {
        const reason = mapSend(await readFunctionFailure(error));
        safeLog({ event: 'otp.send.fail', code: reason });
        return { ok: false, reason };
      }
      if ((data as { ok?: unknown } | null)?.ok !== true) {
        safeLog({ event: 'otp.send.fail', code: 'bad_response' });
        return { ok: false, reason: 'server' };
      }
      return { ok: true };
    },

    // 인증번호 확인. 맞으면 서버가 준 세션을 이 기기에 저장한다(SecureStore, 웹은 메모리: lib/supabase.ts 의 저장소).
    async verifyCode(email: string, token: string): Promise<Outcome<VerifyFailure>> {
      const { data, error } = await client.functions.invoke('otp-gate', { body: { action: 'verify', email: normalizeEmail(email), token } });
      if (error) {
        const reason = mapVerify(await readFunctionFailure(error));
        safeLog({ event: 'otp.verify.fail', code: reason });
        return { ok: false, reason };
      }
      const session = (data as { ok?: unknown; session?: { access_token?: unknown; refresh_token?: unknown } } | null)?.session;
      if (typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') {
        safeLog({ event: 'otp.verify.fail', code: 'bad_response' });
        return { ok: false, reason: 'server' };
      }
      const set = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (set.error) {
        safeLog({ event: 'otp.session.fail', code: set.error.code ?? 'unknown' });
        return { ok: false, reason: 'server' };
      }
      return { ok: true };
    },

    // 만 19세 판정은 서버가 한다(나이 계산은 서버에서만, K2 02). 앱은 통과 · 거절만 받는다.
    async checkBirth(birthIso: string): Promise<Outcome<BirthFailure>> {
      const { error } = await client.functions.invoke('underage-reject', { body: { birth_date: birthIso } });
      if (!error) return { ok: true };
      const reason = mapBirth(await readFunctionFailure(error));
      safeLog({ event: 'birth.check.fail', code: reason });
      return { ok: false, reason };
    },

    // 통과한 생년월일을 A01 답으로 저장한다(동의 기록이 생기기 전까지는 고칠 수 있다: backend/스키마.md 9-2 결정 7).
    async saveBirth(birthIso: string): Promise<Outcome<SaveFailure>> {
      const { error } = await client.rpc('save_answers', { p_answers: { A01: birthIso } });
      if (!error) return { ok: true };
      const f = readDbFailure(error);
      const reason: SaveFailure = f.network ? 'network' : f.code === '42501' ? 'session' : 'server';
      safeLog({ event: 'birth.save.fail', code: reason });
      return { ok: false, reason };
    },

    // 이 기기의 로그인만 끊는다(02 뒤로가기 · 03 뒤로가기 · 차단된 계정). 서버 요청이 실패해도 기기에서는 지워진다.
    async signOut(): Promise<void> {
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        safeLog({ event: 'signout.fail' });
      }
    },

    // 로그인한 세션의 이메일(앱을 다시 켠 뒤 02 에서 생년월일 칸을 바로 열 때 화면에 보인다). 없으면 null
    async sessionEmail(): Promise<string | null> {
      const { data } = await client.auth.getSession();
      return data.session?.user?.email ?? null;
    },

    async hasSession(): Promise<boolean> {
      const { data } = await client.auth.getSession();
      return data.session != null;
    },

    async userId(): Promise<string | null> {
      const { data } = await client.auth.getSession();
      return data.session?.user?.id ?? null;
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
