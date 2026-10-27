// 12 설정이 서버와 주고받는 일(F7). 원본: backend/스키마.md 9-4(grant) · 9-6(함수 표 · 오류 코드) · 9-7(delete-account).
//  · 차단 목록 list_blocked_users → [{ user_id, blocked_at, name(성+OO), age, region }] · 해제 unblock_user(p_target)
//  · 신고 내역 list_my_reports → [{ id, reason_code, status, created_at }] — 화면에는 신고한 날과 상태만(P5-11). 사유 코드는 읽지 않는다
//  · 알림 profiles 의 notify_recommendation · notify_like · notify_match · notify_chat(0036) 열만 update(열 단위 권한)
//    v5: '이번 주 만날 분' 알림은 서버 push_gate 가 notify_match 를 읽는다(0036 P8 · P8b) — 12 알림 첫 줄은 match 열을 쓴다
//  · 선택 동의 CK4 · CK9 · CK11 ~ CK16(03 밖 선택 동의, L17A). CK10(내 등급 보이기)은 D-197 폐지 — 읽지도 쓰지도 않는다(옛 기록은 서버에 그대로, 탈퇴 때 함께 삭제): 켜기 = consents 에 동의 행 넣기(지금 판), 끄기 = revoke_consent(p_item). 필수 칸 철회는 서버가 required_consent 로 막는다
//    CK11 ~ CK16 판은 config/laterConsent.ts(판_관리 2-1)
//  · 탈퇴 delete-account { action:'start' } → 인증번호 발송, { action:'confirm', token } → 탈퇴 확정(즉시 비노출 · 30일 뒤 삭제 · 세션 정리)
//  · 12-5 아는 분 피하기: 0037 [7] F 앱 함수 7개(AVOID_RPC) — 피할 회사 · 학교 이름은 기기에(lib/avoidLocal), 서버는 해시 · 개수만
//  · 응답에서 아는 키만 읽는다. 로그는 이벤트 이름과 코드만(이름 · 이메일 · 인증번호 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { LATER_CONSENT_VERSIONS } from '@/config/laterConsent';
import { LATER_CONSENT_CODES, type ConsentCode, type LaterConsentCode } from '@/content/types';

import { memoryAvoidStore, orgKey, type AvoidLocal, type AvoidSchool, type AvoidStore } from './avoidLocal';
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

// 12-5 아는 분 피하기 — 0037 [7] F 앱 함수 7개(확정 이름 · 인자). 이름 · 인자는 이 표 한 곳에서만 쓴다
export const AVOID_RPC = {
  state: 'get_contact_block_state', // () → { on, avoid_org_on, enabled, avoid_on, auto_sync, share_my_key, last_synced_at, avoid_company, avoid_school, can_sync_today }
  sync: 'sync_contact_hashes', // (p_sync_id uuid, p_hashes text[] 500 이하 · 16진 64자, p_mode 'add' | 'replace', p_final) → { ok } · 오류 feature_off · consent_required(CK11) · rate_limited(하루 3번) · too_large · invalid_value
  options: 'set_contact_block_options', // (p_auto_sync, p_share_my_key, p_enabled, p_avoid_on — 보내지 않은 칸은 그대로) → { ok } · p_share_my_key false 면 서버가 내 비교 키를 바로 지움
  clearContacts: 'clear_contact_links', // () → { ok } — 주소록으로 숨긴 목록 지움(CK11 철회와 같은 효과)
  prompted: 'mark_contact_prompted', // () → { ok } — 안내 시트를 보인 시각
  setOrg: 'set_avoid_org', // (p_kind 'company' | 'school', p_name 60자 이하, p_on) → { ok, count } · 오류 feature_off(스위치 avoid_org 꺼짐) · too_many(5곳) · invalid_value
  clearOrgs: 'clear_avoid_orgs', // () → { ok }
} as const;

export type ContactState = { contactOn: boolean; orgOn: boolean; enabled: boolean; avoidOn: boolean; autoSync: boolean; shareMyKey: boolean; companyCount: number; schoolCount: number; canSyncToday: boolean };
// get_contact_block_state 읽기: 모르는 모양이면 null(서버 오류). 스위치는 켜짐(true)일 때만 켜짐 · 회원 설정은 서버 처음값(켜짐) 쪽
export function parseContactState(raw: unknown): ContactState | null {
  if (!isRecord(raw)) return null;
  const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);
  return {
    contactOn: raw.on === true,
    orgOn: raw.avoid_org_on === true,
    enabled: raw.enabled !== false,
    avoidOn: raw.avoid_on !== false,
    autoSync: raw.auto_sync === true,
    shareMyKey: raw.share_my_key !== false,
    companyCount: count(raw.avoid_company),
    schoolCount: count(raw.avoid_school),
    canSyncToday: raw.can_sync_today !== false,
  };
}

