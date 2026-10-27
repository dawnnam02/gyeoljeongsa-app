// F20 조건 5: 데모 백엔드가 실서버와 같은 이름 · 같은 응답 모양으로 학교 검색 · 저장 · 이어서 하기를 한다.
//  화면이 쓰는 API(features/surveyV2/api.ts)를 데모 가짜 클라이언트 위에서 그대로 돌린다(실서버 코드 길과 같은 길).
import type { SupabaseClient } from '@supabase/supabase-js';

import { createSurveyV2Api, readSchoolRows, V2_SERVER } from '@/features/surveyV2/api';
import { createLocalDraftStore, draftKey, parseLocalDraft } from '@/features/surveyV2/localDraft';
import { createDemoV2Memory, createSurveyV2DemoClient, DEMO_V2_GUEST, demoV2ValueOk } from '@/demo/surveyV2Backend';
import { chunkedStorage } from '@/lib/chunkedStorage';

import { createMemoryStore } from './memoryStore';

jest.mock('@/lib/log', () => ({ safeLog: jest.fn() }));

const base = (id: string | null, email = 'f20@email.com') =>
  ({ auth: { getSession: async () => ({ data: { session: id ? { user: { id, email } } : null }, error: null }) } }) as unknown as Pick<SupabaseClient, 'auth'>;

function setup(id: string | null = 'u1', email?: string) {
  const memory = createDemoV2Memory();
  const client = createSurveyV2DemoClient(base(id, email), { memory });
  const api = createSurveyV2Api(client, { demo: true, proofUpload: true, schoolSearch: 'server' });
  return { memory, client, api };
}

describe('서버 이름(가정 포함) 한 곳', () => {
  test('있는 함수는 지금 이름 그대로, 새 함수는 가정 이름', () => {
    expect(V2_SERVER.saveAnswers).toBe('save_answers');
    expect(V2_SERVER.saveTexts).toBe('save_free_texts');
    expect(V2_SERVER.savePrompt).toBe('save_my_prompt');
    expect(V2_SERVER.progress).toBe('get_progress');
    expect(V2_SERVER.searchSchools).toBe('search_schools');
    expect(V2_SERVER.appealAnalyze).toBe('appeal-analyze'); // S16 Edge
  });
});

