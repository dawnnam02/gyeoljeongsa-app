// 글자 버튼(가이드 4-3 텍스트 버튼): 면 없이 글자만 장미색 본문 Medium. 눌림 85% · 비활성 ×40%.
// 가이드 10-3: 그 밖의 요소(텍스트 버튼 등)는 3장 눌림 색만 쓴다(scale · ripple 없음). 터치 영역은 48 × 48 이상(QP-40).
// 누르기 전에 한글 입력 조합을 먼저 끝낸다(D-143, commitThenPress) — 상단 바 오른쪽 글자([임시 저장] 등)도 이 부품이다.
import { StyleSheet, View } from 'react-native';

import { alpha, colors, size, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { useCommitThenPress } from './commitThenPress';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  align?: 'center' | 'start';
  variant?: 'bodyMedium' | 'captionMedium';
  accessibilityLabel?: string;
  icon?: IconName; // 글자 앞 아이콘 20 · accent(D43 A9 탈퇴하기 등)
  testID?: string;
};

export function TextButton({ label, onPress, disabled = false, align = 'center', variant = 'bodyMedium', accessibilityLabel, icon, testID }: Props) {
  const press = useCommitThenPress(onPress);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={press}
      testID={testID}
      effect="none"
      style={({ pressed }) => [styles.base, align === 'start' ? styles.start : styles.center, pressed ? styles.pressed : null]}>
      {icon ? (
        <View style={styles.inner}>
          <Icon name={icon} size={20} color={colors.accent} testID={testID ? `${testID}-icon` : undefined} />
          <AppText variant={variant} tone="accent" style={styles.label}>
            {label}
          </AppText>
        </View>
      ) : (
        <AppText variant={variant} tone="accent" style={styles.label}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s8 }, // 3부-자 QP-40: 두 글자 [닫기]도 가로 48
  center: { alignItems: 'center' },
  start: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  pressed: { opacity: alpha.pressed },
  label: { textAlign: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
});
