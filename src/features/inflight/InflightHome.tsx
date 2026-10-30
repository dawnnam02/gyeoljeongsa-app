// 홈(탑승권 탭 첫 화면) 새 구성의 B2 ~ B7(IF2-F · D-223 · 디자인 안 1 '주머니 한 줄' · 정책 PF-81 ~ PF-89 · 화면_요구사항 'T2 홈 — 새 구성').
//  · B1(탑승권 · 남은 날 · 취소 · 못 탐 이유)은 BoardingScreen 이 먼저 그린다. 이 부품은 그 뒤 홈 상태(get_home_state) 하나를 읽어 나머지 블록을 그린다
//    (홈 열 때 부르는 서버 함수 = 탑승권 둘 + get_home_state 하나 · AI 0 — PF-09 · IFF-04)
//  · 자리 고정 B2 이번 짝 → B3 좌석 앞 주머니 → B4 상태 카드 → B5 지난 회차 짝 → B6 나를 알기 → B7 접힘 줄 · 블록 5 이하(B1 포함) · 칸 3 이하
//  · 못 불러오면 블록 0 · 오류 글 0(B1 만 오류) · 홈 표면에 상대 이름 · 사진 · 나이 · 글 · 답 · 공통점 · 별자리 · 좌석 · 회차 번호 · 숫자 · 점 · '새' · '아직' 0(PF-08 · PF-86)
//  · 궁합 카드 · 꼭 나눌 이야기는 접힌 한 줄 → 시트(PF-42) · 방이 닫히면(차단 · 나가기) 다시 읽을 때 블록 · 시트 · 캐시 0
//  · 쉬는 중 · 졸업 단계 · 1.1 피드백 칸은 그리지 않는다(PF-84 · PF-87)
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { BOARDING } from '@/features/boarding/boardingCopy';
import type { BoardingState } from '@/features/boarding/boardingApi';
import { SafeShareSheet } from '@/features/safeShare/SafeShareSheet';
import { if2Look } from '@/theme/if2Look';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { deviceNotes, useDeviceNotes, type DeviceNotes } from './deviceNotes';
import type { HomeState, InflightApi } from './inflightApi';
import { foldRows, hasReflectMemo, homeBlocks, homeCode, tripOf, type FoldRow } from './inflightLogic';
import type { Ck17Api, TypeSource } from './inflightService';
import { isPacked, tarotOf, travelTypeOf } from './if2Library';
import { HomeBlock, HomeCell, if2Styles } from './If2Parts';
import { Ck17Sheet, HelloWriteSheet, MeetPrepSheet, MemoSheet, MustTalkSheet, PairCardSheet, PreAnswerSheet } from './If2Sheets';
import { tx } from './if2Text';

export type InflightHomeDeps = {
  api: Pick<InflightApi, 'home' | 'pairCard' | 'preQuestions'>;
  ck17: Ck17Api;
  type: TypeSource;
  isOn: (key: string) => boolean;
  notes?: DeviceNotes;
  now?: () => number;
};
export type InflightHomeNav = {
  open: (href: Href) => void;
  chat: (roomId: string, draft?: string) => void;
  settings: (page: 'avoid' | 'safety' | 'consent-management') => void;
  profileSameHobby: () => void;
};

type Sheet = 'none' | 'hello' | 'pre' | 'pair' | 'talk' | 'prep' | 'memo' | 'share' | 'ck17';

export function useInflightHome(deps: InflightHomeDeps | undefined) {
  const [home, setHome] = useState<HomeState | null>(null);
  const on = !!deps && deps.isOn('inflight_home');
  const load = useCallback(() => {
    if (!deps || !on) {
      setHome(null);
      return;
    }
    void deps.api.home().then((r) => setHome(r.ok ? r.data : null)); // 못 불러오면 블록 0 · 오류 글 0(PF-86)
  }, [deps, on]);
  useFocusEffect(
    useCallback(() => {
      load();
      return undefined;
    }, [load]),
  );
  return { home, on, reload: load };
}

