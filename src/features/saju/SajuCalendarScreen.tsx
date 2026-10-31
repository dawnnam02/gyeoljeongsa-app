// IF-SJ-CAL 만세력 달력 · 날짜 고르기(IF5-F1 ③ · F5-07 · 09 · 12 · 디자인 CAL-1 ~ 3 · 정책 PS-35 · PS-36 · PS-71 · PS-72 · 카피 24-6).
//  · 만세력 달력(mode cal): 한 달 달력(앞 · 뒤 달 이동만 · 무한 스크롤 0) · 날짜 칸에 그날의 글자(한글 간지) + 절기 표시 · 쉬어 가는 날은 모양 + 색(색만으로 전하지 않음) · 날짜를 누르면 아래에 그날 한 장
//    계산은 공개 규칙이라 서버 호출 0(내 값 0 — CK17A 꺼짐이어도 볼 수 있다). 음력 날짜는 음양력 표(saju5/lunar5 · 1960 ~ 2051)로 그날 한 장에 한 줄(IF5-F1b ⓐ) · 표 밖이면 줄 숨김
//  · 날짜 고르기(mode pick): 용도 일곱(이사 · 개업 · 계약 · 면접 · 여행 · 중요한 대화 · 결혼식) 칩 → 서버 get_taekil(건제 12신 하나 · 점수 0) → 달력에 색 두 가지(고르기 좋은 날 · 쉬어 가는 날 · 그 밖은 색 없음)
//    의료 · 소송 · 투자 · 대출 용도 0 · 흉 · 점수 0 · 만남 계획 시트와 연결 0 · AI 설명(마일리지 30)은 F2 · 상대와 함께 보기(IF5-F1c): 두 사람 모두 그날의 글자와 부딪히지 않고 쉬어 가는 날도 아닌 '함께 무난한 날'만 표시(내 일지 + 상대 일지 숫자 하나 · 기기 안 계산 · 점수 · 판정 · 이유 칸 · 이름 · 저장 0)
//  · 사주 값이 아닌 공개 달력이지만 디자인대로 캡처를 막는다. 공유 · 복사 · 알림 · 캘린더 내보내기 0
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Toggle } from '@/components/Toggle';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { Footnote } from '@/features/inflight/If2Parts';
import { tx } from '@/features/inflight/if2Text';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { day_branch_of_pillar, pair_ok_days_iso } from '@/saju5/pair5';
import { officer_of } from '@/saju5/saju_calc5';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { SajuApi, Taekil } from './sajuApi';
import { addMonths, calendarLine, dnOf, daysInMonth, idx60, inSupport, isoOf, lunarOf, monthGrid, nowIso, pickDayCard, USE_PURPOSE, WEEKDAY_SHORT, weekdayOf, SUPPORT_FROM_ISO, SUPPORT_TO_ISO } from './sajuLogic';
import { sajuServices } from './sajuService';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { AiBlock } from './ai/AiBlock';
import { taekilFacts } from './ai/aiFacts';
import { aiServices, type AiServices } from './ai/aiService';
import type { If5ConsentStore } from '@/features/consent/if5Consent';
import { If5Icon } from './If5Icon';
import { PartnerSheet } from './PartnerSheet';
import { ErrorBlock, RangeBlock, sajuStyles } from './SajuParts';

const REST_OFFICERS = ['위', '폐', '파'];
type Tone = 'good' | 'neutral' | 'rest';

