// 탭바 아이콘(D42-C · 1안 실선 1.5, D-171 · 앱 적용 D-176). 그림은 공용 아이콘(components/Icon · iconPaths)의 이름으로 고른다.
//  켜진 탭 = 와인(accent) 선 + 닫힌 면 accentSoft + 라벨 Bold + 라벨 아래 20 × 3 막대 / 꺼진 탭 = sub 선 + 라벨 Regular(components/TabBarParts)
//  옛 PNG(assets/icons/tab/*, 반짝이 · 하트 임시 그림)는 지웠다. 아이콘을 바꾸면 이 표의 이름만 고친다.
import type { IconName } from '@/components/iconPaths';

export const TAB_ICONS = {
  boarding: 'boarding', // V5 탑승권
  chat: 'chat', // V5 채팅
  recommendations: 'recommend', // 옛 추천 탭(V5 숨김)
  likes: 'like', // 옛 호감 탭(V5 숨김)
  shop: 'shop', // 상점 탭(v4_shop 꺼짐 · 숨김)
  settings: 'settings',
} as const satisfies Record<string, IconName>;

export type TabIconName = keyof typeof TAB_ICONS;
