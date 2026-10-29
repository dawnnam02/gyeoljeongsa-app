// 06 AI 정리 중 · 07 내 성향이 서버와 주고받는 일. 원본: ai/설계.md 9·14장, backend/스키마.md ai_results · confirm_profile.
//  · 상태 읽기: ai_results 가장 최근 한 줄을 읽는다(3초 간격으로 부른다). 읽는 열만 고른다
//  · 시작(start) · 다시 시도(retry) · 직접 입력(manual): 서버 함수 ai-profile. 처리가 끝날 때까지 응답하지 않는다(최대 105초) — 부르는 쪽이 기다리지 않아도 된다
//  · 수정 저장: ai_results.user_edited 열만 고친다. result(AI 원본)는 절대 쓰지 않는다
//  · 확정: confirm_profile(result_id)
// 로그에는 이벤트 이름과 코드만 남긴다(설문 답 · AI 결과 본문 금지).
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiRow, AiStatus, Evidence, FailureInfo, ManualOffer, TraitKey, Traits, TraitsView } from '@/types/ai';
import { TRAIT_KEYS } from '@/types/ai';

import { safeLog } from './log';
import { readDbFailure, readFunctionFailure } from './serverError';

export type AiFailure = 'network' | 'server';
export type LoadLatest = { ok: true; row: AiRow | null } | { ok: false; reason: AiFailure };

export type RunOutcome =
  | { kind: 'ok'; resultId: string }
  | { kind: 'pending'; resultId: string | null } // 같은 건이 이미 처리 중 — 계속 읽는다
  | { kind: 'failed'; info: FailureInfo }
  | { kind: 'limit' } // 새 건 한도(429) · 다시 시도 한도 — 07 에서 직접 고치거나 직접 입력
  | { kind: 'consent' } // 동의 없음(403 consent_missing) → 03
  | { kind: 'error'; reason: AiFailure };

export type SaveOutcome = { ok: true } | { ok: false; reason: AiFailure };
// 확정 실패(서버 오류 코드별): consent_missing → 03 · survey_incomplete → 04 · photos_incomplete → 05 · ai_not_ready → 06 · 그 밖은 다시 시도
export type ConfirmFailReason = AiFailure | 'not-ready' | 'consent_missing' | 'survey_incomplete' | 'photos_incomplete';
export type ConfirmOutcome = { ok: true } | { ok: false; reason: ConfirmFailReason };

const COLUMNS = 'id,status,source,retry_count,created_at,confirmed_at,result,user_edited';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readTraits(v: unknown): Traits | null {
  if (!isRecord(v)) return null;
  const out: Partial<Record<TraitKey, number>> = {};
  for (const key of TRAIT_KEYS) {
    const n = v[key];
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    out[key] = Math.min(100, Math.max(0, Math.round(n)));
  }
  return out as Traits;
}

function readView(v: unknown): TraitsView | null {
  if (!isRecord(v)) return null;
  const traits = readTraits(v.traits);
  if (!traits) return null;
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [];
  return { traits, tags, summary: typeof v.summary === 'string' ? v.summary : '' };
}

function readEvidence(v: unknown): Evidence | null {
  if (!isRecord(v)) return null;
  const out: Partial<Record<TraitKey, string[]>> = {};
  for (const key of TRAIT_KEYS) {
    const list = v[key];
    out[key] = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  }
  return out as Evidence;
}

// 서버 한 줄 → AiRow (모르는 모양이면 null)
export function readRow(raw: unknown): AiRow | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const status = raw.status as AiStatus;
  if (status !== 'pending' && status !== 'ok' && status !== 'failed') return null;
  const originalView = readView(raw.result);
  return {
    id: raw.id,
    status,
    source: raw.source === 'manual' ? 'manual' : 'ai',
    retryCount: typeof raw.retry_count === 'number' ? raw.retry_count : 0,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
    confirmedAt: typeof raw.confirmed_at === 'string' ? raw.confirmed_at : null,
    original: originalView ? { ...originalView, evidence: isRecord(raw.result) ? readEvidence(raw.result.evidence) : null } : null,
    edited: readView(raw.user_edited),
  };
}

// 실패 단계(ai/설계.md 9-2 · 14-7): 실패 누적 = 다시 시도 횟수 + 1
export function failureFromRetryCount(retryCount: number, manual: ManualOffer | null = null): FailureInfo {
  const stage = Math.min(4, Math.max(1, retryCount + 1));
  return { stage, retriesLeft: 4 - stage, showRetry: stage < 4, showManual: stage >= 3, manual };
}

