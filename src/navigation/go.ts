// 화면 이동 보조(앞으로 · 뒤로 · 상점 쪽 열기 · 연 화면으로 돌아가기). 이동 목적지는 navigation/flow.ts · resolve.ts · stage.ts 가 정하고, 여기는 '쌓는 방법'만 정한다.
import type { Href, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// 앞으로 나아가는 이동(진행 단계가 바뀐 뒤: 03 → 04 등): 지나온 화면(01 · 02 · 03)을 쌓아 두지 않고 갈아 끼운다.
// 뒤로가기로 이미 끝낸 동의 화면 같은 곳에 돌아오지 못하게 한다.
export function goForward(router: Router, href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

// 뒤로: 쌓인 화면이 있으면 한 칸 뒤로, 없으면(앱을 다시 켜서 바로 이 화면이 열린 경우) fallback 으로 갈아 끼운다.
export function goBackOr(router: Router, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

// 다른 화면이 16 상점의 쪽(상품 상세 · 이용권 · 구독 관리)을 바로 열 때(Q5A-14 · F18 N2). from 에 연 화면 ID 를 실어 보내 그 쪽의 ‹ 가 연 화면으로 돌아오게 한다.
export type ShopOpener = '10' | '12';
export type ShopPageRequest = { page: 'product'; key: string } | { page: 'inventory' | 'manage' };

export function openShopPage(router: Router, request: ShopPageRequest, opener: ShopOpener): void {
  router.navigate({ pathname: '/shop', params: { ...request, from: opener } });
}

export function shopOpenerOf(value: string | undefined): ShopOpener | null {
  return value === '10' || value === '12' ? value : null;
}

// 연 화면으로 돌아가기. 탭의 '뒤로'(router.back)는 쓰지 않는다 — 탭 묶음은 뒤로가기를 첫 탭(09)으로 보낸다(backBehavior initialRoute, Q6 N2).
//  12: 같은 탭 묶음 안의 설정 탭으로 간다.
//  10: 10 은 탭 묶음 밖(뿌리 스택) 화면이라, 10 이 연 상점은 뿌리 스택에 탭 묶음이 하나 더 쌓인 것이다 → 그 묶음을 스택에서 걷어 내면 10 이 다시 보인다.
//      주소로 바로 들어와 아래에 10 이 없으면(걷어 낼 것이 없으면) 상점 목록에 머문다.
export function backToShopOpener(router: Router, opener: ShopOpener): void {
  if (opener === '12') {
    router.navigate('/settings');
    return;
  }
  if (router.canDismiss()) router.dismiss();
}
