// 대화방 칸(IF2-F · 정책 PF-51 ~ PF-59 · 화면_요구사항 'T4 대화방 칸' · 카피 21-7 · 21-10 · 21-11 · 21-14 · 21-15) — T4 맨 위 순서엔 아무것도 더하지 않는다(PF-58).
//  자리 셋: 입력창 위 한 자리(첫마디 실마리 칩 — 내 첫 글 전만) · 말풍선 흐름(꼬리표 글 · 같이 열어 보는 질문 카드 · 안전 안내 카드) · 시트(이야깃거리 · 엽서 보내기 · 나가기)
//  · 주고받는 글은 모두 채팅 글 한 종류 + 꼬리표(0043 send_chat_card · together_* — 같은 거르기 · 신고 · 보관 · 알림) · 새 실시간 채널 0
//  · 상대가 답했는지 · 썼는지 · '아직' · 재촉 0(PF-13 · PF-55) · 칩은 누르면 입력창에 들어감(바로 보내지 않음) · 다시 뽑기 0
//  · 안전 안내 카드: 판정은 휴대폰에서 · 저장 · 전송 · 로그 0 · 막지 않음 · 나에게만 · 방마다 한 번(본 기록만 기기 — PF-56 · IFF-09)
//  · 작별 엽서: 다섯 가운데 하나 + 한 줄 고침(팀장 10-28 · 대화방 거르기) · 보내기가 끝난 뒤에만 나감(실패면 나가지 않음 — PF-57)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { SAFETY_GUIDE } from '@/content/copy';
import { CONSENT_MANAGE } from '@/content/settingsCopy';
import type { Message } from '@/features/chat/chatApi';
import { CHAT } from '@/features/chat/chatCopy';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { deviceNotes, useDeviceNotes, type DeviceNotes, type Postcard } from './deviceNotes';
import type { If2Fail, InflightApi, OpenerChip, TalkDepth, TalkTopics } from './inflightApi';
import { ABOUT_CATS, ABOUT_MAX, aboutRef, DEPTH_ORDER, type AboutCat } from './inflightLogic';
import { chipText, depthOfQuestion, questionText } from './if2Library';
import { if2Styles, SheetHead } from './If2Parts';
import { tx, txList } from './if2Text';

export type ChatIf2Deps = { api: InflightApi; isOn: (key: string) => boolean; notes?: DeviceNotes };
const FAREWELL_MAX = 100; // 0043 farewell_max(한 줄 · 100자)
const ANSWER_MAX = 200; // 0043 answer_max
const count = (t: string) => Array.from(t).length;
const failText = (f: If2Fail): string => (f.code === 'text_blocked' ? CHAT.send.blocked : f.code === 'room_closed' ? CHAT.send.closed : CHAT.send.failed);

// 엽서 글(첫 인사 문장 + 더할 한 줄) — 서버 ref p0 ~ p5 = 카피 21장 배열 번호
export const postcardBody = (p: Postcard): string => [txList('HELLO_POSTCARD.write.lines')[p.line] ?? '', p.extra].filter((x) => x.trim() !== '').join(' ');