export function InflightHome({ deps, home, boarding, nav, onToast, testID = 'home' }: { deps: InflightHomeDeps; home: HomeState; boarding: BoardingState; nav: InflightHomeNav; onToast: (t: string) => void; testID?: string }) {
  const notes = deps.notes ?? deviceNotes();
  const n = useDeviceNotes(notes);
  const now = deps.now ?? Date.now;
  const [sheet, setSheet] = useState<Sheet>('none');
  const [typeId, setTypeId] = useState<string | null>(null); // 내 여행 타입 id(서버 값이 생기기 전엔 데모만)
  const [memoRoom, setMemoRoom] = useState<string | null>(null);
  const isOn = deps.isOn;
  const round = boarding.ticket?.roundNo ?? boarding.round?.no ?? 0;
  const roomId = home.pair?.roomId ?? null;

  useEffect(() => {
    void deps.type.mine().then(setTypeId);
  }, [deps.type]);
  // 회차 끝 · 방 닫힘 + 30일 지움(엽서 · 미리 답 · 표시 · 메모 — PF-10 · PF-A)
  useEffect(() => {
    if (!notes.ready()) return;
    const flying = home.stage === 'inflight' || home.stage === 'landing' || home.stage === 'overlap';
    notes.purge({ now: now(), inflightRound: flying ? round : null, openRoom: roomId, openRoomRound: home.stage === 'matched' ? round : home.stage === 'overlap' ? round - 1 : null, reflectOk: home.reflectOk });
  }, [home, n, notes, now, round, roomId]);

  const type = travelTypeOf(typeId);
  const packed = isPacked(n.typeBag); // 타입은 있어도 짐을 아직 안 쌌으면 칸 글은 '짐을 싸면 엽서가 나와요'(그때 처음 엽서가 나옴 — 정책 PF-31)
  const blocks = homeBlocks(home, n, now());
  const code = homeCode(home, blocks);
  const trip = tripOf(boarding.round?.no ?? null);
  const reflectRoom = Object.values(n.memos).find((m) => m.room !== roomId)?.room ?? null;

  const cellsOf = (b: string): ReactNode => {
    switch (b) {
      case 'B2':
      case 'B5': {
        if (!home.pair) return null;
        const prev = b === 'B5';
        const cells = home.pair.cells;
        const names = cells.map((c) => (c === 'pair_card' ? tx('PAIR_CARD.home.name') : c === 'values_talk' ? tx('MUST_TALK.home.name') : c === 'meet_prep' ? tx('MEET_PREP.home.name') : tx('MEET_MEMO.home.name')));
        return (
          <HomeBlock key={b} title={prev ? tx('HOME.pair.titlePrev') : tx('HOME.pair.title')} cellNames={names} testID={`${testID}-${b}`}>
            <View style={styles.full}>
              <AppText variant="body" testID={`${testID}-${b}-line`}>
                {tx('HOME.pair.chatLine')}
              </AppText>
              <Button label={tx('HOME.pair.chatGo')} variant="secondary" onPress={() => roomId && nav.chat(roomId)} testID={`${testID}-${b}-chat`} />
            </View>
            {cells.map((c) =>
              c === 'pair_card' ? (
                <HomeCell key={c} icon="story" name={tx('PAIR_CARD.home.name')} line={tx('PAIR_CARD.home.line')} onPress={() => setSheet('pair')} testID={`${testID}-${b}-pair`} />
              ) : c === 'values_talk' ? (
                <HomeCell key={c} icon="listcard" name={tx('MUST_TALK.home.name')} line={tx('MUST_TALK.home.line')} onPress={() => setSheet('talk')} testID={`${testID}-${b}-talk`} />
              ) : c === 'meet_prep' ? (
                <HomeCell key={c} icon="tag" name={tx('MEET_PREP.home.name')} line={tx('MEET_PREP.home.line')} onPress={() => setSheet('prep')} testID={`${testID}-${b}-prep`} />
              ) : (
                <HomeCell key={c} icon="memo" name={tx('MEET_MEMO.home.name')} line={roomId && n.memos[roomId] ? tx('MEET_MEMO.home.lineWritten') : tx('MEET_MEMO.home.line')} onPress={() => openMemo(roomId)} testID={`${testID}-${b}-memo`} />
              ),
            )}
          </HomeBlock>
        );
      }
      case 'B3': {
        const cells = (home.pocket ?? []).filter((c) => c.kind !== 'type' || !!type);
        if (cells.length === 0) return null;
        return (
          <HomeBlock key={b} title={tx('HOME.pocket.title')} cellNames={cells.map((c) => (c.kind === 'mag' ? tx('HOME.pocket.mag') : c.kind === 'card' ? tx('HOME.pocket.card') : tx('HOME.pocket.type')))} testID={`${testID}-B3`}>
            {cells.map((c) =>
              c.kind === 'mag' ? (
                <HomeCell key="mag" icon="magazine" name={tx('HOME.pocket.mag')} line={c.state === 'issued' && trip ? tx('HOME.pocket.magLine', { 여행지: trip }) : tx('HOME.pocket.magBefore')} onPress={c.state === 'issued' ? () => nav.open('/magazine' as Href) : undefined} testID={`${testID}-B3-mag`} />
              ) : c.kind === 'card' ? (
                <HomeCell key="card" icon="tcard" name={tx('HOME.pocket.card')} line={c.state === 'revealed' ? tx('HOME.pocket.cardAfter', { '카드 이름': tarotOf(c.card)?.name ?? '' }) : tx('HOME.pocket.cardBefore')} onPress={isOn('inflight_mag') ? () => nav.open('/magazine?page=card' as Href) : undefined} testID={`${testID}-B3-card`} />
              ) : (
                <HomeCell key="type" icon="tag" name={tx('HOME.pocket.type')} line={type && packed ? tx('HOME.pocket.typeAfter', { '타입 이름': type.name }) : tx('HOME.pocket.typeNone')} onPress={() => nav.open('/type-card' as Href)} testID={`${testID}-B3-type`} />
              ),
            )}
          </HomeBlock>
        );
      }
      case 'B4': {
        if (code === 'reflect') {
          return (
            <HomeBlock key={b} title={tx('HOME.status.reflect')} cellNames={[tx('MEET_MEMO.home.name')]} testID={`${testID}-B4`}>
              <HomeCell icon="memo" name={tx('MEET_MEMO.home.name')} line={tx('MEET_MEMO.home.lineWritten')} onPress={() => openMemo(reflectRoom)} testID={`${testID}-B4-memo`} />
            </HomeBlock>
          );
        }
        const st = home.status;
        if (!st) return null;
        const title = st.head === 'arrival' ? tx('HOME.status.arrival') : st.head === 'landing' ? tx('HOME.status.landing') : tx('HOME.status.meet');
        const names = st.cells.map((c) => (c === 'postcard' ? tx('HELLO_POSTCARD.home.name') : c === 'pre_answer' ? tx('PRE_ANSWER.home.name') : c === 'meet_prep' ? tx('MEET_PREP.home.name') : tx('MEET_MEMO.home.name')));
        const wrote = !!n.postcard && n.postcard.round === round;
        return (
          <HomeBlock key={b} title={title} cellNames={names} testID={`${testID}-B4`}>
            {st.cells.map((c) =>
              c === 'postcard' ? (
                <HomeCell key={c} icon="postcard" name={tx('HELLO_POSTCARD.home.name')} line={!st.writable ? tx('HELLO_POSTCARD.home.lineLanding') : wrote ? tx('HELLO_POSTCARD.home.lineWritten') : tx('HELLO_POSTCARD.home.line')} onPress={() => setSheet('hello')} testID={`${testID}-B4-postcard`} />
              ) : c === 'pre_answer' ? (
                <HomeCell key={c} icon="slip" name={tx('PRE_ANSWER.home.name')} line={st.writable ? tx('PRE_ANSWER.home.line') : tx('PRE_ANSWER.home.lineLanding')} onPress={() => setSheet('pre')} testID={`${testID}-B4-pre`} />
              ) : c === 'meet_prep' ? (
                <HomeCell key={c} icon="tag" name={tx('MEET_PREP.home.name')} line={tx('MEET_PREP.home.line')} onPress={() => setSheet('prep')} testID={`${testID}-B4-prep`} />
              ) : (
                <HomeCell key={c} icon="memo" name={tx('MEET_MEMO.home.name')} line={roomId && n.memos[roomId] ? tx('MEET_MEMO.home.lineWritten') : tx('MEET_MEMO.home.line')} onPress={() => openMemo(roomId)} testID={`${testID}-B4-memo`} />
              ),
            )}
          </HomeBlock>
        );
      }
      case 'B6': {
        const cells = (home.me?.cells ?? []).filter((c) => c !== 'type' || !!type);
        if (cells.length === 0) return null;
        return (
          <HomeBlock key={b} title={tx('HOME.me.title')} cellNames={cells.map((c) => (c === 'type' ? tx('TYPE_CARD.home.name') : tx('PREVIEW_ME.home.name')))} testID={`${testID}-B6`}>
            {cells.map((c) =>
              c === 'type' ? (
                <HomeCell key={c} icon="suitcase" name={tx('TYPE_CARD.home.name')} line={type && packed ? tx('TYPE_CARD.home.line', { '타입 이름': type.name }) : tx('TYPE_CARD.home.lineNone')} onPress={() => nav.open('/type-card' as Href)} testID={`${testID}-B6-type`} />
              ) : (
                <HomeCell key={c} icon="postmark" name={tx('PREVIEW_ME.home.name')} line={tx('PREVIEW_ME.home.line')} onPress={() => nav.open('/preview-me' as Href)} testID={`${testID}-B6-preview`} />
              ),
            )}
          </HomeBlock>
        );
      }
      case 'B7':
        return <FoldBlock key={b} rows={foldRowsOf()} open={n.homeFold} onToggle={() => notes.set('homeFold', !n.homeFold)} onRow={onFoldRow} boarding={boarding} testID={`${testID}-B7`} />;
      default:
        return null;
    }
  };

  function openMemo(room: string | null) {
    if (!room) return;
    setMemoRoom(room);
    setSheet('memo');
  }
  function foldRowsOf(): FoldRow[] {
    return foldRows(home, { hasPastChat: boarding.past.some((p) => !!p.chatId), memoElsewhere: code !== 'reflect' && hasReflectMemo(home, n, now()), typeOn: isOn('type_card') && !!type, previewOn: isOn('profile_preview') });
  }
  function onFoldRow(r: FoldRow) {
    if (r === 'profile') nav.open('/profile' as Href);
    else if (r === 'survey') nav.open({ pathname: '/survey/[step]', params: { step: '01' } } as Href);
    else if (r === 'avoid') nav.settings('avoid');
    else if (r === 'chats') {
      const chat = boarding.past.find((p) => p.chatId);
      if (chat?.chatId) nav.chat(chat.chatId);
    } else if (r === 'memo') openMemo(reflectRoom);
    else if (r === 'type') nav.open('/type-card' as Href);
    else nav.open('/preview-me' as Href);
  }

  const shown = blocks.filter((b) => b !== 'B1');
  return (
    <View style={if2Styles.gap} testID={`${testID}-blocks`}>
      <View testID={`${testID}-state-${code}`} />
      {home.hobbyNotice && !n.hobbyNotice ? (
        <View style={styles.band} testID={`${testID}-hobby-notice`}>
          <AppText variant="small">{tx('PROFILE.sameHobby.notice')}</AppText>
          <View style={styles.bandButtons}>
            <View style={if2Styles.flex}>
              <Button
                label={tx('PROFILE.sameHobby.noticeOpen')}
                variant="secondary"
                onPress={() => {
                  notes.set('hobbyNotice', true);
                  nav.profileSameHobby();
                }}
                testID={`${testID}-hobby-open`}
              />
            </View>
            <View style={if2Styles.flex}>
              <Button label={tx('PROFILE.sameHobby.noticeKeep')} variant="secondary" onPress={() => notes.set('hobbyNotice', true)} testID={`${testID}-hobby-keep`} />
            </View>
          </View>
        </View>
      ) : null}
      {shown.map((b) => cellsOf(b))}

      {roomId ? (
        <>
          <PairCardSheet visible={sheet === 'pair'} roomId={roomId} api={deps.api} overlap={home.stage === 'overlap'} onClose={() => setSheet('none')} onChat={() => (setSheet('none'), nav.chat(roomId))} onTalk={() => setSheet('talk')} onCk17={() => setSheet('ck17')} />
          <MustTalkSheet visible={sheet === 'talk'} roomId={roomId} onClose={() => setSheet('none')} onUseOpener={(t) => (setSheet('none'), nav.chat(roomId, t))} notes={notes} />
          <MeetPrepSheet visible={sheet === 'prep'} roomId={roomId} shareOn={isOn('safe_share')} onClose={() => setSheet('none')} onShare={() => setSheet('share')} onGuide={() => (setSheet('none'), nav.settings('safety'))} notes={notes} />
          <SafeShareSheet visible={sheet === 'share'} partner={null} onClose={() => setSheet('prep')} />
        </>
      ) : null}
      {memoRoom ? <MemoSheet visible={sheet === 'memo'} roomId={memoRoom} closedAt={n.memos[memoRoom]?.closedAt ?? null} onClose={() => setSheet('none')} onToast={onToast} notes={notes} /> : null}
      <HelloWriteSheet visible={sheet === 'hello'} round={round} writable={home.status?.writable === true} onClose={() => setSheet('none')} onToast={onToast} notes={notes} />
      <PreAnswerSheet visible={sheet === 'pre'} round={round} api={deps.api} onClose={() => setSheet('none')} onToast={onToast} notes={notes} />
      <Ck17Sheet
        visible={sheet === 'ck17'}
        onClose={() => setSheet('pair')}
        onSave={async (a, b) => {
          const r = await deps.ck17.record(a, b, 'feature_sheet');
          if (r.ok) setSheet('pair');
          return r.ok;
        }}
      />
    </View>
  );
}

