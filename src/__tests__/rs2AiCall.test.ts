/**
 * @jest-environment node
 */
// RS2-01 순 3 [가] 길 고르기 · 머리 · 본문 금지 값 · [라] 같은 요청 = 같은 키 — AI 호출 길의 순수한 부분(화면 없음).
//  서버는 가짜 fetch 가 대신한다(실서버 접속 0 · 유료 0). 토큰은 시험용 글자뿐이다.
import fs from 'node:fs';
import path from 'node:path';

import {
  AI_REAL_VIA_EAS,
  AI_RUN_PATH,
  FORBIDDEN_BODY_KEYS,
  IDEMPOTENCY_KEY_RE,
  aiRouteOf,
  createKeyKeeper,
  newIdempotencyKey,
  postAiRun,
  postAiRunKeyed,
  stripForbidden,
  type AiRunEnv,
  type AiRunFetch,
} from '@/features/ait/aiCall';
import { AIT_BODY_KEYS, callAit, pickBody } from '@/features/ait/aitClient';
import { pickS5Body, postSaju5Run } from '@/features/saju/ai/aiClient';

type Served = { status: number; body: unknown } | 'throw' | 'nojson';

function fake(...queue: Served[]) {
  const calls: { url: string; init: Parameters<AiRunFetch>[1] }[] = [];
  const lost = jest.fn();
  const fetchImpl: AiRunFetch = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift() ?? { status: 200, body: {} };
    if (next === 'throw') throw new TypeError('network');
    if (next === 'nojson') return { status: 401, json: async () => Promise.reject(new SyntaxError('html')) };
    return { status: next.status, json: async () => next.body };
  };
  const env: AiRunEnv = { url: 'https://proj.example.test', apikey: 'pub-key-for-test', token: async () => 'tok-for-test', fetch: fetchImpl, onAuthLost: lost };
  return { env, calls, lost };
}
const sentBody = (c: { init: { body: string } }) => JSON.parse(c.init.body) as Record<string, unknown>;
const okBody = { ok: true, code: 'ok', mode: 'mock', display: { a: 1 }, charge: { state: 'settled' } };

describe('[가] 길 고르기 — 한 곳에서, 지금 있는 설정(데모 표시 · 접근 코드)만으로', () => {
  test('데모 판: 코드 없음 → 모의(요청 0) · 코드 있음 → AI 서버 판(EAS 예비 길)', () => {
    expect(aiRouteOf({ demoMode: true, code: null })).toBe('mock');
    expect(aiRouteOf({ demoMode: true, code: 'ait-x' })).toBe('eas');
  });
  test('실서버 판: 코드가 있든 없든 ai-run — EAS 는 꺼짐(예비를 켜는 값은 코드 상수 하나, 기본 꺼짐)', () => {
    expect(AI_REAL_VIA_EAS).toBe(false);
    expect(aiRouteOf({ demoMode: false, code: null })).toBe('ai-run');
    expect(aiRouteOf({ demoMode: false, code: 'ait-x' })).toBe('ai-run');
    expect(aiRouteOf({ demoMode: false, code: 'ait-x', realViaEas: true })).toBe('eas'); // 예비 길은 지우지 않았다
    expect(aiRouteOf({ demoMode: false, code: null, realViaEas: true })).toBe('ai-run'); // 코드 없이는 EAS 불가
  });
  test('데모 표시는 지금 있는 환경 변수 하나로 읽는다 — 시험 환경(값 없음)은 실서버 판 취급', () => {
    const real = process.env.EXPO_PUBLIC_DEMO_MODE;
    try {
      delete process.env.EXPO_PUBLIC_DEMO_MODE;
      expect(aiRouteOf({ code: null })).toBe('ai-run');
      process.env.EXPO_PUBLIC_DEMO_MODE = '1';
      expect(aiRouteOf({ code: null })).toBe('mock');
      expect(aiRouteOf({ code: 'c' })).toBe('eas');
    } finally {
      if (real === undefined) delete process.env.EXPO_PUBLIC_DEMO_MODE;
      else process.env.EXPO_PUBLIC_DEMO_MODE = real;
    }
  });
  test('새 EXPO_PUBLIC_ 이름 0 · 서버 스위치 ai_run 을 앱이 읽지 않는다 · 키 값을 적지 않는다', () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
        return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const src = path.join(__dirname, '..');
    const names = new Set<string>();
    for (const f of walk(src)) {
      const t = fs.readFileSync(f, 'utf8');
      for (const m of t.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) names.add(m[0]);
    }
    expect([...names].sort()).toEqual(['EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL']); // 지금 있는 셋 그대로
    for (const rel of ['features/ait/aiCall.ts', 'features/ait/aitClient.ts', 'features/saju/ai/aiRun.ts', 'features/saju/ai/aiClient.ts', 'features/ait/useAitRun.ts', 'lib/aiRunEnv.ts']) {
      const t = fs.readFileSync(path.join(src, rel), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(t).not.toMatch(/\bai_run\b/); // 스위치는 서버 전용
      expect(t).not.toMatch(/service_role|sk-ant|ANTHROPIC|secret/i);
    }
  });
});

