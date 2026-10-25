// 움직임 바탕 부품(F17 · D25 · D42-M 2안 '지면'). 값은 theme/motion.ts 한 곳, 움직이는 속성은 transform · opacity 만(명세 9장).
//  Reanimated 4 + React Compiler 라 공유 값은 get() · set() 으로만 읽고 쓴다. worklet 안 runOnJS 는 끝날 때 한 번만.
//  동작 줄이기(OS 설정, lib/reduceMotion 이 바뀌어도 따라감)가 켜지면 이동 · 크기 · 회전 · 덮개 없이 투명도만 150ms(명세 7장).
//  부품
//   Rise      : 아래(또는 옆)에서 8px 올라오며 나타남 260 edOut — 목록 줄 · 말풍선 · 토스트(일상)
//   Land      : 카드 하나가 8px 올라오며 놓임 300 edOut · 50ms 차례(기울기 · 지나침 0)
//   Fade      : 투명도만
//   MaskLine  : 줄 가림 — 제목 글자가 제 줄 아래에서 올라온다(명세 2장 · 5-1). 화면에 처음 들어올 때 한 번만
//   Wipe      : 위(왼쪽 · 오른쪽)에서 걷힘(명세 5-2). cover 색을 주면 같은 바탕 덮개를 걷고, 없으면 역이동(바탕이 단색이 아닌 곳)
//   CoverTurn : 와인 표지 넘김(명세 8장) — 공개 순간 한 번
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

import { AppText, type TextTone, type TextVariant } from '@/components/AppText';
import { useReduceMotion } from '@/lib/reduceMotion';
import { dist, ease, reduced, scene2, staggerDelay, type EaseName } from '@/theme/motion';
import { colors, type } from '@/theme/tokens';

export const curve = (name: EaseName) => {
  const [x1, y1, x2, y2] = ease[name];
  return Easing.bezier(x1, y1, x2, y2);
};
export const tween = (to: number, duration: number, name: EaseName = 'edOut') => withTiming(to, { duration, easing: curve(name) });
// 동작 줄이기 때 나타남(투명도만 150ms)
export const fadeIn = (o: SharedValue<number>) => o.set(withTiming(1, { duration: reduced.fadeMs, easing: curve('std') }));

type Base = { style?: StyleProp<ViewStyle>; children?: ReactNode; testID?: string; pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only' };

// 올라오며 나타남(일상 8 · 탭 4 · 말풍선 6 · 옆 넘김 40). play 가 false 면 처음부터 보인다(움직임 없음)
export function Rise({ delay = 0, distance = dist.s, duration = scene2.list.dur, axis = 'y', play = true, style, children, testID, pointerEvents }: Base & { delay?: number; distance?: number; duration?: number; axis?: 'x' | 'y'; play?: boolean }) {
  const reduce = useReduceMotion();
  const move = play && !reduce; // 동작 줄이기면 처음부터 제자리(투명도만 바뀐다)
  const o = useSharedValue(play ? 0 : 1);
  const t = useSharedValue(move ? distance : 0);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      t.set(0);
      fadeIn(o);
      return;
    }
    o.set(withDelay(delay, tween(1, duration)));
    t.set(withDelay(delay, tween(0, duration)));
  }, [play, reduce, delay, duration, o, t]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get(), transform: axis === 'x' ? [{ translateX: t.get() }] : [{ translateY: t.get() }] }));
  return (
    <Animated.View style={[style, animated]} testID={testID} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// 카드가 놓임(2안 card.in): 8 아래에서 300 edOut 으로 올라오며 나타남. index 로 50ms 차례(최대 4). 기울기 · 지나침은 2안에서 지웠다
export function Land({ index = 0, delay = 0, play = true, style, children, testID }: Base & { index?: number; delay?: number; play?: boolean }) {
  return (
    <Rise delay={delay + staggerDelay(index)} distance={scene2.card.rise} duration={scene2.card.dur} play={play} style={style} testID={testID}>
      {children}
    </Rise>
  );
}

// 투명도만(덮개 · 걷힘). to 로 갈 때 duration · curve
export function Fade({ visible, duration = scene2.load.swap, delay = 0, name = 'std', style, children, testID, pointerEvents }: Base & { visible: boolean; duration?: number; delay?: number; name?: EaseName }) {
  const reduce = useReduceMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(withDelay(reduce ? 0 : delay, withTiming(visible ? 1 : 0, { duration: reduce ? reduced.fadeMs : duration, easing: curve(name) })));
  }, [visible, reduce, delay, duration, name, o]);
  const animated = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View style={[style, animated]} testID={testID} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// ── 줄 가림(명세 2장 · 5-1) ─────────────────────────────────────────────────
