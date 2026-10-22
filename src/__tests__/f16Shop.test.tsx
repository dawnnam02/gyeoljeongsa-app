// F16 조건 2 · 3 · 4: 16 상점의 닫힘 · 구독 준비 중 · can_purchase closed / sub_not_ready · 복원 credits_on_account · 레이트 리밋 일반 오류 · 모의 서버(shopDemo)가 같은 키를 같은 모양으로 낸다
//  (09 지역 안내 · 부제는 recsScreen.test.tsx, SELLER_SOON 정식화는 sellerLine.test.tsx · check:copy)
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { COMMON, RECS } from '@/content/copy';
import { SHOP16 } from '@/content/shopCopy';
import { CandidateScreen, type CandidateDeps } from '@/features/recs/CandidateScreen';
import { RecommendationsScreen, type RecsDeps } from '@/features/recs/RecommendationsScreen';
import { PurchaseSheet, resetOpenRequestIds } from '@/features/shop/PurchaseSheet';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { blockedTextOf, shopClosed, subPreparing } from '@/features/shop/shopLogic';
import type { ShopDeps } from '@/features/shop/shopTypes';
import { createDemoBackend, DEMO_OTP_CODE } from '@/lib/demoBackend';
import { createDemoClient } from '@/lib/demoClient';
import { createGradeApi } from '@/lib/gradeApi';
import { createRecsApi } from '@/lib/recsApi';
import { newRequestId } from '@/lib/requestId';
import { createShopApi, parseShop, type ShopState } from '@/lib/shopApi';
import { takeToast } from '@/lib/toastBus';

import { allTexts, has, hasText, mount, must, press, textOf } from './renderHelpers';

jest.setTimeout(90_000);

const mockRouter = { setParams: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});
jest.mock('@/lib/services', () => ({ shopApi: {}, gradeApi: {}, profileApi: { facePhotoUrl: async () => null }, settingsApi: {}, recsApi: {}, likesApi: {}, supabase: {} }));

const START = Date.UTC(2026, 9, 16, 3, 0, 0);
const CLOSED_TEXT = '지금은 구매할 수 없어요.';
const PREP_LINE = '함께하는 분이 더 모이면 열려요';
const PREP_DETAIL = '나보다 위 등급 분을 먼저 추천받는 구독은 함께하는 분이 더 모이면 열려요. 지금은 구매할 수 없어요.';

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of shown.splice(0)) tree.unmount();
  });
});
beforeEach(() => {
  resetOpenRequestIds();
  jest.clearAllMocks();
  takeToast();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
});

let counter = 0;
async function login(scene: string) {
  counter += 1;
  const backend = createDemoBackend({ now: () => START });
  const client = createDemoClient(backend);
  const email = `${scene}${counter}@email.co`;
  await backend.invoke('otp-gate', { body: { action: 'send', email } });
  await backend.invoke('otp-gate', { body: { action: 'verify', email, token: DEMO_OTP_CODE } });
  return { backend, client, email, shop: createShopApi(client) };
}
async function setup(scene = 'plain', over: (deps: ShopDeps) => Partial<ShopDeps> = () => ({})) {
  const { backend, client, email } = await login(scene);
  let n = 0;
  const deps: ShopDeps = {
    api: createShopApi(client),
    grade: createGradeApi(client),
    now: () => START,
    newId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    toastMs: 50,
    slowMs: 30_000,
  };
  Object.assign(deps, over(deps));
  const tree = await mount(<ShopScreen deps={deps} />);
  shown.push(tree);
  await flush();
  return { tree, deps, backend, email };
}
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const tap = async (tree: ReactTestRenderer, id: string) => {
  await press(tree, id);
  await flush();
};
const must_ = <T,>(r: { ok: true; data: T } | { ok: false; reason: string }): T => {
  if (!r.ok) throw new Error(`실패: ${r.reason}`);
  return r.data;
};
// 서버가 상점을 '닫힘'으로 주되 상품은 그대로 보내는 경우(앱이 서버 판정을 그대로 따르는지): 읽기 결과만 바꾼다
const closedWithProducts = (deps: ShopDeps): Partial<ShopDeps> => {
  const real = deps.api;
  return {
    api: {
      ...real,
      loadShop: async () => {
        const r = await real.loadShop();
        return r.ok ? { ok: true as const, data: { ...r.data, paymentMode: 'closed' as const, shopStatus: 'closed' as const } } : r;
      },
    },
  };
};