export function SajuCalendarScreen({ api: injected, now, mode: forced, use: forcedUse, ai: injectedAi, consent }: { api?: Pick<SajuApi, 'taekil'> & Partial<Pick<SajuApi, 'chart'>>; now?: () => number; mode?: 'cal' | 'pick'; use?: number | null; ai?: AiServices | null; consent?: If5ConsentStore }) {
  const ai = useMemo(() => {
    if (injectedAi !== undefined) return injectedAi;
    try {
      return aiServices();
    } catch {
      return null;
    }
  }, [injectedAi]);

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
  // 상대와 함께 보기(IF5-F1c): 상대 생일은 시트에서만 입력하고 이 화면은 '상대의 일지 숫자 하나(0 ~ 11)'만 메모리에 둔다(생일 · 기둥 · 간지 0 · 저장 0 · 서버 전송 0 · 이 화면을 떠나거나 앱이 뒤로 가면 버린다)
  //  내 일지도 숫자 하나 — 서버가 준 내 원국의 일주에서만 구하고(day_branch_of_pillar), 원국이 없으면(동의 안 함 · 미입력) 함께 보기 전에 '먼저 내 정보를 넣어 주세요'를 안내한다
  const [partner, setPartner] = useState<number | null>(null);
  const [combine, setCombine] = useState(false);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [mine, setMine] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; branch: number } | { kind: 'missing' } | { kind: 'fail' }>({ kind: 'idle' });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') {
        setPartner(null);
        setCombine(false);
      }
    });
    return () => sub.remove();
  }, []);
  // [상대 생일 넣기]를 누르면 내 원국 일주부터 읽는다(서버 get_my_saju 한 번 · 시각 · 곳은 보내지 않음). 읽히면 시트를 열고, 없으면 안내만 한다
  const openPartner = () => {
    if (mine.kind === 'ready') return setPartnerOpen(true);
    if (mine.kind === 'loading') return undefined;
    if (!api.chart) return setMine({ kind: 'missing' });
    setMine({ kind: 'loading' });
    void api.chart({ hour: null, minute: null, place: null }).then((r) => {
      if (!r.ok) return setMine({ kind: r.code === 'consent_required' || r.code === 'forbidden' || r.code === 'feature_off' ? 'missing' : 'fail' } as const);
      if (r.data.state !== 'ready') return setMine({ kind: 'missing' });
      const idx = idx60(r.data.day.stem, r.data.day.branch);
      if (idx < 0) return setMine({ kind: 'fail' });
      setMine({ kind: 'ready', branch: day_branch_of_pillar(idx) });
      return setPartnerOpen(true);
    });
    return undefined;
  };

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
  // 함께 무난한 날: 두 사람 모두 그날 일진과 부딪히지 않고(내 일지 · 상대 일지) 쉬어 가는 날도 아닌 날 — 날마다 both_ok 하나(점수 · 판정 · 이유 0)
  const bothSet = useMemo(() => {
    const set = new Set<string>();
    if (mode !== 'pick' || !combine || partner === null || mine.kind !== 'ready' || use === null || outOfRangeMonth) return set;
    try {
      const from = first < SUPPORT_FROM_ISO ? SUPPORT_FROM_ISO : first;
      const to = last > SUPPORT_TO_ISO ? SUPPORT_TO_ISO : last;
      for (const d of pair_ok_days_iso(from, to, USE_PURPOSE[use], mine.branch, partner)) if (d.both_ok) set.add(d.date);
    } catch {
      /* 계산 못 한 달은 표시하지 않는다 */
    }
    return set;
  }, [mode, combine, partner, mine, use, first, last, outOfRangeMonth]);
  const bothOk = (iso: string): boolean => bothSet.has(iso);
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
            {mine.kind === 'missing' ? (
              // 내 원국이 없다(동의 안 함 · 미입력): 상대 생일을 받기 전에 내 칸부터 — 기존 글 '먼저 내 정보를 넣어 주세요' + [내 정보 넣기](사주 마당으로)
              <View style={sajuStyles.gapSmall} testID="saju-cal-mine-missing">
                <AppText variant="caption">{IF5_TEXT['SAJU.status.empty']}</AppText>
                <Button label={IF5_TEXT['SAJU.madang.fillIn']} variant="secondary" onPress={() => router.push('/saju' as Href)} testID="saju-cal-mine-fill" />
              </View>
            ) : partner === null ? (
              <View style={sajuStyles.gapSmall} testID="saju-cal-partner-need">
                <AppText variant="caption">{IF5_TEXT['SAJU.pick.partner.need']}</AppText>
                {mine.kind === 'fail' ? <AppText variant="caption" accessibilityRole="alert" testID="saju-cal-mine-fail">{IF5_TEXT['SAJU.status.errBody']}</AppText> : null}
                <Button label={IF5_TEXT['SAJU.partner.title']} variant="secondary" disabled={mine.kind === 'loading'} onPress={openPartner} testID="saju-cal-partner-open" />
              </View>
            ) : (
              <View style={sajuStyles.gapSmall} testID="saju-cal-partner">
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={IF5_TEXT['SAJU.pick.partner.toggle']}
                  accessibilityState={{ checked: combine }}
                  aria-checked={combine}
                  onPress={() => setCombine(!combine)}
                  effect="none"
                  style={({ pressed }) => [sajuStyles.row, styles.toggleRow, pressed && styles.pressed]}
                  testID="saju-cal-partner-toggle">
                  <AppText variant="bodyMedium" style={sajuStyles.flex}>
                    {IF5_TEXT['SAJU.pick.partner.toggle']}
                  </AppText>
                  <Toggle on={combine} />
                </Pressable>
                <AppText variant="caption">{IF5_TEXT['SAJU.pick.partner.hint']}</AppText>
              </View>
            )}
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
          <View style={styles.gridWrap} testID="saju-cal-grid">
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
                  const both = c.inRange && bothOk(c.iso);
                  const label = `${ym.m}월 ${c.day}일${c.inRange && mode === 'cal' ? `, ${c.ganji}` : ''}${both ? `, ${IF5_TEXT['SAJU.pick.partner.both']}` : mark === 'rest' ? `, ${IF5_TEXT['SAJU.pick.rest']}` : mark === 'good' ? `, ${IF5_TEXT['SAJU.pick.good']}` : ''}`;
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
                      style={({ pressed }) => [styles.cell, styles.day, mark === 'good' && styles.good, mark === 'rest' && styles.rest, both && (mark === 'good' ? styles.bothGood : styles.bothOk), sel === c.iso && styles.picked, pressed && styles.pressed]}
                      testID={`saju-cal-day-${c.day}`}>
                      <AppText variant="smallMedium" style={mark === 'good' ? styles.onAccent : undefined}>
                        {c.day}
                      </AppText>
                      {mode === 'cal' && c.inRange ? <AppText variant="caption" tone="text" importantForAccessibility="no">{c.ganji}</AppText> : null}
                      {mark === 'good' || both ? (
                        <View style={styles.marks}>
                          {mark === 'good' ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                          {both ? <If5Icon name="diamond" size={14} color={mark === 'good' ? colors.onAccent : colors.accent} testID={`saju-cal-both-${c.day}`} /> : null}
                        </View>
                      ) : null}
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
              {mode === 'pick' && combine && partner ? (
                <View style={sajuStyles.row} testID="saju-cal-legend-both"><View style={[styles.legendBoth]}><If5Icon name="diamond" size={14} color={colors.accent} /></View><AppText variant="caption">{IF5_TEXT['SAJU.pick.partner.both']}</AppText></View>
              ) : null}
            </View>
          </View>
        )}

        {picked ? <DayCard iso={picked} mode={mode} tone={pickedTone} purpose={use === null ? null : USE_PURPOSE[use]} taekil={taekil.kind === 'ready' ? taekil.data : null} toneLabel={toneLabel(pickedTone)} /> : mode === 'pick' && use !== null ? <AppText variant="caption">{IF5_TEXT['SAJU.pick.tap']}</AppText> : null}

        {mode === 'pick' && ai && use !== null && taekil.kind === 'ready' && taekil.data.days.length > 0 ? <PickAi ai={ai} purpose={USE_PURPOSE[use]} taekil={taekil.data} /> : null}
        {mode === 'pick' ? <AppText variant="caption">{IF5_TEXT['SAJU.pick.scope']}</AppText> : null}
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.card.end']}</AppText>
        <Footnote text={IF5_TEXT['SAJU.card.footer']} testID="saju-cal-footer" />
      </ScrollView>
      {mode === 'pick' ? <PartnerSheet visible={partnerOpen} mine={null} today={() => today} onClose={() => setPartnerOpen(false)} consent={consent} pick={(r) => (setPartner(r.branch), setCombine(true))} testID="saju-cal-partner-sheet" /> : null}
    </Screen>
  );
}

