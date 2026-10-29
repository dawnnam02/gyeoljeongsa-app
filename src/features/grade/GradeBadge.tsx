// 등급 표시 부품(W9: 숫자 → 아이콘). 처음 F13(수익/상점_화면.md 7-7, 카피 16-F) · 바뀜 청사진_v5 6-2.
//  · 그림은 GradeIcon(1안 여행지 풍경, D-154). 단계 번호 → 풍경은 iconBridge(서버 키가 오기 전 임시 다리). 숫자가 그려진 tier-N.png 는 더 쓰지 않는다
//  · 눈에 보이는 글 · 스크린리더 이름 어디에도 단계 숫자 · 순서 말이 없다(check:grade · gradeIcon.test)
//  · 서버가 1~9 를 주지 않으면 아무것도 그리지 않는다. 앱은 숨기는 계산을 하지 않는다(상대 아이콘을 숨기는 일은 라우트 · 서버 몫)
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Pressable } from '@/components/Pressable';
import { BADGE16 } from '@/content/shopCopy';
import { asGradeNo } from '@/lib/gradeApi';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import { GradeIcon } from './GradeIcon';
import { iconOf } from './iconBridge';
import { GI } from './iconCopy';

// 예전 이름 그대로(16-G · 10 상세가 부른다). 그림만 아이콘으로 바뀌었다
export function GradeImage({ n, size: px = layout.tierBadgeBig, testID }: { n: number; size?: number; testID?: string }) {
  return <GradeIcon icon={iconOf(undefined, n)} size={px} testID={testID} />;
}

// 09 카드 이름 줄 옆 칩: 아이콘만(글 없음). 터치 영역 44. 누르면 말풍선
export function GradeChip({ n, open = false, onPress, testID = 'grade-chip' }: { n: number | null | undefined; open?: boolean; onPress?: () => void; testID?: string }) {
  const no = asGradeNo(n);
  if (no === null) return null;
  return (
    <Pressable accessibilityLabel={GI.partnerA11y} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={onPress} effect="none" testID={testID} style={styles.touch}>
      <View style={styles.chip}>
        <GradeIcon icon={iconOf(undefined, no)} size={layout.tierBadgeCard} testID={`${testID}-image`} />
      </View>
    </Pressable>
  );
}

// 말풍선: 숫자 · 방향 문구(NV82 · NV81) 대신 '인생을 대변하지 않아요' 한 줄만
export function GradeBubble({ n, testID = 'grade-chip' }: { n: number | null | undefined; testID?: string }) {
  const no = asGradeNo(n);
  if (no === null) return null;
  return (
    <View style={styles.bubble} accessible accessibilityRole="alert" testID={`${testID}-bubble`}>
      <AppText variant="caption" tone="text" testID={`${testID}-bubble-note`}>
        {BADGE16.notLife}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' }, // 아이콘만이라 폭도 48 이상
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingVertical: 0, paddingHorizontal: space.s4 },
  bubble: { alignSelf: 'stretch', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.s12, gap: space.s4 },
});
