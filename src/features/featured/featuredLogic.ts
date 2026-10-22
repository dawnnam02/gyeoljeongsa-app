// [1] 오늘의 한 분 강조의 보기 규칙(순수 함수). 원본: 기획/K12_v4기능명세.md 2-1 · backend/S12_변경기록.md 4-2.
//  · 강조는 보기만 바꾼다(K12 1-07). 호감 · 넘기기 · 하루 3건 한도는 그대로이고, 앱은 강조를 계산하지도 순서를 바꾸지도 않는다
//  · 호감을 보냈거나 넘겼거나 연결된 카드는 강조 모양을 벗고 기존 모양(호감 보냄 · 넘김)이 된다. 자리는 맨 앞 그대로(화면이 튀지 않게)
//  · 강조 모양일 때만 칩이 최대 5개, 아니면 기존 카드 칩(최대 3개)
import type { FeaturedPick } from '@/lib/featuredApi';
import type { RecCard } from '@/lib/recsApi';

type CardState = Pick<RecCard, 'id' | 'liked' | 'passed' | 'connected'>;

export function featuredLook(pick: FeaturedPick | null, card: CardState): boolean {
  if (!pick || pick.candidateId !== card.id) return false;
  return !card.liked && !card.passed && !card.connected;
}

export function chipsFor(card: CardState & Pick<RecCard, 'reasons'>, pick: FeaturedPick | null): string[] {
  return pick && featuredLook(pick, card) ? pick.reasons : card.reasons;
}