describe('조건 2 · 응답 읽기(parseShop) · 규칙 함수', () => {
  test('새 키: payment_mode closed · shop_status · sub_gate · products[].not_ready_reason. 모르는 값은 열림 · open · 이유 없음으로 읽는다', () => {
    const base = { stage: 0, subscription: null, credits: {}, match_once: {} };
    const closed = parseShop({ ...base, payment_mode: 'closed', shop_status: 'closed', sub_gate: 'open', products: [] });
    expect(closed).toMatchObject({ paymentMode: 'closed', shopStatus: 'closed', subGate: 'open' });
    expect(closed?.products).toEqual([]);
    expect(parseShop({ ...base, payment_mode: 'closed', products: [] })?.shopStatus).toBe('closed'); // shop_status 가 없어도 결제 닫힘은 닫힘
    expect(parseShop({ ...base, payment_mode: 'live', shop_status: 'closed', products: [] })).toMatchObject({ paymentMode: 'live', shopStatus: 'closed' }); // live 0단계
    expect(parseShop({ ...base, payment_mode: 'demo', shop_status: 'weird', sub_gate: 'weird', products: [] })).toMatchObject({ paymentMode: 'demo', shopStatus: 'open', subGate: 'open' });
    const prep = parseShop({
      ...base,
      payment_mode: 'demo',
      shop_status: 'open',
      sub_gate: 'preparing',
      products: [
        { key: 'grade_sub_1m', catalog_id: 'N01', name: '등급 구독', section: 'grade_sub', sort: 1, kind: 'subscription', price_krw: 14900, purchase_state: 'coming', not_ready_reason: 'sub_members' },
        { key: 'match_once', catalog_id: 'N02', name: '1회 매칭', section: 'match_once', sort: 2, kind: 'consumable', price_krw: 4900, purchase_state: 'available', not_ready_reason: 'secret' },
      ],
    });
    expect(prep?.subGate).toBe('preparing');
    expect(prep?.products.map((p) => [p.key, p.state, p.notReadyReason])).toEqual([['grade_sub_1m', 'coming', 'sub_members'], ['match_once', 'available', null]]);
    expect(JSON.stringify(prep)).not.toMatch(/secret/);
  });

  test('shopClosed · subPreparing: 닫힘이 먼저이고 준비 중은 등급 구독(N01)에만', () => {
    const open = parseShop({ stage: 1, payment_mode: 'demo', shop_status: 'open', sub_gate: 'preparing', products: [{ key: 'grade_sub_1m', catalog_id: 'N01', name: '등급 구독', section: 'grade_sub', sort: 1, kind: 'subscription', purchase_state: 'coming', not_ready_reason: 'sub_members' }, { key: 'match_once', catalog_id: 'N02', name: '1회 매칭', section: 'match_once', sort: 2, kind: 'consumable', purchase_state: 'available' }] }) as ShopState;
    const [n01, n02] = open.products;
    expect(shopClosed(open)).toBe(false);
    expect(subPreparing(n01, open)).toBe(true);
    expect(subPreparing(n02, open)).toBe(false);
    const closed = { ...open, shopStatus: 'closed' as const };
    expect(shopClosed(closed)).toBe(true);
    expect(subPreparing(n01, closed)).toBe(false);
    expect(shopClosed({ ...open, paymentMode: 'closed' })).toBe(true);
  });

  test('can_purchase 이유 closed · sub_not_ready 는 각자 글로, 기존 이유는 그대로', () => {
    expect(blockedTextOf('closed')).toBe('closed');
    expect(blockedTextOf('sub_not_ready')).toBe('sub-not-ready');
    expect(blockedTextOf('age')).toBe('age');
    expect(blockedTextOf('already_subscribed')).toBe('already');
    expect(blockedTextOf('demo_not_allowed')).toBe('sold');
    expect(blockedTextOf('stage')).toBe('sold');
  });

  test('글: 카피 16-O 그대로이고 숫자 · 날짜 · 사람 수 · 재촉 말이 없다', () => {
    expect(SHOP16.closed).toBe(CLOSED_TEXT);
    expect(SHOP16.subPrepLine).toBe(PREP_LINE);
    expect(SHOP16.subPrepDetail).toBe(PREP_DETAIL);
    expect(SHOP16.comingButton).toBe('준비 중이에요');
    for (const t of [SHOP16.closed, SHOP16.subPrepLine, SHOP16.subPrepDetail]) {
      expect(t).not.toMatch(/\d|곧|서둘러|지금 안 하면|2,000|명/);
    }
  });
});