// ── 첫마디 실마리(F-23 · PF-51): 입력창 위 칩 3 · 써 둔 엽서가 있으면 첫 칩 · 내 첫 글 뒤 사라짐 ─────────────
export function OpenerChips({ roomId, roundNo, wrote, deps, onChip, onPostcard, testID = 'if2-chips' }: { roomId: string; roundNo: number | null; wrote: boolean; deps: ChatIf2Deps; onChip: (text: string) => void; onPostcard: () => void; testID?: string }) {
  const notes = useDeviceNotes(deps.notes ?? deviceNotes());
  const [loaded, setChips] = useState<OpenerChip[]>([]);
  const on = deps.isOn('opener_chips');
  useEffect(() => {
    if (on && !wrote) void deps.api.openerChips(roomId).then((r) => setChips(r.ok && r.data.show ? r.data.chips : []));
  }, [deps.api, on, roomId, wrote]);
  const chips = on && !wrote ? loaded : []; // 내 첫 글 뒤 · 스위치 꺼짐이면 칩 0
  const card = deps.isOn('postcard') && notes.postcard && roundNo !== null && notes.postcard.round === roundNo ? notes.postcard : null;
  const texts = chips.map((c) => chipText(c.id, c.hobby)).filter((t): t is string => !!t);
  if (wrote || (!card && texts.length === 0)) return null;
  return (
    <View style={styles.chips} accessibilityLabel={tx('FIRST_HINT.label')} testID={testID}>
      <AppText variant="caption">{tx('FIRST_HINT.label')}</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {card ? <Chip label={tx('FIRST_HINT.postcardChip')} accessibilityLabel={tx('FIRST_HINT.postcardChipA11y')} onPress={onPostcard} testID={`${testID}-postcard`} /> : null}
        {texts.slice(0, card ? 2 : 3).map((t, i) => (
          <Chip key={t} label={tx('FIRST_HINT.chip', { 질문: t })} accessibilityLabel={tx('FIRST_HINT.chipA11y', { 질문: t })} onPress={() => onChip(t)} testID={`${testID}-${i}`} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── 써 둔 엽서 보내기 시트(F-25 · PF-37): 상대 프로필을 본 뒤 [엽서 보내기] · [두기] 같은 크기 · 공개 뒤 고쳐 쓰기 0 ────────
type HelloSendProps = { visible: boolean; roomId: string; deps: ChatIf2Deps; onClose: () => void; onSent: () => void; testID?: string };
export function HelloSendSheet(props: HelloSendProps) {
  const testID = props.testID ?? 'if2-hello-send';
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <HelloSendBody {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}
function HelloSendBody({ roomId, deps, onClose, onSent, testID = 'if2-hello-send' }: HelloSendProps) {
  const store = deps.notes ?? deviceNotes();
  const card = useDeviceNotes(store).postcard;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!card || busy) return;
    setBusy(true);
    const r = await deps.api.sendCard(roomId, 'postcard', postcardBody(card), `p${card.line}`);
    setBusy(false);
    if (r.ok) {
      store.set('postcard', null); // 보내면 기기에서 지움(PF-37)
      onSent();
      return;
    }
    setError(r.code === 'not_first' ? tx('HELLO_POSTCARD.send.notFirst') : failText(r));
  };
  return (
    <>
      <SheetHead title={tx('HELLO_POSTCARD.send.title')} closeLabel={tx('PAIR_CARD.close')} onClose={() => !busy && onClose()} testID={testID} />
      {card ? (
        <View style={if2Styles.paper} accessible accessibilityLabel={tx('HELLO_POSTCARD.bubble.a11y', { 문장: txList('HELLO_POSTCARD.write.lines')[card.line] ?? '', '한 줄': card.extra })} testID={`${testID}-preview`}>
          <AppText variant="captionMedium" tone="accent">
            {tx('HELLO_POSTCARD.bubble.label')}
          </AppText>
          <AppText variant="body">{postcardBody(card)}</AppText>
        </View>
      ) : null}
      <AppText variant="caption">{tx('HELLO_POSTCARD.send.note')}</AppText>
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
          {error}
        </AppText>
      ) : null}
      <View style={styles.pair}>
        <View style={if2Styles.flex}>
          <Button label={tx('HELLO_POSTCARD.send.send')} loading={busy} onPress={() => void send()} testID={`${testID}-send`} />
        </View>
        <View style={if2Styles.flex}>
          <Button label={tx('HELLO_POSTCARD.send.keep')} variant="secondary" onPress={onClose} testID={`${testID}-keep`} />
        </View>
      </View>
    </>
  );
}

// ── 이야깃거리 시트(F-29 · F-30 · F-14 · F-67 — PF-52 ~ PF-55 · PF-36): 칸 넷 ─────────────────────────────
type TopicTab = 'topics' | 'together' | 'aboutMe' | 'pre';
type TopicsProps = { visible: boolean; roomId: string; deps: ChatIf2Deps; onClose: () => void; onPlaced: () => void; onGive: (text: string) => void; testID?: string };
export function TopicsSheet(props: TopicsProps) {
  const testID = props.testID ?? 'if2-topics';
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <TopicsBody {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}
function TopicsBody({ roomId, deps, onClose, onPlaced, onGive, testID = 'if2-topics' }: TopicsProps) {
  const store = deps.notes ?? deviceNotes();
  const notes = useDeviceNotes(store);
  const [topics, setTopics] = useState<TalkTopics | 'loading' | 'failed' | 'closed'>('loading');
  const [tab, setTab] = useState<TopicTab>('topics');
  const [depth, setDepth] = useState<TalkDepth>('light');
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [picks, setPicks] = useState<Partial<Record<AboutCat, number>>>({});
  const [aboutStep, setAboutStep] = useState<'pick' | 'preview'>('pick');
  const preItems = notes.preAnswers?.items ?? [];
  const tabs = useMemo(
    () =>
      ([['topics', tx('TOPICS.section.topics')], ...(deps.isOn('together_q') ? [['together', tx('TOPICS.section.together')]] : []), ...(deps.isOn('my_manual') ? [['aboutMe', tx('TOPICS.section.aboutMe')]] : []), ...(deps.isOn('pre_answer') && preItems.length > 0 ? [['pre', tx('PRE_ANSWER.chat.section')]] : [])] as [TopicTab, string][]),
    [deps, preItems.length],
  );
  const fetchTopics = useCallback(() => {
    void deps.api.topics(roomId).then((r) => setTopics(r.ok ? r.data : r.code === 'room_closed' ? 'closed' : 'failed'));
  }, [deps.api, roomId]);
  useEffect(fetchTopics, [fetchTopics]);
  const load = () => {
    setTopics('loading');
    fetchTopics();
  };
  const today = typeof topics === 'object' ? topics : null;
  const openDepths = today ? DEPTH_ORDER.filter((d) => today.depths.includes(d)) : [];
  const list = today ? today.questions.filter((id) => depthOfQuestion(id) === depth) : [];
  const allSeen = !!today && today.questions.length > 0 && today.questions.every((id) => seen.has(id));
  const draftOf = (id: string) => preItems.find((x) => x.q === id)?.text ?? null;

  const place = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await deps.api.sendCard(roomId, 'topic', questionText(id) ?? '', id);
    setBusy(false);
    if (r.ok) {
      setSeen((s) => new Set([...s, id]));
      onPlaced();
      onClose();
    } else setError(r.code === 'not_today' ? tx('TOPICS.notToday') : failText(r));
  };
  const sendTogether = async () => {
    if (!q || busy) return;
    if (count(answer.trim()) < 1 || count(answer) > ANSWER_MAX) {
      setError(tx('OPEN_TOGETHER.tooLong', { n: String(ANSWER_MAX) }));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await deps.api.togetherSend(roomId, q, questionText(q) ?? '', answer.trim());
    setBusy(false);
    if (r.ok) {
      onPlaced();
      onClose();
    } else setError(r.code === 'daily_used' ? tx('OPEN_TOGETHER.dailyUsed') : r.code === 'not_today' ? tx('TOPICS.notToday') : r.code === 'too_long' ? tx('OPEN_TOGETHER.tooLong', { n: String(ANSWER_MAX) }) : failText(r));
  };
  const aboutLines = ABOUT_CATS.filter((c) => picks[c] !== undefined).map((c) => txList(`ABOUT_ME.${c}`)[picks[c] as number] ?? '');
  const sendAbout = async () => {
    if (aboutLines.length === 0) {
      setError(tx('ABOUT_ME.needOne'));
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await deps.api.sendCard(roomId, 'about_me', aboutLines.join('\n'), aboutRef(picks));
    setBusy(false);
    if (r.ok) {
      onPlaced();
      onClose();
    } else setError(r.code === 'already_sent' ? tx('ABOUT_ME.alreadySent') : failText(r));
  };

  return (
    <>
      <SheetHead title={tx('TOPICS.title')} closeLabel={tx('TOPICS.close')} onClose={() => !busy && onClose()} testID={testID} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {tabs.map(([k, label]) => (
          <Chip key={k} label={label} variant="tab" selected={tab === k} onPress={() => (setTab(k), setError(null))} testID={`${testID}-tab-${k}`} />
        ))}
      </ScrollView>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
        {topics === 'loading' ? <AppText variant="caption">{tx('TOPICS.title')}</AppText> : null}
        {topics === 'failed' ? (
          <View style={if2Styles.gapSmall} testID={`${testID}-failed`}>
            <AppText variant="body" tone="sub" accessibilityRole="alert">
              {tx('TOPICS.loadFailed')}
            </AppText>
            <TextButton label={tx('TOPICS.title')} onPress={load} testID={`${testID}-retry`} />
          </View>
        ) : null}
        {topics === 'closed' ? <AppText variant="body">{tx('TOPICS.closed')}</AppText> : null}
        {today && tab === 'topics' ? (
          <>
            <AppText variant="caption">{tx('TOPICS.guide')}</AppText>
            <View style={if2Styles.wrapRow}>
              {openDepths.map((d) => (
                <Chip key={d} label={tx(d === 'values' ? 'TOPICS.depth.marriage' : `TOPICS.depth.${d}`)} accessibilityLabel={tx('TOPICS.a11y.depth', { '깊이 칸 이름': tx(d === 'values' ? 'TOPICS.depth.marriage' : `TOPICS.depth.${d}`) })} variant="tab" selected={depth === d} onPress={() => setDepth(d)} testID={`${testID}-depth-${d}`} />
              ))}
            </View>
            {list.map((id, i) => (
              <View key={id} style={if2Styles.paper} testID={`${testID}-q-${i}`}>
                <AppText variant="body">{questionText(id)}</AppText>
                <TextButton label={tx('TOPICS.send')} variant="captionMedium" align="start" onPress={() => void place(id)} testID={`${testID}-place-${i}`} />
              </View>
            ))}
            {allSeen ? <AppText variant="caption">{tx('TOPICS.dayEnd')}</AppText> : null}
          </>
        ) : null}
        {today && tab === 'together' ? (
          today.togetherUsed ? (
            <AppText variant="body" testID={`${testID}-daily-used`}>
              {tx('OPEN_TOGETHER.dailyUsed')}
            </AppText>
          ) : (
            <>
              <AppText variant="caption">{tx('OPEN_TOGETHER.guide')}</AppText>
              <AppText variant="bodyBold">{tx('OPEN_TOGETHER.pick')}</AppText>
              {today.questions.map((id, i) => (
                <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: q === id }} accessibilityLabel={questionText(id) ?? ''} onPress={() => setQ(id)} effect="none" style={({ pressed }) => [styles.pick, q === id && styles.pickOn, pressed && styles.pressed]} testID={`${testID}-together-q-${i}`}>
                  <AppText variant="body">{questionText(id)}</AppText>
                </Pressable>
              ))}
              {q ? (
                <>
                  {draftOf(q) ? <TextButton label={tx('OPEN_TOGETHER.loadDraft')} align="start" onPress={() => setAnswer(draftOf(q) ?? '')} testID={`${testID}-load-draft`} /> : null}
                  <TextField label={tx('OPEN_TOGETHER.myLabel')} value={answer} onChangeText={setAnswer} placeholder={tx('OPEN_TOGETHER.placeholder')} multiline testID={`${testID}-answer`} />
                  <Button label={tx('OPEN_TOGETHER.send')} loading={busy} onPress={() => void sendTogether()} testID={`${testID}-together-send`} />
                </>
              ) : null}
            </>
          )
        ) : null}
        {tab === 'aboutMe' ? (
          aboutStep === 'pick' ? (
            <>
              <AppText variant="caption">{tx('ABOUT_ME.guide')}</AppText>
              <AppText variant="caption">{tx('ABOUT_ME.limit')}</AppText>
              {ABOUT_CATS.map((c) => (
                <View key={c} style={if2Styles.gapSmall}>
                  <AppText variant="bodyBold">{tx(`ABOUT_ME.cat.${c}`)}</AppText>
                  {txList(`ABOUT_ME.${c}`).map((l, i) => {
                    const on = picks[c] === i;
                    const full = picks[c] === undefined && Object.keys(picks).length >= ABOUT_MAX;
                    return (
                      <Pressable
                        key={l}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: full }}
                        accessibilityLabel={l}
                        disabled={full}
                        onPress={() => setPicks((p) => (on ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== c)) : { ...p, [c]: i }))}
                        effect="none"
                        style={({ pressed }) => [styles.pick, on && styles.pickOn, full && styles.dim, pressed && styles.pressed]}
                        testID={`${testID}-about-${c}-${i}`}>
                        <AppText variant="body">{l}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <AppText variant="caption">{tx('ABOUT_ME.onceNote')}</AppText>
              <Button label={tx('ABOUT_ME.preview')} variant="secondary" onPress={() => (aboutLines.length ? (setAboutStep('preview'), setError(null)) : setError(tx('ABOUT_ME.needOne')))} testID={`${testID}-about-preview`} />
            </>
          ) : (
            <>
              <View style={if2Styles.paper} testID={`${testID}-about-card`}>
                <AppText variant="captionMedium" tone="accent">
                  {tx('ABOUT_ME.card.title')}
                </AppText>
                {aboutLines.map((l) => (
                  <AppText key={l} variant="body">
                    {l}
                  </AppText>
                ))}
              </View>
              <Button label={tx('ABOUT_ME.send')} loading={busy} onPress={() => void sendAbout()} testID={`${testID}-about-send`} />
              <TextButton label={tx('FAREWELL.pick.back')} onPress={() => setAboutStep('pick')} testID={`${testID}-about-back`} />
            </>
          )
        ) : null}
        {tab === 'pre' ? (
          preItems.length === 0 ? (
            <AppText variant="body">{tx('PRE_ANSWER.chat.empty')}</AppText>
          ) : (
            <>
              <AppText variant="caption">{tx('PRE_ANSWER.chat.giveNote')}</AppText>
              {preItems.map((x, i) => (
                <View key={x.q} style={if2Styles.paper} testID={`${testID}-pre-${i}`}>
                  <AppText variant="bodyMedium">{questionText(x.q)}</AppText>
                  <AppText variant="body">{x.text}</AppText>
                  <TextButton
                    label={tx('PRE_ANSWER.chat.give')}
                    variant="captionMedium"
                    align="start"
                    onPress={() => {
                      onGive(`${questionText(x.q) ?? ''}\n${x.text}`);
                      onClose();
                    }}
                    testID={`${testID}-give-${i}`}
                  />
                </View>
              ))}
            </>
          )
        ) : null}
        {error ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </>
  );
}

// ── 같이 열어 보는 질문 카드(F-30 · PF-54 · PF-55): 내 쪽 상태만 — 상대가 답했는지 0 ─────────────────────────
export function TogetherCard({ message, answers, roomOpen, deps, onChanged, testID }: { message: Message; answers: { mine: string | null; theirs: string | null }; roomOpen: boolean; deps: ChatIf2Deps; onChanged: () => void; testID: string }) {
  const [sheet, setSheet] = useState(false);
  const [ask, setAsk] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = message.together ?? null;
  const qText = message.ref ? (questionText(message.ref) ?? '') : '';
  const drafts = useDeviceNotes(deps.notes ?? deviceNotes()).preAnswers?.items ?? [];
  const draft = drafts.find((x) => x.q === message.ref)?.text ?? null;
  const answer = async () => {
    if (busy) return;
    if (count(text.trim()) < 1 || count(text) > ANSWER_MAX) {
      setError(tx('OPEN_TOGETHER.tooLong', { n: String(ANSWER_MAX) }));
      return;
    }
    setBusy(true);
    const r = await deps.api.togetherAnswer(message.id, text.trim());
    setBusy(false);
    if (r.ok) {
      setSheet(false);
      onChanged();
    } else setError(r.code === 'too_long' ? tx('OPEN_TOGETHER.tooLong', { n: String(ANSWER_MAX) }) : r.code === 'text_blocked' ? CHAT.send.blocked : tx('OPEN_TOGETHER.failed'));
  };
  const withdraw = async () => {
    if (busy) return;
    setBusy(true);
    const r = await deps.api.togetherWithdraw(message.id);
    setBusy(false);
    setAsk(false);
    if (r.ok) onChanged();
    else setError(r.code === 'opened' ? tx('OPEN_TOGETHER.alreadyOpened') : tx('OPEN_TOGETHER.failed'));
  };
  const line =
    t?.state === 'withdrawn'
      ? tx('OPEN_TOGETHER.withdrawn')
      : t?.state === 'closed' || (!roomOpen && t?.state !== 'opened')
        ? tx('OPEN_TOGETHER.closed')
        : t?.state === 'waiting'
          ? tx('OPEN_TOGETHER.card.mine')
          : t?.state === 'mine_needed'
            ? tx('OPEN_TOGETHER.card.theirs')
            : null;
  // 읽기 이름: 펼친 뒤 '같이 열어 보는 질문, {질문}, 내 답 {글}, 상대 답 {글}'(두 {글} 자리에 내 답 · 상대 답 차례로)
  const openedParts = tx('OPEN_TOGETHER.a11y.opened', { 질문: qText }).split('{글}');
  const a11y = t?.state === 'opened' ? `${openedParts[0] ?? ''}${answers.mine ?? ''}${openedParts[1] ?? ''}${answers.theirs ?? ''}${openedParts[2] ?? ''}` : tx('OPEN_TOGETHER.a11y.card', { 질문: qText, '카드 글': line ?? '' });
  return (
    <View style={[styles.together, message.mine ? styles.mineSide : null]} accessible accessibilityLabel={a11y} testID={testID}>
      <AppText variant="captionMedium" tone="accent">
        {t?.state === 'opened' ? tx('OPEN_TOGETHER.card.opened') : tx('OPEN_TOGETHER.card.label')}
      </AppText>
      {t?.state !== 'withdrawn' ? <AppText variant="bodyMedium">{qText}</AppText> : null}
      {line ? (
        <AppText variant="caption" testID={`${testID}-line`}>
          {line}
        </AppText>
      ) : null}
      {t?.state === 'waiting' ? <AppText variant="body">{t.myAnswer}</AppText> : null}
      {t?.state === 'opened' ? (
        <View style={if2Styles.gapSmall} testID={`${testID}-opened`}>
          <AppText variant="captionMedium">{tx('OPEN_TOGETHER.card.myAnswer')}</AppText>
          <AppText variant="body">{answers.mine ?? ''}</AppText>
          <AppText variant="captionMedium">{tx('OPEN_TOGETHER.card.partnerAnswer')}</AppText>
          <AppText variant="body">{answers.theirs ?? ''}</AppText>
        </View>
      ) : null}
      {roomOpen && t?.state === 'mine_needed' ? <Button label={tx('OPEN_TOGETHER.card.answer')} variant="secondary" onPress={() => (setText(''), setError(null), setSheet(true))} testID={`${testID}-answer`} /> : null}
      {roomOpen && t?.state === 'waiting' && t.canWithdraw ? <TextButton label={tx('OPEN_TOGETHER.withdraw')} variant="captionMedium" align="start" onPress={() => setAsk(true)} testID={`${testID}-withdraw`} /> : null}
      {error && !sheet ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <BottomSheet visible={sheet} onClose={() => !busy && setSheet(false)} testID={`${testID}-sheet`}>
        <SheetHead title={tx('OPEN_TOGETHER.card.label')} closeLabel={tx('TOPICS.close')} onClose={() => setSheet(false)} testID={`${testID}-sheet`} />
        <AppText variant="bodyMedium">{qText}</AppText>
        {draft ? <TextButton label={tx('OPEN_TOGETHER.loadDraft')} align="start" onPress={() => setText(draft)} testID={`${testID}-draft`} /> : null}
        <TextField label={tx('OPEN_TOGETHER.myLabel')} value={text} onChangeText={setText} placeholder={tx('OPEN_TOGETHER.placeholder')} multiline testID={`${testID}-input`} />
        {error ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
            {error}
          </AppText>
        ) : null}
        <Button label={tx('OPEN_TOGETHER.card.answer')} loading={busy} onPress={() => void answer()} testID={`${testID}-submit`} />
      </BottomSheet>
      <ConfirmDialog visible={ask} title={tx('OPEN_TOGETHER.withdrawTitle')} body={tx('OPEN_TOGETHER.withdrawBody')} confirmLabel={tx('OPEN_TOGETHER.withdrawConfirm')} cancelLabel={CONSENT_MANAGE.cancel} busy={busy} onConfirm={() => void withdraw()} onCancel={() => setAsk(false)} testID={`${testID}-withdraw-confirm`} />
    </View>
  );
}

// ── 안전 안내 카드(F-39 · PF-56): 받은 말풍선 바로 아래 · 나에게만 · 12 안전 안내 넷째 줄 그대로 · [신고하기] · [닫기] 같은 크기 ────
export function MoneySafetyCard({ onReport, onClose, testID = 'if2-money' }: { onReport: () => void; onClose: () => void; testID?: string }) {
  const body = SAFETY_GUIDE.lines[3];
  return (
    <View style={styles.safety} accessible accessibilityLiveRegion="polite" accessibilityLabel={tx('MONEY_SAFETY.a11y', { 본문: body })} testID={testID}>
      <AppText variant="captionMedium" tone="accent">
        {tx('MONEY_SAFETY.title')}
      </AppText>
      <AppText variant="small" testID={`${testID}-body`}>
        {body}
      </AppText>
      <AppText variant="caption">{tx('MONEY_SAFETY.note')}</AppText>
      <View style={styles.pair}>
        <View style={if2Styles.flex}>
          <Button label={tx('MONEY_SAFETY.report')} variant="secondary" onPress={onReport} testID={`${testID}-report`} />
        </View>
        <View style={if2Styles.flex}>
          <Button label={tx('MONEY_SAFETY.close')} variant="secondary" onPress={onClose} testID={`${testID}-close`} />
        </View>
      </View>
    </View>
  );
}

// ── 나가기 시트 + 작별 엽서(F-45 · PF-57) ────────────────────────────────────────────────
type FarewellProps = { visible: boolean; roomId: string; deps: ChatIf2Deps; onClose: () => void; onPlainLeave: () => void; onLeft: () => void; busyPlain: boolean; plainError: string | null; testID?: string };
export function FarewellSheet(props: FarewellProps) {
  const testID = props.testID ?? 'if2-farewell';
  return (
    <BottomSheet visible={props.visible} onClose={() => !props.busyPlain && props.onClose()} testID={testID}>
      {props.visible ? <FarewellBody {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}
function FarewellBody({ roomId, deps, onClose, onPlainLeave, onLeft, busyPlain, plainError, testID = 'if2-farewell' }: FarewellProps) {
  const lines = txList('FAREWELL.pick.lines');
  const [step, setStep] = useState<'choose' | 'pick'>('choose');
  const [pick, setPick] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = count(text) > FAREWELL_MAX || /[\r\n]/.test(text);
  const send = async () => {
    if (pick === null || busy || tooLong || text.trim() === '') return;
    setBusy(true);
    setError(null);
    const r = await deps.api.sendCard(roomId, 'farewell', text.trim(), `f${pick}`);
    setBusy(false);
    if (r.ok && r.left) {
      onLeft();
      return;
    }
    // 보내기에 실패하면 나가지 않는다(엽서만 남고 방이 열린 채 남는 일 0)
    setError(!r.ok && r.code === 'text_blocked' ? tx('FAREWELL.pick.blocked') : !r.ok && r.code === 'too_long' ? tx('FAREWELL.pick.tooLong', { n: String(FAREWELL_MAX) }) : tx('FAREWELL.failed'));
  };
  return (
    <>
      {step === 'choose' ? (
        <>
          <AppText variant="bodyBold" accessibilityRole="header">
            {CHAT.leave.title}
          </AppText>
          <AppText variant="small">{CHAT.leave.body}</AppText>
          <AppText variant="small" testID={`${testID}-body`}>
            {tx('FAREWELL.sheet.body')}
          </AppText>
          {plainError ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert">
              {plainError}
            </AppText>
          ) : null}
          <View style={styles.pair}>
            <View style={if2Styles.flex}>
              <Button label={tx('FAREWELL.sheet.withCard')} variant="secondary" onPress={() => setStep('pick')} testID={`${testID}-with-card`} />
            </View>
            <View style={if2Styles.flex}>
              <Button label={tx('FAREWELL.sheet.plain')} variant="secondary" loading={busyPlain} onPress={onPlainLeave} testID={`${testID}-plain`} />
            </View>
          </View>
          <Button label={CHAT.leave.cancel} variant="text" onPress={onClose} testID={`${testID}-cancel`} />
        </>
      ) : (
        <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
          <AppText variant="bodyBold" accessibilityRole="header">
            {tx('FAREWELL.pick.title')}
          </AppText>
          {lines.map((l, i) => (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: pick === i }}
              accessibilityLabel={tx('FAREWELL.a11y.line', { 글: l })}
              onPress={() => {
                setPick(i);
                setText(l);
                setError(null);
              }}
              effect="none"
              style={({ pressed }) => [styles.pick, pick === i && styles.pickOn, pressed && styles.pressed]}
              testID={`${testID}-line-${i}`}>
              <AppText variant="body">{l}</AppText>
            </Pressable>
          ))}
          {pick !== null ? (
            <TextField label={tx('FAREWELL.pick.edit')} value={text} onChangeText={setText} placeholder={tx('FAREWELL.pick.editPlaceholder')} error={tooLong ? tx('FAREWELL.pick.tooLong', { n: String(FAREWELL_MAX) }) : null} testID={`${testID}-edit`} />
          ) : null}
          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
              {error}
            </AppText>
          ) : null}
          <Button label={tx('FAREWELL.pick.confirm')} dimmed={pick === null || tooLong || text.trim() === ''} loading={busy} onPress={() => void send()} testID={`${testID}-send`} />
          <TextButton label={tx('FAREWELL.pick.back')} onPress={() => !busy && setStep('choose')} testID={`${testID}-back`} />
        </ScrollView>
      )}
    </>
  );
}

// 꼬리표 글 머리(말풍선 위 작은 글 — 두 사람 같은 글)
export function tagLabel(m: Message): string | null {
  switch (m.tag) {
    case 'postcard':
      return tx('HELLO_POSTCARD.bubble.label');
    case 'topic':
      return tx('TOPICS.bubble.label');
    case 'about_me':
      return tx('ABOUT_ME.card.title');
    case 'farewell':
      return tx('FAREWELL.bubble.label');
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  chips: { gap: space.s4, paddingHorizontal: space.s12, paddingTop: space.s8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  chipRow: { gap: space.s8, paddingVertical: space.s4 },
  pair: { flexDirection: 'row', gap: space.s8 },
  sheetScroll: { maxHeight: size.touchMin * 11 },
  pick: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s16, paddingVertical: space.s12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  pickOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  dim: { opacity: alpha.disabled },
  pressed: { opacity: alpha.pressed },
  together: { marginHorizontal: size.screenPadding, padding: space.s16, gap: space.s8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  mineSide: { borderColor: colors.accentSoft },
  safety: { marginHorizontal: size.screenPadding, padding: space.s16, gap: space.s8, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
});
