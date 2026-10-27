// 하단 안내 한 줄(F9, 후보 3): 앞에 자물쇠 아이콘(1안 security 16 · sub, D43 C1 — 옛 그림 글자 대신), 글자 sub. 아이콘은 장식이라 스크린리더는 글만 읽는다. 글(카피)은 호출하는 쪽이 준다.
import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = { text: string; textTestID?: string };

export function LockNote({ text, textTestID }: Props) {
  return (
    <View style={styles.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="security" size={16} color={colors.sub} testID="lock-note-icon" />
      </View>
      <AppText variant="caption" testID={textTestID} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.s4 },
  text: { flex: 1 },
});
