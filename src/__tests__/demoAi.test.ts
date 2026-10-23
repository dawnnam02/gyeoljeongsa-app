// F3 서버 쪽 흐름: 모의 서버(데모 모드)의 ai-profile · ai_results · confirm_profile 을 처음부터 끝까지 따라간다.
//  통과 조건 1(상태 읽기 · 지연) · 2(실패 → 다시 시도 → 직접 입력) · 3(스키마 값 그대로) · 4(user_edited 저장 · 원본 보존) · 진행 단계(progress.ts)
import fs from 'node:fs';

import { CONSENT_CODES, type ConsentCode } from '@/content/types';
import { REQUIRED_SET } from '@/features/consent/consentLogic';
import { aiStage, loadProgressStage } from '@/lib/progress';
import { createAiApi, failureFromRetryCount, readRow } from '@/lib/aiApi';
import { createAuthApi } from '@/lib/authApi';
import { buildConsentRows, recordConsents } from '@/lib/consentApi';
import { createDemoBackend, DEMO_AI_DELAY_MS, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { DEMO_AI_RESULT } from '@/lib/demoAiSample';
import { createDemoClient } from '@/lib/demoClient';

import { outsidePath, testOutside } from './helpers/outsideDocs';

const START = Date.UTC(2026, 9, 14, 3, 0, 0);

async function setup() {
  const clock = { now: START };
  const backend = createDemoBackend({ now: () => clock.now });
  const client = createDemoClient(backend);
  const auth = createAuthApi(client);
  await auth.sendCode('ai@email.co');
  await auth.verifyCode('ai@email.co', DEMO_OTP_CODE);
  await auth.saveBirth('1995-03-12');
  const all = Object.fromEntries(CONSENT_CODES.map((c) => [c, true])) as Record<ConsentCode, boolean>;
  const rows = buildConsentRows({ userId: (await auth.userId()) ?? '', shown: CONSENT_CODES, checked: all, required: REQUIRED_SET, appVersion: '0.1.0' });
  await recordConsents(client, rows);
  return { clock, backend, client, ai: createAiApi(client) };
}

// 시계와 타이머(서버 응답)를 같이 흘려보낸다
async function pass(s: Awaited<ReturnType<typeof setup>>, ms: number) {
  s.clock.now += ms;
  await jest.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => undefined); // 앱 로그(safeLog)가 시험 출력을 어지럽히지 않게
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('정상 응답(ok): 정리 중 → 정리 끝', () => {
  test('시작하면 처리 중이고, 4초 뒤 끝난다. 진행 단계도 따라간다', async () => {
    const s = await setup();
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'consented' }); // 아직 건이 없다
    const run = s.ai.startDemo('ok');
    const early = await s.ai.loadLatest();
    expect(early.ok && early.row?.status).toBe('pending');
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'ai-processing' });
    await pass(s, DEMO_AI_DELAY_MS.ok);
    const outcome = await run;
    expect(outcome.kind).toBe('ok');
    const done = await s.ai.loadLatest();
    expect(done.ok && done.row?.status).toBe('ok');
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'traits-pending' });
  });

  testOutside(['ai/시험/mock_20.json'])('결과의 5축 · 태그 · 요약 · 근거가 모의 20건(ai/시험/mock_20.json)의 첫 사례 출력과 같다(스키마 값 그대로)', async () => {
    const s = await setup();
    void s.ai.startDemo('ok');
    await pass(s, DEMO_AI_DELAY_MS.ok);
    const latest = await s.ai.loadLatest();
    if (!latest.ok || !latest.row?.original) throw new Error('결과가 없어요');
    const file = outsidePath('ai/시험/mock_20.json');
    const mock = JSON.parse(fs.readFileSync(file, 'utf8')) as { cases: { output: Record<string, unknown> }[] };
    const want = mock.cases[0].output;
    expect(latest.row.original.traits).toEqual(want.traits);
    expect([...latest.row.original.tags]).toEqual(want.tags);
    expect(latest.row.original.summary).toBe(want.summary);
    expect(latest.row.original.evidence).toEqual(want.evidence);
    expect(DEMO_AI_RESULT.summary).toBe(want.summary);
    expect(latest.row.original.tags.length).toBeLessThanOrEqual(5);
    expect(latest.row.original.summary.split(/(?<=요\.)\s/).length).toBe(3); // 해요체 세 문장
  });

  test('처리 중에 또 시작해도 새 건이 늘지 않는다', async () => {
    const s = await setup();
    void s.ai.startDemo('ok');
    const again = await s.ai.start();
    expect(again.kind).toBe('pending');
    expect(s.backend.peek.aiRows('ai@email.co')).toHaveLength(1);
  });
});

