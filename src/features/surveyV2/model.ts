// 설문 v2(F20) 규칙 — 화면 없이 시험할 수 있는 순수 함수. 원본: 기획/설문_v2.md 2-5(값) · 2-6(건너뛰기) · 2-7(검증 · W1~W6) · 4-2(성실도 쌍).
//  · 입력 중인 값(Draft)과 서버 값(V2Value)을 나눈다. check() 가 Draft → 서버 값 또는 오류 문구를 정한다
//  · 보이는 문항 · 자동 값 · 숨은 문항 지우기는 앞 답(answers)만 보고 정한다 — 데모 백엔드도 같은 함수로 '첫 빈 문항'을 센다(서버 get_progress 와 같은 뜻)
//  · 등급 · 점수는 여기서 계산하지 않는다(서버만, 척추 마디 3). '말하고 싶지 않아요'는 값 null 로 보내고 계산은 서버가 한다
import { SV2, PROPOSED } from './copy';
import { QUESTION_COPY } from './questionCopy';
import { QUESTIONS } from './questions';
import { autoSigungu, isSidoCode, SIGUNGU, type SidoCode } from './regions';
import type { AgeGapValue, HeightRangeValue, QuestionDef, SectionKey, V2Answers, V2Value } from './types';

export const FLOW_SECTIONS: readonly SectionKey[] = ['basic', 'edu', 'job', 'money', 'family', 'life', 'values', 'marriage', 'wish'];
export const FLOW: readonly QuestionDef[] = QUESTIONS.filter((q) => FLOW_SECTIONS.includes(q.section)); // 필수 흐름 64
export const STORY: readonly QuestionDef[] = QUESTIONS.filter((q) => q.section === 'story'); // Q17~Q24
export const APPEAL: readonly QuestionDef[] = QUESTIONS.filter((q) => q.section === 'appeal'); // T04~T09
export const TEXT_IDS: readonly string[] = ['T01', 'T02', 'T03', ...APPEAL.map((q) => q.id)]; // free_texts 로 가는 글
export const PUBLIC_TOGGLE_IDS: readonly string[] = FLOW.filter((q) => q.section === 'marriage' && q.toggle).map((q) => q.id); // 결혼관 공개 스위치 6(처음 꺼짐)
export const CONDITION_IDS: readonly string[] = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F08', 'F09', 'F10', 'F14', 'F15', 'F16'];
export const STORY_MAX = 3;
export const AUTO_NEXT_MS = 400; // 하나 고르기 · 구간 · 5단계는 고르면 0.4초 뒤 다음 문항(설문_v2 2-1 · D35 5장 4)
export const SCHOOL_MIN_CHARS = 2; // 학교 검색은 2자부터(F20 세부청사진 2)

// 자물쇠(민감) · AI에 보내지 않음 · AI 안내 상자(설문_v2 2-4)
export const SENSITIVE_IDS: readonly string[] = ['A06', 'A07', 'A08', 'C05', 'C06', 'D08', 'D09', 'D04']; // D-199: F07 희망 종교 삭제 → 자물쇠 8
export const NO_AI_IDS: readonly string[] = ['A12', 'B02', 'B05', 'C02', 'D08', 'D09', 'A05'];
export const AI_BOX_IDS: readonly string[] = ['T01', 'T02', 'T03'];
// '말하고 싶지 않아요'를 고르면 '답하면 등급이 오를 수 있어요.'를 보이는 다섯 문항(등급에 쓰는 돈 · 부모 쪽, 설문_v2 2-4). 혼인 A07 · 자녀 A08 은 등급에 쓰지 않아 안내 없음
export const DECLINE_HINT_IDS: readonly string[] = ['C05', 'C06', 'D04', 'D08', 'D09'];
// 연락처 모양 안내(W6 · D-75): 공개 칸은 안내만, 나만 칸은 보이지 않는다는 안내
export const CONTACT_FIELD: Readonly<Record<string, 'public' | 'private'>> = {
  B03: 'public',
  C02: 'private',
  T01: 'private',
  T02: 'private',
  T03: 'private',
  ...Object.fromEntries(STORY.map((q) => [q.id, 'public' as const])),
  ...Object.fromEntries(APPEAL.map((q) => [q.id, 'private' as const])),
};

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
export function qOf(id: string): QuestionDef {
  const q = byId.get(id);
  if (!q) throw new Error(`설문 v2 에 없는 문항 ${id}`);
  return q;
}
export const copyOf = (id: string) => QUESTION_COPY[id];
export const optText = (id: string, code: string): string => QUESTION_COPY[id]?.opt?.[code] ?? (code === 'decline' ? SV2.common.decline : code);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

