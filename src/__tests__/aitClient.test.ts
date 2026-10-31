/**
 * @jest-environment node
 */
// AIT-F ⑤ ⑦ 앱 쪽 연결 시험 — 코드 보관(웹 메모리 · 네이티브 안전 저장) · 서버 부르기(머리 · 본문 키 · 오류) · 서버와 맞물림.
//  보안 앱 시험 ATF-02 ~ 04 · 06 ~ 11 · 20 · 24 가운데 코드로 볼 수 있는 몫. 서버는 가짜 업체도 없이 모의 모드(업체 호출 0)로 돌린다.
import fs from 'node:fs';
import path from 'node:path';

import { createCounters } from '@/server/ait';
import { createAitRoute } from '@/server/ait/route';
import { AIT_ACCESS_HEADER, AIT_BODY_KEYS, pickBody, postAit, type AitFetch } from '@/features/ait/aitClient';
import { AIT_CONSENT_VERSION, aitStore, cleanCode, hasConsent } from '@/features/ait/aitStore';
import { parseChatDisplay, parseCoachDisplay, parseCompatDisplay, parseHoroscopeDisplay, parseReply } from '@/features/ait/aitTypes';

const mockMem = new Map<string, string>();
const mockSetSpy = jest.fn();
jest.mock('@/lib/secureStorage', () => ({
  secureStore: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => (mockSetSpy(k), void mockMem.set(k, v)),
    del: async (k: string) => void mockMem.delete(k),
  },
}));

const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const SIGN = 'test-signing-secret-' + 'abcd'.repeat(6);
const HOST = 'lovedecide--demo.expo.app';
const ENV = { ['AI_ACCESS_' + 'CODE']: CODE, ['AIT_SIGN_' + 'KEY']: SIGN } as Record<string, string>;

function serverFetch(): { fetchImpl: AitFetch; seen: { url: string; init: Parameters<AitFetch>[1] }[] } {
  const route = createAitRoute({ env: () => ENV, makeUpstream: () => { throw new Error('모의 모드에서는 불리면 안 됨'); }, now: (() => { let c = Date.UTC(2026, 10, 1); return () => (c += 11_000); })(), counters: createCounters(), lock: { live: false }, sink: () => undefined });
  const seen: { url: string; init: Parameters<AitFetch>[1] }[] = [];
  const fetchImpl: AitFetch = async (url, init) => {
    seen.push({ url, init });
    return route(new Request(`https://${HOST}${url}`, { method: init.method, headers: { ...init.headers, host: HOST }, body: init.body }));
  };
  return { fetchImpl, seen };
}

beforeEach(() => {
  mockMem.clear();
  mockSetSpy.mockClear();
  aitStore.reset();
});

