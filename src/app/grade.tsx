import { useState } from 'react';

import { MyGradeScreen } from '@/features/grade/MyGradeScreen';
import { gradeApi } from '@/lib/services';

// 화면 ID 16-G 내 등급 — v5(D-200 ② · 정책 P3-10): 12 설정 '내 등급' 줄로 여는 탭 위 화면(탭바 없음). 본문은 features/grade/MyGradeScreen.tsx
export default function GradeRoute() {
  const [deps] = useState(() => ({ grade: gradeApi, now: Date.now }));
  return <MyGradeScreen deps={deps} />;
}
