// 채팅이 서버와 주고받는 일(V5 W5). 서버 = 백엔드 B `backend/작업중/0031_chat.sql` + Edge `chat-media`(backend/W4_변경기록.md 3 · 4장) — 이름 · 키를 그대로 맞췄다.
//   list_chat_rooms()                                  → {rooms:[방]} · {off:true}(스위치 꺼짐) · null
//   get_chat_room(p_room)                              → 방 · null(볼 수 없음) · {off:true}
//   list_chat_messages(p_room, p_before?, p_limit=50)  → {messages:[글](오래된 순), has_more}
//   send_chat_message(p_room, p_body)                  → {ok:true, message, help?} · {ok:false, code:'text_blocked', codes}
//        help = 위기 도움 카드 참/거짓 한 칸(보내기 응답에만 · 저장 0 · 정책 P4-31) — 백엔드 0047 뒤에 온다. 응답에 칸이 없으면 0(카드 안 뜸)
//   mark_chat_read(p_room, p_upto)                     → 남은 안 읽은 수
//   request_chat_extension(p_room)                     → {extended, room} · cancel_chat_extension(p_room) → 방
//   leave_chat_room(p_room)                            → {left:true} (나간 사람은 방이 사라짐 · 상대는 partner_left 로 30일 읽기만)
//   block_chat_partner(p_room) → {blocked:true} · report_chat_partner(p_room, p_reason, p_description?, p_message?) → 신고 id
//   오류: forbidden · feature_off(42501) / not_available · room_closed · rate_limited · invalid_text · invalid_reason · invalid_description · description_required · already_reported(P0001)
//   Edge chat-media: upload-url {room_id, kind, format} → {ok, attachment_id, signed_url, token, max_bytes, content_type} → signed_url 에 PUT
//                    → finalize {attachment_id, duration_ms?} → {ok, message} / url {attachment_id} → {ok, url, expires_in:300}
//   방 = room_id · state(open|closed) · opened_at · closes_at · close_reason(null|expired|partner_left) · extend{me, partner} · extend_count · partner{user_id, name(김OO)} · last_message{kind, mine, preview, created_at} · unread
//   글 = id(숫자) · mine · kind(text|photo|voice|system) · body · attachment_id · duration_ms · caution(링크 — 받는 쪽 주의 표시) · created_at
//   실시간: postgres_changes INSERT public.chat_messages filter room_id=eq.{방} — 새 글 · 시스템 글(연장 · 닫힘 · 나감)이 모두 이 한 줄로 온다
//  · 앱은 아는 키만 읽는다. extend.partner(상대가 연장을 원하는지)는 읽지 않는다(판단 — W5_변경기록 6장)
//  · 로그에는 이벤트 이름과 코드만(글 · 이름 · 경로 · URL 금지)
import type { SupabaseClient } from '@supabase/supabase-js';

import { safeLog } from '@/lib/log';
import { readDbFailure, readFunctionFailure } from '@/lib/serverError';

import type { ClosedReason } from './chatLogic';

