// 데모 모드 모의 서버의 12 설정 부분(F7). 실제 서버 계약(backend/스키마.md 9-6 · 9-7, migrations/0004 · functions/delete-account)과 같은 응답 모양 · 같은 오류 코드.
//  rpc  list_blocked_users → [{ user_id, blocked_at, name, age, region }] · unblock_user(p_target) → null | not_found
//       list_my_reports → [{ id, reason_code, status, created_at }] · revoke_consent(p_item) → 철회한 줄 수 | required_consent(선택 CK4 · CK9 · CK10 · CK11 ~ CK16 밖)
//       12-5 0037 F: get_contact_block_state · sync_contact_hashes · set_contact_block_options · clear_contact_links · mark_contact_prompted · set_avoid_org · clear_avoid_orgs
//       (스위치 avoid_org · contact_block 꺼짐이면 쓰기 함수가 feature_off — 이메일 장면 avoidoff · v4off)
//       0039: 이메일 장면 avoidnokey = 서버 비밀 키(org_pepper · contact_pepper)가 없는 서버 — 더하기 set_avoid_org 가 org_key_missing(빼기는 됨)
//  표   profiles 의 notify_* 열 읽기 · 고치기(다른 열은 permission denied)
//  함수 delete-account { action:'start' } → { ok:true } | 429 locked · daily_limit · too_soon | 502 send_failed
//                      { action:'confirm', token } → { ok:true, scheduled_at } | 400 invalid_token | 429 locked
// 1단계(F7)는 이 파일만 만든다. demoBackend.ts 에 잇는 줄은 app/확인/F7_통합목록.md 에 있다(2단계).
// 장면은 이메일 앞부분으로 고른다: settings(차단 2명 · 신고 3건이 미리 있음) · wdsendfail(탈퇴 인증번호 발송 실패) · wdlimit(발송 한도 소진) · setfail(차단 목록 · 신고 내역 · 알림 저장이 인터넷 문제로 실패)
// 여기 사람들은 가상이다(실제 사람 아님). 이름은 서버처럼 성 + OO.
import { demoSceneDefault, liveDefault } from '@/config/featureKeys';

import { orgKey } from './avoidLocal'; // 서버 private.org_hash 와 같은 정규화(같은 값이면 한 곳)

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type Consent = { item_code: string; agreed: boolean; revoked_at: string | null };
const OPTIONAL_ITEMS = new Set(['CK4', 'CK9', 'CK10', 'CK11', 'CK12', 'CK13', 'CK14', 'CK15', 'CK16']);

export const DEMO_WITHDRAW_CODE = '123456'; // 데모 모드 인증번호(demoBackend 의 DEMO_OTP_CODE 와 같은 값)
const VALID_MS = 180_000; // 3분
const LOCK_MS = 600_000; // 5번 틀리면 10분
const RESEND_MS = 60_000; // 60초 안 재발송 막음
const DAY_MS = 86_400_000;

type Person = { name: string; age: number; region: Row };
const SEED_PEOPLE: Readonly<Record<string, Person>> = {
  'demo-blocked-1': { name: '박OO', age: 29, region: { sido: '경기', sigungu: '성남시' } },
  'demo-blocked-2': { name: '최OO', age: 33, region: { sido: '서울', sigungu: '송파구' } },
};

type UserState = {
  blocks: { target: string; at: number; released: boolean }[];
  reports: { id: string; target: string; reason: string; status: 'received' | 'reviewing' | 'done'; at: number }[];
  notify: { notify_recommendation: boolean; notify_like: boolean; notify_match: boolean; notify_chat: boolean };
  otp: { sends: number[]; sentAt: number | null; wrong: number; lockedUntil: number };
  withdrawnAt: number | null;
  // 12-5(D-200 ① · D-201 · 0037 F): 회원 설정 처음값은 서버와 같다(켜짐 · 자동 동기화 꺼짐 · 내 이메일 쓰기 켜짐). 회사 · 학교는 정규화한 글(서버는 해시)
  avoid: { companies: Set<string>; schools: Set<string>; shareMyKey: boolean; enabled: boolean; avoidOn: boolean; autoSync: boolean; lastSyncedAt: number | null; promptedAt: number | null; syncs: { id: string; at: number }[] };
};
const newAvoid = (): UserState['avoid'] => ({ companies: new Set(), schools: new Set(), shareMyKey: true, enabled: true, avoidOn: true, autoSync: false, lastSyncedAt: null, promptedAt: null, syncs: [] });

