// 12 설정이 서버와 주고받는 일(F7). 원본: backend/스키마.md 9-4(grant) · 9-6(함수 표 · 오류 코드) · 9-7(delete-account).
//  · 차단 목록 list_blocked_users → [{ user_id, blocked_at, name(성+OO), age, region }] · 해제 unblock_user(p_target)
//  · 신고 내역 list_my_reports → [{ id, reason_code, status, created_at }] — 화면에는 신고한 날과 상태만(P5-11). 사유 코드는 읽지 않는다
//  · 알림 profiles 의 notify_recommendation · notify_like · notify_match · notify_chat(0036) 열만 update(열 단위 권한)
//    v5: '이번 주 만날 분' 알림은 서버 push_gate 가 notify_match 를 읽는다(0036 P8 · P8b) — 12 알림 첫 줄은 match 열을 쓴다
//  · 선택 동의 CK4 · CK9 · CK11 ~ CK16(03 밖 선택 동의, L17A). CK10(내 등급 보이기)은 D-197 폐지 — 읽지도 쓰지도 않는다(옛 기록은 서버에 그대로, 탈퇴 때 함께 삭제): 켜기 = consents 에 동의 행 넣기(지금 판), 끄기 = revoke_consent(p_item). 필수 칸 철회는 서버가 required_consent 로 막는다
//    CK11 ~ CK16 판은 config/laterConsent.ts(판_관리 2-1)
//  · 탈퇴 delete-account { action:'start' } → 인증번호 발송, { action:'confirm', token } → 탈퇴 확정(즉시 비노출 · 30일 뒤 삭제 · 세션 정리)
//  · 응답에서 아는 키만 읽는다. 로그는 이벤트 이름과 코드만(이름 · 이메일 · 인증번호 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { LATER_CONSENT_VERSIONS } from '@/config/laterConsent';
import { LATER_CONSENT_CODES, type ConsentCode, type LaterConsentCode } from '@/content/types';

import { loadActiveConsents, recordConsents } from './consentApi';
import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

export type SettingsFailure = 'network' | 'server';
export type Outcome<F extends string = SettingsFailure> = { ok: true } | { ok: false; reason: F };
export type Loaded<T, F extends string = SettingsFailure> = { ok: true; data: T } | { ok: false; reason: F };

export type BlockedPerson = { userId: string; name: string; age: number | null };
export type ReportStatus = 'received' | 'reviewing' | 'done';
export type MyReport = { id: string; status: ReportStatus; createdAt: string };
export type NotifyKey = 'recommendation' | 'like' | 'match' | 'chat';
export type NotifyPrefs = Readonly<Record<NotifyKey, boolean>>;
export type OptionalCode = 'CK4' | 'CK9' | LaterConsentCode;
export const OPTIONAL_CODES: readonly OptionalCode[] = ['CK4', 'CK9', ...LATER_CONSENT_CODES];
export type OptionalConsents = Readonly<Record<OptionalCode, boolean>>;
// 탈퇴 인증번호: limit = 24시간 5번 · 60초 · 10분 잠금(관문 코드 rate_limited · locked · daily_limit · too_soon) · send = 메일 발송 실패 · wrong = 번호 틀림
export type WithdrawStartFailure = 'network' | 'server' | 'limit' | 'send' | 'session';
export type WithdrawConfirmFailure = 'network' | 'server' | 'limit' | 'wrong' | 'session';

