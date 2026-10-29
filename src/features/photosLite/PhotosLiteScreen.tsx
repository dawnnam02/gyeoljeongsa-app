// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 화면 ID 05 사진 등록의 짧은 판(테스트용). Figma 05(3:137) 모양 · 카피.md 05 글 그대로. 체형(G02)은 임시판 12문항에 없어 뺐다.
//  · 사진 3칸(얼굴 정면 · 전신 · 자유): 누르면 고르기 → 긴 변 1600 이하 · JPEG 로 다시 만들기 · 메타 걷기(EXIF · GPS 0) → 비공개 버킷에 올리기 → '확인 중' 행
//    칸마다 올리는 중 · 오류를 따로 보인다. 다시 누르면 새 사진으로 바꾼다(서버가 이전 대기 사진을 교체). 데모 모드는 예시 그림
//  · 권한: 시스템 권한 창을 띄우기 전에 앱 안 안내(동의문구 5-4)를 먼저 보이고, 거부하면 안내 한 줄
//  · G03 스타일(여러 개, 필수 아님) · 안내 박스 5줄 · 내부 평가 고지
//  · [올리고 설문 마치기]: ① 04 필수 빈 곳 → 그 쪽으로 + N12 ② 사진 3장 ③ 스타일 저장 · 설문 제출 ④ ai-profile start ⑤ 06
//    start 는 끝날 때까지(최대 105초) 응답하지 않으므로 잠깐(startGraceMs)만 기다린다: 그 안에 온 동의 없음 → 03 · 한도 → 07 · 연결 오류 → 머묾, 나머지는 06
//  · 다시 올리기 상태(mode='reupload', 08 반려 배지에서 /photos?mode=reupload): 사진이 없는 칸(반려된 칸)만 열고 스타일은 숨기며 [올리기](N11) → 08. AI 는 다시 돌리지 않는다
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

import { PhotoSlotArt } from '@/components/PhotoSlotArt';
import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pressable } from '@/components/Pressable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt } from '@/components/StateArt';
import { Icon } from '@/components/Icon';
import { LITE_COMMON, PHOTOS_LITE, SURVEY_LITE, SURVEY_LITE_DRAFT } from '@/content/surveyLiteCopy';
import type { RunOutcome } from '@/lib/aiApi';
import { kstToday } from '@/lib/birthDate';
import { aiApi } from '@/lib/services';
import { DEMO_LITE_IMAGES } from '@/lib/surveyLiteDemo';
import { PHOTO_SLOTS, type JpegFile, type LiteAnswers, type LoadOutcome, type PhotoSlot, type SurveyLiteApi, type UploadFailCode } from '@/lib/surveyLiteApi';
import { goBackOr, goForward } from '@/navigation/go';
import { useSignupStore } from '@/store';
import { layout } from '@/theme/layout';
import { PHOTO_ICONS } from '@/theme/photoIcons';
import { colors, radius, size, space } from '@/theme/tokens';

import { confirmFromInterview, interviewDone } from '../ai/interviewConfirm';
import { manualOfferStore } from '../ai/manualOffer';
import { QuestionInput } from '../surveyLite/inputs';
import { surveyLiteApi } from '../surveyLite/liteDeps';
import { checkDraft, draftFromValue, firstMissingPage, LITE_PAGES, questionOf, visibilityLine, type Draft } from '../surveyLite/liteModel';
import { base64ToBytes, fitLongEdge, inspectJpeg, jpegDataUri, PHOTO_SIZE_LABEL, preparePhoto, stripJpegMetadata } from './photoPipeline';
import { defaultPicker, type PhotoPicker } from './photoPicker';
import { photosSurveyMissing } from '../surveyV2/photosCheck';

