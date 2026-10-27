// 화면 ID 08 내 프로필(K2 4장 08 · 카피.md 08 · Figma 3:244 · F11).
//  탭이 아니라 탭 위에 열리는 화면이다(K7): 탭바 없음 · 왼쪽 위 ‹ 와 Android 뒤로가기는 들어온 화면으로(스택이 없으면 09, T3 · T5) · 저장 바는 화면 바닥(좌우 20 · 위 12 · 아래 20 + 기기 안전영역)
//  사진 칸은 사진이 없거나 반려되면 기본 프로필 그림(R16)이다
//  머리: 둥근 사진 칸(얼굴 정면) + "이OO · 31세 · 서울 마포구" + 배지(인증 대기 · 사진 확인 중 · 사진 다시 올리기, 누르면 설명)
//  공개 범위: 토글 9개(처음값 켜짐 7 · 꺼짐 2). 답하지 않은 항목은 꺼짐 · 잠금(N15). 구간 공개 항목은 "구간으로만 보여요"
//  저장: 바뀐 토글의 열만 서버로. 서버가 저장 즉시 상대 화면을 바꾼다 — 앱은 가리는 일을 하지 않는다. 저장하지 않고 탭을 떠나면 바뀐 토글은 버린다
//  처음 한 번(07 확정 직후, ?first=1): 맨 위 안내 상자 + 저장 자리에 [확인했어요] → 바뀐 토글 저장 + 기록 → 09
//  표시하지 않는 것: 진행 단계 · 내부 등급 · 점수
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, ScrollView, StyleSheet, View } from 'react-native';

import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { InfoBox } from '@/components/InfoBox';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt } from '@/components/StateArt';
import { TextButton } from '@/components/TextButton';
import { COMMON, PROFILE, PROFILE_DRAFT } from '@/content/copy';
import { kstToday } from '@/lib/birthDate';
import type { ProfileApi, ProfileData } from '@/lib/profileApi';
import { profileApi } from '@/lib/services';
import { usePhotoUrls } from '@/features/recs/usePhotoUrls';
import { goBackOr, goForward } from '@/navigation/go';
import { resolveDest } from '@/navigation/resolve';
import { forgetMyFace } from '@/store/myFaceStore';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import { ToggleRow } from './ToggleRow';
import {
  ageOn,
  availability,
  diffToggles,
  maskedName,
  photoBadges,
  shownToggles,
  toggleLabel,
  TOGGLE_DEFS,
  type PhotoView,
  type ToggleKey,
  type ToggleState,
} from './profileLogic';

export type ProfileDeps = { api: Pick<ProfileApi, 'load' | 'saveVisibility' | 'photoUrl' | 'ackReview'>; now: () => number };
const defaultDeps: ProfileDeps = { api: profileApi, now: Date.now };

