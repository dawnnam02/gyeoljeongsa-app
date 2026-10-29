// 라운지가 서버와 주고받는 일(LG-F · D-220). 서버 = backend/migrations/0042_lounge.sql(앱 함수 10 · 응답 모양 = backend/R_변경기록.md 10-4) — 이름 · 키를 그대로 맞췄다.
//   lounge_state()                         → {state, trip_no, …} state: none · closed · left · kicked · landing · captain_only(+ captain[]) · intro(+ rules_version · has_seat) · stub ·
//                                             lights_out · paused · empty_room · open(+ seat · channel · posts[최근 200])
//   lounge_agree(p_rules_version)           → {ok} / {ok:false, code: rules_changed(+ rules_version) · captain_only · closed · none · left · kicked}
//   lounge_take_seat()                      → {ok, seat:'13A'} / code intro · captain_only · closed …
//   lounge_get_post(p_post)                 → {ok, post} / not_found
//   lounge_post(p_body, p_quote, p_answer)  → {ok, post, help} / code read_only · lights_out · closed · paused · empty · too_long · rate_minute · rate_day · filtered(+ codes) · quote_invalid · answer_invalid · left · kicked
//   lounge_empathy(p_post, p_on) · lounge_hide(p_post, p_on) → {ok, on} / lights_out · closed(공감만) · not_found
//   lounge_report(p_post, p_reason RP4 ~ RP8, p_note) → 늘 {ok:true} / invalid · not_found
//   lounge_pick(p_post, p_side a | b)       → {ok, side} / pick_closed · lights_out · closed
//   lounge_delete(p_post)                   → {ok} / not_found
//   get_lounge_report_note(p_post)          → {ok, no_pair} / not_found — 0043 덧붙임: 신고 직후 신고자에게만, 그 신고가 이번 회차 짝 제외 쌍이 됐나(lounge_report 응답은 {ok:true} 그대로)
//   0044(3부-자): get_lounge_row_state()    → {state, line} — T4 줄 전용(글 · 좌석 · 채널 0). state = lounge_state 와 같은 값 · line = first · seated · lightsOut · landing · captainOnly · kicked · null(줄 0)
//                 get_lounge_my_hidden()    → {ok:true, seats:[{seat, post}]} / {ok:false, code} — 내가 숨긴 좌석(post = 되돌리기 lounge_hide(post, false)에 쓰는 그 좌석 글 id 하나 · 회원 id 0)
//                 실시간 closed             → 수 18:00 공개 뒤 객실 채널에 한 번, 내용 {id:null, seat:null, body:null, at} — 화면을 닫고 구독을 끊는다(5분 다시 읽기는 안전망)
//   오류: 스위치 꺼짐 feature_off(42501) · 로그인 아님 forbidden → 앱은 'off'(줄 0 · T6 → T4 목록)
//   실시간: 비공개 채널 channel(`lounge:<객실 uuid>`) · 서버 방송만 — 이벤트 post {id, seat, body, at}(seat null = 기장, body 'captain.<키>') · gone {id, …}
//  · 앱은 아는 키만 읽는다. 실시간 내용은 id · seat · body · at 넷만(LGF-02 · 보안 LC-05) · 회원 id 를 읽는 곳 0
//  · 앱은 채널로 보내지 않는다(Presence · 입력 중 · 보내기 0 — LGF-01). 글은 lounge_post 로만
//  · 로그에는 이벤트 이름과 코드만(글 · 좌석 · 채널 이름 0 — LGF-03)
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

export type LoungeStateCode = 'none' | 'closed' | 'left' | 'kicked' | 'landing' | 'captain_only' | 'intro' | 'stub' | 'lights_out' | 'paused' | 'empty_room' | 'open';
export const LOUNGE_STATE_CODES: readonly LoungeStateCode[] = ['none', 'closed', 'left', 'kicked', 'landing', 'captain_only', 'intro', 'stub', 'lights_out', 'paused', 'empty_room', 'open'];
export type CaptainKind = 'first' | 'noon' | 'balance' | 'lights_out' | 'morning' | 'landing';
const CAPTAIN_KINDS: readonly CaptainKind[] = ['first', 'noon', 'balance', 'lights_out', 'morning', 'landing'];
export type BalanceSide = 'a' | 'b';
export type BalanceLevel = 'even' | 'slight' | 'much';

