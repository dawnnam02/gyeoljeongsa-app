// 사전 오픈(K20 · F22)이 서버와 주고받는 일. 이름 · 모양은 backend/S18_변경기록.md 4장 최신 판(10:21 — 0024 · 0025 · Edge link-application)에 맞췄다.
//  get_launch_state()  RPC(로그인) → { screen: 'wait'|'review'|'region_wait'|'recommend', phase: 'prelaunch'|'warming'|'open', launch_day: 'YYYY-MM-DD'|null,
//                              launch_weekday: '금요일', open_time: 'HH:MM', launch_text: '12월 25일 금요일 오전 9시', deferred_count: 0|1|2,
//                              applicant_no: 'MMDD-NNNN'|null, application_linked: boolean,
//                              review: { status, steps: [{step, state}] (늘 5개), decline_reason, fix_reason, vouched_by } | null,
//                              region: null | { name: '수도권' 등 6, state: 'open'|'wait', reason: 'count'|'ratio'|'cell'|null, can_early_join } }
//                      · 추천 탭이 그릴 화면은 screen 하나로 고른다(phase · review.status · region 조합과 같은 답, S18 4-1). screen 이 없으면(옛 서버) phase · region 으로
//                      · 로그인 없음 42501 · 정지 · 탈퇴 = null 응답 → 둘 다 09 가 원래 하던 대로(session)
//  link-application    Edge(로그인) body { applicant_no, link_code } → 200 { ok: true, applicant_no } · 400 invalid_code · 409 already_linked(이미 이은 계정)
//                      · 429 rate_limited(하루 5번 틀림) · 그 밖(invalid_request · unauthorized · forbidden · method_not_allowed · server_error) = 서버 · 로그인 글
//  early_join()        RPC → { ok: true, starts_on } · 오류 region_locked(지역 양보 불가) · not_waiting · forbidden — S18 4-4(D-132)와 같음. region.early_join_on · can_early_join 도 S18 4-1 그대로
//  get_launch_public() RPC(로그인 없이) → { phase, launch_day, launch_weekday, open_time, launch_text } — 01 온보딩 마지막 장 출시일 줄. S18 4-5(D-132)와 같음
//  · 아는 키만 읽는다. 다른 회원 수 · 인원 · 순번 · 진행 % 같은 키는 와도 버린다(K20 2-2 · P-10). 모르는 phase 는 prelaunch(닫힌 쪽)로 읽는다
//  · 로그에는 이벤트 이름과 코드만(번호 · 코드 원문 0)
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from '@/lib/log';
import { readDbFailure, readFunctionFailure } from '@/lib/serverError';

export type Phase = 'prelaunch' | 'warming' | 'open';
export type StepKey = 'identity' | 'photos' | 'survey' | 'docs' | 'confirm';
export type StepState = 'todo' | 'checking' | 'done' | 'fix' | 'na';
export type ReviewStatus = 'received' | 'in_review' | 'needs_more' | 'confirmed' | 'declined';
export type DeclineReason = 'under_24' | 'married' | 'fake' | 'forged';
export type Region = { name: string | null; state: 'open' | 'wait'; reason: 'count' | 'ratio' | 'cell' | null; canEarlyJoin: boolean; earlyJoinOn: string | null };
export type FixReason = 'identity_age' | 'photo_face' | 'photo_full' | 'photo_free' | 'doc_school' | 'doc_job' | 'doc_asset';
export type Review = { status: ReviewStatus; steps: { step: StepKey; state: StepState }[]; declineReason: DeclineReason | null; fixReason: FixReason | null; vouchedBy: string | null };
export type Screen = 'wait' | 'review' | 'region_wait' | 'recommend';
export type LaunchState = {
  screen: Screen | null; // 서버가 고른 추천 탭 화면(없으면 옛 서버 — phase · region 으로 고른다)
  phase: Phase;
  launchDay: string | null;
  openTime: string;
  launchText: string | null; // 서버가 만든 '12월 25일 금요일 오전 9시'(있으면 그대로 쓴다)
  deferredCount: number; // 미룸 횟수 — 늘었으면 미룸 공지를 한 번
  applicantNo: string | null;
  linked: boolean;
  review: Review | null;
  region: Region | null;
};
export type LaunchFailure = 'network' | 'server' | 'missing' | 'session';
export type LaunchLoad = { ok: true; state: LaunchState } | { ok: false; reason: LaunchFailure };
export type LinkFailure = 'invalid' | 'already' | 'limit' | 'session' | 'network' | 'server';
export type LinkResult = { ok: true; applicantNo: string } | { ok: false; reason: LinkFailure };
export type EarlyJoinResult = { ok: true; startsOn: string | null } | { ok: false; reason: 'locked' | 'not_waiting' | 'missing' | 'network' | 'server' };
export type LaunchPublic = { phase: Phase; launchDay: string | null; launchText: string | null };