describe('조건 4 · 모의 서버(shopDemo)가 서버와 같은 키를 낸다', () => {
  test('기본(테스트 웹 그대로): payment_mode demo · shop_status open · sub_gate open(문턱 0) · 구독 상품 available · 이유 없음', async () => {
    const { shop, client } = await login('plain');
    const state = must_(await shop.loadShop());
    expect(state).toMatchObject({ paymentMode: 'demo', shopStatus: 'open', subGate: 'open' });
    const sub = state.products.find((p) => p.key === 'grade_sub_1m');
    expect(sub).toMatchObject({ state: 'available', notReadyReason: null });
    expect(state.products).toHaveLength(36); // S17(D-85): G9 · N14 뺌 · S19(D-122): 카드 7개 뺌
    const raw = (await client.rpc('get_shop_state')).data as Record<string, unknown>;
    expect(raw).toMatchObject({ payment_mode: 'demo', shop_status: 'open', sub_gate: 'open' });
    expect(JSON.stringify(raw.products)).not.toContain('not_ready_reason'); // 이유가 없으면 키 자체가 없다
    expect(must_(await shop.canPurchase('grade_sub_1m'))).toEqual({ ok: true, availableToday: null });
    expect(must_(await shop.demoPurchase('grade_sub_1m', newRequestId()))).toEqual({ kind: 'granted' });
  });

  test('shopclosed(결제 닫힘): 상품 목록이 비고 can_purchase · demo_purchase · demo_end_subscription · demo_restore_purchases 가 closed(42501)', async () => {
    const { shop, client } = await login('shopclosed');
    const state = must_(await shop.loadShop());
    expect(state).toMatchObject({ paymentMode: 'closed', shopStatus: 'closed', subGate: 'open', stage: 0 });
    expect(state.products).toEqual([]);
    expect(must_(await shop.canPurchase('grade_sub_1m'))).toEqual({ ok: false, reason: 'closed' });
    expect(must_(await shop.canPurchase('match_once'))).toEqual({ ok: false, reason: 'closed' });
    expect(await shop.demoPurchase('grade_sub_1m', newRequestId())).toEqual({ ok: false, reason: 'closed' });
    expect(await shop.endSubscription('cancel')).toEqual({ ok: false, reason: 'server' });
    expect(await shop.restorePurchases()).toEqual({ ok: false, reason: 'server' });
    const raw = await client.rpc('demo_purchase', { p_product_key: 'grade_sub_1m', p_request_id: newRequestId() });
    expect(raw.error).toEqual({ code: '42501', message: 'closed' });
    expect(must_(await shop.loadShop()).subscription).toBeNull(); // 아무것도 지급되지 않았다
  });

  test('shoplive0(실결제 0단계): 닫힘 + 상품 비움. shoplive(0단계 아님)는 상품이 보이고 열림이며 데모 결제는 demo_not_allowed(기존 그대로)', async () => {
    const zero = await login('shoplive0');
    expect(must_(await zero.shop.loadShop())).toMatchObject({ paymentMode: 'live', shopStatus: 'closed', stage: 0, products: [] });
    const live = await login('shoplive');
    const state = must_(await live.shop.loadShop());
    expect(state).toMatchObject({ paymentMode: 'live', shopStatus: 'open' });
    expect(state.products).toHaveLength(36); // S17(D-85): G9 · N14 뺌 · S19(D-122): 카드 7개 뺌
    expect(must_(await live.shop.canPurchase('grade_sub_1m'))).toEqual({ ok: false, reason: 'demo_not_allowed' });
    expect(await live.shop.demoPurchase('grade_sub_1m', newRequestId())).toEqual({ ok: false, reason: 'demo_not_allowed' });
  });

  test('subprep(구독 문턱 미만): sub_gate preparing · 구독 상품만 coming + sub_members · 3개월은 보류 그대로 · 다른 상품은 그대로 · can_purchase · demo_purchase 는 sub_not_ready', async () => {
    const { shop, client } = await login('subprep');
    const state = must_(await shop.loadShop());
    expect(state).toMatchObject({ paymentMode: 'demo', shopStatus: 'open', subGate: 'preparing' });
    const by = (key: string) => state.products.find((p) => p.key === key);
    expect(by('grade_sub_1m')).toMatchObject({ state: 'coming', notReadyReason: 'sub_members' });
    expect(by('grade_sub_3m')).toMatchObject({ state: 'held', notReadyReason: null });
    expect(by('membership_1m')).toMatchObject({ state: 'coming', notReadyReason: null }); // 원래 준비 중인 구독 상품에는 이유 키가 없다
    expect(by('past_card_1')).toMatchObject({ state: 'available', notReadyReason: null });
    expect(by('match_once')).toMatchObject({ state: 'available', notReadyReason: null });
    expect(must_(await shop.canPurchase('grade_sub_1m'))).toEqual({ ok: false, reason: 'sub_not_ready' });
    expect(must_(await shop.canPurchase('past_card_1'))).toEqual({ ok: true, availableToday: null });
    expect(await shop.demoPurchase('grade_sub_1m', newRequestId())).toEqual({ ok: false, reason: 'sub_not_ready' });
    expect(must_(await shop.loadShop()).subscription).toBeNull();
    expect(must_(await shop.demoPurchase('past_card_1', newRequestId()))).toEqual({ kind: 'granted' }); // 이용권 단품은 영향 없음
    const raw = (await client.rpc('get_shop_state')).data as { products: { key: string; not_ready_reason?: string }[] };
    expect(raw.products.filter((p) => 'not_ready_reason' in p).map((p) => p.key)).toEqual(['grade_sub_1m']);
  });

  test('복원: 구독 거래는 없고 이용권만 있으면 nothing + credits_on_account + credits(양수만) / 아무것도 없으면 no_purchase', async () => {
    const { shop } = await login('plain');
    expect(must_(await shop.restorePurchases())).toEqual({ result: 'nothing', reason: 'no_purchase', credits: null });
    must_(await shop.demoPurchase('letter_1', newRequestId()));
    must_(await shop.demoPurchase('past_card_1', newRequestId()));
    expect(must_(await shop.restorePurchases())).toEqual({ result: 'nothing', reason: 'credits_on_account', credits: { past_card: 1, letter: 1 } });
    const subscriber = await login('plain');
    must_(await subscriber.shop.demoPurchase('grade_sub_1m', newRequestId()));
    must_(await subscriber.shop.demoPurchase('letter_1', newRequestId()));
    expect(must_(await subscriber.shop.restorePurchases())).toMatchObject({ result: 'nothing', reason: 'already_linked' }); // 구독 거래가 있으면 이용권보다 구독 판정이 먼저
  });

  test('복원 응답 읽기: credits 는 아는 이용권 종류의 양의 정수만(모르는 종류 · 0 · 음수 · 글자는 버린다)', async () => {
    const client = { rpc: async () => ({ data: { result: 'nothing_to_restore', reason: 'credits_on_account', credits: { letter: 2, match_slot: 0, report: -1, one_more: 'x', traits: 5, intro: 1 } }, error: null }) } as unknown as SupabaseClient;
    expect(must_(await createShopApi(client).restorePurchases())).toEqual({ result: 'nothing', reason: 'credits_on_account', credits: { letter: 2 } });
    const noCredits = { rpc: async () => ({ data: { result: 'nothing_to_restore', reason: 'credits_on_account' }, error: null }) } as unknown as SupabaseClient;
    expect(must_(await createShopApi(noCredits).restorePurchases())).toEqual({ result: 'nothing', reason: 'credits_on_account', credits: null });
  });
});

