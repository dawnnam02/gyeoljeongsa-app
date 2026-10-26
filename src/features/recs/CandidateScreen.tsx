// 화면 ID 10 상대 프로필(K2 4장 10 · 카피.md 10 · Figma 3:376 · 신고 · 차단 시트 195:12).
//  사진 3장을 옆으로 넘긴다("사진 1 / 3", 이전 · 다음 버튼도 있다) → "김OO · 32 · 서울 강남" → 한 줄 정보 → 표 3줄(없으면 "비공개") → "왜 추천했나요"(맞은 항목이 1개 이상일 때만)
//  → 서류 확인 안내 · 안전 안내 → 하단(get_pair_state, F6): none [넘기기][호감 보내기] · sent "호감 보냄" · received [거절][수락] · connected 안내 한 줄.
//  공개 범위로 거르는 일은 서버가 한다 — 앱은 받은 것만 그린다(R5)
//  넘기기: 확인창 없이 처리하고 되돌릴 수 없다 → 09(그 카드는 '넘김'). 호감 보내기: 같은 분께 두 번 못 보낸다 → 09 + 토스트
//  신고 · 차단: 상단 우측 → 시트. 신고 제출은 이 화면에 머물고(토스트 "신고했어요…"), 차단은 진입한 화면으로 돌아간다
//  등급(F13): 구독자 + 상대가 CK10 에 동의했을 때만 머리 아래에 배지 + NV55 · NV81 · NV85 + 한계 문구. 동의 안 한 상대는 아무것도 없다('비공개' 글자도 없다).
//  비구독자는 맨 아래 한 줄 NV47(등급 구독 상세로). 서버가 비구독자 응답에 등급을 주지 않는다 — 구독 여부는 get_partner_grade 의 locked 로 안다
//  움직임 · 햅틱(D25 장면 4 · 4장, F17): [호감 보내기]를 누르면 Light → 보내지면 버튼이 '호감 보냄'으로 바뀌고 작은 편지 한 통이 위로 떠난다(700) → 09 + 토스트.
//   하루 한도 안내 Warning · 보내기 · 수락 실패 Error · 받은 호감 수락 Success. 동작 줄이기: 편지 없이 바로 09
//  표시하지 않는 것: 점수 · 순위(받지도 않는다). "왜 추천했나요" 둘째 문장은 법무가 유지하라고 확인한 글(별도 문자열)
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { cancelHandoff, haptic, MailFly, returnHandoff, Rise, scene, setHandoffTarget, TOAST_MS, useHandoffHidesPhoto, useHandoffStore, useReduceMotion, type Rect } from '@/motion';
import { GlanceRow, IconButton } from '@/components/Badges';
import { BottomCTA, CtaPair, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt } from '@/components/StateArt';
import { Toast } from '@/components/Toast';
import { CANDIDATE, COMMON, RECS, REPORT_SHEET, SAFETY } from '@/content/copy';
import { LIKES } from '@/content/likesCopy';
import { BADGE16, GRADE16 } from '@/content/shopCopy';
import { GradeImage } from '@/features/grade/GradeBadge';
import { likeButtonMode, sendFailureMode, type LikeButtonMode } from '@/features/likes/likeGate';
import { useCaptureBlock } from '@/lib/captureBlock';
import type { GradeApi, PartnerGrade } from '@/lib/gradeApi';
import type { LikesApi } from '@/lib/likesApi';
import type { CandidateData, RecsApi } from '@/lib/recsApi';
import { gradeApi, likesApi, recsApi } from '@/lib/services';
import { setToast as passToast } from '@/lib/toastBus';
import { goBackOr } from '@/navigation/go';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';
import { ReportBlockSheet } from '@/features/safety/ReportBlockSheet';

import { PhotoBox } from './PhotoBox';
import { MarriageViews } from './MarriageViews';
import { PromptCards } from './PromptCards';
import { detailInfoLine, galleryPhotos, headLineDetail, heightText, openItems, plain, REASON_NAMES, regionText, tableRows, whySentence } from './recsLogic';
import { usePhotoUrls } from './usePhotoUrls';

