import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';
import { inflightChatApi } from '@/features/chat/chatService';
import { clearHandoff, peekHandoff } from '@/features/chat/openerPath';
import { appMeetDeps } from '@/features/chat/useMeetScene';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID T4R 대화방(V5 W5). id = 서버 0031 room_id(= 탑승권 W6 의 chatId). 본문은 features/chat/ChatRoomScreen.tsx
//  D46: 이 방에 처음 들어오면 만남 장면(T4S)이 먼저 — 어느 길로 들어오든 이 주소 하나(T3 · 10 · 목록 · T2 지난 채팅방 · 알림, 정책 P4-21)
//  IF2-F(D-223): 대화방 칸(스위치마다 — 꺼지면 그 칸 0 · 방 그대로, 정책 PF-93)
//  QF2 Q2-13: 입력창에 넣을 글(홈 '꺼내는 말 가져가기' · T3 이야깃거리)과 프로필 질문 카드(Q2-08)는 주소의 ?draft= 가 아니라 앱 안 메모리(openerPath)로 건너온다 —
//  웹 주소창 · 기록에 인용이 남지 않는다. 주소의 draft 값은 읽지 않는다(남이 만든 링크로 입력창이 채워지지 않게)
export default function ChatRoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = String(id ?? '');
  const { isOn } = useFeatureFlags();
  const if2 = useMemo(() => ({ api: inflightChatApi(), isOn }), [isOn]);
  const handoff = useMemo(() => peekHandoff(roomId), [roomId]);
  useEffect(() => () => clearHandoff(roomId), [roomId]); // 화면을 떠나면 건넨 것을 지운다(다시 들어와도 되살지 않음)
  return <ChatRoomScreen id={roomId} meet={appMeetDeps()} if2={if2} draft={handoff?.draft} fromCard={handoff?.card} />;
}
