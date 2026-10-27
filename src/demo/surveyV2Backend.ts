// 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)의 설문 v2 모의 서버(F20). 서버에 요청하지 않고 기기 · 브라우저 저장소에 쓰지 않는다(메모리, 페이지를 닫으면 사라짐).
//  실서버와 같은 이름 · 같은 응답 모양({data, error})으로 답해서, 화면은 실서버와 같은 코드(features/surveyV2/api.ts)를 지난다.
//  흉내 내는 것(이름은 api.ts V2_SERVER — '가정' 이름은 S16 변경기록이 나오면 함께 맞춘다):
//   from('survey_answers' · 'free_texts').select().in() · from('visibility_settings').select().maybeSingle() / .update()
//   rpc save_answers · clear_answers · save_free_texts · get_my_prompts · save_my_prompt · delete_my_prompt · get_progress · search_schools(S16 모양: 배열 · way · 과정 이름)
//   W8 정치성향(0029 작업중 이름): rpc set_politics · get_politics · revoke_consent('CK15') · from('consents').insert(CK15 행) — CK15 없으면 consent_required: CK15 로 거부
//   3부-사 종교(CK4 · 0023 validate_survey_answer): A06 에 값(종교 하나)을 저장하려면 유효한 CK4 — 없으면 consent_required: CK4 (A06) 로 거부. '답하지 않음'(null)은 동의 없이 받는다
//   동의 기록(consents)은 데모 로그인 모의 서버(lib/demoBackend)가 원본: 로그인한 회원이면 넣기 · 읽기를 그쪽으로 넘겨(동의 관리 · 03 과 같은 줄) 설문 카드에서 받은 CK4 · CK15 가
//   설정 '동의 관리'에 켜짐으로 보인다(L22 C1). 설정에서 거두면 demoBackend 가 demoSurveyRevoked 로 이 기록을 지운다(실서버 revoke_consent 와 같은 판정 — L22 C6)
//   functions.invoke('appeal-analyze', {}) (S16 Edge, 모의: 분석 없이 done · empty) · ('appeal-proof', {action: 'upload' | 'status'})
//  검사: 서버 검사식처럼 보기 코드 · 글자 수 · 값 모양을 본다(하나라도 틀리면 아무것도 저장하지 않는다). 첫 빈 문항은 앱과 같은 규칙(model.firstMissing)
//  사용자: 데모 로그인(lib/demoClient)의 사용자. 로그인 없이 /survey/v2 를 열면 손님 한 명(demo-v2-guest)으로 둔다(웹 점검용)
//  장면(이메일 앞부분): v2savefail = 저장이 인터넷 문제로 실패 · v2prooffail = 칸마다 첫 증빙 올리기 실패 · v2slow = 검색 · 저장 1.2초 늦음
//  화면 점검(scripts/web-f20.mjs)이 볼 수 있게 데모 모드 웹에서만 읽기 전용 창구 __surveyV2Peek 를 연다
import type { SupabaseClient } from '@supabase/supabase-js';

import { SIGUNGU, isSidoCode } from '@/features/surveyV2/regions';
import { serverSchoolRows } from '@/features/surveyV2/api';
import { firstMissing, qOf, STORY } from '@/features/surveyV2/model';
import type { ProofState, V2Value } from '@/features/surveyV2/types';
import { schoolIndex, type SchoolCourse } from '@/data/schools/schoolSearch';

