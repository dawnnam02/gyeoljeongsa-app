import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { inflightChatApi } from '@/features/chat/chatService';
import { appMeetDeps } from '@/features/chat/useMeetScene';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID T4R 대화방(V5 W5). id = 서버 0031 room_id(= 탑승권 W6 의 chatId). 본문은 features/chat/ChatRoomScreen.tsx
//  D46: 이 방에 처음 들어오면 만남 장면(T4S)이 먼저 — 어느 길로 들어오든 이 주소 하나(T3 · 10 · 목록 · T2 지난 채팅방 · 알림, 정책 P4-21)
//  IF2-F(D-223): 대화방 칸(스위치마다 — 꺼지면 그 칸 0 · 방 그대로, 정책 PF-93) · draft = 홈 '꺼내는 말 가져가기'(입력창에 넣기만)
export default function ChatRoomRoute() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const { isOn } = useFeatureFlags();
  const if2 = useMemo(() => ({ api: inflightChatApi(), isOn }), [isOn]);
  return <ChatRoomScreen id={String(id ?? '')} meet={appMeetDeps()} if2={if2} draft={typeof draft === 'string' ? draft : undefined} />;
}
