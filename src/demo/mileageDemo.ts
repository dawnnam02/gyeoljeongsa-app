// 데모 모드 모의 서버의 마일리지 장부(IF5-F2 ⑨ · P0 '기기 안 가상 잔액'). 이름 · 인자 · 응답 모양 = 서버 0048(backend/R_변경기록.md 16-2 · 16-3):
//   get_mileage() → {ok, state ready, paid, free, total, held, charge_locked, products[{sku,price,mileage}], costs[{feature,label,cost}], rules{confirm_from,length_free_chars,length_step_chars,length_step_cost}}
//   list_mileage_history(p_before, p_limit) → {ok, state ready, items[{id,at,kind charge|gift|boarding|ops|demo|use|recovered|restored,amount,feature?,state?}], next}
//   get_mileage_cost(p_feature, p_chars) → {ok, feature, cost, base, extra, confirm} | {ok:false, code invalid_value|unknown_feature|too_large}
//  · 앱은 이 값을 하드코딩하지 않고 응답을 그대로 읽는다(수 · 가격 · 차감표 · 규칙은 이 모의 서버 한 곳 — 서버 0048 시작값과 같다: 수익 IF5 상품 4 · 차감표 10 · 가입 선물 1,000 · 탑승 적립 200)
//  · 장부는 이 메모리뿐이다(서버 요청 0 · 기기 저장 0 · 결제 호출 0). 데모 판의 가상 잔액이라 새로 고치면 처음으로 돌아간다. 로그아웃 · 탈퇴에서도 다음 사람에게 넘어가지 않는다(회원마다 따로)
//  · 데모 전용 이름(진짜 서버에는 없다 — 서버에서는 AI Edge 가 서비스 역할로 한다): demo_mileage_charge(p_sku) 충전 흉내 · demo_mileage_hold / settle / release 예치 → 확정 · 해제
//    mileage_hold 와 같은 규칙: 요청 번호 하나에 예치 하나(같은 요청을 다시 부르면 같은 결과) · 무료분 먼저 → 유료분은 먼저 산 것부터 · 외상 0 · 위기 턴은 0이어도 막지 않고 차감 0 · 인자에 금액 0
//  · 장면(이메일 앞부분): mzero 가입 선물이 없는 빈 잔액 · mlow 잔액 100 · mfail 읽기 실패(P0001) · mbig 충전 잠금 표시(charge_locked)

type Row = Record<string, unknown>;
type RpcResult = { data: unknown; error: { code: string; message: string } | null };
export type DemoMileageUser = { id: string; email: string };
export type DemoMileageOptions = {
  flags: (u: DemoMileageUser) => Promise<Readonly<Record<string, boolean>>>;
  /** 탄 회차 수(탑승권 모의 서버의 list_ticket_history) — 회차마다 탑승 적립을 한 번씩 */
  boardedRounds?: (u: DemoMileageUser) => Promise<number>;
  now?: () => number;
};

// 서버 0048 시작값(수익 IF5): 상품 4 · 차감표 10 · 규칙
const PRODUCTS = [
  { sku: 'mileage_3300', price: 3300, mileage: 3300 },
  { sku: 'mileage_5500', price: 5500, mileage: 5500 },
  { sku: 'mileage_11000', price: 11000, mileage: 11000 },
  { sku: 'mileage_33000', price: 33000, mileage: 33000 },
] as const;
const COSTS = [
  { feature: 'compat', label: '둘이 맞춰 보기', cost: 1200 },
  { feature: 'counsel_turn', label: '고민 정리 1턴', cost: 250 },
  { feature: 'daewoon', label: '대운 풀이', cost: 1000 },
  { feature: 'polish_long', label: '긴 글 다듬기', cost: 300 },
  { feature: 'polish_short', label: '짧은 다듬기', cost: 10 },
  { feature: 'saju_chat_turn', label: '사주 이어 묻기 1턴', cost: 200 },
  { feature: 'saju_full', label: '사주 종합 풀이', cost: 2000 },
  { feature: 'saju_reading', label: '사주 풀이', cost: 800 },
  { feature: 'sinyeon', label: '올해 풀이', cost: 1500 },
  { feature: 'taekil_explain', label: '날짜 고르기 설명', cost: 30 },
] as const;
const RULES = { confirm_from: 300, length_free_chars: 1000, length_step_chars: 1000, length_step_cost: 70 } as const;
const MAX_INPUT_CHARS = 32000;
const SIGNUP_GIFT = 1000;
const BOARDING_REWARD = 200;
const HOLD_TTL_MS = 120_000;

