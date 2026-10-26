// T1 탑승권 · T2 기다림(V5 W6 · 청사진 v5 초안 4-1 4~7 · 6-1). 탭 '탑승권'의 본문 — 서버 get_boarding_state 하나로 고른다(boardingLogic.boardingView).
//  위에서 아래: 머리(탑승권 + 프로필 원) → (크레딧이 있으면) 크레딧 줄 → 상태 카드(제목 · 한두 줄 · 버튼) → 탑승권 한 장 → 기다리는 동안 할 일 → (데모) 장면 줄
//  · 판매 전 · 판매 중 · 좌석 모두 참 · 판매 끝 · 탑승 완료(기다림) · 공개(만난 분 있음 / 완벽한 사람을 찾지 못함) · 살 수 없음(정치 문항 · 계산 멈춤)
//  · 재촉 0: 남은 좌석 수 · 매진 임박 · 서두르세요 0. 남은 때는 날 단위(오늘 · n일 뒤)만, 시 · 분 · 초 카운트다운 0
//  · 탑승권 받기 순간(6-3 ① · 2안 '지면' 핵심 ①, 명세 4-2): 결제 시트 520 edInOut + 시트 제목 줄 가림 → 결제 확인 햅틱 Success → 시트 340 으로 닫힘 →
//    도장 자리에 로고 타일 52 가 잉크 번짐(560) · 상태 카드 제목 줄 가림(200 뒤) · 부제(280 뒤) · 남은 날(360 뒤)이 위에서 걷힘. 동작 줄이기면 모두 투명도 150
//  · 결제 시트 아래 '결혼중개 계약 설명 보기'(L17A · D-190 ⑤, 약관 제14조의2 ③ BR09): 약관 제14조의2 글 그대로 연다(사기 전 설명 · 다시 보기 자리)
//  · 장면 그림(D42-I 4안 · D-176): 상태 카드 위에 상태마다 한 장(boardingArt.ts SCENE_OF). 불러오기 실패는 '오류' 그림. 살 수 없음(ineligible)은 그림 없음
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Illustration } from '@/components/Illustration';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { TermsArticleSheet } from '@/features/consent/TermsArticleSheet';
import { haptic, InkTile, logoTile, MaskLine, scene2, SkeletonCard, SkeletonPulse, TOAST_MS, Wipe } from '@/motion';
import { colors, size, space } from '@/theme/tokens';

import type { BoardingApi, BoardingLoad, BoardingState, BuyFailure } from './boardingApi';
import { SCENE_OF } from './boardingArt';
import { BOARDING } from './boardingCopy';
import { arriveWhen, boardingView, canUseCredit, daysUntil, nextSaleOpen, whenText, type BoardingView } from './boardingLogic';
import { TicketCard } from './TicketCard';
import { ArriveView } from './ArriveView';
import { defaultOpenedRounds, useOpenedRounds, type OpenedRounds } from './openedRounds';

export type BoardingDeps = { api: Pick<BoardingApi, 'load' | 'buy'>; newId: () => string; toastMs?: number; opened?: OpenedRounds; demoBar?: (reload: () => void) => ReactNode };

// 새 주소(탑승권 · 공개 · 크레딧)는 이 파일이 만든 라우트라 자동 주소 타입에 아직 없을 수 있다 — 문자열 그대로 넘긴다
export const hrefOf = (path: string): Href => path as unknown as Href;
const SURVEY_HREF: Href = { pathname: '/survey/[step]', params: { step: '01' } };

