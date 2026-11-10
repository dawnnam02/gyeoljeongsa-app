import { SajuYardScreen } from '@/features/saju/SajuYardScreen';

// 화면 ID IF-MADANG 사주 마당 — 하단 탭(TAB-1 · D-254, 탑승권 · 채팅 · 사주 마당 · 설정). 탭 첫 화면은 짧은 메뉴(features/saju/SajuYardScreen).
//  옛 긴 풀이 화면은 /saju-detail(app/saju-detail.tsx)로 옮겼다. 스위치 saju_yard 가 꺼져 있으면 탭 칸이 없고 주소로 와도 홈으로(PF-93 · PS-94 — SajuYardScreen 안에서)
export default function SajuRoute() {
  return <SajuYardScreen />;
}
