// 글쓰기 줄(V5 W5): [사진][마이크][글 칸][보내기(D42-C 1안 send)]. 녹음 중에는 같은 자리가 [취소] '녹음 중 0:05 / 1:00' [보내기]로 바뀐다.
//  · 글 칸은 공통 TextField(F23 한글 입력 규칙 — 웹 조합 중 되쓰기 · 자르기 0). 보내기 · Enter 는 조합을 먼저 끝낸 뒤 최신 글로 보낸다(commitThenPress)
//  · 한 번에 1000자. 넘으면 칸 아래 이유(보내지 않음) — 조합이 끝난 뒤에만 잰다. 빈 글은 보내기 꺼짐
//  · 사진 · 음성 단추는 기기가 할 수 있을 때만(chatMedia — iOS · Android 는 패키지 설치 전까지 없음)
//  · 녹음 표시는 멈춘 점 하나 + 지난 시간 글(깜빡임 · 물결 0). 1분이 되면 멈추고 보낸다
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { useCommitThenPress } from '@/components/commitThenPress';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { CHAT } from './chatCopy';
import { ChatIcon } from './ChatIcons';
import { checkText, durationText, TEXT_MAX, VOICE_MAX_MS } from './chatLogic';

type Props = {
  canPhoto: boolean;
  canVoice: boolean;
  onSendText: (text: string) => void;
  onPhoto: () => void;
  onStartVoice: () => Promise<boolean>; // 녹음을 시작했으면 true
  onStopVoice: (send: boolean) => void;
  now?: () => number;
  testID?: string;
};

export function Composer({ canPhoto, canVoice, onSendText, onPhoto, onStartVoice, onStopVoice, now = Date.now, testID = 'composer' }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recAt, setRecAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const stopRef = useRef(onStopVoice);
  useEffect(() => {
    stopRef.current = onStopVoice;
  });

  // 녹음 시간: 0.5초마다 글만 바꾼다. 1분이 되면 멈추고 보낸다
  useEffect(() => {
    if (recAt === null) return undefined;
    const timer = setInterval(() => {
      const ms = now() - recAt;
      setElapsed(ms);
      if (ms >= VOICE_MAX_MS) {
        setRecAt(null);
        stopRef.current(true);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [recAt, now]);

  const send = () => {
    const c = checkText(text.normalize('NFC'));
    if (!c.ok) {
      setError(c.reason === 'long' ? CHAT.composer.tooLong(TEXT_MAX) : null);
      return;
    }
    setError(null);
    setText('');
    onSendText(c.text);
  };
  const press = useCommitThenPress(send);
  const id = (part: string) => `${testID}-${part}`;

  if (recAt !== null) {
    return (
      <View style={styles.bar} testID={id('recording')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHAT.voice.cancel}
          onPress={() => {
            setRecAt(null);
            onStopVoice(false);
          }}
          effect="none"
          style={({ pressed }) => [styles.textTouch, pressed && styles.pressed]}
          testID={id('rec-cancel')}>
          <AppText variant="bodyMedium" tone="accent">
            {CHAT.voice.cancel}
          </AppText>
        </Pressable>
        <View style={styles.recMid} accessible accessibilityLabel={CHAT.voice.recordingA11y(durationText(elapsed))} accessibilityLiveRegion="none">
          <View style={styles.recDot} />
          <AppText variant="bodyMedium" testID={id('rec-time')}>
            {`${CHAT.voice.recording} ${durationText(elapsed)}`}
          </AppText>
          <AppText variant="caption">{`/ ${durationText(VOICE_MAX_MS)}`}</AppText>
        </View>
        <SendCircle
          label={CHAT.voice.send}
          onPress={() => {
            setRecAt(null);
            onStopVoice(true);
          }}
          testID={id('rec-send')}
        />
      </View>
    );
  }

  const empty = text.trim() === '';
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.bar}>
        {canPhoto ? (
          <Pressable accessibilityRole="button" accessibilityLabel={CHAT.composer.photo} onPress={onPhoto} effect="none" style={({ pressed }) => [styles.icon, pressed && styles.pressed]} testID={id('photo')}>
            <ChatIcon name="photo" color={colors.sub} />
          </Pressable>
        ) : null}
        {canVoice ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CHAT.composer.voice}
            onPress={async () => {
              if (await onStartVoice()) {
                setElapsed(0);
                setRecAt(now());
              }
            }}
            effect="none"
            style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
            testID={id('voice')}>
            <ChatIcon name="mic" color={colors.sub} />
          </Pressable>
        ) : null}
        <View style={styles.field}>
          <TextField
            label={CHAT.composer.label}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (error) setError(null);
            }}
            placeholder={CHAT.composer.placeholder}
            returnKeyType="send"
            onSubmitEditing={press}
            testID={id('input')}
          />
        </View>
        <SendCircle label={CHAT.composer.send} onPress={press} disabled={empty} testID={id('send')} />
      </View>
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" style={styles.error} testID={id('error')}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

// 보내기 원: 공통 SendButton(원 40)과 같은 모양 · 같은 색. 터치 칸만 48 × 48 로 넓혀 둔다(웹에서 hitSlop 은 칸 크기에 들지 않아서)
function SendCircle({ label, onPress, disabled = false, testID }: { label: string; onPress?: () => void; disabled?: boolean; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} effect="scale" surface="accent" style={styles.sendTouch} testID={testID}>
      <View style={[styles.sendCircle, disabled ? styles.sendOff : null]}>
        <Icon name="send" size={SEND_ICON} color={colors.onAccent} />
      </View>
    </Pressable>
  );
}

const SEND_ICON = 20; // 1안 명세: 보내기 원 안은 20(선 1.75) — 공통 SendButton 과 같다

const styles = StyleSheet.create({
  sendTouch: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  sendCircle: { width: layout.sendButton, height: layout.sendButton, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: alpha.disabled },
  textTouch: { minWidth: size.touchMin, minHeight: size.touchMin, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s8 },
  wrap: { backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.s4, paddingHorizontal: space.s12, paddingVertical: space.s8, backgroundColor: colors.bg },
  icon: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: alpha.pressed },
  field: { flex: 1, marginRight: space.s4 },
  error: { paddingHorizontal: size.screenPadding, paddingBottom: space.s8 },
  recMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s8, justifyContent: 'center' },
  recDot: { width: space.s8, height: space.s8, borderRadius: radius.pill, backgroundColor: colors.accent },
});
