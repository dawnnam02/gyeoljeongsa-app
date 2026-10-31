import { SajuTalkScreen } from '@/features/saju/SajuTalkScreen';

// 화면 ID IF-SJ-TALK 사주 이야기 나누기(IF5-F2). 탭 밖 — 들어오는 길은 사주 마당 맨 위 입구뿐. 스위치 saju_yard · saju_talk 가 꺼져 있으면 주소로 와도 홈으로(SajuTalkScreen 안에서)
export default function SajuTalkRoute() {
  return <SajuTalkScreen />;
}
