// 탑승권(V5 W6 · 청사진 v5 초안 4-1 · 6-1 T1 · T2 · T3 · T5)이 서버와 주고받는 일.
//  서버는 백엔드 A(작업중 0030 티켓 · 크레딧) · C(0032 주간 배치)가 만드는 중 — 아래 이름은 **가정 이름**(app/W6_변경기록.md '서버 이름 맞출 곳'). 나오면 맞춘다.
//  get_boarding_state()  RPC(로그인) → {
//      now, round: { no, match_at(ISO, 수 18:00 KST), sale_open_at(목 00:00), sale_close_at(수 17:30) } | null,
//      phase: 'before_sale' | 'on_sale' | 'closed' | 'revealed',
//      region: { name } | null, seat: 'open' | 'full'(내 권역 · 내 성별 — 남은 수는 보내지 않는다), ticket: { round_no, bought_at, paid_with: 'store' | 'credit' } | null,
//      credits: 정수 ≥ 0, eligible: null | 'not_confirmed' | 'politics_missing' | 'paused'(살 수 없는 이유),
//      result: null | { round_no, kind: 'matched' | 'no_match', reason: 'balance' | 'no_fit' | 'gap' | null, partner_id, chat_id, partner: { name, age, region, face_photo_id } },
//      past: [{ round_no, partner_name, chat_id, open }] }
//  buy_ticket({ p_request_id, p_use_credit })  RPC → { ok: true, round_no } · 오류 sold_out · already_boarded · sale_closed · not_eligible · no_credit
//  list_credit_ledger()  RPC → { balance, items: [{ at, delta(+1 · −1), reason: 'balance' | 'no_fit' | 'gap' | 'used', round_no }] }
//  · 아는 키만 읽는다. 남은 좌석 수 · 정원 · 순번 · 점수 · 등급 같은 키는 와도 버린다(척추 4번 질문 · 재촉 0)
//  · 로그에는 이벤트 이름과 코드만
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

export type BoardingPhase = 'before_sale' | 'on_sale' | 'closed' | 'revealed';
export type Ineligible = 'not_confirmed' | 'politics_missing' | 'paused';
export type CreditReason = 'balance' | 'no_fit' | 'gap' | 'used' | 'cancelled' | 'refund_taken' | 'refund_restored'; // R-A(D-200 ④ ⑤): 탑승 취소 · 스토어 환불 회수 · 다시 줌
export type Round = { no: number; matchAt: number; saleOpenAt: number | null; saleCloseAt: number | null };
export type Ticket = { roundNo: number; boughtAt: number; paidWith: 'store' | 'credit' };
export type Partner = { name: string; age: number | null; region: { sido?: string; sigungu?: string } | null; facePhotoId: string | null };
export type RoundResult =
  | { roundNo: number; kind: 'matched'; partnerId: string; chatId: string | null; partner: Partner }
  | { roundNo: number; kind: 'no_match'; reason: Exclude<CreditReason, 'used'> | null };
export type PastMatch = { roundNo: number; partnerName: string; chatId: string | null; open: boolean };
export type BoardingState = {
  now: number;
  offset: number; // 서버 시각 − 기기 시각
  round: Round | null;
  phase: BoardingPhase;
  regionName: string | null;
  seat: 'open' | 'full';
  ticket: Ticket | null;
  credits: number;
  ineligible: Ineligible | null;
  result: RoundResult | null;
  past: PastMatch[];
};
export type BoardingFailure = 'network' | 'server' | 'missing' | 'session';
export type BoardingLoad = { ok: true; state: BoardingState } | { ok: false; reason: BoardingFailure };
export type BuyFailure = 'sold_out' | 'already' | 'closed' | 'not_eligible' | 'no_credit' | 'network' | 'server';
export type BuyResult = { ok: true; roundNo: number } | { ok: false; reason: BuyFailure };
export type CreditItem = { at: number; delta: number; reason: CreditReason; roundNo: number | null };
export type CreditLoad = { ok: true; balance: number; items: CreditItem[] } | { ok: false; reason: BoardingFailure };