export function BoardingScreen({ deps }: { deps: BoardingDeps }) {
  const router = useRouter();
  const [load, setLoad] = useState<BoardingLoad | null>(null);
  const [sheet, setSheet] = useState(false);
  const [contract, setContract] = useState(false); // 결혼중개 계약 설명(약관 제14조의2, L17A)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<BuyFailure | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0); // 탑승권을 받은 순간 로고 타일을 한 번 찍는다
  const toastMs = deps.toastMs ?? TOAST_MS;
  const openedStore = deps.opened ?? defaultOpenedRounds;
  const opened = useOpenedRounds(openedStore);

  const reload = useCallback(() => {
    void deps.api.load().then(setLoad);
  }, [deps.api]);
  useFocusEffect(
    useCallback(() => {
      reload();
      return undefined;
    }, [reload]),
  );
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  const state = load?.ok ? load.state : null;
  const view = state ? boardingView(state) : null;
  const scene = view ? SCENE_OF[view] : null;
  // 공개된 만난 분 회차 · 아직 이 기기에서 열어 보지 않았으면 도착 화면(못 찾음 회차는 도착 화면 없이 지금처럼)
  const arrivedRound = view === 'matched' && state?.result?.kind === 'matched' ? state.result.roundNo : null;
  const arriving = arrivedRound !== null && opened.ready && !opened.rounds.includes(arrivedRound);

  const buy = async (useCredit: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await deps.api.buy(deps.newId(), useCredit);
    setBusy(false);
    if (!r.ok) {
      setError(r.reason);
      if (r.reason === 'sold_out' || r.reason === 'closed' || r.reason === 'already') reload();
      return;
    }
    haptic.success(); // 구매가 확인됨(D25 4장)
    setSheet(false);
    setStamp((n) => n + 1);
    setToast(BOARDING.bought);
    reload();
  };

  return (
    <Screen edges={['top']} backdrop="recommendations" testID="screen-boarding">
      <TabHeader title={BOARDING.headerTitle} testID="boarding-header" />
      {load === null || (arrivedRound !== null && !opened.ready) ? (
        <View style={styles.pad}>
          <SkeletonPulse>
            <SkeletonCard testID="boarding-skeleton" />
          </SkeletonPulse>
        </View>
      ) : !state || !view ? (
        <View style={[styles.pad, styles.gap]} testID="boarding-error">
          <Illustration scene="error" testID="boarding-art" />
          <AppText variant="body" tone="sub" accessibilityRole="alert">
            {BOARDING.loadFailed}
          </AppText>
          <Button label={BOARDING.retry} variant="secondary" onPress={reload} testID="boarding-retry" />
        </View>
      ) : arriving && arrivedRound !== null && state.round ? (
        // 도착 화면(D-178): 공개 시각이 지난 회차를 처음 볼 때 한 번. [지금 열어 보기] → 열어 봄 표시 → 공개 순간(표지 넘김)
        <ScrollView contentContainerStyle={[styles.pad, styles.gap]} testID="boarding-scroll">
          <ArriveView
            when={arriveWhen(state.round.matchAt)}
            onOpen={() => {
              openedStore.mark(arrivedRound);
              router.push(hrefOf('/reveal?moment=1'));
            }}
            testID="boarding-arrive"
          />
          {deps.demoBar ? deps.demoBar(reload) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap]} testID="boarding-scroll">
          {state.credits > 0 ? <TextButton label={BOARDING.creditsLink(state.credits)} align="start" onPress={() => router.push(hrefOf('/credits'))} testID="boarding-credits" /> : null}
          {scene ? <Illustration scene={scene} testID="boarding-art" /> : null}
          <StatusCard state={state} view={view} moment={stamp > 0} onBuy={() => setSheet(true)} onOpen={(path) => router.push(path)} />
          <View>
            <TicketCard
              roundNo={state.round?.no ?? null}
              regionName={state.regionName}
              when={state.round ? whenText(state.round.matchAt) : null}
              status={state.ticket ? (state.ticket.paidWith === 'credit' ? BOARDING.stateCredit : BOARDING.stateBoarded) : BOARDING.stateNone}
            />
            {stamp > 0 ? <InkTile key={stamp} size={logoTile.ticket} duration={scene2.ticket.stamp} style={styles.stamp} testID="boarding-stamp" /> : null}
          </View>
          {view === 'boarded' || view === 'matched' || view === 'no_match' || view === 'before_sale' ? <Tasks state={state} onOpen={(path) => router.push(path)} /> : null}
          {deps.demoBar ? deps.demoBar(reload) : null}
        </ScrollView>
      )}
      <BottomSheet visible={sheet} core onClose={() => (busy ? undefined : setSheet(false))} testID="boarding-sheet">
        {state?.round ? (
          <View style={styles.gap}>
            <MaskLine variant="title" accessibilityRole="header" delay={scene2.ticket.sheetTitleDelay} duration={scene2.ticket.sheetTitle}>{BOARDING.sheet.title}</MaskLine>
            <AppText variant="body" testID="boarding-sheet-summary">
              {BOARDING.sheet.summary(BOARDING.round(state.round.no), whenText(state.round.matchAt))}
            </AppText>
            <View style={styles.priceRow}>
              <AppText variant="body" tone="sub">
                {BOARDING.sheet.priceLabel}
              </AppText>
              <AppText variant="bodyBold" testID="boarding-sheet-price">
                {BOARDING.sheet.price}
              </AppText>
            </View>
            {BOARDING.sheet.rules.map((r) => (
              <AppText key={r} variant="caption">
                {r}
              </AppText>
            ))}
            <TextButton label={BOARDING.sheet.contract} onPress={() => setContract(true)} testID="boarding-contract" />
            {error ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="boarding-sheet-error">
                {BOARDING.buyErrors[error]}
              </AppText>
            ) : null}
            {canUseCredit(state) ? <Button label={BOARDING.sheet.payCredit} onPress={() => void buy(true)} loading={busy} testID="boarding-pay-credit" /> : null}
            <Button label={BOARDING.sheet.pay} variant={canUseCredit(state) ? 'secondary' : 'primary'} onPress={() => void buy(false)} loading={busy} testID="boarding-pay" />
            <AppText variant="caption" testID="boarding-sheet-demo">
              {BOARDING.sheet.demo}
            </AppText>
          </View>
        ) : null}
      </BottomSheet>
      <TermsArticleSheet visible={contract} prefix="제14조의2" onClose={() => setContract(false)} testID="boarding-contract-sheet" />
      <Toast text={toast} testID="boarding-toast" />
    </Screen>
  );
}

