// F13 조건 1 · 2 · 3 · 4 · 5 의 서버 쪽: lib/shopApi · lib/gradeApi(실서버 계약 = backend/스키마.md 11 · 12장)를 lib/shopDemo(같은 모양의 모의 서버) 위에서 돌린다.
//  상품 45개(D-62) · 구독 · 데모 결제 · 1회 매칭(하루 2회 · 못 채움) · 내 등급 13항목 · 무료 열람 요청 · 등급 계산 멈추기 · 09 구독자 순서 · 상대 등급 배지(CK10)
import { RISK_REASONS, PRODUCT_COPY, SHOP_DROPPED } from '@/content/productCopy';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { asGradeNo, createGradeApi, parseHistory, parseMyGrade, parsePartnerGrade } from '@/lib/gradeApi';
import { parseToday } from '@/lib/recsApi';
import { createShopApi, parseShop } from '@/lib/shopApi';
import { newRequestId } from '@/lib/requestId';

jest.setTimeout(90_000);

const START = Date.UTC(2026, 9, 16, 3, 0, 0); // 한국 시각 12:00

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
const today = async (r: Rig) => {
  const { data } = await r.client.rpc('list_today_recommendations');
  return data as { items: Record<string, unknown>[] };
};

describe('응답 읽기: 아는 키만', () => {
  test('상점: 모양이 아니면 null · 모르는 구역 · 상태의 상품은 버리고 모르는 키는 무시', () => {
    expect(parseShop(null)).toBeNull();
    expect(parseShop({ products: 'x' })).toBeNull();
    const parsed = parseShop({
      payment_mode: 'demo',
      stage: 1,
      subscription: null,
      credits: { match_slot: 3, past_card: 'x', secret: 9 },
      match_once: { available_today: 3, uses_today: 0, daily_max: 2, slots_left: 3 },
      products: [
        { key: 'a', catalog_id: 'N01', name: '등급 구독', section: 'grade_sub', sort: 2, kind: 'subscription', price_krw: 14900, purchase_state: 'available', risk_label: true, score: 99 },
        { key: 'b', catalog_id: 'N02', name: 'x', section: 'weird', sort: 1, purchase_state: 'available' },
        { key: 'c', catalog_id: 'N03', name: 'y', section: 'single', sort: 1, purchase_state: 'weird' },
        { key: 'd', catalog_id: 'G1', name: 'z', section: 'single', sort: 1, purchase_state: 'coming' },
      ],
    });
    expect(parsed?.products.map((p) => p.key)).toEqual(['d', 'a']); // sort 순서
    expect(parsed?.credits).toEqual({ match_slot: 3, past_card: 0, letter: 0, report: 0, one_more: 0 });
    expect(JSON.stringify(parsed)).not.toMatch(/score|rank|secret/);
  });

  test('내 등급: 비구독자 locked 만 · 구독자 grade_no 1~9 정수만 · 첫 계산 전 · 멈춤 · 항목 키 13개만', () => {
    expect(parseMyGrade({ locked: true })).toEqual({ kind: 'locked' });
    expect(parseMyGrade({ locked: false, ready: false, reason: 'stopped', first_ready_at: '2026-10-17T00:00:00Z' })).toMatchObject({ kind: 'pending', reason: 'stopped' });
    expect(parseMyGrade({ locked: false, ready: false, reason: 'not_computed' })).toMatchObject({ kind: 'pending', reason: 'not_computed' });
    expect(parseMyGrade({ locked: false, ready: true, grade_no: 0 })).toBeNull();
    expect(parseMyGrade({ locked: false, ready: true, grade_no: 10 })).toBeNull();
    expect(parseMyGrade({ locked: false, ready: true, grade_no: 4.5 })).toBeNull();
    const ready = parseMyGrade({
      locked: false,
      ready: true,
      grade_no: 3,
      band: '28-32',
      band_merged: true,
      shown_at: '2026-10-16T18:00:00Z',
      next_at: '2026-10-17T18:00:00Z',
      areas: { cond: 46.2, verify: 3.5, sincere: 4.8 },
      top: [{ item: 'sch', pts: 15.8 }, { item: 'oldkey', pts: 9 }, { item: 'inc', pts: -1 }, { item: 'job', pts: 11.3 }],
      manner_ok: true,
      actionable: [{ item: 'v_sch', up_to: 2.1 }, { item: 'full', up_to: 1 }],
      verify_on: false,
      raw: 77,
    });
    expect(ready).toMatchObject({ kind: 'ready', gradeNo: 3, bandMerged: true, mannerOk: true, verifyOn: false });
    if (ready?.kind === 'ready') {
      expect(ready.areas).toEqual({ cond: 46.2, verify: 3.5, sincere: 4.8 });
      expect(ready.top.map((p) => p.item)).toEqual(['sch', 'job']); // 옛 키 · 음수는 버린다
      expect(ready.actionable.map((p) => p.item)).toEqual(['v_sch']);
    }
    expect(JSON.stringify(ready)).not.toMatch(/raw|score/);
  });

  test('상대 등급 · 변화 기록 · asGradeNo', () => {
    expect(parsePartnerGrade({ locked: true })).toEqual({ locked: true, gradeNo: null });
    expect(parsePartnerGrade({ user_id: 'u' })).toEqual({ locked: false, gradeNo: null }); // CK10 안 한 상대: 등급 키 없음
    expect(parsePartnerGrade({ user_id: 'u', grade_no: 5, grade_basis: 'age_band' })).toEqual({ locked: false, gradeNo: 5 });
    expect(parsePartnerGrade({ user_id: 'u', grade_no: 'five' })).toEqual({ locked: false, gradeNo: null });
    expect(parseHistory({ locked: true })).toEqual({ kind: 'locked' });
    expect(parseHistory({ locked: false, items: [{ at: '2026-10-14T00:00:00Z', from_no: 5, to_no: 4, reason: 'verification' }, { at: 'x', to_no: 3 }, { at: '2026-10-01T00:00:00Z', to_no: 11 }] })).toMatchObject({ kind: 'items' });
    expect([asGradeNo(1), asGradeNo(9), asGradeNo(0), asGradeNo('3'), asGradeNo(null)]).toEqual([1, 9, null, null, null]);
  });

  test('요청 ID 는 uuid v4 모양이고 매번 다르다', () => {
    const a = newRequestId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newRequestId()).not.toBe(a);
  });
});

