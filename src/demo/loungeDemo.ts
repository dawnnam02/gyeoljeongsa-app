// 데모 모드 모의 서버의 탑승객 라운지(LG-F · D-220). 이름 · 인자 · 응답 모양 = 서버 0042(backend/migrations/0042_lounge.sql 앱 함수 10 · R_변경기록 10-4) 그대로 —
//  앱은 실서버와 같은 파서(features/lounge/loungeApi)로 읽는다. 메모리에만 있고 서버 요청 0 · 기기 저장 0.
//   lounge_state · lounge_agree · lounge_take_seat · lounge_get_post · lounge_post · lounge_empathy · lounge_hide · lounge_report · lounge_pick · lounge_delete
//   + 0043 get_lounge_report_note(p_post) → {ok, no_pair}(신고자에게만 — 사유 RP4 · RP6 · RP7 · 수 17:30 전 · 회차당 3쌍까지면 짝 제외 쌍)
//   + 0044(3부-자) get_lounge_row_state() → {state, line}(T4 줄 전용 · 판정은 lounge_state 와 같음) · get_lounge_my_hidden() → {ok, seats:[{seat, post}]} · 실시간 closed(수 18:00 공개 뒤 객실 채널에 한 번 · 내용 {id:null, seat:null, body:null, at})
//   + 데모 전용 demo_lounge_scene({ p_scene }) — T6 아래 데모 줄이 장면을 바꾼다(null 이면 다음 장면)
//  · 실시간: 비공개 채널 lounge:<객실 uuid> 흉내(channel · removeChannel) — 서버 방송처럼 내용은 {id, seat, body, at} 넷만, 이벤트 post · gone
//  · 가상 탑승객 20좌석(실제 사람 아님) · 1회차(12-23 수 18:00 공개, 판매 12-17 목 00:00 ~ 12-23 17:30) · 여행지 trip_no 1(경주)
//  · 장면(이메일 앞부분 lounge… 또는 데모 줄). lounge 가 없는 이메일은 탑승권 데모가 '탄 사람'일 때만(비행 중) — 처음 들어가기부터
//     loungefirst 처음 들어가기(약속 → 쪽지 → 좌석)   loungeon 평소(좌석 있음)   loungemorning 아침(어제 둘 중 하나 결과)   loungedark 불 끈 시간
//     loungeland 착륙 준비   loungeclosed 닫힘   loungecaptain 기장 안내만   loungeempty 빈 객실(읽기만)   loungepaused 쓰기 멈춤(자동 가림)
//     loungekicked 이용 멈춤(강퇴)   loungeleft 나감(탑승 취소)   loungerules 약속이 바뀜(좌석은 그대로)
//  · 데모의 '지금' = 장면마다 정해 둔 시각 + 연 뒤 흐른 시간. 내가 처음 글을 쓰면 1.5초 뒤 가상 탑승객 한 분이 인용해서 답한다(실시간 흉내)
//  · 거르기(0016 + R42 'lounge' 칸): 연락처 · 링크 · 금전 · 욕설 4종 막음, 위기 낱말은 보내고 쓴 사람에게만 help. 글에 '데모실패'가 있으면 처음 한 번 인터넷 실패
import { demoHelpHit } from './crisisWords';

type Row = Record<string, unknown>;
type DbResult ={ data: unknown; error: { code: string; message: string } | null };
export type DemoLoungeUser = { id: string; email: string };
export type LoungeFlight = 'in' | 'late' | 'after' | 'none';

export type LoungeScene = 'first' | 'open' | 'morning' | 'lightsOut' | 'landing' | 'closed' | 'captainOnly' | 'emptyRoom' | 'paused' | 'kicked' | 'left' | 'rules';
export const LOUNGE_SCENES: readonly LoungeScene[] = ['first', 'open', 'morning', 'lightsOut', 'landing', 'closed', 'captainOnly', 'emptyRoom', 'paused', 'kicked', 'left', 'rules'];
const EMAIL_SCENE: [string, LoungeScene][] = [
  ['loungefirst', 'first'],
  ['loungemorning', 'morning'],
  ['loungedark', 'lightsOut'],
  ['loungeland', 'landing'],
  ['loungeclosed', 'closed'],
  ['loungecaptain', 'captainOnly'],
  ['loungeempty', 'emptyRoom'],
  ['loungepaused', 'paused'],
  ['loungekicked', 'kicked'],
  ['loungeleft', 'left'],
  ['loungerules', 'rules'],
  ['loungeon', 'open'],
];
export const loungeSceneOfEmail = (email: string): LoungeScene | null => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  return EMAIL_SCENE.find(([k]) => l.includes(k))?.[1] ?? null;
};

