// 16 상점의 규칙(순수 함수). 원본: 수익/상점_화면.md 3 · 7 · 8장 · 마케팅/카피.md 16-B ~ 16-D.
//  · 앱은 서버가 준 판정만 그린다(R5): 어느 상품이 보이는지 · 살 수 있는지 · 몇 개 남았는지는 서버 값이다. 여기는 그 값을 어떤 모양으로 보일지만 정한다
//  · 상품 이름 · 한 줄 · 가격은 카피 글(content/productCopy.ts)을 먼저 쓴다. 서버 이름은 카피에 없는 상품의 대비책이다
import { PRODUCT_COPY, RISK_REASONS, type ProductCopy } from '@/content/productCopy';
import type { PurchaseReason, ShopProduct, ShopState } from '@/lib/shopApi';
import type { IconName } from '@/components/iconPaths';
import { SHOP_ICONS } from '@/theme/uiAssets';

const KST_MS = 9 * 3_600_000;

// 4 · 12 같은 날짜 표기 "11월 16일"(한국 날짜)
export function formatDay(ms: number): string {
  const d = new Date(ms + KST_MS);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

export function copyOf(catalogId: string): ProductCopy | null {
  return PRODUCT_COPY.find((p) => p.id === catalogId) ?? null;
}
export const nameOf = (product: ShopProduct): string => copyOf(product.catalogId)?.name ?? product.name;
export const lineOf = (product: ShopProduct): string => copyOf(product.catalogId)?.line ?? '';
export const riskReasonOf = (product: ShopProduct): string | null => (product.riskLabel ? (RISK_REASONS[product.catalogId] ?? null) : null);

// 서버 가격(원) → "4,900원"
export function wonText(n: number): string {
  return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

// 가격 글(Q5A-05): 실제 금액은 서버 price_krw 가 이긴다. 카피 글의 "14,900원" 자리만 서버 금액으로 바꾸고 "월 " · " · 3명" 같은 말은 그대로 둔다.
// 카피에 금액이 없는 글("무료" · "구독에 포함" · "제휴 수수료")이나 서버 금액이 없거나 0이면 카피 글 그대로. 카피 자체가 없으면 서버 금액만.
export function priceOf(product: ShopProduct): string {
  const copy = copyOf(product.catalogId)?.price ?? '';
  const krw = product.priceKrw;
  if (krw == null || !(krw > 0)) return copy;
  if (copy === '') return wonText(krw);
  return /\d[\d,]*원/.test(copy) ? copy.replace(/\d[\d,]*원/, wonText(krw)) : copy;
}

// 이/가 붙이기: 받침 있으면 "이", 없으면 "가"
export function subjectOf(text: string): string {
  const code = text.charCodeAt(text.length - 1);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return `${text}${hangul && (code - 0xac00) % 28 !== 0 ? '이' : '가'}`;
}

// 목록 구역(상점_화면 7-1): ① 등급 구독(N01) + 3개월 보류(N03) ② 1회 매칭(N02) ③ 필요할 때 하나씩 = 그 밖 전부(서버 순서) ④ 무료는 화면이 따로 그린다
// D-62(10-16): 상점에서 뺀 상품. 서버가 보내도 목록에 그리지 않는다
export const HIDDEN_CATALOG_IDS: readonly string[] = ['N07'];

export type ShopSections = { grade: ShopProduct | null; threeMonth: ShopProduct | null; match: ShopProduct | null; singles: ShopProduct[] };
export function sectionsOf(shop: ShopState): ShopSections {
  const byId = (id: string) => shop.products.find((p) => p.catalogId === id) ?? null;
  const grade = byId('N01');
  const threeMonth = byId('N03');
  const match = byId('N02');
  const taken = new Set([grade, threeMonth, match].filter((p): p is ShopProduct => p !== null).map((p) => p.key));
  return { grade, threeMonth, match, singles: shop.products.filter((p) => !taken.has(p.key) && !HIDDEN_CATALOG_IDS.includes(p.catalogId)) };
}

// 상점 닫힘 · 구독 준비 중(F16, Q3c). 둘 다 서버가 정한 값만 읽는다(R5).
//  closed: 서버 shop_status 'closed'(결제 closed 이거나 live 인데 0단계) → 구매 단추 자리에 '지금은 구매할 수 없어요.'(16-O). 서버는 이때 상품 목록을 비워 준다
//  preparing: 구독 판매 문턱 미만(sub_gate 'preparing' / 상품의 not_ready_reason 'sub_members') → 구독 카드 · 상세는 준비 중, 구매 막힘. 닫힘이 먼저다. 이미 구독 중인 사람의 카드 · 상세는 이 규칙을 안 쓴다(호출한 쪽이 거른다)
export const shopClosed = (shop: ShopState): boolean => shop.shopStatus === 'closed' || shop.paymentMode === 'closed';
export const subPreparing = (product: ShopProduct, shop: ShopState): boolean =>
  !shopClosed(shop) && product.catalogId === 'N01' && (product.notReadyReason === 'sub_members' || shop.subGate === 'preparing');

// 줄 오른쪽에 무엇이 보이나(상점_화면 8장 '지금 구매' 상태대로)
//  buy 살 수 있음 · soon 준비 중(VP1) · held 보류(VP2) · included 구독에 포함 · free 무료
export type RowMode = 'buy' | 'soon' | 'held' | 'included' | 'free';
export function rowModeOf(product: ShopProduct): RowMode {
  switch (product.state) {
    case 'available':
      return 'buy';
    case 'held':
      return 'held';
    case 'benefit':
      return 'included';
    case 'free':
      return 'free';
    default:
      return 'soon';
  }
}

// 줄을 누르면 상세(16-2)가 열리나: 살 수 있는 것 · 보류는 늘 열리고, 준비 중인 것은 테스트 화면(데모 결제)에서만 열려 미리보기를 본다
export function rowOpens(product: ShopProduct, paymentMode: ShopState['paymentMode']): boolean {
  const mode = rowModeOf(product);
  return mode === 'buy' || mode === 'held' || (mode === 'soon' && paymentMode === 'demo');
}

// 빨간 라벨은 테스트 화면(payment_mode = demo)에서만 보인다(카피 16-C · 실사용자 화면 숨김)
export const showsRiskLabel = (product: ShopProduct, shop: ShopState): boolean => product.riskLabel && shop.paymentMode === 'demo';

// 상품 줄 그림(상점 아이콘 25~30, 살 수 있는 상품 4개만) — D42-C 1안 아이콘 이름(components/Icon 으로 그린다)
export function iconOf(catalogId: string): IconName | null {
  switch (catalogId) {
    case 'N01':
      return SHOP_ICONS.tierSubscription;
    case 'N02':
      return SHOP_ICONS.oneMatch;
    case 'G1':
      return SHOP_ICONS.pastRecsPass;
    case 'G2':
      return SHOP_ICONS.likeLetter;
    default:
      return null;
  }
}

// 구매 전 확인(법정 문구) 어느 것을 보이나: 등급 구독 C1 · 1회 매칭 C2 · 단품(열람권 · 편지) C3 · 그 밖은 없음
export type BeforeBuyKind = 'grade' | 'match' | 'single' | null;
export function beforeBuyKind(product: ShopProduct): BeforeBuyKind {
  if (product.catalogId === 'N01' || product.catalogId === 'N03') return 'grade';
  if (product.catalogId === 'N02') return 'match';
  if (product.catalogId === 'G1' || product.catalogId === 'G2') return 'single';
  return null;
}

// 구독이 지금 어떤 상태인가(카드 · 16-12 가 같은 분류를 쓴다)
export type SubView = 'none' | 'active' | 'renew-off' | 'problem' | 'price-up' | 'ended';
export function subViewOf(shop: ShopState): SubView {
  const sub = shop.subscription;
  if (!sub) return 'none';
  if (sub.status === 'expired' || sub.status === 'refunded' || sub.status === 'revoked') return 'ended';
  if (!sub.active && sub.status !== 'grace' && sub.status !== 'billing_retry') return 'ended'; // Q5A-18: 결제 재시도 중이면 active 여도 아니어도 '결제 문제' 안내
  if (sub.status === 'billing_retry' || sub.status === 'grace') return 'problem';
  if (sub.priceIncreasePending) return 'price-up';
  if (!sub.autoRenew) return 'renew-off';
  return 'active';
}

// 구매가 막힌 이유 → 어느 글(상점_화면 3-8 · 7-8)
export type BlockedText = 'age' | 'sold' | 'already' | 'daily' | 'none-today' | 'closed' | 'sub-not-ready';
export function blockedTextOf(reason: PurchaseReason): BlockedText {
  switch (reason) {
    case 'closed':
      return 'closed'; // Q3c: 상점 닫힘(16-O)
    case 'sub_not_ready':
      return 'sub-not-ready'; // Q3c: 구독 판매 문턱 미만(16-O 상세 안내)
    case 'age':
      return 'age';
    case 'already_subscribed':
      return 'already';
    case 'match_daily_max':
      return 'daily';
    case 'match_unavailable':
      return 'none-today';
    default:
      return 'sold';
  }
}
