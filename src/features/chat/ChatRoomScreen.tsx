// 대화방(V5 W5 · 청사진 v5 초안 5장 8 · T-18 · T-19 · T-20 · T-27). 라우트 연결은 앱 A 몫 — /chat/[id] 가 <ChatRoomScreen id={id} /> 를 그리면 된다.
//  · 머리: ‹ 상대 이름 + ⋯(메뉴 시트: 7일 연장하기 · 대화방 나가기 · 신고 · 차단 · 닫기)
//  · 위 띠: '12월 30일 수요일 오후 6시까지 열려 있어요.' + [연장 알아보기] — 날짜 글만(카운트다운 · 재촉 0)
//  · 글 · 사진 · 음성. 연락처도 자유(T-20) — 금전 요구 · 욕설만 서버가 막는다(보낼 수 없는 표현이 있어요)
//  · 보내는 동안 내 말풍선에 '보내는 중', 못 보내면 '보내지 못했어요. [다시 보내기] [지우기]'
//  · 닫힌 방: 글쓰기 줄 대신 '대화방이 닫혔어요' 안내(지우는 날짜) — 읽기만. 신고는 닫힌 뒤에도 된다
//  · 새 글: 실시간(api.subscribe) + 15초마다 다시 읽기. 새로 온 말풍선만 8 올라오며 나타남(동작 줄이기면 투명도만)
//  · D46 만남 장면(T4S): meet 를 주면(라우트 /chat/[id]) 이 방에 처음 들어올 때 장면이 대화방 위에 한 번 덮인다(useMeetScene · MeetScene) ·
//    맨 위에 기억 한 줄(CHAT.room.metAt) · 판단 중엔 바탕만 1초. meet 가 없으면(시험 · 다른 길) 장면 · 기억 줄 0
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { COMMON, REPORT_SHEET } from '@/content/copy';
import { setToast as setNextToast } from '@/lib/toastBus';
import { CrisisCard } from '@/features/safety/CrisisCard';
import { takeCrisisCard } from '@/features/safety/crisisBudget';
import { MoreButton } from '@/features/safety/MoreButton';
import { ReportBlockSheet } from '@/features/safety/ReportBlockSheet';
import { haptic, Rise, scene2, SkeletonLines, TOAST_MS, WaitState, Wipe } from '@/motion';
import { alpha, colors, size, space } from '@/theme/tokens';

import type { ChatApi, Message, Outgoing, Room, SendFailure } from './chatApi';
import { CHAT } from './chatCopy';
import { closedLine, dayKey, dayText, isOpen, openLine, TEXT_MAX, VOICE_MAX_BYTES, VOICE_MIN_MS } from './chatLogic';
import type { ChatMedia } from './chatMedia';
import { Banner, ClosedNotice, DayDivider, MessageBubble, type SendState } from './ChatParts';
import { chatApi, chatMedia, CHAT_LIST_HREF } from './chatService';
import { Composer } from './Composer';
import { MeetScene } from './MeetScene';
import { useMeetScene, type MeetDeps } from './useMeetScene';
import { FarewellSheet, HelloSendSheet, MoneySafetyCard, OpenerChips, tagLabel, TogetherCard, TopicsSheet, type ChatIf2Deps } from '@/features/inflight/ChatIf2';
import { createDeviceNotes, deviceNotes, useDeviceNotes } from '@/features/inflight/deviceNotes';
import { moneySafetyHit } from '@/features/inflight/inflightLogic';
import { tx } from '@/features/inflight/if2Text';

const NO_NOTES = createDeviceNotes(); // IF2 칸이 없는 방(시험 · 스위치 꺼짐): 메모리만
export const POLL_MS = 15_000;
const FAIL_TEXT: Partial<Record<SendFailure, string>> = {
  blocked: CHAT.send.blocked,
  closed: CHAT.send.closed,
  network: COMMON.offline,
  limited: CHAT.send.limited,
  format: CHAT.send.format,
  size: CHAT.send.size,
  long: CHAT.composer.tooLong(TEXT_MAX),
};

type Pending = { clientId: string; out: Outgoing; state: Exclude<SendState, 'sent'>; failure: SendFailure | null; createdAt: number };
type Load = { kind: 'loading' } | { kind: 'failed'; reason: 'network' | 'server' } | { kind: 'gone' } | { kind: 'ready' };