export type DemoSettingsUser = { id: string; email: string; consents: Consent[] };

const fail = (code: string, message: string): DbResult<never> => ({ data: null, error: { code, message } });
const network = (): DbResult<never> => fail('', 'Failed to fetch');
const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// supabase.functions.invoke 가 2xx 가 아닐 때 주는 오류와 같은 모양(이름 · context)
class DemoHttpError extends Error {
  constructor(readonly context: Response) {
    super('Edge Function returned a non-2xx status code');
    this.name = 'FunctionsHttpError';
  }
}
const httpFailure = (status: number, code: string) => ({ data: null, error: new DemoHttpError(jsonResponse(status, { ok: false, code })) });

export function createDemoSettings(options: { now?: () => number; people?: (id: string) => Person | null } = {}) {
  const now = options.now ?? Date.now;
  const lookup = (id: string): Person | null => SEED_PEOPLE[id] ?? options.people?.(id) ?? null;
  const users = new Map<string, UserState>();
  let reportSeq = 0;

  const stateOf = (user: DemoSettingsUser): UserState => {
    let s = users.get(user.id);
    if (!s) {
      s = { blocks: [], reports: [], notify: { notify_recommendation: true, notify_like: true, notify_match: true, notify_chat: true }, otp: { sends: [], sentAt: null, wrong: 0, lockedUntil: 0 }, withdrawnAt: null, avoid: newAvoid() };
      if (user.email.startsWith('settings')) {
        const t = now();
        s.blocks.push({ target: 'demo-blocked-1', at: t - 2 * DAY_MS, released: false }, { target: 'demo-blocked-2', at: t - 9 * DAY_MS, released: false });
        s.reports.push(
          { id: 'demo-report-a', target: 'demo-blocked-1', reason: 'RP1', status: 'reviewing', at: t - DAY_MS },
          { id: 'demo-report-b', target: 'demo-blocked-2', reason: 'RP7', status: 'done', at: t - 3 * DAY_MS },
          { id: 'demo-report-c', target: 'demo-blocked-x', reason: 'RP3', status: 'received', at: Date.UTC(2025, 11, 3, 3) },
        );
      }
      if (user.email.startsWith('wdlimit')) s.otp.sends = [0, 1, 2, 3, 4].map(() => now());
      users.set(user.id, s);
    }
    return s;
  };

  const flaky = (user: DemoSettingsUser) => user.email.startsWith('setfail');
  // 기능 스위치(lib/v4Demo 와 같은 규칙): v4off · avoidoff 장면은 live 처음값(contact_block · avoid_org 꺼짐), 그 밖은 데모 처음값
  const flagOn = (user: DemoSettingsUser, key: string): boolean => {
    const l = user.email.split('@')[0].toLowerCase();
    return l.startsWith('v4off') || l.startsWith('avoidoff') ? liveDefault(key) : demoSceneDefault(key, user.email);
  };

  const rpcs: Record<string, (user: DemoSettingsUser, args: Row) => DbResult<unknown>> = {
    list_blocked_users(user) {
      if (flaky(user)) return network();
      const s = stateOf(user);
      const rows = s.blocks
        .filter((b) => !b.released)
        .sort((a, b) => b.at - a.at)
        .map((b) => {
          const p = lookup(b.target);
          return { user_id: b.target, blocked_at: new Date(b.at).toISOString(), name: p?.name ?? null, age: p?.age ?? null, region: p?.region ?? null };
        });
      return { data: rows, error: null };
    },
    unblock_user(user, args) {
      const s = stateOf(user);
      const hit = s.blocks.find((b) => b.target === args.p_target && !b.released);
      if (!hit) return fail('P0001', 'not_found');
      hit.released = true;
      return { data: null, error: null };
    },
    list_my_reports(user) {
      if (flaky(user)) return network();
      const s = stateOf(user);
      const rows = [...s.reports].sort((a, b) => b.at - a.at).map((r) => ({ id: r.id, reason_code: r.reason, status: r.status, created_at: new Date(r.at).toISOString() }));
      return { data: rows, error: null };
    },
    // 12-5 아는 분 피하기 — 0037 [7] F 앱 함수 7개(같은 이름 · 인자 · 오류 코드). 이름은 정규화한 글만(서버는 해시) · 응답은 개수만
    get_contact_block_state(user) {
      if (flaky(user)) return network();
      const a = stateOf(user).avoid;
      const day = a.syncs.filter((x) => now() - x.at < DAY_MS);
      return {
        data: {
          on: flagOn(user, 'contact_block'),
          avoid_org_on: flagOn(user, 'avoid_org'),
          enabled: a.enabled,
          avoid_on: a.avoidOn,
          auto_sync: a.autoSync,
          share_my_key: a.shareMyKey,
          last_synced_at: a.lastSyncedAt === null ? null : new Date(a.lastSyncedAt).toISOString(),
          avoid_company: a.companies.size,
          avoid_school: a.schools.size,
          can_sync_today: new Set(day.map((x) => x.id)).size < 3,
        },
        error: null,
      };
    },
    sync_contact_hashes(user, args) {
      if (!flagOn(user, 'contact_block')) return fail('42501', 'feature_off');
      const hashes = args.p_hashes;
      const mode = args.p_mode ?? 'add';
      if (typeof args.p_sync_id !== 'string' || (mode !== 'add' && mode !== 'replace') || !Array.isArray(hashes)) return fail('P0001', 'invalid_value');
      if (hashes.length > 500) return fail('P0001', 'too_large');
      if (hashes.some((h) => typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h))) return fail('P0001', 'invalid_value');
      if (!user.consents.some((c) => c.item_code === 'CK11' && c.agreed && c.revoked_at === null)) return fail('P0001', 'consent_required');
      const a = stateOf(user).avoid;
      const day = a.syncs.filter((x) => now() - x.at < DAY_MS);
      if (!day.some((x) => x.id === args.p_sync_id) && new Set(day.map((x) => x.id)).size >= 3) return fail('P0001', 'rate_limited');
      a.syncs.push({ id: args.p_sync_id, at: now() }); // 데모는 맞춰 볼 회원 키가 없다 — 기록만
      a.enabled = true;
      a.lastSyncedAt = now();
      return { data: { ok: true }, error: null };
    },
    set_contact_block_options(user, args) {
      const a = stateOf(user).avoid;
      const pick = (v: unknown, keep: boolean) => (typeof v === 'boolean' ? v : keep); // null · 빠짐 = 그대로
      a.autoSync = pick(args.p_auto_sync, a.autoSync);
      a.shareMyKey = pick(args.p_share_my_key, a.shareMyKey); // 끄면 서버는 내 비교 키를 바로 지운다(데모는 값만)
      a.enabled = pick(args.p_enabled, a.enabled);
      a.avoidOn = pick(args.p_avoid_on, a.avoidOn);
      return { data: { ok: true }, error: null };
    },
    clear_contact_links(user) {
      const a = stateOf(user).avoid;
      a.syncs = [];
      a.enabled = false;
      a.autoSync = false;
      return { data: { ok: true }, error: null };
    },
    mark_contact_prompted(user) {
      const a = stateOf(user).avoid;
      a.promptedAt = a.promptedAt ?? now();
      return { data: { ok: true }, error: null };
    },
    set_avoid_org(user, args) {
      if (!flagOn(user, 'avoid_org')) return fail('42501', 'feature_off');
      const kind = args.p_kind;
      const on = args.p_on ?? true;
      const raw = typeof args.p_name === 'string' ? args.p_name : '';
      if ((kind !== 'company' && kind !== 'school') || typeof on !== 'boolean' || raw.length > 60) return fail('P0001', 'invalid_value');
      const name = orgKey(raw);
      if (!name) return fail('P0001', 'invalid_value');
      const set = kind === 'company' ? stateOf(user).avoid.companies : stateOf(user).avoid.schools;
      if (on && user.email.split('@')[0].toLowerCase().startsWith('avoidnokey')) return fail('P0001', 'org_key_missing'); // 0039 [3]
      if (on) {
        if (!set.has(name) && set.size >= 5) return fail('P0001', 'too_many');
        set.add(name);
      } else set.delete(name);
      return { data: { ok: true, count: set.size }, error: null };
    },
    clear_avoid_orgs(user) {
      const a = stateOf(user).avoid;
      a.companies.clear();
      a.schools.clear();
      return { data: { ok: true }, error: null };
    },
    revoke_consent(user, args) {
      if (!OPTIONAL_ITEMS.has(String(args.p_item))) return fail('P0001', 'required_consent'); // 0033: 선택 동의 CK4 · CK9 · CK10 · CK11 ~ CK16 만 철회
      let n = 0;
      const stamp = new Date(now()).toISOString();
      for (const c of user.consents) {
        if (c.item_code === args.p_item && c.agreed && c.revoked_at === null) {
          c.revoked_at = stamp;
          n += 1;
        }
      }
      return { data: n, error: null };
    },
  };

  return {
    // demoBackend.rpc 가 이름이 여기 있으면 넘긴다(2단계)
    handles: (name: string) => name in rpcs,
    rpc(user: DemoSettingsUser, name: string, args: Row = {}): Promise<DbResult<unknown>> {
      const handler = rpcs[name];
      if (!handler) return Promise.resolve(fail('42883', `function ${name} does not exist`));
      return Promise.resolve(handler(user, args));
    },

    // profiles 의 알림 열(본인 행)
    profileRow(user: DemoSettingsUser): Row {
      return { ...stateOf(user).notify };
    },
    updateProfile(user: DemoSettingsUser, values: Row): DbResult<null> {
      if (flaky(user)) return network();
      const s = stateOf(user);
      const keys = Object.keys(values);
      if (keys.length === 0 || keys.some((k) => !(k in s.notify) || typeof values[k] !== 'boolean')) return fail('42501', 'permission denied for column');
      for (const k of keys) (s.notify as Record<string, boolean>)[k] = values[k] as boolean;
      return { data: null, error: null };
    },

    // delete-account 함수
    async deleteAccount(user: DemoSettingsUser, body: Row): Promise<{ data: unknown; error: unknown }> {
      const s = stateOf(user);
      const t = now();
      if (body.action === 'start') {
        if (t < s.otp.lockedUntil) return httpFailure(429, 'locked');
        s.otp.sends = s.otp.sends.filter((x) => t - x < DAY_MS);
        if (s.otp.sends.length >= 5) return httpFailure(429, 'daily_limit');
        if (s.otp.sentAt !== null && t - s.otp.sentAt < RESEND_MS) return httpFailure(429, 'too_soon');
        if (user.email.startsWith('wdsendfail')) return httpFailure(502, 'send_failed');
        s.otp.sends.push(t);
        s.otp.sentAt = t;
        return { data: { ok: true }, error: null };
      }
      if (body.action === 'confirm') {
        const token = typeof body.token === 'string' ? body.token.trim() : '';
        if (!/^[0-9]{6}$/.test(token)) return httpFailure(400, 'invalid_token');
        if (t < s.otp.lockedUntil) return httpFailure(429, 'locked');
        const expired = s.otp.sentAt === null || t - s.otp.sentAt > VALID_MS;
        if (expired || token !== DEMO_WITHDRAW_CODE) {
          s.otp.wrong += 1;
          if (s.otp.wrong >= 5) {
            s.otp.wrong = 0;
            s.otp.lockedUntil = t + LOCK_MS;
            return httpFailure(429, 'locked');
          }
          return httpFailure(400, 'invalid_token');
        }
        s.otp.wrong = 0;
        s.withdrawnAt = t;
        return { data: { ok: true, scheduled_at: new Date(t + 30 * DAY_MS).toISOString() }, error: null };
      }
      return httpFailure(400, 'invalid_request');
    },

    // F5 · F6 의 신고 · 차단이 일어나면 demoBackend 가 알려 준다(2단계). 신고는 차단 목록에도 오른다(P5-03)
    noteBlock(user: DemoSettingsUser, target: string) {
      const s = stateOf(user);
      const live = s.blocks.find((b) => b.target === target && !b.released);
      if (!live) s.blocks.push({ target, at: now(), released: false });
    },
    noteReport(user: DemoSettingsUser, target: string, reason: string) {
      const s = stateOf(user);
      reportSeq += 1;
      s.reports.push({ id: `demo-report-${reportSeq}`, target, reason, status: 'received', at: now() });
      this.noteBlock(user, target);
    },

    // 시험 · 화면 점검용
    peek(userId: string) {
      const s = users.get(userId);
      return s
        ? { blocked: s.blocks.filter((b) => !b.released).map((b) => b.target), reports: s.reports.map((r) => ({ id: r.id, status: r.status })), notify: { ...s.notify }, withdrawn: s.withdrawnAt !== null, avoid: { companies: [...s.avoid.companies], schools: [...s.avoid.schools], shareMyKey: s.avoid.shareMyKey, syncs: s.avoid.syncs.length } }
        : { blocked: [], reports: [], notify: null, withdrawn: false, avoid: null };
    },
  };
}

export type DemoSettings = ReturnType<typeof createDemoSettings>;
