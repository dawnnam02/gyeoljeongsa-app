// T1 탑승권 · T2 기다림(V5 W6 · 청사진 v5 초안 4-1 4~7 · 6-1). 탭 '탑승권'의 본문 — 서버 get_ticket_state + get_weekly_match(boardingApi.load)로 고른다(boardingLogic.boardingView).
//  · [결제하기] = 계약 설명 확인 기록 → 자리 잡기(hold_ticket_seat) → 데모 결제(demo_buy_ticket). [크레딧 1장으로 타기] = board_with_credit. 결제 뒤 자리를 못 받으면(credited) 크레딧 안내 한 줄
//  · [탑승 취소] 확인창 본문: 결제로 탄 좌석 = cancel.body(스토어 환불 문장 포함) · 크레딧으로 탄 좌석 = cancel.bodyCredit(카피 14-7, 팀장 10-27)
//  위에서 아래: 머리(탑승권 + 프로필 원) → (크레딧이 있으면) 크레딧 줄 → 상태 카드(제목 · 한두 줄 · 버튼) → 탑승권 한 장 → 기다리는 동안 할 일 → (데모) 장면 줄
//  · 판매 전 · 판매 중 · 좌석 모두 참 · 판매 끝 · 탑승 완료(기다림) · 공개(만난 분 있음 / 완벽한 사람을 찾지 못함) · 살 수 없음(정치 문항 · 계산 멈춤)
//  · 재촉 0: 남은 좌석 수 · 매진 임박 · 서두르세요 0. 남은 때는 날 단위(오늘 · n일 뒤)만, 시 · 분 · 초 카운트다운 0
//  · 탑승권 받기 순간(6-3 ① · 2안 '지면' 핵심 ①, 명세 4-2): 결제 시트 520 edInOut + 시트 제목 줄 가림 → 결제 확인 햅틱 Success → 시트 340 으로 닫힘 →
//    도장 자리에 로고 타일 52 가 잉크 번짐(560) · 상태 카드 제목 줄 가림(200 뒤) · 부제(280 뒤) · 남은 날(360 뒤)이 위에서 걷힘. 동작 줄이기면 모두 투명도 150
//  · 결제 시트 아래 '결혼중개 계약 설명 보기'(L17A · D-190 ⑤, 약관 제14조의2 ③ BR09): 약관 제14조의2 글 그대로 연다(사기 전 설명 · 다시 보기 자리)
//  · 결제 버튼을 누르면 먼저 계약 설명 확인 기록(0037 ack_ticket_contract, 판 = 보인 요약 블록 글의 지문) → 남으면 결제. 실패하면 결제하지 않고 오류 한 줄
//    0039 관문: 잡기 · 데모 결제 · 크레딧 탑승이 contract_ack_required 로 돌아오면(이 화면이 남긴 기록이 서버에 없음) 기록을 다시 남기고 한 번만 다시 부른다.
//    그래도 같으면 일반 결제 오류 글 — 확인 기록 없이 결제로 넘어가는 길 0
//  · 살 수 없음(not_eligible)으로 막히면 화면을 다시 읽어 T1 '살 수 없음' 카드(0039 reason_detail 로 가른 글)를 보인다
//  · [탑승 취소] 성공(0037 result 'credited') → 크레딧 1장이 늘고 T1(판매 중)
//  · 장면 그림(D42-I 4안 · D-176): 상태 카드 위에 상태마다 한 장(boardingArt.ts SCENE_OF). 불러오기 실패는 '오류' 그림. 살 수 없음(ineligible)은 그림 없음
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Illustration } from '@/components/Illustration';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { fillText } from '@/content/fillLegal';
import { TermsArticleSheet } from '@/features/consent/TermsArticleSheet';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { haptic, InkTile, logoTile, MaskLine, scene2, SkeletonCard, SkeletonPulse, TOAST_MS, Wipe } from '@/motion';
import { colors, size, space } from '@/theme/tokens';

import type { BoardingApi, BoardingLoad, BoardingState, BuyFailure } from './boardingApi';
import { SCENE_OF } from './boardingArt';
import { BOARDING, CREDITS } from './boardingCopy';
import { afterCancel, arriveWhen, boardingView, canCancel, canUseCredit, contractVersion, daysUntil, nextSaleOpen, whenText, type BoardingView } from './boardingLogic';
import { TicketCard } from './TicketCard';
import { ArriveView } from './ArriveView';
import { defaultOpenedRounds, useOpenedRounds, type OpenedRounds } from './openedRounds';
import { InflightHome, useInflightHome, type InflightHomeDeps } from '@/features/inflight/InflightHome';

