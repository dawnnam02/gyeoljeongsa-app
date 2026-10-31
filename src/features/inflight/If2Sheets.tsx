// 기내 서비스 · 연애 기능 시트(IF2-F · 화면_요구사항 IF 화면): IF-CK17 · IF-HELLO 쓰기 · IF-PRE · IF-PAIR · IF-TALK · IF-PREP · IF-MEMO.
//  · 나만 쓰는 글 · 표시는 기기에만(deviceNotes — SecureStore · 웹은 메모리) · 서버 0 · 로그 0
//  · 숫자 · 개수 · '아직' · 판정 0(PF-02 · PF-03) · 쪽 · 카드마다 끝줄(PF-04) · 글은 IF2 글(tx · 카피 21장)과 기존 키(12 안전 안내 · 만남 계획 공유)만
//  · 궁합 카드 시트는 캡처 막기 대상(P6-11 · IFF-15 — 12 보안 '상대 화면 캡처 차단'이 켜져 있을 때) · 상대 이름 · 사진 · 나이 · 별자리 이름 · 일간 · 띠 0(IFF-01)
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FullSheet } from '@/components/FullSheet';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { SAFETY_GUIDE } from '@/content/copy';
import { BOARDING } from '@/features/boarding/boardingCopy';
import { CONSENT_MANAGE } from '@/content/settingsCopy';
import { useCaptureBlock } from '@/lib/captureBlock';
import { alpha, colors, radius, size, space } from '@/theme/tokens';

import { CK17 } from '@/content/ck17Content';
import { deviceNotes, MEMO_LEN, POSTCARD_EXTRA_LEN, PRE_ANSWER_LEN, PRE_ANSWER_MAX, useDeviceNotes, type DeviceNotes } from './deviceNotes';
import type { InflightApi, PairCard, PreQuestions } from './inflightApi';
import { compatText, questionText, questionsOfDepth, sameLines } from './if2Library';
import { kstDateText, MEMO_KEEP_MS } from './inflightLogic';
import { Footnote, if2Styles, MarkButton, SheetHead } from './If2Parts';
import { tx, txList } from './if2Text';

const count = (t: string) => Array.from(t).length;

// ── IF-CK17 재미 정보 동의 시트(정책 PF-16 · 동의문구 4-17) ───────────────────────────
//  체크 두 줄 · 미리 체크 0 · B 는 A 를 고른 뒤에만 · A 를 풀면 B 도 풀림 · [이어 가기]는 아무것도 안 골라도 눌림(거부 기록) · 권유 말 0
type Ck17Props = { visible: boolean; initial?: { a: boolean; b: boolean }; onClose: () => void; onSave: (a: boolean, b: boolean) => Promise<boolean>; testID?: string };
export function Ck17Sheet(props: Ck17Props) {
  const testID = props.testID ?? 'if2-ck17';
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <Ck17Body {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}
// QP-48(대비 4.5+): 누를 수 없는 칸(①에 동의해야 고를 수 있어요)을 투명도로 흐리지 않는다 — 글은 sub 색(왜 못 고르는지 알리는 글이라 읽혀야 한다). Pressable 의 자동 흐림도 끈다(offLook own)
function CheckRow({ on, label, why, note, disabled, onPress, testID }: { on: boolean; label: string; why: string; note?: string; disabled?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!disabled }} aria-checked={on} accessibilityLabel={label} disabled={disabled} offLook="own" onPress={onPress} effect="none" style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]} testID={testID}>
      <CheckBox checked={on} />
      <View style={if2Styles.flex}>
        <AppText variant="body" tone={disabled ? 'sub' : 'text'}>
          {label}
        </AppText>
        <AppText variant="caption">{why}</AppText>
        {note ? <AppText variant="caption">{note}</AppText> : null}
      </View>
    </Pressable>
  );
}
function Ck17Body({ initial, onClose, onSave, testID = 'if2-ck17' }: Ck17Props) {
  const [a, setA] = useState(initial?.a ?? false); // 미리 체크 0 — 이미 켠 칸만 그대로
  const [b, setB] = useState(initial?.b ?? false);
  const [more, setMore] = useState<'none' | 'summary' | 'full'>('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const go = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    const ok = await onSave(a, a && b);
    setBusy(false);
    if (!ok) setError(true);
  };
  const toggleA = () => {
    if (a) setB(false); // A 를 풀면 B 도 풀림
    setA(!a);
  };
  return (
    <>
      <SheetHead title={CK17.title} closeLabel={CK17.close} onClose={() => (busy ? undefined : onClose())} testID={testID} />
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
        <AppText variant="body" testID={`${testID}-lead`}>
          {CK17.lead}
        </AppText>
        <CheckRow on={a} label={CK17.checkA} why={CK17.whyA} onPress={toggleA} testID={`${testID}-a`} />
        <CheckRow on={b} label={CK17.checkB} why={CK17.whyB} note={CK17.noteB} disabled={!a} onPress={() => setB(!b)} testID={`${testID}-b`} />
        <TextButton label={more === 'full' ? CK17.fullOpen : CK17.summaryOpen} align="start" onPress={() => setMore(more === 'none' ? 'summary' : 'full')} testID={`${testID}-more`} />
        {more !== 'none' ? (
          <View style={if2Styles.gapSmall} testID={`${testID}-summary`}>
            {CK17.summary.map((l) => (
              <AppText key={l} variant="caption" tone="text">
                {l}
              </AppText>
            ))}
            {more === 'summary' ? <TextButton label={CK17.fullOpen} align="start" onPress={() => setMore('full')} testID={`${testID}-full-open`} /> : null}
          </View>
        ) : null}
        {more === 'full' ? (
          <View style={if2Styles.gapSmall} testID={`${testID}-full`}>
            <AppText variant="bodyBold">{CK17.fullTitle}</AppText>
            {CK17.full.map((l) => (
              <AppText key={l} variant="caption" tone="text">
                {l}
              </AppText>
            ))}
          </View>
        ) : null}
        {error ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
            {CONSENT_MANAGE.saveFailed}
          </AppText>
        ) : null}
        <Button label={CK17.go} loading={busy} onPress={() => void go()} testID={`${testID}-go`} />
      </ScrollView>
    </>
  );
}

