// 채팅 부품(V5 W5). 색 · 글자 · 간격 · 둥글기는 tokens 만, 누르는 것은 모두 공통 Pressable · Button · TextButton.
//  목록 줄: [얼굴 원 44][이름 · 나이 · 지역 / 마지막 글][때 · 읽지 않음] — 닫힌 방은 '닫힌 대화방' 한 줄 + 흐린 글자
//  말풍선: 내 글 = accentAlt 면 · 흰 글(오른쪽) / 받은 글 = bubbleAi 면 · text 글(왼쪽) — 공통 Bubble(F9)과 같은 색 · 둥글기 16 · 최대 폭 264
//  사진 말풍선: 200 × 250 둥글기 16, 누르면 크게 보기 · 음성 말풍선: [재생 · 멈춤 48] 길이 · 진행 막대(ProgressBar — 동작 줄이기면 즉시)
//  방 위 띠: '…까지 열려 있어요.' + [연장 알아보기] — 날짜 글만(카운트다운 0)
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { ProgressBar } from '@/motion';
import { layout } from '@/theme/layout';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import type { Message, Room } from './chatApi';
import { CHAT } from './chatCopy';
import { ChatIcon } from './ChatIcons';
import { clockText, durationText, listTimeText, systemLine } from './chatLogic';

export const PHOTO_W = 200;
export const PHOTO_H = 250;
const VOICE_BAR_W = 120;

export const headOf = (r: Room) => [r.partner.name, r.partner.age !== null ? String(r.partner.age) : null, r.partner.region.split(' ').slice(0, 2).join(' ') || null].filter(Boolean).join(' · ');

function lastLine(r: Room): string {
  if (!r.last) return CHAT.list.lastNone;
  if (r.last.kind === 'photo') return CHAT.list.lastPhoto;
  if (r.last.kind === 'voice') return CHAT.list.lastVoice;
  if (r.last.kind === 'system') return systemLine(r.last.body, r.last.mine) ?? CHAT.list.lastNone;
  return r.last.body;
}

