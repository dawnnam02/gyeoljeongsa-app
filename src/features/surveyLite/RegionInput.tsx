// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 입력형태 '지역'(A03): 시·도 칸 · 시·군·구 칸(누르면 목록 시트) + 빠른 선택 칩 "서울 / 경기 / 인천 / 부산 / 대구 / 대전 / 광주 / 그 외".
// 칩은 시·도를 바로 고르는 길이고 '그 외'는 시·도 전체 목록을 연다. 시·도를 바꾸면 시·군·구를 비운다(세종은 자동). Figma 04(3:82) 모양.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { FullSheet } from '@/components/FullSheet';
import { Pressable } from '@/components/Pressable';
import { SURVEY_LITE } from '@/content/surveyLiteCopy';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { Draft, LiteQuestion } from './liteModel';
import { pickSido } from './liteModel';
import { isSido, SIDO, SIGUNGU, type Sido } from './regions';

type RegionDraft = Extract<Draft, { kind: 'region' }>;
type Props = { q: LiteQuestion; draft: RegionDraft; onChange: (draft: Draft) => void; invalid: boolean };

export function RegionInput({ q, draft, onChange, invalid }: Props) {
  const [sheet, setSheet] = useState<'sido' | 'sigungu' | null>(null);
  const id = (part: string) => `lite-${q.id}-${part}`;
  const choose = (sido: Sido) => onChange(pickSido(sido));
  const list = sheet === 'sido' ? [...SIDO] : draft.sido ? [...SIGUNGU[draft.sido]] : [];

  return (
    <View style={styles.wrap}>
      <Field label={SURVEY_LITE.sidoPlaceholder} value={draft.sido} invalid={invalid && !draft.sido} onPress={() => setSheet('sido')} testID={id('sido')} />
      <Field
        label={SURVEY_LITE.sigunguPlaceholder}
        value={draft.sigungu}
        invalid={invalid && !!draft.sido && !draft.sigungu}
        disabled={!draft.sido}
        onPress={() => setSheet('sigungu')}
        testID={id('sigungu')}
      />
      <View style={styles.chips}>
        {SURVEY_LITE.quickSido.map((name, i) => (
          <Chip key={name} label={name} variant={draft.sido === name ? 'selected' : 'inactive'} onPress={() => isSido(name) && choose(name)} testID={id(`quick-${i}`)} />
        ))}
        <Chip label={SURVEY_LITE.quickOther} variant="inactive" onPress={() => setSheet('sido')} testID={id('quick-other')} />
      </View>
      <FullSheet visible={sheet !== null} title={sheet === 'sigungu' ? SURVEY_LITE.sigunguPlaceholder : SURVEY_LITE.sidoPlaceholder} onClose={() => setSheet(null)} testID={id('sheet')}>
        <ScrollView contentContainerStyle={styles.list}>
          {list.map((name, i) => {
            const selected = sheet === 'sido' ? draft.sido === name : draft.sigungu === name;
            return (
              <Pressable
                key={name}
                accessibilityLabel={name}
                aria-selected={selected}
                effect="none"
                onPress={() => {
                  if (sheet === 'sido' && isSido(name)) choose(name);
                  else onChange({ ...draft, sigungu: name });
                  setSheet(null);
                }}
                testID={id(`item-${i}`)}
                style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
                <AppText variant={selected ? 'bodyBold' : 'body'} tone={selected ? 'accent' : 'text'}>
                  {name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </FullSheet>
    </View>
  );
}

type FieldProps = { label: string; value: string | null; invalid: boolean; disabled?: boolean; onPress: () => void; testID: string };

// 입력 칸 모양(가이드 4장: 높이 48 · pill · 면 card)의 누르는 칸. 값이 없으면 칸 이름을 자리표시로 보인다
function Field({ label, value, invalid, disabled = false, onPress, testID }: FieldProps) {
  return (
    <Pressable
      accessibilityLabel={value ? `${label} ${value}` : label}
      disabled={disabled}
      effect="none"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.field, invalid ? styles.fieldInvalid : null, pressed ? styles.pressed : null]}>
      <AppText variant="body" tone={value ? 'text' : 'sub'} numberOfLines={1}>
        {value ?? label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s12, alignSelf: 'stretch' },
  field: {
    minHeight: size.input,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    paddingHorizontal: space.s20,
    justifyContent: 'center',
    borderWidth: layout.inputBorder,
    borderColor: colors.card,
  },
  fieldInvalid: { borderColor: colors.accent, borderWidth: layout.inputBorderActive, paddingHorizontal: space.s20 - (layout.inputBorderActive - layout.inputBorder) },
  pressed: { opacity: alpha.pressed },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  list: { paddingVertical: space.s8 },
  row: { minHeight: size.listRow, justifyContent: 'center', paddingHorizontal: size.screenPadding, borderBottomWidth: 1, borderBottomColor: colors.line },
});
