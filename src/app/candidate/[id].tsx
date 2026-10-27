import { Stack, useLocalSearchParams } from 'expo-router';

import { CandidateScreen } from '@/features/recs/CandidateScreen';
import { CandidateGate } from '@/navigation/v5Hide';

// 화면 ID 10 상대 프로필(F5). 본문은 features/recs/CandidateScreen.tsx
// F21: 09 카드 사진이 10 큰 사진으로 이어 붙는 덮개(motion/PhotoHandoff)가 자리를 재야 해서, 10 은 옆으로 밀려 들어오지 않고 투명도로 들어온다
// 3부-바(QP-01 후속): 공개 순간에서 온 길(from=reveal)은 늘 열고, 그 밖의 길은 v4 스위치(09 · 11) 하나라도 켜져 있을 때만(navigation/v5Hide CandidateGate)
export default function CandidateRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return (
    <>
      <Stack.Screen options={{ animation: 'fade' }} />
      <CandidateGate from={from}>
        <CandidateScreen />
      </CandidateGate>
    </>
  );
}
