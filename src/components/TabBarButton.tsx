// 탭바의 각 칸. react-navigation 기본 버튼(PlatformPressable) 대신 공통 Pressable 을 쓴다.
// (tabs)/_layout.tsx 의 tabBarButton 에 연결한다.
//  - 가이드 10-3: 탭 칸은 ripple 만 쓴다(크기 변화 없음). 원은 칸 가운데서 퍼지고 칸 밖으로 나가지 않는다.
//  - 가이드 5장 눌림: 눌린 동안 그 탭의 아이콘 · 라벨이 85%가 된다(칸 전체 불투명도로 한다: 칸에는 아이콘과 라벨뿐이다).
//  - 가이드 10-1: 현재 탭은 선택됨(aria-selected)으로 읽힌다. 활성 탭을 다시 눌러도 활성은 그대로다.
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';

import { useIsActiveTab } from '@/navigation/activeTab';
import type { TabIconName } from '@/theme/tabIcons';
import { alpha, space } from '@/theme/tokens';

import { Pressable } from './Pressable';

type Props = BottomTabBarButtonProps & { tab: TabIconName };

export function TabBarButton(props: Props) {
  const selected = useIsActiveTab(props.tab);
  return (
    <Pressable
      effect="ripple"
      style={({ pressed }) => [props.style, styles.cell, pressed ? styles.pressed : null]}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      testID={props.testID}
      role={props.role}
      aria-label={props['aria-label']}
      aria-selected={selected}>
      {props.children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 가이드 5장: 아이콘은 칸 위에서 8, 아래로 24 + 간격 4 + 라벨 18 = 54(칸 높이 56 안). react-navigation 기본 안 여백(5)을 이렇게 바꾼다
  cell: { paddingTop: space.s8, paddingBottom: 0, paddingHorizontal: 0 },
  pressed: { opacity: alpha.pressed },
});
