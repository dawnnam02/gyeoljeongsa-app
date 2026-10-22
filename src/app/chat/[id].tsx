import { useLocalSearchParams } from 'expo-router';

import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';

// 화면 ID T4R 대화방(V5 W5). id = 서버 0031 room_id(= 탑승권 W6 의 chatId). 본문은 features/chat/ChatRoomScreen.tsx
export default function ChatRoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatRoomScreen id={String(id ?? '')} />;
}
