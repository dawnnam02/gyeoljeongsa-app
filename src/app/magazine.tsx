import { useMemo } from 'react';

import { MagazineScreen } from '@/features/inflight/MagazineScreen';
import { inflightServices } from '@/features/inflight/inflightService';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-MAG 기내지(IF2-F · F-08 · F-02 · 이번 주 카드 F-09 는 ② 쪽). 탭 밖 · 새 탭 0 — 들어오는 길은 홈 B3 좌석 앞 주머니(기내지 · 이번 주 카드 칸).
//  스위치 inflight_mag 꺼짐 · 탑승 아님 · 기간 지남으로 바로 오면 '닫혔어요' 한 줄 + [탑승권으로](화면 C4 · PF-93). 본문은 features/inflight/MagazineScreen.tsx
export default function MagazineRoute() {
  const { isOn } = useFeatureFlags();
  const preOn = isOn('pre_answer');
  const deps = useMemo(() => ({ ...inflightServices(), preOn }), [preOn]);
  return <MagazineScreen deps={deps} />;
}
