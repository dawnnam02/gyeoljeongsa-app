// 대화형 설문(V6-F) 작은 부품 — 시안 디자인/V6_대화형설문(AYLA'S 모양 2판 · 확정 5건 A) · 브랜드색 v2 · D42 2안 일상 움직임.
//  AiBubble   : accentSoft 원 32 '결' + bubbleAi 말풍선(둥글기 16 · 말한 쪽 위 6 · 폭 264). 첫 말풍선 위에만 'AI' 표시(AI 기본법 고지)
//  MeBubble   : accentAlt 알약(둥글기 20) · 흰 글. 1부 답은 눌러서 그 자리에서 고친다
//  TopicLine  : 섹션 넘어갈 때 구분 줄 '다음 이야기 · {섹션}'
//  TypingDots : 점 3개 — 900ms 투명도만 오르내림(깜빡임 0). 동작 줄이기면 가운데만 진하게 멈춤
//  ChatComposer: card 알약 입력칸 + accent 원 보내기(공통 TextField · SendButton — 한글 조합 규칙 F23 그대로)
// 새 말풍선은 아래 6 에서 240ms 떠오름(scene2.bubble). 동작 줄이기면 투명도만(motion Rise 가 맡음). 색 · 간격은 토큰만.
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { useCommitThenPress } from '@/components/commitThenPress';
import { Pressable } from '@/components/Pressable';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { dist, Rise, scene2, useReduceMotion } from '@/motion';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { fill, t } from './copy';

const AVATAR = size.avatar; // 32
const DOT_CYCLE_MS = 900;

// 새 줄만 떠오른다(불러온 지난 대화 · 다시 그림은 그대로)
export function Appear({ play, delay = 0, children, testID }: { play: boolean; delay?: number; children: ReactNode; testID?: string }) {
  return (
    <Rise play={play} delay={delay} distance={dist.bubble} duration={scene2.bubble.in} testID={testID}>
      {children}
    </Rise>
  );
}

export function AiBubble({ text, badge = false, small = false, dim = false, testID }: { text: string; badge?: boolean; small?: boolean; dim?: boolean; testID?: string }) {
  return (
    <View style={[styles.aiRow, dim ? styles.dim : null]}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText variant="captionBold" tone="accent">
          {t('CHAT.UI.avatar')}
        </AppText>
      </View>
      <View style={styles.aiCol}>
        {badge ? (
          <AppText variant="captionBold" tone="accent" accessibilityLabel={t('CHAT.START.aiBadgeA11y')} testID={testID ? `${testID}-badge` : undefined}>
            {t('CHAT.START.aiBadge')}
          </AppText>
        ) : null}
        {small ? (
          <AppText variant="caption" tone="sub" style={styles.why} testID={testID}>
            {text}
          </AppText>
        ) : (
          <View style={styles.aiBubble} accessible accessibilityLabel={`${t('CHAT.START.aiBadgeA11y')}: ${text}`} testID={testID}>
            <AppText variant="body">{text}</AppText>
          </View>
        )}
      </View>
    </View>
  );
}

export function MeBubble({ text, onPress, dim = false, testID }: { text: string; onPress?: () => void; dim?: boolean; testID?: string }) {
  const body = (
    <View style={styles.meBubble}>
      <AppText variant="body" tone="inverse">
        {text}
      </AppText>
    </View>
  );
  return (
    <View style={[styles.meRow, dim ? styles.dim : null]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={fill(t('CHAT.UI.editA11y'), { 답: text })} effect="scale" scaleTo="card" onPress={onPress} testID={testID} style={styles.meTouch}>
          {body}
        </Pressable>
      ) : (
        <View testID={testID}>{body}</View>
      )}
    </View>
  );
}

export function TopicLine({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.topic} testID={testID}>
      <View style={styles.rule} />
      <AppText variant="captionMedium" tone="sub">
        {text}
      </AppText>
      <View style={styles.rule} />
    </View>
  );
}

export function Note({ text, testID }: { text: string; testID?: string }) {
  return (
    <AppText variant="captionMedium" tone="accent" style={styles.note} testID={testID}>
      {text}
    </AppText>
  );
}

