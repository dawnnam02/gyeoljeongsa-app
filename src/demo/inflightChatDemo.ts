// 데모 채팅의 기내 서비스 대화방 칸(IF2-F · D-223) — 서버 0043 과 같은 이름 · 인자 · 응답 모양:
//  opener_chips(p_room) · talk_topics(p_room) · send_chat_card(p_room, p_tag, p_body, p_ref) · together_send(p_room, p_question, p_body, p_answer) ·
//  together_answer(p_card, p_answer) · together_withdraw(p_card)
//  · 글은 채팅 글 한 종류 + 꼬리표(tag · ref) — 같은 거르기(데모 BLOCKED_WORDS = 0016 흉내) · 같은 방 · 같은 실시간 흉내
//  · 같이 열어 보는 질문: 내 쪽 상태만(mine_needed · waiting · opened · withdrawn · closed) — 상대가 답했는지 0(PF-55)
//    데모 짝은 내 질문에 1.5초 뒤 답한다(함께 열림) · 내가 이야깃거리를 처음 놓으면 짝이 질문 카드 한 장을 보낸다(받은 쪽 [답 적기] 장면)
//  · 칩 · 그날 질문은 demo/funCalc(0043 · fun_calc 와 같은 해시 · 데모 키). 스위치가 꺼지면 feature_off
//  · 여기 사람은 가상이다. 서버 요청 0 · 기기 저장 0
import lib from '@/content/if2Library.json';
import type { ChatTag, Message, TogetherState } from '@/features/chat/chatApi';

import { pickDistinct } from './funCalc';
import { DEMO_FUN_KEY, demoOpenerChips, demoShared } from './inflightShared';

type Row = Record<string, unknown>;
type DbResult = { data: unknown; error: { code: string; message: string } | null };
export type DemoCard = { roomId: string; question: string; sender: 'me' | 'partner'; mine: string | null; theirs: string | null; opened: boolean; withdrawn: boolean; day: string };
export type InflightChatContext = {
  userId: () => Promise<string>;
  room: (roomId: string) => { open: boolean; openedAt: number; messages: Message[] } | null;
  now: () => number;
  add: (roomId: string, m: Message) => void; // 새 글 넣기 + 실시간 흉내 알림
  notify: (roomId: string) => void; // 글은 그대로 · 실시간 흉내 알림만(카드 상태가 바뀜)
  leave: (roomId: string) => void;
  blocked: (text: string) => boolean;
  help: (text: string) => boolean; // 위기 도움 카드 한 칸(서버가 보내기 응답에 싣는 참/거짓 — 하루 3번 상한 포함, 정책 P4-34)
  newId: () => string;
  replyMs: number;
};

const KST = 9 * 3_600_000;
const kstDay = (t: number) => new Date(t + KST).toISOString().slice(0, 10);
const off = (): DbResult => ({ data: null, error: { code: '42501', message: 'feature_off' } });
const ok = (data: unknown): DbResult => ({ data, error: null });
const no = (code: string, extra: Row = {}): DbResult => ok({ ok: false, code, ...extra });
const DEPTHS = ['light', 'taste', 'life', 'values'];
const FLAG_OF_TAG: Readonly<Record<string, string>> = { postcard: 'postcard', topic: 'talk_depth', about_me: 'my_manual', farewell: 'farewell' };
const PARTNER_ANSWER = '천천히 생각해 봤는데, 저는 편하게 이야기할 수 있는 시간이 가장 좋아요.';

// 앱 Message → 0043 응답의 글 모양(parseMessage 가 읽는 키)
export function rawOf(m: Message): Row {
  return {
    id: Number(m.id),
    mine: m.mine,
    kind: m.kind,
    body: m.body,
    attachment_id: null,
    duration_ms: m.durationMs,
    caution: m.caution,
    created_at: new Date(m.createdAt).toISOString(),
    ...(m.tag ? { tag: m.tag, ref: m.ref ?? null } : {}),
    ...(m.tag === 'together_q' && m.together ? { together: rawTogether(m.together) } : {}),
  };
}
const rawTogether = (t: TogetherState): Row =>
  t.state === 'waiting' ? { state: 'waiting', my_answer: t.myAnswer, can_withdraw: t.canWithdraw } : t.state === 'closed' ? { state: 'closed', my_answer: t.myAnswer } : { state: t.state };

