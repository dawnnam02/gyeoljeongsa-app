// 16 상점 안의 쪽(수익/상점_화면.md 1장 · 7-2): 목록 한 장 + 하위 쪽. 라우트는 /shop 하나이고 쪽은 이 화면 안에서 쌓는다(12 설정과 같은 방식).
//  하위 쪽이 열려 있는 동안 탭바와 원형 프로필 사진은 없다(08 처럼 탭 위에 열리는 쪽).
import type { AiApi } from '@/lib/aiApi';
import type { GradeApi } from '@/lib/gradeApi';
import type { ShopApi } from '@/lib/shopApi';

export type ShopPage =
  | { name: 'list' }
  | { name: 'product'; key: string } // 16-2 상품 상세
  | { name: 'grade' } // 16-G1 내 등급
  | { name: 'grade-history' } // 16-G2
  | { name: 'grade-goal' } // 16-G3
  | { name: 'grade-how' } // 16-G4
  | { name: 'inventory' } // 16-8 (+ 16-9 복원)
  | { name: 'refund' } // 16-10
  | { name: 'manage' } // 16-12
  | { name: 'report' }; // 16-1 내 성향 리포트

export type ShopDeps = {
  api: Pick<ShopApi, 'loadShop' | 'canPurchase' | 'demoPurchase' | 'matchPreview' | 'useMatchOnce' | 'endSubscription' | 'loadPurchases' | 'restorePurchases'>;
  grade: Pick<GradeApi, 'loadMine' | 'loadHistory' | 'requestAccess'>;
  ai?: Pick<AiApi, 'loadLatest'>; // 16-1 내 성향 리포트가 확정한 성향을 읽는다
  now: () => number;
  newId: () => string; // 요청 ID(같은 버튼의 재시도는 같은 ID)
  toastMs: number;
  slowMs: number; // 결제 확인이 이만큼 걸리면 '확인이 늦어지고 있어요'(NV17)
};

export type ShopNav = {
  push: (page: ShopPage) => void;
  back: () => void;
  toList: () => void;
};
