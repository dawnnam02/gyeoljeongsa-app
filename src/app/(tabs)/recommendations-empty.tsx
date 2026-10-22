import { RecommendationsScreen } from '@/features/recs/RecommendationsScreen';
import { V4Gate } from '@/navigation/v5Hide';

// 화면 ID 13 추천 없음(09 의 빈 상태를 따로 보는 라우트, F5). 남은 시간은 그대로 보이고 카드 자리가 빈 상태다
// V5(W10 · D-152): 스위치 v4_daily_recs 가 꺼져 있으면 그리지 않고 V5_HOME 으로(navigation/v5Hide). 코드는 그대로
export default function RecommendationsEmptyRoute() {
  return (
    <V4Gate screen="dailyRecs">
      <RecommendationsScreen forceEmpty />
    </V4Gate>
  );
}
