/**
 * @jest-environment node
 */
// AI-FIX11 RS2-04 · RS2-06 · RS2-08 — AI 서버 입구(route.ts)의 본문 읽기 순서와 문.
//  RS2-04: Content-Length 없는(chunked) 요청의 본문을 접근 코드 확인 **전에** 끝까지 읽던 것 → 접근 코드가 먼저, 본문은 96KB 에서 끊어 읽는다.
//  RS2-06: 틀린 접근 코드 연타(격리 안 최선 노력) — 20번이 쌓이면 맞는 코드도 429. 최소 길이 기준(8자)은 그대로.
//  가짜 업체 · 네트워크 0 · 유료 0. 시험용 값은 실행 때 조립한다(소스에 접근 코드 완성 꼴 0 — 푸시 전 검사).
import { createCounters, MAX_BODY_BYTES } from '@/server/ait';
import { createAitRoute, readBodyCapped, type RouteEnv } from '@/server/ait/route';

const N = { code: 'AI_ACCESS_' + 'CODE', sign: 'AIT_SIGN_' + 'KEY' };
const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const WRONG = ['ait', 'abce', 'efgh', 'jkmn', 'pqrs'].join('-');
const SIGNVAL = 'test-signing-secret-' + 'abcd'.repeat(6);
const HOST = 'lovedecide--demo.expo.app';
const HORO = JSON.stringify({ feature: 'horoscope', sun_sign: 'leo', day_element: 'wood' });
const enc = new TextEncoder();

function mkRoute() {
  let clock = Date.UTC(2026, 10, 1, 3, 0, 0);
  const lines: string[] = [];
  const env: RouteEnv = { [N.code]: CODE, [N.sign]: SIGNVAL } as RouteEnv;
  const route = createAitRoute({
    env: () => env,
    makeUpstream: () => { throw new Error('업체는 불리지 않아야 해요'); },
    now: () => (clock += 50),                 // 50ms 씩 — 틀린 코드 20번이 한 분 창 안에 들어가게
    counters: createCounters(),
    lock: { live: false },
    sink: (l) => lines.push(l),
  });
  return { route, lines, tick: (ms: number) => (clock += ms) };
}

/** 몇 번째 조각까지 당겨 갔는지 세는 스트림(highWaterMark 0 = 읽을 때만 당긴다). chunks 가 Infinity 면 끝이 없다 */
function counting(chunk: Uint8Array, chunks: number) {
  const st = { pulled: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (st.pulled >= chunks) { c.close(); return; }
        st.pulled++;
        c.enqueue(chunk);
      },
      cancel() { st.cancelled = true; },
    },
    { highWaterMark: 0 },
  );
  return { stream, st };
}
const streamReq = (stream: ReadableStream<Uint8Array>, code: string | null, extra: Record<string, string> = {}) =>
  new Request(`https://${HOST}/api/ai/x`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: HOST, ...(code === null ? {} : { 'x-ait-code': code }), ...extra },
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
const plainReq = (body: string, code: string | null = CODE, method = 'POST') =>
  new Request(`https://${HOST}/api/ai/x`, { method, headers: { 'content-type': 'application/json', host: HOST, ...(code === null ? {} : { 'x-ait-code': code }) }, body: method === 'GET' ? undefined : body });