//  <View overflow hidden> 안의 글자가 제 높이의 110% 아래에서 0 으로 올라온다(퍼센트 이동 — onLayout 으로 재지 않아 첫 프레임이 깜빡이지 않는다).
//  줄은 카피의 '\n' 으로만 나눈다(두 줄이면 70ms 차례, 세 줄 이상이면 통째로 한 번). 글자 꼬리(ㅃ · g)가 잘리지 않게 아래 0.12em 여유 + 같은 값 음수 margin.
//  쓰는 곳: 일상 화면 제목 1곳 · 핵심 화면 2곳까지. 본문 · 목록 · 버튼 · 숫자 · 입력칸 · 토스트에는 쓰지 않는다
type MaskProps = {
  children: string; // 글(줄은 줄바꿈 문자로만 나눈다)
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>; // 글자
  wrapStyle?: StyleProp<ViewStyle>; // 가림 틀
  delay?: number;
  duration?: number;
  play?: boolean;
  numberOfLines?: number;
  maxFontSizeMultiplier?: number;
  accessibilityRole?: 'header' | 'text';
  testID?: string;
};

export function MaskLine({ children: text, variant = 'title', tone, style, wrapStyle, delay = 0, duration = scene2.nav.title, play = true, numberOfLines, maxFontSizeMultiplier, accessibilityRole, testID }: MaskProps) {
  const parts = text.split('\n');
  const lines = parts.length > scene2.mask.maxLines ? [text] : parts;
  const tail = Math.round(type[variant].fontSize * scene2.mask.tail);
  const textProps = { variant, tone, style, numberOfLines, maxFontSizeMultiplier };
  if (lines.length === 1) {
    return (
      <MaskRow delay={delay} duration={duration} play={play} tail={tail} style={wrapStyle}>
        <AppText {...textProps} accessibilityRole={accessibilityRole} testID={testID}>
          {text}
        </AppText>
      </MaskRow>
    );
  }
  // 두 줄: 스크린리더에는 한 덩어리로 읽힌다
  return (
    <View style={wrapStyle} accessible accessibilityRole={accessibilityRole} accessibilityLabel={lines.join(' ')} testID={testID}>
      {lines.map((line, i) => (
        <MaskRow key={i} delay={delay + i * scene2.mask.lineGap} duration={duration} play={play} tail={tail}>
          <AppText {...textProps}>{line}</AppText>
        </MaskRow>
      ))}
    </View>
  );
}

function MaskRow({ delay, duration, play, tail, style, children }: { delay: number; duration: number; play: boolean; tail: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      p.set(0);
      fadeIn(p);
      return;
    }
    p.set(0); // 처음부터 보이던 글이 나중에 play 로 바뀌어도 가린 자리에서 시작한다
    p.set(withDelay(delay, tween(1, duration)));
  }, [play, reduce, delay, duration, p]);
  const rise = Math.round(scene2.mask.rise * 100); // 110
  const moving = useAnimatedStyle(() => (reduce ? { opacity: p.get() } : { transform: [{ translateY: `${(1 - p.get()) * rise}%` as const }] }));
  return (
    <View style={[styles.mask, { paddingBottom: tail, marginBottom: -tail }, style]}>
      <Animated.View style={moving}>{children}</Animated.View>
    </View>
  );
}

