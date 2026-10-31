// 마일리지가 서버와 주고받는 일(IF5-F2 ⑨ · D-237). 서버 = backend/migrations/0048_mileage_saju.sql 앱 함수 셋(읽기뿐 · 응답 모양 = backend/R_변경기록.md 16-2 · 16-3):
//   get_mileage()                       → {ok, state ready, paid, free, total, held, charge_locked, products[{sku,price,mileage}], costs[{feature,label,cost}], rules{confirm_from,length_free_chars,length_step_chars,length_step_cost}}
//   list_mileage_history(p_before,p_limit) → {ok, items[{id,at,kind charge|gift|boarding|ops|demo|use|recovered|restored,amount,feature?,state?}], next}
//   get_mileage_cost(p_feature,p_chars) → {ok, feature, cost, base, extra, confirm} | {ok:false, code invalid_value|unknown_feature|too_large}
//   오류: DB 오류 forbidden(42501) · feature_off(42501)
//  · 값(상품 · 가격 · 차감표 · 규칙 · 잔액)은 이 응답을 그대로 읽는다 — 앱 코드에 마일리지 수 · 가격 · 차감 하드코딩 0, 잔액 계산 0, 낙관적 차감 표시 0(IFF5-02 · 08)
//  · 앱이 서버에 보내는 것은 {기능 이름 · 입력 글자 수 · 상품 번호 · 요청 번호}뿐이다 — 인자 이름에 amount · delta · balance · price · qty · user 0(IC5-01)
//  · 충전: 스토어 결제 호출 0(consumeAsync · acknowledgePurchase 0). P0 는 데모 모의 서버의 가상 충전(demo_mileage_charge)만 — 진짜 서버에는 없는 이름이다
//  · 앱 자동 재시도 0(IFF5-06). 로그에는 이벤트 이름과 코드만
import type { RpcCall } from '@/features/inflight/inflightApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const MILEAGE_FAIL_CODES = ['feature_off', 'forbidden', 'network', 'not_ready', 'invalid_value', 'unknown_feature', 'too_large', 'charge_locked', 'unknown_product'] as const;
export type MileageFailCode = (typeof MILEAGE_FAIL_CODES)[number];
export type MileageFail = { ok: false; code: MileageFailCode };
export type MileageResult<T> = { ok: true; data: T } | MileageFail;

export type MileageProduct = { sku: string; price: number; mileage: number };
export type MileageCostRow = { feature: string; label: string; cost: number };
export type MileageRules = { confirmFrom: number; freeChars: number; stepChars: number; stepCost: number };
export type MileageState = { paid: number; free: number; total: number; held: number; chargeLocked: boolean; products: MileageProduct[]; costs: MileageCostRow[]; rules: MileageRules };

export const HISTORY_KINDS = ['charge', 'gift', 'boarding', 'ops', 'demo', 'use', 'recovered', 'restored'] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];
export type HistoryItem = { id: number; at: string; kind: HistoryKind; amount: number; feature: string | null; state: string | null };
export type MileageHistory = { items: HistoryItem[]; next: number | null };
export type CostInfo = { feature: string; cost: number; base: number; extra: number; confirm: boolean };

export function parseMileageState(raw: unknown): MileageState | null {
  if (!isRecord(raw) || raw.state !== 'ready') return null;
  const paid = int(raw.paid);
  const free = int(raw.free);
  const total = int(raw.total);
  const held = int(raw.held);
  const r = isRecord(raw.rules) ? raw.rules : null;
  if (paid === null || free === null || total === null || held === null || !r) return null;
  const confirmFrom = int(r.confirm_from);
  const freeChars = int(r.length_free_chars);
  const stepChars = int(r.length_step_chars);
  const stepCost = int(r.length_step_cost);
  if (confirmFrom === null || freeChars === null || stepChars === null || stepCost === null) return null;
  const products = arr(raw.products).flatMap((p) => {
    if (!isRecord(p)) return [];
    const sku = str(p.sku);
    const price = int(p.price);
    const mileage = int(p.mileage);
    return sku && price !== null && mileage !== null && price > 0 && mileage > 0 ? [{ sku, price, mileage }] : [];
  });
  const costs = arr(raw.costs).flatMap((c) => {
    if (!isRecord(c)) return [];
    const feature = str(c.feature);
    const label = str(c.label);
    const cost = int(c.cost);
    return feature && label && cost !== null && cost > 0 ? [{ feature, label, cost }] : [];
  });
  return { paid, free, total, held, chargeLocked: raw.charge_locked === true, products, costs, rules: { confirmFrom, freeChars, stepChars, stepCost } };
}

