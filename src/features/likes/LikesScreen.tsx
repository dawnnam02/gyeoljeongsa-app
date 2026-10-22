// 화면 ID 11 호감 · 14 호감 없음(K2 4장 11 · 6장 14 · 카피.md 11 · 정책 7장 · Figma 11 3:410 · 14 38:275 · 11b 195:12 · 11g 227:312).
//  머리 "호감" + 오른쪽 위 원형 프로필 사진(F11, 누르면 08) → 안전 한 줄(N34, 세 탭 맨 위) → 탭 3개(보낸 호감 · 받은 호감 · 연결됨, 처음은 받은 호감 · 알림으로 오면 ?tab=connected) → 그 탭의 목록(최신순)
//  받은 호감: "{시간} · 받은 호감" + [수락][거절] + "{n}일 뒤 만료"(NK05). 수락 → 연결됨 탭에 생김 + 토스트(탭은 그대로). 거절 → 확인창 없이 사라짐 + "거절했어요."(K2 11)
//            화면을 연 채로 7일이 지나면 '만료'(버튼 없음). 다시 불러오면 서버가 뺀다(P7-04)
//  보낸 호감: "{시간} · 수락 대기"(남은 시간 없음, P7-05) · 연결됨: "서로 수락했어요 · 연락 방법은 준비 중이에요"(누르는 동작 없음)
//  행을 누르면 10. 행 ⋯ → 신고 · 차단 시트(features/safety, 10 과 같은 시트). 신고 → 머묾 + 토스트, 차단 → 세 탭 어디서나 즉시 사라짐 + 머묾
//  탈퇴 · 차단 · 만료로 연결할 수 없는 상대: 행을 흐리게 하고 누르면 "이분과는 더 이상 연결할 수 없어요."
//  빈 상태 3종은 목록 자리에, 탭은 그대로. 14 라우트는 받은 호감 0건 상태다. 로딩 · 인터넷 · 서버 오류 + [다시 시도]
//  표시하지 않는 것: 점수 · 등급 · 순위(받지도 않는다) · 연락처(1차에 연락 수단 없음, P7-11)
//  수락 순간(D25 장면 5, F17): 수락이 끝나면 Success 햅틱 + '서로 수락' 순간(두 원 · 로고 타일 찍힘 · 같은 글)이 2.2초 보였다 걷힌다(토스트 대신). 수락 실패는 Error 햅틱.
//   탭은 그대로다(K2 11 '수락 → 연결됨 탭에 생김 + 탭은 그대로'). 시제품의 '연결됨 탭으로 옮김'은 K2 와 어긋나 하지 않았다
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedRow, Fade, haptic, scene, TOAST_MS, useCollapsingTitle } from '@/motion';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OfflineArt } from '@/components/StateArt';
import { TabHeader } from '@/components/TabHeader';
import { Toast } from '@/components/Toast';
import { COMMON, REPORT_SHEET } from '@/content/copy';
import { LIKES, type LikesTab } from '@/content/likesCopy';
import { usePhotoUrls } from '@/features/recs/usePhotoUrls';
import { ReportBlockSheet } from '@/features/safety/ReportBlockSheet';
import type { SafetyApi } from '@/features/safety/reportLogic';
import { SafetyLine } from '@/features/safety/SafetyLine';
import { useCaptureBlock } from '@/lib/captureBlock';
import type { LikeLists, LikeRow, LikesApi, LoadFailure, ReceivedLike } from '@/lib/likesApi';
import type { RecsApi } from '@/lib/recsApi';
import { likesApi, recsApi } from '@/lib/services';
import { takeToast } from '@/lib/toastBus';
import { resolveDest } from '@/navigation/resolve';
import { useMyFaceStore } from '@/store/myFaceStore';
import { colors, size, radius, space } from '@/theme/tokens';

import { expiryOf, subLine, timeAgo } from './likesLogic';
import { ExpiredMark, LikeRowView, LikesEmpty, LikesTabs, RowButton } from './LikesParts';
import { MatchMoment } from './MatchMoment';

