import { Redirect, type Href } from 'expo-router';

import { TypeCardScreen } from '@/features/inflight/TypeCardScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-TYPE 내 여행 타입(IF2-F · F-19). 탭 밖 — 들어오는 길은 홈 B3 셋째 칸 · B6 · B7. 본문은 features/inflight/TypeCardScreen.tsx
//  스위치 type_card 가 꺼져 있으면 주소로 와도 홈으로(화면 C4 · 정책 PF-93)
export default function TypeCardRoute() {
  const { flags, isOn } = useFeatureFlags();
  if (flags.loaded && !isOn('type_card')) return <Redirect href={'/boarding' as Href} />;
  return <TypeCardScreen />;
}
