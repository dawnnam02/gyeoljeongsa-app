// 지금 보이는 화면이 어느 탭의 화면인가. 탭바에서 '현재 탭'을 정하는 기준이다(가이드 10-1: 활성 탭은 한 번에 1개).
// 13 추천 없음은 09 추천 탭, 14 호감 없음은 11 호감 탭이 켜진다. 13 · 14 는 탭 칸이 없는 숨은 화면이라
// react-navigation 의 focused 만 믿으면 이 두 화면에서 켜진 탭이 하나도 없게 된다. 그래서 주소로 정한다.
import { usePathname } from 'expo-router';

import { SCREENS, screenById, TAB_SCREEN_IDS, type ScreenId } from './screens';

const tabIds: readonly ScreenId[] = TAB_SCREEN_IDS;

// 주소(그룹 (tabs) 는 빠진 꼴, 예 /likes-empty)에서 켜질 탭의 주소(예 /likes)를 돌려준다. 탭 화면이 아니면 null.
export function tabRouteOf(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  const screen = SCREENS.find((s) => s.route === path);
  if (!screen) return null;
  const owner = screen.stateOf ? screenById(screen.stateOf) : screen;
  return tabIds.includes(owner.id) ? owner.route : null;
}

// tabName 은 탭 주소에서 / 를 뺀 이름(recommendations · likes · shop · settings)
export function useIsActiveTab(tabName: string): boolean {
  return tabRouteOf(usePathname()) === `/${tabName}`;
}
