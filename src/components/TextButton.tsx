// 글자 버튼(가이드 4-3 텍스트 버튼): 면 없이 글자만 장미색 본문 Medium. 눌림 85% · 비활성 ×40%.
// 가이드 10-3: 그 밖의 요소(텍스트 버튼 등)는 3장 눌림 색만 쓴다(scale · ripple 없음). 터치 영역은 44 이상.
// 누르기 전에 한글 입력 조합을 먼저 끝낸다(D-143, commitThenPress) — 상단 바 오른쪽 글자([임시 저장] 등)도 이 부품이다.
import { StyleSheet } from 'react-native';

import { alpha, size, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { useCommitThenPress } from './commitThenPress';
import { Pressable } from './Pressable';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  align?: 'center' | 'start';
  variant?: 'bodyMedium' | 'captionMedium';
  accessibilityLabel?: string;
  testID?: string;
};

export function TextButton({ label, onPress, disabled = false, align = 'center', variant = 'bodyMedium', accessibilityLabel, testID }: Props) {
  const press = useCommitThenPress(onPress);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={press}
      testID={testID}
      effect="none"
      style={({ pressed }) => [styles.base, align === 'start' ? styles.start : styles.center, pressed ? styles.pressed : null]}>
      <AppText variant={variant} tone="accent" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s8 },
  center: { alignItems: 'center' },
  start: { alignItems: 'flex-start', alignSelf: 'flex-start' },
  pressed: { opacity: alpha.pressed },
  label: { textAlign: 'center' },
});