describe('지연 응답(slow): 60초가 넘어서 끝난다', () => {
  test('60초에도 처리 중이고 75초에 끝난다', async () => {
    const s = await setup();
    void s.ai.startDemo('slow');
    await pass(s, 60_000);
    const mid = await s.ai.loadLatest();
    expect(mid.ok && mid.row?.status).toBe('pending');
    await pass(s, DEMO_AI_DELAY_MS.slow - 60_000);
    const end = await s.ai.loadLatest();
    expect(end.ok && end.row?.status).toBe('ok');
  });
});

describe('실패 응답(fail): 다시 시도 → 직접 입력 (ai/설계.md 9-2 실패 단계 표)', () => {
  test('실패 1~4번째의 버튼: 다시 시도 3 · 3번째부터 직접 입력 · 4번째는 직접 입력만', async () => {
    const s = await setup();
    const first = s.ai.startDemo('fail');
    await pass(s, DEMO_AI_DELAY_MS.fail);
    const o1 = await first;
    expect(o1.kind === 'failed' && o1.info).toMatchObject({ stage: 1, retriesLeft: 3, showRetry: true, showManual: false, manual: null });
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'ai-failed' });

    const found = await s.ai.loadLatest();
    if (!found.ok || !found.row) throw new Error('건이 없어요');
    const id = found.row.id;
    const stages = [];
    for (let i = 0; i < 3; i += 1) {
      const run = s.ai.retry(id);
      const running = await s.ai.loadLatest();
      expect(running.ok && running.row?.status).toBe('pending'); // 다시 시도하면 바로 처리 중
      await pass(s, DEMO_AI_DELAY_MS.fail);
      const out = await run;
      if (out.kind !== 'failed') throw new Error('실패가 와야 해요');
      stages.push(out.info);
    }
    expect(stages.map((x) => [x.stage, x.retriesLeft, x.showRetry, x.showManual])).toEqual([
      [2, 2, true, false],
      [3, 1, true, true],
      [4, 0, false, true],
    ]);
    expect(stages[1].manual?.initialTraits).toBeDefined();
    expect(stages[1].manual?.tagCandidates.length).toBeGreaterThan(5);
    expect(await s.ai.retry(id)).toEqual({ kind: 'limit' }); // 4번째 실패 뒤에는 다시 시도할 수 없다
    // 읽기만으로도 같은 단계를 만든다(앱을 다시 열었을 때)
    expect(failureFromRetryCount(3)).toMatchObject({ stage: 4, showRetry: false, showManual: true });
  });

  test('직접 입력은 3번째 실패부터만 받고, 저장되면 건이 끝나 확정할 수 있다(source=manual · 원본 없음)', async () => {
    const s = await setup();
    const first = s.ai.startDemo('fail');
    await pass(s, DEMO_AI_DELAY_MS.fail);
    await first;
    const latest = await s.ai.loadLatest();
    if (!latest.ok || !latest.row) throw new Error('건이 없어요');
    const id = latest.row.id;
    const view = { traits: { extraversion: 40, planning: 60, family: 70, economy: 50, conflict: 55 }, tags: ['차분함'], summary: '' };
    expect((await s.ai.manual(id, view)).kind).toBe('error'); // 1번째 실패: 아직 안 된다
    for (let i = 0; i < 2; i += 1) {
      const run = s.ai.retry(id);
      await pass(s, DEMO_AI_DELAY_MS.fail);
      await run;
    }
    expect((await s.ai.manual(id, { ...view, tags: ['아홉글자이상태그입니다'] })).kind).toBe('error'); // 8자 넘는 태그는 거절
    expect((await s.ai.manual(id, view)).kind).toBe('ok');
    const done = await s.ai.loadLatest();
    if (!done.ok || !done.row) throw new Error('건이 없어요');
    expect(done.row.status).toBe('ok');
    expect(done.row.source).toBe('manual');
    expect(done.row.original).toBeNull();
    expect(done.row.edited?.traits).toEqual(view.traits);
    expect((await s.ai.confirm(id)).ok).toBe(true);
    expect(s.backend.peek.active('ai@email.co')).toBe(true);
  });
});

