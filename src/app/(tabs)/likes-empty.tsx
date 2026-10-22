import { LikesScreen } from '@/features/likes/LikesScreen';
import { V4Gate } from '@/navigation/v5Hide';

// 화면 ID 14 호감 없음(11 의 받은 호감 0건 상태를 따로 보는 라우트, F6). 탭 3개는 그대로이고 받은 호감 목록 자리가 빈 상태다
// V5(W10 · D-152): 스위치 v4_likes 가 꺼져 있으면 그리지 않고 V5_HOME 으로(navigation/v5Hide). 코드는 그대로
export default function LikesEmptyRoute() {
  return (
    <V4Gate screen="likes">
      <LikesScreen forceEmpty />
    </V4Gate>
  );
}
