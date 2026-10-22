// [2] 만남 뒤 피드백 카드 자리(11 연결됨 탭 맨 위, K12 2-2 · 2-D1 · 2-D4). 서버가 준 상태(MeetPrompt)만 그린다.
//  · none · off(스위치 꺼짐) → 아무것도 없다(카드 자리도 없다, T2-08)
//  · ask      → 질문 카드: 제목 · 상대 표기(11 행과 같은 '성OO · 나이 · 지역', 사진 · 이름 전체 없음) · 보조 글 · [답하기] · ×(묻지 않기)
//  · answered → 한 줄 '답해 주셨어요' + [고치기](서버가 고칠 수 있다고 했고 48시간이 안 지났을 때만)
//  · 숫자 · 별 모양 · 시계 · 배지 없음. 누르면 부모에게 알리기만 하고, 서버 호출(dismiss)과 시트 열기는 부모가 한다
//  · 글은 키 자리(content/v4Wave01Copy.ts, 1단계 임시)
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { V4W01 } from '@/content/v4Wave01Copy';
import type { MeetPrompt } from '@/lib/meetFeedbackApi';
import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { alpha, size, space } from '@/theme/tokens';

import { canEditNow } from './meetFeedbackLogic';

type Props = {
  prompt: MeetPrompt;
  now: number;
  onAnswer: () => void; // [답하기] → 시트
  onDismiss: () => void; // × 묻지 않기 → 부모가 dismiss 를 부르고 카드를 거둔다
  onEdit: () => void; // [고치기] → 답이 채워진 시트
  busy?: boolean; // 묻지 않기 요청 중(다시 눌리지 않는다)
  testID?: string;
};

export function MeetFeedbackCard({ prompt, now, onAnswer, onDismiss, onEdit, busy = false, testID = 'meet-card' }: Props) {
  if (prompt.kind === 'answered') {
    const editable = canEditNow(prompt, now);
    return (
      <View style={styles.answered} testID={`${testID}-answered`}>
        <AppText variant="captionMedium" tone="sub" style={styles.flex} testID={`${testID}-answered-text`}>
          {V4W01.meet.answered}
        </AppText>
        {editable ? <TextButton label={V4W01.meet.edit} variant="captionMedium" onPress={onEdit} testID={`${testID}-edit`} /> : null}
      </View>
    );
  }
  if (prompt.kind !== 'ask') return null;
  return (
    <Card style={styles.card} testID={testID}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
            {V4W01.meet.cardTitle}
          </AppText>
          <AppText variant="caption" numberOfLines={1} testID={`${testID}-head`}>
            {prompt.head}
          </AppText>
        </View>
        <Pressable
          accessibilityLabel={V4W01.meet.dismissA11y}
          disabled={busy}
          onPress={onDismiss}
          effect="none"
          testID={`${testID}-dismiss`}
          style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}>
          <Image source={UI_ICONS.close} style={styles.icon} />
        </Pressable>
      </View>
      <AppText variant="caption" testID={`${testID}-sub`}>
        {V4W01.meet.cardSub}
      </AppText>
      <Button label={V4W01.meet.answerButton} variant="secondary" disabled={busy} onPress={onAnswer} testID={`${testID}-answer`} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s8 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8 },
  flex: { flex: 1 },
  close: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center', marginTop: -space.s12, marginRight: -space.s12 },
  icon: { width: layout.headerIcon, height: layout.headerIcon },
  pressed: { opacity: alpha.pressed },
  answered: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touchMin },
});
