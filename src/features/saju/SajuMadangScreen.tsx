// IF-MADANG 사주 마당 한 화면(IF5-F1 ③ · 기능 F5-01 ~ 18 무료 층 · 정책 PS-31 ~ PS-39 · 디자인 HUB-1 · 2 · SUM-1 · 2 · DETAIL-1 · HELP-1).
//  · 새 탭 0 · 탭 밖 화면. 위에서 아래: 머리 → 내 네 기둥 → 내 결 읽기 → 올해 · 이번 달 → 인연 이야기 → 일 · 돈 · 사람 → 인생 계절표 → 날짜 고르기 → 둘이 맞춰 보기 → 만세력 달력 → 읽는 법 → 끝줄
//  · 판단 차례: 스위치 → CK17A → 내 정보 → 범위 → 시각. 범위 밖 · 시각 모름은 그 카드 안에서만 처리(화면 전체를 막지 않음). '시각 모름'은 오류가 아니다 — 경고 색 · 느낌표 0 · 재촉 0
//  · 점수 · 퍼센트 · 판정 · 순위 · 숫자 배지 · 깜빡임 · 무한 스크롤 · 진행 막대 · 새 점 · 공유 · 복사 0. 재회 갈래 0. 결과는 짝 · 줄에 쓰이지 않는다
//  · 마일리지 · AI 호출 0(F2) — 'AI 맞춤' 자리와 사주 이야기 나누기 입구는 이 묶음에 없다. 사주 값이 보이는 동안은 캡처 · 녹화를 막는다(useAlwaysCaptureBlock · 공유 · 복사 단추를 그리지 않는다)
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { IF3_TEXT } from '@/content/if3Copy';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { Footnote } from '@/features/inflight/If2Parts';
import { Ck17Sheet } from '@/features/inflight/If2Sheets';
import { tx } from '@/features/inflight/if2Text';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { colors, radius, size, space } from '@/theme/tokens';

import { inputStore, useInputStore, type InputStore } from './deviceInput';
import { PartnerSheet } from './PartnerSheet';
import { SajuInputSheet } from './SajuInputSheet';
import type { SajuFailCode } from './sajuApi';
import { chartOf, cuspKind, elementBars, loveCard, monthView, pillarCells, pillarsCard, readingCard, seasonRows, tableCard, tableRows, traitCards, workCard, yearView, nowIso, type CardView, type ReadyChart, type ReadyLuck } from './sajuLogic';
import { sajuServices, type SajuDeps } from './sajuService';
import { ElementBars, ErrorBlock, FoldRow, GUIDE_TERMS, GuideSheet, HelpButton, LoadingBlock, PillarTable, RangeBlock, SummaryCard, sajuStyles } from './SajuParts';
import { useCk17, useSajuData } from './useSajuData';

export const SAJU_HREF = '/saju';
export const SAJU_CAL_HREF = '/saju-calendar';

// 앱 기본 연결: 스위치는 훅 하나, 서버 연결은 처음 쓸 때 만든다
export function useSajuDeps(): SajuDeps {
  const { isOn } = useFeatureFlags();
  const svc = sajuServices();
  return useMemo(() => ({ ...svc, isOn }), [svc, isOn]);
}

export function SajuMadangScreen({ deps: injected, store }: { deps?: SajuDeps; store?: InputStore }) {
  return injected ? <Hub deps={injected} store={store} /> : <HubWithDefaults />;
}
function HubWithDefaults() {
  const deps = useSajuDeps();
  const { flags } = useFeatureFlags();
  if (flags.loaded && !deps.isOn('saju_yard')) return <Redirect href={'/boarding' as Href} />; // 스위치 꺼짐: 주소로 와도 홈으로(PF-93 · PS-94)
  return <Hub deps={deps} />;
}

function failIsMissing(code: SajuFailCode): boolean {
  return code === 'feature_off' || code === 'forbidden';
}