export const LAUNCH_RPC = 'get_launch_state';
export const LINK_FUNCTION = 'link-application';
export const EARLY_JOIN_RPC = 'early_join'; // S18 4-4
export const LAUNCH_PUBLIC_RPC = 'get_launch_public'; // S18 4-5

const STEPS: readonly StepKey[] = ['identity', 'photos', 'survey', 'docs', 'confirm'];
const STEP_STATES: readonly StepState[] = ['todo', 'checking', 'done', 'fix', 'na'];
const STATUSES: readonly ReviewStatus[] = ['received', 'in_review', 'needs_more', 'confirmed', 'declined'];
const REASONS: readonly DeclineReason[] = ['under_24', 'married', 'fake', 'forged'];
const FIX_REASONS: readonly FixReason[] = ['identity_age', 'photo_face', 'photo_full', 'photo_free', 'doc_school', 'doc_job', 'doc_asset'];
const NO_SHAPE = /^\d{4}-\d{4}$/;
const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const day = (v: unknown): string | null => (typeof v === 'string' && DAY_SHAPE.test(v) ? v : null);
const phaseOf = (v: unknown): Phase => pick(v, ['prelaunch', 'warming', 'open'] as const) ?? 'prelaunch'; // 모르는 값은 닫힌 쪽
// 서버가 만든 출시일 글은 날짜 · 요일 · 시각 글자만 받는다(숫자 셈 · 남은 날 글이 섞이면 쓰지 않고 앱이 만든다)
const launchTextOf = (v: unknown): string | null => {
  const t = str(v);
  return t && /^\d{1,2}월 \d{1,2}일 [일월화수목금토]요일 오[전후] \d{1,2}시( \d{1,2}분)?$/.test(t) ? t : null;
};

function readReview(raw: unknown): Review | null {
  if (!isRecord(raw)) return null;
  const status = pick(raw.status, STATUSES);
  if (!status) return null;
  const list = Array.isArray(raw.steps) ? raw.steps : [];
  // 칸은 늘 5개 · 이 순서(K20 2-2). 서버가 빠뜨린 칸은 '아직'
  const steps = STEPS.map((step) => {
    const row = list.find((x) => isRecord(x) && x.step === step) as Record<string, unknown> | undefined;
    return { step, state: pick(row?.state, STEP_STATES) ?? 'todo' };
  });
  return {
    status,
    steps,
    declineReason: status === 'declined' ? pick(raw.decline_reason, REASONS) : null,
    fixReason: pick(raw.fix_reason, FIX_REASONS),
    vouchedBy: str(raw.vouched_by),
  };
}

function readRegion(raw: unknown): Region | null {
  if (!isRecord(raw)) return null;
  const state = pick(raw.state, ['open', 'wait'] as const);
  if (!state) return null;
  return {
    name: str(raw.name) ?? str(raw.region), // S18 최신: name(그 전 판: region)
    state,
    reason: pick(raw.reason, ['count', 'ratio', 'cell'] as const),
    canEarlyJoin: raw.can_early_join === true,
    earlyJoinOn: day(raw.early_join_on),
  };
}

// 응답 → LaunchState. 모양이 아니면 null(못 읽음)
export function parseLaunchState(raw: unknown): LaunchState | null {
  if (!isRecord(raw)) return null;
  const no = str(raw.applicant_no);
  const deferred = typeof raw.deferred_count === 'number' && Number.isInteger(raw.deferred_count) && raw.deferred_count >= 0 ? raw.deferred_count : 0;
  return {
    screen: pick(raw.screen, ['wait', 'review', 'region_wait', 'recommend'] as const),
    phase: phaseOf(raw.phase),
    launchDay: day(raw.launch_day),
    openTime: typeof raw.open_time === 'string' && /^\d{2}:\d{2}/.test(raw.open_time) ? raw.open_time.slice(0, 5) : '09:00',
    launchText: launchTextOf(raw.launch_text),
    deferredCount: deferred,
    applicantNo: no && NO_SHAPE.test(no) ? no : null,
    linked: raw.application_linked === true,
    review: readReview(raw.review),
    region: readRegion(raw.region),
  };
}

