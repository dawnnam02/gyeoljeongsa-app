// IF-SJ-CAL 만세력 달력 · 날짜 고르기(IF5-F1 ③ · F5-07 · 09 · 12 · 디자인 CAL-1 ~ 3 · 정책 PS-35 · PS-36 · PS-71 · PS-72 · 카피 24-6).
//  · 만세력 달력(mode cal): 한 달 달력(앞 · 뒤 달 이동만 · 무한 스크롤 0) · 날짜 칸에 그날의 글자(한글 간지) + 절기 표시 · 쉬어 가는 날은 모양 + 색(색만으로 전하지 않음) · 날짜를 누르면 아래에 그날 한 장
//    계산은 공개 규칙이라 서버 호출 0(내 값 0 — CK17A 꺼짐이어도 볼 수 있다). 음력 날짜는 음양력 표가 없어 보여 주지 않는다(AI 쪽 표 필요 — 넘김)
//  · 날짜 고르기(mode pick): 용도 일곱(이사 · 개업 · 계약 · 면접 · 여행 · 중요한 대화 · 결혼식) 칩 → 서버 get_taekil(건제 12신 하나 · 점수 0) → 달력에 색 두 가지(고르기 좋은 날 · 쉬어 가는 날 · 그 밖은 색 없음)
//    의료 · 소송 · 투자 · 대출 용도 0 · 흉 · 점수 0 · 만남 계획 시트와 연결 0 · 상대 합쳐 보기 · AI 설명(마일리지 30)은 F2
//  · 사주 값이 아닌 공개 달력이지만 디자인대로 캡처를 막는다. 공유 · 복사 · 알림 · 캘린더 내보내기 0
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { Footnote } from '@/features/inflight/If2Parts';
import { tx } from '@/features/inflight/if2Text';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { officer_of } from '@/saju5/saju_calc5';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { SajuApi, Taekil } from './sajuApi';
import { addMonths, calendarLine, dnOf, daysInMonth, inSupport, isoOf, monthGrid, nowIso, pickDayCard, USE_PURPOSE, WEEKDAY_SHORT, weekdayOf, SUPPORT_FROM_ISO, SUPPORT_TO_ISO } from './sajuLogic';
import { sajuServices } from './sajuService';
import { ErrorBlock, RangeBlock, sajuStyles } from './SajuParts';

const REST_OFFICERS = ['위', '폐', '파'];
type Tone = 'good' | 'neutral' | 'rest';