// ── 건너뛰기(설문_v2 2-6) ───────────────────────────────────────────────
const C03_SHOWN = ['public_corp', 'civil', 'edu_research', 'large', 'foreign', 'sme', 'other'];
const C04_HIDDEN = ['self', 'freelance', 'student', 'licensed'];
const has = (a: V2Answers, id: string) => Object.prototype.hasOwnProperty.call(a, id);

// 조건이 '상관없어요'가 아니면 활성(F12 · F13 의 보기가 된다)
export function isActiveCondition(id: string, a: V2Answers): boolean {
  if (!has(a, id)) return false;
  const v = a[id];
  if (v === 'any') return false;
  if (Array.isArray(v)) return v.length > 0 && !(v.length === 1 && v[0] === 'any');
  return v !== null && v !== undefined;
}
export const activeConditions = (a: V2Answers): string[] => CONDITION_IDS.filter((id) => isActiveCondition(id, a));

export function isShown(id: string, a: V2Answers): boolean {
  switch (id) {
    case 'A11':
      return a.A02 === 'male';
    case 'B02':
    case 'B06':
    case 'B03':
      return a.B01 !== 'hs';
    case 'B05':
      return a.B01 === 'master' || a.B01 === 'doctor';
    case 'B07':
      return a.B01 === 'univ' || a.B01 === 'master' || a.B01 === 'doctor';
    case 'C08':
      return a.C01 === 'licensed';
    case 'C02':
      return a.C01 !== 'student';
    case 'C03':
      return typeof a.C01 === 'string' && C03_SHOWN.includes(a.C01);
    case 'C04':
      return typeof a.C01 === 'string' && !C04_HIDDEN.includes(a.C01);
    case 'D06':
      return a.D05 !== '0';
    case 'F12':
    case 'F13':
      return activeConditions(a).length > 0;
    default:
      return true;
  }
}

// 숨겨질 때 자동으로 저장하는 값(설문_v2 2-6). 없으면 undefined(값 없음 = 지운다)
export function autoValue(id: string, a: V2Answers): V2Value | undefined {
  if (id === 'A11' && a.A02 === 'female') return 'na';
  if ((id === 'C03' || id === 'C04') && typeof a.C01 === 'string' && !isShown(id, a)) return 'na';
  if (id === 'D06' && a.D05 === '0') return 'only';
  return undefined;
}

export const visibleFlow = (a: V2Answers): QuestionDef[] => FLOW.filter((q) => isShown(q.id, a));

// 보내기 전 정리: 숨은 문항은 자동 값으로 바꾸거나 지우고, F12 · F13 은 활성 조건만 남긴다(앞 답을 바꾸면 다시 계산)
export function normalizeAnswers(a: V2Answers): { values: Record<string, V2Value>; clear: string[] } {
  const values: Record<string, V2Value> = {};
  const clear: string[] = [];
  const active = activeConditions(a);
  for (const q of FLOW) {
    if (!isShown(q.id, a)) {
      const auto = autoValue(q.id, a);
      if (auto !== undefined) values[q.id] = auto;
      else if (has(a, q.id)) clear.push(q.id);
      continue;
    }
    if (!has(a, q.id)) continue;
    const v = a[q.id];
    if ((q.id === 'F12' || q.id === 'F13') && isStrArr(v)) {
      const kept = v.filter((c) => active.includes(c));
      if (q.id === 'F13' && kept.length !== Math.min(3, active.length)) {
        clear.push(q.id); // 순서가 모자라면 다시 묻는다
        continue;
      }
      values[q.id] = kept;
    } else values[q.id] = v;
  }
  return { values, clear };
}

// ── 입력 중인 값 ───────────────────────────────────────────────────────
export type SchoolPick = { readonly key: string } | { readonly code: string };
export type Draft =
  | { kind: 'choice'; code: string | null } // 하나 고르기 · 구간('decline' = 말하고 싶지 않아요)
  | { kind: 'region'; sido: SidoCode | null; sigungu: string | null }
  | { kind: 'school'; pick: SchoolPick | null }
  | { kind: 'multi'; picks: readonly string[] }
  | { kind: 'scale'; value: number | null }
  | { kind: 'number'; text: string }
  | { kind: 'range'; any: boolean; a: string; b: string } // F01 a 어린 쪽 · b 많은 쪽 / F02 a 최소 · b 최대
  | { kind: 'rankAll'; order: readonly string[]; touched: boolean }
  | { kind: 'rankTop'; order: readonly string[] }
  | { kind: 'text'; text: string };

