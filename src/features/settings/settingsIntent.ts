// 다른 화면에서 12 설정 안의 쪽을 바로 여는 길(3부-사 FB-015 · 화면_요구사항 12-5 '들어오는 곳': 12 줄 · T2 할 일 · 사전 오픈 단계표 할 일).
//  12 의 쪽(아는 분 피하기 등)은 라우트가 아니라 설정 화면 안의 쪽이라(라우트를 늘리지 않음) — 열 쪽을 여기 남기고 설정 탭으로 간 뒤,
//  설정 화면이 초점을 받을 때 한 번 꺼내 그 쪽을 연다. 기기 · 서버 저장 0(메모리 한 칸)
import type { Href } from 'expo-router';

import type { SettingsPage } from './settingsLogic';

let pending: Exclude<SettingsPage, 'list'> | null = null;

export const SETTINGS_HREF = '/settings' as Href;

// 열 쪽을 남기고 설정 탭으로 간다(navigate — 탭 이동)
export function openSettingsPage(router: { navigate: (href: Href) => void }, page: Exclude<SettingsPage, 'list'>): void {
  pending = page;
  router.navigate(SETTINGS_HREF);
}

// 설정 화면이 초점을 받을 때 한 번 꺼낸다(꺼내면 비움 — 다음에 탭을 누르면 목록부터)
export function takeSettingsPage(): Exclude<SettingsPage, 'list'> | null {
  const p = pending;
  pending = null;
  return p;
}