type Row = Record<string, unknown>;
type DbError = { code: string; message: string };
type Result<T> = { data: T | null; error: DbError | null };
type DemoV2User = {
  answers: Record<string, V2Value>;
  texts: Record<string, string>;
  prompts: Map<number, { code: string; answer: string }>;
  visibility: Record<string, boolean>;
  proofs: Record<string, ProofState>;
  failedProofs: string[];
  calls: Record<string, number>;
  ck15: boolean; // W8 정치성향 별도 동의(유효)
  ck4: boolean; // 3부-사 종교 별도 동의(유효) — 로그인 회원은 demoBackend 동의 기록을 먼저 본다
  politics: number | null; // W8 막대 값 0~100(나만 · 설문 답과 따로)
};
export type DemoV2Memory = { users: Map<string, DemoV2User> };
export const createDemoV2Memory = (): DemoV2Memory => ({ users: new Map() });
const newUser = (): DemoV2User => ({ answers: {}, texts: {}, prompts: new Map(), visibility: {}, proofs: {}, failedProofs: [], calls: {}, ck15: false, ck4: false, politics: null });
// 시험 · 점검용: 메모리 회원 한 명에 동의 칸 등을 미리 넣는다(로그인 없는 손님 · 시험 base — 03 에서 CK4 를 고르고 온 회원 흉내)
export function demoV2Seed(memory: DemoV2Memory, userId: string, patch: Partial<Pick<DemoV2User, 'ck4' | 'ck15'>>): void {
  const u = memory.users.get(userId) ?? newUser();
  Object.assign(u, patch);
  memory.users.set(userId, u);
}

export const DEMO_V2_GUEST = 'demo-v2-guest';
const STORY_IDS = STORY.map((q) => q.id);
const OTHER_PROMPT = /^Q(0[1-9]|1[0-6])$/; // 08 질문 소개 Q01~Q16
const isRecord = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const ok = <T>(data: T): Result<T> => ({ data, error: null });
const bad = (message: string): Result<never> => ({ data: null, error: { code: 'P0001', message } });
const offline = (): Result<never> => ({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } });
const chars = (s: string) => [...s].length;

// 서버 검사식 흉내: 문항 하나의 값 모양(설문_v2 2-5)
export function demoV2ValueOk(id: string, v: unknown): boolean {
  let q;
  try {
    q = qOf(id);
  } catch {
    return false;
  }
  const auto: Readonly<Record<string, readonly unknown[]>> = { A11: ['na'], C03: ['na'], C04: ['na'], D06: ['only'] };
  if (auto[id]?.includes(v)) return true;
  if (id === 'A06' && v === null) return true; // 3부-사: 종교 '답하지 않음'(민감 문항 null — 서버 0023)
  switch (q.format) {
    case 'choice':
    case 'bucket':
      return (v === null && q.decline) || (typeof v === 'string' && q.codes.includes(v) && v !== 'decline');
    case 'region':
      return isRecord(v) && Object.keys(v).sort().join() === 'sido,sigungu' && isSidoCode(v.sido) && SIGUNGU[v.sido].includes(String(v.sigungu));
    case 'school':
      if (v === null) return q.decline;
      if (typeof v === 'string') return q.codes.includes(v) && v !== 'decline';
      return isRecord(v) && Object.keys(v).join() === 'school_key' && typeof v.school_key === 'string' && schoolIndex().byKey(v.school_key) !== null;
    case 'multi':
      return Array.isArray(v) && v.length >= (id === 'F12' ? 0 : 1) && new Set(v).size === v.length && v.every((c) => typeof c === 'string' && q.codes.includes(c));
    case 'scale5':
      return isInt(v, 1, 5);
    case 'number':
      return isInt(v, q.min ?? 0, q.max ?? 0);
    case 'range': {
      if (v === 'any') return true;
      if (!isRecord(v)) return false;
      const keys = id === 'F01' ? ['younger', 'older'] : ['min', 'max'];
      const [lo, hi] = id === 'F01' ? [0, 15] : [130, 220];
      const ks = Object.keys(v);
      if (ks.length === 0 || !ks.every((k) => keys.includes(k) && isInt(v[k], lo, hi))) return false;
      return id !== 'F02' || typeof v.min !== 'number' || typeof v.max !== 'number' || v.min <= v.max;
    }
    case 'rankAll':
      return Array.isArray(v) && v.length === q.codes.length && [...v].sort().join() === [...q.codes].sort().join();
    case 'rankTop':
      return Array.isArray(v) && v.length >= 1 && v.length <= 3 && new Set(v).size === v.length && v.every((c) => typeof c === 'string' && q.codes.includes(c));
    case 'line':
    case 'para':
      return typeof v === 'string' && chars(v) >= (q.min ?? 0) && chars(v) <= (q.max ?? 0);
    default:
      return false;
  }
}

