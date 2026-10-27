// 종교 별도 동의(CK4) — 설문 A06 앞 카드(3부-사 · D-219 · 본인 결정 '정치 CK15 와 같은 방식' · 법무 L22 · 카피 17장).
//  · 서버(0023 validate_survey_answer): A06 에 종교 값을 저장하려면 유효한 CK4(동의함 · 철회 없음)가 있어야 한다. '답하지 않음'(null)은 동의 없이 받는다
//  · 카드는 유효한 CK4 가 없을 때만(03 에서 고르지 않았거나 설정에서 거둔 회원 — L22 A안). 동의 = CK4 동의 줄(지금 판 CONSENT_TEXT_VERSIONS.CK4) · 거절도 '동의 안 함' 줄(L22 1-5 · 동의문구 6장 1번)
//  · 03 · 동의 관리와 같은 consents 표 · 같은 판 → 설정 '동의 관리'에 켜짐으로 보이고 거둘 수 있다(L22 C1 · C9 — 다시 동의하면 새 줄)
//  · 로그에는 이벤트 이름과 코드만
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { loadActiveConsents, recordConsents } from '@/lib/consentApi';
import { safeLog } from '@/lib/log';

export type ReligionFailure = 'network' | 'server';
export type ReligionApi = {
  load: () => Promise<{ ok: true; on: boolean } | { ok: false; reason: ReligionFailure }>; // on = 유효한 CK4 가 있다(카드 없이 A06)
  record: (agreed: boolean) => Promise<{ ok: true } | { ok: false; reason: ReligionFailure }>;
};

// opts.guestUserId: 데모 모드에서 로그인 없이 연 설문(손님)의 사용자 칸. 실서버에는 넘기지 않는다
export function createReligionApi(client: SupabaseClient, appVersion = 'dev', opts: { guestUserId?: string } = {}): ReligionApi {
  return {
    async load() {
      const r = await loadActiveConsents(client);
      if (!r.ok) return r;
      return { ok: true, on: r.rows.some((row) => row.item_code === 'CK4') };
    },
    async record(agreed) {
      const { data } = await client.auth.getSession();
      const userId = data.session?.user?.id ?? opts.guestUserId;
      if (!userId) return { ok: false, reason: 'server' };
      const saved = await recordConsents(client, [{ user_id: userId, item_code: 'CK4', agreed, text_version: CONSENT_TEXT_VERSIONS.CK4, app_version: appVersion }]);
      safeLog({ event: 'religion_consent', status: saved.ok ? (agreed ? 'agreed' : 'declined') : saved.reason });
      return saved;
    },
  };
}