type LotSource = 'signup_gift' | 'boarding' | 'ops_reward' | 'demo';
type Lot = { id: number; source: LotSource; bucket: 'free' | 'paid'; amount: number; remaining: number; at: number; tag?: string };
type Hold = { id: string; requestId: string; feature: string; amount: number; state: 'held' | 'settled' | 'released'; at: number; parts: { lot: number; amt: number }[]; crisis: boolean };
type Entry = { id: number; at: number; kind: 'grant' | 'use'; lot?: number; hold?: string; amount: number };
type Ledger = { lots: Lot[]; holds: Hold[]; entries: Entry[]; seq: number; boardedGranted: number; gifted: boolean };

const ok = (data: unknown): RpcResult => ({ data, error: null });
const off = (): RpcResult => ({ data: null, error: { code: '42501', message: 'feature_off' } });
const fail = (code: string, extra: Row = {}): RpcResult => ok({ ok: false, code, ...extra });

/** 길이 가산: 무료 글자 수를 넘는 부분 step 글자마다(못 채워도 한 칸) step 마일리지 — 서버 private.mileage_cost 와 같은 올림 */
function costFor(base: number, chars: number): number {
  if (chars <= RULES.length_free_chars) return base;
  return base + Math.ceil((chars - RULES.length_free_chars) / RULES.length_step_chars) * RULES.length_step_cost;
}

