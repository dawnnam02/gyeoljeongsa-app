// 탭바 한 칸의 아이콘과 라벨(가이드 5장 · 10-1 · D42-C 1안 '다' 켜짐 표시, D-171 · D-176).
//  현재 탭: 와인(accent) 선 + 닫힌 면 accentSoft + 라벨 Bold accent + 라벨 아래 20 × 3 막대(색을 못 가려도 면 · 막대 · 굵기로 알아본다)
//  나머지: sub 선 + 라벨 Regular sub. 선 굵기는 둘 다 1.5(components/Icon)
//  '현재'는 react-navigation 의 focused 가 아니라 주소로 정한다(13 · 14 에서도 추천 · 호감 탭이 켜지게, navigation/activeTab.ts).
import { StyleSheet, View } from 'react-native';

import { useIsActiveTab } from '@/navigation/activeTab';
import { TAB_ICONS, type TabIconName } from '@/theme/tabIcons';
import { colors, radius, size, space } from '@/theme/tokens';

import { AppText, HEADER_MAX_SCALE } from './AppText';
import { Icon } from './Icon';

// 켜진 탭 막대(1안 명세 20 × 3, 라벨 바로 아래)
const BAR_W = 20;
const BAR_H = 3;

export function TabIcon({ name }: { name: TabIconName }) {
  const active = useIsActiveTab(name);
  return (
    <View style={styles.icon}>
      <Icon name={TAB_ICONS[name]} size={size.tabIcon} color={active ? colors.accent : colors.sub} on={active} testID={`tab-icon-${name}`} />
    </View>
  );
}

export function TabLabel({ name, title }: { name: TabIconName; title: string }) {
  const active = useIsActiveTab(name);
  return (
    <View style={styles.labelWrap}>
      <AppText variant={active ? 'captionBold' : 'caption'} tone={active ? 'accent' : 'sub'} maxFontSizeMultiplier={HEADER_MAX_SCALE} style={styles.label}>
        {title}
      </AppText>
      {active ? <View style={styles.bar} pointerEvents="none" testID={`tab-bar-${name}`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: size.tabIcon, height: size.tabIcon },
  labelWrap: { alignItems: 'center' },
  label: { marginTop: space.s4 }, // 아이콘 – 라벨 간격 4(가이드 5장)
  // 칸 높이 56 안에 들게 라벨 줄(18)의 아래 여백에 겹쳐 둔다
  bar: { position: 'absolute', bottom: -BAR_H + 1, width: BAR_W, height: BAR_H, borderRadius: radius.pill, backgroundColor: colors.accent },
});
