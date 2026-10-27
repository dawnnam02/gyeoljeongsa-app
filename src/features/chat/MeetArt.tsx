// 만남 장면 그림(연출 ④ — 디자인 D46 원본 그대로, theme/meetArt 에셋). 부품마다 따로 그린 SVG(react-native-svg)를 장면 좌표 칸에 겹쳐 놓고,
//  움직임은 그 칸(RN View)의 transform · opacity 로만 한다(SVG 속성 움직임 · filter · blend 0). 시각은 공유 값 t 하나(meetTimeline).
//  · 층(디자인 6장 메모): 장면 전체 cam 1 → 1.1 · 빛 한 층(투명도) — 움직이는 층은 이 둘이고, 사람 부품(걷기 · 앉기 · 컵 · 시선)은 사람 층 안의 작은 칸
//  · still = 정지 그림(동작 줄이기 · 화면 읽기): 쉬는 모습(5.9초) 하나만 그리고 걸어오는 사람 칸은 두지 않는다
//  · 꾸밈 그림이라 스크린리더는 건너뛴다(장면 한 덩이 이름은 MeetScene 이 단다)
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { MEET_ART, MEET_FULL, type MeetBox, type MeetPlaceKey } from '@/theme/meetArt';
import { scene2 } from '@/theme/motion';

import { artIn, bobY, camScale, cupDeg, cupShift, legDeg, lightO, lookA, lookB, sitIn, standOut, walkX } from './meetTimeline';

const P = MEET_ART.parts;
const M = scene2.meet;
const CAM_ORIGIN = `${(P.cam.origin[0] / MEET_ART.W) * 100}% ${(P.cam.origin[1] / MEET_ART.H) * 100}%`;
const CUP_PIVOT = P.aCup.pivot ?? P.aCup.elbow;
const CUP_V = [CUP_PIVOT[0] - P.aCup.elbow[0], CUP_PIVOT[1] - P.aCup.elbow[1]] as const; // 손 - 팔꿈치(장면 좌표 15, 22)

type Props = { place: MeetPlaceKey; t: SharedValue<number>; width: number; still: boolean; testID?: string };

export function MeetArt({ place, t, width, still, testID }: Props) {
  const s = width / MEET_ART.W;
  const height = (width * MEET_ART.H) / MEET_ART.W;
  const art = MEET_ART.places[place];
  const cup = art.prop === 'book' ? MEET_ART.people.aCup_book : MEET_ART.people.aCup_cup;

  const artStyle = useAnimatedStyle(() => ({ opacity: artIn(t.get()) }));
  const camStyle = useAnimatedStyle(() => ({ transform: [{ scale: camScale(t.get()) }] }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: lightO(t.get()) }));
  const foreArm = useAnimatedStyle(() => ({ transform: [{ rotate: `${cupDeg(t.get())}deg` }] }));
  const cupStyle = useAnimatedStyle(() => {
    const [dx, dy] = cupShift(cupDeg(t.get()), CUP_V[0], CUP_V[1]);
    return { transform: [{ translateX: dx * s }, { translateY: dy * s }] };
  });
  const faceA = useAnimatedStyle(() => ({ transform: [{ translateX: P.aFace.turn * s * lookA(t.get()) }] }));
  const faceB = useAnimatedStyle(() => ({ transform: [{ translateX: P.bFace.turn * s * lookB(t.get()) }] }));
  const walker = useAnimatedStyle(() => {
    const out = standOut(t.get());
    return { opacity: 1 - out, transform: [{ translateX: walkX(t.get()) * s }, { translateY: M.standDrop * out * s }] };
  });
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: bobY(t.get()) * s }] }));
  const legL = useAnimatedStyle(() => ({ transform: [{ rotate: `${legDeg(t.get(), P.bLegL.swing)}deg` }] }));
  const legR = useAnimatedStyle(() => ({ transform: [{ rotate: `${legDeg(t.get(), P.bLegR.swing)}deg` }] }));
  const sitter = useAnimatedStyle(() => {
    const p = sitIn(t.get());
    return { opacity: p, transform: [{ translateY: -M.sitRise * (1 - p) * s }] };
  });

  return (
    <View style={[styles.box, { width, height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: CAM_ORIGIN }, camStyle]} testID={testID ? `${testID}-cam` : undefined}>
          <Layer xml={art.base} box={MEET_FULL} s={s} testID={testID ? `${testID}-base` : undefined} />
          <Layer xml={MEET_ART.people.aFore} box={P.aFore.box} s={s} style={foreArm} />
          <Layer xml={cup} box={P.aCup.box} s={s} style={cupStyle} />
          <Layer xml={MEET_ART.people.aFace} box={P.aFace.box} s={s} style={faceA} />
          {still ? null : (
            <Animated.View style={[StyleSheet.absoluteFill, walker]} testID={testID ? `${testID}-walker` : undefined}>
              <Animated.View style={[StyleSheet.absoluteFill, bob]}>
                <Layer xml={MEET_ART.people.bLegL} box={P.bLegL.box} s={s} style={legL} />
                <Layer xml={MEET_ART.people.bLegR} box={P.bLegR.box} s={s} style={legR} />
                <Layer xml={MEET_ART.people.bBody} box={P.bBody.box} s={s} />
              </Animated.View>
            </Animated.View>
          )}
          <Animated.View style={[StyleSheet.absoluteFill, sitter]} testID={testID ? `${testID}-sitter` : undefined}>
            <Layer xml={MEET_ART.people.bSit} box={P.bSit.box} s={s} />
            <Layer xml={MEET_ART.people.bFace} box={P.bFace.box} s={s} style={faceB} />
          </Animated.View>
          {art.fore ? <Layer xml={art.fore} box={MEET_FULL} s={s} /> : null}
        </Animated.View>
        <Layer xml={MEET_ART.light} box={MEET_FULL} s={s} style={lightStyle} />
      </Animated.View>
    </View>
  );
}

// 부품 한 칸: 장면 좌표 칸(x · y · 폭 · 높이)을 화면 px 로. 칸 가운데가 도는 축(팔꿈치 · 엉덩이)이 되게 에셋이 잘라 두었다
function Layer({ xml, box, s, style, testID }: { xml: string; box: MeetBox; s: number; style?: ComponentProps<typeof Animated.View>['style']; testID?: string }): ReactNode {
  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { left: box[0] * s, top: box[1] * s, width: box[2] * s, height: box[3] * s }, style]} testID={testID}>
      <SvgXml xml={xml} width="100%" height="100%" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignSelf: 'center' },
  layer: { position: 'absolute' },
});
