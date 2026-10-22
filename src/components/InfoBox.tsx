// 안내 상자(가이드 4-3 채움 카드): Card(면 card · 둥글기 16 · 안 여백 20) · 테두리 없음 · 누르지 않는다. 체크 칸이 아니라 알림이다.
// 글자는 card 면 위라서 본문색(text)을 쓴다(가이드 1-2: card 위 작은 글자는 text). 제목 15 Bold · 본문 12 Regular(디자인 D7 값).
import { StyleSheet } from 'react-native';

import { space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Card } from './Card';

type Props = { title: string; body: string; testID?: string };

export function InfoBox({ title, body, testID }: Props) {
  return (
    <Card testID={testID} accessible accessibilityLabel={`${title}. ${body}`} style={styles.box}>
      <AppText variant="bodyBold">{title}</AppText>
      <AppText variant="caption" tone="text">
        {body}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.s8, alignSelf: 'stretch' },
});