export type LikesScreenApi = Pick<LikesApi, 'loadAll' | 'accept' | 'decline'> & Pick<RecsApi, 'photoUrl'> & SafetyApi;
export type LikesDeps = { api: LikesScreenApi; now: () => number; tickMs: number; toastMs: number };

// services 의 likesApi(11 목록 · 수락 · 거절)와 recsApi(사진 · 신고 · 차단)를 쓴다(2단계 통합 10-16)
export function defaultLikesDeps(): LikesDeps {
  return { api: { loadAll: likesApi.loadAll, accept: likesApi.accept, decline: likesApi.decline, photoUrl: recsApi.photoUrl, report: recsApi.report, block: recsApi.block }, now: Date.now, tickMs: 60_000, toastMs: TOAST_MS };
}

const tabFrom = (value: string | string[] | undefined): LikesTab | null => {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'sent' || v === 'received' || v === 'connected' ? v : null;
};
const keyOf = (row: LikeRow): string => (row.kind === 'connected' ? row.matchId : row.likeId);
const without = <T,>(record: Readonly<Record<string, T>>, key: string): Record<string, T> => {
  const next = { ...record };
  delete next[key];
  return next;
};
const dropUser = (lists: LikeLists, userId: string): LikeLists => ({
  received: lists.received.filter((r) => r.userId !== userId),
  sent: lists.sent.filter((r) => r.userId !== userId),
  connected: lists.connected.filter((r) => r.userId !== userId),
});