// 사람마다 다른 처음 순서(E13, 순서 효과 줄이기): 씨앗 글로 정해지는 섞기
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function emptyDraft(q: QuestionDef, seed = ''): Draft {
  switch (q.format) {
    case 'choice':
    case 'bucket':
      return { kind: 'choice', code: null };
    case 'region':
      return { kind: 'region', sido: null, sigungu: null };
    case 'school':
      return { kind: 'school', pick: null };
    case 'multi':
      return { kind: 'multi', picks: [] };
    case 'scale5':
      return { kind: 'scale', value: null };
    case 'number':
      return { kind: 'number', text: '' };
    case 'range':
      return { kind: 'range', any: false, a: '', b: '' };
    case 'rankAll':
      return { kind: 'rankAll', order: seededShuffle(q.codes, `${seed}:${q.id}`), touched: false };
    case 'rankTop':
      return { kind: 'rankTop', order: [] };
    default:
      return { kind: 'text', text: '' };
  }
}

// 서버(또는 로컬)에 저장된 값 → 입력 중인 값(돌아왔을 때 이어서 보이게)
export function draftFromValue(q: QuestionDef, value: V2Value | undefined, seed = ''): Draft {
  const empty = emptyDraft(q, seed);
  if (value === undefined) return empty;
  const raw: unknown = value;
  switch (empty.kind) {
    case 'choice':
      if (value === null) return q.decline ? { kind: 'choice', code: 'decline' } : empty;
      return typeof value === 'string' && q.codes.includes(value) ? { kind: 'choice', code: value } : empty;
    case 'region':
      return isRecord(raw) && isSidoCode(raw.sido) && typeof raw.sigungu === 'string' ? { kind: 'region', sido: raw.sido, sigungu: raw.sigungu } : empty;
    case 'school':
      if (value === null) return q.decline ? { kind: 'school', pick: { code: 'decline' } } : empty;
      if (typeof value === 'string') return q.codes.includes(value) ? { kind: 'school', pick: { code: value } } : empty;
      return isRecord(raw) && typeof raw.school_key === 'string' ? { kind: 'school', pick: { key: raw.school_key } } : empty;
    case 'multi':
      return isStrArr(value) ? { kind: 'multi', picks: value.filter((c) => q.codes.includes(c)) } : empty;
    case 'scale':
      return typeof value === 'number' ? { kind: 'scale', value } : empty;
    case 'number':
      return typeof value === 'number' ? { kind: 'number', text: String(value) } : empty;
    case 'range': {
      if (value === 'any') return { kind: 'range', any: true, a: '', b: '' };
      if (!isRecord(raw)) return empty;
      const [ka, kb] = q.id === 'F01' ? ['younger', 'older'] : ['min', 'max'];
      return { kind: 'range', any: false, a: typeof raw[ka] === 'number' ? String(raw[ka]) : '', b: typeof raw[kb] === 'number' ? String(raw[kb]) : '' };
    }
    case 'rankAll':
      return isStrArr(value) && value.length === q.codes.length ? { kind: 'rankAll', order: value, touched: true } : empty;
    case 'rankTop':
      return isStrArr(value) ? { kind: 'rankTop', order: value } : empty;
    case 'text':
      return typeof value === 'string' ? { kind: 'text', text: value } : empty;
  }
}

// ── 검사(설문_v2 2-7 · CSV 검증 규칙) ─────────────────────────────────────
export type Check = { state: 'empty' } | { state: 'invalid'; message: string } | { state: 'ok'; value: V2Value };
const chars = (s: string) => [...s].length; // 서버 char_length 와 같게 글자 단위
const intIn = (text: string, min: number, max: number): number | null => {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
};
const RANGE_SPAN: Readonly<Record<string, readonly [number, number]>> = { F01: [0, 15], F02: [130, 220] };
export const rangeSpan = (id: string): readonly [number, number] => RANGE_SPAN[id] ?? [0, 0];
const MAX_PICK: Readonly<Record<string, number>> = { E11: 5, F12: 3 };
export const maxPick = (id: string): number | null => MAX_PICK[id] ?? null;

