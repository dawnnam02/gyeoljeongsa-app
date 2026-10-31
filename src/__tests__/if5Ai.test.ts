/**
 * @jest-environment node
 */
// IF5-F2 ⑩ AI 맞춤 시험 — 서버 경로(/api/ai/s5_*) 모의 응답만 · 실호출 0 · 네트워크 0. 사실 묶음 · 서버 문 · 예치 흐름 · 위기 · 끝줄.
//  보안 앱 시험 IFF5-05 · 06 · 12 · 15 · 16 · 26 · 27 · 28 · 29 · 35 가운데 F2 몫 + AIT 서버 오류 5종 · 던지기 경로 로그 전수(ATS-03 — AIT_위협 14장 KEEP 한계 ⓑ).
import fs from 'node:fs';
import path from 'node:path';

import { demoHelpHit } from '@/demo/crisisWords';
import { createDemoSaju } from '@/demo/sajuDemo';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi } from '@/features/mileage/mileageApi';
import { pickS5Body, S5_BODY_KEYS, S5_KINDS } from '@/features/saju/ai/aiClient';
import { chatFacts, daewoonFacts, readingFacts, sinyeonFacts, taekilFacts } from '@/features/saju/ai/aiFacts';
import { runAi, COST_FEATURE, newRequestId, type AiDeps } from '@/features/saju/ai/aiRun';
import { partnerAiFacts } from '@/features/saju/partnerLocal';
import { chartOf, type ReadyChart, type ReadyLuck } from '@/features/saju/sajuLogic';
import { parseMyChart, parseMyLuck, parseTaekil } from '@/features/saju/sajuApi';
import type { AitResult } from '@/features/ait/aitTypes';
import { createCounters, MAX_BODY_BYTES } from '@/server/ait';
import { createAitRoute, type RouteEnv, type Upstream } from '@/server/ait/route';
import { guardFacts, S5_ALLOWED_KEYS, S5_FEATURES, type S5Feature } from '@/server/ait/sajuRoute';
import { guardCompatFacts } from '@/server/saju5/partner5';
import { SCREEN_LABEL5, screenRelationLabels } from '@/server/saju5/ai_facts5';

const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');
const SIGN = 'test-signing-secret-' + 'abcd'.repeat(6);
const HOST = 'lovedecide--demo.expo.app';
const ENV = { AI_ACCESS_CODE: CODE, AIT_SIGN_KEY: SIGN } as unknown as RouteEnv;

