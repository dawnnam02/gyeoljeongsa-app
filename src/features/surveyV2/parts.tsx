// 설문 v2 화면 안 작은 부품(F20). 공통 부품(components/)에 없는 모양만 여기서 만들었다 — 'F21로 옮길 것'(app/F20_변경기록.md).
//  OptionRow   : 하나 고르기 · 구간 한 줄(D35 4장: 높이 52 · 구간 48 · 둥글기 12 · card / 고름 = bg + accent 선 + 체크)
//  OptionChip  : 여러 개 · 상위 3개 칩(꺼짐 0.4 · 고른 차례 번호 원)
//  Stepper     : [−] 값 [+] (키 · 나이 차 · 키 범위, 터치 48)
//  PublicToggle: 결혼관 '내 프로필에 보이기' 스위치 줄(처음 꺼짐)
//  QuestionHead: 질문 · 도움말 · 공개 범위 줄 · 자물쇠 · AI 미전송 줄
// 색 · 간격 · 글자는 토큰만, 누름은 공통 Pressable 만 쓴다.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { haptic } from '@/motion';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { PROPOSED } from './copy';

type RowProps = { label: string; selected: boolean; dense?: boolean; disabled?: boolean; onPress: () => void; testID?: string };

export function OptionRow({ label, selected, dense = false, disabled = false, onPress, testID }: RowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      disabled={disabled}
      effect="scale"
      onPress={() => {
        haptic.selection(); // 설문 선택지 고름(D25 4장)
        onPress();
      }}
      testID={testID}
      style={[styles.row, dense ? styles.rowDense : null, selected ? styles.rowOn : null, disabled ? styles.off : null]}>
      <AppText variant="body" tone="text" style={styles.rowText}>
        {label}
      </AppText>
      {selected ? <Icon name="check" size={layout.headerIcon} color={colors.accent} /> : null}
    </Pressable>
  );
}

type ChipProps = { label: string; selected: boolean; disabled?: boolean; order?: number | null; accessibilityLabel?: string; onPress: () => void; testID?: string };

export function OptionChip({ label, selected, disabled = false, order = null, accessibilityLabel, onPress, testID }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      effect="none"
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      testID={testID}
      style={styles.chipTouch}>
      <View style={[styles.chip, selected ? styles.chipOn : null, disabled ? styles.off : null]}>
        {order !== null ? (
          <View style={styles.order}>
            <AppText variant="captionBold" tone="inverse">
              {String(order)}
            </AppText>
          </View>
        ) : selected ? (
          <Icon name="check" size={space.s16} color={colors.accent} />
        ) : null}
        <AppText variant="captionMedium" tone={selected ? 'accent' : 'text'}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

type StepperProps = { label: string; stepLabel: string; text: string; unit?: string; min: number; max: number; start: number; disabled?: boolean; onChange: (text: string) => void; testID: string };

// 값 칸에 바로 쳐도 되고 [−][+]로 1씩 움직여도 된다. 빈 칸에서 처음 누르면 start 에서 시작한다(미리 고른 값 없음)
export function Stepper({ label, stepLabel, text, unit, min, max, start, disabled = false, onChange, testID }: StepperProps) {
  const n = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
  const bump = (delta: number) => {
    const base = n === null ? start : Math.min(max, Math.max(min, n + delta));
    onChange(String(base));
  };
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel={PROPOSED.minusA11y(stepLabel)} disabled={disabled || (n !== null && n <= min)} effect="scale" scaleTo="button" onPress={() => bump(-1)} testID={`${testID}-minus`} style={[styles.round, disabled ? styles.off : null]}>
        <Icon name="minus" size={layout.headerIcon} />
      </Pressable>
      <View style={styles.valueField}>
        <TextField
          label={label}
          value={text}
          onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, String(max).length))}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={String(max).length}
          disabled={disabled}
          testID={testID}
        />
      </View>
      {unit ? <AppText variant="body">{unit}</AppText> : null}
      <Pressable accessibilityLabel={PROPOSED.plusA11y(stepLabel)} disabled={disabled || (n !== null && n >= max)} effect="scale" scaleTo="button" onPress={() => bump(1)} testID={`${testID}-plus`} style={[styles.round, disabled ? styles.off : null]}>
        <Icon name="plus" size={layout.headerIcon} />
      </Pressable>
    </View>
  );
}

type ToggleProps = { label: string; on: boolean; onPress: () => void; preview?: ReactNode; testID: string };

export function PublicToggle({ label, on, onPress, preview, testID }: ToggleProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <View style={styles.toggleWrap}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: on }}
        aria-checked={on}
        effect="none"
        onPress={() => {
          haptic.selection();
          onPress();
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
        style={styles.toggleRow}>
        <AppText variant="bodyMedium" style={styles.rowText}>
          {label}
        </AppText>
        <Toggle on={on} pressed={pressed} testID={`${testID}-switch`} />
      </Pressable>
      {on && preview ? preview : null}
    </View>
  );
}

type HeadProps = { question: string; help?: string; lines: readonly { text: string; tone?: 'sub' | 'accent'; testID?: string }[]; testID?: string };

export function QuestionHead({ question, help, lines, testID }: HeadProps) {
  return (
    <View style={styles.head} testID={testID}>
      <AppText variant="title" accessibilityRole="header" testID="v2-question">
        {question}
      </AppText>
      {help ? (
        <AppText variant="caption" tone="text" testID="v2-help">
          {help}
        </AppText>
      ) : null}
      {lines.map((l) => (
        <AppText key={l.text} variant="caption" tone={l.tone ?? 'sub'} testID={l.testID}>
          {l.text}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: size.input,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: layout.inputBorder,
    borderColor: colors.card,
    paddingLeft: space.s16,
    paddingRight: space.s12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s8,
  },
  rowDense: { minHeight: size.touchMin },
  rowOn: { backgroundColor: colors.bg, borderColor: colors.accent, borderWidth: layout.inputBorderActive },
  rowText: { flex: 1, minWidth: 0 },
  off: { opacity: alpha.disabled },
  chipTouch: { minHeight: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
  chip: {
    minHeight: size.chip,
    borderRadius: radius.pill,
    paddingHorizontal: space.s12,
    backgroundColor: colors.card,
    borderWidth: layout.inputBorder,
    borderColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
  },
  chipOn: { backgroundColor: colors.bg, borderColor: colors.accent, borderWidth: layout.inputBorderActive },
  order: { width: space.s20, height: space.s20, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  round: { width: size.touchMin, height: size.touchMin, borderRadius: radius.pill, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  valueField: { flex: 1, minWidth: 0 },
  toggleWrap: { gap: space.s8 },
  toggleRow: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, borderTopWidth: 1, borderTopColor: colors.line },
  head: { gap: space.s8 },
});
