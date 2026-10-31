// IF-MAG 기내지(F-08 · F-02) + IF-CARD 이번 주 카드(F-09) — 정책 PF-21 ~ PF-25 · 화면_요구사항 IF-MAG · IF-CARD · 카피 21-3 · 21-4.
//  · 그 회차 탑승객만 · 목 09:00 ~ 수 18:00 · 표지 + 6쪽을 가로로 넘김(끝 쪽 뒤 넘김 0) · 쪽 이름만(쪽 번호 · 진행 점 0) · 머리 대신 [닫기] · 푸시 0
//  · ① 하늘과 결 = CK17A 켠 분만(아니면 안내 한 줄 + [동의하고 보기] — 누를 때만 동의 시트 · 쪽에 닿아도 저절로 안 뜸 · 되풀이 0, 3부-자 QP-46) · ② 이번 주 카드 = 세 장 가운데 한 장(서버가 고른 자리를 먼저 저장 — 다시 뽑기 0)
//  · 서버 get_magazine 은 이번 회차에 안 탄 분도 탄 뒤 닫힌 분도 똑같이 none 이라, 앱이 탑승권 상태로 가른다(3부-자 QP-43): 판매 중 · 마감 뒤 공개 전인데 탑승권이 없으면 notBoarded, 그 밖은 closed
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
import { SIGN_CUSP, t3 } from '@/content/if3Copy';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { aitEnabled } from '@/features/ait/aitEnabled';
import { StarAiBlock } from '@/features/ait/StarAiBlock';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { Rise, TOAST_MS } from '@/motion';
import { if2Look } from '@/theme/if2Look';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { BirthWeek, InflightApi, Magazine, PreQuestions, WeekCard } from './inflightApi';
import { columnOf, element5Name, questionText, sajuText, signName, stemIntro, tarotOf, tripPlaceOf, zodiacText } from './if2Library';
import { MAG_PAGES, magazineNoneKind, tripOf, type MagPage } from './inflightLogic';
import { Art, artXml, Footnote, if2Styles, tarotXml } from './If2Parts';
import { Ck17Sheet, PreAnswerSheet } from './If2Sheets';
import { tx } from './if2Text';
import type { Ck17Api } from './inflightService';
import { BirthCard, MyWaysFold, SkyWeekCard } from './SkyParts';

// isOn: 3부-카 하늘 읽기 스위치(sky_week · my_ways · birth_card · sky_book). 없으면 모두 꺼짐(실서버 처음값) — 꺼진 칸은 그리지 않는다(정책 PG-93)
export type MagazineDeps = {
  api: Pick<InflightApi, 'magazine' | 'weekCard' | 'pickWeekCard' | 'preQuestions'> & Partial<Pick<InflightApi, 'myWays' | 'birthWeek'>>;
  ck17: Ck17Api;
  preOn?: boolean;
  boarding?: () => Promise<BoardingState | null>;
  isOn?: (key: string) => boolean;
};
const GRAIN: Readonly<Record<string, 'grainWood' | 'grainFire' | 'grainEarth' | 'grainMetal' | 'grainWater'>> = { wood: 'grainWood', fire: 'grainFire', earth: 'grainEarth', metal: 'grainMetal', water: 'grainWater' };
const pageName = (p: MagPage) =>
  p === 'cover' ? tx('MAGAZINE.cover.issue') : p === 'skyGrain' ? tx('MAGAZINE.page.skyGrain') : p === 'card' ? tx('MAGAZINE.page.card') : p === 'love' ? tx('MAGAZINE.page.love') : p === 'question' ? tx('MAGAZINE.page.question') : p === 'place' ? tx('MAGAZINE.page.place') : tx('MAGAZINE.page.back');

