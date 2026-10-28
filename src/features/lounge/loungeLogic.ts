// 라운지 화면 규칙(렌더 없는 셈 — 시험이 바로 부른다). 근거: 정책 L장 · 화면 요구 T4 '라운지 줄' · T6 셈표 · 카피 19-11(서버 응답 ↔ 글 키).
import type { BalanceSide, CaptainPost, LoungePost, LoungeQuote, LoungeStateCode, MemberPost } from './loungeApi';
import { LOUNGE_MAX_POSTS, byTime } from './loungeApi';
import { LOUNGE } from './loungeCopy';

// ── T4 라운지 줄(19-2 · 19-11) — 좌석 · 인원 · 미리보기 · 새 글 점 · 숫자 0. null = 줄 없음
export function rowLineOf(code: LoungeStateCode | 'off' | 'failed'): string | null {
  switch (code) {
    case 'intro':
    case 'stub':
      return LOUNGE.row.lineFirst;
    case 'open':
    case 'empty_room':
    case 'paused':
      return LOUNGE.row.lineSeated;
    case 'lights_out':
      return LOUNGE.row.lineLightsOut;
    case 'landing':
      return LOUNGE.row.lineLanding;
    case 'captain_only':
      return LOUNGE.row.lineCaptainOnly;
    case 'kicked':
      return LOUNGE.row.lineKicked;
    default:
      return null; // none · closed · left · 꺼짐 · 불러오기 실패 — 줄째 없음(오류 글 0)
  }
}

// ── T6 에서 할 수 있는 것(서버 0042 판정과 같은 갈래 — 서버가 최종)
const SEATED: readonly LoungeStateCode[] = ['open', 'empty_room', 'paused', 'lights_out', 'landing'];
export const hasRoom = (code: LoungeStateCode, seat: string | null) => SEATED.includes(code) && seat !== null; // 객실 글을 보는 상태
export const canWrite = (code: LoungeStateCode) => code === 'open'; // 글 · 인용 · [나도 답하기]
// 공감: 소등 · 착륙 준비 중 0(PL-13 · PL-15 · LGF-07). 빈 객실 · 쓰기 멈춤은 서버가 받는다
export const canEmpathize = (code: LoungeStateCode) => code === 'open' || code === 'empty_room' || code === 'paused';
// 숨김 · 신고: 좌석이 있으면 소등 · 착륙 준비 중에도 된다(PL-13 · PL-24 · PL-25 · LGF-15)
export const canHideReport = (code: LoungeStateCode, seat: string | null) => hasRoom(code, seat);
// 둘 중 하나 고르기: 서버 pick_open + 소등 · 착륙 준비가 아님
export const canPick = (code: LoungeStateCode, p: CaptainPost) => p.captainKind === 'balance' && p.pick === null && p.pickOpen && (code === 'open' || code === 'paused');

// ── 보내기 실패 → 입력칸 아래 한 줄(19-8 · 19-11). 글은 입력칸에 남긴다. 숫자 0
const FILTER_ORDER = ['contact', 'url', 'money', 'abuse'] as const;
export function sendErrorText(code: string, codes: readonly string[] = []): string {
  switch (code) {
    case 'filtered': {
      const first = FILTER_ORDER.find((c) => codes.includes(c)) ?? 'abuse';
      return first === 'contact' ? LOUNGE.error.contact : first === 'url' ? LOUNGE.error.link : first === 'money' ? LOUNGE.error.money : LOUNGE.error.abuse;
    }
    case 'read_only':
      return LOUNGE.error.readOnly;
    case 'lights_out':
      return LOUNGE.error.lightsOut;
    case 'closed':
      return LOUNGE.error.closed;
    case 'paused':
      return LOUNGE.error.paused;
    case 'empty':
      return LOUNGE.error.empty;
    case 'too_long':
      return LOUNGE.error.tooLong;
    case 'rate_minute':
      return LOUNGE.error.rate;
    case 'rate_day':
      return LOUNGE.error.daily;
    case 'quote_invalid':
      return LOUNGE.error.quoteInvalid;
    case 'answer_invalid':
      return LOUNGE.error.answerInvalid;
    case 'network':
      return LOUNGE.error.offline;
    default:
      return LOUNGE.error.sendFailed; // server · left · kicked(뒤이어 상태를 다시 읽는다)
  }
}
// 이 code 가 오면 화면 상태가 바뀐 것 — 상태를 다시 읽는다
export const STATE_CHANGED: readonly string[] = ['left', 'kicked', 'closed', 'none', 'lights_out', 'paused', 'read_only', 'off'];

export const empathyErrorText = (code: string) => (code === 'lights_out' ? LOUNGE.error.empathyLightsOut : code === 'closed' ? LOUNGE.error.empathyClosed : code === 'not_found' ? LOUNGE.error.notFound : LOUNGE.error.empathy);
export const hideErrorText = (code: string) => (code === 'not_found' ? LOUNGE.error.notFound : LOUNGE.error.hide);
export const reportErrorText = (code: string) => (code === 'not_found' ? LOUNGE.error.notFound : LOUNGE.error.report);
export const deleteErrorText = (code: string) => (code === 'not_found' ? LOUNGE.error.notFound : LOUNGE.error.delete);
export const pickErrorText = (code: string) => (code === 'pick_closed' ? LOUNGE.error.pickClosed : LOUNGE.error.balance);

