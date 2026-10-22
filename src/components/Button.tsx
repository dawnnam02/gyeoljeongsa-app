// 버튼 v3 A안 '도톰한 와인'(D40 토큰표 · 본인 선택 D-141 · 가이드 4-4). 종류 주 · 보조 · 텍스트 · 위험(아이콘 버튼은 IconButton) × 상태 기본 · 눌림 · 비활성 · 불러오는 중 · 포커스.
//  높이 52(텍스트 48) · 모서리 16 · 좌우 20 · 글자 주 · 위험 = 본문 Bold, 보조 · 텍스트 = 본문 Medium. 한 화면에 주 버튼은 하나(나머지는 보조 · 텍스트).
//  기본   : 주 = 와인 면 + 와인빛 옅은 그림자 + 윗면 빛 / 위험 = text 면 + 옅은 그림자 / 보조 = 아이보리 면 + line 1 선 + 아주 옅은 그림자 / 텍스트 = 글자만
//  눌림   : 물결 없음 · 덮개 없음 — 종류마다 전용 눌림 면(주 = accent 에 text 14% 섞음 · 위험 = text 에 bg 12% 섞음 · 보조 card · 텍스트 accentSoft 상자) + 그림자 줄어듦 + 1px 내려감 + 0.97
//           (동작 줄이기면 이동 · 크기 0, 색 · 그림자만 바뀜)
//  비활성 : 주 · 위험 = card 면 · sub 글자(4.78 : 1) · 그림자 없음 / 보조 = 면 없음 + line 선 / 텍스트 = sub 글자
//  dimmed : 비활성 모양이지만 눌림은 받는다(눌렀을 때 이유 문구를 보이려는 버튼, K2 R7). 눌림 효과는 없다
//  loading: 눌림 면 위에 글자 대신 점 3개(8 · 간격 8 — 차례로 진해짐, 기다림 표시라 반복 허용), 폭 그대로, busy. 다시 눌러도 반응 없음(R9)
//  포커스 : 키보드로 왔을 때만 와인 2px 테두리를 2px 띄워 그린다(손가락 · 마우스로 누른 뒤에는 그리지 않음)
//  inline : 혼자 놓인 버튼(다시 시도 등) — 최소 폭 160 · 좌우 32 · 가운데
//  한글 입력: 누르기 전에 글 칸의 조합을 먼저 끝내고 최신 onPress 를 부른다(D-143 · F23 lib/imeText, commitThenPress) — 07 태그 · 10 신고 · 12 탈퇴 · 설문 v2 가 한 번에 받는다
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { COMMON } from '@/content/copy';
import { useReduceMotion } from '@/lib/reduceMotion';
import { buttonFace, shadowStyle, type ShadowKind } from '@/theme/buttonLook';
import { alpha, button, colors, radius, size, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { useCommitThenPress } from './commitThenPress';
import { Pressable } from './Pressable';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  dimmed?: boolean;
  loading?: boolean;
  inline?: boolean;
  testID?: string;
};

const DOT = space.s8;
const DOT_GAP = space.s8; // 점 사이: D36 6장은 6 이지만 4 격자(가이드 13장 D38)라 8
const DOT_CYCLE_MS = 900; // 진한 점이 한 바퀴 도는 시간(기다림 표시)
const POINTER_FOCUS_MS = 600; // 누른 직후의 포커스는 손가락 · 마우스로 온 것으로 본다(네이티브)