// 화면 값: 이름은 이 기기(lib/avoidLocal) · 스위치 · 이메일 비교는 서버
//  otherCount = 서버 개수 − 기기 목록(다른 기기에서 넣은 곳) · contactOn = 스위치 contact_block(꺼짐이면 지인 차단 줄 '준비 중')
export type AvoidSettings = AvoidLocal & { shareEmail: boolean; orgOn: boolean; otherCount: number; contactOn: boolean };
export type ContactOptions = { autoSync?: boolean; shareMyKey?: boolean; enabled?: boolean; avoidOn?: boolean };
export type ContactSyncFailure = SettingsFailure | 'off' | 'consent' | 'limit' | 'invalid';
const HASH64 = /^[0-9a-f]{64}$/;

export function createSettingsApi(client: SupabaseClient, appVersion = 'dev', avoidStore: AvoidStore = memoryAvoidStore()) {
  const dbFail = (error: { code?: string | null; message?: string | null }, event: string): SettingsFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return f.network ? 'network' : 'server';
  };

  // 기기 목록 열쇠(회원 id). 세션이 없으면 빈 이름(목록은 비어 보이고, 서버 쪽 함수가 forbidden 으로 막는다)
  const myId = async (): Promise<string> => {
    const { data } = await client.auth.getSession();
    return data.session?.user?.id ?? '';
  };
  const setOrg = async (kind: 'company' | 'school', name: string, on: boolean, next: (l: AvoidLocal) => AvoidLocal): Promise<Outcome> => {
    const { error } = await client.rpc(AVOID_RPC.setOrg, { p_kind: kind, p_name: name, p_on: on });
    if (error) return { ok: false, reason: dbFail(error, 'settings.avoid.save.fail') };
    const id = await myId();
    await avoidStore.write(id, next(await avoidStore.read(id)));
    return { ok: true };
  };

  // 회원 설정 묶음(set_contact_block_options) — 보낸 칸만 바꾼다(서버는 null = 그대로)
  const setContactOptions = async (o: ContactOptions): Promise<Outcome> => {
    const args: Record<string, boolean> = {};
    if (o.autoSync !== undefined) args.p_auto_sync = o.autoSync;
    if (o.shareMyKey !== undefined) args.p_share_my_key = o.shareMyKey;
    if (o.enabled !== undefined) args.p_enabled = o.enabled;
    if (o.avoidOn !== undefined) args.p_avoid_on = o.avoidOn;
    const { error } = await client.rpc(AVOID_RPC.options, args);
    return error ? { ok: false, reason: dbFail(error, 'settings.avoid.options.fail') } : { ok: true };
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

    // 탈퇴 2: 번호가 맞으면 서버가 탈퇴를 확정한다(이 순간이 탈퇴 확인일).
    //  확정되면 이 기기에 둔 피할 회사 · 학교 이름 목록도 지운다(3부-바 — 서버 해시는 탈퇴 cascade). 세션이 정리되기 전에 회원 id 를 먼저 읽어 둔다
    async confirmWithdraw(token: string): Promise<Outcome<WithdrawConfirmFailure>> {
      const id = await myId();
      const r = await invokeDelete({ action: 'confirm', token }, 'withdraw.confirm.fail');
      if (r.ok) {
        await avoidStore.remove(id);
        return { ok: true };
      }
      if (r.network) return { ok: false, reason: 'network' };
      if (r.code === 'invalid_token') return { ok: false, reason: 'wrong' };
      if (r.code && LIMIT_CODES.has(r.code)) return { ok: false, reason: 'limit' };
      if (r.code === 'unauthorized' || r.status === 401) return { ok: false, reason: 'session' };
      return { ok: false, reason: 'server' };
    },

    // 12-5 아는 분 피하기(D-200 ① · D-201, 정책 P2-05a) — 0037 [7] F 확정 함수(AVOID_RPC). 데모는 lib/settingsDemo.ts
    //  피할 회사 · 학교: 서버에는 한 곳씩 set_avoid_org(이름은 서버에서 해시로만) · 이름 목록은 이 기기(avoidStore)
    async loadAvoid(): Promise<Loaded<AvoidSettings>> {
      const { data, error } = await client.rpc(AVOID_RPC.state);
      if (error) return { ok: false, reason: dbFail(error, 'settings.avoid.load.fail') };
      const st = parseContactState(data);
      if (!st) return { ok: false, reason: 'server' };
      const local = await avoidStore.read(await myId());
      // 서버 개수가 기기 목록보다 많으면 = 다른 기기(또는 지운 앱)에서 넣은 곳 — 이름은 볼 수 없고 개수만(AVOID.otherDevice)
      const otherCount = Math.max(0, st.companyCount - local.companies.length) + Math.max(0, st.schoolCount - local.schools.length);
      return { ok: true, data: { ...local, shareEmail: st.shareMyKey, orgOn: st.orgOn, otherCount, contactOn: st.contactOn } };
    },
    async loadContactState(): Promise<Loaded<ContactState>> {
      const { data, error } = await client.rpc(AVOID_RPC.state);
      if (error) return { ok: false, reason: dbFail(error, 'settings.contact.load.fail') };
      const st = parseContactState(data);
      return st ? { ok: true, data: st } : { ok: false, reason: 'server' };
    },
    // 피할 회사 한 곳 넣기(on) · 빼기. 서버가 받으면 기기 목록도 고친다
    async setAvoidCompany(name: string, on: boolean): Promise<Outcome> {
      const n = name.trim();
      const same = (c: string) => orgKey(c) === orgKey(n); // 서버에서 한 곳인 이름(기호 · (주) 차이)은 기기 목록에서도 한 줄
      return setOrg('company', n, on, (l) => ({ ...l, companies: on ? [...l.companies.filter((c) => !same(c)), n] : l.companies.filter((c) => !same(c)) }));
    },
    // 피할 학교 한 곳(내장 학교 목록의 키 · 이름 — 서버는 학교 표 이름과 비교하므로 이름을 보낸다)
    async setAvoidSchool(school: AvoidSchool, on: boolean): Promise<Outcome> {
      return setOrg('school', school.name, on, (l) => ({ ...l, schools: on ? [...l.schools.filter((s) => s.key !== school.key), { key: school.key, name: school.name }] : l.schools.filter((s) => s.key !== school.key) }));
    },
    async clearAvoidOrgs(): Promise<Outcome> {
      const { error } = await client.rpc(AVOID_RPC.clearOrgs);
      if (error) return { ok: false, reason: dbFail(error, 'settings.avoid.clear.fail') };
      await avoidStore.remove(await myId()); // 서버 개수 0 + 이 기기 목록도 통째로 지움
      return { ok: true };
    },
    // '내 이메일을 다른 분의 지인 비교에 쓰기'(처음 켜짐). 끄면 서버가 내 비교 키를 바로 지운다
    setShareEmail: (on: boolean): Promise<Outcome> => setContactOptions({ shareMyKey: on }),
    setContactOptions,
    // 지인 차단(CK11 · 주소록): 기기에서 만든 키(SHA-256('kjs1|' + 소문자 이메일) 16진 64자)를 500개씩. 응답은 { ok } 뿐 — 맞은 수 · 누구는 오지 않는다
    //  주소록 읽기 · 해시는 lib/contactSync(3부-바, expo-contacts · expo-crypto). 스위치 contact_block 꺼짐이면 화면 줄은 '준비 중'
    async syncContacts(syncId: string, hashes: readonly string[], mode: 'add' | 'replace', final: boolean): Promise<Outcome<ContactSyncFailure>> {
      if (hashes.length > 500 || hashes.some((h) => !HASH64.test(h))) return { ok: false, reason: 'invalid' };
      const { error } = await client.rpc(AVOID_RPC.sync, { p_sync_id: syncId, p_hashes: [...hashes], p_mode: mode, p_final: final });
      if (!error) return { ok: true };
      const reason = dbFail(error, 'settings.contact.sync.fail');
      const m = messageCode(error);
      if (m === 'feature_off') return { ok: false, reason: 'off' };
      if (m === 'consent_required') return { ok: false, reason: 'consent' };
      if (m === 'rate_limited') return { ok: false, reason: 'limit' };
      if (m === 'too_large' || m === 'invalid_value') return { ok: false, reason: 'invalid' };
      return { ok: false, reason };
    },
    async clearContacts(): Promise<Outcome> {
      const { error } = await client.rpc(AVOID_RPC.clearContacts);
      return error ? { ok: false, reason: dbFail(error, 'settings.contact.clear.fail') } : { ok: true };
    },
    async markContactPrompted(): Promise<Outcome> {
      const { error } = await client.rpc(AVOID_RPC.prompted);
      return error ? { ok: false, reason: dbFail(error, 'settings.contact.prompted.fail') } : { ok: true };
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

