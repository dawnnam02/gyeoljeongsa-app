/**
 * @jest-environment node
 */
// Q2-30 · AI-FIX10 ④ 시험판 AI 기능의 차감 키(love_reading · compat_glance · zodiac · counsel_turn)와 예치 → 확정 · 해제 틀.
//  스위치가 꺼져 있으면(장부 없음) 차감 경로가 열리지 않는다 · 값은 get_mileage.costs 에서 읽는다 · 위기 카드는 차감 0.
import fs from 'node:fs';
import path from 'node:path';

import { AIT_COST_KEY, aitCostKey, costOf, outcomeOfReply, runCharged } from '@/features/ait/aitCharge';
import { AIT_CODES } from '@/features/ait/aitTypes';
import type { AitReply, AitResult } from '@/features/ait/aitTypes';
import type { HoldResult, LedgerEdge } from '@/features/mileage/ledgerEdge';
import { CHARGE_OF_CODE, RESPONSE_CODES } from '@/server/ait/codes';
import { COST_KEY } from '@/server/ait/features';

const COSTS = [{ feature: 'compat_glance', cost: 10 }, { feature: 'zodiac', cost: 10 }, { feature: 'counsel_turn', cost: 330 }, { feature: 'love_reading', cost: 2900 }];

function edge(hold: HoldResult) {
  const log: string[] = [];
  const e: LedgerEdge = {
    hold: async (a) => (log.push(`hold:${a.feature}:${a.chars}`), hold),
    settle: async (id) => (log.push(`settle:${id}`), true),
    release: async (id, why) => (log.push(`release:${id}:${why}`), true),
  };
  return { e, log };
}
const held: HoldResult = { kind: 'held', holdId: 'h1', amount: 10, replay: false };

describe('차감 키 · 값은 서버 차감표에서', () => {
  test('키 이름이 서버 차감표(백엔드 0058 이관)와 같고, 값은 costs 에서 읽는다 — 앱에 수 0', () => {
    expect(AIT_COST_KEY).toEqual({ chat: 'counsel_turn', compat: 'compat_glance', horoscope: 'zodiac', love_reading: 'love_reading' });
    expect(aitCostKey('compat')).toBe('compat_glance');
    expect(aitCostKey('coach')).toBeNull(); // 코치(polish_*)는 이 틀 밖
    expect(costOf(COSTS, 'zodiac')).toBe(10);
    expect(costOf(COSTS, 'nope')).toBeNull();
    expect(costOf([{ feature: 'zodiac', cost: -1 }], 'zodiac')).toBeNull();
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'backend', 'migrations', '0058_mileage_d244.sql'), 'utf8');
    for (const k of ['love_reading', 'compat_glance', 'zodiac']) expect(sql).toContain(k); // 서버 차감표에 있는 키
    const src = fs.readFileSync(path.join(__dirname, '..', 'features', 'ait', 'aitCharge.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/\b\d{3,}\b/); // 마일리지 수를 앱에 적지 않는다
  });
});

describe('예치 → 부르기 → 확정 · 해제', () => {
  const a = { feature: 'compat' as const, requestId: 'r1', chars: 0, costs: COSTS };
  test('답이 나가면 확정, 호출은 한 번', async () => {
    const { e, log } = edge(held);
    let n = 0;
    const r = await runCharged(e, a, async () => (n++, { outcome: 'ok' as const, value: 'x' }));
    expect(r).toEqual({ kind: 'ok', value: 'x' });
    expect(log).toEqual(['hold:compat_glance:0', 'settle:h1']);
    expect(n).toBe(1);
  });
  test('위기 · 거절 카드와 못 받음은 확정 없이 해제(차감 0)', async () => {
    for (const [outcome, why] of [['card', 'user_cancel'], ['failed', 'check_failed']] as const) {
      const { e, log } = edge(held);
      const r = await runCharged(e, { ...a, feature: 'horoscope' }, async () => ({ outcome, value: 1 }));
      expect(r.kind).toBe(outcome);
      expect(log).toEqual(['hold:zodiac:0', `release:h1:${why}`]);
    }
    const { e, log } = edge(held);
    const r = await runCharged(e, a, async () => {
      throw new Error('x');
    }); // 던져도 해제
    expect(r).toEqual({ kind: 'maint' });
    expect(log).toEqual(['hold:compat_glance:0', 'release:h1:provider_error']);
  });
  test('스위치가 꺼져 있으면(off) · 장부 실패 · 너무 큼 · 위기 무료는 차감 경로가 열리지 않는다 — 부르기 0', async () => {
    for (const hold of [{ kind: 'off' }, { kind: 'fail' }, { kind: 'tooLarge' }, { kind: 'free' }] as HoldResult[]) {
      const { e, log } = edge(hold);
      let n = 0;
      const r = await runCharged(e, a, async () => (n++, { outcome: 'ok' as const, value: 1 }));
      expect(r).toEqual({ kind: 'maint' });
      expect(n).toBe(0);
      expect(log.filter((x) => !x.startsWith('hold:'))).toEqual([]); // 확정 · 해제도 없다
    }
  });
  test('잔액 부족은 부르기 0 · 값을 서버가 안 준 키는 예치조차 안 한다', async () => {
    const low = edge({ kind: 'low', need: 10, have: 3 });
    expect(await runCharged(low.e, a, async () => ({ outcome: 'ok' as const, value: 1 }))).toEqual({ kind: 'low', need: 10, have: 3 });
    const none = edge(held);
    expect(await runCharged(none.e, { ...a, costs: [] }, async () => ({ outcome: 'ok' as const, value: 1 }))).toEqual({ kind: 'maint' });
    expect(none.log).toEqual([]);
    expect(await runCharged(none.e, { ...a, feature: 'coach' as never }, async () => ({ outcome: 'ok' as const, value: 1 }))).toEqual({ kind: 'maint' });
  });
});