export type LoungeQuote = { id: string; state: 'shown'; seat: string; body: string } | { id: string; state: 'hidden' | 'deleted' };
export type MemberPost = {
  kind: 'member' | 'answer';
  id: string;
  seat: string;
  body: string;
  at: number;
  mine: boolean;
  tag: 'answer' | null;
  quote: LoungeQuote | null;
  empathized: boolean; // 남의 글: 내가 공감을 눌렀나(나에게만)
  received: boolean; // 내 글: 공감을 받았나(글쓴이에게만 · 개수 0)
  help: boolean; // 내 글: 위기 낱말 안내(쓴 본인 응답에만)
};
export type CaptainPost = {
  kind: 'captain';
  id: string;
  captainKey: string; // 카피 LOUNGE.captain.<키>: first · lightsOut · morning · landing · q01 ~ q14 · b01 ~ b12
  captainKind: CaptainKind;
  at: number;
  pick: BalanceSide | null; // 둘 중 하나: 내가 고른 쪽
  pickOpen: boolean;
  result: { level: BalanceLevel; side: BalanceSide | null } | null; // 아침 글의 어제 결과(말 세 단계 — 숫자 0)
};
export type LoungePost = MemberPost | CaptainPost;
export type CaptainNote = { captainKind: CaptainKind; captainKey: string; at: number }; // 기장 안내만(captain_only) 상태의 글

export type LoungeState = {
  code: LoungeStateCode;
  tripNo: number | null;
  seat: string | null;
  channel: string | null;
  posts: LoungePost[];
  captain: CaptainNote[];
  rulesVersion: string | null;
  hasSeat: boolean;
};

// 0044 줄 전용 응답: 상태 + 줄 키(서버가 lounge_state 와 같은 판정으로 고름). intro + 좌석 있음(약속 판이 바뀐 회차)은 lounge_state 의 has_seat 를 한 번 더 읽어 앱이 rulesChanged 로 가름
export type RowLine = 'first' | 'seated' | 'lightsOut' | 'landing' | 'captainOnly' | 'kicked';
const ROW_LINES: readonly RowLine[] = ['first', 'seated', 'lightsOut', 'landing', 'captainOnly', 'kicked'];
export type LoungeRowResult = { code: LoungeStateCode; line: RowLine | null };
export type HiddenSeat = { seat: string; post: string };

// 실시간 이벤트 내용 — 넷만 읽는다(LGF-02)
export type LoungeEvent = { id: string; seat: string | null; body: string | null; at: number | null };

export type LoungeFail = { ok: false; code: string; codes?: string[]; rulesVersion?: string };
export type LoungeResult<T> = { ok: true; data: T } | LoungeFail;
// 앱이 따로 다루는 실패: off(스위치 꺼짐 · 로그인 아님) · network(인터넷) · server(그 밖) — 나머지는 서버 code 그대로
export const LOUNGE_OFF = 'off';

export type LoungeHandlers = { onPost: (e: LoungeEvent) => void; onGone: (e: LoungeEvent) => void; onClosed?: () => void }; // closed = 0044: 수 18:00 공개 뒤 한 번(내용은 읽지 않는다)

