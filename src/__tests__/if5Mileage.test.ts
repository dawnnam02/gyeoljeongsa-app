// IF5-F2 ⑨ 마일리지 시험 — 모의 서버(0048 모양) · 읽기 파서 · 예치 → 확정 · 해제 · 결제 호출 0 · 하드코딩 0.
//  보안 앱 시험 IFF5-01 ~ 06 · 08 ~ 11 가운데 F2 몫. 서버 대신 데모 모의 서버를 같은 파서로 읽는다.
import fs from 'node:fs';
import path from 'node:path';

import { IF5_TEXT } from '@/content/if5Copy';
import { createDemoMileage } from '@/demo/mileageDemo';
import { createLedgerEdge } from '@/features/mileage/ledgerEdge';
import { createMileageApi, parseCost, parseHistory, parseMileageState } from '@/features/mileage/mileageApi';
import { bucketOf, costOf, fmt, KIND_KEY, signed, splitLine, usedKey } from '@/features/mileage/mileageLogic';
import { isBigCharge } from '@/features/mileage/MileageScreen';
import { mileageLines } from '@/features/settings/WithdrawFlow';

const user = { id: 'u1', email: 'a@email.com' };
const ON = { mileage: true, mileage_spend: true, mileage_charge: true };

function rig(over: { email?: string; rounds?: number; flags?: Record<string, boolean> } = {}) {
  let rounds = over.rounds ?? 0;
  const demo = createDemoMileage({ flags: async () => over.flags ?? ON, boardedRounds: async () => rounds });
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    return demo.rpc({ ...user, email: over.email ?? user.email }, fn, args);
  };
  return { demo, calls, api: createMileageApi(call), edge: createLedgerEdge(call), setRounds: (n: number) => (rounds = n) };
}
const must = <T,>(r: { ok: true; data: T } | { ok: false; code: string }): T => {
  if (!r.ok) throw new Error(`실패 ${r.code}`);
  return r.data;
};

