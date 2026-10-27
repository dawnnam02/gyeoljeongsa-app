// 데모 모드 모의 서버의 16 상점 · 등급 부분(F13). 실제 서버 계약(backend/스키마.md 11장 S8 · 12장 S8c, 0012 · 0014)과 같은 응답 모양 · 같은 오류 코드를 쓴다.
//  get_shop_state · can_purchase · demo_purchase · get_match_once_preview · use_match_once · demo_end_subscription
//  get_my_grade · get_partner_grade · list_grade_history · request_grade_access · set_grade_processing
// 실결제는 없다. 돈이 나가는 일도, 스토어를 부르는 일도 없다(demo_purchase 만). payment_mode 'live' 장면은 앱이 구매를 시작하지 않는지 보려는 것이다.
// F16(Q3c): 기본 장면은 서버 데모 시드와 같다 — payment_mode 'demo' · 구독 문턱 0(sub_gate 'open') · shop_status 'open'(테스트 웹은 그대로 동작).
//  get_shop_state 에 shop_status · sub_gate · products[].not_ready_reason 이 더해졌고, closed(결제 닫힘)와 live 0단계는 products 를 비워 준다. can_purchase · demo_* 는 closed 에서 오류 closed(42501)
//  구독 문턱 미만(subprep)이면 구독 상품(grade_sub_1m)은 'coming' + not_ready_reason 'sub_members', can_purchase · demo_purchase 는 sub_not_ready. demo_restore_purchases 는 이용권만 있는 계정에 credits_on_account + credits
// 상품 45개(서버 시드 0012 에서 N07 을 뺀 것 — D-62, S8d)의 가격 · 상태는 서버 시드와 같고, 이름은 S8d 뒤 카피.md 16-B 이름과 같다(PRODUCT_COPY).
//  S17(D-85): 서버 0020 처럼 G9 · N14(SHOP_DROPPED)는 꺼진 상품이다 — 목록에 내지 않고(43개, 순서 12 · 42 는 빈 채) can_purchase 는 product_off, demo_purchase 는 오류 product_off.
//  N16 은 위험 C(빨간 라벨).
//  S19(D-122, 질문지 1 ⓐ): 서버 0026 처럼 X12 · X13 · X15 · X16 · X17 · X18 · N15 도 꺼진 상품이다(SHOP_DROPPED) — 목록 36개(순서 12 · 27 · 28 · 30 ~ 33 · 42 · 43 빈 채) · 구매는 위와 같은 product_off.
//  S8d 서버 함수 3개도 같은 모양이다: get_grade_processing{processing, stopped_at} · list_my_purchases{items[]} · demo_restore_purchases{result, reason, product_key, period_end}. get_my_grade 에는 areas{cond, verify, sincere}가 있다.
//  구매 복원 장면: shoprestore = 구독 거래는 있고 구독 연결만 없는 계정(복원하면 연결됨)
// 장면은 이메일 앞부분으로 고른다:
//   shopsub 구독 중 · shopoff 갱신 꺼짐 · shopgrace 결제 문제 · shopprice 가격 인상 동의 대기 · shopend 구독 끝남 · shoplive 실결제 모드(구매 시작 안 함)
//   shopclosed 결제 닫힘(payment_mode closed · 상품 목록 빔) · shoplive0 실결제 0단계(상점 닫힘) · subprep 구독 문턱 미만(구독 준비 중 · 이름에 들어 있으면 된다. 예: shopsub-subprep)
//   shopzero 켜진 상품 0개(0단계) · shopfail 상점 읽기 실패 · shopflaky 처음 한 번 인터넷 끊김 · shopage 연령 판정 실패 · payfail 데모 결제 실패 · payslow 데모 결제가 오래 걸림
//   gradenew 첫 계산 전 · gradeband 나이대 합침 · gradefail 내 등급 읽기 실패 · gradeempty 변화 기록 없음 (구독 중 장면과 함께 쓰려고 앞부분이 아니라 이름에 들어 있으면 된다. 예: shopsub-gradenew)
//   moslot 1회 매칭 명분 3 · mopart 오늘 2명만 · monone 오늘 0명
// 구독 중 장면(shop*)에서 만든 계정은 09 에서 구독자 순서 · 상대 등급 배지를 받는다. 같은 계정에서 구매하면 그 자리에서 구독자가 된다.
import { PRODUCT_COPY, SHOP_DROPPED } from '@/content/productCopy';

import type { DemoRecs } from './demoRecs';

