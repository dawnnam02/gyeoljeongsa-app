import { PrelaunchTabGate } from '@/features/prelaunch/PrelaunchGate';
import { ShopScreen } from '@/features/shop/ShopScreen';
import { V4Gate } from '@/navigation/v5Hide';

// 화면 ID 16 상점(F11). 본문은 features/shop/ShopScreen.tsx. 지금은 무료 '내 성향 리포트' 카드 하나 — 상품 목록 · 등급은 F13
// F22(K20 4-5 · D-123): 출시일 09:00 전(사전 오픈)에는 같은 자리에 '상점은 {날짜}에 열려요' · 16-G 첫 계산 한 줄(features/prelaunch). 상품 목록 0
// V5(W10 · D-152): 스위치 v4_shop 가 꺼져 있으면 그리지 않고 V5_HOME 으로(navigation/v5Hide). 코드는 그대로
export default function ShopRoute() {
  return (
    <V4Gate screen="shop">
      <PrelaunchTabGate kind="shop">
        <ShopScreen />
      </PrelaunchTabGate>
    </V4Gate>
  );
}