// IF2-F(D-223): inflight = 홈 새 구성(스위치 inflight_home · 정책 PF-81 ~ PF-89). 없거나 꺼져 있으면 지금 T1 · T2 그대로
export type BoardingDeps = { api: Pick<BoardingApi, 'load' | 'buy'> & Partial<Pick<BoardingApi, 'cancel' | 'ackContract'>>; newId: () => string; toastMs?: number; opened?: OpenedRounds; demoBar?: (reload: () => void) => ReactNode; inflight?: InflightHomeDeps; inflightBar?: (reload: () => void) => ReactNode };

// 계약 설명 요약 블록에 실제로 그리는 줄(값이 빈 자리 글이 든 줄은 숨김). 확인 기록의 판(contractVersion)도 이 줄로 만든다
const contractLines = (): { i: number; text: string }[] =>
  BOARDING.sheet.contractSummary.flatMap((line, i) => {
    const f = fillText(line);
    return f.missing ? [] : [{ i, text: f.text }];
  });

// 새 주소(탑승권 · 공개 · 크레딧)는 이 파일이 만든 라우트라 자동 주소 타입에 아직 없을 수 있다 — 문자열 그대로 넘긴다
export const hrefOf = (path: string): Href => path as unknown as Href;
const SURVEY_HREF: Href = { pathname: '/survey/[step]', params: { step: '01' } };
// 3부-아(검수 QP-32): T1 살 수 없음 [설문으로]는 남은 그 문항으로 바로(설문 v2 한 문항 쪽 — 마치면 T1 로 돌아옴)
const POLITICS_HREF: Href = { pathname: '/survey/[step]', params: { step: 'v2', notice: 'politics' } };
const RELIGION_HREF: Href = { pathname: '/survey/[step]', params: { step: 'v2', notice: 'religion' } };
// 3부-아(카피 20장): 성별 · 지역 답이 비면 설문 v2 의 빠진 문항으로(05 와 같은 missing 입구)
const PROFILE_HREF: Href = { pathname: '/survey/[step]', params: { step: 'v2', notice: 'missing' } };