let clientSeq = 0;
const newClientId = () => `c${Date.now().toString(36)}${(clientSeq += 1).toString(36)}`;

const asMessage = (p: Pending): Message => ({
  id: p.clientId,
  clientId: p.clientId,
  mine: true,
  kind: p.out.kind,
  body: p.out.kind === 'text' ? p.out.body : '',
  mediaId: null,
  caution: false,
  durationMs: p.out.kind === 'voice' ? p.out.durationMs : null,
  createdAt: p.createdAt,
  purged: false,
});

// IF2-F(D-223): if2 = 대화방 칸(첫마디 실마리 · 이야깃거리 시트 · 꼬리표 글 · 같이 열어 보는 질문 · 안전 안내 카드 · 작별 엽서 — 정책 PF-51 ~ PF-59). 없으면 지금 그대로.
//  draft = 홈 '꺼내는 말 가져가기'(입력창에 넣기만). 맨 위 순서(머리 · 남은 날 띠 · 기억 한 줄 · 방 열림 글)에는 아무것도 더하지 않는다(PF-58)
export function ChatRoomScreen({ id, api: givenApi, media: givenMedia, toastMs = TOAST_MS, pollMs = POLL_MS, meet, if2, draft }: { id: string; api?: ChatApi; media?: ChatMedia; toastMs?: number; pollMs?: number; meet?: MeetDeps; if2?: ChatIf2Deps; draft?: string }) {
  const api = givenApi ?? chatApi();
  const media = givenMedia ?? chatMedia();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [crisisId, setCrisisId] = useState<string | null>(null); // 위기 도움 카드가 붙은 내 글 id — 방금 보낸 글 한 장만(화면 메모리 · 방을 다시 열면 0 · 하루 3번, 정책 P4-29 ~ 34)
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [seen, setSeen] = useState<Set<string> | null>(null); // 처음 불러온 글(움직이지 않음)
  const [sheet, setSheet] = useState<'none' | 'menu' | 'extend' | 'leave' | 'safety' | 'topics' | 'hello'>('none');
  const [inject, setInject] = useState<{ text: string; seq: number } | null>(draft ? { text: draft, seq: 1 } : null);
  const putText = (text: string) => setInject((cur) => ({ text, seq: (cur?.seq ?? 0) + 1 }));
  const if2Store = if2?.notes ?? (if2 ? deviceNotes() : NO_NOTES); // IF2 칸이 없으면 기기 저장소를 건드리지 않는다
  const if2Notes = useDeviceNotes(if2Store);
  const if2On = (k: string) => !!if2 && if2.isOn(k);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [voice, setVoice] = useState<{ id: string; playing: boolean; elapsed: number } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const [r, m] = await Promise.all([api.getRoom(id), api.listMessages(id)]);
    if (!alive.current) return;
    if (!r.ok || !m.ok) {
      const reason = !r.ok ? r.reason : !m.ok ? m.reason : 'server';
      if (reason === 'unavailable') setLoad({ kind: 'gone' });
      else setLoad((cur) => (cur.kind === 'ready' ? cur : { kind: 'failed', reason }));
      return;
    }
    setRoom(r.data);
    setMessages(m.data);
    setSeen((cur) => cur ?? new Set(m.data.map((x) => x.id)));
    setLoad({ kind: 'ready' });
    const last = m.data[m.data.length - 1];
    if (r.data.unread > 0 && last) void api.markRead(id, last.id);
  }, [api, id]);

  useEffect(() => {
    alive.current = true; // 처음 읽기는 아래 useFocusEffect 가 한다
    const off = api.subscribe(id, () => void refresh());
    const timer = setInterval(() => void refresh(), pollMs);
    return () => {
      alive.current = false;
      off();
      clearInterval(timer);
      media.stop();
    };
  }, [api, id, media, pollMs, refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return undefined;
    }, [refresh]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  // 사진 주소(서명 URL · 데모 파일): 처음 보일 때 한 번
  useEffect(() => {
    const need = messages.filter((m) => m.kind === 'photo' && m.mediaId && !m.purged && !(m.mediaId in urls));
    if (need.length === 0) return;
    let on = true;
    void Promise.all(need.map(async (m) => [m.mediaId as string, await api.mediaUrl(m.mediaId as string).catch(() => null)] as const)).then((pairs) => {
      if (on) setUrls((cur) => ({ ...cur, ...Object.fromEntries(pairs) }));
    });
    return () => {
      on = false;
    };
  }, [messages, urls, api]);

  const now = api.now();
  const open = room ? isOpen(room, now) : false;
  const meetView = useMeetScene(meet, { id, load: load.kind, room, messages, now: () => api.now() });
  const covered = meetView.scene !== null || meetView.cover; // 장면 · 판단 중 바탕이 덮는 동안 아래 대화방은 화면 읽기에서 숨긴다

  // 새 카드가 뜨면 앞 카드는 걷힌다(한 번에 한 장). 하루 3번을 넘으면 글만 보내고 화면 변화 0(안내 글 0)
  const showCrisis = (messageId: string) => {
    if (takeCrisisCard()) setCrisisId(messageId);
  };
  const sendOut = async (out: Outgoing) => {
    setPending((cur) => [...cur.filter((p) => p.clientId !== out.clientId), { clientId: out.clientId, out, state: 'sending', failure: null, createdAt: api.now() }]);
    const r = await api.send(id, out);
    if (!alive.current) return;
    if (r.ok) {
      const { help, ...sent } = r.data; // 위기 표시는 보내기 응답에만 — 글 목록 상태에는 넣지 않는다(저장 0)
      setPending((cur) => cur.filter((p) => p.clientId !== out.clientId));
      setMessages((cur) => (cur.some((m) => m.id === sent.id) ? cur : [...cur, sent]));
      if (help && out.kind === 'text') showCrisis(sent.id);
      const mid = r.data.mediaId;
      if (out.kind !== 'text' && out.localUri && mid) setUrls((cur) => ({ ...cur, [mid]: cur[mid] ?? out.localUri ?? null }));
      return;
    }
    setPending((cur) => cur.map((p) => (p.clientId === out.clientId ? { ...p, state: 'failed', failure: r.reason } : p)));
    if (r.reason === 'closed' || r.reason === 'unavailable') void refresh();
  };

  const pickPhoto = async () => {
    const p = await media.pickPhoto();
    if (!p.ok) {
      if (p.reason !== 'cancel') setToast(p.reason === 'size' ? CHAT.photo.size : p.reason === 'format' ? CHAT.photo.format : CHAT.photo.unavailable);
      return;
    }
    void sendOut({ clientId: newClientId(), kind: 'photo', bytes: p.bytes, contentType: 'image/jpeg', localUri: p.uri, demoKey: p.demoKey });
  };
  const startVoice = async () => {
    media.stop();
    const s = await media.startRecording();
    if (s === 'ok') return true;
    setToast(s === 'denied' ? CHAT.voice.denied : CHAT.voice.unavailable);
    return false;
  };
  const stopVoice = async (send: boolean) => {
    if (!send) {
      media.cancelRecording();
      return;
    }
    const rec = await media.stopRecording();
    if (!rec || rec.durationMs < VOICE_MIN_MS) {
      setToast(CHAT.voice.tooShort);
      return;
    }
    if (rec.bytes.length > VOICE_MAX_BYTES) {
      setToast(CHAT.voice.tooBig);
      return;
    }
    void sendOut({ clientId: newClientId(), kind: 'voice', bytes: rec.bytes, contentType: rec.contentType, durationMs: rec.durationMs, localUri: rec.uri || undefined });
  };
  const toggleVoice = async (m: Message) => {
    if (voice?.id === m.id && voice.playing) {
      media.stop(m.id);
      setVoice({ id: m.id, playing: false, elapsed: voice.elapsed });
      return;
    }
    const uri = m.mediaId ? await api.mediaUrl(m.mediaId).catch(() => null) : null;
    setVoice({ id: m.id, playing: true, elapsed: 0 });
    const ok = await media.play(
      m.id,
      uri,
      m.durationMs ?? 0,
      (ms) => alive.current && setVoice((cur) => (cur?.id === m.id ? { ...cur, elapsed: ms } : cur)),
      () => alive.current && setVoice((cur) => (cur?.id === m.id ? { id: m.id, playing: false, elapsed: 0 } : cur)),
    );
    if (!ok) {
      setVoice(null);
      setToast(CHAT.voice.playFailed);
    }
  };

  const setExtend = async (want: boolean) => {
    if (busy) return;
    setBusy(true);
    const r = await api.setExtend(id, want);
    setBusy(false);
    if (!r.ok) {
      setDialogError(r.reason === 'network' ? COMMON.offline : CHAT.extend.failed);
      return;
    }
    setDialogError(null);
    setSheet('none');
    setToast(r.data.extended ? CHAT.extend.extendedToast : want ? CHAT.extend.wantNote : CHAT.extend.undoNote);
    await refresh();
  };
  // 안전 안내 카드를 닫거나 신고하면 그 방은 다시 0(본 기록만 기기 — PF-56)
  const markSafety = () => if2Store.set('wordSafety', [...if2Notes.wordSafety.filter((x) => x !== id), id].slice(-20));
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    const r = await api.leave(id);
    setBusy(false);
    if (!r.ok) {
      setDialogError(r.reason === 'network' ? COMMON.offline : CHAT.leave.failed);
      return;
    }
    setDialogError(null);
    setSheet('none');
    setNextToast(CHAT.leave.done); // 나간 방은 내 목록에서 사라진다(0031) → 목록에서 토스트
    back();
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace(CHAT_LIST_HREF as Href));

  // 글 목록 + 보내는 중인 글. 날짜가 바뀌는 곳에 나눔 줄
  const shown: { m: Message; state: SendState; failure: SendFailure | null }[] = [
    ...messages.map((m) => ({ m, state: 'sent' as const, failure: null })),
    ...pending.map((p) => ({ m: asMessage(p), state: p.state, failure: p.failure })),
  ];
  const pendingUri = (clientId: string) => {
    const p = pending.find((x) => x.clientId === clientId);
    return p && p.out.kind !== 'text' ? (p.out.localUri ?? null) : null;
  };

  const title = room?.partner.name ?? '';
  // IF2: 같이 열어 보는 질문의 답 두 글(together_a)은 카드 안에 펼친다 · 안전 안내 카드는 판정에 걸린 첫 받은 글 아래 한 번
  const answersOf = (cardId: string) => {
    const a = messages.filter((x) => x.tag === 'together_a' && x.ref === cardId);
    return { mine: a.find((x) => x.mine)?.body ?? null, theirs: a.find((x) => !x.mine)?.body ?? null };
  };
  const safetyAt = if2On('word_safety') && open && !if2Notes.wordSafety.includes(id) ? (shown.find(({ m }) => !m.mine && m.kind === 'text' && !m.tag && moneySafetyHit(m.body))?.m.id ?? null) : null;
  const wrote = shown.some(({ m }) => m.mine && m.kind !== 'system');
  const farewellOn = !!if2 && if2On('farewell') && !!room && open;
  return (
    <View style={styles.flex}>
      <View style={styles.flex} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        <Screen enter="depth" testID="chat-room">
          <View style={styles.head}>
            <View style={styles.flex}>
              <ScreenHeader title={title} onBack={back} testID="chat-room-header" />
            </View>
            {room ? <MoreButton onPress={() => setSheet('menu')} testID="chat-room-more" /> : null}
          </View>
          {load.kind === 'loading' ? <WaitState waiting skeleton={<SkeletonLines count={5} />} note={<AppText variant="caption">{COMMON.loading}</AppText>} testID="chat-room-wait" /> : null}
          {load.kind === 'failed' ? (
            <View style={styles.center} testID="chat-room-failed">
              <AppText variant="body" style={styles.centerText}>
                {load.reason === 'network' ? COMMON.offline : CHAT.room.loadFailed}
              </AppText>
              <Button label={COMMON.retry} variant="secondary" inline onPress={() => void refresh()} testID="chat-room-retry" />
            </View>
          ) : null}
          {load.kind === 'gone' ? (
            <View style={styles.center} testID="chat-room-gone">
              <AppText variant="body" style={styles.centerText}>
                {CHAT.room.gone}
              </AppText>
            </View>
          ) : null}
          {load.kind === 'ready' && room ? (
            <KeyboardAvoid>
              {open ? (
                <Banner
                  text={room.myExtend ? CHAT.extend.wantNote : openLine(room.closesAt, now)}
                  lead={room.myExtend ? 'accept' : undefined}
                  action={{ label: CHAT.room.extendLink, onPress: () => setSheet('extend'), icon: 'extend' }}
                  testID="chat-room-banner"
                />
              ) : null}
              <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.list} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} testID="chat-room-messages">
                {meetView.metAt ? (
                  <AppText variant="caption" style={styles.startNote} testID="chat-room-met-at">
                    {meetView.metAt}
                  </AppText>
                ) : null}
                <AppText variant="caption" style={styles.startNote} testID="chat-room-start">
                  {CHAT.room.startNote(room.partner.name)}
                </AppText>
                {shown.map(({ m, state, failure }, i) => {
                  if (m.tag === 'together_a') return null; // 같이 열어 보는 질문 카드 안에 펼침
                  const prev = shown[i - 1]?.m;
                  const divider = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const fresh = seen !== null && !seen.has(m.id) && state === 'sent';
                  // 2안 핵심 ③: 이 방의 첫 보낸 말풍선(처음 불러올 때 내 글이 없던 방)만 보낸 쪽에서 걷힘 420(위쪽 바탕 그라데이션이라 덮개 대신 역이동), 나머지 새 말풍선은 일상 240 · 6px
                  const firstMine = fresh && m.mine && shown.findIndex((x) => x.m.mine) === i;
                  const bubble = m.tag === 'together_q' && if2 ? (
                    <TogetherCard message={m} answers={answersOf(m.id)} roomOpen={open} deps={if2} onChanged={(helpFor) => (helpFor && showCrisis(helpFor), void refresh())} testID={`chat-together-${i}`} />
                  ) : (
                    <MessageBubble
                      label={m.tag ? tagLabel(m) : null}
                      message={m}
                      sendState={state}
                      mediaUri={state === 'sent' ? (m.mediaId ? (urls[m.mediaId] ?? null) : null) : pendingUri(m.id)}
                      voice={m.kind === 'voice' ? { playing: voice?.id === m.id && voice.playing, elapsedMs: voice?.id === m.id ? voice.elapsed : 0, onToggle: () => void toggleVoice(m) } : undefined}
                      onPhoto={() => {
                        const u = state === 'sent' ? (m.mediaId ? urls[m.mediaId] : null) : pendingUri(m.id);
                        if (u) setViewer(u);
                      }}
                      onRetry={() => {
                        const p = pending.find((x) => x.clientId === m.id);
                        if (p) void sendOut(p.out);
                      }}
                      onDiscard={() => setPending((cur) => cur.filter((x) => x.clientId !== m.id))}
                      failText={failure ? FAIL_TEXT[failure] : undefined}
                      testID={`chat-msg-${i}`}
                    />
                  );
                  return (
                    <View key={m.id}>
                      {divider ? <DayDivider text={dayText(m.createdAt)} testID={`chat-day-${i}`} /> : null}
                      {firstMine ? (
                        <Wipe from="right" duration={scene2.chat.first}>
                          {bubble}
                        </Wipe>
                      ) : fresh ? (
                        <Rise distance={scene2.bubble.rise} duration={scene2.bubble.in}>
                          {bubble}
                        </Rise>
                      ) : (
                        bubble
                      )}
                      {crisisId === m.id ? (
                        <View style={styles.crisisLine}>
                          <CrisisCard onClose={() => setCrisisId(null)} testID="chat-crisis" />
                        </View>
                      ) : null}
                      {safetyAt === m.id ? (
                        <MoneySafetyCard
                          onReport={() => {
                            markSafety();
                            setSheet('safety');
                          }}
                          onClose={markSafety}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
              {/* 첫마디 실마리는 만남 장면(D46)이 덮여 있는 동안 0 — 장면이 끝난 뒤 입력창 위에 */}
              {open && if2 && !meetView.scene ? <OpenerChips roomId={id} roundNo={room.roundNo} wrote={wrote} deps={if2} onChip={putText} onPostcard={() => setSheet('hello')} /> : null}
              {open ? (
                <Composer
                  canPhoto={media.photo}
                  canVoice={media.voice}
                  onSendText={(text) => void sendOut({ clientId: newClientId(), kind: 'text', body: text })}
                  onPhoto={() => void pickPhoto()}
                  onStartVoice={startVoice}
                  onStopVoice={(send) => void stopVoice(send)}
                  inject={inject}
                  side={
                    if2On('talk_depth') ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={tx('TOPICS.entryA11y')} onPress={() => setSheet('topics')} effect="none" style={({ pressed }) => [styles.topicsBtn, pressed && styles.pressed]} testID="chat-topics">
                        <AppText variant="captionMedium" tone="accent">
                          {tx('TOPICS.entry')}
                        </AppText>
                      </Pressable>
                    ) : undefined
                  }
                  testID="chat-composer"
                />
              ) : (
                <ClosedNotice title={CHAT.room.closedTitle} body={closedLine(room)} note={CHAT.room.closedMediaNote} testID="chat-room-closed" />
              )}
            </KeyboardAvoid>
          ) : null}

          {/* 메뉴 시트 */}
          <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet('none')} testID="chat-menu">
            <AppText variant="bodyBold" accessibilityRole="header" style={styles.sheetTitle}>
              {CHAT.menu.title}
            </AppText>
            {open ? (
              <>
                <MenuItem label={CHAT.menu.extend} hint={CHAT.menu.extendHint} icon="extend" onPress={() => setSheet('extend')} testID="chat-menu-extend" />
                <MenuItem
                  label={CHAT.menu.leave}
                  hint={CHAT.menu.leaveHint}
                  icon="leave"
                  onPress={() => {
                    haptic.warning(); // 되돌릴 수 없는 확인창(D25 4장)
                    setDialogError(null);
                    setSheet('leave');
                  }}
                  testID="chat-menu-leave"
                />
              </>
            ) : null}
            <MenuItem label={CHAT.menu.safety} hint={CHAT.menu.safetyHint} icon="report" danger onPress={() => setSheet('safety')} testID="chat-menu-safety" last />
            <Button label={CHAT.menu.cancel} variant="secondary" onPress={() => setSheet('none')} testID="chat-menu-cancel" />
          </BottomSheet>

          {/* 연장 시트: 둘 다 원하면 7일 더(상대의 선택은 둘 다 고른 뒤에만 알 수 있다) */}
          <BottomSheet visible={sheet === 'extend'} onClose={() => !busy && setSheet('none')} dismissable={!busy} testID="chat-extend">
            <AppText variant="bodyBold" accessibilityRole="header">
              {CHAT.extend.title}
            </AppText>
            <AppText variant="small" testID="chat-extend-body">
              {room?.myExtend ? CHAT.extend.wantNote : CHAT.extend.body}
            </AppText>
            {dialogError ? (
              <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="chat-extend-error">
                {dialogError}
              </AppText>
            ) : null}
            {room?.myExtend ? (
              <Button label={CHAT.extend.undo} variant="secondary" loading={busy} onPress={() => void setExtend(false)} testID="chat-extend-undo" />
            ) : (
              <Button label={CHAT.extend.want} loading={busy} onPress={() => void setExtend(true)} testID="chat-extend-want" />
            )}
            <Button label={CHAT.menu.cancel} variant="text" onPress={() => !busy && setSheet('none')} testID="chat-extend-cancel" />
          </BottomSheet>

          {if2 && farewellOn ? (
            <FarewellSheet
              visible={sheet === 'leave'}
              roomId={id}
              deps={if2}
              onClose={() => !busy && setSheet('none')}
              onPlainLeave={() => void leave()}
              busyPlain={busy}
              plainError={dialogError}
              onLeft={() => {
                setSheet('none');
                setNextToast(CHAT.leave.done);
                back();
              }}
            />
          ) : null}
          {if2 && room ? (
            <>
              <TopicsSheet visible={sheet === 'topics'} roomId={id} deps={if2} onClose={() => setSheet('none')} onPlaced={(helpFor) => (helpFor && showCrisis(helpFor), void refresh())} onGive={putText} />
              <HelloSendSheet
                visible={sheet === 'hello'}
                roomId={id}
                deps={if2}
                onClose={() => setSheet('none')}
                onSent={() => {
                  setSheet('none');
                  void refresh();
                }}
              />
            </>
          ) : null}
          <ConfirmDialog
            visible={sheet === 'leave' && !farewellOn}
            title={CHAT.leave.title}
            body={CHAT.leave.body}
            confirmLabel={CHAT.leave.confirm}
            cancelLabel={CHAT.leave.cancel}
            busy={busy}
            error={dialogError}
            onConfirm={() => void leave()}
            onCancel={() => !busy && setSheet('none')}
            testID="chat-leave"
          />

          {room ? (
            <ReportBlockSheet
              visible={sheet === 'safety'}
              targetId={room.id} // 0031 report_chat_partner · block_chat_partner 는 방 id 로 받는다
              api={{ report: api.report, block: api.block }}
              onClose={() => setSheet('none')}
              onReported={() => {
                setSheet('none');
                setToast(REPORT_SHEET.done);
              }}
              onBlocked={() => {
                setSheet('none');
                setNextToast(REPORT_SHEET.blockDone); // 목록에서 보인다(차단한 방은 목록에서 빠짐)
                back();
              }}
              onUnavailable={() => {
                setSheet('none');
                setLoad({ kind: 'gone' });
              }}
              testID="chat-report"
            />
          ) : null}

          <Modal visible={viewer !== null} transparent={false} animationType="fade" onRequestClose={() => setViewer(null)} testID="chat-viewer">
            <SafeAreaView style={styles.viewer}>
              <Pressable accessibilityRole="button" accessibilityLabel={CHAT.photo.viewerClose} onPress={() => setViewer(null)} effect="none" style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]} testID="chat-viewer-close">
                <AppText variant="bodyMedium" tone="inverse">
                  {CHAT.photo.viewerClose}
                </AppText>
              </Pressable>
              {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImg} resizeMode="contain" accessibilityLabel={CHAT.photo.viewerA11y} /> : null}
            </SafeAreaView>
          </Modal>

          <Toast text={toast} bottom={open ? size.touchMin + space.s32 : undefined} />
        </Screen>
      </View>
      {meetView.cover ? <View pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.cover]} testID="chat-meet-wait" /> : null}
      {meetView.scene ? <MeetScene plan={meetView.scene.plan} mode={meetView.scene.mode} onDone={meetView.done} testID="chat-meet" /> : null}
    </View>
  );
}

