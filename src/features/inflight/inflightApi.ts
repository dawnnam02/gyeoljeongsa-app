// 기내 서비스 · 연애 기능 1.0 이 서버와 주고받는 일(IF2-F · D-223). 서버 = backend/migrations/0043_inflight.sql(앱 함수 · 응답 모양 = backend/R_변경기록.md 11-4) — 이름 · 인자 · 키를 그대로 맞췄다.
//   get_home_state()                       → {stage, blocks, hobby_notice?, pocket?{cells}, status?{head, cells, writable}, pair?{room_id, cells}, me?{cells}, reflect_ok?}
//   get_magazine()                         → {state none | not_yet | issued, issue_date, trip_no, week_element, column, ck17a, sky{signs[달력 순 한두 개], zodiacs[같은 차례 주간 글 id]} | null, grain{stem, saju, relation} | null}
//        0046(3부-차): 경계 날(시작일 −1 · 0 · +1, 해마다 36일)은 순서 없는 한 쌍을 달력 순으로 — 대표 · 이웃 구분 키 sign · cusp · zodiac 은 응답에 없다
//   get_week_card() · pick_week_card(p_slot) → {state none | face_down | revealed(slot, card) | not_ready} · {ok, slot, card} | {ok:false, code already_picked(slot, card) | invalid_slot | none | not_ready}
//   pre_answer_questions()                 → {state none | open | landing | not_ready, questions[20 id]}
//   preview_my_profile()                   → {profile(짝이 get_candidate_profile 로 받는 값 그대로), ck17b, same_hobby}
//   get_pair_card(p_room)                  → {ok, card{same[{code} | {group}], saju | null, star | null, ck17_mine, made_at}} | {ok:false, code not_found}
//   opener_chips(p_room)                   → {ok, show, chips[{id ct-.. | ch-.., hobby?{code | group}}]}
//   talk_topics(p_room)                    → {ok, depths[light · taste · life · values], questions[그날 10 id], together_used} | {ok:false, code not_found | room_closed | not_ready}
//   send_chat_card(p_room, p_tag, p_body, p_ref) → {ok, message(+ left)} | {ok:false, code text_blocked(codes) | invalid_tag | invalid_ref | too_long | not_first | not_today | already_sent | not_found | room_closed}
//   together_send(p_room, p_question, p_body, p_answer) · together_answer(p_card, p_answer) · together_withdraw(p_card) → {ok, (opened,) message, help?} | {ok:false, code …}
//        0045: 오늘 거르기 횟수 30 이상이면 together_send · together_answer 모두 {ok:false, code:'rate_limited'}(전엔 DB 오류 또는 상한 없음) — 화면은 채팅 limited 글. together_answer opened:false = 열기 직전 검사에 걸림(응답 모양 그대로 — 화면은 '기다려요' 그대로)
//        help = 위기 도움 카드 참/거짓 한 칸(내 답이 보내진 직후 응답에만 · 저장 0 · 정책 P4-29) — 백엔드 0047 뒤. 응답에 칸이 없으면 0
//   오류: 스위치 꺼짐 feature_off(42501) · 로그인 아님 forbidden → 'off'
//  · 앱은 아는 키만 읽는다 — 상대 이름 · 사진 · 나이 · 별자리 이름 · 일간 · 띠 · 좌석 · 회차 번호 키는 응답에 와도 버린다(IFF-01 · IFF-04 · 정책 PF-08 · PF-12)
//  · 카드 · 칩 계산은 서버 몫(앱 계산 0, IFF-10). 앱은 결과 번호 · 라이브러리 id 만 받아 미리 쓴 글로 그린다
//  · 홈을 열 때 부르는 서버 함수는 get_home_state 하나(+ 탑승권 기존 둘) · AI 호출 0(PF-09 · IFF-04 · IFF-11)
//  · 로그에는 이벤트 이름과 코드만(글 · 답 · 방 id 0 — 보안 P7-b)
import type { SupabaseClient } from '@supabase/supabase-js';