// moment: 방금 탑승권을 받았다(핵심 ①) — 탑승 완료 카드의 제목 · 부제 · 남은 날이 차례로 드러난다. 그 밖에는 움직임 없음
function StatusCard({ state, view, moment = false, onBuy, onOpen }: { state: BoardingState; view: BoardingView; moment?: boolean; onBuy: () => void; onOpen: (href: Href) => void }) {
  const next = state.round ? whenText(nextSaleOpen(state.round.matchAt)) : null;
  const play = moment && view === 'boarded';
  const T = scene2.ticket;
  const card = (title: string, body: string | null, action?: ReactNode, extra?: ReactNode) => (
    <Card style={styles.gapSmall} testID={`boarding-status-${view}`}>
      <MaskLine variant="bodyBold" accessibilityRole="header" play={play} delay={T.titleDelay} duration={T.title} testID="boarding-status-title">{title}</MaskLine>
      {body ? (
        <Wipe play={play} delay={T.subDelay} duration={T.sub} cover={colors.card}>
          <AppText variant="body" testID="boarding-status-body">
            {body}
          </AppText>
        </Wipe>
      ) : null}
      {extra ? (
        <Wipe play={play} delay={T.msgDelay} duration={T.msg} cover={colors.card}>
          {extra}
        </Wipe>
      ) : null}
      {action}
    </Card>
  );
  switch (view) {
    case 'before_sale':
      return card(BOARDING.beforeSale.title, state.round?.saleOpenAt ? BOARDING.beforeSale.body(whenText(state.round.saleOpenAt)) : null);
    case 'on_sale':
      return card(
        BOARDING.onSale.title,
        BOARDING.onSale.body,
        <Button label={canUseCredit(state) ? BOARDING.onSale.buyCredit : BOARDING.onSale.buy} onPress={onBuy} testID="boarding-buy" />,
        canUseCredit(state) ? (
          <AppText variant="captionMedium" tone="accent" testID="boarding-credit-note">
            {BOARDING.onSale.credits(state.credits)}
          </AppText>
        ) : null,
      );
    case 'full':
      return card(BOARDING.full.title, next ? BOARDING.full.body(next) : null);
    case 'closed':
      return card(BOARDING.closed.title, next ? BOARDING.closed.body(next) : null);
    case 'boarded': {
      const days = state.round ? daysUntil(state.round.matchAt, state.now) : null;
      return card(
        BOARDING.boarded.title,
        BOARDING.boarded.body,
        undefined,
        days !== null ? (
          <AppText variant="title" tone="accent" testID="boarding-days">
            {days === 0 ? BOARDING.boarded.today : BOARDING.boarded.days(days)}
          </AppText>
        ) : null,
      );
    }
    case 'matched':
      return card(
        BOARDING.matched.title,
        state.result?.kind === 'matched' ? BOARDING.matched.body(state.result.partner.name) : null,
        <Button label={BOARDING.matched.open} onPress={() => onOpen(hrefOf('/reveal'))} testID="boarding-open-reveal" />,
      );
    case 'no_match': {
      const reason = state.result?.kind === 'no_match' && state.result.reason ? BOARDING.noMatch.reasons[state.result.reason] : null;
      return card(
        BOARDING.noMatch.title,
        BOARDING.noMatch.body,
        <Button label={BOARDING.noMatch.credits} variant="secondary" onPress={() => onOpen(hrefOf('/credits'))} testID="boarding-open-credits" />,
        reason ? (
          <AppText variant="caption" testID="boarding-nomatch-reason">
            {reason}
          </AppText>
        ) : null,
      );
    }
    case 'ineligible': {
      const k = state.ineligible ?? 'not_confirmed';
      const c = BOARDING.ineligible[k];
      const href: Href | null = k === 'politics_missing' ? SURVEY_HREF : k === 'paused' ? hrefOf('/settings') : null;
      return card(c.title, c.body, c.action && href ? <Button label={c.action} variant="secondary" onPress={() => onOpen(href)} testID="boarding-ineligible-action" /> : undefined);
    }
  }
}

