// 탭바 한 칸의 아이콘과 라벨(가이드 5장 · 10-1).
//  현재 탭: 채움 아이콘 + 라벨 Bold 브랜드색 + 아이콘 뒤 accentSoft 알약 56 × 28(v2 D36 #17 · 가이드 5장) / 나머지: 선형 회색 아이콘 + 라벨 Regular 회색
//  '현재'는 react-navigation 의 focused 가 아니라 주소로 정한다(13 · 14 에서도 추천 · 호감 탭이 켜지게, navigation/activeTab.ts).
import { Image, StyleSheet, View } from 'react-native';

import { useIsActiveTab } from '@/navigation/activeTab';
import { TAB_ICONS, type TabIconName } from '@/theme/tabIcons';
import { colors, radius, size, space } from '@/theme/tokens';

import { AppText, HEADER_MAX_SCALE } from './AppText';

export function TabIcon({ name }: { name: TabIconName }) {
  const active = useIsActiveTab(name);
  return (
    <View style={styles.icon}>
      {active ? <View style={styles.pill} pointerEvents="none" testID={`tab-pill-${name}`} /> : null}
      <Image source={active ? TAB_ICONS[name].active : TAB_ICONS[name].inactive} style={styles.icon} />
    </View>
  );
}

export function TabLabel({ name, title }: { name: TabIconName; title: string }) {
  const active = useIsActiveTab(name);
  return (
    <AppText variant={active ? 'captionBold' : 'caption'} tone={active ? 'accent' : 'sub'} maxFontSizeMultiplier={HEADER_MAX_SCALE} style={styles.label}>
      {title}
    </AppText>
  );
}

const styles = StyleSheet.create({
  icon: { width: size.tabIcon, height: size.tabIcon },
  pill: {
    position: 'absolute',
    width: size.tabIndicatorW,
    height: size.tabIndicatorH,
    left: (size.tabIcon - size.tabIndicatorW) / 2,
    top: (size.tabIcon - size.tabIndicatorH) / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  label: { marginTop: space.s4 }, // 아이콘 – 라벨 간격 4(가이드 5장)
});