import { parseMessage, type Message } from '@/features/chat/chatApi';
import { safeLog } from '@/lib/log';
import { readDbFailure } from '@/lib/serverError';

type DbError = { code?: string | null; message?: string | null };
export type RpcResult = { data: unknown; error: DbError | null };
export type RpcCall = (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;

export const IF2_OFF = 'off';
export type If2Fail = { ok: false; code: string; codes?: string[] };
export type If2Result<T> = { ok: true; data: T } | If2Fail;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null);

// ── 홈 상태(get_home_state) ─────────────────────────────────────────────
export const HOME_STAGES = ['prelaunch', 'inflight', 'landing', 'overlap', 'matched', 'noMatch', 'before'] as const;
export type HomeStage = (typeof HOME_STAGES)[number];
export const HOME_BLOCKS = ['T1', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'] as const;
export type HomeBlock = (typeof HOME_BLOCKS)[number];
export type PocketCell = { kind: 'mag'; state: 'not_yet' | 'issued' } | { kind: 'card'; state: 'face_down' } | { kind: 'card'; state: 'revealed'; card: number } | { kind: 'type' };
export type StatusCell = 'postcard' | 'pre_answer' | 'meet_prep' | 'meet_memo';
export type PairCell = 'pair_card' | 'values_talk' | 'meet_prep' | 'meet_memo';
export type MeCell = 'type' | 'preview';
export type HomeState = {
  stage: HomeStage;
  blocks: HomeBlock[];
  hobbyNotice: boolean;
  pocket: PocketCell[] | null;
  status: { head: 'arrival' | 'landing' | 'meet'; cells: StatusCell[]; writable: boolean } | null;
  pair: { roomId: string; cells: PairCell[] } | null;
  me: { cells: MeCell[] } | null;
  reflectOk: boolean;
};

function parsePocket(raw: unknown): PocketCell[] {
  if (!Array.isArray(raw)) return [];
  const out: PocketCell[] = [];
  for (const c of raw) {
    if (!isRecord(c)) continue;
    if (c.kind === 'mag') out.push({ kind: 'mag', state: c.state === 'not_yet' ? 'not_yet' : 'issued' });
    else if (c.kind === 'card') {
      const card = int(c.card);
      out.push(c.state === 'revealed' && card !== null && card >= 0 && card <= 21 ? { kind: 'card', state: 'revealed', card } : { kind: 'card', state: 'face_down' });
    } else if (c.kind === 'type') out.push({ kind: 'type' });
  }
  return out;
}

export function parseHomeState(raw: unknown): HomeState | null {
  if (!isRecord(raw)) return null;
  const stage = oneOf(raw.stage, HOME_STAGES);
  if (!stage) return null;
  const blocks = strs(raw.blocks).filter((b): b is HomeBlock => (HOME_BLOCKS as readonly string[]).includes(b));
  const st = isRecord(raw.status) ? raw.status : null;
  const head = st ? oneOf(st.head, ['arrival', 'landing', 'meet'] as const) : null;
  const pr = isRecord(raw.pair) ? raw.pair : null;
  const roomId = pr ? str(pr.room_id) : null;
  const me = isRecord(raw.me) ? raw.me : null;
  return {
    stage,
    blocks,
    hobbyNotice: raw.hobby_notice === true,
    pocket: isRecord(raw.pocket) ? parsePocket(raw.pocket.cells) : null,
    status: st && head ? { head, cells: strs(st.cells).filter((c): c is StatusCell => ['postcard', 'pre_answer', 'meet_prep', 'meet_memo'].includes(c)), writable: st.writable === true } : null,
    pair: pr && roomId ? { roomId, cells: strs(pr.cells).filter((c): c is PairCell => ['pair_card', 'values_talk', 'meet_prep', 'meet_memo'].includes(c)) } : null,
    me: me ? { cells: strs(me.cells).filter((c): c is MeCell => c === 'type' || c === 'preview') } : null,
    reflectOk: raw.reflect_ok === true,
  };
}

// ── 기내지(get_magazine) ────────────────────────────────────────────────
export type Magazine =
  | { state: 'none' | 'not_yet' }
  | {
      state: 'issued';
      issueDate: string | null;
      tripNo: number | null;
      weekElement: string | null;
      column: string | null;
      ck17a: boolean;
      sky: { signs: string[]; zodiacs: string[] } | null;
      grain: { stem: number; saju: string; relation: string } | null;
    };

export function parseMagazine(raw: unknown): Magazine | null {
  if (!isRecord(raw)) return null;
  if (raw.state === 'none' || raw.state === 'not_yet') return { state: raw.state };
  if (raw.state !== 'issued') return null;
  const skyRaw = isRecord(raw.sky) ? raw.sky : null;
  const signs = skyRaw ? strs(skyRaw.signs).slice(0, 2) : [];
  const zodiacs = skyRaw ? strs(skyRaw.zodiacs).slice(0, 2) : [];
  const sky = signs.length >= 1 && zodiacs.length === signs.length ? { signs, zodiacs } : null; // 별자리와 글이 같은 수·차례일 때만(옛 sign · cusp · zodiac 모양은 읽지 않는다)
  const g = isRecord(raw.grain) ? raw.grain : null;
  const grain = g && int(g.stem) !== null && str(g.saju) && str(g.relation) ? { stem: int(g.stem) as number, saju: str(g.saju) as string, relation: str(g.relation) as string } : null;
  return { state: 'issued', issueDate: str(raw.issue_date), tripNo: int(raw.trip_no), weekElement: str(raw.week_element), column: str(raw.column), ck17a: raw.ck17a === true, sky, grain };
}

// ── 이번 주 카드 ────────────────────────────────────────────────────────
export type WeekCard = { state: 'none' | 'face_down' | 'not_ready' } | { state: 'revealed'; slot: number; card: number };
export function parseWeekCard(raw: unknown): WeekCard | null {
  if (!isRecord(raw)) return null;
  if (raw.state === 'revealed') {
    const slot = int(raw.slot);
    const card = int(raw.card);
    return slot !== null && card !== null && card >= 0 && card <= 21 ? { state: 'revealed', slot, card } : null;
  }
  const s = oneOf(raw.state, ['none', 'face_down', 'not_ready'] as const);
  return s ? { state: s } : null;
}

// ── 미리 답해 두는 질문 · 미리보기 ─────────────────────────────────────────
export type PreQuestions = { state: 'none' | 'open' | 'landing' | 'not_ready'; questions: string[] };
export type PreviewMe = { profile: Record<string, unknown>; ck17b: boolean; sameHobby: boolean };

// ── 궁합 카드 · 칩 · 이야깃거리 ────────────────────────────────────────────
export type HobbyItem = { code: string } | { group: string };
const parseHobby = (v: unknown): HobbyItem | null => (isRecord(v) && str(v.code) ? { code: str(v.code) as string } : isRecord(v) && str(v.group) ? { group: str(v.group) as string } : null);
export type PairCard = { same: HobbyItem[]; saju: string | null; star: string | null; ck17Mine: boolean };
export function parsePairCard(raw: unknown): PairCard | null {
  if (!isRecord(raw) || !isRecord(raw.card)) return null;
  const c = raw.card;
  const same = Array.isArray(c.same) ? c.same.map(parseHobby).filter((h): h is HobbyItem => h !== null).slice(0, 2) : [];
  const saju = str(c.saju);
  const star = str(c.star);
  return { same, saju: saju && /^cs-[a-z]+-[a-z]+-\d$/.test(saju) ? saju : null, star: star && /^cst-[a-z]+-[a-z]+-\d$/.test(star) ? star : null, ck17Mine: c.ck17_mine === true };
}
export type OpenerChip = { id: string; hobby: HobbyItem | null };
export type OpenerChips = { show: boolean; chips: OpenerChip[] };
export const TALK_DEPTHS = ['light', 'taste', 'life', 'values'] as const;
export type TalkDepth = (typeof TALK_DEPTHS)[number];
export type TalkTopics = { depths: TalkDepth[]; questions: string[]; togetherUsed: boolean };

export type CardTag = 'postcard' | 'topic' | 'about_me' | 'farewell';

export type InflightApi = {
  home(): Promise<If2Result<HomeState>>;
  magazine(): Promise<If2Result<Magazine>>;
  weekCard(): Promise<If2Result<WeekCard>>;
  pickWeekCard(slot: number): Promise<{ ok: true; slot: number; card: number } | (If2Fail & { slot?: number; card?: number })>;
  preQuestions(): Promise<If2Result<PreQuestions>>;
  preview(): Promise<If2Result<PreviewMe>>;
  pairCard(roomId: string): Promise<If2Result<PairCard>>;
  openerChips(roomId: string): Promise<If2Result<OpenerChips>>;
  topics(roomId: string): Promise<If2Result<TalkTopics>>;
  sendCard(roomId: string, tag: CardTag, body: string, ref: string): Promise<{ ok: true; message: Message | null; left: boolean } | If2Fail>;
  togetherSend(roomId: string, questionId: string, body: string, answer: string): Promise<{ ok: true; message: Message | null; help?: true } | If2Fail>;
  togetherAnswer(cardId: string, answer: string): Promise<{ ok: true; opened: boolean; message: Message | null; help?: true } | If2Fail>;
  togetherWithdraw(cardId: string): Promise<{ ok: true; message: Message | null } | If2Fail>;
};

export function createInflightApi(call: RpcCall): InflightApi {
  const rpc = async (fn: string, args: Record<string, unknown> = {}): Promise<RpcResult> => {
    try {
      return await call(fn, args);
    } catch {
      return { data: null, error: { code: 'client', message: 'rpc_failed' } };
    }
  };
  const failOf = (error: DbError, event: string): If2Fail => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    if (f.network) return { ok: false, code: 'network' };
    const head = String(error.message ?? '').split(':')[0].trim();
    if (f.code === '42501' || head === 'feature_off' || head === 'forbidden') return { ok: false, code: IF2_OFF };
    if (head === 'rate_limited') return { ok: false, code: 'rate_limited' }; // send_chat_card(작별 포함)는 상한 · 1분 · 하루가 DB 오류 rate_limited(P0001) — JSON 코드와 같은 이름으로
    return { ok: false, code: 'server' };
  };
  // 응답 안 {ok:false, code} 를 그대로(서버 코드)
  const inner = (data: unknown): If2Fail | null =>
    isRecord(data) && data.ok === false ? { ok: false, code: str(data.code) ?? 'server', ...(Array.isArray(data.codes) ? { codes: strs(data.codes) } : {}) } : null;
  async function read<T>(fn: string, args: Record<string, unknown>, parse: (d: unknown) => T | null, event: string): Promise<If2Result<T>> {
    const { data, error } = await rpc(fn, args);
    if (error) return failOf(error, event);
    const bad = inner(data);
    if (bad) return bad;
    const v = parse(data);
    return v === null ? { ok: false, code: 'server' } : { ok: true, data: v };
  }
  const messageOf = (data: unknown): Message | null => (isRecord(data) ? parseMessage(data.message) : null);
  const helpOf = (data: unknown): { help?: true } => (isRecord(data) && data.help === true ? { help: true } : {}); // 위기 표시 한 칸(보내기 응답에만 · 없으면 0)

  return {
    home: () => read('get_home_state', {}, parseHomeState, 'if2.home.fail'),
    magazine: () => read('get_magazine', {}, parseMagazine, 'if2.mag.fail'),
    weekCard: () => read('get_week_card', {}, parseWeekCard, 'if2.card.fail'),
    async pickWeekCard(slot) {
      const { data, error } = await rpc('pick_week_card', { p_slot: slot });
      if (error) return failOf(error, 'if2.card.pick.fail');
      if (isRecord(data) && data.ok === true && int(data.slot) !== null && int(data.card) !== null) return { ok: true, slot: int(data.slot) as number, card: int(data.card) as number };
      const bad = inner(data) ?? { ok: false as const, code: 'server' };
      return isRecord(data) && int(data.slot) !== null && int(data.card) !== null ? { ...bad, slot: int(data.slot) as number, card: int(data.card) as number } : bad;
    },
    preQuestions: () =>
      read(
        'pre_answer_questions',
        {},
        (d) => {
          if (!isRecord(d)) return null;
          const s = oneOf(d.state, ['none', 'open', 'landing', 'not_ready'] as const);
          return s ? { state: s, questions: strs(d.questions).slice(0, 20) } : null;
        },
        'if2.pre.fail',
      ),
    preview: () => read('preview_my_profile', {}, (d) => (isRecord(d) && isRecord(d.profile) ? { profile: d.profile, ck17b: d.ck17b === true, sameHobby: d.same_hobby === true } : null), 'if2.preview.fail'),
    pairCard: (roomId) => read('get_pair_card', { p_room: roomId }, parsePairCard, 'if2.pair.fail'),
    openerChips: (roomId) =>
      read(
        'opener_chips',
        { p_room: roomId },
        (d) =>
          isRecord(d)
            ? {
                show: d.show === true,
                chips: (Array.isArray(d.chips) ? d.chips : []).flatMap((c) => (isRecord(c) && str(c.id) && /^(ct|ch)-\d{2}$/.test(c.id as string) ? [{ id: c.id as string, hobby: parseHobby(c.hobby) }] : [])).slice(0, 3),
              }
            : null,
        'if2.chips.fail',
      ),
    topics: (roomId) =>
      read(
        'talk_topics',
        { p_room: roomId },
        (d) => (isRecord(d) ? { depths: strs(d.depths).filter((x): x is TalkDepth => (TALK_DEPTHS as readonly string[]).includes(x)), questions: strs(d.questions).slice(0, 10), togetherUsed: d.together_used === true } : null),
        'if2.topics.fail',
      ),
    async sendCard(roomId, tag, body, ref) {
      const { data, error } = await rpc('send_chat_card', { p_room: roomId, p_tag: tag, p_body: body, p_ref: ref });
      if (error) return failOf(error, 'if2.card.send.fail');
      const bad = inner(data);
      if (bad) return bad;
      return { ok: true, message: messageOf(data), left: isRecord(data) && data.left === true };
    },
    async togetherSend(roomId, questionId, body, answer) {
      const { data, error } = await rpc('together_send', { p_room: roomId, p_question: questionId, p_body: body, p_answer: answer });
      if (error) return failOf(error, 'if2.together.send.fail');
      return inner(data) ?? { ok: true, message: messageOf(data), ...helpOf(data) };
    },
    async togetherAnswer(cardId, answer) {
      const { data, error } = await rpc('together_answer', { p_card: Number(cardId), p_answer: answer });
      if (error) return failOf(error, 'if2.together.answer.fail');
      return inner(data) ?? { ok: true, opened: isRecord(data) && data.opened === true, message: messageOf(data), ...helpOf(data) };
    },
    async togetherWithdraw(cardId) {
      const { data, error } = await rpc('together_withdraw', { p_card: Number(cardId) });
      if (error) return failOf(error, 'if2.together.withdraw.fail');
      return inner(data) ?? { ok: true, message: messageOf(data) };
    },
  };
}

// 서버 클라이언트(supabase · 데모 모의 클라이언트)의 rpc 를 그대로
export const rpcOf =
  (client: SupabaseClient): RpcCall =>
  async (fn, args) =>
    (await client.rpc(fn, args ?? {})) as RpcResult;
