// 데모 모드의 대화형 설문 모의 서버(V6-F). 서버에 요청하지 않고 기기 · 브라우저 저장소에 쓰지 않는다(메모리). 실제 모델 호출 0.
//  1부 답 · 학교 검색 · 정치(CK15)는 설문 v2 모의 서버(surveyV2Backend)에 그대로 넘기고, 이 파일은 0033 · Edge 2개의 이름 · 응답 모양만 흉내 낸다:
//   rpc interview_start(p_device) · interview_resume(p_session) · interview_set_state(p_session, p_state) · get_interview_summary() · edit_interview_summary(p_edit)
//   functions.invoke('survey-interview', {action: open | turn, session_id, text, behavior?}) · ('survey-analyze', {session_id})
//   from('consents').insert(CK16 행) — CK16 동의가 없으면 행동 숫자를 받아도 버린다(0033 트리거와 같은 규칙)
//  2부 AI 말은 ai/V6/모의대본 대본 차례대로(surveyChatScripts.ts). 장면(이메일 앞부분): v6slow = P21(늦은 턴 8초 넘음) · v6fail = P26(실패 턴은 예비 질문) ·
//   v6down = 인터뷰 함수가 통신 오류(앱이 예비 질문으로 이어 감) · v6wait = 정리 '분석 대기' · v6off = 스위치 꺼짐({off: true}). 그 밖 = P01(정상)
//  상한: 내 답 25턴(넘으면 429 turn_limit) · 하루 시작 3번. 데모 모드 웹에서만 읽기 전용 창구 __surveyChatPeek(글 0 — 턴 수 · 동의 · 행동 숫자 키 이름만)
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSurveyV2DemoClient, createDemoV2Memory, DEMO_V2_GUEST, type DemoV2Memory } from './surveyV2Backend';
import { demoShared } from './inflightShared';
import { DEMO_ANALYSIS, DEMO_SCRIPTS, type ScriptTurn } from './surveyChatScripts';

type Row = Record<string, unknown>;
type DemoTurn = { seq: number; role: 'ai' | 'user'; slot: string | null; text: string; behavior: Row | null };
type DemoSession = { id: number; state: 'part1' | 'part2' | 'wrap' | 'done'; device: string | null; turns: DemoTurn[]; userTurns: number; analysis: 'none' | 'running' | 'waiting' | 'done' };
type DemoChatUser = { ck16: boolean; sessions: DemoSession[]; starts: number; edited: Row | null; behaviorsReceived: number; behaviorsSaved: number; savedKeys: string[] };
export type DemoChatMemory = { users: Map<string, DemoChatUser>; v2: DemoV2Memory; next: number };
export const createDemoChatMemory = (v2: DemoV2Memory = createDemoV2Memory()): DemoChatMemory => ({ users: new Map(), v2, next: 1 });

export const MAX_USER_TURNS = 25;
const DAILY_STARTS = 3;
export const IV_OPEN = '지금부터는 AI가 몇 가지를 여쭤볼게요. 정답은 없으니 떠오르는 대로 편하게 적어 주세요. 가까운 분들은 보통 어떤 사람이라고 말해 주나요?'; // 서버 FIXED['iv.open']
export const IV_CLOSE = '오랜 시간 이야기 나눠 주셔서 고마워요. 이제 들려주신 이야기를 정리해 드릴게요.'; // 서버 FIXED['iv.close']
const BEHAVIOR_KEYS = ['first_key_ms', 'compose_ms', 'chars_per_sec_x10', 'delete_ratio_pm', 'pauses_3s', 'rewrites'];

const isRecord = (v: unknown): v is Row => typeof v === 'object' && v !== null && !Array.isArray(v);
const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export type DemoChatOptions = {
  memory?: DemoChatMemory;
  latencyMs?: number; // 모든 응답 기본 지연
  scriptScale?: number; // 대본 지연(latency_ms)에 곱하는 수(정상 턴). 늦은 턴은 그대로. 시험은 0
  script?: readonly ScriptTurn[]; // 시험: 대본을 바꿔 끼운다(25턴 상한 등)
  failTurns?: number; // 시험: 처음 n 번의 턴 요청은 통신 실패(저장 0, 다시 보내기 시험)
  dropReplies?: number; // 시험: 처음 n 번은 저장 · 답까지 하고 응답만 잃음(통신 실패로 보임 — duplicate 시험)
};

const shared = createDemoChatMemory();
// 3부-자(0044): 모의 confirm_profile(null)이 '가장 늦은 세션 정리가 done 인가'를 읽는다(공유 메모리 한정)
demoShared.setInterviewDone((userId) => shared.users.get(userId)?.sessions.at(-1)?.analysis === 'done');