export type LoungeApi = {
  state(): Promise<LoungeResult<LoungeState>>;
  agree(rulesVersion: string): Promise<LoungeResult<null>>;
  takeSeat(): Promise<LoungeResult<{ seat: string }>>;
  getPost(id: string): Promise<LoungeResult<LoungePost>>;
  post(body: string, quoteId: string | null, answerId: string | null): Promise<LoungeResult<{ post: LoungePost | null; help: boolean }>>;
  empathy(id: string, on: boolean): Promise<LoungeResult<{ on: boolean }>>;
  hide(id: string, on: boolean): Promise<LoungeResult<{ on: boolean }>>;
  report(id: string, reason: LoungeReason, note: string): Promise<LoungeResult<null>>;
  pick(id: string, side: BalanceSide): Promise<LoungeResult<{ side: BalanceSide }>>;
  remove(id: string): Promise<LoungeResult<null>>;
  reportNote(id: string): Promise<LoungeResult<{ noPair: boolean }>>; // 0043 get_lounge_report_note
  rowState(): Promise<LoungeResult<LoungeRowResult>>; // 0044 get_lounge_row_state — T4 줄 전용
  myHidden(): Promise<LoungeResult<{ seats: HiddenSeat[] }>>; // 0044 get_lounge_my_hidden — 숨긴 좌석 시트를 다시 들어와도 채움
  subscribe(channel: string, handlers: LoungeHandlers): () => void; // 끊는 함수를 돌려준다
};

// 라운지 신고 사유 5개(정책 PL-25 · 0042 — RP1 ~ RP3 0)
export const LOUNGE_REASONS = ['RP4', 'RP5', 'RP6', 'RP7', 'RP8'] as const;
export type LoungeReason = (typeof LOUNGE_REASONS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const idOf = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v));
const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const SEAT = /^1[1-9][A-F]$/; // 11 ~ 19열 × A ~ F(정책 PL-05)
const seatOf = (v: unknown): string | null => (typeof v === 'string' && SEAT.test(v) ? v : null);
const CHANNEL = /^lounge:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sideOf = (v: unknown): BalanceSide | null => (v === 'a' || v === 'b' ? v : null);

export function parseQuote(raw: unknown): LoungeQuote | null {
  if (!isRecord(raw)) return null;
  const id = idOf(raw.id);
  if (!id) return null;
  if (raw.state === 'hidden' || raw.state === 'deleted') return { id, state: raw.state };
  const seat = seatOf(raw.seat);
  return seat && typeof raw.body === 'string' ? { id, state: 'shown', seat, body: raw.body } : { id, state: 'deleted' };
}

export function parsePost(raw: unknown): LoungePost | null {
  if (!isRecord(raw)) return null;
  const id = idOf(raw.id);
  const at = time(raw.at);
  if (!id || at === null) return null;
  if (raw.kind === 'captain') {
    const captainKind = CAPTAIN_KINDS.includes(raw.captain_kind as CaptainKind) ? (raw.captain_kind as CaptainKind) : null;
    const captainKey = str(raw.captain);
    if (!captainKind || !captainKey) return null;
    const r = isRecord(raw.result) ? raw.result : null;
    const level = r && (r.level === 'even' || r.level === 'slight' || r.level === 'much') ? r.level : null;
    return { kind: 'captain', id, captainKey, captainKind, at, pick: sideOf(raw.pick), pickOpen: raw.pick_open === true, result: level ? { level, side: sideOf(r?.side) } : null };
  }
  if (raw.kind !== 'member' && raw.kind !== 'answer') return null;
  const seat = seatOf(raw.seat);
  if (!seat || typeof raw.body !== 'string') return null;
  return {
    kind: raw.kind,
    id,
    seat,
    body: raw.body,
    at,
    mine: raw.mine === true,
    tag: raw.tag === 'answer' ? 'answer' : null,
    quote: parseQuote(raw.quote),
    empathized: raw.empathized === true,
    received: raw.received === true,
    help: raw.help === true,
  };
}

