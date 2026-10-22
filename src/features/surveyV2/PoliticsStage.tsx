// 설문 v2 정치성향 단계(W8): 문항 머리 + CK15 별도 동의 안내(InfoBox) + 체크 칸 + 끌기 막대.
//  · 서버에 유효한 CK15 가 있으면 체크 칸 대신 '별도 동의를 마쳤어요' 한 줄
//  · 동의 전에는 막대를 움직일 수 없다(흐림). 저장 · 동의 기록은 화면의 [다음]에서 한 번에(누르기 전 저장 0)
//  · 값은 설문 답과 따로(politics.ts) — 검토 화면에는 '답했어요 / 아직' 말만, 위치 · 숫자는 보이지 않는다
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckBox } from '@/components/CheckBox';
import { InfoBox } from '@/components/InfoBox';
import { Pressable } from '@/components/Pressable';
import { size, space } from '@/theme/tokens';

import { QuestionHead } from './parts';
import { POL } from './politicsCopy';
import { PoliticsSlider } from './PoliticsSlider';

export type PolDraft = { loaded: boolean; serverConsent: boolean; checked: boolean; value: number | null; savedValue: number | null };
export const emptyPol: PolDraft = { loaded: false, serverConsent: false, checked: false, value: null, savedValue: null };

export const polConsentOn = (p: PolDraft) => p.serverConsent || p.checked;
// [다음]을 막는 이유(없으면 null)
export const polBlock = (p: PolDraft): string | null => (!polConsentOn(p) ? POL.needConsent : p.value === null ? POL.needValue : null);
export const polAnswered = (p: PolDraft) => p.serverConsent && p.savedValue !== null;

type Props = { pol: PolDraft; reason: string | null; onCheck: () => void; onChange: (v: number) => void };

export function PoliticsStage({ pol, reason, onCheck, onChange }: Props) {
  const on = polConsentOn(pol);
  return (
    <View style={styles.wrap} testID="v2-politics">
      <QuestionHead question={POL.question} help={POL.help} lines={[]} testID="v2-pol-head" />
      <InfoBox title={POL.consentTitle} body={POL.consentBody} testID="v2-pol-consent" />
      <AppText variant="caption" tone="text" testID="v2-pol-consent-note">
        {POL.consentNote}
      </AppText>
      {pol.serverConsent ? (
        <AppText variant="captionMedium" tone="accent" testID="v2-pol-consent-done">
          {POL.consentDone}
        </AppText>
      ) : (
        <Pressable accessibilityRole="checkbox" aria-checked={pol.checked} accessibilityLabel={POL.consentCheck} onPress={onCheck} effect="none" testID="v2-pol-check" style={styles.check}>
          <CheckBox checked={pol.checked} emphasized={reason === POL.needConsent} />
          <AppText variant="body" style={styles.flex}>
            {POL.consentCheck}
          </AppText>
        </Pressable>
      )}
      <PoliticsSlider value={pol.value} onChange={onChange} disabled={!on} testID="v2-pol-slider" />
      {reason ? (
        <AppText variant="caption" tone="accent" accessibilityLiveRegion="polite" testID="v2-pol-reason">
          {reason}
        </AppText>
      ) : null}
    </View>
  );
}

// 검토 화면 한 줄: 답했는지만(위치 · 숫자 없음)
export function PoliticsReviewRow({ pol, onEdit }: { pol: PolDraft; onEdit: () => void }) {
  const done = polAnswered(pol);
  return (
    <Card style={styles.review} testID="v2-review-politics">
      <View style={styles.flex}>
        <AppText variant="bodyBold">{POL.reviewTitle}</AppText>
        <AppText variant="caption" tone={done ? 'text' : 'accent'} testID="v2-review-politics-state">
          {done ? POL.reviewDone : POL.reviewTodo}
        </AppText>
      </View>
      <Button label={POL.reviewEdit} variant="secondary" onPress={onEdit} testID="v2-review-politics-edit" />
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s16 },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touchMin },
  flex: { flex: 1, flexShrink: 1 },
  review: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
});