describe('조건 1: 16 상점 서버 상태 (get_shop_state)', () => {
  test('상품 36개(D-62: N07 · D-85: G9 · N14 · D-122: X12 · X13 · X15 · X16 · X17 · X18 · N15 뺌): 서버 순서 1~45 중 9칸 빈 채 · 살 수 있는 4 + 보류 1 · 위험 C 20개 = 카피 빨간 라벨 이유 중 남은 19줄 + N16', async () => {
    const r = rig();
    await login(r, 'plain@email.co');
    const shop = must(await r.shop.loadShop());
    expect(shop.paymentMode).toBe('demo');
    expect(shop.stage).toBe(1);
    expect(shop.products).toHaveLength(36);
    expect(shop.products.map((p) => p.sort)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => ![12, 27, 28, 30, 31, 32, 33, 42, 43].includes(n)));
    expect(shop.products.some((p) => ['N04', 'N07', 'G9', 'N14', 'X12', 'X13', 'X15', 'X16', 'X17', 'X18', 'N15'].includes(p.catalogId))).toBe(false);
    expect(shop.products.filter((p) => p.state === 'available').map((p) => p.catalogId)).toEqual(['N01', 'N02', 'G1', 'G2']);
    expect(shop.products.filter((p) => p.state === 'held').map((p) => p.catalogId)).toEqual(['N03']);
    const risky = shop.products.filter((p) => p.riskLabel).map((p) => p.catalogId).sort();
    expect(risky).toEqual([...Object.keys(RISK_REASONS).filter((id) => !SHOP_DROPPED.includes(id)), 'N16'].sort()); // N16 이유 줄은 카피 16-C 가 생긴 뒤 RISK_REASONS 에 더한다
    expect(risky).toHaveLength(20);
    // 카피 상품 표 45개에서 상점에서 뺀 9개(SHOP_DROPPED)를 뺀 것과 카탈로그 ID 가 1:1
    expect(shop.products.map((p) => p.catalogId).sort()).toEqual(PRODUCT_COPY.map((p) => p.id).filter((id) => !SHOP_DROPPED.includes(id)).sort());
    expect(shop.subscription).toBeNull();
    expect(shop.matchOnce).toEqual({ availableToday: 3, usesToday: 0, dailyMax: 2, slotsLeft: 0 });
  });

  test('S17(D-85): 꺼진 G9 · N14 는 구매 판정 · 데모 결제가 product_off(서버 0020 과 같음) · N16 은 준비 중 그대로 + 빨간 라벨', async () => {
    const r = rig();
    await login(r, 'plain-d85@email.co');
    expect(SHOP_DROPPED.slice(0, 2)).toEqual(['G9', 'N14']);
    for (const key of ['polish_text', 'public_intro']) {
      expect(must(await r.shop.canPurchase(key))).toEqual({ ok: false, reason: 'product_off' });
      expect(await r.shop.demoPurchase(key, newRequestId())).toEqual({ ok: false, reason: 'product_off' });
    }
    const n16 = must(await r.shop.loadShop()).products.find((p) => p.catalogId === 'N16');
    expect(n16).toMatchObject({ key: 'profile_deco', state: 'coming', riskLabel: true });
    expect(must(await r.shop.canPurchase('profile_deco'))).toEqual({ ok: false, reason: 'product_not_ready' });
  });

  test('S19(D-122, 질문지 1 ⓐ): 내린 카드 7개(성사 보수 · 사람 개입)는 목록에 없고 구매 판정 · 데모 결제가 product_off(서버 0026 과 같음) · 구매 내역 0', async () => {
    const r = rig();
    await login(r, 'plain-d122@email.co');
    const seven = ['X12', 'X13', 'X15', 'X16', 'X17', 'X18', 'N15'];
    expect(SHOP_DROPPED.filter((id) => seven.includes(id)).sort()).toEqual([...seven].sort());
    const keys = ['success_fee', 'manager', 'per_connection', 'wedding_partner', 'offline_event', 'guarantee', 'grade_coaching'];
    const listed = must(await r.shop.loadShop()).products;
    expect(listed.some((p) => keys.includes(p.key))).toBe(false);
    for (const key of keys) {
      expect(must(await r.shop.canPurchase(key))).toEqual({ ok: false, reason: 'product_off' });
      expect(await r.shop.demoPurchase(key, newRequestId())).toEqual({ ok: false, reason: 'product_off' });
    }
    // 같은 성격이 아닌 이웃 상품은 그대로(X14 광고 배너 · N16 프로필 꾸미기 · N17 다시 섞기 — 준비 중 + 빨간 라벨)
    for (const id of ['X14', 'N16', 'N17']) expect(listed.find((p) => p.catalogId === id)).toMatchObject({ state: 'coming', riskLabel: true });
  });

  test('점수 · 등급 · 순위 키는 응답에 없다', async () => {
    const r = rig();
    await login(r, 'plain@email.co');
    const { data } = await r.client.rpc('get_shop_state');
    expect(JSON.stringify(data)).not.toMatch(/"(score|rank|grade|grade_no|percent)"/);
  });

  test('장면: 읽기 실패(server) · 처음 한 번 인터넷 끊김(network) · 켜진 상품 0개', async () => {
    const r = rig();
    await login(r, 'shopfail1@email.co');
    expect(await r.shop.loadShop()).toEqual({ ok: false, reason: 'server' });
    await login(r, 'shopflaky1@email.co');
    expect(await r.shop.loadShop()).toEqual({ ok: false, reason: 'network' });
    expect(must(await r.shop.loadShop()).products).toHaveLength(36);
    await login(r, 'shopzero1@email.co');
    expect(must(await r.shop.loadShop()).products).toHaveLength(0);
  });

  test('구독 장면: 이용 중 · 갱신 꺼짐 · 결제 문제 · 가격 인상 대기 · 끝남', async () => {
    const r = rig();
    const want: [string, Partial<{ status: string; autoRenew: boolean; active: boolean; priceIncreasePending: boolean }>][] = [
      ['shopsub1', { status: 'active', autoRenew: true, active: true }],
      ['shopoff1', { status: 'active', autoRenew: false, active: true }],
      ['shopgrace1', { status: 'billing_retry', active: true }],
      ['shopprice1', { status: 'active', priceIncreasePending: true, active: true }],
      ['shopend1', { status: 'expired', active: false }],
    ];
    for (const [name, expected] of want) {
      await login(r, `${name}@email.co`);
      expect(must(await r.shop.loadShop()).subscription).toMatchObject(expected);
    }
  });
});

