// IF-MAG 기내지(F-08 · F-02) + IF-CARD 이번 주 카드(F-09) — 정책 PF-21 ~ PF-25 · 화면_요구사항 IF-MAG · IF-CARD · 카피 21-3 · 21-4.
//  · 그 회차 탑승객만 · 목 09:00 ~ 수 18:00 · 표지 + 6쪽을 가로로 넘김(끝 쪽 뒤 넘김 0) · 쪽 이름만(쪽 번호 · 진행 점 0) · 머리 대신 [닫기] · 푸시 0
//  · ① 하늘과 결 = CK17A 켠 분만(아니면 안내 한 줄 · 그 쪽을 처음 볼 때만 동의 시트 · 되풀이 0) · ② 이번 주 카드 = 세 장 가운데 한 장(서버가 고른 자리를 먼저 저장 — 다시 뽑기 0)
//  · 쪽마다 끝줄(① ② ④ ⑤ 재미 끝줄 · ③ 연애 이야기 끝줄 · ⑥ AI 작성 알림 — PF-04 · PF-20) · 글은 IF2 글 + AI 라이브러리(id) · AI 호출 0
//  · 내 별자리 이름은 나만 보는 기내지에서만(PF-14) · 일간 글자 · 큰 한자 · 부적 꼴 0
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { Rise, TOAST_MS } from '@/motion';
import { if2Look } from '@/theme/if2Look';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { InflightApi, Magazine, PreQuestions, WeekCard } from './inflightApi';
import { columnOf, element5Name, questionText, sajuText, signName, stemIntro, tarotOf, zodiacText } from './if2Library';
import { MAG_PAGES, tripOf, type MagPage } from './inflightLogic';
import { Art, artXml, Footnote, if2Styles, tarotXml } from './If2Parts';
import { Ck17Sheet, PreAnswerSheet } from './If2Sheets';
import { tx } from './if2Text';
import type { Ck17Api } from './inflightService';

export type MagazineDeps = { api: Pick<InflightApi, 'magazine' | 'weekCard' | 'pickWeekCard' | 'preQuestions'>; ck17: Ck17Api; preOn?: boolean };
const asked = new Set<string>(); // ① 쪽 동의 시트를 이번 실행에 띄운 호(되풀이 0 — 기기 저장 0)
const GRAIN: Readonly<Record<string, 'grainWood' | 'grainFire' | 'grainEarth' | 'grainMetal' | 'grainWater'>> = { wood: 'grainWood', fire: 'grainFire', earth: 'grainEarth', metal: 'grainMetal', water: 'grainWater' };
const pageName = (p: MagPage) =>
  p === 'cover' ? tx('MAGAZINE.cover.issue') : p === 'skyGrain' ? tx('MAGAZINE.page.skyGrain') : p === 'card' ? tx('MAGAZINE.page.card') : p === 'love' ? tx('MAGAZINE.page.love') : p === 'question' ? tx('MAGAZINE.page.question') : p === 'place' ? tx('MAGAZINE.page.place') : tx('MAGAZINE.page.back');