// ── 걷힘(명세 5-2) ────────────────────────────────────────────────────────
//  from: top(위에서 아래로 드러남) · left(왼쪽에서) · right(오른쪽에서, 보낸 말풍선)
//  cover 색을 주면 '덮개' — 내용 위 같은 바탕색 View 를 scale 1 → 0 으로 걷는다(단색 바탕 위 글 · 칩 · 말풍선, 값쌈)
//  cover 가 없으면 '역이동' — 바깥(잘림) 틀은 -100% → 0, 안쪽은 +100% → 0 으로 반대로 움직여 내용은 제자리(사진 · 그라데이션 위)
//  잘림 + 움직임이 겹치는 동안만 renderToHardwareTextureAndroid 를 켠다(명세 9장)
export function Wipe({ from = 'top', delay = 0, duration = scene2.ticket.sub, play = true, cover, style, children, testID }: Base & { from?: 'top' | 'left' | 'right'; delay?: number; duration?: number; play?: boolean; cover?: string }) {
  const reduce = useReduceMotion();
  const move = play && !reduce;
  const p = useSharedValue(play ? 0 : 1);
  const [busy, setBusy] = useState(move);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      p.set(0);
      fadeIn(p);
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setBusy)(false);
    };
    p.set(0);
    p.set(withDelay(delay, withTiming(1, { duration, easing: curve('edOut') }, done)));
  }, [play, reduce, delay, duration, p]);
  const sign = from === 'right' ? 1 : -1;
  const vertical = from === 'top';
  const lidOn = !!cover;
  const outer = useAnimatedStyle(() => {
    if (reduce) return { opacity: p.get() };
    if (lidOn) return {};
    const v = `${sign * (1 - p.get()) * 100}%` as const;
    return { transform: vertical ? [{ translateY: v }] : [{ translateX: v }] };
  });
  const inner = useAnimatedStyle(() => {
    if (reduce || lidOn) return {};
    const v = `${-sign * (1 - p.get()) * 100}%` as const;
    return { transform: vertical ? [{ translateY: v }] : [{ translateX: v }] };
  });
  const lid = useAnimatedStyle(() => (vertical ? { transform: [{ scaleY: 1 - p.get() }] } : { transform: [{ scaleX: 1 - p.get() }] }));
  const origin: ViewStyle = { transformOrigin: vertical ? 'bottom' : from === 'left' ? 'right' : 'left' };
  if (cover) {
    return (
      <Animated.View style={[style, outer]} testID={testID}>
        {children}
        {move ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: cover }, origin, lid]} /> : null}
      </Animated.View>
    );
  }
  return (
    <Animated.View style={[style, move ? styles.clip : null, outer]} renderToHardwareTextureAndroid={busy && move} testID={testID}>
      <Animated.View style={inner}>{children}</Animated.View>
    </Animated.View>
  );
}

// ── 표지 넘김(명세 8장) ──────────────────────────────────────────────────────
//  내용 위 와인 표지가 왼쪽 가장자리를 축으로 0 → -150° 돌며 넘어간다(perspective 를 transform 맨 앞에 · 뒷면 숨김). 끝나면 표지를 치운다.
//  회전 중에만 renderToHardwareTextureAndroid(표지는 끝나면 치우므로 켜 둔 채로 둔다). 동작 줄이기면 표지 없이 내용이 투명도 150 으로 나타난다
export function CoverTurn({ delay = scene2.reveal.coverDelay, duration = scene2.reveal.cover, play = true, color = colors.accent, radius = 0, style, children, testID }: Base & { delay?: number; duration?: number; play?: boolean; color?: string; radius?: number }) {
  const reduce = useReduceMotion();
  const move = play && !reduce;
  const turn = useSharedValue(0);
  const o = useSharedValue(play && reduce ? 0 : 1);
  const [covered, setCovered] = useState(move);
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      fadeIn(o);
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setCovered)(false);
    };
    turn.set(withDelay(delay, withTiming(scene2.reveal.coverDeg, { duration, easing: curve('edInOut') }, done)));
  }, [play, reduce, delay, duration, turn, o]);
  const body = useAnimatedStyle(() => ({ opacity: o.get() }));
  const lid = useAnimatedStyle(() => ({ transform: [{ perspective: scene2.reveal.perspective }, { rotateY: `${turn.get()}deg` }] }));
  return (
    <View style={style} testID={testID}>
      <Animated.View style={body}>{children}</Animated.View>
      {covered && move ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          renderToHardwareTextureAndroid
          style={[StyleSheet.absoluteFill, styles.lid, { backgroundColor: color, borderRadius: radius }, lid]}
          testID={testID ? `${testID}-cover` : undefined}
        />
      ) : null}
    </View>
  );
}

// 표지의 축 · 뒷면(시험이 값을 본다)
export const COVER_LID = { transformOrigin: 'left center', backfaceVisibility: 'hidden' } as const satisfies ViewStyle;

const styles = StyleSheet.create({
  mask: { overflow: 'hidden' },
  clip: { overflow: 'hidden' },
  lid: COVER_LID,
});
