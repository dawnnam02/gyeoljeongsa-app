// 16 상점이 서버와 주고받는 일(F13). 원본: backend/스키마.md 11장(S8) 11-2 앱 호출 계약 · 11-8 앱 반영 필요.
//  · get_shop_state → { payment_mode(demo · live · closed), shop_status(closed · open), sub_gate(open · preparing), stage, subscription{…}|null, credits{…}, match_once{…}, products[46]{ key, catalog_id, name, section, sort, kind, price_krw, purchase_state, not_ready_reason?, redirect_to, risk_label, risk_note } }
//    (Q3c) closed 이거나 live 인데 stage 0 이면 shop_status 'closed' 이고 products 는 빈 배열이다. sub_gate 'preparing' 이면 구독 상품(grade_sub_1m)은 purchase_state 'coming' + not_ready_reason 'sub_members'
//  · can_purchase(p_product_key, p_platform) → { ok, reason, purchase_token, available_today? }   · demo_purchase(p_product_key, p_request_id) → { result: granted | already_granted | preview, … }
//  · get_match_once_preview → { available_today, uses_today, daily_max, slots_left }   · use_match_once(p_request_id) → { added, slots_left, uses_today, day, replayed }
//  · demo_end_subscription(p_how) → { status, auto_renew, period_end, active }   (테스트 화면 전용)
//  · 앱은 서버가 준 판정만 그린다(R5): 구매 가능 여부 · 지급 · 남은 수를 앱이 계산하지 않는다. 아는 키만 읽는다 — 모르는 키는 버린다.
//  · 결제는 데모 결제(payment_mode = demo)만이다. live 이면 앱은 구매를 시작하지 않는다(실결제 연결 금지).
//  · 로그에는 이벤트 이름과 코드만(상품 키 · 금액 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from './log';
import { readDbFailure } from './serverError';

export type ShopFailure = 'network' | 'server';
export type PurchaseState = 'available' | 'held' | 'coming' | 'benefit' | 'free';
export type ProductSection = 'grade_sub' | 'match_once' | 'single' | 'free';
export type SubscriptionStatus = 'active' | 'grace' | 'billing_retry' | 'expired' | 'refunded' | 'revoked';
export type CreditKind = 'match_slot' | 'past_card' | 'letter' | 'report' | 'one_more';
export const CREDIT_KINDS: readonly CreditKind[] = ['match_slot', 'past_card', 'letter', 'report', 'one_more'];

export type ShopProduct = {
  key: string;
  catalogId: string;
  name: string; // 서버의 이름(옛 이름일 수 있다). 화면은 카피 글(content/productCopy.ts)을 먼저 쓴다
  section: ProductSection;
  sort: number;
  kind: string;
  priceKrw: number | null;
  state: PurchaseState;
  notReadyReason: 'sub_members' | null; // Q3c: 구독 판매 문턱(활성 회원 수) 미만이라 준비 중인 구독 상품에만. 숫자는 오지 않는다
  redirectTo: string | null;
  riskLabel: boolean;
  riskNote: string | null;
};
export type ShopSubscription = {
  status: SubscriptionStatus;
  productKey: string;
  periodEnd: number | null; // ms
  autoRenew: boolean;
  active: boolean;
  priceIncreasePending: boolean;
};
export type MatchOnceStatus = { availableToday: number; usesToday: number; dailyMax: number; slotsLeft: number };
export type ShopState = {
  paymentMode: 'demo' | 'live' | 'closed'; // closed: 결제를 열지 않은 상태(Q3c 기본값). 상품 목록은 비어 있다
  shopStatus: 'open' | 'closed'; // 서버가 정한 상점 열림 · 닫힘(closed 이면 '지금은 구매할 수 없어요' 16-O)
  subGate: 'open' | 'preparing'; // 구독 판매 문턱(D-66 ③). preparing 이면 구독 카드 · 상세는 준비 중
  stage: number;
  subscription: ShopSubscription | null;
  credits: Readonly<Record<CreditKind, number>>;
  matchOnce: MatchOnceStatus;
  products: ShopProduct[];
};

