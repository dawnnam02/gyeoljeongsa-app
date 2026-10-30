// 위기 도움 카드(라운지 · 대화방 공용 — 정책 P4-29 ~ 36 · 화면 요구 T4 '위기 도움 카드' · 카피 19-14).
//  · 줄 둘 + 단추 하나: ① CRISIS.note(상담전화 109) ② SAFETY.emergency(112 · 119 먼저) ③ [닫기](48 × 48). 전화 걸기 · 링크 · 복사 · 신고 단추 0
//  · 쓴 본인 화면에만 그린다(받은 글 · 목록에서 불러온 글 아래에는 부르지 않는다). 닫음은 화면 메모리뿐 — 기기 저장 0
//  · 읽기: 두 줄을 한 덩어리 '도움 안내, {본문}'(polite 안내 — 다른 글 읽기를 끊지 않는다). [닫기]는 따로 눌린다
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TextButton } from '@/components/TextButton';
import { CRISIS, crisisNote, SAFETY } from '@/content/copy';
import { layout } from '@/theme/layout';
import { colors, radius, space } from '@/theme/tokens';

export function CrisisCard({ onClose, testID }: { onClose: () => void; testID: string }) {
  const note = crisisNote();
  return (
    <View style={styles.card} testID={testID}>
      <View accessible accessibilityLiveRegion="polite" accessibilityLabel={CRISIS.a11y(`${note} ${SAFETY.emergency}`)} style={styles.lines} testID={`${testID}-lines`}>
        <AppText variant="small" testID={`${testID}-text`}>
          {note}
        </AppText>
        <AppText variant="small" testID={`${testID}-emergency`}>
          {SAFETY.emergency}
        </AppText>
      </View>
      <TextButton label={CRISIS.close} variant="captionMedium" align="start" onPress={onClose} testID={`${testID}-close`} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.s12, gap: space.s4, maxWidth: layout.bubbleMaxWidth },
  lines: { gap: space.s4 },
});