export type ChatPartner = { id: string; name: string; age: number | null; region: string; facePhotoId: string | null };
export type MessageKind = 'text' | 'photo' | 'voice' | 'system';
export type SystemEvent = 'opened' | 'extend_requested' | 'extend_cancelled' | 'extended' | 'closed_expired' | 'partner_left';
export type LastMessage = { kind: MessageKind; body: string; at: number; mine: boolean };
export type Room = {
  id: string;
  partner: ChatPartner;
  roundNo: number | null;
  openedAt: number;
  closesAt: number;
  closedAt: number | null;
  closedReason: ClosedReason | null;
  purgeAt: number | null;
  myExtend: boolean;
  last: LastMessage | null;
  unread: number;
};
// IF2-F(0043): 꼬리표 글 — 엽서 · 이야깃거리 · 같이 열어 보는 질문(+ 그 답) · 저는 이런 편이에요 · 작별 엽서. 보통 글은 tag 없음(0031 키 그대로)
export type ChatTag = 'postcard' | 'topic' | 'together_q' | 'together_a' | 'about_me' | 'farewell';
const CHAT_TAGS: readonly ChatTag[] = ['postcard', 'topic', 'together_q', 'together_a', 'about_me', 'farewell'];
// 같이 열어 보는 질문 카드의 내 쪽 상태(0043 together_state) — 상대가 답했는지 · 눌렀는지는 없다(보안 S-6 · PF-55)
export type TogetherState = { state: 'mine_needed' } | { state: 'waiting'; myAnswer: string; canWithdraw: boolean } | { state: 'opened' } | { state: 'withdrawn' } | { state: 'closed'; myAnswer: string | null };
// 보내기 응답으로 돌아온 글 + 위기 표시 한 칸(help). 목록에서 읽은 글에는 이 칸이 없다 — 방을 다시 열면 카드가 다시 뜨지 않는다(정책 P4-33)
export type SentMessage = Message & { help?: true };
export type Message = {
  id: string;
  clientId: string | null;
  mine: boolean;
  kind: MessageKind;
  body: string;
  mediaId: string | null; // 첨부 id(서버 attachment_id) — 열람 URL 은 mediaUrl 로 300초씩
  durationMs: number | null;
  caution: boolean;
  createdAt: number;
  purged: boolean;
  tag?: ChatTag | null;
  ref?: string | null;
  together?: TogetherState | null;
};
// localUri = 보내는 동안 내 화면에 먼저 그릴 주소(메모리) · demoKey = 데모 사진 파일 키(데모 채팅만)
export type OutgoingMedia =
  | { kind: 'photo'; bytes: Uint8Array; contentType: 'image/jpeg'; localUri?: string; demoKey?: string }
  | { kind: 'voice'; bytes: Uint8Array; contentType: string; durationMs: number; localUri?: string };
export type Outgoing = { clientId: string; kind: 'text'; body: string } | ({ clientId: string } & OutgoingMedia);

export type LoadFailure = 'network' | 'server' | 'unavailable';
export type SendFailure = 'network' | 'server' | 'blocked' | 'closed' | 'unavailable' | 'long' | 'limited' | 'format' | 'size';
export type Result<T, F> = { ok: true; data: T } | { ok: false; reason: F };
export type ReportResult = { ok: true } | { ok: false; reason: 'network' | 'server' | 'already' | 'invalid_reason' | 'description_required' | 'invalid_description' | 'unavailable' };

export type ChatApi = {
  listRooms(): Promise<Result<Room[], Exclude<LoadFailure, 'unavailable'>>>;
  getRoom(id: string): Promise<Result<Room, LoadFailure>>;
  listMessages(id: string, before?: string): Promise<Result<Message[], LoadFailure>>;
  send(id: string, out: Outgoing): Promise<Result<SentMessage, SendFailure>>;
  markRead(id: string, uptoId: string): Promise<void>;
  setExtend(id: string, want: boolean): Promise<Result<{ closesAt: number; extended: boolean }, LoadFailure>>;
  leave(id: string): Promise<Result<null, LoadFailure>>;
  report(roomId: string, reasonCode: string, description: string): Promise<ReportResult>;
  block(roomId: string): Promise<{ ok: true } | { ok: false; reason: 'network' | 'server' | 'unavailable' }>;
  mediaUrl(mediaId: string): Promise<string | null>;
  faceUrl(photoId: string): Promise<string | null>;
  subscribe(id: string, onChange: () => void): () => void; // 새 글(시스템 글 포함)이 오면 부른다
  now(): number;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const idOf = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v));
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const KINDS: readonly MessageKind[] = ['text', 'photo', 'voice', 'system'];

export function regionText(region: unknown): string {
  if (!isRecord(region)) return '';
  return [str(region.sido), str(region.sigungu)].filter(Boolean).join(' ');
}

