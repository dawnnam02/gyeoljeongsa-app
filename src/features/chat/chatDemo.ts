// 데모 채팅(V5 W5): 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)에서 ChatApi 를 메모리로 흉내 낸다. 규칙은 서버 0031(backend/W4_변경기록.md)과 같게. 기기 · 브라우저 저장소 0 · 서버 요청 0.
//  · 상대 = 데모 인물 24명 가운데 '나'와 끼리끼리 순서 첫 분(탑승권 데모 demo/boardingDemo 와 같은 분 · 같은 방 id 'demo-chat-1-{n}'). 이름은 김OO 꼴(서버 mask_name 과 같음)
//  · 회차 1 = 2026-12-23(수) 18:00 KST 에 열림 → 12-30(수) 18:00 닫힘. 데모 '지금'은 장면마다 정해 둔 시각 + 화면을 연 뒤 흐른 시간
//  · 장면(이메일 앞부분 또는 목록 아래 데모 줄):
//     (기본) fresh 막 열린 방 · 글 0 — 3부-사 FB-016(팀장 판단): 짧은 길(공개 → [대화 시작하기])에서 만남 장면이 바로 나오게(K27 10-1). 끝 줄 '눈이 마주쳤어요'
//     chatopen open 열린 방(대화가 이어진 방) · 읽지 않은 글 1 — 내 글이 있어 장면 0(정책 P4-22 '내 글이 있으면 장면 0' 그대로)
//     chatlast lastDay 마지막 날   chatext extendWait 상대가 이미 연장을 원함(내가 고르면 7일 더)
//     chatleft partnerLeft 상대가 나감(읽기만)   chatclosed closed 7일이 지나 닫힌 방(읽기만 · 30일 뒤 지움)   chat0 empty 방 없음
//     chatnew fresh(기본과 같음)   chatfirst partnerFirst 상대가 먼저 글 1 · 내 글 0(끝 줄 '먼저 말을 걸어왔어요')
//  · 3부-사 FB-014: 장소는 방이 열린 주로 차례 돈다(D-206) — 데모 장면마다 열린 주를 달리해(아래 WEEK_OF) 데모 줄로 장면을 바꾸면 장소 · 기억 한 줄이 바뀐다.
//    기본(fresh)은 탑승권 데모 1회차(12-23)와 같은 날 · 같은 방 id 라 공개 → [대화 시작하기] 길이 이어진다
//  · 거르기 흉내(0016 text_guard): 금전 요구 · 욕설만 text_blocked. 연락처는 자유(T-20). 링크(http · www)는 보내되 caution(받는 쪽 주의 표시)
//    글에 '데모실패'가 있으면 처음 한 번 인터넷 실패(다시 보내기 확인용)
//  · 내가 처음 글을 보내면 1.5초 뒤 상대가 한 번 답한다(실시간 흉내). 사진 = 데모 사진 파일 · 음성 = 길이만(소리 없음)
//  · 나가기: 나간 사람은 방이 사라지고(목록에서 빠짐), 상대는 30일 읽기만(0031 · 팀장 결정)
//  · 여기 사람은 가상이다(실제 사람 아님). 글은 해요체 · 느낌표 0
import { createInflightChatDemo } from '@/demo/inflightChatDemo';
import { demoShared } from '@/demo/inflightShared';
import { demoPerson, kinOrder, mePhotoKey, myReligionOf, poolFor, type DemoPerson } from '@/demo/people';
import { demoPhotoUri } from '@/demo/peoplePhotos';

import type { ChatApi, Message, Outgoing, Room, SystemEvent } from './chatApi';
import { DAY, PURGE_DAYS, ROOM_DAYS, TEXT_MAX, VOICE_MAX_BYTES } from './chatLogic';

export type DemoChatScene = 'open' | 'lastDay' | 'extendWait' | 'partnerLeft' | 'closed' | 'empty' | 'fresh' | 'partnerFirst';
// 데모 줄 차례: 기본(막 열린 방) → 상대가 먼저 → 열린 방 → 마지막 날 → 연장 → 나감 → 닫힘 → 방 없음 → 처음으로
export const DEMO_CHAT_SCENES: readonly DemoChatScene[] = ['fresh', 'partnerFirst', 'open', 'lastDay', 'extendWait', 'partnerLeft', 'closed', 'empty'];
// 장면마다 방이 열린 주(1회차 12-23 에서 몇 주 뒤) — 장소 = 열린 날짜의 주 번호 차례(features/chat/meetLogic). 날짜가 글로 나오는 장면(열린 방 · 마지막 날 · 연장)은 0
const WEEK_OF: Readonly<Record<DemoChatScene, number>> = { fresh: 0, partnerFirst: 1, open: 0, lastDay: 0, extendWait: 0, partnerLeft: 2, closed: 3, empty: 0 };
const shiftOf = (scene: DemoChatScene) => WEEK_OF[scene] * 7 * DAY;

