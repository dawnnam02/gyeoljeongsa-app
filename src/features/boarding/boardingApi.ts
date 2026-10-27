// 탑승권(V5 W6 · 청사진 v5 4-1 · 6-1 T1 · T2 · T3 · T5)이 서버와 주고받는 일. 이름 · 인자 · 응답 = 백엔드 확정 정의(3부-바, 10-27 — 읽기만 대조):
//  get_ticket_state()  0030 [5] · 0039 → { price_krw, payment_mode, round{ round_no, match_day 'YYYY-MM-DD', match_weekday, match_time 'HH:MI', match_text, sale_open_at, sale_close_at, close_text,
//      sale_state before | open | closed | ended } | null, seat{ state held | boarded | matched | returned, paid_by purchase | credit, hold_until, boarded_at, return_reason } | null,
//      region(권역 글), can_board, reason(ticket_board_check 사유 | null), reason_detail(0039 — reason 이 profile_incomplete 일 때 profile_missing · politics_missing ·
//      grade_paused · grade_pending · religion_missing, 그 밖 null), credit{ balance, next_expire_on } }  — 정원 · 남은 좌석 · 인원 키 없음
//  get_weekly_match()  0032 [6] → { off: true } | { state none | waiting | matched | not_found, round_no, match_at } + matched{ partner_id, room_id, partner(공개 범위 답 A12 · A01 · A03 …) } · not_found{ credited }
//  hold_ticket_seat({ p_round_no })  0030 · 0039 → { ok, reason, reason_detail, round_no, hold_until } — 결제 창 열기 전 자리 잡기(10분). 그 회차 계약 설명 확인 기록이 없으면 reason contract_ack_required
//  release_ticket_hold()  0030 → { released } — 결제가 끝나지 못했을 때 잡은 자리 놓기
//  demo_buy_ticket({ p_request_id uuid })  0030 · 0039 → { result boarded | credited | already_granted, round_no, tx_id, reason?, outcome? } · 오류 closed · demo_not_allowed · invalid_request · no_hold · forbidden · contract_ack_required
//      (payment_mode = demo 일 때만. 스토어 결제 · 영수증 검증은 W7 — 법인 뒤)
//  board_with_credit({ p_round_no })  0030 · 0039 → { ok, reason, reason_detail, round_no, paid_by } · reason contract_ack_required(확인 기록 없음)
//  list_ticket_history()  0030 · 0037 R37 → { tickets[{ round_no, match_day, state, paid_by, price_krw, boarded_at, return_reason }],
//      credits[{ id, reason, round_no, created_at, expires_on(R37 늘 null), state open | used | expired | revoked | held(0039 — B안 해지로 R41 에 옮긴 장), used_round_no }], balance }
//  cancel_ticket_seat({ p_round_no })  0037 [4] → { ok, round_no, paid_by, result 'credited', lot_id } · 오류 closed · not_found
//  ack_ticket_contract({ p_round_no, p_text_version })  0037 [9] · 0039 → { ok } · 판은 'contract-5-8-' + 16진 8자만(그 밖 invalid_value) — 잡기 · 데모 결제 · 크레딧 탑승의 관문
//  · 아는 키만 읽는다. 남은 좌석 수 · 정원 · 순번 · 점수 · 등급 같은 키는 와도 버린다(척추 4번 질문 · 재촉 0)
//  · 크레딧 끝나는 날(credit.next_expire_on · credits[].expires_on)은 읽지 않는다 — 0037 뒤 기한 없음(D-200 ③), 화면에 날짜 칸 0
//  · 로그에는 이벤트 이름과 코드만
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