export const NOTIFY_COLUMNS: Readonly<Record<NotifyKey, string>> = {
  recommendation: 'notify_recommendation',
  like: 'notify_like',
  match: 'notify_match',
  chat: 'notify_chat', // 0036 대화방 새 글(P9)
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

export type AvoidSettings = { companies: string[]; schools: { key: string; name: string }[]; shareEmail: boolean };
// 12-5 응답 읽기: 모르는 모양이면 null(서버 오류로 본다). 이름 · 키만 읽고 다른 키는 버린다
export function parseAvoid(raw: unknown): AvoidSettings | null {
  if (!isRecord(raw)) return null;
  const companies = Array.isArray(raw.companies) ? raw.companies.filter((c): c is string => typeof c === 'string' && c.trim() !== '') : null;
  const schools = Array.isArray(raw.schools) ? raw.schools.filter((x): x is { key: string; name: string } => isRecord(x) && typeof x.key === 'string' && typeof x.name === 'string').map((x) => ({ key: x.key, name: x.name })) : null;
  if (!companies || !schools) return null;
  return { companies, schools, shareEmail: raw.share_email !== false };
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
      const { data, error } = await client.from('profiles').select('notify_recommendation,notify_like,notify_match,notify_chat').maybeSingle();
      if (error) return { ok: false, reason: dbFail(error, 'settings.notify.load.fail') };
      const row: Record<string, unknown> = isRecord(data) ? data : {};
      const on = (col: string) => row[col] !== false; // 서버 처음값은 켜짐
      return { ok: true, data: { recommendation: on('notify_recommendation'), like: on('notify_like'), match: on('notify_match'), chat: on('notify_chat') } };
    },

    async saveNotify(key: NotifyKey, value: boolean): Promise<Outcome> {
      const { error } = await client.from('profiles').update({ [NOTIFY_COLUMNS[key]]: value });
      return error ? { ok: false, reason: dbFail(error, 'settings.notify.save.fail') } : { ok: true };
    },

    // 유효한 동의(철회 안 됨) 중 선택 칸(CK4 · CK9 · CK11 ~ CK16)의 켜짐 여부. CK10 기록이 있어도 읽지 않는다(D-197)
    async loadConsents(): Promise<Loaded<OptionalConsents>> {
      const result = await loadActiveConsents(client);
      if (!result.ok) return result;
      const has = (code: OptionalCode) => result.rows.some((r) => r.item_code === code);
      return { ok: true, data: Object.fromEntries(OPTIONAL_CODES.map((c) => [c, has(c)])) as Record<OptionalCode, boolean> };
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
      const version = code === 'CK4' || code === 'CK9' ? CONSENT_TEXT_VERSIONS[code] : LATER_CONSENT_VERSIONS[code];
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return { ok: false, reason: 'session' };
      const saved = await recordConsents(client, [{ user_id: userId, item_code: code as ConsentCode /* CK11 ~ CK16 은 생성 코드 목록 밖(config/laterConsent.ts) */, agreed: true, text_version: version, app_version: appVersion }]);
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

    // 12-5 아는 분 피하기(D-200 ① · D-201, 정책 P2-05a). 서버 함수 이름 · 인자는 앱 제안(0037 전, 백엔드 R 변경기록과 맞출 몫) — 데모는 lib/settingsDemo.ts
    //  get_avoid_settings() → { companies: text[], schools: [{ key, name }], share_email: bool }
    //  set_avoid_orgs(p_companies text[], p_schools text[]) → 회사 · 학교 각각 5곳까지(서버가 한 번 더 막음 avoid_full)
    //  set_share_email(p_on bool) → 끄면 서버가 내 비교 키를 지운다
    async loadAvoid(): Promise<Loaded<AvoidSettings>> {
      const { data, error } = await client.rpc('get_avoid_settings');
      if (error) return { ok: false, reason: dbFail(error, 'settings.avoid.load.fail') };
      const parsed = parseAvoid(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },
    async saveAvoidOrgs(companies: readonly string[], schools: readonly string[]): Promise<Outcome> {
      const { error } = await client.rpc('set_avoid_orgs', { p_companies: [...companies], p_schools: [...schools] });
      return error ? { ok: false, reason: dbFail(error, 'settings.avoid.save.fail') } : { ok: true };
    },
    async setShareEmail(on: boolean): Promise<Outcome> {
      const { error } = await client.rpc('set_share_email', { p_on: on });
      return error ? { ok: false, reason: dbFail(error, 'settings.avoid.share.fail') } : { ok: true };
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

