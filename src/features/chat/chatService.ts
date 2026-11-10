// 채팅 화면이 쓰는 연결 하나. 데모 모드면 메모리 데모 채팅(chatDemo), 아니면 서버(chatApi, 0031 가정 이름).
//  lib/services.ts(공용)는 고치지 않으려고 여기서 만든다 — 처음 쓸 때 한 번. 시험은 화면에 api · media 를 직접 넣는다
import { env } from '@/config/env';
import { createInflightApi, rpcOf, type InflightApi } from '@/features/inflight/inflightApi';
import { onSessionEnd } from '@/lib/sessionGate';
import { supabase } from '@/lib/supabase';

import { createChatApi, type ChatApi } from './chatApi';
import { createDemoChatApi } from './chatDemo';
import { defaultChatMedia, type ChatMedia } from './chatMedia';

let email = '';
const who = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    email = u.email ?? '';
    return { id: u.id, email };
  } catch {
    return null;
  }
};

let api: ChatApi | null = null;
let media: ChatMedia | null = null;

export function chatApi(): ChatApi {
  // 데모: 신고 · 차단을 데모 로그인 모의 서버의 12 신고 내역 · 차단 목록에도(검수 QP-10)
  const note = async (partner: string, reason?: string) => void (await supabase.rpc('demo_note_chat_safety', { p_partner: partner, ...(reason ? { p_reason: reason } : {}) }));
  if (!api) api = env.demoMode ? createDemoChatApi({ who, note }) : createChatApi(supabase);
  return api;
}

// IF2-F(0043): 대화방 칸(첫마디 실마리 · 이야깃거리 · 꼬리표 글 · 같이 열어 보기). 데모면 데모 채팅이 같은 모양으로 답한다(방 · 글이 데모 채팅 메모리에 있어서)
let if2: InflightApi | null = null;

// 로그아웃 · 탈퇴 · 세션 만료(lib/sessionGate): 이 연결이 들고 있던 것을 버린다 — 데모에서는 방 · 글 · 상대(메모리), 두 모드 모두 마지막으로 본 이메일.
//  다음에 로그인하는 사람은 새 연결을 받는다(앞 사람의 방 목록이 이어지지 않는다 — FB-022)
onSessionEnd(() => {
  api = null;
  media = null;
  if2 = null;
  email = '';
});

export function inflightChatApi(): InflightApi {
  if (!if2) {
    const a = chatApi() as ChatApi & { if2Rpc?: Parameters<typeof createInflightApi>[0] };
    if2 = createInflightApi(env.demoMode && a.if2Rpc ? a.if2Rpc : rpcOf(supabase));
  }
  return if2;
}

export function chatMedia(): ChatMedia {
  if (!media) media = defaultChatMedia(() => email);
  return media;
}

// 대화방 주소(라우트는 앱 A 몫 — 주소가 바뀌면 이 두 줄만)
export const CHAT_LIST_HREF = '/chat';
export const chatRoomHref = (id: string) => `/chat/${encodeURIComponent(id)}`;
