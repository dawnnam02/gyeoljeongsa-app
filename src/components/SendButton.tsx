// 보내기 원 버튼(F9 색 v2): accent 원 40 · onAccent ↑. 터치 영역은 hitSlop 으로 48 까지 넓힌다. 공통 Pressable(scale + 흰 ripple).
import { StyleSheet } from 'react-native';

import { layout } from '@/theme/layout';
import { alpha, colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Pressable } from './Pressable';

type Props = { accessibilityLabel: string; onPress?: () => void; disabled?: boolean; testID?: string };

export function SendButton({ accessibilityLabel, onPress, disabled = false, testID }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={space.s4}
      surface="accent"
      testID={testID}
      style={[styles.circle, disabled ? styles.disabled : null]}>
      <AppText variant="bodyBold" tone="inverse">
        ↑
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { width: layout.sendButton, height: layout.sendButton, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: alpha.disabled },
});
