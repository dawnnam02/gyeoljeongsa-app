// 데모 모드 모의 서버의 탑승권 부분(V5 W6). 이름 · 인자 · 응답 모양 = 서버 확정 정의(features/boarding/boardingApi 머리 주석, 3부-바 10-27):
//  get_ticket_state · get_weekly_match · hold_ticket_seat · release_ticket_hold · demo_buy_ticket · board_with_credit · list_ticket_history (0030 · 0032 · 0037 R37)
//  cancel_ticket_seat({ p_round_no }) — 0037 [4](D-202): 마감 전만, 결제 좌석 → 장부 cancel_credit · 크레딧 좌석 → cancel_return, 어느 쪽이든 크레딧 1장 → { ok, round_no, paid_by, result: 'credited', lot_id } · 오류 closed · not_found
//  ack_ticket_contract({ p_round_no, p_text_version }) — 0037 [9](R40): 회차 · 판(4 ~ 60자)이 맞으면 기록 한 줄 → { ok: true } · 오류 invalid_value
//  + 데모 전용 demo_boarding_scene({ p_scene }) (탑승권 화면 아래 데모 줄이 장면을 바꾼다)
//  · 서버와 다른 점 하나: get_ticket_state 에 now(장면 시각)를 더 보낸다 — 시계와 상관없이 같은 화면(서버 0030 에는 없는 키, 앱은 있으면 쓴다)
//  장면(이메일 앞부분 또는 데모 줄):
//   (기본) onsale 판매 중 · 탑승권 없음 · 크레딧 0     boardbefore 판매 전     boardcredit 판매 중 · 크레딧 1장(지난 회차 짝이 맞지 않아 돌려받음)
//   boardfull 내 성별 좌석이 모두 참     boardon 탑승 완료(기다림)     boardmatch 수요일 18:00 공개 — 만난 분 있음     boardnone 공개 — 완벽한 사람을 찾지 못함 + 크레딧
//   boardclosed 판매가 끝났고 탑승권 없음     boardpolitics 정치 성향 문항이 비어 살 수 없음(profile_incomplete)     boardlate 탑승 완료 · 판매 마감 뒤(취소 없음)
//   boardoncredit 크레딧으로 탑승 완료(취소하면 크레딧 1장 돌려받음)
//  · 회차 1 = 2026-12-23(수) 18:00 KST 첫 매칭(T-24). 크레딧 장면은 회차 2(12-30). 데모의 '지금'은 장면마다 정해 둔 시각
//  · 만난 분 = 데모 인물 24명 가운데 '나'와 끼리끼리 순서 첫 분(demo/people kinOrder) — 남은 좌석 수 · 정원 · 점수 키는 보내지 않는다
import { kinOrder, myReligionOf, poolFor } from './people';

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
export type BoardingScene = 'onsale' | 'before' | 'credit' | 'full' | 'boarded' | 'matched' | 'none' | 'closed' | 'politics' | 'late' | 'boardedCredit';
export const BOARDING_SCENES: readonly BoardingScene[] = ['before', 'onsale', 'credit', 'full', 'boarded', 'matched', 'none', 'closed', 'politics', 'late', 'boardedCredit'];
export type DemoBoardingUser = { id: string; email: string };

