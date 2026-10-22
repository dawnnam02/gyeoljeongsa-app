import { PrelaunchGate } from '@/features/prelaunch/PrelaunchGate';
import { RecommendationsScreen } from '@/features/recs/RecommendationsScreen';
import { V4Gate } from '@/navigation/v5Hide';

// 화면 ID 09 오늘의 추천(F5). 본문은 features/recs/RecommendationsScreen.tsx
// F22(K20 4-5): 사전 오픈 동안 · 출시 뒤 권역이 열리기 전에는 같은 자리에 대기 화면(features/prelaunch). 고르는 것은 서버 get_launch_state 하나
// V5(W10 · D-152): 스위치 v4_daily_recs 가 꺼져 있으면 그리지 않고 V5_HOME 으로(navigation/v5Hide). 코드는 그대로
export default function RecommendationsRoute() {
  return (
    <V4Gate screen="dailyRecs">
      <PrelaunchGate>
        <RecommendationsScreen />
      </PrelaunchGate>
    </V4Gate>
  );
}
