// 기내 서비스 · 연애 기능 공통 부품(IF2-F): 아이콘 15(디자인 원본) · 원본 그림 · 끝줄 · 홈 블록 · 칸 · 시트 머리 · 기기 저장 표시 단추.
//  · 색 · 글자 · 간격 · 둥글기는 tokens 만(그림 색은 에셋 안) · 누르는 것은 공통 Pressable(터치 48+) · 숫자 · 배지 · 점 · '새' 0
//  · 꾸밈 그림은 스크린리더가 건너뛴다(글이 뜻을 말한다)
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';

import art from '../../../assets/illustrations/if2art.json';
import { AppText } from '@/components/AppText';
import { iconStroke } from '@/components/Icon';
import type { IconPart } from '@/components/iconPaths';
import { Pressable } from '@/components/Pressable';
import { if2Look } from '@/theme/if2Look';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { IF2_ICON_PATHS } from './if2IconPaths';
import { tx } from './if2Text';

export type If2IconName = keyof typeof IF2_ICON_PATHS;
export const IF2_ICON_NAMES = Object.keys(IF2_ICON_PATHS) as If2IconName[];

export function If2Icon({ name, size: s = if2Look.cellIcon, color = colors.text, on = false, testID }: { name: If2IconName; size?: number; color?: string; on?: boolean; testID?: string }) {
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={iconStroke(s)} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {(IF2_ICON_PATHS[name].parts as readonly IconPart[]).map((p, i) =>
        p.role === 'dot' ? <Path key={i} d={p.d} fill={color} stroke="none" /> : <Path key={i} d={p.d} fill={p.role === 'shape' && on ? colors.accentSoft : 'none'} />,
      )}
    </Svg>
  );
}

type ArtKey = Exclude<keyof typeof art, '원본' | 'tarot'>;
export const artXml = (key: ArtKey): string => art[key];
export const tarotXml = (no: number): string => art.tarot[no] ?? art.tarotBack;

// 원본 그림 한 장(비율 칸 · 꾸밈)
export function Art({ xml, width, height, testID }: { xml: string; width: number | `${number}%`; height?: number; testID?: string }) {
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
}

// 끝줄(정책 PF-04 · 법무 4-1): 본문과 같은 화면 · 접힘 밖
export function Footnote({ text, testID }: { text: string; testID?: string }) {
  return (
    <AppText variant="caption" style={styles.footnote} testID={testID}>
      {text}
    </AppText>
  );
}

// 홈 블록 하나(안 1 종이 칸): 머리 + 칸들. 읽기 이름 = '{블록 머리}, {칸 이름 차례}'(개수 0)
export function HomeBlock({ title, cellNames, children, testID }: { title: string; cellNames: readonly string[]; children: ReactNode; testID: string }) {
  return (
    <View style={styles.block} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="header" accessibilityLabel={tx('HOME.blockA11y', { '블록 머리': title, '칸 이름 차례': cellNames.join(', ') })} testID={`${testID}-title`}>
        {title}
      </AppText>
      <View style={styles.cells}>{children}</View>
    </View>
  );
}

// 블록 안 칸 하나(소품 + 이름 한 줄 + 한 줄) — 한 포커스 '칸 이름, 한 줄'(HOME.cellA11y). 누르면 화면 · 시트
export function HomeCell({ icon, name, line, onPress, testID }: { icon: If2IconName; name: string; line: string; onPress?: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={tx('HOME.cellA11y', { '칸 이름': name, '한 줄': line })}
      disabled={!onPress}
      onPress={onPress}
      effect="scale"
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
      testID={testID}>
      <If2Icon name={icon} color={colors.accent} />
      <AppText variant="bodyMedium" numberOfLines={2} testID={`${testID}-name`}>
        {name}
      </AppText>
      <AppText variant="caption" numberOfLines={3} testID={`${testID}-line`}>
        {line}
      </AppText>
    </Pressable>
  );
}

// 기기에만 남는 표시 단추('이야기 나눴어요' · '챙겼어요') — 켜짐은 상태 속성 · 개수 0
export function MarkButton({ label, a11y, on, onPress, testID }: { label: string; a11y: string; on: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={a11y} onPress={onPress} effect="scale" style={({ pressed }) => [styles.mark, on && styles.markOn, pressed && styles.pressed]} testID={testID}>
      <AppText variant="captionMedium" tone={on ? 'accent' : 'sub'}>
        {label}
      </AppText>
    </Pressable>
  );
}

// 시트 머리(제목 + 닫기 글자 버튼)
export function SheetHead({ title, closeLabel, onClose, testID }: { title: string; closeLabel: string; onClose: () => void; testID: string }) {
  return (
    <View style={styles.head}>
      <AppText variant="bodyBold" accessibilityRole="header" style={styles.flex} testID={`${testID}-title`}>
        {title}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} effect="none" style={({ pressed }) => [styles.close, pressed && styles.pressed]} testID={`${testID}-close`}>
        <AppText variant="bodyMedium" tone="accent">
          {closeLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

export const if2Styles = StyleSheet.create({
  gap: { gap: space.s12 },
  gapSmall: { gap: space.s8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  section: { gap: space.s8, paddingVertical: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  paper: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
  flex: { flex: 1 },
});

const styles = StyleSheet.create({
  footnote: { paddingTop: space.s8 },
  block: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s12 },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  cell: { flexGrow: 1, flexBasis: 0, minWidth: size.touchMin * 2, minHeight: if2Look.cellMinH, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s12, gap: space.s4 },
  pressed: { opacity: alpha.pressed },
  mark: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.s12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  markOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  close: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'flex-end' },
  flex: { flex: 1 },
});