const DAY = 24 * 3_600_000;
const KST = 9 * 3_600_000;
const at = (iso: string) => Date.parse(iso);
const ROUNDS = [
  { no: 1, match: at('2026-12-23T18:00:00+09:00'), open: at('2026-12-17T00:00:00+09:00'), close: at('2026-12-23T17:30:00+09:00') },
  { no: 2, match: at('2026-12-30T18:00:00+09:00'), open: at('2026-12-24T00:00:00+09:00'), close: at('2026-12-30T17:30:00+09:00') },
];
const iso = (t: number) => new Date(t).toISOString();
const WEEK = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const kst = (t: number) => new Date(t + KST);
const two = (n: number) => String(n).padStart(2, '0');
const kstDay = (t: number) => {
  const d = kst(t);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
};
// 서버 ticket_kst_text 와 같은 꼴(앱은 읽지 않는다 — 모양만 맞춤)
const kstText = (t: number, withDate: boolean) => {
  const d = kst(t);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const clock = `${h < 12 ? '오전' : '오후'} ${h <= 12 ? h : h - 12}시${m ? ` ${m}분` : ''}`;
  return withDate ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEK[d.getUTCDay()]} ${clock}` : clock;
};

type SeatState = 'held' | 'boarded' | 'matched' | 'returned' | 'released' | 'lapsed';
type Seat = { roundNo: number; state: SeatState; paidBy: 'purchase' | 'credit' | null; holdUntil: number | null; boardedAt: number | null; returnReason: string | null };
type Lot = { id: number; reason: string; roundNo: number | null; createdAt: number; usedRound: number | null };
type State = {
  scene: BoardingScene;
  seats: Seat[];
  lots: Lot[];
  txs: Map<string, { round_no: number; outcome: 'seat' | 'credit'; tx_id: string }>; // 데모 거래(요청 ID 하나에 한 번)
  acks: { roundNo: number; version: string }[]; // 계약 설명 확인 기록(R40) — 데모는 회차 · 판만
};

const sceneOfEmail = (email: string): BoardingScene => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  const table: [string, BoardingScene][] = [
    ['boardbefore', 'before'],
    ['boardcredit', 'credit'],
    ['boardfull', 'full'],
    ['boardoncredit', 'boardedCredit'],
    ['boardon', 'boarded'],
    ['boardlate', 'late'],
    ['boardmatch', 'matched'],
    ['boardnone', 'none'],
    ['boardclosed', 'closed'],
    ['boardpolitics', 'politics'],
  ];
  return table.find(([k]) => l.includes(k))?.[1] ?? 'onsale';
};

const ON_BOARD: readonly SeatState[] = ['boarded', 'matched', 'returned'];

export function createDemoBoarding() {
  const states = new Map<string, State>();
  const seed = (scene: BoardingScene): State => {
    const s: State = { scene, seats: [], lots: [], txs: new Map(), acks: [] };
    const bought = at('2026-12-18T21:10:00+09:00');
    const seat = (state: SeatState, paidBy: 'purchase' | 'credit', returnReason: string | null = null): Seat => ({ roundNo: 1, state, paidBy, holdUntil: null, boardedAt: bought, returnReason });
    if (scene === 'boarded' || scene === 'late') s.seats.push(seat('boarded', 'purchase'));
    if (scene === 'matched') s.seats.push(seat('matched', 'purchase'));
    if (scene === 'boardedCredit') {
      s.lots.push({ id: 1, reason: 'unbalanced', roundNo: null, createdAt: at('2026-12-16T18:00:00+09:00'), usedRound: 1 });
      s.seats.push(seat('boarded', 'credit'));
    }
    if (scene === 'none') {
      s.seats.push(seat('returned', 'purchase', 'no_match'));
      s.lots.push({ id: 1, reason: 'no_match', roundNo: 1, createdAt: at('2026-12-23T18:00:00+09:00'), usedRound: null });
    }
    if (scene === 'credit') s.lots.push({ id: 1, reason: 'unbalanced', roundNo: 1, createdAt: at('2026-12-23T18:00:00+09:00'), usedRound: null });
    return s;
  };
  const stateOf = (u: DemoBoardingUser): State => {
    let s = states.get(u.id);
    if (!s) {
      s = seed(sceneOfEmail(u.email));
      states.set(u.id, s);
    }
    return s;
  };
  const roundOf = (s: State) => (s.scene === 'credit' ? ROUNDS[1] : ROUNDS[0]);
  const roundNo = (v: unknown) => ROUNDS.find((r) => r.no === v) ?? null;
  const balance = (s: State) => s.lots.filter((l) => l.usedRound === null).length;
  // 장면마다 정해 둔 '지금': 판매 전 = 판매 시작 이틀 전 · 판매 중 · 기다림 = 매칭 사흘 전 · 공개 = 매칭 1분 뒤 · 판매 끝 = 매칭 10분 전 · 마감 뒤 = 마감 10분 뒤
  const nowOf = (s: State) => {
    const r = roundOf(s);
    if (s.scene === 'before') return r.open - 2 * DAY;
    if (s.scene === 'matched' || s.scene === 'none') return r.match + 60_000;
    if (s.scene === 'closed') return r.match - 10 * 60_000;
    if (s.scene === 'late') return r.close + 10 * 60_000;
    return r.match - 3 * DAY;
  };
  const partnerOf = (u: DemoBoardingUser) => kinOrder(poolFor(u.email), 4, myReligionOf(u.email))[0] ?? null;
  const seatOf = (s: State, no: number, kinds: readonly SeatState[]) => s.seats.find((x) => x.roundNo === no && kinds.includes(x.state)) ?? null;
  const liveHold = (s: State, no: number) => s.seats.find((x) => x.roundNo === no && x.state === 'held' && (x.holdUntil ?? 0) > nowOf(s)) ?? null;
  // 서버 ticket_board_check 와 같은 순서(이 데모에 있는 사유만)
  const boardCheck = (s: State, no: number): string | null => {
    const r = roundNo(no);
    if (!r) return 'no_round';
    const now = nowOf(s);
    if (now < r.open) return 'before_sale';
    if (now >= r.close) return 'closed';
    if (s.scene === 'politics') return 'profile_incomplete';
    if (seatOf(s, no, ON_BOARD)) return 'already_boarded';
    if (s.scene === 'full') return 'full';
    return null;
  };
  const fail = (message: string): DbResult => ({ data: null, error: { code: 'P0001', message } });
  const ok = (data: unknown): DbResult => ({ data, error: null });
  const newLot = (s: State, reason: string, no: number | null): Lot => {
    const lot: Lot = { id: s.lots.reduce((m, l) => Math.max(m, l.id), 0) + 1, reason, roundNo: no, createdAt: nowOf(s), usedRound: null };
    s.lots.push(lot);
    return lot;
  };
  const board = (s: State, no: number, paidBy: 'purchase' | 'credit') => {
    const held = liveHold(s, no);
    if (held) Object.assign(held, { state: 'boarded', paidBy, boardedAt: nowOf(s), holdUntil: null });
    else s.seats.push({ roundNo: no, state: 'boarded', paidBy, holdUntil: null, boardedAt: nowOf(s), returnReason: null });
  };

  function ticketState(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    const r = roundOf(s);
    const now = nowOf(s);
    const seat = seatOf(s, r.no, ON_BOARD) ?? liveHold(s, r.no);
    const reason = boardCheck(s, r.no);
    const d = kst(r.match);
    return ok({
      now: iso(now), // 데모만(장면 시각)
      price_krw: 26900,
      payment_mode: 'demo',
      round: {
        round_no: r.no,
        match_day: kstDay(r.match),
        match_weekday: WEEK[d.getUTCDay()],
        match_time: `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`,
        match_text: kstText(r.match, true),
        sale_open_at: iso(r.open),
        sale_close_at: iso(r.close),
        close_text: kstText(r.close, false),
        sale_state: now < r.open ? 'before' : now < r.close ? 'open' : now < r.match ? 'closed' : 'ended',
      },
      seat: seat ? { state: seat.state, paid_by: seat.paidBy, hold_until: seat.state === 'held' && seat.holdUntil ? iso(seat.holdUntil) : null, boarded_at: seat.boardedAt ? iso(seat.boardedAt) : null, return_reason: seat.returnReason } : null,
      region: '수도권',
      can_board: reason === null,
      reason,
      credit: { balance: balance(s), next_expire_on: null }, // 0037 뒤 기한 없음
    });
  }

  // 0032 get_weekly_match: 가장 최근 탄 회차 하나. 공개 전 waiting · 짝 있음 matched(공개 범위 답) · 짝 없음 not_found
  function weeklyMatch(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    const seat = s.seats.filter((x) => ON_BOARD.includes(x.state)).sort((a, b) => b.roundNo - a.roundNo)[0];
    if (!seat) return ok({ state: 'none' });
    const r = roundNo(seat.roundNo) ?? ROUNDS[0];
    const head = { round_no: r.no, match_at: iso(r.match) };
    if (nowOf(s) < r.match || seat.state === 'boarded') return ok({ state: 'waiting', ...head });
    const p = seat.state === 'matched' ? partnerOf(u) : null;
    if (p) return ok({ state: 'matched', ...head, partner_id: `demo-cand-${p.n}`, room_id: `demo-chat-${r.no}-${p.n}`, partner: { A12: p.name, A01: p.age, A03: p.region } });
    return ok({ state: 'not_found', ...head, credited: true });
  }

  function hold(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const no = typeof args.p_round_no === 'number' ? args.p_round_no : -1;
    const held = liveHold(s, no);
    if (held) return ok({ ok: true, reason: null, round_no: no, hold_until: iso(held.holdUntil ?? 0) });
    const reason = boardCheck(s, no);
    if (reason) return ok({ ok: false, reason, round_no: no, hold_until: null });
    const r = roundNo(no) ?? ROUNDS[0];
    for (const x of s.seats) if (x.roundNo === no && x.state === 'held') x.state = 'lapsed';
    const until = Math.min(nowOf(s) + 10 * 60_000, r.close);
    s.seats.push({ roundNo: no, state: 'held', paidBy: null, holdUntil: until, boardedAt: null, returnReason: null });
    return ok({ ok: true, reason: null, round_no: no, hold_until: iso(until) });
  }

  function release(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    const held = s.seats.filter((x) => x.state === 'held' && (x.holdUntil ?? 0) > nowOf(s));
    for (const x of held) x.state = 'released';
    return ok({ released: held.length > 0 });
  }

  // 0030 demo_buy_ticket → ticket_settle_paid: ① 잡아 둔 자리 → 탑승 ② 없으면 지금 탈 수 있을 때 바로 ③ 못 태우면 크레딧(paid_no_seat)
  function demoBuy(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const id = typeof args.p_request_id === 'string' ? args.p_request_id : '';
    if (!id) return fail('invalid_request');
    const key = `demo:${id}`;
    const again = s.txs.get(key);
    if (again) return ok({ result: 'already_granted', ...again });
    const last = [...s.seats].reverse().find((x) => (x.state === 'held' || x.state === 'lapsed') && nowOf(s) < (roundNo(x.roundNo)?.match ?? 0));
    if (!last) return fail('no_hold');
    const no = last.roundNo;
    const txId = `demo-tx-${s.txs.size + 1}`;
    if (liveHold(s, no) || boardCheck(s, no) === null) {
      board(s, no, 'purchase');
      s.txs.set(key, { round_no: no, outcome: 'seat', tx_id: txId });
      return ok({ result: 'boarded', round_no: no, tx_id: txId });
    }
    const reason = boardCheck(s, no);
    newLot(s, 'paid_no_seat', no);
    s.txs.set(key, { round_no: no, outcome: 'credit', tx_id: txId });
    return ok({ result: 'credited', reason, round_no: no, tx_id: txId });
  }

  function boardCredit(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const no = typeof args.p_round_no === 'number' ? args.p_round_no : -1;
    const reason = boardCheck(s, no);
    if (reason) return ok({ ok: false, reason, round_no: no, paid_by: null });
    const lot = s.lots.filter((l) => l.usedRound === null).sort((a, b) => a.id - b.id)[0];
    if (!lot) return ok({ ok: false, reason: 'no_credit', round_no: no, paid_by: null });
    board(s, no, 'credit');
    lot.usedRound = no;
    return ok({ ok: true, reason: null, round_no: no, paid_by: 'credit' });
  }

  // 0030 · 0037 R37 list_ticket_history: 탄 회차 · 크레딧 장(유효기간 칸 null) · 잔액
  function history(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    const tickets = s.seats
      .filter((x) => ON_BOARD.includes(x.state))
      .sort((a, b) => b.roundNo - a.roundNo)
      .map((x) => ({
        round_no: x.roundNo,
        match_day: kstDay(roundNo(x.roundNo)?.match ?? 0),
        state: x.state,
        paid_by: x.paidBy,
        price_krw: x.paidBy === 'purchase' ? 26900 : null,
        boarded_at: x.boardedAt ? iso(x.boardedAt) : null,
        return_reason: x.returnReason,
      }));
    const credits = [...s.lots]
      .sort((a, b) => b.id - a.id)
      .map((l) => ({ id: l.id, reason: l.reason, round_no: l.roundNo, created_at: iso(l.createdAt), expires_on: null, state: l.usedRound === null ? 'open' : 'used', used_round_no: l.usedRound }));
    return ok({ tickets, credits, balance: balance(s) });
  }

  function cancel(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const seat = typeof args.p_round_no === 'number' ? seatOf(s, args.p_round_no, ['boarded']) : null;
    if (!seat) return fail('not_found');
    if (nowOf(s) >= (roundNo(seat.roundNo) ?? ROUNDS[0]).close) return fail('closed');
    const paidBy = seat.paidBy;
    Object.assign(seat, { state: 'released', boardedAt: null, paidBy: null });
    const lot = newLot(s, paidBy === 'credit' ? 'cancel_return' : 'cancel_credit', seat.roundNo); // D-202: 어느 쪽이든 크레딧 1장
    return ok({ ok: true, round_no: seat.roundNo, paid_by: paidBy, result: 'credited', lot_id: lot.id });
  }

  function ack(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const v = args.p_text_version;
    if (typeof v !== 'string' || v.length < 4 || v.length > 60 || !roundNo(args.p_round_no)) return fail('invalid_value');
    s.acks.push({ roundNo: args.p_round_no as number, version: v });
    return ok({ ok: true });
  }

  // 데모 줄: 장면을 바꾼다. '18:00 공개'는 탑승한 상태에서 매칭(만난 분 있음)으로
  function setScene(u: DemoBoardingUser, args: Row): DbResult {
    const scene = args.p_scene;
    if (typeof scene !== 'string' || !(BOARDING_SCENES as readonly string[]).includes(scene)) return fail('invalid_value');
    states.set(u.id, seed(scene as BoardingScene));
    return ok({ scene });
  }

  const handlers: Record<string, (u: DemoBoardingUser, args: Row) => DbResult> = {
    get_ticket_state: (u) => ticketState(u),
    get_weekly_match: (u) => weeklyMatch(u),
    hold_ticket_seat: hold,
    release_ticket_hold: (u) => release(u),
    demo_buy_ticket: demoBuy,
    board_with_credit: boardCredit,
    list_ticket_history: (u) => history(u),
    cancel_ticket_seat: cancel,
    ack_ticket_contract: ack,
    demo_boarding_scene: setScene,
  };
  return {
    handles: (name: string) => name in handlers,
    rpc: (u: DemoBoardingUser, name: string, args: Row = {}): Promise<DbResult> => Promise.resolve(handlers[name](u, args)),
    partnerIdOf: (u: DemoBoardingUser): string | null => {
      const p = stateOf(u).seats.some((x) => x.state === 'matched') ? partnerOf(u) : null;
      return p ? `demo-cand-${p.n}` : null;
    },
    sceneOf: (u: DemoBoardingUser) => stateOf(u).scene,
    acksOf: (u: DemoBoardingUser) => stateOf(u).acks.map((a) => ({ ...a })), // 시험 · 점검용
  };
}

export type DemoBoarding = ReturnType<typeof createDemoBoarding>;
