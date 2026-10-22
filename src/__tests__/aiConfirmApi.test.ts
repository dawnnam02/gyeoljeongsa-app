// [이대로 확정] 서버 오류 코드를 앱이 구분하는가(B4): consent_missing · survey_incomplete · photos_incomplete · ai_not_ready · 인터넷 · 그 밖
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAiApi } from '@/lib/aiApi';

const clientWith = (error: { code?: string; message: string } | null) => ({ rpc: jest.fn(async () => ({ data: null, error })) }) as unknown as SupabaseClient;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('confirm_profile 오류 구분', () => {
  test.each([
    ['consent_missing: CK8', 'consent_missing'],
    ['survey_incomplete: A05,A06', 'survey_incomplete'],
    ['photos_incomplete', 'photos_incomplete'],
    ['ai_not_ready', 'not-ready'],
  ])('%s → %s', async (message, reason) => {
    expect(await createAiApi(clientWith({ code: 'P0001', message })).confirm('r1')).toEqual({ ok: false, reason });
  });

  test('인터넷 문제는 network, 모르는 오류는 server, 성공은 ok', async () => {
    expect(await createAiApi(clientWith({ message: 'Failed to fetch' })).confirm('r1')).toEqual({ ok: false, reason: 'network' });
    expect(await createAiApi(clientWith({ code: 'XX000', message: 'boom' })).confirm('r1')).toEqual({ ok: false, reason: 'server' });
    expect(await createAiApi(clientWith(null)).confirm('r1')).toEqual({ ok: true });
  });
});