// 메뉴 줄 앞 아이콘 24(D43 A1 · A2 · A3, 신고 · 차단은 accent)
function MenuItem({ label, hint, icon, danger = false, onPress, testID, last = false }: { label: string; hint: string; icon: IconName; danger?: boolean; onPress: () => void; testID: string; last?: boolean }) {
  return (
    <Pressable accessibilityLabel={`${label}. ${hint}`} onPress={onPress} effect="none" style={({ pressed }) => [styles.item, styles.itemRow, !last && styles.itemLine, pressed && styles.pressed]} testID={testID}>
      <Icon name={icon} size={24} color={danger ? colors.accent : colors.text} testID={`${testID}-icon`} />
      <View style={styles.itemText}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="caption">{hint}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingRight: space.s8 },
  center: { alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingTop: space.s48 },
  centerText: { textAlign: 'center' },
  list: { gap: space.s12, paddingVertical: space.s16 },
  crisisLine: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: size.screenPadding, marginTop: space.s4 }, // 내 말풍선 바로 아래 · 말풍선 폭 안(카드가 bubbleMaxWidth)
  startNote: { textAlign: 'center', paddingHorizontal: size.screenPadding },
  sheetTitle: { paddingVertical: space.s8, borderBottomWidth: 1, borderBottomColor: colors.line },
  item: { minHeight: size.listRow, justifyContent: 'center', gap: space.s4, paddingVertical: space.s12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  itemText: { flex: 1, gap: space.s4 },
  itemLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { opacity: alpha.pressed },
  viewer: { flex: 1, backgroundColor: colors.text },
  viewerClose: { alignSelf: 'flex-end', minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'center', paddingHorizontal: size.screenPadding },
  viewerImg: { flex: 1, width: '100%' },
  cover: { backgroundColor: colors.bg },
  topicsBtn: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.s4 },
});