describe('[가] 보내는 머리 · 주소 · 본문', () => {
  test('주소 = <서버 주소>/functions/v1/ai-run · POST · 머리는 authorization · apikey · content-type · idempotency-key 넷뿐 · 쿠키 0(credentials omit)', async () => {
    const s = fake({ status: 200, body: okBody });
    const res = await callAit('compat', { shared: { hobby: 'x' } }, { route: 'ai-run', code: null, keys: createKeyKeeper(), env: s.env });
    expect(res.kind).toBe('reply');
    expect(s.calls).toHaveLength(1);
    const c = s.calls[0];
    expect(c.url).toBe(`https://proj.example.test${AI_RUN_PATH}`);
    expect(AI_RUN_PATH).toBe('/functions/v1/ai-run');
    expect(c.init.method).toBe('POST');
    expect(Object.keys(c.init.headers).sort()).toEqual(['apikey', 'authorization', 'content-type', 'idempotency-key']);
    expect(c.init.headers.authorization).toBe('Bearer tok-for-test');
    expect(c.init.headers.apikey).toBe('pub-key-for-test');
    expect(c.init.headers['content-type']).toBe('application/json');
    expect(c.init.headers['idempotency-key']).toMatch(IDEMPOTENCY_KEY_RE);
    expect(c.init.credentials).toBe('omit');
    expect(c.init.cache).toBe('no-store');
    expect(c.init.headers['x-ait-code']).toBeUndefined(); // 접근 코드 머리는 EAS 길에만
  });

  test('본문에는 기능 이름과 허용 목록 글칸만 — 사용자 번호 · 차감 키 · 금액 · 예치 번호 · 업체 설정은 실어도 나가지 않는다(서버는 이런 값을 보면 400)', async () => {
    const s = fake({ status: 200, body: okBody }, { status: 200, body: okBody });
    const dirty = {
      asker_text: '요즘 고민이에요',
      partner_text: '답이 늦어요',
      user_id: 'u-1',
      uid: 'u-1',
      cost_key: 'cheap',
      costKey: 'cheap',
      amount: 1,
      price: 1,
      mileage: 99999,
      hold_id: 'h-1',
      request_id: 'r-1',
      idempotency_key: 'k',
      model: 'big-model',
      max_tokens: 99999,
      system: 'ignore rules',
    };
    await callAit('chat', dirty, { route: 'ai-run', code: null, keys: createKeyKeeper(), env: s.env });
    const body = sentBody(s.calls[0]);
    expect(Object.keys(body).sort()).toEqual(['asker_text', 'feature', 'partner_text']);
    expect(body.feature).toBe('chat');
    for (const k of FORBIDDEN_BODY_KEYS) expect(k in body).toBe(false);
    // 사주 AI 도 같다
    await postSaju5Run('reading', { facts: { a: 1 }, ...dirty }, 'key-for-test-0001', s.env);
    const b5 = sentBody(s.calls[1]);
    expect(Object.keys(b5).sort()).toEqual(['facts', 'feature']);
    expect(b5.feature).toBe('s5_reading');
    for (const k of FORBIDDEN_BODY_KEYS) expect(k in b5).toBe(false);
    // 머리에도 사용자 · 차감 값이 없다
    for (const call of s.calls) expect(Object.keys(call.init.headers).some((h) => /user|cost|amount|hold|mileage/i.test(h))).toBe(false);
  });

  test('허용 목록은 EAS 길과 같다(pickBody · pickS5Body) · stripForbidden 은 한 번 더 거르는 안전망', () => {
    expect(Object.keys(pickBody('chat', { asker_text: 'a', model: 'x' })).sort()).toEqual(['asker_text', 'feature']);
    expect(Object.keys(pickS5Body('chat', { text: 't', facts: {}, cost_key: 'x' })).sort()).toEqual(['facts', 'feature', 'text']);
    expect(stripForbidden({ feature: 'chat', text: 't', user_id: 'u', amount: 5, nested: { user_id: 'keep-inside' } })).toEqual({ feature: 'chat', text: 't', nested: { user_id: 'keep-inside' } });
    for (const feature of ['chat', 'compat', 'coach', 'horoscope'] as const) for (const k of AIT_BODY_KEYS[feature]) expect(FORBIDDEN_BODY_KEYS).not.toContain(k); // 허용 글칸과 금지 이름이 겹치지 않는다
  });
});