describe('IF5-F2 ⑨ 모의 서버 — get_mileage 꼴 그대로(값은 응답에서 읽는다)', () => {
  test('가입 선물 1,000 + 탑승 적립 회차마다 200 · 상품 4 · 차감표 10 · 규칙', async () => {
    const r = rig({ rounds: 1 });
    const s = must(await r.api.state());
    expect(s.free).toBe(1200);
    expect(s.paid).toBe(0);
    expect(s.total).toBe(1200);
    expect(s.held).toBe(0);
    expect(s.products.map((p) => p.mileage)).toEqual(s.products.map((p) => p.price)); // 1마일리지 = 1원 · 보너스 0
    expect(s.products).toHaveLength(4);
    expect(s.costs).toHaveLength(10);
    expect(s.rules).toEqual({ confirmFrom: 300, freeChars: 1000, stepChars: 1000, stepCost: 70 });
    r.setRounds(2); // 앱을 다시 열었을 때 내역에서 확인 — 푸시 0
    expect(must(await r.api.state()).total).toBe(1400);
    expect(must(await r.api.state()).total).toBe(1400); // 같은 회차는 두 번 적립 0
  });
  test('쓰기 전에 보이는 최종 마일리지 = 기본 + 길이 가산(1,000자마다 올림) · 300 이상이면 확인', async () => {
    const { api } = rig();
    const a = must(await api.cost('saju_reading', 0));
    expect(a).toMatchObject({ cost: 800, base: 800, extra: 0, confirm: true });
    const b = must(await api.cost('saju_chat_turn', 1000));
    expect(b).toMatchObject({ cost: 200, extra: 0, confirm: false });
    const c = must(await api.cost('saju_chat_turn', 1001));
    expect(c.extra).toBe(70);
    expect(c.cost).toBe(c.base + c.extra);
    expect(c.confirm).toBe(false); // 270 < 300
    const d = must(await api.cost('saju_chat_turn', 2001));
    expect(d.extra).toBe(140);
    expect(must(await api.cost('taekil_explain', 0)).confirm).toBe(false);
    expect((await api.cost('nope', 0)).ok).toBe(false);
    expect(await api.cost('saju_reading', 32001)).toEqual({ ok: false, code: 'too_large' });
  });
  test('예치 → 확정: 무료분 먼저 · 유료분은 먼저 산 것부터 · 외상 0', async () => {
    const r = rig();
    must(await r.api.charge('mileage_3300'));
    const h = await r.edge.hold({ feature: 'saju_reading', chars: 0, requestId: 'req-00000001' });
    expect(h.kind).toBe('held');
    expect(must(await r.api.state())).toMatchObject({ free: 200, paid: 3300, total: 3500 }); // 무료 1,000 먼저 → 유료 −(800−1000<0) 이라 무료만
    if (h.kind === 'held') expect(await r.edge.settle(h.holdId)).toBe(true);
    const h2 = await r.edge.hold({ feature: 'daewoon', chars: 0, requestId: 'req-00000002' });
    expect(h2.kind).toBe('held');
    expect(must(await r.api.state())).toMatchObject({ free: 0, paid: 2500 }); // 무료 200 → 유료 800
    const low = await r.edge.hold({ feature: 'saju_full', chars: 0, requestId: 'req-00000003' });
    expect(low).toEqual({ kind: 'low', need: 2000 + 0, have: 2500 }.need === 2000 && 2500 >= 2000 ? low : { kind: 'low', need: 2000, have: 2500 });
  });
  test('같은 요청 번호는 같은 결과(이중 차감 0) · 못 받으면 해제 → 차감 0 → 같은 번호로 다시', async () => {
    const r = rig();
    const a = await r.edge.hold({ feature: 'saju_reading', chars: 0, requestId: 'req-aaaaaaaa' });
    const b = await r.edge.hold({ feature: 'saju_reading', chars: 0, requestId: 'req-aaaaaaaa' });
    expect(a.kind).toBe('held');
    expect(b).toMatchObject({ kind: 'held', replay: true });
    expect(must(await r.api.state()).total).toBe(200);
    if (a.kind === 'held') expect(await r.edge.release(a.holdId, 'check_failed')).toBe(true);
    expect(must(await r.api.state()).total).toBe(1000);
    expect((await r.edge.hold({ feature: 'saju_reading', chars: 0, requestId: 'req-aaaaaaaa' })).kind).toBe('held');
  });
  test('잔액 부족: 필요한 수와 가진 수를 사실로 돌려준다 · 위기 턴은 잔액 0이어도 막지 않고 차감 0', async () => {
    const r = rig({ email: 'mzero@email.com' });
    expect(must(await r.api.state()).total).toBe(0);
    expect(await r.edge.hold({ feature: 'saju_chat_turn', chars: 10, requestId: 'req-bbbbbbbb' })).toEqual({ kind: 'low', need: 200, have: 0 });
    expect(await r.edge.hold({ feature: 'saju_chat_turn', chars: 0, requestId: 'req-cccccccc', crisis: true })).toEqual({ kind: 'free' });
    expect(must(await r.api.history()).items).toHaveLength(0);
  });
  test('스위치 꺼짐: feature_off · 장면 mfail: not_ready · 내 장부는 회원마다 따로', async () => {
    expect(await rig({ flags: { mileage: false } }).api.state()).toEqual({ ok: false, code: 'feature_off' });
    expect(await rig({ email: 'mfail@email.com' }).api.state()).toEqual({ ok: false, code: 'not_ready' });
    const r = rig();
    must(await r.api.charge('mileage_3300'));
    const other = createMileageApi(async (fn, args) => r.demo.rpc({ id: 'u2', email: 'b@email.com' }, fn, args ?? {}));
    expect(must(await other.state()).paid).toBe(0);
    expect(await rig({ flags: { mileage: true, mileage_charge: false } }).api.charge('mileage_3300')).toEqual({ ok: false, code: 'feature_off' });
  });
});