const at = (iso: string) => Date.parse(iso);
const MATCH_AT = at('2026-12-23T18:00:00+09:00');
const CLOSES_AT = MATCH_AT + ROOM_DAYS * DAY;
const SCENE_NOW: Record<DemoChatScene, number> = {
  open: at('2026-12-25T20:00:00+09:00'),
  lastDay: at('2026-12-30T10:00:00+09:00'),
  extendWait: at('2026-12-29T21:00:00+09:00'),
  partnerLeft: at('2026-12-26T12:00:00+09:00'),
  closed: at('2026-12-31T12:00:00+09:00'),
  empty: at('2026-12-25T20:00:00+09:00'),
  fresh: at('2026-12-23T18:05:00+09:00'), // 공개 5분 뒤 · 아무도 쓰지 않음
  partnerFirst: at('2026-12-23T20:00:00+09:00'), // 상대가 18:24 에 먼저 씀 · 나는 아직
};
const BLOCKED_WORDS = ['송금', '계좌로', '입금해', '코인투자', '시발', '씨발', '병신'];
const LINK = /https?:\/\/|www\./i;
const REPLY = '네, 좋아요. 천천히 이야기 나눠요.';
// IF2-F 안전 안내 카드(F-39) 데모: 내 글에 '데모안전'이 있으면 짝이 거르기에 안 걸리는 돈 · 투자 꼴 글로 답한다(받은 말풍선 아래 나에게만 카드)
const MONEY_REPLY = '요즘 코인 이야기 많이 하던데 혹시 관심 있으세요?';

export const sceneOfEmail = (email: string): DemoChatScene => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  if (l.includes('chatlast')) return 'lastDay';
  if (l.includes('chatext')) return 'extendWait';
  if (l.includes('chatleft')) return 'partnerLeft';
  if (l.includes('chatclosed')) return 'closed';
  if (l.includes('chat0')) return 'empty';
  if (l.includes('chatnew')) return 'fresh';
  if (l.includes('chatfirst')) return 'partnerFirst';
  if (l.includes('chatopen')) return 'open';
  return 'fresh';
};

type Who = () => Promise<{ id: string; email: string } | null>;
type RoomState = { room: Room; messages: Message[]; theirExtend: boolean; gone: boolean; replied: boolean; failOnce: boolean };
type State = { scene: DemoChatScene; rooms: RoomState[]; reports: { room: string; reason: string }[]; startedAt: number };

let seq = 0;
const nextId = () => String((seq += 1));
const msg = (mine: boolean, kind: Message['kind'], body: string, when: number, extra: Partial<Message> = {}): Message => ({
  id: nextId(),
  clientId: null,
  mine,
  kind,
  body,
  mediaId: null,
  durationMs: null,
  caution: false,
  createdAt: when,
  purged: false,
  ...extra,
});
const sys = (event: SystemEvent, mine: boolean, when: number) => msg(mine, 'system', event, when);

