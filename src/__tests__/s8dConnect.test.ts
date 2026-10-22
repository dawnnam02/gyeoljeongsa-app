// F14 조건 3 · S8d 서버 기능 연결: get_my_grade.areas · get_grade_processing · list_my_purchases · demo_restore_purchases · 상품 이름(서버 = 카피)
//  lib/shopApi · lib/gradeApi 를 lib/shopDemo(S8d 와 같은 모양의 모의 서버) 위에서 돌린다. 실서버 · 유료 없음.
import { PRODUCT_COPY } from '@/content/productCopy';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createGradeApi, parseMyGrade } from '@/lib/gradeApi';
import { newRequestId } from '@/lib/requestId';
import { createShopApi, parsePurchases } from '@/lib/shopApi';

jest.setTimeout(90_000);

const START = Date.UTC(2026, 9, 16, 3, 0, 0);

type Rig = ReturnType<typeof rig>;
function rig() {
  const clock = { now: START };
  const backend = createDemoBackend({ now: () => clock.now });
  const client = createDemoClient(backend);
  return { clock, backend, client, shop: createShopApi(client), grade: createGradeApi(client) };
}
async function login(r: Rig, email: string) {
  await r.backend.invoke('otp-gate', { body: { action: 'send', email } });
  await r.backend.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
}
const must = <T,>(r: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(`실패: ${r.reason}`);
  return r.data;
};

describe('S8d get_my_grade.areas', () => {
  test('세 영역 숫자 그대로(앱이 더하지 않는다) · 없거나 모양이 틀리면 null', async () => {
    const r = rig();
    await login(r, 'shopsub-areas@email.co');
    const my = must(await r.grade.loadMine());
    expect(my.kind === 'ready' && my.areas).toEqual({ cond: 46.2, verify: 3.5, sincere: 4.8 });
    const base = { locked: false, ready: true, grade_no: 4, top: [], actionable: [] };
    expect(parseMyGrade({ ...base, areas: { cond: 1, verify: 2 } })).toMatchObject({ kind: 'ready', areas: null });
    expect(parseMyGrade({ ...base, areas: { cond: 1, verify: -2, sincere: 3 } })).toMatchObject({ areas: null });
    expect(parseMyGrade(base)).toMatchObject({ areas: null });
    expect(parseMyGrade({ locked: true })).toEqual({ kind: 'locked' }); // 비구독자 응답에는 areas 가 없다
  });
});

describe('S8d get_grade_processing', () => {
  test('비구독자도 읽는다 · 멈추면 stopped_at · 다시 켜면 null', async () => {
    const r = rig();
    await login(r, 'plain-proc@email.co');
    expect(must(await r.grade.loadMine()).kind).toBe('locked');
    expect(must(await r.grade.loadProcessing())).toEqual({ processing: true, stoppedAt: null });
    await r.grade.setProcessing(false);
    const stopped = must(await r.grade.loadProcessing());
    expect(stopped.processing).toBe(false);
    expect(stopped.stoppedAt).toBe(START);
    expect(must(await r.grade.loadMine()).kind).toBe('locked'); // 비구독자 등급 화면은 잠금 그대로, 멈춤 상태는 이 함수로만 안다
    await r.grade.setProcessing(true);
    expect(must(await r.grade.loadProcessing())).toEqual({ processing: true, stoppedAt: null });
  });

  test('읽기 실패는 reason 으로 돌려준다', async () => {
    const r = rig();
    await login(r, 'procfail@email.co');
    expect(await r.grade.loadProcessing()).toEqual({ ok: false, reason: 'server' });
  });
});

