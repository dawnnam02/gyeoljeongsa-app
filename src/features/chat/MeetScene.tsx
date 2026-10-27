// T4S 만남 장면(D-205 · D-206 연출 ④ '예능 결' · 화면 T4S · 정책 P4-21 ~ P4-28). 대화방 주소의 첫 상태로 대화방 위에 한 번 덮인다(새 주소 0).
//  박자: 0.0 장소(어둠에서) → 0.6 장소 자막 카드(두 줄, 2초 머문 뒤 옅어짐) → 1.2 한 사람이 걸어와 앉음 · 컵 내려놓음 · 말 없이 서로 봄
//        → 3.8 끝 한 줄(아래 띠) · 빛이 조금 따뜻해짐 → 5.0 여운(움직임 0) → 6.0 종이색으로 걷히며 대화방(0.24초). 합 6.24초 · 끝나면 저절로 대화방
//  · 위아래 어두운 띠 = 앱 글자색(colors.text, C7 라이트 고정의 예외 하나) · 소리 · 진동 0 · 하트 · 반짝임 · 숫자 · 진행 막대 · 남은 초 0
//  · [건너뛰기] 처음부터 끝까지 같은 자리(터치 48) · 뒤로(안드로이드 버튼 · iOS 밀기)는 화면의 평소 뒤로 · 앱이 뒤로 가면 장면을 끝낸다(돌아오면 대화방)
//  · mode still(동작 줄이기): 쉬는 모습 + 카드 + 끝 줄이 한 번에 투명도 150 → 4초 → 투명도 150 으로 대화방(합 4.3초, 이동 · 확대 · 걷힘 0)
//  · mode reader(화면 읽기): 같은 정지 그림 · 저절로 넘김 0 · 장면 한 덩이 이름(MEET_SCENE.a11y) · 버튼은 [대화방으로 가기] 하나
//    3부-사: 기준은 화면 T4S · 정책 P4-25(동작 줄이기 = 4초 뒤 저절로 · [대화방으로 가기] 는 화면 읽기만). 카피 16-2 go 메모의 '동작 줄이기 때 버튼'은 메모 쪽 고침 거리
//  · 움직이는 속성은 transform · opacity 만(Reanimated). 시각은 공유 값 t 하나(meetTimeline)
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { curve } from '@/motion';
import { withAlpha } from '@/theme/color';
import { MEET_ART } from '@/theme/meetArt';
import { scene2 } from '@/theme/motion';
import { alpha, colors, radius, size, space, type } from '@/theme/tokens';

import { MeetArt } from './MeetArt';
import { MEET_SCENE } from './meetCopy';
import type { MeetMode, MeetScenePlan } from './meetLogic';
import { cardIn, cardKeep, cardLine, endLineIn, handoff, ruleIn } from './meetTimeline';

const M = scene2.meet;
const RISE = Math.round(scene2.mask.rise * 100); // 줄 가림: 제 높이 110% 아래에서
const BANDS = { top: 150, bottom: 174 }; // 디자인 390×844 화면의 위 · 아래 띠 비율(그림 520)

type Props = { plan: MeetScenePlan; mode: MeetMode; onDone: () => void; testID?: string };

