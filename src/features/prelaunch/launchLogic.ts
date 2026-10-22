// 사전 오픈(K20 · F22) 규칙 함수 — 화면 없이 시험한다.
//  · 앱은 날짜로 사전 오픈을 판단하지 않는다(K20 4-5). 서버 get_launch_state 의 phase · region 만 보고 09 자리를 고른다(decideGate)
//  · 출시일은 날짜 · 요일 · 시각 글만(K20 2-6 · P-11): 남은 날 수 · 시간 · 초 · 움직이는 숫자 0. 여기에는 '지금'을 받는 함수가 없다
//  · 신청 번호는 접수 확인용(순서 뜻 0, K20 2-5). 앱은 서버가 준 글자를 그대로 보일 뿐 계산하지 않는다
import type { DeclineReason, LaunchLoad, LaunchState, StepKey, StepState } from './launchApi';

export const STEP_ORDER: readonly StepKey[] = ['identity', 'photos', 'survey', 'docs', 'confirm'];
export const DECLINE_REASONS: readonly DeclineReason[] = ['under_24', 'married', 'fake', 'forged']; // K20 2-3 · P-09: 4개뿐

// 'YYYY-MM-DD'(한국 날짜) → { month, day, weekday(0=일) }. 실제 있는 날짜가 아니면 null
export function readDay(iso: string | null): { month: number; day: number; weekday: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return { month: mo, day: d, weekday: t.getUTCDay() };
}

// 'HH:MM' → { hour, minute }. 모양이 아니면 null
export function readTime(hhmm: string | null): { hour: number; minute: number } | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(hhmm);
  if (!m) return null;
  const [hour, minute] = [Number(m[1]), Number(m[2])];
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 날짜 글: '12월 25일 금요일'
export function dayText(iso: string | null): string | null {
  const d = readDay(iso);
  return d ? `${d.month}월 ${d.day}일 ${WEEKDAYS[d.weekday]}요일` : null;
}

// 시각 글: '오전 9시' · '오후 1시 30분' · 자정 '오전 0시' · 정오 '오후 12시'
export function timeText(hhmm: string | null): string | null {
  const t = readTime(hhmm);
  if (!t) return null;
  const half = t.hour < 12 ? '오전' : '오후';
  const h = t.hour <= 12 ? t.hour : t.hour - 12;
  return `${half} ${h}시${t.minute ? ` ${t.minute}분` : ''}`;
}

// 첫 추천 시각 글 한 덩이: '12월 25일 금요일 오전 9시'. 서버가 만든 launch_text 가 있으면 그대로(S18 4-1), 없으면 날짜 · 시각으로 만든다.
// 날짜가 없거나(미정) 모양이 틀리면 null — 화면은 날짜 줄을 숨긴다
export function firstRecWhen(state: Pick<LaunchState, 'launchDay' | 'openTime'> & { launchText?: string | null }): string | null {
  const day = dayText(state.launchDay);
  if (!day) return null;
  if (state.launchText) return state.launchText;
  return `${day} ${timeText(state.openTime) ?? timeText('18:00')}`;
}

// 월 · 일만: '12월 25일'(16 상점 '상점은 {12월 25일}에 열려요' · 01 '첫 추천은 {12월 25일}부터')
export function monthDayText(iso: string | null): string | null {
  const d = readDay(iso);
  return d ? `${d.month}월 ${d.day}일` : null;
}

// 11 호감 · 16 상점 · 16-G 등급 탭(K20 4-1): 출시일 09:00 전(prelaunch · warming)에만 사전 오픈 빈 상태.
// 출시 뒤 권역 기다림은 추천만 막고 호감 · 상점 · 등급은 열린다(S18 6장). 못 읽음 · 서버 함수 없음 · 로그인 없음은 그 화면 그대로(그 화면이 제 오류를 그린다)
export type TabGateView = 'loading' | 'closed' | 'open';
export function decideTabGate(load: LaunchLoad | null): TabGateView {
  if (!load) return 'loading';
  return load.ok && load.state.phase !== 'open' ? 'closed' : 'open';
}

// 미룸 공지(K20 2-6 · P-21): 서버 미룸 횟수가 이 기기에서 본 횟수보다 늘었을 때 한 번
export const deferNoticeDue = (deferredCount: number, seenCount: number): boolean => deferredCount > seenCount;

