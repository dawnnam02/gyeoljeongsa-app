// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 짧은 설문의 규칙(화면 없이 시험할 수 있는 순수 함수). 원본: 기획/화면_요구사항.md 04 '입력 검증 규칙' · backend/스키마.md 4장 값 모양.
//  · 문항 정의는 content/surveyLiteCopy.ts 의 CSV 행 그대로이고, 선택지 · 범위 · 글자 수는 CSV '선택지' 칸을 읽어 만든다(숫자를 따로 적지 않는다)
//  · 입력 중인 값(Draft)과 서버 값(LiteValue)을 나눈다. checkDraft 가 Draft → 서버 값 또는 오류 문구를 정한다
//  · 쪽 나누기: 04 는 한 쪽에 한 문항(10쪽), 05 는 G01 사진 · G03 스타일. 칩 · 쪽 표시 · 진행바는 04 와 같은 규칙(K2 3장 S8)
import { SIGN_IN } from '@/content/copy';
import { LITE_QUESTIONS, SURVEY_LITE } from '@/content/surveyLiteCopy';
import { adultCutoff, BIRTH_MIN, birthDigitsToIso } from '@/lib/birthDate';
import type { LiteAnswers, LiteValue } from '@/lib/surveyLiteApi';

import { autoSigungu, isSido, SIGUNGU, type Sido } from './regions';

export const LITE_TYPES = ['날짜', '지역', '숫자', '선택', '구간', '척도', '순위', '텍스트', '범위', '복수 선택', '사진'] as const;
export type LiteType = (typeof LITE_TYPES)[number];

export type LiteQuestion = {
  readonly id: string;
  readonly section: string;
  readonly question: string;
  readonly type: LiteType;
  readonly options: string; // CSV 선택지 칸 그대로
  readonly required: boolean;
  readonly visibility: '공개' | '구간' | '비공개';
  readonly used: boolean; // 매칭사용이 '미사용'이 아니다(추천에 쓰인다)
  readonly sensitive: boolean;
};

export const QUESTIONS: readonly LiteQuestion[] = LITE_QUESTIONS.map((row) => ({
  id: row.id,
  section: row.section,
  question: row.question,
  type: row.type,
  options: row.options,
  required: row.required === '예',
  visibility: row.visibility,
  used: row.matching !== '미사용',
  sensitive: row.sensitive === '예',
}));

export function questionOf(id: string): LiteQuestion {
  const q = QUESTIONS.find((item) => item.id === id);
  if (!q) throw new Error(`임시 설문에 없는 문항 ${id}`);
  return q;
}

export const DECLINE = '답하지 않음';
export const ANY = '상관없음';
const EXCLUSIVE = [DECLINE, ANY];

// ── CSV 선택지 칸 읽기 ────────────────────────────────────────────────
export const choicesOf = (q: LiteQuestion): string[] => q.options.split(' / ');

// '1=매우 내향적 / 5=매우 외향적'
export function scaleOf(q: LiteQuestion): { min: number; max: number; low: string; high: string } {
  const [a, b] = q.options.split(' / ').map((part) => /^(\d+)=(.+)$/.exec(part));
  if (!a || !b) throw new Error(`척도 선택지 모양이 아니에요: ${q.id}`);
  return { min: Number(a[1]), max: Number(b[1]), low: a[2], high: b[2] };
}

// '130~220 cm'
export function numberOf(q: LiteQuestion): { min: number; max: number; unit: string } {
  const m = /^(\d+)~(\d+)\s*(.*)$/.exec(q.options);
  if (!m) throw new Error(`숫자 선택지 모양이 아니에요: ${q.id}`);
  return { min: Number(m[1]), max: Number(m[2]), unit: m[3] };
}

// '자유 입력 20~300자'
export function textOf(q: LiteQuestion): { min: number; max: number } {
  const m = /(\d+)~(\d+)자/.exec(q.options);
  if (!m) throw new Error(`텍스트 선택지 모양이 아니에요: ${q.id}`);
  return { min: Number(m[1]), max: Number(m[2]) };
}

