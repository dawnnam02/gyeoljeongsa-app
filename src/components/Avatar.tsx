// 아바타(F9 색 v2): accentSoft 원 32 · 글자 accent Bold 12(기본 '결').
import { StyleSheet, View } from 'react-native';

import { layout } from '@/theme/layout';
import { colors, radius } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = { label?: string; testID?: string };

export function Avatar({ label = '결', testID }: Props) {
  return (
    <View style={styles.circle} testID={testID} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText variant="captionBold" tone="accent">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: layout.avatar, height: layout.avatar, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