describe('조건 1: 구매 판정과 데모 결제 (can_purchase · demo_purchase)', () => {
  test('판정 이유: 보류 · 준비 중 · 알 수 없는 상품 · 연령 · 이미 이용 중', async () => {
    const r = rig();
    await login(r, 'plain2@email.co');
    const reason = async (key: string) => {
      const res = must(await r.shop.canPurchase(key));
      return res.ok ? 'ok' : res.reason;
    };
    expect(await reason('grade_sub_1m')).toBe('ok');
    expect(await reason('grade_sub_3m')).toBe('product_held');
    expect(await reason('report_1')).toBe('product_not_ready');
    expect(await reason('nope')).toBe('unknown_product');
    await login(r, 'shopage2@email.co');
    expect(await reason('grade_sub_1m')).toBe('age');
    await login(r, 'shopsub2@email.co');
    expect(await reason('grade_sub_1m')).toBe('already_subscribed');
  });

  test('실결제 모드(live)에서는 데모 결제를 거부한다(실결제 연결 없음)', async () => {
    const r = rig();
    await login(r, 'shoplive1@email.co');
    const shop = must(await r.shop.loadShop());
    expect(shop.paymentMode).toBe('live');
    const can = must(await r.shop.canPurchase('grade_sub_1m'));
    expect(can).toEqual({ ok: false, reason: 'demo_not_allowed' });
    expect(await r.shop.demoPurchase('grade_sub_1m', newRequestId())).toEqual({ ok: false, reason: 'demo_not_allowed' });
    expect(must(await r.shop.loadShop()).subscription).toBeNull();
  });

  test('등급 구독 데모 구매 → 구독 중 · 같은 요청 ID 는 한 번만 · 이미 이용 중이면 다시 못 산다', async () => {
    const r = rig();
    await login(r, 'plain3@email.co');
    const id = newRequestId();
    expect(must(await r.shop.demoPurchase('grade_sub_1m', id))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.demoPurchase('grade_sub_1m', id))).toEqual({ kind: 'already' });
    const shop = must(await r.shop.loadShop());
    expect(shop.subscription).toMatchObject({ status: 'active', productKey: 'grade_sub_1m', active: true, autoRenew: true });
    expect((shop.subscription?.periodEnd ?? 0) - START).toBe(30 * 24 * 3_600_000);
    expect(await r.shop.demoPurchase('grade_sub_1m', newRequestId())).toEqual({ ok: false, reason: 'already_subscribed' });
  });

  test('단품 데모 구매 → 이용권이 늘고, 준비 중 상품은 미리보기만(기록 · 지급 0)', async () => {
    const r = rig();
    await login(r, 'plain4@email.co');
    expect(must(await r.shop.demoPurchase('past_card_1', newRequestId()))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.demoPurchase('letter_1', newRequestId()))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.demoPurchase('past_card_1', newRequestId()))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.demoPurchase('boost', newRequestId()))).toEqual({ kind: 'preview' });
    expect(must(await r.shop.demoPurchase('score_view', newRequestId()))).toEqual({ kind: 'preview' });
    const shop = must(await r.shop.loadShop());
    expect(shop.credits).toMatchObject({ past_card: 2, letter: 1, match_slot: 0 });
    expect(await r.shop.demoPurchase('grade_sub_3m', newRequestId())).toEqual({ ok: false, reason: 'product_held' });
  });

  test('결제 실패 장면: 서버 오류 · 인터넷 끊김 → 지급 0', async () => {
    const r = rig();
    await login(r, 'payfail1@email.co');
    expect(await r.shop.demoPurchase('past_card_1', newRequestId())).toEqual({ ok: false, reason: 'server' });
    await login(r, 'payoff1@email.co');
    expect(await r.shop.demoPurchase('past_card_1', newRequestId())).toEqual({ ok: false, reason: 'network' });
    expect(must(await r.shop.loadShop()).credits.past_card).toBe(0);
  });

  test('구독 끝내기(테스트 화면): 자동 갱신 끄기 → 갱신 꺼짐 · 지금 만료 → 끝남 · 환불 → 즉시 잠금', async () => {
    const r = rig();
    await login(r, 'shopsub3@email.co');
    expect(await r.shop.endSubscription('cancel')).toEqual({ ok: true });
    expect(must(await r.shop.loadShop()).subscription).toMatchObject({ autoRenew: false, active: true });
    expect(await r.shop.endSubscription('expire')).toEqual({ ok: true });
    expect(must(await r.shop.loadShop()).subscription).toMatchObject({ status: 'expired', active: false });
    await login(r, 'shopsub4@email.co');
    expect(await r.shop.endSubscription('refund')).toEqual({ ok: true });
    expect(must(await r.shop.loadShop()).subscription).toMatchObject({ status: 'refunded', active: false });
  });
});

