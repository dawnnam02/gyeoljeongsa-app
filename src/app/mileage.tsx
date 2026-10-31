import { MileageScreen } from '@/features/mileage/MileageScreen';

// 화면 ID IF-MILE 마일리지(IF5-F2). 탭 밖 — 상점 탭 0. 들어오는 길은 사주 마당 머리 [마일리지] · 12 설정 '마일리지' 줄 · 잔액 부족 [충전하러 가기] · 내역 [충전하기]뿐.
// 스위치 mileage 가 꺼져 있으면 주소로 와도 홈으로(PF-93 · PS-94 — MileageScreen 안에서)
export default function MileageRoute() {
  return <MileageScreen />;
}