describe('조건 2 · 16 상점 화면: 구독 준비 중', () => {
  test('목록: 구독 카드는 이름 + "함께하는 분이 더 모이면 열려요" + 흐린 [준비 중이에요]. 혜택 · 가격 · [자세히] 없음, 3개월은 보류 그대로, 1회 매칭은 그대로', async () => {
    const { tree } = await setup('subprep');
    expect(has(tree, 'screen-16')).toBe(true);
    expect(textOf(tree, 'shop-grade-name')).toBe('등급 구독');
    expect(textOf(tree, 'shop-grade-prep')).toBe(PREP_LINE);
    const soon = must(tree, 'shop-grade-soon');
    expect(soon.props.label).toBe('준비 중이에요');
    expect(soon.props.dimmed).toBe(true);
    for (const id of ['shop-grade-benefits', 'shop-grade-price', 'shop-grade-note', 'shop-grade-detail', 'shop-grade-closed']) expect(has(tree, id)).toBe(false);
    expect(must(tree, 'shop-three-held').props.label).toBe('지금은 준비하지 않아요');
    expect(has(tree, 'shop-match-detail')).toBe(true);
    expect(has(tree, 'shop-closed')).toBe(false);
    expect(has(tree, 'shop-test-band')).toBe(true); // 데모 모드는 그대로 테스트 화면
    expect(allTexts(tree).filter((t) => /\d/.test(t) && /함께하는/.test(t))).toEqual([]); // 숫자 기준을 화면에 쓰지 않는다
  });

  test('[준비 중이에요]를 누르면 상세의 준비 중 안내: 구매 단추 · 가격 · 1개월 선택 · 구매 전 확인 · 판매자 줄 없음, 서버로 구매 요청도 안 간다', async () => {
    const { tree, deps } = await setup('subprep');
    const canPurchase = jest.spyOn(deps.api, 'canPurchase');
    const demoPurchase = jest.spyOn(deps.api, 'demoPurchase');
    await tap(tree, 'shop-grade-soon');
    expect(textOf(tree, 'detail-name')).toBe('등급 구독');
    expect(textOf(tree, 'detail-prep')).toBe(PREP_DETAIL);
    expect(textOf(tree, 'detail-fair')).toBe('결제는 내 등급을 올리지 않아요.');
    for (const id of ['detail-buy', 'detail-soon', 'detail-price', 'detail-options', 'detail-option-1m', 'detail-before', 'detail-seller', 'detail-footer', 'detail-closed']) expect(has(tree, id)).toBe(false);
    expect(canPurchase).not.toHaveBeenCalled();
    expect(demoPurchase).not.toHaveBeenCalled();
  });

  test('바로 여는 주소(page=product&key=grade_sub_1m)도 준비 중 안내, 3개월(보류) 상세는 기존 그대로(준비 중 안내 없음)', async () => {
    mockParams.page = 'product';
    mockParams.key = 'grade_sub_1m';
    const { tree } = await setup('subprep');
    expect(textOf(tree, 'detail-prep')).toBe(PREP_DETAIL);
    expect(has(tree, 'detail-buy')).toBe(false);
    mockParams.key = 'grade_sub_3m';
    const three = await setup('subprep');
    expect(has(three.tree, 'detail-prep')).toBe(false);
    expect(has(three.tree, 'detail-held')).toBe(true);
  });

  test('이미 구독 중인 사람(shopsub-subprep)은 준비 중이 아니라 이용 중 카드 · [등급 구독 관리]', async () => {
    const { tree } = await setup('shopsub-subprep');
    expect(has(tree, 'shop-grade-prep')).toBe(false);
    expect(has(tree, 'shop-grade-soon')).toBe(false);
    expect(has(tree, 'shop-grade-inuse')).toBe(true);
    expect(has(tree, 'shop-grade-manage')).toBe(true);
  });

  test('준비 중에도 다른 상품은 끝까지 산다(지난 추천 열람권)', async () => {
    const { tree, deps } = await setup('subprep');
    await tap(tree, 'shop-row-G1');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-done-text')).toBe('지난 추천 열람권 1장이 들어왔어요.');
    expect(must_(await deps.api.loadShop()).credits.past_card).toBe(1);
  });

  test('구매 시트가 서버 판정 sub_not_ready 를 받으면(상태가 읽은 뒤 바뀐 경우) 준비 중 안내 글로 막는다 · demo_purchase 오류도 같다', async () => {
    const { tree } = await setup('plain', (d) => {
      const real = d.api;
      return { api: { ...real, canPurchase: async () => ({ ok: true as const, data: { ok: false as const, reason: 'sub_not_ready' as const } }) } };
    });
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-blocked-text')).toBe(PREP_DETAIL);

    const second = await setup('plain', (d) => {
      const real = d.api;
      return { api: { ...real, demoPurchase: async () => ({ ok: false as const, reason: 'sub_not_ready' as const }) } };
    });
    await tap(second.tree, 'shop-grade-detail');
    await tap(second.tree, 'detail-option-1m');
    await tap(second.tree, 'detail-buy');
    await tap(second.tree, 'purchase-pay');
    await tap(second.tree, 'purchase-demo-buy');
    expect(textOf(second.tree, 'purchase-blocked-text')).toBe(PREP_DETAIL);
    expect(has(second.tree, 'purchase-done')).toBe(false);
  });
});