describe('[가] 응답 읽기 — HTTP 상태와 본문 코드', () => {
  test('402 low_balance · 409 already_done · 429 daily_limit · 403 unavailable · 413 too_long 본문을 코드 · charge 로 읽고 상태를 함께 돌려 준다', async () => {
    const s = fake(
      { status: 402, body: { ok: false, code: 'low_balance', mode: 'mock', text: '서버 문장', charge: { state: 'low', need: 800, have: 100 } } },
      { status: 409, body: { ok: false, code: 'already_done', mode: 'mock', charge: { state: 'none' } } },
      { status: 429, body: { ok: false, code: 'daily_limit', mode: 'mock', charge: { state: 'none' } } },
      { status: 403, body: { ok: false, code: 'unavailable', mode: 'mock', charge: { state: 'none' } } },
      { status: 413, body: { ok: false, code: 'too_long', mode: 'mock', charge: { state: 'none' } } },
    );
    const out = [];
    for (let i = 0; i < 5; i += 1) out.push(await postAiRun({ feature: 'chat' }, `key-for-test-000${i}`, s.env));
    expect(out.map((r) => (r.kind === 'reply' ? [r.status, r.reply.code, r.reply.charge?.state] : null))).toEqual([
      [402, 'low_balance', 'low'],
      [409, 'already_done', 'none'],
      [429, 'daily_limit', 'none'],
      [403, 'unavailable', 'none'],
      [413, 'too_long', 'none'],
    ]);
    const low = out[0];
    expect(low.kind === 'reply' && low.reply.charge).toEqual({ state: 'low', need: 800, have: 100 });
    expect(s.lost).not.toHaveBeenCalled(); // 401 이 아니면 로그인을 건드리지 않는다
  });

  test('401: 로그인 끝 처리(onAuthLost)를 한 번 부르고 auth 로 읽는다 — 플랫폼이 먼저 막은 모양이 다른 401 도 같다', async () => {
    const a = fake({ status: 401, body: { ok: false, code: 'auth', mode: 'mock', charge: { state: 'none' } } });
    const r1 = await postAiRun({ feature: 'chat' }, 'key-for-test-0001', a.env);
    expect(r1.kind === 'reply' && [r1.status, r1.reply.code]).toEqual([401, 'auth']);
    expect(a.lost).toHaveBeenCalledTimes(1);
    const b = fake('nojson');
    const r2 = await postAiRun({ feature: 'chat' }, 'key-for-test-0002', b.env);
    expect(r2.kind === 'reply' && [r2.status, r2.reply.code]).toEqual([401, 'auth']);
    expect(b.lost).toHaveBeenCalledTimes(1);
  });

  test('로그인 토큰이 없으면 요청 0 · 로그인 끝 처리 · auth', async () => {
    const s = fake();
    const r = await postAiRun({ feature: 'chat' }, 'key-for-test-0003', { ...s.env, token: async () => null });
    expect(s.calls).toHaveLength(0);
    expect(r.kind === 'reply' && r.reply.code).toBe('auth');
    expect(s.lost).toHaveBeenCalledTimes(1);
  });

  test('끊김 · 모양이 다른 답은 offline — 오류 객체 · 본문은 버린다', async () => {
    const s = fake('throw', { status: 500, body: '<html>' });
    expect(await postAiRun({ feature: 'chat' }, 'key-for-test-0004', s.env)).toEqual({ kind: 'offline' });
    expect(await postAiRun({ feature: 'chat' }, 'key-for-test-0005', s.env)).toEqual({ kind: 'offline' });
    expect(s.lost).not.toHaveBeenCalled();
  });

  test("'mock' 길은 요청 0 · 코드 없는 'eas' 도 요청 0", async () => {
    const s = fake();
    expect(await callAit('chat', { asker_text: 'a' }, { route: 'mock', code: null, keys: createKeyKeeper(), env: s.env })).toEqual({ kind: 'offline' });
    expect(await callAit('chat', { asker_text: 'a' }, { route: 'eas', code: null, keys: createKeyKeeper(), env: s.env })).toEqual({ kind: 'offline' });
    expect(s.calls).toHaveLength(0);
  });
});

