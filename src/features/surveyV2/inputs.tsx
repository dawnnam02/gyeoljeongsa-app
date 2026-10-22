// 설문 v2 문항 입력(형식 7종, 설문_v2 0장 · D35 4장 크기 표). 학교 검색은 SchoolInput.tsx.
//  하나 고르기 · 구간 = 세로 줄(OptionRow), '말하고 싶지 않아요'는 선 아래 따로 · 여러 개 = 칩('상관없어요'는 혼자만, 상한이면 '{n}/{최대}')
//  5단계 = 다섯 칸(숫자는 보이지 않고 양 끝 글만, 처음엔 손잡이 없음) · 숫자 하나 = [−] 값 [+] · 양끝 = 두 줄의 [−] 값 [+] + '상관없어요'
//  순위 전부 = 줄마다 위 · 아래 + [이대로 괜찮아요] · 상위 3개 = 누른 차례 번호 칩 · 짧은 글 = 한 줄 · 여러 줄 + '{지금}/{최대}' + 연락처 안내(막지 않음)
//  지역 2단 = 시·도 칩 → 시·군·구 칩(세종은 자동)
// 글은 questionCopy.ts · copy.ts 만 쓴다. 색 · 간격은 토큰만.
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ContactHint } from '@/components/ContactHint';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { haptic } from '@/motion';
import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { SV2, PROPOSED } from './copy';
import { choicesFor, CONTACT_FIELD, copyOf, maxPick, moveRank, optText, pickSido, rankTopNeed, rangeSpan, toggleMulti, toggleTop, type Draft } from './model';
import { OptionChip, OptionRow, Stepper } from './parts';
import { SIDO_CODES, SIGUNGU } from './regions';
import type { QuestionDef, V2Answers } from './types';

type Props = { q: QuestionDef; draft: Draft; answers: V2Answers; onChange: (d: Draft) => void; invalid: boolean };