describe('AIT-F 코드 보관 (ATF-03 ~ 05)', () => {
  test('코드 입력 정리: 공백 제거 · 소문자 · 길이 상한 — 값은 형식을 따지지 않는다(서버가 본다)', () => {
    expect(cleanCode('  AIT-ABCD  efgh ')).toBe('ait-abcdefgh');
    expect(cleanCode('x'.repeat(200))).toHaveLength(64);
  });

  test('넣기 · 읽기 · 지우기 · 동의 기록 — 판 이름과 시각이 남는다 (법무 16-4 #2)', async () => {
    await aitStore.load();
    expect(aitStore.get().code).toBeNull();
    expect(await aitStore.setCode('   ')).toBe(false);
    expect(await aitStore.setCode(CODE)).toBe(true);
    expect(aitStore.get().code).toBe(CODE);
    expect(hasConsent(aitStore.get())).toBe(false);
    await aitStore.setConsent(new Date('2026-11-01T03:00:00Z'));
    expect(hasConsent(aitStore.get())).toBe(true);
    expect(aitStore.get().consent).toEqual({ version: AIT_CONSENT_VERSION, at: '2026-11-01T03:00:00.000Z' });
    // 다시 켠 앱: 기기에서 읽어 온다
    aitStore.reset();
    await aitStore.load();
    expect(aitStore.get().code).toBe(CODE);
    expect(hasConsent(aitStore.get())).toBe(true);
    await aitStore.clearCode();
    expect(aitStore.get().code).toBeNull();
    expect(mockMem.has('ait.code')).toBe(false);
    await aitStore.forget();
    expect(aitStore.get().consent).toBeNull();
    expect(mockMem.size).toBe(0);
  });

  test('옛 동의 판은 동의로 치지 않는다 · 깨진 기록은 없는 것', async () => {
    mockMem.set('ait.consent', JSON.stringify({ version: 'old', at: '2026-01-01T00:00:00Z' }));
    await aitStore.load();
    expect(hasConsent(aitStore.get())).toBe(false);
    aitStore.reset();
    mockMem.set('ait.consent', '{깨짐');
    await aitStore.load();
    expect(aitStore.get().consent).toBeNull();
  });

  test('웹에서는 안전 저장도 쓰지 않는다 — 메모리만 (본인 결정 D-7 · ATF-03)', async () => {
    jest.resetModules();
    const secureSet = jest.fn();
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    jest.doMock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1, getItemAsync: jest.fn(), setItemAsync: secureSet, deleteItemAsync: jest.fn() }));
    jest.dontMock('@/lib/secureStorage');
    jest.unmock('@/lib/secureStorage');
    const web = require('@/features/ait/aitStore') as typeof import('@/features/ait/aitStore'); // eslint-disable-line @typescript-eslint/no-require-imports
    await web.aitStore.load();
    await web.aitStore.setCode(CODE);
    await web.aitStore.setConsent();
    expect(web.aitStore.get().code).toBe(CODE);
    expect(secureSet).not.toHaveBeenCalled();
    jest.dontMock('react-native');
    jest.dontMock('expo-secure-store');
  });

  test('코드 보관 소스: 브라우저 저장소 · 쿠키 · AsyncStorage 0, 로그 0 (ATF-03 · 04 · 10)', () => {
    const dir = path.resolve(__dirname, '..', 'features', 'ait');
    for (const f of fs.readdirSync(dir).filter((n) => /\.(ts|tsx)$/.test(n))) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(t).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|AsyncStorage|console\.|safeLog|Clipboard|Share\b|expo-sharing|setStringAsync/);
    }
  });
});