// 이 문항에서 고를 수 있는 보기(F12 · F13 은 활성 조건만)
export function choicesFor(q: QuestionDef, a: V2Answers): { code: string; disabled: boolean }[] {
  if (q.id === 'F12' || q.id === 'F13') {
    const active = activeConditions(a);
    return q.codes.filter((c) => active.includes(c)).map((code) => ({ code, disabled: false }));
  }
  return q.codes.map((code) => ({ code, disabled: false }));
}

export const rankTopNeed = (a: V2Answers): number => Math.min(3, activeConditions(a).length);

export function check(q: QuestionDef, d: Draft, a: V2Answers): Check {
  switch (d.kind) {
    case 'choice':
      if (d.code === null) return { state: 'empty' };
      if (d.code === 'decline') return q.decline ? { state: 'ok', value: null } : { state: 'empty' };
      return q.codes.includes(d.code) ? { state: 'ok', value: d.code } : { state: 'empty' };
    case 'region':
      if (!d.sido) return { state: 'empty' };
      if (!d.sigungu || !SIGUNGU[d.sido].includes(d.sigungu)) return { state: 'invalid', message: SV2.error.region };
      return { state: 'ok', value: { sido: d.sido, sigungu: d.sigungu } };
    case 'school': {
      const p = d.pick;
      if (!p) return { state: 'empty' };
      if ('key' in p) return { state: 'ok', value: { school_key: p.key } };
      if (p.code === 'decline') return q.decline ? { state: 'ok', value: null } : { state: 'empty' };
      return q.codes.includes(p.code) ? { state: 'ok', value: p.code } : { state: 'empty' };
    }
    case 'multi': {
      const allowed = choicesFor(q, a).filter((c) => !c.disabled).map((c) => c.code);
      const picks = q.codes.filter((c) => d.picks.includes(c) && allowed.includes(c));
      if (picks.length === 0) return { state: 'empty' };
      if (picks.includes('any') && picks.length > 1) return { state: 'invalid', message: SV2.error.anyAlone };
      const max = maxPick(q.id);
      if (max !== null && picks.length > max) return { state: 'invalid', message: SV2.error.maxPick(max) };
      return { state: 'ok', value: picks };
    }
    case 'scale':
      return d.value !== null && d.value >= 1 && d.value <= 5 ? { state: 'ok', value: d.value } : { state: 'empty' };
    case 'number': {
      if (d.text.trim() === '') return { state: 'empty' };
      const n = intIn(d.text, q.min ?? 0, q.max ?? 0);
      return n === null ? { state: 'invalid', message: PROPOSED.rangeError(q.min ?? 0, q.max ?? 0) } : { state: 'ok', value: n };
    }
    case 'range': {
      if (d.any) return { state: 'ok', value: 'any' };
      const [min, max] = rangeSpan(q.id);
      const ta = d.a.trim();
      const tb = d.b.trim();
      if (ta === '' && tb === '') return { state: 'empty' };
      const va = ta === '' ? undefined : intIn(ta, min, max);
      const vb = tb === '' ? undefined : intIn(tb, min, max);
      if (va === null || vb === null) return { state: 'invalid', message: PROPOSED.rangeError(min, max) };
      if (q.id === 'F02' && va !== undefined && vb !== undefined && va > vb) return { state: 'invalid', message: SV2.error.minMax };
      const value: AgeGapValue | HeightRangeValue =
        q.id === 'F01'
          ? { ...(va !== undefined ? { younger: va } : {}), ...(vb !== undefined ? { older: vb } : {}) }
          : { ...(va !== undefined ? { min: va } : {}), ...(vb !== undefined ? { max: vb } : {}) };
      return { state: 'ok', value };
    }
    case 'rankAll':
      return d.touched ? { state: 'ok', value: [...d.order] } : { state: 'empty' };
    case 'rankTop': {
      const active = activeConditions(a);
      const kept = d.order.filter((c) => active.includes(c));
      const need = rankTopNeed(a);
      return need > 0 && kept.length === need ? { state: 'ok', value: kept } : { state: 'empty' };
    }
    case 'text': {
      const text = d.text.normalize('NFC').trim(); // 저장 값은 조합된 글자(NFC) — 입력 칸의 글은 건드리지 않는다(F23)
      if (text === '') return { state: 'empty' };
      if (q.id === 'A12') return /^[가-힣]{2,10}$/.test(text) ? { state: 'ok', value: text } : { state: 'invalid', message: SV2.error.name };
      const n = chars(text);
      if (q.min !== undefined && n < q.min) return { state: 'invalid', message: SV2.error.minChars(q.min) };
      if (q.max !== undefined && n > q.max) return { state: 'invalid', message: SV2.error.maxChars(q.max) };
      return { state: 'ok', value: text };
    }
  }
}