export function createDemoMileage(o: DemoMileageOptions) {
  const nowMs = (): number => o.now?.() ?? Date.now();
  const ledgers = new Map<string, Ledger>();
  const sceneOf = (u: DemoMileageUser): string => {
    const l = (u.email.split('@')[0] ?? '').toLowerCase();
    return ['mzero', 'mlow', 'mfail', 'mbig'].find((k) => l.includes(k)) ?? '';
  };
  const ledgerOf = (u: DemoMileageUser): Ledger => {
    let l = ledgers.get(u.id);
    if (!l) {
      l = { lots: [], holds: [], entries: [], seq: 0, boardedGranted: 0, gifted: false };
      ledgers.set(u.id, l);
    }
    return l;
  };
  const grant = (l: Ledger, source: LotSource, bucket: 'free' | 'paid', amount: number): Lot => {
    const lot: Lot = { id: ++l.seq, source, bucket, amount, remaining: amount, at: nowMs() };
    l.lots.push(lot);
    l.entries.push({ id: ++l.seq, at: lot.at, kind: 'grant', lot: lot.id, amount });
    return lot;
  };

  // 가입 선물 1인 1회 · 탑승 적립(회차마다) — 서버는 가입 때 · mileage_boarding_sync 가 하는 일을 읽을 때 한 번 맞춘다(푸시 0)
  async function sync(u: DemoMileageUser, l: Ledger): Promise<void> {
    const scene = sceneOf(u);
    if (!l.gifted) {
      l.gifted = true;
      if (scene === 'mlow') grant(l, 'ops_reward', 'free', 100);
      else if (scene !== 'mzero') grant(l, 'signup_gift', 'free', SIGNUP_GIFT);
    }
    const rounds = (await o.boardedRounds?.(u)) ?? 0;
    while (l.boardedGranted < rounds) {
      l.boardedGranted += 1;
      grant(l, 'boarding', 'free', BOARDING_REWARD);
    }
    // 죽은 예치 회수(get_mileage 가 부르는 mileage_reclaim — 120초 넘은 held 를 해제)
    for (const h of l.holds) if (h.state === 'held' && nowMs() - h.at > HOLD_TTL_MS) release(l, h);
  }

  function balance(l: Ledger) {
    let paid = 0;
    let free = 0;
    for (const lot of l.lots) {
      if (lot.bucket === 'paid') paid += lot.remaining;
      else free += lot.remaining;
    }
    const held = l.holds.filter((h) => h.state === 'held').reduce((s, h) => s + h.amount, 0);
    return { paid, free, total: paid + free, held };
  }

  // 쓰는 차례: 무료분 먼저 → 유료분은 먼저 산 것부터(두 로트에 걸치면 나눠 기록)
  function take(l: Ledger, amount: number): { lot: number; amt: number }[] {
    const order = [...l.lots.filter((x) => x.bucket === 'free'), ...l.lots.filter((x) => x.bucket === 'paid')].filter((x) => x.remaining > 0);
    const parts: { lot: number; amt: number }[] = [];
    let need = amount;
    for (const lot of order) {
      if (need <= 0) break;
      const t = Math.min(lot.remaining, need);
      lot.remaining -= t;
      need -= t;
      parts.push({ lot: lot.id, amt: t });
    }
    return parts;
  }
  function release(l: Ledger, h: Hold): void {
    for (const p of h.parts) {
      const lot = l.lots.find((x) => x.id === p.lot);
      if (lot) lot.remaining += p.amt;
    }
    h.state = 'released';
  }

  const gate = async (u: DemoMileageUser, key: string): Promise<RpcResult | null> => ((await o.flags(u))[key] ? null : off());

  async function getMileage(u: DemoMileageUser): Promise<RpcResult> {
    const g = await gate(u, 'mileage');
    if (g) return g;
    if (sceneOf(u) === 'mfail') return { data: null, error: { code: 'P0001', message: 'not_ready' } };
    const l = ledgerOf(u);
    await sync(u, l);
    return ok({ ok: true, state: 'ready', ...balance(l), charge_locked: sceneOf(u) === 'mbig', products: PRODUCTS.map((p) => ({ ...p })), costs: COSTS.map((c) => ({ ...c })), rules: { ...RULES } });
  }

  const iso = (ms: number): string => new Date(ms).toISOString();
  async function listHistory(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const g = await gate(u, 'mileage');
    if (g) return g;
    if (sceneOf(u) === 'mfail') return { data: null, error: { code: 'P0001', message: 'not_ready' } };
    const l = ledgerOf(u);
    await sync(u, l);
    const lim = Math.min(Math.max(typeof args.p_limit === 'number' ? Math.floor(args.p_limit) : 30, 1), 100);
    const before = typeof args.p_before === 'number' ? args.p_before : null;
    const kindOf = (lot: Lot): string => (lot.source === 'signup_gift' ? 'gift' : lot.source === 'boarding' ? 'boarding' : lot.source === 'ops_reward' ? 'ops' : lot.bucket === 'paid' ? 'demo' : 'demo');
    const items: Row[] = [];
    for (const e of l.entries) {
      if (e.kind === 'grant') {
        const lot = l.lots.find((x) => x.id === e.lot);
        if (lot) items.push({ id: e.id, at: iso(e.at), kind: kindOf(lot), amount: e.amount });
      }
    }
    for (const h of l.holds) {
      if (h.state === 'released' || h.crisis || h.amount === 0) continue;
      items.push({ id: Number(h.id.split('-')[1]), at: iso(h.at), kind: 'use', amount: -h.amount, feature: h.feature, state: h.state });
    }
    items.sort((a, b) => Number(b.id) - Number(a.id));
    const rows = items.filter((x) => before === null || Number(x.id) < before).slice(0, lim);
    return ok({ ok: true, state: 'ready', items: rows, next: rows.length === lim ? rows[lim - 1].id : null });
  }

  async function getCost(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const g = await gate(u, 'mileage');
    if (g) return g;
    const feature = args.p_feature;
    const chars = args.p_chars === undefined || args.p_chars === null ? 0 : args.p_chars;
    if (typeof feature !== 'string' || typeof chars !== 'number' || !Number.isInteger(chars) || chars < 0) return fail('invalid_value');
    const base = COSTS.find((c) => c.feature === feature)?.cost;
    if (base === undefined) return fail('unknown_feature');
    if (chars > MAX_INPUT_CHARS) return fail('too_large');
    const cost = costFor(base, chars);
    return ok({ ok: true, feature, cost, base, extra: cost - base, confirm: cost >= RULES.confirm_from });
  }

  // ── 데모 전용 ────────────────────────────────────────────────────────────
  async function charge(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const g = (await gate(u, 'mileage')) ?? (await gate(u, 'mileage_charge'));
    if (g) return g;
    if (sceneOf(u) === 'mbig') return fail('charge_locked');
    const p = PRODUCTS.find((x) => x.sku === args.p_sku);
    if (!p) return fail('unknown_product');
    const l = ledgerOf(u);
    await sync(u, l);
    grant(l, 'demo', 'paid', p.mileage);
    return ok({ ok: true, result: 'granted', total: balance(l).total });
  }

  async function hold(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const g = (await gate(u, 'mileage')) ?? (await gate(u, 'mileage_spend'));
    if (g) return g;
    const requestId = args.p_request_id;
    if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 64) return { data: null, error: { code: 'P0001', message: 'invalid_value' } };
    const base = COSTS.find((c) => c.feature === args.p_feature)?.cost;
    if (base === undefined) return { data: null, error: { code: 'P0001', message: 'unknown_feature' } };
    const chars = typeof args.p_chars === 'number' && Number.isInteger(args.p_chars) && args.p_chars >= 0 ? args.p_chars : 0;
    if (chars > MAX_INPUT_CHARS) return fail('too_large');
    const l = ledgerOf(u);
    await sync(u, l);
    const same = l.holds.find((h) => h.requestId === requestId && h.state !== 'released'); // 못 받아 해제된 요청은 같은 요청 번호로 다시 보낼 수 있다(차감 0 → 다시 예치)
    if (same) {
      if (same.feature !== args.p_feature) return { data: null, error: { code: 'P0001', message: 'request_mismatch' } };
      return ok({ ok: true, hold_id: same.id, amount: same.amount, state: same.crisis ? 'crisis_free' : same.state === 'held' ? 'held' : same.state, replay: true });
    }
    // 위기 턴: 잔액이 0이어도 막지 않고 표에 아무것도 쓰지 않는다
    if (args.p_crisis === true) return ok({ ok: true, hold_id: null, amount: 0, state: 'crisis_free' });
    const amount = costFor(base, chars);
    const have = balance(l).total;
    if (have < amount) return fail('insufficient', { need: amount, have });
    l.seq += 1;
    const h: Hold = { id: `h-${l.seq}`, requestId, feature: String(args.p_feature), amount, state: 'held', at: nowMs(), parts: take(l, amount), crisis: false };
    l.holds.push(h);
    return ok({ ok: true, hold_id: h.id, amount, state: 'held' });
  }

  async function settle(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const l = ledgerOf(u);
    const h = l.holds.find((x) => x.id === args.p_hold);
    if (!h) return { data: null, error: { code: 'P0001', message: 'not_found' } };
    if (h.state === 'released') return fail('hold_released');
    h.state = 'settled';
    return ok({ ok: true, state: 'settled', amount: h.amount });
  }

  async function releaseHold(u: DemoMileageUser, args: Row): Promise<RpcResult> {
    const l = ledgerOf(u);
    const h = l.holds.find((x) => x.id === args.p_hold);
    if (!h) return { data: null, error: { code: 'P0001', message: 'not_found' } };
    if (h.state === 'settled') return fail('hold_settled');
    if (h.state === 'held') release(l, h);
    return ok({ ok: true, state: 'released' });
  }

  const handlers: Record<string, (u: DemoMileageUser, args: Row) => Promise<RpcResult>> = {
    get_mileage: getMileage,
    list_mileage_history: listHistory,
    get_mileage_cost: getCost,
    demo_mileage_charge: charge,
    demo_mileage_hold: hold,
    demo_mileage_settle: settle,
    demo_mileage_release: releaseHold,
  };
  return {
    handles: (name: string) => name in handlers,
    rpc: (u: DemoMileageUser, name: string, args: Row = {}): Promise<RpcResult> => handlers[name](u, args),
    /** 로그아웃 · 탈퇴 · 시험: 이 회원의 장부를 비운다 */
    forget: (userId: string) => void ledgers.delete(userId),
  };
}

export type DemoMileage = ReturnType<typeof createDemoMileage>;
