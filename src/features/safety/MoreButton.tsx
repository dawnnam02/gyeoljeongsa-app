// 행 오른쪽 위 ⋯ 버튼(11 행 · Figma 11 195:4 · 그림은 D42-C 1안 more 아이콘 24): 누르는 면 44 × 44, 스크린리더 이름 "더보기"(N33). 누르면 부모가 ReportBlockSheet 를 연다(F6 이 쓴다).
import { StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';

import { Pressable } from '@/components/Pressable';
import { REPORT_SHEET } from '@/content/copy';
import { alpha, colors, size } from '@/theme/tokens';

export function MoreButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityLabel={REPORT_SHEET.moreA11y} onPress={onPress} effect="none" testID={testID} style={({ pressed }) => [styles.touch, pressed && styles.pressed]}>
      <Icon name="more" size={size.tabIcon} color={colors.text} testID={testID ? `${testID}-icon` : undefined} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: alpha.pressed },
});