export function MeetScene({ plan, mode, onDone, testID = 'chat-meet' }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const play = mode === 'play';
  const still = !play;
  const reader = mode === 'reader';
  const t = useSharedValue(play ? 0 : M.rest);
  const fade = useSharedValue(0);
  const finished = useRef(false);
  const block = useRef<View>(null);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (play) {
      fade.set(withTiming(1, { duration: M.in, easing: curve('std') }));
      t.set(withTiming(M.total, { duration: M.total, easing: Easing.linear }));
      timers.push(setTimeout(finish, M.total));
    } else {
      fade.set(withTiming(1, { duration: M.reducedIn, easing: curve('std') }));
      if (!reader) {
        timers.push(setTimeout(() => fade.set(withTiming(0, { duration: M.reducedOut, easing: curve('std') })), M.reducedIn + M.reducedHold));
        timers.push(setTimeout(finish, M.reducedIn + M.reducedHold + M.reducedOut));
      } else {
        // 화면 읽기: 첫 초점은 장면 덩이
        timers.push(
          setTimeout(() => {
            try {
              if (block.current) AccessibilityInfo.sendAccessibilityEvent(block.current, 'focus');
            } catch {
              // 초점을 옮기지 못해도 장면 덩이가 맨 앞이다
            }
          }, M.reducedIn),
        );
      }
    }
    // 장면 중 앱이 뒤로 가면(홈 · 전화) 장면을 끝낸다 — 돌아오면 대화방(K27 상황 8)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') finish();
    });
    return () => {
      timers.forEach(clearTimeout);
      sub.remove();
      cancelAnimation(t);
      cancelAnimation(fade);
    };
  }, [play, reader, finish, t, fade]);

  // 크기: 그림은 3:4 · 폭 전체(넘치면 높이에 맞춤). 위 띠에는 [건너뛰기] 자리, 아래 띠에는 끝 줄(세 줄까지) · 화면 읽기 버튼 자리
  const lineH = type.bodyMedium.lineHeight;
  const topMin = insets.top + size.touchMin + space.s8;
  const bottomMin = insets.bottom + space.s32 + lineH * 2 + space.s16 + (reader ? size.button + space.s16 : 0);
  const artW = Math.max(0, Math.min(winW, ((winH - topMin - bottomMin) * MEET_ART.W) / MEET_ART.H));
  const artH = (artW * MEET_ART.H) / MEET_ART.W;
  const line = MEET_SCENE.line[plan.endLine];

  const root = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: play ? handoff(t.get()) * winH : 0 }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateY: play ? -handoff(t.get()) * winH : 0 }] }));
  const keep = useAnimatedStyle(() => ({ opacity: cardKeep(t.get(), still) }));
  const chip = useAnimatedStyle(() => {
    const p = cardIn(t.get());
    return { opacity: p, transform: [{ translateY: M.cardRise * (1 - p) }] };
  });
  const rule = useAnimatedStyle(() => ({ transform: [{ scaleX: ruleIn(t.get()) }] }));
  const c1 = useAnimatedStyle(() => ({ transform: [{ translateY: `${(1 - cardLine(t.get(), 0)) * RISE}%` as const }] }));
  const c2 = useAnimatedStyle(() => ({ transform: [{ translateY: `${(1 - cardLine(t.get(), 1)) * RISE}%` as const }] }));
  const end = useAnimatedStyle(() => ({ transform: [{ translateY: `${(1 - endLineIn(t.get())) * RISE}%` as const }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, root]} accessibilityViewIsModal testID={testID}>
      <StatusBar style="light" />
      <Animated.View style={[styles.fill, inner]}>
        <View ref={block} style={styles.fill} accessible accessibilityLabel={MEET_SCENE.a11y(plan.placeName, plan.when, line)} testID={`${testID}-block`}>
          <View style={[styles.band, { flex: BANDS.top, minHeight: topMin }]} />
          <View style={{ width: artW, height: artH, alignSelf: 'center' }}>
            <MeetArt place={plan.place} t={t} width={artW} still={still} testID={`${testID}-art`} />
            <Animated.View style={[styles.chipWrap, { maxWidth: artW - space.s32 }, keep]} testID={`${testID}-card`}>
              <Animated.View style={[styles.chip, chip]}>
                <Animated.View style={[styles.rule, rule]} />
                <View style={styles.mask}>
                  <Animated.View style={c1}>
                    <AppText variant="bodyBold" testID={`${testID}-place`}>
                      {plan.placeName}
                    </AppText>
                  </Animated.View>
                </View>
                <View style={styles.mask}>
                  <Animated.View style={c2}>
                    <AppText variant="captionMedium" tone="sub" testID={`${testID}-when`}>
                      {plan.when}
                    </AppText>
                  </Animated.View>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
          <View style={[styles.band, styles.bottom, { flex: BANDS.bottom, minHeight: bottomMin }]}>
            <View style={styles.mask}>
              <Animated.View style={end}>
                <AppText variant="bodyMedium" numberOfLines={3} style={styles.line} testID={`${testID}-line`}>
                  {line}
                </AppText>
              </Animated.View>
            </View>
          </View>
        </View>
        {reader ? (
          <View style={[styles.go, { bottom: insets.bottom + space.s16 }]}>
            <Button label={MEET_SCENE.go} onPress={finish} testID={`${testID}-go`} />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={MEET_SCENE.skipA11y}
            onPress={finish}
            effect="none"
            style={({ pressed }) => [styles.skip, { top: insets.top }, pressed && styles.pressed]}
            testID={`${testID}-skip`}>
            <AppText variant="smallMedium" style={styles.skipText}>
              {MEET_SCENE.skip}
            </AppText>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.text, overflow: 'hidden', zIndex: 10 },
  fill: { flex: 1 },
  band: { justifyContent: 'flex-start' },
  bottom: { paddingTop: space.s32, paddingHorizontal: space.s24 },
  chipWrap: { position: 'absolute', left: space.s16, bottom: space.s16 },
  chip: { alignSelf: 'flex-start', backgroundColor: withAlpha(colors.bg, 0.94), borderRadius: radius.sm, paddingHorizontal: space.s12, paddingVertical: space.s8 },
  rule: { width: space.s20, height: 2, backgroundColor: colors.accent, marginBottom: space.s8, transformOrigin: 'left' },
  mask: { overflow: 'hidden' },
  line: { color: colors.bg, textAlign: 'center' },
  skip: { position: 'absolute', right: space.s8, minHeight: size.touchMin, minWidth: size.touchMin, paddingHorizontal: space.s12, justifyContent: 'center', alignItems: 'center' },
  skipText: { color: withAlpha(colors.bg, 0.8) },
  pressed: { opacity: alpha.pressed },
  go: { position: 'absolute', left: size.screenPadding, right: size.screenPadding },
});
