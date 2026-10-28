import { Redirect, type Href } from 'expo-router';

import { PreviewScreen } from '@/features/inflight/PreviewScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-PREVIEW 짝에게 보이는 내 모습(IF2-F · F-56). 탭 밖 — 들어오는 길은 08 [짝에게 보이는 모습] · 홈 B6 · B7. 본문은 features/inflight/PreviewScreen.tsx
//  스위치 profile_preview 가 꺼져 있으면 주소로 와도 홈으로(화면 C4 · 정책 PF-93)
export default function PreviewRoute() {
  const { flags, isOn } = useFeatureFlags();
  if (flags.loaded && !isOn('profile_preview')) return <Redirect href={'/boarding' as Href} />;
  return <PreviewScreen />;
}