// B7 접힘 줄 '다듬기 · 지난 대화' — 펼침은 기기에만 기억 · 끝 있는 줄 목록
function FoldBlock({ rows, open, onToggle, onRow, boarding, testID }: { rows: FoldRow[]; open: boolean; onToggle: () => void; onRow: (r: FoldRow) => void; boarding: BoardingState; testID: string }) {
  const nameOf = (r: FoldRow) =>
    r === 'profile' ? BOARDING.tasks.profile.name : r === 'survey' ? BOARDING.tasks.survey.name : r === 'avoid' ? BOARDING.tasks.avoid.name : r === 'chats' ? BOARDING.tasks.chats.name : r === 'memo' ? tx('MEET_MEMO.home.name') : r === 'type' ? tx('TYPE_CARD.home.name') : tx('PREVIEW_ME.home.name');
  const lineOf = (r: FoldRow) =>
    r === 'profile' ? BOARDING.tasks.profile.line : r === 'survey' ? BOARDING.tasks.survey.line : r === 'avoid' ? BOARDING.tasks.avoid.line : r === 'chats' ? BOARDING.tasks.chats.line(boarding.past.length) : r === 'memo' ? tx('MEET_MEMO.home.lineWritten') : r === 'type' ? tx('TYPE_CARD.home.open') : tx('PREVIEW_ME.home.line');
  return (
    <View style={styles.fold} testID={testID}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} accessibilityLabel={open ? tx('HOME.fold.a11yClose') : tx('HOME.fold.a11yOpen')} onPress={onToggle} effect="none" style={({ pressed }) => [styles.foldRow, pressed && styles.pressed]} testID={`${testID}-toggle`}>
        <Icon name="settings" size={22} color={colors.sub} />
        <AppText variant="bodyMedium" style={if2Styles.flex}>
          {tx('HOME.fold.title')}
        </AppText>
        <Icon name="back" size={20} color={colors.sub} rotate={open ? 90 : -90} />
      </Pressable>
      {open
        ? rows.map((r) => (
            <Pressable key={r} accessibilityRole="button" accessibilityLabel={`${nameOf(r)}, ${lineOf(r)}`} onPress={() => onRow(r)} effect="none" style={({ pressed }) => [styles.foldItem, pressed && styles.pressed]} testID={`${testID}-row-${r}`}>
              <AppText variant="bodyMedium">{nameOf(r)}</AppText>
              <AppText variant="caption">{lineOf(r)}</AppText>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%', gap: space.s8 },
  band: { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.s16, gap: space.s12 },
  bandButtons: { flexDirection: 'row', gap: space.s8 },
  fold: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  foldRow: { minHeight: if2Look.foldRowH, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16 },
  foldItem: { minHeight: size.touchMin, justifyContent: 'center', gap: space.s4, paddingHorizontal: space.s16, paddingVertical: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { opacity: alpha.pressed },
});