export function TypingDots({ slow, testID }: { slow: boolean; testID?: string }) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      cancelAnimation(p);
      p.set(1);
      return undefined;
    }
    p.set(0);
    p.set(withRepeat(withTiming(3, { duration: DOT_CYCLE_MS * 3 }), -1));
    return () => cancelAnimation(p);
  }, [reduce, p]);
  return (
    <View style={styles.aiRow} testID={testID}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText variant="captionBold" tone="accent">
          {t('CHAT.UI.avatar')}
        </AppText>
      </View>
      <View style={styles.aiCol}>
        <View style={[styles.aiBubble, styles.dots]} accessible accessibilityLabel={t('CHAT.TALK.typingA11y')} accessibilityLiveRegion="polite">
          {[0, 1, 2].map((i) => (
            <Dot key={i} index={i} p={p} reduce={reduce} />
          ))}
        </View>
        {slow ? (
          <AppText variant="caption" tone="sub" accessibilityLiveRegion="polite" testID={testID ? `${testID}-slow` : undefined}>
            {t('CHAT.TALK.slow')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function Dot({ index, p, reduce }: { index: number; p: SharedValue<number>; reduce: boolean }) {
  const style = useAnimatedStyle(() => {
    if (reduce) return { opacity: index === 1 ? 1 : alpha.disabled };
    const d = Math.abs(((p.get() - index + 3) % 3) - 0.5); // 차례로 진해졌다 옅어짐(투명도만)
    return { opacity: d < 0.5 ? 1 - d : alpha.disabled };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

type ComposerProps = { value: string; onChange: (text: string) => void; onSend: () => void; disabled: boolean; testID?: string };

export function ChatComposer({ value, onChange, onSend, disabled, testID = 'chat-composer' }: ComposerProps) {
  const send = useCommitThenPress(onSend);
  const empty = value.trim() === '';
  return (
    <View style={styles.composer} testID={testID}>
      <View style={styles.field}>
        <TextField label={t('CHAT.TALK.placeholder')} placeholder={t('CHAT.TALK.placeholder')} value={value} onChangeText={onChange} multiline maxLength={COMPOSER_MAX} testID={`${testID}-input`} />
      </View>
      {/* 보내기: 보이는 원 40(D42-C send) · 누르는 면 48 */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('CHAT.TALK.send')} onPress={send} disabled={disabled || empty} effect="scale" scaleTo="icon" testID={`${testID}-send`} style={styles.sendTouch}>
        <View style={[styles.sendCircle, disabled || empty ? styles.dim : null]}>
          <Icon name="send" size={SEND_ICON} color={colors.onAccent} />
        </View>
      </Pressable>
    </View>
  );
}
const SEND_ICON = 20;
export const COMPOSER_MAX = 1000; // 서버는 2000자까지 받는다(survey-interview) — 한 번에 1000자

const styles = StyleSheet.create({
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8, alignSelf: 'stretch' },
  aiCol: { flexShrink: 1, gap: space.s4, maxWidth: layout.bubbleMaxWidth },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  aiBubble: { backgroundColor: colors.bubbleAi, borderRadius: radius.lg, borderTopLeftRadius: space.s4 + 2, paddingHorizontal: space.s16 - 2, paddingVertical: space.s8 + 1 },
  why: { paddingHorizontal: space.s4 },
  meRow: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch' },
  meTouch: { maxWidth: layout.bubbleMaxWidth, borderRadius: radius.pill },
  meBubble: { maxWidth: layout.bubbleMaxWidth, backgroundColor: colors.accentAlt, borderRadius: space.s20, paddingHorizontal: space.s16, paddingVertical: space.s8 + 1 },
  dim: { opacity: alpha.disabled },
  topic: { flexDirection: 'row', alignItems: 'center', gap: space.s8, marginVertical: space.s4 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  note: { paddingLeft: AVATAR + space.s8 },
  dots: { flexDirection: 'row', gap: space.s4, alignItems: 'center', minHeight: size.chip },
  dot: { width: space.s8, height: space.s8, borderRadius: radius.pill, backgroundColor: colors.sub },
  sendTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  sendCircle: { width: layout.sendButton, height: layout.sendButton, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s8 },
  field: { flex: 1, minWidth: 0 },
});
