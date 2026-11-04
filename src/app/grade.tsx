import { useMemo } from 'react';

import { MyGradeScreen } from '@/features/grade/MyGradeScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { gradeApi } from '@/lib/services';

// 화면 ID 16-G 내 등급 — v5(D-200 ② · 정책 P3-10): 12 설정 '내 등급' 줄로 여는 탭 위 화면(탭바 없음). 본문은 features/grade/MyGradeScreen.tsx
export default function GradeRoute() {
  const docVerify = useFeatureFlags().isOn('doc_verify'); // D-238: 서류 인증 스위치가 꺼져 있으면 '서류 인증' 칸 · 서류 줄이 없다
  const deps = useMemo(() => ({ grade: gradeApi, now: Date.now, docVerify }), [docVerify]);
  return <MyGradeScreen deps={deps} />;
}