// ── IF-HELLO 쓰기 시트(PF-37): 첫 인사 문장 6 가운데 하나 + 더할 한 줄 60 · 기기에만 · 착륙 준비부터 고치기 0 ───────
type HelloProps = { visible: boolean; round: number; writable: boolean; onClose: () => void; onToast: (t: string) => void; notes?: DeviceNotes; testID?: string };
export function HelloWriteSheet(props: HelloProps) {
  const testID = props.testID ?? 'if2-hello';
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <HelloWriteBody {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}
function HelloWriteBody({ round, writable, onClose, onToast, notes = deviceNotes(), testID = 'if2-hello' }: HelloProps) {
  const saved = useDeviceNotes(notes).postcard;
  const lines = txList('HELLO_POSTCARD.write.lines');
  const mine = saved && saved.round === round ? saved : null;
  const [line, setLine] = useState<number | null>(mine ? mine.line : null);
  const [extra, setExtra] = useState(mine ? mine.extra : '');
  const tooLong = count(extra) > POSTCARD_EXTRA_LEN;
  const save = () => {
    if (line === null || tooLong) return;
    try {
      notes.set('postcard', { round, line, extra: extra.trim(), at: Date.now() });
      onToast(tx('HELLO_POSTCARD.write.saved'));
      onClose();
    } catch {
      onToast(tx('HELLO_POSTCARD.write.saveFailed'));
    }
  };
  const has = !!mine;
  return (
    <>
      <SheetHead title={tx('HELLO_POSTCARD.write.title')} closeLabel={tx('PAIR_CARD.close')} onClose={onClose} testID={testID} />
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
        {writable ? (
          <AppText variant="body">{tx('HELLO_POSTCARD.write.guide')}</AppText>
        ) : (
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-landing`}>
            {tx('HELLO_POSTCARD.write.landing')}
          </AppText>
        )}
        <View style={if2Styles.gapSmall}>
          {lines.map((l, i) => (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: line === i, disabled: !writable }}
              aria-checked={line === i}
              accessibilityLabel={tx('HELLO_POSTCARD.a11y.line', { 문장: l })}
              disabled={!writable}
              onPress={() => setLine(i)}
              effect="none"
              style={({ pressed }) => [styles.pick, line === i && styles.pickOn, pressed && styles.pressed]}
              testID={`${testID}-line-${i}`}>
              <AppText variant="body">{l}</AppText>
            </Pressable>
          ))}
        </View>
        <TextField label={tx('HELLO_POSTCARD.write.extraLabel')} value={extra} onChangeText={setExtra} placeholder={tx('HELLO_POSTCARD.write.extraPlaceholder')} disabled={!writable} error={tooLong ? tx('HELLO_POSTCARD.write.tooLong', { n: String(POSTCARD_EXTRA_LEN) }) : null} testID={`${testID}-extra`} />
        <AppText variant="caption" testID={`${testID}-note`}>
          {tx('HELLO_POSTCARD.write.note')}
        </AppText>
        {writable ? <Button label={tx('HELLO_POSTCARD.write.save')} dimmed={line === null || tooLong} onPress={save} testID={`${testID}-save`} /> : null}
        {writable && has ? (
          <TextButton
            label={tx('HELLO_POSTCARD.write.delete')}
            onPress={() => {
              notes.set('postcard', null);
              onToast(tx('HELLO_POSTCARD.write.deleted'));
              onClose();
            }}
            testID={`${testID}-delete`}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

// ── IF-PRE 미리 답해 두기(PF-36): 그 회차 질문 20 · 답 10까지 · 200자 · 적은 날짜만 · 기기에만 · 착륙 준비부터 보기만 ─────
type PreProps = { visible: boolean; round: number; api: Pick<InflightApi, 'preQuestions'>; onClose: () => void; onToast: (t: string) => void; notes?: DeviceNotes; testID?: string };
export function PreAnswerSheet(props: PreProps) {
  const testID = props.testID ?? 'if2-pre';
  return (
    <FullSheet visible={props.visible} title={tx('PRE_ANSWER.title')} onClose={props.onClose} testID={testID}>
      {props.visible ? <PreAnswerBody {...props} testID={testID} /> : null}
    </FullSheet>
  );
}
function PreAnswerBody({ round, api, onToast, notes = deviceNotes(), testID = 'if2-pre' }: PreProps) {
  const n = useDeviceNotes(notes);
  const [q, setQ] = useState<PreQuestions | null>(null);
  const [failed, setFailed] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    void api.preQuestions().then((r) => (r.ok ? setQ(r.data) : setFailed(true)));
  }, [api]);
  const items = n.preAnswers && n.preAnswers.round === round ? n.preAnswers.items : [];
  const writable = q?.state === 'open';
  const answerOf = (id: string) => items.find((x) => x.q === id) ?? null;
  const full = items.length >= PRE_ANSWER_MAX;
  const tooLong = count(draft) > PRE_ANSWER_LEN;
  const save = () => {
    if (!edit || tooLong || draft.trim() === '') return;
    try {
      const rest = items.filter((x) => x.q !== edit);
      notes.set('preAnswers', { round, items: [...rest, { q: edit, text: draft.trim(), at: Date.now() }] });
      onToast(tx('PRE_ANSWER.saved'));
      setEdit(null);
    } catch {
      onToast(tx('PRE_ANSWER.saveFailed'));
    }
  };
  const remove = (id: string) => notes.set('preAnswers', { round, items: items.filter((x) => x.q !== id) });
  return (
    <>
      <ScrollView contentContainerStyle={styles.fullBody}>
        <AppText variant="body" testID={`${testID}-note`}>
          {tx('PRE_ANSWER.note')}
        </AppText>
        <AppText variant="caption">{tx('PRE_ANSWER.expiry')}</AppText>
        {q?.state === 'landing' ? (
          <AppText variant="captionMedium" tone="accent" testID={`${testID}-landing`}>
            {tx('PRE_ANSWER.landing')}
          </AppText>
        ) : null}
        {failed ? (
          <AppText variant="body" tone="sub" accessibilityRole="alert" testID={`${testID}-failed`}>
            {tx('PRE_ANSWER.loadFailed')}
          </AppText>
        ) : null}
        {items.length === 0 && q ? (
          <AppText variant="caption" testID={`${testID}-empty`}>
            {tx('PRE_ANSWER.empty')}
          </AppText>
        ) : null}
        {full && writable ? (
          <AppText variant="caption" testID={`${testID}-full`}>
            {tx('PRE_ANSWER.full')}
          </AppText>
        ) : null}
        {(q?.questions ?? []).map((id, i) => {
          const text = questionText(id);
          if (!text) return null;
          const a = answerOf(id);
          const editing = edit === id;
          return (
            <View key={id} style={if2Styles.paper} testID={`${testID}-q-${i}`}>
              <AppText variant="bodyMedium" accessibilityLabel={a ? tx('PRE_ANSWER.a11y.item', { 질문: text, 글: a.text, 날짜: kstDateText(a.at) }) : text}>
                {text}
              </AppText>
              {a && !editing ? (
                <>
                  <AppText variant="body">{a.text}</AppText>
                  <AppText variant="caption">{tx('PRE_ANSWER.writtenAt', { 날짜: kstDateText(a.at) })}</AppText>
                </>
              ) : null}
              {editing ? (
                <>
                  <TextField label={text} value={draft} onChangeText={setDraft} placeholder={tx('PRE_ANSWER.placeholder')} multiline error={tooLong ? tx('PRE_ANSWER.tooLong', { n: String(PRE_ANSWER_LEN) }) : null} testID={`${testID}-input`} />
                  <Button label={tx('PRE_ANSWER.save')} dimmed={tooLong || draft.trim() === ''} onPress={save} testID={`${testID}-save`} />
                </>
              ) : null}
              {writable && !editing ? (
                <View style={if2Styles.row}>
                  {a || !full ? (
                    <TextButton
                      label={tx('PRE_ANSWER.home.open')}
                      variant="captionMedium"
                      onPress={() => {
                        setEdit(id);
                        setDraft(a?.text ?? '');
                      }}
                      testID={`${testID}-write-${i}`}
                    />
                  ) : null}
                  {a ? <TextButton label={tx('PRE_ANSWER.delete')} variant="captionMedium" onPress={() => remove(id)} testID={`${testID}-delete-${i}`} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

// ── IF-PAIR 궁합 카드(PF-42 ~ PF-46): ① 두 분 다 ② 사주로 보면 ③ 별자리로 보면 · 서버가 공개 때 만든 한 장을 읽기만 ──────
// extra: 카드 맨 아래(끝줄 위)에 더하는 칸 — AIT-F 궁합 카드 AI판(데모 판에서만 넘어온다). 카드를 받은 뒤에만 그린다
type PairExtra = { extra?: (card: PairCard) => ReactNode };
export function PairCardSheet(props: PairExtra & { visible: boolean; roomId: string; api: Pick<InflightApi, 'pairCard'>; overlap: boolean; onClose: () => void; onChat: () => void; onTalk: () => void; onCk17: () => void; testID?: string }) {
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={props.testID ?? 'if2-pair'}>
      {props.visible ? <PairCardBody {...props} /> : null}
    </BottomSheet>
  );
}
function PairCardBody({ roomId, api, overlap, onClose, onChat, onTalk, onCk17, extra, testID = 'if2-pair' }: PairExtra & { roomId: string; api: Pick<InflightApi, 'pairCard'>; overlap: boolean; onClose: () => void; onChat: () => void; onTalk: () => void; onCk17: () => void; testID?: string }) {
  useCaptureBlock(); // 시트가 열린 동안만(12 보안 '상대 화면 캡처 차단'이 켜져 있을 때 · 웹은 없음)
  const [card, setCard] = useState<PairCard | 'loading' | 'failed' | 'gone'>('loading');
  const fetchCard = useCallback(() => {
    void api.pairCard(roomId).then((r) => setCard(r.ok ? r.data : r.code === 'not_found' || r.code === 'off' ? 'gone' : 'failed'));
  }, [api, roomId]);
  useEffect(fetchCard, [fetchCard]);
  const load = () => {
    setCard('loading');
    fetchCard();
  };
  const same = typeof card === 'object' ? sameLines(card.same) : [];
  const saju = typeof card === 'object' && card.saju ? compatText(card.saju) : null;
  const star = typeof card === 'object' && card.star ? compatText(card.star) : null;
  const heads = [same.length > 0 ? tx('PAIR_CARD.same.title') : null, saju ? tx('PAIR_CARD.saju.title') : null, star ? tx('PAIR_CARD.star.title') : null].filter((x): x is string => !!x);
  return (
    <>
      <SheetHead title={tx('PAIR_CARD.title')} closeLabel={tx('PAIR_CARD.close')} onClose={onClose} testID={testID} />
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap} accessibilityLabel={tx('PAIR_CARD.a11y.sheet', { '펼친 칸 머리 차례': heads.join(', ') })}>
        {card === 'loading' ? <AppText variant="caption">{tx('PAIR_CARD.lead')}</AppText> : null}
        {card === 'failed' ? (
          <View style={if2Styles.gapSmall} testID={`${testID}-failed`}>
            <AppText variant="body" tone="sub" accessibilityRole="alert">
              {tx('PAIR_CARD.loadFailed')}
            </AppText>
            <Button label={BOARDING.retry} variant="secondary" onPress={load} testID={`${testID}-retry`} />
          </View>
        ) : null}
        {card === 'gone' ? (
          <AppText variant="body" testID={`${testID}-gone`}>
            {tx('PAIR_CARD.gone')}
          </AppText>
        ) : null}
        {typeof card === 'object' ? (
          <>
            <AppText variant="body" testID={`${testID}-lead`}>
              {tx('PAIR_CARD.lead')}
            </AppText>
            {same.length > 0 ? (
              <View style={if2Styles.paper} accessible accessibilityLabel={tx('PAIR_CARD.a11y.same', { '같은 점': same.join(', ') })} testID={`${testID}-same`}>
                <AppText variant="bodyBold">{tx('PAIR_CARD.same.title')}</AppText>
                {same.map((line, i) => (
                  <AppText key={line} variant="body" testID={i === 0 ? `${testID}-same-line` : `${testID}-same-line-${i}`}>
                    {line}
                  </AppText>
                ))}
              </View>
            ) : null}
            {saju ? (
              <View style={if2Styles.paper} testID={`${testID}-saju`}>
                <AppText variant="bodyBold">{tx('PAIR_CARD.saju.title')}</AppText>
                <AppText variant="body">{saju}</AppText>
              </View>
            ) : null}
            {star ? (
              <View style={if2Styles.paper} accessible accessibilityLabel={tx('PAIR_CARD.a11y.star', { '원소 관계 문장': star })} testID={`${testID}-star`}>
                <AppText variant="bodyBold">{tx('PAIR_CARD.star.title')}</AppText>
                <AppText variant="body">{star}</AppText>
              </View>
            ) : null}
            {!saju && !card.ck17Mine ? (
              <View style={if2Styles.gapSmall} testID={`${testID}-mine-off`}>
                <AppText variant="caption">{tx('PAIR_CARD.ck17.mineOff')}</AppText>
                <TextButton label={tx('PAIR_CARD.ck17.link')} align="start" onPress={onCk17} testID={`${testID}-ck17`} />
              </View>
            ) : null}
            <AppText variant="caption">{tx('PAIR_CARD.topics.note')}</AppText>
            <Button label={tx('PAIR_CARD.topics.go')} variant="secondary" onPress={onChat} testID={`${testID}-chat`} />
            {overlap ? <TextButton label={tx('PAIR_CARD.talkLink')} align="start" onPress={onTalk} testID={`${testID}-talk`} /> : null}
            {extra ? extra(card) : null}
            <Footnote text={tx('PAIR_CARD.footer')} testID={`${testID}-footer`} />
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

// ── IF-TALK 꼭 나눌 이야기(PF-47): 일곱 주제 · 꺼내는 말 · 나만 표시(기기 · 개수 0) · [꺼내는 말 가져가기] → 그 방 입력창 ─────
export function MustTalkSheet({ visible, roomId, onClose, onUseOpener, notes = deviceNotes(), testID = 'if2-talk' }: { visible: boolean; roomId: string; onClose: () => void; onUseOpener: (text: string) => void; notes?: DeviceNotes; testID?: string }) {
  const n = useDeviceNotes(notes);
  const topics = txList('MUST_TALK.topic');
  const openers = txList('MUST_TALK.opener');
  const marked = n.mustTalk[roomId] ?? [];
  const toggle = (i: number) => notes.set('mustTalk', { ...n.mustTalk, [roomId]: marked.includes(i) ? marked.filter((x) => x !== i) : [...marked, i] });
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <SheetHead title={tx('MUST_TALK.title')} closeLabel={tx('MUST_TALK.close')} onClose={onClose} testID={testID} />
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
        <AppText variant="body">{tx('MUST_TALK.guide')}</AppText>
        {topics.map((t, i) => (
          <View key={t} style={if2Styles.paper} testID={`${testID}-topic-${i}`}>
            <AppText variant="bodyBold">{t}</AppText>
            <AppText variant="body">{openers[i]}</AppText>
            <View style={if2Styles.wrapRow}>
              <MarkButton label={tx('MUST_TALK.check')} a11y={tx('MUST_TALK.checkA11y', { 주제: t })} on={marked.includes(i)} onPress={() => toggle(i)} testID={`${testID}-mark-${i}`} />
              <TextButton label={tx('MUST_TALK.useOpener')} variant="captionMedium" onPress={() => onUseOpener(openers[i] ?? '')} testID={`${testID}-use-${i}`} />
            </View>
          </View>
        ))}
        <Footnote text={tx('MUST_TALK.note')} testID={`${testID}-note`} />
      </ScrollView>
    </BottomSheet>
  );
}

// ── IF-PREP 첫 만남 준비(PF-71): 12 안전 안내 1 ~ 6줄 원문(같은 키) · 만남 계획 공유(safe_share) · 꺼내 볼 이야기 2 · 마음 챙기기 2 · 이런 만남 3 ─────
export function MeetPrepSheet({ visible, roomId, shareOn, onClose, onShare, onGuide, notes = deviceNotes(), testID = 'if2-prep' }: { visible: boolean; roomId: string; shareOn: boolean; onClose: () => void; onShare: () => void; onGuide: () => void; notes?: DeviceNotes; testID?: string }) {
  const n = useDeviceNotes(notes);
  const marked = n.meetPrep[roomId] ?? [];
  const toggle = (k: string) => notes.set('meetPrep', { ...n.meetPrep, [roomId]: marked.includes(k) ? marked.filter((x) => x !== k) : [...marked, k] });
  // 꺼내 볼 이야기 2 = 이야깃거리 '가볍게' · '취향' 질문을 방마다 하나씩(방 id 로 고정 — 모든 짝에게 같은 차례 규칙)
  const talks = useMemo(() => {
    const h = [...roomId].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    return (['light', 'taste'] as const).map((d) => {
      const ids = questionsOfDepth(d);
      return ids.length ? questionText(ids[h % ids.length]) : null;
    }).filter((x): x is string => !!x);
  }, [roomId]);
  const check = (k: string, line: string, i: number) => <MarkButton label={tx('MEET_PREP.check')} a11y={tx('MEET_PREP.checkA11y', { 줄: line })} on={marked.includes(k)} onPress={() => toggle(k)} testID={`${testID}-mark-${k}-${i}`} />;
  return (
    <BottomSheet visible={visible} onClose={onClose} testID={testID}>
      <SheetHead title={tx('MEET_PREP.title')} closeLabel={tx('MEET_PREP.close')} onClose={onClose} testID={testID} />
      <ScrollView style={styles.sheetScroll} contentContainerStyle={if2Styles.gap}>
        <AppText variant="bodyBold">{tx('MEET_PREP.safety.title')}</AppText>
        {SAFETY_GUIDE.lines.map((l, i) => (
          <View key={l} style={if2Styles.gapSmall} testID={`${testID}-safety-${i}`}>
            <AppText variant="body">{l}</AppText>
            {check('s', l, i)}
          </View>
        ))}
        {shareOn ? <Button label={SAFE_SHARE_ENTRY} variant="secondary" onPress={onShare} testID={`${testID}-share`} /> : null}
        <TextButton label={tx('MEET_PREP.guideAll')} align="start" onPress={onGuide} testID={`${testID}-guide`} />
        <View style={if2Styles.section}>
          <AppText variant="bodyBold">{tx('MEET_PREP.talk.title')}</AppText>
          {talks.map((t) => (
            <AppText key={t} variant="body">
              {t}
            </AppText>
          ))}
        </View>
        <View style={if2Styles.section}>
          <AppText variant="bodyBold">{tx('MEET_PREP.mind.title')}</AppText>
          {txList('MEET_PREP.mind').map((l, i) => (
            <View key={l} style={if2Styles.gapSmall}>
              <AppText variant="body">{l}</AppText>
              {check('m', l, i)}
            </View>
          ))}
        </View>
        <View style={if2Styles.section}>
          <AppText variant="bodyBold">{tx('MEET_PREP.place.title')}</AppText>
          {txList('MEET_PREP.place').map((l) => (
            <AppText key={l} variant="body">
              {l}
            </AppText>
          ))}
        </View>
        <Footnote text={tx('MEET_PREP.checkNote')} />
      </ScrollView>
    </BottomSheet>
  );
}
// 만남 계획 공유 바로가기 글 = 카피 v4 절 `SAFE_SHARE.entry`(21-13 '새 글 0 · 바로가기')
export const SAFE_SHARE_ENTRY = '만남 계획 공유';

// ── IF-MEMO 돌아보기 메모(PF-72): 질문 틀 3 · 칸마다 100자 · 기기에만 · 방이 닫힌 날 + 30일 ─────────────────
type MemoProps = { visible: boolean; roomId: string; closedAt: number | null; onClose: () => void; onToast: (t: string) => void; notes?: DeviceNotes; testID?: string };
export function MemoSheet(props: MemoProps) {
  const testID = props.testID ?? 'if2-memo';
  return (
    <FullSheet visible={props.visible} title={tx('MEET_MEMO.title')} onClose={props.onClose} testID={testID}>
      {props.visible ? <MemoBody {...props} testID={testID} /> : null}
    </FullSheet>
  );
}
function MemoBody({ roomId, closedAt, onClose, onToast, notes = deviceNotes(), testID = 'if2-memo' }: MemoProps) {
  const n = useDeviceNotes(notes);
  const prompts = txList('MEET_MEMO.prompt');
  const memo = n.memos[roomId] ?? null;
  const [texts, setTexts] = useState<string[]>(() => prompts.map((_, i) => memo?.texts[i] ?? ''));
  const [ask, setAsk] = useState(false);
  const tooLong = texts.some((t) => count(t) > MEMO_LEN);
  const closed = closedAt ?? memo?.closedAt ?? null;
  const save = () => {
    if (tooLong) return;
    try {
      notes.set('memos', { ...n.memos, [roomId]: { room: roomId, texts: texts.map((t) => t.trim()), at: Date.now(), closedAt: closed } });
      onToast(tx('MEET_MEMO.saved'));
      onClose();
    } catch {
      onToast(tx('MEET_MEMO.saveFailed'));
    }
  };
  return (
    <>
      <ScrollView contentContainerStyle={styles.fullBody}>
        <AppText variant="caption" testID={`${testID}-hint`}>
          {tx('MEET_MEMO.nameHint')}
        </AppText>
        {closed !== null ? (
          <AppText variant="caption" testID={`${testID}-expiry`}>
            {tx('MEET_MEMO.expiry', { 날짜: kstDateText(closed + MEMO_KEEP_MS) })}
          </AppText>
        ) : null}
        {prompts.map((p, i) => (
          <TextField
            key={p}
            label={p}
            value={texts[i] ?? ''}
            onChangeText={(v) => setTexts((cur) => cur.map((x, j) => (j === i ? v : x)))}
            placeholder={tx('MEET_MEMO.placeholder')}
            multiline
            error={count(texts[i] ?? '') > MEMO_LEN ? tx('MEET_MEMO.tooLong', { n: String(MEMO_LEN) }) : null}
            testID={`${testID}-field-${i}`}
          />
        ))}
        <Button label={tx('MEET_MEMO.save')} dimmed={tooLong} onPress={save} testID={`${testID}-save`} />
        {memo ? <TextButton label={tx('MEET_MEMO.delete')} onPress={() => setAsk(true)} testID={`${testID}-delete`} /> : null}
        <Footnote text={tx('MEET_MEMO.note')} testID={`${testID}-note`} />
      </ScrollView>
      <ConfirmDialog
        visible={ask}
        title={tx('MEET_MEMO.deleteTitle')}
        body={tx('MEET_MEMO.deleteBody')}
        confirmLabel={tx('MEET_MEMO.deleteConfirm')}
        cancelLabel={CONSENT_MANAGE.cancel}
        onConfirm={() => {
          const rest = { ...n.memos };
          delete rest[roomId];
          notes.set('memos', rest);
          setAsk(false);
          onToast(tx('MEET_MEMO.deleted'));
          onClose();
        }}
        onCancel={() => setAsk(false)}
        testID={`${testID}-delete-confirm`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetScroll: { maxHeight: size.touchMin * 12 },
  fullBody: { gap: space.s12, padding: size.screenPadding },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12, minHeight: size.touchMin, paddingVertical: space.s8 },
  pressed: { opacity: alpha.pressed },
  pick: { minHeight: size.touchMin, justifyContent: 'center', paddingHorizontal: space.s16, paddingVertical: space.s12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  pickOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
