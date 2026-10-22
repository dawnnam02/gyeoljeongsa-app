import { SettingsScreen } from '@/features/settings/SettingsScreen';

// 화면 ID 12 설정(F7). 본문은 features/settings/SettingsScreen.tsx. 하위 화면은 12 안의 쪽이라 라우트를 늘리지 않는다
export default function SettingsRoute() {
  return <SettingsScreen />;
}