describe('조건 4: 1회 매칭 (하루 2회 한도 · 남은 명분 · 못 채움 · 09 추가 3명 구역)', () => {
  test('구매 → 명분 3 → 사용 → 09 에 추가 3명(source match_once) · 명분 0 · 오늘 1회 사용', async () => {
    const r = rig();
    await login(r, 'plain5@email.co');
    expect(must(await r.shop.matchPreview())).toEqual({ availableToday: 3, usesToday: 0, dailyMax: 2, slotsLeft: 0 });
    expect(await r.shop.useMatchOnce(newRequestId())).toEqual({ ok: false, reason: 'no_slot' });
    expect(must(await r.shop.canPurchase('match_once'))).toEqual({ ok: true, availableToday: 3 });
    expect(must(await r.shop.demoPurchase('match_once', newRequestId()))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.loadShop()).credits.match_slot).toBe(3);

    const before = await today(r);
    expect(before.items.map((i) => i.source)).toEqual(['free', 'free', 'free']);
    const use = must(await r.shop.useMatchOnce(newRequestId()));
    expect(use).toMatchObject({ added: 3, slotsLeft: 0, usesToday: 1, replayed: false });
    const after = await today(r);
    expect(after.items.map((i) => i.source)).toEqual(['free', 'free', 'free', 'match_once', 'match_once', 'match_once']);
    expect(after.items.map((i) => i.candidate_id)).toEqual(expect.arrayContaining(['demo-cand-7', 'demo-cand-8', 'demo-cand-9']));
    const card = parseToday(after, START);
    expect(card?.cards).toHaveLength(6);
  });

  test('같은 요청 ID 는 두 번 보내도 한 번만(replayed) · 하루 2번까지 · 세 번째는 match_daily_max', async () => {
    const r = rig();
    await login(r, 'moslot1@email.co'); // 명분 3
    const id = newRequestId();
    expect(must(await r.shop.useMatchOnce(id))).toMatchObject({ added: 3, slotsLeft: 0, usesToday: 1, replayed: false });
    expect(must(await r.shop.useMatchOnce(id))).toMatchObject({ added: 3, usesToday: 1, replayed: true });
    expect(must(await r.shop.demoPurchase('match_once', newRequestId()))).toEqual({ kind: 'granted' });
    expect(must(await r.shop.useMatchOnce(newRequestId()))).toMatchObject({ added: 3, usesToday: 2 });
  });

  test('오늘 2번을 다 쓰면 판정이 match_daily_max, 사용도 거부(차감 0)', async () => {
    const r = rig();
    await login(r, 'moslot2@email.co');
    must(await r.shop.useMatchOnce(newRequestId()));
    must(await r.shop.demoPurchase('match_once', newRequestId()));
    must(await r.shop.useMatchOnce(newRequestId()));
    expect(must(await r.shop.canPurchase('match_once'))).toMatchObject({ ok: false, reason: 'match_daily_max' });
    expect(await r.shop.demoPurchase('match_once', newRequestId())).toEqual({ ok: false, reason: 'match_daily_max' });
    expect(await r.shop.useMatchOnce(newRequestId())).toEqual({ ok: false, reason: 'daily_max' });
    expect(must(await r.shop.loadShop()).credits.match_slot).toBe(0);
  });

  test('못 채움: 오늘 2명뿐이면 2명만 받고 1명분은 남는다 · 오늘 0명이면 거부(차감 0)', async () => {
    const r = rig();
    await login(r, 'mopart1@email.co');
    expect(must(await r.shop.matchPreview()).availableToday).toBe(2);
    must(await r.shop.demoPurchase('match_once', newRequestId()));
    expect(must(await r.shop.useMatchOnce(newRequestId()))).toMatchObject({ added: 2, slotsLeft: 1 });
    expect(must(await r.shop.matchPreview())).toMatchObject({ availableToday: 0, slotsLeft: 1 });
    expect(await r.shop.useMatchOnce(newRequestId())).toEqual({ ok: false, reason: 'unavailable' });
    expect(must(await r.shop.loadShop()).credits.match_slot).toBe(1);
    await login(r, 'monone1@email.co');
    expect(must(await r.shop.canPurchase('match_once'))).toMatchObject({ ok: false, reason: 'match_unavailable' });
    expect(await r.shop.useMatchOnce(newRequestId())).toEqual({ ok: false, reason: 'no_slot' });
  });

  test('1회 매칭 카드에 보내는 호감은 카드당 1번이고 하루 3건 한도 밖이다', async () => {
    const r = rig();
    await login(r, 'moslot3@email.co');
    must(await r.shop.useMatchOnce(newRequestId()));
    for (const id of ['demo-cand-1', 'demo-cand-2', 'demo-cand-3']) expect((await r.client.rpc('send_like', { p_target: id })).error).toBeNull();
    expect((await r.client.rpc('send_like', { p_target: 'demo-cand-1' })).error?.message).toBe('already_sent');
    expect((await r.client.rpc('send_like', { p_target: 'demo-cand-10' })).error?.message).toBe('forbidden'); // 아직 받지 않은 1회 매칭 분: 오늘 추천 밖
    expect((await r.client.rpc('send_like', { p_target: 'demo-cand-7' })).error).toBeNull(); // 3건을 다 써도 추가 카드는 보낼 수 있다
    expect((await r.client.rpc('send_like', { p_target: 'demo-cand-8' })).error).toBeNull();
    const pair = await r.client.rpc('get_pair_state', { p_target: 'demo-cand-9' });
    expect((pair.data as { likes_left: number }).likes_left).toBe(0);
  });
});

