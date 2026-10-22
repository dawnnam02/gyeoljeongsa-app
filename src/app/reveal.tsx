import { useState } from 'react';

import { boardingServices } from '@/features/boarding/boardingServices';
import { RevealScreen } from '@/features/boarding/RevealScreen';
import { recsApi } from '@/lib/services';

// 화면 ID T3 수요일 18:00 공개 순간 — V5 W6. 탭 위에 열리는 화면(탭바 없음). 본문은 features/boarding/RevealScreen.tsx
export default function RevealRoute() {
  const [deps] = useState(() => ({ api: boardingServices().api, photoUrl: (id: string) => recsApi.photoUrl(id) }));
  return <RevealScreen deps={deps} />;
}
