import { MileageLogScreen } from '@/features/mileage/MileageLogScreen';

// 화면 ID IF-MILE-LOG 마일리지 내역(IF5-F2). 마일리지 화면의 [내역 보기]로만 온다. 스위치 mileage 가 꺼져 있으면 주소로 와도 홈으로
export default function MileageLogRoute() {
  return <MileageLogScreen />;
}
