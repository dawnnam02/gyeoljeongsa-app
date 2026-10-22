import { useState } from 'react';

import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { boardingServices } from '@/features/boarding/boardingServices';
import { PrelaunchGate } from '@/features/prelaunch/PrelaunchGate';

// 화면 ID T1 탑승권(+ T2 기다림은 같은 화면의 상태) — V5 W6. 본문은 features/boarding/BoardingScreen.tsx
// 사전 오픈(F22): 확정 전에는 같은 자리에 대기 화면(단계표), 확정되면 출시 전이어도 탑승권(판매 전 상태)
export default function BoardingRoute() {
  const [deps] = useState(() => boardingServices());
  return (
    <PrelaunchGate confirmedOpens>
      <BoardingScreen deps={deps} />
    </PrelaunchGate>
  );
}