const at = (iso: string) => Date.parse(iso);
const KST = 9 * 3_600_000;
const MINUTE = 60_000;
const ROUND = { no: 1, open: at('2026-12-17T00:00:00+09:00'), close: at('2026-12-23T17:30:00+09:00'), match: at('2026-12-23T18:00:00+09:00') };
const ROOM_OPENED = at('2026-12-19T19:30:00+09:00'); // 10명이 모인 때(첫 질문)
const SCENE_NOW: Readonly<Record<LoungeScene, number>> = {
  first: at('2026-12-20T21:00:00+09:00'),
  open: at('2026-12-20T21:00:00+09:00'),
  morning: at('2026-12-21T07:05:00+09:00'),
  lightsOut: at('2026-12-21T02:00:00+09:00'),
  landing: at('2026-12-23T17:40:00+09:00'),
  closed: at('2026-12-23T18:10:00+09:00'),
  captainOnly: at('2026-12-20T21:00:00+09:00'),
  emptyRoom: at('2026-12-20T21:00:00+09:00'),
  paused: at('2026-12-20T21:00:00+09:00'),
  kicked: at('2026-12-20T21:00:00+09:00'),
  left: at('2026-12-20T21:00:00+09:00'),
  rules: at('2026-12-20T21:00:00+09:00'),
};
export const LOUNGE_RULES_NOW = 'lounge-rules-2026.10.30-v1'; // 판_관리 lounge-rules-YYYY.MM.DD-vN (PL-03a — CK 코드와 따로)
const RULES_OLD = 'lounge-rules-2026.10.20-v1';
const LIMIT = { bodyMax: 200, perMin: 5, perDay: 60, balanceMin: 10, evenPp: 10, slightPp: 30 }; // lounge_const 처음값
const MONEY_WORDS = ['송금', '계좌', '입금해', '빌려줄', '빌려 줄', '보내줄 수'];
const ABUSE_WORDS = ['시발', '씨발', '병신', '개새끼', '꺼져'];
const CONTACT = /(\d{2,3}[- .]?\d{3,4}[- .]?\d{4})|카톡|카카오톡|오픈채팅|인스타|텔레그램|라인 아이디/;
const LINK = /https?:\/\/|www\.|\.(com|net|kr|io)\b/i;

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const ROOM_ID = uuid(0xa1);
const CHANNEL = `lounge:${ROOM_ID}`;
const iso = (t: number) => new Date(t).toISOString();
const kstHour = (t: number) => new Date(t + KST).getUTCHours();
const kstDayStart = (t: number) => Math.floor((t + KST) / 86_400_000) * 86_400_000 - KST;
const lightsOut = (t: number) => {
  const h = kstHour(t);
  return h >= 1 && h < 7;
};

