// 채팅 화면이 쓰는 연결 하나. 데모 모드면 메모리 데모 채팅(chatDemo), 아니면 서버(chatApi, 0031 가정 이름).
//  lib/services.ts(공용)는 고치지 않으려고 여기서 만든다 — 처음 쓸 때 한 번. 시험은 화면에 api · media 를 직접 넣는다
import { env } from '@/config/env';
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
  if (!api) api = env.demoMode ? createDemoChatApi({ who }) : createChatApi(supabase);
  return api;
}

export function chatMedia(): ChatMedia {
  if (!media) media = defaultChatMedia(() => email);
  return media;
}

// 대화방 주소(라우트는 앱 A 몫 — 주소가 바뀌면 이 두 줄만)
export const CHAT_LIST_HREF = '/chat';
export const chatRoomHref = (id: string) => `/chat/${encodeURIComponent(id)}`;
