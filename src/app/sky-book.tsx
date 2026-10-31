import { Redirect, type Href } from 'expo-router';

import { SkyBookScreen } from '@/features/inflight/SkyBookScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-BOOK 하늘 도감(IF3-F · G-03). 탭 밖 — 들어오는 길은 기내지 뒤표지 한 줄과 12 설정 '정보' 줄 둘뿐(홈 입구 0 · 푸시 0).
//  스위치 sky_book 이 꺼져 있으면 주소로 와도 홈으로(화면 C4 · 정책 PG-93). 본문은 features/inflight/SkyBookScreen.tsx
export default function SkyBookRoute() {
  const { flags, isOn } = useFeatureFlags();
  if (flags.loaded && !isOn('sky_book')) return <Redirect href={'/boarding' as Href} />;
  return <SkyBookScreen guide={isOn('read_guide')} />;
}