// 서버에 함수가 아직 없다(S18 전 서버): PostgREST 'PGRST202' · Postgres '42883'
const isMissing = (code: string | null, message: string) => code === 'PGRST202' || code === '42883' || /could not find the function/i.test(message);
// 로그인이 없거나 풀림(권한 42501 · JWT PGRST301/PGRST303): 09 화면이 원래 하던 대로 처리한다
const isSession = (code: string | null) => code === '42501' || code === 'PGRST301' || code === 'PGRST303';
const failureOf = (error: { code?: string | null; message?: string | null }): LaunchFailure => {
  const f = readDbFailure(error);
  return isMissing(f.code, String(error.message ?? '')) ? 'missing' : f.network ? 'network' : isSession(f.code) ? 'session' : 'server';
};

export function createLaunchApi(client: SupabaseClient) {
  return {
    async load(): Promise<LaunchLoad> {
      try {
        const { data, error } = await client.rpc(LAUNCH_RPC);
        if (error) {
          const reason = failureOf(error);
          safeLog({ event: 'launch.load.fail', code: error.code ?? reason });
          return { ok: false, reason };
        }
        if (data === null) return { ok: false, reason: 'session' }; // 정지 · 탈퇴(쓸 수 없는 계정) — 09 가 원래 하던 대로
        const state = parseLaunchState(data);
        if (!state) {
          safeLog({ event: 'launch.load.fail', code: 'shape' });
          return { ok: false, reason: 'server' };
        }
        return { ok: true, state };
      } catch {
        safeLog({ event: 'launch.load.fail', code: 'client' });
        return { ok: false, reason: 'network' };
      }
    },

    // 신청 잇기(K20 2-7 · P-13). 번호 · 코드 모양은 화면이 먼저 거른다(launchLogic normalize*)
    async link(applicantNo: string, linkCode: string): Promise<LinkResult> {
      try {
        const { data, error } = await client.functions.invoke(LINK_FUNCTION, { body: { applicant_no: applicantNo, link_code: linkCode } });
        if (error) {
          const f = await readFunctionFailure(error);
          const reason: LinkFailure = f.network
            ? 'network'
            : f.code === 'invalid_code'
              ? 'invalid'
              : f.code === 'already_linked'
                ? 'already'
                : f.code === 'rate_limited' || f.status === 429
                  ? 'limit'
                  : f.code === 'unauthorized' || f.status === 401
                    ? 'session'
                    : 'server';
          safeLog({ event: 'launch.link.fail', code: f.code ?? reason });
          return { ok: false, reason };
        }
        const no = isRecord(data) ? str(data.applicant_no) : null;
        if (!isRecord(data) || data.ok !== true || !no || !NO_SHAPE.test(no)) {
          safeLog({ event: 'launch.link.fail', code: 'shape' });
          return { ok: false, reason: 'server' };
        }
        safeLog({ event: 'launch.link.ok' });
        return { ok: true, applicantNo: no };
      } catch {
        safeLog({ event: 'launch.link.fail', code: 'client' });
        return { ok: false, reason: 'network' };
      }
    },

    // [지역 넓혀 먼저 시작하기](K20 3-4 ② · NP-18) — 본인이 확인 한 줄 뒤에 누를 때만. 서버가 양보 불가를 대신 풀지 않는다
    async earlyJoin(): Promise<EarlyJoinResult> {
      try {
        const { data, error } = await client.rpc(EARLY_JOIN_RPC);
        if (error) {
          const f = readDbFailure(error);
          const msg = String(error.message ?? '');
          const reason = isMissing(f.code, msg) ? 'missing' : f.network ? 'network' : /region_locked/.test(msg) ? 'locked' : /not_waiting/.test(msg) ? 'not_waiting' : 'server';
          safeLog({ event: 'launch.early.fail', code: f.code ?? reason });
          return { ok: false, reason };
        }
        if (!isRecord(data) || data.ok !== true) return { ok: false, reason: 'server' };
        return { ok: true, startsOn: day(data.starts_on) };
      } catch {
        return { ok: false, reason: 'network' };
      }
    },

    // 로그인 없이 읽는 출시일(01 온보딩 마지막 장). 못 읽으면 null — 화면은 줄을 그리지 않는다
    async loadPublic(): Promise<LaunchPublic | null> {
      try {
        const { data, error } = await client.rpc(LAUNCH_PUBLIC_RPC);
        if (error || !isRecord(data)) return null;
        return { phase: phaseOf(data.phase), launchDay: day(data.launch_day), launchText: launchTextOf(data.launch_text) };
      } catch {
        return null;
      }
    },
  };
}

export type LaunchApi = ReturnType<typeof createLaunchApi>;