export type PhotosLiteDeps = {
  api: Pick<SurveyLiteApi, 'demo' | 'load' | 'saveAnswers' | 'uploadPhoto' | 'photoPreview' | 'submit' | 'startAi'>;
  picker: PhotoPicker;
  now: () => number;
  startGraceMs: number;
  surveyMissing?: (answers: LiteAnswers) => Promise<string | null>; // F20: 설문 빈 문항 검사(없으면 임시 설문 답으로 본다)
  interviewConfirm?: () => Promise<boolean>; // 3부-자(0044): 대화형 '내 성향'을 마쳤으면 confirm_profile(null) 로 확정 — true 면 06 · 07 을 건너뛰고 08 로(없으면 늘 AI 정리 길)
};
export const START_GRACE_MS = 1500;
// 대화형 설문을 마친 분은 서버가 인터뷰 정리로 확정한다(confirm_profile(null)) — AI 정리(ai-profile) 호출 없이 08 로. 안 되면 지금 길
const interviewConfirm = async (): Promise<boolean> => {
  if (!(await confirmFromInterview(aiApi.confirm, interviewDone))) return false;
  useSignupStore.getState().setStage('traits-confirmed');
  manualOfferStore.clear();
  return true;
};
const defaultDeps = (): PhotosLiteDeps => ({ api: surveyLiteApi(), picker: defaultPicker(), now: Date.now, startGraceMs: START_GRACE_MS, surveyMissing: photosSurveyMissing, interviewConfirm });

type SlotView = { readonly photoId: string | null; readonly preview: string | null; readonly working: boolean; readonly error: string | null };
const EMPTY_SLOT: SlotView = { photoId: null, preview: null, working: false, error: null };
const DEMO_SIZE = { width: 90, height: 120 }; // 예시 그림 크기

const STYLE_Q = questionOf('G03'); // G03 스타일(복수 선택, 필수 아님)

type Props = { deps?: PhotosLiteDeps; onMissing?: (step: string) => void; mode?: 'normal' | 'reupload' };