function readManualOffer(v: unknown): ManualOffer | null {
  if (!isRecord(v)) return null;
  const initialTraits = readTraits(v.initial_traits);
  if (!initialTraits) return null;
  const tags = Array.isArray(v.tag_candidates) ? v.tag_candidates.filter((t): t is string => typeof t === 'string') : [];
  return { initialTraits, tagCandidates: tags };
}

function readFailureBody(body: Record<string, unknown>): FailureInfo {
  const stage = typeof body.fail_stage === 'number' ? Math.min(4, Math.max(1, body.fail_stage)) : 1;
  return {
    stage,
    retriesLeft: typeof body.retries_left === 'number' ? body.retries_left : 4 - stage,
    showRetry: body.show_retry === true,
    showManual: body.show_manual === true,
    manual: readManualOffer(body.manual),
  };
}

export function createAiApi(client: SupabaseClient) {
  async function invoke(body: Record<string, unknown>): Promise<RunOutcome> {
    const { data, error } = await client.functions.invoke('ai-profile', { body });
    if (error) {
      const f = await readFunctionFailure(error);
      safeLog({ event: 'ai.invoke.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
      if (f.network) return { kind: 'error', reason: 'network' };
      if (f.code === 'consent_missing') return { kind: 'consent' };
      if (f.code === 'new_case_limit_daily' || f.code === 'new_case_limit_total' || f.code === 'retry_limit') return { kind: 'limit' };
      if (f.code === 'in_progress') return { kind: 'pending', resultId: null };
      return { kind: 'error', reason: 'server' };
    }
    if (!isRecord(data)) return { kind: 'error', reason: 'server' };
    if (data.ok === true && typeof data.result_id === 'string') return { kind: 'ok', resultId: data.result_id };
    if (data.status === 'pending') return { kind: 'pending', resultId: typeof data.result_id === 'string' ? data.result_id : null };
    if (data.ok === false && data.status === 'failed') return { kind: 'failed', info: readFailureBody(data) };
    return { kind: 'error', reason: 'server' };
  }

  return {
    // 가장 최근 건 한 줄
    async loadLatest(): Promise<LoadLatest> {
      const { data, error } = await client.from('ai_results').select(COLUMNS).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return { ok: false, reason: readDbFailure(error).network ? 'network' : 'server' };
      if (data === null) return { ok: true, row: null };
      const row = readRow(data);
      return row ? { ok: true, row } : { ok: false, reason: 'server' };
    },
    start: () => invoke({ action: 'start' }),
    // 데모 모드에서만 쓴다: 모의 서버에 어떤 응답(ok · fail · slow)을 줄지 알려 준다
    startDemo: (scenario: 'ok' | 'fail' | 'slow') => invoke({ action: 'start', demo_scenario: scenario }),
    retry: (resultId: string) => invoke({ action: 'retry', result_id: resultId }),
    // 직접 입력: 서버가 user_edited 를 저장하고 건을 끝낸다(source=manual). 이어서 confirm 을 부른다
    manual: (resultId: string, view: { traits: Traits; tags: readonly string[]; summary: string }) =>
      invoke({ action: 'manual', result_id: resultId, traits: view.traits, tags: view.tags, summary: view.summary }),

    // [저장]: 수정본만 쓴다. result(원본) 열은 보내지 않는다
    async saveEdited(resultId: string, view: TraitsView): Promise<SaveOutcome> {
      const edited = { traits: view.traits, tags: [...view.tags], summary: view.summary };
      const { error } = await client.from('ai_results').update({ user_edited: edited }).eq('id', resultId);
      if (error) return { ok: false, reason: readDbFailure(error).network ? 'network' : 'server' };
      return { ok: true };
    },

    // [이대로 확정]. resultId null = 대화형 설문 '내 성향'을 마친 분(서버 0044: 인터뷰 정리 done 이면 그 결과로 확정 · 06 · 07 건너뜀)
    async confirm(resultId: string | null): Promise<ConfirmOutcome> {
      const { error } = await client.rpc('confirm_profile', { p_result_id: resultId });
      if (!error) return { ok: true };
      const f = readDbFailure(error);
      if (f.network) return { ok: false, reason: 'network' };
      const message = String(error.message ?? '');
      safeLog({ event: 'ai.confirm.fail', code: message.split(':')[0].slice(0, 30) || (f.code ?? 'unknown') });
      if (message.startsWith('ai_not_ready')) return { ok: false, reason: 'not-ready' };
      const missing = /^(consent_missing|survey_incomplete|photos_incomplete)/.exec(message);
      if (missing) return { ok: false, reason: missing[1] as 'consent_missing' | 'survey_incomplete' | 'photos_incomplete' };
      return { ok: false, reason: 'server' };
    },
  };
}

export type AiApi = ReturnType<typeof createAiApi>;
