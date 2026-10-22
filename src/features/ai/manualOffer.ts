// 06 에서 07 로 넘기는 직접 입력 재료(서버가 실패 응답에 담아 준 5축 처음값 · 태그 후보). 기기에 저장하지 않는 메모리 값이다.
import type { ManualOffer } from '@/types/ai';

let offer: { resultId: string; value: ManualOffer | null } | null = null;

export const manualOfferStore = {
  set: (resultId: string, value: ManualOffer | null) => {
    offer = { resultId, value };
  },
  get: () => offer,
  clear: () => {
    offer = null;
  },
};
