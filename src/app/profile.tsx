import { ProfileScreen } from '@/features/profile/ProfileScreen';

// 화면 ID 08 내 프로필(F4 · F11). 탭이 아니라 탭 위에 열리는 화면이다 — 주소 /profile 은 그대로이고 (tabs) 그룹 밖으로 옮겼다(K7).
// 탭 화면 오른쪽 위 원형 사진으로 들어오며, 탭바가 없고 왼쪽 위 ‹ 로 들어온 화면으로 돌아간다. 본문은 features/profile/ProfileScreen.tsx
export default function ProfileRoute() {
  return <ProfileScreen />;
}
