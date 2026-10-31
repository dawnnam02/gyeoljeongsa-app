import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';

// 화면 ID IF-MADANG 사주 마당(IF5-F1). 탭 밖 — 들어오는 길은 홈 B6 칸 · B7 줄 · 오늘 하루 띠 · 12 설정 '사주 마당' 줄. 스위치 saju_yard 가 꺼져 있으면 주소로 와도 홈으로(PF-93 · PS-94 — SajuMadangScreen 안에서)
export default function SajuRoute() {
  return <SajuMadangScreen />;
}