export function BoardingScreen({ deps }: { deps: BoardingDeps }) {
  const router = useRouter();
  const [load, setLoad] = useState<BoardingLoad | null>(null);
  const [sheet, setSheet] = useState(false);
  const [contract, setContract] = useState(false); // 결혼중개 계약 설명(약관 제14조의2, L17A)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Exclude<BuyFailure, 'ack_required'> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0); // 탑승권을 받은 순간 로고 타일을 한 번 찍는다
  const [askCancel, setAskCancel] = useState(false); // T2 [탑승 취소] 확인창(D-200 ④ · D-201)
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const toastMs = deps.toastMs ?? TOAST_MS;
  const openedStore = deps.opened ?? defaultOpenedRounds;
  const opened = useOpenedRounds(openedStore);

  const inflight = useInflightHome(deps.inflight);
  const reloadHome = inflight.reload;
  const reload = useCallback(() => {
    void deps.api.load().then(setLoad);
    reloadHome(); // B1 먼저 · 홈 블록은 뒤(PF-86)
  }, [deps.api, reloadHome]);
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
  const homeOn = inflight.on && !!deps.inflight;
  const view = state ? boardingView(state) : null;
  const scene = view ? SCENE_OF[view] : null;
  // 공개된 만난 분 회차 · 아직 이 기기에서 열어 보지 않았으면 도착 화면(못 찾음 회차는 도착 화면 없이 지금처럼)
  const arrivedRound = view === 'matched' && state?.result?.kind === 'matched' ? state.result.roundNo : null;
  const arriving = arrivedRound !== null && opened.ready && !opened.rounds.includes(arrivedRound);

  const summary = contractLines();
  // 결제 전 계약 설명 확인 기록(0037 ack_ticket_contract · R40). 요약 블록을 보인 시트에서 결제 버튼을 누를 때 — 남지 않으면 결제로 넘어가지 않는다.
  //  결제가 실패해 다시 누르면 같은 기록을 쓴다(같은 회차 · 같은 판). 결제가 끝나면 비운다
  const acked = useRef<string | null>(null);
  const ackFirst = async (roundNo: number, again = false): Promise<'network' | 'server' | null> => {
    if (!deps.api.ackContract) return null;
    const version = contractVersion([BOARDING.sheet.contractSummaryTitle, ...summary.map((l) => l.text)]);
    const key = `${roundNo}|${version}`;
    if (acked.current === key && !again) return null;
    const a = await deps.api.ackContract(roundNo, version);
    if (!a.ok) return a.reason;
    acked.current = key;
    return null;
  };

  const buy = async (useCredit: boolean) => {
    if (busy || !state?.round) return;
    setBusy(true);
    setError(null);
    const ackFail = await ackFirst(state.round.no);
    if (ackFail) {
      setBusy(false);
      setError(ackFail);
      return;
    }
    let r = await deps.api.buy(deps.newId(), useCredit, state.round.no);
    if (!r.ok && r.reason === 'ack_required' && deps.api.ackContract) {
      // 0039 관문(contract_ack_required): 확인 기록을 다시 남기고 한 번만 다시 — 같은 요약 블록을 이미 보였으니 같은 판
      acked.current = null;
      const again = await ackFirst(state.round.no, true);
      r = again ? { ok: false, reason: again } : await deps.api.buy(deps.newId(), useCredit, state.round.no);
    }
    setBusy(false);
    if (!r.ok) {
      setError(r.reason === 'ack_required' ? 'server' : r.reason);
      if (r.reason === 'sold_out' || r.reason === 'closed' || r.reason === 'already' || r.reason === 'credited' || r.reason === 'not_eligible') reload();
      return;
    }
    haptic.success(); // 구매가 확인됨(D25 4장)
    acked.current = null; // 확인 기록은 결제 한 번에 하나(서버가 그 거래에 잇는다) — 취소 뒤 다시 살 때는 새로 남긴다
    setSheet(false);
    setStamp((n) => n + 1);
    setToast(BOARDING.bought);
    reload();
  };

  // T2 [탑승 취소]: 확인창 → cancel_ticket_seat. 마감이 지났으면 마감 글을 보이고 다시 읽는다(버튼이 사라진다)
  const cancelTicket = async () => {
    if (cancelling || !state?.round || !deps.api.cancel) return;
    setCancelling(true);
    setCancelError(null);
    const r = await deps.api.cancel(state.round.no);
    setCancelling(false);
    setAskCancel(false);
    if (!r.ok) {
      setCancelError(r.reason === 'closed' ? BOARDING.cancel.closed : r.reason === 'network' ? BOARDING.buyErrors.network : BOARDING.cancel.failed);
      if (r.reason === 'closed') reload();
      return;
    }
    // 0037 result 'credited': 크레딧 1장이 늘고 T1(판매 중)으로 — 서버 값을 다시 읽기 전에도 같은 모습
    setLoad((l) => (l?.ok ? { ok: true, state: afterCancel(l.state, r.credited) } : l));
    setToast(BOARDING.cancel.done);
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
          {homeOn && inflight.home?.stage === 'matched' && view === 'matched' && state.round ? (
            // 새 구성 · 공개 뒤 짝 있음: B1 = 다음 탑승 한 줄(짝 안내는 B2 — PF-41 · PF-83)
            <AppText variant="body" testID="boarding-next">
              {BOARDING.closed.body(whenText(nextSaleOpen(state.round.matchAt)))}
            </AppText>
          ) : (
            <StatusCard state={state} view={view} moment={stamp > 0} onBuy={() => setSheet(true)} onOpen={(path) => router.push(path)} onCancel={deps.api.cancel ? () => setAskCancel(true) : undefined} cancelError={cancelError} />
          )}
          <View>
            <TicketCard
              roundNo={state.round?.no ?? null}
              regionName={state.regionName}
              when={state.round ? whenText(state.round.matchAt) : null}
              status={state.ticket ? (state.ticket.paidWith === 'credit' ? BOARDING.stateCredit : BOARDING.stateBoarded) : BOARDING.stateNone}
            />
            {stamp > 0 ? <InkTile key={stamp} size={logoTile.ticket} duration={scene2.ticket.stamp} style={styles.stamp} testID="boarding-stamp" /> : null}
          </View>
          {homeOn && inflight.home && deps.inflight ? (
            <InflightHome
              deps={deps.inflight}
              home={inflight.home}
              boarding={state}
              onToast={setToast}
              nav={{
                open: (href) => router.push(href),
                chat: (roomId, draft) => router.push(hrefOf(`/chat/${encodeURIComponent(roomId)}${draft ? `?draft=${encodeURIComponent(draft)}` : ''}`)),
                settings: (page) => openSettingsPage(router, page),
                profileSameHobby: () => router.push(hrefOf('/profile?focus=sameHobby')),
              }}
            />
          ) : view === 'boarded' || view === 'matched' || view === 'no_match' || view === 'before_sale' ? (
            <Tasks state={state} onOpen={(path) => router.push(path)} onAvoid={() => openSettingsPage(router, 'avoid')} />
          ) : null}
          {deps.demoBar ? deps.demoBar(reload) : null}
          {homeOn && deps.inflightBar ? deps.inflightBar(reload) : null}
        </ScrollView>
      )}
      <BottomSheet visible={sheet} core onClose={() => (busy ? undefined : setSheet(false))} testID="boarding-sheet">
        {state?.round ? (
          <View style={styles.gap}>
            <MaskLine variant="title" accessibilityRole="header" delay={scene2.ticket.sheetTitleDelay} duration={scene2.ticket.sheetTitle}>{BOARDING.sheet.title}</MaskLine>
            <AppText variant="body" testID="boarding-sheet-summary">
              {BOARDING.sheet.summary(CREDITS.round(state.round.no), whenText(state.round.matchAt))}
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
            {/* 결혼중개 계약 설명 요약 블록(D-199 · 카피 14-6 · 동의문구 5-8). 값이 빈 자리 글({신고번호})이 든 줄은 숨김 */}
            <Card style={styles.gapTiny} testID="boarding-contract-summary">
              <AppText variant="bodyBold" accessibilityRole="header">
                {BOARDING.sheet.contractSummaryTitle}
              </AppText>
              {summary.map((l) => (
                <AppText key={l.i} variant="caption" tone="text" testID={`boarding-contract-summary-${l.i}`}>
                  {l.text}
                </AppText>
              ))}
            </Card>
            <TextButton label={BOARDING.sheet.contract} onPress={() => setContract(true)} testID="boarding-contract" />
            {error ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="boarding-sheet-error">
                {/* credited(0030 paid_no_seat): 결제는 됐지만 자리를 못 받아 크레딧 1장 — 카피 14-7 전용 글 buyErrors.credited(D46-A 덧붙임) */}
                {BOARDING.buyErrors[error]}
              </AppText>
            ) : null}
            <AppText variant="captionMedium" tone="text" testID="boarding-sheet-deadline">
              {BOARDING.sheet.deadlineNote}
            </AppText>
            {canUseCredit(state) ? <Button label={BOARDING.sheet.payCredit} onPress={() => void buy(true)} loading={busy} testID="boarding-pay-credit" /> : null}
            <Button label={BOARDING.sheet.pay} variant={canUseCredit(state) ? 'secondary' : 'primary'} onPress={() => void buy(false)} loading={busy} testID="boarding-pay" />
            <AppText variant="caption" testID="boarding-sheet-demo">
              {BOARDING.sheet.demo}
            </AppText>
          </View>
        ) : null}
      </BottomSheet>
      <ConfirmDialog
        visible={askCancel}
        title={BOARDING.cancel.title}
        body={state?.ticket?.paidWith === 'credit' ? BOARDING.cancel.bodyCredit : BOARDING.cancel.body}
        confirmLabel={BOARDING.cancel.confirm}
        cancelLabel={BOARDING.cancel.keep}
        busy={cancelling}
        onConfirm={() => void cancelTicket()}
        onCancel={() => setAskCancel(false)}
        testID="boarding-cancel-confirm"
      />
      <TermsArticleSheet visible={contract} prefix="제14조의2" onClose={() => setContract(false)} testID="boarding-contract-sheet" />
      <Toast text={toast} testID="boarding-toast" />
    </Screen>
  );
}