export function parseRoom(raw: unknown): Room | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.room_id);
  const openedAt = time(raw.opened_at);
  const closesAt = time(raw.closes_at);
  const p = isRecord(raw.partner) ? raw.partner : {};
  const partnerId = str(p.user_id);
  if (!id || !partnerId || openedAt === null || closesAt === null) return null;
  const closed = raw.state === 'closed';
  const l = isRecord(raw.last_message) ? raw.last_message : null;
  const lastAt = l ? time(l.created_at) : null;
  const lastKind = l && KINDS.includes(l.kind as MessageKind) ? (l.kind as MessageKind) : null;
  const ext = isRecord(raw.extend) ? raw.extend : {};
  return {
    id,
    partner: { id: partnerId, name: str(p.name) ?? '', age: int(p.age), region: regionText(p.region), facePhotoId: str(p.face_photo_id) },
    roundNo: int(raw.round_no),
    openedAt,
    closesAt,
    closedAt: closed ? closesAt : null, // 닫힌 방의 closes_at = 닫힌 때(0031)
    closedReason: closed ? (raw.close_reason === 'partner_left' ? 'partner_left' : 'expired') : null,
    purgeAt: null, // 앱이 닫힌 때 + 30일로 센다
    myExtend: ext.me === true,
    last: l && lastAt !== null && lastKind ? { kind: lastKind, body: typeof l.preview === 'string' ? l.preview : '', at: lastAt, mine: l.mine === true } : null,
    unread: Math.max(0, int(raw.unread) ?? 0),
  };
}

export function parseMessage(raw: unknown): Message | null {
  if (!isRecord(raw)) return null;
  const id = idOf(raw.id);
  const createdAt = time(raw.created_at);
  const kind = KINDS.includes(raw.kind as MessageKind) ? (raw.kind as MessageKind) : null;
  if (!id || createdAt === null || !kind) return null;
  return {
    id,
    clientId: str(raw.client_id),
    mine: raw.mine === true,
    kind,
    body: typeof raw.body === 'string' ? raw.body : '',
    mediaId: idOf(raw.attachment_id),
    durationMs: int(raw.duration_ms),
    caution: raw.caution === true,
    createdAt,
    purged: raw.purged === true,
    ...tagged(raw),
  };
}

// 꼬리표 글만 tag · ref(+ 질문 카드면 내 쪽 상태). 모르는 꼬리표는 보통 글로
function tagged(raw: Record<string, unknown>): Pick<Message, 'tag' | 'ref' | 'together'> {
  const tag = CHAT_TAGS.includes(raw.tag as ChatTag) ? (raw.tag as ChatTag) : null;
  if (!tag) return {};
  const ref = typeof raw.ref === 'string' && /^[A-Za-z0-9_,:-]{1,80}$/.test(raw.ref) ? raw.ref : null;
  const t = isRecord(raw.together) ? raw.together : null;
  let together: TogetherState | null = null;
  if (tag === 'together_q' && t) {
    const mine = typeof t.my_answer === 'string' ? t.my_answer : null;
    if (t.state === 'mine_needed') together = { state: 'mine_needed' };
    else if (t.state === 'waiting') together = { state: 'waiting', myAnswer: mine ?? '', canWithdraw: t.can_withdraw === true };
    else if (t.state === 'opened') together = { state: 'opened' };
    else if (t.state === 'withdrawn') together = { state: 'withdrawn' };
    else if (t.state === 'closed') together = { state: 'closed', myAnswer: mine };
  }
  return { tag, ref, together };
}

const roomsOf = (raw: unknown): unknown[] | null => (isRecord(raw) && raw.off === true ? [] : isRecord(raw) && Array.isArray(raw.rooms) ? raw.rooms : Array.isArray(raw) ? raw : raw === null ? [] : null);
export const parseRooms = (raw: unknown): Room[] | null => {
  const list = roomsOf(raw);
  return list ? list.map(parseRoom).filter((r): r is Room => r !== null) : null;
};
export const parseMessages = (raw: unknown): Message[] | null => {
  const list = isRecord(raw) && Array.isArray(raw.messages) ? raw.messages : Array.isArray(raw) ? raw : null;
  return list ? list.map(parseMessage).filter((m): m is Message => m !== null).sort((a, b) => a.createdAt - b.createdAt || Number(a.id) - Number(b.id)) : null;
};