// can_purchase / demo_purchase 가 돌려주는 이유 코드(스키마 11-2)
export type PurchaseReason =
  | 'state'
  | 'age'
  | 'unknown_product'
  | 'product_off'
  | 'stage'
  | 'product_held'
  | 'product_not_ready'
  | 'already_subscribed'
  | 'match_daily_max'
  | 'match_unavailable'
  | 'invalid_platform'
  | 'demo_mode'
  | 'demo_not_allowed'
  | 'closed' // Q3c: 상점 닫힘(payment_mode closed). 어느 플랫폼이든
  | 'sub_not_ready' // Q3c: 구독 판매 문턱 미만
  | 'other';
const PURCHASE_REASONS: readonly string[] = [
  'state', 'age', 'unknown_product', 'product_off', 'stage', 'product_held', 'product_not_ready', 'already_subscribed', 'match_daily_max', 'match_unavailable', 'invalid_platform', 'demo_mode', 'demo_not_allowed', 'closed', 'sub_not_ready',
];
const asReason = (code: string): PurchaseReason => (PURCHASE_REASONS.includes(code) ? (code as PurchaseReason) : 'other');

export type CanPurchase = { ok: true; availableToday: number | null } | { ok: false; reason: PurchaseReason };
export type DemoPurchaseResult = { kind: 'granted' | 'already' | 'preview' };
export type MatchOnceUse = { added: number; slotsLeft: number; usesToday: number; replayed: boolean };
export type UseMatchFailure = 'network' | 'server' | 'daily_max' | 'no_slot' | 'unavailable';
export type PurchaseStatus = 'done' | 'refunded' | 'pending' | 'rejected';
export type PurchaseItem = { txId: string; productKey: string; catalogId: string; name: string; priceKrw: number; quantity: number; status: PurchaseStatus; purchasedAt: number | null; refundedAt: number | null };
// 구매 복원 결과. nothing 의 reason: no_purchase · refunded · period_ended · already_linked · credits_on_account(Q3c: 구독 거래는 없고 이용권 잔액만 있음 → credits 에 {종류: 잔액}). 모두 NV30 글
export type RestoreResult = { result: 'restored' | 'nothing'; reason: string | null; credits: Readonly<Partial<Record<CreditKind, number>>> | null };
export type SubscriptionEnd = 'cancel' | 'expire' | 'refund';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : fallback);
const messageCode = (error: { message?: string | null }) => String(error.message ?? '').split(':')[0].trim();
const SECTIONS: readonly string[] = ['grade_sub', 'match_once', 'single', 'free'];
const STATES: readonly string[] = ['available', 'held', 'coming', 'benefit', 'free'];
const STATUSES: readonly string[] = ['active', 'grace', 'billing_retry', 'expired', 'refunded', 'revoked'];

export function parseShop(raw: unknown): ShopState | null {
  if (!isRecord(raw) || !Array.isArray(raw.products)) return null;
  const products: ShopProduct[] = [];
  for (const row of raw.products) {
    if (!isRecord(row) || typeof row.key !== 'string' || typeof row.catalog_id !== 'string') continue;
    if (typeof row.section !== 'string' || !SECTIONS.includes(row.section) || typeof row.purchase_state !== 'string' || !STATES.includes(row.purchase_state)) continue;
    products.push({
      key: row.key,
      catalogId: row.catalog_id,
      name: typeof row.name === 'string' ? row.name : '',
      section: row.section as ProductSection,
      sort: int(row.sort),
      kind: typeof row.kind === 'string' ? row.kind : '',
      priceKrw: typeof row.price_krw === 'number' ? row.price_krw : null,
      state: row.purchase_state as PurchaseState,
      notReadyReason: row.not_ready_reason === 'sub_members' ? 'sub_members' : null,
      redirectTo: typeof row.redirect_to === 'string' ? row.redirect_to : null,
      riskLabel: row.risk_label === true,
      riskNote: typeof row.risk_note === 'string' ? row.risk_note : null,
    });
  }
  let subscription: ShopSubscription | null = null;
  if (isRecord(raw.subscription)) {
    const s = raw.subscription;
    const end = typeof s.period_end === 'string' ? Date.parse(s.period_end) : NaN;
    subscription = {
      status: typeof s.status === 'string' && STATUSES.includes(s.status) ? (s.status as SubscriptionStatus) : 'expired',
      productKey: typeof s.product_key === 'string' ? s.product_key : '',
      periodEnd: Number.isNaN(end) ? null : end,
      autoRenew: s.auto_renew === true,
      active: s.active === true,
      priceIncreasePending: s.price_increase_pending === true,
    };
  }
  const creditsRaw = isRecord(raw.credits) ? raw.credits : {};
  const credits = Object.fromEntries(CREDIT_KINDS.map((k) => [k, int(creditsRaw[k])])) as Record<CreditKind, number>;
  const mo = isRecord(raw.match_once) ? raw.match_once : {};
  return {
    paymentMode: raw.payment_mode === 'live' ? 'live' : raw.payment_mode === 'closed' ? 'closed' : 'demo',
    shopStatus: raw.shop_status === 'closed' || raw.payment_mode === 'closed' ? 'closed' : 'open', // 서버가 shop_status 를 안 줘도 payment_mode closed 는 닫힘
    subGate: raw.sub_gate === 'preparing' ? 'preparing' : 'open',
    stage: int(raw.stage),
    subscription,
    credits,
    matchOnce: { availableToday: int(mo.available_today), usesToday: int(mo.uses_today), dailyMax: int(mo.daily_max, 2), slotsLeft: int(mo.slots_left) },
    products: products.sort((a, b) => a.sort - b.sort),
  };
}

