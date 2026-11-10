/**
 * @jest-environment node
 */
// Q2-30 · AI-FIX10 ④ 시험판 AI 기능의 차감 키(love_reading · compat_glance · zodiac · counsel_turn) 읽기 + RS2-01(D-253) 순 3 [다] 차감 정리.
//  예치 · 확정 · 해제는 서버(Edge 함수 ai-run)가 한다 — 이 파일의 앱 쪽 장부 길(runCharged)은 없앴다. 앱은 응답 charge.state 만 읽는다(settled 일 때만 잔액을 다시 읽는다).
//  값은 get_mileage.costs 에서 읽는다 · 위기 카드는 차감 0.
import fs from 'node:fs';
import path from 'node:path';

import { AIT_COST_KEY, aitCostKey, costOf, outcomeOfReply, shouldReloadBalance } from '@/features/ait/aitCharge';
import { AIT_CODES, BASE_CODES, EDGE_CODES, parseReply } from '@/features/ait/aitTypes';
import type { AitReply, AitResult } from '@/features/ait/aitTypes';
import { CHARGE_OF_CODE, RESPONSE_CODES } from '@/server/ait/codes';
import { COST_KEY } from '@/server/ait/features';

const COSTS = [{ feature: 'compat_glance', cost: 10 }, { feature: 'zodiac', cost: 10 }, { feature: 'counsel_turn', cost: 330 }, { feature: 'love_reading', cost: 2900 }];

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

describe('RS2-01 [다] 앱은 예치 · 확정 · 해제를 부르지 않는다 (서버가 한다)', () => {
  test('aitCharge.ts 에 장부(ledgerEdge) 가져오기 · hold · settle · release 호출이 없다', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'features', 'ait', 'aitCharge.ts'), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/ledgerEdge|LedgerEdge/);
    expect(src).not.toMatch(/\.(hold|settle|release)\s*\(/);
    expect(src).not.toMatch(/runCharged/);
  });

  test('응답 charge.state 가 settled 일 때만 잔액을 다시 읽는다 · none · off · low 와 charge 없는 답(모의 · EAS 길)은 읽지 않는다', () => {
    const base = { ok: true, code: 'ok', mode: 'live', display: { a: 1 }, card: null, bundle: null, retryAfterSec: null } as const;
    expect(shouldReloadBalance({ ...base, charge: { state: 'settled', need: null, have: null } })).toBe(true);
    for (const state of ['none', 'off', 'low'] as const) expect(shouldReloadBalance({ ...base, charge: { state, need: null, have: null } })).toBe(false);
    expect(shouldReloadBalance(base)).toBe(false);
  });

  test('charge 읽기: 모르는 상태는 none(차감 없음)으로 · 숫자만 · 키가 없으면 charge 도 없다', () => {
    const raw = { ok: false, code: 'low_balance', mode: 'mock', text: '서버 문장은 읽지 않는다', charge: { state: 'low', need: 330, have: 120 } };
    expect(parseReply(raw)).toEqual({ ok: false, code: 'low_balance', mode: 'mock', display: null, card: null, bundle: null, retryAfterSec: null, charge: { state: 'low', need: 330, have: 120 } });
    expect(parseReply({ ...raw, charge: { state: 'weird', need: 'x', have: -5 } })?.charge).toEqual({ state: 'none', need: null, have: null });
    expect(parseReply({ ok: true, code: 'ok' })).toEqual({ ok: true, code: 'ok', mode: null, display: null, card: null, bundle: null, retryAfterSec: null });
    expect('charge' in (parseReply({ ok: true, code: 'ok' }) as object)).toBe(false);
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
      expect(outcomeOfReply(reply({ ok: false, code, display: null }), parse).outcome).toBe('failed'); // blocked_output(검사 · 심사 탈락 · 판정 실패) · ai-run 새 코드 셋 포함
    }
    expect(outcomeOfReply({ kind: 'offline' }, parse).outcome).toBe('failed');
    expect(outcomeOfReply(reply({ display: null }), parse).outcome).toBe('failed'); // 글을 못 읽으면 보여 준 게 없다
    expect(outcomeOfReply(reply({ ok: false }), parse).outcome).toBe('failed'); // code 만 ok 이고 ok 표시가 아니면 확정하지 않는다
    expect(outcomeOfReply(reply({ code: 'crisis', card: null, ok: false, display: null }), parse).outcome).toBe('failed'); // 카드 없는 위기 코드는 카드로 치지 않음(차감은 0 그대로)
  });

  test('서버 쪽 표와 같은 규칙 · 같은 키: 앱의 차감 키 = AI 서버 모듈(features.ts COST_KEY), 확정은 응답 코드 ok 하나(codes.ts CHARGE_OF_CODE)', () => {
    expect(AIT_COST_KEY).toEqual({ chat: COST_KEY.chat, compat: COST_KEY.compat, horoscope: COST_KEY.horoscope, love_reading: COST_KEY.love_reading });
    // 앱 코드 = 서버 AI 모듈의 열세 코드 + ai-run 에서만 나오는 셋(low_balance · already_done · daily_limit — 모두 차감 0)
    expect([...BASE_CODES].sort()).toEqual([...RESPONSE_CODES].sort());
    expect([...EDGE_CODES]).toEqual(['low_balance', 'already_done', 'daily_limit']);
    expect([...AIT_CODES].sort()).toEqual([...RESPONSE_CODES, ...EDGE_CODES].sort());
    expect(RESPONSE_CODES.filter((c) => CHARGE_OF_CODE[c] === 'settle')).toEqual(['ok']);
    for (const c of BASE_CODES) {
      const o = outcomeOfReply(reply({ ok: c === 'ok', code: c, card: c === 'crisis' || c === 'refused_intent' ? card : null, display: c === 'ok' ? { a: 1 } : null }), parse).outcome;
      expect(o === 'ok').toBe(CHARGE_OF_CODE[c] === 'settle');
    }
    for (const c of EDGE_CODES) expect(outcomeOfReply(reply({ ok: false, code: c, display: null }), parse).outcome).toBe('failed'); // 새 코드 셋은 확정하지 않는다
  });
});