describe('수정 저장(user_edited)과 확정(confirm_profile)', () => {
  async function finished() {
    const s = await setup();
    void s.ai.startDemo('ok');
    await pass(s, DEMO_AI_DELAY_MS.ok);
    const latest = await s.ai.loadLatest();
    if (!latest.ok || !latest.row) throw new Error('건이 없어요');
    return { s, row: latest.row };
  }

  test('[저장]은 user_edited 에만 쓰고 AI 원본(result)은 그대로다', async () => {
    const { s, row } = await finished();
    const edited = { traits: { ...row.original!.traits, extraversion: 35 }, tags: ['차분함', '계획적'], summary: '계획을 세우고 지키는 편이고, 가족과 보내는 시간을 중요하게 여겨요. 돈은 함께 관리해요.' };
    expect(await s.ai.saveEdited(row.id, edited)).toEqual({ ok: true });
    const after = await s.ai.loadLatest();
    if (!after.ok || !after.row) throw new Error('건이 없어요');
    expect(after.row.edited).toEqual(edited);
    expect(after.row.original).toEqual(row.original); // 원본 보존
    expect(after.row.confirmedAt).toBeNull(); // 저장은 확정이 아니다
    const server = s.backend.peek.aiRows('ai@email.co')[0];
    expect(server.original).toEqual(DEMO_AI_RESULT);
    expect(server.confirmed).toBe(false);
  });

  test('원본 열(result)이나 다른 열은 고칠 수 없다(열 단위 권한)', async () => {
    const { s, row } = await finished();
    const hit = await s.client.from('ai_results').update({ result: { traits: {} } }).eq('id', row.id);
    expect(hit.error?.code).toBe('42501');
    const status = await s.client.from('ai_results').update({ status: 'failed' }).eq('id', row.id);
    expect(status.error?.code).toBe('42501');
    expect(s.backend.peek.aiRows('ai@email.co')[0].original).toEqual(DEMO_AI_RESULT);
  });

  test('서버 검사식과 같은 규칙: 5축 모두 0~100 정수 · 태그 5개 이하 8자 이하 · 요약 200자 이하', async () => {
    const { s, row } = await finished();
    const base = { traits: row.original!.traits, tags: ['차분함'], summary: '요약' };
    const bad = [
      { ...base, traits: { ...base.traits, planning: 101 } },
      { ...base, traits: { ...base.traits, planning: 50.5 } },
      { ...base, tags: ['하나', '둘이', '셋이', '넷이', '다섯이', '여섯이'] },
      { ...base, tags: ['아홉글자이상태그입니다'] },
      { ...base, summary: 'ㅇ'.repeat(201) },
    ];
    for (const view of bad) expect((await s.ai.saveEdited(row.id, view)).ok).toBe(false);
    expect((await s.ai.saveEdited(row.id, base)).ok).toBe(true);
  });

  test('[이대로 확정]: confirm_profile 이 건을 확정하고 계정이 정상(active)이 된다. 수정본이 있으면 수정본이 최종이다', async () => {
    const { s, row } = await finished();
    const edited = { traits: { ...row.original!.traits, family: 80 }, tags: ['가족 중심'], summary: '가족과 보내는 시간을 중요하게 여겨요. 돈은 함께 관리하며 저축을 우선해요.' };
    await s.ai.saveEdited(row.id, edited);
    expect((await s.ai.confirm(row.id)).ok).toBe(true);
    expect(s.backend.peek.active('ai@email.co')).toBe(true);
    expect(await loadProgressStage(s.client)).toMatchObject({ ok: true, stage: 'traits-confirmed' });
    const server = s.backend.peek.aiRows('ai@email.co')[0];
    expect(server.confirmed).toBe(true);
    expect(server.edited).toEqual(edited);
    expect(server.original).toEqual(DEMO_AI_RESULT);
  });

  test('처리가 끝나기 전에는 확정할 수 없다(ai_not_ready)', async () => {
    const s = await setup();
    void s.ai.startDemo('slow');
    const latest = await s.ai.loadLatest();
    if (!latest.ok || !latest.row) throw new Error('건이 없어요');
    expect(await s.ai.confirm(latest.row.id)).toEqual({ ok: false, reason: 'not-ready' });
  });
});

describe('읽기 도우미', () => {
  test('aiStage: 건 상태 → 진행 단계', () => {
    expect(aiStage(null)).toBe('survey-complete'); // 건이 없다 = 설문 · 사진을 마치고 제출 전(05). 설문이 덜 끝난 계정은 서버가 먼저 가른다
    expect(aiStage('pending')).toBe('ai-processing');
    expect(aiStage('failed')).toBe('ai-failed');
    expect(aiStage('ok')).toBe('traits-pending');
  });

  test('readRow: 모르는 모양은 버린다', () => {
    expect(readRow(null)).toBeNull();
    expect(readRow({ id: 'a', status: 'weird' })).toBeNull();
    expect(readRow({ id: 'a', status: 'pending' })?.original).toBeNull();
  });
});
