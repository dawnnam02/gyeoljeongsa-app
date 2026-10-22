// 데모 모드 모의 서버의 사전 오픈 부분(F22 · K20 4-5 '데모'). 메모리에만 있고 서버에 요청하지 않으며 기기에 아무것도 저장하지 않는다.
//  응답 모양은 backend/S18_변경기록.md 4장 최신 판(10:21 — 0024 · 0025 · Edge link-application)과 같다. S18 이 만드는 중인 것은 같은 이름(app/F22_변경기록.md 4장):
//   rpc get_launch_state()                → S18 4-1 키(screen · application_linked · region.name · review.fix_reason 포함) + (가정) region.early_join_on
//   rpc get_feature_flags()               → 데모 처음값(featureKeys demoDefault) — 단 prelaunch 는 지금 장면의 단계가 open 이 아니면 켜짐
//   functions.invoke('link-application')  → body { applicant_no, link_code } · 200 { ok, applicant_no } · 400 invalid_code(모양이 아닌 입력은 세지 않음 · 남이 이은 번호는 셈)
//                                            · 409 already_linked(이미 이은 계정) · 429 rate_limited(오늘 5번 틀림) · 401
//   rpc early_join()(S18 만드는 중)       → { ok, starts_on } · 오류 region_locked(지역 양보 불가) · not_waiting
//   rpc get_launch_public()(S18 만드는 중 · 로그인 없이) → { phase, launch_day, launch_text } — 마지막으로 본 계정의 단계(없으면 데모 처음값)
//  잇지 않은 다른 호출은 원래 데모 클라이언트(lib/demoClient · demoBackend)로 그대로 넘긴다(demoBackend.ts 는 고치지 않았다).
//  장면은 이메일 앞부분으로 고르고, 대기 화면의 데모 줄(demo/prelaunchDemoBar)로 바꾼다:
//   prelaunch…      사전 오픈 · 확인 중(사진 확인 중)          prelaunchfix…   보완 요청(사진)
//   prelaunchok…    확정                                      prelaunchno…    함께하기 어려워요(혼인 확인)
//   prelaunchwait…  출시 뒤 권역 기다림(인원)                 prelaunchratio… 출시 뒤 권역 기다림(성비)
//   prelaunchlate…  출시일 7일 미룸(미룸 공지)                prelaunchnew…   출시 뒤 확정 전(screen review, D-123)
//   그 밖 이메일    데모 처음값(prelaunch 꺼짐 → 09 그대로)
//  잇기: 번호 1018-4721 + 코드 246810 = 성공 · 1017-3388 + 135790 = 남이 이은 번호(틀림으로 셈) · 그 밖 = 틀림(하루 5번 틀리면 다음 날까지 rate_limited)
// 여기 값은 가상이다(실제 신청 아님).
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

import { demoDefault, demoSceneDefault, FEATURE_KEY_LIST } from '@/config/featureKeys';
import { EARLY_JOIN_RPC, LAUNCH_PUBLIC_RPC, LAUNCH_RPC, LINK_FUNCTION, type DeclineReason, type Phase, type Region, type ReviewStatus, type Screen, type StepKey, type StepState } from '@/features/prelaunch/launchApi';
import { dayText, normalizeApplicantNo, normalizeLinkCode, timeText } from '@/features/prelaunch/launchLogic';
import { kstToday } from '@/lib/birthDate';

export const DEMO_LAUNCH_DAY = '2026-12-23'; // V5 T-24 출시 = 첫 매칭(수)
export const DEMO_DEFERRED_DAY = '2027-01-01'; // 열린 권역 0 → 7일 미룸(D-108)
export const DEMO_OPEN_TIME = '18:00'; // V5: 수요일 18:00 공개
export const DEMO_LINK = { no: '1018-4721', code: '246810' } as const;
export const DEMO_LINK_TAKEN = { no: '1017-3388', code: '135790' } as const;
export const LINK_DAILY_WRONG = 5; // K20 P-13

