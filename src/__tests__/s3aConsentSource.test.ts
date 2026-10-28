// 3부-아 ②(0041 · 법무 L22 1-5 · 2-3): 동의 기록에 받은 곳(source) 한 칸 · 줄 60개 상한(too_many_consents)
//  signup(03) · survey_card(설문 카드 CK4 · CK15) · feature_sheet(기능 시트 CK11 ~ CK14 · CK16) · settings(동의 관리 · 알림)
import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSENT_TEXT_VERSIONS } from '@/config/consent';
import { createSurveyChatApi } from '@/features/surveyChat/api';
import { createPoliticsApi } from '@/features/surveyV2/politics';
import { createReligionApi } from '@/features/surveyV2/religion';
import { buildConsentRows, recordConsents } from '@/lib/consentApi';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createSettingsApi } from '@/lib/settingsApi';

jest.mock('@/lib/log', () => ({ safeLog: jest.fn() }));

type Row = Record<string, unknown>;
function capture() {
  const rows: Row[] = [];
  const client = {
    from: () => ({
      insert: async (r: Row[]) => {
        rows.push(...r);
        return { error: null };
      },
    }),
    rpc: async () => ({ data: null, error: null }),
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }) },
  } as unknown as SupabaseClient;
  return { client, rows };
}

describe('② 받은 곳(source)', () => {
  test('03 = signup · 설문 정치 · 종교 카드 = survey_card · CK16 = feature_sheet · 동의 관리 = settings · 지인 차단 시트 CK11 = feature_sheet', async () => {
    const r03 = buildConsentRows({ userId: 'u', shown: ['CK1', 'CK4'], checked: { CK1: true, CK4: false } as never, required: new Set(['CK1']) as never, appVersion: 't' });
    expect(r03.map((r) => r.source)).toEqual(['signup', 'signup']);
    const pol = capture();
    await createPoliticsApi(pol.client, 't').agree();
    const rel = capture();
    await createReligionApi(rel.client, 't').record(false);
    const ck16 = capture();
    await createSurveyChatApi(ck16.client, 't').agreeCk16();
    const st = capture();
    await createSettingsApi(st.client, 't').setOptional('CK9', true);
    const sheet = capture();
    await createSettingsApi(sheet.client, 't').setOptional('CK11', true, 'feature_sheet');
    expect([pol, rel, ck16, st, sheet].map((c) => [c.rows[0]?.item_code, c.rows[0]?.source])).toEqual([
      ['CK15', 'survey_card'],
      ['CK4', 'survey_card'],
      ['CK16', 'feature_sheet'],
      ['CK9', 'settings'],
      ['CK11', 'feature_sheet'],
    ]);
  });

  test('데모 서버: 4값 밖은 거부(check) · 줄 60개 상한 = too_many_consents(54000 · consent_rows_full · support) → reason limit', async () => {
    const client = createDemoClient(createDemoBackend({ now: () => Date.UTC(2026, 9, 22) }));
    await client.functions.invoke('otp-gate', { body: { action: 'send', email: 'src@email.com' } });
    await client.functions.invoke('otp-gate', { body: { action: 'verify', email: 'src@email.com', token: DEMO_OTP_CODE } });
    const id = (await client.auth.getSession()).data.session?.user?.id ?? '';
    const row = (source: unknown) => ({ user_id: id, item_code: 'CK9', agreed: false, text_version: CONSENT_TEXT_VERSIONS.CK9, app_version: 't', source });
    expect((await client.from('consents').insert([row('somewhere')])).error?.code).toBe('23514');
    expect((await client.from('consents').insert([row('settings')])).error).toBeNull();
    for (let i = 0; i < 59; i += 1) expect((await client.from('consents').insert([row('settings')])).error).toBeNull();
    const full = await client.from('consents').insert([row('settings')]);
    expect(full.error).toMatchObject({ code: '54000', message: 'too_many_consents', details: 'consent_rows_full', hint: 'support' });
    expect(await recordConsents(client, [row('settings') as never])).toEqual({ ok: false, reason: 'limit' });
    expect(await createSettingsApi(client, 't').setOptional('CK9', true)).toEqual({ ok: false, reason: 'limit' });
  });
});