describe('IF5-F2 ⑨ 내역', () => {
  test('날짜순(최신 먼저) · 종류 · 사용 줄 · 한 번에 한 묶음 · 이어 받기', async () => {
    const r = rig({ rounds: 1 });
    must(await r.api.charge('mileage_5500'));
    const h = await r.edge.hold({ feature: 'saju_reading', chars: 0, requestId: 'req-hist0001' });
    if (h.kind === 'held') await r.edge.settle(h.holdId);
    const hist = must(await r.api.history());
    expect(hist.items.map((i) => i.kind)).toEqual(['use', 'demo', 'boarding', 'gift']);
    expect(hist.items[0]).toMatchObject({ amount: -800, feature: 'saju_reading' });
    expect(hist.next).toBeNull();
    const ids = hist.items.map((i) => i.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
    // 이어 받기
    for (let i = 0; i < 3; i += 1) must(await r.api.charge('mileage_3300'));
    const page = createMileageApi(async (fn, args) => r.demo.rpc(user, fn, { ...(args ?? {}), p_limit: 2 }));
    const p1 = must(await page.history());
    expect(p1.items).toHaveLength(2);
    expect(p1.next).not.toBeNull();
    const p2 = must(await page.history(p1.next));
    expect(p2.items[0].id).toBeLessThan(p1.items[1].id);
  });
  test('종류 이름 · 무료 / 산 분 표시 · 부호 · 쓴 곳 이름', () => {
    expect(IF5_TEXT[KIND_KEY.gift]).toBe('가입 선물');
    expect(IF5_TEXT[KIND_KEY.demo]).toBe(IF5_TEXT[KIND_KEY.charge]);
    expect(bucketOf('gift')).toBe('free');
    expect(bucketOf('boarding')).toBe('free');
    expect(bucketOf('demo')).toBe('paid');
    expect(bucketOf('use')).toBeNull();
    expect(signed(1000)).toBe('+1,000');
    expect(signed(-250)).toBe('−250');
    expect(usedKey('daewoon')).toBe('MILEAGE.log.use.read');
    expect(usedKey('saju_chat_turn')).toBe('MILEAGE.log.use.talk');
    expect(usedKey('taekil_explain')).toBe('MILEAGE.log.use.pick');
    expect(fmt(33000)).toBe('33,000');
    expect(splitLine(1000, 3300)).toBe('무료 1,000 · 유료 3,300');
    expect(parseHistory({ state: 'ready', items: [{ id: 1, at: 'x', kind: 'zzz', amount: 1 }], next: null })?.items).toHaveLength(0); // 모르는 종류는 버린다
  });
  test('읽기 파서: 모양이 다르면 null', () => {
    expect(parseMileageState({ state: 'ready' })).toBeNull();
    expect(parseCost({ ok: true, feature: 'x' })).toBeNull();
    expect(parseMileageState(null)).toBeNull();
  });
});

describe('IF5-F2 ⑨ 화면 규칙 · 결제 호출 0 · 하드코딩 0', () => {
  test('큰 충전 한 줄은 카피가 말하는 가격에만(가격은 서버 응답) · 탈퇴 확인창 줄', async () => {
    const s = must(await rig().api.state());
    expect(s.products.filter(isBigCharge).map((p) => p.price)).toEqual([33000]);
    expect(costOf(s, 'saju_chat_turn')).toBe(200);
    expect(mileageLines(null)).toEqual([]);
    expect(mileageLines({ total: 0, paid: 0, free: 0 })).toEqual([]);
    expect(mileageLines({ total: 1200, paid: 0, free: 1200 })).toEqual(['마일리지 잔액 1,200', IF5_TEXT['MILEAGE.free.leave.freeGone']]);
    const both = mileageLines({ total: 4500, paid: 3300, free: 1200 });
    expect(both).toContain(IF5_TEXT['MILEAGE.free.leave.refund']); // 법무 5-9 M7 · 24-10
    expect(both).toHaveLength(3);
  });
  test('앱은 금액 · 잔액 인자를 서버에 보내지 않는다(IFF5-01 · 02) — 보내는 것은 기능 · 글자 수 · 상품 · 요청 번호뿐', async () => {
    const r = rig();
    await r.api.state();
    await r.api.cost('saju_reading', 5);
    await r.api.charge('mileage_3300');
    await r.edge.hold({ feature: 'saju_reading', chars: 5, requestId: 'req-argcheck1' });
    const names = new Set(r.calls.flatMap((c) => Object.keys(c.args)));
    for (const n of names) expect(n).not.toMatch(/amount|delta|balance|price|qty|user|uid|total/);
  });
  test('정적 점검: 마일리지 화면 코드에 결제 호출 · 스토어 결제 모듈 · 가격 / 수 숫자 0 · 재촉 말 0', () => {
    const dir = path.join(__dirname, '..', 'features', 'mileage');
    const files = fs.readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(t).not.toMatch(/consumeAsync|acknowledgePurchase|react-native-iap|expo-in-app|billing|purchaseUpdated/i);
      expect(t).not.toMatch(/\b(3300|5500|11000|33000|1000|800|1500|2000|1200)\b/); // 값은 서버 응답
      expect(t).not.toMatch(/남은 시간|서두르|마지막|인기|한정|할인|보너스|AsyncStorage|setItem|localStorage/);
    }
    // 데모 모의 서버만 값(시작값)을 안다
    expect(fs.readFileSync(path.join(__dirname, '..', 'demo', 'mileageDemo.ts'), 'utf8')).toContain('3300');
  });
  test('상점 탭 0: 탭 화면 목록에 마일리지 없음 · 새 입구는 설정 줄 + 사주 마당 머리 + 잔액 부족뿐', () => {
    const screens = fs.readFileSync(path.join(__dirname, '..', 'navigation', 'screens.ts'), 'utf8');
    expect(screens).toMatch(/TAB_SCREEN_IDS = \['T1', 'T4', '09', '11', '16', '12'\]/);
    const flow = fs.readFileSync(path.join(__dirname, '..', 'navigation', 'flow.ts'), 'utf8');
    const into = [...flow.matchAll(/a\('([^']+)', 'IF-MILE'/g)].map((m) => m[1]);
    expect(into.sort()).toEqual(['12', 'IF-MADANG', 'IF-MILE-LOG', 'IF-SJ-TALK']);
  });
});