function seedRoom(p: DemoPerson, email: string, scene: DemoChatScene): RoomState {
  const shift = shiftOf(scene);
  const t = (iso8601: string) => at(iso8601) + shift;
  const openedAt = MATCH_AT + shift;
  const closesAt = CLOSES_AT + shift;
  const messages: Message[] = [
    sys('opened', false, openedAt),
    msg(false, 'text', '안녕하세요. 같은 날 이어지게 되어 반가워요. 저는 주말에 동네를 오래 걷는 편이에요.', t('2026-12-23T18:24:00+09:00')),
    msg(true, 'text', '안녕하세요. 저도 반가워요. 퇴근하고 천천히 걷는 걸 좋아해요.', t('2026-12-23T19:02:00+09:00')),
    msg(false, 'photo', '', t('2026-12-24T12:30:00+09:00'), { mediaId: `demo-key:${p.key}_free` }),
    msg(false, 'text', '점심에 걷다가 찍었어요. 말씀하신 산책길도 궁금해요.', t('2026-12-24T12:31:00+09:00')),
    msg(true, 'voice', '', t('2026-12-24T21:15:00+09:00'), { mediaId: 'demo-voice:7', durationMs: 7_000 }),
    msg(false, 'text', '주말에 시간이 괜찮으시면 차 한잔 어떠세요. 편하실 때 알려 주세요.', t('2026-12-25T19:40:00+09:00')),
  ];
  const mePhoto = mePhotoKey('free', email);
  if (mePhoto) messages.splice(3, 0, msg(true, 'photo', '', t('2026-12-23T19:03:00+09:00'), { mediaId: `demo-key:${mePhoto}` }));
  if (scene === 'fresh') messages.splice(1); // 막 열린 방: 열림 시스템 글만
  if (scene === 'partnerFirst') messages.splice(2); // 상대 첫 글 하나만
  const closed = scene === 'closed' || scene === 'partnerLeft';
  const closedAt = scene === 'partnerLeft' ? t('2026-12-26T11:00:00+09:00') : closesAt;
  if (scene === 'closed') messages.push(sys('closed_expired', false, closesAt));
  if (scene === 'partnerLeft') messages.push(sys('partner_left', false, closedAt));
  // 상대가 연장을 원한 시스템 글(extend_requested, mine=false)은 서버가 보내지만 화면은 그리지 않는다(판단 — 변경기록 6장)
  if (scene === 'extendWait') messages.push(sys('extend_requested', false, t('2026-12-29T20:00:00+09:00')));
  const room: Room = {
    id: `demo-chat-1-${p.n}`,
    partner: { id: `demo-cand-${p.n}`, name: p.name, age: p.age, region: `${p.region.sido} ${p.region.sigungu}`, facePhotoId: `demo-ph-${p.n}-face` },
    roundNo: 1 + WEEK_OF[scene],
    openedAt,
    closesAt: closed ? closedAt : closesAt,
    closedAt: closed ? closedAt : null,
    closedReason: scene === 'closed' ? 'expired' : scene === 'partnerLeft' ? 'partner_left' : null,
    purgeAt: null,
    myExtend: false,
    last: null,
    unread: scene === 'open' || scene === 'partnerFirst' ? 1 : 0,
  };
  return { room, messages, theirExtend: scene === 'extendWait', gone: false, replied: false, failOnce: true };
}

const lastOf = (s: RoomState): Room['last'] => {
  const m = s.messages[s.messages.length - 1];
  return m ? { kind: m.kind, body: m.kind === 'text' || m.kind === 'system' ? m.body : '', at: m.createdAt, mine: m.mine } : null;
};

export type DemoControls = { scene(): Promise<DemoChatScene>; next(): Promise<DemoChatScene>; peek(): Promise<unknown> };
// IF2-F: 0043 대화방 칸 함수(opener_chips · talk_topics · send_chat_card · together_*)를 같은 모양으로 답하는 데모 창구
export type DemoIf2Rpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code: string; message: string } | null }>;
export const hasDemoControls = (api: ChatApi): api is ChatApi & { demo: DemoControls } => 'demo' in api;

