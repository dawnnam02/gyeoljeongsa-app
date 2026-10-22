import { PrelaunchTabGate } from '@/features/prelaunch/PrelaunchGate';
import { LikesScreen } from '@/features/likes/LikesScreen';
import { V4Gate } from '@/navigation/v5Hide';

// 화면 ID 11 호감(F6). 본문은 features/likes/LikesScreen.tsx. 연결 알림으로 들어오면 ?tab=connected
// F22(K20 4-5 · D-123): 출시일 09:00 전(사전 오픈)에는 같은 자리에 빈 상태 한 줄(features/prelaunch). 고르는 것은 서버 get_launch_state 하나
// V5(W10 · D-152): 스위치 v4_likes 가 꺼져 있으면 그리지 않고 V5_HOME 으로(navigation/v5Hide). 코드는 그대로
export default function LikesRoute() {
  return (
    <V4Gate screen="likes">
      <PrelaunchTabGate kind="likes">
        <LikesScreen />
      </PrelaunchTabGate>
    </V4Gate>
  );
}
