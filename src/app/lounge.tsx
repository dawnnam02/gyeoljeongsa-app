import { LoungeScreen } from '@/features/lounge/LoungeScreen';
import { appLoungeDeps } from '@/features/lounge/loungeService';

// 화면 ID T6 탑승객 라운지(LG-F · D-220 · 화면 요구 T6). 탭 밖 · 새 탭 0 — 들어오는 길은 T4 채팅 목록 맨 위 '라운지 줄' 하나(정책 PL-02).
//  스위치 lounge 꺼짐 · 탑승 아님으로 이 주소에 바로 오면 T4 목록으로(PL-35). 본문은 features/lounge/LoungeScreen.tsx
export default function LoungeRoute() {
  return <LoungeScreen deps={appLoungeDeps()} />;
}