// 09 자리에 무엇을 그리나(K20 4-5). seenOpen = 이번 실행에서 'open' 을 한 번이라도 받았나
//  · 불러오는 중 → loading
//  · 서버 screen 이 recommend → open(오늘의 추천). wait(공개 전) · review(공개 뒤 확정 전, D-123) · region_wait → wait(대기 화면)
//  · screen 이 없는 옛 서버: phase open + 권역이 없거나 열림 → open, 그 밖 → wait
//  · 서버에 get_launch_state 가 아직 없음(S18 전 서버) · 로그인이 없거나 풀림 → open(지금 동작 그대로 — 09 가 제 방식으로 처리)
//  · 인터넷 · 서버 문제 → 이번 실행에서 open 을 봤으면 open, 아니면 error(대기 화면 틀 + 다시 시도, 날짜 숨김 — K20 4-1)
export type GateView = 'loading' | 'open' | 'wait' | 'error';
// V5(W6): 탑승권 탭은 '확정'이면 출시 전이어도 열린다(탑승권 판매 전 상태부터 보임 — 청사진 v5 초안 6-1 T1 '사전 오픈 대기 화면 자리 이어받음'). confirmedOpens 로 고른다
export function decideGate(load: LaunchLoad | null, seenOpen: boolean, confirmedOpens = false): GateView {
  if (!load) return 'loading';
  if (load.ok) return isOpen(load.state) || (confirmedOpens && load.state.review?.status === 'confirmed') ? 'open' : 'wait';
  if (load.reason === 'missing' || load.reason === 'session') return 'open';
  return seenOpen ? 'open' : 'error';
}
export const isOpen = (state: Pick<LaunchState, 'phase' | 'region'> & { screen?: LaunchState['screen'] }): boolean =>
  state.screen ? state.screen === 'recommend' : state.phase === 'open' && (state.region === null || state.region.state === 'open');

// 출시일 줄(첫 추천 날짜)은 공개 전에만 — 공개 뒤(review · region_wait)에는 지난 날짜라 보이지 않는다
export const showsLaunchDay = (state: Pick<LaunchState, 'phase'>): boolean => state.phase !== 'open';

// 할 일 한 줄(K20 2-4 줄 3 · NP-04): 앞에서부터 처음 끝나지 않은 칸 하나만. 숫자 0
export type TodoKind = 'surveyTodo' | 'photosTodo' | 'photosFix' | 'surveyFix' | 'docsFix' | 'checking' | null;
export function todoOf(steps: readonly { step: StepKey; state: StepState }[]): TodoKind {
  const by = (k: StepKey) => steps.find((s) => s.step === k)?.state ?? 'todo';
  for (const k of ['identity', 'photos', 'survey'] as const) {
    const st = by(k);
    if (st === 'fix') return k === 'photos' ? 'photosFix' : k === 'survey' ? 'surveyFix' : null;
    if (st === 'todo') return k === 'photos' ? 'photosTodo' : k === 'survey' ? 'surveyTodo' : null;
  }
  if (by('docs') === 'fix') return 'docsFix';
  if (['identity', 'photos', 'survey'].some((k) => by(k as StepKey) === 'checking')) return 'checking';
  return null;
}

// 기다리는 동안 할 일 4줄(K20 2-4 줄 6 · NP-21) 중 보일 것. 권유 말 0, 이름과 한 줄 설명만
//  ① 아는 분 미리 피하기: avoid_org 켜짐 ② 서류 인증: doc_verify 켜짐 ③ 지인 보증: vouch 켜짐 + 확정 뒤 ④ 신청 잇기: 아직 안 이었을 때
export type WaitTask = 'avoid' | 'docs' | 'vouch' | 'link';
export function waitTasks(state: Pick<LaunchState, 'linked' | 'review'>, on: (key: string) => boolean): WaitTask[] {
  const out: WaitTask[] = [];
  if (on('avoid_org')) out.push('avoid');
  if (on('doc_verify')) out.push('docs');
  if (on('vouch') && state.review?.status === 'confirmed') out.push('vouch');
  if (!state.linked) out.push('link');
  return out;
}

// 신청 잇기 입력 모양(K20 2-5 · P-13): 번호 'MMDD-NNNN'(붙여 쓴 8자리도 받음) · 코드 숫자 6자리
export function normalizeApplicantNo(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d{8}$/.test(digits)) return null;
  const month = Number(digits.slice(0, 2));
  const day = Number(digits.slice(2, 4));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}
export const normalizeLinkCode = (raw: string): string | null => {
  const digits = raw.replace(/\s/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
};
