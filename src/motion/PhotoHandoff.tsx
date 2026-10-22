// 사진 이어 붙임 09 → 10(D25 10-4 · 10-7, D-94 '09 → 10 만', F21).
//  공유 요소 전환(Reanimated 실험 기능)은 쓰지 않는다. 앱 맨 위에 덮개 한 장(PhotoHandoffLayer)을 두고,
//  ① 09 카드를 누르면 그 사진 칸의 화면 위 자리를 재서 startHandoff → ② 10 의 큰 사진 자리가 그려지면 setHandoffTarget →
//  ③ 덮개가 카드 사진 자리에서 큰 사진 자리까지 위치 · 크기 · 모서리를 400(out)으로 옮긴 뒤 내려가고 10 의 진짜 사진이 보인다.
//  뒤로 가면 반대로 250(in). 사진이 없으면 같은 크기의 바탕색(accentSoft) 칸이 대신 간다. 비율이 달라 scale 로는 찌그러지므로
//  이 덮개 하나만 크기를 움직이는 예외(D25 6장). 동작 줄이기면 덮개를 쓰지 않는다(10 이 투명도로 나타남). 재기에 실패하면 이어 붙이지 않는다.
import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';

import { reduceMotionStore } from '@/lib/reduceMotion';
import { scene } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

import { curve } from './primitives';

export type Rect = { x: number; y: number; width: number; height: number };
type Phase = 'idle' | 'going' | 'arrived' | 'returning';
type Handoff = { phase: Phase; id: string | null; uri: string | null; from: Rect | null; to: Rect | null; fromRadius: number; toRadius: number };

const IDLE: Handoff = { phase: 'idle', id: null, uri: null, from: null, to: null, fromRadius: radius.sm, toRadius: radius.md };
export const useHandoffStore = create<Handoff>(() => IDLE);

const valid = (r: Rect | null): r is Rect => !!r && r.width > 0 && r.height > 0;

// ① 09: 카드 사진 칸의 자리와 사진 주소를 넘긴다(동작 줄이기 · 잴 수 없음이면 하지 않음)
export function startHandoff(id: string, uri: string | null, from: Rect | null): void {
  if (reduceMotionStore.get() || !valid(from)) {
    useHandoffStore.setState(IDLE);
    return;
  }
  useHandoffStore.setState({ ...IDLE, phase: 'going', id, uri, from });
}

// ② 10: 큰 사진 자리가 그려지면 도착 자리를 넘긴다(이어 붙이는 중일 때만)
export function setHandoffTarget(id: string, to: Rect | null): void {
  const s = useHandoffStore.getState();
  if (s.phase !== 'going' || s.id !== id || s.to) return;
  if (!valid(to)) {
    useHandoffStore.setState(IDLE);
    return;
  }
  useHandoffStore.setState({ to });
}

// 뒤로: 10 의 큰 사진 자리에서 09 카드 자리로 되돌아간다
export function returnHandoff(id: string, from: Rect | null): void {
  const s = useHandoffStore.getState();
  if (s.id !== id || !valid(s.from) || !valid(from) || reduceMotionStore.get()) {
    useHandoffStore.setState(IDLE);
    return;
  }
  useHandoffStore.setState({ phase: 'returning', to: s.from, from });
}

// 10 을 떠날 때 아직 도착하지 못한 이어 붙임은 버린다(다음에 다른 길로 10 을 열 때 사진이 숨지 않게)
export function cancelHandoff(id: string): void {
  const s = useHandoffStore.getState();
  if (s.id === id && s.phase === 'going') useHandoffStore.setState(IDLE);
}

// 10 이 진짜 사진을 숨길지(덮개가 오는 중)
export const useHandoffHidesPhoto = (id: string): boolean => useHandoffStore((s) => s.id === id && s.phase === 'going');
// 10 이 이어 붙임으로 들어왔는지(정보를 60ms 간격으로 띄울지)
export const useCameByHandoff = (id: string): boolean => useHandoffStore((s) => s.id === id && (s.phase === 'going' || s.phase === 'arrived'));

const finish = (to: Phase) => useHandoffStore.setState(to === 'idle' ? IDLE : { phase: to });

// ③ 앱 맨 위 덮개 하나(root _layout)
export function PhotoHandoffLayer() {
  const h = useHandoffStore();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const hh = useSharedValue(0);
  const r = useSharedValue<number>(radius.sm);
  const o = useSharedValue(0);
  const moving = (h.phase === 'going' && valid(h.to)) || h.phase === 'returning';

  useEffect(() => {
    if (!moving || !valid(h.from) || !valid(h.to)) {
      o.set(0);
      return;
    }
    const back = h.phase === 'returning';
    const duration = back ? scene.handoff.back : scene.handoff.photo;
    const easing = curve(back ? 'in' : 'out');
    x.set(h.from.x);
    y.set(h.from.y);
    w.set(h.from.width);
    hh.set(h.from.height);
    r.set(back ? h.toRadius : h.fromRadius);
    o.set(1);
    const cfg = { duration, easing };
    x.set(withTiming(h.to.x, cfg));
    y.set(withTiming(h.to.y, cfg));
    w.set(withTiming(h.to.width, cfg));
    r.set(withTiming(back ? h.fromRadius : h.toRadius, cfg));
    hh.set(
      withTiming(h.to.height, cfg, (done) => {
        if (done) runOnJS(finish)(back ? 'idle' : 'arrived');
      }),
    );
  }, [moving, h.phase, h.from, h.to, h.fromRadius, h.toRadius, x, y, w, hh, r, o]);

  const box = useAnimatedStyle(() => ({ left: x.get(), top: y.get(), width: w.get(), height: hh.get(), borderRadius: r.get(), opacity: o.get() }));
  if (!moving) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="photo-handoff">
      <Animated.View style={[styles.box, box]}>{h.uri ? <Image source={{ uri: h.uri }} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.accentSoft },
  fill: { width: '100%', height: '100%' },
});