export function MagazineScreen({ deps }: { deps: MagazineDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string; round?: string }>();
  const [mag, setMag] = useState<Magazine | 'loading' | 'failed'>('loading');
  const [card, setCard] = useState<WeekCard | null>(null);
  const [pre, setPre] = useState<PreQuestions | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState<'none' | 'ck17' | 'pre'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const pager = useRef<ScrollView>(null);
  const startPage = params.page === 'card' ? MAG_PAGES.indexOf('card') : 0;
  const round = Number(params.round ?? '0') || 0;

  const fetchAll = useCallback(() => {
    void deps.api.magazine().then((r) => setMag(r.ok ? r.data : r.code === 'off' ? { state: 'none' } : 'failed'));
    void deps.api.weekCard().then((r) => setCard(r.ok ? r.data : null));
    if (deps.preOn) void deps.api.preQuestions().then((r) => setPre(r.ok ? r.data : null));
  }, [deps.api, deps.preOn]);
  useEffect(fetchAll, [fetchAll]);
  const load = () => {
    setMag('loading');
    fetchAll();
  };
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const issued = typeof mag === 'object' && mag.state === 'issued' ? mag : null;
  const trip = issued ? (tripOf(issued.tripNo) ?? '') : '';
  // ① 하늘과 결 쪽을 처음 볼 때만 동의 시트(CK17A 꺼짐 · 되풀이 0) — 쪽을 옮기는 순간에 판단
  const arrive = (next: number) => {
    setPage(next);
    if (!issued || issued.ck17a || MAG_PAGES[next] !== 'skyGrain' || !issued.issueDate || asked.has(issued.issueDate)) return;
    asked.add(issued.issueDate);
    setSheet('ck17');
  };
  const goTo = (n: number) => {
    const next = Math.max(0, Math.min(MAG_PAGES.length - 1, n));
    arrive(next);
    pager.current?.scrollTo({ x: next * width, animated: true });
    AccessibilityInfo.announceForAccessibility?.(tx('MAGAZINE.a11y.page', { '쪽 이름': pageName(MAG_PAGES[next]), 여행지: trip }));
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth(w);
    if (startPage > 0 && page === 0) {
      setPage(startPage);
      setTimeout(() => pager.current?.scrollTo({ x: startPage * w, animated: false }), 0);
    }
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) arrive(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/boarding' as Href));

  const head = (
    <View style={styles.head}>
      <AppText variant="captionMedium" tone="sub" style={if2Styles.flex} testID="mag-page-name">
        {issued ? pageName(MAG_PAGES[page]) : ''}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={tx('MAGAZINE.a11y.close')} onPress={close} effect="none" style={({ pressed }) => [styles.close, pressed && styles.pressed]} testID="mag-close">
        <AppText variant="bodyMedium" tone="accent">
          {tx('MAGAZINE.close')}
        </AppText>
      </Pressable>
    </View>
  );

  if (!issued) {
    const m = typeof mag === 'object' ? mag : null;
    return (
      <Screen edges={['top']} testID="screen-mag">
        {head}
        <View style={styles.center} testID={`mag-${mag === 'loading' ? 'loading' : mag === 'failed' ? 'failed' : (m?.state ?? 'none')}`}>
          {mag === 'loading' ? <AppText variant="caption">{tx('MAGAZINE.cover.issue')}</AppText> : null}
          {mag === 'failed' ? (
            <>
              <AppText variant="body" tone="sub" accessibilityRole="alert">
                {tx('MAGAZINE.loadFailed')}
              </AppText>
              <Button label={BOARDING.retry} variant="secondary" inline onPress={load} testID="mag-retry" />
            </>
          ) : null}
          {m?.state === 'not_yet' ? <AppText variant="body">{tx('MAGAZINE.notYet')}</AppText> : null}
          {m?.state === 'none' ? (
            <>
              <AppText variant="body">{tx('MAGAZINE.closed')}</AppText>
              <Button label={tx('MAGAZINE.toHome')} variant="secondary" inline onPress={() => router.replace('/boarding' as Href)} testID="mag-home" />
            </>
          ) : null}
        </View>
      </Screen>
    );
  }

  const pageBody = (p: MagPage) => {
    switch (p) {
      case 'cover':
        return (
          <View style={styles.page} accessible accessibilityLabel={tx('MAGAZINE.a11y.cover', { 여행지: trip })} testID="mag-cover">
            <Art xml={artXml('cover')} width="100%" height={styles.art.height} />
            <AppText variant="caption">{tx('MAGAZINE.cover.kicker', { 여행지: trip })}</AppText>
            <AppText variant="heading">{tx('MAGAZINE.cover.issue')}</AppText>
            <AppText variant="small" tone="sub">
              {tx('MAGAZINE.cover.hint')}
            </AppText>
          </View>
        );
      case 'skyGrain':
        return (
          <View style={styles.page} testID="mag-sky">
            <AppText variant="title">{tx('MAGAZINE.page.skyGrain')}</AppText>
            {issued.sky && issued.grain ? (
              <>
                <AppText variant="bodyBold">{tx('MAGAZINE.page.sky')}</AppText>
                <AppText variant="caption">{tx('MAGAZINE.page.skySub')}</AppText>
                <Art xml={artXml('constellation')} width="100%" height={styles.small.height} />
                <AppText variant="captionMedium" tone="accent" testID="mag-sign">
                  {signName(issued.sky.sign) ?? ''}
                </AppText>
                <AppText variant="body">{zodiacText(issued.sky.zodiac) ?? ''}</AppText>
                <View style={if2Styles.section}>
                  <AppText variant="bodyBold">{tx('MAGAZINE.page.grain')}</AppText>
                  <AppText variant="caption">{tx('MAGAZINE.page.grainSub')}</AppText>
                  {issued.weekElement && GRAIN[issued.weekElement] ? <Art xml={artXml(GRAIN[issued.weekElement])} width="100%" height={styles.grain.height} /> : null}
                  <AppText variant="captionMedium" tone="accent">
                    {element5Name(stemElement(issued.grain.stem)) ?? ''}
                  </AppText>
                  <AppText variant="body">{stemIntro(issued.grain.stem) ?? ''}</AppText>
                  <AppText variant="body">{sajuText(issued.grain.saju) ?? ''}</AppText>
                </View>
              </>
            ) : (
              <View style={if2Styles.gapSmall} testID="mag-ck17-off">
                <AppText variant="body">{tx('FUN.ck17.offBody')}</AppText>
                <TextButton label={tx('FUN.ck17.link')} align="start" onPress={() => openSettingsPage(router, 'consent-management')} testID="mag-ck17-link" />
              </View>
            )}
            <Footnote text={tx('FUN.footer')} testID="mag-sky-footer" />
          </View>
        );
      case 'card':
        return <WeekCardView card={card} api={deps.api} onCard={setCard} />;
      case 'love': {
        const col = issued.column ? columnOf(issued.column) : null;
        return (
          <View style={styles.page} testID="mag-love">
            <AppText variant="title">{tx('MAGAZINE.page.love')}</AppText>
            <AppText variant="caption">{tx('MAGAZINE.page.loveSub')}</AppText>
            {col ? (
              <>
                <AppText variant="bodyBold">{col.title}</AppText>
                {col.body.map((b) => (
                  <AppText key={b} variant="body">
                    {b}
                  </AppText>
                ))}
              </>
            ) : null}
            <Footnote text={tx('MAGAZINE.love.footer')} testID="mag-love-footer" />
          </View>
        );
      }
      case 'question':
        return (
          <View style={styles.page} testID="mag-question">
            <AppText variant="title">{tx('MAGAZINE.page.question')}</AppText>
            <AppText variant="caption">{tx('MAGAZINE.page.questionSub')}</AppText>
            {(pre?.questions ?? []).slice(0, 3).map((id) => (
              <AppText key={id} variant="bodyMedium">
                {questionText(id) ?? ''}
              </AppText>
            ))}
            {deps.preOn && pre && pre.state !== 'none' ? <Button label={tx('MAGAZINE.question.preAnswer')} variant="secondary" onPress={() => setSheet('pre')} testID="mag-pre" /> : null}
            <Footnote text={tx('FUN.footer')} />
          </View>
        );
      case 'place':
        return (
          <View style={styles.page} testID="mag-place">
            <AppText variant="title">{tx('MAGAZINE.page.place')}</AppText>
            <AppText variant="caption">{tx('MAGAZINE.page.placeSub', { 여행지: trip })}</AppText>
            <Art xml={artXml('place')} width="100%" height={styles.art.height} />
            <Footnote text={tx('FUN.footer')} />
          </View>
        );
      default:
        return (
          <View style={[styles.page, styles.back]} testID="mag-back">
            <Art xml={artXml('logoTile')} width={if2Look.stampW} height={if2Look.stampW} />
            <AppText variant="title">{tx('MAGAZINE.back.end')}</AppText>
            <AppText variant="body" tone="sub">
              {tx('MAGAZINE.back.next')}
            </AppText>
            <Button label={tx('MAGAZINE.a11y.close')} variant="secondary" inline onPress={close} testID="mag-back-close" />
            <Footnote text={tx('MAGAZINE.back.aiNote')} testID="mag-ai-note" />
          </View>
        );
    }
  };

  return (
    <Screen edges={['top']} testID="screen-mag">
      {head}
      <View style={if2Styles.flex} onLayout={onLayout}>
        <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} scrollEventThrottle={16} testID="mag-pager">
          {MAG_PAGES.map((p) => (
            <ScrollView key={p} style={width > 0 ? { width } : styles.hidden} contentContainerStyle={styles.pagePad} accessibilityElementsHidden={MAG_PAGES[page] !== p} importantForAccessibility={MAG_PAGES[page] === p ? 'auto' : 'no-hide-descendants'}>
              {MAG_PAGES[page] === p ? <Rise axis="x" distance={space.s16} duration={if2Look.flipMs / 2}>{pageBody(p)}</Rise> : pageBody(p)}
            </ScrollView>
          ))}
        </ScrollView>
      </View>
      <View style={styles.nav}>
        {page > 0 ? <TextButton label={tx('MAGAZINE.a11y.prev')} onPress={() => goTo(page - 1)} testID="mag-prev" /> : <View />}
        {page < MAG_PAGES.length - 1 ? <TextButton label={tx('MAGAZINE.a11y.next')} onPress={() => goTo(page + 1)} testID="mag-next" /> : <View />}
      </View>
      <Ck17Sheet
        visible={sheet === 'ck17'}
        onClose={() => setSheet('none')}
        onSave={async (a, b) => {
          const r = await deps.ck17.record(a, b, 'feature_sheet');
          if (r.ok) {
            setSheet('none');
            fetchAll();
          }
          return r.ok;
        }}
      />
      {deps.preOn ? <PreAnswerSheet visible={sheet === 'pre'} round={round} api={deps.api} onClose={() => setSheet('none')} onToast={setToast} /> : null}
      <Toast text={toast} />
    </Screen>
  );
}