// 서버 차례(오래된 글 → 새 글)를 지킨다. 같은 때면 id 차례
export const byTime = (a: LoungePost, b: LoungePost) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function parseState(raw: unknown): LoungeState | null {
  if (!isRecord(raw)) return null;
  const code = LOUNGE_STATE_CODES.includes(raw.state as LoungeStateCode) ? (raw.state as LoungeStateCode) : null;
  if (!code) return null;
  const posts = Array.isArray(raw.posts) ? raw.posts.map(parsePost).filter((p): p is LoungePost => p !== null).sort(byTime) : [];
  const captain = Array.isArray(raw.captain)
    ? raw.captain
        .map((c): CaptainNote | null => {
          if (!isRecord(c)) return null;
          const kind = CAPTAIN_KINDS.includes(c.captain_kind as CaptainKind) ? (c.captain_kind as CaptainKind) : null;
          const key = str(c.captain);
          const at = time(c.at);
          return kind && key && at !== null ? { captainKind: kind, captainKey: key, at } : null;
        })
        .filter((c): c is CaptainNote => c !== null)
    : [];
  const channel = typeof raw.channel === 'string' && CHANNEL.test(raw.channel) ? raw.channel : null;
  return {
    code,
    tripNo: int(raw.trip_no),
    seat: seatOf(raw.seat),
    channel,
    posts: posts.slice(-LOUNGE_MAX_POSTS),
    captain,
    rulesVersion: str(raw.rules_version),
    hasSeat: raw.has_seat === true,
  };
}

export function parseRow(raw: unknown): LoungeRowResult | null {
  if (!isRecord(raw)) return null;
  const code = LOUNGE_STATE_CODES.includes(raw.state as LoungeStateCode) ? (raw.state as LoungeStateCode) : null;
  if (!code) return null;
  const line = ROW_LINES.includes(raw.line as RowLine) ? (raw.line as RowLine) : null; // 모르는 값 · null = 줄 0
  return { code, line };
}

export function parseHidden(raw: unknown): HiddenSeat | null {
  if (!isRecord(raw)) return null;
  const seat = seatOf(raw.seat);
  const post = idOf(raw.post);
  return seat && post ? { seat, post } : null;
}

// 최근 200개까지만(정책 PL-14 — 더 불러오기 0)
export const LOUNGE_MAX_POSTS = 200;

// 실시간 이벤트 → 넷만(다른 키가 와도 읽지 않는다)
export function pickEvent(raw: unknown): LoungeEvent | null {
  const p = isRecord(raw) && isRecord(raw.payload) ? raw.payload : raw; // supabase 방송 콜백은 {type, event, payload}
  if (!isRecord(p)) return null;
  const id = idOf(p.id);
  if (!id) return null;
  return { id, seat: seatOf(p.seat), body: typeof p.body === 'string' ? p.body : null, at: time(p.at) };
}

type DbError = { code?: string | null; message?: string | null };
type Rpc = { data: unknown; error: DbError | null };
type ChannelLike = { on: (type: string, filter: { event: string }, cb: (msg: unknown) => void) => ChannelLike; subscribe: (cb?: (status: string) => void) => unknown };
type RealtimeClient = { channel: (name: string, opts?: unknown) => ChannelLike; removeChannel: (ch: ChannelLike) => unknown; realtime?: { setAuth?: () => unknown } };
const BAD = Symbol('bad'); // 응답 모양이 틀림(→ server)

