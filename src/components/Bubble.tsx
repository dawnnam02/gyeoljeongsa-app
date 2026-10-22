// 말풍선 2종(F9 색 v2). AI = bubbleAi 면 · text 글자 / 내 = accentAlt 면 · onAccent 글자. 둥글기 16 · 최대 폭 264.
// F3 · F5 대화 화면이 쓴다. 누르지 않는다.
import { StyleSheet, View } from 'react-native';

import { layout } from '@/theme/layout';
import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export type BubbleRole = 'ai' | 'me';

type Props = { role: BubbleRole; text: string; testID?: string };

export function Bubble({ role, text, testID }: Props) {
  const me = role === 'me';
  return (
    <View style={[styles.row, me ? styles.rowMe : styles.rowAi]}>
      <View style={[styles.bubble, { backgroundColor: me ? colors.accentAlt : colors.bubbleAi }]} testID={testID}>
        <AppText variant="body" tone={me ? 'inverse' : 'text'}>
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowAi: { justifyContent: 'flex-start' },
  rowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: layout.bubbleMaxWidth, borderRadius: radius.lg, paddingHorizontal: space.s16, paddingVertical: space.s12 },
});