function Tasks({ state, onOpen }: { state: BoardingState; onOpen: (href: Href) => void }) {
  const rows: { key: string; name: string; line: string; href: Href }[] = [
    { key: 'profile', ...BOARDING.tasks.profile, href: hrefOf('/profile') },
    { key: 'survey', ...BOARDING.tasks.survey, href: SURVEY_HREF },
  ];
  const chat = state.past.find((p) => p.chatId);
  if (chat?.chatId) rows.push({ key: 'chats', name: BOARDING.tasks.chats.name, line: BOARDING.tasks.chats.line(state.past.length), href: hrefOf(`/chat/${chat.chatId}`) });
  return (
    <View style={styles.gapSmall} testID="boarding-tasks">
      <AppText variant="bodyBold" accessibilityRole="header">
        {BOARDING.tasksTitle}
      </AppText>
      {rows.map((r) => (
        <Card key={r.key} onPress={() => onOpen(r.href)} accessibilityLabel={`${r.name}, ${r.line}`} testID={`boarding-task-${r.key}`} style={styles.gapTiny}>
          <AppText variant="bodyMedium">{r.name}</AppText>
          <AppText variant="caption">{r.line}</AppText>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: size.screenPadding, paddingTop: space.s16, paddingBottom: space.s40 },
  gap: { gap: space.s16 },
  gapSmall: { gap: space.s12 },
  gapTiny: { gap: space.s4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stamp: { position: 'absolute', right: space.s16, top: space.s16 },
});
