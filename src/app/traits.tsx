import { TraitsScreen } from '@/features/ai/TraitsScreen';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

// 화면 ID 07 내 성향(F3). 본문은 features/ai/TraitsScreen.tsx
//  3부-자: 스위치 type_card 가 켜져 있으면 확정 끝에 [내 여행 타입 보기] 입구(정책 PF-33)
export default function TraitsRoute() {
  const { isOn } = useFeatureFlags();
  return <TraitsScreen typeOn={isOn('type_card')} />;
}