export function createLoungeApi(client: SupabaseClient): LoungeApi {
  const call = async (fn: string, args: Record<string, unknown> = {}): Promise<Rpc> => {
    try {
      return (await client.rpc(fn, args)) as Rpc;
    } catch {
      return { data: null, error: { code: null, message: 'fetch failed' } };
    }
  };
  // 오류 · 실패 응답을 하나로: 꺼짐 · 인터넷 · 서버 · 서버 code
  const run = async <T,>(fn: string, args: Record<string, unknown>, read: (data: Record<string, unknown>) => T | typeof BAD): Promise<LoungeResult<T>> => {
    const { data, error } = await call(fn, args);
    if (error) {
      const f = readDbFailure(error);
      const msg = String(error.message ?? '').split(':')[0].trim();
      const code = f.network ? 'network' : f.code === '42501' || msg === 'feature_off' || msg === 'forbidden' ? LOUNGE_OFF : 'server';
      safeLog({ event: `lounge.${fn.replace('lounge_', '')}.fail`, code: f.code ?? code });
      return { ok: false, code };
    }
    if (!isRecord(data)) return { ok: false, code: 'server' };
    if (data.ok === false) {
      const code = str(data.code) ?? 'server';
      return { ok: false, code, ...(Array.isArray(data.codes) ? { codes: data.codes.filter((c): c is string => typeof c === 'string') } : {}), ...(str(data.rules_version) ? { rulesVersion: str(data.rules_version) as string } : {}) };
    }
    const v = read(data);
    return v === BAD ? { ok: false, code: 'server' } : { ok: true, data: v };
  };

  return {
    state: () => run('lounge_state', {}, (d) => parseState(d) ?? BAD),
    agree: (rulesVersion) => run('lounge_agree', { p_rules_version: rulesVersion }, (d) => (d.ok === true ? null : BAD)),
    takeSeat: () => run('lounge_take_seat', {}, (d) => (seatOf(d.seat) ? { seat: d.seat as string } : BAD)),
    getPost: (id) => run('lounge_get_post', { p_post: id }, (d) => parsePost(d.post) ?? BAD),
    post: (body, quoteId, answerId) => run('lounge_post', { p_body: body, p_quote: quoteId, p_answer: answerId }, (d) => ({ post: parsePost(d.post), help: d.help === true })),
    empathy: (id, on) => run('lounge_empathy', { p_post: id, p_on: on }, (d) => ({ on: d.on === true })),
    hide: (id, on) => run('lounge_hide', { p_post: id, p_on: on }, (d) => ({ on: d.on === true })),
    report: (id, reason, note) => run('lounge_report', { p_post: id, p_reason: reason, p_note: note.trim() === '' ? null : note.trim() }, (d) => (d.ok === true ? null : BAD)),
    pick: (id, side) => run('lounge_pick', { p_post: id, p_side: side }, (d) => (sideOf(d.side) ? { side: d.side as BalanceSide } : BAD)),
    remove: (id) => run('lounge_delete', { p_post: id }, (d) => (d.ok === true ? null : BAD)),
    reportNote: (id) => run('get_lounge_report_note', { p_post: id }, (d) => (typeof d.no_pair === 'boolean' ? { noPair: d.no_pair } : BAD)),
    rowState: () => run('get_lounge_row_state', {}, (d) => parseRow(d) ?? BAD),
    myHidden: () => run('get_lounge_my_hidden', {}, (d) => ({ seats: Array.isArray(d.seats) ? d.seats.map(parseHidden).filter((x): x is HiddenSeat => x !== null) : [] })),
    subscribe(channel, handlers) {
      if (!CHANNEL.test(channel)) return () => undefined;
      const rt = client as unknown as RealtimeClient;
      let closed = false;
      let ch: ChannelLike | null = null;
      try {
        ch = rt
          .channel(channel, { config: { private: true } })
          .on('broadcast', { event: 'post' }, (msg) => {
            const e = pickEvent(msg);
            if (e && !closed) handlers.onPost(e);
          })
          .on('broadcast', { event: 'gone' }, (msg) => {
            const e = pickEvent(msg);
            if (e && !closed) handlers.onGone(e);
          })
          .on('broadcast', { event: 'closed' }, () => {
            if (!closed) handlers.onClosed?.(); // 0044: 내용({id:null …})은 읽지 않는다 — 닫혔다는 사실만
          });
        const joined = ch;
        // 비공개 채널은 로그인 토큰으로 들어간다 — 토큰을 실시간 연결에 먼저 건 뒤 구독
        void Promise.resolve(rt.realtime?.setAuth?.())
          .catch(() => undefined)
          .then(() => {
            if (!closed) joined.subscribe();
          });
      } catch {
        safeLog({ event: 'lounge.subscribe.fail', code: 'client' });
        return () => undefined; // 실시간을 못 붙이면 화면에 들어올 때 다시 읽기만
      }
      return () => {
        closed = true;
        if (ch) void Promise.resolve(rt.removeChannel(ch)).catch(() => undefined);
      };
    },
  };
}
