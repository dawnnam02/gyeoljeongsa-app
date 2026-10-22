// 데모 모드 모의 서버의 탑승권 부분(V5 W6). 이름은 가정 이름(features/boarding/boardingApi 머리 주석) — 서버 0030 · 0032 가 나오면 맞춘다.
//  get_boarding_state · buy_ticket · list_credit_ledger + 데모 전용 demo_boarding_scene({ p_scene }) (탑승권 화면 아래 데모 줄이 장면을 바꾼다)
//  장면(이메일 앞부분 또는 데모 줄):
//   (기본) onsale 판매 중 · 탑승권 없음 · 크레딧 0     boardbefore 판매 전     boardcredit 판매 중 · 크레딧 1장(지난 회차 짝이 맞지 않아 돌려받음)
//   boardfull 내 성별 좌석이 모두 참     boardon 탑승 완료(기다림)     boardmatch 수요일 18:00 공개 — 만난 분 있음     boardnone 공개 — 완벽한 사람을 찾지 못함 + 크레딧
//   boardclosed 판매가 끝났고 탑승권 없음     boardpolitics 정치 성향 문항이 비어 살 수 없음
//  · 회차 1 = 2026-12-23(수) 18:00 KST 첫 매칭(T-24). 크레딧 장면은 회차 2(12-30). 데모의 '지금'은 장면마다 정해 둔 시각(시계와 상관없이 같은 화면)
//  · 만난 분 = 데모 인물 24명 가운데 '나'와 끼리끼리 순서 첫 분(demo/people kinOrder) — 남은 좌석 수 · 정원 · 점수 키는 보내지 않는다
import { kinOrder, myReligionOf, poolFor } from './people';

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
export type BoardingScene = 'onsale' | 'before' | 'credit' | 'full' | 'boarded' | 'matched' | 'none' | 'closed' | 'politics';
export const BOARDING_SCENES: readonly BoardingScene[] = ['before', 'onsale', 'credit', 'full', 'boarded', 'matched', 'none', 'closed', 'politics'];
export type DemoBoardingUser = { id: string; email: string };

const DAY = 24 * 3_600_000;
const at = (iso: string) => Date.parse(iso);
const ROUNDS = [
  { no: 1, match: at('2026-12-23T18:00:00+09:00'), open: at('2026-12-17T00:00:00+09:00'), close: at('2026-12-23T17:30:00+09:00') },
  { no: 2, match: at('2026-12-30T18:00:00+09:00'), open: at('2026-12-24T00:00:00+09:00'), close: at('2026-12-30T17:30:00+09:00') },
];
const iso = (t: number) => new Date(t).toISOString();

type State = { scene: BoardingScene; ticket: { roundNo: number; boughtAt: number; paidWith: 'store' | 'credit' } | null; ledger: { at: number; delta: number; reason: string; roundNo: number }[]; requests: Map<string, unknown> };

const sceneOfEmail = (email: string): BoardingScene => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  const table: [string, BoardingScene][] = [
    ['boardbefore', 'before'],
    ['boardcredit', 'credit'],
    ['boardfull', 'full'],
    ['boardon', 'boarded'],
    ['boardmatch', 'matched'],
    ['boardnone', 'none'],
    ['boardclosed', 'closed'],
    ['boardpolitics', 'politics'],
  ];
  return table.find(([k]) => l.includes(k))?.[1] ?? 'onsale';
};