describe('AIT-F 서버 부르기 (ATF-06 ~ 09 · 24)', () => {
  test('본문은 허용 키만 — model · max_tokens · system · 가격 · 횟수 · 코드는 나가지 않는다 (ATF-08)', () => {
    const dirty = { asker_text: '안녕', model: 'claude-opus-5-5', max_tokens: 9999, system: 'x', code: CODE, price: 1, shared: [], field: 'intro', text: 't', sun_sign: 'leo', day_element: 'wood', cusp: false, bundle: { a: 1 }, chip: 'enough', partner_text: 'p', partner_alias: 'a' };
    for (const f of ['chat', 'compat', 'coach', 'horoscope'] as const) {
      const b = pickBody(f, dirty);
      expect(Object.keys(b).every((k) => k === 'feature' || AIT_BODY_KEYS[f].includes(k))).toBe(true);
      for (const k of ['model', 'max_tokens', 'system', 'code', 'price']) expect(b).not.toHaveProperty(k);
      expect(b.feature).toBe(f);
    }
  });

  test('요청 꼴: POST /api/ai/<기능> · 코드는 x-ait-code 머리에만 · 쿠키 없음(credentials omit) · 저장 안 함(no-store) (ATF-09)', async () => {
    const { fetchImpl, seen } = serverFetch();
    await postAit('horoscope', { sun_sign: 'leo', day_element: 'wood' }, CODE, fetchImpl);
    const { url, init } = seen[0];
    expect(url).toBe('/api/ai/horoscope');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.cache).toBe('no-store');
    expect(init.headers[AIT_ACCESS_HEADER]).toBe(CODE);
    expect(Object.keys(init.headers).sort()).toEqual(['content-type', AIT_ACCESS_HEADER].sort());
    expect(url).not.toContain(CODE);
    expect(init.body).not.toContain(CODE);
  });

  test('서버와 맞물림: 네 기능의 앱 본문이 서버 허용 목록을 통과한다(bad_request 0)', async () => {
    const { fetchImpl } = serverFetch();
    const cases: [Parameters<typeof postAit>[0], Record<string, unknown>][] = [
      ['chat', { asker_text: '요즘 답이 늦어져서 마음이 쓰여요', partner_text: '바빠서 그래', partner_alias: '그 사람' }],
      ['compat', { shared: [{ k: 'hobby', v: 'travel' }] }],
      ['coach', { field: 'intro', text: '주말에는 주로 집에서 쉬거나 산책을 해요' }],
      ['horoscope', { sun_sign: 'leo', day_element: 'wood', cusp: false }],
    ];
    for (const [f, body] of cases) {
      const r = await postAit(f, body, CODE, fetchImpl);
      expect(r.kind).toBe('reply');
      if (r.kind === 'reply') {
        expect(r.reply.code).not.toBe('bad_request');
        expect(r.reply.mode).toBe('mock'); // 업체 호출 0 — 모의 모드
      }
    }
  });

  test('틀린 코드는 auth — 서버 문장은 받아도 쓰지 않는다(code 만 읽는다) (ATF-07)', async () => {
    const { fetchImpl } = serverFetch();
    const r = await postAit('horoscope', { sun_sign: 'leo', day_element: 'wood' }, 'ait-xxxx', fetchImpl);
    expect(r.kind === 'reply' && r.reply.code).toBe('auth');
    expect(JSON.stringify(r)).not.toContain('text');
  });

  test('챗봇 두 턴: 서명 묶음을 그대로 돌려보내면 이어지고, 칩으로 끝낸다 (ATF-20 · 서버와 맞물림)', async () => {
    const { fetchImpl, seen } = serverFetch();
    const t1 = await postAit('chat', { asker_text: '요즘 상대의 답이 늦어져서 마음이 쓰여요' }, CODE, fetchImpl);
    if (t1.kind !== 'reply') throw new Error('offline');
    expect(t1.reply.code).toBe('ok');
    const d1 = parseChatDisplay(t1.reply.display);
    expect(d1?.stage).toBe('S1');
    expect(t1.reply.bundle).not.toBeNull();
    const t2 = await postAit('chat', { asker_text: '', chip: d1?.chips[0], bundle: t1.reply.bundle }, CODE, fetchImpl);
    expect(t2.kind === 'reply' && t2.reply.code).toBe('ok');
    // 묶음을 고치면(앱이 만든 assistant 턴 흉내) 거절
    const forged = JSON.parse(JSON.stringify(t1.reply.bundle)) as Record<string, unknown>;
    forged.payload = 'x' + String(forged.payload ?? '').slice(1);
    const t3 = await postAit('chat', { asker_text: '이어서요', bundle: forged }, CODE, fetchImpl);
    expect(t3.kind === 'reply' && t3.reply.code).not.toBe('ok');
    expect(seen[1].init.body).toContain('"bundle"');
  });

  test('위기 글은 서버가 먼저 고정 카드로 — 앱은 id 만 본다 (ATF-22)', async () => {
    const { fetchImpl } = serverFetch();
    const r = await postAit('chat', { asker_text: '죽고 싶다는 생각이 계속 들어요' }, CODE, fetchImpl);
    expect(r.kind === 'reply' && r.reply.code).toBe('crisis');
    expect(r.kind === 'reply' && r.reply.card?.id).toBe('crisis');
  });

  test('닿지 못하면 offline — 던짐 · 잘못된 모양 · JSON 아님 · 오류 본문은 버린다 (정적 판 · 끊김)', async () => {
    const boom: AitFetch = async () => { throw new TypeError('network 상세 ' + CODE); };
    expect(await postAit('horoscope', {}, CODE, boom)).toEqual({ kind: 'offline' });
    const html: AitFetch = async () => ({ json: async () => { throw new SyntaxError('<html>'); } });
    expect(await postAit('horoscope', {}, CODE, html)).toEqual({ kind: 'offline' });
    const odd: AitFetch = async () => ({ json: async () => ({ code: 'whatever', ok: true }) });
    expect(await postAit('horoscope', {}, CODE, odd)).toEqual({ kind: 'offline' });
  });

  test('응답 읽기: 모양이 다르면 null · 글은 길이를 자른다 · 숫자 retry 는 1 ~ 3600', () => {
    expect(parseReply(null)).toBeNull();
    expect(parseReply({ ok: false, code: 'rate', retryAfterSec: 99999 })?.retryAfterSec).toBe(3600);
    expect(parseChatDisplay({ stage: 'S9', sentences: [] })).toBeNull();
    expect(parseChatDisplay({ stage: 'S1', sentences: [{ kind: 'trait', text: 'x'.repeat(900), refs: [] }] })?.sentences[0].text).toHaveLength(400);
    expect(parseCompatDisplay({ same_line: 'a', topics: [] })).toBeNull();
    expect(parseCoachDisplay({ keep: '', findings: [{ quote: 1 }] })).toBeNull();
    expect(parseHoroscopeDisplay({ star: 'a' })).toBeNull();
  });
});