const shared = createDemoV2Memory();

// 탑승 관문 흉내(검수 B0 · 실서버 ticket_profile_ready 0030 · 0036 [8]): 유효한 CK15 + 정치 답 + 종교 A06 답(7코드). 이 모의 서버에 그 회원 기록이 없으면 null(설문을 열지 않음)
const RELIGION_CODES: readonly unknown[] = ['none', 'protestant', 'catholic', 'buddhist', 'won', 'islam', 'other'];
export function demoSurveyReady(userId: string, memory: DemoV2Memory = shared): boolean | null {
  const d = demoSurveyDetail(userId, memory);
  return d === undefined ? null : d === null;
}
// 설정 '동의 관리'에서 거둔 뒤(demoBackend → 실서버 revoke_consent 0037 과 같은 일): CK4 = 종교 '답하지 않음'(null) · CK15 = 정치 답 지움
export function demoSurveyRevoked(userId: string, code: string, memory: DemoV2Memory = shared): void {
  const u = memory.users.get(userId);
  if (!u) return;
  if (code === 'CK4') {
    u.ck4 = false;
    if ('A06' in u.answers) u.answers.A06 = null;
  }
  if (code === 'CK15') {
    u.ck15 = false;
    u.politics = null;
  }
}

// 종교 답(7코드)이 있나 — 설문을 건너뛴 데모 계정이 CK4 를 거둔 뒤 다시 답했는지 볼 때(demoBackend)
export function demoSurveyReligionOk(userId: string, memory: DemoV2Memory = shared): boolean {
  return RELIGION_CODES.includes(memory.users.get(userId)?.answers.A06);
}

// 0039 profile_ready_detail 의 설문 몫(같은 이름 · 같은 차례): 정치(CK15 + 답) → 종교 A06. 다 있으면 null, 이 모의 서버에 그 회원 기록이 없으면 undefined
export function demoSurveyDetail(userId: string, memory: DemoV2Memory = shared): 'politics_missing' | 'religion_missing' | null | undefined {
  const u = memory.users.get(userId);
  if (!u) return undefined;
  if (!u.ck15 || u.politics === null) return 'politics_missing';
  return RELIGION_CODES.includes(u.answers.A06) ? null : 'religion_missing';
}

export type DemoV2Options = { memory?: DemoV2Memory; latencyMs?: number };

