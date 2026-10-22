// 등급 아이콘(W9 · D-154, 청사진_v5 6-2 · 결정 #15 · Q10). 본인 선택 1안 '여행지 풍경' — 그림 원본은 디자인/V5_시안/index.html SETS[0](24 격자 · 선 2 · 둥근 끝).
//  · 9단계는 모양으로만 가른다. 색(accent 한 색) · 크기 · 굵기는 모두 같다. 그림 안에 글자 · 숫자 없음
//  · 등급 ↔ 풍경 짝은 서버만 안다. 이 부품은 풍경 이름(GradeIconKey)만 받는다 — 단계 번호를 받지 않는다
//  · 화면에는 내 것만 '같은 무리'로 보인다(MyFlock). 상대 아이콘은 그리지 않는다(V5 6-2)
//  · 옛 tier-N.png(숫자가 그려진 그림)는 더 쓰지 않는다
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { colors, radius, space } from '@/theme/tokens';

import { GI } from './iconCopy';

export const GRADE_ICON_KEYS = ['sea', 'mountain', 'moon', 'cloud', 'island', 'bridge', 'forest', 'sun', 'field'] as const; // 시안 배열 순서 그대로(등급 순서 아님)
export type GradeIconKey = (typeof GRADE_ICON_KEYS)[number];
export const isGradeIconKey = (v: unknown): v is GradeIconKey => typeof v === 'string' && (GRADE_ICON_KEYS as readonly string[]).includes(v);

// 시안 SETS[0] 의 path 그대로(해의 원 하나만 Circle)
type Part = { d: string } | { c: readonly [number, number, number] };
const ICONS: Record<GradeIconKey, { name: string; parts: readonly Part[] }> = {
  sea: { name: '바다', parts: [{ d: 'M3 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0' }, { d: 'M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0' }] },
  mountain: { name: '산', parts: [{ d: 'M3 19l6-10 4 6 2-3 6 7z' }] },
  moon: { name: '달', parts: [{ d: 'M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4z' }] },
  cloud: { name: '구름', parts: [{ d: 'M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1A4.5 4.5 0 0 0 7 18z' }] },
  island: { name: '섬', parts: [{ d: 'M3 17c3-1.5 15-1.5 18 0' }, { d: 'M9 16c0-3 2-5 6-5' }, { d: 'M12 11c-2-3-5-3-6-1M12 11c1-3 4-4 6-2' }] },
  bridge: { name: '다리', parts: [{ d: 'M3 16h18' }, { d: 'M4 16c3-6 13-6 16 0' }, { d: 'M8 13v3M12 12v4M16 13v3' }] },
  forest: { name: '숲', parts: [{ d: 'M8 4l-4 8h8z' }, { d: 'M8 12v6' }, { d: 'M16 7l-4 7h8z' }, { d: 'M16 14v4' }] },
  sun: { name: '해', parts: [{ c: [12, 12, 4] }, { d: 'M12 3v2M12 19v2M3 12h2M19 12h2' }] },
  field: { name: '들판', parts: [{ d: 'M3 18c4-3 14-3 18 0' }, { d: 'M7 15v-4M12 14V9M17 15v-4' }, { d: 'M12 9c-1.5-1-1.5-2.5 0-3.5 1.5 1 1.5 2.5 0 3.5z' }] },
};
export const gradeIconName = (key: GradeIconKey) => ICONS[key].name;
export const GRADE_ICON_PARTS = ICONS; // 시험용(9 모양이 서로 다른지)

// 키를 모르면 아무것도 그리지 않는다
export function GradeIcon({ icon, size = 24, opacity = 1, testID }: { icon: GradeIconKey | null | undefined; size?: number; opacity?: number; testID?: string }) {
  if (!isGradeIconKey(icon)) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {ICONS[icon].parts.map((p, i) => ('d' in p ? <Path key={i} d={p.d} /> : <Circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />))}
    </Svg>
  );
}

// 무리 그림 자리(시안 p8 pos, 폭 330 기준 → 비율). 가운데 넷째가 나(36 · 100%), 이웃은 28 · 45%
const FLOCK_POS: readonly (readonly [number, number])[] = [[0.05, 0.2], [0.2, 0.55], [0.34, 0.1], [0.48, 0.6], [0.62, 0.2], [0.76, 0.62], [0.88, 0.18]];

// 내 무리(시안 p8 · 토큰표 ◎): 타일 80(accentSoft · 모서리 20) 안 아이콘 56 + '내 무리' · 풍경 이름 · 한 줄 / 같은 모양 무리 그림 / 나만 보여요 문구
export function MyFlock({ icon, testID = 'my-flock' }: { icon: GradeIconKey | null | undefined; testID?: string }) {
  if (!isGradeIconKey(icon)) return null;
  const name = gradeIconName(icon);
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.mine} accessible accessibilityRole="image" accessibilityLabel={GI.flockA11y(name)} testID={`${testID}-mine`}>
        <View style={styles.tile}>
          <GradeIcon icon={icon} size={56} testID={`${testID}-icon-${icon}`} />
        </View>
        <View style={styles.mineText}>
          <AppText variant="captionMedium" tone="sub">
            {GI.flockLabel}
          </AppText>
          <AppText variant="bodyBold" testID={`${testID}-name`}>
            {name}
          </AppText>
          <AppText variant="caption" tone="sub" testID={`${testID}-line`}>
            {GI.flockLine}
          </AppText>
        </View>
      </View>
      <View style={styles.flock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`${testID}-flock`}>
        {FLOCK_POS.map(([x, y], i) => (
          <View key={i} style={[styles.dot, { left: `${x * 100}%`, top: `${y * 100}%` }]}>
            <GradeIcon icon={icon} size={i === 3 ? 36 : 28} opacity={i === 3 ? 1 : 0.45} />
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="sub" testID={`${testID}-note`}>
        {GI.flockNote}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s12 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  tile: { width: 80, height: 80, borderRadius: radius.xl, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  mineText: { flex: 1, gap: space.s4 },
  flock: { height: 88, position: 'relative' },
  dot: { position: 'absolute' },
});
