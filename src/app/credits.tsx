import { useState } from 'react';

import { boardingServices } from '@/features/boarding/boardingServices';
import { CreditScreen } from '@/features/boarding/CreditScreen';

// 화면 ID T5 크레딧 · 내역 — V5 W6. 탭 위에 열리는 화면(탭바 없음). 본문은 features/boarding/CreditScreen.tsx
export default function CreditsRoute() {
  const [deps] = useState(() => ({ api: boardingServices().api }));
  return <CreditScreen deps={deps} />;
}
