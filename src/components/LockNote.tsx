// 하단 안내 한 줄(F9, 후보 3): 앞에 🔒, 글자 sub 12. 🔒 는 장식이라 스크린리더는 글만 읽는다. 글(카피)은 호출하는 쪽이 준다.
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = { text: string; textTestID?: string };

export function LockNote({ text, textTestID }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" accessibilityElementsHidden importantForAccessibility="no">
        {'\u{1F512}'}
      </AppText>
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
