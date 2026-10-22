// 로그인한 계정의 '진행 단계'(K2 2-3 표)를 서버에 한 번 물어 정한다. 앱이 단계를 추측하지 않고, 서버가 알려 준 값만 쓴다.
//   rpc get_progress(p_consent_versions)  — backend/스키마.md 9-6b (S4). 본인 행만 읽고 아무것도 바꾸지 않는다
//   p_consent_versions: 앱이 지금 보여 주는 필수 동의 7칸의 문구 판. 이 판의 유효 동의가 없는 칸을 서버가 '바뀐 칸'으로 센다
//   stage 가 PROGRESS_STAGES 에 없으면 서버 오류로 본다
// facts(survey_first_missing · photo_slots …)는 04 · 05 가 이어 갈 위치를 정할 때 쓴다 — 지금은 타입만 있고 화면이 쓰지 않는다(설문은 AYLA'S 가 가져온다).
// 아래 consentStage · changedConsents · aiStage 는 03 재동의 화면과 시험이 쓰는 앱 쪽 판정으로 남겨 둔다.
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS, isCurrentEdition } from '@/config/consent';
import { CONSENT_CODES, type ConsentCode } from '@/content/types';
import { CONSENT_ITEMS } from '@/content/consentContent';
import { PROGRESS_STAGES, type ProgressStage } from '@/types/account';

import type { ActiveConsent } from './consentApi';
import { readDbFailure } from './serverError';

const REQUIRED: readonly ConsentCode[] = CONSENT_ITEMS.filter((item) => item.required).map((item) => item.code);

// 다시 동의를 받아야 하는 칸(동의문구 3-5): 필수 칸은 현재 문구 판의 유효 동의가 없는 것,
// 선택 칸은 이전에 동의했는데 현재 판의 동의가 없는 것(안 했던 선택 칸은 처음부터 묻지 않는다).
export function changedConsents(rows: readonly ActiveConsent[]): ConsentCode[] {
  const changed: ConsentCode[] = [];
  for (const code of CONSENT_CODES) {
    const mine = rows.filter((r) => r.item_code === code);
    const hasCurrent = mine.some((r) => isCurrentEdition(code, r.text_version));
    if (REQUIRED.includes(code) ? !hasCurrent : mine.length > 0 && !hasCurrent) changed.push(code);
  }
  return changed;
}

// 동의 기록 → 단계. 필수 칸의 기록이 하나도 없으면 동의 전(03), 일부가 옛 판이면 바뀐 칸만 다시(03 재동의), 모두 현재 판이면 동의 끝.
export function consentStage(rows: readonly ActiveConsent[]): 'birthdate-passed' | 'consent-changed' | 'consented' {
  const anyRequired = rows.some((r) => REQUIRED.includes(r.item_code as ConsentCode));
  if (!anyRequired) return 'birthdate-passed';
  return changedConsents(rows).some((code) => REQUIRED.includes(code)) ? 'consent-changed' : 'consented';
}

// get_progress 가 함께 주는 숫자 요약(이메일 · 사용자 ID · 답 내용은 없다). 04 · 05 가 이어 갈 위치에 쓴다
export type ProgressFacts = {
  readonly surveyFirstMissing: string | null; // 첫 빈 문항 ID (04 이어 가기)
  readonly photoSlots: number | null; // 대기 · 승인 사진 칸 수 0~3 (05 이어 가기)
  readonly consentNeeded: readonly string[]; // 다시 받을 동의 칸 코드
};

export type StageResult = { ok: true; stage: ProgressStage; facts?: ProgressFacts } | { ok: false; reason: 'network' | 'server' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// 앱이 지금 보여 주는 필수 동의 7칸의 문구 판
export function requiredConsentVersions(): Record<string, string> {
  return Object.fromEntries(REQUIRED.map((code) => [code, CONSENT_TEXT_VERSIONS[code]]));
}

function readFacts(value: unknown): ProgressFacts | undefined {
  if (!isRecord(value)) return undefined;
  return {
    surveyFirstMissing: typeof value.survey_first_missing === 'string' ? value.survey_first_missing : null,
    photoSlots: typeof value.photo_slots === 'number' ? value.photo_slots : null,
    consentNeeded: Array.isArray(value.consent_needed) ? value.consent_needed.filter((c): c is string => typeof c === 'string') : [],
  };
}

export async function loadProgressStage(client: SupabaseClient): Promise<StageResult> {
  const { data, error } = await client.rpc('get_progress', { p_consent_versions: requiredConsentVersions() });
  if (error) return { ok: false, reason: readDbFailure(error).network ? 'network' : 'server' };
  if (!isRecord(data) || typeof data.stage !== 'string' || !(PROGRESS_STAGES as readonly string[]).includes(data.stage)) return { ok: false, reason: 'server' };
  const facts = readFacts(data.facts);
  return facts ? { ok: true, stage: data.stage as ProgressStage, facts } : { ok: true, stage: data.stage as ProgressStage };
}

// 가장 최근 AI 건의 상태 → 진행 단계(K2 2-3 표). 건이 없으면 설문 · 사진을 마치고 제출하기 전이라 05('survey-complete')다 —
// 설문 · 사진이 덜 끝난 계정('consented')은 서버가 get_progress 에서 먼저 가른다. 확정된 계정도 서버가 먼저 가른다.
export function aiStage(status: string | null): 'survey-complete' | 'ai-processing' | 'ai-failed' | 'traits-pending' {
  if (status === 'pending') return 'ai-processing';
  if (status === 'failed') return 'ai-failed';
  if (status === 'ok') return 'traits-pending';
  return 'survey-complete';
}