describe('RS2-04 본문 읽기 순서', () => {
  test('접근 코드가 없거나 틀리면 끝없는 chunked 본문을 한 조각도 읽지 않고 같은 401', async () => {
    const s = mkRoute();
    const none = counting(new Uint8Array(16 * 1024).fill(120), Infinity);
    const wrong = counting(new Uint8Array(16 * 1024).fill(120), Infinity);
    const rNone = await s.route(streamReq(none.stream, null));
    const rWrong = await s.route(streamReq(wrong.stream, WRONG));
    expect(rNone.status).toBe(401);
    expect(rWrong.status).toBe(401);
    expect(await rWrong.json()).toEqual(await rNone.json());
    expect(none.st.pulled).toBe(0);
    expect(wrong.st.pulled).toBe(0);
  });

  test('접근 코드가 맞아도 본문은 96KB 에서 끊어 읽는다: 끝없는 chunked → 413, 당겨 간 조각은 상한 근처, 스트림은 취소', async () => {
    const s = mkRoute();
    const chunk = 16 * 1024;
    const big = counting(new Uint8Array(chunk).fill(120), Infinity);
    const r = await s.route(streamReq(big.stream, CODE));
    expect(r.status).toBe(413);
    expect(big.st.pulled).toBeLessThanOrEqual(MAX_BODY_BYTES / chunk + 1);
    expect(big.st.pulled).toBeGreaterThan(MAX_BODY_BYTES / chunk - 1);
    expect(big.st.cancelled).toBe(true);
  });

  test('선언된 Content-Length 가 상한 위면 읽지 않고 413 (선언을 지원하는 환경)', async () => {
    const s = mkRoute();
    const big = counting(new Uint8Array(16 * 1024).fill(120), Infinity);
    const r = await s.route(streamReq(big.stream, CODE, { 'content-length': String(MAX_BODY_BYTES + 1) }));
    expect(r.status).toBe(413);
    expect(big.st.pulled).toBeLessThanOrEqual(MAX_BODY_BYTES / (16 * 1024) + 1);
  });

  test('작은 chunked 본문(한글이 조각 사이에서 끊김)도 그대로 처리 — 모의 별자리 200', async () => {
    const s = mkRoute();
    const body = enc.encode(JSON.stringify({ feature: 'horoscope', sun_sign: 'leo', day_element: 'wood' }));
    const parts = [body.slice(0, 7), body.slice(7, 20), body.slice(20)];
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { if (i < parts.length) c.enqueue(parts[i++]); else c.close(); } }, { highWaterMark: 0 });
    const r = await s.route(streamReq(stream, CODE));
    expect(r.status).toBe(200);
  });

  test('readBodyCapped: 글자 중간에서 끊긴 조각을 한 번에 풀어 깨지지 않는다 · 본문 없음은 빈 글 · 정확히 상한이면 통과, 1바이트 넘으면 자리 글', async () => {
    const korean = enc.encode('가나다라');                       // 한 글자 3바이트
    let i = 0;
    const pieces = [korean.slice(0, 4), korean.slice(4)];
    const stream = new ReadableStream<Uint8Array>({ pull(c) { if (i < pieces.length) c.enqueue(pieces[i++]); else c.close(); } }, { highWaterMark: 0 });
    expect(await readBodyCapped(streamReq(stream, CODE))).toBe('가나다라');
    expect(await readBodyCapped(new Request(`https://${HOST}/x`, { method: 'GET' }))).toBe('');
    const exact = await readBodyCapped(plainReq('a'.repeat(MAX_BODY_BYTES)));
    expect(exact).toHaveLength(MAX_BODY_BYTES);
    const over = await readBodyCapped(plainReq('a'.repeat(MAX_BODY_BYTES + 1)));
    expect(over).toHaveLength(MAX_BODY_BYTES + 1);              // 자리 글(공백 상한+1) — 핸들러가 413 으로 답한다
    expect(over.trim()).toBe('');
  });

  test('방법이 틀리면(GET) 본문 읽기 전에 405, 출처가 다르면 403 — 이전과 같은 응답', async () => {
    const s = mkRoute();
    expect((await s.route(plainReq('', CODE, 'GET'))).status).toBe(405);
    const cross = new Request(`https://${HOST}/api/ai/x`, { method: 'POST', headers: { 'content-type': 'application/json', host: HOST, origin: 'https://evil.example', 'x-ait-code': CODE }, body: HORO });
    expect((await s.route(cross)).status).toBe(403);
  });

  test('보통 요청(본문 있는 문자열)은 그대로 200, 97KB 문자열 본문은 413', async () => {
    const s = mkRoute();
    expect((await s.route(plainReq(HORO))).status).toBe(200);
    expect((await s.route(plainReq('x'.repeat(MAX_BODY_BYTES + 5)))).status).toBe(413);
  });
});

describe('RS2-06 틀린 접근 코드 연타', () => {
  test('틀린 코드 20번 → 그다음은 맞는 코드도 429(retry-after 60), 1분이 지나면 풀림 · 응답 본문에 코드 값 0', async () => {
    const s = mkRoute();
    for (let i = 0; i < 20; i++) expect((await s.route(plainReq(HORO, WRONG))).status).toBe(401);
    const locked = await s.route(plainReq(HORO));
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBe('60');
    const text = JSON.stringify(await locked.json());
    expect(text).not.toContain(CODE);
    expect(text).not.toContain(WRONG);
    s.tick(61_000);
    expect((await s.route(plainReq(HORO))).status).toBe(200);
  });

  test('맞는 코드 요청은 아무리 많아도 틀린 횟수에 안 센다 · 8자 코드는 받고 7자는 닫힌다(최소 길이 기준 그대로)', async () => {
    const s = mkRoute();
    for (let i = 0; i < 5; i++) { s.tick(13_000); expect((await s.route(plainReq(HORO))).status).toBe(200); }
    const mk = (code: string) => createAitRoute({ env: () => ({ [N.code]: code, [N.sign]: SIGNVAL }) as RouteEnv, makeUpstream: () => { throw new Error('x'); }, now: () => Date.UTC(2026, 10, 1, 3, 0, 0), counters: createCounters(), lock: { live: false }, sink: () => undefined });
    expect((await mk('12345678')(plainReq(HORO, '12345678'))).status).toBe(200);
    expect((await mk('1234567')(plainReq(HORO, '1234567'))).status).toBe(401);
  });
});
