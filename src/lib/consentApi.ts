// 동의 기록(03): 읽기와 저장. 서버 표 public.consents (backend/스키마.md 9-4: 넣기 열 user_id · item_code · agreed · text_version · app_version).
// 동의한 시각(agreed_at)은 서버가 채운다(열 권한이 없다).
//  · 필수 칸은 동의한 기록만 남고, 선택 칸(CK4 · CK9)은 예 · 아니오 모두 남긴다(동의문구 6장 1번)
//  · [동의하고 계속]을 누르는 순간 한 번에 저장한다(요청 하나 = 한 트랜잭션). 누르기 전에는 저장하지 않는다(6장 2번)
//  · 문구 판이 바뀌면 새 기록을 더하고 이전 기록은 고치지 않는다(6장 3번)
//  · 3부-아(0041 · 법무 L22 1-5): 받은 곳 source 한 칸 — signup(03) · survey_card(설문 카드 CK4 · CK15) · feature_sheet(기능 시트 CK11 ~ CK14 · CK16) · settings(동의 관리).
//    줄 60개 상한에 걸리면 서버가 too_many_consents(54000 · DETAIL consent_rows_full · HINT support) — reason 'limit'(화면은 고객센터 안내 글)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { CONSENT_CODES, type ConsentCode } from '@/content/types';

import { readDbFailure } from './serverError';

export type ActiveConsent = { item_code: string; text_version: string };
export type ConsentFailure = 'network' | 'server';
export type ConsentRecordFailure = ConsentFailure | 'limit';
export type ConsentSource = 'signup' | 'survey_card' | 'feature_sheet' | 'settings';

export type ConsentRowInput = {
  user_id: string;
  item_code: ConsentCode;
  agreed: boolean;
  text_version: string;
  app_version: string;
  source?: ConsentSource; // 0041 받은 곳(빈 값 = 옛 앱 · 서버가 받음)
};

// 유효한 동의 = agreed 이고 철회되지 않은 행
export async function loadActiveConsents(
  client: SupabaseClient,
): Promise<{ ok: true; rows: ActiveConsent[] } | { ok: false; reason: ConsentFailure }> {
  const { data, error } = await client.from('consents').select('item_code,text_version').eq('agreed', true).is('revoked_at', null);
  if (error) return { ok: false, reason: readDbFailure(error).network ? 'network' : 'server' };
  const rows = (Array.isArray(data) ? data : []).filter(
    (r): r is ActiveConsent => typeof r?.item_code === 'string' && typeof r?.text_version === 'string',
  );
  return { ok: true, rows };
}

// 화면에 보인 칸(shown)과 체크 결과(checked)에서 저장할 행을 만든다.
export function buildConsentRows(args: {
  userId: string;
  shown: readonly ConsentCode[];
  checked: Readonly<Record<ConsentCode, boolean>>;
  required: ReadonlySet<ConsentCode>;
  appVersion: string;
  source?: ConsentSource;
}): ConsentRowInput[] {
  const rows: ConsentRowInput[] = [];
  for (const code of CONSENT_CODES) {
    if (!args.shown.includes(code)) continue;
    const agreed = args.checked[code] === true;
    if (args.required.has(code) && !agreed) continue; // 필수 칸은 동의한 기록만 남긴다
    rows.push({ user_id: args.userId, item_code: code, agreed, text_version: CONSENT_TEXT_VERSIONS[code], app_version: args.appVersion, source: args.source ?? 'signup' });
  }
  return rows;
}

// 한 번에 저장한다. 이미 같은 판의 유효 동의가 있어 유일 제약(23505)에 걸리면, 방금 저장이 성공했는데 응답만 놓친 것일 수 있어
// 서버에 있는 기록으로 다시 확인한다(저장하려던 동의가 모두 있으면 성공으로 본다).
export async function recordConsents(client: SupabaseClient, rows: readonly ConsentRowInput[]): Promise<{ ok: true } | { ok: false; reason: ConsentRecordFailure }> {
  if (rows.length === 0) return { ok: true };
  const { error } = await client.from('consents').insert([...rows]);
  if (!error) return { ok: true };
  const failure = readDbFailure(error);
  if (failure.code === '54000' || String((error as { message?: string }).message ?? '').startsWith('too_many_consents')) return { ok: false, reason: 'limit' }; // 0041 상한
  if (failure.code === '23505') {
    const current = await loadActiveConsents(client);
    if (current.ok) {
      const wanted = rows.filter((r) => r.agreed);
      const present = (r: ConsentRowInput) => current.rows.some((c) => c.item_code === r.item_code && c.text_version === r.text_version);
      if (wanted.every(present)) return { ok: true };
    }
  }
  return { ok: false, reason: failure.network ? 'network' : 'server' };
}
