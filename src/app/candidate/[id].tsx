import { Stack } from 'expo-router';

import { CandidateScreen } from '@/features/recs/CandidateScreen';

// 화면 ID 10 상대 프로필(F5). 본문은 features/recs/CandidateScreen.tsx
// F21: 09 카드 사진이 10 큰 사진으로 이어 붙는 덮개(motion/PhotoHandoff)가 자리를 재야 해서, 10 은 옆으로 밀려 들어오지 않고 투명도로 들어온다
export default function CandidateRoute() {
  return (
    <>
      <Stack.Screen options={{ animation: 'fade' }} />
      <CandidateScreen />
    </>
  );
}