describe('저장 → 읽기(이어서 하기)', () => {
  test('답 · 글 · 결혼 이야기 · 공개 스위치를 저장하고 다시 읽으면 같고, 첫 빈 문항을 알려 준다', async () => {
    const { api, memory } = setup();
    const saved = await api.save({
      answers: { A12: '김하나', A02: 'female', A11: 'na', C05: null, B02: { school_key: 'K0109' } },
      texts: { T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.', T04: '미국에서 2년 동안 대학원 석사 과정을 마쳤어요.' },
      stories: { Q17: '양가에 하루씩 나눠 다녀오고 싶어요.' },
      publicOn: { E01: true },
    });
    expect(saved).toEqual({ ok: true });
    const r = await api.load();
    if (!r.ok) throw new Error('load');
    expect(r.data.userKey).toBe('u1');
    expect(r.data.answers).toMatchObject({ A12: '김하나', A02: 'female', C05: null, B02: { school_key: 'K0109' }, T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.' });
    expect(r.data.appeal).toEqual({ T04: '미국에서 2년 동안 대학원 석사 과정을 마쳤어요.' });
    expect(r.data.stories).toEqual({ Q17: '양가에 하루씩 나눠 다녀오고 싶어요.' });
    expect(r.data.publicOn).toEqual({ E01: true });
    expect(r.data.firstMissing).toBe('A03');
    expect(memory.users.get('u1')?.visibility).toEqual({ e01_wedding_time: true });
  });

  test('값이 하나라도 틀리면 아무것도 저장하지 않는다(서버 검사식처럼)', async () => {
    const { api, memory } = setup();
    expect(await api.save({ answers: { A02: 'female', A06: 'decline' } })).toEqual({ ok: false, reason: 'server' });
    expect(memory.users.get('u1')?.answers).toEqual({});
    expect(demoV2ValueOk('A06', null)).toBe(false); // 종교는 '말하고 싶지 않아요' 없음
    expect(demoV2ValueOk('F07', ['other'])).toBe(false); // D-199: F07 문항 없음 — 저장 받지 않음(서버 0036 트리거와 같음)
    expect(demoV2ValueOk('B02', { school_key: '없는키' })).toBe(false);
  });

  test('글은 3개씩 나눠 보낸다(지금 서버 save_free_texts 한도 3)', async () => {
    const { api, memory } = setup();
    const t = (n: number) => `${n}번째 글을 열 글자 넘게 써 봐요.`;
    expect(await api.save({ texts: { T04: t(4), T05: t(5), T06: t(6), T07: t(7), T08: t(8) } })).toEqual({ ok: true });
    expect(memory.users.get('u1')?.calls.save_free_texts).toBe(2);
    expect(Object.keys(memory.users.get('u1')?.texts ?? {})).toHaveLength(5);
  });

  test('어필 카드를 저장하면 분석(appeal-analyze)을 한 번 부른다 · 다른 글만 저장하면 부르지 않는다', async () => {
    const { api, memory } = setup();
    await api.save({ texts: { T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.' } });
    expect(memory.users.get('u1')?.calls['appeal-analyze']).toBeUndefined();
    await api.save({ texts: { T05: '영어로 회의를 할 수 있는 정도예요.' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(memory.users.get('u1')?.calls['appeal-analyze']).toBe(1);
  });

  test('숨은 문항 옛 값 지우기(clear_answers)', async () => {
    const { api, memory } = setup();
    await api.save({ answers: { B01: 'univ', B06: 'grad' } });
    await api.save({ answers: { B01: 'hs' }, clear: ['B06'] });
    expect(memory.users.get('u1')?.answers).toEqual({ B01: 'hs' });
  });

  test('결혼 이야기는 질문 소개와 같은 3칸: 바꾸면 같은 칸, 지우면 칸이 빈다', async () => {
    const { api, memory } = setup();
    await api.load();
    await api.save({ stories: { Q17: '명절에는 번갈아 다녀오고 싶어요.', Q20: '한 달 생활비를 함께 정해요.' } });
    await api.save({ stories: { Q17: '명절에는 양가를 번갈아 다녀오고 싶어요.', Q20: null } });
    expect([...(memory.users.get('u1')?.prompts.entries() ?? [])]).toEqual([[1, { code: 'Q17', answer: '명절에는 양가를 번갈아 다녀오고 싶어요.' }]]);
  });

  test('로그인 없이 열면 손님 한 명으로 둔다(웹 점검용)', async () => {
    const { api, memory } = setup(null);
    await api.save({ answers: { A02: 'male' } });
    expect(memory.users.has(DEMO_V2_GUEST)).toBe(true);
  });

  test('장면 v2savefail: 저장이 인터넷 문제로 실패', async () => {
    const { api } = setup('u2', 'v2savefail@email.com');
    expect(await api.save({ answers: { A02: 'male' } })).toEqual({ ok: false, reason: 'network' });
  });
});

describe('학교 검색 · 증빙', () => {
  test('검색 함수(search_schools)는 내장 목록과 같은 줄 모양을 돌려준다 · 수준 칸 없음', async () => {
    const { api, client } = setup();
    const r = await api.searchSchools('연대', { courses: ['U', 'C', 'G'] });
    if (!r.ok) throw new Error('search');
    expect(r.rows[0]).toMatchObject({ school_key: 'K0138', name: '연세대학교', via: 'alias' });
    const raw = await client.rpc('search_schools', { p_query: '관동대학교', p_courses: null, p_limit: 3 });
    const rows = readSchoolRows(raw.data);
    expect(rows?.[0]).toMatchObject({ name: '가톨릭관동대학교', via: 'old', matched: '관동대학교' });
    expect(JSON.stringify(raw.data)).not.toMatch(/tier|ratio/);
    expect(Array.isArray(raw.data)).toBe(true); // S16 2장: 배열 · 과정 이름 · way
    expect(Object.keys((raw.data as Record<string, unknown>[])[0])).toEqual(['school_key', 'name', 'now_name', 'matched', 'way', 'course']);
    expect((raw.data as Record<string, unknown>[])[0]).toMatchObject({ way: '옛 이름', course: '대학교' });
    const only = await client.rpc('search_schools', { p_query: '서울대', p_courses: ['대학원'], p_limit: 3 });
    expect((only.data as { course: string }[]).every((r) => r.course === '대학원')).toBe(true);
  });

  test('실서버 설정(local)도 같은 결과를 기기 안에서 찾는다', async () => {
    const api = createSurveyV2Api({} as SupabaseClient, { demo: false, proofUpload: false, schoolSearch: 'local' });
    const r = await api.searchSchools('ㅅㅇㄷ', {});
    expect(r.ok && r.rows[0].name).toBe('서울대학교');
    expect(await api.uploadProof('T04')).toEqual({ ok: false, reason: 'server' }); // 실서버는 증빙 흐름이 없어 버튼을 숨긴다
  });

  test('증빙 올리기 → 확인 중, 장면 v2prooffail 은 첫 번째만 실패(다시 올려 주세요)', async () => {
    const { api } = setup();
    expect(await api.uploadProof('T05')).toEqual({ ok: true, state: 'pending' });
    const failing = setup('u3', 'v2prooffail@email.com').api;
    expect((await failing.uploadProof('T04')).ok).toBe(false);
    expect(await failing.uploadProof('T04')).toEqual({ ok: true, state: 'pending' });
    const loaded = await failing.load();
    expect(loaded.ok && loaded.data.proofs).toEqual({ T04: 'pending' });
  });
});

describe('로컬 저장(민감 저장소)', () => {
  test('사용자마다 열쇠가 다르고 SecureStore 열쇠 글자만 쓴다', () => {
    expect(draftKey('a1b2-c3:d4')).toBe('survey_v2.a1b2-c3_d4');
  });
  test('저장 · 읽기 · 지우기, 깨진 값은 없는 것으로', async () => {
    const { store } = createMemoryStore();
    const local = createLocalDraftStore(chunkedStorage(store));
    const value = { v: 1 as const, drafts: { A12: { kind: 'text' as const, text: '김하나' } }, pending: ['A12'], publicOn: { E01: true }, stage: 'flow' as const, at: 'A02', seen: [], updatedAt: 1 };
    await local.save('u1', value);
    expect(await local.load('u1')).toEqual(value);
    expect(await local.load('u2')).toBeNull();
    await local.clear('u1');
    expect(await local.load('u1')).toBeNull();
    expect(parseLocalDraft('{"v":2}')).toBeNull();
    expect(parseLocalDraft('깨짐')).toBeNull();
  });
});
