// 칩 4종(F9 색 v2, 브랜드색_v2 2장). 높이 32(minHeight, 글자를 키우면 늘어남) · pill · 글자 13 Medium.
//  selected : accentSoft 채움 + accent 1px 선 + 체크 + accent 글자(v2 D36 #11 — 색만으로 구분하지 않게 체크)   tag : accentSoft 채움 + accent 글자(누르지 않는다)
//  inactive : bg 채움 + line 1px 선 + sub 글자
//  tab      : 화면 안 탭 칸(11 호감 '보낸 호감 · 받은 호감 · 연결됨', 팀장 결정 10-15). 고르지 않음 = card 면 · text 글자 Medium, 고름(selected) = bg 면 · accent 선 · accent 글자 Bold.
//             role tab · 선택 상태를 스크린리더에 알리고, 누르면 카드처럼 작아진다(scale)
// onPress 가 있으면 공통 Pressable 로 누르고, 터치 영역은 높이 48(안의 칩은 32)다.
// 움직임(2안 '지면' D42-M 명세 4-1 chip · 5-4): 누르는 selected ↔ inactive 칩은 바탕 · 테두리 · 글자 색이 150 std 로 바뀌고(interpolateColor),
//  체크는 켤 때 150 std · 끌 때 120 in 투명도. 좌우 여백을 '체크 자리'만큼 똑같이 두고 체크는 왼쪽 여백 안에 겹쳐 나타나, 고를 때 폭이 변하지 않고 꺼진 칩도 글자가 가운데다(D-179). 색 변화는 움직임이 아니라 동작 줄이기여도 같다
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { curve, scene2 } from '@/motion';

import { colors, radius, size, space, type } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';

export type ChipVariant = 'selected' | 'tag' | 'inactive' | 'tab';

// lead: 글자 앞 아이콘 16 · accent(D43 A13 · A14 — 08 알약 '인증 대기' · '사진 확인 중'). 체크가 보이는 고른 칩에서는 그리지 않는다
type Props = { label: string; variant?: ChipVariant; selected?: boolean; lead?: IconName; onPress?: () => void; accessibilityLabel?: string; testID?: string };

export function Chip({ label, variant = 'tag', selected = false, lead, onPress, accessibilityLabel, testID }: Props) {
  const tab = variant === 'tab';
  const look = tab ? (selected ? variantStyle.tabOn : variantStyle.tab) : variantStyle[variant];
  const checked = !tab && variant === 'selected';
  const body = (
    <View style={[styles.chip, look, checked && styles.withCheck]} testID={onPress ? undefined : testID}>
      {checked ? <Icon name="check" size={space.s16} color={colors.accent} testID={testID ? `${testID}-check` : undefined} /> : null}
      {lead && !checked ? <Icon name={lead} size={space.s16} color={colors.accent} testID={testID ? `${testID}-lead` : undefined} /> : null}
      <AppText variant={tab && selected ? 'captionBold' : 'captionMedium'} tone={tab ? (selected ? 'accent' : 'text') : variant === 'inactive' ? 'sub' : 'accent'}>
        {label}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  if (variant === 'selected' || variant === 'inactive') {
    return (
      <Pressable accessibilityLabel={accessibilityLabel ?? label} aria-selected={variant === 'selected'} onPress={onPress} effect="none" testID={testID} style={styles.touch}>
        <PickChip label={label} on={variant === 'selected'} testID={testID} />
      </Pressable>
    );
  }
  if (tab) {
    return (
      <Pressable accessibilityRole="tab" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected }} aria-selected={selected} onPress={onPress} effect="scale" scaleTo="button" testID={testID} style={styles.touch}>
        {body}
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} effect="none" testID={testID} style={styles.touch}>
      {body}
    </Pressable>
  );
}

// 고를 수 있는 칩: 끔(inactive) ↔ 켬(selected) 색이 150 으로 바뀐다
function PickChip({ label, on, testID }: { label: string; on: boolean; testID?: string }) {
  const p = useSharedValue(on ? 1 : 0);
  const c = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(on ? 1 : 0, { duration: scene2.chip.color, easing: curve('std') }));
    c.set(withTiming(on ? 1 : 0, on ? { duration: scene2.chip.checkOn, easing: curve('std') } : { duration: scene2.chip.checkOff, easing: curve('in') }));
  }, [on, p, c]);
  // 멈춰 있을 때는 토큰 색 그대로(가운데에서만 섞은 색)
  const face = useAnimatedStyle(() => {
    const v = p.get();
    if (v <= 0) return { backgroundColor: colors.bg, borderColor: colors.line };
    if (v >= 1) return { backgroundColor: colors.accentSoft, borderColor: colors.accent };
    return { backgroundColor: interpolateColor(v, [0, 1], [colors.bg, colors.accentSoft]), borderColor: interpolateColor(v, [0, 1], [colors.line, colors.accent]) };
  });
  const ink = useAnimatedStyle(() => {
    const v = p.get();
    return { color: v <= 0 ? colors.sub : v >= 1 ? colors.accent : interpolateColor(v, [0, 1], [colors.sub, colors.accent]) };
  });
  const check = useAnimatedStyle(() => ({ opacity: c.get() }));
  return (
    <Animated.View style={[styles.chip, styles.pick, face]}>
      <Animated.View style={[styles.pickCheck, check]}>
        <Icon name="check" size={space.s16} color={colors.accent} testID={on && testID ? `${testID}-check` : undefined} />
      </Animated.View>
      <Animated.Text style={[type.captionMedium, ink]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 고를 수 있는 칩: 좌우 여백 = 왼쪽 8 + 체크 16 + 4(같은 값을 오른쪽에도) → 글자는 늘 가운데, 체크는 왼쪽 여백 안 8 자리에 겹친다
  pick: { borderWidth: 1, paddingHorizontal: space.s8 + space.s16 + space.s4, alignItems: 'center' },
  pickCheck: { position: 'absolute', left: space.s8, top: 0, bottom: 0, justifyContent: 'center' },
  touch: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
  chip: { minHeight: size.chip, borderRadius: radius.pill, paddingHorizontal: space.s12, justifyContent: 'center', alignSelf: 'flex-start' },
  withCheck: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingLeft: space.s8 },
});

const variantStyle = StyleSheet.create({
  selected: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  tabOn: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.accent },
  tag: { backgroundColor: colors.accentSoft },
  inactive: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  tab: { backgroundColor: colors.card },
});