// ── 글 목록(최근 200 · 더 불러오기 0)
export function mergePost(list: readonly LoungePost[], post: LoungePost): LoungePost[] {
  const next = [...list.filter((p) => p.id !== post.id), post].sort(byTime);
  return next.slice(-LOUNGE_MAX_POSTS);
}
// 지운 글 · 가려진 글(gone): 목록에서 빼고, 그 글을 인용한 상자는 '지운 글'로
export function removePost(list: readonly LoungePost[], id: string): LoungePost[] {
  return list.filter((p) => p.id !== id).map((p) => (p.kind !== 'captain' && p.quote?.id === id ? { ...p, quote: { id, state: 'deleted' as const } } : p));
}
// 이 좌석 숨기기: 그 좌석 글을 빼고 그 좌석 글을 인용한 상자는 가림(PL-24)
export function hideSeatPosts(list: readonly LoungePost[], seat: string): LoungePost[] {
  return list
    .filter((p) => p.kind === 'captain' || p.seat !== seat)
    .map((p) => (p.kind !== 'captain' && p.quote?.state === 'shown' && p.quote.seat === seat ? { ...p, quote: { id: p.quote.id, state: 'hidden' as const } } : p));
}

// 인용 상자 글(19-6 · 19-11): 보임 = 좌석 · 앞 40자 / 내가 숨긴 좌석 = '숨긴 좌석의 글이에요' / 가려짐 = '볼 수 없는 글이에요' / 지움 = '지운 글이에요'
export const QUOTE_PREVIEW = 40;
export const previewOf = (body: string) => (Array.from(body).length > QUOTE_PREVIEW ? `${Array.from(body).slice(0, QUOTE_PREVIEW).join('')}…` : body);
export function quoteLine(q: LoungeQuote, hiddenSeatOf: (quoteId: string) => boolean): { seat: string | null; text: string } {
  if (q.state === 'shown') return { seat: q.seat, text: previewOf(q.body) };
  if (q.state === 'deleted') return { seat: null, text: LOUNGE.msg.deleted };
  return { seat: null, text: hiddenSeatOf(q.id) ? LOUNGE.quote.hiddenSeat : LOUNGE.quote.unavailable };
}

// ── 기장 안내 글(19-9): 서버 captain 키 → 카피 LOUNGE.captain.<키>
type CaptainCopy = Record<string, unknown>;
export function captainText(key: string): { question: string; a: string | null; b: string | null } | null {
  const v = (LOUNGE.captain as CaptainCopy)[key];
  if (typeof v === 'string') return { question: v, a: null, b: null };
  if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'string')) return { question: v[0] as string, a: v[1] as string, b: v[2] as string };
  return null;
}
export function captainKindLabel(p: Pick<CaptainPost, 'captainKind'>): string | null {
  if (p.captainKind === 'first') return LOUNGE.captain.kind.first;
  if (p.captainKind === 'noon') return LOUNGE.captain.kind.noon;
  if (p.captainKind === 'balance') return LOUNGE.captain.kind.balance;
  return null; // 불 끄기 · 아침 · 착륙 인사는 종류 글 없음
}
export const canAnswer = (p: CaptainPost) => p.captainKind === 'first' || p.captainKind === 'noon';

// 아침 글의 어제 결과: 아침 글 바로 앞의 '둘 중 하나' 글의 선택지 이름으로(말 세 단계 — 숫자 · 비율 0)
export function balanceResultText(posts: readonly LoungePost[], morning: CaptainPost): { question: string; text: string } | null {
  if (!morning.result) return null;
  const before = posts.filter((p): p is CaptainPost => p.kind === 'captain' && p.captainKind === 'balance' && p.at < morning.at);
  const q = before.length > 0 ? captainText(before[before.length - 1].captainKey) : null;
  if (!q || !q.a || !q.b) return null;
  if (morning.result.level === 'even') return { question: q.question, text: LOUNGE.balance.even };
  const side: BalanceSide | null = morning.result.side;
  if (!side) return null;
  const option = side === 'a' ? q.a : q.b;
  return { question: q.question, text: morning.result.level === 'slight' ? LOUNGE.balance.slight(option) : LOUNGE.balance.much(option) };
}
// 둘 중 하나 결과가 이미 나왔나(그 글 뒤 아침 글에 결과)
export const balanceHasResult = (posts: readonly LoungePost[], balance: CaptainPost) => posts.some((p) => p.kind === 'captain' && p.captainKind === 'morning' && p.at > balance.at && p.result !== null);

// ── 회차 여행지(19-1: trip_no 1 ~ 12 차례) — 값이 없으면 부제 줄째 숨김
export function tripName(tripNo: number | null): string | null {
  if (tripNo === null || tripNo < 1) return null;
  const names = LOUNGE.trip.names;
  return names[(tripNo - 1) % names.length] ?? null;
}

// ── 화면 읽기 이름(19-10)
export function memberA11y(p: MemberPost): string {
  if (p.mine) return p.received ? `${LOUNGE.a11y.msgMine(p.body)}, ${LOUNGE.empathy.received}` : LOUNGE.a11y.msgMine(p.body);
  if (p.quote?.state === 'shown') return LOUNGE.a11y.msgQuote(p.seat, p.quote.seat, p.body);
  if (p.tag === 'answer') return LOUNGE.a11y.msgAnswer(p.seat, p.body);
  return LOUNGE.a11y.msg(p.seat, p.body);
}

// 좌석표(11 ~ 19열 × A ~ F = 54자리, 정책 PL-05) — 창가 · 통로 · 가운데 글 0
export const SEAT_ROWS = [11, 12, 13, 14, 15, 16, 17, 18, 19] as const;
export const SEAT_COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export function seatPosition(seat: string): { row: number; col: number } | null {
  const m = /^(1[1-9])([A-F])$/.exec(seat);
  if (!m) return null;
  return { row: SEAT_ROWS.indexOf(Number(m[1]) as (typeof SEAT_ROWS)[number]), col: SEAT_COLS.indexOf(m[2] as (typeof SEAT_COLS)[number]) };
}