describe('조건 2: 내 등급 (get_my_grade 13항목 · 비구독자 locked 만)', () => {
  test('비구독자는 {locked:true} 한 키뿐 — 등급 힌트가 없다', async () => {
    const r = rig();
    await login(r, 'plain6@email.co');
    const { data } = await r.client.rpc('get_my_grade');
    expect(data).toEqual({ locked: true });
    expect(await r.grade.loadMine()).toEqual({ ok: true, data: { kind: 'locked' } });
    expect((await r.client.rpc('list_grade_history')).data).toEqual({ locked: true });
  });

  test('구독자: 9단계 중 4 · 같은 나이대 기준 · 항목 키는 13개 안 · 총 원점수 키 없음', async () => {
    const r = rig();
    await login(r, 'shopsub5@email.co');
    const my = must(await r.grade.loadMine());
    expect(my.kind).toBe('ready');
    if (my.kind !== 'ready') return;
    expect(my.gradeNo).toBe(4);
    expect(my.band).toBe('28-32');
    expect(my.top).toHaveLength(3);
    expect(my.actionable.length).toBeLessThanOrEqual(3);
    expect(my.verifyOn).toBe(false);
    const { data } = await r.client.rpc('get_my_grade');
    expect(Object.keys(data as object).sort()).toEqual(['actionable', 'areas', 'band', 'band_merged', 'basis', 'grade_no', 'locked', 'manner_ok', 'next_at', 'ready', 'shown_at', 'top', 'verify_on']); // 키 12 + 항목 객체(스키마 11-2)
  });

  test('첫 계산 전 · 나이대 합침 · 읽기 실패 · 변화 기록 있음/없음', async () => {
    const r = rig();
    await login(r, 'shopsub6@email.co');
    // 같은 계정으로 등급 계산 멈추기 → reason 'stopped'
    expect(await r.grade.setProcessing(false)).toEqual({ ok: true, processing: false });
    expect(must(await r.grade.loadMine())).toMatchObject({ kind: 'pending', reason: 'stopped' });
    expect(must(await r.grade.loadHistory())).toEqual({ kind: 'items', items: [] });
    expect(await r.grade.setProcessing(true)).toEqual({ ok: true, processing: true });
    expect(must(await r.grade.loadMine())).toMatchObject({ kind: 'ready', gradeNo: 4 });
    const hist = must(await r.grade.loadHistory());
    expect(hist.kind === 'items' && hist.items.filter((i) => i.fromNo !== null)).toHaveLength(3);
    await login(r, 'shopsub7gradenew@email.co');
    expect(must(await r.grade.loadMine())).toMatchObject({ kind: 'pending', reason: 'not_computed' });
    await login(r, 'shopsub8gradeband@email.co');
    expect(must(await r.grade.loadMine())).toMatchObject({ kind: 'ready', bandMerged: true });
    await login(r, 'shopsub9gradefail@email.co');
    expect(await r.grade.loadMine()).toEqual({ ok: false, reason: 'server' });
  });

  test('무료 열람 요청: 모든 회원(비구독자도) · 10일 안 · 두 번째는 같은 요청 합침(merged)', async () => {
    const r = rig();
    await login(r, 'plain7@email.co');
    const first = must(await r.grade.requestAccess());
    expect(first.merged).toBe(false);
    expect((first.dueAt ?? 0) - (first.receivedAt ?? 0)).toBe(10 * 24 * 3_600_000);
    const second = must(await r.grade.requestAccess());
    expect(second).toMatchObject({ merged: true, requestId: first.requestId });
  });

  test('등급 계산 멈추기: 구독자는 stopped, 다시 켜면 계산 · 잘못된 값은 거부', async () => {
    const r = rig();
    await login(r, 'shopsub10@email.co');
    expect((await r.client.rpc('set_grade_processing', { p_on: 'yes' })).error?.message).toBe('invalid_value');
    await r.grade.setProcessing(false);
    expect(r.backend.peek.shop('shopsub10@email.co')?.processing).toBe(false);
    await r.grade.setProcessing(true);
    expect(r.backend.peek.shop('shopsub10@email.co')?.processing).toBe(true);
  });
});