export function PhotosLiteScreen({ deps: given, onMissing, mode = 'normal' }: Props) {
  const reupload = mode === 'reupload';
  const router = useRouter();
  const [deps] = useState<PhotosLiteDeps>(() => given ?? defaultDeps());
  const { api, picker, now, startGraceMs } = deps;

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadReason, setLoadReason] = useState<'network' | 'server'>('server');
  const [answers, setAnswers] = useState<LiteAnswers>({});
  const [slots, setSlots] = useState<Readonly<Record<PhotoSlot, SlotView>>>({ face: EMPTY_SLOT, full: EMPTY_SLOT, free: EMPTY_SLOT });
  const [styleDraft, setStyleDraft] = useState<Draft>(() => draftFromValue(STYLE_Q, undefined));
  const [ask, setAsk] = useState<PhotoSlot | null>(null); // 권한 안내 창
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSlotError, setLastSlotError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<readonly PhotoSlot[]>([]); // 다시 올리기 상태에서 닫힌 칸(이미 확인 중 · 승인)
  const busyRef = useRef(false);
  const alive = useRef(true);

  const setSlot = useCallback((slot: PhotoSlot, patch: Partial<SlotView>) => {
    setSlots((s) => ({ ...s, [slot]: { ...s[slot], ...patch } }));
  }, []);

  // 읽은 결과를 화면에 놓는다
  const apply = useCallback(
    (result: LoadOutcome) => {
      if (!alive.current) return;
      if (!result.ok) {
        setLoadReason(result.reason);
        setPhase('error');
        return;
      }
      setAnswers(result.data.answers);
      setStyleDraft(draftFromValue(STYLE_Q, result.data.answers.G03));
      const next: Record<PhotoSlot, SlotView> = { face: EMPTY_SLOT, full: EMPTY_SLOT, free: EMPTY_SLOT };
      for (const slot of PHOTO_SLOTS) {
        const rows = result.data.photos.filter((p) => p.slot === slot);
        const row = rows.find((p) => p.status === 'pending') ?? rows[0]; // 새로 올린 대기 사진이 먼저
        if (row) next[slot] = { ...EMPTY_SLOT, photoId: row.photoId };
      }
      setSlots(next);
      setLocked(PHOTO_SLOTS.filter((slot) => next[slot].photoId !== null));
      setPhase('ready');
      // 미리보기(본인은 확인 중에도 본다, 300초 URL 은 메모리에만)
      for (const slot of PHOTO_SLOTS) {
        const id = next[slot].photoId;
        if (!id) continue;
        void api.photoPreview(id).then((url) => {
          if (alive.current && url) setSlots((s) => (s[slot].photoId === id ? { ...s, [slot]: { ...s[slot], preview: url } } : s));
        });
      }
    },
    [api],
  );
  const load = useCallback(async () => apply(await api.load()), [api, apply]);

  useEffect(() => {
    alive.current = true;
    void (async () => apply(await api.load()))();
    return () => {
      alive.current = false;
    };
    // 처음 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failText = (code: UploadFailCode | 'format' | 'size'): string => {
    if (code === 'format' || code === 'size') return PHOTOS_LITE.badPhoto(picker.formatLabel, PHOTO_SIZE_LABEL);
    if (code === 'limit') return LITE_COMMON.server; // 하루 · 칸 한도(429): 잠시 뒤에 다시
    return PHOTOS_LITE.uploadFailed; // 인터넷 · 서버 · 위치정보(has_gps, 화면_요구사항 D-4)
  };

  const upload = async (slot: PhotoSlot, file: JpegFile) => {
    const result = await api.uploadPhoto(slot, file);
    if (!alive.current) return;
    if (result.ok) {
      setSlot(slot, { photoId: result.photoId, preview: jpegDataUri(file.bytes), working: false, error: null });
      setLastSlotError(null);
    } else {
      const text = failText(result.code);
      setSlot(slot, { working: false, error: text }); // 이전에 올린 사진은 그대로 남는다
      setLastSlotError(text);
    }
  };

  // 데모: 예시 그림이 같은 메타 걷기 · 검사를 거친다
  const uploadDemo = async (slot: PhotoSlot) => {
    setSlot(slot, { working: true, error: null });
    const clean = stripJpegMetadata(base64ToBytes(DEMO_LITE_IMAGES[slot]));
    const info = clean ? inspectJpeg(clean) : null;
    if (!clean || !info?.jpeg || info.exif || info.gps) {
      setSlot(slot, { working: false, error: failText('format') });
      return;
    }
    await upload(slot, { bytes: clean, ...fitLongEdge(DEMO_SIZE.width, DEMO_SIZE.height) });
  };

  const pickAndUpload = async (slot: PhotoSlot) => {
    const picked = await picker.pick();
    if (!picked || !alive.current) return;
    setSlot(slot, { working: true, error: null });
    const prepared = await preparePhoto(picked, picker.encode);
    if (!alive.current) return;
    if (!prepared.ok) {
      const text = failText(prepared.code);
      setSlot(slot, { working: false, error: text });
      setLastSlotError(text);
      return;
    }
    await upload(slot, prepared.file);
  };

  const pressingRef = useRef(false); // Q5A-15: 칸을 빠르게 두 번 눌러도 선택기 · 권한 확인이 한 번만 열린다(working 은 선택기가 돌아온 뒤에야 켜진다)
  const pressSlot = async (slot: PhotoSlot) => {
    if (pressingRef.current) return;
    pressingRef.current = true;
    try {
      await pressSlotOnce(slot);
    } finally {
      pressingRef.current = false;
    }
  };
  const pressSlotOnce = async (slot: PhotoSlot) => {
    if (slots[slot].working || busyRef.current) return;
    if (reupload && locked.includes(slot)) return; // 반려된 칸만 열린다
    setMessage(null);
    if (api.demo) return uploadDemo(slot);
    if (!picker.available) {
      setSlot(slot, { error: PHOTOS_LITE.uploadFailed });
      setLastSlotError(PHOTOS_LITE.uploadFailed);
      return;
    }
    const status = await picker.status();
    if (status === 'denied') {
      setDenied(true);
      return;
    }
    if (status === 'undetermined') {
      setAsk(slot); // 시스템 권한 창 전에 앱 안 안내 먼저
      return;
    }
    setDenied(false);
    await pickAndUpload(slot);
  };

  const allowAsked = async () => {
    const slot = ask;
    setAsk(null);
    if (!slot) return;
    const status = await picker.request();
    if (status !== 'granted') {
      setDenied(true);
      return;
    }
    setDenied(false);
    await pickAndUpload(slot);
  };

  const working = PHOTO_SLOTS.some((s) => slots[s].working);
  const uploaded = PHOTO_SLOTS.filter((s) => slots[s].photoId !== null).length;

  const finish = async () => {
    if (busyRef.current || working) return;
    if (reupload) {
      if (uploaded < PHOTO_SLOTS.length) setMessage(PHOTOS_LITE.needThree);
      else goForward(router, '/profile'); // 08: 배지가 '사진 확인 중'으로 돌아간다
      return;
    }
    // F20(D-123): 설문 빈 문항 검사 — 스위치 survey_v2 가 켜져 있으면 정식 설문 v2 진행('v2'), 아니면 임시 설문 첫 빈 쪽
    const missing = deps.surveyMissing ? null : firstMissingPage(answers);
    const step = deps.surveyMissing ? await deps.surveyMissing(answers) : missing !== null ? LITE_PAGES[missing].step : null;
    if (step !== null) {
      setMessage(SURVEY_LITE.missing); // N12, 그 쪽으로 보낸다
      if (onMissing) onMissing(step);
      else router.replace({ pathname: '/survey/[step]', params: { step, notice: 'missing' } });
      return;
    }
    if (uploaded < PHOTO_SLOTS.length) {
      setMessage(PHOTOS_LITE.needThree);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    const stop = (text: string) => {
      busyRef.current = false;
      if (!alive.current) return;
      setBusy(false);
      setMessage(text);
    };
    const style = checkDraft(STYLE_Q, styleDraft, kstToday(now()));
    if (style.state === 'ok') {
      const saved = await api.saveAnswers({ G03: style.value });
      if (!saved.ok) return stop(SURVEY_LITE.saveFailed);
    }
    const submitted = await api.submit();
    if (!submitted.ok) return stop(SURVEY_LITE.saveFailed);
    // 3부-자(0044): 대화형 '내 성향'을 마친 분은 AI 정리(06) · 확인(07) 없이 서버가 인터뷰 정리로 확정 → 08(처음 한 번). 확정이 안 되면 아래 AI 정리 길 그대로
    if (deps.interviewConfirm && (await deps.interviewConfirm())) {
      if (!alive.current) return;
      busyRef.current = false;
      setBusy(false);
      goForward(router, { pathname: '/profile', params: { first: '1' } });
      return;
    }
    // AI 처리 시작(앱은 설문 본문을 보내지 않는다). 처리 끝까지 기다리지 않고 06 이 상태를 읽는다
    let timer: ReturnType<typeof setTimeout> | null = null;
    const grace = new Promise<'waiting'>((resolve) => {
      timer = setTimeout(() => resolve('waiting'), startGraceMs);
    });
    const outcome: RunOutcome | 'waiting' = await Promise.race([api.startAi(), grace]);
    if (timer) clearTimeout(timer);
    if (!alive.current) return;
    if (outcome !== 'waiting' && outcome.kind === 'error') return stop(outcome.reason === 'network' ? LITE_COMMON.offline : LITE_COMMON.server);
    busyRef.current = false;
    setBusy(false);
    if (outcome !== 'waiting' && outcome.kind === 'consent') goForward(router, '/consent');
    else if (outcome !== 'waiting' && outcome.kind === 'limit') goForward(router, '/traits'); // 새 건 한도: 07 에서 직접 고친다
    else goForward(router, '/analysis');
  };

  // 04 마지막 쪽(임시판은 F01 쪽), 다시 올리기 상태는 08
  const back = () => (reupload ? goBackOr(router, '/profile') : goBackOr(router, { pathname: '/survey/[step]', params: { step: '32' } }));

  if (phase !== 'ready') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="photoslite-screen">
        <ScreenHeader title={PHOTOS_LITE.headerTitle} onBack={back} testID="photoslite-header" />
        <View style={styles.center}>
          {phase === 'loading' ? (
            <>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="body" testID="photoslite-loading">
                {LITE_COMMON.loading}
              </AppText>
            </>
          ) : (
            <>
              <OfflineArt show={loadReason === 'network'} />
              <AppText variant="body" style={styles.centerText} testID="photoslite-load-error">
                {loadReason === 'network' ? LITE_COMMON.offline : LITE_COMMON.server}
              </AppText>
              <Button label={LITE_COMMON.retry} variant="secondary" inline onPress={() => {
                  setPhase('loading');
                  void load();
                }}
                testID="photoslite-retry" />
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} testID="photoslite-screen">
      <ScreenHeader title={PHOTOS_LITE.headerTitle} onBack={back} testID="photoslite-header" />
      <ScrollView contentContainerStyle={styles.content} testID="photoslite-scroll">
        <View style={styles.titles}>
          <AppText variant="title" accessibilityRole="header" testID="photoslite-title">
            {PHOTOS_LITE.title}
          </AppText>
          <AppText variant="body" tone="sub" testID="photoslite-subtitle">
            {PHOTOS_LITE.subtitle}
          </AppText>
        </View>
        {api.demo ? (
          <AppText variant="captionMedium" tone="accent" testID="photoslite-demo-note">
            {SURVEY_LITE_DRAFT.demoPhotoNote}
          </AppText>
        ) : null}

        <View style={styles.slots}>
          {PHOTO_SLOTS.map((slot) => (
            <SlotBox key={slot} slot={slot} view={slots[slot]} locked={reupload && locked.includes(slot)} onPress={() => void pressSlot(slot)} />
          ))}
        </View>
        {lastSlotError ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="photoslite-slot-error">
            {lastSlotError}
          </AppText>
        ) : null}
        {denied ? (
          <AppText variant="caption" tone="text" testID="photoslite-denied">
            {PHOTOS_LITE.permissionDenied}
          </AppText>
        ) : null}

        <Card style={styles.guide} testID="photoslite-guide">
          {PHOTOS_LITE.guideLines.map((line) => (
            <AppText key={line} variant="caption" tone="text">
              {line}
            </AppText>
          ))}
        </Card>

        {reupload ? null : (
          <View style={styles.block} testID="photoslite-style">
            <AppText variant="bodyBold">{PHOTOS_LITE.styleLabel}</AppText>
            <QuestionInput q={STYLE_Q} draft={styleDraft} onChange={setStyleDraft} invalid={false} />
            <AppText variant="caption" testID="photoslite-style-visibility">
              {visibilityLine(STYLE_Q)}
            </AppText>
          </View>
        )}

        <AppText variant="caption" testID="photoslite-internal-note">
          {PHOTOS_LITE.internalNote}
        </AppText>
        {message ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="photoslite-message">
            {message}
          </AppText>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <CtaFade />
        <Button label={reupload ? PHOTOS_LITE.reupload : PHOTOS_LITE.finish} onPress={() => void finish()} dimmed={working || uploaded < PHOTO_SLOTS.length} loading={busy} testID="photoslite-finish" />
      </View>
      <ConfirmDialog
        visible={ask !== null}
        title={PHOTOS_LITE.permissionAsk}
        confirmLabel={LITE_COMMON.confirm}
        cancelLabel={LITE_COMMON.cancel}
        onConfirm={() => void allowAsked()}
        onCancel={() => setAsk(null)}
        testID="photoslite-permission"
      />
    </Screen>
  );
}

function SlotBox({ slot, view, locked, onPress }: { slot: PhotoSlot; view: SlotView; locked: boolean; onPress: () => void }) {
  const name = PHOTOS_LITE.slots[slot];
  return (
    <View style={styles.slotCell}>
      <Pressable
        accessibilityLabel={name}
        aria-busy={view.working}
        disabled={locked}
        effect="scale"
        onPress={onPress}
        testID={`photoslite-slot-${slot}`}
        style={[styles.slot, view.error ? styles.slotError : null]}>
        {view.preview ? (
          <Image source={{ uri: view.preview }} style={styles.preview} accessibilityIgnoresInvertColors testID={`photoslite-preview-${slot}`} />
        ) : (
          <View style={styles.slotEmpty}>
            {/* 사진 가이드 그림(H2 54 정면 · 55 전신 · 56 자유): 어떤 사진을 올릴지 보인다. 카메라 + 는 칸 모서리로 옮겨 '누르면 올린다'를 남긴다 */}
            <PhotoSlotArt name={slot} size={layout.photoGuideArt} testID={`photoslite-guide-art-${slot}`} />
            <AppText variant="caption" tone="text">
              {name}
            </AppText>
            <View style={styles.camera}>
              <Icon name={PHOTO_ICONS.cameraAdd} size={space.s24} color={colors.sub} />
            </View>
          </View>
        )}
        {view.working ? (
          <View style={styles.overlay} testID={`photoslite-working-${slot}`}>
            <ActivityIndicator color={colors.accent} accessibilityLabel={LITE_COMMON.loading} />
          </View>
        ) : null}
        {view.photoId && !view.working ? <View testID={`photoslite-done-${slot}`} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s16, paddingBottom: space.s24, gap: space.s16 },
  titles: { gap: space.s8 },
  slots: { flexDirection: 'row', gap: space.s12 },
  slotCell: { flex: 1, minWidth: 0 },
  slot: { aspectRatio: 3 / 4, borderRadius: radius.lg, backgroundColor: colors.line, overflow: 'hidden' },
  slotError: { borderWidth: layout.inputBorderActive, borderColor: colors.accent },
  slotEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s8 },
  camera: { position: 'absolute', top: space.s8, right: space.s8, width: space.s24, height: space.s24 }, // Figma 05 카메라+ 32×32 → 가이드 그림을 넣으며 모서리 24
  preview: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  guide: { gap: space.s4 },
  block: { gap: space.s12 },
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centerText: { textAlign: 'center' },
});