type DbError = { code: string; message: string };
type Result = { data: unknown; error: DbError | null };
const ok = (data: unknown): Result => ({ data, error: null });
const fail = (code: string, message: string): Result => ({ data: null, error: { code, message } });
const offline = (): Result => fail('', 'Failed to fetch');

export type DemoShopUser = { id: string; email: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_MS = 9 * 3_600_000;
const SLOW_MS = 32_000; // payslow: 앱의 '확인이 늦어요'(30초)를 넘기는 시간
const NAMES = new Set(['get_shop_state', 'can_purchase', 'demo_purchase', 'get_match_once_preview', 'use_match_once', 'demo_end_subscription', 'get_my_grade', 'get_partner_grade', 'list_grade_history', 'request_grade_access', 'set_grade_processing', 'get_grade_processing', 'list_my_purchases', 'demo_restore_purchases']);

// 서버 시드(0012 store_products)에서 N07(D-62)을 뺀 45개: [sort, catalog_id, key, 서버 이름, 구역, 종류, 가격, 상태, 위험]. G9 · N14 는 꺼진 행(D-85, 서버 live_on false) · N16 위험은 0020 뒤 값(C)
//  X12 · X13 · X15 · X16 · X17 · X18 · N15 도 꺼진 행(D-122, 서버 0026 live_on false). 행은 서버처럼 남기고 SHOP_DROPPED 로 끈다
type Seed = [number, string, string, string, string, string, number | null, string, string];
const SEED: Seed[] = [
  [1, 'N01', 'grade_sub_1m', '등급 구독', 'grade_sub', 'subscription', 14900, 'available', 'C'],
  [2, 'N02', 'match_once', '1회 매칭', 'match_once', 'consumable', 4900, 'available', 'C'],
  [3, 'N03', 'grade_sub_3m', '등급 구독 3개월', 'grade_sub', 'subscription', 35900, 'held', 'B'],
  [4, 'G1', 'past_card_1', '지난 추천 열람권', 'single', 'consumable', 1500, 'available', 'A'],
  [5, 'G2', 'letter_1', '호감 편지', 'single', 'consumable', 1500, 'available', 'A'],
  [6, 'G3', 'report_1', '깊은 성향 리포트', 'single', 'consumable', 4900, 'coming', 'B'],
  [7, 'G4', 'one_more_1', '오늘 한 분 더', 'single', 'consumable', 2500, 'coming', 'B'],
  [8, 'G5', 'extra_like', '다시 연 카드 호감 +2', 'single', 'benefit', null, 'benefit', 'A'],
  [9, 'G6', 'membership_1m', '멤버십(옛 D-39)', 'grade_sub', 'subscription', 14900, 'coming', 'A'],
  [10, 'G7', 'doc_verify', '서류 인증', 'single', 'free', 0, 'coming', 'B'],
  [11, 'G8', 'chat', '대화 기능', 'single', 'benefit', null, 'benefit', 'A'],
  [12, 'G9', 'polish_text', '프로필 글 다듬기', 'single', 'consumable', 1900, 'coming', 'B'],
  [13, 'G10', 'first_topics', '첫 대화 주제', 'single', 'consumable', 1900, 'coming', 'C'],
  [14, 'G11', 'period_pass', '기간 이용권', 'single', 'period', 49000, 'coming', 'C'],
  [15, 'G12', 'date_partner', '데이트 장소 제휴', 'single', 'commission', null, 'coming', 'A'],
  [16, 'X1', 'boost', '우선 노출', 'single', 'consumable', 2900, 'coming', 'C'],
  [17, 'X2', 'like_priority', '호감 우선 표시', 'single', 'consumable', 1900, 'coming', 'C'],
  [18, 'X3', 'view_history', '프로필 열람 기록', 'single', 'benefit', null, 'coming', 'C'],
  [19, 'X4', 'read_receipt', '읽음 확인', 'single', 'benefit', null, 'coming', 'C'],
  [20, 'X5', 'hidden_fields', '비공개 항목 열람', 'single', 'consumable', 2900, 'coming', 'C'],
  [21, 'X6', 'score_view', '점수 · 인기도 · 궁합 % 보기', 'single', 'benefit', null, 'coming', 'C'],
  [22, 'X7', 'dealbreaker_bypass', '양보 불가 넘어 보기', 'single', 'consumable', 2900, 'coming', 'C'],
  [23, 'X8', 'recycle', '재추천 금지 단축', 'single', 'consumable', 1900, 'coming', 'C'],
  [24, 'X9', 'undo_decline', '거절 되돌리기', 'single', 'consumable', 1900, 'coming', 'C'],
  [25, 'X10', 'undo_pass', '넘김 되돌리기(유료)', 'single', 'consumable', 1000, 'coming', 'C'],
  [26, 'X11', 'contact_pass', '연락처 교환권', 'single', 'consumable', 4900, 'coming', 'C'],
  [27, 'X12', 'success_fee', '성혼 사례비', 'single', 'commission', null, 'coming', 'C'],
  [28, 'X13', 'manager', '매니저 주선', 'single', 'service', null, 'coming', 'C'],
  [29, 'X14', 'ads', '광고 배너', 'single', 'ads', null, 'coming', 'C'],
  [30, 'X15', 'per_connection', '연결 성공 요금', 'single', 'consumable', 2900, 'coming', 'C'],
  [31, 'X16', 'wedding_partner', '웨딩 업체 제휴', 'single', 'commission', null, 'coming', 'C'],
  [32, 'X17', 'offline_event', '오프라인 만남 행사', 'single', 'one_time', 29000, 'coming', 'C'],
  [33, 'X18', 'guarantee', '만남 · 결혼 보장형', 'single', 'subscription', null, 'coming', 'C'],
  [34, 'N05', 'match_reasons', '맞는 점 전체 보기', 'single', 'consumable', 1900, 'coming', 'A'],
  [35, 'N06', 'grade_filter', '등급 조건 추천(정한 등급 이상만)', 'single', 'benefit', null, 'coming', 'C'],
  [36, 'N08', 'hide_my_grade', '내 등급 보이기', 'free', 'free', 0, 'free', 'A'],
  [37, 'N09', 'partner_traits', '상대 성향 요약 보기', 'single', 'consumable', 1900, 'coming', 'B'],
  [38, 'N10', 'condition_check', '내 조건 점검', 'single', 'benefit', null, 'coming', 'B'],
  [39, 'N11', 'grade_percentile', '등급 분포 속 내 위치(상위 %)', 'single', 'benefit', null, 'coming', 'C'],
  [40, 'N12', 'grade_peer_avg', '같은 등급대 평균과 비교', 'single', 'benefit', null, 'coming', 'B'],
  [41, 'N13', 'early_reco', '아침 일찍 받기(07:00)', 'single', 'benefit', null, 'coming', 'B'],
  [42, 'N14', 'public_intro', '공개 자기소개 한 줄 + 다듬기', 'single', 'consumable', 1900, 'coming', 'B'],
  [43, 'N15', 'grade_coaching', '등급 상담(사람)', 'single', 'one_time', 19000, 'coming', 'C'],
  [44, 'N16', 'profile_deco', '프로필 꾸미기(테두리 · 배지)', 'single', 'non_consumable', 1900, 'coming', 'C'],
  [45, 'N17', 'reshuffle', '오늘 추천 다시 섞기', 'single', 'consumable', 2900, 'coming', 'C'],
];
// 구독 혜택 키(서버 shop_config.subscription_benefits 켠 것의 이름 — 앱은 개수만 쓴다)
const BENEFITS = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B09', 'B10', 'B11', 'B12', 'B13'];
const CREDIT_OF: Record<string, { kind: string; qty: number }> = {
  match_once: { kind: 'match_slot', qty: 3 },
  past_card_1: { kind: 'past_card', qty: 1 },
  letter_1: { kind: 'letter', qty: 1 },
};
const CREDIT_KINDS = ['match_slot', 'past_card', 'letter', 'report', 'one_more', 'reasons', 'traits', 'intro'];
// 서버 store_products.live_on: 꺼진 상품(D-85 · D-122)은 목록 · 구매에서 빠진다
const liveOn = (seed: Seed): boolean => !SHOP_DROPPED.includes(seed[1]);

type Sub = { status: string; productKey: string; periodEnd: number; autoRenew: boolean; priceIncrease: boolean };
type Purchase = { txId: string; productKey: string; catalogId: string; priceKrw: number; quantity: number; status: 'done' | 'refunded' | 'pending' | 'rejected'; at: number; refundedAt: number | null; periodEnd: number | null };
type St = {
  sub: Sub | null;
  purchases: Purchase[];
  stoppedAt: number | null; // 등급 계산을 멈춘 시각(get_grade_processing)
  credits: Record<string, number>;
  requests: Map<string, string>; // 데모 결제 요청 ID → 결과(같은 요청은 한 번만)
  matchUses: { requestId: string; added: number }[];
  accessRequest: { id: string; receivedAt: number; dueAt: number } | null;
  processing: boolean; // 등급 계산 중인가(set_grade_processing)
  loads: number;
  seq: number;
};

// kin(F24): 데모 '나'의 등급을 정하는 장면(이메일 kk1~kk9 · 데모 줄로 바꾼 값). 없으면 예전처럼 4
export type DemoShopHooks = { recs: DemoRecs; kin?: (user: DemoShopUser) => number | null };

export function createDemoShop(now: () => number, hooks: DemoShopHooks) {
  const states = new Map<string, St>();
  const local = (email: string) => email.split('@')[0];
  const stateOf = (user: DemoShopUser): St => {
    let s = states.get(user.id);
    if (!s) {
      const l = local(user.email);
      const t = now();
      let sub: Sub | null = null;
      if (l.startsWith('shopsub')) sub = { status: 'active', productKey: 'grade_sub_1m', periodEnd: t + 22 * DAY_MS, autoRenew: true, priceIncrease: false };
      else if (l.startsWith('shopoff')) sub = { status: 'active', productKey: 'grade_sub_1m', periodEnd: t + 9 * DAY_MS, autoRenew: false, priceIncrease: false };
      else if (l.startsWith('shopgrace')) sub = { status: 'billing_retry', productKey: 'grade_sub_1m', periodEnd: t + 2 * DAY_MS, autoRenew: true, priceIncrease: false };
      else if (l.startsWith('shopprice')) sub = { status: 'active', productKey: 'grade_sub_1m', periodEnd: t + 12 * DAY_MS, autoRenew: true, priceIncrease: true };
      else if (l.startsWith('shopend')) sub = { status: 'expired', productKey: 'grade_sub_1m', periodEnd: t - 3 * DAY_MS, autoRenew: false, priceIncrease: false };
      const credits = Object.fromEntries(CREDIT_KINDS.map((k) => [k, 0]));
      if (l.includes('moslot')) credits.match_slot = 3;
      const purchases: Purchase[] = [];
      if (sub && l.startsWith('shop')) purchases.push({ txId: 'demo-tx-seed-sub', productKey: 'grade_sub_1m', catalogId: 'N01', priceKrw: 14900, quantity: 1, status: sub.status === 'refunded' ? 'refunded' : 'done', at: t - 8 * DAY_MS, refundedAt: null, periodEnd: sub.periodEnd });
      if (l.startsWith('shoprestore')) purchases.push({ txId: 'demo-tx-seed-restore', productKey: 'grade_sub_1m', catalogId: 'N01', priceKrw: 14900, quantity: 1, status: 'done', at: t - 5 * DAY_MS, refundedAt: null, periodEnd: t + 25 * DAY_MS });
      s = { sub, purchases, stoppedAt: null, credits, requests: new Map(), matchUses: [], accessRequest: null, processing: true, loads: 0, seq: 0 };
      states.set(user.id, s);
    }
    return s;
  };

  const isActive = (s: St) => s.sub !== null && (s.sub.status === 'grace' || ((s.sub.status === 'active' || s.sub.status === 'billing_retry') && s.sub.periodEnd > now()));
  // 구독자 여부는 09 · 10 이 묻는다(hooks.recs 가 쓴다)
  const subscriber = (user: DemoShopUser) => isActive(stateOf(user));

  // 서버가 계산한 척하는 내 등급: 계산이 멈췄거나 첫 계산 전이면 null
  const gradeNo = (user: DemoShopUser): number | null => {
    const s = stateOf(user);
    const l = local(user.email);
    if (!s.processing || l.includes('gradenew')) return null;
    return hooks.kin?.(user) ?? 4;
  };

  function mode(user: DemoShopUser): 'demo' | 'live' | 'closed' {
    const l = local(user.email);
    if (l.startsWith('shopclosed')) return 'closed';
    return l.startsWith('shoplive') ? 'live' : 'demo';
  }
  // 서버 shop_status: closed 이거나 live 인데 stage 0 이면 닫힘(Q3c). 그때 products 는 빈 배열
  const stageOf = (user: DemoShopUser): number => (local(user.email).startsWith('shoplive0') || mode(user) === 'closed' ? 0 : 1);
  const closedFor = (user: DemoShopUser): boolean => mode(user) === 'closed' || (mode(user) === 'live' && stageOf(user) === 0);
  // 서버 sub_gate: 활성 회원이 문턱(shop_config.sub_min_members)에 못 미치면 preparing. 데모 시드는 문턱 0 이라 기본은 open
  const gateOf = (user: DemoShopUser): 'open' | 'preparing' => (local(user.email).includes('subprep') ? 'preparing' : 'open');

  function matchStatus(user: DemoShopUser, s: St) {
    const used = s.matchUses.length;
    const available = hooks.recs.matchOnceAvailable(user.id, user.email);
    return { available_today: used >= 2 ? 0 : available, uses_today: used, daily_max: 2, slots_left: s.credits.match_slot };
  }

  function shopState(user: DemoShopUser): Result {
    const s = stateOf(user);
    const l = local(user.email);
    s.loads += 1;
    if (l.startsWith('shopfail')) return fail('XX000', 'internal');
    if (l.startsWith('shopflaky') && s.loads === 1) return offline();
    const m = mode(user);
    const gate = gateOf(user);
    const subJson = s.sub
      ? {
          status: s.sub.status,
          product_key: s.sub.productKey,
          period_end: new Date(s.sub.periodEnd).toISOString(),
          auto_renew: s.sub.autoRenew,
          active: isActive(s),
          price_increase_pending: s.sub.priceIncrease,
          benefits: BENEFITS,
        }
      : null;
    const zero = l.startsWith('shopzero');
    return ok({
      payment_mode: m,
      shop_status: closedFor(user) ? 'closed' : 'open',
      sub_gate: gate,
      stage: stageOf(user),
      subscription: subJson,
      credits: s.credits,
      match_once: matchStatus(user, s),
      products: zero || closedFor(user)
        ? []
        : SEED.filter(liveOn).map(([sort, catalogId, key, name, section, kind, price, state, risk]) => {
            const notReady = kind === 'subscription' && state === 'available' && gate === 'preparing'; // 서버: grant_kind subscription + available + 문턱 미만
            return {
              key,
              catalog_id: catalogId,
              name: PRODUCT_COPY.find((c) => c.id === catalogId)?.name ?? name,
              section,
              sort,
              kind,
              price_krw: price,
              purchase_state: notReady ? 'coming' : state,
              ...(notReady ? { not_ready_reason: 'sub_members' } : {}),
              redirect_to: key === 'membership_1m' ? 'grade_sub_1m' : null,
              risk_label: risk === 'C',
              risk_note: risk === 'C' ? '위험 C(데모 시드)' : null,
            };
          }),
    });
  }

  // 서버 private.purchase_check 와 같은 순서의 이유 코드. null 이면 살 수 있다
  function purchaseCheck(user: DemoShopUser, s: St, key: string): string | null {
    const seed = SEED.find((x) => x[2] === key);
    if (!seed) return 'unknown_product';
    if (local(user.email).startsWith('shopage')) return 'age';
    if (!liveOn(seed)) return 'product_off';
    if (seed[7] === 'held') return 'product_held';
    if (seed[7] !== 'available') return 'product_not_ready';
    if (seed[5] === 'subscription' && gateOf(user) === 'preparing') return 'sub_not_ready'; // Q3c D-66 ③: 구독 판매 문턱 미만
    if (seed[4] === 'grade_sub' && isActive(s)) return 'already_subscribed';
    if (key === 'match_once') {
      const m = matchStatus(user, s);
      if (m.uses_today >= m.daily_max) return 'match_daily_max';
      if (m.available_today <= 0 && s.credits.match_slot <= 0) return 'match_unavailable';
    }
    return null;
  }

  function canPurchase(user: DemoShopUser, args: Record<string, unknown>): Result {
    if (typeof args.p_product_key !== 'string') return fail('P0001', 'unknown_product');
    const s = stateOf(user);
    const platform = args.p_platform;
    let reason: string | null;
    if (mode(user) === 'closed') reason = 'closed'; // Q3c: 어느 플랫폼이든 먼저
    else if (platform !== 'apple' && platform !== 'google' && platform !== 'demo') reason = 'invalid_platform';
    else if (mode(user) === 'live' && platform === 'demo') reason = 'demo_not_allowed';
    else if (mode(user) === 'demo' && platform !== 'demo') reason = 'demo_mode';
    else reason = purchaseCheck(user, s, args.p_product_key);
    const out: Record<string, unknown> = { ok: reason === null, reason, purchase_token: null };
    if (args.p_product_key === 'match_once') out.available_today = matchStatus(user, s).available_today;
    return ok(out);
  }

  function grant(s: St, key: string): void {
    const seed = SEED.find((x) => x[2] === key);
    if (!seed) return;
    if (seed[4] === 'grade_sub') {
      const days = key === 'grade_sub_3m' ? 90 : 30;
      s.sub = { status: 'active', productKey: key, periodEnd: now() + days * DAY_MS, autoRenew: true, priceIncrease: false };
      return;
    }
    const credit = CREDIT_OF[key];
    if (credit) s.credits[credit.kind] += credit.qty;
  }

  async function demoPurchase(user: DemoShopUser, args: Record<string, unknown>): Promise<Result> {
    const s = stateOf(user);
    const l = local(user.email);
    if (mode(user) === 'closed') return fail('42501', 'closed'); // Q3c
    if (mode(user) !== 'demo') return fail('42501', 'demo_not_allowed');
    if (typeof args.p_request_id !== 'string' || args.p_request_id === '') return fail('P0001', 'invalid_request');
    const key = String(args.p_product_key);
    const again = s.requests.get(args.p_request_id);
    if (again !== undefined) return ok({ result: 'already_granted', product_key: again, tx_id: `demo-tx-${args.p_request_id}` });
    const seed = SEED.find((x) => x[2] === key);
    if (!seed) return fail('P0001', 'unknown_product');
    if (!liveOn(seed)) return fail('P0001', 'product_off'); // 서버 demo_purchase 와 같은 순서: 없는 상품 → 꺼진 상품 → 준비 중 미리보기
    if (l.startsWith('payfail')) return fail('XX000', 'internal');
    if (l.startsWith('payoff')) return offline();
    if (l.startsWith('payslow')) await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
    if (seed[7] === 'coming') return ok({ result: 'preview', product_key: key, implemented: false }); // 준비 중 상품: 기록 · 지급 0
    const reason = purchaseCheck(user, s, key);
    if (reason !== null) return fail('P0001', reason);
    s.requests.set(args.p_request_id, key);
    grant(s, key);
    const credit = CREDIT_OF[key];
    s.purchases.push({ txId: `demo-tx-${args.p_request_id}`, productKey: key, catalogId: seed[1], priceKrw: seed[6] ?? 0, quantity: credit?.qty ?? 1, status: 'done', at: now(), refundedAt: null, periodEnd: s.sub && seed[4] === 'grade_sub' ? s.sub.periodEnd : null });
    return ok({ result: 'granted', product_key: key, tx_id: `demo-tx-${args.p_request_id}`, granted: seed[4] === 'grade_sub' ? { subscription: key } : { credit: CREDIT_OF[key]?.kind } });
  }

  function takeMatchOnce(user: DemoShopUser, args: Record<string, unknown>): Result {
    const s = stateOf(user);
    if (typeof args.p_request_id !== 'string' || args.p_request_id === '') return fail('P0001', 'invalid_request');
    const done = s.matchUses.find((u) => u.requestId === args.p_request_id);
    if (done) return ok({ added: done.added, slots_left: s.credits.match_slot, uses_today: s.matchUses.length, day: new Date(now()).toISOString().slice(0, 10), replayed: true });
    if (s.matchUses.length >= 2) return fail('P0001', 'match_daily_max');
    if (s.credits.match_slot <= 0) return fail('P0001', 'no_slot');
    const want = Math.min(3, s.credits.match_slot);
    const added = hooks.recs.addMatchOnce(user.id, user.email, want);
    if (added <= 0) return fail('P0001', 'match_unavailable'); // 차감 0
    s.credits.match_slot -= added;
    s.matchUses.push({ requestId: args.p_request_id, added });
    return ok({ added, slots_left: s.credits.match_slot, uses_today: s.matchUses.length, day: new Date(now()).toISOString().slice(0, 10), replayed: false });
  }

  function endSubscription(user: DemoShopUser, args: Record<string, unknown>): Result {
    const s = stateOf(user);
    if (mode(user) === 'closed') return fail('42501', 'closed'); // Q3c
    if (mode(user) !== 'demo') return fail('42501', 'demo_not_allowed');
    const how = args.p_how;
    if (how !== 'cancel' && how !== 'expire' && how !== 'refund') return fail('P0001', 'invalid_value');
    if (!s.sub) return fail('P0001', 'not_found');
    if (how === 'cancel') s.sub.autoRenew = false;
    else if (how === 'expire') {
      s.sub.status = 'expired';
      s.sub.autoRenew = false;
      s.sub.periodEnd = now() - 1000;
    } else {
      s.sub.status = 'refunded';
      s.sub.autoRenew = false;
      const last = [...s.purchases].reverse().find((p) => p.periodEnd !== null && p.status === 'done');
      if (last) {
        last.status = 'refunded';
        last.refundedAt = now();
      }
    }
    return ok({ status: s.sub.status, auto_renew: s.sub.autoRenew, period_end: new Date(s.sub.periodEnd).toISOString(), active: isActive(s) });
  }

  // ── 등급 ──────────────────────────────────────────────────────────
  // 오늘 03:00(KST) 반영 시각
  function lastRun(): number {
    const t = now();
    const kst = new Date(t + KST_MS);
    const run = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 3) - KST_MS;
    return run <= t ? run : run - DAY_MS;
  }

  function myGrade(user: DemoShopUser): Result {
    const s = stateOf(user);
    const l = local(user.email);
    if (l.includes('gradefail')) return fail('XX000', 'internal');
    if (!isActive(s)) return ok({ locked: true });
    const next = lastRun() + DAY_MS;
    const n = gradeNo(user);
    if (n === null) {
      return ok({ locked: false, ready: false, reason: s.processing ? 'not_computed' : 'stopped', first_ready_at: new Date(next).toISOString() });
    }
    return ok({
      locked: false,
      ready: true,
      grade_no: n,
      basis: 'age_band',
      band: '28-32',
      band_merged: l.includes('gradeband'),
      shown_at: new Date(lastRun()).toISOString(),
      next_at: new Date(next).toISOString(),
      areas: { cond: 46.2, verify: 3.5, sincere: 4.8 }, // S8d: 영역별 '+n점'. 세 값을 더하지 않는다(합 비공개)
      top: [
        { item: 'sch', pts: 15.8 },
        { item: 'inc', pts: 14.2 },
        { item: 'job', pts: 11.3 },
      ],
      manner_ok: true,
      actionable: [
        { item: 'v_sch', up_to: 2.1 },
        { item: 'ans', up_to: 2.4 },
        { item: 'act', up_to: 0.6 },
      ],
      verify_on: false, // 1차: 서류 인증 준비 중(NV43)
    });
  }
  function history(user: DemoShopUser): Result {
    const s = stateOf(user);
    if (!isActive(s)) return ok({ locked: true });
    if (local(user.email).includes('gradeempty') || gradeNo(user) === null) return ok({ locked: false, items: [] });
    const t = now();
    // 기록은 지금 등급에서 끝난다(처음 6 → 5 → 6 → 5 → 4). 끼리끼리 장면으로 등급을 바꾸면 같은 모양으로 옮긴다(1~9 안)
    const shift = (gradeNo(user) ?? 4) - 4;
    const at = (no: number) => Math.min(9, Math.max(1, no + shift));
    return ok({
      locked: false,
      items: [
        { at: new Date(t - 2 * DAY_MS).toISOString(), from_no: at(5), to_no: at(4), reason: 'verification' },
        { at: new Date(t - 40 * DAY_MS).toISOString(), from_no: at(6), to_no: at(5), reason: 'answer_edit' },
        { at: new Date(t - 60 * DAY_MS).toISOString(), from_no: at(5), to_no: at(6), reason: 'manner' },
        { at: new Date(t - 90 * DAY_MS).toISOString(), from_no: null, to_no: at(6), reason: 'first' },
      ].filter((x) => x.from_no !== x.to_no), // 1 · 9 끝에서 같은 숫자가 된 줄은 뺀다
    });
  }

  function requestAccess(user: DemoShopUser): Result {
    const s = stateOf(user);
    if (s.accessRequest) return ok({ request_id: s.accessRequest.id, received_at: new Date(s.accessRequest.receivedAt).toISOString(), due_at: new Date(s.accessRequest.dueAt).toISOString(), merged: true });
    s.seq += 1;
    const t = now();
    s.accessRequest = { id: `demo-gr-${s.seq}`, receivedAt: t, dueAt: t + 10 * DAY_MS };
    return ok({ request_id: s.accessRequest.id, received_at: new Date(t).toISOString(), due_at: new Date(t + 10 * DAY_MS).toISOString(), merged: false });
  }

  function partnerGrade(user: DemoShopUser, args: Record<string, unknown>): Result {
    const s = stateOf(user);
    if (!isActive(s)) return ok({ locked: true });
    const id = String(args.p_partner);
    const info = hooks.recs.gradeInfo(user.id, id);
    if (!info) return fail('P0001', 'not_available');
    return ok({ user_id: id }); // D-197(CK10 폐지 · 청사진 6-2): 상대 등급 번호를 주지 않는다
  }

  function setProcessing(user: DemoShopUser, args: Record<string, unknown>): Result {
    const s = stateOf(user);
    if (typeof args.p_on !== 'boolean') return fail('P0001', 'invalid_value');
    s.processing = args.p_on;
    s.stoppedAt = s.processing ? null : now();
    return ok({ processing: s.processing });
  }

  // S8d: 비구독자도 읽는다
  function getProcessing(user: DemoShopUser): Result {
    const s = stateOf(user);
    if (local(user.email).startsWith('procfail')) return fail('XX000', 'internal');
    return ok({ processing: s.processing, stopped_at: s.stoppedAt === null ? null : new Date(s.stoppedAt).toISOString() });
  }

  // S8d: 최근 순, 환불 · 확인 중 · 거절 포함
  function listPurchases(user: DemoShopUser): Result {
    const s = stateOf(user);
    if (local(user.email).startsWith('purfail')) return fail('XX000', 'internal');
    const items = [...s.purchases]
      .sort((a, b) => b.at - a.at)
      .map((p) => ({
        tx_id: p.txId,
        product_key: p.productKey,
        catalog_id: p.catalogId,
        name: PRODUCT_COPY.find((c) => c.id === p.catalogId)?.name ?? p.productKey,
        price_krw: p.priceKrw,
        quantity: p.quantity,
        platform: 'demo',
        environment: 'sandbox',
        state: p.status === 'done' ? 'granted' : p.status,
        status: p.status,
        purchased_at: new Date(p.at).toISOString(),
        refunded_at: p.refundedAt === null ? null : new Date(p.refundedAt).toISOString(),
      }));
    return ok({ items });
  }

  // S8d: 가장 최근 구독 거래의 기간이 안 끝났는데 구독 연결이 사라진 경우에만 되살린다
  function restorePurchases(user: DemoShopUser): Result {
    const s = stateOf(user);
    if (mode(user) === 'closed') return fail('42501', 'closed'); // Q3c
    if (mode(user) !== 'demo') return fail('42501', 'demo_not_allowed');
    if (local(user.email).startsWith('restfail')) return fail('XX000', 'internal');
    const subs = s.purchases.filter((p) => p.periodEnd !== null).sort((a, b) => b.at - a.at);
    const last = subs[0];
    if (!last) {
      // Q3c Q5A-17: 구독 거래는 없고 이용권 잔액만 있으면 reason credits_on_account + credits{종류: 잔액}(양수만)
      const credits = Object.fromEntries(Object.entries(s.credits).filter(([, n]) => n > 0));
      if (Object.keys(credits).length > 0) return ok({ result: 'nothing_to_restore', reason: 'credits_on_account', credits });
      return ok({ result: 'nothing_to_restore', reason: 'no_purchase' });
    }
    if (last.status === 'refunded') return ok({ result: 'nothing_to_restore', reason: 'refunded' });
    if ((last.periodEnd ?? 0) <= now()) return ok({ result: 'nothing_to_restore', reason: 'period_ended' });
    if (s.sub !== null) return ok({ result: 'nothing_to_restore', reason: 'already_linked' });
    s.sub = { status: 'active', productKey: last.productKey, periodEnd: last.periodEnd ?? now(), autoRenew: true, priceIncrease: false };
    return ok({ result: 'restored', product_key: last.productKey, period_end: new Date(last.periodEnd ?? now()).toISOString() });
  }

  return {
    handles: (name: string) => NAMES.has(name),
    // 09 · 10 모의 서버가 묻는 값: 내가 구독자인가 · 내 등급(계산 전 · 멈춤이면 null)
    subscriber,
    gradeNo,
    rpc(user: DemoShopUser, name: string, args: Record<string, unknown>): Result | Promise<Result> {
      switch (name) {
        case 'get_shop_state':
          return shopState(user);
        case 'can_purchase':
          return canPurchase(user, args);
        case 'demo_purchase':
          return demoPurchase(user, args);
        case 'get_match_once_preview':
          return ok(matchStatus(user, stateOf(user)));
        case 'use_match_once':
          return takeMatchOnce(user, args);
        case 'demo_end_subscription':
          return endSubscription(user, args);
        case 'get_my_grade':
          return myGrade(user);
        case 'get_partner_grade':
          return partnerGrade(user, args);
        case 'list_grade_history':
          return history(user);
        case 'request_grade_access':
          return requestAccess(user);
        case 'set_grade_processing':
          return setProcessing(user, args);
        case 'get_grade_processing':
          return getProcessing(user);
        case 'list_my_purchases':
          return listPurchases(user);
        case 'demo_restore_purchases':
          return restorePurchases(user);
        default:
          return fail('42883', `function ${name} does not exist`);
      }
    },
    // 시험 · 화면 점검용
    peek(user: DemoShopUser) {
      const s = stateOf(user);
      return { sub: s.sub ? { ...s.sub } : null, credits: { ...s.credits }, matchUses: s.matchUses.map((u) => ({ ...u })), processing: s.processing, accessRequested: s.accessRequest !== null };
    },
  };
}

export type DemoShop = ReturnType<typeof createDemoShop>;