// '연하 최대 0~15세 / 연상 최대 0~15세 / 상관없음'
export type RangeSide = { label: string; min: number; max: number; unit: string };
export function rangeOf(q: LiteQuestion): { younger: RangeSide; older: RangeSide; any: string } {
  const [y, o, any] = q.options.split(' / ');
  const side = (part: string): RangeSide => {
    const m = /^(.+?) (\d+)~(\d+)(.*)$/.exec(part);
    if (!m) throw new Error(`범위 선택지 모양이 아니에요: ${q.id}`);
    return { label: m[1], min: Number(m[2]), max: Number(m[3]), unit: m[4] };
  };
  return { younger: side(y), older: side(o), any };
}

// ── 입력 중인 값 ──────────────────────────────────────────────────────
export type Draft =
  | { kind: 'date'; text: string; locked: boolean }
  | { kind: 'region'; sido: Sido | null; sigungu: string | null }
  | { kind: 'number'; text: string }
  | { kind: 'choice'; choice: string | null } // 선택 · 구간
  | { kind: 'scale'; value: number | null }
  | { kind: 'rank'; order: readonly string[]; confirmed: boolean }
  | { kind: 'text'; text: string }
  | { kind: 'range'; any: boolean; younger: string; older: string }
  | { kind: 'multi'; picks: readonly string[] };

export function emptyDraft(q: LiteQuestion): Draft {
  switch (q.type) {
    case '날짜':
      return { kind: 'date', text: '', locked: false };
    case '지역':
      return { kind: 'region', sido: null, sigungu: null };
    case '숫자':
      return { kind: 'number', text: '' };
    case '선택':
    case '구간':
      return { kind: 'choice', choice: null };
    case '척도':
      return { kind: 'scale', value: null };
    case '순위':
      return { kind: 'rank', order: choicesOf(q), confirmed: false }; // 처음 순서는 시작 자리일 뿐이다(K2: 한 번 옮기거나 N05 를 체크해야 답한 것)
    case '텍스트':
      return { kind: 'text', text: '' };
    case '범위':
      return { kind: 'range', any: false, younger: '', older: '' };
    case '복수 선택':
      return { kind: 'multi', picks: [] };
    case '사진':
      throw new Error('사진(G01)은 05 화면이 칸 상태로 다룬다');
  }
}

const isStringArray = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// 서버에 저장된 값 → 입력 중인 값(돌아왔을 때 이어서 보이게)
export function draftFromValue(q: LiteQuestion, value: LiteValue | undefined, birthLocked = false): Draft {
  const empty = emptyDraft(q);
  if (value === undefined) return empty;
  const raw: unknown = value; // 서버에서 온 값은 모양을 다시 본다
  switch (empty.kind) {
    case 'date':
      return typeof value === 'string' ? { kind: 'date', text: value.replace(/-/g, ''), locked: birthLocked } : empty;
    case 'region':
      return isRecord(raw) && isSido(raw.sido) && typeof raw.sigungu === 'string' ? { kind: 'region', sido: raw.sido, sigungu: raw.sigungu } : empty;
    case 'number':
      return typeof value === 'number' ? { kind: 'number', text: String(value) } : empty;
    case 'choice':
      if (value === null && choicesOf(q).includes(DECLINE)) return { kind: 'choice', choice: DECLINE };
      return typeof value === 'string' ? { kind: 'choice', choice: value } : empty;
    case 'scale':
      return typeof value === 'number' ? { kind: 'scale', value } : empty;
    case 'rank':
      return isStringArray(value) && value.length === choicesOf(q).length ? { kind: 'rank', order: value, confirmed: true } : empty;
    case 'text':
      return typeof value === 'string' ? { kind: 'text', text: value } : empty;
    case 'range':
      if (value === ANY) return { kind: 'range', any: true, younger: '', older: '' };
      if (!isRecord(raw)) return empty;
      return {
        kind: 'range',
        any: false,
        younger: typeof raw.younger === 'number' ? String(raw.younger) : '',
        older: typeof raw.older === 'number' ? String(raw.older) : '',
      };
    case 'multi':
      return isStringArray(value) ? { kind: 'multi', picks: value } : empty;
  }
}

// ── 검사 ──────────────────────────────────────────────────────────────
export type Check = { state: 'empty' } | { state: 'invalid'; message: string } | { state: 'ok'; value: LiteValue };