export function createInflightChatDemo(ctx: InflightChatContext) {
  const cards = new Map<string, DemoCard>(); // 질문 카드 글 id → 카드
  let partnerAsked = false;

  const stateOf = (cardId: string, roomOpen: boolean): TogetherState | null => {
    const c = cards.get(cardId);
    if (!c) return null;
    if (c.withdrawn) return { state: 'withdrawn' };
    if (c.opened) return { state: 'opened' };
    if (!roomOpen) return { state: 'closed', myAnswer: c.mine };
    if (c.mine !== null) return { state: 'waiting', myAnswer: c.mine, canWithdraw: c.sender === 'me' };
    return { state: 'mine_needed' };
  };
  // 질문 카드 글에 지금 내 쪽 상태를 붙인다(목록 · 응답 모두)
  const decorate = (m: Message, roomOpen: boolean): Message =>
    m.tag === 'together_q' ? { ...m, body: cards.get(m.id)?.withdrawn ? '' : m.body, together: stateOf(m.id, roomOpen) } : m;

  const msg = (mine: boolean, body: string, tag: ChatTag, ref: string | null): Message => ({
    id: ctx.newId(),
    clientId: null,
    mine,
    kind: 'text',
    body,
    mediaId: null,
    durationMs: null,
    caution: false,
    createdAt: ctx.now(),
    purged: false,
    tag,
    ref,
  });

  const today = (roomId: string): { depths: string[]; questions: string[] } => {
    const r = ctx.room(roomId);
    if (!r) return { depths: [], questions: [] };
    const day = Math.floor((Date.parse(kstDay(ctx.now())) - Date.parse(kstDay(r.openedAt))) / 86_400_000) + 1;
    const n = day >= 5 ? 4 : day >= 3 ? 3 : 1;
    const pool = lib.questions.filter((q) => q.depth <= n).map((q) => q.id).sort();
    const picks = pickDistinct(DEMO_FUN_KEY, `topics:v1:${roomId}:${kstDay(ctx.now())}`, pool.length, Math.min(10, pool.length));
    return { depths: DEPTHS.slice(0, n), questions: picks.map((i) => pool[i]) };
  };
  const usedToday = (roomId: string) => [...cards.values()].some((c) => c.roomId === roomId && c.day === kstDay(ctx.now()));

  const open = (cardId: string, roomId: string) => {
    const c = cards.get(cardId);
    if (!c || c.opened || c.withdrawn || c.mine === null || c.theirs === null) return;
    c.opened = true;
    // 먼저 답한 분 차례로 답 두 글(together_a · ref = 카드 글 번호)
    const first = c.sender === 'me' ? [true, false] : [false, true];
    for (const mine of first) ctx.add(roomId, msg(mine, (mine ? c.mine : c.theirs) ?? '', 'together_a', cardId));
  };

  async function guard(name: string, roomId: string): Promise<DbResult | { room: NonNullable<ReturnType<InflightChatContext['room']>> }> {
    const flags = await demoShared.flags(await ctx.userId());
    if (flags[name] !== true) return off();
    const r = ctx.room(roomId);
    if (!r) return no('not_found');
    if (!r.open) return no('room_closed');
    return { room: r };
  }
  const isFail = (x: unknown): x is DbResult => typeof x === 'object' && x !== null && 'error' in x;

  const handlers: Record<string, (args: Row) => Promise<DbResult>> = {
    async opener_chips(args) {
      const roomId = String(args.p_room ?? '');
      const flags = await demoShared.flags(await ctx.userId());
      if (flags.opener_chips !== true) return off();
      const r = ctx.room(roomId);
      if (!r) return no('not_found');
      const wrote = r.messages.some((m) => m.mine && m.kind !== 'system');
      if (!r.open || wrote) return ok({ ok: true, show: false, chips: [] });
      return ok({ ok: true, show: true, chips: await demoOpenerChips(await ctx.userId(), roomId) });
    },
    async talk_topics(args) {
      const roomId = String(args.p_room ?? '');
      const g = await guard('talk_depth', roomId);
      if (isFail(g)) return g;
      const t = today(roomId);
      return ok({ ok: true, depths: t.depths, questions: t.questions, together_used: usedToday(roomId) });
    },
    async send_chat_card(args) {
      const roomId = String(args.p_room ?? '');
      const tag = String(args.p_tag ?? '');
      if (!(tag in FLAG_OF_TAG)) return no('invalid_tag');
      const g = await guard(FLAG_OF_TAG[tag], roomId);
      if (isFail(g)) return g;
      const body = String(args.p_body ?? '').trim();
      const ref = String(args.p_ref ?? '');
      if (tag === 'postcard') {
        if (!/^p[0-5]$/.test(ref)) return no('invalid_ref');
        if (Array.from(body).length > 120) return no('too_long');
        if (g.room.messages.some((m) => m.mine && m.kind !== 'system')) return no('not_first');
      } else if (tag === 'topic') {
        if (!today(roomId).questions.includes(ref)) return no('not_today');
        if (Array.from(body).length > 300) return no('too_long');
      } else if (tag === 'about_me') {
        const items = ref.split(',');
        const cats = items.map((i) => i.replace(/[0-9]$/, ''));
        if (!/^(reply|upset|pace|heart)[0-4](,(reply|upset|pace|heart)[0-4]){0,2}$/.test(ref) || new Set(cats).size !== cats.length || items.some((i) => /^(reply|upset|pace)4$/.test(i))) return no('invalid_ref');
        if (g.room.messages.some((m) => m.mine && m.tag === 'about_me')) return no('already_sent');
      } else {
        if (!/^f[0-4]$/.test(ref)) return no('invalid_ref');
        if (Array.from(body).length > 100 || /[\r\n]/.test(body)) return no('too_long');
      }
      if (ctx.blocked(body)) return no('text_blocked', { codes: ['money'] });
      const m = msg(true, body, tag as ChatTag, ref);
      ctx.add(roomId, m);
      if (tag === 'farewell') {
        ctx.leave(roomId);
        return ok({ ok: true, message: rawOf(m), left: true });
      }
      // 데모: 내가 이야깃거리를 처음 놓으면 짝이 같이 열어 보는 질문 한 장을 보낸다(받은 쪽 장면)
      if (tag === 'topic' && !partnerAsked && !usedToday(roomId)) {
        partnerAsked = true;
        const q = today(roomId).questions.find((x) => x !== ref) ?? ref;
        setTimeout(() => {
          const r = ctx.room(roomId);
          if (!r?.open || usedToday(roomId)) return;
          const card = msg(false, '', 'together_q', q);
          cards.set(card.id, { roomId, question: q, sender: 'partner', mine: null, theirs: PARTNER_ANSWER, opened: false, withdrawn: false, day: kstDay(ctx.now()) });
          ctx.add(roomId, card);
        }, ctx.replyMs);
      }
      return ok({ ok: true, message: rawOf(m) });
    },
    async together_send(args) {
      const roomId = String(args.p_room ?? '');
      const g = await guard('together_q', roomId);
      if (isFail(g)) return g;
      const q = String(args.p_question ?? '');
      const answer = String(args.p_answer ?? '').trim();
      if (!today(roomId).questions.includes(q)) return no('not_today');
      if (usedToday(roomId)) return no('daily_used');
      if (Array.from(answer).length < 1 || Array.from(answer).length > 200) return no('too_long');
      if (ctx.blocked(answer)) return no('text_blocked', { codes: ['money'] });
      const card = msg(true, String(args.p_body ?? ''), 'together_q', q);
      cards.set(card.id, { roomId, question: q, sender: 'me', mine: answer, theirs: null, opened: false, withdrawn: false, day: kstDay(ctx.now()) });
      ctx.add(roomId, card);
      // 데모 짝이 1.5초 뒤 답한다 → 함께 열림
      setTimeout(() => {
        const c = cards.get(card.id);
        if (!c || c.withdrawn || !ctx.room(roomId)?.open) return;
        c.theirs = PARTNER_ANSWER;
        open(card.id, roomId);
        ctx.notify(roomId);
      }, ctx.replyMs);
      return ok({ ok: true, message: rawOf(decorate(card, true)), ...(ctx.help(answer) ? { help: true } : {}) });
    },
    async together_answer(args) {
      const cardId = String(args.p_card ?? '');
      const c = cards.get(cardId);
      if (!c) return no('not_found');
      const g = await guard('together_q', c.roomId);
      if (isFail(g)) return g;
      if (c.withdrawn) return no('withdrawn');
      if (c.opened) return no('opened');
      const answer = String(args.p_answer ?? '').trim();
      if (Array.from(answer).length < 1 || Array.from(answer).length > 200) return no('too_long');
      if (ctx.blocked(answer)) return no('text_blocked', { codes: ['money'] });
      c.mine = answer;
      const before = c.opened;
      open(cardId, c.roomId);
      const m = g.room.messages.find((x) => x.id === cardId);
      return ok({ ok: true, opened: !before && c.opened, message: m ? rawOf(decorate(m, true)) : null, ...(ctx.help(answer) ? { help: true } : {}) });
    },
    async together_withdraw(args) {
      const cardId = String(args.p_card ?? '');
      const c = cards.get(cardId);
      if (!c) return no('not_found');
      const g = await guard('together_q', c.roomId);
      if (isFail(g)) return g;
      if (c.sender !== 'me') return no('not_sender');
      if (c.opened) return no('opened');
      c.withdrawn = true;
      c.mine = null;
      const m = g.room.messages.find((x) => x.id === cardId);
      return ok({ ok: true, message: m ? rawOf(decorate(m, true)) : null });
    },
  };

  return {
    handles: (name: string) => name in handlers,
    rpc: (name: string, args: Row = {}): Promise<DbResult> => handlers[name](args),
    decorate,
    cardOf: (id: string) => cards.get(id) ?? null,
  };
}