// base: 데모 로그인을 가진 클라이언트(lib/demoClient). auth.getSession 만 빌린다
export function createSurveyV2DemoClient(base: Pick<SupabaseClient, 'auth'>, options: DemoV2Options = {}): SupabaseClient {
  const memory = options.memory ?? shared;
  const latency = options.latencyMs ?? 0;

  async function me(): Promise<{ id: string; email: string; user: DemoV2User }> {
    const { data } = await base.auth.getSession();
    const id = data.session?.user?.id ?? DEMO_V2_GUEST;
    const email = String(data.session?.user?.email ?? '');
    let user = memory.users.get(id);
    if (!user) {
      user = newUser();
      memory.users.set(id, user);
    }
    return { id, email, user };
  }
  // 동의 기록 원본: 로그인한 회원이고 base 가 표를 가지면(lib/demoClient) 그쪽(03 · 동의 관리와 같은 줄). 손님 · 시험용 base 는 이 메모리
  type ConsentTable = { insert: (rows: Row[]) => PromiseLike<Result<null>>; select: (cols: string) => { eq: (c: string, v: unknown) => { is: (c: string, v: null) => PromiseLike<Result<Row[]>> } } };
  // (표 질의는 then 이 있는 값이라 async 함수가 바로 돌려주면 await 가 실행해 버린다 — 함수로 감싸 돌려준다)
  const baseConsents = async (): Promise<(() => ConsentTable) | null> => {
    const from = (base as { from?: (name: string) => unknown }).from;
    if (typeof from !== 'function') return null;
    const { data } = await base.auth.getSession();
    return data.session?.user?.id ? () => from.call(base, 'consents') as ConsentTable : null;
  };
  const consentValid = async (u: DemoV2User, code: 'CK4' | 'CK15'): Promise<boolean> => {
    const t = await baseConsents();
    if (!t) return code === 'CK4' ? u.ck4 : u.ck15;
    const { data } = await t().select('item_code').eq('agreed', true).is('revoked_at', null);
    return (data ?? []).some((r) => r.item_code === code);
  };
  const scene = (email: string, name: string) => email.split('@')[0].startsWith(name);
  const wait = async (email: string) => {
    const ms = scene(email, 'v2slow') ? 1200 : latency;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  };
  const count = (u: DemoV2User, name: string) => {
    u.calls[name] = (u.calls[name] ?? 0) + 1;
  };

  const host = globalThis as { document?: unknown; __surveyV2Peek?: unknown };
  if (host.document !== undefined && memory === shared) {
    host.__surveyV2Peek = () =>
      [...memory.users.entries()].map(([id, u]) => ({
        id,
        answered: Object.keys(u.answers).sort(),
        answers: u.answers,
        texts: u.texts,
        prompts: [...u.prompts.entries()].map(([slot, p]) => ({ slot, ...p })),
        visibility: u.visibility,
        proofs: u.proofs,
        calls: u.calls,
        ck15: u.ck15,
        politicsSet: u.politics !== null, // 값은 내보내지 않는다(칸 · 숫자 0) — 점검은 저장 여부와 칸만 본다
        politicsBand: u.politics === null ? null : u.politics >= 80 ? 5 : Math.floor(u.politics / 20) + 1,
        firstMissing: firstMissing({ ...u.answers, ...Object.fromEntries(Object.entries(u.texts).filter(([k]) => ['T01', 'T02', 'T03'].includes(k))) }),
      }));
  }

  const rpcs: Record<string, (u: DemoV2User, email: string, args: Row) => Result<unknown> | Promise<Result<unknown>>> = {
    async save_answers(u, email, args) {
      if (scene(email, 'v2savefail')) return offline();
      const p = args.p_answers;
      if (!isRecord(p) || Object.keys(p).length > 70) return bad('invalid_answers');
      for (const [id, v] of Object.entries(p)) if (!demoV2ValueOk(id, v)) return bad(`invalid_value: ${id}`);
      // 3부-사: 종교 값(답하지 않음 밖)은 유효한 CK4 가 있어야(0023 — 하나라도 막히면 아무것도 저장하지 않음)
      if (p.A06 !== undefined && p.A06 !== null && !(await consentValid(u, 'CK4'))) return { data: null, error: { code: '23514', message: 'consent_required: CK4 (A06)' } };
      Object.assign(u.answers, p);
      return ok(Object.keys(p).length);
    },
    clear_answers(u, _email, args) {
      const ids = Array.isArray(args.p_ids) ? args.p_ids.filter((x): x is string => typeof x === 'string') : [];
      for (const id of ids) delete u.answers[id];
      return ok(ids.length);
    },
    save_free_texts(u, email, args) {
      if (scene(email, 'v2savefail')) return offline();
      const p = args.p_texts;
      if (!isRecord(p) || Object.keys(p).length > 3) return bad('invalid_answers');
      for (const [id, body] of Object.entries(p)) {
        if (!/^T0[1-9]$/.test(id) || typeof body !== 'string') return bad('invalid_answers');
        const q = qOf(id);
        if (body !== '' && (chars(body) < (q.min ?? 0) || chars(body) > (q.max ?? 0))) return bad(`invalid_length: ${id}`);
      }
      for (const [id, body] of Object.entries(p)) {
        if (body === '') delete u.texts[id];
        else u.texts[id] = String(body);
      }
      return ok(Object.keys(p).length);
    },
    get_my_prompts(u) {
      return ok({ prompts: [...u.prompts.entries()].sort((a, b) => a[0] - b[0]).map(([slot, p]) => ({ slot, code: p.code, question: '', answer: p.answer, state: 'live' })), visible: true });
    },
    save_my_prompt(u, email, args) {
      if (scene(email, 'v2savefail')) return offline();
      const slot = args.p_slot;
      const code = args.p_code;
      const answer = typeof args.p_answer === 'string' ? args.p_answer.trim() : '';
      if (!isInt(slot, 1, 3) || typeof code !== 'string' || !(STORY_IDS.includes(code) || OTHER_PROMPT.test(code))) return bad('invalid_value');
      if (chars(answer) < 10 || chars(answer) > 100 || answer.split('\n').length > 2) return ok({ error: 'length' });
      for (const [s, p] of u.prompts) if (p.code === code && s !== slot) return ok({ error: 'dup' });
      u.prompts.set(slot as number, { code, answer });
      return ok({ ok: true });
    },
    delete_my_prompt(u, _email, args) {
      if (typeof args.p_slot === 'number') u.prompts.delete(args.p_slot);
      return ok({ ok: true });
    },
    get_progress(u) {
      const all: Record<string, V2Value> = { ...u.answers };
      for (const id of ['T01', 'T02', 'T03']) if (u.texts[id]) all[id] = u.texts[id];
      return ok({ stage: 'consented', facts: { survey_first_missing: firstMissing(all), photo_slots: 0, consent_needed: [] } });
    },
    // W8 정치성향(0029): 동의 없으면 거부 · 0~100 정수만
    async set_politics(u, email, args) {
      if (scene(email, 'v2savefail')) return offline();
      if (!(await consentValid(u, 'CK15'))) return { data: null, error: { code: '23514', message: 'consent_required: CK15' } };
      if (!isInt(args.p_position, 0, 100)) return { data: null, error: { code: '22023', message: 'invalid_value' } };
      u.politics = args.p_position as number;
      return ok({ saved: true, position: u.politics });
    },
    async get_politics(u) {
      const consent = await consentValid(u, 'CK15');
      return ok({ consent, answered: consent && u.politics !== null, position: consent ? u.politics : null });
    },
    revoke_consent(u, _email, args) {
      if (args.p_item !== 'CK15') return bad('required_consent');
      u.ck15 = false;
      u.politics = null; // 철회 → 답 즉시 삭제(0029 [6])
      return ok(1);
    },
    search_schools(_u, _email, args) {
      const query = typeof args.p_query === 'string' ? args.p_query : '';
      const names: Readonly<Record<string, SchoolCourse>> = { 대학교: 'U', 전문대학: 'C', 대학원: 'G', 고등학교: 'H', 목록밖: 'X' };
      const courses = Array.isArray(args.p_courses) ? args.p_courses.map((c) => names[String(c)]).filter((c): c is SchoolCourse => !!c) : undefined;
      const limit = typeof args.p_limit === 'number' ? Math.min(Math.max(args.p_limit, 1), 20) : 10;
      return ok(serverSchoolRows(query, { courses, limit }));
    },
  };

  function table(name: string) {
    const select = (cols = '*') => ({
      // 3부-사: 동의 읽기(lib/consentApi loadActiveConsents 모양 — select · eq('agreed', true) · is('revoked_at', null))
      eq: (_c: string, _v: unknown) => ({
        is: async (_c2: string, _v2: null): Promise<Result<Row[]>> => {
          const { user } = await me();
          if (name !== 'consents') return ok([]);
          const t = await baseConsents();
          if (t) return (await t().select(cols).eq('agreed', true).is('revoked_at', null)) as Result<Row[]>;
          return ok([...(user.ck15 ? [{ item_code: 'CK15', text_version: 'memory' }] : []), ...(user.ck4 ? [{ item_code: 'CK4', text_version: 'memory' }] : [])]);
        },
      }),
      in: async (_col: string, ids: string[]): Promise<Result<Row[]>> => {
        const { user, email } = await me();
        await wait(email);
        if (name === 'survey_answers') return ok(Object.entries(user.answers).filter(([id]) => ids.includes(id)).map(([question_id, value]) => ({ question_id, value })));
        if (name === 'free_texts') return ok(Object.entries(user.texts).filter(([id]) => ids.includes(id)).map(([question_id, body]) => ({ question_id, body })));
        return ok([]);
      },
      maybeSingle: async (): Promise<Result<Row>> => {
        const { user } = await me();
        return name === 'visibility_settings' ? ok({ ...user.visibility }) : ok(null as unknown as Row);
      },
    });
    return {
      select,
      // W8 · 3부-사: 동의 기록(consentApi.recordConsents 모양). 로그인 회원은 demoBackend 기록에 넣고(같은 검사 · 60줄 상한), 이 메모리에도 CK15 · CK4 를 적는다
      insert: async (rows: Row[]): Promise<Result<null>> => {
        const { user, email } = await me();
        await wait(email);
        if (name !== 'consents' || !Array.isArray(rows)) return bad('not_allowed');
        const t = await baseConsents();
        if (t) {
          const r = await t().insert(rows);
          if (r.error) return r;
        }
        for (const r of rows) {
          if (r.item_code === 'CK15' && r.agreed === true) user.ck15 = true;
          if (r.item_code === 'CK4') user.ck4 = r.agreed === true;
        }
        return ok(null);
      },
      update: async (changes: Row): Promise<Result<null>> => {
        const { user } = await me();
        if (name !== 'visibility_settings') return bad('not_allowed');
        for (const [col, on] of Object.entries(changes)) if (typeof on === 'boolean') user.visibility[col] = on;
        return ok(null);
      },
    };
  }

  const client = {
    auth: base.auth,
    from: (name: string) => table(name),
    rpc: async (name: string, args: Row = {}) => {
      const { user, email } = await me();
      count(user, name);
      await wait(email);
      const fn = rpcs[name];
      return fn ? fn(user, email, args) : { data: null, error: { code: 'PGRST202', message: `데모 모의 서버에 없는 함수 ${name}` } };
    },
    functions: {
      invoke: async (name: string, opts: { body?: unknown } = {}) => {
        const { user, email } = await me();
        count(user, name);
        await wait(email);
        const body = isRecord(opts.body) ? opts.body : {};
        if (name === 'appeal-analyze') {
          const has = Object.keys(user.texts).some((id) => /^T0[4-9]$/.test(id));
          return { data: { ok: true, status: has ? 'done' : 'empty' }, error: null }; // 모의: LLM 호출 0 · 점수 0
        }
        if (name !== 'appeal-proof') return { data: null, error: { name: 'FunctionsHttpError', message: 'not found' } };
        if (body.action === 'status') return { data: { proofs: { ...user.proofs } }, error: null };
        const card = String(body.card ?? '');
        if (!/^T0[4-9]$/.test(card)) return { data: { ok: false, error: 'invalid_card' }, error: null };
        if (scene(email, 'v2prooffail') && !user.failedProofs.includes(card)) {
          user.failedProofs.push(card);
          user.proofs[card] = 'retry';
          return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } };
        }
        user.proofs[card] = 'pending'; // 운영팀이 서류를 보고 승인 · 반려(K12 7). 데모는 '확인 중'까지
        return { data: { ok: true, state: 'pending' }, error: null };
      },
    },
  };
  return client as unknown as SupabaseClient;
}
