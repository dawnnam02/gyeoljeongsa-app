/**
 * @jest-environment node
 */
// AIT-F ⑦ 서버 경로 시험(보안 AIT_위협 6장 ATS 가운데 앱 연결 몫) — 모의 업체(가짜 Upstream) · 요청 객체 직접 호출 · 네트워크 0 · 유료 0.
//  원본 handler 의 505개 시험(ai/AIT/ts/tests)이 규칙 자체를 본다. 여기서는 앱이 붙인 것을 본다: 환경 값 읽기 · 모의 기본 · 키 없으면 not_ready ·
//  공식 SDK 감싸기(재시도 0 · 시간 상한) · 작업 공간 확인 · 오류 모양 · 응답 · 로그에 값 0.
// 시험용 값은 모두 실행 때 조립한다(소스에 열쇠 · 접근 코드 완성 꼴 0 — 푸시 전 검사).
import fs from 'node:fs';
import path from 'node:path';

import { createCounters, FORBIDDEN_BODY_KEYS, MAX_BODY_BYTES, RESPONSE_CODES } from '@/server/ait';
import type { MessagesBody } from '@/server/ait';
import { anthropicUpstream, createAitRoute, failureOf, UPSTREAM_TIMEOUT_MS, UpstreamError, type RouteEnv, type Upstream } from '@/server/ait/route';

const N = { key: 'ANTHROPIC_' + 'API_KEY', code: 'AI_ACCESS_' + 'CODE', sign: 'AIT_SIGN_' + 'KEY', mode: 'AIT_MODE', ws: 'AIT_WORKSPACE_ID', model: 'AIT_CHAT_MODEL' };
const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const WRONG = ['ait', 'abce', 'efgh', 'jkmn', 'pqrs'].join('-');
const KEYVAL = 'test-upstream-' + 'k'.repeat(12);
const SIGNVAL = 'test-signing-secret-' + 'abcd'.repeat(6);
const WS = 'wrkspc_' + 'test'.padEnd(10, 'x');
const HOST = 'lovedecide--demo.expo.app';
const MARK = 'UNIQUE-입력-표지-9f3';

type EnvOpt = { key?: boolean; ws?: string | null; mode?: string | null; code?: string | null; sign?: boolean };
function mkEnv(o: EnvOpt = {}): RouteEnv {
  const e: Record<string, string | undefined> = {};
  if (o.code !== null) e[N.code] = o.code ?? CODE;
  if (o.sign !== false) e[N.sign] = SIGNVAL;
  if (o.mode) e[N.mode] = o.mode;
  if (o.key) e[N.key] = KEYVAL;
  if (o.ws !== null && o.ws !== undefined) e[N.ws] = o.ws;
  return e as RouteEnv;
}

function good(feature: string): unknown[] {
  // 업체가 돌려줄 법한 검사 통과 응답은 만들기 어렵다 — live 시험은 '업체가 불렸다 / 안 불렸다 / 요청 꼴 / 오류 분류'를 본다(응답 검사는 원본 시험이 본다)
  return [{ type: 'text', text: JSON.stringify({ feature }) }];
}