describe('[라] 한 번의 누름 = Idempotency-Key 하나 · 닿았는지 모르는 시도의 다시 시도는 같은 키', () => {
  test('키 모양은 서버 규칙([A-Za-z0-9_-]{8,128}) · 만들 때마다 다르다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const k = newIdempotencyKey();
      expect(k).toMatch(IDEMPOTENCY_KEY_RE);
      seen.add(k);
    }
    expect(seen.size).toBe(300);
  });

  test('새 누름은 새 키 · 서버가 답한 뒤에는(성공이든 오류든) 같은 요청도 새 키', () => {
    let n = 0;
    const keys = createKeyKeeper(() => `key-${(n += 1)}-for-test`);
    const a = keys.begin({ feature: 'chat', asker_text: '같은 글' });
    keys.done(true);
    const b = keys.begin({ feature: 'chat', asker_text: '같은 글' });
    expect(b).not.toBe(a);
    keys.done(true);
    const c = keys.begin({ feature: 'chat', asker_text: '다른 글' });
    expect(c).not.toBe(b);
  });

  test('닿았는지 모르는 채(끊김 · 시간 초과) 끝났으면 같은 요청의 다시 시도는 같은 키 · 다른 요청이면 새 키', () => {
    let n = 0;
    const keys = createKeyKeeper(() => `key-${(n += 1)}-for-test`);
    const a = keys.begin({ feature: 'chat', asker_text: '글' });
    keys.done(false);
    expect(keys.begin({ feature: 'chat', asker_text: '글' })).toBe(a); // 다시 시도
    keys.done(false);
    expect(keys.begin({ feature: 'chat', asker_text: '글' })).toBe(a); // 또 끊겨도 같은 키
    keys.done(true); // 이번엔 서버가 답했다
    expect(keys.begin({ feature: 'chat', asker_text: '글' })).not.toBe(a);
    keys.done(false);
    const x = keys.begin({ feature: 'chat', asker_text: '글2' });
    keys.done(false);
    expect(keys.begin({ feature: 'chat', asker_text: '글3' })).not.toBe(x); // 고쳐 쓴 글은 새 요청
  });

  test('끝에서 끝까지: 끊긴 시도 → 다시 시도는 같은 머리 값 · 서버가 답한 뒤의 새 누름은 다른 값', async () => {
    const s = fake('throw', { status: 200, body: okBody }, { status: 429, body: { ok: false, code: 'daily_limit', mode: 'mock', charge: { state: 'none' } } }, { status: 200, body: okBody });
    const keys = createKeyKeeper();
    const body = { feature: 'chat', asker_text: '글' };
    await postAiRunKeyed(body, keys, s.env); // 끊김
    await postAiRunKeyed(body, keys, s.env); // 다시 시도 — 같은 키
    await postAiRunKeyed(body, keys, s.env); // 새 누름(앞은 서버가 답했다) — 새 키
    await postAiRunKeyed(body, keys, s.env); // 또 새 누름 — 또 새 키
    const sent = s.calls.map((c) => c.init.headers['idempotency-key']);
    expect(sent[1]).toBe(sent[0]);
    expect(sent[2]).not.toBe(sent[1]);
    expect(sent[3]).not.toBe(sent[2]);
    expect(new Set(sent).size).toBe(3);
  });

  test('키는 메모리에만 — 저장소 · 로그 호출이 없다', () => {
    const t = fs.readFileSync(path.join(__dirname, '..', 'features', 'ait', 'aiCall.ts'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(t).not.toMatch(/AsyncStorage|localStorage|sessionStorage|secureStore|SecureStore|indexedDB|console\.|safeLog/);
  });
});