describe('조건 2 · 16 상점 화면: 상점 닫힘', () => {
  test('shopclosed: 서버가 상품 목록을 비워 주면 구매 단추 자리 대신 "지금은 구매할 수 없어요." 한 줄 · 테스트 띠 없음 · 무료 구역 · 링크는 그대로', async () => {
    const { tree } = await setup('shopclosed');
    expect(textOf(tree, 'shop-closed-text')).toBe(CLOSED_TEXT);
    for (const id of ['shop-card-grade', 'shop-card-match', 'shop-card-three', 'shop-singles-title', 'shop-test-band']) expect(has(tree, id)).toBe(false);
    expect(has(tree, 'shop-free')).toBe(true);
    expect(has(tree, 'shop-links')).toBe(true);
    expect(allTexts(tree).filter((t) => t === CLOSED_TEXT)).toHaveLength(1);
    expect(allTexts(tree).join(' ')).not.toMatch(/\d{1,3}(,\d{3})*원/); // 가격도 없다
  });

  test('shoplive0(실결제 0단계)도 같은 닫힘 한 줄', async () => {
    const { tree } = await setup('shoplive0');
    expect(textOf(tree, 'shop-closed-text')).toBe(CLOSED_TEXT);
    expect(has(tree, 'shop-test-band')).toBe(false);
  });

  test('닫힘 + 상품이 같이 오면(서버 판정을 그대로 따른다): 카드마다 구매 단추 자리가 같은 한 줄, [자세히] 없음, 상세도 구매 단추 없이 한 줄', async () => {
    const { tree } = await setup('plain', closedWithProducts);
    expect(textOf(tree, 'shop-grade-closed')).toBe(CLOSED_TEXT);
    expect(textOf(tree, 'shop-match-closed')).toBe(CLOSED_TEXT);
    expect(has(tree, 'shop-grade-detail')).toBe(false);
    expect(has(tree, 'shop-match-detail')).toBe(false);
    expect(has(tree, 'shop-closed')).toBe(false); // 카드가 있으면 따로 한 줄을 더하지 않는다
    expect(has(tree, 'shop-test-band')).toBe(false); // 결제가 닫힌 상점은 테스트 화면이 아니다

    mockParams.page = 'product';
    mockParams.key = 'grade_sub_1m';
    const detail = await setup('plain', closedWithProducts);
    expect(textOf(detail.tree, 'detail-closed')).toBe(CLOSED_TEXT);
    for (const id of ['detail-buy', 'detail-options', 'detail-prep']) expect(has(detail.tree, id)).toBe(false);
  });

  test('닫힘 + 사라진 상품 주소로 열면 "지금은 구매할 수 없어요."(열림이면 기존 "지금은 이 상품을 살 수 없어요.")', async () => {
    mockParams.page = 'product';
    mockParams.key = 'grade_sub_1m';
    const closed = await setup('shopclosed');
    expect(textOf(closed.tree, 'shop-product-missing')).toBe(CLOSED_TEXT);
    mockParams.key = 'nope';
    const open = await setup('plain');
    expect(textOf(open.tree, 'shop-product-missing')).toBe(SHOP16.notSellable);
  });

  test('구매 시트가 can_purchase closed 를 받으면(읽은 뒤 서버가 닫힌 경우) 닫힘 글로 막는다', async () => {
    const { tree } = await setup('plain', (d) => {
      const real = d.api;
      return { api: { ...real, canPurchase: async () => ({ ok: true as const, data: { ok: false as const, reason: 'closed' as const } }) } };
    });
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    expect(textOf(tree, 'purchase-blocked-text')).toBe(CLOSED_TEXT);
    expect(has(tree, 'purchase-demo-buy')).toBe(false);
  });

  test('구매 시트(PurchaseSheet)에 닫힌 상점 · 준비 중 구독 상품이 오면 [결제하기]는 서버에 묻지 않고 바로 막는다', async () => {
    const raw = (state: string, extra: Record<string, unknown>) =>
      parseShop({ stage: 1, payment_mode: 'demo', shop_status: state, sub_gate: 'open', credits: {}, match_once: {}, products: [{ key: 'grade_sub_1m', catalog_id: 'N01', name: '등급 구독', section: 'grade_sub', sort: 1, kind: 'subscription', price_krw: 14900, purchase_state: 'available', ...extra }] }) as ShopState;
    const canPurchase = jest.fn(async () => ({ ok: true as const, data: { ok: true as const, availableToday: null } }));
    const deps = { api: { canPurchase, demoPurchase: jest.fn() }, now: () => START, newId: () => 'x', slowMs: 30_000 } as unknown as ShopDeps;
    const open = async (shop: ShopState) => {
      const tree = await mount(<PurchaseSheet visible product={shop.products[0]} shop={shop} deps={deps} onClose={() => undefined} onReload={async () => shop} onManage={() => undefined} onTakeMatch={() => undefined} />);
      shown.push(tree);
      await tap(tree, 'purchase-pay');
      return tree;
    };
    expect(textOf(await open(raw('closed', {})), 'purchase-blocked-text')).toBe(CLOSED_TEXT);
    expect(textOf(await open(raw('open', { purchase_state: 'coming', not_ready_reason: 'sub_members' })), 'purchase-blocked-text')).toBe(PREP_DETAIL);
    expect(canPurchase).not.toHaveBeenCalled();
    expect(has(await open(raw('open', {})), 'purchase-demo-buy')).toBe(true); // 열림 · 문턱 통과는 기존 흐름 그대로
    expect(canPurchase).toHaveBeenCalledTimes(1);
  });

  test('demo_purchase 가 closed 로 거절되면 구매 시트는 닫힘 글, 아무것도 지급되지 않는다', async () => {
    const { tree, deps } = await setup('plain', (d) => {
      const real = d.api;
      return { api: { ...real, demoPurchase: async () => ({ ok: false as const, reason: 'closed' as const }) } };
    });
    await tap(tree, 'shop-grade-detail');
    await tap(tree, 'detail-option-1m');
    await tap(tree, 'detail-buy');
    await tap(tree, 'purchase-pay');
    await tap(tree, 'purchase-demo-buy');
    expect(textOf(tree, 'purchase-blocked-text')).toBe(CLOSED_TEXT);
    expect(must_(await deps.api.loadShop()).subscription).toBeNull();
  });
});

