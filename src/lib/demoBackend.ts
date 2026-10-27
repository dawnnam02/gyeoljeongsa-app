// 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)의 모의 서버. 메모리에만 있고 서버에 요청하지 않으며 기기에 아무것도 저장하지 않는다.
// 실제 서버가 하는 일 중 02 가입 · 03 동의 흐름에 필요한 만큼만 같은 규칙으로 흉내 낸다(F8 범위의 최소분: F1 이 쓰는 것뿐).
//   otp-gate        인증번호 발송(같은 이메일 24시간 5번 · 60초 간격) · 확인(5번 틀리면 10분 잠금 · 3분 안에 입력)
//   underage-reject 만 19세 판정(첫 거절부터 30일 안에 3번이면 30일 잠금)
//   save_answers    A01 생년월일 저장
//   account_status · profiles · consents  본인 행 읽기 · 동의 기록 넣기
//   04 · 05 임시 설문(F2L) get_progress 의 설문 · 사진 진행은 lib/surveyLiteDemo.ts 메모리(demoLiteProgress)에서 읽는다
//   11 호감(F6)     list_likes · accept_like · decline_like · 10 의 받은 · 보낸 · 연결 상태(lib/likesDemo.ts, 0011 거절 숨김)
//   12 설정(F7)     list_blocked_users · unblock_user · list_my_reports · revoke_consent · profiles 알림 열 · delete-account(lib/settingsDemo.ts)
// 메일은 보내지 않는다. 인증번호는 항상 DEMO_OTP_CODE 이고, 화면이 데모 모드에서만 이 번호를 알려 준다(데모 안내).
// 모의 규칙은 실제 서버(backend/functions · migrations)와 같은 이름 · 같은 오류 코드를 쓴다. 서버 규칙이 바뀌면 여기도 맞춘다.
import { FunctionsHttpError } from '@supabase/supabase-js';

import { editionOf } from '@/config/consent';
import { kkFromEmail, mePhotoKey, photoKeyOf, type PhotoSlotName } from '@/demo/people';
import { demoPhotoUri } from '@/demo/peoplePhotos';
import { adultCutoff, birthDigitsToIso, BIRTH_MIN, kstToday } from './birthDate';
import { isValidEmail, normalizeEmail } from './emailRules';
import { DEMO_AI_RESULT, DEMO_MANUAL_INITIAL } from './demoAiSample';
import { OTP_LOCK_SECONDS, OTP_VALID_SECONDS } from './otpClock';
import { createDemoRecs, type RecsAccess } from './demoRecs';
import { createDemoLikes, type DemoLikesUser } from './likesDemo';
import { createDemoShop, type DemoShopUser } from './shopDemo';
import { demoLiteProgress } from './surveyLiteDemo';
import { createDemoSettings, type DemoSettingsUser } from './settingsDemo';
import { createDemoV4 } from './v4Demo';
import { createDemoBoarding } from '@/demo/boardingDemo';

export const DEMO_OTP_CODE = '123456';

// 06 AI 정리 모의 응답 3종(F3): ok 정상 · fail 실패(다시 시도해도 계속 실패 → 3번째부터 직접 입력) · slow 지연(60초를 넘겨 끝난다)
export type DemoAiScenario = 'ok' | 'fail' | 'slow';
export const DEMO_AI_DELAY_MS: Readonly<Record<DemoAiScenario, number>> = { ok: 4_000, fail: 4_000, slow: 75_000 };

const DAY_MS = 24 * 60 * 60 * 1000;
const SEND_LIMIT = 5; // 같은 이메일 24시간 5번
const SEND_GAP_MS = 60 * 1000;
const WRONG_LIMIT = 5;
const UNDERAGE_LIMIT = 3;
const UNDERAGE_WINDOW_MS = 30 * DAY_MS;

type DemoConsent = { item_code: string; agreed: boolean; text_version: string; revoked_at: string | null };
type DemoAiCase = {
  id: string;
  createdAt: number;
  scenario: DemoAiScenario;
  retryCount: number;
  runStartedAt: number; // 지금 돌고 있는(또는 마지막) 처리가 시작된 시각
  source: 'ai' | 'manual';
  edited: Record<string, unknown> | null; // user_edited
  manualDone: boolean;
  confirmedAt: number | null;
};
type DemoAccount = {
  id: string;
  email: string;
  birthDate: string | null;
  consents: DemoConsent[];
  aiCases: DemoAiCase[];
  active: boolean;
  visibility: Record<string, boolean>; // 공개 범위 토글 9열(F4)
  reviewAcked: boolean; // 07 직후 '처음 한 번 확인'을 마쳤는가(F4)
  surveySkipped?: boolean; // 데모 줄 '설문 완료 · 정상 응답'(DemoSkipBar)으로 설문을 건너뜀 — 탑승 관문에서는 설문을 다 마친 사람으로 본다(B0)
  religionCleared?: boolean; // 3부-사: 건너뛴 계정이 설정에서 CK4 를 거둠 → 실서버처럼 종교 '답하지 않음'(설문에서 다시 답하기 전까지 religion_missing)
};

// 공개 범위 토글 9열의 처음값(backend/스키마.md visibility_settings: 켜짐 7 · 꺼짐 2)
export const DEMO_VISIBILITY_DEFAULTS: Readonly<Record<string, boolean>> = {
  a06_religion: true,
  a07_marital_history: true,
  a08_children: true,
  b02_school: false,
  c02_employer: false,
  c05_income: true,
  c06_assets: true,
  d03_parent_education: true,
  d04_parent_assets: true,
};