describe('조건 3: 09 구독자 순서 · 상대 등급 배지(CK10 동의 상대만) · 10 상대 등급', () => {
  test('비구독자 09 응답에는 grade 키가 하나도 없다', async () => {
    const r = rig();
    await login(r, 'plain8@email.co');
    const list = await today(r);
    expect(list.items).toHaveLength(3);
    expect(JSON.stringify(list)).not.toMatch(/grade/);
    const { data } = await r.client.rpc('get_candidate_profile', { p_target: 'demo-cand-1' });
    expect(JSON.stringify(data)).not.toMatch(/grade/);
    expect((await r.client.rpc('get_partner_grade', { p_partner: 'demo-cand-1' })).data).toEqual({ locked: true });
    const parsed = parseToday(list, START);
    expect(parsed?.cards.every((c) => c.gradeNo === null)).toBe(true);
  });

  test('구독자 09: 나보다 위 등급 분이 앞(2등급 · 3등급 → 6등급) · 배지는 CK10 동의한 분만(3등급 분은 없음)', async () => {
    const r = rig();
    await login(r, 'shopsub11@email.co'); // 내 등급 4 → 위 = 3 이하
    const list = await today(r);
    expect(list.items.map((i) => i.candidate_id)).toEqual(['demo-cand-1', 'demo-cand-3', 'demo-cand-2']);
    // D-197(CK10 폐지 · 청사진 6-2): 상대 등급 번호는 누구에게도 주지 않는다 — 키 자체가 없다(순서는 서버 그대로)
    expect(list.items.some((i) => 'grade_no' in i)).toBe(false);
    const parsed = parseToday(list, START);
    expect(parsed?.cards.map((c) => c.gradeNo)).toEqual([null, null, null]);
  });

  test('계산을 멈춘 구독자는 비구독자와 같은 순서(상향 정렬 없음)', async () => {
    const r = rig();
    await login(r, 'shopsub12@email.co');
    await r.grade.setProcessing(false);
    const list = await today(r);
    expect(list.items.map((i) => i.candidate_id)).toEqual(['demo-cand-1', 'demo-cand-2', 'demo-cand-3']);
  });

  test('10 상세: 구독자 + 동의한 상대만 grade_no · 동의 안 한 상대는 user_id 만 · 오늘 추천 밖은 not_available', async () => {
    const r = rig();
    await login(r, 'shopsub13@email.co');
    expect(must({ ok: true as const, data: await r.grade.partnerGrade('demo-cand-1') })).toEqual({ locked: false, gradeNo: null }); // D-197: 번호 없음
    expect(await r.grade.partnerGrade('demo-cand-3')).toEqual({ locked: false, gradeNo: null });
    expect(await r.grade.partnerGrade('demo-cand-9')).toBeNull(); // 아직 받지 않은 1회 매칭 분: 범위 밖
    const detail = await r.client.rpc('get_candidate_profile', { p_target: 'demo-cand-1' });
    expect('grade_no' in (detail.data as object)).toBe(false); // D-197: 상세에도 없음
    const noGrade = await r.client.rpc('get_candidate_profile', { p_target: 'demo-cand-3' });
    expect('grade_no' in (noGrade.data as object)).toBe(false);
  });

  test('D-197: 구매해 구독자가 되어도 09 에 상대 등급 배지가 생기지 않는다', async () => {
    const r = rig();
    await login(r, 'plain9@email.co');
    expect((await today(r)).items.some((i) => 'grade_no' in i)).toBe(false);
    must(await r.shop.demoPurchase('grade_sub_1m', newRequestId()));
    expect((await today(r)).items.filter((i) => 'grade_no' in i)).toHaveLength(0);
  });
});