export function RoomRow({ room, open, now, faceUri, onPress, testID }: { room: Room; open: boolean; now: number; faceUri: string | null; onPress: () => void; testID: string }) {
  const state = open ? CHAT.list.openUntil(listTimeText(room.closesAt, now)) : CHAT.list.closed;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={CHAT.list.rowA11y(room.partner.name, open ? lastLine(room) : CHAT.list.closed)} onPress={onPress} effect="scale" testID={testID} style={styles.row}>
      <ProfileAvatar uri={faceUri} width={layout.rowPhoto} testID={`${testID}-face`} />
      <View style={styles.rowMid}>
        <AppText variant="bodyMedium" numberOfLines={1} testID={`${testID}-head`}>
          {headOf(room)}
        </AppText>
        <AppText variant="small" tone="sub" numberOfLines={1} testID={`${testID}-last`}>
          {open ? lastLine(room) : CHAT.list.closed}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <AppText variant="caption" testID={`${testID}-time`}>
          {room.last ? listTimeText(room.last.at, now) : state}
        </AppText>
        {room.unread > 0 && open ? (
          <View style={styles.unread} accessibilityLabel={CHAT.list.unreadA11y(room.unread)} testID={`${testID}-unread`}>
            <AppText variant="captionBold" tone="inverse">
              {room.unread > 99 ? '99+' : String(room.unread)}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function DayDivider({ text, testID }: { text: string; testID?: string }) {
  return (
    <View style={styles.divider} testID={testID}>
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

export type SendState = 'sent' | 'sending' | 'failed';

type BubbleProps = {
  message: Message;
  sendState?: SendState;
  mediaUri: string | null;
  voice?: { playing: boolean; elapsedMs: number; onToggle: () => void };
  onPhoto?: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
  failText?: string; // 못 보낸 이유(없으면 '보내지 못했어요.')
  testID: string;
};

export function MessageBubble({ message: m, sendState = 'sent', mediaUri, voice, onPhoto, onRetry, onDiscard, failText, testID }: BubbleProps) {
  const mine = m.mine;
  if (m.kind === 'system') {
    const line = systemLine(m.body, mine);
    return line ? <DayDivider text={line} testID={testID} /> : null;
  }
  const face = { backgroundColor: mine ? colors.accentAlt : colors.bubbleAi };
  let body;
  if (m.purged) {
    body = (
      <View style={[styles.bubble, styles.purged]}>
        <AppText variant="small" tone="sub">
          {CHAT.room.purgedMedia}
        </AppText>
      </View>
    );
  } else if (m.kind === 'photo') {
    body = (
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={CHAT.photo.a11y(mine)} onPress={onPhoto} effect="scale" testID={`${testID}-photo`} style={styles.photo}>
        {mediaUri ? <Image source={{ uri: mediaUri }} style={styles.photoImg} resizeMode="cover" accessibilityIgnoresInvertColors /> : <ProfileAvatar uri={null} width={PHOTO_W} height={PHOTO_H} round={false} radiusSize={radius.lg} />}
      </Pressable>
    );
  } else if (m.kind === 'voice') {
    const total = m.durationMs ?? 0;
    const playing = voice?.playing ?? false;
    const elapsed = voice?.elapsedMs ?? 0;
    const ink = mine ? colors.onAccent : colors.text;
    body = (
      <View style={[styles.bubble, styles.voice, face]} accessibilityLabel={CHAT.voice.a11y(mine, durationText(total))} testID={`${testID}-voice`}>
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? CHAT.voice.pause : CHAT.voice.play} onPress={voice?.onToggle} effect="none" hitSlop={space.s4} style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]} testID={`${testID}-play`}>
          <ChatIcon name={playing ? 'pause' : 'play'} color={ink} />
        </Pressable>
        <View style={styles.voiceMid}>
          <ProgressBar ratio={total > 0 ? Math.min(1, elapsed / total) : 0} height={size.barProgress} style={[styles.voiceBar, mine ? styles.voiceTrackMine : null]} testID={`${testID}-progress`} />
          <AppText variant="caption" tone={mine ? 'inverse' : 'sub'} testID={`${testID}-len`}>
            {playing || elapsed > 0 ? `${durationText(elapsed)} / ${durationText(total)}` : durationText(total)}
          </AppText>
        </View>
      </View>
    );
  } else {
    body = (
      <View style={[styles.bubble, face]} testID={`${testID}-text`}>
        <AppText variant="body" tone={mine ? 'inverse' : 'text'} selectable>
          {m.body}
        </AppText>
      </View>
    );
  }
  return (
    <View style={[styles.line, mine ? styles.lineMine : styles.lineTheirs]} testID={testID}>
      <View style={[styles.stack, mine ? styles.stackMine : null]}>
        {body}
        {m.caution && !mine && sendState === 'sent' ? (
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-caution`}>
            {CHAT.send.caution}
          </AppText>
        ) : null}
        {sendState === 'failed' ? (
          <View style={styles.failRow} testID={`${testID}-failed`}>
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-fail-text`}>
              {failText ?? CHAT.send.failed}
            </AppText>
            <TextButton label={CHAT.send.retry} variant="captionMedium" onPress={onRetry} testID={`${testID}-retry`} />
            <TextButton label={CHAT.send.discard} variant="captionMedium" onPress={onDiscard} testID={`${testID}-discard`} />
          </View>
        ) : (
          <AppText variant="caption" style={mine ? styles.timeMine : null} testID={`${testID}-time`}>
            {sendState === 'sending' ? CHAT.send.sending : clockText(m.createdAt)}
          </AppText>
        )}
      </View>
    </View>
  );
}

// lead: 글 앞 아이콘 16 · sub(D43 A11 — 연장을 고른 뒤 상태 줄 accept)
export function Banner({ text, action, lead, testID }: { text: string; action?: { label: string; onPress: () => void; icon?: IconName }; lead?: IconName; testID: string }) {
  return (
    <View style={styles.banner} testID={testID}>
      {lead ? <Icon name={lead} size={16} color={colors.sub} testID={`${testID}-lead`} /> : null}
      <AppText variant="small" style={styles.flex} testID={`${testID}-text`}>
        {text}
      </AppText>
      {action ? <TextButton label={action.label} variant="captionMedium" icon={action.icon} onPress={action.onPress} testID={`${testID}-action`} /> : null}
    </View>
  );
}

export function ClosedNotice({ title, body, note, testID }: { title: string; body: string; note: string; testID: string }) {
  return (
    <View style={styles.closed} testID={testID} accessibilityLiveRegion="polite">
      <AppText variant="bodyBold">{title}</AppText>
      <AppText variant="small" testID={`${testID}-body`}>
        {body}
      </AppText>
      <AppText variant="caption">{note}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.listRow + space.s16, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingVertical: space.s12 },
  rowMid: { flex: 1, gap: space.s4 },
  rowEnd: { alignItems: 'flex-end', gap: space.s4 },
  unread: { minWidth: size.badge, height: size.badge, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s8 },
  divider: { alignSelf: 'center', backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: space.s12, paddingVertical: space.s4, marginVertical: space.s8 },
  line: { flexDirection: 'row', paddingHorizontal: size.screenPadding },
  lineMine: { justifyContent: 'flex-end' },
  lineTheirs: { justifyContent: 'flex-start' },
  stack: { maxWidth: layout.bubbleMaxWidth, gap: space.s4 },
  stackMine: { alignItems: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  purged: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  photo: { width: PHOTO_W, height: PHOTO_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.accentSoft },
  photoImg: { width: PHOTO_W, height: PHOTO_H },
  voice: { flexDirection: 'row', alignItems: 'center', gap: space.s8, paddingLeft: space.s4, paddingVertical: space.s4 },
  playBtn: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: alpha.pressed },
  voiceMid: { gap: space.s4, paddingRight: space.s4 },
  voiceTrackMine: { backgroundColor: colors.accentSoft },
  voiceBar: { width: VOICE_BAR_W },
  timeMine: { textAlign: 'right' },
  failRow: { flexDirection: 'row', alignItems: 'center', gap: space.s4, flexWrap: 'wrap', justifyContent: 'flex-end' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.s8, backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingLeft: space.s16, paddingRight: space.s4, marginHorizontal: size.screenPadding, marginBottom: space.s8, minHeight: size.touchMin },
  flex: { flex: 1 },
  closed: { gap: space.s4, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.s16, marginHorizontal: size.screenPadding, marginBottom: space.s16 },
});
