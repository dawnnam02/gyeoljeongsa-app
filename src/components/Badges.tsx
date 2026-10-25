// UI v2 작은 부품(D36 #9 · #14 · #15 · #18 · #19 · 가이드 4-4, F21)
//  IconButton    : 터치 48 · 보이는 원 40 · 아이콘 24 · 접근성 이름 필수. 버튼 v3 A안(D-141): 원 = 아이보리 면 + line 1 선 + 옅은 그림자, 눌리면 card 면 · 그림자 없음 · 0.92(2안 아이콘) + 1px
//  VerifiedBadge : accentSoft 알약 24 + 체크 + 보조 Medium 13 — 확인된 항목만. 확인된 것이 없으면 아무것도 그리지 않는다(D-96 · D-118 ⑧)
//  GlanceRow     : 한눈에 줄(나이 · 키 · 지역 · 결혼 시기, 나눔선). 값이 없는 칸은 빼고, 다 없으면 그리지 않는다
//  TimePill      : '다음 추천까지' 같은 기한 표시 알약(accentSoft · 보조 Medium · accent 글자). 재촉 아님 — 숫자를 굴리거나 깜빡이지 않는다
//  ResultView    : 결과 · 빈 화면 틀 — 그림 + 제목 20 + 설명 1~2줄 + 버튼 하나
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { buttonFace, shadowStyle } from '@/theme/buttonLook';
import { button, colors, radius, size, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';

export function IconButton({ icon, accessibilityLabel, onPress, testID, flip = false }: { icon: IconName; accessibilityLabel: string; onPress: () => void; testID?: string; flip?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      effect="scale"
      scaleTo="icon"
      pressShift={button.pressY}
      clip={false}
      testID={testID}
      style={styles.iconTouch}>
      <View style={[styles.iconCircle, pressed ? styles.iconCircleDown : shadowStyle('icon')]} testID={testID ? `${testID}-circle` : undefined}>
        <Icon name={icon} size={size.tabIcon} flip={flip} testID={testID ? `${testID}-icon` : undefined} />
      </View>
    </Pressable>
  );
}

export function VerifiedBadge({ labels, testID }: { labels: readonly string[]; testID?: string }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.badges} testID={testID}>
      {labels.map((label) => (
        <View key={label} style={styles.badge} testID={testID ? `${testID}-item` : undefined}>
          <Icon name="check" size={space.s16} color={colors.accent} />
          <AppText variant="captionMedium" tone="accent">
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function GlanceRow({ cells, testID }: { cells: readonly { label: string; value: string | null }[]; testID?: string }) {
  const shown = cells.filter((c): c is { label: string; value: string } => c.value !== null && c.value !== '');
  if (shown.length === 0) return null;
  return (
    <View style={styles.glance} testID={testID}>
      {shown.map((c, i) => (
        <View key={c.label} style={[styles.cell, i > 0 ? styles.cellLine : null]} accessible accessibilityLabel={`${c.label} ${c.value}`} testID={testID ? `${testID}-${i}` : undefined}>
          <AppText variant="caption">{c.label}</AppText>
          <AppText variant="bodyBold" numberOfLines={1}>
            {c.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function TimePill({ children, testID }: { children: string | null; testID?: string }) {
  if (!children) return null;
  return (
    <View style={styles.pill}>
      <AppText variant="captionMedium" tone="accent" testID={testID}>
        {children}
      </AppText>
    </View>
  );
}

export function ResultView({ art, title, body, action, testID }: { art?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; testID?: string }) {
  return (
    <View style={styles.result} testID={testID}>
      {art}
      <AppText variant="title" accessibilityRole="header" style={styles.center}>
        {title}
      </AppText>
      {body}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  iconTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  iconCircle: { width: size.iconButton, height: size.iconButton, borderRadius: radius.pill, backgroundColor: buttonFace.icon, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  iconCircleDown: { backgroundColor: buttonFace.iconPressed },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  badge: { minHeight: size.badge, flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s8, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  glance: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: space.s12 },
  cell: { flex: 1, alignItems: 'center', gap: space.s4, paddingHorizontal: space.s4 },
  cellLine: { borderLeftWidth: 1, borderLeftColor: colors.line },
  pill: { alignSelf: 'flex-start', minHeight: size.badge, justifyContent: 'center', paddingHorizontal: space.s12, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  result: { alignItems: 'stretch', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  center: { textAlign: 'center' },
});