// base: 데모 로그인을 가진 클라이언트. auth.getSession 만 빌린다
export function createSurveyChatDemoClient(base: Pick<SupabaseClient, 'auth'>, options: DemoChatOptions = {}): SupabaseClient {
  const memory = options.memory ?? shared;
  const latency = options.latencyMs ?? 0;
  const scale = options.scriptScale ?? 0.4;
  let failLeft = options.failTurns ?? 0;
  let dropLeft = options.dropReplies ?? 0;
  // 공유 메모리면 설문 v2 모의 서버도 공유 메모리(같은 브라우저의 /survey/v2 검토 화면 · __surveyV2Peek 가 같은 답을 본다)
  const inner = createSurveyV2DemoClient(base, { ...(options.memory ? { memory: memory.v2 } : {}), latencyMs: latency }) as unknown as {
    from: (name: string) => Row & { insert: (rows: Row[]) => Promise<unknown> };
    rpc: (name: string, args?: Row) => Promise<unknown>;
    functions: { invoke: (name: string, opts?: { body?: unknown }) => Promise<unknown> };
  };

  async function me(): Promise<{ id: string; email: string; user: DemoChatUser }> {
    const { data } = await base.auth.getSession();
    const id = data.session?.user?.id ?? DEMO_V2_GUEST;
    const email = String(data.session?.user?.email ?? '');
    let user = memory.users.get(id);
    if (!user) {
      user = { ck16: false, sessions: [], starts: 0, edited: null, behaviorsReceived: 0, behaviorsSaved: 0, savedKeys: [] };
      memory.users.set(id, user);
    }
    return { id, email, user };
  }
  const scene = (email: string, name: string) => email.split('@')[0].startsWith(name);
  const scriptOf = (email: string): readonly ScriptTurn[] => options.script ?? (scene(email, 'v6slow') ? DEMO_SCRIPTS.P21 : scene(email, 'v6fail') ? DEMO_SCRIPTS.P26 : DEMO_SCRIPTS.P01);
  const sessionJson = (u: DemoChatUser, s: DemoSession) => ({ session_id: s.id, state: s.state, user_turns: s.userTurns, turns_left: MAX_USER_TURNS - s.userTurns, analysis: s.analysis, ck16: u.ck16 });
  const ok = (data: unknown) => ({ data, error: null });
  const fail = (message: string, code = 'P0001') => ({ data: null, error: { code, message } });
  const find = (u: DemoChatUser, id: unknown) => u.sessions.find((s) => s.id === id);

  const host = globalThis as { document?: unknown; __surveyChatPeek?: unknown };
  if (host.document !== undefined && memory === shared) {
    host.__surveyChatPeek = () =>
      [...memory.users.entries()].map(([id, u]) => ({
        id,
        ck16: u.ck16,
        sessions: u.sessions.map((s) => ({ id: s.id, state: s.state, userTurns: s.userTurns, analysis: s.analysis })),
        behaviorsReceived: u.behaviorsReceived,
        behaviorsSaved: u.behaviorsSaved,
        savedKeys: u.savedKeys, // 저장된 행동 숫자의 키 이름(값 0)
      }));
  }

  const rpcs: Record<string, (u: DemoChatUser, email: string, args: Row) => { data: unknown; error: unknown }> = {
    interview_start(u, email, args) {
      if (scene(email, 'v6off')) return ok({ off: true });
      const open = [...u.sessions].reverse().find((s) => s.state === 'part1' || s.state === 'part2');
      if (open) return ok({ ...sessionJson(u, open), resumed: true });
      if (u.starts >= DAILY_STARTS) return fail('daily_limit', '54000');
      u.starts += 1;
      const s: DemoSession = { id: memory.next, state: 'part1', device: typeof args.p_device === 'string' ? args.p_device : null, turns: [], userTurns: 0, analysis: 'none' };
      memory.next += 1;
      u.sessions.push(s);
      return ok({ ...sessionJson(u, s), resumed: false });
    },
    interview_resume(u, email, args) {
      if (scene(email, 'v6off')) return ok({ off: true });
      const s = args.p_session === undefined ? u.sessions.at(-1) : find(u, args.p_session);
      if (!s) return args.p_session === undefined ? ok({ session: null }) : fail('not_found', 'P0002');
      return ok({ session: sessionJson(u, s), turns: s.turns.map((t) => ({ seq: t.seq, role: t.role, slot: t.slot, text: t.text })) });
    },
    interview_set_state(u, _email, args) {
      const s = find(u, args.p_session);
      if (!s) return fail('not_found', 'P0002');
      const to = args.p_state;
      if (!((s.state === 'part1' && to === 'part2') || (s.state === 'part2' && to === 'wrap') || s.state === to)) return fail('invalid_state', '22023');
      s.state = to as DemoSession['state'];
      return ok(sessionJson(u, s));
    },
    get_interview_summary(u, email) {
      if (scene(email, 'v6off')) return ok({ off: true });
      const s = u.sessions.at(-1);
      if (!s || s.analysis !== 'done') return ok({ status: s?.analysis ?? 'none', version: null, summary: null, reason: null, facts: null, evidence: null, edited: null, edited_at: null, pace_used: false });
      return ok({
        status: 'done',
        version: 1,
        summary: DEMO_ANALYSIS.summary,
        reason: DEMO_ANALYSIS.reason,
        facts: Object.fromEntries(Object.entries(DEMO_ANALYSIS.facts).map(([k, text]) => [k, { text, turns: [] }])),
        evidence: [],
        edited: u.edited,
        edited_at: u.edited ? new Date(0).toISOString() : null,
        pace_used: u.ck16,
        style_chips: DEMO_ANALYSIS.styleChips, // 가정 키(앱 쪽 제안 — 서버 0033 에는 아직 없음)
      });
    },
    edit_interview_summary(u, _email, args) {
      const e = args.p_edit;
      if (!isRecord(e) || Object.keys(e).some((k) => k !== 'summary' && k !== 'facts')) return fail('invalid_value', '22023');
      const next: Row = { ...(u.edited ?? {}) };
      if ('summary' in e) {
        if (e.summary === null) delete next.summary;
        else if (typeof e.summary !== 'string' || [...e.summary.trim()].length < 1 || [...e.summary.trim()].length > 200) return fail('invalid_value', '22023');
        else next.summary = e.summary.trim();
      }
      if (isRecord(e.facts)) {
        const f: Row = { ...(isRecord(next.facts) ? next.facts : {}) };
        for (const [k, v] of Object.entries(e.facts)) {
          if (!/^(T0[1-9]|Q(1[7-9]|2[0-4]))$/.test(k)) return fail('invalid_value', '22023');
          if (v === null) delete f[k];
          else if (typeof v === 'string' && [...v].length <= 300) f[k] = v.trim();
          else return fail('invalid_value', '22023');
        }
        if (Object.keys(f).length) next.facts = f;
        else delete next.facts;
      }
      u.edited = Object.keys(next).length ? next : null;
      return ok({ saved: true, version: 1, edited: u.edited });
    },
  };

  // 2부 한 턴(0033 iv_save_turn + Edge survey-interview 의 응답 모양)
  async function interview(u: DemoChatUser, email: string, body: Row): Promise<{ data: unknown; error: unknown }> {
    if (scene(email, 'v6off')) return ok({ off: true });
    if (body.action === 'turn' && (scene(email, 'v6down') || failLeft > 0)) {
      failLeft -= 1;
      return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } };
    }
    const s = find(u, body.session_id);
    if (!s) return { data: null, error: { name: 'FunctionsHttpError', message: 'not_found', context: { status: 404 } } };
    if (s.state !== 'part2') return { data: null, error: { name: 'FunctionsHttpError', message: 'invalid_state', context: { status: 409 } } };
    const pushAi = (text: string, slot: string | null) => {
      const seq = s.turns.length + 1;
      s.turns.push({ seq, role: 'ai', slot, text, behavior: null });
      return seq;
    };
    if (body.action === 'open') {
      const first = s.turns.find((t) => t.role === 'ai');
      if (first) return ok({ ok: true, reply: { seq: first.seq, slot: first.slot, text: first.text, source: 'preset' }, turn: s.userTurns, turns_left: MAX_USER_TURNS - s.userTurns, done: false, fallback: false });
      const seq = pushAi(IV_OPEN, 'intro');
      return ok({ ok: true, reply: { seq, slot: 'intro', text: IV_OPEN, source: 'preset' }, turn: 0, turns_left: MAX_USER_TURNS, done: false, fallback: false });
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 2000) return { data: null, error: { name: 'FunctionsHttpError', message: 'invalid_request', context: { status: 400 } } };
    // turn(D-187): 같은 번호(이미 받은 턴)면 저장 없이 그 턴 AI 말(duplicate: true) · 앞지르면 400 · 없으면 다음 번호로 본다
    const nth = typeof body.turn === 'number' && Number.isInteger(body.turn) ? body.turn : s.userTurns + 1;
    if (nth > s.userTurns + 1 || nth < 1) return { data: null, error: { name: 'FunctionsHttpError', message: 'invalid_request', context: { status: 400 } } };
    if (nth <= s.userTurns) {
      const userAt = s.turns.filter((x) => x.role === 'user')[nth - 1];
      const ai = s.turns.find((x) => x.role === 'ai' && x.seq > (userAt?.seq ?? 0));
      return ok({ ok: true, reply: { seq: ai?.seq ?? 0, slot: ai?.slot ?? null, text: ai?.text ?? '', source: 'preset' }, turn: s.userTurns, turns_left: MAX_USER_TURNS - s.userTurns, done: false, fallback: false, guard: 'ok', behavior_saved: false, duplicate: true });
    }
    if (s.userTurns >= MAX_USER_TURNS) return { data: null, error: { name: 'FunctionsHttpError', message: 'turn_limit', context: { status: 429 } } };
    // 행동 숫자: 받은 것은 세되, CK16 이 없으면 저장 0(0033 트리거 규칙)
    const raw = body.behavior;
    const behavior = isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter(([k, v]) => BEHAVIOR_KEYS.includes(k) && (v === null || typeof v === 'number'))) : null;
    if (raw !== undefined) u.behaviorsReceived += 1;
    const saved = u.ck16 && behavior !== null && Object.values(behavior).some((v) => v !== null);
    if (saved) {
      u.behaviorsSaved += 1;
      u.savedKeys = Object.keys(behavior ?? {}).sort();
    }
    s.userTurns += 1;
    s.turns.push({ seq: s.turns.length + 1, role: 'user', slot: null, text, behavior: saved ? behavior : null });
    const masked = /\d{2,4}-?\d{3,4}-?\d{4}|@[a-z0-9._]{3,}/i.test(text);
    const script = scriptOf(email);
    const step: ScriptTurn | undefined = script[s.userTurns - 1];
    await sleep(step ? (step.flow === 'slow' ? step.ms : Math.round(step.ms * scale)) : 0);
    const left = MAX_USER_TURNS - s.userTurns;
    const close = !step || step.done || left <= 0;
    const say = !step || (left <= 0 && !step.done) ? IV_CLOSE : step.say;
    const slot = close ? null : step.slot;
    const seq = pushAi(say, slot);
    if (dropLeft > 0) {
      dropLeft -= 1; // 저장 · 답은 했지만 응답을 잃음
      return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } };
    }
    return ok({
      ok: true,
      reply: { seq, slot, text: say, source: !step || (left <= 0 && !step.done) ? 'preset' : step.source },
      turn: s.userTurns,
      turns_left: left,
      done: close,
      fallback: step?.source === 'fallback',
      guard: masked ? 'flagged' : 'ok',
      behavior_saved: saved,
    });
  }

  async function analyze(u: DemoChatUser, email: string, body: Row): Promise<{ data: unknown; error: unknown }> {
    if (scene(email, 'v6off')) return ok({ off: true });
    const s = find(u, body.session_id);
    if (!s) return { data: null, error: { name: 'FunctionsHttpError', message: 'not_found', context: { status: 404 } } };
    if (s.state !== 'wrap' && s.state !== 'done') return { data: null, error: { name: 'FunctionsHttpError', message: 'invalid_state', context: { status: 409 } } };
    if (scene(email, 'v6wait')) {
      s.analysis = 'waiting';
      return ok({ ok: false, status: 'waiting' });
    }
    s.analysis = 'done';
    return ok({ ok: true, status: 'done', version: 1, fixed: 0 });
  }

  const client = {
    auth: base.auth,
    from: (name: string) => {
      const t = inner.from(name);
      if (name !== 'consents') return t;
      return {
        ...t,
        insert: async (rows: Row[]) => {
          const { user } = await me();
          if (Array.isArray(rows)) for (const r of rows) if (r.item_code === 'CK16' && r.agreed === true) user.ck16 = true;
          return t.insert(rows);
        },
      };
    },
    rpc: async (name: string, args: Row = {}) => {
      const fn = rpcs[name];
      if (!fn) return inner.rpc(name, args);
      const { user, email } = await me();
      await sleep(latency);
      return fn(user, email, args);
    },
    functions: {
      invoke: async (name: string, opts: { body?: unknown } = {}) => {
        if (name !== 'survey-interview' && name !== 'survey-analyze') return inner.functions.invoke(name, opts);
        const { user, email } = await me();
        await sleep(latency);
        const body = isRecord(opts.body) ? opts.body : {};
        return name === 'survey-interview' ? interview(user, email, body) : analyze(user, email, body);
      },
    },
  };
  return client as unknown as SupabaseClient;
}