describe('조건 3 · 복원 reason credits_on_account → NV30 · 레이트 리밋은 일반 오류', () => {
  test('16-8 구매 복원: 이용권만 있는 계정은 NV30 글("이용권은 계정에 저장돼 있어 그대로예요")이고 이용권 숫자는 글에 넣지 않는다', async () => {
    const { tree, deps, backend, email } = await setup('plain');
    must_(await deps.api.demoPurchase('letter_1', newRequestId()));
    await tap(tree, 'shop-link-inventory');
    await tap(tree, 'inventory-restore');
    expect(textOf(tree, 'restore-text')).toBe('다시 연결할 구매가 없어요. 이용권은 계정에 저장돼 있어 그대로예요.');
    expect(textOf(tree, 'restore-text')).toBe(SHOP16.restoreNone);
    expect(backend.peek.shop(email)?.credits.letter).toBe(1); // 복원은 이용권을 건드리지 않는다
    expect(backend.peek.shop(email)?.sub).toBeNull();
  });

  test('복원이 서버 closed 로 거절되면 일반 오류 글(잠시 문제가 생겼어요)', async () => {
    const { tree } = await setup('shopclosed');
    await tap(tree, 'shop-link-inventory');
    await tap(tree, 'inventory-restore');
    expect(textOf(tree, 'restore-text')).toBe(SHOP16.restoreFailed);
  });

  const limited = { rpc: async () => ({ data: null, error: { code: '54000', message: 'rate_limited' } }) } as unknown as SupabaseClient;

  test('rate_limited(54000): 추천 목록 · 후보 상세 · 상대 등급 · 등급 열람 요청은 모두 일반 서버 오류로 읽는다(인터넷 문제 · 볼 수 없음으로 읽지 않는다)', async () => {
    const recs = createRecsApi(limited);
    expect(await recs.loadToday()).toEqual({ ok: false, reason: 'server' });
    expect(await recs.loadCandidate('demo-cand-1')).toEqual({ ok: false, reason: 'server' }); // null(볼 수 없음)이 아니다
    const grade = createGradeApi(limited);
    expect(await grade.partnerGrade('demo-cand-1')).toBeNull(); // 배지만 빠진다
    expect(await grade.requestAccess()).toEqual({ ok: false, reason: 'server' });
    expect(await grade.loadMine()).toEqual({ ok: false, reason: 'server' });
  });

  test('rate_limited 일 때 09 는 일반 불러오기 실패 글 + [다시 시도](오프라인 글 아님), 10 은 불러오기 실패', async () => {
    const api = createRecsApi(limited);
    const deps: RecsDeps = { api, now: () => START, tickMs: 5_000, toastMs: 50 };
    const tree = await mount(<RecommendationsScreen deps={deps} />);
    shown.push(tree);
    await flush();
    expect(textOf(tree, 'recs-error')).toBe(RECS.loadFailed);
    expect(hasText(tree, COMMON.offline)).toBe(false);
    expect(has(tree, 'recs-retry')).toBe(true);

    mockParams.id = 'demo-cand-1';
    const candidateDeps = { api: { ...api, pairState: async () => null }, grade: { partnerGrade: async () => null }, toastMs: 50 } as unknown as CandidateDeps;
    const detail = await mount(<CandidateScreen deps={candidateDeps} />);
    shown.push(detail);
    await flush();
    expect(textOf(detail, 'candidate-error')).toBe(COMMON.server); // 인터넷 글(COMMON.offline) · "볼 수 없어요"가 아니라 일반 오류
    expect(has(detail, 'candidate-retry')).toBe(true);
  });
});
