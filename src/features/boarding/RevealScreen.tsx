// T3 수요일 18:00 공개 순간(V5 W6 · 청사진 v5 초안 4-1 7 · 6-1 · 6-3 ② · 2안 '지면' 핵심 ②, 명세 4-3). '여행지에서 운명적 만남'을 차분하게:
//  탑승권 탭의 [만난 분 보기]가 '열어 보기' 탭이다. 공개 화면이 열리면 머리 글 투명도 240 → 제목 줄 가림(180 뒤 560) →
//  사진 · 이름 카드 위 와인 표지가 왼쪽을 축으로 넘어감(160 뒤 700 edInOut, D-175) → 사진 위에서 걷힘 · 이름 줄 가림(400 뒤) → 안내 걷힘(450 뒤) →
//  [대화 시작하기] · [프로필 자세히 보기] 투명도(680 · 700 뒤). 합계 약 1초 · 줄 가림 2곳(제목 · 이름) · 카운트다운 · 폭죽 · 반짝임 0 · 점수 · 등급 숫자 0.
//  동작 줄이기면 표지 없이 모두 투명도 150(motion/CoverTurn · MaskLine · Wipe)
//  · 못 찾은 회차는 같은 자리에 "완벽한 사람을 찾지 못했어요" + 크레딧 안내 + [크레딧 보기] — 위에 장면 그림 '못 찾음'(D42-I 4안 · 돌아온 탑승권 한 장)
//  · 대화방 주소는 채팅(앱 D)의 /chat/[id] 를 가정 — 채팅 라우트가 생기면 그대로 이어진다
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Illustration } from '@/components/Illustration';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { regionText } from '@/features/recs/recsLogic';
import { CoverTurn, Fade, MaskLine, scene2, Wipe } from '@/motion';
import { radius, size, space } from '@/theme/tokens';

import type { BoardingApi, BoardingLoad } from './boardingApi';
import { BOARDING, REVEAL } from './boardingCopy';
import { ArriveView } from './ArriveView';
import { arriveWhen } from './boardingLogic';
import { hrefOf } from './BoardingScreen';
import { defaultOpenedRounds, useOpenedRounds, type OpenedRounds } from './openedRounds';

export type RevealDeps = { api: Pick<BoardingApi, 'load'>; photoUrl: (photoId: string) => Promise<string | null>; opened?: OpenedRounds };

const PHOTO = 240;
const R = scene2.reveal;

