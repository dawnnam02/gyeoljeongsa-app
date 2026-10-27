// 데모 모드 모의 서버의 12 설정 부분(F7). 실제 서버 계약(backend/스키마.md 9-6 · 9-7, migrations/0004 · functions/delete-account)과 같은 응답 모양 · 같은 오류 코드.
//  rpc  list_blocked_users → [{ user_id, blocked_at, name, age, region }] · unblock_user(p_target) → null | not_found
//       list_my_reports → [{ id, reason_code, status, created_at }] · revoke_consent(p_item) → 철회한 줄 수 | required_consent(선택 CK4 · CK9 · CK10 · CK11 ~ CK16 밖)
//  표   profiles 의 notify_* 열 읽기 · 고치기(다른 열은 permission denied)
//  함수 delete-account { action:'start' } → { ok:true } | 429 locked · daily_limit · too_soon | 502 send_failed
//                      { action:'confirm', token } → { ok:true, scheduled_at } | 400 invalid_token | 429 locked
// 1단계(F7)는 이 파일만 만든다. demoBackend.ts 에 잇는 줄은 app/확인/F7_통합목록.md 에 있다(2단계).
// 장면은 이메일 앞부분으로 고른다: settings(차단 2명 · 신고 3건이 미리 있음) · wdsendfail(탈퇴 인증번호 발송 실패) · wdlimit(발송 한도 소진) · setfail(차단 목록 · 신고 내역 · 알림 저장이 인터넷 문제로 실패)
// 여기 사람들은 가상이다(실제 사람 아님). 이름은 서버처럼 성 + OO.
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
  avoid: { companies: string[]; schools: { key: string; name: string }[]; shareEmail: boolean }; // 12-5(D-200 ① · D-201, shareEmail 처음 켜짐)
};

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
      s = { blocks: [], reports: [], notify: { notify_recommendation: true, notify_like: true, notify_match: true, notify_chat: true }, otp: { sends: [], sentAt: null, wrong: 0, lockedUntil: 0 }, withdrawnAt: null, avoid: { companies: [], schools: [], shareEmail: true } };
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
    // 12-5 아는 분 피하기(앱 제안 이름 — 0037 전)
    get_avoid_settings(user) {
      if (flaky(user)) return network();
      const a = stateOf(user).avoid;
      return { data: { companies: [...a.companies], schools: a.schools.map((x) => ({ ...x })), share_email: a.shareEmail }, error: null };
    },
    set_avoid_orgs(user, args) {
      const companies = Array.isArray(args.p_companies) ? args.p_companies.filter((c): c is string => typeof c === 'string').map((c) => c.trim()).filter(Boolean) : null;
      const schools = Array.isArray(args.p_schools) ? args.p_schools.filter((k): k is string => typeof k === 'string') : null;
      if (!companies || !schools) return fail('22023', 'bad_input');
      if (companies.length > 5 || schools.length > 5) return fail('P0001', 'avoid_full');
      const a = stateOf(user).avoid;
      a.companies = [...new Set(companies)];
      a.schools = [...new Set(schools)].map((key) => ({ key, name: key })); // 이름은 앱이 내장 학교 목록에서 채운다(서버는 이름도 준다)
      return { data: null, error: null };
    },
    set_share_email(user, args) {
      if (typeof args.p_on !== 'boolean') return fail('22023', 'bad_input');
      stateOf(user).avoid.shareEmail = args.p_on; // 끄면 서버는 내 비교 키를 지운다(데모는 값만)
      return { data: null, error: null };
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
        ? { blocked: s.blocks.filter((b) => !b.released).map((b) => b.target), reports: s.reports.map((r) => ({ id: r.id, status: r.status })), notify: { ...s.notify }, withdrawn: s.withdrawnAt !== null, avoid: { ...s.avoid } }
        : { blocked: [], reports: [], notify: null, withdrawn: false, avoid: null };
    },
  };
}

export type DemoSettings = ReturnType<typeof createDemoSettings>;