export type CandidateDeps = { api: Pick<RecsApi, 'loadCandidate' | 'pairState' | 'photoUrl' | 'pass' | 'sendLike' | 'report' | 'block'>; likes?: Pick<LikesApi, 'accept' | 'decline'>; grade?: Pick<GradeApi, 'partnerGrade'>; toastMs: number };
const defaultDeps: CandidateDeps = { api: recsApi, likes: likesApi, grade: gradeApi, toastMs: TOAST_MS };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function CandidateScreen({ deps = defaultDeps }: { deps?: CandidateDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = first(params.id) ?? '';
  const { api, toastMs } = deps;
  const likes = deps.likes ?? likesApi;
  const grade = deps.grade ?? gradeApi;
  useCaptureBlock();

  const [data, setData] = useState<CandidateData | null | undefined>(undefined); // undefined 로딩 · null 볼 수 없음
  const [loadError, setLoadError] = useState<'network' | 'server' | null>(null);
  const [mode, setMode] = useState<LikeButtonMode>('send'); // 하단 모양(F6 likeGate)
  const [likeId, setLikeId] = useState<string | null>(null); // received 일 때 수락 · 거절할 호감
  const [partner, setPartner] = useState<PartnerGrade | null>(null); // get_partner_grade: 비구독자 locked · 구독자는 상대 등급(CK10 동의일 때만)
  const liked = mode === 'sent';
  const limit = mode === 'limit';
  const [busy, setBusy] = useState<'pass' | 'like' | 'accept' | 'decline' | null>(null);
  const busyRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(0); // 토스트를 하단 바 위로(D8 4차 M14)
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  const alive = useRef(true);
  const reduce = useReduceMotion();
  const [mailing, setMailing] = useState(false); // 호감을 보낸 뒤 편지가 떠나는 동안(D25 장면 4)

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const result = await api.loadCandidate(id);
    if (!alive.current) return;
    if (!result.ok) {
      setLoadError(result.reason);
      return;
    }
    setLoadError(null);
    setData(result.data);
    // 하단 모양: 보낸 분 "호감 보냄" · 받은 호감 [거절][수락] · 연결 안내 · 오늘 한도를 다 썼으면 미리 흐리게(서버가 보낼 때 최종으로 막는다)
    if (result.data) {
      const pair = await api.pairState(id);
      if (!alive.current) return;
      setMode((m) => (m === 'hidden' ? m : likeButtonMode(pair)));
      setLikeId(pair?.likeId ?? null);
      const pg = await grade.partnerGrade(id); // 못 읽으면 null → 프로필 응답의 grade_no 만 따른다
      if (!alive.current) return;
      setPartner(pg);
    }
  }, [api, grade, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(timer);
  }, [toast, toastMs]);

  const urls = usePhotoUrls(data ? data.photos.map((p) => p.photoId) : [], api.photoUrl);
  // 사진 이어 붙임(F21): 09 카드에서 이어 붙어 들어왔으면 정보가 60ms 간격으로 떠오르고, 뒤로 갈 때 큰 사진이 카드 자리로 되돌아간다
  const [viaHandoff] = useState(() => {
    const h = useHandoffStore.getState();
    return h.id === id && h.phase === 'going';
  });
  const hidePhoto = useHandoffHidesPhoto(id);
  const galleryRef = useRef<View>(null);
  const measureGallery = (done: (rect: Rect | null) => void) => {
    const node = galleryRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return done(null);
    node.measureInWindow((x, y, w, h) => done({ x, y, width: w, height: h }));
  };
  useEffect(() => () => cancelHandoff(id), [id]);
  const leave = () => goBackOr(router, '/recommendations');
  const back = () => {
    if (!viaHandoff) return leave();
    measureGallery((rect) => {
      returnHandoff(id, rect);
      leave();
    });
  };

  const run = async (kind: 'pass' | 'like') => {
    if (busyRef.current || !data) return;
    busyRef.current = true;
    setBusy(kind);
    setActionError(null);
    if (kind === 'pass') {
      const result = await api.pass(id);
      busyRef.current = false;
      if (!alive.current) return;
      setBusy(null);
      if (result.ok) return back(); // 09 에서 그 카드는 '넘김'
      if (result.reason === 'unavailable') return setData(null);
      setActionError(result.reason === 'network' ? COMMON.offline : CANDIDATE.passFailed);
      return;
    }
    haptic.light(); // 호감 보내기 누름(D25 4장)
    const result = await api.sendLike(id);
    if (!alive.current) return;
    if (result.ok) {
      // 버튼은 '호감 보냄', 편지가 떠난 뒤(700) 09 + 토스트. 그동안 다시 누를 수 없다(busyRef 는 떠날 때까지 잠근다)
      const text = result.data.connected ? CANDIDATE.likeConnected : CANDIDATE.likeDone;
      setBusy(null);
      setMode('sent');
      setMailing(true);
      setTimeout(() => {
        busyRef.current = false;
        if (!alive.current) return;
        passToast(text);
        back();
      }, reduce ? 0 : scene.like.mail);
      return;
    }
    busyRef.current = false;
    setBusy(null);
    if (result.reason === 'already') return setMode('sent'); // 이미 보낸 분: 두 번 보내지 않는다
    if (result.reason === 'limit') {
      haptic.warning(); // 하루 호감 한도 안내
      return setMode('limit');
    }
    if (result.reason === 'unavailable') {
      // 규칙 ②(likeGate): 프로필이 아직 보이면 거절된 쌍(거절한 사람이 같은 날 연 상대) — 오류 글 없이 [호감 보내기]만 숨긴다
      const again = await api.loadCandidate(id);
      if (!alive.current) return;
      if (sendFailureMode('unavailable', again.ok && again.data !== null) === 'hidden') return setMode('hidden');
      return setData(null);
    }
    haptic.error();
    setActionError(result.reason === 'network' ? COMMON.offline : CANDIDATE.likeFailed);
  };

  // 받은 호감(10 하단 received): 11 의 [수락] · [거절]과 같은 동작. 성공하면 토스트를 남기고 진입한 화면(11)으로
  const respond = async (kind: 'accept' | 'decline') => {
    if (busyRef.current || !likeId) return;
    busyRef.current = true;
    setBusy(kind);
    setActionError(null);
    const result = kind === 'accept' ? await likes.accept(likeId) : await likes.decline(likeId);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(null);
    if (result.ok) {
      if (kind === 'accept') haptic.success(); // 서로 수락(연결)
      passToast(kind === 'accept' ? LIKES.acceptDone : LIKES.declineDone);
      return goBackOr(router, '/likes');
    }
    if (kind === 'accept') haptic.error();
    setActionError(result.reason === 'network' ? COMMON.offline : result.reason === 'unavailable' ? LIKES.unavailable : kind === 'accept' ? LIKES.acceptFailed : COMMON.server);
  };

  const goTo = (n: number) => {
    const next = Math.max(0, Math.min((data ? galleryPhotos(data.photos).length : 1) - 1, n));
    setPage(next);
    pager.current?.scrollTo({ x: next * width, animated: true });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };
  const onPagerLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    if (viaHandoff) measureGallery((rect) => setHandoffTarget(id, rect));
  };

  // 로딩 · 오류 · 볼 수 없음
  if (data === undefined) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={CANDIDATE.headerTitle} onBack={back} testID="candidate-header" />
        <View style={styles.centerBox} testID="screen-10-loading">
          {loadError ? (
            <>
              <OfflineArt show={loadError === 'network'} />
              <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered} testID="candidate-error">
                {loadError === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
              <Button
                label={COMMON.retry}
                inline
                onPress={() => {
                  setLoadError(null);
                  void load();
                }}
                testID="candidate-retry"
              />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="caption">{COMMON.loading}</AppText>
            </>
          )}
        </View>
      </Screen>
    );
  }
  if (data === null) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={CANDIDATE.headerTitle} onBack={back} testID="candidate-header" />
        <View style={styles.centerBox} testID="screen-10-unavailable">
          <AppText variant="body" tone="text" style={styles.centered} accessibilityRole="alert">
            {CANDIDATE.unavailable}
          </AppText>
          <Button label={CANDIDATE.confirm} onPress={back} testID="candidate-unavailable-ok" />
        </View>
      </Screen>
    );
  }

  // 비구독자(locked)에게는 등급 자리를 만들지 않는다. 구독자는 서버가 준 번호가 있을 때만(상대 CK10 동의)
  const shownGrade = partner?.locked ? null : (partner?.gradeNo ?? data.gradeNo);
  const rows = tableRows(data.answers);
  const open = openItems(data.answers);
  const why = whySentence(data.reasons);
  const shown = galleryPhotos(data.photos);
  const total = shown.length;

  return (
    <Screen edges={['top']} enter={viaHandoff ? 'none' : 'depth'}>
      <ScreenHeader title={CANDIDATE.headerTitle} onBack={back} rightLabel={REPORT_SHEET.title} onRight={() => setSheet(true)} testID="candidate-header" />
      <ScrollView contentContainerStyle={styles.content} testID="screen-10">
        <View ref={galleryRef} collapsable={false} style={[styles.gallery, hidePhoto ? styles.waiting : null]} onLayout={onPagerLayout} testID="candidate-gallery">
          <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} scrollEventThrottle={16}>
            {shown.map((p, i) => (
              <PhotoBox key={p.slot} state={p.state} uri={p.photoId ? urls[p.photoId] : null} label={`${RECS.photoA11y} ${i + 1}`} style={[styles.slide, width > 0 ? { width } : null]} testID={`candidate-photo-${i}`} />
            ))}
          </ScrollView>
          {page > 0 ? (
            <View style={[styles.arrow, styles.arrowLeft]}>
              <IconButton icon="back" accessibilityLabel={CANDIDATE.prevPhoto} onPress={() => goTo(page - 1)} testID="candidate-photo-prev" />
            </View>
          ) : null}
          {page < total - 1 ? (
            <View style={[styles.arrow, styles.arrowRight]}>
              <IconButton icon="back" flip accessibilityLabel={CANDIDATE.nextPhoto} onPress={() => goTo(page + 1)} testID="candidate-photo-next" />
            </View>
          ) : null}
          {total > 1 ? (
            <View style={styles.counter} pointerEvents="none">
              <AppText variant="captionMedium" tone="inverse" testID="candidate-photo-index">
                {CANDIDATE.photoIndex(page + 1, total)}
              </AppText>
            </View>
          ) : null}
        </View>

        <Rise play={viaHandoff} duration={scene.handoff.info}>
          <AppText variant="title" testID="candidate-head">
            {headLineDetail(data.answers)}
          </AppText>
        </Rise>
        {detailInfoLine(data.answers) ? (
          <Rise play={viaHandoff} delay={scene.handoff.infoGap} duration={scene.handoff.info}>
            <AppText variant="body" tone="sub" testID="candidate-info">
              {detailInfoLine(data.answers)}
            </AppText>
          </Rise>
        ) : null}
        <Rise play={viaHandoff} delay={scene.handoff.infoGap * 2} duration={scene.handoff.info}>
          <GlanceRow
            cells={[
              { label: REASON_NAMES.F01, value: plain(data.answers.A01) },
              { label: REASON_NAMES.F02, value: heightText(data.answers.A05) },
              { label: REASON_NAMES.F06, value: regionText(data.answers.A03) },
              { label: REASON_NAMES.E01, value: plain(data.answers.E01) },
            ]}
            testID="candidate-glance"
          />
        </Rise>
        <PromptCards prompts={data.prompts} />
        <MarriageViews answers={data.answers} />

        {shownGrade !== null ? (
          <Card style={styles.grade} testID="candidate-grade">
            <View style={styles.gradeHead}>
              <GradeImage n={shownGrade} size={layout.tierBadgeCard} testID="candidate-grade-badge" />
              <AppText variant="bodyBold" style={styles.gradeText} accessibilityLabel={BADGE16.a11y(shownGrade)} testID="candidate-grade-text">
                {BADGE16.detail(shownGrade)}
              </AppText>
            </View>
            <AppText variant="caption" tone="text" testID="candidate-grade-direction">
              {BADGE16.direction}
            </AppText>
            <AppText variant="caption" tone="text" testID="candidate-grade-notlife">
              {BADGE16.notLife}
            </AppText>
            <AppText variant="caption" testID="candidate-grade-limits">
              {GRADE16.limits}
            </AppText>
          </Card>
        ) : null}

        <Card style={styles.table} testID="candidate-table">
          {rows.map((r, i) => (
            <View key={r.key} style={[styles.row, i > 0 ? styles.rowLine : null]} testID={`candidate-row-${r.key}`}>
              <AppText variant="body">{r.label}</AppText>
              <AppText variant="body" tone={r.value === CANDIDATE.hidden ? 'sub' : 'text'} style={styles.rowValue}>
                {r.value}
              </AppText>
            </View>
          ))}
        </Card>

        {open.length > 0 ? (
          <Card style={styles.table} testID="candidate-open">
            <AppText variant="bodyBold" style={styles.openTitle} testID="candidate-open-title">
              {CANDIDATE.openTitle}
            </AppText>
            {open.map((r) => (
              <View key={r.id} style={[styles.row, styles.rowLine]} testID={`candidate-open-${r.id}`}>
                <AppText variant="body">{r.label}</AppText>
                <AppText variant="body" style={styles.rowValue}>
                  {r.value}
                </AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {data.reasons.length > 0 ? (
          <Card style={styles.why} testID="candidate-why" accessible accessibilityLabel={`${CANDIDATE.whyTitle}. ${why} ${CANDIDATE.whyNote}`}>
            <AppText variant="bodyBold">{CANDIDATE.whyTitle}</AppText>
            <AppText variant="body" tone="text" testID="candidate-why-body">
              {why}
            </AppText>
            <AppText variant="caption" testID="candidate-why-note">
              {CANDIDATE.whyNote}
            </AppText>
          </Card>
        ) : null}

        <AppText variant="caption" testID="candidate-disclaimer">
          {CANDIDATE.disclaimer}
        </AppText>
        <AppText variant="caption" testID="candidate-safety">
          {SAFETY.line}
        </AppText>
        {/* v5(QP-A, 카피.md 14-1): 상대 등급 열람 · 구독 권유 줄(NV47) 없음 */}
      </ScrollView>

      <BottomCTA onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)} testID="candidate-cta">
        {mailing && !reduce ? <MailFly testID="candidate-mail" /> : null}
        {limit ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="candidate-limit">
            {CANDIDATE.likeLimit}
          </AppText>
        ) : null}
        {actionError ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="candidate-action-error">
            {actionError}
          </AppText>
        ) : null}
        {mode === 'connected' ? (
          <AppText variant="body" tone="sub" style={styles.centered} testID="candidate-connected">
            {LIKES.connectedNote}
          </AppText>
        ) : mode === 'received' ? (
          <CtaPair
            secondary={<Button label={LIKES.decline} variant="secondary" loading={busy === 'decline'} disabled={busy !== null} onPress={() => respond('decline')} testID="candidate-decline" />}
            primary={<Button label={LIKES.accept} loading={busy === 'accept'} disabled={busy !== null} onPress={() => respond('accept')} testID="candidate-accept" />}
          />
        ) : mode === 'hidden' ? (
          <Button label={CANDIDATE.pass} variant="secondary" loading={busy === 'pass'} disabled={busy !== null || liked} dimmed={liked} onPress={() => run('pass')} testID="candidate-pass" />
        ) : (
          <CtaPair
            secondary={<Button label={CANDIDATE.pass} variant="secondary" loading={busy === 'pass'} disabled={busy !== null || liked} dimmed={liked} onPress={() => run('pass')} testID="candidate-pass" />}
            primary={
              <Button
                label={liked ? CANDIDATE.liked : CANDIDATE.like}
                loading={busy === 'like'}
                disabled={busy !== null || liked}
                dimmed={liked || limit}
                onPress={limit ? undefined : () => run('like')}
                testID="candidate-like"
              />
            }
          />
        )}
      </BottomCTA>

      <ReportBlockSheet
        visible={sheet}
        targetId={id}
        api={api}
        onClose={() => setSheet(false)}
        onReported={() => {
          setSheet(false);
          setToast(REPORT_SHEET.done); // 신고 제출 → 이 화면에 머문다. 서버가 신고자에게 상대를 즉시 숨긴다
        }}
        onBlocked={() => {
          setSheet(false);
          passToast(REPORT_SHEET.blockDone);
          back(); // 차단 확인 → 진입한 화면. 목록에서는 서버가 이미 뺐다
        }}
        onUnavailable={() => {
          setSheet(false);
          setData(null);
        }}
      />
      <Toast text={toast} bottom={footerHeight + space.s12} testID="candidate-toast" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s12 }, // 머리 아래 20(D8 4차 M12)
  gallery: { height: layout.detailPhotoHeight, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.line }, // 큰 사진 둥글기 12(Figma 3:385, D8 4차 M7)
  slide: { height: layout.detailPhotoHeight, borderRadius: 0, width: '100%' },
  counter: { position: 'absolute', bottom: space.s8, alignSelf: 'center', backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: space.s12, paddingVertical: space.s4, opacity: alpha.pressed },
  arrow: { position: 'absolute', top: (layout.detailPhotoHeight - size.touchMin) / 2 },
  arrowLeft: { left: space.s4 },
  arrowRight: { right: space.s4 },
  waiting: { opacity: 0 }, // 이어 붙는 덮개가 오는 동안 진짜 사진은 숨긴다(덮개가 내려가면 보임)
  table: { padding: 0 },
  openTitle: { paddingHorizontal: size.screenPadding, paddingTop: space.s12, paddingBottom: space.s8 },
  grade: { gap: space.s8 },
  gradeHead: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  gradeText: { flex: 1 },
  row: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  why: { gap: space.s8 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centered: { textAlign: 'center' },
});