export const isPassable = (q: QuestionDef, c: Check): boolean => c.state === 'ok' || (c.state === 'empty' && !q.required);

// [다음]을 눌렀는데 넘어갈 수 없을 때 보일 글
export function blockMessage(q: QuestionDef, c: Check): string | null {
  if (c.state === 'invalid') return c.message;
  if (c.state !== 'empty' || !q.required) return null;
  if (q.format === 'line' || q.format === 'para') return SV2.error.requiredText;
  if (q.format === 'rankAll') return SV2.error.rankTouch;
  return SV2.error.required;
}

// ── 진행 · 이어서 하기 ────────────────────────────────────────────────────
// 저장된 답 + 입력 중 값에서 맞게 쓴 답만 모은다
export function answersOf(drafts: Readonly<Record<string, Draft>>): Record<string, V2Value> {
  const out: Record<string, V2Value> = {};
  // 두 번 돈다: F12 · F13 은 앞 답(활성 조건)을 보고 검사한다
  for (let pass = 0; pass < 2; pass += 1) {
    for (const q of QUESTIONS) {
      const d = drafts[q.id];
      if (!d) continue;
      const c = check(q, d, out);
      if (c.state === 'ok') out[q.id] = c.value;
      else delete out[q.id];
    }
  }
  return out;
}

// 처음 비어 있는 필수 문항(보이는 것만). 없으면 null — 서버 get_progress 의 survey_first_missing 과 같은 뜻
export function firstMissing(a: V2Answers): string | null {
  for (const q of visibleFlow(a)) if (q.required && !has(a, q.id)) return q.id;
  return null;
}

export type SectionBar = { key: SectionKey; ratio: number; current: boolean };
export function progressOf(a: V2Answers, currentId: string | null): { done: number; total: number; bars: SectionBar[]; label: { section: SectionKey; index: number; total: number } | null } {
  const shown = visibleFlow(a);
  const done = shown.filter((q) => has(a, q.id)).length;
  const cur = currentId ? shown.find((q) => q.id === currentId) ?? null : null;
  const bars = FLOW_SECTIONS.map((key) => {
    const qs = shown.filter((q) => q.section === key);
    const answered = qs.filter((q) => has(a, q.id)).length;
    return { key, ratio: qs.length === 0 ? 1 : answered / qs.length, current: cur?.section === key };
  });
  let label: { section: SectionKey; index: number; total: number } | null = null;
  if (cur) {
    const inSection = shown.filter((q) => q.section === cur.section);
    label = { section: cur.section, index: inSection.indexOf(cur) + 1, total: inSection.length };
  }
  return { done, total: shown.length, bars, label };
}

// ── 확인 문구 W1~W5(막지 않음, 검토 화면) ─────────────────────────────────
export type WarnCode = 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
export type Warning = { code: WarnCode; ids: string[] };
const INC_HIGH = ['inc05', 'inc06', 'inc07', 'inc08', 'inc09', 'inc10', 'inc11', 'inc12', 'inc13'];
const COURSE_OF_B01: Readonly<Record<string, string>> = { college: 'C', univ: 'U', master: 'G', doctor: 'G' };
const repeated = (s: string) => {
  const t = s.replace(/\s+/g, '');
  return t.length >= 2 && new Set([...t]).size === 1;
};
// schoolCourse: 학교 키 → 과정(U · C · G …), 해외 학교는 과정을 가리지 않는다
export function warnings(a: V2Answers, schoolCourse: (key: string) => { course: string; overseas: boolean } | null): Warning[] {
  const out: Warning[] = [];
  if (typeof a.A05 === 'number' && (a.A05 < 140 || a.A05 > 200)) out.push({ code: 'W1', ids: ['A05'] });
  if (a.C01 === 'student' && typeof a.C05 === 'string' && INC_HIGH.includes(a.C05)) out.push({ code: 'W2', ids: ['C01', 'C05'] });
  const b02: unknown = a.B02;
  const want = typeof a.B01 === 'string' ? COURSE_OF_B01[a.B01] : undefined;
  const sch = isRecord(b02) && typeof b02.school_key === 'string' ? schoolCourse(b02.school_key) : null;
  const w3: string[] = [];
  if (want && sch && !sch.overseas && sch.course !== want) w3.push('B01', 'B02');
  if (a.B06 === 'enrolled' && typeof a.C01 === 'string' && a.C01 !== 'student') w3.push('B06', 'C01');
  if (w3.length) out.push({ code: 'W3', ids: [...new Set(w3)] });
  const t1 = typeof a.T01 === 'string' ? a.T01.trim() : '';
  const t2 = typeof a.T02 === 'string' ? a.T02.trim() : '';
  const t3 = typeof a.T03 === 'string' ? a.T03.trim() : '';
  const w4 = [...(t1 && t1 === t2 ? ['T01', 'T02'] : []), ...(['T01', 'T02', 'T03'] as const).filter((id) => repeated({ T01: t1, T02: t2, T03: t3 }[id]))];
  if (w4.length) out.push({ code: 'W4', ids: [...new Set(w4)] });
  const pairs: [string, string][] = [
    ['E08', 'E14'],
    ['E09', 'E15'],
    ['E03', 'E16'],
  ];
  const w5 = pairs.filter(([x, y]) => typeof a[x] === 'number' && typeof a[y] === 'number' && Math.abs((a[x] as number) + (a[y] as number) - 6) >= 3).flat();
  if (w5.length) out.push({ code: 'W5', ids: w5 });
  return out;
}

