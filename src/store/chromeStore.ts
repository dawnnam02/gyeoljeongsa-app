// 탭바를 잠깐 숨기는 표시 하나(F13). 16 상점의 하위 쪽(16-2 상품 상세 · 16-G1~G4 등급 · 16-8 이용권 · 16-10 안내 · 16-12 관리)은
// 08 처럼 탭 위에 열려서 탭바와 원형 프로필 사진이 없다(수익/상점_화면.md 1 · 7장). 탭 화면은 라우트가 하나(/shop)라서 쪽이 열려 있는 동안만 이 표시를 켠다.
// 표시를 켠 화면이 사라지면(탭을 떠나거나 닫히면) 반드시 끈다 — useHideTabBar 가 한다.
import { useEffect } from 'react';
import { create } from 'zustand';

type Chrome = { tabBarHidden: boolean };
export const useChromeStore = create<Chrome>(() => ({ tabBarHidden: false }));

export function useHideTabBar(hidden: boolean): void {
  useEffect(() => {
    useChromeStore.setState({ tabBarHidden: hidden });
    return () => useChromeStore.setState({ tabBarHidden: false });
  }, [hidden]);
}