export type BoardingPhase = 'before_sale' | 'on_sale' | 'closed' | 'revealed';
export type Ineligible = 'not_confirmed' | 'politics_missing' | 'paused';
// T5 내역 글 키(카피 14-5-2 · 14-7 CREDITS.reasons). 서버 장부 사유 → 이 키는 아래 LOT_REASON
export type CreditReason = 'balance' | 'no_fit' | 'gap' | 'used' | 'cancelled' | 'refund_taken' | 'refund_restored' | 'paid_no_seat' | 'round_cancelled' | 'admin' | 'age_rejoin_restore';
export type Round = { no: number; matchAt: number; saleOpenAt: number | null; saleCloseAt: number | null };
export type Ticket = { roundNo: number; boughtAt: number; paidWith: 'store' | 'credit' };
export type Partner = { name: string; age: number | null; region: { sido?: string; sigungu?: string } | null; facePhotoId: string | null };
export type RoundResult =
  | { roundNo: number; kind: 'matched'; partnerId: string; chatId: string | null; partner: Partner }
  | { roundNo: number; kind: 'no_match'; reason: Exclude<CreditReason, 'used'> | null };
export type PastMatch = { roundNo: number; partnerName: string; chatId: string | null; open: boolean };
export type BoardingState = {
  now: number;
  offset: number; // 서버 시각 − 기기 시각(서버 0030 은 시각을 보내지 않아 0 — 데모만 장면 시각)
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
// credited = 결제는 됐지만 자리를 못 줘 크레딧 1장(0030 paid_no_seat) — 화면은 크레딧 안내 한 줄
// ack_required = 0039 관문: 그 회차 계약 설명 확인 기록이 없음(contract_ack_required). 화면은 확인 기록을 다시 남기고 한 번만 다시 부른다 — 그래도 나면 일반 오류 글('server')
export type BuyFailure = 'sold_out' | 'already' | 'closed' | 'not_eligible' | 'no_credit' | 'credited' | 'ack_required' | 'network' | 'server';
export type BuyResult = { ok: true; roundNo: number } | { ok: false; reason: BuyFailure };
// at = 화면에 적을 날짜(모르면 null — 쓴 날 · 회수한 날은 서버가 주지 않는 때가 있다)
export type CreditItem = { at: number | null; delta: number; reason: CreditReason; roundNo: number | null };
export type CreditLoad = { ok: true; balance: number; items: CreditItem[] } | { ok: false; reason: BoardingFailure };

export const TICKET_STATE_RPC = 'get_ticket_state';
export const WEEKLY_MATCH_RPC = 'get_weekly_match';
export const HOLD_SEAT_RPC = 'hold_ticket_seat';
export const RELEASE_HOLD_RPC = 'release_ticket_hold';
export const DEMO_BUY_RPC = 'demo_buy_ticket';
export const BOARD_CREDIT_RPC = 'board_with_credit';
export const TICKET_HISTORY_RPC = 'list_ticket_history';
// 0037 확정(D-202): public.cancel_ticket_seat(p_round_no integer) → { ok, round_no, paid_by, result: 'credited', lot_id }
//  · 결제로 탔든 크레딧으로 탔든 크레딧 1장(기한 없음) — 돈은 회원이 결제한 스토어에 직접 요청. 오류 closed(마감 · 공개 뒤) · not_found(이 회차에 탄 자리 없음) · forbidden · invalid_value
export const CANCEL_TICKET_RPC = 'cancel_ticket_seat';
export type CancelResult = { ok: true; roundNo: number; credited: boolean } | { ok: false; reason: 'closed' | 'network' | 'server' };
// 0037 [9] H 계약 설명 확인 기록(R40 · 약관 제14조의2 ③): ack_ticket_contract(p_round_no integer, p_text_version text 4 ~ 60자) → { ok } · 오류 invalid_value · forbidden
//  T1 결제 시트의 계약 요약 블록을 보인 뒤, 결제(구매 · 크레딧 탑승) 바로 전에 부른다. 기록이 남지 않으면 결제로 넘어가지 않는다
export const ACK_CONTRACT_RPC = 'ack_ticket_contract';
export type AckResult = { ok: true } | { ok: false; reason: 'network' | 'server' };
// 10 상대 프로필(사진 id 를 얻는 곳). 공개 사진은 get_weekly_match 에 없다
export const CANDIDATE_RPC = 'get_candidate_profile';

// 서버 장부 사유(0030 · 0037 [3] · 0038 [2]) → T5 글 키. D46-A 덧붙임(10-27): 카피 14-7 확정 4줄(paid_no_seat · round_cancelled · admin · age_rejoin_restore)도 그린다.
//  표에 없는 사유는 그 장(+1 · 그 장을 쓴 −1)을 그리지 않는다: age_terminate(해지 계정 — 화면 0)
export const LOT_REASON: Readonly<Record<string, CreditReason>> = {
  unbalanced: 'balance',
  no_match: 'no_fit',
  grade_gap: 'gap',
  cancel_return: 'cancelled', // 크레딧으로 탄 자리 취소(0037 B)
  cancel_credit: 'cancelled', // 결제로 탄 자리 취소 → 크레딧(0037 B · D-202)
  refund_reversed: 'refund_restored', // 스토어 환불 취소로 다시 지급(0037 C)
  paid_no_seat: 'paid_no_seat', // 결제 뒤 자리 없음(0030) — 카피 14-7 CREDITS.reason.paidNoSeat
  round_cancelled: 'round_cancelled', // 회차가 열리지 않음 — CREDITS.reason.roundCancelled
  admin: 'admin', // 고객센터에서 바로잡음(늘거나 줄어도 같은 글) — CREDITS.reason.admin
  age_rejoin_restore: 'age_rejoin_restore', // 다시 가입해 이어받음 — CREDITS.reason.ageRejoinRestore
};
export const LOT_REASON_COPY_PENDING = ['age_terminate'] as const;
// 서버 회차 판매 상태 → 화면 단계 · 탈 수 없는 사유 → 화면 글. 모르는 값은 살 수 없는 쪽(closed)
const PHASE: Readonly<Record<string, BoardingPhase>> = { before: 'before_sale', open: 'on_sale', closed: 'closed', ended: 'revealed' };
const INELIGIBLE: Readonly<Record<string, Ineligible>> = { state: 'not_confirmed', review_pending: 'not_confirmed' };
// profile_incomplete(정치 · 등급 · 종교 · 성별 · 지역 중 빈 것)는 0039 reason_detail 로 가른다(3부-사). 글이 있는 상세만 그 글,
//  모르는 상세 · 상세 없음(0039 전 서버) · 글이 아직 없는 상세(profile_missing · grade_pending · religion_missing — 카피 대기)는 일반 안내('확정을 마치면 탈 수 있어요') — 빈 화면 0
const INELIGIBLE_DETAIL: Readonly<Record<string, Ineligible>> = { politics_missing: 'politics_missing', grade_paused: 'paused' };
export function ineligibleOf(reason: unknown, detail: unknown): Ineligible | null {
  if (reason === 'profile_incomplete') return fromMap(INELIGIBLE_DETAIL, detail) ?? 'not_confirmed';
  return fromMap(INELIGIBLE, reason);
}
// hold · board_with_credit 의 사유(ticket_board_check · payment_closed · no_credit) → 결제 오류 글
const BUY_REASON: Readonly<Record<string, BuyFailure>> = {
  full: 'sold_out',
  already_boarded: 'already',
  closed: 'closed',
  before_sale: 'closed',
  sale_off: 'closed',
  no_round: 'closed',
  region_closed: 'closed',
  payment_closed: 'closed',
  state: 'not_eligible',
  review_pending: 'not_eligible',
  profile_incomplete: 'not_eligible',
  no_credit: 'no_credit',
  contract_ack_required: 'ack_required', // 0039 계약 설명 확인 관문
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fromMap = <T>(m: Readonly<Record<string, T>>, v: unknown): T | null => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(m, v) ? m[v] : null);
const pick = <T extends string>(v: unknown, options: readonly T[]): T | null => (typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const rows = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : []);

// 회차: 공개 시각 = match_day + match_time(한국 시각). 판매 시작 · 마감은 시각 값 그대로
function readRound(raw: unknown): Round | null {
  if (!isRecord(raw)) return null;
  const no = int(raw.round_no);
  const day = str(raw.match_day);
  const hm = str(raw.match_time);
  const matchAt = day && hm && /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(hm) ? time(`${day}T${hm}:00+09:00`) : null;
  if (no === null || no < 1 || matchAt === null) return null;
  return { no, matchAt, saleOpenAt: time(raw.sale_open_at), saleCloseAt: time(raw.sale_close_at) };
}

// get_ticket_state → 화면 상태(공개 결과 · 지난 대화는 get_weekly_match 가 채운다)
export function parseTicketState(raw: unknown, deviceNow: number): BoardingState | null {
  if (!isRecord(raw)) return null;
  const now = time(raw.now) ?? deviceNow; // 서버 0030 에는 없는 키 — 데모만 장면 시각을 보낸다
  const round = readRound(raw.round);
  const reason = typeof raw.reason === 'string' ? raw.reason : null;
  const seat = isRecord(raw.seat) ? raw.seat : null;
  const boarded = pick(seat?.state, ['boarded', 'matched', 'returned'] as const); // held(잡기만 함)는 탑승권이 아니다
  const ticket: Ticket | null = round && seat && boarded ? { roundNo: round.no, boughtAt: time(seat.boarded_at) ?? now, paidWith: seat.paid_by === 'credit' ? 'credit' : 'store' } : null;
  const balance = isRecord(raw.credit) ? int(raw.credit.balance) : null;
  return {
    now,
    offset: now - deviceNow,
    round,
    phase: fromMap(PHASE, isRecord(raw.round) ? raw.round.sale_state : null) ?? 'closed',
    regionName: str(raw.region),
    seat: reason === 'full' ? 'full' : 'open',
    ticket,
    credits: balance !== null && balance > 0 ? balance : 0,
    ineligible: ineligibleOf(reason, raw.reason_detail),
    result: null,
    past: [],
  };
}

// get_weekly_match → 공개 결과. 공개 전(waiting) · 탄 회차 없음(none) · 스위치 꺼짐(off)은 null. 이유 코드는 서버도 보내지 않는다(명세 7장 결정 5)
export function parseWeeklyMatch(raw: unknown): RoundResult | null {
  if (!isRecord(raw) || raw.off === true) return null;
  const roundNo = int(raw.round_no);
  if (roundNo === null) return null;
  if (raw.state === 'not_found') return { roundNo, kind: 'no_match', reason: null };
  if (raw.state !== 'matched') return null;
  const partnerId = str(raw.partner_id);
  const a = isRecord(raw.partner) ? raw.partner : null; // 공개 범위 답(visible_answers): A12 가린 이름 · A01 나이 · A03 지역
  const name = str(a?.A12);
  if (!partnerId || !a || !name) return null;
  const sido = isRecord(a.A03) ? str(a.A03.sido) : str(a.A03);
  const sigungu = isRecord(a.A03) ? str(a.A03.sigungu) : null;
  const region = sido ? { sido, ...(sigungu ? { sigungu } : {}) } : null;
  return { roundNo, kind: 'matched', partnerId, chatId: str(raw.room_id), partner: { name, age: int(a.A01), region, facePhotoId: null } };
}

// list_ticket_history → T5 내역(+1 = 받은 장 · −1 = 그 장을 씀 · 스토어 환불로 회수). 새것부터
//  0039 state 'held'(B안 해지로 R41 에 옮긴 장 — 재가입 때 이어 줌)는 해지 계정의 장이라 그 장(+1)과 옮긴 줄을 모두 그리지 않는다(age_terminate 와 같은 '화면 0',
//  잔액에도 들지 않음 — 서버 balance 그대로). 모르는 state 도 받은 줄(+1)만 그린다(빈 화면 0)
export function parseHistory(raw: unknown): { balance: number; items: CreditItem[] } | null {
  if (!isRecord(raw) || !Array.isArray(raw.credits)) return null;
  const tickets = rows(raw.tickets);
  const boardedAt = (roundNo: number | null) => {
    const t = tickets.find((x) => int(x.round_no) === roundNo && x.paid_by === 'credit');
    return t ? time(t.boarded_at) : null;
  };
  const out: (CreditItem & { key: number; seq: number })[] = [];
  for (const l of rows(raw.credits)) {
    const reason = fromMap(LOT_REASON, l.reason);
    const at = time(l.created_at);
    if (!reason || at === null || l.state === 'held') continue;
    const seq = (int(l.id) ?? 0) * 2;
    const roundNo = int(l.round_no);
    out.push({ at, delta: 1, reason, roundNo, key: at, seq });
    if (l.state === 'used') {
      const usedRound = int(l.used_round_no);
      const usedAt = boardedAt(usedRound); // 그 회차에 크레딧으로 탄 시각(자리를 취소했으면 모름)
      out.push({ at: usedAt, delta: -1, reason: 'used', roundNo: usedRound, key: Math.max(usedAt ?? at, at), seq: seq + 1 });
    } else if (l.state === 'revoked') {
      out.push({ at: null, delta: -1, reason: 'refund_taken', roundNo, key: at, seq: seq + 1 });
    }
  }
  out.sort((a, b) => b.key - a.key || b.seq - a.seq);
  const balance = int(raw.balance);
  return { balance: balance !== null && balance > 0 ? balance : 0, items: out.map(({ at, delta, reason, roundNo }) => ({ at, delta, reason, roundNo })) };
}

const loadFailure = (error: { code?: string | null; message?: string | null }, event: string): BoardingFailure => {
  const f = readDbFailure(error);
  safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
  if (f.network) return 'network';
  if (f.code === 'PGRST202' || f.code === '42883') return 'missing';
  if (f.code === '42501' || f.code === 'PGRST301' || f.code === 'PGRST303') return 'session';
  return 'server';
};

const buyFailure = (error: { code?: string | null; message?: string | null }): BuyFailure => {
  const f = readDbFailure(error);
  safeLog({ event: 'boarding.buy.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
  if (f.network) return 'network';
  const m = String(error.message ?? '');
  return m === 'closed' ? 'closed' : m === 'contract_ack_required' ? 'ack_required' : 'server'; // 0039 demo_buy_ticket 관문은 예외로 온다
};

type Rpc = Pick<SupabaseClient, 'rpc'>;
type RpcAnswer = { data: unknown; error: { code?: string | null; message?: string | null } | null };
const call = async (client: Rpc, name: string, args?: Record<string, unknown>): Promise<RpcAnswer> => (await client.rpc(name, args)) as unknown as RpcAnswer;

export function createBoardingApi(client: Rpc, deviceNow: () => number = Date.now) {
  return {
    // 탑승권 화면 상태 = get_ticket_state + get_weekly_match. 공개 결과를 못 읽어도 탑승권 화면은 그린다(결과 없음)
    async load(): Promise<BoardingLoad> {
      const weekly = call(client, WEEKLY_MATCH_RPC).catch((): RpcAnswer => ({ data: null, error: { message: 'weekly' } }));
      const [t, w] = await Promise.all([call(client, TICKET_STATE_RPC), weekly]);
      if (t.error) return { ok: false, reason: loadFailure(t.error, 'boarding.load.fail') };
      const state = parseTicketState(t.data, deviceNow());
      if (!state) return { ok: false, reason: t.data === null ? 'session' : 'server' };
      if (w.error) safeLog({ event: 'boarding.weekly.fail', code: readDbFailure(w.error).code ?? 'unknown' });
      const result = w.error ? null : parseWeeklyMatch(w.data);
      const past = result?.kind === 'matched' ? [{ roundNo: result.roundNo, partnerName: result.partner.name, chatId: result.chatId, open: true }] : [];
      return { ok: true, state: { ...state, result, past } };
    },
    // [결제하기]: 자리 잡기 → 데모 결제(같은 요청 ID 는 한 번). [크레딧 1장으로 타기]: board_with_credit 하나
    async buy(requestId: string, useCredit: boolean, roundNo: number): Promise<BuyResult> {
      if (useCredit) {
        const { data, error } = await call(client, BOARD_CREDIT_RPC, { p_round_no: roundNo });
        if (error) return { ok: false, reason: buyFailure(error) };
        if (!isRecord(data)) return { ok: false, reason: 'server' };
        if (data.ok === true) return { ok: true, roundNo: int(data.round_no) ?? roundNo };
        return { ok: false, reason: fromMap(BUY_REASON, data.reason) ?? 'server' };
      }
      const hold = await call(client, HOLD_SEAT_RPC, { p_round_no: roundNo });
      if (hold.error) return { ok: false, reason: buyFailure(hold.error) };
      if (!isRecord(hold.data)) return { ok: false, reason: 'server' };
      if (hold.data.ok !== true) return { ok: false, reason: fromMap(BUY_REASON, hold.data.reason) ?? 'server' };
      const paid = await call(client, DEMO_BUY_RPC, { p_request_id: requestId });
      if (paid.error) {
        void call(client, RELEASE_HOLD_RPC).catch(() => undefined); // 잡은 자리를 놓는다(10분 뒤 저절로도 풀림)
        return { ok: false, reason: buyFailure(paid.error) };
      }
      const d = isRecord(paid.data) ? paid.data : null;
      const r = int(d?.round_no) ?? roundNo;
      if (d?.result === 'boarded' || (d?.result === 'already_granted' && d.outcome === 'seat')) return { ok: true, roundNo: r };
      if (d?.result === 'credited' || (d?.result === 'already_granted' && d.outcome === 'credit')) return { ok: false, reason: 'credited' };
      return { ok: false, reason: 'server' };
    },
    // T2 [탑승 취소](마감 전만). 마감이 지났거나(closed) 이 회차에 탄 자리가 없으면(not_found) closed(화면은 마감 글 + 다시 읽기)
    //  성공 = result 'credited'(크레딧 1장). 돌려받는 길은 하나라 paid_by · lot_id 는 읽지 않는다(확인창 글은 화면 상태의 탄 방법으로 고른다)
    async cancel(roundNo: number): Promise<CancelResult> {
      const { data, error } = await call(client, CANCEL_TICKET_RPC, { p_round_no: roundNo });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'boarding.cancel.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        if (f.network) return { ok: false, reason: 'network' };
        const m = String(error.message ?? '');
        return { ok: false, reason: m === 'closed' || m === 'not_found' ? 'closed' : 'server' };
      }
      if (!isRecord(data) || data.ok !== true) return { ok: false, reason: 'server' };
      return { ok: true, roundNo: int(data.round_no) ?? roundNo, credited: data.result === 'credited' };
    },
    // T1 계약 설명 확인 기록(R40). 같은 회차에 여러 번 불러도 된다(서버는 줄을 더하고, 거래가 생기면 가장 최근 줄에 거래 번호를 잇는다)
    async ackContract(roundNo: number, textVersion: string): Promise<AckResult> {
      const { data, error } = await call(client, ACK_CONTRACT_RPC, { p_round_no: roundNo, p_text_version: textVersion });
      if (error) {
        const f = readDbFailure(error);
        safeLog({ event: 'boarding.ack.fail', code: f.code ?? (f.network ? 'network' : 'unknown') });
        return { ok: false, reason: f.network ? 'network' : 'server' };
      }
      return isRecord(data) && data.ok === true ? { ok: true } : { ok: false, reason: 'server' };
    },
    async ledger(): Promise<CreditLoad> {
      const { data, error } = await call(client, TICKET_HISTORY_RPC);
      if (error) return { ok: false, reason: loadFailure(error, 'boarding.ledger.fail') };
      const parsed = parseHistory(data);
      return parsed ? { ok: true, ...parsed } : { ok: false, reason: 'server' };
    },
    // T3 공개 순간 사진: 만난 분의 승인된 얼굴 사진 id(10 상대 프로필과 같은 함수). 못 읽으면 null(사진 자리만)
    async facePhoto(partnerId: string): Promise<string | null> {
      try {
        const { data, error } = await call(client, CANDIDATE_RPC, { p_target: partnerId });
        if (error || !isRecord(data)) return null;
        const face = rows(data.photos).find((p) => p.slot === 'face' && p.state === 'approved');
        return str(face?.photo_id);
      } catch {
        return null;
      }
    },
  };
}

export type BoardingApi = ReturnType<typeof createBoardingApi>;