// F4 모의 데이터: 이메일 앞부분으로 장면을 고른다(savefail = 저장이 인터넷 문제로 실패 · photook = 사진 3장 승인 · photoreject = 얼굴 사진 반려)
const DEMO_ANSWERS: Readonly<Record<string, unknown>> = {
  A12: '이하나',
  A03: { sido: '서울', sigungu: '마포구' },
  A06: '무교',
  A07: '초혼',
  A08: '없음',
  B02: '숙명여자대학교', // F24: 설문 v2 학교 목록에 있는 이름(데모 인물 n 13 과 같은 사람)
  C02: null, // 비워 둔 직장명 → 토글이 꺼짐·잠금(N15)
  C05: '4천만~6천만 원',
  C06: '1억~3억 원',
  D03: '대졸',
  D04: '답하지 않음', // 답하지 않음 → 잠금
};
type DemoSession = { access_token: string; refresh_token: string; expires_in: number; token_type: 'bearer'; user: { id: string; email: string } };
type Gate = { sends: number[]; sentAt: number | null; wrong: number; lockedUntil: number };
type Reject = { times: number[]; lockedUntil: number };
type DbError = { code: string; message: string };
type DbResult<T> = Promise<{ data: T | null; error: DbError | null }>;
type FunctionOptions = { body?: unknown } | undefined;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// 서버가 2xx 가 아닌 값을 준 것처럼 돌려준다(supabase.functions.invoke 와 같은 모양)
const httpFailure = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
  data: null,
  error: new FunctionsHttpError(jsonResponse(status, { ok: false, code, ...extra })),
});
const success = (body: unknown) => ({ data: body, error: null });

// '1995-03-12' · '19950312' → 'YYYY-MM-DD' 또는 null(실제 있는 날짜가 아님). 서버 parseBirthDate 와 같다.
function parseBirth(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (/^\d{8}$/.test(t)) return birthDigitsToIso(t);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m ? birthDigitsToIso(`${m[1]}${m[2]}${m[3]}`) : null;
}

const DEMO_MANUAL_TAGS = ['활발함', '차분함', '조용한 편', '계획적', '꼼꼼함', '즉흥적', '유연함', '가족 중심', '독립적', '저축 우선', '각자 관리', '대화로 해결', '배려하는 편', '맞벌이 선호', '가사 반반', '여행 좋아해요'];
const TRAIT_KEYS_DEMO = ['extraversion', 'planning', 'family', 'economy', 'conflict'] as const;

// 서버 검사식 private.validate_ai_edit 과 같은 규칙: traits 5축 모두 0~100 정수 · tags 0~5개 각 1~8자 · summary 200자 이하, 다른 키 없음
function readEdited(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !['traits', 'tags', 'summary'].includes(k))) return null;
  const traits = v.traits as Record<string, unknown> | undefined;
  if (typeof traits !== 'object' || traits === null) return null;
  const bad = (k: string) => typeof traits[k] !== 'number' || !Number.isInteger(traits[k]) || (traits[k] as number) < 0 || (traits[k] as number) > 100;
  if (Object.keys(traits).length !== 5 || TRAIT_KEYS_DEMO.some(bad)) return null;
  if (v.tags !== undefined && v.tags !== null) {
    if (!Array.isArray(v.tags) || v.tags.length > 5 || v.tags.some((x) => typeof x !== 'string' || x.length < 1 || x.length > 8)) return null;
  }
  if (v.summary !== undefined && v.summary !== null && (typeof v.summary !== 'string' || v.summary.length > 200)) return null;
  return { traits: v.traits, tags: v.tags ?? [], summary: v.summary ?? '' };
}