// note(3부-아 QP-10): 신고 · 차단을 데모 로그인 모의 서버(12 신고 내역 · 차단 목록)에도 알린다 — 실서버는 같은 표라 따로 할 일 0
export type DemoSafetyNote = (partnerId: string, reason?: string) => Promise<void>;
export function createDemoChatApi(options: { who: Who; photoUri?: (key: string) => string | null; replyMs?: number; clock?: () => number; note?: DemoSafetyNote }): ChatApi & { demo: DemoControls; if2Rpc: DemoIf2Rpc } {
  const photoUri = options.photoUri ?? demoPhotoUri;
  const clock = options.clock ?? Date.now;
  const replyMs = options.replyMs ?? 1_500;
  const states = new Map<string, State>();
  const listeners = new Map<string, Set<() => void>>();
  const sceneOverride = new Map<string, DemoChatScene>();

  const seed = (key: string, email: string, scene: DemoChatScene): State => {
    const p = kinOrder(poolFor(email), 4, myReligionOf(email))[0] ?? demoPerson(4);
    const rooms = scene === 'empty' || !p ? [] : [seedRoom(p, email, scene)];
    const s: State = { scene, rooms, reports: [], startedAt: clock() };
    states.set(key, s);
    return s;
  };
  const me = async () => (await options.who()) ?? { id: 'demo-guest', email: '' };
  const stateOf = async (): Promise<State> => {
    const u = await me();
    return states.get(u.id) ?? seed(u.id, u.email, sceneOverride.get(u.id) ?? sceneOfEmail(u.email));
  };
  const nowOf = (s: State) => SCENE_NOW[s.scene] + shiftOf(s.scene) + (clock() - s.startedAt);
  const notify = (id: string) => listeners.get(id)?.forEach((f) => f());
  const view = (r: RoomState): Room => ({ ...r.room, last: lastOf(r), purgeAt: r.room.closedAt !== null ? r.room.closedAt + PURGE_DAYS * DAY : null });
  const roomOf = (s: State, id: string) => s.rooms.find((r) => r.room.id === id && !r.gone) ?? null;
  // 닫는 시각이 지났으면 닫는다(서버 chat_sweep 흉내) + 닫힌 뒤 30일이 지나면 방이 사라진다
  const settle = (s: State) => {
    const now = nowOf(s);
    for (const r of s.rooms) {
      if (r.room.closedAt === null && now >= r.room.closesAt) {
        r.room.closedAt = r.room.closesAt;
        r.room.closedReason = 'expired';
        r.messages.push(sys('closed_expired', false, r.room.closesAt));
      }
      if (r.room.closedAt !== null && now >= r.room.closedAt + PURGE_DAYS * DAY) r.gone = true;
    }
  };
  const unavailable = { ok: false as const, reason: 'unavailable' as const };
  const push = (r: RoomState, m: Message) => {
    r.messages.push(m);
    notify(r.room.id);
  };
  // IF2-F 대화방 칸(데모): 방 · 글은 이 데모 채팅의 것을 쓴다
  const anyRoom = (id: string): { s: State; r: RoomState } | null => {
    for (const s of states.values()) {
      const r = roomOf(s, id);
      if (r) return { s, r };
    }
    return null;
  };
  const if2 = createInflightChatDemo({
    userId: async () => (await me()).id,
    room: (id) => {
      const x = anyRoom(id);
      if (!x) return null;
      settle(x.s);
      return { open: x.r.room.closedAt === null, openedAt: x.r.room.openedAt, messages: x.r.messages };
    },
    now: () => {
      const s = states.values().next().value as State | undefined;
      return s ? nowOf(s) : SCENE_NOW.fresh;
    },
    add: (id, m) => {
      const x = anyRoom(id);
      if (!x) return;
      if (!m.mine) x.r.room.unread += 1;
      push(x.r, { ...m, createdAt: nowOf(x.s) });
    },
    notify: (id) => notify(id),
    leave: (id) => {
      const x = anyRoom(id);
      if (!x) return;
      x.r.gone = true;
      void me().then((u) => demoShared.markRoom(u.id, id, 'gone'));
    },
    blocked: (text) => BLOCKED_WORDS.some((w) => text.replace(/\s+/g, '').includes(w)),
    newId: nextId,
    replyMs,
  });

  return {
    async listRooms() {
      const s = await stateOf();
      settle(s);
      return { ok: true, data: s.rooms.filter((r) => !r.gone).map(view) };
    },
    async getRoom(id) {
      const s = await stateOf();
      settle(s);
      const r = roomOf(s, id);
      return r ? { ok: true, data: view(r) } : unavailable;
    },
    async listMessages(id) {
      const s = await stateOf();
      const r = roomOf(s, id);
      return r ? { ok: true, data: r.messages.map((m) => if2.decorate({ ...m }, r.room.closedAt === null)) } : unavailable;
    },
    async send(id, out: Outgoing) {
      const s = await stateOf();
      settle(s);
      const r = roomOf(s, id);
      if (!r) return unavailable;
      if (r.room.closedAt !== null) return { ok: false, reason: 'closed' };
      if (out.kind === 'text') {
        if (Array.from(out.body).length > TEXT_MAX) return { ok: false, reason: 'long' };
        const flat = out.body.replace(/\s+/g, '');
        if (BLOCKED_WORDS.some((w) => flat.includes(w))) return { ok: false, reason: 'blocked' };
        if (out.body.includes('데모실패') && r.failOnce) {
          r.failOnce = false;
          return { ok: false, reason: 'network' };
        }
      }
      if (out.kind === 'voice' && out.bytes.length > VOICE_MAX_BYTES) return { ok: false, reason: 'size' };
      const m = msg(true, out.kind, out.kind === 'text' ? out.body : '', nowOf(s), {
        clientId: out.clientId,
        mediaId: out.kind === 'photo' ? `demo-key:${out.demoKey ?? ''}` : out.kind === 'voice' ? `demo-voice:${Math.round(out.durationMs / 1000)}` : null,
        durationMs: out.kind === 'voice' ? out.durationMs : null,
        caution: out.kind === 'text' && LINK.test(out.body),
      });
      r.messages.push(m);
      if (!r.replied) {
        r.replied = true;
        setTimeout(() => {
          if (r.gone || r.room.closedAt !== null) return;
          r.room.unread += 1;
          push(r, msg(false, 'text', out.kind === 'text' && out.body.includes('데모안전') ? MONEY_REPLY : REPLY, nowOf(s)));
        }, replyMs);
      }
      return { ok: true, data: { ...m } };
    },
    async markRead(id) {
      const s = await stateOf();
      const r = roomOf(s, id);
      if (r) r.room.unread = 0;
    },
    async setExtend(id, want) {
      const s = await stateOf();
      settle(s);
      const r = roomOf(s, id);
      if (!r || r.room.closedAt !== null) return unavailable;
      if (want === r.room.myExtend) return { ok: true, data: { closesAt: r.room.closesAt, extended: false } };
      r.room.myExtend = want;
      if (want && r.theirExtend) {
        r.room.closesAt += ROOM_DAYS * DAY;
        r.room.myExtend = false;
        r.theirExtend = false;
        push(r, sys('extended', true, nowOf(s)));
        return { ok: true, data: { closesAt: r.room.closesAt, extended: true } };
      }
      push(r, sys(want ? 'extend_requested' : 'extend_cancelled', true, nowOf(s)));
      return { ok: true, data: { closesAt: r.room.closesAt, extended: false } };
    },
    async leave(id) {
      const s = await stateOf();
      const r = roomOf(s, id);
      if (!r) return unavailable;
      r.gone = true; // 나간 사람은 방이 사라진다(상대는 partner_left 로 30일 읽기만)
      demoShared.markRoom((await me()).id, id, 'gone'); // IF2-F: 홈 '이번 짝' · 궁합 카드도 바로 0(데모 서버가 같은 판정)
      return { ok: true, data: null };
    },
    async report(roomId, reasonCode) {
      const s = await stateOf();
      if (!roomOf(s, roomId)) return { ok: false, reason: 'unavailable' };
      if (s.reports.some((x) => x.room === roomId)) return { ok: false, reason: 'already' };
      s.reports.push({ room: roomId, reason: reasonCode });
      const pid = roomOf(s, roomId)?.room.partner.id;
      if (pid) await options.note?.(pid, reasonCode).catch(() => undefined);
      return { ok: true };
    },
    async block(roomId) {
      const s = await stateOf();
      const r = roomOf(s, roomId);
      if (!r) return { ok: false, reason: 'unavailable' };
      r.gone = true; // 차단 뒤 서로 안 보임(방도 목록에서 빠짐)
      demoShared.markRoom((await me()).id, roomId, 'gone'); // IF2-F: 홈 블록 · 궁합 카드 바로 0
      await options.note?.(r.room.partner.id).catch(() => undefined);
      return { ok: true };
    },
    async mediaUrl(mediaId) {
      if (mediaId.startsWith('demo-key:')) return photoUri(mediaId.slice('demo-key:'.length));
      return null;
    },
    async faceUrl(photoId) {
      const m = /^demo-ph-(\d+)-(face|full|free)$/.exec(photoId);
      const p = m ? demoPerson(Number(m[1])) : null;
      return p && m ? photoUri(`${p.key}_${m[2]}`) : null;
    },
    subscribe(id, onChange) {
      const set = listeners.get(id) ?? new Set();
      set.add(onChange);
      listeners.set(id, set);
      return () => {
        set.delete(onChange);
      };
    },
    now() {
      const s = states.values().next().value as State | undefined;
      return s ? nowOf(s) : SCENE_NOW.fresh;
    },
    // IF2-F 데모 창구(ChatApi 밖): 0043 대화방 칸 함수
    if2Rpc: async (name, args = {}) => {
      await stateOf(); // 이 회원의 데모 방이 먼저 있게(목록을 읽기 전에 불러도)
      return if2.handles(name) ? if2.rpc(name, args) : { data: null, error: { code: '42883', message: `function ${name} does not exist` } };
    },
    // 데모 전용(ChatApi 밖): 장면 읽기 · 바꾸기
    demo: {
      async scene() {
        return (await stateOf()).scene;
      },
      async next() {
        const u = await me();
        const cur = (await stateOf()).scene;
        const nx = DEMO_CHAT_SCENES[(DEMO_CHAT_SCENES.indexOf(cur) + 1) % DEMO_CHAT_SCENES.length];
        sceneOverride.set(u.id, nx);
        states.delete(u.id);
        await stateOf();
        return nx;
      },
      async peek() {
        const s = await stateOf();
        return { scene: s.scene, rooms: s.rooms.map((r) => ({ id: r.room.id, gone: r.gone, closedReason: r.room.closedReason, closesAt: r.room.closesAt, myExtend: r.room.myExtend, count: r.messages.length })), reports: s.reports.length };
      },
    },
  };
}