function setup(over: { env?: RouteEnv; create?: Upstream['create']; workspaceId?: string | null } = {}) {
  const calls: MessagesBody[] = [];
  const lines: string[] = [];
  const makeCalls: string[] = [];
  const lock = { live: false };
  let clock = Date.UTC(2026, 10, 1, 3, 0, 0);
  const base: Upstream['create'] = over.create ?? (async () => ({ data: { stop_reason: 'end_turn', content: good('x'), usage: { input_tokens: 10, output_tokens: 5 } }, workspaceId: over.workspaceId === undefined ? WS : over.workspaceId }));
  const route = createAitRoute({
    env: () => over.env ?? mkEnv(),
    makeUpstream: (k) => (makeCalls.push(k), { create: async (b, sig) => (calls.push(b), base(b, sig)) }),
    now: () => (clock += 11_000),
    counters: createCounters(),
    lock,
    sink: (l) => lines.push(l),
  });
  return { route, calls, lines, makeCalls, lock, tick: (ms: number) => (clock += ms) };
}
const reqOf = (body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
  new Request(`https://${HOST}/api/ai/x`, { method, headers: { 'content-type': 'application/json', 'x-ait-code': CODE, host: HOST, ...headers }, body: method === 'GET' || method === 'HEAD' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const HORO = { feature: 'horoscope', sun_sign: 'leo', day_element: 'wood' };
const COMPAT = { feature: 'compat', shared: [{ k: 'hobby', v: 'travel' }] };
const COACH = { feature: 'coach', field: 'intro', text: '주말에는 주로 집에서 쉬거나 산책을 해요' };
const CHAT = { feature: 'chat', asker_text: '요즘 상대의 답이 늦어져서 마음이 쓰여요' };

describe('AIT-F 서버 경로 · 문(접근 코드)', () => {
  test('코드 없음 · 틀림 · 서버 미설정은 같은 상태 · 같은 본문 · 같은 머리, 업체 호출 0 (ATS-05 · 06)', async () => {
    const outs = new Set<string>();
    const live = { key: true, ws: WS, mode: 'live' };
    for (const [headers, env] of [
      [{ 'x-ait-code': '' }, mkEnv(live)],
      [{ 'x-ait-code': WRONG }, mkEnv(live)],
      [{ 'x-ait-code': CODE }, mkEnv({ ...live, code: null })],
      [{ 'x-ait-code': CODE }, mkEnv({ ...live, code: '   ' })],
    ] as [Record<string, string>, RouteEnv][]) {
      const s = setup({ env });
      const r = await s.route(reqOf(HORO, headers));
      expect(r.status).toBe(401);
      outs.add(`${r.status}|${await r.text()}|${r.headers.get('content-type')}|${r.headers.get('cache-control')}`);
      expect(s.calls).toHaveLength(0);
      expect(s.makeCalls).toHaveLength(0);
    }
    expect(outs.size).toBe(1);
  });

  test('코드를 본문 · 주소에 실어도 읽지 않는다 — 머리로만 (ATF-09 서버 쪽)', async () => {
    const s = setup({ env: mkEnv({ key: true, ws: WS, mode: 'live' }) });
    const r = await s.route(new Request(`https://${HOST}/api/ai/horoscope?code=${CODE}`, { method: 'POST', headers: { 'content-type': 'application/json', host: HOST }, body: JSON.stringify({ ...HORO, code: CODE }) }));
    expect(r.status).toBe(401);
    expect(s.calls).toHaveLength(0);
  });

  test('POST 가 아니면 405 · 다른 출처는 403 · 형식 아님 415 · 큰 본문 413 — 모두 업체 호출 0', async () => {
    const s = setup({ env: mkEnv({ key: true, ws: WS, mode: 'live' }) });
    for (const m of ['GET', 'PUT', 'DELETE', 'PATCH']) expect((await s.route(reqOf(HORO, {}, m))).status).toBe(405);
    expect((await s.route(reqOf(HORO, { origin: 'https://other.example' }))).status).toBe(403);
    expect((await s.route(reqOf(HORO, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await s.route(reqOf(HORO, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await s.route(reqOf('x'.repeat(MAX_BODY_BYTES + 5)))).status).toBe(413);
    const ok = await s.route(reqOf(HORO, { origin: `https://${HOST}` }));
    expect(ok.status).not.toBe(403);
    expect(s.calls.length).toBeLessThanOrEqual(1);
  });

  test('응답 머리: no-store · nosniff · noindex · no-referrer · 쿠키 0 · CORS 머리 0 (ATD-08 · 09 모의)', async () => {
    const s = setup();
    for (const r of [await s.route(reqOf(HORO)), await s.route(reqOf(HORO, { 'x-ait-code': WRONG })), await s.route(reqOf(HORO, {}, 'GET'))]) {
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('x-robots-tag')).toBe('noindex');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('set-cookie')).toBeNull();
      expect([...r.headers.keys()].filter((k) => k.startsWith('access-control-'))).toEqual([]);
    }
  });
});

describe('AIT-F 서버 경로 · 모의가 기본 — 업체 호출 0 (AC-27)', () => {
  test.each([['chat', CHAT], ['compat', COMPAT], ['coach', COACH], ['horoscope', HORO]] as const)('AIT_MODE 없음 → %s 는 모의 응답 · 업체 호출 0 · 열쇠를 읽어도 만들지 않는다', async (_f, body) => {
    const s = setup({ env: mkEnv({ key: true, ws: WS }) });
    const r = await s.route(reqOf(body));
    const j = (await r.json()) as { mode: string; code: string };
    expect(j.mode).toBe('mock');
    expect(['ok', 'blocked_output']).toContain(j.code);
    expect(s.calls).toHaveLength(0);
    expect(s.makeCalls).toHaveLength(0);
  });

  test('AIT_MODE=mock 도 같다 · 알 수 없는 값은 설정 오류(unavailable) · 업체 호출 0', async () => {
    const a = setup({ env: mkEnv({ key: true, ws: WS, mode: 'mock' }) });
    expect(((await (await a.route(reqOf(HORO))).json()) as { mode: string }).mode).toBe('mock');
    const b = setup({ env: mkEnv({ key: true, ws: WS, mode: 'LIVE!' }) });
    const r = await b.route(reqOf(HORO));
    expect(((await r.json()) as { code: string }).code).toBe('unavailable');
    expect(a.calls.length + b.calls.length).toBe(0);
  });

  test('live 를 원해도 키가 없으면 not_ready → 모의로 돈다 · 작업 공간 ID 가 없어도 같다 · 업체 호출 0 (ATS-04 · 23)', async () => {
    for (const env of [mkEnv({ mode: 'live', ws: WS }), mkEnv({ mode: 'live', key: true }), mkEnv({ mode: 'live', key: true, ws: '  ' })]) {
      const s = setup({ env });
      const j = (await (await s.route(reqOf(HORO))).json()) as { mode: string };
      expect(j.mode).toBe('mock');
      expect(s.calls).toHaveLength(0);
      expect(s.makeCalls).toHaveLength(0);
    }
  });

  test('AIT_SIGN_KEY 가 없으면 챗봇은 닫힘(unavailable), 단발 기능은 그대로 (D-3)', async () => {
    const s = setup({ env: mkEnv({ sign: false }) });
    expect(((await (await s.route(reqOf(CHAT))).json()) as { code: string }).code).toBe('unavailable');
    expect(((await (await s.route(reqOf(HORO))).json()) as { code: string }).code).toBe('ok');
  });
});

describe('AIT-F 서버 경로 · 실호출 길(가짜 업체) — 요청 꼴 · 오류 분류 · 잠금', () => {
  const live = () => mkEnv({ key: true, ws: WS, mode: 'live' });

  test('live 준비가 되면 업체를 한 번 부른다 · 요청 꼴은 서버가 정한다(모델 · max_tokens · effort) · 금지 필드 0 (AC-20 · 24)', async () => {
    const s = setup({ env: live() });
    await s.route(reqOf(HORO));
    expect(s.makeCalls).toEqual([KEYVAL]);
    expect(s.calls).toHaveLength(1);
    const b = s.calls[0];
    expect(b.model).toBe('claude-haiku-5-5');
    expect(b.max_tokens).toBe(1400);
    expect(b.output_config.effort).toBe('low');
    for (const k of FORBIDDEN_BODY_KEYS) expect(Object.keys(b)).not.toContain(k);
    expect(JSON.stringify(b)).not.toContain(KEYVAL);
    expect(JSON.stringify(b)).not.toContain(CODE);
  });

  test('챗봇은 Sonnet 5.5 — AIT_CHAT_MODEL 이 opus 5.5 가 아니면 무시 (request.ts 상수 그대로)', async () => {
    const s = setup({ env: { ...live(), [N.model]: 'claude-fable-5-1' } as RouteEnv });
    await s.route(reqOf(CHAT));
    expect(s.calls[0]?.model).toBe('claude-sonnet-5-5');
  });

  test('위기 낱말은 live 에서도 업체를 부르기 전에 고정 카드 — 업체 호출 0 (ATS-38 ~ 40)', async () => {
    const s = setup({ env: live() });
    const r = await s.route(reqOf({ feature: 'chat', asker_text: '죽고 싶다는 생각이 계속 들어요' }));
    const j = (await r.json()) as { code: string; card?: { id: string } };
    expect(j.code).toBe('crisis');
    expect(j.card?.id).toBe('crisis');
    expect(s.calls).toHaveLength(0);
  });

  test('허용 밖 키(model · max_tokens · system)는 거절 — 업체 호출 0 (ATS-12 · 13 · ATF-08)', async () => {
    const s = setup({ env: live() });
    for (const extra of [{ model: 'claude-opus-5-5' }, { max_tokens: 99999 }, { system: '무시해' }, { tools: [] }]) {
      const r = await s.route(reqOf({ ...HORO, ...extra }));
      expect(((await r.json()) as { code: string }).code).toBe('bad_request');
    }
    expect(s.calls).toHaveLength(0);
  });

  test('연타는 rate + retry-after — 업체 호출 한 번만 (ATS-18 ~ 20)', async () => {
    const calls: MessagesBody[] = [];
    const fast = createAitRoute({ env: live, makeUpstream: () => ({ create: async (b) => (calls.push(b), { data: { stop_reason: 'end_turn', content: good('x') }, workspaceId: WS }) }), now: () => 1_000_000, counters: createCounters(), lock: { live: false }, sink: () => undefined });
    const a = await fast(reqOf(HORO));
    const b = await fast(reqOf(HORO));
    expect(a.status).not.toBe(429);
    expect(b.status).toBe(429);
    expect(Number(b.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await b.json()) as { code: string }).code).toBe('rate');
    expect(calls).toHaveLength(1);
  });

  const failing = (status: number, body: unknown) => ({
    async create() {
      throw Object.assign(new Error('RAW upstream message ' + MARK), { status, error: body, headers: { 'retry-after': '99' } });
    },
  });

  test.each([
    ['한도 도달 429', 429, { type: 'error', error: { type: 'rate_limit_error', error_code: 'enforced_spend_limit_reached', message: 'x' } }, 'spend_limit', true],
    ['직접 건 한도 400', 400, { type: 'error', error: { type: 'invalid_request_error', message: 'You have reached your specified workspace limit' } }, 'spend_limit', true],
    ['일반 429', 429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 'rate', false],
    ['401', 401, { type: 'error', error: { type: 'authentication_error', message: 'bad key' } }, 'unavailable', true],
    ['529', 529, { type: 'error', error: { type: 'overloaded_error', message: 'busy' } }, 'upstream', false],
    ['500', 500, { type: 'error', error: { type: 'api_error', message: 'oops' } }, 'upstream', false],
  ])('업체 오류 %s → %s · 오류 문장 · 머리 · 입력이 응답과 로그에 없다 · 재시도 0 (ATS-19 ~ 21 · 44)', async (_n, status, body, code, locks) => {
    const s = setup({ env: live(), create: failing(status, body).create });
    const r = await s.route(reqOf({ ...HORO }));
    const text = await r.text();
    expect((JSON.parse(text) as { code: string }).code).toBe(code);
    expect(text).not.toContain(MARK);
    expect(text).not.toContain('RAW');
    expect(text).not.toContain(KEYVAL);
    expect(s.lines.join('\n')).not.toContain(MARK);
    expect(s.calls).toHaveLength(1); // 한 번만 불렀다(재시도 0)
    expect(s.lock.live).toBe(locks);
    if (locks) {
      // 잠긴 뒤에는 모의로 돈다 — 업체 호출 0
      s.tick(5_000);
      const again = (await (await s.route(reqOf(HORO))).json()) as { mode: string };
      expect(again.mode).toBe('mock');
      expect(s.calls).toHaveLength(1);
    }
  });

  test('시간 초과(timeout 표시)는 timeout 으로 · 던져진 일반 오류는 upstream — 입력 · 오류 문장 반사 0', async () => {
    const s1 = setup({ env: live(), create: async () => { throw new UpstreamError({ timeout: true }); } });
    expect(((await (await s1.route(reqOf(HORO))).json()) as { code: string }).code).toBe('timeout');
    const s2 = setup({ env: live(), create: async () => { throw new TypeError('network ' + MARK); } });
    const t = await (await s2.route(reqOf(HORO))).text();
    expect((JSON.parse(t) as { code: string }).code).toBe('upstream');
    expect(t).not.toContain(MARK);
  });

  test('작업 공간 ID 가 다르거나 머리가 없으면 그 응답을 버리고 이 격리를 잠근다 (AC-08)', async () => {
    for (const workspaceId of ['wrkspc_other', null]) {
      const s = setup({ env: live(), workspaceId });
      const r = await s.route(reqOf(HORO));
      const j = (await r.json()) as { code: string; display?: unknown };
      expect(j.code).toBe('unavailable');
      expect(j.display).toBeUndefined();
      expect(s.lock.live).toBe(true);
    }
  });

  test('응답 · 로그에 접근 코드 · 서명 키 · 열쇠 · 입력 글이 없다 — 로그는 허용 키뿐 (AC-11 · ATS-02 · 03)', async () => {
    const s = setup({ env: live() });
    const texts: string[] = [];
    for (const b of [{ ...CHAT, asker_text: CHAT.asker_text + MARK }, COMPAT, { ...COACH, text: COACH.text + MARK }, HORO]) texts.push(await (await s.route(reqOf(b))).text());
    texts.push(await (await s.route(reqOf(HORO, { 'x-ait-code': WRONG }))).text());
    const all = texts.join('\n') + '\n' + s.lines.join('\n');
    for (const secret of [CODE, WRONG, SIGNVAL, KEYVAL, MARK, WS]) expect(all).not.toContain(secret);
    expect(s.lines.length).toBeGreaterThan(0);
    const allowed = new Set(['t', 'f', 'in', 'out', 'ms', 'code', 'mode', 'rid']);
    for (const l of s.lines) for (const k of Object.keys(JSON.parse(l) as object)) expect(allowed.has(k)).toBe(true);
  });

  test('응답 코드는 열세 개 안의 것뿐', async () => {
    const s = setup({ env: live() });
    for (const b of [CHAT, COMPAT, COACH, HORO, { feature: 'nope' }, '{', { feature: 'chat', bundle: 'x' }]) {
      const j = (await (await s.route(reqOf(b))).json()) as { code: string };
      expect(RESPONSE_CODES as readonly string[]).toContain(j.code);
    }
  });
});

describe('AIT-F 서버 경로 · 공식 SDK 감싸기', () => {
  test('anthropicUpstream: maxRetries 0 · 시간 상한 60초 · 열쇠는 생성자에만 · 작업 공간 머리를 돌려준다', async () => {
    jest.resetModules();
    const ctor = jest.fn();
    const create = jest.fn(() => ({ withResponse: async () => ({ data: { stop_reason: 'end_turn', content: [], usage: { input_tokens: 1, output_tokens: 2 } }, response: { headers: new Headers({ 'anthropic-workspace-id': WS }) } }) }));
    jest.doMock('@anthropic-ai/sdk', () => ({ __esModule: true, default: function Anthropic(this: unknown, opts: unknown) { ctor(opts); return { messages: { create } }; } }));
    const fresh = require('@/server/ait/route') as typeof import('@/server/ait/route'); // eslint-disable-line @typescript-eslint/no-require-imports
    const up = fresh.anthropicUpstream(KEYVAL);
    const ctl = new AbortController();
    const r = await up.create({ model: 'claude-haiku-5-5' } as MessagesBody, ctl.signal);
    expect(ctor).toHaveBeenCalledWith({ apiKey: KEYVAL, maxRetries: 0, timeout: UPSTREAM_TIMEOUT_MS });
    expect(r.workspaceId).toBe(WS);
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0] as unknown[])[1]).toEqual({ signal: ctl.signal });
    expect(JSON.stringify(create.mock.calls[0])).not.toContain(KEYVAL);
    jest.dontMock('@anthropic-ai/sdk');
  });

  test('failureOf: 상태 · 이름 · 앞 40자만 뽑고 본문 · 머리 · 메시지 나머지는 버린다', () => {
    const f = failureOf({ status: 400, error: { error: { type: 'invalid_request_error', message: 'You have reached your specified workspace spend limit. ' + MARK } }, headers: { a: 'b' } }, false);
    expect(Object.keys(f).sort()).toEqual(['errorType', 'messageHead', 'status']);
    expect(f.messageHead).toHaveLength(40);
    expect(JSON.stringify(f)).not.toContain(MARK);
    expect(failureOf(new Error('x'), true)).toEqual({ timeout: true });
    expect(failureOf('문자열', false)).toEqual({ status: undefined, errorType: undefined, messageHead: undefined });
  });

  test('anthropicUpstream 은 진짜 SDK 로도 만들어진다(호출 없음)', () => {
    expect(typeof anthropicUpstream(KEYVAL).create).toBe('function');
  });
});

describe('AIT-F 서버 경로 · 정적 점검 (AC-01 · 05 · 11 · 33 · ATS-43 · 48 · ATD-03)', () => {
  const SRC = path.resolve(__dirname, '..');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
  const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const nonTest = files.filter((f) => !/__tests__/.test(f));

  test('서버 비밀 변수 이름은 src/server 안에서만 쓰인다 (그 밖 코드 0)', () => {
    const outside = nonTest.filter((f) => !rel(f).startsWith('server/') && new RegExp(`${N.key}|${N.code}|${N.sign}|${N.ws}`).test(strip(fs.readFileSync(f, 'utf8'))));
    expect(outside.map(rel)).toEqual([]);
  });

  test('src/server 를 가져오는 파일은 API 경로와 src/server 자신뿐 — 화면 · 부품 · lib · features 는 가져오지 않는다 (ATF-16)', () => {
    // IF5-F1: src/saju5(ai/IF5/ts 복사본 — 기기 안 사주 계산 · 미리 쓴 글)는 순수 글 검사기 둘(rules · text — 정규식 목록뿐, 지시문 · 열쇠 · 업체 호출 0)과 타입(types — 타입 전용)만 가져온다. 화면 · 부품 · lib · features 는 여전히 0
    const importers = nonTest.filter((f) => /from '(@\/server\/|\.\.?\/(?:\.\.\/)*server\/)/.test(fs.readFileSync(f, 'utf8')) && !rel(f).startsWith('server/') && !rel(f).startsWith('saju5/'));
    expect(importers.map(rel)).toEqual(['app/api/ai/[feature]+api.ts']);
    const fromSaju = new Set<string>();
    for (const f of nonTest.filter((x) => rel(x).startsWith('saju5/'))) for (const m of fs.readFileSync(f, 'utf8').matchAll(/from '(?:@\/server\/ait\/|\.\.\/server\/ait\/)([a-z_]+)(?:\.ts)?'/g)) fromSaju.add(m[1]);
    expect([...fromSaju].sort()).toEqual(['rules', 'text', 'types']); // types 는 spec5.ts 의 타입 전용 가져오기(번들에 0)
  });

  test('EXPO_PUBLIC_ 변수 이름은 기존 셋뿐 — AIT 가 새로 만들지 않았다 (ATF-02)', () => {
    const names = new Set<string>();
    for (const f of nonTest) for (const m of fs.readFileSync(f, 'utf8').matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)) names.add(m[0]);
    expect([...names].sort()).toEqual(['EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_URL']);
  });

  test('console 직접 호출은 route.ts 의 sink 한 곳뿐 · 파일 쓰기 · Supabase · 다른 주소 0', () => {
    const server = nonTest.filter((f) => rel(f).startsWith('server/'));
    const withConsole = server.filter((f) => /\bconsole\./.test(strip(fs.readFileSync(f, 'utf8'))));
    expect(withConsole.map(rel)).toEqual(['server/ait/route.ts']);
    expect((strip(fs.readFileSync(path.join(SRC, 'server/ait/route.ts'), 'utf8')).match(/console\./g) ?? []).length).toBe(1);
    for (const f of server) {
      const t = strip(fs.readFileSync(f, 'utf8'));
      expect(t).not.toMatch(/from '(?:node:)?fs'|supabase|AsyncStorage|SecureStore|localStorage/);
      if (rel(f).endsWith('/generated.ts')) continue; // 근거 카드의 공개 출처 주소는 화면에 보이는 자료일 뿐 밖으로 나가는 주소가 아니다
      for (const m of t.matchAll(/https?:\/\/[^\s'"`)]+/g)) expect(m[0]).toMatch(/anthropic/);
    }
  });

  test('API 경로 파일: 모든 방법이 같은 문을 지나고 값을 만지지 않는다', () => {
    const t = fs.readFileSync(path.join(SRC, 'app/api/ai/[feature]+api.ts'), 'utf8');
    expect(t).toContain("handleAitRequest(request)");
    for (const m of ['GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) expect(t).toContain(`export const ${m} = POST`);
    expect(strip(t)).not.toMatch(/process\.env/);
  });

  test('소스에 열쇠 · 접근 코드 완성 꼴이 없다 (푸시 전 검사 R3 · R5 · R4 모양)', () => {
    const KEYRE = new RegExp('sk-an' + 't-[A-Za-z0-9_-]{8,}');
    const CODERE = /ait-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/;
    const hits = files.filter((f) => KEYRE.test(fs.readFileSync(f, 'utf8')) || CODERE.test(fs.readFileSync(f, 'utf8')));
    expect(hits.map(rel)).toEqual([]);
  });

  test('app.config.js: 기본은 정적 데모 출력 그대로, AIT_SERVER_EXPORT=1 일 때만 서버 출력', () => {
    const cfg = require('../../app.config.js') as (a: { config: Record<string, unknown> }) => { web?: { output?: string } }; // eslint-disable-line @typescript-eslint/no-require-imports
    const base = { web: { output: 'single', lang: 'ko' }, ios: {}, plugins: [] };
    const prev = process.env.AIT_SERVER_EXPORT;
    delete process.env.AIT_SERVER_EXPORT;
    expect(cfg({ config: base }).web?.output).toBe('single');
    process.env.AIT_SERVER_EXPORT = '1';
    expect(cfg({ config: base }).web?.output).toBe('server');
    if (prev === undefined) delete process.env.AIT_SERVER_EXPORT;
    else process.env.AIT_SERVER_EXPORT = prev;
  });
});
