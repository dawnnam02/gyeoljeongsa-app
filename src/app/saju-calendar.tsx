import { Redirect, type Href } from 'expo-router';

import { SajuCalendarScreen } from '@/features/saju/SajuCalendarScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID IF-SJ-CAL 만세력 달력 · 날짜 고르기(IF5-F1). 달력은 saju_calendar, 날짜 고르기는 saju_pickday 가 켜져 있어야 한다. 꺼져 있으면 주소로 와도 홈으로
export default function SajuCalendarRoute() {
  const { flags, isOn } = useFeatureFlags();
  if (flags.loaded && !(isOn('saju_yard') && isOn('saju_calendar'))) return <Redirect href={'/boarding' as Href} />;
  return <SajuCalendarScreen />;
}
