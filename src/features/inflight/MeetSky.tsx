// G-06 만난 날의 하늘(IF5-F1b ⓒ · 카피 22-8 `MEET_SKY` 9키 · 정책 PG-61 · PS-35) — 돌아보기 메모(IF-MEMO) 안 줄 하나(메모 칸 3 밖).
//  · 내가 고른 날 하나의 달 모양 + 절기 한 줄뿐(별자리 0 · 의미 부여 0 · 점수 · 판정 0). 줄 글은 라이브러리 완결 문장(과거형) · 틀 글은 카피 22-8
//  · 고른 날은 기기에만(메모 기록에 같이 — deviceNotes · 서버 전송 0 · 로그 0). 하늘표(2027-01-01 ~ 2028-12-31) 밖 날은 `MEET_SKY.unavailable` 한 줄
//  · 날짜 고르기: 한 달 달력(앞 · 뒤 달 이동만) — 오늘까지의 날만 누를 수 있다(만난 날은 지난 날). 개인 값(생일 · 사주) 0 · 동의와 상관없음
//  · 끝줄은 메모 화면의 `MEET_MEMO.note` 가 그대로(이 줄에 재미 끝줄을 더하지 않는다 — 사실 줄)
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import art3 from '../../../assets/illustrations/if3art.json';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { IF3_TEXT, t3 } from '@/content/if3Copy';
import { t5 } from '@/content/if5Copy';
import { addMonths, daysInMonth, isoOf, nowIso, WEEKDAY_SHORT } from '@/features/saju/sajuLogic';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { if2Styles } from './If2Parts';
import { mdText, meetSkyOf } from './if3Logic';
import { tx } from './if2Text';

type Props = { day: string | null; onChange: (day: string | null) => void; now?: () => number; testID?: string };

export function MeetSky({ day, onChange, now = Date.now, testID = 'meet-sky' }: Props) {
  const today = nowIso(now());
  const [open, setOpen] = useState(false);
  const [ym, setYm] = useState(() => ({ y: Number((day ?? today).slice(0, 4)), m: Number((day ?? today).slice(5, 7)) }));
  const sky = meetSkyOf(day);
  const first = new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: daysInMonth(ym.y, ym.m) }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const pick = (d: number) => {
    onChange(isoOf(ym.y, ym.m, d));
    setOpen(false);
  };
  const go = (delta: number) => setYm(addMonths(ym.y, ym.m, delta));

  return (
    <View style={styles.box} testID={testID}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {IF3_TEXT['MEET_SKY.title']}
      </AppText>
      <AppText variant="caption" testID={`${testID}-lead`}>
        {IF3_TEXT['MEET_SKY.lead']}
      </AppText>

      {day === null ? (
        <AppText variant="body" testID={`${testID}-empty`}>
          {IF3_TEXT['MEET_SKY.empty']}
        </AppText>
      ) : sky ? (
        <View style={if2Styles.row} accessible accessibilityLabel={t3('MEET_SKY.a11y.line', { 날짜: mdText(day), '한 줄': sky.line })} testID={`${testID}-line`}>
          <View style={styles.moon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SvgXml xml={(art3.moons as readonly string[])[sky.stage] ?? ''} width="100%" height="100%" />
          </View>
          <View style={if2Styles.flex}>
            <AppText variant="captionMedium" tone="accent" testID={`${testID}-date`}>
              {mdText(day)}
            </AppText>
            <AppText variant="body" testID={`${testID}-text`}>
              {sky.line}
            </AppText>
          </View>
        </View>
      ) : (
        <AppText variant="body" testID={`${testID}-unavailable`}>
          {IF3_TEXT['MEET_SKY.unavailable']}
        </AppText>
      )}

      <View style={styles.actions}>
        <Button label={day === null ? IF3_TEXT['MEET_SKY.pick'] : IF3_TEXT['MEET_SKY.change']} variant="secondary" inline onPress={() => setOpen(!open)} testID={`${testID}-pick`} />
        {day !== null ? <TextButton label={IF3_TEXT['MEET_SKY.clear']} onPress={() => (onChange(null), setOpen(false))} testID={`${testID}-clear`} /> : null}
      </View>

      {open ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-picker`}>
          <View style={if2Styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('MAGAZINE.a11y.prev')} onPress={() => go(-1)} effect="none" style={({ pressed }) => [styles.nav, pressed && styles.pressed]} testID={`${testID}-prev`}>
              <Icon name="chevron" size={24} color={colors.text} flip />
            </Pressable>
            <AppText variant="bodyBold" style={[if2Styles.flex, styles.center]} accessibilityRole="header" testID={`${testID}-month`}>
              {t5('SAJU.cal.month', { 년: ym.y, 월: ym.m })}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('MAGAZINE.a11y.next')} onPress={() => go(1)} effect="none" style={({ pressed }) => [styles.nav, pressed && styles.pressed]} testID={`${testID}-next`}>
              <Icon name="chevron" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAY_SHORT.map((w) => (
              <AppText key={w} variant="caption" style={styles.cell}>
                {w}
              </AppText>
            ))}
          </View>
          {weeks.map((wk, wi) => (
            <View key={wi} style={styles.weekRow}>
              {wk.map((d, ci) => {
                if (d === null) return <View key={`e-${wi}-${ci}`} style={styles.cell} />;
                const iso = isoOf(ym.y, ym.m, d);
                const future = iso > today; // 만난 날은 지난 날
                const chosen = iso === day;
                return (
                  <Pressable
                    key={iso}
                    accessibilityRole="button"
                    accessibilityLabel={mdText(iso)}
                    accessibilityState={{ selected: chosen, disabled: future }}
                    aria-selected={chosen}
                    disabled={future}
                    onPress={() => pick(d)}
                    effect="none"
                    style={({ pressed }) => [styles.cell, styles.day, chosen && styles.chosen, pressed && styles.pressed]}
                    testID={`${testID}-day-${d}`}>
                    <AppText variant="smallMedium" tone={future ? 'sub' : 'text'}>{d}</AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      <AppText variant="caption" testID={`${testID}-note`}>
        {IF3_TEXT['MEET_SKY.note']}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.s8, paddingVertical: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  moon: { width: 40, height: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.s12, flexWrap: 'wrap' },
  nav: { minWidth: size.touchMin, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: size.touchMin, textAlign: 'center' },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  chosen: { borderWidth: 2, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { opacity: alpha.pressed },
});
