import { Tabs, type BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarButton } from '@/components/TabBarButton';
import { TabIcon, TabLabel } from '@/components/TabBarParts';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { useV4Screens } from '@/navigation/v5Hide';
import { useChromeStore } from '@/store/chromeStore';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { CHAT } from '@/features/chat/chatCopy';
import { TABS } from '@/content/copy';
import type { TabIconName } from '@/theme/tabIcons';
import { colors, size } from '@/theme/tokens';

// 탭바 4개: 추천 · 호감 · 상점 · 설정(K2 R6 · K7, 가이드 5장). 내 프로필(08)은 탭이 아니라 머리 오른쪽 위 원형 사진으로 들어가는 탭 밖 화면이다(app/profile.tsx).
// 현재 탭 = 채움 아이콘 + 라벨 Bold 브랜드색, 나머지 = 선형 회색 아이콘 + 라벨 Regular 회색(가이드 10-1, 본인 지시 2026-10-14).
// 아이콘 파일은 theme/tabIcons.ts 한 곳에서 바꾼다. 탭 한 칸도 버튼 · 카드와 같은 공통 Pressable 로 눌린다(TabBarButton).
function tabOptions(name: TabIconName, title: string): BottomTabNavigationOptions {
  return {
    title,
    tabBarAccessibilityLabel: title,
    tabBarIcon: () => <TabIcon name={name} />,
    tabBarIconStyle: { width: size.tabIcon, height: size.tabIcon }, // react-navigation 기본(31 × 28)을 가이드 5장의 24 × 24 로
    tabBarLabel: () => <TabLabel name={name} title={title} />,
    tabBarButton: (props) => <TabBarButton tab={name} {...props} />,
  };
}

// V5(W10 · D-152): 스위치로 숨긴 탭(추천 v4_daily_recs · 호감 v4_likes · 상점 v4_shop)은 칸을 만들지 않는다(href null). 새 탭(탑승권)은 앱 C 몫
const hidden = { href: null } as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  usePushRegistration(); // D-199: 스위치 chat_push 가 켜졌고 권한을 허락한 기기만 알림 토큰 등록(꺼짐이면 0)
  const v4 = useV4Screens(); // 읽기 전 · 못 읽으면 live 값(꺼짐)
  const tabBarHidden = useChromeStore((s) => s.tabBarHidden); // 16 상점의 하위 쪽이 열려 있는 동안 탭바를 숨긴다(F13, 08 처럼 탭 위에 열리는 쪽)
  return (
    <Tabs
      // 11 · 16 · 12 에서 Android 뒤로가기는 추천(09)으로, 09 에서는 앱을 백그라운드로(K2 4장 09 · 11 · 12 · 16 뒤로가기)
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabBarHidden ? { display: 'none' } : {
          // 윗선 1 + 본체 56 + 기기 하단 안전영역(가이드 5장, Figma P5). 칸의 위쪽 여백 8은 칸 안(TabBarButton)에서 줘서 터치 영역이 폭 × 56 이 된다
          minHeight: 1 + size.tabBar + insets.bottom, // 글자를 키우면 늘어난다(D22 13)
          paddingBottom: insets.bottom,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        },
        tabBarItemStyle: { minHeight: size.touchMin },
      }}>
      <Tabs.Screen name="boarding" options={tabOptions('boarding', BOARDING.headerTitle)} />
      {/* V5 W5(D-159): 채팅 탭 — 청사진 v5 초안 6-1 탭 순서 탑승권 · 채팅 · 설정 */}
      <Tabs.Screen name="chat" options={tabOptions('chat', CHAT.tabTitle)} />
      <Tabs.Screen name="recommendations" options={v4.dailyRecs ? tabOptions('recommendations', TABS.recommendations) : hidden} />
      <Tabs.Screen name="likes" options={v4.likes ? tabOptions('likes', TABS.likes) : hidden} />
      <Tabs.Screen name="shop" options={v4.shop ? tabOptions('shop', TABS.shop) : hidden} />
      <Tabs.Screen name="settings" options={tabOptions('settings', TABS.settings)} />
      {/* 13 추천 없음 · 14 호감 없음은 탭 화면의 상태라 탭바에 칸을 만들지 않는다(탭바는 보이고, 켜진 탭은 추천 · 호감이다) */}
      <Tabs.Screen name="recommendations-empty" options={{ href: null }} />
      <Tabs.Screen name="likes-empty" options={{ href: null }} />
    </Tabs>
  );
}
