// 정치성향 끌기 막대 부품(W8, 결정 #15 · 청사진_v5 4-3). 왼쪽 ~ 오른쪽 연속값 0~100, 가운데 가능.
//  · 손가락 · 마우스: 막대 어디든 눌러 놓고 끌면 따라온다(RN 응답자 — 새 패키지 0)
//  · 키보드(웹): ← ↓ 조금 왼쪽 · → ↑ 조금 오른쪽 · PageUp/PageDown 크게 · Home 왼쪽 끝 · End 오른쪽 끝. 값이 없을 때 첫 키는 가운데에 놓는다
//  · 스크린리더: 역할 adjustable(웹 slider) · 올리기/내리기 동작 · 값은 말(진보 쪽 · 가운데 …)로 읽는다
//  · 화면에는 숫자 · 칸 · 눈금을 그리지 않는다. 채움 막대도 없다(한쪽이 '더 많다'로 읽히지 않게) — 손잡이 하나만
//  · 글자 입력이 아니라 한글 입력 규칙(imeText)과 무관하다
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View, type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, size, space } from '@/theme/tokens';

import { bandOf, clampScore } from './politics';
import { POL } from './politicsCopy';

export const POL_STEP = 5; // 화살표 한 번
export const POL_BIG_STEP = 20; // PageUp/PageDown
const THUMB = 28;

export const politicsWords = (v: number | null) => (v === null ? POL.unset : POL.where[bandOf(v) - 1]);

// 키 → 다음 값(시험용으로 따로 둔다). 모르는 키는 null
export function keyStep(key: string, v: number | null): number | null {
  const base = v ?? 50;
  if (v === null && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(key)) return 50;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return clampScore(base - POL_STEP);
    case 'ArrowRight':
    case 'ArrowUp':
      return clampScore(base + POL_STEP);
    case 'PageDown':
      return clampScore(base - POL_BIG_STEP);
    case 'PageUp':
      return clampScore(base + POL_BIG_STEP);
    case 'Home':
      return 0;
    case 'End':
      return 100;
    default:
      return null;
  }
}

type Props = { value: number | null; onChange: (v: number) => void; disabled?: boolean; testID?: string };

export function PoliticsSlider({ value, onChange, disabled = false, testID = 'pol-slider' }: Props) {
  const [width, setWidth] = useState(0);
  const start = useRef({ loc: 0, page: 0 }); // 누른 곳(막대 안 x · 화면 x) — 손을 움직이는 동안만 쓴다

  const put = (x: number) => {
    if (width > 0 && !disabled) onChange(clampScore((x / width) * 100));
  };
  // RN 기본 응답자(새 패키지 0): 막대를 누르면 그 자리로, 끌면 따라온다. 가로로 끄는 동안 위 스크롤에 넘기지 않는다
  const touch = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      start.current = { loc: e.nativeEvent.locationX, page: e.nativeEvent.pageX };
      put(start.current.loc);
    },
    onResponderMove: (e: GestureResponderEvent) => put(start.current.loc + (e.nativeEvent.pageX - start.current.page)),
  };

  const step = (key: string) => {
    if (disabled) return false;
    const next = keyStep(key, value);
    if (next === null) return false;
    onChange(next);
    return true;
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') step('ArrowRight');
    else if (e.nativeEvent.actionName === 'decrement') step('ArrowLeft');
  };
  // RN 타입에 없는 웹 키보드 속성(react-native-web 이 넘겨 준다)
  const webKeys =
    Platform.OS === 'web'
      ? {
          focusable: !disabled,
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            if (step(e.key)) e.preventDefault();
          },
        }
      : {};

  const words = politicsWords(value);
  return (
    <View style={styles.wrap} testID={testID}>
      <View
        {...webKeys}
        {...touch}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={POL.sliderLabel}
        accessibilityHint={POL.sliderHint}
        accessibilityValue={{ min: 0, max: 100, now: value ?? undefined, text: words }}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={words}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.touch, disabled && styles.off]}
        testID={`${testID}-track`}
      >
        <View style={styles.line} pointerEvents="none" />
        {value !== null ? <View pointerEvents="none" style={[styles.thumb, { left: `${value}%` }]} testID={`${testID}-thumb`} /> : null}
      </View>
      <View style={styles.ends} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText variant="captionMedium" tone="text">
          {POL.left}
        </AppText>
        <AppText variant="captionMedium" tone="text">
          {POL.right}
        </AppText>
      </View>
      {value === null ? (
        <AppText variant="caption" tone="sub" testID={`${testID}-unset`}>
          {POL.unset}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s8, alignSelf: 'stretch' },
  touch: { height: size.touchMin, justifyContent: 'center', position: 'relative' },
  off: { opacity: 0.4 },
  line: { height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.line },
  thumb: { position: 'absolute', top: (size.touchMin - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: radius.pill, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg, transform: [{ translateX: -THUMB / 2 }] },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
});