describe('서버 답 → 차감 결과 (답이 나가야만 확정)', () => {
  const card = { id: 'crisis', lines: ['x'], options: [] as ('continue' | 'end')[] };
  const reply = (over: Partial<AitReply>): AitResult => ({ kind: 'reply', reply: { ok: true, code: 'ok', mode: 'live', display: { a: 1 }, card: null, bundle: null, retryAfterSec: null, ...over } });
  const parse = (d: unknown) => (d && typeof d === 'object' ? (d as { a?: number }).a ?? null : null);

  test('ok + 읽힌 글만 ok(확정) · 위기 · 거절 카드는 card(차감 0) · 그 밖의 모든 코드와 끊김은 failed(차감 0)', () => {
    expect(outcomeOfReply(reply({}), parse)).toEqual({ outcome: 'ok', value: 1 });
    expect(outcomeOfReply(reply({ ok: false, code: 'crisis', card, display: null }), parse)).toEqual({ outcome: 'card', value: null });
    expect(outcomeOfReply(reply({ ok: false, code: 'refused_intent', card, display: null }), parse)).toEqual({ outcome: 'card', value: null });
    for (const code of AIT_CODES.filter((c) => c !== 'ok' && c !== 'crisis' && c !== 'refused_intent')) {
      expect(outcomeOfReply(reply({ ok: false, code, display: null }), parse).outcome).toBe('failed'); // blocked_output(검사 · 심사 탈락 · 판정 실패) 포함
    }
    expect(outcomeOfReply({ kind: 'offline' }, parse).outcome).toBe('failed');
    expect(outcomeOfReply(reply({ display: null }), parse).outcome).toBe('failed'); // 글을 못 읽으면 보여 준 게 없다
    expect(outcomeOfReply(reply({ ok: false }), parse).outcome).toBe('failed'); // code 만 ok 이고 ok 표시가 아니면 확정하지 않는다
    expect(outcomeOfReply(reply({ code: 'crisis', card: null, ok: false, display: null }), parse).outcome).toBe('failed'); // 카드 없는 위기 코드는 카드로 치지 않음(차감은 0 그대로)
  });

  test('판정 실패 · 위기 · 거절이 나온 호출은 끝까지 흘려도 settle 0, release 1 — 이중 차감 0', async () => {
    for (const code of ['blocked_output', 'timeout', 'upstream', 'crisis', 'refused_intent'] as const) {
      const log: string[] = [];
      const e: LedgerEdge = { hold: async () => ({ kind: 'held', holdId: 'h', amount: 10, replay: false }), settle: async () => (log.push('settle'), true), release: async () => (log.push('release'), true) };
      const res = reply({ ok: false, code, display: null, card: code === 'crisis' || code === 'refused_intent' ? card : null });
      await runCharged(e, { feature: 'horoscope', requestId: 'r', chars: 0, costs: COSTS }, async () => outcomeOfReply(res, parse) as { outcome: 'ok' | 'card' | 'failed'; value: number | null });
      expect(log).toEqual(['release']);
    }
  });

  test('서버 쪽 표와 같은 규칙 · 같은 키: 앱의 차감 키 = AI 서버 모듈(features.ts COST_KEY), 확정은 응답 코드 ok 하나(codes.ts CHARGE_OF_CODE)', () => {
    expect(AIT_COST_KEY).toEqual({ chat: COST_KEY.chat, compat: COST_KEY.compat, horoscope: COST_KEY.horoscope, love_reading: COST_KEY.love_reading });
    expect([...AIT_CODES].sort()).toEqual([...RESPONSE_CODES].sort());
    expect(RESPONSE_CODES.filter((c) => CHARGE_OF_CODE[c] === 'settle')).toEqual(['ok']);
    for (const c of AIT_CODES) {
      const o = outcomeOfReply(reply({ ok: c === 'ok', code: c, card: c === 'crisis' || c === 'refused_intent' ? card : null, display: c === 'ok' ? { a: 1 } : null }), parse).outcome;
      expect(o === 'ok').toBe(CHARGE_OF_CODE[c] === 'settle');
    }
  });
});
