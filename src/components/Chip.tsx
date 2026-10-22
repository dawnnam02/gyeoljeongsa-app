// 칩 4종(F9 색 v2, 브랜드색_v2 2장). 높이 32(minHeight, 글자를 키우면 늘어남) · pill · 글자 13 Medium.
//  selected : accentSoft 채움 + accent 1px 선 + 체크 + accent 글자(v2 D36 #11 — 색만으로 구분하지 않게 체크)   tag : accentSoft 채움 + accent 글자(누르지 않는다)
//  inactive : bg 채움 + line 1px 선 + sub 글자
//  tab      : 화면 안 탭 칸(11 호감 '보낸 호감 · 받은 호감 · 연결됨', 팀장 결정 10-15). 고르지 않음 = card 면 · text 글자 Medium, 고름(selected) = bg 면 · accent 선 · accent 글자 Bold.
//             role tab · 선택 상태를 스크린리더에 알리고, 누르면 카드처럼 작아진다(scale)
// onPress 가 있으면 공통 Pressable 로 누르고, 터치 영역은 높이 48(안의 칩은 32)다.
import { Image, StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '@/theme/tokens';
import { UI_ICONS } from '@/theme/uiAssets';

import { AppText } from './AppText';
import { Pressable } from './Pressable';

export type ChipVariant = 'selected' | 'tag' | 'inactive' | 'tab';

type Props = { label: string; variant?: ChipVariant; selected?: boolean; onPress?: () => void; accessibilityLabel?: string; testID?: string };

export function Chip({ label, variant = 'tag', selected = false, onPress, accessibilityLabel, testID }: Props) {
  const tab = variant === 'tab';
  const look = tab ? (selected ? variantStyle.tabOn : variantStyle.tab) : variantStyle[variant];
  const checked = !tab && variant === 'selected';
  const body = (
    <View style={[styles.chip, look, checked && styles.withCheck]} testID={onPress ? undefined : testID}>
      {checked ? <Image source={UI_ICONS.check} style={styles.check} tintColor={colors.accent} accessibilityIgnoresInvertColors testID={testID ? `${testID}-check` : undefined} /> : null}
      <AppText variant={tab && selected ? 'captionBold' : 'captionMedium'} tone={tab ? (selected ? 'accent' : 'text') : variant === 'inactive' ? 'sub' : 'accent'}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  if (tab) {
    return (
      <Pressable accessibilityRole="tab" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }} aria-selected={selected} onPress={onPress} effect="scale" scaleTo="button" testID={testID} style={styles.touch}>
        {body}
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityLabel={accessibilityLabel ?? label} aria-selected={variant === 'selected'} onPress={onPress} effect="none" testID={testID} style={styles.touch}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
  chip: { minHeight: size.chip, borderRadius: radius.pill, paddingHorizontal: space.s12, justifyContent: 'center', alignSelf: 'flex-start' },
  withCheck: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingLeft: space.s8 },
  check: { width: space.s16, height: space.s16 },
});

const variantStyle = StyleSheet.create({
  selected: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  tabOn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.accent },
  tag: { backgroundColor: colors.accentSoft },
  inactive: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  tab: { backgroundColor: colors.card },
});
