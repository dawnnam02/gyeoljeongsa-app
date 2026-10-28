import { ChatListScreen } from '@/features/chat/ChatListScreen';
import { appLoungeDeps } from '@/features/lounge/loungeService';

// 화면 ID T4 채팅(V5 W5 · 청사진 v5 초안 6-1). 본문은 features/chat/ChatListScreen.tsx. 대화방은 /chat/[id]
//  LG-F: 맨 위 '라운지 줄'(T6 /lounge 입구 하나 — 정책 PL-02). 스위치 lounge 가 꺼지면 줄 0
export default function ChatRoute() {
  return <ChatListScreen lounge={appLoungeDeps()} />;
}