// ── 답 글(검토 화면) ──────────────────────────────────────────────────────
export function answerText(q: QuestionDef, value: V2Value, schoolName: (key: string) => string | null): string {
  const c = QUESTION_COPY[q.id];
  const v: unknown = value;
  if (v === null) return SV2.common.decline;
  switch (q.format) {
    case 'choice':
    case 'bucket':
      return typeof v === 'string' ? optText(q.id, v) : '';
    case 'region': {
      if (!isRecord(v) || !isSidoCode(v.sido)) return '';
      return `${optText('F06', v.sido)} ${String(v.sigungu)}`;
    }
    case 'school':
      if (typeof v === 'string') return optText(q.id, v);
      return isRecord(v) && typeof v.school_key === 'string' ? schoolName(v.school_key) ?? '' : '';
    case 'multi':
    case 'rankAll':
    case 'rankTop':
      return isStrArr(v) ? v.map((code, i) => (q.format === 'multi' ? optText(q.id, code) : `${i + 1}. ${optText(q.id, code)}`)).join(' · ') : '';
    case 'scale5':
      return typeof v === 'number' ? `${c?.low ?? ''} · ${SV2.common.count(v, 5)} · ${c?.high ?? ''}` : '';
    case 'number':
      return typeof v === 'number' ? `${v} ${SV2.unitCm}` : '';
    case 'range': {
      if (v === 'any') return SV2.common.any;
      if (!isRecord(v)) return '';
      if (q.id === 'F01') {
        const y = typeof v.younger === 'number' ? (v.younger === 0 ? SV2.F01.zeroYounger : SV2.F01.younger(v.younger)) : null;
        const o = typeof v.older === 'number' ? (v.older === 0 ? SV2.F01.zeroOlder : SV2.F01.older(v.older)) : null;
        return [y, o].filter(Boolean).join(' · ');
      }
      const [lo, hi] = rangeSpan('F02');
      return SV2.F02range(typeof v.min === 'number' ? v.min : lo, typeof v.max === 'number' ? v.max : hi);
    }
    default:
      return typeof v === 'string' ? v : '';
  }
}

// 지역 고르기: 시·도를 바꾸면 시·군·구를 비운다(세종은 자동)
export const pickSido = (sido: SidoCode): Draft => ({ kind: 'region', sido, sigungu: autoSigungu(sido) });

// 여러 개: '상관없어요'는 혼자만(고르면 나머지가 풀린다), 상한이 차면 더 고르지 않는다
export function toggleMulti(codes: readonly string[], picks: readonly string[], code: string, max: number | null): string[] {
  if (picks.includes(code)) return picks.filter((p) => p !== code);
  if (code === 'any') return ['any'];
  const next = codes.filter((c) => c === code || (picks.includes(c) && c !== 'any'));
  return max !== null && next.length > max ? [...picks] : next;
}

// 순위 전부: index 의 보기를 delta 만큼 옮긴다
export function moveRank(order: readonly string[], index: number, delta: -1 | 1): string[] {
  const to = index + delta;
  if (index < 0 || index >= order.length || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// 상위 3개: 누르면 다음 차례로 들어가고 다시 누르면 빠진다
export function toggleTop(order: readonly string[], code: string, need: number): string[] {
  if (order.includes(code)) return order.filter((c) => c !== code);
  return order.length >= need ? [...order] : [...order, code];
}
