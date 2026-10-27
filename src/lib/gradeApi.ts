// 내 등급(16-G1~G5) · 상대 등급(10) · 등급 계산 멈추기(12)가 서버와 주고받는 일(F13). 원본: backend/스키마.md 11-2 · 11-4 · 11-8, S8c 변경기록(항목 키 13개 · reason 'stopped').
//  · get_my_grade v5(0039 덧B · 3부-사): 보기 { locked:false, ready:true, state:'shown', grade_icon(풍경 키 하나), basis:'age_band', band, shown_at, next_at }
//                     · 멈춤 { locked:false, ready:false, state:'paused', reason:'stopped' } · 계산 전 { locked:false, ready:false, state:'pending', reason:'not_computed', first_ready_at }
//                     등급 숫자(grade_no) · 점수 · 기여 키는 없다 — 앱은 grade_icon 하나만 그림으로 쓰고 숫자를 읽지 않는다. 옛 서버(0023) { locked:true } 는 잠금으로 둔다
//                     (옛 서버가 보내던 areas · top · actionable · manner_ok · verify_on 은 와도 읽기만 하고, 없으면 그 칸을 그리지 않는다)
//  · get_partner_grade(p_partner) → 비구독자 { locked:true } · 구독자 { user_id } + (상대가 CK10 동의 · 등급 있음) grade_no · grade_basis
//  · list_grade_history → { locked, items[{ at, from_no, to_no, reason }] }   · request_grade_access → { request_id, received_at, due_at, merged }
//  · S8d: get_grade_processing() → { processing, stopped_at }
//  · set_grade_processing(p_on) → { processing }   · 앱은 서버가 준 값만 그린다(R5): 등급을 계산 · 정렬 · 거르지 않는다. 등급 힌트를 만들지 않는다
//  · 로그에는 이벤트 이름과 코드만
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from './log';
import { readDbFailure } from './serverError';

export type GradeFailure = 'network' | 'server';
// 항목 키 13개(S8c). 올릴 수 있는 항목은 v_sch v_job v_ast ans act mnr
export type GradeItemKey = 'edu' | 'sch' | 'job' | 'emp' | 'inc' | 'ast' | 'pas' | 'v_sch' | 'v_job' | 'v_ast' | 'ans' | 'act' | 'mnr';
export const GRADE_ITEM_KEYS: readonly GradeItemKey[] = ['edu', 'sch', 'job', 'emp', 'inc', 'ast', 'pas', 'v_sch', 'v_job', 'v_ast', 'ans', 'act', 'mnr'];
export type GradeAreaKey = 'cond' | 'verify' | 'sincere';
export const GRADE_AREA_OF: Readonly<Record<GradeItemKey, GradeAreaKey>> = {
  edu: 'cond', sch: 'cond', job: 'cond', emp: 'cond', inc: 'cond', ast: 'cond', pas: 'cond',
  v_sch: 'verify', v_job: 'verify', v_ast: 'verify',
  ans: 'sincere', act: 'sincere', mnr: 'sincere',
};
// 등급 풍경 키 9개(청사진 6-2 · 0039 grade_icon_of). 순서는 시안 배열 그대로이고 등급 순서가 아니다 — 등급 ↔ 풍경 짝은 서버만 안다
export const GRADE_ICON_KEYS = ['sea', 'mountain', 'moon', 'cloud', 'island', 'bridge', 'forest', 'sun', 'field'] as const;
export type GradeIconKey = (typeof GRADE_ICON_KEYS)[number];
export const isGradeIconKey = (v: unknown): v is GradeIconKey => typeof v === 'string' && (GRADE_ICON_KEYS as readonly string[]).includes(v);
const isItem = (v: unknown): v is GradeItemKey => typeof v === 'string' && (GRADE_ITEM_KEYS as readonly string[]).includes(v);

export type GradeAreas = Readonly<Record<GradeAreaKey, number>>;
export type GradePoint = { item: GradeItemKey; pts: number };
export type MyGrade =
  | { kind: 'locked' } // 옛 서버(0023) 비구독자 — v5 서버는 보내지 않는다
  | {
      kind: 'ready';
      icon: GradeIconKey; // 0039 grade_icon — 내 풍경 하나(숫자 0)
      band: string;
      bandMerged: boolean;
      shownAt: number | null;
      nextAt: number | null;
      areas: GradeAreas | null; // S8d: 영역별 '+n점'(조건 · 인증 · 답변 성실도). 세 값을 더하지 않는다(합 비공개). 서버가 안 주면 null
      top: GradePoint[]; // 기여 상위 3(매너 제외)
      mannerOk: boolean;
      actionable: GradePoint[] | null; // 올릴 수 있는 항목(up_to 를 pts 로 담는다). v5 서버는 보내지 않는다(null — 완료 표시를 만들지 않는다)
      verifyOn: boolean;
    }
  | { kind: 'pending'; reason: 'not_computed' | 'stopped'; firstReadyAt: number | null };
export type GradeHistory = { kind: 'locked' } | { kind: 'items'; items: { at: number; fromNo: number | null; toNo: number; reason: string }[] };
export type AccessRequest = { requestId: string; receivedAt: number | null; dueAt: number | null; merged: boolean };
export type PartnerGrade = { locked: boolean; gradeNo: number | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const time = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : t;
};
// 등급 번호는 정수 1~9 일 때만 쓴다. 그 밖의 값은 없는 것으로 본다(배지를 그리지 않는다)
export const asGradeNo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 9 ? v : null);

function points(value: unknown, key: 'pts' | 'up_to'): GradePoint[] {
  if (!Array.isArray(value)) return [];
  const out: GradePoint[] = [];
  for (const row of value) {
    if (!isRecord(row) || !isItem(row.item)) continue;
    const n = row[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) continue;
    out.push({ item: row.item, pts: n });
  }
  return out;
}