export const BOARDING_RPC = 'get_boarding_state'; // 가정 이름(0030 · 0032)
export const BUY_TICKET_RPC = 'buy_ticket'; // 가정 이름(0030)
export const CREDIT_LEDGER_RPC = 'list_credit_ledger'; // 가정 이름(0030)
export const CANCEL_TICKET_RPC = 'cancel_ticket_seat'; // 백엔드 R_변경기록 3장 0037 B 설계 이름 public.cancel_ticket_seat(round) — 인자 이름 p_round_no 는 앱 제안(미확인). cancel_ticket_seat(p_round_no) → { ok, refund: 'store' | 'credit' } · 오류 sale_closed · not_boarded. 백엔드 0037 에서 맞춘다
export type CancelResult = { ok: true; refund: 'store' | 'credit' } | { ok: false; reason: 'closed' | 'network' | 'server' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

function readRound(raw: unknown): Round | null {
  if (!isRecord(raw)) return null;
  const no = int(raw.no);
  const matchAt = time(raw.match_at);
  if (no === null || no < 1 || matchAt === null) return null;
  return { no, matchAt, saleOpenAt: time(raw.sale_open_at), saleCloseAt: time(raw.sale_close_at) };
}

function readResult(raw: unknown): RoundResult | null {
  if (!isRecord(raw)) return null;
  const roundNo = int(raw.round_no);
  if (roundNo === null) return null;
  if (raw.kind === 'matched') {
    const partnerId = str(raw.partner_id);
    const p = isRecord(raw.partner) ? raw.partner : null;
    const name = str(p?.name);
    if (!partnerId || !p || !name) return null;
    const region = isRecord(p.region) ? { sido: str(p.region.sido) ?? undefined, sigungu: str(p.region.sigungu) ?? undefined } : null;
    return { roundNo, kind: 'matched', partnerId, chatId: str(raw.chat_id), partner: { name, age: int(p.age), region, facePhotoId: str(p.face_photo_id) } };
  }
  if (raw.kind === 'no_match') return { roundNo, kind: 'no_match', reason: pick(raw.reason, ['balance', 'no_fit', 'gap'] as const) };
  return null;
}

export function parseBoarding(raw: unknown, deviceNow: number): BoardingState | null {
  if (!isRecord(raw)) return null;
  const now = time(raw.now) ?? deviceNow;
  const ticketRaw = isRecord(raw.ticket) ? raw.ticket : null;
  const ticketRound = int(ticketRaw?.round_no);
  const ticket: Ticket | null = ticketRaw && ticketRound !== null ? { roundNo: ticketRound, boughtAt: time(ticketRaw.bought_at) ?? now, paidWith: ticketRaw.paid_with === 'credit' ? 'credit' : 'store' } : null;
  const past = Array.isArray(raw.past)
    ? raw.past
        .filter(isRecord)
        .map((p) => ({ roundNo: int(p.round_no) ?? 0, partnerName: str(p.partner_name) ?? '', chatId: str(p.chat_id), open: p.open === true }))
        .filter((p) => p.roundNo > 0 && p.partnerName !== '')
    : [];
  const credits = int(raw.credits);
  return {
    now,
    offset: now - deviceNow,
    round: readRound(raw.round),
    phase: pick(raw.phase, ['before_sale', 'on_sale', 'closed', 'revealed'] as const) ?? 'closed', // 모르는 값은 살 수 없는 쪽
    regionName: isRecord(raw.region) ? str(raw.region.name) : null,
    seat: raw.seat === 'full' ? 'full' : 'open',
    ticket,
    credits: credits !== null && credits > 0 ? credits : 0,
    ineligible: pick(raw.eligible, ['not_confirmed', 'politics_missing', 'paused'] as const),
    result: readResult(raw.result),
    past,
  };
}

export function parseLedger(raw: unknown): { balance: number; items: CreditItem[] } | null {
  if (!isRecord(raw)) return null;
  const balance = int(raw.balance);
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter(isRecord)
    .map((x) => ({ at: time(x.at), delta: int(x.delta), reason: pick(x.reason, ['balance', 'no_fit', 'gap', 'used', 'cancelled', 'refund_taken', 'refund_restored'] as const), roundNo: int(x.round_no) }))
    .filter((x): x is CreditItem => x.at !== null && x.delta !== null && x.delta !== 0 && x.reason !== null)
    .sort((a, b) => b.at - a.at);
  return { balance: balance !== null && balance > 0 ? balance : 0, items };
}

const loadFailure = (error: { code?: string | null; message?: string | null }, event: string): BoardingFailure => {
  const f = readDbFailure(error);
  safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
  if (f.network) return 'network';
  if (f.code === 'PGRST202' || f.code === '42883') return 'missing';
  if (f.code === '42501' || f.code === 'PGRST301' || f.code === 'PGRST303') return 'session';
  return 'server';
};

export function createBoardingApi(client: Pick<SupabaseClient, 'rpc'>, deviceNow: () => number = Date.now) {
  return {
    async load(): Promise<BoardingLoad> {
      const { data, error } = await client.rpc(BOARDING_RPC);
      if (error) return { ok: false, reason: loadFailure(error, 'boarding.load.fail') };
      const state = parseBoarding(data, deviceNow());
      return state ? { ok: true, state } : { ok: false, reason: data === null ? 'session' : 'server' };
    },
    async buy(requestId: string, useCredit: boolean): Promise<BuyResult> {
      const { data, error } = await client.rpc(BUY_TICKET_RPC, { p_request_id: requestId, p_use_credit: useCredit });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'boarding.buy.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        if (f.network) return { ok: false, reason: 'network' };
        const m = String(error.message ?? '');
        if (m === 'sold_out') return { ok: false, reason: 'sold_out' };
        if (m === 'already_boarded') return { ok: false, reason: 'already' };
        if (m === 'sale_closed') return { ok: false, reason: 'closed' };
        if (m === 'not_eligible') return { ok: false, reason: 'not_eligible' };
        if (m === 'no_credit') return { ok: false, reason: 'no_credit' };
        return { ok: false, reason: 'server' };
      }
      const roundNo = isRecord(data) ? int(data.round_no) : null;
      return isRecord(data) && data.ok === true && roundNo !== null ? { ok: true, roundNo } : { ok: false, reason: 'server' };
    },
    // T2 [탑승 취소](마감 전만). 마감이 지났거나 탄 적이 없으면 closed(화면은 마감 글 + 다시 읽기)
    async cancel(roundNo: number): Promise<CancelResult> {
      const { data, error } = await client.rpc(CANCEL_TICKET_RPC, { p_round_no: roundNo });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'boarding.cancel.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        if (f.network) return { ok: false, reason: 'network' };
        const m = String(error.message ?? '');
        return { ok: false, reason: m === 'sale_closed' || m === 'not_boarded' ? 'closed' : 'server' };
      }
      return isRecord(data) && data.ok === true ? { ok: true, refund: data.refund === 'credit' ? 'credit' : 'store' } : { ok: false, reason: 'server' };
    },
    async ledger(): Promise<CreditLoad> {
      const { data, error } = await client.rpc(CREDIT_LEDGER_RPC);
      if (error) return { ok: false, reason: loadFailure(error, 'boarding.ledger.fail') };
      const parsed = parseLedger(data);
      return parsed ? { ok: true, ...parsed } : { ok: false, reason: 'server' };
    },
  };
}

export type BoardingApi = ReturnType<typeof createBoardingApi>;
