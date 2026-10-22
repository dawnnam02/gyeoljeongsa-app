// 화면 ID 09 오늘의 추천 · 13 추천 없음(K2 4장 09 · 6장 13 · 카피.md 09 · N16 · Figma 3:309).
//  머리: "오늘의 추천" + 오른쪽 위 원형 프로필 사진(F11, 누르면 08). "다음 추천까지 14시간 32분"(서버의 다음 갱신 시각 − 서버 현재 시각, 1분마다 바뀐다)은 머리 오른쪽에서
//  부제 바로 아래 작은 글 한 줄(12 sub, 간격 4)로 옮겼다(D19 5장 · K7-2). 13 · 첫 추천 대기 · 준비 중 상태는 content 맨 위에 이 시간 줄만 둔다
//  카드 0~3장: 사진 96×120 · "김OO · 32 · 서울 강남" · 한 줄 정보 · "맞는 점" + 칩 최대 3 · 호감 보냄 / 넘김 라벨. 서버가 준 순서 그대로(정렬 없음)
//  0명: 빈 상태(제목 · 본문 · 보조 · [희망 조건 보기]). 시간이 0이 되면 자동으로 다시 불러온다. 당겨서 새로고침은 다시 불러오기일 뿐이다
//  등급 배지(F13): 서버가 카드에 grade_no 를 준 때(구독자 + 상대 CK10 동의)만 이름 줄 옆에 '{n}등급' 칩. 없으면 아무것도 없다(자물쇠 · 흐린 배지 · '비공개' 글자 금지)
//  추가로 받은 추천(F13): 1회 매칭으로 받은 카드(source 'match_once')는 무료 3장 아래 '추가로 받은 추천' 구역. 카드 모양 · 넘기기 · 상세는 같다
//  지역 안내(F16 · B15, D-66 ①): 서버 region_hint 가 true 이고 무료 카드가 1~2장이면 무료 카드 아래에 안내 3줄(오늘은 {n}분만 추천했어요… · 조건은 내가 직접 바꿀 때만 달라져요. · [지역 조건 바꾸기]).
//   단추는 12 희망 조건 수정의 길로 이동만 한다(서버 값을 바꾸지 않는다). 0장은 기존 빈 상태 글. 부제는 1명 '한 분' · 2명 '두 분' · 3명 '세 분'(B16)
//  표시하지 않는 것: 점수 · 순위(받지도 않는다)
//  움직임(D25 장면 3 · 6, F17): 처음 불러오는 동안 카드와 같은 틀의 뼈대(은은한 밝기 1600ms 주기). 목록이 오면 부제 · 시간 줄이 올라오고(250, 60ms 간격)
//   250ms 뒤 카드가 편지처럼 놓인다(한 장 520ms · 70ms 차례 · 3° 안 기울기). 당겨서 새로고침을 놓으면 Light 햅틱, 새 목록이 오면 다시 놓인다.
//   10 에서 돌아와 다시 읽을 때는 움직이지 않는다(첫 화면 진입 · 새로고침에만). 바탕 bgGrad 높이 300. 동작 줄이기: 투명도만
//  v2(F21 · D36 · D25 10장): 큰 제목 줄어듦 · 탭 페이드 스루 · 대기 단계표(0.3초 안 아무것도 → 뼈대 → 반짝임 → 10초 넘으면 멈춤 + 글) ·
//   '다음 추천까지' 알약(굴리지 않고 분이 바뀌면 조용히 교체) · 카드 = 종이(bg + line 1 · 둥글기 20) · 카드 사진이 10 큰 사진으로 이어 붙음(motion/PhotoHandoff)
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { TimePill } from '@/components/Badges';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { OfflineArt, StateArt } from '@/components/StateArt';
import { TabHeader } from '@/components/TabHeader';
import { Toast } from '@/components/Toast';
import { COMMON, RECS } from '@/content/copy';
import { haptic, Land, Rise, scene, SkeletonCard, startHandoff, TOAST_MS, useCollapsingTitle, WaitState, type Rect } from '@/motion';
import { BADGE16, SHOP16 } from '@/content/shopCopy';
import { GradeBubble, GradeChip } from '@/features/grade/GradeBadge';
import { PREFERENCES_EDIT_ENABLED } from '@/config/flags';
import { useCaptureBlock } from '@/lib/captureBlock';
import type { RecCard, RecsApi, TodayData } from '@/lib/recsApi';
import { recsApi } from '@/lib/services';
import { takeToast } from '@/lib/toastBus';
import { resolveDest } from '@/navigation/resolve';
import { layout } from '@/theme/layout';
import { H2_EMPTY_ART, UI_ICONS } from '@/theme/uiAssets';
import { alpha, colors, size, space } from '@/theme/tokens';