const countChars = (s: string) => [...s].length; // 서버 char_length 와 같게 글자 단위로 센다
const intIn = (text: string, min: number, max: number): number | null => {
  if (!/^\d{1,4}$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
};

export function checkDraft(q: LiteQuestion, draft: Draft, todayIso: string): Check {
  switch (draft.kind) {
    case 'date': {
      if (draft.text === '') return { state: 'empty' };
      const iso = birthDigitsToIso(draft.text);
      if (draft.locked && iso) return { state: 'ok', value: iso };
      if (!iso || iso < BIRTH_MIN || iso > adultCutoff(todayIso)) return { state: 'invalid', message: BIRTH_FORMAT_MESSAGE };
      return { state: 'ok', value: iso };
    }
    case 'region':
      if (!draft.sido || !draft.sigungu) return { state: 'empty' };
      return SIGUNGU[draft.sido].includes(draft.sigungu) ? { state: 'ok', value: { sido: draft.sido, sigungu: draft.sigungu } } : { state: 'empty' };
    case 'number': {
      if (draft.text.trim() === '') return { state: 'empty' };
      const spec = numberOf(q);
      const n = intIn(draft.text.trim(), spec.min, spec.max);
      return n === null ? { state: 'invalid', message: SURVEY_LITE.required } : { state: 'ok', value: n };
    }
    case 'choice':
      if (draft.choice === null || !choicesOf(q).includes(draft.choice)) return { state: 'empty' };
      return { state: 'ok', value: draft.choice === DECLINE ? null : draft.choice }; // 답하지 않음 = 답했지만 값 없음(JSON null)
    case 'scale': {
      const spec = scaleOf(q);
      return draft.value !== null && draft.value >= spec.min && draft.value <= spec.max ? { state: 'ok', value: draft.value } : { state: 'empty' };
    }
    case 'rank':
      return draft.confirmed ? { state: 'ok', value: [...draft.order] } : { state: 'empty' };
    case 'text': {
      const text = draft.text.trim(); // 앞뒤 공백을 지우고 공백만이면 빈 값
      if (text === '') return { state: 'empty' };
      const spec = textOf(q);
      const n = countChars(text);
      if (n < spec.min) return { state: 'invalid', message: SURVEY_LITE.minChars(spec.min) };
      if (n > spec.max) return { state: 'invalid', message: SURVEY_LITE.maxChars(spec.max) };
      return { state: 'ok', value: text };
    }
    case 'range': {
      if (draft.any) return { state: 'ok', value: ANY };
      const spec = rangeOf(q);
      const y = draft.younger.trim();
      const o = draft.older.trim();
      if (y === '' && o === '') return { state: 'empty' };
      const younger = y === '' ? undefined : intIn(y, spec.younger.min, spec.younger.max);
      const older = o === '' ? undefined : intIn(o, spec.older.min, spec.older.max);
      if (younger === null || older === null) return { state: 'invalid', message: SURVEY_LITE.required };
      return { state: 'ok', value: { ...(younger !== undefined ? { younger } : {}), ...(older !== undefined ? { older } : {}) } }; // 한쪽만 있어도 된다(비면 제한 없음)
    }
    case 'multi': {
      const order = choicesOf(q);
      const picks = order.filter((c) => draft.picks.includes(c));
      return picks.length === 0 ? { state: 'empty' } : { state: 'ok', value: picks };
    }
  }
}

// 02 의 생년월일 형식 오류(N02)를 그대로 쓴다
export const BIRTH_FORMAT_MESSAGE = SIGN_IN.errors.birthFormat;

export const emptyMessage = (q: LiteQuestion) => (q.type === '지역' ? SURVEY_LITE.regionRequired : SURVEY_LITE.required);

// 이 문항을 넘어갈 수 있는가(필수는 ok, 선택은 비어도 된다)
export function isPassable(q: LiteQuestion, check: Check): boolean {
  return check.state === 'ok' || (check.state === 'empty' && !q.required);
}

// [다음]을 눌렀는데 넘어갈 수 없을 때 보일 글
export function blockMessage(q: LiteQuestion, check: Check): string | null {
  if (check.state === 'invalid') return check.message;
  if (check.state === 'empty' && q.required) return emptyMessage(q);
  return null;
}

// 복수 선택: '상관없음' · '답하지 않음'은 혼자만(K2 04 복수 선택)
export function toggleMulti(choices: readonly string[], picks: readonly string[], item: string): string[] {
  if (picks.includes(item)) return picks.filter((p) => p !== item);
  if (EXCLUSIVE.includes(item)) return [item];
  return choices.filter((c) => c === item || (picks.includes(c) && !EXCLUSIVE.includes(c)));
}

// 순위: index 의 보기를 delta(−1 위 · +1 아래)만큼 옮긴다
export function moveRank(order: readonly string[], index: number, delta: -1 | 1): string[] {
  const to = index + delta;
  if (index < 0 || index >= order.length || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// 지역: 시·도를 바꾸면 시·군·구를 비운다(세종은 자동 채움)
export function pickSido(sido: Sido): Draft {
  return { kind: 'region', sido, sigungu: autoSigungu(sido) };
}

// ── 공개 범위 한 줄(화면_요구사항 04 '공개 범위 안내 규칙' · N04) ─────────────
const TOGGLE_QUESTIONS = ['A06', 'A07', 'A08', 'B02', 'C02', 'C05', 'C06', 'D03', 'D04']; // 08 토글 9개(정책 2-3)
const LEGAL_LINE: Readonly<Record<string, string>> = { D03: SURVEY_LITE.parentRangeLine, D04: SURVEY_LITE.parentRangeLine };

export function visibilityLine(q: LiteQuestion): string {
  const legal = LEGAL_LINE[q.id];
  if (legal) return legal;
  const suffix = TOGGLE_QUESTIONS.includes(q.id) ? ` ${SURVEY_LITE.toggleSuffix}` : '';
  if (q.visibility === '공개') return `${SURVEY_LITE.publicLine}${suffix}`;
  if (q.visibility === '구간') return `${SURVEY_LITE.rangeLine}${suffix}`;
  return q.used ? SURVEY_LITE.hiddenUsedLine : SURVEY_LITE.hiddenLine;
}

// ── 쪽 ────────────────────────────────────────────────────────────────
// 04: 한 쪽에 한 문항. step 은 정식 설문에서 그 문항이 놓일 쪽 번호(화면_요구사항 3-2), A01 은 02 에서 받는 문항이라 임시판 첫 쪽(01)에 둔다
export type LitePage = { readonly step: string; readonly chip: string; readonly id: string };
export const LITE_PAGES: readonly LitePage[] = [
  { step: '01', chip: '기본', id: 'A01' },
  { step: '02', chip: '기본', id: 'A03' },
  { step: '03', chip: '기본', id: 'A05' },
  { step: '07', chip: '학력', id: 'B01' },
  { step: '11', chip: '직업', id: 'C05' },
  { step: '13', chip: '가족', id: 'D03' },
  { step: '19', chip: '성향', id: 'E08' },
  { step: '21', chip: '성향', id: 'E13' },
  { step: '22', chip: '성향', id: 'T01' },
  { step: '25', chip: '희망', id: 'F01' },
];
export const PHOTO_PAGE_IDS: readonly string[] = ['G01', 'G03'];

// 진행바 분모: 04 의 10쪽 + 05(K2 S8 과 같은 규칙)
export const LITE_PROGRESS_TOTAL = LITE_PAGES.length + 1;

export function chipProgress(pageIndex: number): { chip: string; index: number; total: number } {
  const page = LITE_PAGES[pageIndex];
  const inChip = LITE_PAGES.filter((p) => p.chip === page.chip);
  return { chip: page.chip, index: inChip.indexOf(page) + 1, total: inChip.length };
}

// 서버(또는 데모 메모리)에 저장된 답 기준으로 처음 비어 있는 04 쪽. 없으면 null
export function firstMissingPage(answers: LiteAnswers): number | null {
  const i = LITE_PAGES.findIndex((p) => questionOf(p.id).required && !(p.id in answers));
  return i < 0 ? null : i;
}

// 앱을 다시 열 때 어디서 시작하나: missing(05 에서 빠진 문항으로 보냄) · last(05 의 ‹) · resume(처음 빈 쪽, 다 찼으면 마지막 쪽)
export type LiteEntry = 'resume' | 'last' | 'missing';
export function startPage(entry: LiteEntry, answers: LiteAnswers): number {
  if (entry === 'last') return LITE_PAGES.length - 1;
  return firstMissingPage(answers) ?? LITE_PAGES.length - 1;
}

// 라우트 /survey/[step] 의 값으로 시작 방식을 고른다(통합 때 라우트가 쓴다). 04-32 는 05 의 ‹ 가 돌아오는 곳이다
export function liteEntryOf(step: string | undefined, notice: string | undefined): LiteEntry {
  if (notice === 'missing') return 'missing';
  if (step === '32') return 'last';
  return 'resume';
}
