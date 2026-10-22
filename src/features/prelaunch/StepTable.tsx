// 단계표 5칸(K20 2-2 · P-D2 · NP-03): 본인 확인 · 나이 → 사진 · 셀피 → 결혼관 설문 → 서류(선택) → 확정.
//  칸마다 이름 + 상태 글(아직 · 확인 중 · 확인됨 · 보완 필요 · 준비 중)만. 진행 % · 앞에 몇 명 · 예상 시간 숫자 0. 상태는 서버가 계산한 그대로(앱이 정하지 않음)
//  표시: 확인됨 = accent 면 + 흰 체크 · 확인 중 = accentSoft 면 + accent 선 · 보완 필요 = accent 굵은 선 · 아직 = sub 선 · 준비 중 = line 점선. 종이 카드(card) 위
//  스크린리더: 표 전체를 한 번에 읽는다('확정까지 단계. 본인 확인 · 나이 확인됨, …', NP-22)
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { colors, size, space } from '@/theme/tokens';

import type { StepKey, StepState } from './launchApi';
import { PRELAUNCH } from './prelaunchCopy';

type Props = { steps: readonly { step: StepKey; state: StepState }[]; testID?: string };

export const stepsA11y = (steps: Props['steps']): string => PRELAUNCH.stepsA11y(steps.map((s) => `${PRELAUNCH.steps[s.step]} ${PRELAUNCH.states[s.state]}`).join(', '));

export function StepTable({ steps, testID = 'prelaunch-steps' }: Props) {
  return (
    <Card accessible accessibilityLabel={stepsA11y(steps)} style={styles.card} testID={testID}>
      <AppText variant="smallMedium" tone="sub">
        {PRELAUNCH.stepsTitle}
      </AppText>
      {steps.map((s, i) => (
        <View key={s.step} style={styles.row} testID={`${testID}-${s.step}`}>
          <View style={styles.markCol}>
            <Mark state={s.state} testID={`${testID}-${s.step}-mark`} />
            {i < steps.length - 1 ? <View style={styles.rail} /> : null}
          </View>
          <AppText variant={s.state === 'fix' ? 'bodyBold' : 'body'} style={styles.name}>
            {PRELAUNCH.steps[s.step]}
          </AppText>
          <AppText variant="smallMedium" tone={s.state === 'fix' || s.state === 'checking' ? 'accent' : 'sub'} testID={`${testID}-${s.step}-state`}>
            {PRELAUNCH.states[s.state]}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

function Mark({ state, testID }: { state: StepState; testID: string }) {
  return (
    <View style={[styles.mark, markStyle[state]]} testID={testID}>
      {state === 'done' ? <Image source={UI_ICONS.check} style={styles.check} /> : null}
    </View>
  );
}

const MARK = size.badge; // 24
const styles = StyleSheet.create({
  card: { gap: space.s4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12, minHeight: size.touchMin },
  markCol: { width: MARK, alignItems: 'center', alignSelf: 'stretch' },
  rail: { flex: 1, width: layout.checkBoxBorder, backgroundColor: colors.line, marginTop: space.s4 },
  mark: { width: MARK, height: MARK, borderRadius: MARK / 2, alignItems: 'center', justifyContent: 'center' },
  check: { width: layout.checkIcon, height: layout.checkIcon, tintColor: colors.onAccent },
  name: { flex: 1 },
});

const markStyle = StyleSheet.create({
  done: { backgroundColor: colors.accent },
  checking: { backgroundColor: colors.accentSoft, borderWidth: layout.checkBoxBorder, borderColor: colors.accent },
  fix: { backgroundColor: colors.bg, borderWidth: size.focusRing, borderColor: colors.accent },
  todo: { backgroundColor: colors.bg, borderWidth: layout.checkBoxBorder, borderColor: colors.sub },
  na: { backgroundColor: colors.card, borderWidth: layout.checkBoxBorder, borderColor: colors.line, borderStyle: 'dashed' },
});
