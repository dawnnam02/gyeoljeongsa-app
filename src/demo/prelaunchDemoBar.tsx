// 데모 모드에서만 보이는 사전 오픈 장면 줄(F22 5 · K20 4-5 '데모'). 스토어 빌드(데모 모드 꺼짐)에는 그려지지 않는다 — 부르는 쪽(PrelaunchGate)이 데모일 때만 넘긴다.
//  · 대기 화면 맨 아래: 장면 칩(확인 중 · 보완 필요 · 확정 · 함께하기 어려워요 · 지역 기다림 · 성비 기다림) + [사전 오픈 끄기(출시)] + 잇기 번호 · 코드 안내
//  · 09 위(이메일 장면 계정만): [사전 오픈 다시 켜기] 한 줄 — 다시 켜면 대기 화면으로(K20 1-3 '되돌리기')
//  글은 원본 문서에 없는 데모 안내라 카피 대조 대상이 아니다(content/demo.ts 와 같은 취급).
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { colors, radius, size, space } from '@/theme/tokens';

import { DEMO_LINK, DEMO_LINK_TAKEN, type PrelaunchScene } from './prelaunchDemo';

export const PRELAUNCH_DEMO = {
  note: '데모 모드예요. 사전 오픈 장면을 골라 볼 수 있어요.',
  link: `잇기 성공: 번호 ${DEMO_LINK.no} · 코드 ${DEMO_LINK.code} / 남이 이은 번호(틀림으로 셈): ${DEMO_LINK_TAKEN.no} · 코드 ${DEMO_LINK_TAKEN.code}`,
  scenes: [
    ['checking', '확인 중'],
    ['fix', '보완 필요'],
    ['confirmed', '확정'],
    ['declined', '함께하기 어려워요'],
    ['deferred', '출시일 7일 미룸'],
    ['reviewOpen', '출시 뒤 확정 전'],
    ['regionWait', '지역 기다림(인원)'],
    ['regionRatio', '지역 기다림(성비)'],
    ['regionLocked', '지역 기다림(양보 불가)'],
  ] as readonly (readonly [PrelaunchScene, string])[],
  open: '사전 오픈 끄기(출시 장면)',
  reopen: '데모 · 사전 오픈 다시 켜기',
} as const;

export function PrelaunchDemoBar({ onScene }: { onScene: (scene: PrelaunchScene) => void }) {
  return (
    <View style={styles.bar} testID="prelaunch-demo">
      <AppText variant="caption" tone="text">
        {PRELAUNCH_DEMO.note}
      </AppText>
      <View style={styles.chips}>
        {PRELAUNCH_DEMO.scenes.map(([scene, label]) => (
          <Chip key={scene} label={label} variant="inactive" onPress={() => onScene(scene)} testID={`prelaunch-demo-${scene}`} />
        ))}
      </View>
      <Button label={PRELAUNCH_DEMO.open} variant="secondary" onPress={() => onScene('open')} testID="prelaunch-demo-open" />
      <AppText variant="caption" testID="prelaunch-demo-link">
        {PRELAUNCH_DEMO.link}
      </AppText>
    </View>
  );
}

// 09(오늘의 추천) 위에 겹치는 한 줄. 화면 배치를 바꾸지 않게 아래에 띄운다(이메일 장면 계정에서만)
export function PrelaunchDemoReopen({ onReopen }: { onReopen: () => void }) {
  return (
    <View style={styles.reopen} pointerEvents="box-none" testID="prelaunch-demo-reopen-wrap">
      <Chip label={PRELAUNCH_DEMO.reopen} variant="inactive" onPress={onReopen} testID="prelaunch-demo-reopen" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space.s8, padding: space.s16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  reopen: { position: 'absolute', left: size.screenPadding, bottom: space.s8 },
});