export function parseHistory(raw: unknown): MileageHistory | null {
  if (!isRecord(raw) || raw.state !== 'ready') return null;
  const items = arr(raw.items).flatMap((x) => {
    if (!isRecord(x)) return [];
    const id = int(x.id);
    const at = str(x.at);
    const amount = int(x.amount);
    const kind = (HISTORY_KINDS as readonly string[]).includes(String(x.kind)) ? (x.kind as HistoryKind) : null;
    return id !== null && at && amount !== null && kind ? [{ id, at, kind, amount, feature: str(x.feature), state: str(x.state) }] : [];
  });
  return { items, next: int(raw.next) };
}

export function parseCost(raw: unknown): CostInfo | null {
  if (!isRecord(raw)) return null;
  const feature = str(raw.feature);
  const cost = int(raw.cost);
  const base = int(raw.base);
  const extra = int(raw.extra);
  if (!feature || cost === null || base === null || extra === null || typeof raw.confirm !== 'boolean') return null;
  return { feature, cost, base, extra, confirm: raw.confirm };
}

export type MileageApi = {
  state(): Promise<MileageResult<MileageState>>;
  history(before?: number | null): Promise<MileageResult<MileageHistory>>;
  cost(feature: string, chars: number): Promise<MileageResult<CostInfo>>;
  /** P0 가상 충전(데모 모의 서버만). 스토어 결제 호출 0 */
  charge(sku: string): Promise<MileageResult<{ total: number }>>;
};

export function createMileageApi(call: RpcCall): MileageApi {
  async function read<T>(fn: string, args: Rec, parse: (d: unknown) => T | null, event: string): Promise<MileageResult<T>> {
    let res: Awaited<ReturnType<RpcCall>>;
    try {
      res = await call(fn, args);
    } catch {
      return { ok: false, code: 'network' };
    }
    if (res.error) {
      const f = readDbFailure(res.error);
      safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
      if (f.network) return { ok: false, code: 'network' };
      const head = String(res.error.message ?? '').split(':')[0].trim();
      if (head === 'feature_off') return { ok: false, code: 'feature_off' };
      if (f.code === '42501' || head === 'forbidden') return { ok: false, code: 'forbidden' };
      return { ok: false, code: 'not_ready' };
    }
    const d = res.data;
    if (isRecord(d) && d.ok === false) {
      const code = MILEAGE_FAIL_CODES.find((c) => c === d.code);
      return { ok: false, code: code ?? 'not_ready' };
    }
    const v = parse(d);
    return v === null ? { ok: false, code: 'not_ready' } : { ok: true, data: v };
  }
  return {
    state: () => read('get_mileage', {}, parseMileageState, 'mileage.get.fail'),
    history: (before) => read('list_mileage_history', { p_before: before ?? null, p_limit: 30 }, parseHistory, 'mileage.history.fail'),
    cost: (feature, chars) => read('get_mileage_cost', { p_feature: feature, p_chars: Math.max(0, Math.floor(chars)) }, parseCost, 'mileage.cost.fail'),
    charge: (sku) =>
      read(
        'demo_mileage_charge',
        { p_sku: sku },
        (d) => {
          const total = isRecord(d) ? int(d.total) : null;
          return isRecord(d) && d.result === 'granted' && total !== null ? { total } : null;
        },
        'mileage.charge.fail',
      ),
  };
}