// 키보드(또는 스위치 접근)로 온 포커스인가. 웹은 브라우저의 :focus-visible 판단을 그대로 쓴다
function keyboardFocus(event: unknown, pointerAt: number): boolean {
  if (Platform.OS === 'web') {
    const target = (event as { nativeEvent?: { target?: { matches?: (q: string) => boolean } } } | undefined)?.nativeEvent?.target;
    if (target && typeof target.matches === 'function') {
      try {
        return target.matches(':focus-visible');
      } catch {
        /* 옛 브라우저: 아래 시간 판단 */
      }
    }
  }
  return Date.now() - pointerAt > POINTER_FOCUS_MS;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, dimmed = false, loading = false, inline = false, testID }: Props) {
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const pointerAt = useRef(0);
  const press = useCommitThenPress(onPress);
  const inert = disabled || loading;
  const off = disabled || dimmed; // 비활성 모양
  const filled = variant === 'primary' || variant === 'danger';
  const down = !off && (pressed || loading); // 눌림 면(불러오는 중도 눌림 면)
  const face = off ? offFace[variant] : down ? downFace[variant] : onFace[variant];
  const shadow: ShadowKind | null = off ? null : variant === 'primary' ? (down ? 'primaryPressed' : 'primary') : variant === 'danger' ? (down ? 'dangerPressed' : 'danger') : variant === 'secondary' && !down ? 'secondary' : null;
  const labelTone = off ? 'sub' : filled ? 'inverse' : variant === 'text' ? 'accent' : 'text';
  const moves = !dimmed && variant !== 'text'; // 텍스트 버튼은 상자 색만 바뀐다
  return (
    <View style={[styles.wrap, inline && styles.inlineWrap]}>
      {focused ? <View pointerEvents="none" style={styles.focus} testID={testID ? `${testID}-focus` : undefined} /> : null}
      <Pressable
        accessibilityLabel={loading ? COMMON.loading : label}
        accessibilityState={{ disabled: inert || dimmed, busy: loading }}
        aria-disabled={inert || dimmed}
        aria-busy={loading}
        disabled={inert}
        onPress={press}
        onPressIn={() => {
          pointerAt.current = Date.now();
          setPressed(true);
        }}
        onPressOut={() => setPressed(false)}
        onFocus={(event) => setFocused(keyboardFocus(event, pointerAt.current))}
        onBlur={() => setFocused(false)}
        testID={testID}
        effect={moves ? 'scale' : 'none'} // 물결은 버튼에서 뺐다(탭바 · 목록 줄은 그대로, D-141)
        scaleTo="button"
        pressShift={moves ? button.pressY : 0}
        clip={false} // 그림자가 밖으로 보여야 한다
        offLook="own" // 비활성은 투명도 대신 색(card 면 · sub 글자)
        style={[styles.base, variant === 'text' && styles.textBase, inline && styles.inline, face, shadowStyle(shadow)]}>
        <AppText variant={filled ? 'bodyBold' : 'bodyMedium'} tone={labelTone} numberOfLines={2} style={[styles.label, loading && styles.hidden]}>
          {label}
        </AppText>
        {loading ? <Dots light={filled && !off} testID={testID ? `${testID}-dots` : undefined} /> : null}
      </Pressable>
    </View>
  );
}

// 불러오는 중: 점 3개, 진한 점이 차례로 옮겨 간다. 동작 줄이기면 가운데만 진하게 멈춤
function Dots({ light, testID }: { light: boolean; testID?: string }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(1);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(t);
      t.set(1);
      return undefined;
    }
    t.set(0);
    t.set(withRepeat(withTiming(3, { duration: DOT_CYCLE_MS }), -1));
    return () => cancelAnimation(t);
  }, [reduce, t]);
  return (
    <View style={styles.dots} pointerEvents="none" testID={testID}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} index={i} t={t} light={light} />
      ))}
    </View>
  );
}

function Dot({ index, t, light }: { index: number; t: SharedValue<number>; light: boolean }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.floor(t.get()) % 3 === index ? 1 : alpha.disabled }));
  return <Animated.View style={[styles.dot, { backgroundColor: light ? colors.onAccent : colors.accent }, style]} />;
}

const onFace = StyleSheet.create({
  primary: { backgroundColor: buttonFace.primary },
  danger: { backgroundColor: buttonFace.danger },
  secondary: { backgroundColor: buttonFace.secondary, borderWidth: 1, borderColor: colors.line },
  text: { backgroundColor: 'transparent' },
});
const downFace = StyleSheet.create({
  primary: { backgroundColor: buttonFace.primaryPressed },
  danger: { backgroundColor: buttonFace.dangerPressed },
  secondary: { backgroundColor: buttonFace.secondaryPressed, borderWidth: 1, borderColor: colors.line },
  text: { backgroundColor: buttonFace.textPressed },
});
const offFace = StyleSheet.create({
  primary: { backgroundColor: buttonFace.off },
  danger: { backgroundColor: buttonFace.off },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  text: { backgroundColor: 'transparent' },
});

const RING = size.focusOffset + size.focusRing;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  inlineWrap: { alignSelf: 'center' },
  base: {
    minHeight: size.button,
    borderRadius: button.radius,
    paddingHorizontal: button.paddingX,
    paddingVertical: space.s8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBase: { minHeight: size.touchMin, paddingHorizontal: space.s8 },
  inline: { minWidth: button.inlineMinW, paddingHorizontal: button.inlinePaddingX },
  focus: { position: 'absolute', top: -RING, left: -RING, right: -RING, bottom: -RING, borderWidth: size.focusRing, borderColor: colors.accent, borderRadius: button.radius + RING },
  label: { textAlign: 'center' },
  hidden: { opacity: 0 }, // 폭을 그대로 두려고 글자는 자리만 지킨다
  dots: { ...StyleSheet.absoluteFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DOT_GAP },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill },
});
