// 데모 채팅(V5 W5): 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)에서 ChatApi 를 메모리로 흉내 낸다. 규칙은 서버 0031(backend/W4_변경기록.md)과 같게. 기기 · 브라우저 저장소 0 · 서버 요청 0.
//  · 상대 = 데모 인물 24명 가운데 '나'와 끼리끼리 순서 첫 분(탑승권 데모 demo/boardingDemo 와 같은 분 · 같은 방 id 'demo-chat-1-{n}'). 이름은 김OO 꼴(서버 mask_name 과 같음)
//  · 회차 1 = 2026-12-23(수) 18:00 KST 에 열림 → 12-30(수) 18:00 닫힘. 데모 '지금'은 장면마다 정해 둔 시각 + 화면을 연 뒤 흐른 시간
//  · 장면(이메일 앞부분 또는 목록 아래 데모 줄):
//     (기본) open 열린 방 · 읽지 않은 글 1   chatlast lastDay 마지막 날   chatext extendWait 상대가 이미 연장을 원함(내가 고르면 7일 더)
//     chatleft partnerLeft 상대가 나감(읽기만)   chatclosed closed 7일이 지나 닫힌 방(읽기만 · 30일 뒤 지움)   chat0 empty 방 없음
//     D46 만남 장면(K27 10-1): chatnew fresh 막 열린 방 · 글 0(장면 끝 줄 '눈이 마주쳤어요')   chatfirst partnerFirst 상대가 먼저 글 1 · 내 글 0(끝 줄 '먼저 말을 걸어왔어요')
//     (기본 open 은 내 글이 있어 장면이 없다 — 정책 P4-22 '내 글이 있으면 장면 0')
//  · 거르기 흉내(0016 text_guard): 금전 요구 · 욕설만 text_blocked. 연락처는 자유(T-20). 링크(http · www)는 보내되 caution(받는 쪽 주의 표시)
//    글에 '데모실패'가 있으면 처음 한 번 인터넷 실패(다시 보내기 확인용)
//  · 내가 처음 글을 보내면 1.5초 뒤 상대가 한 번 답한다(실시간 흉내). 사진 = 데모 사진 파일 · 음성 = 길이만(소리 없음)
//  · 나가기: 나간 사람은 방이 사라지고(목록에서 빠짐), 상대는 30일 읽기만(0031 · 팀장 결정)
//  · 여기 사람은 가상이다(실제 사람 아님). 글은 해요체 · 느낌표 0
import { demoPerson, kinOrder, mePhotoKey, myReligionOf, poolFor, type DemoPerson } from '@/demo/people';
import { demoPhotoUri } from '@/demo/peoplePhotos';

import type { ChatApi, Message, Outgoing, Room, SystemEvent } from './chatApi';
import { DAY, PURGE_DAYS, ROOM_DAYS, TEXT_MAX, VOICE_MAX_BYTES } from './chatLogic';

export type DemoChatScene = 'open' | 'lastDay' | 'extendWait' | 'partnerLeft' | 'closed' | 'empty' | 'fresh' | 'partnerFirst';
export const DEMO_CHAT_SCENES: readonly DemoChatScene[] = ['open', 'lastDay', 'extendWait', 'partnerLeft', 'closed', 'empty', 'fresh', 'partnerFirst'];

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

export const sceneOfEmail = (email: string): DemoChatScene => {
  const l = (email.split('@')[0] ?? '').toLowerCase();
  if (l.includes('chatlast')) return 'lastDay';
  if (l.includes('chatext')) return 'extendWait';
  if (l.includes('chatleft')) return 'partnerLeft';
  if (l.includes('chatclosed')) return 'closed';
  if (l.includes('chat0')) return 'empty';
  if (l.includes('chatnew')) return 'fresh';
  if (l.includes('chatfirst')) return 'partnerFirst';
  return 'open';
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
  const t = (iso8601: string) => at(iso8601);
  const messages: Message[] = [
    sys('opened', false, MATCH_AT),
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
  const closedAt = scene === 'partnerLeft' ? t('2026-12-26T11:00:00+09:00') : CLOSES_AT;
  if (scene === 'closed') messages.push(sys('closed_expired', false, CLOSES_AT));
  if (scene === 'partnerLeft') messages.push(sys('partner_left', false, closedAt));
  // 상대가 연장을 원한 시스템 글(extend_requested, mine=false)은 서버가 보내지만 화면은 그리지 않는다(판단 — 변경기록 6장)
  if (scene === 'extendWait') messages.push(sys('extend_requested', false, t('2026-12-29T20:00:00+09:00')));
  const room: Room = {
    id: `demo-chat-1-${p.n}`,
    partner: { id: `demo-cand-${p.n}`, name: p.name, age: p.age, region: `${p.region.sido} ${p.region.sigungu}`, facePhotoId: `demo-ph-${p.n}-face` },
    roundNo: 1,
    openedAt: MATCH_AT,
    closesAt: closed ? closedAt : CLOSES_AT,
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
export const hasDemoControls = (api: ChatApi): api is ChatApi & { demo: DemoControls } => 'demo' in api;

export function createDemoChatApi(options: { who: Who; photoUri?: (key: string) => string | null; replyMs?: number; clock?: () => number }): ChatApi & { demo: DemoControls } {
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
  const nowOf = (s: State) => SCENE_NOW[s.scene] + (clock() - s.startedAt);
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
      return r ? { ok: true, data: r.messages.map((m) => ({ ...m })) } : unavailable;
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
          push(r, msg(false, 'text', REPLY, nowOf(s)));
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
      return { ok: true, data: null };
    },
    async report(roomId, reasonCode) {
      const s = await stateOf();
      if (!roomOf(s, roomId)) return { ok: false, reason: 'unavailable' };
      if (s.reports.some((x) => x.room === roomId)) return { ok: false, reason: 'already' };
      s.reports.push({ room: roomId, reason: reasonCode });
      return { ok: true };
    },
    async block(roomId) {
      const s = await stateOf();
      const r = roomOf(s, roomId);
      if (!r) return { ok: false, reason: 'unavailable' };
      r.gone = true; // 차단 뒤 서로 안 보임(방도 목록에서 빠짐)
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
      return s ? nowOf(s) : SCENE_NOW.open;
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
