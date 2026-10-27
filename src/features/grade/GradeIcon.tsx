// 등급 아이콘(W9 · D-154, 청사진_v5 6-2 · 결정 #15 · Q10). 본인 선택 '여행지 풍경' — 그림은 D42-C 1안 확정본(실선 1.5, D-171 · D-176).
//  경로 원본: 디자인/D42_새판/아이콘/1안_원본/paths.json(components/iconPaths) — 다리(주탑 둘 + 케이블) · 들판(지평선 + 밭고랑)은 2차에서 다시 그린 것
//  · 9단계는 모양으로만 가른다. 색(accent 한 색) · 크기 · 굵기는 모두 같다. 그림 안에 글자 · 숫자 없음
//  · 등급 ↔ 풍경 짝은 서버만 안다. 이 부품은 풍경 이름(GradeIconKey)만 받는다 — 단계 번호를 받지 않는다
//  · 화면에는 내 것만 '같은 무리'로 보인다(MyFlock). 상대 아이콘은 그리지 않는다(V5 6-2)
//  · 옛 tier-N.png(숫자가 그려진 그림)는 지웠다
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { ICON_PATHS } from '@/components/iconPaths';
import { GRADE_ICON_KEYS, isGradeIconKey, type GradeIconKey } from '@/lib/gradeApi';
import { colors, radius, space } from '@/theme/tokens';

import { GI } from './iconCopy';

// 풍경 키 9개는 서버 응답을 읽는 lib/gradeApi 가 원본(시안 배열 순서 그대로 · 등급 순서 아님) — 여기서는 다시 내보내기만
export { GRADE_ICON_KEYS, isGradeIconKey };
export type { GradeIconKey };

const ICONS: Record<GradeIconKey, (typeof ICON_PATHS)[GradeIconKey]> = Object.fromEntries(GRADE_ICON_KEYS.map((k) => [k, ICON_PATHS[k]])) as Record<GradeIconKey, (typeof ICON_PATHS)[GradeIconKey]>;
export const gradeIconName = (key: GradeIconKey) => ICONS[key].name;
export const GRADE_ICON_PARTS = ICONS; // 시험용(9 모양이 서로 다른지)

// 키를 모르면 아무것도 그리지 않는다
export function GradeIcon({ icon, size = 24, opacity = 1, testID }: { icon: GradeIconKey | null | undefined; size?: number; opacity?: number; testID?: string }) {
  if (!isGradeIconKey(icon)) return null;
  return <Icon name={icon} size={size} color={colors.accent} opacity={opacity} testID={testID} />;
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
