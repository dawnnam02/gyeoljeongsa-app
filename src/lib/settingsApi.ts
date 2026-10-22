// 12 설정이 서버와 주고받는 일(F7). 원본: backend/스키마.md 9-4(grant) · 9-6(함수 표 · 오류 코드) · 9-7(delete-account).
//  · 차단 목록 list_blocked_users → [{ user_id, blocked_at, name(성+OO), age, region }] · 해제 unblock_user(p_target)
//  · 신고 내역 list_my_reports → [{ id, reason_code, status, created_at }] — 화면에는 신고한 날과 상태만(P5-11). 사유 코드는 읽지 않는다
//  · 알림 profiles 의 notify_recommendation · notify_like · notify_match 열만 update(열 단위 권한)
//  · 선택 동의 CK4 · CK9 · CK10(내 등급 보이기, F13): 켜기 = consents 에 동의 행 넣기(지금 판), 끄기 = revoke_consent(p_item). 필수 칸 철회는 서버가 required_consent 로 막는다
//  · 탈퇴 delete-account { action:'start' } → 인증번호 발송, { action:'confirm', token } → 탈퇴 확정(즉시 비노출 · 30일 뒤 삭제 · 세션 정리)
//  · 응답에서 아는 키만 읽는다. 로그는 이벤트 이름과 코드만(이름 · 이메일 · 인증번호 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { CK10_TEXT_VERSION } from '@/config/gradeConsent';
import type { ConsentCode } from '@/content/types';

import { loadActiveConsents, recordConsents } from './consentApi';
import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

export type SettingsFailure = 'network' | 'server';
export type Outcome<F extends string = SettingsFailure> = { ok: true } | { ok: false; reason: F };
export type Loaded<T, F extends string = SettingsFailure> = { ok: true; data: T } | { ok: false; reason: F };

export type BlockedPerson = { userId: string; name: string; age: number | null };
export type ReportStatus = 'received' | 'reviewing' | 'done';
export type MyReport = { id: string; status: ReportStatus; createdAt: string };
export type NotifyKey = 'recommendation' | 'like' | 'match';
export type NotifyPrefs = Readonly<Record<NotifyKey, boolean>>;
export type OptionalCode = 'CK4' | 'CK9' | 'CK10';
export type OptionalConsents = Readonly<Record<OptionalCode, boolean>>;
// 탈퇴 인증번호: limit = 24시간 5번 · 60초 · 10분 잠금(관문 코드 rate_limited · locked · daily_limit · too_soon) · send = 메일 발송 실패 · wrong = 번호 틀림
export type WithdrawStartFailure = 'network' | 'server' | 'limit' | 'send' | 'session';
export type WithdrawConfirmFailure = 'network' | 'server' | 'limit' | 'wrong' | 'session';

export const NOTIFY_COLUMNS: Readonly<Record<NotifyKey, string>> = {
  recommendation: 'notify_recommendation',
  like: 'notify_like',
  match: 'notify_match',
};
const LIMIT_CODES = new Set(['rate_limited', 'locked', 'daily_limit', 'too_soon']);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const messageCode = (error: { message?: string | null }) => String(error.message ?? '').split(':')[0].trim();

export function parseBlocked(raw: unknown): BlockedPerson[] | null {
  if (!Array.isArray(raw)) return null;
  const out: BlockedPerson[] = [];
  for (const row of raw) {
    if (!isRecord(row) || typeof row.user_id !== 'string') continue;
    out.push({
      userId: row.user_id,
      name: typeof row.name === 'string' && row.name !== '' ? row.name : '',
      age: typeof row.age === 'number' && Number.isFinite(row.age) ? row.age : null,
    });
  }
  return out;
}

export function parseReports(raw: unknown): MyReport[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MyReport[] = [];
  for (const row of raw) {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.created_at !== 'string') continue;
    const status = row.status === 'received' || row.status === 'reviewing' || row.status === 'done' ? row.status : null;
    if (!status) continue;
    out.push({ id: row.id, status, createdAt: row.created_at });
  }
  return out;
}