export function QuestionInput({ q, draft, answers, onChange, invalid }: Props) {
  const id = (part: string) => `v2-${q.id}-${part}`;
  const c = copyOf(q.id);

  switch (draft.kind) {
    case 'choice': {
      const main = q.codes.filter((code) => code !== 'decline');
      const dense = q.format === 'bucket';
      return (
        <View style={styles.list} accessibilityRole="radiogroup">
          {main.map((code) => (
            <OptionRow key={code} label={optText(q.id, code)} selected={draft.code === code} dense={dense} onPress={() => onChange({ kind: 'choice', code: draft.code === code ? null : code })} testID={id(`opt-${code}`)} />
          ))}
          {q.decline ? (
            <View style={styles.apart}>
              <OptionRow label={SV2.common.decline} selected={draft.code === 'decline'} dense={dense} onPress={() => onChange({ kind: 'choice', code: draft.code === 'decline' ? null : 'decline' })} testID={id('opt-decline')} />
            </View>
          ) : null}
        </View>
      );
    }

    case 'region': {
      const sido = draft.sido;
      return (
        <View style={styles.block}>
          <AppText variant="captionMedium" tone="text">
            {SV2.A03step.sido}
          </AppText>
          <View style={styles.chips}>
            {SIDO_CODES.map((code) => (
              <OptionChip key={code} label={optText('F06', code)} selected={sido === code} onPress={() => onChange(sido === code ? { kind: 'region', sido: null, sigungu: null } : pickSido(code))} testID={id(`sido-${code}`)} />
            ))}
          </View>
          {sido && SIGUNGU[sido].length > 1 ? (
            <>
              <AppText variant="captionMedium" tone={invalid && !draft.sigungu ? 'accent' : 'text'}>
                {SV2.A03step.sigungu}
              </AppText>
              <View style={styles.chips} testID={id('sigungu')}>
                {SIGUNGU[sido].map((name, i) => (
                  <OptionChip key={name} label={name} selected={draft.sigungu === name} onPress={() => onChange({ ...draft, sigungu: draft.sigungu === name ? null : name })} testID={id(`sigungu-${i}`)} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      );
    }

    case 'multi': {
      const list = choicesFor(q, answers);
      const max = maxPick(q.id);
      const main = list.filter((o) => o.code !== 'any');
      const any = list.find((o) => o.code === 'any');
      const press = (code: string) => onChange({ kind: 'multi', picks: toggleMulti(q.codes, draft.picks, code, max) });
      const full = max !== null && draft.picks.length >= max;
      return (
        <View style={styles.block}>
          {max !== null ? (
            <AppText variant="captionMedium" tone="accent" testID={id('count')}>
              {SV2.common.count(draft.picks.length, max)}
            </AppText>
          ) : null}
          <View style={styles.chips}>
            {main.map((o) => {
              const on = draft.picks.includes(o.code);
              return <OptionChip key={o.code} label={optText(q.id, o.code)} selected={on} disabled={o.disabled || (!on && full)} onPress={() => press(o.code)} testID={id(`opt-${o.code}`)} />;
            })}
          </View>
          {any ? (
            <View style={[styles.chips, styles.apart]}>
              <OptionChip label={SV2.common.any} selected={draft.picks.includes('any')} onPress={() => press('any')} testID={id('opt-any')} />
            </View>
          ) : null}
        </View>
      );
    }

    case 'scale': {
      const values = [1, 2, 3, 4, 5];
      return (
        <View style={styles.block} accessibilityRole="radiogroup">
          <View style={styles.scaleRow}>
            <View style={styles.track} pointerEvents="none" />
            {values.map((n) => {
              const on = draft.value === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={`${c?.low ?? ''} ~ ${c?.high ?? ''}, ${SV2.common.count(n, 5)}`}
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  effect="none"
                  onPress={() => {
                    haptic.selection();
                    onChange({ kind: 'scale', value: on ? null : n });
                  }}
                  testID={id(`opt-${n}`)}
                  style={styles.scaleCell}>
                  <View style={[styles.dot, on ? styles.thumb : invalid ? styles.dotInvalid : null]}>{on ? <View style={styles.thumbCore} /> : null}</View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.ends}>
            <AppText variant="caption" tone="text" style={styles.endText}>
              {c?.low ?? ''}
            </AppText>
            <AppText variant="caption" tone="text" style={[styles.endText, styles.endRight]}>
              {c?.high ?? ''}
            </AppText>
          </View>
        </View>
      );
    }

    case 'number':
      return (
        <Stepper label={c?.q ?? q.id} stepLabel="1cm" text={draft.text} unit={SV2.unitCm} min={q.min ?? 0} max={q.max ?? 0} start={170} onChange={(text) => onChange({ kind: 'number', text })} testID={id('input')} />
      );

    case 'range': {
      const [min, max] = rangeSpan(q.id);
      const f01 = q.id === 'F01';
      const labels = f01 ? [PROPOSED.F01younger, PROPOSED.F01older] : [PROPOSED.F02min, PROPOSED.F02max];
      const start = f01 ? [0, 0] : [160, 185];
      const side = (k: 'a' | 'b', i: number) => (
        <View key={k} style={styles.block}>
          <AppText variant="captionMedium" tone="text">
            {labels[i]}
          </AppText>
          <Stepper label={labels[i]} stepLabel={f01 ? labels[i] : '1cm'} text={draft[k]} unit={f01 ? undefined : SV2.unitCm} min={min} max={max} start={start[i]} disabled={draft.any} onChange={(text) => onChange({ ...draft, [k]: text })} testID={id(k)} />
        </View>
      );
      return (
        <View style={styles.block}>
          {side('a', 0)}
          {side('b', 1)}
          <View style={styles.chips}>
            <OptionChip label={SV2.common.any} selected={draft.any} onPress={() => onChange({ ...draft, any: !draft.any })} testID={id('any')} />
          </View>
        </View>
      );
    }

    case 'rankAll':
      return (
        <View style={styles.list}>
          {draft.order.map((code, i) => (
            <View key={code} style={styles.rankRow} testID={id(`row-${i}`)}>
              <View style={styles.rankNo}>
                <AppText variant="smallMedium" tone="accent">
                  {String(i + 1)}
                </AppText>
              </View>
              <AppText variant="bodyMedium" style={styles.rowText}>
                {optText(q.id, code)}
              </AppText>
              <Arrow label={SV2.rankUp(optText(q.id, code))} up disabled={i === 0} onPress={() => onChange({ kind: 'rankAll', order: moveRank(draft.order, i, -1), touched: true })} testID={id(`up-${i}`)} />
              <Arrow label={SV2.rankDown(optText(q.id, code))} up={false} disabled={i === draft.order.length - 1} onPress={() => onChange({ kind: 'rankAll', order: moveRank(draft.order, i, 1), touched: true })} testID={id(`down-${i}`)} />
            </View>
          ))}
          <View style={styles.chips}>
            <OptionChip label={SV2.E13keepOrder} selected={draft.touched} onPress={() => onChange({ ...draft, touched: !draft.touched })} testID={id('keep')} />
          </View>
        </View>
      );

    case 'rankTop': {
      const need = rankTopNeed(answers);
      const list = choicesFor(q, answers);
      return (
        <View style={styles.block}>
          <AppText variant="captionMedium" tone="accent" testID={id('count')}>
            {SV2.common.count(draft.order.length, need)}
          </AppText>
          <View style={styles.chips}>
            {list.map((o) => {
              const at = draft.order.indexOf(o.code);
              const label = optText(q.id, o.code);
              return (
                <OptionChip
                  key={o.code}
                  label={label}
                  selected={at >= 0}
                  order={at >= 0 ? at + 1 : null}
                  disabled={at < 0 && draft.order.length >= need}
                  accessibilityLabel={at >= 0 ? SV2.F13pickedA11y(label, at + 1) : label}
                  onPress={() => onChange({ kind: 'rankTop', order: toggleTop(draft.order, o.code, need) })}
                  testID={id(`opt-${o.code}`)}
                />
              );
            })}
          </View>
        </View>
      );
    }

    case 'text': {
      const multiline = q.format !== 'line';
      const field = CONTACT_FIELD[q.id];
      const max = q.max ?? 0;
      return (
        <View style={styles.block}>
          <TextField label={c?.q ?? q.id} value={draft.text} onChangeText={(text) => onChange({ kind: 'text', text: q.format === 'story' ? text.replace(/\n{2,}/g, '\n') : text })} multiline={multiline} maxLength={max} testID={id('input')} />
          <AppText variant="caption" style={styles.counter} testID={id('counter')}>
            {SV2.common.chars([...draft.text.trim()].length, max)}
          </AppText>
          {field ? <ContactHint text={draft.text} field={field} testID={id('contact')} /> : null}
        </View>
      );
    }

    default:
      return null; // 학교(school)는 SchoolInput
  }
}

function Arrow({ label, up, disabled, onPress, testID }: { label: string; up: boolean; disabled: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} effect="none" onPress={onPress} testID={testID} style={({ pressed }) => [styles.arrow, pressed ? styles.pressed : null, disabled ? styles.off : null]}>
      <Image source={UI_ICONS.back} style={[styles.icon, up ? styles.up : styles.down]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s8, alignSelf: 'stretch' },
  block: { gap: space.s8, alignSelf: 'stretch' },
  apart: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.s8, marginTop: space.s4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  scaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { position: 'absolute', left: size.touchMin / 2, right: size.touchMin / 2, height: space.s4, borderRadius: radius.pill, backgroundColor: colors.line },
  scaleCell: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  dot: { width: space.s12, height: space.s12, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: layout.inputBorderActive, borderColor: colors.line },
  dotInvalid: { borderColor: colors.accent },
  thumb: { width: space.s24 + space.s4, height: space.s24 + space.s4, borderColor: colors.accent, borderWidth: layout.inputBorderActive + 1, alignItems: 'center', justifyContent: 'center' },
  thumbCore: { width: space.s8 + 2, height: space.s8 + 2, borderRadius: radius.pill, backgroundColor: colors.accent },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s16 },
  endText: { flexShrink: 1 },
  endRight: { textAlign: 'right' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8, minHeight: size.listRow, paddingLeft: space.s12, paddingRight: space.s4, borderRadius: radius.md, backgroundColor: colors.card },
  rankNo: { width: space.s24 + space.s4, height: space.s24 + space.s4, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  arrow: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  icon: { width: layout.headerIcon, height: layout.headerIcon },
  up: { transform: [{ rotate: '90deg' }] },
  down: { transform: [{ rotate: '-90deg' }] },
  pressed: { opacity: alpha.pressed },
  off: { opacity: alpha.disabled },
  counter: { alignSelf: 'flex-end' },
});
