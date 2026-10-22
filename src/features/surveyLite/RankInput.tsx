// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 입력형태 '순위'(E13): 보기 전부가 순서를 가진다. 줄마다 위 · 아래 이동 버튼(끌어서 정렬은 정식판에서 — 임시판은 버튼만).
// 처음 놓인 순서는 시작 자리일 뿐이라 한 번 옮기거나 N05 "이 순서로 할게요"를 체크해야 답한 것으로 센다(화면_요구사항 04).
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckBox } from '@/components/CheckBox';
import { Pressable } from '@/components/Pressable';
import { SURVEY_LITE, SURVEY_LITE_DRAFT } from '@/content/surveyLiteCopy';
import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { Draft, LiteQuestion } from './liteModel';
import { moveRank } from './liteModel';

type RankDraft = Extract<Draft, { kind: 'rank' }>;
type Props = { q: LiteQuestion; draft: RankDraft; onChange: (draft: Draft) => void; invalid: boolean };

export function RankInput({ q, draft, onChange, invalid }: Props) {
  const id = (part: string) => `lite-${q.id}-${part}`;
  const move = (index: number, delta: -1 | 1) => onChange({ kind: 'rank', order: moveRank(draft.order, index, delta), confirmed: true });
  return (
    <View style={styles.wrap}>
      {draft.order.map((item, i) => (
        <View key={item} style={styles.row} testID={id(`row-${i}`)}>
          <AppText variant="bodyMedium" style={styles.item}>{`${i + 1}. ${item}`}</AppText>
          <Arrow label={SURVEY_LITE_DRAFT.rankUp(item)} up disabled={i === 0} onPress={() => move(i, -1)} testID={id(`up-${i}`)} />
          <Arrow label={SURVEY_LITE_DRAFT.rankDown(item)} up={false} disabled={i === draft.order.length - 1} onPress={() => move(i, 1)} testID={id(`down-${i}`)} />
        </View>
      ))}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={SURVEY_LITE.rankConfirm}
        aria-checked={draft.confirmed}
        effect="none"
        onPress={() => onChange({ ...draft, confirmed: !draft.confirmed })}
        testID={id('confirm')}
        style={({ pressed }) => [styles.confirm, pressed ? styles.pressed : null]}>
        <CheckBox checked={draft.confirmed} emphasized={invalid} />
        <AppText variant="body">{SURVEY_LITE.rankConfirm}</AppText>
      </Pressable>
    </View>
  );
}

function Arrow({ label, up, disabled, onPress, testID }: { label: string; up: boolean; disabled: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} effect="none" onPress={onPress} testID={testID} style={({ pressed }) => [styles.arrow, pressed ? styles.pressed : null]}>
      <Image source={UI_ICONS.back} style={[styles.icon, up ? styles.up : styles.down]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s8, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: size.listRow, paddingLeft: space.s16, paddingRight: space.s4, borderRadius: radius.md, backgroundColor: colors.card },
  item: { flex: 1, minWidth: 0 },
  arrow: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  icon: { width: layout.headerIcon, height: layout.headerIcon },
  up: { transform: [{ rotate: '90deg' }] }, // ‹(왼쪽)을 시계 방향 90° → 위
  down: { transform: [{ rotate: '-90deg' }] },
  pressed: { opacity: alpha.pressed },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.touchMin, alignSelf: 'flex-start' },
});
