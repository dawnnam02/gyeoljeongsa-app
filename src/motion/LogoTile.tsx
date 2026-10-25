// 로고 타일(D31 · D25 용어 줄): A안 앱 아이콘 그림(assets/icon/app-icon.png = 디자인/로고/최종/결정사_앱아이콘_1024.png)을 모서리 22.5% 로 둥글게 잘라 쓴다.
//  2안 '지면'(D42-M · 명세 6장 A안): 타일은 '찍히지' 않고 잉크가 번지듯 원이 가운데서 퍼지며 드러난다(InkTile). 튕김 · 기울기 · 퍼지는 고리는 지웠다.
//   방법 A: 지름 = 타일 대각선인 둥근 틀(overflow hidden)을 scale 0.02 → 1 로 키우고, 안쪽 타일은 1/s 로 크기를 지킨다. 새 의존성 0 · transform 만.
//   둥근 잘림 비용 때문에 번지는 동안에만 renderToHardwareTextureAndroid 를 켠다(명세 9장). 안드로이드에서 원 가장자리가 계단처럼 보이면 B(MaskedView, 설치 승인 필요)로.
//  쓰는 곳: 스플래시 104 · 공개 72 · 탑승권 도장 52 · (v4) 서로 수락 · 구매 완료 48
//  동작 줄이기: 투명도만 150ms
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/lib/reduceMotion';
import { LOGO_TILE_RADIUS, scene2 } from '@/theme/motion';
import { colors } from '@/theme/tokens';
import { BRAND } from '@/theme/uiAssets';

import { curve, fadeIn } from './primitives';

type TileProps = { size: number; style?: StyleProp<ViewStyle>; testID?: string };

export function LogoTile({ size, style, testID }: TileProps) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * LOGO_TILE_RADIUS }, styles.clip, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <Image source={BRAND.tile} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

// 잉크 번짐으로 드러나는 로고 타일. delay 뒤 duration(기본 탑승권 560) 동안, play=false 면 처음부터 놓여 있다
export function InkTile({ size, delay = 0, duration = scene2.ticket.stamp, play = true, style, testID }: TileProps & { delay?: number; duration?: number; play?: boolean }) {
  const reduce = useReduceMotion();
  const move = play && !reduce;
  const from = scene2.ink.from;
  const s = useSharedValue(move ? from : 1); // 둥근 틀의 크기
  const o = useSharedValue(play && reduce ? 0 : 1); // 동작 줄이기 때 투명도
  const [busy, setBusy] = useState(move);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      s.set(1);
      fadeIn(o);
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setBusy)(false);
    };
    s.set(withDelay(delay, withTiming(1, { duration, easing: curve('edOut') }, done)));
  }, [play, reduce, delay, duration, s, o]);
  const diameter = Math.ceil(size * Math.SQRT2); // 타일 대각선 — 다 퍼지면 모서리까지 덮는다
  const offset = (size - diameter) / 2;
  const circle = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ scale: 1 / Math.max(s.get(), from) }] }));
  return (
    <View style={[{ width: size, height: size }, style]} testID={testID}>
      <Animated.View
        renderToHardwareTextureAndroid={busy && move}
        style={[styles.circle, { width: diameter, height: diameter, borderRadius: diameter / 2, left: offset, top: offset }, circle]}>
        {/* 타일의 가운데 = 둥근 틀의 가운데라 역배율도 가운데 기준 */}
        <Animated.View style={[{ position: 'absolute', left: -offset, top: -offset, width: size, height: size }, inner]}>
          <LogoTile size={size} testID={testID ? `${testID}-tile` : undefined} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// 옛 이름(찍히는 타일)을 쓰던 v4 화면(서로 수락 · 사전 오픈 · 구매 완료)도 같은 잉크 번짐으로 나타난다
export const StampTile = InkTile;

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', backgroundColor: colors.accent },
  fill: { width: '100%', height: '100%' },
  circle: { position: 'absolute', overflow: 'hidden' },
});