// moment: 방금 탑승권을 받았다(핵심 ①) — 탑승 완료 카드의 제목 · 부제 · 남은 날이 차례로 드러난다. 그 밖에는 움직임 없음
function StatusCard({ state, view, moment = false, onBuy, onOpen, onCancel, cancelError = null }: { state: BoardingState; view: BoardingView; moment?: boolean; onBuy: () => void; onOpen: (href: Href) => void; onCancel?: () => void; cancelError?: string | null }) {
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
        <>
          <Button label={canUseCredit(state) ? BOARDING.onSale.buyCredit : BOARDING.onSale.buy} onPress={onBuy} testID="boarding-buy" />
          <AppText variant="caption" testID="boarding-sale-close">
            {BOARDING.saleCloseNote}
          </AppText>
        </>,
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
      const open = canCancel(state);
      // 마감 전: 마감 안내 + [탑승 취소] + 고객센터 한 줄. 마감 뒤: '판매가 마감되어 취소할 수 없어요.'(D-200 ④ · D-201)
      const cancelArea = (
        <View style={styles.gapTiny} testID="boarding-cancel-area">
          {open ? (
            <>
              <AppText variant="caption" testID="boarding-sale-close">
                {BOARDING.saleCloseNote}
              </AppText>
              {onCancel ? <Button label={BOARDING.cancel.button} variant="secondary" onPress={onCancel} testID="boarding-cancel" /> : null}
              <AppText variant="caption" testID="boarding-cancel-support">
                {BOARDING.cancel.supportNote}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" testID="boarding-cancel-closed">
              {BOARDING.cancel.closed}
            </AppText>
          )}
          {cancelError ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="boarding-cancel-error">
              {cancelError}
            </AppText>
          ) : null}
        </View>
      );
      return card(
        BOARDING.boarded.title,
        BOARDING.boarded.body,
        cancelArea,
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
        state.result?.kind === 'matched' ? BOARDING.matched.body : null,
        <Button label={BOARDING.matched.open} onPress={() => onOpen(hrefOf('/reveal'))} testID="boarding-open-reveal" />,
      );
    case 'no_match': {
      // 이유 줄은 두지 않는다(카피.md 14-5-2, QPM 3-2) — 제목 '완벽한 사람을 찾지 못했어요' 한 줄 + 크레딧 안내
      return card(
        BOARDING.noMatch.title,
        BOARDING.noMatch.body,
        <Button label={BOARDING.noMatch.credits} variant="secondary" onPress={() => onOpen(hrefOf('/credits'))} testID="boarding-open-credits" />,
      );
    }
    case 'ineligible': {
      const k = state.ineligible ?? 'not_confirmed';
      const c = BOARDING.ineligible[k];
      const href: Href | null = k === 'politics_missing' ? POLITICS_HREF : k === 'religion_missing' ? RELIGION_HREF : k === 'profile_missing' ? PROFILE_HREF : k === 'paused' ? hrefOf('/settings') : null;
      return card(c.title, c.body, c.action && href ? <Button label={c.action} variant="secondary" onPress={() => onOpen(href)} testID="boarding-ineligible-action" /> : undefined);
    }
  }
}