describe('S8d list_my_purchases', () => {
  test('최근 순 · 환불 상태 · 이름은 서버 = 카피', async () => {
    const r = rig();
    await login(r, 'plain-buy@email.co');
    expect(must(await r.shop.loadPurchases())).toEqual([]);
    must(await r.shop.demoPurchase('past_card_1', newRequestId()));
    r.clock.now += 1000;
    must(await r.shop.demoPurchase('grade_sub_1m', newRequestId()));
    let items = must(await r.shop.loadPurchases());
    expect(items.map((i) => i.productKey)).toEqual(['grade_sub_1m', 'past_card_1']);
    expect(items[0]).toMatchObject({ catalogId: 'N01', name: '등급 구독', priceKrw: 14900, quantity: 1, status: 'done' });
    for (const it of items) expect(it.name).toBe(PRODUCT_COPY.find((c) => c.id === it.catalogId)?.name);
    expect(await r.shop.endSubscription('refund')).toEqual({ ok: true });
    items = must(await r.shop.loadPurchases());
    expect(items[0]).toMatchObject({ status: 'refunded' });
    expect(items[0].refundedAt).not.toBeNull();
  });

  test('모르는 status · 이름 없는 줄은 버리고 모양이 아니면 null · 읽기 실패', async () => {
    expect(parsePurchases({ items: [{ tx_id: 'a', name: 'n', status: 'weird' }, { tx_id: 'b', name: 'n', status: 'pending', price_krw: 1500 }, { tx_id: 'c', status: 'done' }] })?.map((i) => i.txId)).toEqual(['b']);
    expect(parsePurchases(null)).toBeNull();
    const r = rig();
    await login(r, 'purfail@email.co');
    expect(await r.shop.loadPurchases()).toEqual({ ok: false, reason: 'server' });
  });
});

describe('S8d demo_restore_purchases', () => {
  test('연결이 사라진 최근 구독만 restored · 나머지는 nothing + 이유 · 실결제 모드는 막힘', async () => {
    const none = rig();
    await login(none, 'plain-r1@email.co');
    expect(must(await none.shop.restorePurchases())).toEqual({ result: 'nothing', reason: 'no_purchase', credits: null });
    const linked = rig();
    await login(linked, 'plain-r2@email.co');
    must(await linked.shop.demoPurchase('grade_sub_1m', newRequestId()));
    expect(must(await linked.shop.restorePurchases())).toEqual({ result: 'nothing', reason: 'already_linked', credits: null });
    const lost = rig();
    await login(lost, 'shoprestore-r3@email.co');
    expect(must(await lost.shop.loadShop()).subscription).toBeNull();
    expect(must(await lost.shop.restorePurchases())).toEqual({ result: 'restored', reason: null, credits: null });
    expect(must(await lost.shop.loadShop()).subscription?.active).toBe(true);
    const refunded = rig();
    await login(refunded, 'plain-r4@email.co');
    must(await refunded.shop.demoPurchase('grade_sub_1m', newRequestId()));
    expect(await refunded.shop.endSubscription('refund')).toEqual({ ok: true });
    expect(must(await refunded.shop.restorePurchases())).toEqual({ result: 'nothing', reason: 'refunded', credits: null });
    const live = rig();
    await login(live, 'shoplive-r5@email.co');
    expect(await live.shop.restorePurchases()).toEqual({ ok: false, reason: 'server' }); // demo_not_allowed
    const bad = rig();
    await login(bad, 'restfail@email.co');
    expect(await bad.shop.restorePurchases()).toEqual({ ok: false, reason: 'server' });
  });
});

describe('S8d get_shop_state.products', () => {
  test('36개 · N07(D-62) · G9 · N14(D-85) · X12 · X13 · X15 · X16 · X17 · X18 · N15(D-122) 없음 · 모든 이름이 카피 16-B 이름', async () => {
    const r = rig();
    await login(r, 'plain-prod@email.co');
    const shop = must(await r.shop.loadShop());
    expect(shop.products).toHaveLength(36);
    expect(shop.products.some((p) => ['N07', 'G9', 'N14', 'X12', 'X13', 'X15', 'X16', 'X17', 'X18', 'N15'].includes(p.catalogId))).toBe(false);
    for (const p of shop.products) expect(p.name).toBe(PRODUCT_COPY.find((c) => c.id === p.catalogId)?.name);
  });
});