export function createDemoBoarding() {
  const states = new Map<string, State>();
  const seed = (scene: BoardingScene): State => {
    const s: State = { scene, ticket: null, ledger: [], requests: new Map() };
    if (scene === 'boarded' || scene === 'matched') s.ticket = { roundNo: 1, boughtAt: at('2026-12-18T21:10:00+09:00'), paidWith: 'store' };
    if (scene === 'none') {
      s.ticket = { roundNo: 1, boughtAt: at('2026-12-18T21:10:00+09:00'), paidWith: 'store' };
      s.ledger.push({ at: at('2026-12-23T18:00:00+09:00'), delta: 1, reason: 'no_fit', roundNo: 1 });
    }
    if (scene === 'credit') s.ledger.push({ at: at('2026-12-23T18:00:00+09:00'), delta: 1, reason: 'balance', roundNo: 1 });
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
  const credits = (s: State) => s.ledger.reduce((a, x) => a + x.delta, 0);
  // 장면마다 정해 둔 '지금': 판매 전 = 판매 시작 이틀 전 · 판매 중 · 기다림 = 매칭 사흘 전 · 공개 = 매칭 1분 뒤 · 판매 끝 = 매칭 10분 전
  const nowOf = (s: State) => {
    const r = roundOf(s);
    if (s.scene === 'before') return r.open - 2 * DAY;
    if (s.scene === 'matched' || s.scene === 'none') return r.match + 60_000;
    if (s.scene === 'closed') return r.match - 10 * 60_000;
    return r.match - 3 * DAY;
  };
  const partnerOf = (u: DemoBoardingUser) => kinOrder(poolFor(u.email), 4, myReligionOf(u.email))[0] ?? null;

  function state(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    const r = roundOf(s);
    const phase = s.scene === 'before' ? 'before_sale' : s.scene === 'matched' || s.scene === 'none' ? 'revealed' : s.scene === 'closed' ? 'closed' : 'on_sale';
    const p = s.scene === 'matched' ? partnerOf(u) : null;
    const result =
      s.scene === 'matched' && p
        ? { round_no: r.no, kind: 'matched', partner_id: `demo-cand-${p.n}`, chat_id: `demo-chat-${r.no}-${p.n}`, partner: { name: p.name, age: p.age, region: p.region, face_photo_id: `demo-ph-${p.n}-face` } }
        : s.scene === 'none'
          ? { round_no: r.no, kind: 'no_match', reason: 'no_fit' }
          : null;
    return {
      data: {
        now: iso(nowOf(s)),
        round: { no: r.no, match_at: iso(r.match), sale_open_at: iso(r.open), sale_close_at: iso(r.close) },
        phase,
        region: { name: '수도권' },
        seat: s.scene === 'full' ? 'full' : 'open',
        ticket: s.ticket ? { round_no: s.ticket.roundNo, bought_at: iso(s.ticket.boughtAt), paid_with: s.ticket.paidWith } : null,
        credits: credits(s),
        eligible: s.scene === 'politics' ? 'politics_missing' : null,
        result,
        past: result && p ? [{ round_no: r.no, partner_name: p.name, chat_id: result.chat_id, open: true }] : [],
      },
      error: null,
    };
  }

  const fail = (message: string): DbResult => ({ data: null, error: { code: 'P0001', message } });

  function buy(u: DemoBoardingUser, args: Row): DbResult {
    const s = stateOf(u);
    const id = typeof args.p_request_id === 'string' ? args.p_request_id : '';
    if (!id) return fail('invalid_request');
    const again = s.requests.get(id);
    if (again) return { data: again, error: null };
    const r = roundOf(s);
    if (s.ticket && s.ticket.roundNo === r.no) return fail('already_boarded');
    if (s.scene === 'politics') return fail('not_eligible');
    if (s.scene === 'before' || s.scene === 'closed' || s.scene === 'matched' || s.scene === 'none') return fail('sale_closed');
    if (s.scene === 'full') return fail('sold_out');
    const useCredit = args.p_use_credit === true;
    if (useCredit && credits(s) <= 0) return fail('no_credit');
    const t = nowOf(s);
    s.ticket = { roundNo: r.no, boughtAt: t, paidWith: useCredit ? 'credit' : 'store' };
    if (useCredit) s.ledger.push({ at: t, delta: -1, reason: 'used', roundNo: r.no });
    s.scene = 'boarded';
    const out = { ok: true, round_no: r.no };
    s.requests.set(id, out);
    return { data: out, error: null };
  }

  function ledger(u: DemoBoardingUser): DbResult {
    const s = stateOf(u);
    return { data: { balance: credits(s), items: s.ledger.map((x) => ({ at: iso(x.at), delta: x.delta, reason: x.reason, round_no: x.roundNo })) }, error: null };
  }

  // 데모 줄: 장면을 바꾼다. '18:00 공개'는 탑승한 상태에서 매칭(만난 분 있음)으로
  function setScene(u: DemoBoardingUser, args: Row): DbResult {
    const scene = args.p_scene;
    if (typeof scene !== 'string' || !(BOARDING_SCENES as readonly string[]).includes(scene)) return fail('invalid_value');
    states.set(u.id, seed(scene as BoardingScene));
    return { data: { scene }, error: null };
  }

  const handlers: Record<string, (u: DemoBoardingUser, args: Row) => DbResult> = {
    get_boarding_state: (u) => state(u),
    buy_ticket: buy,
    list_credit_ledger: (u) => ledger(u),
    demo_boarding_scene: setScene,
  };
  return {
    handles: (name: string) => name in handlers,
    rpc: (u: DemoBoardingUser, name: string, args: Row = {}): Promise<DbResult> => Promise.resolve(handlers[name](u, args)),
    partnerIdOf: (u: DemoBoardingUser): string | null => {
      const s = stateOf(u);
      const p = s.scene === 'matched' ? partnerOf(u) : null;
      return p ? `demo-cand-${p.n}` : null;
    },
    sceneOf: (u: DemoBoardingUser) => stateOf(u).scene,
  };
}

export type DemoBoarding = ReturnType<typeof createDemoBoarding>;