export function LikesScreen({ deps: given, forceEmpty = false }: { deps?: LikesDeps; forceEmpty?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [deps] = useState<LikesDeps>(() => given ?? defaultLikesDeps());
  const { api, now, tickMs, toastMs } = deps;
  useCaptureBlock();

  const [picked, setPicked] = useState<LikesTab | null>(null);
  const tab: LikesTab = forceEmpty ? (picked ?? 'received') : (picked ?? tabFrom(params.tab) ?? 'received'); // 탭바로 오면 받은 호감, 연결 알림은 ?tab=connected
  const [lists, setLists] = useState<LikeLists | null>(null);
  const [loadError, setLoadError] = useState<LoadFailure | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(() => now());
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<Readonly<Record<string, 'accept' | 'decline'>>>({});
  const busyRef = useRef(new Set<string>());
  const [notes, setNotes] = useState<Readonly<Record<string, string>>>({}); // 행 아래 한 줄(수락 실패 · 연결할 수 없음)
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set()); // 연결할 수 없는 행(흐림)
  const [sheetFor, setSheetFor] = useState<string | null>(null); // ⋯ 를 누른 행의 상대
  const [moment, setMoment] = useState<{ partnerUri: string | null } | null>(null); // 서로 수락 순간(D25 장면 5)
  const myUri = useMyFaceStore((s) => s.uri);
  const collapse = useCollapsingTitle(); // 큰 제목 줄어듦(F21)
  // 탭 바꾸기(F21 · D25 10-4 페이드 스루): Selection 햅틱(시제품 장면 11) + 목록이 나감 100 뒤 들어옴 150(이동 없음)
  const changeTab = (next: LikesTab) => {
    if (next !== tab) haptic.selection();
    setPicked(next);
  };
  const closeMoment = useCallback(() => setMoment(null), []);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadSeq = useRef(0); // Q5A-09: 마지막으로 보낸 읽기만 화면에 반영한다(옛 응답이 늦게 와 덮지 않게)
  const load = useCallback(async () => {
    const mine = ++loadSeq.current;
    const result = await api.loadAll();
    if (!alive.current || mine !== loadSeq.current) return;
    if (!result.ok) {
      setLoadError(result.reason);
      return;
    }
    setLoadError(null);
    setLists(result.data);
    setClock(now());
  }, [api, now]);

  // 화면에 들어올 때마다 읽는다(10 에서 수락 · 거절 · 차단 뒤 돌아오면 목록이 바뀐다). 10 이 남긴 토스트가 있으면 보인다. 보던 탭 · 스크롤은 그대로
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

  // 시간 글(R12) · 만료 표시가 화면을 연 채로도 바뀌게
  useEffect(() => {
    const timer = setInterval(() => setClock(now()), tickMs);
    return () => clearInterval(timer);
  }, [now, tickMs]);

  const received = forceEmpty ? [] : (lists?.received ?? []);
  const rows: LikeRow[] = !lists ? [] : tab === 'received' ? received : tab === 'sent' ? lists.sent : lists.connected;
  const urls = usePhotoUrls(lists ? [...received, ...lists.sent, ...lists.connected].map((r) => r.facePhotoId) : [], api.photoUrl);

  const note = (key: string, text: string | null) => setNotes((prev) => (text === null ? without(prev, key) : { ...prev, [key]: text }));
  const markGone = (key: string) => {
    setGone((prev) => new Set(prev).add(key));
    note(key, LIKES.unavailable);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    if (alive.current) setRefreshing(false);
  };

  const open = (row: LikeRow) => {
    const key = keyOf(row);
    if (gone.has(key) || (row.kind === 'received' && expiryOf(row.expiresAt, clock).state === 'expired')) {
      note(key, LIKES.unavailable); // 흐린 행은 10 대신 이 글
      return;
    }
    router.push({ pathname: '/candidate/[id]', params: { id: row.userId } });
  };

  const respond = async (row: ReceivedLike, kind: 'accept' | 'decline') => {
    const key = row.likeId;
    if (busyRef.current.has(key)) return; // 두 번 눌러도 요청은 한 번(R9)
    if (gone.has(key)) {
      note(key, LIKES.unavailable);
      return;
    }
    busyRef.current.add(key);
    setBusy((prev) => ({ ...prev, [key]: kind }));
    note(key, null);
    let matchId: string | null = null;
    let result: { ok: true } | { ok: false; reason: 'network' | 'server' | 'unavailable' };
    if (kind === 'accept') {
      const accepted = await api.accept(key);
      if (accepted.ok) matchId = accepted.data.matchId;
      result = accepted.ok ? { ok: true } : accepted;
    } else {
      result = await api.decline(key);
    }
    busyRef.current.delete(key);
    if (!alive.current) return;
    setBusy((prev) => without(prev, key));
    if (result.ok) {
      setLists((prev) => {
        if (!prev) return prev;
        const rest = prev.received.filter((r) => r.likeId !== key);
        if (kind === 'decline') return { ...prev, received: rest };
        // 수락 → 받은 호감에서 빠지고 연결됨 맨 위에 생긴다(서버 목록으로 곧 다시 맞춘다)
        const joined = { kind: 'connected' as const, matchId: matchId ?? `new-${key}`, userId: row.userId, createdAt: now(), head: row.head, facePhotoId: row.facePhotoId };
        return { ...prev, received: rest, connected: [joined, ...prev.connected.filter((c) => c.userId !== row.userId)] };
      });
      if (kind === 'accept') {
        haptic.success(); // 서로 수락(연결) — D25 4장
        setMoment({ partnerUri: row.facePhotoId ? (urls[row.facePhotoId] ?? null) : null });
      } else setToast(LIKES.declineDone);
      void load(); // 서버 목록으로 다시 맞춘다(탭은 그대로)
      return;
    }
    if (kind === 'accept') haptic.error();
    if (result.reason === 'unavailable') return markGone(key);
    note(key, result.reason === 'network' ? COMMON.offline : kind === 'accept' ? LIKES.acceptFailed : COMMON.server);
  };

  const goRecs = () => {
    const next = resolveDest('09');
    if (next.kind === 'href') router.push(next.href);
  };

  const subOf = (row: LikeRow): string => {
    if (row.kind === 'connected') return LIKES.connectedNote;
    return subLine(timeAgo(row.createdAt, clock), row.kind === 'received' ? LIKES.receivedLabel : LIKES.sentLabel);
  };

  const screenId = !lists ? 'screen-11-loading' : tab === 'received' && received.length === 0 ? 'screen-14' : 'screen-11';

  return (
    <Screen edges={['top']} enter="tab">
      <TabHeader title={LIKES.headerTitle} collapse={collapse} testID="likes-header" />
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        onScroll={collapse.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        testID={screenId}>
        <SafetyLine testID="likes-safety" />
        <LikesTabs value={tab} onChange={changeTab} />
        {!lists ? (
          <View style={styles.centerBox}>
            {loadError ? (
              <>
                <OfflineArt show={loadError === 'network'} />
                <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered} testID="likes-error">
                  {loadError === 'network' ? COMMON.offline : COMMON.server}
                </AppText>
                <Button
                  label={COMMON.retry}
                  onPress={() => {
                    setLoadError(null);
                    void load();
                  }}
                  testID="likes-retry"
                />
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.accent} />
                <AppText variant="caption">{COMMON.loading}</AppText>
              </>
            )}
          </View>
        ) : (
          <>
            {loadError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="likes-reload-error">
                {loadError === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
            ) : null}
            <Fade key={tab} visible delay={scene.fadeThrough.out} duration={scene.fadeThrough.in} name="out">
            {rows.length === 0 ? (
              <LikesEmpty tab={tab} onRecs={goRecs} />
            ) : (
              <View style={styles.list} testID={`likes-list-${tab}`}>
                {rows.map((row, i) => {
                  const key = keyOf(row);
                  const id = `${tab}-${i}`;
                  const expiry = row.kind === 'received' ? expiryOf(row.expiresAt, clock) : null;
                  const dead = gone.has(key) || expiry?.state === 'expired';
                  let actions: ReactNode = null;
                  if (row.kind === 'received') {
                    const state = busy[key];
                    actions =
                      expiry?.state === 'expired' ? (
                        <ExpiredMark testID={`like-expired-${id}`} />
                      ) : (
                        <>
                          <RowButton label={LIKES.accept} a11y={LIKES.acceptA11y(row.head)} tone="accept" busy={state === 'accept'} locked={state !== undefined} dimmed={dead} onPress={() => void respond(row, 'accept')} testID={`like-accept-${id}`} />
                          <RowButton label={LIKES.decline} a11y={LIKES.declineA11y(row.head)} tone="decline" busy={state === 'decline'} locked={state !== undefined} dimmed={dead} onPress={() => void respond(row, 'decline')} testID={`like-decline-${id}`} />
                          {expiry ? (
                            <AppText variant="caption" testID={`like-expiry-${id}`}>
                              {expiry.label}
                            </AppText>
                          ) : null}
                        </>
                      );
                  }
                  return (
                    <AnimatedRow key={key}>
                    <LikeRowView
                      id={id}
                      head={row.head}
                      sub={subOf(row)}
                      uri={row.facePhotoId ? urls[row.facePhotoId] : null}
                      hasPhoto={row.facePhotoId !== null}
                      dim={dead}
                      first={i === 0}
                      note={notes[key] ?? null}
                      onOpen={() => open(row)}
                      onMore={() => setSheetFor(row.userId)}
                      actions={actions}
                    />
                    </AnimatedRow>
                  );
                })}
              </View>
            )}
            </Fade>
          </>
        )}
      </Animated.ScrollView>

      <ReportBlockSheet
        visible={sheetFor !== null}
        targetId={sheetFor ?? ''}
        api={api}
        onClose={() => setSheetFor(null)}
        onReported={() => {
          setSheetFor(null);
          setToast(REPORT_SHEET.done); // 신고 → 이 화면에 머문다. 서버가 신고자에게 상대를 숨기면 다시 불러올 때 행이 사라진다
          void load();
        }}
        onBlocked={() => {
          const target = sheetFor;
          setSheetFor(null);
          if (target) setLists((prev) => (prev ? dropUser(prev, target) : prev)); // 세 탭 어디에서도 즉시 사라진다
          setToast(REPORT_SHEET.blockDone);
          void load();
        }}
        onUnavailable={() => {
          const target = sheetFor;
          setSheetFor(null);
          if (target && lists) [...lists.received, ...lists.sent, ...lists.connected].filter((r) => r.userId === target).forEach((r) => markGone(keyOf(r)));
          void load();
        }}
        testID="report"
      />
      <Toast text={toast} testID="likes-toast" />
      {moment ? <MatchMoment text={LIKES.acceptDone} myUri={myUri} partnerUri={moment.partnerUri} onDone={closeMoment} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s12, paddingBottom: space.s24, gap: space.s8, flexGrow: 1 },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingVertical: space.s40 },
  centered: { textAlign: 'center' },
});