// 54자리(11 ~ 19열 × A ~ F)를 섞은 차례 — 회원 값과 상관없이(정책 PL-04). 데모는 고정 씨앗으로 섞어 화면이 늘 같다
const ALL_SEATS = [11, 12, 13, 14, 15, 16, 17, 18, 19].flatMap((r) => ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => `${r}${c}`));
function shuffled(seed: number): string[] {
  const a = [...ALL_SEATS];
  let x = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i -= 1) {
    x = (Math.imul(x, 1_664_525) + 1_013_904_223) >>> 0;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const ORDER = shuffled(20_261_217);
const OTHERS = ORDER.slice(0, 20); // 가상 탑승객 20좌석(데모 — 실제 사람 아님)
const MY_SEAT = ORDER[20];

type Kind = 'member' | 'answer' | 'captain';
type CaptainKind = 'first' | 'noon' | 'balance' | 'lights_out' | 'morning' | 'landing';
type Post = {
  id: string;
  seat: string | null; // null = 기장
  kind: Kind;
  body: string;
  at: number;
  quoteId: string | null;
  answerTo: string | null;
  captainKey: string | null;
  captainKind: CaptainKind | null;
  result: { level: 'even' | 'slight' | 'much'; side: 'a' | 'b' | null } | null;
  votes: { a: number; b: number }; // 둘 중 하나 — 가상 탑승객이 고른 수(응답에 내보내지 않음)
  deleted: boolean;
  empathyFrom: Set<string>; // 공감한 좌석(응답에는 '내가 눌렀나' · '받았나'만)
};

// 가상 탑승객 글(해요체 · 느낌표 0 · 누구인지 드러나는 것 0)
const SEED: { who: number; at: string; body: string; answer?: 'first' | 'q04'; quote?: number }[] = [
  { who: 0, at: '2026-12-19T19:42:00+09:00', body: '퇴근길에 산 붕어빵이요. 따뜻할 때 먹으면 기분이 좋아져요.', answer: 'first' },
  { who: 1, at: '2026-12-19T19:51:00+09:00', body: '아침에 내리는 커피 향이요.', answer: 'first' },
  { who: 2, at: '2026-12-19T20:06:00+09:00', body: '저는 짜장면이요. 중국집에서는 늘 같은 걸 고르게 돼요.' },
  { who: 3, at: '2026-12-19T20:14:00+09:00', body: '저는 짬뽕이에요. 국물이 있어야 든든하더라고요.', quote: 2 },
  { who: 4, at: '2026-12-19T21:30:00+09:00', body: '다들 주말 잘 보내고 계세요?' },
  { who: 5, at: '2026-12-20T09:15:00+09:00', body: '아침 공기가 차가워졌네요. 따뜻하게 입고 나가세요.' },
  { who: 6, at: '2026-12-20T12:21:00+09:00', body: '어제 길에서 강아지가 저를 보고 꼬리를 흔들어서 혼자 웃었어요.', answer: 'q04' },
  { who: 7, at: '2026-12-20T12:41:00+09:00', body: '회의 중에 들은 농담이 계속 생각나서 웃었어요.', answer: 'q04' },
  { who: 8, at: '2026-12-20T13:05:00+09:00', body: '강아지 이야기 듣기만 해도 기분이 좋아지네요.', quote: 6 },
  { who: 9, at: '2026-12-20T18:30:00+09:00', body: '저녁 메뉴 고민 중이에요. 다들 뭐 드세요?' },
  { who: 10, at: '2026-12-20T18:42:00+09:00', body: '오늘은 따뜻한 국수가 당기네요.', quote: 9 },
  { who: 11, at: '2026-12-20T20:16:00+09:00', body: '오늘 둘 중 하나는 정말 어렵네요.' },
  { who: 12, at: '2026-12-20T20:40:00+09:00', body: '주말이 짧게 느껴지는 건 저만 그런가요?' },
];
const MINE_SEED = { at: '2026-12-20T19:05:00+09:00', body: '저는 이번 주가 처음이라 조금 설레요.' };
const REPLY = '반가워요. 천천히 이야기 나눠요.';
// 둘 중 하나 가상 표(결과 말 세 단계를 장면마다 다르게): b03 조금 더(a) · b04 거의 반반 · 그 뒤 훨씬 더(b)
const VOTES: Record<string, { a: number; b: number }> = { b03: { a: 9, b: 6 }, b04: { a: 7, b: 7 }, b05: { a: 3, b: 12 }, b06: { a: 11, b: 4 }, b07: { a: 6, b: 9 } };

type State = {
  scene: LoungeScene;
  startedAt: number;
  acked: string | null; // 약속 판
  seat: string | null;
  posts: Post[];
  hides: Set<string>; // 내가 숨긴 좌석
  picks: Map<string, 'a' | 'b'>;
  sent: number[]; // 내가 보낸 때(1분 · 하루 한도)
  replied: boolean;
  failOnce: boolean;
  reports: { post: string; reason: string; pair: boolean }[];
  pairs: Set<string>; // 짝 제외 쌍(데모는 좌석으로 셈 — 실서버는 회원 쌍)
  seq: number;
};

export function createDemoLounge(options: { flight?: (u: DemoLoungeUser) => LoungeFlight; switchOn?: (u: DemoLoungeUser) => Promise<boolean>; clock?: () => number; replyMs?: number } = {}) {
  const flight = options.flight ?? (() => 'none' as LoungeFlight);
  const switchOn = options.switchOn ?? (async () => true);
  const clock = options.clock ?? Date.now;
  const replyMs = options.replyMs ?? 1_500;
  const states = new Map<string, State>();
  const override = new Map<string, LoungeScene>();

  // ── 실시간 흉내(비공개 채널): 구독한 채널에만 방송, 내용 넷
  type Listener = { event: string; cb: (msg: unknown) => void };
  type DemoChannel = { name: string; listeners: Listener[]; joined: boolean; on: (type: string, filter: { event: string }, cb: (msg: unknown) => void) => DemoChannel; subscribe: (cb?: (status: string) => void) => DemoChannel };
  const channels = new Set<DemoChannel>();
  const channel = (name: string): DemoChannel => {
    const ch: DemoChannel = {
      name,
      listeners: [],
      joined: false,
      on(type, filter, cb) {
        if (type === 'broadcast') ch.listeners.push({ event: filter.event, cb });
        return ch;
      },
      subscribe(cb) {
        ch.joined = name === CHANNEL; // 내 객실 채널만 들어간다(서버 lounge_rt_ok 흉내)
        channels.add(ch);
        cb?.(ch.joined ? 'SUBSCRIBED' : 'CHANNEL_ERROR');
        return ch;
      },
    };
    return ch;
  };
  const removeChannel = (ch: unknown) => {
    channels.delete(ch as DemoChannel);
    return Promise.resolve('ok');
  };
  const broadcast = (event: 'post' | 'gone' | 'closed', payload: { id: string | null; seat: string | null; body: string | null; at: string | null }) => {
    for (const ch of [...channels]) if (ch.joined && ch.name === CHANNEL) ch.listeners.filter((l) => l.event === event).forEach((l) => l.cb({ type: 'broadcast', event, payload: { id: payload.id, seat: payload.seat, body: payload.body, at: payload.at } }));
  };

  const sceneFor = (u: DemoLoungeUser): LoungeScene => override.get(u.id) ?? loungeSceneOfEmail(u.email) ?? (flight(u) === 'late' ? 'landing' : 'first');
  const nowOf = (s: State) => SCENE_NOW[s.scene] + (clock() - s.startedAt);

  // 기장 안내 시각표(서버 lounge_slots): 01:00 불 끄기 · 07:00 아침 · 12:00 오늘 질문 · 20:00 둘 중 하나(판매 중) + 판매 마감 착륙 인사. 객실이 열린 때 첫 질문
  const captainSlots = (from: number, to: number) => {
    const out: { kind: CaptainKind; key: string; at: number }[] = [];
    const day0 = kstDayStart(ROUND.open);
    for (let d = 0; d <= 6; d += 1) {
      const base = day0 + d * 86_400_000;
      const slots: [CaptainKind, number, string][] = [
        ['lights_out', 1, 'lightsOut'],
        ['morning', 7, 'morning'],
        ['noon', 12, `q${String((d % 14) + 1).padStart(2, '0')}`],
        ['balance', 20, `b${String((d % 12) + 1).padStart(2, '0')}`],
      ];
      for (const [kind, h, key] of slots) {
        const t = base + h * 3_600_000;
        if (t > ROUND.open && t < ROUND.close && t > from && t <= to) out.push({ kind, key, at: t });
      }
    }
    if (ROUND.close > from && ROUND.close <= to) out.push({ kind: 'landing', key: 'landing', at: ROUND.close });
    return out.sort((a, b) => a.at - b.at);
  };
  const result = (votes: { a: number; b: number }) => {
    const n = votes.a + votes.b;
    if (n < LIMIT.balanceMin) return null;
    const pp = (Math.abs(votes.a - votes.b) * 100) / n;
    const level = pp < LIMIT.evenPp ? 'even' : pp < LIMIT.slightPp ? 'slight' : 'much';
    return { level, side: level === 'even' ? null : votes.a > votes.b ? 'a' : 'b' } as Post['result'];
  };

  const seed = (u: DemoLoungeUser, scene: LoungeScene): State => {
    const s: State = { scene, startedAt: clock(), acked: null, seat: null, posts: [], hides: new Set(), picks: new Map(), sent: [], replied: false, failOnce: true, reports: [], pairs: new Set(), seq: 0x100 };
    const now = SCENE_NOW[scene];
    const mk = (p: Partial<Post> & Pick<Post, 'kind' | 'at'>): Post => {
      s.seq += 1;
      return { id: uuid(s.seq), seat: null, body: '', quoteId: null, answerTo: null, captainKey: null, captainKind: null, result: null, votes: { a: 0, b: 0 }, deleted: false, empathyFrom: new Set(), ...p };
    };
    const roomOpen = scene !== 'emptyRoom';
    if (roomOpen) s.posts.push(mk({ kind: 'captain', at: ROOM_OPENED, captainKey: 'first', captainKind: 'first' }));
    const prevBalance: Post[] = [];
    for (const slot of captainSlots(ROOM_OPENED - 3_600_000, now)) {
      const p = mk({ kind: 'captain', at: slot.at, captainKey: slot.key, captainKind: slot.kind, votes: VOTES[slot.key] ?? { a: 8, b: 5 } });
      if (slot.kind === 'morning') {
        const b = prevBalance[prevBalance.length - 1];
        if (b && slot.at - b.at <= 12 * 3_600_000) p.result = result(b.votes);
      }
      if (slot.kind === 'balance') prevBalance.push(p);
      s.posts.push(p);
    }
    if (roomOpen) {
      const byIndex: Post[] = [];
      for (const x of SEED) {
        const t = at(x.at);
        if (t > now) continue;
        const answerTo = x.answer === 'first' ? (s.posts.find((p) => p.captainKind === 'first')?.id ?? null) : x.answer === 'q04' ? (s.posts.find((p) => p.captainKey === 'q04')?.id ?? null) : null;
        const p = mk({ kind: answerTo ? 'answer' : 'member', seat: OTHERS[x.who], body: x.body, at: t, answerTo, quoteId: x.quote !== undefined ? (byIndex[x.quote]?.id ?? null) : null });
        byIndex.push(p);
        s.posts.push(p);
      }
    }
    // 좌석 · 약속 동의
    if (scene !== 'first' && scene !== 'captainOnly') {
      s.seat = MY_SEAT;
      s.acked = scene === 'rules' ? RULES_OLD : LOUNGE_RULES_NOW;
      if (roomOpen && at(MINE_SEED.at) <= now) {
        const mine = mk({ kind: 'member', seat: MY_SEAT, body: MINE_SEED.body, at: at(MINE_SEED.at) });
        mine.empathyFrom.add(OTHERS[4]); // 가상 탑승객 한 분이 공감 → 글쓴이에게만 '공감받았어요'
        s.posts.push(mine);
      }
    }
    s.posts.sort((a, b) => a.at - b.at);
    states.set(u.id, s);
    return s;
  };
  const stateOf = (u: DemoLoungeUser): State => states.get(u.id) ?? seed(u, sceneFor(u));

  // 서버 lounge_me 흉내: none · closed · left · kicked · ok
  const me = (u: DemoLoungeUser, s: State): 'none' | 'closed' | 'left' | 'kicked' | 'ok' => {
    const byEmail = loungeSceneOfEmail(u.email) !== null || override.has(u.id);
    const f = byEmail ? 'in' : flight(u);
    if (s.scene === 'closed' || f === 'after' || nowOf(s) >= ROUND.match) return s.seat || f === 'after' || s.scene === 'closed' ? 'closed' : 'none';
    if (s.scene === 'kicked') return 'kicked';
    if (s.scene === 'left' || f === 'none') return s.seat ? 'left' : 'none';
    return 'ok';
  };
  const paused = (s: State) => s.scene === 'paused';
  const roomOpen = (s: State) => s.scene !== 'emptyRoom';
  const areaOpen = (s: State) => s.scene !== 'captainOnly';
  const visibleSeat = (s: State, seat: string | null) => seat === null || (!s.hides.has(seat) && !(seat === s.seat && paused(s)));
  const find = (s: State, id: unknown) => s.posts.find((p) => p.id === id) ?? null;

  const postJson = (s: State, p: Post): Row => {
    if (p.kind === 'captain') {
      const pickOpen = p.captainKind === 'balance' && roomOpen(s) && nowOf(s) < p.at + 5 * 3_600_000 && nowOf(s) < ROUND.close && !lightsOut(nowOf(s));
      return { id: p.id, seat: null, kind: 'captain', captain: p.captainKey, captain_kind: p.captainKind, at: iso(p.at), pick: s.picks.get(p.id) ?? null, pick_open: pickOpen, result: p.result ? { level: p.result.level, side: p.result.side } : null };
    }
    const mine = p.seat === s.seat;
    let quote: Row | null = null;
    if (p.quoteId) {
      const q = find(s, p.quoteId);
      quote = !q || q.deleted ? { id: p.quoteId, state: 'deleted' } : !visibleSeat(s, q.seat) ? { id: q.id, state: 'hidden' } : { id: q.id, seat: q.seat, body: q.body };
    }
    const base: Row = { id: p.id, seat: p.seat, kind: p.kind, body: p.body, at: iso(p.at), mine, tag: p.kind === 'answer' ? 'answer' : null, quote };
    return mine ? { ...base, received: p.empathyFrom.size > 0, help: demoHelpHit(p.body) } : { ...base, empathized: s.seat !== null && p.empathyFrom.has(s.seat) };
  };
  const shownPosts = (s: State) => s.posts.filter((p) => !p.deleted && p.at <= nowOf(s) && visibleSeat(s, p.seat)).slice(-200);

  const ok = (data: unknown): DbResult => ({ data, error: null });
  const code = (c: string, extra: Row = {}): DbResult => ok({ ok: false, code: c, ...extra });

  const handlers: Record<string, (u: DemoLoungeUser, s: State, args: Row) => DbResult> = {
    lounge_state: (u, s) => {
      const st = me(u, s);
      if (st !== 'ok') return ok({ state: st });
      const now = nowOf(s);
      if (!s.seat) {
        if (now >= ROUND.close) return ok({ state: 'landing', trip_no: ROUND.no, seat: null });
        if (!areaOpen(s)) {
          const captain = captainSlots(now - 24 * 3_600_000, now)
            .filter((x) => x.kind === 'morning' || x.kind === 'noon' || x.kind === 'landing')
            .map((x) => ({ captain_kind: x.kind, captain: x.key, at: iso(x.at) }));
          return ok({ state: 'captain_only', trip_no: ROUND.no, captain });
        }
      }
      if (now < ROUND.close && s.acked !== LOUNGE_RULES_NOW) return ok({ state: 'intro', trip_no: ROUND.no, rules_version: LOUNGE_RULES_NOW, has_seat: s.seat !== null });
      if (!s.seat) return ok({ state: 'stub', trip_no: ROUND.no });
      const state = now >= ROUND.close ? 'landing' : lightsOut(now) ? 'lights_out' : paused(s) ? 'paused' : !roomOpen(s) ? 'empty_room' : 'open';
      return ok({ state, trip_no: ROUND.no, seat: s.seat, channel: CHANNEL, posts: shownPosts(s).map((p) => postJson(s, p)) });
    },
    lounge_agree: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (nowOf(s) >= ROUND.close) return code('closed');
      if (!s.seat && !areaOpen(s)) return code('captain_only');
      if (args.p_rules_version !== LOUNGE_RULES_NOW) return code('rules_changed', { rules_version: LOUNGE_RULES_NOW });
      s.acked = LOUNGE_RULES_NOW;
      return ok({ ok: true });
    },
    lounge_take_seat: (u, s) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (s.seat) return ok({ ok: true, seat: s.seat });
      if (nowOf(s) >= ROUND.close) return code('closed');
      if (!areaOpen(s)) return code('captain_only');
      if (s.acked !== LOUNGE_RULES_NOW) return code('intro');
      s.seat = MY_SEAT; // 빈자리 가운데 섞은 차례 다음 칸(가상 탑승객 20좌석 다음)
      return ok({ ok: true, seat: s.seat });
    },
    lounge_get_post: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok' || !s.seat) return code(st === 'ok' ? 'not_found' : st);
      const p = find(s, args.p_post);
      if (!p || p.deleted || p.at > nowOf(s) || !visibleSeat(s, p.seat)) return code('not_found');
      return ok({ ok: true, post: postJson(s, p) });
    },
    lounge_post: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      const now = nowOf(s);
      if (!s.seat) return code(now >= ROUND.close ? 'closed' : 'read_only');
      if (now >= ROUND.close) return code('closed');
      if (lightsOut(now)) return code('lights_out');
      if (paused(s)) return code('paused');
      if (!roomOpen(s)) return code('read_only');
      const body = String(args.p_body ?? '').replace(/^[\s]+|[\s]+$/g, '');
      if (Array.from(body).length < 1) return code('empty');
      if (Array.from(body).length > LIMIT.bodyMax) return code('too_long');
      if (s.sent.filter((t) => t > now - MINUTE).length >= LIMIT.perMin) return code('rate_minute');
      if (s.sent.filter((t) => t >= kstDayStart(now)).length >= LIMIT.perDay) return code('rate_day');
      const flat = body.replace(/\s+/g, '');
      const codes = [CONTACT.test(body) ? 'contact' : null, LINK.test(body) ? 'url' : null, MONEY_WORDS.some((w) => flat.includes(w.replace(/\s+/g, ''))) ? 'money' : null, ABUSE_WORDS.some((w) => flat.includes(w)) ? 'abuse' : null].filter((c): c is string => c !== null);
      if (codes.length > 0) return code('filtered', { codes });
      const quote = args.p_quote ? find(s, args.p_quote) : null;
      if (args.p_quote && (!quote || quote.kind === 'captain' || quote.deleted || !visibleSeat(s, quote.seat))) return code('quote_invalid');
      const answer = args.p_answer ? find(s, args.p_answer) : null;
      if (args.p_answer && (!answer || answer.kind !== 'captain' || (answer.captainKind !== 'first' && answer.captainKind !== 'noon'))) return code('answer_invalid');
      s.seq += 1;
      const p: Post = { id: uuid(s.seq), seat: s.seat, kind: answer ? 'answer' : 'member', body, at: now, quoteId: quote?.id ?? null, answerTo: answer?.id ?? null, captainKey: null, captainKind: null, result: null, votes: { a: 0, b: 0 }, deleted: false, empathyFrom: new Set() };
      s.posts.push(p);
      s.sent.push(now);
      broadcast('post', { id: p.id, seat: p.seat, body: p.body, at: iso(p.at) });
      if (!s.replied) {
        s.replied = true;
        setTimeout(() => {
          if (states.get(u.id) !== s || p.deleted) return;
          s.seq += 1;
          const r: Post = { id: uuid(s.seq), seat: OTHERS[13], kind: 'member', body: REPLY, at: nowOf(s), quoteId: p.id, answerTo: null, captainKey: null, captainKind: null, result: null, votes: { a: 0, b: 0 }, deleted: false, empathyFrom: new Set() };
          p.empathyFrom.add(OTHERS[13]);
          s.posts.push(r);
          broadcast('post', { id: r.id, seat: r.seat, body: r.body, at: iso(r.at) });
        }, replyMs);
      }
      return ok({ ok: true, post: postJson(s, p), help: demoHelpHit(body) });
    },
    lounge_empathy: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (!s.seat) return code('read_only');
      const now = nowOf(s);
      if (now >= ROUND.close) return code('closed');
      if (lightsOut(now)) return code('lights_out');
      const p = find(s, args.p_post);
      if (!p || p.kind === 'captain' || p.deleted || p.seat === s.seat || !visibleSeat(s, p.seat)) return code('not_found');
      const on = args.p_on !== false;
      if (on) p.empathyFrom.add(s.seat);
      else p.empathyFrom.delete(s.seat);
      return ok({ ok: true, on });
    },
    lounge_hide: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (!s.seat) return code('read_only');
      const p = find(s, args.p_post);
      if (!p || p.kind === 'captain' || !p.seat || p.seat === s.seat) return code('not_found');
      const on = args.p_on !== false;
      if (on) s.hides.add(p.seat);
      else s.hides.delete(p.seat);
      return ok({ ok: true, on });
    },
    lounge_report: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (!s.seat) return code('read_only');
      const note = typeof args.p_note === 'string' ? args.p_note.trim() : '';
      if (!['RP4', 'RP5', 'RP6', 'RP7', 'RP8'].includes(String(args.p_reason)) || Array.from(note).length > 200) return code('invalid');
      const p = find(s, args.p_post);
      if (!p || p.kind === 'captain' || p.seat === s.seat) return code('not_found');
      // 신고 쌍(PL-26): RP4 · RP6 · RP7 · 판매 마감(수 17:30) 전 · 신고자 회차당 3쌍까지(4건째부터 신고로만)
      if (['RP4', 'RP6', 'RP7'].includes(String(args.p_reason)) && nowOf(s) < ROUND.close && p.seat && (s.pairs.has(p.seat) || s.pairs.size < 3)) s.pairs.add(p.seat);
      s.reports.push({ post: p.id, reason: String(args.p_reason), pair: p.seat !== null && s.pairs.has(p.seat) }); // 12 신고 내역 · 차단 목록에는 남기지 않는다(PL-25 — 라운지 전용)
      return ok({ ok: true });
    },
    lounge_pick: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (!s.seat) return code('read_only');
      if (args.p_side !== 'a' && args.p_side !== 'b') return code('invalid');
      const p = find(s, args.p_post);
      if (!p || p.captainKind !== 'balance') return code('not_found');
      const now = nowOf(s);
      if (now >= ROUND.close) return code('closed');
      if (lightsOut(now)) return code('lights_out');
      if (!(postJson(s, p).pick_open as boolean)) return code('pick_closed');
      if (!s.picks.has(p.id)) s.picks.set(p.id, args.p_side);
      return ok({ ok: true, side: s.picks.get(p.id) });
    },
    lounge_delete: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      if (!s.seat) return code('not_found');
      const p = find(s, args.p_post);
      if (!p || p.deleted || p.seat !== s.seat) return code('not_found');
      p.deleted = true;
      broadcast('gone', { id: p.id, seat: null, body: null, at: null });
      return ok({ ok: true });
    },
    get_lounge_report_note: (u, s, args) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      const r = [...s.reports].reverse().find((x) => x.post === args.p_post);
      return r ? ok({ ok: true, no_pair: r.pair }) : code('not_found');
    },
    // 0044 줄 전용 응답: 판정은 lounge_state 와 같고 글 · 좌석 · 채널은 내보내지 않는다. line 은 서버 키(first · seated · lightsOut · landing · captainOnly · kicked · null)
    get_lounge_row_state: (u, s) => {
      const r = handlers.lounge_state(u, s, {}).data as Row;
      const state = String(r.state);
      const LINE: Record<string, string> = { intro: 'first', stub: 'first', open: 'seated', empty_room: 'seated', paused: 'seated', lights_out: 'lightsOut', landing: 'landing', captain_only: 'captainOnly', kicked: 'kicked' };
      return ok({ state, line: LINE[state] ?? null });
    },
    // 0044 내가 숨긴 좌석: 좌석 이름 차례 · post = 되돌리기(lounge_hide(post, false))에 쓰는 그 좌석의 가장 늦은 글 id 하나(지운 글이어도 됨) · 회원 id 0
    get_lounge_my_hidden: (u, s) => {
      const st = me(u, s);
      if (st !== 'ok') return code(st);
      const seats = [...s.hides].sort().flatMap((seat) => {
        const latest = s.posts.filter((p) => p.seat === seat).sort((a, b) => b.at - a.at)[0];
        return latest ? [{ seat, post: latest.id }] : [];
      });
      return ok({ ok: true, seats });
    },
    demo_lounge_scene: (u, s, args) => {
      if (args.p_peek === true) return ok({ ok: true, scene: s.scene });
      const want = LOUNGE_SCENES.includes(args.p_scene as LoungeScene) ? (args.p_scene as LoungeScene) : LOUNGE_SCENES[(LOUNGE_SCENES.indexOf(s.scene) + 1) % LOUNGE_SCENES.length];
      override.set(u.id, want);
      if (want === 'closed' && s.seat) broadcast('closed', { id: null, seat: null, body: null, at: iso(ROUND.match) }); // 서버 lounge_close_tick 흉내: 공개 시각 뒤 객실 채널에 한 번
      seed(u, want);
      return ok({ ok: true, scene: want });
    },
  };

  return {
    handles: (name: string) => name in handlers,
    async rpc(u: DemoLoungeUser, name: string, args: Row = {}): Promise<DbResult> {
      if (name !== 'demo_lounge_scene' && !(await switchOn(u))) return { data: null, error: { code: '42501', message: 'feature_off' } }; // 서버 require_feature('lounge')
      const s = stateOf(u);
      if (name === 'lounge_post' && typeof args.p_body === 'string' && args.p_body.includes('데모실패') && s.failOnce) {
        s.failOnce = false;
        return { data: null, error: { code: '', message: 'Failed to fetch' } };
      }
      return handlers[name](u, s, args);
    },
    channel,
    removeChannel,
    // 시험 · 점검용(메모리 읽기만)
    sceneOf: (u: DemoLoungeUser) => stateOf(u).scene,
    joinedCount: () => [...channels].filter((c) => c.joined).length,
    peek: (u: DemoLoungeUser) => {
      const s = stateOf(u);
      return { scene: s.scene, seat: s.seat, acked: s.acked, hides: [...s.hides], reports: s.reports.length, picks: s.picks.size, posts: s.posts.filter((p) => !p.deleted).length };
    },
  };
}

export type DemoLounge = ReturnType<typeof createDemoLounge>;
export const DEMO_LOUNGE_OTHERS = OTHERS; // 시험용(가상 탑승객 좌석 20)
export const DEMO_LOUNGE_MY_SEAT = MY_SEAT;
export const DEMO_LOUNGE_CHANNEL = CHANNEL;
