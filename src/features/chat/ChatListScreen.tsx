// 채팅 탭 — 대화방 목록(V5 W5 · 청사진 v5 초안 5장 8 · T4). 탭 · 라우트 연결은 앱 A 몫(app/W5_변경기록.md 2장).
//  · 열린 방 먼저(마지막 글 최신순), 닫힌 방은 아래('닫힌 대화방' — 30일 동안 읽기만). 차단한 상대의 방은 목록에 없다
//  · 줄: 얼굴 원 · 이름 · 나이 · 지역 · 마지막 글 · 때 · 읽지 않은 수. 남은 기간은 방 안에서 날짜 글로만(목록에 카운트다운 0)
//  · 불러오기: 0.3초 안은 빈 자리 → 뼈대(WaitState). 실패는 한 줄 + [다시 시도]. 화면에 들어올 때마다 다시 읽는다
//  · 데모 모드: 맨 아래 '데모 · 장면' 줄(누를 때마다 열린 방 → 마지막 날 → 상대가 연장을 원함 → 닫힌 방 → 방 없음)
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { OfflineArt, StateArt } from '@/components/StateArt';
import { TabHeader } from '@/components/TabHeader';
import { Toast } from '@/components/Toast';
import { COMMON } from '@/content/copy';
import { usePhotoUrls } from '@/features/recs/usePhotoUrls';
import { takeToast } from '@/lib/toastBus';
import { SkeletonLines, TOAST_MS, WaitState } from '@/motion';
import { alpha, colors, radius, size, space } from '@/theme/tokens';
import { H2_EMPTY_ART } from '@/theme/uiAssets';

import type { ChatApi, Room } from './chatApi';
import { CHAT } from './chatCopy';
import { hasDemoControls, type DemoChatScene } from './chatDemo';
import { isOpen, sortRooms } from './chatLogic';
import { RoomRow } from './ChatParts';
import { chatApi, chatRoomHref } from './chatService';

type Load = { kind: 'loading' } | { kind: 'failed'; reason: 'network' | 'server' } | { kind: 'ready'; rooms: Room[] };

export function ChatListScreen({ api: given, onOpen, toastMs = TOAST_MS }: { api?: ChatApi; onOpen?: (id: string) => void; toastMs?: number }) {
  const api = given ?? chatApi();
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [scene, setScene] = useState<DemoChatScene | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const my = (seq.current += 1);
    const r = await api.listRooms();
    if (my !== seq.current) return;
    if (!r.ok) setLoad({ kind: 'failed', reason: r.reason });
    else setLoad({ kind: 'ready', rooms: r.data });
    if (hasDemoControls(api)) setScene(await api.demo.scene());
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      const text = takeToast(); // 대화방에서 차단하고 돌아오면 '차단했어요…'
      if (text) setToast(text);
      void refresh();
      return undefined;
    }, [refresh]),
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  const rooms = load.kind === 'ready' ? load.rooms : [];
  const now = api.now();
  const withOpen = sortRooms(rooms.map((r) => ({ ...r, open: isOpen(r, now), lastAt: r.last?.at ?? r.openedAt })));
  const faces = usePhotoUrls(
    rooms.map((r) => r.partner.facePhotoId),
    (id) => api.faceUrl(id),
  );
  const open = (id: string) => (onOpen ? onOpen(id) : router.push(chatRoomHref(id) as Href));

  return (
    <Screen enter="tab" testID="chat-list">
      <TabHeader title={CHAT.tabTitle} testID="chat-list-header" />
      <ScrollView contentContainerStyle={styles.body}>
        {load.kind === 'loading' ? (
          <WaitState waiting skeleton={<SkeletonLines count={4} />} note={<AppText variant="caption">{COMMON.loading}</AppText>} testID="chat-list-wait" />
        ) : null}
        {load.kind === 'failed' ? (
          <View style={styles.center} testID="chat-list-failed">
            <OfflineArt show={load.reason === 'network'} />
            <AppText variant="body" style={styles.centerText}>
              {load.reason === 'network' ? COMMON.offline : CHAT.list.loadFailed}
            </AppText>
            <Button label={COMMON.retry} variant="secondary" inline onPress={() => void refresh()} testID="chat-list-retry" />
          </View>
        ) : null}
        {load.kind === 'ready' && rooms.length === 0 ? (
          <View style={styles.center} testID="chat-list-empty">
            <StateArt source={H2_EMPTY_ART.emptyHistory} />
            <AppText variant="bodyBold" style={styles.centerText}>
              {CHAT.list.emptyTitle}
            </AppText>
            <AppText variant="small" tone="sub" style={styles.centerText}>
              {CHAT.list.emptyBody}
            </AppText>
          </View>
        ) : null}
        {withOpen.map((r, i) => (
          <View key={r.id}>
            {i > 0 ? <View style={styles.sep} /> : null}
            <RoomRow room={r} open={r.open} now={now} faceUri={r.partner.facePhotoId ? (faces[r.partner.facePhotoId] ?? null) : null} onPress={() => open(r.id)} testID={`chat-row-${i}`} />
          </View>
        ))}
        {scene && hasDemoControls(api) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CHAT.demo.sceneLine(CHAT.demo.scenes[scene])}
            onPress={async () => {
              setScene(await api.demo.next());
              await refresh();
            }}
            effect="none"
            style={({ pressed }) => [styles.demo, pressed && styles.pressed]}
            testID="chat-demo-scene">
            <AppText variant="caption" tone="text">
              {CHAT.demo.sceneLine(CHAT.demo.scenes[scene])}
            </AppText>
          </Pressable>
        ) : null}
      </ScrollView>
      <Toast text={toast} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.s32, flexGrow: 1 },
  center: { alignItems: 'center', gap: space.s12, paddingHorizontal: size.screenPadding, paddingTop: space.s48 },
  centerText: { textAlign: 'center' },
  sep: { height: 1, backgroundColor: colors.line, marginHorizontal: size.screenPadding },
  demo: { marginTop: space.s24, marginHorizontal: size.screenPadding, minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  pressed: { opacity: alpha.pressed },
});
