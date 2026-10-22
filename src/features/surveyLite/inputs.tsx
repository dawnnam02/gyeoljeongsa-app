// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 문항 렌더러(입력형태 11종 중 04 의 10종 — 사진은 05 의 photosLite/PhotoSlots). 화면_요구사항 04 '입력 검증 규칙 1' 표의 모양 그대로:
//  날짜 = 8자리 입력(02 와 같은 칸) · 숫자 = 숫자판 · 선택 · 구간 = 칩 하나 · 척도 = 1~5 다섯 칸 + 양 끝 라벨 · 순위 = RankInput ·
//  텍스트 = 여러 줄 + {지금}/{최대} · 범위 = 두 숫자 칸 + '상관없음' 칩 · 복수 선택 = 칩 여러 개 · 지역 = RegionInput
// 모든 누름은 공통 Pressable(Chip · 칸)이고 색 · 간격은 토큰만 쓴다. 글은 CSV · 카피 그대로다.
import { StyleSheet, View } from 'react-native';

import { haptic } from '@/motion';
import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { SIGN_IN } from '@/content/copy';
import { SURVEY_LITE } from '@/content/surveyLiteCopy';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import { choicesOf, numberOf, rangeOf, scaleOf, textOf, toggleMulti, type Draft, type LiteQuestion } from './liteModel';
import { RankInput } from './RankInput';
import { RegionInput } from './RegionInput';

type Props = { q: LiteQuestion; draft: Draft; onChange: (draft: Draft) => void; invalid: boolean };

const digits = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);

export function QuestionInput({ q, draft, onChange, invalid }: Props) {
  const id = (part: string) => `lite-${q.id}-${part}`;
  // 오류 문구는 화면이 문항 아래에 한 번 보인다(칸마다 따로 쓰지 않는다)

  switch (draft.kind) {
    case 'date':
      return (
        <TextField
          label={SIGN_IN.birthLabel}
          placeholder={SIGN_IN.birthPlaceholder}
          value={draft.text}
          onChangeText={(text) => onChange({ ...draft, text: digits(text, 8) })}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={8}
          disabled={draft.locked}
          testID={id('input')}
        />
      );

    case 'region':
      return <RegionInput q={q} draft={draft} onChange={onChange} invalid={invalid} />;

    case 'number': {
      const spec = numberOf(q);
      return (
        <View style={styles.inline}>
          <View style={styles.grow}>
            <TextField
              label={q.question}
              value={draft.text}
              onChangeText={(text) => onChange({ ...draft, text: digits(text, String(spec.max).length) })}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={String(spec.max).length}
              testID={id('input')}
            />
          </View>
          <AppText variant="body">{spec.unit}</AppText>
        </View>
      );
    }

    case 'choice':
      return (
        <View style={styles.chips}>
          {choicesOf(q).map((option, i) => (
            <Chip
              key={option}
              label={option}
              variant={draft.choice === option ? 'selected' : 'inactive'}
              onPress={() => {
                haptic.selection(); // 설문 선택지 고름(D25 4장)
                onChange({ kind: 'choice', choice: draft.choice === option ? null : option }); // 다시 누르면 풀린다(필수면 미응답)
              }}
              testID={id(`opt-${i}`)}
            />
          ))}
        </View>
      );

    case 'scale': {
      const spec = scaleOf(q);
      const values = Array.from({ length: spec.max - spec.min + 1 }, (_, i) => spec.min + i);
      return (
        <View style={styles.scaleWrap}>
          <View style={styles.scaleRow}>
            {values.map((n) => {
              const selected = draft.value === n;
              const end = n === spec.min ? ` ${spec.low}` : n === spec.max ? ` ${spec.high}` : '';
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n}${end}`}
                  aria-checked={selected}
                  effect="scale"
                  onPress={() => {
                    haptic.selection();
                    onChange({ kind: 'scale', value: selected ? null : n });
                  }}
                  testID={id(`opt-${n}`)}
                  style={[styles.scaleBox, selected ? styles.scaleOn : invalid ? styles.scaleInvalid : null]}>
                  <AppText variant="bodyMedium" tone={selected ? 'accent' : 'text'}>
                    {String(n)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.ends}>
            <AppText variant="caption">{spec.low}</AppText>
            <AppText variant="caption">{spec.high}</AppText>
          </View>
        </View>
      );
    }

    case 'rank':
      return <RankInput q={q} draft={draft} onChange={onChange} invalid={invalid} />;

    case 'text': {
      const spec = textOf(q);
      return (
        <View style={styles.textWrap}>
          <TextField label={q.question} value={draft.text} onChangeText={(text) => onChange({ ...draft, text })} multiline maxLength={spec.max} testID={id('input')} />
          <AppText variant="caption" style={styles.counter} testID={id('counter')}>
            {SURVEY_LITE.counter([...draft.text.trim()].length, spec.max)}
          </AppText>
        </View>
      );
    }

    case 'range': {
      const spec = rangeOf(q);
      const side = (key: 'younger' | 'older') => {
        const s = spec[key];
        return (
          <View style={styles.inline} key={key}>
            <AppText variant="body" style={styles.grow}>
              {s.label}
            </AppText>
            <View style={styles.smallField}>
              <TextField
                label={s.label}
                value={draft[key]}
                onChangeText={(text) => onChange({ ...draft, [key]: digits(text, String(s.max).length) })}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={String(s.max).length}
                disabled={draft.any} // '상관없음'을 고르면 숫자 칸이 흐려진다
                testID={id(key)}
              />
            </View>
            <AppText variant="body">{s.unit}</AppText>
          </View>
        );
      };
      return (
        <View style={styles.rangeWrap}>
          {side('younger')}
          {side('older')}
          <Chip label={spec.any} variant={draft.any ? 'selected' : 'inactive'} onPress={() => onChange({ ...draft, any: !draft.any })} testID={id('any')} />
        </View>
      );
    }

    case 'multi': {
      const choices = choicesOf(q);
      return (
        <View style={styles.chips}>
          {choices.map((option, i) => (
            <Chip
              key={option}
              label={option}
              variant={draft.picks.includes(option) ? 'selected' : 'inactive'}
              onPress={() => {
                haptic.selection();
                onChange({ kind: 'multi', picks: toggleMulti(choices, draft.picks, option) });
              }}
              testID={id(`opt-${i}`)}
            />
          ))}
        </View>
      );
    }
  }
}


const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  grow: { flex: 1, minWidth: 0 },
  smallField: { width: size.button * 2 },
  scaleWrap: { gap: space.s8 },
  scaleRow: { flexDirection: 'row', gap: space.s8 },
  scaleBox: {
    flex: 1,
    minHeight: size.input,
    borderRadius: radius.md,
    borderWidth: layout.inputBorder,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleOn: { borderColor: colors.accent, borderWidth: layout.inputBorderActive, backgroundColor: colors.accentSoft },
  scaleInvalid: { borderColor: colors.accent },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  textWrap: { gap: space.s8 },
  counter: { alignSelf: 'flex-end' },
  rangeWrap: { gap: space.s12 },
});
