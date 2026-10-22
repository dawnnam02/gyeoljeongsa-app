// 서로 수락 순간(D25 장면 5 · Figma 11 연결됨 순간 408:471 · D31 로고 타일, F17).
//  순서 · 시간(theme/motion scene.match): 두 사람의 원이 양옆에서 가까워짐(400 out) → 450ms 에 로고 타일이 찍힘(700) → 750ms 에 글(250) → 2200ms 머문 뒤 걷힘(250) → onDone.
//  바탕은 bgGrad 높이 460(Backdrop connected). 폭죽 · 소리 없음. 햅틱은 수락이 끝난 때 Success 한 번(부르는 쪽).
//  글은 카피 그대로(LIKES.acceptDone). 스크린리더에는 알림으로 한 번 읽힌다. 동작 줄이기: 이동 · 크기 없이 투명도만(머무는 시간 0.35배)
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Backdrop } from '@/components/Screen';
import { RECS } from '@/content/copy';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { Fade, logoTile, Rise, scene, StampTile, useReduceMotion } from '@/motion';
import { colors, radius, space } from '@/theme/tokens';

// 시제품 .pair(200 × 80, 원 72 를 양끝에서 안쪽 32 에 · 타일은 가운데 아래) — 4 격자로 맞춤
const PAIR_W = 200;
const PAIR_H = 80;
const CIRCLE = 72;
const SLIDE = 56; // 양옆에서 다가오는 거리(시제품 slideL · slideR)

export function MatchMoment({ text, myUri, partnerUri, onDone }: { text: string; myUri: string | null; partnerUri: string | null; onDone: () => void }) {
  const reduce = useReduceMotion();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), Math.round(scene.match.hold * (reduce ? 0.35 : 1)));
    return () => clearTimeout(hold);
  }, [reduce]);
  useEffect(() => {
    if (!leaving) return undefined;
    const done = setTimeout(onDone, scene.match.out);
    return () => clearTimeout(done);
  }, [leaving, onDone]);

  return (
    <Fade visible={!leaving} duration={scene.match.out} style={styles.cover} testID="match-moment">
      <Backdrop kind="connected" testID="match-moment-backdrop" />
      <View style={styles.center}>
        <View style={styles.pair}>
          <Rise axis="x" distance={-SLIDE} duration={scene.match.pair} style={[styles.circle, styles.left]}>
            <PhotoBox state={myUri ? 'approved' : 'none'} uri={myUri} label={RECS.photoA11y} style={styles.photo} />
          </Rise>
          <Rise axis="x" distance={SLIDE} duration={scene.match.pair} style={[styles.circle, styles.right]}>
            <PhotoBox state={partnerUri ? 'approved' : 'none'} uri={partnerUri} label={RECS.photoA11y} style={styles.photo} />
          </Rise>
          <StampTile size={logoTile.moment} delay={scene.match.stampDelay} style={styles.tile} testID="match-moment-tile" />
        </View>
        <Rise delay={scene.match.textDelay} duration={scene.match.text}>
          <AppText variant="title" style={styles.text} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="match-moment-text">
            {text}
          </AppText>
        </Rise>
      </View>
    </Fade>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s40, gap: space.s48 },
  pair: { width: PAIR_W, height: PAIR_H },
  circle: { position: 'absolute', top: space.s4, width: CIRCLE, height: CIRCLE, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.accent, overflow: 'hidden', backgroundColor: colors.accentSoft },
  left: { left: space.s32 },
  right: { right: space.s32 },
  photo: { width: '100%', height: '100%', borderRadius: radius.pill },
  tile: { position: 'absolute', left: (PAIR_W - logoTile.moment) / 2, top: PAIR_H - space.s24 },
  text: { textAlign: 'center' },
});