const stemElement = (stem: number) => ['wood', 'fire', 'earth', 'metal', 'water'][Math.floor(stem / 2)] ?? 'wood';

// IF-CARD: 뒤집힌 세 장 → 하나를 누르면 서버에 자리를 먼저 저장하고 그 장만 뒤집힘 · 다시 열면 같은 장 · 다시 뽑기 · 한 장 더 0
export function WeekCardView({ card, api, onCard, testID = 'card' }: { card: WeekCard | null; api: Pick<InflightApi, 'pickWeekCard'>; onCard: (c: WeekCard) => void; testID?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pick = async (slot: number) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const r = await api.pickWeekCard(slot);
    setBusy(false);
    if (r.ok) onCard({ state: 'revealed', slot: r.slot, card: r.card });
    else if (r.code === 'already_picked' && r.slot !== undefined && r.card !== undefined) onCard({ state: 'revealed', slot: r.slot, card: r.card });
    else setFailed(true); // 저장 실패면 뒤집지 않는다
  };
  const t = card?.state === 'revealed' ? tarotOf(card.card) : null;
  return (
    <View style={styles.page} testID={`${testID}-page`}>
      <AppText variant="title">{tx('WEEK_CARD.title')}</AppText>
      <AppText variant="caption">{tx('MAGAZINE.page.cardSub')}</AppText>
      {card === null || card.state === 'none' || card.state === 'not_ready' ? (
        <AppText variant="body" testID={`${testID}-closed`}>
          {card?.state === 'none' ? tx('WEEK_CARD.closed') : tx('WEEK_CARD.loadFailed')}
        </AppText>
      ) : card.state === 'face_down' ? (
        <>
          <AppText variant="body">{tx('WEEK_CARD.guide')}</AppText>
          <View style={styles.three}>
            {(['left', 'middle', 'right'] as const).map((side, i) => (
              <Pressable key={side} accessibilityRole="button" accessibilityLabel={tx(`WEEK_CARD.slotA11y.${side}`)} disabled={busy} onPress={() => void pick(i)} effect="scale" style={styles.slot} testID={`${testID}-slot-${i}`}>
                <Art xml={artXml('tarotBack')} width={if2Look.tarotW} height={if2Look.tarotH} />
              </Pressable>
            ))}
          </View>
          {failed ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-failed`}>
              {tx('WEEK_CARD.flipFailed')}
            </AppText>
          ) : null}
        </>
      ) : t ? (
        <Rise duration={if2Look.flipMs} testID={`${testID}-revealed`}>
          <View style={styles.revealed} accessible accessibilityLabel={tx('WEEK_CARD.a11y.card', { '카드 이름': t.name, 글: t.line })}>
            <Art xml={tarotXml(t.no)} width={if2Look.tarotBigW} height={if2Look.tarotBigH} />
            <AppText variant="caption">{tx('WEEK_CARD.kicker')}</AppText>
            <AppText variant="title" testID={`${testID}-name`}>
              {t.name}
            </AppText>
            <AppText variant="body">{t.upright}</AppText>
            <AppText variant="bodyMedium">{t.line}</AppText>
            <AppText variant="body" tone="sub">
              {t.question}
            </AppText>
            <AppText variant="caption">{tx('WEEK_CARD.done')}</AppText>
          </View>
        </Rise>
      ) : null}
      <Footnote text={tx('FUN.footer')} testID={`${testID}-footer`} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', minHeight: size.header, paddingHorizontal: size.screenPadding },
  close: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'flex-end' },
  pressed: { opacity: alpha.pressed },
  center: { flex: 1, alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingTop: space.s48 },
  pagePad: { padding: size.screenPadding, paddingBottom: space.s40 },
  page: { gap: space.s12 },
  back: { alignItems: 'center' },
  hidden: { width: 0 },
  art: { height: 200 },
  small: { height: 120 },
  grain: { height: 48 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: size.screenPadding, paddingBottom: space.s16, borderTopWidth: 1, borderTopColor: colors.line },
  three: { flexDirection: 'row', justifyContent: 'center', gap: space.s8 },
  slot: { borderRadius: radius.md, minWidth: size.touchMin, minHeight: size.touchMin },
  revealed: { alignItems: 'center', gap: space.s8 },
});