function route() {
  const lines: string[] = [];
  const calls: unknown[] = [];
  let clock = Date.UTC(2026, 10, 1, 3, 0, 0);
  const r = createAitRoute({
    env: () => ENV,
    makeUpstream: () => ({ create: async (b) => (calls.push(b), { data: { stop_reason: 'end_turn', content: [], usage: {} }, workspaceId: 'x' }) }) as Upstream,
    now: () => (clock += 11_000),
    counters: createCounters(),
    lock: { live: false },
    sink: (l) => lines.push(l),
  });
  const post = async (body: unknown, headers: Record<string, string> = {}) => {
    const res = await r(new Request(`https://${HOST}/api/ai/x`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ait-code': CODE, host: HOST, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
  return { post, lines, calls };
}

// 서버 읽기 응답(데모 모의 서버) → 앱이 쓰는 내 사실
async function mine() {
  const demo = createDemoSaju({ flags: async () => ({ saju_yard: true }), account: () => ({ birthDate: '1994-03-14', consentOn: () => true }), today: () => '2027-03-20' });
  const u = { id: 'u', email: 'sj@email.com' };
  const chart = parseMyChart((await demo.rpc(u, 'get_my_saju', { p_hour: 15, p_minute: 20, p_place: '서울' })).data) as ReadyChart;
  const luck = parseMyLuck((await demo.rpc(u, 'get_my_luck', { p_hour: 15, p_minute: 20, p_place: '서울', p_year: 2027 })).data) as ReadyLuck;
  const tk = parseTaekil((await demo.rpc(u, 'get_taekil', { p_purpose: 'moving', p_start: '2027-04-01', p_end: '2027-04-20', p_personal: false, p_hour: null, p_minute: null, p_place: null })).data);
  const my = chartOf(chart)!;
  return { chart, luck, my, tk: tk! };
}

describe('IF5-F2 ⑩ 사실 묶음 — 대운 날짜 0 · 상대 간지 0 · 생일 원값 0', () => {
  test('내 쪽 사실: 날짜 · 코드 · 번호 칸 0, 대운은 나이(년 · 개월)와 순서만', async () => {
    const { my, luck } = await mine();
    const all = {
      reading: readingFacts(my),
      daewoon: daewoonFacts(my, luck, '2027-03-20'),
      sinyeon: sinyeonFacts(my, luck),
      chat: chatFacts(my, luck, '2027-03-20'),
    };
    for (const [k, f] of Object.entries(all)) {
      expect(f).not.toBeNull();
      const text = JSON.stringify(f);
      expect(text).not.toMatch(/start_date|end_date|date_exact|"idx"|"code"|birth/);
      expect(text.replace(/"starts":"[^"]*"/g, '')).not.toMatch(/\d{4}-\d{2}-\d{2}/); // 연-월-일 꼴 날짜 0(절기 시각 starts 칸만 예외)
      expect(guardFacts(`s5_${k}` as never, f)).toEqual({ ok: true });
    }
    const dw = all.daewoon as { items: { start_age_years: number }[]; current: unknown; total_periods: number };
    expect(dw.items.length).toBeGreaterThanOrEqual(3);
    expect(dw.total_periods).toBe(9);
    expect(typeof dw.items[0].start_age_years).toBe('number');
  });
  test('서버 문: 대운 날짜를 얹으면 거절 · 한자 · 생일 칸 · 코드 칸 거절', async () => {
    const { my, luck } = await mine();
    const dw = daewoonFacts(my, luck, '2027-03-20')!;
    expect(guardFacts('s5_daewoon', { ...dw, items: [{ ...(dw.items as object[])[0], start_date: '2030-01-01' }] })).toEqual({ ok: false, why: 'forbidden_key' });
    expect(guardFacts('s5_daewoon', { ...dw, note: '시작 2030-01-01' })).toEqual({ ok: false, why: 'date_in_facts' });
    expect(guardFacts('s5_reading', { ...readingFacts(my), x: '甲子' })).toEqual({ ok: false, why: 'hanja' });
    expect(guardFacts('s5_reading', { ...readingFacts(my), birth: '1994-03-14' })).toEqual({ ok: false, why: 'forbidden_key' });
    expect(guardFacts('s5_reading', { ...dw })).toEqual({ ok: false, why: 'kind' });
    expect(guardFacts('s5_chat', 'x')).toEqual({ ok: false, why: 'not_object' });
  });
  test('상대 쪽: 간지 없는 2단계 — 일간의 오행 · 음양과 시각을 아는지뿐 · 간지를 끼우면 서버가 거절', async () => {
    const { my } = await mine();
    const f = partnerAiFacts(my, { birthDigits: '19920802', time: { hour: 9, minute: 0 } }, '2027-03-20')!;
    expect(f).not.toBeNull();
    expect(f.partner_level).toBe(2);
    expect(f.b).toEqual({ hour_known: true, day_master: { element: expect.any(String), polarity: expect.any(String) } });
    expect(guardCompatFacts(f)).toEqual({ ok: true });
    expect(guardFacts('s5_compat', f)).toEqual({ ok: true });
    // 상대 생일 원값 · 기둥 문자열은 어디에도 없다
    expect(JSON.stringify(f.b)).not.toMatch(/1992|0802|pillars|ganji/);
    const dirty = { ...f, b: { ...(f.b as object), pillars: [{ pos: '일주', ganji: '갑자' }] } };
    expect(guardCompatFacts(dirty).ok).toBe(false);
    expect(guardFacts('s5_compat', dirty).ok).toBe(false);
    expect(partnerAiFacts(my, { birthDigits: '20150101', time: null }, '2027-03-20')).toBeNull(); // 만 19세 미만 — 보내지 않는다
    expect(partnerAiFacts(my, { birthDigits: '19500101', time: null }, '2027-03-20')).toBeNull(); // 범위 밖
  });
  test('관계 말은 업체 요청을 만드는 순간 서버가 화면 말로 바꾼다(보내는 쪽 치환)', () => {
    const out = JSON.stringify(screenRelationLabels({ relations: [{ label: Object.keys(SCREEN_LABEL5)[0] }] }));
    expect(out).toContain(Object.values(SCREEN_LABEL5)[0]);
  });
});

describe('IF5-F2 ⑩ 서버 경로 /api/ai/s5_* (모의 응답)', () => {
  test('코드가 없으면 어느 기능이든 같은 401 · 본문 키 허용 목록 · 앱 허용 목록과 같음', async () => {
    const { post } = route();
    for (const f of S5_FEATURES) {
      const r = await post({ feature: f, facts: {} }, { 'x-ait-code': '' });
      expect(r.status).toBe(401);
      expect(r.json.code).toBe('auth');
    }
    expect((await post({ feature: 's5_reading', facts: {}, model: 'x' })).status).toBe(400); // 모델 · 토큰 · 시스템을 앱이 정하려 하면 거절
    expect((await post({ feature: 's5_reading', facts: {}, max_tokens: 9999 })).status).toBe(400);
    for (const k of S5_KINDS) expect([...S5_BODY_KEYS[k]].sort()).toEqual(S5_ALLOWED_KEYS[`s5_${k}` as S5Feature].filter((x) => x !== 'feature').sort());
    expect(pickS5Body('reading', { facts: {}, model: 'x', amount: 5 })).toEqual({ feature: 's5_reading', facts: {} });
  });
  test('여섯 기능이 모의로 끝까지: 풀이 · 대운 · 올해 · 궁합 · 날짜 설명 · 이야기 — 끝줄(FOOTER5)은 응답에 없다', async () => {
    const { post, calls } = route();
    const { my, luck, tk } = await mine();
    const facts: Record<string, Record<string, unknown>> = {
      s5_reading: readingFacts(my),
      s5_daewoon: daewoonFacts(my, luck, '2027-03-20')!,
      s5_sinyeon: sinyeonFacts(my, luck)!,
      s5_compat: partnerAiFacts(my, { birthDigits: '19920802', time: null }, '2027-03-20')!,
      s5_taekil: taekilFacts('moving', tk)!,
    };
    for (const [f, v] of Object.entries(facts)) {
      const r = await post({ feature: f, facts: v });
      expect(r.json.code).toBe('ok');
      expect(r.json.mode).toBe('mock');
      expect(JSON.stringify(r.json)).not.toMatch(/재미로 보는 이야기예요|결정은 내 몫|bundle/);
    }
    const c = await post({ feature: 's5_chat', text: '요즘 일이 잘 풀릴까요?', facts: chatFacts(my, luck, '2027-03-20') });
    expect(c.json.code).toBe('ok');
    expect(typeof c.json.display.reply).toBe('string');
    expect(c.json.bundle.mac).toBeTruthy();
    expect(calls).toHaveLength(0); // 모의 모드 — 업체 호출 0(실호출 0)
  });
  test('이야기: 서명 묶음으로 이어 감 · 사실을 다시 보내면 거절 · 위기 말은 업체 호출 0 + 고정 카드 + 묶음 이어짐', async () => {
    const { post } = route();
    const { my, luck } = await mine();
    const first = await post({ feature: 's5_chat', text: '올해 일이 어떨까요?', facts: chatFacts(my, luck, '2027-03-20') });
    const next = await post({ feature: 's5_chat', text: '그럼 사람 관계는요?', bundle: first.json.bundle });
    expect(next.json.code).toBe('ok');
    expect(next.json.display.turns).toBe(2);
    expect((await post({ feature: 's5_chat', text: '네', bundle: first.json.bundle, facts: {} })).status).toBe(400);
    const crisis = await post({ feature: 's5_chat', text: '요즘 너무 힘들어서 죽고 싶어요', bundle: next.json.bundle });
    expect(crisis.json.code).toBe('crisis');
    expect(crisis.json.card.id).toBe('crisis');
    expect(crisis.json.card.options).toContain('continue'); // 닫으면 대화로 돌아감
    const after = await post({ feature: 's5_chat', text: '고마워요, 이어서요', bundle: crisis.json.bundle });
    expect(after.json.code).toBe('ok');
    // 앞거름(precheck): 업체 호출 0 · 묶음 0
    const pre = await post({ feature: 's5_chat', text: '죽고 싶어요', precheck: true });
    expect(pre.json.code).toBe('crisis');
    expect(pre.json.bundle).toBeUndefined();
    const pass = await post({ feature: 's5_chat', text: '올해 어때요', precheck: true });
    expect(pass.json.code).toBe('ok');
    // 미성년 신호는 세션을 닫는다
    const minor = await post({ feature: 's5_chat', text: '저는 고등학생인데 사주 봐 주세요', bundle: after.json.bundle });
    expect(minor.json.code).toBe('refused_intent');
    expect((await post({ feature: 's5_chat', text: '그래도요', bundle: minor.json.bundle })).json.code).toBe('limit');
  });
  test('던지기 경로 로그 전수(ATS-03) · 오류 5종: 로그에는 허용 키뿐 — 입력 · 사실 · 코드 · 서명 키 값 0', async () => {
    const { post, lines } = route();
    const { my, luck } = await mine();
    const MARK = 'UNIQUE-표지-77aa';
    await post({ feature: 's5_chat', text: `${MARK} 올해 어때요`, facts: chatFacts(my, luck, '2027-03-20') });
    await post({ feature: 's5_chat', text: `${MARK} 죽고 싶어요`, facts: chatFacts(my, luck, '2027-03-20') });
    await post({ feature: 's5_reading', facts: { kind: 'reading', note: MARK, birth: '1994-03-14' } }); // 걸러지는 사실
    await post({ feature: 's5_reading', facts: readingFacts(my) }, { 'x-ait-code': 'wrong' });
    await post('{not json');
    await post({ feature: 's5_chat', text: MARK, bundle: { payload: 'x', mac: 'y' } });
    expect(lines.length).toBeGreaterThan(3);
    const ALLOWED = new Set(['t', 'f', 'in', 'out', 'ms', 'code', 'mode', 'rid']);
    for (const l of lines) {
      const rec = JSON.parse(l) as Record<string, unknown>;
      for (const k of Object.keys(rec)) expect(ALLOWED.has(k)).toBe(true);
      expect(l).not.toContain(MARK);
      expect(l).not.toContain(CODE);
      expect(l).not.toContain(SIGN);
    }
    // 던져진 오류는 오류 객체를 내보내지 않는다 — 로그에 스택 · 메시지 0
    expect(lines.join('\n')).not.toMatch(/at \w+|Error|stack/);
  });
  test('큰 본문 413 · 본문 한도 이름 맞춤', async () => {
    const { post } = route();
    const r = await post({ feature: 's5_chat', text: 'a'.repeat(MAX_BODY_BYTES + 10), facts: {} });
    expect(r.status).toBe(413);
  });
});

describe('IF5-F2 ⑨ ⑩ 예치 → 확정 · 해제 흐름(runAi)', () => {
  const rig = (over: { email?: string; code?: string | null; post?: AiDeps['post'] } = {}) => {
    const demo = createDemoMileage({ flags: async () => ({ mileage: true, mileage_spend: true, mileage_charge: true }) });
    const u = { id: 'u1', email: over.email ?? 'a@email.com' };
    const call = async (fn: string, args: Record<string, unknown> = {}) => demo.rpc(u, fn, args);
    const api = createMileageApi(call);
    const edge = createLedgerEdge(call);
    const posts: { kind: string; body: Record<string, unknown> }[] = [];
    const post: AiDeps['post'] =
      over.post ??
      (async (kind, body) => {
        posts.push({ kind, body });
        return { kind: 'reply', reply: { ok: true, code: 'ok', mode: 'mock', display: { reply: '답이에요.', ask: '', flags: [] }, card: null, bundle: { payload: 'p', mac: 'm' }, retryAfterSec: null } } as AitResult;
      });
    const deps: AiDeps = { edge, code: () => (over.code === undefined ? CODE : over.code), post };
    const total = async () => {
      const s = await api.state();
      return s.ok ? s.data.total : -1;
    };
    return { deps, total, posts, api };
  };
  const facts = { kind: 'reading' };

  test('성공: 답이 나가면 확정 — 800 차감 · 실제 호출 한 번', async () => {
    const r = rig();
    const out = await runAi(r.deps, { kind: 'reading', requestId: newRequestId(), chars: 0, facts });
    expect(out.kind).toBe('ok');
    expect(await r.total()).toBe(200);
    expect(r.posts).toHaveLength(1);
  });
  test('코드가 없으면 서버 요청 0 · 데모 글 · 예치는 그대로 한다', async () => {
    const r = rig({ code: null });
    const { my } = await mine();
    const out = await runAi(r.deps, { kind: 'reading', requestId: newRequestId(), chars: 0, facts: readingFacts(my) });
    expect(out).toMatchObject({ kind: 'ok', mode: 'demo' });
    expect(r.posts).toHaveLength(0);
  });
  test('검사 탈락 · 끊김 · 시간 초과는 모두 해제 — 차감 0 · 같은 요청 번호로 다시 보낼 수 있다', async () => {
    for (const code of ['blocked_output', 'timeout', 'upstream'] as const) {
      const r = rig({ post: async () => ({ kind: 'reply', reply: { ok: false, code, mode: 'mock', display: null, card: null, bundle: null, retryAfterSec: null } }) as AitResult });
      const id = newRequestId();
      const out = await runAi(r.deps, { kind: 'reading', requestId: id, chars: 0, facts });
      expect(out.kind).toBe(code === 'blocked_output' ? 'blocked' : 'failed');
      expect(await r.total()).toBe(1000);
    }
    const off = rig({ post: async () => ({ kind: 'offline' }) as AitResult });
    expect((await runAi(off.deps, { kind: 'reading', requestId: newRequestId(), chars: 0, facts })).kind).toBe('failed');
    expect(await off.total()).toBe(1000);
  });
  test('잔액 부족: 서버를 부르지 않고 필요한 수 · 가진 수만 돌려준다', async () => {
    const r = rig({ email: 'mlow@email.com' }); // 잔액 100
    const out = await runAi(r.deps, { kind: 'sinyeon', requestId: newRequestId(), chars: 0, facts });
    expect(out).toEqual({ kind: 'low', need: 1500, have: 100 });
    expect(r.posts).toHaveLength(0);
    expect(await r.total()).toBe(100);
  });
  test('위기 카드는 차감 0 — 잔액이 0이어도 카드가 나온다(예치 전에 거른다) · 코드 없는 데모도 낱말로', async () => {
    const r = rig({ email: 'mzero@email.com', post: async (_k, body) => ({ kind: 'reply', reply: { ok: false, code: body.precheck ? 'crisis' : 'ok', mode: 'mock', display: null, card: { id: 'crisis', lines: [], options: ['continue', 'end'] }, bundle: null, retryAfterSec: null } }) as AitResult });
    const out = await runAi(r.deps, { kind: 'chat', requestId: newRequestId(), chars: 10, text: '죽고 싶어요', facts: {} });
    expect(out.kind).toBe('card');
    expect(await r.total()).toBe(0);
    const demo = rig({ email: 'mzero@email.com', code: null });
    expect((await runAi(demo.deps, { kind: 'chat', requestId: newRequestId(), chars: 10, text: '사라지고 싶어요', facts: {} })).kind).toBe('card');
    expect(demoHelpHit('사라지고 싶어요')).toBe(true);
  });
  test('종합: 풀이 · 대운 · 올해 세 번을 한 예치로 — 하나라도 못 받으면 전부 해제', async () => {
    const seq: string[] = [];
    const okReply = { ok: true, code: 'ok', mode: 'mock', display: { reply: 'x' }, card: null, bundle: null, retryAfterSec: null } as const;
    const r = rig({
      post: async (kind) => {
        seq.push(kind);
        return { kind: 'reply', reply: kind === 'sinyeon' ? { ...okReply, ok: false, code: 'blocked_output', display: null } : okReply } as AitResult;
      },
    });
    await r.api.charge('mileage_3300');
    const out = await runAi(r.deps, { kind: 'full', requestId: newRequestId(), chars: 0, facts, full: { reading: facts, daewoon: { kind: 'daewoon' }, sinyeon: { kind: 'sinyeon' } } });
    expect(out.kind).toBe('blocked');
    expect(seq).toEqual(['reading', 'daewoon', 'sinyeon']);
    expect(await r.total()).toBe(4300);
    const r2 = rig();
    const low = await runAi(r2.deps, { kind: 'full', requestId: newRequestId(), chars: 0, facts, full: { reading: facts, daewoon: null, sinyeon: null } });
    expect(low).toEqual({ kind: 'low', need: 2000, have: 1000 }); // 종합 2,000 > 가진 1,000
    await r2.api.charge('mileage_3300');
    const ok = await runAi(r2.deps, { kind: 'full', requestId: newRequestId(), chars: 0, facts, full: { reading: facts, daewoon: null, sinyeon: { kind: 'sinyeon' } } }); // 대운 칸 없는 분은 그 편만 빠진다
    expect(ok.kind).toBe('ok');
    expect(await r2.total()).toBe(2300);
  });
  test('기능 이름 → 차감표 이름(서버 mileage_features)', () => {
    expect(COST_FEATURE).toEqual({ reading: 'saju_reading', daewoon: 'daewoon', sinyeon: 'sinyeon', full: 'saju_full', compat: 'compat', taekil: 'taekil_explain', chat: 'saju_chat_turn' });
  });
});

describe('IF5-F2 ⑩ 정적 점검 — 끝줄 한 곳 · 번들 · 평문', () => {
  const src = (...p: string[]) => path.join(__dirname, '..', ...p);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(d, e.name)] : []));
  test('끝줄(SAJU.card.footer)은 화면 파일에서만 · 서버는 FOOTER5 를 응답에 붙이지 않는다', () => {
    const handler = fs.readFileSync(src('server', 'ait', 'sajuRoute.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(handler).not.toMatch(/FOOTER5/);
    const ai = walk(src('features', 'saju', 'ai')).map((f) => fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')).join('\n');
    expect(ai).not.toMatch(/SAJU\.card\.footer|FOOTER5|결정은 내 몫/); // AI 칸 안에서 끝줄 0 — 화면 한 곳(Footnote)만
  });
  test('화면 쪽 코드는 서버 폴더를 가져오지 않는다 · saju5 에는 AI 요청 모듈 0(번들)', () => {
    for (const dir of ['features', 'components', 'app']) {
      for (const f of walk(src(dir))) {
        if (f.includes(`${path.sep}app${path.sep}api${path.sep}`)) continue;
        expect(fs.readFileSync(f, 'utf8')).not.toMatch(/from '[^']*server\//);
      }
    }
    const names = fs.readdirSync(src('saju5'));
    for (const n of ['request5.ts', 'generated5.ts', 'chat5.ts', 'input5.ts', 'validate5.ts', 'partner5.ts', 'cost5.ts']) expect(names).not.toContain(n);
  });
  test('결과는 평문만 · 공유 · 복사 단추 0 · 열기에서 AI 호출 0(홈 · 마당은 눌렀을 때만)', () => {
    const t = walk(src('features', 'saju', 'ai')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(t).not.toMatch(/dangerouslySetInnerHTML|Linking|Clipboard|Share\.|expo-clipboard|expo-sharing|markdown/i);
    const hub = fs.readFileSync(src('features', 'saju', 'SajuMadangScreen.tsx'), 'utf8');
    expect(hub).not.toMatch(/runAi\(/); // 허브가 직접 AI 를 부르지 않는다 — AiBlock 의 단추 핸들러만
    const home = fs.readFileSync(src('features', 'inflight', 'InflightHome.tsx'), 'utf8');
    expect(home).not.toMatch(/runAi|postSaju5|aiServices|\/api\/ai/);
  });
});
