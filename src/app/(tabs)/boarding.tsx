import { useMemo, useState } from 'react';

import { BoardingScreen } from '@/features/boarding/BoardingScreen';
import { boardingServices } from '@/features/boarding/boardingServices';
import { PrelaunchGate } from '@/features/prelaunch/PrelaunchGate';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID T1 탑승권(+ T2 기다림은 같은 화면의 상태) — V5 W6. 본문은 features/boarding/BoardingScreen.tsx
// 사전 오픈(F22): 확정 전에는 같은 자리에 대기 화면(단계표), 확정되면 출시 전이어도 탑승권(판매 전 상태)
// IF2-F(D-223): 스위치 inflight_home 이 켜지면 홈 새 구성(B1 ~ B7) — 스위치는 여기서 훅으로 읽어 넘긴다(꺼지면 지금 T1 · T2 그대로)
export default function BoardingRoute() {
  const [base] = useState(() => boardingServices());
  const { isOn } = useFeatureFlags();
  const deps = useMemo(() => ({ ...base, inflight: { ...base.inflightBase, isOn } }), [base, isOn]);
  return (
    <PrelaunchGate confirmedOpens>
      <BoardingScreen deps={deps} />
    </PrelaunchGate>
  );
}
