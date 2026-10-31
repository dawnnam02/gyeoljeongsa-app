// 사주 마당 공통 부품(IF5-F1 · 디자인 IF5 SUM · HUB · DETAIL · HELP): 한 장 요약 틀 · 네 기둥 표 · 오행 막대 · 시각 고르기 · 낱말 풀이 시트 · 상태 줄.
//  · 한 문장(굵게) → 세 줄(점) → [펼쳐 보기]. 펼침은 기억하지 않는다(화면 메모리뿐). 점수 · 퍼센트 · 판정 · 숫자 배지 · 깜빡임 0 · 토큰 밖 색 0
//  · 사주 값(글자)은 접근성 라벨에 싣지 않는다(IFF5-34): 표는 이름만 읽고 칸 글자는 숨긴다
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { IF3_TEXT } from '@/content/if3Copy';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { FRAGMENTS5 } from '@/saju5/fragments5';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { If5Icon, type If5IconName } from './If5Icon';
import { elementWord, type CardView, type ElementBar, type PillarCell } from './sajuLogic';

// ── 한 장 요약 틀 ────────────────────────────────────────────────────────────
export function SummaryCard({ id, label, icon, sub, one, lines, more, children, labels, top, bottom }: { id: string; label: string; icon?: If5IconName; sub?: string; one: string | null; lines: readonly string[]; more?: readonly string[]; children?: ReactNode; labels?: readonly string[]; top?: ReactNode; bottom?: ReactNode }) {
  const [open, setOpen] = useState(false); // 펼침은 기억하지 않는다
  const hasMore = (more?.length ?? 0) > 0 || !!children;
  return (
    <View style={styles.card} testID={id}>
      <CardTitle label={label} icon={icon} testID={`${id}-label`} />
      {sub ? <AppText variant="caption">{sub}</AppText> : null}
      {top}
      {one ? (
        <AppText variant="bodyBold" testID={`${id}-one`}>
          {one}
        </AppText>
      ) : null}
      {lines.map((l, i) => (
        <View key={l} style={styles.lineRow}>
          <AppText variant="body" tone="sub">
            {'· '}
          </AppText>
          <AppText variant="body" style={styles.flex} testID={`${id}-line-${i}`}>
            {labels?.[i] ? `${labels[i]} · ${l}` : l}
          </AppText>
        </View>
      ))}
      {bottom}
      {hasMore ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? IF5_TEXT['SAJU.card.less'] : IF5_TEXT['SAJU.card.more']}
            accessibilityState={{ expanded: open }}
            aria-expanded={open}
            onPress={() => setOpen(!open)}
            effect="none"
            style={({ pressed }) => [styles.foldBtn, pressed && styles.pressed]}
            testID={`${id}-toggle`}>
            <AppText variant="bodyMedium" tone="accent" style={styles.flex}>
              {open ? IF5_TEXT['SAJU.card.less'] : IF5_TEXT['SAJU.card.more']}
            </AppText>
            <Icon name="chevron" size={20} color={colors.accent} rotate={open ? -90 : 90} />
          </Pressable>
          {open ? (
            <View style={styles.gapSmall} testID={`${id}-body`}>
              {(more ?? []).map((m) => (
                <AppText key={m} variant="body" tone="text">
                  {m}
                </AppText>
              ))}
              {children}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
/** 카드 이름 줄: 디자인 아이콘(선택) + 이름. 아이콘은 꾸밈이라 스크린리더가 건너뛴다 */
export function CardTitle({ label, icon, testID }: { label: string; icon?: If5IconName; testID?: string }) {
  return (
    <View style={styles.row}>
      {icon ? <If5Icon name={icon} size={20} color={colors.accent} /> : null}
      <AppText variant="bodyBold" accessibilityRole="header" testID={testID}>
        {label}
      </AppText>
    </View>
  );
}
export const cardLines = (v: CardView | null): readonly string[] => v?.three ?? [];

// 접힘 줄 하나(별난 점 카드 · 자세히 보기 표 같은 안쪽 접힘)
export function FoldRow({ id, title, sub, children }: { id: string; title: string; sub: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fold} testID={id}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} effect="none" style={({ pressed }) => [styles.foldHead, pressed && styles.pressed]} testID={`${id}-toggle`}>
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{title}</AppText>
          <AppText variant="caption">{sub}</AppText>
        </View>
        <Icon name="chevron" size={20} color={colors.sub} rotate={open ? -90 : 90} />
      </Pressable>
      {open ? <View style={styles.gapSmall}>{children}</View> : null}
    </View>
  );
}

// ── 네 기둥 표(해 · 달 · 날 · 시) ────────────────────────────────────────────
export function PillarTable({ cells, id }: { cells: readonly PillarCell[]; id: string }) {
  return (
    <View accessible accessibilityLabel={[IF5_TEXT['SAJU.pillars.group'], ...cells.flatMap((c) => (c ? [t5('SAJU.pillars.col.a11y', { '칸 이름': c.posName })] : []))].join(', ')} style={styles.pillars} testID={id}>
      {cells.map((c, i) =>
        c ? (
          <View key={c.pos} style={[styles.pillar, c.pos === 'day' && styles.pillarMe]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`${id}-${c.pos}`}>
            <AppText variant="caption">{c.posName}</AppText>
            <AppText variant="heading" style={styles.center}>{c.stem}</AppText>
            <AppText variant="caption">{c.stemEl}</AppText>
            <AppText variant="heading" style={styles.center}>{c.branch}</AppText>
            <AppText variant="caption">{c.branchEl}</AppText>
            {c.alt ? (
              <AppText variant="caption" testID={`${id}-${c.pos}-alt`}>
                {`${IF3_TEXT['THREE_PILLARS.cusp.or']} ${c.alt.stem}${c.alt.branch}`}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View key={`empty-${i}`} style={[styles.pillar, styles.pillarEmpty]} testID={`${id}-hour-unknown`} />
        ),
      )}
    </View>
  );
}

// ── 오행 막대(길이만 · 숫자 라벨 0) ──────────────────────────────────────────
export function ElementBars({ bars, lacking, id, onHelp }: { bars: readonly ElementBar[]; lacking: readonly string[]; id: string; onHelp?: () => void }) {
  return (
    <View style={styles.gapSmall} testID={id}>
      <View style={styles.row}>
        <AppText variant="bodyMedium" style={styles.flex}>
          {IF5_TEXT['SAJU.pillars.oh.title']}
        </AppText>
        {onHelp ? <HelpButton onPress={onHelp} testID={`${id}-help`} /> : null}
      </View>
      <View accessible accessibilityLabel={IF5_TEXT['SAJU.pillars.oh.title']} style={styles.gapSmall}>
        {bars.map((b) => (
          <View key={b.el} style={styles.barRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`${id}-${b.el}`}>
            <AppText variant="caption" style={styles.barName}>
              {b.name}
            </AppText>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(6, Math.round(b.level * 100))}%` }]} />
            </View>
          </View>
        ))}
      </View>
      {lacking.length > 0 ? (
        <AppText variant="caption" tone="text" testID={`${id}-few`}>
          {`${t5('SAJU.pillars.oh.few', { '기운 이름': elementWord(lacking[0]) })} ${IF5_TEXT['SAJU.pillars.oh.neutral']}`}
        </AppText>
      ) : null}
    </View>
  );
}

// ── [?] 쉬운 말 풀이 ─────────────────────────────────────────────────────────
export function HelpButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={IF5_TEXT['SAJU.card.help']} onPress={onPress} effect="none" style={({ pressed }) => [styles.help, pressed && styles.pressed]} testID={testID}>
      <If5Icon name="help" size={20} color={colors.accent} />
    </Pressable>
  );
}
/** 낱말 풀이 칩 이름 — 카피 24장 읽는 법 낱말 여덟(SAJU.guide.term.0 ~ 7) ↔ 조각 표 F5-16 칩 */
export const GUIDE_TERMS: readonly { key: `SAJU.guide.term.${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`; chips: readonly string[] }[] = [
  { key: 'SAJU.guide.term.0', chips: ['사주'] },
  { key: 'SAJU.guide.term.1', chips: ['오행'] },
  { key: 'SAJU.guide.term.2', chips: ['천간', '지지'] },
  { key: 'SAJU.guide.term.3', chips: ['일간'] },
  { key: 'SAJU.guide.term.4', chips: ['대운'] },
  { key: 'SAJU.guide.term.5', chips: ['세운'] },
  { key: 'SAJU.guide.term.6', chips: ['절기'] },
  { key: 'SAJU.guide.term.7', chips: ['일진'] },
];
/** 풀이 본문: 조각 표 F5-16 칩의 한 문장 + 펼침 첫 줄(없으면 한 문장만). 모르는 칩은 null */
export function guideBody(chip: string): { b1: string; b2: string | null } | null {
  const c = FRAGMENTS5.features['F5-16']?.chips?.[chip];
  if (!c) return null;
  const one = (c.one?.map ?? {}).all;
  const more = (c.more?.[0]?.map ?? {}).all;
  return one ? { b1: one, b2: more ?? null } : null;
}
export function GuideSheet({ term, onClose }: { term: (typeof GUIDE_TERMS)[number] | null; onClose: () => void }) {
  const name = term ? IF5_TEXT[term.key] : '';
  return (
    <BottomSheet visible={!!term} onClose={onClose} testID="saju-guide">
      {term ? (
        <View style={styles.gapSmall}>
          <AppText variant="bodyBold" accessibilityRole="header" testID="saju-guide-title">
            {t5('SAJU.guide.help.title', { 낱말: name })}
          </AppText>
          {term.chips.map((chip) => {
            const b = guideBody(chip);
            return b ? (
              <View key={chip} style={styles.gapSmall}>
                <AppText variant="body">{b.b1}</AppText>
                {b.b2 ? <AppText variant="body">{b.b2}</AppText> : null}
              </View>
            ) : null;
          })}
          <Button label={IF5_TEXT['SAJU.guide.help.ok']} variant="secondary" onPress={onClose} testID="saju-guide-ok" />
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ── 시각 고르기(시 0 ~ 23 · 분 5분 간격) ─────────────────────────────────────
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
export const hourLabel = (h: number): string => t5('SAJU.input.hourUnit', { n: h }); // 카피 24-15-1 `{n}시`(IF5-F1b)
export const minuteLabel = (m: number): string => t5('SAJU.input.minUnit', { n: m }); // `{n}분`
export const clockText = (h: number, m: number): string => `${hourLabel(h)} ${minuteLabel(m)}`;
export function TimePicker({ hour, minute, onPick, id }: { hour: number | null; minute: number | null; onPick: (h: number, m: number) => void; id: string }) {
  const h = hour ?? 0;
  const m = minute ?? 0;
  return (
    <View style={styles.gapSmall} testID={id}>
      <View style={styles.wrap}>
        {HOURS.map((x) => (
          <Chip key={x} label={hourLabel(x)} variant={hour === x ? 'selected' : 'inactive'} onPress={() => onPick(x, m)} accessibilityLabel={hourLabel(x)} testID={`${id}-h-${x}`} />
        ))}
      </View>
      <View style={styles.wrap}>
        {MINUTES.map((x) => (
          <Chip key={x} label={minuteLabel(x)} variant={hour !== null && minute === x ? 'selected' : 'inactive'} onPress={() => onPick(h, x)} accessibilityLabel={minuteLabel(x)} testID={`${id}-m-${x}`} />
        ))}
      </View>
    </View>
  );
}

// ── 상태 줄 ──────────────────────────────────────────────────────────────────
/** 불러오는 중: 정지 뼈대(깜빡임 0 · 초 · 남은 시간 0) */
export function LoadingBlock({ id }: { id: string }) {
  return (
    <View style={styles.card} accessible accessibilityLabel={IF5_TEXT['SAJU.status.loadLab']} testID={id}>
      <AppText variant="caption">{IF5_TEXT['SAJU.status.loadLab']}</AppText>
      <View style={[styles.skel, styles.skelWide]} />
      <View style={styles.skel} />
      <View style={styles.skel} />
    </View>
  );
}
export function ErrorBlock({ id, onRetry, noRetry }: { id: string; onRetry?: () => void; noRetry?: boolean }) {
  return (
    <View style={styles.card} testID={id}>
      <AppText variant="bodyBold" accessibilityRole="alert">
        {IF5_TEXT['SAJU.status.errTitle']}
      </AppText>
      <AppText variant="body">{IF5_TEXT['SAJU.status.errBody']}</AppText>
      {onRetry && !noRetry ? <Button label={IF5_TEXT['SAJU.status.retry']} variant="secondary" onPress={onRetry} testID={`${id}-retry`} /> : null}
    </View>
  );
}
export function RangeBlock({ id, text }: { id: string; text?: string }) {
  return (
    <View style={styles.card} testID={id}>
      <AppText variant="bodyBold">{IF5_TEXT['SAJU.status.rangeTitle']}</AppText>
      <AppText variant="body">{text ?? IF5_TEXT['SAJU.status.rangeBody']}</AppText>
    </View>
  );
}

export const sajuStyles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.s12 },
  gapSmall: { gap: space.s8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
});

const styles = StyleSheet.create({
  ...sajuStyles,
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
  lineRow: { flexDirection: 'row' },
  foldBtn: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  pressed: { opacity: alpha.pressed },
  fold: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.s8, gap: space.s8 },
  foldHead: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  pillars: { flexDirection: 'row', gap: space.s8 },
  pillar: { flex: 1, alignItems: 'center', gap: space.s4, paddingVertical: space.s8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  pillarMe: { borderWidth: 3, borderColor: colors.accent },
  pillarEmpty: { borderStyle: 'dashed', backgroundColor: colors.bg },
  center: { textAlign: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  barName: { width: 36 },
  barTrack: { flex: 1, height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.card },
  barFill: { height: size.barTrait, borderRadius: radius.pill, backgroundColor: colors.accent },
  help: { minWidth: size.touchMin, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  skel: { height: space.s16, borderRadius: radius.sm, backgroundColor: colors.card },
  skelWide: { width: '70%' },
});