export function SajuCalendarScreen({ api: injected, now, mode: forced, use: forcedUse }: { api?: Pick<SajuApi, 'taekil'>; now?: () => number; mode?: 'cal' | 'pick'; use?: number | null }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; use?: string }>();
  const mode: 'cal' | 'pick' = forced ?? (params.mode === 'pick' ? 'pick' : 'cal');
  const initialUse = forcedUse !== undefined ? forcedUse : params.use !== undefined && /^[0-6]$/.test(String(params.use)) ? Number(params.use) : null;
  const api = useMemo(() => injected ?? sajuServices().api, [injected]);
  const nowFn = now ?? Date.now;
  const today = nowIso(nowFn());
  const [ym, setYm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [sel, setSel] = useState<string | null>(null);
  const [use, setUse] = useState<number | null>(mode === 'pick' ? initialUse : null);
  const [res, setRes] = useState<{ key: string; ok: Taekil | null }>({ key: '', ok: null });
  const [tries, setTries] = useState(0);
  useAlwaysCaptureBlock(true);

  const first = isoOf(ym.y, ym.m, 1);
  const last = isoOf(ym.y, ym.m, daysInMonth(ym.y, ym.m));
  const outOfRangeMonth = last < SUPPORT_FROM_ISO || first > SUPPORT_TO_ISO;
  const want = mode === 'pick' && use !== null && !outOfRangeMonth;
  const reqKey = `${use}|${first}|${tries}`;
  useEffect(() => {
    if (!want || use === null) return undefined;
    let alive = true;
    // 한 달 안에서 지원 범위만(최대 62일 안) — 개인 맞춤 0(p_personal false)이라 시각 · 곳을 보내지 않는다
    void api
      .taekil({ purpose: USE_PURPOSE[use], start: first < SUPPORT_FROM_ISO ? SUPPORT_FROM_ISO : first, end: last > SUPPORT_TO_ISO ? SUPPORT_TO_ISO : last, personal: false, hour: null, minute: null, place: null })
      .then((r) => alive && setRes({ key: reqKey, ok: r.ok ? r.data : null }));
    return () => {
      alive = false;
    };
  }, [api, want, use, first, last, reqKey]);
  const taekil: { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; data: Taekil } | { kind: 'fail' } = !want ? { kind: 'idle' } : res.key !== reqKey ? { kind: 'loading' } : res.ok ? { kind: 'ready', data: res.ok } : { kind: 'fail' };

  const toneOf = (iso: string): Tone | null => {
    if (!inSupport(iso)) return null;
    if (mode === 'cal') return REST_OFFICERS.includes(officer_of(dnOf(iso))) ? 'rest' : 'neutral';
    if (taekil.kind !== 'ready') return null;
    return taekil.data.days.find((d) => d.date === iso)?.tone ?? null;
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/saju' as Href));
  const weeks = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const go = (delta: number) => {
    setYm(addMonths(ym.y, ym.m, delta));
    setSel(null);
  };

  const title = mode === 'pick' ? IF5_TEXT['SAJU.pick.title'] : IF5_TEXT['SAJU.cal.title'];
  const toneLabel = (t: Tone | null): string => (t === 'good' ? IF5_TEXT['SAJU.pick.good'] : t === 'rest' ? IF5_TEXT['SAJU.pick.rest'] : IF5_TEXT['SAJU.pick.plain']);
  const picked = sel && inSupport(sel) ? sel : null;
  const pickedTone = picked ? toneOf(picked) : null;

  return (
    <Screen edges={['top']} testID="screen-saju-cal">
      <ScreenHeader title={title} onBack={back} testID="saju-cal-header" />
      <ScrollView contentContainerStyle={styles.body} testID="saju-cal-scroll">
        <AppText variant="caption" tone="text">
          {IF5_TEXT['SAJU.card.fun']}
        </AppText>
        <AppText variant="caption" testID="saju-cal-capture">
          {IF5_TEXT['SAJU.card.capture']}
        </AppText>
        {mode === 'pick' ? (
          <>
            <AppText variant="body">{IF5_TEXT['SAJU.pick.lead']}</AppText>
            <View style={sajuStyles.wrap}>
              {([0, 1, 2, 3, 4, 5, 6] as const).map((i) => (
                <Chip key={i} label={IF5_TEXT[`SAJU.pick.use.${i}` as const]} variant={use === i ? 'selected' : 'inactive'} onPress={() => (setUse(use === i ? null : i), setSel(null))} testID={`saju-cal-use-${i}`} />
              ))}
            </View>
            {use === null ? <AppText variant="caption" testID="saju-cal-hint">{IF5_TEXT['SAJU.pick.hint']}</AppText> : null}
          </>
        ) : (
          <AppText variant="caption" testID="saju-cal-hint">
            {IF5_TEXT['SAJU.cal.hint']}
          </AppText>
        )}

        <View style={sajuStyles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('MAGAZINE.a11y.prev')} onPress={() => go(-1)} effect="none" style={({ pressed }) => [styles.nav, pressed && styles.pressed]} testID="saju-cal-prev">
            <Icon name="chevron" size={24} color={colors.text} flip />
          </Pressable>
          <AppText variant="bodyBold" style={[sajuStyles.flex, styles.center]} accessibilityRole="header" testID="saju-cal-month">
            {t5('SAJU.cal.month', { 년: ym.y, 월: ym.m })}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('MAGAZINE.a11y.next')} onPress={() => go(1)} effect="none" style={({ pressed }) => [styles.nav, pressed && styles.pressed]} testID="saju-cal-next">
            <Icon name="chevron" size={24} color={colors.text} />
          </Pressable>
        </View>

        {outOfRangeMonth ? (
          <RangeBlock id="saju-cal-range" />
        ) : taekil.kind === 'fail' ? (
          <ErrorBlock id="saju-cal-error" onRetry={() => setTries((n) => n + 1)} />
        ) : (
          <View testID="saju-cal-grid">
            <View style={styles.weekRow}>
              {WEEKDAY_SHORT.map((w) => (
                <AppText key={w} variant="caption" style={styles.cell}>
                  {w}
                </AppText>
              ))}
            </View>
            {weeks.map((wk, wi) => (
              <View key={wi} style={styles.weekRow}>
                {wk.map((c, ci) => {
                  if (!c) return <View key={`e-${wi}-${ci}`} style={styles.cell} />;
                  const t = toneOf(c.iso);
                  const mark = mode === 'pick' ? t : t === 'rest' ? 'rest' : null; // 달력 mode 에선 쉬어 가는 날만 표시
                  const label = `${ym.m}월 ${c.day}일${c.inRange && mode === 'cal' ? `, ${c.ganji}` : ''}${mark === 'rest' ? `, ${IF5_TEXT['SAJU.pick.rest']}` : mark === 'good' ? `, ${IF5_TEXT['SAJU.pick.good']}` : ''}`;
                  return (
                    <Pressable
                      key={c.iso}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel === c.iso }}
                      aria-selected={sel === c.iso}
                      accessibilityLabel={label}
                      disabled={!c.inRange}
                      onPress={() => setSel(c.iso)}
                      effect="none"
                      style={({ pressed }) => [styles.cell, styles.day, mark === 'good' && styles.good, mark === 'rest' && styles.rest, sel === c.iso && styles.picked, pressed && styles.pressed]}
                      testID={`saju-cal-day-${c.day}`}>
                      <AppText variant="smallMedium" style={mark === 'good' ? styles.onAccent : undefined}>
                        {c.day}
                      </AppText>
                      {mode === 'cal' && c.inRange ? <AppText variant="caption" tone="text" importantForAccessibility="no">{c.ganji}</AppText> : null}
                      {mark === 'good' ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                      {mark === 'rest' ? <Icon name="moon" size={14} color={colors.accent} /> : null}
                      {mode === 'cal' && c.jeol ? <Icon name="sun" size={12} color={colors.sub} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <View style={styles.legend} testID="saju-cal-legend">
              {mode === 'pick' ? (
                <>
                  <View style={sajuStyles.row}><View style={styles.legendGood}><Icon name="check" size={14} color={colors.onAccent} /></View><AppText variant="caption">{IF5_TEXT['SAJU.pick.good']}</AppText></View>
                  <AppText variant="caption">{IF5_TEXT['SAJU.pick.plain']}</AppText>
                </>
              ) : (
                <View style={sajuStyles.row}><Icon name="sun" size={12} color={colors.sub} /><AppText variant="caption">{IF5_TEXT['SAJU.cal.legend.jeol']}</AppText></View>
              )}
              <View style={sajuStyles.row}><Icon name="moon" size={14} color={colors.accent} /><AppText variant="caption">{IF5_TEXT['SAJU.pick.rest']}</AppText></View>
            </View>
          </View>
        )}

        {picked ? <DayCard iso={picked} mode={mode} tone={pickedTone} purpose={use === null ? null : USE_PURPOSE[use]} taekil={taekil.kind === 'ready' ? taekil.data : null} toneLabel={toneLabel(pickedTone)} /> : mode === 'pick' && use !== null ? <AppText variant="caption">{IF5_TEXT['SAJU.pick.tap']}</AppText> : null}

        {mode === 'pick' ? <AppText variant="caption">{IF5_TEXT['SAJU.pick.scope']}</AppText> : null}
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.card.end']}</AppText>
        <Footnote text={IF5_TEXT['SAJU.card.footer']} testID="saju-cal-footer" />
      </ScrollView>
    </Screen>
  );
}

function DayCard({ iso, mode, tone, purpose, taekil, toneLabel }: { iso: string; mode: 'cal' | 'pick'; tone: Tone | null; purpose: string | null; taekil: Taekil | null; toneLabel: string }) {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const line = calendarLine(iso);
  const day = taekil?.days.find((x) => x.date === iso) ?? null;
  const pick = mode === 'pick' && purpose && day ? pickDayCard(purpose, day.tone, day.officer, day.clash) : null;
  return (
    <View style={styles.dayCard} testID="saju-cal-day-card">
      <AppText variant="bodyBold" accessibilityRole="header" testID="saju-cal-day-title">
        {t5('SAJU.cal.day.title', { 월: m, 일: d, 요일: weekdayOf(iso) })}
      </AppText>
      <AppText variant="bodyMedium" testID="saju-cal-day-tone">
        {toneLabel}
      </AppText>
      {mode === 'cal' ? <CalDay iso={iso} /> : null}
      {mode === 'cal' && line ? (
        <AppText variant="body" testID="saju-cal-day-line">
          {line.one}
        </AppText>
      ) : null}
      {pick ? (
        <>
          {pick.day ? <AppText variant="body">{pick.day}</AppText> : null}
          {pick.three.slice(0, 2).map((l) => (
            <AppText key={l} variant="body">
              {l}
            </AppText>
          ))}
        </>
      ) : null}
      {tone === null && mode === 'pick' ? <AppText variant="caption">{IF5_TEXT['SAJU.pick.hint']}</AppText> : null}
    </View>
  );
}
function CalDay({ iso }: { iso: string }) {
  const g = monthGrid(Number(iso.slice(0, 4)), Number(iso.slice(5, 7))).flat().find((c) => c?.iso === iso);
  if (!g) return null;
  return (
    <View style={sajuStyles.gapSmall}>
      <AppText variant="body" testID="saju-cal-day-glyph">
        {t5('SAJU.cal.day.glyph', { 글자: g.ganji })}
      </AppText>
      {g.jeol ? (
        <AppText variant="caption" testID="saju-cal-day-jeol">
          {`${IF5_TEXT['SAJU.cal.legend.jeol']} · ${g.jeol}`}
        </AppText>
      ) : (
        <AppText variant="caption" testID="saju-cal-day-nojeol">
          {IF5_TEXT['SAJU.cal.day.noJeol']}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s12 },
  nav: { minWidth: size.touchMin, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: size.touchMin, textAlign: 'center' },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 2 },
  good: { backgroundColor: colors.accent },
  onAccent: { color: colors.onAccent },
  legendGood: { width: 20, height: 20, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  rest: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  picked: { borderWidth: 2, borderColor: colors.text },
  pressed: { opacity: alpha.pressed },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16, paddingTop: space.s8 },
  dayCard: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
});