/** 날짜 설명(AI 맞춤 · 마일리지 30 · 확인 시트 0) — 스위치 saju_ai 가 켜졌을 때만. 스위치 훅은 AI 연결이 있을 때만 이 칸이 부른다 */
function PickAi({ ai, purpose, taekil }: { ai: AiServices; purpose: string; taekil: Taekil }) {
  const { isOn } = useFeatureFlags();
  if (!isOn('saju_ai')) return null;
  return <AiBlock id="saju-pick" kind="taekil" svc={ai} buttonLabel={IF5_TEXT['SAJU.pick.ai']} facts={() => taekilFacts(purpose, taekil)} />;
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
  const lunar = lunarOf(iso); // 음양력 표 범위(1960 ~ 2051) 밖이면 줄째 숨김 · 경계 달 단서 0 · 윤달이면 '음력 윤{월}월 {일}일'(IF5-F1c)
  return (
    <View style={sajuStyles.gapSmall}>
      {lunar ? (
        <AppText variant="body" testID="saju-cal-day-lunar">
          {t5(lunar.leap ? 'SAJU.cal.day.lunarLeap' : 'SAJU.cal.day.lunar', { 월: lunar.month, 일: lunar.day })}
        </AppText>
      ) : null}
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
  gridWrap: { marginHorizontal: -space.s12 }, // 360 폭에서도 날짜 칸 가로 49 이상(디자인 CAL — 화면 여백 20 → 8)
  weekRow: { flexDirection: 'row' },
  cell: { width: '14.2857%', minHeight: size.touchMin, textAlign: 'center' }, // 7칸 같은 너비 — flex:1 이면 테두리(2px · 1px)가 있는 칸이 그만큼 넓어져 테두리 없는 칸이 48 아래로 줄어든다(IF5-F1c 함께 보기)
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: space.s4 },
  good: { backgroundColor: colors.accent },
  onAccent: { color: colors.onAccent },
  legendGood: { width: 20, height: 20, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { minHeight: size.touchMin },
  legendBoth: { width: 20, height: 20, borderRadius: radius.sm, backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bothOk: { backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, borderStyle: 'solid' },
  bothGood: { borderWidth: 2, borderColor: colors.text, borderStyle: 'solid' },
  marks: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  rest: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  picked: { borderWidth: 2, borderColor: colors.text },
  pressed: { opacity: alpha.pressed },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s16, paddingTop: space.s8 },
  dayCard: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
});