export type PrelaunchScene = 'checking' | 'fix' | 'confirmed' | 'declined' | 'regionWait' | 'regionRatio' | 'regionLocked' | 'deferred' | 'reviewOpen' | 'open' | 'prelaunch';
export type DemoPrelaunchUser = { id: string; email: string };
type Steps = Record<StepKey, StepState>;
type UserState = {
  scene: PrelaunchScene | null; // 이메일 장면(없으면 데모 처음값 계정)
  phase: Phase;
  status: ReviewStatus;
  steps: Steps;
  declineReason: DeclineReason | null;
  region: Region | null;
  regionLocked: boolean; // 지역 양보 불가(early_join → region_locked)
  launchDay: string;
  deferred: number;
  applicantNo: string;
  linked: boolean;
  wrong: { day: string; count: number };
};
type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
type FnResult = { data: unknown; error: unknown };

const SCENE_PREFIX: readonly [string, PrelaunchScene][] = [
  ['prelaunchratio', 'regionRatio'],
  ['prelaunchwait', 'regionWait'],
  ['prelaunchlate', 'deferred'],
  ['prelaunchnew', 'reviewOpen'],
  ['prelaunchfix', 'fix'],
  ['prelaunchok', 'confirmed'],
  ['prelaunchno', 'declined'],
  ['prelaunch', 'checking'],
];
export const sceneOfEmail = (email: string): PrelaunchScene | null => {
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  return SCENE_PREFIX.find(([p]) => local.startsWith(p))?.[1] ?? null;
};

const STEPS_CHECKING: Steps = { identity: 'done', photos: 'checking', survey: 'done', docs: 'todo', confirm: 'todo' };
const STEPS_FIX: Steps = { ...STEPS_CHECKING, photos: 'fix' };
const STEPS_DONE: Steps = { identity: 'done', photos: 'done', survey: 'done', docs: 'todo', confirm: 'done' };
const DAY_MS = 24 * 3_600_000;

const httpFailure = (status: number, code: string): FnResult => ({
  data: null,
  error: new FunctionsHttpError(new Response(JSON.stringify({ ok: false, code }), { status, headers: { 'content-type': 'application/json' } })),
});
const launchText = (day: string) => `${dayText(day)} ${timeText(DEMO_OPEN_TIME)}`; // S18 launch_text 와 같은 글
const weekdayOf = (day: string) => (dayText(day) ?? '').split(' ').pop() ?? null;

// 앱 번호(K20 2-5 모양): 접수 날짜 4자리(월일) + 4자리. 데모는 계정 번호에서 정해진 값(무작위 아님 — 화면 점검이 같은 값을 본다)
function appNumber(id: string, todayIso: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 9000;
  let tail = String(1000 + h).padStart(4, '0');
  if (tail === DEMO_LINK.no.slice(5) || tail === DEMO_LINK_TAKEN.no.slice(5)) tail = '5050';
  return `${todayIso.slice(5, 7)}${todayIso.slice(8, 10)}-${tail}`;
}