function readAreas(v: unknown): GradeAreas | null {
  if (!isRecord(v)) return null;
  const { cond, verify, sincere } = v;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return ok(cond) && ok(verify) && ok(sincere) ? { cond, verify, sincere } : null;
}

export type GradeProcessing = { processing: boolean; stoppedAt: number | null };

// 0039 v5 모양을 읽는다. 보기인데 아는 풍경 키가 없으면 null(오류 화면 — 숫자로 짐작해 그리지 않는다)
export function parseMyGrade(raw: unknown): MyGrade | null {
  if (!isRecord(raw)) return null;
  if (raw.locked === true) return { kind: 'locked' };
  if (raw.locked !== false) return null;
  if (raw.ready !== true || raw.state === 'paused' || raw.state === 'pending') {
    const stopped = raw.state === 'paused' || raw.reason === 'stopped';
    return { kind: 'pending', reason: stopped ? 'stopped' : 'not_computed', firstReadyAt: time(raw.first_ready_at) };
  }
  if (!isGradeIconKey(raw.grade_icon)) return null;
  return {
    kind: 'ready',
    icon: raw.grade_icon,
    band: typeof raw.band === 'string' ? raw.band : '',
    bandMerged: raw.band_merged === true,
    shownAt: time(raw.shown_at),
    nextAt: time(raw.next_at),
    areas: readAreas(raw.areas),
    top: points(raw.top, 'pts').slice(0, 3),
    mannerOk: raw.manner_ok === true,
    actionable: Array.isArray(raw.actionable) ? points(raw.actionable, 'up_to').slice(0, 3) : null,
    verifyOn: raw.verify_on === true,
  };
}

export function parseHistory(raw: unknown): GradeHistory | null {
  if (!isRecord(raw)) return null;
  if (raw.locked === true) return { kind: 'locked' };
  if (!Array.isArray(raw.items)) return null;
  const items: { at: number; fromNo: number | null; toNo: number; reason: string }[] = [];
  for (const row of raw.items) {
    if (!isRecord(row)) continue;
    const at = time(row.at);
    const to = asGradeNo(row.to_no);
    if (at === null || to === null) continue;
    items.push({ at, fromNo: asGradeNo(row.from_no), toNo: to, reason: typeof row.reason === 'string' ? row.reason : '' });
  }
  return { kind: 'items', items };
}

export function parsePartnerGrade(raw: unknown): PartnerGrade | null {
  if (!isRecord(raw)) return null;
  if (raw.locked === true) return { locked: true, gradeNo: null };
  return { locked: false, gradeNo: asGradeNo(raw.grade_no) };
}

export function createGradeApi(client: SupabaseClient) {
  const fail = (error: { code?: string | null; message?: string | null }, event: string): GradeFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return f.network ? 'network' : 'server';
  };

  return {
    async loadMine(): Promise<{ ok: true; data: MyGrade } | { ok: false; reason: GradeFailure }> {
      const { data, error } = await client.rpc('get_my_grade');
      if (error) return { ok: false, reason: fail(error, 'grade.mine.fail') };
      const parsed = parseMyGrade(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    async loadHistory(): Promise<{ ok: true; data: GradeHistory } | { ok: false; reason: GradeFailure }> {
      const { data, error } = await client.rpc('list_grade_history');
      if (error) return { ok: false, reason: fail(error, 'grade.history.fail') };
      const parsed = parseHistory(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    // 내 등급 무료 열람 요청(법상 필수). 진행 중이면 서버가 같은 요청을 돌려준다(merged)
    async requestAccess(): Promise<{ ok: true; data: AccessRequest } | { ok: false; reason: GradeFailure }> {
      const { data, error } = await client.rpc('request_grade_access');
      if (error) return { ok: false, reason: fail(error, 'grade.access.fail') };
      if (!isRecord(data) || typeof data.request_id !== 'string') return { ok: false, reason: 'server' };
      return { ok: true, data: { requestId: data.request_id, receivedAt: time(data.received_at), dueAt: time(data.due_at), merged: data.merged === true } };
    },

    // 10 상대 등급: 비구독자는 locked(등급 키 없음), 구독자는 상대가 CK10 동의 · 등급이 있을 때만 gradeNo
    async partnerGrade(partnerId: string): Promise<PartnerGrade | null> {
      const { data, error } = await client.rpc('get_partner_grade', { p_partner: partnerId });
      if (error) {
        fail(error, 'grade.partner.fail');
        return null;
      }
      return parsePartnerGrade(data);
    },

    // S8d: 계산 중인가(구독자 · 비구독자 모두). 12 설정 스위치가 이 서버 값을 읽는다
    async loadProcessing(): Promise<{ ok: true; data: GradeProcessing } | { ok: false; reason: GradeFailure }> {
      const { data, error } = await client.rpc('get_grade_processing');
      if (error) return { ok: false, reason: fail(error, 'grade.processing.read.fail') };
      if (!isRecord(data) || typeof data.processing !== 'boolean') return { ok: false, reason: 'server' };
      return { ok: true, data: { processing: data.processing, stoppedAt: time(data.stopped_at) } };
    },

    // 12 설정 '등급 계산 멈추기'. on = true 면 다시 계산, false 면 멈춤(서버가 내 등급을 지운다)
    async setProcessing(on: boolean): Promise<{ ok: true; processing: boolean } | { ok: false; reason: GradeFailure }> {
      const { data, error } = await client.rpc('set_grade_processing', { p_on: on });
      if (error) return { ok: false, reason: fail(error, 'grade.processing.fail') };
      return { ok: true, processing: isRecord(data) ? data.processing !== false : on };
    },
  };
}

export type GradeApi = ReturnType<typeof createGradeApi>;