import { PhotoBox } from './PhotoBox';
import { emptyKind, firstWaitText, formatRemaining, msUntil, remainingLabel, subtitleFor, widenCount } from './recsLogic';
import { usePhotoUrls } from './usePhotoUrls';

export type RecsDeps = { api: Pick<RecsApi, 'loadToday' | 'photoUrl'>; now: () => number; tickMs: number; toastMs: number };
const defaultDeps: RecsDeps = { api: recsApi, now: Date.now, tickMs: 15_000, toastMs: TOAST_MS };
const RELOAD_RETRY_MS = 30_000; // 시간이 지났는데 서버가 아직 새 목록을 안 줬을 때 다시 묻는 간격

export function RecommendationsScreen({ deps = defaultDeps, forceEmpty = false }: { deps?: RecsDeps; forceEmpty?: boolean }) {
  const router = useRouter();
  const { api, now, tickMs, toastMs } = deps;
  useCaptureBlock();
  const collapse = useCollapsingTitle();

  const [data, setData] = useState<TodayData | null>(null);
  const [loadError, setLoadError] = useState<'network' | 'server' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(() => now());
  const [toast, setToast] = useState<string | null>(null);
  const [landing, setLanding] = useState(0); // 카드가 놓이는 차례 번호: 첫 목록 · 당겨서 새로고침 뒤에만 1 씩 오른다
  const pulled = useRef(false);
  const hadData = useRef(false);
  const alive = useRef(true);
  const lastReload = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadSeq = useRef(0); // Q5A-09: 마지막으로 보낸 읽기만 반영
  const load = useCallback(async () => {
    lastReload.current = now();
    const mine = ++loadSeq.current;
    const result = await api.loadToday();
    if (!alive.current || mine !== loadSeq.current) return;
    if (!result.ok) {
      setLoadError(result.reason);
      return;
    }
    setLoadError(null);
    if (!hadData.current || pulled.current) setLanding((n) => n + 1);
    hadData.current = true;
    pulled.current = false;
    setData(result.data);
    setClock(now());
  }, [api, now]);

  // 화면에 들어올 때마다 읽는다(10 에서 호감 · 넘김 · 차단 뒤 돌아왔을 때 카드 상태가 바뀐다). 10 이 남긴 토스트가 있으면 보인다
  useFocusEffect(
    useCallback(() => {
      void load();
      const text = takeToast();
      if (text) setToast(text);
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(timer);
  }, [toast, toastMs]);

  // 남은 시간을 다시 센다. 0 이 되면 자동으로 다시 불러온다(새 추천이 있으면 카드가 바뀌고 없으면 빈 상태)
  const remainingMs = data ? msUntil(data.nextAt, clock, data.offset) : null;
  const near = remainingMs !== null && remainingMs < 60_000; // 1분 안으로 남으면 1초마다 확인해 0 이 되는 순간 다시 불러온다
  useEffect(() => {
    const timer = setInterval(() => setClock(now()), near ? 1_000 : tickMs);
    return () => clearInterval(timer);
  }, [now, tickMs, near]);
  const expired = remainingMs !== null && remainingMs <= 0;
  useEffect(() => {
    if (expired && now() - lastReload.current >= Math.min(RELOAD_RETRY_MS, tickMs * 2, 10_000)) void load();
  }, [expired, clock, load, now, tickMs]);

  const cards = forceEmpty ? [] : (data?.cards ?? []);
  const urls = usePhotoUrls(cards.map((c) => c.face.photoId), api.photoUrl);

  const onRefresh = async () => {
    haptic.light(); // 당겨서 새로고침을 놓음(D25 4장)
    pulled.current = true;
    setRefreshing(true);
    await load();
    if (alive.current) setRefreshing(false);
  };

  const open = (card: RecCard, photo: Rect | null) => {
    if (card.passed) return; // 넘긴 카드는 눌러도 열리지 않는다(가안, K3 확인)
    startHandoff(card.id, card.face.photoId ? (urls[card.face.photoId] ?? null) : null, photo); // 카드 사진 → 10 큰 사진(동작 줄이기 · 잴 수 없음이면 하지 않음)
    router.push({ pathname: '/candidate/[id]', params: { id: card.id } });
  };

  const finished = cards.length > 0 && cards.every((c) => c.liked || c.passed || c.connected);
  // 부제 · 지역 안내는 무료 추천 수 기준이다(1회 매칭으로 받은 카드는 '추가로 받은 추천' 구역이라 세지 않는다)
  const freeCount = cards.filter((c) => c.source === 'free').length;
  const widen = forceEmpty || !data ? null : widenCount(data.regionHint, freeCount);
  const goWiden = () => {
    // 이동만 한다: 12 희망 조건 수정과 같은 길(지역은 04-27). 서버 값은 본인이 그 화면에서 직접 바꿀 때만 달라진다
    const next = resolveDest('04:25', { origin: '09' });
    if (next.kind === 'href') router.push(next.href);
  };
  // 0장일 때: 13 추천 없음 · 준비 중(NK02) · 첫 추천 대기(NK01). 서버 시각(now)으로 가른다. 라우트 13 은 늘 추천 없음
  const serverNow = clock + (data?.offset ?? 0);
  const zero = forceEmpty || !data ? 'empty' : emptyKind(data.firstListPending, data.ready);
  const headRemaining = remainingMs === null ? null : remainingLabel(remainingMs);
  const remainingLine = <TimePill testID="recs-remaining">{headRemaining}</TimePill>;

  return (
    <Screen edges={['top']} backdrop={forceEmpty ? 'base' : 'recommendations'} enter="tab">
      <TabHeader title={RECS.headerTitle} collapse={collapse} testID="recs-header" />

      {!data ? (
        <View style={styles.centerBox} testID={forceEmpty ? 'screen-13-loading' : 'screen-09-loading'}>
          {loadError ? (
            <>
              <OfflineArt show={loadError === 'network'} />
              <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered} testID="recs-error">
                {loadError === 'network' ? COMMON.offline : RECS.loadFailed}
              </AppText>
              <Button
                label={COMMON.retry}
                inline
                onPress={() => {
                  setLoadError(null);
                  void load();
                }}
                testID="recs-retry"
              />
            </>
          ) : (
            <View style={styles.skeleton} accessible accessibilityLabel={COMMON.loading} accessibilityLiveRegion="polite" testID="recs-skeleton">
              <WaitState
                waiting
                skeleton={
                  <View style={styles.skeletonCards}>
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </View>
                }
                note={
                  <AppText variant="body" tone="sub" testID="recs-wait-long">
                    {COMMON.loading}
                  </AppText>
                }
                testID="recs-wait"
              />
            </View>
          )}
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={styles.content}
          onScroll={collapse.onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          testID={cards.length === 0 ? 'screen-13' : 'screen-09'}>
          {cards.length === 0 && headRemaining ? remainingLine : null}
          {cards.length === 0 && zero !== 'empty' ? (
            <View style={styles.empty} testID={zero === 'first' ? 'recs-first-wait' : 'recs-preparing'}>
              <EmptyArt />
              <AppText variant="title" style={styles.centered} accessibilityRole="header" testID="recs-wait-title">
                {zero === 'first' && data ? firstWaitText(data.nextAt, serverNow) : RECS.preparing}
              </AppText>
              <AppText variant="body" tone="sub" style={styles.centered} testID="recs-wait-note">
                {zero === 'first' ? RECS.firstWaitNote : RECS.preparingNote}
              </AppText>
            </View>
          ) : cards.length === 0 ? (
            <View style={styles.empty} testID="recs-empty">
              <EmptyArt />
              <AppText variant="title" style={styles.centered} accessibilityRole="header">
                {RECS.emptyTitle}
              </AppText>
              <AppText variant="body" tone="sub" style={styles.centered} testID="recs-empty-body">
                {RECS.emptyBody}
              </AppText>
              {PREFERENCES_EDIT_ENABLED ? ( // 임시 설문(F2L) 동안 희망 조건 수정이 없어 보조 한 줄과 버튼을 숨긴다(D-48)
                <>
                  <AppText variant="caption" style={styles.centered}>
                    {RECS.emptyHint}
                  </AppText>
                  <Button
                    label={RECS.emptyButton}
                    onPress={() => {
                      const next = resolveDest('04:25', { origin: '09' });
                      if (next.kind === 'href') router.push(next.href);
                    }}
                    testID="recs-empty-prefs"
                  />
                </>
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.subBlock} key={`sub-${landing}`}>
                {freeCount > 0 ? (
                  <Rise play={landing > 0} duration={scene.today.subline}>
                    <AppText variant="body" tone="sub" testID="recs-subtitle">
                      {subtitleFor(freeCount)}
                    </AppText>
                  </Rise>
                ) : null}
                {headRemaining ? (
                  <Rise play={landing > 0} delay={scene.today.sublineGap} duration={scene.today.subline}>
                    {remainingLine}
                  </Rise>
                ) : null}
              </View>
              {loadError ? (
                <AppText variant="captionMedium" tone="accent" accessibilityRole="alert">
                  {loadError === 'network' ? COMMON.offline : RECS.loadFailed}
                </AppText>
              ) : null}
              {cards.map((card, i) =>
                card.source === 'free' ? (
                  <Land key={`${landing}-${card.id}`} index={i} delay={scene.today.subline} play={landing > 0}>
                    <RecCardView card={card} uri={card.face.photoId ? urls[card.face.photoId] : null} onOpen={(photo) => open(card, photo)} index={i} />
                  </Land>
                ) : null,
              )}
              {widen !== null ? (
                <Card style={styles.widen} testID="recs-widen">
                  <AppText variant="body" tone="text" testID="recs-widen-note">
                    {RECS.widenNote(widen)}
                  </AppText>
                  <AppText variant="caption" testID="recs-widen-own">
                    {RECS.widenOwnNote}
                  </AppText>
                  <Button label={RECS.widenButton} variant="secondary" onPress={goWiden} testID="recs-widen-button" />
                </Card>
              ) : null}
              {cards.some((c) => c.source === 'match_once') ? (
                <>
                  <AppText variant="bodyBold" accessibilityRole="header" style={styles.extraTitle} testID="recs-extra-title">
                    {SHOP16.extraTitle}
                  </AppText>
                  {cards.map((card, i) => (card.source === 'match_once' ? <RecCardView key={card.id} card={card} uri={card.face.photoId ? urls[card.face.photoId] : null} onOpen={(photo) => open(card, photo)} index={i} /> : null))}
                </>
              ) : null}
              {finished && remainingMs !== null ? (
                <>
                  <StateArt source={H2_EMPTY_ART.emptyRecsEnd} size={layout.stateArt} testID="recs-done-art" />
                  <AppText variant="body" tone="sub" testID="recs-done">
                    {RECS.allDone(formatRemaining(remainingMs))}
                  </AppText>
                </>
              ) : null}
            </>
          )}
        </Animated.ScrollView>
      )}
      <Toast text={toast} testID="recs-toast" />
    </Screen>
  );
}

// 13 · NK01 · NK02 빈 상태 그림(디자인/아이콘/투명/20_빈상태_추천없음.png, 칸 144 · 그림 140 · 제목 위 24, Figma 88:29). 꾸밈 그림이라 스크린리더는 건너뛴다
function EmptyArt() {
  return (
    <View style={styles.artSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="recs-empty-art">
      <Image source={UI_ICONS.emptyRecs} style={styles.art} resizeMode="contain" />
    </View>
  );
}

function RecCardView({ card, uri, onOpen, index }: { card: RecCard; uri: string | null | undefined; onOpen: (photo: Rect | null) => void; index: number }) {
  const [bubble, setBubble] = useState(false); // 등급 칩을 누르면 말풍선(NV82)이 열린다
  // 사진 이어 붙임(F21): 손가락이 닿을 때 사진 칸의 화면 위 자리를 재 두고, 누름이 끝나면 넘긴다(잴 수 없는 환경이면 null)
  const photoRef = useRef<View>(null);
  const photoRect = useRef<Rect | null>(null);
  const measure = () => {
    const node = photoRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, width, height) => {
      photoRect.current = { x, y, width, height };
    });
  };
  const status = card.passed ? RECS.passedLabel : card.liked || card.connected ? RECS.sentLabel : null;
  // 넘김 카드는 카드 전체(면 · 글 · 칩 · "넘김" 알약)를 40% 로(가이드 3장 비활성, D8 4차 M9)
  return (
    <Card
      variant="paper"
      onPressIn={measure}
      onPress={() => onOpen(photoRect.current)}
      accessibilityLabel={`${RECS.cardA11y(card.head)}${card.gradeNo !== null ? `, ${BADGE16.a11y(card.gradeNo)}` : ''}${status ? `, ${status}` : ''}`}
      testID={`rec-card-${index}`}
      style={[styles.card, card.passed ? styles.dim : null]}>
      <View ref={photoRef} collapsable={false}>
        <PhotoBox state={card.face.state} uri={uri} style={styles.photo} testID={`rec-photo-${index}`} />
      </View>
      <View style={styles.info}>
        <View>
          <View style={styles.nameRow}>
            <AppText variant="bodyBold" numberOfLines={1} style={styles.nameText} testID={`rec-head-${index}`}>
              {card.head}
            </AppText>
            {card.gradeNo !== null ? <GradeChip n={card.gradeNo} open={bubble} onPress={() => setBubble((v) => !v)} testID={`rec-grade-${index}`} /> : null}
          </View>
          {bubble && card.gradeNo !== null ? <GradeBubble n={card.gradeNo} testID={`rec-grade-${index}`} /> : null}
          {card.info ? (
            <AppText variant="caption" numberOfLines={2} testID={`rec-info-${index}`}>
              {card.info}
            </AppText>
          ) : null}
        </View>
        {card.reasons.length > 0 || status ? (
          <View style={styles.labelRow}>
            {card.reasons.length > 0 ? (
              <AppText variant="captionMedium" tone="sub" testID={`rec-match-${index}`}>
                {RECS.matchLabel}
              </AppText>
            ) : (
              <View />
            )}
            {status ? <Chip label={status} variant={card.passed ? 'inactive' : 'tag'} testID={`rec-status-${index}`} /> : null}
          </View>
        ) : null}
        {card.reasons.length > 0 ? (
          <View style={styles.chips} testID={`rec-chips-${index}`}>
            {card.reasons.map((r) => (
              <Chip key={r} label={r} variant="tag" />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.s8 },
  nameText: { flexShrink: 1 },
  extraTitle: { paddingTop: space.s8 },
  widen: { gap: space.s8 }, // 지역 안내 카드: 글 2줄 + 단추(Figma 09b 394:1175)
  subBlock: { gap: space.s4 }, // 부제 – 다음 추천까지 간격 4(D19 5장)
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s12, flexGrow: 1 },
  card: { flexDirection: 'row', gap: space.s12, padding: space.s12 },
  photo: { width: layout.cardPhotoWidth, height: layout.cardPhotoHeight },
  info: { flex: 1, minWidth: 0, gap: space.s4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: size.chip },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  dim: { opacity: alpha.disabled },
  empty: { flex: 1, alignItems: 'stretch', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  artSlot: { alignSelf: 'center', width: layout.emptyArtSlot, height: layout.emptyArtSlot, alignItems: 'center', justifyContent: 'center', marginBottom: space.s24 - space.s12 }, // 제목 위 24(목록 간격 12 + 12)
  art: { width: layout.emptyArt, height: layout.emptyArt },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  skeleton: { alignSelf: 'stretch', flex: 1, paddingTop: space.s20, gap: space.s12 }, // 카드 목록과 같은 자리 · 간격
  skeletonCards: { gap: space.s12 },
  centered: { textAlign: 'center' },
});
