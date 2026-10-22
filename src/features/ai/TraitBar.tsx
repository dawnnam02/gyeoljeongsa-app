// 07 내 성향의 5축 막대. 보기 상태는 읽기만(TraitBar), 수정 · 직접 입력 상태는 끌어서 바꾼다(TraitSlider).
// 값은 0~100의 성향 위치이고 좋고 나쁨이 아니다(카피.md 07). 등급 · 점수 같은 말은 어디에도 쓰지 않는다.
import { useLayoutEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/components/AppText';
import { TRAITS } from '@/content/copy';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import { clampTrait, snapTrait, TRAIT_STEP } from './traitsLogic';

type BarProps = { name: string; value: number; testID?: string };

export function TraitBar({ name, value, testID }: BarProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={TRAITS.sliderValue(name, value)}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      testID={testID}>
      <AppText variant="bodyMedium" style={styles.name} numberOfLines={2}>
        {name}
      </AppText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%` }]} />
      </View>
      <AppText variant="captionMedium" style={styles.value} testID={testID ? `${testID}-value` : undefined}>
        {String(value)}
      </AppText>
    </View>
  );
}

type SliderProps = { name: string; value: number; onChange: (value: number) => void; testID: string };

// 끌어서(또는 막대를 눌러서) 바꾸는 막대. 5단위로 맞춰진다. 스크린리더는 올리기 · 내리기로 5씩 바꾼다.
export function TraitSlider({ name, value, onChange, testID }: SliderProps) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const latest = useRef({ value, onChange });
  useLayoutEffect(() => {
    latest.current = { value, onChange };
  });

  // 끌기 처리기는 눌렀을 때만 ref 를 읽는다(그리는 동안에는 읽지 않는다)
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const valueAt = (x: number) => (widthRef.current > 0 ? snapTrait((x / widthRef.current) * 100) : latest.current.value);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        startX.current = event.nativeEvent.locationX;
        latest.current.onChange(valueAt(startX.current));
      },
      onPanResponderMove: (_event, gesture) => latest.current.onChange(valueAt(startX.current + gesture.dx)),
    });
  });

  const onLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setWidth(event.nativeEvent.layout.width);
  };
  const thumbLeft = (width * value) / 100 - layout.sliderThumb / 2;

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHead}>
        <AppText variant="bodyMedium">{name}</AppText>
        <AppText variant="bodyBold" testID={`${testID}-value`}>
          {String(value)}
        </AppText>
      </View>
      <View
        style={styles.touch}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={name}
        accessibilityHint={TRAITS.sliderHint}
        accessibilityValue={{ min: 0, max: 100, now: value, text: String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const delta = event.nativeEvent.actionName === 'increment' ? TRAIT_STEP : event.nativeEvent.actionName === 'decrement' ? -TRAIT_STEP : 0;
          if (delta !== 0) onChange(clampTrait(value + delta));
        }}
        testID={testID}
        {...pan.panHandlers}>
        <View style={styles.sliderTrack} pointerEvents="none">
          <View style={[styles.fill, { width: `${value}%` }]} />
        </View>
        <View style={[styles.thumb, { left: thumbLeft }]} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: size.touchMin / 2 + space.s8, gap: space.s8 },
  name: { width: layout.traitNameMax, flexShrink: 1 },
  track: { flex: 1, height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.accent },
  sliderTrack: { height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  value: { width: layout.traitValueWidth, textAlign: 'right' },
  sliderBlock: { gap: space.s4 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  touch: { height: size.touchMin, justifyContent: 'center' },
  thumb: { position: 'absolute', top: (size.touchMin - layout.sliderThumb) / 2, width: layout.sliderThumb, height: layout.sliderThumb, borderRadius: radius.pill, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg },
});