export function RevealScreen({ deps }: { deps: RevealDeps }) {
  const router = useRouter();
  const [load, setLoad] = useState<BoardingLoad | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void deps.api.load().then((l) => {
      if (!alive) return;
      setLoad(l);
      const photo = l.ok && l.state.result?.kind === 'matched' ? l.state.result.partner.facePhotoId : null;
      if (photo) void deps.photoUrl(photo).then((u) => alive && setUri(u));
    });
    return () => {
      alive = false;
    };
  }, [deps]);
  const back = () => (router.canGoBack() ? router.back() : router.replace(hrefOf('/boarding')));
  const result = load?.ok ? load.state.result : null;
  // 도착 화면(D-178): 푸시 등으로 바로 온 아직 안 연 회차는 이 화면에서 먼저 도착 → [지금 열어 보기] → 공개 순간.
  //  공개 순간(표지 넘김 · 줄 가림 · 걷힘)은 처음 열 때 한 번만: 탑승권 탭의 [지금 열어 보기](?moment=1) 또는 여기서 연 때. 이미 열어 본 회차는 바로 상대 화면(움직임 없이)
  const { moment } = useLocalSearchParams<{ moment?: string }>();
  const openedStore = deps.opened ?? defaultOpenedRounds;
  const opened = useOpenedRounds(openedStore);
  const [openedHere, setOpenedHere] = useState(false);
  const round = result?.kind === 'matched' ? result.roundNo : null;
  const matchAt = load?.ok ? (load.state.round?.matchAt ?? null) : null;
  const arriving = round !== null && matchAt !== null && opened.ready && !opened.rounds.includes(round) && !openedHere;
  const play = moment === '1' || openedHere;
  const openNow = () => {
    if (round === null) return;
    setOpenedHere(true);
    openedStore.mark(round);
  };

  return (
    <Screen edges={['top', 'bottom']} backdrop="connected" testID="screen-reveal">
      <ScreenHeader title="" onBack={back} testID="reveal-header" />
      {load === null || (round !== null && !opened.ready) ? null : !result ? (
        <View style={[styles.pad, styles.gap]} testID="reveal-error">
          <AppText variant="body" tone="sub" accessibilityRole="alert">
            {REVEAL.failed}
          </AppText>
          <Button label={REVEAL.back} variant="secondary" onPress={back} testID="reveal-back" />
        </View>
      ) : arriving && matchAt !== null ? (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap]} testID="reveal-arrive-scroll">
          <ArriveView when={arriveWhen(matchAt)} onOpen={openNow} testID="reveal-arrive" />
        </ScrollView>
      ) : result.kind === 'matched' ? (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap, styles.center]} testID="reveal-matched">
          <Fade visible duration={play ? R.swap : 0} name="edOut">
            <AppText variant="captionMedium" tone="accent" testID="reveal-kicker">
              {REVEAL.kicker(BOARDING.round(result.roundNo))}
            </AppText>
          </Fade>
          <MaskLine variant="title" accessibilityRole="header" style={styles.textCenter} wrapStyle={styles.stretch} play={play} delay={R.titleDelay} duration={R.title} testID="reveal-title">{REVEAL.title}</MaskLine>
          <CoverTurn play={play} radius={radius.lg} style={styles.card} testID="reveal-card">
            <Wipe play={play} delay={R.photoDelay} duration={R.photo}>
              <PhotoBox state="approved" uri={uri} label={REVEAL.photoA11y} style={styles.photo} testID="reveal-photo" />
            </Wipe>
            <MaskLine
              variant="bodyBold"
              style={styles.textCenter}
              wrapStyle={styles.name}
              play={play}
              delay={R.nameDelay}
              duration={R.name}
              testID="reveal-name">{[result.partner.name, result.partner.age !== null ? String(result.partner.age) : null, regionText(result.partner.region)].filter(Boolean).join(' · ')}</MaskLine>
          </CoverTurn>
          <Wipe play={play} delay={R.infoDelay} duration={R.info}>
            <AppText variant="body" tone="sub" style={styles.textCenter} testID="reveal-body">
              {REVEAL.body}
            </AppText>
          </Wipe>
          <View style={styles.actions}>
            {result.chatId ? (
              <Fade visible delay={play ? R.ctaDelay : 0} duration={play ? R.cta : 0} name="edOut">
                <Button label={REVEAL.chat} onPress={() => router.push(hrefOf(`/chat/${result.chatId}`))} testID="reveal-chat" />
              </Fade>
            ) : null}
            <Fade visible delay={play ? R.cta2Delay : 0} duration={play ? R.cta : 0} name="edOut">
              <Button label={REVEAL.profile} variant="secondary" onPress={() => router.push({ pathname: '/candidate/[id]', params: { id: result.partnerId } })} testID="reveal-profile" />
            </Fade>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap, styles.center]} testID="reveal-none">
          <Illustration scene="noMatch" testID="reveal-art" />
          <Fade visible duration={R.swap} name="edOut">
            <AppText variant="captionMedium" tone="accent" testID="reveal-kicker">
              {REVEAL.kicker(BOARDING.round(result.roundNo))}
            </AppText>
          </Fade>
          <MaskLine variant="title" accessibilityRole="header" style={styles.textCenter} wrapStyle={styles.stretch} delay={R.titleDelay} duration={R.title} testID="reveal-title">{BOARDING.noMatch.title}</MaskLine>
          <AppText variant="body" style={styles.textCenter} testID="reveal-body">
            {BOARDING.noMatch.body}
          </AppText>
          {result.reason ? (
            <AppText variant="caption" style={styles.textCenter} testID="reveal-reason">
              {BOARDING.noMatch.reasons[result.reason]}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label={BOARDING.noMatch.credits} onPress={() => router.push(hrefOf('/credits'))} testID="reveal-credits" />
            <Button label={REVEAL.back} variant="secondary" onPress={back} testID="reveal-back" />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: size.screenPadding, paddingTop: space.s24, paddingBottom: space.s40 },
  gap: { gap: space.s16 },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  photo: { width: PHOTO, height: PHOTO * 1.25 },
  card: { alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
  name: { marginTop: space.s12, alignSelf: 'stretch' },
  actions: { alignSelf: 'stretch', gap: space.s12, marginTop: space.s8 },
});