export function createPrelaunchDemo(options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  const users = new Map<string, UserState>();
  const listeners = new Set<() => void>();
  const takenBy = new Map<string, string>([[DEMO_LINK_TAKEN.no, 'demo-someone-else']]);
  let last: DemoPrelaunchUser | null = null;

  const waitRegion = (reason: 'count' | 'ratio'): Region => ({ name: '동남권', state: 'wait', reason, canEarlyJoin: true, earlyJoinOn: null });
  const apply = (s: UserState, scene: PrelaunchScene) => {
    if (scene === 'prelaunch') {
      s.phase = 'prelaunch';
      s.region = null;
      return;
    }
    if (scene === 'open') {
      s.phase = 'open';
      s.region = { name: '수도권', state: 'open', reason: null, canEarlyJoin: false, earlyJoinOn: null };
      return;
    }
    if (scene === 'deferred') {
      s.phase = 'prelaunch';
      s.region = null;
      s.launchDay = DEMO_DEFERRED_DAY;
      s.deferred = 1;
      return;
    }
    const regional = scene === 'regionWait' || scene === 'regionRatio' || scene === 'regionLocked';
    s.phase = regional || scene === 'reviewOpen' ? 'open' : 'prelaunch';
    s.status = scene === 'checking' || scene === 'reviewOpen' ? 'in_review' : scene === 'fix' ? 'needs_more' : scene === 'declined' ? 'declined' : 'confirmed';
    s.steps = scene === 'checking' || scene === 'reviewOpen' ? { ...STEPS_CHECKING } : scene === 'fix' ? { ...STEPS_FIX } : scene === 'declined' ? { ...STEPS_CHECKING, photos: 'done', confirm: 'todo' } : { ...STEPS_DONE };
    s.declineReason = scene === 'declined' ? 'married' : null;
    s.region = regional ? waitRegion(scene === 'regionRatio' ? 'ratio' : 'count') : null;
    s.regionLocked = scene === 'regionLocked';
  };

  const stateOf = (user: DemoPrelaunchUser): UserState => {
    let s = users.get(user.id);
    if (!s) {
      const scene = sceneOfEmail(user.email);
      s = {
        scene,
        phase: demoDefault('prelaunch') ? 'prelaunch' : 'open', // 데모 처음값(꺼짐) → 09 그대로
        status: 'confirmed',
        steps: { ...STEPS_DONE },
        declineReason: null,
        region: null,
        regionLocked: false,
        launchDay: DEMO_LAUNCH_DAY,
        deferred: 0,
        applicantNo: appNumber(user.id, kstToday(now())),
        linked: false,
        wrong: { day: '', count: 0 },
      };
      if (scene) apply(s, scene);
      users.set(user.id, s);
    }
    return s;
  };

  // S18 4-1 screen: 공개 전 wait · 공개 뒤 확정 전 review · 확정 + 권역 기다림 region_wait · 그 밖 recommend
  const screenOf = (s: UserState): Screen => (s.phase !== 'open' ? 'wait' : s.status !== 'confirmed' ? 'review' : s.region?.state === 'wait' ? 'region_wait' : 'recommend');
  const fixOf = (s: UserState): string | null => (s.steps.identity === 'fix' ? 'identity_age' : s.steps.photos === 'fix' ? 'photo_face' : s.steps.docs === 'fix' ? 'doc_job' : null);
  const launchState = (s: UserState): Row => ({
    screen: screenOf(s),
    phase: s.phase,
    launch_day: s.launchDay,
    launch_weekday: weekdayOf(s.launchDay),
    open_time: DEMO_OPEN_TIME,
    launch_text: launchText(s.launchDay),
    deferred_count: s.deferred,
    applicant_no: s.applicantNo,
    application_linked: s.linked,
    review: { status: s.status, steps: (Object.keys(s.steps) as StepKey[]).map((step) => ({ step, state: s.steps[step] })), decline_reason: s.declineReason, fix_reason: fixOf(s), vouched_by: null },
    region: s.region ? { name: s.region.name, state: s.region.state, reason: s.region.reason, can_early_join: s.region.canEarlyJoin, early_join_on: s.region.earlyJoinOn } : null,
  });

  const notify = () => listeners.forEach((l) => l());

  return {
    rpc(user: DemoPrelaunchUser | null, name: string): DbResult {
      if (name === LAUNCH_PUBLIC_RPC) {
        // 로그인 없이: 마지막으로 본 계정의 단계(데모 하나에 계정 하나), 없으면 데모 처음값
        const s = last ? stateOf(last) : null;
        const day = s?.launchDay ?? DEMO_LAUNCH_DAY;
        return { data: { phase: s?.phase ?? (demoDefault('prelaunch') ? 'prelaunch' : 'open'), launch_day: day, launch_text: launchText(day) }, error: null };
      }
      if (!user) return { data: null, error: { code: '42501', message: 'forbidden' } };
      last = user;
      const s = stateOf(user);
      if (name === LAUNCH_RPC) return { data: launchState(s), error: null };
      if (name === EARLY_JOIN_RPC) {
        if (!s.region || s.region.state !== 'wait' || !s.region.canEarlyJoin) return { data: null, error: { code: 'P0001', message: 'not_waiting' } };
        if (s.regionLocked) return { data: null, error: { code: 'P0001', message: 'region_locked' } };
        const startsOn = kstToday(now() + DAY_MS); // 다음 날 09:00 부터(K20 3-4 ②)
        s.region = { ...s.region, canEarlyJoin: false, earlyJoinOn: startsOn };
        notify();
        return { data: { ok: true, starts_on: startsOn }, error: null };
      }
      // get_feature_flags: 데모 처음값 + prelaunch 는 지금 단계(open 이 아니면 켜짐)
      const keys = FEATURE_KEY_LIST.filter((k) => !k.pending).map((k) => k.key);
      return {
        data: {
          flags: Object.fromEntries(keys.map((k) => [k, k === 'prelaunch' ? s.phase !== 'open' : demoSceneDefault(k, user.email)])),
          modes: Object.fromEntries(keys.map((k) => [k, 'demo'])),
        },
        error: null,
      };
    },

    // S18 4-2 · 6장 '잇기 셈'과 같은 순서
    link(user: DemoPrelaunchUser | null, body: unknown): FnResult {
      if (!user) return httpFailure(401, 'unauthorized');
      last = user;
      const s = stateOf(user);
      const b = (typeof body === 'object' && body !== null ? body : {}) as Row;
      const no = typeof b.applicant_no === 'string' ? normalizeApplicantNo(b.applicant_no) : null;
      const code = typeof b.link_code === 'string' ? normalizeLinkCode(b.link_code) : null; // S18 최신: 본문 키 link_code(옛 키 code 는 받지 않음)
      if (!no || !code) return httpFailure(400, 'invalid_code'); // 모양이 아닌 입력도 같은 답 · 세지 않음
      if (s.linked) return httpFailure(409, 'already_linked'); // 이미 이은 계정 · 세지 않음
      const today = kstToday(now());
      if (s.wrong.day !== today) s.wrong = { day: today, count: 0 };
      if (s.wrong.count >= LINK_DAILY_WRONG) return httpFailure(429, 'rate_limited'); // 6번째부터 다음 날까지(TP-08)
      const owner = takenBy.get(no);
      if (!owner && no === DEMO_LINK.no && code === DEMO_LINK.code) {
        takenBy.set(no, user.id);
        s.linked = true;
        s.applicantNo = no; // 이으면 앱 번호 대신 신청 번호(K20 2-7)
        notify();
        return { data: { ok: true, applicant_no: no }, error: null };
      }
      s.wrong.count += 1; // 틀림 · 남이 이은 번호(코드를 맞춰 볼 수 없음)
      return httpFailure(400, 'invalid_code');
    },

    // 데모 줄 · 화면 점검: 마지막으로 부른 계정의 장면을 바꾼다
    setScene(scene: PrelaunchScene): void {
      if (!last) return;
      apply(stateOf(last), scene);
      notify();
    },
    // 이메일 장면 계정인가(데모 줄 · 09 위 '다시 켜기'를 보일지)
    sceneAccount(): boolean {
      return last ? stateOf(last).scene !== null : false;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    peek(): Row | null {
      if (!last) return null;
      const s = stateOf(last);
      return { ...launchState(s), wrong_today: s.wrong.count, scene: s.scene };
    },
  };
}

export type PrelaunchDemo = ReturnType<typeof createPrelaunchDemo>;

const HANDLED_RPC = [LAUNCH_RPC, 'get_feature_flags', EARLY_JOIN_RPC, LAUNCH_PUBLIC_RPC];

// 원래 데모 클라이언트에 사전 오픈 호출만 얹는다(나머지는 그대로 넘김)
export function withPrelaunchDemo(client: SupabaseClient, demo: PrelaunchDemo): SupabaseClient {
  const who = async (): Promise<DemoPrelaunchUser | null> => {
    const { data } = await client.auth.getSession();
    const u = data.session?.user;
    return u && typeof u.id === 'string' ? { id: u.id, email: u.email ?? '' } : null;
  };
  return {
    auth: client.auth,
    from: (table: string) => client.from(table),
    storage: client.storage,
    rpc: async (name: string, args?: Row) => (HANDLED_RPC.includes(name) ? demo.rpc(await who(), name) : client.rpc(name, args)),
    functions: {
      invoke: async (name: string, options?: Parameters<SupabaseClient['functions']['invoke']>[1]) => (name === LINK_FUNCTION ? demo.link(await who(), options?.body) : client.functions.invoke(name, options)),
    },
  } as unknown as SupabaseClient;
}

let appDemo: PrelaunchDemo | null = null;
// 앱 하나에 모의 사전 오픈 하나. 웹(테스트 웹)에서는 화면 점검(scripts/web-f22.mjs)이 볼 수 있게 읽기 창구 · 장면 바꾸기를 연다(데모 모드에서만 만들어진다)
export function appPrelaunchDemo(): PrelaunchDemo {
  if (!appDemo) {
    appDemo = createPrelaunchDemo();
    const host = globalThis as { document?: unknown; __prelaunchPeek?: unknown; __prelaunchScene?: unknown };
    if (host.document !== undefined) {
      host.__prelaunchPeek = appDemo.peek;
      host.__prelaunchScene = appDemo.setScene;
    }
  }
  return appDemo;
}
