// 정치성향 문항(W8, 청사진_v5 4-3 · L-6 · 결정 #15 · #25). 서버: backend/작업중/0029_politics.sql(백엔드 C).
//  · 저장 = 끌기 막대 연속값 0~100 정수(0 왼쪽 진보 · 50 가운데 · 100 오른쪽 보수). 매칭은 서버가 5칸으로 나눈다(경계는 오른쪽 칸)
//  · 민감정보(정치적 견해) → 별도 동의 CK15. 동의 없으면 서버가 저장을 거부한다(consent_required: CK15). 앱도 동의 전에는 set_politics 를 부르지 않는다
//  · 이 값은 설문 답(survey_answers)에 넣지 않는다 — AI 정리 · 프로필 · 등급 · 점수에 0. 앱은 자기 값만 get_politics 로 읽는다
//  · 칸 번호 · 숫자는 화면에 내지 않는다. bandOf 는 시험과 스크린리더 말(진보 쪽 · 가운데 …)에만 쓴다
//  · 로그에는 이벤트 이름과 코드만(값 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CK15_TEXT_VERSION } from '@/config/laterConsent';
import { recordConsents } from '@/lib/consentApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';
import type { ConsentCode } from '@/content/types';

// 서버 이름 한 곳 — '서버 이름 맞출 곳'(W8W9_변경기록 4장): 0029 작업중 초안은 인자 · 응답 키를 영어 '점수' 낱말로 지었는데,
// 앱 규칙(staticRules: 그 낱말은 src 어디에도 0)과 부딪혀 앱은 위치(position)로 가정했다. 백엔드 C 에 p_position · position 으로 맞춰 달라고 요청
export const POL_SERVER = {
  set: 'set_politics', // (p_position integer 0~100) → {saved, position} · 오류 forbidden · consent_required: CK15 · invalid_value · rate_limited
  get: 'get_politics', // () → {consent, answered, position}
  consentCode: 'CK15', // consents.item_code(선택 · 별도)
  consentVersion: CK15_TEXT_VERSION, // config/laterConsent.ts — DB 검사 모양(consent-YYYY.MM.DD-vN)의 임시 판. 법무 판_관리.md 에 CK15 판이 생기면 맞춘다(L17A)
} as const;

export type PoliticsState = { consent: boolean; answered: boolean; position: number | null };
export type PoliticsFailure = 'network' | 'server' | 'consent';
export type PoliticsResult<T> = { ok: true; data: T } | { ok: false; reason: PoliticsFailure };

export const clampPos = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// 5칸(0029 politics_band 와 같은 식): 0–19 · 20–39 · 40–59 · 60–79 · 80–100
export function bandOf(position: number): 1 | 2 | 3 | 4 | 5 {
  const s = clampPos(position);
  return (s >= 80 ? 5 : Math.floor(s / 20) + 1) as 1 | 2 | 3 | 4 | 5;
}
// 매칭 규칙(결정 #25): 칸 차이 1 이하. 앱은 매칭하지 않는다 — 서버 규칙과 같은지 시험으로만 본다
export const bandsMatch = (a: number, b: number) => Math.abs(bandOf(a) - bandOf(b)) <= 1;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function failOf(error: unknown): PoliticsFailure {
  const f = readDbFailure(isRecord(error) ? (error as { code?: string; message?: string }) : null);
  if (f.network) return 'network';
  const msg = isRecord(error) && typeof error.message === 'string' ? error.message : '';
  return msg.startsWith('consent_required') ? 'consent' : 'server';
}

export type PoliticsApi = {
  load: () => Promise<PoliticsResult<PoliticsState>>;
  agree: () => Promise<{ ok: true; data: true } | { ok: false; reason: PoliticsFailure | 'limit' }>; // limit = 0041 동의 기록 상한(화면은 CONSENT_MANAGE.tooMany)
  save: (position: number) => Promise<PoliticsResult<number>>;
};

// opts.guestUserId: 데모 모드에서 로그인 없이 연 설문(손님)의 사용자 칸. 실서버에는 넘기지 않는다
export function createPoliticsApi(client: SupabaseClient, appVersion = 'dev', opts: { guestUserId?: string } = {}): PoliticsApi {
  return {
    async load() {
      const { data, error } = await client.rpc(POL_SERVER.get);
      if (error) return { ok: false, reason: failOf(error) };
      const d = isRecord(data) ? data : {};
      const position = typeof d.position === 'number' && Number.isFinite(d.position) ? clampPos(d.position) : null;
      return { ok: true, data: { consent: d.consent === true, answered: d.answered === true && position !== null, position } };
    },
    async agree() {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id ?? opts.guestUserId;
      if (!userId) return { ok: false, reason: 'server' };
      const saved = await recordConsents(client, [
        { user_id: userId, item_code: POL_SERVER.consentCode as ConsentCode /* CK15 는 생성 코드 목록 밖(법무 판 생기면 합친다) */, agreed: true, text_version: POL_SERVER.consentVersion, app_version: appVersion, source: 'survey_card' }, // 0041 받은 곳
      ]);
      safeLog({ event: 'politics_consent', status: saved.ok ? 'ok' : saved.reason });
      return saved.ok ? { ok: true, data: true } : { ok: false, reason: saved.reason };
    },
    async save(position) {
      const p = clampPos(position);
      const { data, error } = await client.rpc(POL_SERVER.set, { p_position: p });
      if (error) {
        const reason = failOf(error);
        safeLog({ event: 'politics_save', status: reason });
        return { ok: false, reason };
      }
      const d = isRecord(data) ? data : {};
      safeLog({ event: 'politics_save', status: 'ok' });
      return { ok: true, data: typeof d.position === 'number' ? clampPos(d.position) : p };
    },
  };
}