export function MagazineScreen({ deps }: { deps: MagazineDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ page?: string; round?: string }>();
  const [mag, setMag] = useState<Magazine | 'loading' | 'failed' | 'off'>('loading');
  const [boarded, setBoarded] = useState<BoardingState | null>(null); // none 일 때만 읽는다(탑승권 상태로 notBoarded · closed 가름)
  const [card, setCard] = useState<WeekCard | null>(null);
  const [pre, setPre] = useState<PreQuestions | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState<'none' | 'ck17' | 'pre'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [birth, setBirth] = useState<BirthWeek | null>(null); // G-07: ④ 쪽에 닿았을 때 한 번만 부른다(스위치 birth_card 켜짐일 때) · 이 화면 메모리뿐
  const birthAsked = useRef(false);
  const pager = useRef<ScrollView>(null);
  const startPage = params.page === 'card' ? MAG_PAGES.indexOf('card') : 0;
  const round = Number(params.round ?? '0') || 0;

  const boardingOf = deps.boarding;
  const fetchAll = useCallback(() => {
    void deps.api.magazine().then((r) => {
      setMag(r.ok ? r.data : r.code === 'off' ? 'off' : 'failed');
      if (r.ok && r.data.state === 'none' && boardingOf) void boardingOf().then(setBoarded, () => setBoarded(null));
    });
    void deps.api.weekCard().then((r) => setCard(r.ok ? r.data : null));
    if (deps.preOn) void deps.api.preQuestions().then((r) => setPre(r.ok ? r.data : null));
  }, [deps.api, deps.preOn, boardingOf]);
  useEffect(fetchAll, [fetchAll]);
  const load = () => {
    setMag('loading');
    fetchAll();
  };
  const birthOn = (deps.isOn ?? (() => false))('birth_card');
  const birthFetch = deps.api.birthWeek;
  useEffect(() => {
    if (!birthOn || !birthFetch || MAG_PAGES[page] !== 'question' || birthAsked.current) return;
    birthAsked.current = true;
    void birthFetch().then(
      (r) => setBirth(r.ok ? r.data : null),
      () => undefined,
    );
  }, [birthOn, birthFetch, page]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const isOn = deps.isOn ?? (() => false);
  const waysApi = deps.api.myWays;
  const birthApi = deps.api.birthWeek;
  const issued = typeof mag === 'object' && mag.state === 'issued' ? mag : null;
  const trip = issued ? (tripOf(issued.tripNo) ?? '') : '';
  // 쪽을 넘길 뿐 — 동의 시트는 쪽에 닿아도 저절로 띄우지 않는다. ① 쪽의 [동의하고 보기]를 누를 때만(정책 PF-16 · PF-23, QP-46)
  const arrive = (next: number) => setPage(next);
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
        <View style={styles.center} testID={`mag-${mag === 'loading' ? 'loading' : mag === 'failed' ? 'failed' : mag === 'off' ? 'none' : (m?.state ?? 'none')}`}>
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
          {m?.state === 'none' || mag === 'off' ? (
            <>
              <AppText variant="body" testID="mag-none-text">
                {mag !== 'off' && magazineNoneKind(boarded) === 'notBoarded' ? tx('MAGAZINE.notBoarded') : tx('MAGAZINE.closed')}
              </AppText>
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
            {isOn('sky_week') ? <SkyWeekCard issueDate={issued.issueDate} /> : null}
            {issued.sky && issued.grain ? (
              <>
                <AppText variant="bodyBold">{tx('MAGAZINE.page.sky')}</AppText>
                <AppText variant="caption">{tx('MAGAZINE.page.skySub')}</AppText>
                <Art xml={artXml('constellation')} width="100%" height={styles.small.height} />
                {issued.sky.signs.length === 2 ? (
                  // 경계 날(3부-차 · 22-10): 순서 없는 한 쌍 — 한 줄 + 사실 한 문장, 두 별자리의 글은 같은 크기 · 같은 무게로 나란히(대표 · 또는 0)
                  <View style={if2Styles.gapSmall} testID="mag-cusp">
                    <AppText variant="captionMedium" tone="accent" testID="mag-cusp-pair">
                      {SIGN_CUSP.pair(signName(issued.sky.signs[0]) ?? '', signName(issued.sky.signs[1]) ?? '')}
                    </AppText>
                    <AppText variant="caption" testID="mag-cusp-why">
                      {SIGN_CUSP.why}
                    </AppText>
                  </View>
                ) : null}
                {issued.sky.signs.map((code, i) => (
                  <View key={code} style={if2Styles.gapSmall} testID={`mag-sky-${i}`}>
                    <AppText variant="captionMedium" tone="accent" testID={`mag-sign-${i}`}>
                      {signName(code) ?? ''}
                    </AppText>
                    <AppText variant="body">{zodiacText(issued.sky?.zodiacs[i] ?? '') ?? ''}</AppText>
                  </View>
                ))}
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
                {aitEnabled() ? <StarAiBlock signs={issued.sky.signs} stem={issued.grain.stem} onSettings={() => openSettingsPage(router, 'ait-code')} /> : null}
                {isOn('my_ways') && waysApi ? <MyWaysFold api={{ myWays: waysApi }} onAgree={() => setSheet('ck17')} /> : null}
              </>
            ) : (
              <View style={if2Styles.gapSmall} testID="mag-ck17-off">
                <AppText variant="body">{tx('FUN.ck17.offBody')}</AppText>
                <Button label={tx('FUN.ck17.agreeView')} variant="secondary" inline onPress={() => setSheet('ck17')} testID="mag-ck17-agree" />
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
            {isOn('birth_card') && birthApi ? <BirthCard week={birth} issueDate={issued.issueDate} active={MAG_PAGES[page] === 'question'} /> : null}
            <Footnote text={tx('FUN.footer')} />
          </View>
        );
      case 'place': {
        const place = tripPlaceOf(issued.tripNo); // 3부-자(계산명세 10-2): 여행지 글 한 편 + 둘이 하기 좋은 일 한 줄 — 모든 회원 같은 글, 라이브러리 값 그대로(머리 글 0 · 새 키 0)
        return (
          <View style={styles.page} testID="mag-place">
            <AppText variant="title">{tx('MAGAZINE.page.place')}</AppText>
            <AppText variant="caption">{tx('MAGAZINE.page.placeSub', { 여행지: trip })}</AppText>
            <Art xml={artXml('place')} width="100%" height={styles.art.height} />
            {place ? (
              <>
                <AppText variant="body" testID="mag-place-body">
                  {place.body}
                </AppText>
                <AppText variant="body" testID="mag-place-together">
                  {place.together}
                </AppText>
              </>
            ) : null}
            <Footnote text={tx('FUN.footer')} />
          </View>
        );
      }
      default:
        return (
          <View style={[styles.page, styles.back]} testID="mag-back">
            <Art xml={artXml('logoTile')} width={if2Look.stampW} height={if2Look.stampW} />
            <AppText variant="title">{tx('MAGAZINE.back.end')}</AppText>
            <AppText variant="body" tone="sub">
              {tx('MAGAZINE.back.next')}
            </AppText>
            {isOn('sky_book') ? <Button label={t3('SKY_BOOK.entry.back')} variant="secondary" inline onPress={() => router.push('/sky-book' as Href)} testID="mag-book" /> : null}
            <Button label={tx('MAGAZINE.a11y.close')} variant="secondary" inline onPress={close} testID="mag-back-close" />
            <Footnote text={tx('MAGAZINE.back.aiNote')} testID="mag-ai-note" />
          </View>
        );
    }
  };

  return (
    <Screen edges={['top']} testID="screen-mag">
      {head}
      {/* key: 불러오는 중 칸(같은 자리 View)을 이어 쓰지 않고 새로 붙인다 — 웹(react-native-web)은 처음 붙을 때 onLayout 이 없으면 크기 관찰을 하지 않아 쪽 폭이 0 으로 남는다 */}
      <View key="mag-pages" style={if2Styles.flex} onLayout={onLayout}>
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
