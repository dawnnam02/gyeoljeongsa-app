import { SajuMadangScreen } from '@/features/saju/SajuMadangScreen';

// 화면 ID IF-SJ-DETAIL 내 사주 자세히(TAB-1) — 옛 사주 마당 긴 풀이 화면. 탭 밖(탭바 없음). 들어오는 길은 사주 마당 탭의 메뉴 줄뿐이고,
//  메뉴 줄이 앱 안 메모리(features/saju/sajuSection)로 넘긴 구역이 맨 위에 오게 열린다. 스위치 saju_yard 가 꺼져 있으면 주소로 와도 홈으로(SajuMadangScreen 안에서)
export default function SajuDetailRoute() {
  return <SajuMadangScreen />;
}
