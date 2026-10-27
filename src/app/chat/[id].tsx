import { useLocalSearchParams } from 'expo-router';

import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { appMeetDeps } from '@/features/chat/useMeetScene';

// 화면 ID T4R 대화방(V5 W5). id = 서버 0031 room_id(= 탑승권 W6 의 chatId). 본문은 features/chat/ChatRoomScreen.tsx
//  D46: 이 방에 처음 들어오면 만남 장면(T4S)이 먼저 — 어느 길로 들어오든 이 주소 하나(T3 · 10 · 목록 · T2 지난 채팅방 · 알림, 정책 P4-21)
export default function ChatRoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatRoomScreen id={String(id ?? '')} meet={appMeetDeps()} />;
}