// 기다리는 동안 할 일(화면_요구사항 T2): 프로필 · 설문 다듬기 · 아는 분 피하기(12-5 — 3부-사 FB-015, 설정 안 쪽을 바로 엶) · 지난 대화.
//  아는 분 피하기 줄 글은 BOARDING.tasks.avoid(카피 20장 · 3부-아 — 이름은 12-5 AVOID.title 과 같은 말)
function Tasks({ state, onOpen, onAvoid }: { state: BoardingState; onOpen: (href: Href) => void; onAvoid: () => void }) {
  const rows: { key: string; name: string; line: string; go: () => void }[] = [
    { key: 'profile', ...BOARDING.tasks.profile, go: () => onOpen(hrefOf('/profile')) },
    { key: 'survey', ...BOARDING.tasks.survey, go: () => onOpen(SURVEY_HREF) },
    { key: 'avoid', ...BOARDING.tasks.avoid, go: onAvoid },
  ];
  const chat = state.past.find((p) => p.chatId);
  if (chat?.chatId) rows.push({ key: 'chats', name: BOARDING.tasks.chats.name, line: BOARDING.tasks.chats.line(state.past.length), go: () => onOpen(hrefOf(`/chat/${chat.chatId}`)) });
  return (
    <View style={styles.gapSmall} testID="boarding-tasks">
      <AppText variant="bodyBold" accessibilityRole="header">
        {BOARDING.tasksTitle}
      </AppText>
      {rows.map((r) => (
        <Card key={r.key} onPress={r.go} accessibilityLabel={`${r.name}, ${r.line}`} testID={`boarding-task-${r.key}`} style={styles.gapTiny}>
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
