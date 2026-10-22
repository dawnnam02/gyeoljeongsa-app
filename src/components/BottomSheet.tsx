// 아래에서 올라오는 시트(Figma 16-3 · 16-5 · 16-G5 · 16-M · 11b, UI v2 D36 #16 · F21): 위 모서리 24 · 손잡이 36 × 4(터치 44) · 최대 90% · 뒤 덮개 text 40%.
// 움직임(D25 3장 · 10-4 '시트 끌어 닫기' · D-118): 열림 = 아래에서 400(out) 올라옴 + 덮개 투명도 · 닫힘 = 250(in) 내려감 뒤 사라짐.
//  손잡이 칸을 아래로 끌면 손을 따라 내려오고 덮개가 함께 옅어진다. 놓을 때 높이 40% 를 넘었거나 초당 800px 넘게 튕겼으면 닫히고, 아니면 제자리 —
//  둘 다 놓은 속도에서 출발하는 스프링(감쇠 1 · 체감 400). 닫힘 햅틱 없음(보여 주기만, D25 10-5).
//  동작 줄이기: 손을 따라가는 것은 그대로, 열림 · 닫힘 · 놓은 뒤는 투명도 150 만.
// 바깥을 누르거나 Android 뒤로가기를 하면 닫힘 요청(onClose)이 온다. dismissable=false 이면 닫히지 않는다(결제 확인 중처럼 끝날 때까지 기다리는 시트).
// visible 이 false 가 되면 내려가는 움직임이 끝난 뒤에 Modal 을 내린다(움직임이 바로 끝나는 환경에서는 바로).
import { useEffect, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { A11Y } from '@/content/copy';
import { curve, releaseSpring, scene, useReduceMotion } from '@/motion';
import { withAlpha } from '@/theme/color';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { Pressable } from './Pressable';

type Props = {
  visible: boolean;
  onClose: () => void;
  dismissable?: boolean;
  children: ReactNode;
  testID?: string;
};

// 놓았을 때 닫을지(시험용으로 밖에 낸다): 높이의 40% 를 넘게 끌었거나 아래로 초당 800px 넘게 튕김
export function shouldDragClose(dy: number, height: number, velocityY: number): boolean {
  'worklet';
  if (height <= 0) return velocityY > scene.sheetDrag.closeVelocity;
  return dy > height * scene.sheetDrag.closeRatio || velocityY > scene.sheetDrag.closeVelocity;
}

export function BottomSheet({ visible, onClose, dismissable = true, children, testID }: Props) {
  const reduce = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true); // 열림 요청은 바로 그린다(렌더 중 맞춤)
  const [sheetHeight, setSheetHeight] = useState(0);
  const far = sheetHeight > 0 ? sheetHeight : windowHeight; // 시트가 숨는 자리(아래로 시트 높이만큼)
  const y = useSharedValue(reduce ? 0 : far);
  const shade = useSharedValue(0); // 덮개 · (줄이기에서) 시트 투명도

  const close = () => {
    if (dismissable) onClose();
  };

  useEffect(() => {
    const fade = { duration: scene.toast.out, easing: curve('std') };
    if (visible) {
      if (reduce) {
        y.set(0);
        shade.set(withTiming(1, fade));
      } else {
        shade.set(withTiming(1, { duration: scene.buy.sheetIn, easing: curve('out') }));
        y.set(withTiming(0, { duration: scene.buy.sheetIn, easing: curve('out') }));
      }
      return;
    }
    // 닫힘: 내려간(줄이기는 옅어진) 뒤 Modal 을 내린다
    const hide = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setMounted)(false);
    };
    if (reduce) shade.set(withTiming(0, fade, hide));
    else {
      shade.set(withTiming(0, { duration: scene.buy.sheetOut, easing: curve('in') }));
      y.set(withTiming(far, { duration: scene.buy.sheetOut, easing: curve('in') }, hide));
    }
  }, [visible, reduce, far, y, shade]);

  // 손잡이 칸 끌기(아래로만)
  const drag = Gesture.Pan()
    .activeOffsetY(space.s8)
    .onUpdate((e) => {
      const dy = Math.max(0, e.translationY);
      y.set(dy);
      if (far > 0) shade.set(1 - Math.min(1, dy / far));
    })
    .onEnd((e) => {
      const dy = Math.max(0, e.translationY);
      if (dismissable && shouldDragClose(dy, far, e.velocityY)) {
        runOnJS(onClose)();
        return;
      }
      if (reduce) {
        y.set(0);
        shade.set(1);
        return;
      }
      y.set(releaseSpring(0, e.velocityY));
      shade.set(releaseSpring(1));
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: shade.get() }));
  const sheetStyle = useAnimatedStyle(() => (reduce ? { opacity: shade.get(), transform: [{ translateY: y.get() }] } : { transform: [{ translateY: y.get() }] }));
  const onSheetLayout = (e: LayoutChangeEvent) => setSheetHeight(e.nativeEvent.layout.height);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} testID={testID}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />
        <Pressable accessibilityLabel={A11Y.close} onPress={close} effect="none" style={styles.scrimTap} testID={testID ? `${testID}-scrim` : undefined} />
        <Animated.View style={[styles.sheet, { maxHeight: windowHeight * 0.9 }, sheetStyle]} onLayout={onSheetLayout} accessibilityViewIsModal>
          <GestureDetector gesture={drag}>
            <View style={styles.grab} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID ? `${testID}-handle` : undefined}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          <ScrollView bounces={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: withAlpha(colors.text, alpha.dim) },
  scrimTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: size.screenPadding,
    paddingBottom: space.s12,
  },
  grab: { height: size.sheetHandleTouch, alignItems: 'center', justifyContent: 'center' },
  handle: { width: size.sheetHandleW, height: size.sheetHandleH, borderRadius: radius.pill, backgroundColor: colors.line },
  body: { gap: space.s12, paddingBottom: space.s12 },
});
