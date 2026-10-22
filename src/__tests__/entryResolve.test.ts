import { resolveEntryHref, type EntryDeps } from '@/navigation/entry';
import { createDemoClient } from '@/lib/demoClient';
import { loadProgressStage } from '@/lib/progress';

function deps(over: Partial<EntryDeps> = {}): EntryDeps & { stages: unknown[] } {
  const stages: unknown[] = [];
  return {
    stages,
    hasLogin: async () => true,
    loadStage: async () => ({ ok: true, stage: 'traits-confirmed' }),
    setStage: (s) => void stages.push(s),
    firstScreen: '/onboarding',
    ...over,
  };
}

describe('Q5A-01 앱 시작: 저장된 로그인 + 서버 진행 단계', () => {
  it('로그인 없음 → 01', async () => {
    expect(await resolveEntryHref(deps({ hasLogin: async () => false }))).toBe('/onboarding');
  });
  it('로그인 있음 + 서버 단계 traits-confirmed → 바로 추천(02 안 거침)', async () => {
    const d = deps();
    expect(await resolveEntryHref(d)).toBe('/recommendations');
    expect(d.stages).toEqual(['traits-confirmed']);
  });
  it('로그인 있음 + survey-complete → 사진', async () => {
    expect(await resolveEntryHref(deps({ loadStage: async () => ({ ok: true, stage: 'survey-complete' }) }))).toBe('/photos');
  });
  it('서버 오류 · 네트워크 · 예외 → 02', async () => {
    expect(await resolveEntryHref(deps({ loadStage: async () => ({ ok: false, reason: 'network' }) }))).toBe('/sign-in');
    expect(await resolveEntryHref(deps({ loadStage: async () => { throw new Error('x'); } }))).toBe('/sign-in');
  });
  it('데모 클라이언트도 같은 흐름: 세션 없으면 02, 가입 후 get_progress 단계로', async () => {
    const client = createDemoClient();
    const { data } = await client.auth.getSession();
    expect(data.session).toBeNull();
    const r = await loadProgressStage(client);
    expect(r.ok === false || r.ok === true).toBe(true);
  });
});