type DbError = { code?: string | null; message?: string | null };
type Rpc = { data: unknown; error: DbError | null };
const messageCode = (e: DbError) => String(e.message ?? '').split(':')[0].trim();
const MEDIA_FAIL: Record<string, SendFailure> = { not_available: 'unavailable', room_closed: 'closed', rate_limited: 'limited', too_large: 'size', bad_format: 'format', has_gps: 'format', invalid_duration: 'format' };

export function createChatApi(client: SupabaseClient, http: typeof fetch = (...a) => fetch(...a)): ChatApi {
  const call = async (name: string, args: Record<string, unknown> = {}): Promise<Rpc> => {
    try {
      return (await client.rpc(name, args)) as Rpc;
    } catch {
      return { data: null, error: { code: 'client', message: 'rpc_failed' } };
    }
  };
  const load = (error: DbError, event: string): LoadFailure => {
    const f = readDbFailure(error);
    safeLog({ event, code: f.code ?? (f.network ? 'network' : 'unknown') });
    if (f.network) return 'network';
    const c = messageCode(error);
    if (f.code === '42501' || c === 'not_available' || c === 'forbidden' || c === 'feature_off') return 'unavailable';
    return 'server';
  };
  const media = async (body: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string; network: boolean }> => {
    try {
      const { data, error } = await client.functions.invoke('chat-media', { body });
      if (error) {
        const f = await readFunctionFailure(error);
        return { ok: false, code: f.code ?? 'server_error', network: f.network };
      }
      return isRecord(data) && data.ok === true ? { ok: true, data } : { ok: false, code: isRecord(data) ? String(data.code ?? 'server_error') : 'server_error', network: false };
    } catch {
      return { ok: false, code: 'network', network: true };
    }
  };

  async function sendMedia(id: string, out: OutgoingMedia): Promise<Result<Message, SendFailure>> {
    const format = out.kind === 'photo' ? 'jpg' : out.contentType.includes('mp4') || out.contentType.includes('m4a') ? 'm4a' : 'webm';
    const up = await media({ action: 'upload-url', room_id: id, kind: out.kind, format });
    if (!up.ok) {
      safeLog({ event: 'chat.upload.fail', code: up.code });
      return { ok: false, reason: up.network ? 'network' : (MEDIA_FAIL[up.code] ?? 'server') };
    }
    const maxBytes = int(up.data.max_bytes);
    if (maxBytes !== null && out.bytes.length > maxBytes) return { ok: false, reason: 'size' };
    try {
      const put = await http(String(up.data.signed_url), { method: 'PUT', headers: { 'content-type': String(up.data.content_type ?? out.contentType) }, body: out.bytes as unknown as BodyInit });
      if (!put.ok) {
        safeLog({ event: 'chat.upload.fail', code: 'storage', status: put.status });
        return { ok: false, reason: 'server' };
      }
    } catch {
      safeLog({ event: 'chat.upload.fail', code: 'network' });
      return { ok: false, reason: 'network' };
    }
    const fin = await media({ action: 'finalize', attachment_id: up.data.attachment_id, ...(out.kind === 'voice' ? { duration_ms: out.durationMs } : {}) });
    if (!fin.ok) {
      safeLog({ event: 'chat.finalize.fail', code: fin.code });
      return { ok: false, reason: fin.network ? 'network' : (MEDIA_FAIL[fin.code] ?? 'server') };
    }
    const m = parseMessage(fin.data.message);
    return m ? { ok: true, data: m } : { ok: false, reason: 'server' };
  }

  return {
    async listRooms() {
      const { data, error } = await call('list_chat_rooms');
      if (error) {
        const r = load(error, 'chat.list.fail');
        return { ok: false, reason: r === 'network' ? 'network' : 'server' };
      }
      const rooms = parseRooms(data);
      return rooms ? { ok: true, data: rooms } : { ok: false, reason: 'server' };
    },
    async getRoom(id) {
      const { data, error } = await call('get_chat_room', { p_room: id });
      if (error) return { ok: false, reason: load(error, 'chat.room.fail') };
      const room = parseRoom(data);
      return room ? { ok: true, data: room } : { ok: false, reason: 'unavailable' };
    },
    async listMessages(id, before) {
      const { data, error } = await call('list_chat_messages', { p_room: id, p_before: before === undefined ? null : Number(before), p_limit: 50 });
      if (error) return { ok: false, reason: load(error, 'chat.messages.fail') };
      if (isRecord(data) && data.off === true) return { ok: false, reason: 'unavailable' };
      const list = parseMessages(data);
      return list ? { ok: true, data: list } : { ok: false, reason: data === null ? 'unavailable' : 'server' };
    },
    async send(id, out) {
      if (out.kind !== 'text') return sendMedia(id, out);
      const { data, error } = await call('send_chat_message', { p_room: id, p_body: out.body });
      if (error) {
        const code = messageCode(error);
        if (code === 'room_closed') return { ok: false, reason: 'closed' };
        if (code === 'invalid_text') return { ok: false, reason: 'long' };
        if (code === 'rate_limited') return { ok: false, reason: 'limited' };
        return { ok: false, reason: load(error, 'chat.send.fail') };
      }
      if (isRecord(data) && data.ok === false) return { ok: false, reason: data.code === 'text_blocked' ? 'blocked' : 'server' };
      const m = parseMessage(isRecord(data) ? data.message : null);
      const help = isRecord(data) && data.help === true;
      return m ? { ok: true, data: { ...m, clientId: out.clientId, ...(help ? { help: true as const } : {}) } } : { ok: false, reason: 'server' };
    },
    async markRead(id, uptoId) {
      const upto = Number(uptoId);
      if (Number.isFinite(upto)) await call('mark_chat_read', { p_room: id, p_upto: upto });
    },
    async setExtend(id, want) {
      const { data, error } = await call(want ? 'request_chat_extension' : 'cancel_chat_extension', { p_room: id });
      if (error) return { ok: false, reason: load(error, 'chat.extend.fail') };
      const room = parseRoom(isRecord(data) && 'room' in data ? data.room : data);
      if (!room) return { ok: false, reason: 'server' };
      return { ok: true, data: { closesAt: room.closesAt, extended: isRecord(data) && data.extended === true } };
    },
    async leave(id) {
      const { error } = await call('leave_chat_room', { p_room: id });
      if (error) return { ok: false, reason: load(error, 'chat.leave.fail') };
      return { ok: true, data: null };
    },
    async report(roomId, reasonCode, description) {
      const text = description.trim();
      const { error } = await call('report_chat_partner', { p_room: roomId, p_reason: reasonCode, p_description: text === '' ? null : text, p_message: null });
      if (!error) return { ok: true };
      const code = messageCode(error);
      if (code === 'already_reported') return { ok: false, reason: 'already' };
      if (code === 'invalid_reason') return { ok: false, reason: 'invalid_reason' };
      if (code === 'description_required') return { ok: false, reason: 'description_required' };
      if (code === 'invalid_description') return { ok: false, reason: 'invalid_description' };
      return { ok: false, reason: load(error, 'chat.report.fail') };
    },
    async block(roomId) {
      const { error } = await call('block_chat_partner', { p_room: roomId });
      if (!error) return { ok: true };
      return { ok: false, reason: load(error, 'chat.block.fail') };
    },
    async mediaUrl(mediaId) {
      const r = await media({ action: 'url', attachment_id: mediaId });
      return r.ok && typeof r.data.url === 'string' ? r.data.url : null;
    },
    async faceUrl(photoId) {
      // 방 응답에 얼굴 사진 id 가 아직 없다(0004 can_view 에 채팅 짝 더하기 — W4 7장 7). 생기면 그대로 쓴다
      const { data, error } = await client.functions.invoke('photo', { body: { action: 'url', photo_id: photoId } });
      if (error) return null;
      return isRecord(data) && data.ok === true && typeof data.url === 'string' ? data.url : null;
    },
    subscribe(id, onChange) {
      try {
        const channel = client
          .channel(`chat:${id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${id}` }, () => onChange())
          .subscribe();
        return () => {
          void client.removeChannel(channel);
        };
      } catch {
        return () => undefined; // 실시간을 못 붙이면 화면의 15초 다시 읽기만
      }
    },
    now: () => Date.now(),
  };
}
