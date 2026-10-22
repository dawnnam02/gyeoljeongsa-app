// 스크롤 단서 그림(R1 A⑦ · T12): 스크롤 영역 맨 아래에 겹쳐, 아래에 더 있을 때만 옅은 띠를 보인다. 판단은 hooks/useScrollCue.
//  · 꾸밈이라 스크린리더는 건너뛰고 누름을 가로막지 않는다(pointerEvents none). 움직임 없음(동작 줄이기와 상관없음)
//  · 색은 토큰만: 바탕 bg 를 85% 로 덮고 위쪽에 line 1px. 그라데이션 부품은 F17 이 넣는 중이라 2단계에 바꿀 수 있다
//  · 부모는 position: relative 인 감싸개 안에 ScrollView 와 나란히 둔다
import { StyleSheet, View } from 'react-native';

import { withAlpha } from '@/theme/color';
import { alpha, colors, space } from '@/theme/tokens';

export function ScrollCue({ visible, testID = 'scroll-cue' }: { visible: boolean; testID?: string }) {
  if (!visible) return null;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.band} testID={testID} />;
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, height: space.s24, backgroundColor: withAlpha(colors.bg, alpha.pressed), borderTopWidth: 1, borderTopColor: colors.line },
});
