// T3 수요일 18:00 공개 순간(V5 W6 · 청사진 v5 초안 4-1 7 · 6-1 · 6-3 ②). '여행지에서 운명적 만남'을 차분하게:
//  종이가 아래에서 올라오듯 머리 글 → 로고 타일이 한 번 찍힘 → 만난 분 사진 · 이름 줄 → 안내 한 줄 → [대화 시작하기] · [프로필 자세히 보기]
//  · 1초 안 · 폭죽 · 반짝임 0 · 점수 · 등급 · 맞은 정도 숫자 0. 동작 줄이기면 이동 없이 투명도만(motion/Rise · StampTile)
//  · 못 찾은 회차는 같은 자리에 "완벽한 사람을 찾지 못했어요" + 크레딧 안내 + [크레딧 보기]
//  · 대화방 주소는 채팅(앱 D)의 /chat/[id] 를 가정 — 채팅 라우트가 생기면 그대로 이어진다
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PhotoBox } from '@/features/recs/PhotoBox';
import { regionText } from '@/features/recs/recsLogic';
import { Rise, scene, StampTile } from '@/motion';
import { size, space } from '@/theme/tokens';

import type { BoardingApi, BoardingLoad } from './boardingApi';
import { BOARDING, REVEAL } from './boardingCopy';
import { hrefOf } from './BoardingScreen';

export type RevealDeps = { api: Pick<BoardingApi, 'load'>; photoUrl: (photoId: string) => Promise<string | null> };

const PHOTO = 240;

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

  return (
    <Screen edges={['top', 'bottom']} backdrop="connected" testID="screen-reveal">
      <ScreenHeader title="" onBack={back} testID="reveal-header" />
      {load === null ? null : !result ? (
        <View style={[styles.pad, styles.gap]} testID="reveal-error">
          <AppText variant="body" tone="sub" accessibilityRole="alert">
            {REVEAL.failed}
          </AppText>
          <Button label={REVEAL.back} variant="secondary" onPress={back} testID="reveal-back" />
        </View>
      ) : result.kind === 'matched' ? (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap, styles.center]} testID="reveal-matched">
          <Rise duration={scene.match.text}>
            <AppText variant="captionMedium" tone="accent" testID="reveal-kicker">
              {REVEAL.kicker(BOARDING.round(result.roundNo))}
            </AppText>
          </Rise>
          <StampTile size={space.s48} delay={scene.match.stampDelay} testID="reveal-stamp" />
          <Rise delay={scene.match.stampDelay} duration={scene.match.pair}>
            <AppText variant="title" accessibilityRole="header" style={styles.textCenter} testID="reveal-title">
              {REVEAL.title}
            </AppText>
          </Rise>
          <Rise delay={scene.match.textDelay} duration={scene.match.text} style={styles.center}>
            <PhotoBox state="approved" uri={uri} label={REVEAL.photoA11y} style={styles.photo} testID="reveal-photo" />
            <AppText variant="bodyBold" style={styles.name} testID="reveal-name">
              {[result.partner.name, result.partner.age !== null ? String(result.partner.age) : null, regionText(result.partner.region)].filter(Boolean).join(' · ')}
            </AppText>
          </Rise>
          <Rise delay={scene.match.textDelay} duration={scene.match.text}>
            <AppText variant="body" tone="sub" style={styles.textCenter} testID="reveal-body">
              {REVEAL.body}
            </AppText>
          </Rise>
          <View style={styles.actions}>
            {result.chatId ? <Button label={REVEAL.chat} onPress={() => router.push(hrefOf(`/chat/${result.chatId}`))} testID="reveal-chat" /> : null}
            <Button label={REVEAL.profile} variant="secondary" onPress={() => router.push({ pathname: '/candidate/[id]', params: { id: result.partnerId } })} testID="reveal-profile" />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, styles.gap, styles.center]} testID="reveal-none">
          <Rise duration={scene.match.text}>
            <AppText variant="captionMedium" tone="accent" testID="reveal-kicker">
              {REVEAL.kicker(BOARDING.round(result.roundNo))}
            </AppText>
          </Rise>
          <Rise delay={scene.match.stampDelay} duration={scene.match.pair}>
            <AppText variant="title" accessibilityRole="header" style={styles.textCenter} testID="reveal-title">
              {BOARDING.noMatch.title}
            </AppText>
          </Rise>
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
  name: { marginTop: space.s12, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.s12, marginTop: space.s8 },
});