type Note = 'verify' | 'checking' | 'retry' | null;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function ProfileScreen({ deps = defaultDeps }: { deps?: ProfileDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ first?: string }>();
  const firstVisit = first(params.first) === '1';
  const { api, now } = deps;

  const [data, setData] = useState<ProfileData | null>(null);
  const [draft, setDraft] = useState<ToggleState | null>(null);
  const [loadError, setLoadError] = useState<'network' | 'server' | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'locked'; text: string } | null>(null);
  const [note, setNote] = useState<Note>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const result = await api.load();
    if (!alive.current) return;
    if (!result.ok) {
      setLoadError(result.reason);
      return;
    }
    setLoadError(null);
    setData(result.data);
    setDraft((current) => current ?? result.data.visibility);
  }, [api]);

  // 탭에 들어올 때마다 읽는다(사진 검수 결과 · 05 에서 돌아온 뒤). 탭을 떠나면 저장하지 않은 토글은 버린다(확인창 없음, 1차)
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        setDraft(null);
        setMessage(null);
        setNote(null);
        forgetMyFace(); // 사진을 다시 올렸을 수 있다: 탭 화면 오른쪽 위 원형 사진이 돌아가서 다시 읽는다
      };
    }, [load]),
  );

  // ‹ 와 Android 뒤로가기: 들어온 화면으로. 쌓인 화면이 없으면(07 확정 직후 · 앱을 다시 연 직후) 09 로 간다(2-5 T3 · T5)
  const goBack = useCallback(() => {
    const to = resolveDest('09');
    goBackOr(router, to.kind === 'href' ? to.href : '/recommendations');
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) return false; // 쌓인 화면이 있으면 화면 스택이 한 칸 뒤로 보낸다
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [router, goBack]),
  );

  // 사진 열람 URL: 사진 id 마다 한 번(300초 안에서 쓰고, 저장하지 않는다)
  const photoKey = data ? data.photos.map((p) => `${p.id}:${p.status}`).join('|') : '';
  const urls = usePhotoUrls(data ? data.photos.map((p) => p.id) : [], api.photoUrl, photoKey);

  const available = data ? availability(data.answers) : null;
  const current = data && draft && available ? shownToggles(draft, available) : null;
  const changes = data && draft && available ? diffToggles(data.visibility, draft, available) : {};
  const dirty = Object.keys(changes).length > 0;

  const onToggle = (key: ToggleKey) => {
    if (!available || !draft) return;
    if (!available[key]) {
      setMessage({ kind: 'locked', text: PROFILE.toggleLocked });
      return;
    }
    setMessage(null);
    setDraft({ ...draft, [key]: !draft[key] });
  };

  // [저장] · [확인했어요]: 바뀐 토글만 서버로. 실패하면 입력한 토글은 그대로 둔다
  const persist = async (): Promise<boolean> => {
    if (!data || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    const result = await api.saveVisibility(changes);
    busyRef.current = false;
    if (!alive.current) return false;
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.reason === 'network' ? COMMON.offline : PROFILE.saveFailed });
      return false;
    }
    setData({ ...data, visibility: { ...data.visibility, ...Object.fromEntries(TOGGLE_DEFS.filter((d) => d.column in changes).map((d) => [d.key, draft?.[d.key] ?? d.initial])) } as ToggleState });
    return true;
  };

  const onSave = async () => {
    if (!dirty) return;
    if (await persist()) setMessage({ kind: 'ok', text: PROFILE.saved });
  };

  const onFirstConfirm = async () => {
    if (!(await persist())) return;
    await api.ackReview();
    if (!alive.current) return;
    router.setParams({ first: undefined }); // 탭 화면은 주소 값을 기억한다: 확인을 마쳤으니 다음에 탭으로 들어오면 처음 한 번 상태가 아니다
    const next = resolveDest('09');
    goForward(router, next.kind === 'href' ? next.href : '/recommendations');
  };

  const onRetryPhoto = () => {
    router.push({ pathname: '/photos', params: { mode: 'reupload' } }); // 05 다시 올리기 상태(반려된 칸만 열린다)
  };

  if (!data || !draft || !current || !available) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title={PROFILE.headerTitle} onBack={goBack} testID="profile-header" />
        <View style={styles.centerBox} testID="screen-08-loading">
          {loadError ? (
            <>
              <OfflineArt show={loadError === 'network'} />
              <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered}>
                {loadError === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
              <Button
                label={COMMON.retry}
                onPress={() => {
                  setLoadError(null);
                  void load();
                }}
                testID="profile-retry"
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

  const badges = photoBadges(data.photos);
  const age = data.birthDate ? ageOn(data.birthDate, kstToday(now())) : null;
  // 이름 줄은 R3 표기 "이OO · 31 · 서울 마포구"(나이에 '세' 없음, D8 3차 M3). 스크린리더 이름에는 '31세'를 남긴다
  const headText = [data.name ? maskedName(data.name) : null, age === null ? null : String(age), data.region].filter((x): x is string => !!x).join(' · ');
  const face = data.photos.find((p) => p.slot === 'face');
  // 본인 화면은 확인 중인 사진도 보인다. 없음 · 반려 · 못 불러옴은 기본 프로필 그림(R16)
  const faceUri = face?.id && (face.status === 'approved' || face.status === 'pending') ? urls[face.id] : null;
  const noteText = note === 'verify' ? PROFILE.badgeVerifyPendingNote : note === 'checking' ? PROFILE.badgePhotoCheckingNote : note === 'retry' ? PROFILE.badgePhotoRetryNote : null;
  const toggle = (n: Note) => setNote((now0) => (now0 === n ? null : n));

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title={PROFILE.headerTitle} onBack={goBack} testID="profile-header" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID={firstVisit ? 'screen-08-first' : 'screen-08'}>
        {firstVisit ? <InfoBox title={PROFILE.firstTitle} body={PROFILE.firstBody} testID="profile-first-box" /> : null}

        <View style={styles.top} testID="profile-top">
          <View style={styles.photo} accessibilityLabel={PROFILE_DRAFT.photoSlots.face} testID="profile-face">
            <ProfileAvatar uri={faceUri} width={layout.profilePhoto} testID="profile-face-avatar" />
          </View>
          <View style={styles.info}>
            <AppText variant="bodyBold" numberOfLines={2} accessibilityLabel={PROFILE_DRAFT.headLabel(data.name ? maskedName(data.name) : '', age === null ? '' : PROFILE_DRAFT.ageUnit(age), data.region ?? '')} testID="profile-head-text">
              {headText}
            </AppText>
            <View style={styles.badges}>
              {data.verification === 'pending' ? <Chip label={PROFILE.badgeVerifyPending} lead="verified" variant={note === 'verify' ? 'selected' : 'tag'} onPress={() => toggle('verify')} testID="badge-verify" /> : null}
              {data.verification === 'verified' ? <Chip label={PROFILE_DRAFT.badgeVerified} variant="tag" testID="badge-verified" /> : null}
              {badges.checking ? <Chip label={PROFILE.badgePhotoChecking} lead="photo_checking" variant={note === 'checking' ? 'selected' : 'tag'} onPress={() => toggle('checking')} testID="badge-photo-checking" /> : null}
              {badges.retry ? <Chip label={PROFILE.badgePhotoRetry} variant={note === 'retry' ? 'selected' : 'tag'} onPress={() => toggle('retry')} testID="badge-photo-retry" /> : null}
            </View>
          </View>
        </View>

        {noteText ? (
          <Card accessible accessibilityRole="text" testID="badge-note" style={styles.noteCard}>
            <AppText variant="caption" tone="text">
              {noteText}
            </AppText>
            {note === 'retry' ? <TextButton label={PROFILE_DRAFT.photoReupload} onPress={onRetryPhoto} align="start" variant="captionMedium" testID="badge-note-reupload" /> : null}
          </Card>
        ) : null}

        <View style={styles.titles}>
          <AppText variant="bodyBold" accessibilityRole="header" testID="profile-visibility-title">
            {PROFILE.visibilityTitle}
          </AppText>
          <AppText variant="body" tone="sub" testID="profile-visibility-subtitle">
            {PROFILE.visibilitySubtitle}
          </AppText>
        </View>

        <View style={styles.list} testID="profile-toggles">
          {TOGGLE_DEFS.map((d, i) => (
            <ToggleRow
              key={d.key}
              label={toggleLabel(d.key)}
              on={current[d.key]}
              locked={!available[d.key]}
              range={d.range}
              last={i === TOGGLE_DEFS.length - 1}
              onPress={() => onToggle(d.key)}
              testID={`toggle-${d.key}`}
            />
          ))}
        </View>

        <View style={styles.titles}>
          <AppText variant="bodyBold" accessibilityRole="header">
            {PROFILE_DRAFT.photosTitle}
          </AppText>
          <View style={styles.photoRow} testID="profile-photos">
            {data.photos.map((p) => (
              <PhotoCell key={p.slot} photo={p} uri={p.id ? urls[p.id] : null} onRetry={onRetryPhoto} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <CtaFade />
        {message ? (
          <AppText variant="captionMedium" tone={message.kind === 'ok' ? 'sub' : 'accent'} accessibilityRole={message.kind === 'ok' ? undefined : 'alert'} accessibilityLiveRegion="polite" testID="profile-message">
            {message.text}
          </AppText>
        ) : null}
        {firstVisit ? (
          <Button label={PROFILE.firstConfirm} loading={busy} onPress={onFirstConfirm} testID="profile-first-confirm" />
        ) : (
          <Button label={PROFILE.save} loading={busy} dimmed={!dirty} onPress={onSave} testID="profile-save" />
        )}
      </View>
    </Screen>
  );
}

function PhotoCell({ photo, uri, onRetry }: { photo: PhotoView; uri: string | null | undefined; onRetry: () => void }) {
  const [broken, setBroken] = useState(false);
  const slotName = PROFILE_DRAFT.photoSlots[photo.slot];
  const status = PROFILE_DRAFT.photoStatus[photo.status];
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${slotName}, ${status}`} testID={`photo-${photo.slot}`}>
      <View style={styles.thumb}>
        {uri && !broken ? <Image source={{ uri }} style={styles.photoImage} onError={() => setBroken(true)} accessibilityIgnoresInvertColors /> : null}
        {broken ? (
          <AppText variant="caption" style={styles.centered}>
            {PROFILE_DRAFT.photoMissing}
          </AppText>
        ) : null}
      </View>
      <AppText variant="captionMedium" tone="text">
        {slotName}
      </AppText>
      <AppText variant="caption">{status}</AppText>
      {photo.status === 'rejected' ? <TextButton label={PROFILE_DRAFT.photoReupload} onPress={onRetry} align="start" variant="captionMedium" testID={`photo-${photo.slot}-reupload`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
  photo: { width: layout.profilePhoto, height: layout.profilePhoto },
  photoImage: { width: '100%', height: '100%' },
  info: { flex: 1, gap: space.s8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  noteCard: { gap: space.s4 },
  titles: { gap: space.s8 },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  photoRow: { flexDirection: 'row', gap: space.s12 },
  cell: { flex: 1, gap: space.s4, minWidth: 0 },
  thumb: { aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: space.s4 },
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s8, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centered: { textAlign: 'center' },
});
