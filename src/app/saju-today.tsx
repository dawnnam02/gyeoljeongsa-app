import { Redirect, type Href } from 'expo-router';

import { SajuTodayScreen } from '@/features/saju/SajuTodayScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 IF-SJ-TODAY 오늘 하루(F5-08 · IF5-F1). 홈 띠를 눌러서만 온다. 스위치 saju_yard · saju_today 가 꺼져 있으면 주소로 와도 홈으로
export default function SajuTodayRoute() {
  const { flags, isOn } = useFeatureFlags();
  if (flags.loaded && !(isOn('saju_yard') && isOn('saju_today'))) return <Redirect href={'/boarding' as Href} />;
  return <SajuTodayScreen />;
}