export function createSettingsApi(client: SupabaseClient, appVersion = 'dev') {
  const dbFail = (error: { code?: string | null; message?: string | null }, event: string): SettingsFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return f.network ? 'network' : 'server';
  };

  const invokeDelete = async (body: Record<string, unknown>, event: string) => {
    const { data, error } = await client.functions.invoke('delete-account', { body });
    if (!error) return { ok: isRecord(data) && data.ok === true, code: null as string | null, network: false, status: null as number | null };
    const f = await readFunctionFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return { ok: false, code: f.code, network: f.network, status: f.status };
  };

  return {
    // 차단 목록(12). 쓸 수 없는 계정이면 서버가 null → 서버 오류로 본다
    async loadBlocked(): Promise<Loaded<BlockedPerson[]>> {
      const { data, error } = await client.rpc('list_blocked_users');
      if (error) return { ok: false, reason: dbFail(error, 'settings.blocked.fail') };
      const parsed = parseBlocked(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    // 차단 해제. 이미 풀려 있으면(not_found) 목록에서 빼면 되므로 성공으로 본다
    async unblock(userId: string): Promise<Outcome> {
      const { error } = await client.rpc('unblock_user', { p_target: userId });
      if (!error || messageCode(error) === 'not_found') return { ok: true };
      return { ok: false, reason: dbFail(error, 'settings.unblock.fail') };
    },

    async loadReports(): Promise<Loaded<MyReport[]>> {
      const { data, error } = await client.rpc('list_my_reports');
      if (error) return { ok: false, reason: dbFail(error, 'settings.reports.fail') };
      const parsed = parseReports(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    // 알림 스위치 3개(profiles 본인 행) + 마케팅(CK9)은 loadConsents 가 준다
    async loadNotify(): Promise<Loaded<NotifyPrefs>> {
      const { data, error } = await client.from('profiles').select('notify_recommendation,notify_like,notify_match').maybeSingle();
      if (error) return { ok: false, reason: dbFail(error, 'settings.notify.load.fail') };
      const row: Record<string, unknown> = isRecord(data) ? data : {};
      const on = (col: string) => row[col] !== false; // 서버 처음값은 켜짐
      return { ok: true, data: { recommendation: on('notify_recommendation'), like: on('notify_like'), match: on('notify_match') } };
    },

    async saveNotify(key: NotifyKey, value: boolean): Promise<Outcome> {
      const { error } = await client.from('profiles').update({ [NOTIFY_COLUMNS[key]]: value });
      return error ? { ok: false, reason: dbFail(error, 'settings.notify.save.fail') } : { ok: true };
    },

    // 유효한 동의(철회 안 됨) 중 선택 2칸의 켜짐 여부
    async loadConsents(): Promise<Loaded<OptionalConsents>> {
      const result = await loadActiveConsents(client);
      if (!result.ok) return result;
      const has = (code: OptionalCode) => result.rows.some((r) => r.item_code === code);
      return { ok: true, data: { CK4: has('CK4'), CK9: has('CK9'), CK10: has('CK10') } };
    },

    // 선택 동의 켜기(동의 기록 더하기) · 끄기(철회 기록, CK4 면 서버가 종교 3문항을 '답하지 않음'으로)
    async setOptional(code: OptionalCode, on: boolean): Promise<Outcome<SettingsFailure | 'session'>> {
      if (!on) {
        const { error } = await client.rpc('revoke_consent', { p_item: code });
        if (!error) return { ok: true };
        const f = readDbFailure(error);
        safeLog({ event: 'settings.consent.revoke.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return { ok: false, reason: f.network ? 'network' : f.code === '42501' ? 'session' : 'server' };
      }
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return { ok: false, reason: 'session' };
      const saved = await recordConsents(client, [{ user_id: userId, item_code: code as ConsentCode /* CK10 은 생성 코드 목록 밖(config/gradeConsent.ts) */, agreed: true, text_version: code === 'CK10' ? CK10_TEXT_VERSION : CONSENT_TEXT_VERSIONS[code], app_version: appVersion }]);
      if (!saved.ok) safeLog({ event: 'settings.consent.agree.fail', code: saved.reason });
      return saved;
    },

    // 탈퇴 1: 가입 이메일로 인증번호(이메일 칸 없음)
    async startWithdraw(): Promise<Outcome<WithdrawStartFailure>> {
      const r = await invokeDelete({ action: 'start' }, 'withdraw.start.fail');
      if (r.ok) return { ok: true };
      if (r.network) return { ok: false, reason: 'network' };
      if (r.code && LIMIT_CODES.has(r.code)) return { ok: false, reason: 'limit' };
      if (r.code === 'send_failed') return { ok: false, reason: 'send' };
      if (r.code === 'unauthorized' || r.status === 401) return { ok: false, reason: 'session' };
      return { ok: false, reason: 'server' };
    },

    // 탈퇴 2: 번호가 맞으면 서버가 탈퇴를 확정한다(이 순간이 탈퇴 확인일)
    async confirmWithdraw(token: string): Promise<Outcome<WithdrawConfirmFailure>> {
      const r = await invokeDelete({ action: 'confirm', token }, 'withdraw.confirm.fail');
      if (r.ok) return { ok: true };
      if (r.network) return { ok: false, reason: 'network' };
      if (r.code === 'invalid_token') return { ok: false, reason: 'wrong' };
      if (r.code && LIMIT_CODES.has(r.code)) return { ok: false, reason: 'limit' };
      if (r.code === 'unauthorized' || r.status === 401) return { ok: false, reason: 'session' };
      return { ok: false, reason: 'server' };
    },

    // 이 기기의 로그인만 끊는다(로그아웃 · 탈퇴 확정 뒤). 서버 요청이 실패해도 기기에서는 지워진다
    async signOut(): Promise<void> {
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        safeLog({ event: 'signout.fail' });
      }
    },
  };
}

export type SettingsApi = ReturnType<typeof createSettingsApi>;