// photoUri(F24): 데모 인물 사진 키(p01_face …) → 화면이 쓰는 주소. 처음값은 app/assets/demo/people 의 파일(데모 모드에서만 불러옴, 없으면 null → 404 → 기본 그림)
export function createDemoBackend(options: { now?: () => number; aiDelayMs?: Partial<Record<DemoAiScenario, number>>; photoUri?: (key: string) => string | null } = {}) {
  const now = options.now ?? Date.now;
  const photoUri = options.photoUri ?? demoPhotoUri;
  const aiDelay = (scenario: DemoAiScenario) => options.aiDelayMs?.[scenario] ?? DEMO_AI_DELAY_MS[scenario];
  // 16 상점 · 등급(F13)이 09 · 10 에 주는 것: 구독자 순서 · 상대 등급 배지. 두 모의 서버가 서로 필요해서 연결을 나중에 채운다
  const recsAccess: RecsAccess = { subscriber: () => false, gradeNo: () => null };
  const recs = createDemoRecs(now, recsAccess); // 09 · 10 (F5)
  // 끼리끼리 장면(F24): 데모 줄(demo_kin_me)로 바꾼 '나'의 등급. 없으면 이메일 kk1~kk9, 그것도 없으면 shopDemo 처음값 4
  const kinMe = new Map<string, number>();
  const shop = createDemoShop(now, { recs, kin: (u) => kinMe.get(u.id) ?? kkFromEmail(u.email) }); // 16 상점 · 등급 · 1회 매칭(F13)
  recsAccess.kinOn = (userId) => kinMe.has(userId);
  const shopUsers = new Map<string, DemoShopUser>(); // 구독자 질문은 사용자 번호로 오므로 마지막으로 본 계정의 이메일(장면)을 기억한다
  recsAccess.subscriber = (userId) => {
    const u = shopUsers.get(userId);
    return u ? shop.subscriber(u) : false;
  };
  recsAccess.gradeNo = (userId) => {
    const u = shopUsers.get(userId);
    return u ? shop.gradeNo(u) : null;
  };
  const likes = createDemoLikes({ now, people: (id) => recs.person(id) }); // 11 호감(F6)
  const settings = createDemoSettings({ now, people: (id) => recs.person(id) ?? likes.person(id) }); // 12 설정(F7). 11 에서 차단한 가상 사람도 이름이 나온다
  // V5 W6: 탑승권 · 크레딧(서버 0030 · 0032 · 0037 이름 · 모양). 탑승 관문(검수 B0, 10-27): 실서버 ticket_profile_ready 와 같은 조건 —
  //  설문 모의 서버(demo/surveyV2Backend 공유 기록)의 CK15 + 정치 답 + 종교 답 · 등급(멈춤 = 상점 모의 서버 계산 멈춤 · 계산 전 = 이메일 gradenew).
  //  0039 reason_detail 과 같은 차례(정치 → 등급 멈춤 → 등급 아직 → 종교). 데모 줄로 설문을 건너뛴 계정 · 설문 기록이 없는 장면 · 시험 계정은 설문 몫을 준비됨으로 본다
  const boarding = createDemoBoarding({
    profileDetail: (u) => {
      const acct = [...accounts.values()].find((a) => a.id === u.id);
      const skipped = !!acct?.surveySkipped;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { demoSurveyDetail, demoSurveyReligionOk } = require('@/demo/surveyV2Backend') as typeof import('@/demo/surveyV2Backend');
      let survey = skipped ? null : (demoSurveyDetail(u.id) ?? null);
      if (skipped && acct?.religionCleared && !demoSurveyReligionOk(u.id)) survey = 'religion_missing';
      if (survey === 'politics_missing') return survey;
      if (!shop.peek(u).processing) return 'grade_paused';
      if (u.email.split('@')[0].toLowerCase().includes('gradenew')) return 'grade_pending';
      return survey;
    },
  });
  const v4 = createDemoV4({ now }); // F22 · D-134: 기능 스위치(get_feature_flags)만 잇는다 — 강조 · 만남 뒤 피드백 응답은 F19 2단계 몫
  const accounts = new Map<string, DemoAccount>();
  const gates = new Map<string, Gate>();
  const rejects = new Map<string, Reject>();
  let session: DemoSession | null = null;
  let seq = 0;
  const confirmTries = new Map<string, number>(); // 장면 cfcycle: 07 확정 실패 4종을 차례로(D8 3차 캡처)

  const gateOf = (email: string): Gate => {
    let gate = gates.get(email);
    if (!gate) {
      gate = { sends: [], sentAt: null, wrong: 0, lockedUntil: 0 };
      gates.set(email, gate);
    }
    return gate;
  };
  const me = (): DemoAccount | null => (session ? ([...accounts.values()].find((a) => a.id === session?.user.id) ?? null) : null);
  // 12 설정(F7) 모의 서버에 넘기는 계정 모양. 동의 기록은 같은 배열이라 revoke_consent 가 철회 시각을 바로 적는다
  const settingsUser = (a: DemoAccount): DemoSettingsUser => ({ id: a.id, email: a.email, consents: a.consents });
  const likesUser = (a: DemoAccount): DemoLikesUser => ({ id: a.id, email: a.email });
  const shopUser = (a: DemoAccount): DemoShopUser => {
    const u = { id: a.id, email: a.email };
    shopUsers.set(a.id, u);
    return u;
  };

  function openSession(account: DemoAccount): DemoSession {
    session = {
      access_token: `demo-access-${account.id}`,
      refresh_token: `demo-refresh-${account.id}`,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: account.id, email: account.email },
    };
    return session;
  }

  // ── Edge Function ────────────────────────────────────────────────
  function otpGate(body: Record<string, unknown>) {
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    if (!isValidEmail(email)) return httpFailure(400, 'invalid_email');
    const gate = gateOf(email);
    const t = now();

    if (body.action === 'send') {
      if (t < gate.lockedUntil) return httpFailure(429, 'locked');
      gate.sends = gate.sends.filter((s) => t - s < DAY_MS);
      if (gate.sends.length >= SEND_LIMIT) return httpFailure(429, 'daily_limit');
      if (gate.sends.length > 0 && t - gate.sends[gate.sends.length - 1] < SEND_GAP_MS) return httpFailure(429, 'too_soon');
      if (email.startsWith('fail')) return httpFailure(502, 'send_failed'); // 데모: fail 로 시작하는 주소는 발송 실패 화면을 볼 수 있게 한다
      gate.sends.push(t);
      gate.sentAt = t;
      return success({ ok: true });
    }

    if (body.action === 'verify') {
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (!/^\d{6}$/.test(token)) return httpFailure(400, 'invalid_token');
      if (t < gate.lockedUntil) return httpFailure(429, 'locked');
      const fresh = gate.sentAt !== null && t - gate.sentAt <= OTP_VALID_SECONDS * 1000;
      if (token !== DEMO_OTP_CODE || !fresh) {
        gate.wrong += 1;
        if (gate.wrong >= WRONG_LIMIT) {
          gate.wrong = 0;
          gate.lockedUntil = t + OTP_LOCK_SECONDS * 1000;
          return httpFailure(429, 'locked');
        }
        return httpFailure(400, 'invalid_token'); // 틀렸는지 · 시간이 지났는지 구분하지 않는다
      }
      gate.wrong = 0;
      gate.sentAt = null; // 한 번 쓴 인증번호는 다시 쓸 수 없다
      let account = accounts.get(email);
      if (!account) {
        seq += 1;
        account = { id: `demo-user-${seq}`, email, birthDate: null, consents: [], aiCases: [], active: false, visibility: { ...DEMO_VISIBILITY_DEFAULTS }, reviewAcked: false };
        accounts.set(email, account);
      }
      const s = openSession(account);
      return success({ ok: true, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, token_type: s.token_type } });
    }
    return httpFailure(400, 'invalid_request');
  }

  function underageReject(body: Record<string, unknown>) {
    const account = me();
    if (!account) return httpFailure(401, 'unauthorized');
    const birth = parseBirth(body.birth_date);
    if (!birth) return httpFailure(400, 'invalid_birth_date');
    const t = now();
    const record = rejects.get(account.email) ?? { times: [], lockedUntil: 0 };
    rejects.set(account.email, record);
    if (t < record.lockedUntil) return httpFailure(403, 'blocked'); // 이미 잠긴 이메일: 날짜와 상관없이 거절하고 이유를 밝히지 않는다
    const today = kstToday(t);
    if (birth < BIRTH_MIN || birth > today) return httpFailure(400, 'invalid_birth_date'); // 입력 실수는 거절 횟수에 세지 않는다
    if (birth <= adultCutoff(today)) return success({ ok: true });
    record.times = record.times.filter((x) => t - x < UNDERAGE_WINDOW_MS);
    record.times.push(t);
    const locked = record.times.length >= UNDERAGE_LIMIT;
    if (locked) record.lockedUntil = t + UNDERAGE_WINDOW_MS;
    return httpFailure(403, 'underage', { locked });
  }

  // ── ai-profile (06 AI 정리 · 모의 모드) ───────────────────────────
  // 서버처럼 처리가 끝날 때까지 응답하지 않는다. 상태 읽기(ai_results)는 시각만 보고 정해서 응답과 따로 움직인다.
  type AiStatus = 'pending' | 'ok' | 'failed';
  type FnResult = { data: unknown; error: unknown };
  const aiStatusOf = (c: DemoAiCase): AiStatus => {
    if (c.manualDone) return 'ok';
    if (now() - c.runStartedAt < aiDelay(c.scenario)) return 'pending';
    return c.scenario === 'fail' ? 'failed' : 'ok';
  };
  const latestCase = (account: DemoAccount): DemoAiCase | null => account.aiCases[account.aiCases.length - 1] ?? null;
  const failureBody = (c: DemoAiCase) => {
    const stage = Math.min(4, c.retryCount + 1);
    return {
      ok: false,
      status: 'failed',
      code: 'ai_failed',
      fail_stage: stage,
      retries_left: 4 - stage,
      show_retry: stage < 4,
      show_manual: stage >= 3,
      ...(stage >= 3 ? { manual: { initial_traits: DEMO_MANUAL_INITIAL, tag_candidates: DEMO_MANUAL_TAGS } } : {}),
    };
  };
  // 처리가 끝나는 때에 맞춰 응답한다
  const finishWith = (c: DemoAiCase): Promise<FnResult> =>
    new Promise((resolve) => {
      const wait = Math.max(0, aiDelay(c.scenario) - (now() - c.runStartedAt));
      setTimeout(() => resolve(aiStatusOf(c) === 'failed' ? success(failureBody(c)) : success({ ok: true, status: 'ok', result_id: c.id })), wait);
    });

  function aiProfile(body: Record<string, unknown>): FnResult | Promise<FnResult> {
    const account = me();
    if (!account) return httpFailure(401, 'unauthorized');
    const t = now();
    const current = latestCase(account);
    if (body.action === 'start') {
      if (current && aiStatusOf(current) === 'pending') return success({ status: 'pending', code: 'in_progress', result_id: current.id });
      if (account.aiCases.filter((c) => t - c.createdAt < DAY_MS).length >= 3) return httpFailure(429, 'new_case_limit_daily', { hint: 'edit_existing' });
      const scenario: DemoAiScenario = body.demo_scenario === 'fail' || body.demo_scenario === 'slow' ? body.demo_scenario : 'ok';
      if (body.demo_scenario !== undefined) account.surveySkipped = true; // 데모 줄 건너뛰기(DemoSkipBar · aiApi.startDemo)
      seq += 1;
      const fresh: DemoAiCase = { id: `demo-ai-${seq}`, createdAt: t, scenario, retryCount: 0, runStartedAt: t, source: 'ai', edited: null, manualDone: false, confirmedAt: null };
      account.aiCases.push(fresh);
      return finishWith(fresh);
    }
    const target = account.aiCases.find((c) => c.id === body.result_id);
    if (!target) return httpFailure(404, 'not_found');
    if (target !== current) return httpFailure(409, 'not_latest');
    if (body.action === 'retry') {
      if (aiStatusOf(target) === 'pending') return success({ status: 'pending', code: 'in_progress', result_id: target.id });
      if (aiStatusOf(target) !== 'failed') return httpFailure(409, 'not_failed');
      if (target.retryCount >= 3) return httpFailure(409, 'retry_limit', { show_retry: false, show_manual: true });
      target.retryCount += 1;
      target.runStartedAt = t;
      return finishWith(target);
    }
    if (body.action === 'manual') {
      if (aiStatusOf(target) !== 'failed' || target.retryCount < 2) return httpFailure(409, 'manual_not_allowed');
      const edited = readEdited({ traits: body.traits, tags: body.tags, summary: body.summary });
      if (!edited) return httpFailure(400, 'invalid_edit');
      target.edited = edited;
      target.source = 'manual';
      target.manualDone = true;
      return success({ ok: true, status: 'ok', source: 'manual', result_id: target.id, retry_count: target.retryCount });
    }
    return httpFailure(400, 'invalid_request');
  }

  const functions: Record<string, (body: Record<string, unknown>) => FnResult | Promise<FnResult>> = {
    'otp-gate': otpGate,
    'underage-reject': underageReject,
    'ai-profile': aiProfile,
    // 사진 열람 URL(F4): 예전에는 1×1 베이지 한 점을 줬고 그것이 원 · 사진 칸에 늘어나 베이지 빈 칸이 됐다(F13a 2번) → 파일이 없으면 404 로 답해 앱이 기본 프로필 그림을 그린다(F13 조건 7).
    // F24: 데모 인물 사진(demo-ph-{n}-{slot}) · '나'의 사진(demo-photo-{계정}-{slot} → 인물 n 13 의 사진 p01, 남성 장면은 없음)은 app/assets/demo/people 의 파일 주소로 답한다(진짜 서버는 서명 URL)
    photo(body) {
      const account = me();
      if (!account) return httpFailure(401, 'unauthorized');
      if (body.action !== 'url' || typeof body.photo_id !== 'string') return httpFailure(400, 'invalid_request');
      const mine = /^demo-photo-(.+)-(face|full|free)$/.exec(body.photo_id);
      const key = photoKeyOf(body.photo_id) ?? (mine && mine[1] === account.id ? mePhotoKey(mine[2] as PhotoSlotName, account.email) : null);
      const url = key ? photoUri(key) : null;
      return url ? success({ ok: true, url }) : httpFailure(404, 'not_found');
    },
    // 12 탈퇴(F7): 인증번호 재확인 → 확정. 확정되면 서버처럼 세션을 끊는다(계정은 탈퇴 상태)
    async 'delete-account'(body) {
      const account = me();
      if (!account) return httpFailure(401, 'unauthorized');
      const result = (await settings.deleteAccount(settingsUser(account), body)) as FnResult;
      if (body.action === 'confirm' && !result.error) session = null;
      return result;
    },
  };

  // ── RPC ──────────────────────────────────────────────────────────
  const rpcs: Record<string, (args: Record<string, unknown>) => DbResult<unknown>> = {
    // 진행 단계 한 번에 묻기(backend/스키마.md 9-6b get_progress). 모의 서버는 설문 · 사진을 아직 몰라서(F8) 동의까지 끝났고 AI 건이 없으면 'consented'(04)로 답한다
    async get_progress(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const versions = (args.p_consent_versions ?? {}) as Record<string, unknown>;
      const required = ['CK1', 'CK2', 'CK3', 'CK5', 'CK6', 'CK7', 'CK8'];
      const live = account.consents.filter((c) => c.agreed && c.revoked_at === null);
      const needed = required.filter((code) => {
        const mine = live.filter((c) => c.item_code === code);
        const want = versions[code];
        return typeof want === 'string' ? !mine.some((c) => editionOf(c.text_version) === editionOf(want)) : mine.length === 0;
      });
      const anyRequired = live.some((c) => required.includes(c.item_code));
      const latest = [...account.aiCases].sort((a, b) => b.createdAt - a.createdAt)[0];
      const status = latest ? aiStatusOf(latest) : null;
      let stage: string;
      if (account.active) stage = 'traits-confirmed';
      else if (!account.birthDate) stage = 'email-verified';
      else if (needed.length === required.length && !anyRequired) stage = 'birthdate-passed';
      else if (needed.length > 0) stage = 'consent-changed';
      else if (status === 'pending') stage = 'ai-processing';
      else if (status === 'failed') stage = 'ai-failed';
      else if (status === 'ok') stage = 'traits-pending';
      else if (demoLiteProgress(account.id).firstMissing === null && demoLiteProgress(account.id).photoSlots === 3) stage = 'survey-complete'; // 임시 설문(F2L) · 사진 3장을 마치고 start 전 → 05(스키마 9-6b 8 · 9행)
      else stage = 'consented';
      return {
        data: {
          stage,
          facts: { account_state: account.active ? 'active' : 'onboarding', birth_date_set: account.birthDate !== null, consent_needed: needed, survey_first_missing: stage === 'consented' ? (demoLiteProgress(account.id).firstMissing ?? null) : null, photo_slots: demoLiteProgress(account.id).photoSlots, ai_status: status },
        },
        error: null,
      };
    },
    // 09 · 10 (F5): 오늘의 추천 · 상대 프로필 · 호감 · 넘기기 · 신고 · 차단
    async list_today_recommendations() {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      shopUser(account);
      return recs.list(account.id, account.email);
    },
    async get_candidate_profile(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const t = String(args.p_target);
      shopUser(account);
      const r = recs.candidate(account.id, account.email, t);
      if (r.data === null && !r.error && likes.knows(likesUser(account), t)) return likes.profile(likesUser(account), t); // 11 행 → 10(F6)
      return r;
    },
    async send_like(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const t = String(args.p_target);
      if (likes.declined(likesUser(account), t)) return { data: null, error: { code: '42501', message: 'forbidden' } }; // 거절된 쌍(0011: 내가 거절했거나, 내 호감이 거절된 뒤 만료)
      const r = recs.sendLike(account.id, account.email, t);
      if (r.error) return r;
      const m = likes.noteSent(likesUser(account), t); // 11 보낸 호감에 올린다. 상대가 이미 나에게 보냈으면 바로 연결(F6)
      if (m.connected) return { data: { like_id: (r.data as { like_id?: string } | null)?.like_id ?? null, connected: true, match_id: m.matchId }, error: null };
      return r;
    },
    async get_pair_state(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const t = String(args.p_target);
      const base = recs.pairState(account.id, t);
      const own = likes.pairState(likesUser(account), t, (base.data as { likes_left?: number } | null)?.likes_left ?? 3); // 11 의 가상 사람 · 거절된 쌍 · 0011 거절 숨김은 likes 가 답한다(F6)
      return own ?? base;
    },
    async pass_candidate(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      return recs.pass(account.id, String(args.p_target));
    },
    async report_user(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const t = String(args.p_target);
      const fromLikes = !recs.person(t) && likes.knows(likesUser(account), t); // 11 의 가상 사람(F6)
      const result = fromLikes ? likes.report(likesUser(account), t, args.p_reason, args.p_description) : recs.report(account.id, account.email, t, args.p_reason, args.p_description);
      if (!result.error) {
        if (!fromLikes) likes.noteBlock(likesUser(account), t); // 신고하면 11 세 목록에서도 빠진다(P5-03)
        settings.noteReport(settingsUser(account), t, String(args.p_reason)); // 12 신고 내역 · 차단 목록(P5-03)
      }
      return result;
    },
    async block_user(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const t = String(args.p_target);
      if (!recs.person(t) && likes.knows(likesUser(account), t)) {
        likes.noteBlock(likesUser(account), t); // 11 의 가상 사람(F6)
        settings.noteBlock(settingsUser(account), t);
        return { data: null, error: null };
      }
      const result = recs.block(account.id, account.email, t);
      if (!result.error) {
        likes.noteBlock(likesUser(account), t); // 11 세 목록에서도 뺀다
        settings.noteBlock(settingsUser(account), t); // 12 차단 목록
      }
      return result;
    },
    // 07 직후 '처음 한 번 확인'을 마쳤다고 기록(F4, 계약 제안: ack_visibility_review)
    async ack_visibility_review() {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      account.reviewAcked = true;
      return { data: { ok: true }, error: null };
    },
    async save_answers(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const answers = (args.p_answers ?? {}) as Record<string, unknown>;
      let saved = 0;
      for (const [id, value] of Object.entries(answers)) {
        if (id === 'A01') {
          const iso = parseBirth(value);
          if (!iso || iso < BIRTH_MIN || iso > adultCutoff(kstToday(now()))) return { data: null, error: { code: 'P0001', message: 'invalid_answer: A01' } };
          account.birthDate = iso;
        }
        saved += 1;
      }
      return { data: saved, error: null };
    },
    // 07 [이대로 확정]: 처리가 끝난 건(원본 또는 수정본이 있는 건)만. 서버는 동의 · 설문 · 사진도 보지만 데모는 AI 건만 본다
    async confirm_profile(args) {
      const account = me();
      if (!account) return { data: null, error: { code: '42501', message: 'forbidden' } };
      const target = account.aiCases.find((c) => c.id === args.p_result_id);
      if (!target) return { data: null, error: { code: 'P0001', message: 'not_found' } };
      if (aiStatusOf(target) !== 'ok') return { data: null, error: { code: 'P0001', message: 'ai_not_ready' } };
      if (account.email.startsWith('cfcycle')) {
        // 확정 실패 4종(서버 confirm_profile 오류 코드와 같은 모양): 동의 → 설문 → 사진 → 그 밖, 다섯 번째부터 확정
        const n = confirmTries.get(account.id) ?? 0;
        confirmTries.set(account.id, n + 1);
        const fails = ['consent_missing: CK8', 'survey_incomplete: A05', 'photos_incomplete', 'unexpected_error'];
        if (n < fails.length) return { data: null, error: { code: 'P0001', message: fails[n] } };
      }
      for (const other of account.aiCases) if (other !== target) other.confirmedAt = null; // 사용자당 확정된 건은 하나
      target.confirmedAt = now();
      account.active = true;
      return { data: { ok: true }, error: null };
    },
  };

  // ── 표 읽기 · 쓰기(본인 행만) ────────────────────────────────────────
  type Row = Record<string, unknown>;
  function rowsOf(table: string): Row[] {
    const account = me();
    if (!account) return [];
    if (table === 'account_status') return [{ user_id: account.id, state: account.active ? 'active' : 'onboarding' }];
    if (table === 'ai_results') {
      return account.aiCases.map((c) => {
        const status = aiStatusOf(c);
        return {
          id: c.id,
          user_id: account.id,
          status,
          source: c.source,
          fail_reason: status === 'failed' ? 'api' : null,
          retry_count: c.retryCount,
          created_at: new Date(c.createdAt).toISOString(),
          confirmed_at: c.confirmedAt === null ? null : new Date(c.confirmedAt).toISOString(),
          result: status === 'ok' && c.source === 'ai' ? DEMO_AI_RESULT : null, // AI 원본: 사용자가 고쳐도 그대로
          user_edited: c.edited,
        };
      });
    }
    if (table === 'profiles') return [{ user_id: account.id, birth_date: account.birthDate, ...settings.profileRow(settingsUser(account)) }]; // notify_* 3열은 12 알림(F7)
    if (table === 'visibility_settings') return [{ user_id: account.id, ...account.visibility }];
    if (table === 'verifications') return [{ user_id: account.id, status: 'pending', method: 'self_report' }];
    if (table === 'survey_answers') {
      const answers: Row[] = Object.entries(DEMO_ANSWERS).map(([question_id, value]) => ({ user_id: account.id, question_id, value }));
      if (account.birthDate) answers.push({ user_id: account.id, question_id: 'A01', value: account.birthDate });
      return answers;
    }
    if (table === 'photos') {
      const local = account.email.split('@')[0];
      const status = (slot: string) => (local.startsWith('photook') ? 'approved' : local.startsWith('photoreject') && slot === 'face' ? 'rejected' : 'pending');
      return ['face', 'full', 'free'].map((slot, i) => ({
        id: `demo-photo-${account.id}-${slot}`,
        user_id: account.id,
        slot,
        status: status(slot),
        reject_codes: status(slot) === 'rejected' ? ['PH2'] : null,
        submitted_at: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      }));
    }
    return account.consents.map((c) => ({ ...c, user_id: account.id }));
  }

  class Query implements PromiseLike<{ data: Row[] | Row | null; error: DbError | null }> {
    private filters: ((row: Row) => boolean)[] = [];
    private columns: string[] | null = null;
    private single = false;
    private sortKey: string | null = null;
    private ascending = true;
    private max: number | null = null;
    private patch: Row | null = null;
    constructor(private readonly table: string) {}
    order(column: string, opts?: { ascending?: boolean }) {
      this.sortKey = column;
      this.ascending = opts?.ascending !== false;
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }
    // ai_results 는 user_edited 열만 고칠 수 있다(열 단위 권한). result(AI 원본)를 보내면 거절한다
    update(values: Row) {
      this.patch = values;
      return this;
    }
    private applyUpdate(): { data: null; error: DbError | null } {
      const account = me();
      const values = this.patch ?? {};
      if (account && this.table === 'profiles') return settings.updateProfile(settingsUser(account), values); // 12 알림 열만(F7)
      if (account && this.table === 'visibility_settings') {
        if (account.email.startsWith('savefail')) return { data: null, error: { code: '', message: 'Failed to fetch' } }; // 인터넷 문제 장면
        const keys = Object.keys(values);
        if (keys.length === 0 || keys.some((k) => !(k in DEMO_VISIBILITY_DEFAULTS) || typeof values[k] !== 'boolean')) return { data: null, error: { code: '42501', message: 'permission denied for column' } };
        for (const k of keys) account.visibility[k] = values[k] as boolean;
        return { data: null, error: null };
      }
      if (!account || this.table !== 'ai_results') return { data: null, error: { code: '42501', message: 'forbidden' } };
      if (Object.keys(values).some((k) => k !== 'user_edited')) return { data: null, error: { code: '42501', message: 'permission denied for column' } };
      const edited = readEdited(values.user_edited);
      if (!edited) return { data: null, error: { code: '23514', message: 'invalid_user_edited' } };
      const ids = rowsOf('ai_results').filter((row) => this.filters.every((f) => f(row))).map((row) => row.id);
      for (const c of account.aiCases) {
        if (!ids.includes(c.id)) continue;
        if (aiStatusOf(c) !== 'ok') return { data: null, error: { code: '42501', message: 'not finished' } };
        c.edited = edited;
      }
      return { data: null, error: null };
    }
    select(cols = '*') {
      this.columns = cols === '*' ? null : cols.split(',').map((c) => c.trim());
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value);
      return this;
    }
    in(column: string, values: readonly unknown[]) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }
    is(column: string, value: null) {
      this.filters.push((row) => (row[column] ?? null) === value);
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    insert(rows: Row[]): DbResult<null> {
      return this.insertRows(rows);
    }
    private async insertRows(input: Row[]): DbResult<null> {
      const account = me();
      if (!account || this.table !== 'consents') return { data: null, error: { code: '42501', message: 'forbidden' } };
      const pending: DemoConsent[] = [];
      for (const r of input) {
        const item = String(r.item_code);
        const version = String(r.text_version);
        const agreed = r.agreed === true;
        const bad = r.user_id !== account.id || !/^CK(1[0-6]|[1-9])$/.test(item) || !/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/.test(version) || String(r.app_version ?? '').length > 32;
        if (bad) return { data: null, error: { code: '23514', message: 'check violation' } };
        if (!agreed && !/^CK(4|9|1[0-6])$/.test(item)) return { data: null, error: { code: '23514', message: 'check violation' } }; // 필수 칸은 동의한 기록만(0033: 선택 CK4 · CK9 · CK10 ~ CK16)
        const duplicate = agreed && [...account.consents, ...pending].some((c) => c.agreed && c.revoked_at === null && c.item_code === item && c.text_version === version);
        if (duplicate) return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        pending.push({ item_code: item, agreed, text_version: version, revoked_at: null });
      }
      if (account.consents.length + pending.length > 60) return { data: null, error: { code: 'P0001', message: 'consent_limit' } }; // 사용자당 60줄까지
      account.consents.push(...pending); // 한 요청 = 전부 또는 하나도 아님
      return { data: null, error: null };
    }
    then<A, B>(
      onfulfilled?: ((value: { data: Row[] | Row | null; error: DbError | null }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      if (this.patch) return Promise.resolve(this.applyUpdate()).then(onfulfilled, onrejected);
      let rows = rowsOf(this.table);
      for (const filter of this.filters) rows = rows.filter(filter);
      const key = this.sortKey;
      if (key) rows = [...rows].sort((a, b) => (String(a[key] ?? '') < String(b[key] ?? '') ? -1 : String(a[key] ?? '') > String(b[key] ?? '') ? 1 : 0) * (this.ascending ? 1 : -1));
      if (this.max !== null) rows = rows.slice(0, this.max);
      const cols = this.columns;
      if (cols) rows = rows.map((row) => Object.fromEntries(cols.map((c) => [c, row[c]])));
      const result = { data: this.single ? (rows[0] ?? null) : rows, error: null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  return {
    invoke(name: string, opts: FunctionOptions): Promise<{ data: unknown; error: unknown }> {
      const handler = functions[name];
      if (!handler) throw new Error(`데모 모드의 functions.invoke('${name}') 은 F8 에서 구현해요`);
      const body = opts && typeof opts.body === 'object' && opts.body !== null ? (opts.body as Record<string, unknown>) : {};
      return Promise.resolve(handler(body));
    },
    rpc(name: string, args: Record<string, unknown> = {}): DbResult<unknown> {
      // 12 설정(F7): list_blocked_users · unblock_user · list_my_reports · revoke_consent
      // 11 호감(F6): list_likes · accept_like · decline_like
      if (likes.handles(name)) {
        const account = me();
        return account ? likes.rpc(likesUser(account), name, args) : Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
      }
      if (shop.handles(name)) {
        const account = me();
        return account ? Promise.resolve(shop.rpc(shopUser(account), name, args)) : Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
      }
      if (settings.handles(name)) {
        const account = me();
        if (!account) return Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
        // 3부-사(법무 L22 C6): 설정에서 CK4 · CK15 를 거두면 실서버 revoke_consent(0037)처럼 설문 기록도 바로 — 종교 '답하지 않음' · 정치 답 지움(탑승 관문이 같은 판정)
        if (name === 'revoke_consent' && (args?.p_item === 'CK4' || args?.p_item === 'CK15')) {
          return settings.rpc(settingsUser(account), name, args).then((r) => {
            if (!r.error) {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { demoSurveyRevoked } = require('@/demo/surveyV2Backend') as typeof import('@/demo/surveyV2Backend');
              demoSurveyRevoked(account.id, String(args?.p_item));
              if (args?.p_item === 'CK4' && account.surveySkipped) account.religionCleared = true;
            }
            return r;
          });
        }
        return settings.rpc(settingsUser(account), name, args);
      }
      // 기능 켜기 스위치(F22 · D-134): 87키 데모 처음값(config/featureKeys demoDefault — review_required · prelaunch 만 꺼짐). 이메일 장면(v4off · featoff …)은 lib/v4Demo 규칙
      // V5 W6 탑승권(서버 확정 이름 get_ticket_state · get_weekly_match · hold_ticket_seat · release_ticket_hold · demo_buy_ticket · board_with_credit · list_ticket_history · cancel_ticket_seat · ack_ticket_contract + 데모 줄 demo_boarding_scene)
      if (boarding.handles(name)) {
        const account = me();
        return account ? boarding.rpc({ id: account.id, email: account.email }, name, args) : Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
      }
      if (name === 'get_feature_flags') {
        const account = me();
        return account ? v4.rpc({ id: account.id, email: account.email }, name, args) : Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
      }
      // 데모 줄(F24 끼리끼리): '나'의 등급을 1~9 로 두거나(p_no) 지금 값을 읽는다. 진짜 서버에는 없는 데모 전용 이름
      if (name === 'demo_kin_me') {
        const account = me();
        if (!account) return Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } });
        const no = args.p_no;
        if (no !== undefined && no !== null) {
          if (typeof no !== 'number' || !Number.isInteger(no) || no < 1 || no > 9) return Promise.resolve({ data: null, error: { code: 'P0001', message: 'invalid_value' } });
          kinMe.set(account.id, no);
        }
        return Promise.resolve({ data: { no: shop.gradeNo(shopUser(account)) ?? 4, on: kinMe.has(account.id) || kkFromEmail(account.email) !== null }, error: null });
      }
      const handler = rpcs[name];
      if (!handler) throw new Error(`데모 모드의 rpc('${name}') 은 F8 에서 구현해요`);
      return handler(args);
    },
    from(table: string): Query {
      if (!['account_status', 'profiles', 'consents', 'ai_results', 'visibility_settings', 'verifications', 'survey_answers', 'photos'].includes(table)) throw new Error(`데모 모드의 from('${table}') 은 F8 에서 구현해요`);
      return new Query(table);
    },
    // 인증
    getSession: () => session,
    setSession(tokens: { access_token?: string }): DemoSession | null {
      const account = [...accounts.values()].find((a) => `demo-access-${a.id}` === tokens.access_token);
      session = account ? openSession(account) : null;
      return session;
    },
    signOut(): void {
      session = null;
    },
    // 시험 · 화면 점검용: 지금 모의 서버가 알고 있는 것
    peek: {
      consents: (email: string) => accounts.get(normalizeEmail(email))?.consents ?? [],
      birthDate: (email: string) => accounts.get(normalizeEmail(email))?.birthDate ?? null,
      // AI 건의 서버 쪽 모습: 원본(result)은 모의 결과 그대로, 수정본(user_edited)은 사용자가 저장한 것
      aiRows: (email: string) => {
        const account = accounts.get(normalizeEmail(email));
        if (!account) return [];
        return account.aiCases.map((c) => ({ id: c.id, source: c.source, retryCount: c.retryCount, edited: c.edited, confirmed: c.confirmedAt !== null, original: c.source === 'ai' ? DEMO_AI_RESULT : null }));
      },
      active: (email: string) => accounts.get(normalizeEmail(email))?.active ?? false,
      // F4: 서버에 저장된 공개 범위 토글 9열과 '처음 한 번 확인' 기록
      visibility: (email: string) => ({ ...(accounts.get(normalizeEmail(email))?.visibility ?? {}) }),
      // F5: 서버(모의)에 남은 호감 · 넘김 · 차단 · 신고
      recs: (email: string) => {
        const a = accounts.get(normalizeEmail(email));
        return a ? recs.peek(a.id) : { liked: [], passed: [], blocked: [], reports: [] };
      },
      reviewAcked: (email: string) => accounts.get(normalizeEmail(email))?.reviewAcked ?? false,
      // F7: 12 차단 목록 · 신고 내역 · 알림 · 탈퇴 여부
      // F6: 11 받은 · 보낸 · 연결 · 거절 · 차단 · 신고(scripts/web-f6.mjs 가 읽는다)
      likes: (email: string) => {
        const a = accounts.get(normalizeEmail(email));
        return a ? likes.peek(likesUser(a)) : null;
      },
      settings: (email: string) => {
        const a = accounts.get(normalizeEmail(email));
        return a ? settings.peek(a.id) : null;
      },
      // F13: 16 상점 · 등급 · 1회 매칭(구독 · 이용권 · 1회 매칭 사용 · 등급 계산 여부)
      shop: (email: string) => {
        const a = accounts.get(normalizeEmail(email));
        return a ? shop.peek(shopUser(a)) : null;
      },
    },
  };
}

export type DemoBackend = ReturnType<typeof createDemoBackend>;