const PURCHASE_STATUSES: readonly string[] = ['done', 'refunded', 'pending', 'rejected'];
const tms = (v: unknown): number | null => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : t;
};

// S8d list_my_purchases → items[]. 모르는 status 나 이름 없는 줄은 버린다
export function parsePurchases(raw: unknown): PurchaseItem[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  const out: PurchaseItem[] = [];
  for (const row of raw.items) {
    if (!isRecord(row) || typeof row.tx_id !== 'string' || typeof row.name !== 'string' || typeof row.status !== 'string' || !PURCHASE_STATUSES.includes(row.status)) continue;
    out.push({
      txId: row.tx_id,
      productKey: typeof row.product_key === 'string' ? row.product_key : '',
      catalogId: typeof row.catalog_id === 'string' ? row.catalog_id : '',
      name: row.name,
      priceKrw: typeof row.price_krw === 'number' ? row.price_krw : 0,
      quantity: typeof row.quantity === 'number' ? row.quantity : 1,
      status: row.status as PurchaseStatus,
      purchasedAt: tms(row.purchased_at),
      refundedAt: tms(row.refunded_at),
    });
  }
  return out;
}

export function createShopApi(client: SupabaseClient) {
  const fail = (error: { code?: string | null; message?: string | null }, event: string): ShopFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    return f.network ? 'network' : 'server';
  };

  return {
    async loadShop(): Promise<{ ok: true; data: ShopState } | { ok: false; reason: ShopFailure }> {
      const { data, error } = await client.rpc('get_shop_state');
      if (error) return { ok: false, reason: fail(error, 'shop.load.fail') };
      const parsed = parseShop(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    // 구매 가능 판정(서버). 앱은 이 답이 ok 일 때만 결제 단계로 간다
    async canPurchase(productKey: string): Promise<{ ok: true; data: CanPurchase } | { ok: false; reason: ShopFailure }> {
      const { data, error } = await client.rpc('can_purchase', { p_product_key: productKey, p_platform: 'demo' });
      if (error) return { ok: false, reason: fail(error, 'shop.can.fail') };
      if (!isRecord(data)) return { ok: false, reason: 'server' };
      if (data.ok === true) return { ok: true, data: { ok: true, availableToday: typeof data.available_today === 'number' ? data.available_today : null } };
      return { ok: true, data: { ok: false, reason: asReason(typeof data.reason === 'string' ? data.reason : '') } };
    },

    // 데모 결제(테스트 화면). 돈은 나가지 않는다. 같은 요청 ID 는 서버가 한 번만 지급한다
    async demoPurchase(productKey: string, requestId: string): Promise<{ ok: true; data: DemoPurchaseResult } | { ok: false; reason: ShopFailure | PurchaseReason }> {
      const { data, error } = await client.rpc('demo_purchase', { p_product_key: productKey, p_request_id: requestId });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'shop.buy.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        if (f.network) return { ok: false, reason: 'network' };
        const code = messageCode(error);
        if (PURCHASE_REASONS.includes(code)) return { ok: false, reason: code as PurchaseReason };
        return { ok: false, reason: 'server' };
      }
      if (!isRecord(data)) return { ok: false, reason: 'server' };
      if (data.result === 'granted') return { ok: true, data: { kind: 'granted' } };
      if (data.result === 'already_granted') return { ok: true, data: { kind: 'already' } };
      if (data.result === 'preview') return { ok: true, data: { kind: 'preview' } };
      return { ok: false, reason: 'server' };
    },

    async matchPreview(): Promise<{ ok: true; data: MatchOnceStatus } | { ok: false; reason: ShopFailure }> {
      const { data, error } = await client.rpc('get_match_once_preview');
      if (error) return { ok: false, reason: fail(error, 'shop.match.preview.fail') };
      if (!isRecord(data)) return { ok: false, reason: 'server' };
      return { ok: true, data: { availableToday: int(data.available_today), usesToday: int(data.uses_today), dailyMax: int(data.daily_max, 2), slotsLeft: int(data.slots_left) } };
    },

    // 1회 매칭 쓰기: 같은 요청 ID 로 두 번 보내도 서버가 한 번만 처리한다(replayed)
    async useMatchOnce(requestId: string): Promise<{ ok: true; data: MatchOnceUse } | { ok: false; reason: UseMatchFailure }> {
      const { data, error } = await client.rpc('use_match_once', { p_request_id: requestId });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'shop.match.use.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        if (f.network) return { ok: false, reason: 'network' };
        const code = messageCode(error);
        if (code === 'match_daily_max') return { ok: false, reason: 'daily_max' };
        if (code === 'no_slot') return { ok: false, reason: 'no_slot' };
        if (code === 'match_unavailable') return { ok: false, reason: 'unavailable' };
        return { ok: false, reason: 'server' };
      }
      if (!isRecord(data)) return { ok: false, reason: 'server' };
      return { ok: true, data: { added: int(data.added), slotsLeft: int(data.slots_left), usesToday: int(data.uses_today), replayed: data.replayed === true } };
    },

    // S8d 16-8 구매 내역(최근 순)
    async loadPurchases(): Promise<{ ok: true; data: PurchaseItem[] } | { ok: false; reason: ShopFailure }> {
      const { data, error } = await client.rpc('list_my_purchases');
      if (error) return { ok: false, reason: fail(error, 'shop.purchases.fail') };
      const parsed = parsePurchases(data);
      return parsed ? { ok: true, data: parsed } : { ok: false, reason: 'server' };
    },

    // S8d 16-9 구매 복원(데모 결제 전용). restored → NV29, nothing_to_restore → NV30
    async restorePurchases(): Promise<{ ok: true; data: RestoreResult } | { ok: false; reason: ShopFailure }> {
      const { data, error } = await client.rpc('demo_restore_purchases');
      if (error) return { ok: false, reason: fail(error, 'shop.restore.fail') };
      if (!isRecord(data)) return { ok: false, reason: 'server' };
      if (data.result === 'restored') return { ok: true, data: { result: 'restored', reason: null, credits: null } };
      if (data.result === 'nothing_to_restore') {
        // Q3c: 이용권만 있는 계정은 reason 'credits_on_account' + credits{종류: 잔액}. 아는 종류의 양의 정수만 읽는다
        const given = isRecord(data.credits) ? data.credits : null;
        const credits = given ? Object.fromEntries(CREDIT_KINDS.filter((k) => int(given[k]) > 0).map((k) => [k, int(given[k])])) : null;
        return { ok: true, data: { result: 'nothing', reason: typeof data.reason === 'string' ? data.reason : null, credits } };
      }
      return { ok: false, reason: 'server' };
    },

    // 테스트 화면 전용: 구독 끝내기(자동 갱신 끄기 · 지금 만료 · 환불)
    async endSubscription(how: SubscriptionEnd): Promise<{ ok: true } | { ok: false; reason: ShopFailure }> {
      const { error } = await client.rpc('demo_end_subscription', { p_how: how });
      return error ? { ok: false, reason: fail(error, 'shop.sub.end.fail') } : { ok: true };
    },
  };
}

export type ShopApi = ReturnType<typeof createShopApi>;