function Hub({ deps, store: injectedStore }: { deps: SajuDeps; store?: InputStore }) {
  const router = useRouter();
  const store = injectedStore ?? inputStore();
  const input = useInputStore(store);
  const [loaded, setLoaded] = useState(store.ready());
  useEffect(() => {
    let alive = true;
    void store.load().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [store]);
  const ck = useCk17(deps);
  const enabled = ck.slot.kind === 'on' && loaded && input.answered;
  const data = useSajuData(deps, input, enabled);
  const [sheet, setSheet] = useState<'none' | 'in' | 'ck17' | 'partner'>('none');
  const [term, setTerm] = useState<(typeof GUIDE_TERMS)[number] | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [useIdx, setUseIdx] = useState<number | null>(null);
  const [chip, setChip] = useState<'work' | 'money' | 'people' | 'rest'>('work');
  const [love, setLove] = useState(0);
  const nowFn = deps.now ?? Date.now;
  const today = nowIso(nowFn());

  const chartSlot = data.chart;
  const ready: ReadyChart | null = chartSlot.kind === 'ready' && chartSlot.data.state === 'ready' ? chartSlot.data : null;
  const my = useMemo(() => (ready ? chartOf(ready) : null), [ready]);
  const luck: ReadyLuck | null = data.luck.kind === 'ready' && data.luck.data.state === 'ready' ? data.luck.data : null;
  const dayReady = data.day.kind === 'ready' && data.day.data.state === 'ready' ? data.day.data : null;
  useAlwaysCaptureBlock(my !== null); // 사주 값이 보이는 동안 캡처 · 녹화 막기(보안 IC5-42 · IFF5-22)

  const openIn = () => {
    setSheet('in');
    if (deps.birthDate) void deps.birthDate().then(setBirthDate);
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));
  const on = deps.isOn;

  const cards = useMemo(() => {
    if (!my) return null;
    return {
      pillars: pillarsCard(my),
      reading: readingCard(my),
      love: loveCard(my),
      work: workCard(my, chip),
      year: luck ? yearView(my, luck) : null,
      month: dayReady ? monthView(my, dayReady, dayReady.month) : null,
      season: luck ? seasonRows(my, luck, today) : [],
      traits: traitCards(my),
      table: tableCard(my),
      rows: tableRows(my),
      bars: elementBars(my),
    };
  }, [my, luck, dayReady, chip, today]);

  // ── 개인 카드 묶음 ────────────────────────────────────────────────────────
  const personal = (): React.ReactNode => {
    if (ck.slot.kind === 'loading' || (ck.slot.kind === 'on' && !loaded)) return <LoadingBlock id="saju-loading" />;
    if (ck.slot.kind === 'fail') return <ErrorBlock id="saju-ck-error" onRetry={ck.reload} />;
    if (ck.slot.kind === 'off') {
      // CK17A 꺼짐: 카드 대신 안내 한 줄 + [동의하고 보기](저절로 시트 0)
      return (
        <View style={styles.card} testID="saju-ck17-off">
          <AppText variant="body">{tx('FUN.ck17.offBody')}</AppText>
          <Button label={tx('FUN.ck17.agreeView')} variant="secondary" onPress={() => setSheet('ck17')} testID="saju-ck17-agree" />
        </View>
      );
    }
    if (!input.answered) {
      return (
        <View style={styles.card} testID="saju-empty">
          <AppText variant="body">{IF5_TEXT['SAJU.madang.empty']}</AppText>
          <Button label={IF5_TEXT['SAJU.madang.fillIn']} onPress={openIn} testID="saju-fill" />
        </View>
      );
    }
    if (chartSlot.kind === 'idle' || chartSlot.kind === 'loading') return <LoadingBlock id="saju-loading" />;
    if (chartSlot.kind === 'fail') return failBlock(chartSlot.code);
    if (chartSlot.data.state === 'none') {
      return (
        <View style={styles.card} testID="saju-none">
          <AppText variant="body">{IF5_TEXT['SAJU.status.empty']}</AppText>
          <Button label={IF5_TEXT['SAJU.madang.fillIn']} variant="secondary" onPress={openIn} testID="saju-fill" />
        </View>
      );
    }
    if (chartSlot.data.state === 'out_of_range') return <RangeBlock id="saju-range" text={IF5_TEXT['SAJU.range.before']} />;
    if (!ready || !my || !cards) return <ErrorBlock id="saju-error" onRetry={data.reload} />;
    return (
      <>
        {on('three_pillars') ? pillarsBlock(ready) : null}
        {on('saju_reading') && cards.reading ? <SummaryCard id="saju-kyeol" label={IF5_TEXT['SAJU.kyeol.label']} one={cards.reading.one} lines={cards.reading.three} more={cards.reading.more} /> : null}
        {(on('saju_year') && luck !== null) || (on('saju_calendar') && dayReady) ? <AppText variant="bodyBold" accessibilityRole="header">{IF5_TEXT['SAJU.madang.group.flow']}</AppText> : null}
        {on('saju_year') ? yearBlock() : null}
        {on('saju_calendar') && cards.month ? <SummaryCard id="saju-month" label={IF5_TEXT['SAJU.month.label']} one={cards.month.one} lines={cards.month.three} more={cards.month.more} /> : null}
        {on('saju_reading') && cards.love ? loveBlock(cards.love) : null}
        {on('saju_reading') ? workBlock() : null}
        {on('saju_season') ? seasonBlock() : null}
      </>
    );
  };
  function failBlock(code: SajuFailCode): React.ReactNode {
    if (code === 'consent_required') {
      return (
        <View style={styles.card} testID="saju-fail-consent">
          <AppText variant="body">{tx('FUN.ck17.offBody')}</AppText>
          <Button label={tx('FUN.ck17.agreeView')} variant="secondary" onPress={() => setSheet('ck17')} testID="saju-ck17-agree" />
        </View>
      );
    }
    if (code === 'invalid_value' || code === 'invalid_time') {
      // 내가 넣은 시각 · 곳이 맞지 않음 — 내 정보를 다시 보게 한다(입력 보존)
      return (
        <View style={styles.card} testID={`saju-fail-${code}`}>
          <AppText variant="bodyBold" accessibilityRole="alert">{IF5_TEXT['SAJU.status.errTitle']}</AppText>
          <AppText variant="body">{IF5_TEXT['SAJU.status.errBody']}</AppText>
          <Button label={IF5_TEXT['SAJU.madang.fillIn']} variant="secondary" onPress={openIn} testID="saju-fill" />
        </View>
      );
    }
    return <ErrorBlock id={`saju-fail-${code}`} onRetry={data.reload} noRetry={failIsMissing(code)} />;
  }
  function pillarsBlock(r: ReadyChart): React.ReactNode {
    if (!my || !cards) return null;
    const cusp = cuspKind(r);
    const c = cards.pillars;
    return (
      <SummaryCard
        id="saju-pillars"
        label={IF5_TEXT['SAJU.pillars.title']}
        sub={IF5_TEXT['SAJU.pillars.lead']}
        one={c?.one ?? null}
        lines={c?.three ?? []}
        more={c?.more ?? []}
        top={
          <View style={sajuStyles.gap}>
            <PillarTable cells={pillarCells(r)} id="saju-pillar-table" />
            {cusp ? (
              <AppText variant="caption" tone="text" testID="saju-cusp">
                {cusp === 'year' ? IF3_TEXT['THREE_PILLARS.cusp.ipchun'] : IF3_TEXT['THREE_PILLARS.cusp.month']}
              </AppText>
            ) : null}
            {!r.hourKnown ? (
              <View style={sajuStyles.row} testID="saju-hour-unknown">
                <AppText variant="caption" tone="text" style={sajuStyles.flex}>
                  {IF5_TEXT['SAJU.hour.unknown']}
                </AppText>
                <Button label={IF5_TEXT['SAJU.hour.add']} variant="secondary" inline onPress={openIn} testID="saju-hour-add" />
              </View>
            ) : null}
            <AppText variant="caption">{IF5_TEXT['SAJU.pillars.me']}</AppText>
            <ElementBars bars={cards.bars.bars} lacking={cards.bars.lacking} id="saju-bars" onHelp={() => setTerm(GUIDE_TERMS[1])} />
          </View>
        }
        bottom={
          <View style={sajuStyles.gapSmall}>
            {cards.traits.length > 0 ? (
              <FoldRow id="saju-traits" title={IF5_TEXT['SAJU.pillars.trait.title']} sub={IF5_TEXT['SAJU.pillars.trait.sub']}>
                {cards.traits.map((t) => (
                  <View key={t.code} style={sajuStyles.gapSmall}>
                    <AppText variant="bodyMedium">{t.title}</AppText>
                    <AppText variant="body">{t.text}</AppText>
                  </View>
                ))}
              </FoldRow>
            ) : null}
            <FoldRow id="saju-table" title={IF5_TEXT['SAJU.table.title']} sub={IF5_TEXT['SAJU.table.sub']}>
              <View style={sajuStyles.row}>
                <AppText variant="bodyMedium" style={sajuStyles.flex}>
                  {IF5_TEXT['SAJU.table.row.rel']}
                </AppText>
                <HelpButton onPress={() => setTerm(GUIDE_TERMS[3])} testID="saju-table-help" />
              </View>
              {cards.rows.rel.map((row) => (
                <AppText key={`r-${row.pos}`} variant="body">{`${row.pos} · ${row.text}`}</AppText>
              ))}
              <AppText variant="bodyMedium">{IF5_TEXT['SAJU.table.row.stage']}</AppText>
              {cards.rows.stage.map((row) => (
                <AppText key={`s-${row.pos}`} variant="body">{`${row.pos} · ${row.text}`}</AppText>
              ))}
              <AppText variant="caption">{IF5_TEXT['SAJU.table.neutral']}</AppText>
            </FoldRow>
          </View>
        }
      />
    );
  }
  function yearBlock(): React.ReactNode {
    if (data.luck.kind === 'loading') return <LoadingBlock id="saju-year-loading" />;
    if (data.luck.kind === 'fail') return <ErrorBlock id="saju-year-error" onRetry={data.reload} noRetry={failIsMissing(data.luck.code)} />;
    if (!cards?.year?.year) return null;
    const y = cards.year;
    const months = [
      y.best.length ? t5('SAJU.year.best', { '달 목록': y.best.map((m) => `${m}월`).join(', ') }) : null,
      y.rest.length ? t5('SAJU.year.rest', { '달 목록': y.rest.map((m) => `${m}월`).join(', ') }) : null,
    ].filter((x): x is string => !!x);
    return (
      <SummaryCard id="saju-year" label={IF5_TEXT['SAJU.year.label']} one={y.year?.one ?? null} lines={y.year?.three ?? []} more={y.year?.more ?? []}>
        {y.zodiac?.one ? <AppText variant="body">{y.zodiac.one}</AppText> : null}
        {months.length > 0 ? (
          <View style={sajuStyles.gapSmall}>
            <AppText variant="bodyMedium">{IF5_TEXT['SAJU.year.mtitle']}</AppText>
            {months.map((m) => (
              <AppText key={m} variant="body">
                {m}
              </AppText>
            ))}
          </View>
        ) : null}
      </SummaryCard>
    );
  }
  function loveBlock(c: CardView): React.ReactNode {
    // 조각 표 F5-03 의 펼침: [소개, 썸, 오래 만남, 결혼 얘기, 맺음] — 칩이 가르는 줄은 가운데 셋(재회 갈래 0 · 결혼 시기 단정 0)
    const staged = c.more.length === 5;
    const chips = ['SAJU.love.c1', 'SAJU.love.c2', 'SAJU.love.c3'] as const;
    return (
      <SummaryCard
        id="saju-love"
        label={IF5_TEXT['SAJU.love.label']}
        one={c.one}
        lines={c.three}
        more={staged ? [c.more[0], c.more[4]] : c.more}
        top={
          staged ? (
            <View style={sajuStyles.gapSmall}>
              <AppText variant="bodyMedium">{IF5_TEXT['SAJU.love.lab2']}</AppText>
              <View style={sajuStyles.wrap}>
                {chips.map((k, i) => (
                  <Chip key={k} label={IF5_TEXT[k]} variant={love === i ? 'selected' : 'inactive'} onPress={() => setLove(i)} testID={`saju-love-chip-${i}`} />
                ))}
              </View>
              <AppText variant="body" testID="saju-love-stage">
                {c.more[1 + love]}
              </AppText>
            </View>
          ) : null
        }
      />
    );
  }
  function workBlock(): React.ReactNode {
    const chips = [
      ['work', 'SAJU.work.c1'],
      ['money', 'SAJU.work.c2'],
      ['people', 'SAJU.work.c3'],
      ['rest', 'SAJU.work.c4'],
    ] as const;
    const c: CardView | null = cards?.work ?? null;
    if (!c) return null;
    const label = chips.find(([k]) => k === chip);
    return (
      <SummaryCard
        id="saju-work"
        label={IF5_TEXT['SAJU.work.label']}
        one={c.one}
        lines={c.three}
        more={c.more}
        top={
          <View style={sajuStyles.gapSmall}>
            <View style={sajuStyles.wrap}>
              {chips.map(([k, key]) => (
                <Chip key={k} label={IF5_TEXT[key]} variant={chip === k ? 'selected' : 'inactive'} onPress={() => setChip(k)} testID={`saju-work-chip-${k}`} />
              ))}
            </View>
            {label ? <AppText variant="bodyMedium">{t5('SAJU.work.lab2', { '칩 이름': IF5_TEXT[label[1]] })}</AppText> : null}
          </View>
        }
      />
    );
  }
  function seasonBlock(): React.ReactNode {
    if (!cards || cards.season.length === 0) return null;
    return (
      <View style={styles.card} testID="saju-season">
        <AppText variant="bodyBold" accessibilityRole="header">
          {IF5_TEXT['SAJU.life.title']}
        </AppText>
        <AppText variant="caption">{IF5_TEXT['SAJU.life.sub']}</AppText>
        {cards.season.map((r) => (
          <View key={r.index} style={[styles.seasonRow, r.current && styles.seasonNow]} testID={`saju-season-${r.index}`}>
            <AppText variant={r.current ? 'bodyBold' : 'body'} style={sajuStyles.flex}>
              {`${r.ageFrom ?? ''}세 ~ ${r.ageTo ?? ''}세 · ${r.label ?? ''}`}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Screen edges={['top']} testID="screen-saju">
      <ScreenHeader title={IF5_TEXT['SAJU.madang.title']} onBack={back} testID="saju-header" />
      <ScrollView contentContainerStyle={styles.body} testID="saju-scroll">
        <View style={sajuStyles.row}>
          <AppText variant="caption" tone="text" style={sajuStyles.flex} testID="saju-fun">
            {IF5_TEXT['SAJU.card.fun']}
          </AppText>
          <View style={styles.pill}>
            <Icon name="security" size={16} color={colors.accent} />
            <AppText variant="captionMedium" tone="accent">
              {IF5_TEXT['SAJU.madang.only']}
            </AppText>
          </View>
        </View>
        <AppText variant="body" testID="saju-head">
          {IF5_TEXT['SAJU.madang.head']}
        </AppText>
        <AppText variant="caption" testID="saju-not-used">
          {IF5_TEXT['SAJU.madang.notUsed']}
        </AppText>
        {my ? (
          <AppText variant="caption" testID="saju-capture">
            {IF5_TEXT['SAJU.card.capture']}
          </AppText>
        ) : null}

        {personal()}

        {on('saju_pickday') ? pickBlock() : null}
        {on('saju_partner') && ck.slot.kind === 'on' ? partnerBlock() : null}
        {on('saju_calendar') ? calBlock() : null}
        {on('read_guide') ? guideBlock() : null}

        <AppText variant="bodyMedium" testID="saju-end">
          {IF5_TEXT['SAJU.card.end']}
        </AppText>
        <Footnote text={IF5_TEXT['SAJU.card.footer']} testID="saju-footer" />
      </ScrollView>

      <SajuInputSheet
        visible={sheet === 'in'}
        store={store}
        current={input}
        birthDate={birthDate}
        onClose={() => setSheet('none')}
        onSaved={() => {
          setSheet('none');
          data.reload();
        }}
      />
      <PartnerSheet visible={sheet === 'partner'} mine={my} today={() => nowIso(nowFn())} onClose={() => setSheet('none')} />
      <Ck17Sheet
        visible={sheet === 'ck17'}
        onClose={() => setSheet('none')}
        onSave={async (a, b) => {
          const r = await deps.ck17.record(a, b, 'feature_sheet');
          if (r.ok) {
            setSheet('none');
            ck.reload();
          }
          return r.ok;
        }}
      />
      <GuideSheet term={term} onClose={() => setTerm(null)} />
    </Screen>
  );

  function pickBlock(): React.ReactNode {
    return (
      <View style={styles.card} testID="saju-pick">
        <AppText variant="bodyBold" accessibilityRole="header">
          {IF5_TEXT['SAJU.pick.title']}
        </AppText>
        <AppText variant="body">{IF5_TEXT['SAJU.pick.lead']}</AppText>
        <View style={sajuStyles.wrap}>
          {([0, 1, 2, 3, 4, 5, 6] as const).map((i) => (
            <Chip key={i} label={IF5_TEXT[`SAJU.pick.use.${i}` as const]} variant={useIdx === i ? 'selected' : 'inactive'} onPress={() => setUseIdx(useIdx === i ? null : i)} testID={`saju-pick-use-${i}`} />
          ))}
        </View>
        <AppText variant="caption">{IF5_TEXT['SAJU.pick.hint']}</AppText>
        <Button label={IF5_TEXT['SAJU.pick.open']} variant="secondary" onPress={() => router.push({ pathname: SAJU_CAL_HREF, params: useIdx === null ? { mode: 'pick' } : { mode: 'pick', use: String(useIdx) } } as unknown as Href)} testID="saju-pick-open" />
        <AppText variant="caption">{IF5_TEXT['SAJU.pick.scope']}</AppText>
      </View>
    );
  }
  function partnerBlock(): React.ReactNode {
    return (
      <View style={styles.card} testID="saju-partner-card">
        <AppText variant="bodyBold" accessibilityRole="header">
          {IF5_TEXT['SAJU.partner.card']}
        </AppText>
        <AppText variant="body">{IF5_TEXT['SAJU.madang.card.pair']}</AppText>
        <Button label={IF5_TEXT['SAJU.partner.title']} variant="secondary" disabled={!my} onPress={() => setSheet('partner')} testID="saju-partner-open" />
      </View>
    );
  }
  function calBlock(): React.ReactNode {
    return (
      <View style={styles.card} testID="saju-cal-card">
        <AppText variant="bodyBold" accessibilityRole="header">
          {IF5_TEXT['SAJU.cal.title']}
        </AppText>
        <AppText variant="body">{IF5_TEXT['SAJU.madang.card.cal']}</AppText>
        <Button label={IF5_TEXT['SAJU.cal.open']} variant="secondary" onPress={() => router.push({ pathname: SAJU_CAL_HREF, params: { mode: 'cal' } } as unknown as Href)} testID="saju-cal-open" />
      </View>
    );
  }
  function guideBlock(): React.ReactNode {
    return (
      <View style={styles.card} testID="saju-guide-card">
        <AppText variant="bodyBold" accessibilityRole="header">
          {IF5_TEXT['SAJU.guide.title']}
        </AppText>
        <AppText variant="body">{IF5_TEXT['SAJU.guide.lead']}</AppText>
        {GUIDE_TERMS.map((t, i) => (
          <View key={t.key} style={sajuStyles.row}>
            <AppText variant="body" style={sajuStyles.flex}>
              {IF5_TEXT[t.key]}
            </AppText>
            <HelpButton onPress={() => setTerm(t)} testID={`saju-guide-help-${i}`} />
          </View>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s16 },
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s12, paddingVertical: space.s4, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  seasonRow: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s8, borderRadius: radius.md },
  seasonNow: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
});
