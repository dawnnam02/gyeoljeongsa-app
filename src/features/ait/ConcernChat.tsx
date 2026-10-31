// 연애 고민 정리 = 챗봇(AIT-F ⑥ · 카피 23-4 `CONCERN` · 23-5 `CONCERN_CARD`) — 홈 B6 셋째 칸에서 여는 전체 시트.
//  첫 화면(안내) → 입력 칸 둘(내 상황 / 상대가 보낸 말) + 상대 호칭 칸 → 다섯 단계 → 끝 화면('충분해요'로 끝 · 턴 상한 0 · 남은 횟수 숫자 0).
//  · 위기 · 폭력 · 거절 · 미성년은 서버가 AI를 부르기 전에 고정 카드를 준다 — 앱은 카드 id 로 카피 23-5 줄을 그대로 보인다. 그 턴의 글은 말풍선에 남기지 않는다(이력 0)
//  · 근거 없는 문장은 서버가 이미 걸렀다 — 앱은 받은 근거 번호를 눌러 열어 볼 수 있게만 한다. 진단 라벨 0 · 상대 정보 자동 첨부 0(보낼 수 있는 것은 이 화면 입력 칸의 글뿐)
//  · 서명 묶음(bundle)은 열어 보지 않고 그대로 돌려보낸다. 화면 상태로만 들고, 닫으면 사라진다(저장 0 · 복사 · 공유 단추 0)
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FullSheet } from '@/components/FullSheet';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { A11Y } from '@/content/copy';
import { colors, radius, space } from '@/theme/tokens';

import { AitAiLabel, AitCardView, AitConsentSheet, AitError, AitHead, AitLoading, AitNoCode, AitPaper, AitPrivacyLines, cardKind, isErrorCode, type AitErrorCode, type CardKind } from './AitParts';
import { AIT_REST_AFTER_ANSWERS } from './aitConfig';
import { postAit } from './aitClient';
import { localPrecheckCard } from './localPrecheck';
import { aitStore, hasConsent } from './aitStore';
import { ait, type AitKey } from './aitText';
import { parseChatDisplay, type AitChatDisplay, type AitRef, type AitSentence } from './aitTypes';

export const ASKER_MAX = 600;
export const PARTNER_MAX = 800;
export const ALIAS_MAX = 20;

type Item = { t: 'me'; text: string } | { t: 'partner'; text: string } | { t: 'ai'; d: AitChatDisplay } | { t: 'card'; kind: CardKind; options: ('continue' | 'end')[] };

const KIND_KEY: Readonly<Record<string, AitKey>> = {
  problem_line: 'CONCERN.kind.problem_line',
  summary: 'CONCERN.kind.summary',
  trait: 'CONCERN.kind.trait',
  reason: 'CONCERN.kind.reason',
  counter: 'CONCERN.kind.counter',
  check: 'CONCERN.kind.check',
  direction: 'CONCERN.kind.direction',
  because: 'CONCERN.kind.because',
  option: 'CONCERN.kind.option',
  first_action: 'CONCERN.kind.first_action',
  change_if: 'CONCERN.kind.change_if',
  question: 'CONCERN.kind.question',
};
const CHIP_KEYS: Readonly<Record<string, AitKey>> = {
  stage_before: 'CONCERN.chip.stage_before',
  stage_chat: 'CONCERN.chip.stage_chat',
  stage_after: 'CONCERN.chip.stage_after',
  stage_other: 'CONCERN.chip.stage_other',
  problem_yes: 'CONCERN.chip.problem_yes',
  problem_edit: 'CONCERN.chip.problem_edit',
  unknown: 'CONCERN.chip.unknown',
  react_yes: 'CONCERN.chip.react_yes',
  react_some: 'CONCERN.chip.react_some',
  react_no: 'CONCERN.chip.react_no',
  state_1: 'CONCERN.chip.state_1',
  state_2: 'CONCERN.chip.state_2',
  state_3: 'CONCERN.chip.state_3',
  state_4: 'CONCERN.chip.state_4',
  enough: 'CONCERN.chip.enough',
  skip: 'CONCERN.chip.skip',
};
const STAGE_KEYS: Readonly<Record<string, readonly [AitKey, AitKey]>> = {
  S1: ['CONCERN.stage.s1.name', 'CONCERN.stage.s1.line'],
  S2: ['CONCERN.stage.s2.name', 'CONCERN.stage.s2.line'],
  S3: ['CONCERN.stage.s3.name', 'CONCERN.stage.s3.line'],
  S4: ['CONCERN.stage.s4.name', 'CONCERN.stage.s4.line'],
  S5: ['CONCERN.stage.s5.name', 'CONCERN.stage.s5.line'],
};

/** 서버가 붙인 고정 줄(notes) 가운데 앱이 아는 것만 카피 23장 글로 바꿔 보인다. 모르는 줄은 보이지 않는다 */
export function noteKeys(notes: readonly string[]): AitKey[] {
  const out: AitKey[] = [];
  for (const n of notes) {
    if (n.startsWith('AI의 추측이에요')) out.push('CONCERN.guessNote');
    else if (n.startsWith('돈을 보내 달라는')) out.push('CONCERN.money');
    else if (n.startsWith('이 설명은 일반적인')) out.push('CONCERN.cardNote');
  }
  return out;
}

const len = (s: string) => Array.from(s).length;

export function ConcernChat({ visible, onClose, onSettings, testID = 'concern' }: { visible: boolean; onClose: () => void; onSettings: () => void; testID?: string }) {
  return (
    <FullSheet visible={visible} title={ait('CONCERN.name')} onClose={onClose} testID={testID}>
      {visible ? <ChatBody onClose={onClose} onSettings={onSettings} testID={testID} /> : null}
    </FullSheet>
  );
}

function ChatBody({ onClose, onSettings, testID }: { onClose: () => void; onSettings: () => void; testID: string }) {
  const [view, setView] = useState<'intro' | 'chat' | 'end'>('intro');
  const [items, setItems] = useState<Item[]>([]);
  const [bundle, setBundle] = useState<unknown>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [stage, setStage] = useState<string>('S1');
  const [asker, setAsker] = useState('');
  const [partner, setPartner] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AitErrorCode | null>(null);
  const [inputMsg, setInputMsg] = useState<AitKey | null>(null);
  const [noCode, setNoCode] = useState(false);
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [answers, setAnswers] = useState(0);
  const [locked, setLocked] = useState(false);
  const pending = useRef<{ chip: string | null } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const alive = useRef(true);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  const doSend = useCallback(
    async (chip: string | null) => {
      const code = aitStore.get().code;
      if (!code) return setNoCode(true);
      setBusy(true);
      setError(null);
      setInputMsg(null);
      const body: Record<string, unknown> = { asker_text: asker.trim(), partner_text: partner.trim() };
      if (alias.trim()) body.partner_alias = alias.trim();
      if (chip) body.chip = chip;
      if (bundle !== null) body.bundle = bundle;
      if (chip === 'state_4') setItems((xs) => [...xs, { t: 'card', kind: 'soft', options: [] }]); // 마음 힘듦 칩: 위로 한 줄 + 번호 줄을 바로(안전이 먼저)
      const res = await postAit('chat', body, code);
      if (!alive.current) return;
      setBusy(false);
      if (res.kind === 'offline') return setError('unavailable');
      const r = res.reply;
      if (r.bundle !== null && r.code !== 'auth') setBundle(r.bundle); // 서버가 서명해 돌려준 묶음 — 열지 않고 그대로 들고 있는다
      const mine: Item[] = [...(asker.trim() ? [{ t: 'me' as const, text: asker.trim() }] : []), ...(partner.trim() ? [{ t: 'partner' as const, text: partner.trim() }] : [])];
      if (r.code === 'ok') {
        const d = parseChatDisplay(r.display);
        if (!d) return setError('bad_request');
        setItems((xs) => [...xs, ...mine, { t: 'ai', d }]);
        setChips(d.chips.filter((c) => c in CHIP_KEYS));
        setStage(d.stage);
        setAnswers((n) => n + 1);
        setAsker('');
        setPartner('');
        if (d.ended) setView('end');
        return;
      }
      if ((r.code === 'crisis' || r.code === 'refused_intent') && r.card) {
        const kind = cardKind(r.card);
        setAsker('');
        setPartner(''); // 카드가 나온 턴의 글은 말풍선에도 입력 칸에도 남기지 않는다
        if (!kind) return setError('unavailable');
        setItems((xs) => [...xs.filter((x) => !(x.t === 'card' && x.kind === 'soft')), { t: 'card', kind, options: r.card?.options ?? [] }]);
        return;
      }
      if (isErrorCode(r.code)) {
        if (r.code === 'rate') {
          setLocked(true);
          if (lockTimer.current) clearTimeout(lockTimer.current);
          lockTimer.current = setTimeout(() => alive.current && setLocked(false), Math.min(60_000, Math.max(3_000, (r.retryAfterSec ?? 30) * 1000)));
        }
        return setError(r.code);
      }
      setError('unavailable');
    },
    [alias, asker, bundle, partner],
  );

  const send = useCallback(
    async (chip: string | null) => {
      if (busy) return;
      if (!chip && !asker.trim() && !partner.trim()) return setInputMsg('CONCERN.mine.empty');
      if (len(asker) > ASKER_MAX) return setError('too_long');
      if (len(partner) > PARTNER_MAX) return setInputMsg('CONCERN.partner.tooLong');
      await aitStore.load();
      // 위기 앞거름이 먼저(IF5-QF F-01 · F-12): 접근 코드가 없거나 동의 전이어도 서버와 한 벌인 낱말 사전으로 본다 — 걸리면 안내 카드 · 요청 0 · 쓴 글은 남기지 않는다.
      //  코드와 동의가 모두 있으면 서버가 같은 일을 세션 상태와 함께 한다(위기 카드 횟수 · 폭력 안전 길)
      if (!aitStore.get().code || !hasConsent(aitStore.get())) {
        const early = localPrecheckCard(`${asker}
${partner}`);
        const kind = early ? cardKind(early) : null;
        if (early && kind) {
          setAsker('');
          setPartner('');
          setError(null);
          setInputMsg(null);
          setNoCode(false);
          setItems((xs) => [...xs.filter((x) => !(x.t === 'card' && x.kind === 'soft')), { t: 'card', kind, options: early.options }]);
          return;
        }
      }
      if (!aitStore.get().code) return setNoCode(true); // 코드 없음 → 서버 요청 0
      if (!hasConsent(aitStore.get())) {
        pending.current = { chip };
        return setConsent(true);
      }
      await doSend(chip);
    },
    [asker, busy, doSend, partner],
  );

  const confirmConsent = async () => {
    await aitStore.setConsent();
    setConsent(false);
    const p = pending.current;
    pending.current = null;
    if (p) await doSend(p.chip);
  };

  const cancelConsent = () => {
    pending.current = null;
    setConsent(false);
  };

  const restart = () => {
    setItems([]);
    setBundle(null);
    setChips([]);
    setStage('S1');
    setAsker('');
    setPartner('');
    setAlias('');
    setError(null);
    setInputMsg(null);
    setAnswers(0);
    setView('chat');
  };

  const stageKeys = STAGE_KEYS[stage] ?? STAGE_KEYS.S1;
  const footer = (
    <View style={styles.gap}>
      <AppText variant="caption" testID={`${testID}-footer`}>
        {ait('CONCERN.footer')}
      </AppText>
      <AppText variant="caption" testID={`${testID}-always`}>
        {ait('CONCERN.always')}
      </AppText>
    </View>
  );

  if (view === 'intro') {
    return (
      <ScrollView contentContainerStyle={styles.body} testID={`${testID}-intro`}>
        <AitHead testID={`${testID}-head`} />
        <AppText variant="bodyBold">{ait('CONCERN.intro.lead')}</AppText>
        <AppText variant="body" testID={`${testID}-not-counsel`}>
          {ait('CONCERN.intro.notCounsel')}
        </AppText>
        <AppText variant="body" testID={`${testID}-no-send`}>
          {ait('CONCERN.intro.noSend')}
        </AppText>
        <Button label={ait('CONCERN.intro.start')} onPress={() => setView('chat')} testID={`${testID}-start`} />
        {footer}
      </ScrollView>
    );
  }

  if (view === 'end') {
    return (
      <ScrollView contentContainerStyle={styles.body} testID={`${testID}-end`}>
        <AppText variant="title" accessibilityRole="header" testID={`${testID}-end-title`}>
          {ait('CONCERN.end.title')}
        </AppText>
        <AppText variant="body" testID={`${testID}-end-body`}>
          {ait('CONCERN.end.body')}
        </AppText>
        <AppText variant="caption" testID={`${testID}-end-no-send`}>
          {ait('CONCERN.intro.noSend')}
        </AppText>
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button label={ait('CONCERN.end.again')} variant="secondary" onPress={restart} testID={`${testID}-again`} />
          </View>
          <View style={styles.flex}>
            <Button label={ait('CONCERN.end.close')} variant="secondary" onPress={onClose} testID={`${testID}-close-end`} />
          </View>
        </View>
        <TextButton label={ait('CONCERN.end.delete')} onPress={() => setDeleting(true)} testID={`${testID}-delete`} />
        {footer}
        <ConfirmDialog
          visible={deleting}
          title={ait('CONCERN.end.delete')}
          body={ait('CONCERN.end.deleteConfirm')}
          confirmLabel={ait('CONCERN.end.delete')}
          cancelLabel={A11Y.close}
          danger
          onConfirm={() => {
            setDeleting(false);
            setItems([]);
            setBundle(null);
            onClose();
          }}
          onCancel={() => setDeleting(false)}
          testID={`${testID}-delete-dialog`}
        />
      </ScrollView>
    );
  }

  const lastCard = [...items].reverse().find((x) => x.t === 'card');
  const closedByCard = lastCard?.t === 'card' && lastCard.kind === 'minor';
  return (
    <>
      <ScrollView ref={scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} testID={`${testID}-scroll`}>
        <AitHead testID={`${testID}-head`} />
        <View style={styles.stage} testID={`${testID}-stage`} accessible accessibilityLabel={ait('CONCERN.stage.a11y', { '단계 이름': ait(stageKeys[0]) })}>
          <AppText variant="bodyBold">{ait(stageKeys[0])}</AppText>
          <AppText variant="caption">{ait(stageKeys[1])}</AppText>
        </View>
        <AppText variant="body" testID={`${testID}-opening`}>
          {ait('CONCERN.opening')}
        </AppText>
        {items.map((it, i) => (
          <ItemView
            key={i}
            it={it}
            testID={`${testID}-item-${i}`}
            onContinue={() => setItems((xs) => xs.map((x, j) => (j === i && x.t === 'card' ? { ...x, options: [] } : x)))}
            onEnd={() => setView('end')}
          />
        ))}
        {answers >= AIT_REST_AFTER_ANSWERS ? (
          <AppText variant="caption" testID={`${testID}-rest`}>
            {ait('CONCERN.rest')}
          </AppText>
        ) : null}
        {busy ? <AitLoading testID={`${testID}-loading`} /> : null}
        {error ? <AitError code={error} locked={locked} onRetry={() => void send(null)} onRestart={restart} onSettings={onSettings} testID={`${testID}-error`} /> : null}
        {noCode ? <AitNoCode feature="concern" onSettings={onSettings} testID={`${testID}-nocode`} /> : null}
        {!closedByCard ? (
          <View style={styles.gap} testID={`${testID}-input`}>
            {chips.length > 0 && !busy ? (
              <View style={styles.gap} testID={`${testID}-chips`}>
                <AppText variant="caption">{ait('CONCERN.chips.label')}</AppText>
                <View style={styles.row}>
                  {chips.map((c) => (
                    <Chip key={c} label={ait(CHIP_KEYS[c])} variant="inactive" accessibilityLabel={ait('CONCERN.chip.a11y', { 선택지: ait(CHIP_KEYS[c]) })} onPress={() => void send(c)} testID={`${testID}-chip-${c}`} />
                  ))}
                </View>
              </View>
            ) : null}
            <AppText variant="caption" testID={`${testID}-notice-name`}>
              {ait('CONCERN.notice.name')}
            </AppText>
            <AppText variant="caption" testID={`${testID}-notice-image`}>
              {ait('CONCERN.notice.noImage')}
            </AppText>
            <AppText variant="caption" testID={`${testID}-notice-partner`}>
              {ait('CONCERN.notice.partnerField')}
            </AppText>
            <AitPrivacyLines testID={`${testID}-privacy`} />
            <AppText variant="captionMedium">{ait('CONCERN.field.mine.label')}</AppText>
            <TextField label={ait('CONCERN.field.mine.label')} value={asker} onChangeText={setAsker} placeholder={ait('CONCERN.field.mine.placeholder')} multiline maxLength={ASKER_MAX} autoCorrect={false} error={inputMsg === 'CONCERN.mine.empty' ? ait('CONCERN.mine.empty') : null} testID={`${testID}-mine`} />
            <AppText variant="captionMedium">{ait('CONCERN.field.partner.label')}</AppText>
            <TextField label={ait('CONCERN.field.partner.label')} value={partner} onChangeText={setPartner} placeholder={ait('CONCERN.field.partner.placeholder')} multiline maxLength={PARTNER_MAX} autoCorrect={false} error={inputMsg === 'CONCERN.partner.tooLong' ? ait('CONCERN.partner.tooLong') : null} testID={`${testID}-partner`} />
            <AppText variant="caption">{ait('CONCERN.field.partner.hint')}</AppText>
            {answers === 0 && items.length === 0 ? (
              <>
                <AppText variant="captionMedium">{ait('CONCERN.field.alias.label')}</AppText>
                <TextField label={ait('CONCERN.field.alias.label')} value={alias} onChangeText={setAlias} placeholder={ait('CONCERN.field.alias.placeholder')} maxLength={ALIAS_MAX} autoCorrect={false} testID={`${testID}-alias`} />
                <AppText variant="caption">{ait('CONCERN.field.alias.hint')}</AppText>
              </>
            ) : null}
            <Button label={busy ? ait('CONCERN.sending') : ait('CONCERN.send')} loading={busy} onPress={() => void send(null)} testID={`${testID}-send`} />
          </View>
        ) : null}
        {footer}
      </ScrollView>
      <AitConsentSheet visible={consent} onConfirm={() => void confirmConsent()} onClose={cancelConsent} testID={`${testID}-consent`} />
    </>
  );
}

function ItemView({ it, testID, onContinue, onEnd }: { it: Item; testID: string; onContinue: () => void; onEnd: () => void }) {
  if (it.t === 'me' || it.t === 'partner') {
    return (
      <View style={[styles.bubble, it.t === 'me' ? styles.mine : styles.theirs]} accessible accessibilityLabel={ait(it.t === 'me' ? 'CONCERN.a11y.me' : 'CONCERN.a11y.partner', { 본문: it.text })} testID={testID}>
        <AppText variant="body">{it.text}</AppText>
      </View>
    );
  }
  if (it.t === 'card') return <AitCardView kind={it.kind} options={it.options} onContinue={onContinue} onEnd={onEnd} testID={testID} />;
  return <AiTurn d={it.d} testID={testID} />;
}

function AiTurn({ d, testID }: { d: AitChatDisplay; testID: string }) {
  const groups: { kind: string; list: AitSentence[] }[] = [];
  for (const s of d.sentences) {
    const last = groups[groups.length - 1];
    if (last && last.kind === s.kind) last.list.push(s);
    else groups.push({ kind: s.kind, list: [s] });
  }
  const all = d.sentences.map((s) => s.text).join(' ');
  return (
    <AitPaper testID={testID}>
      <View accessible accessibilityLabel={ait('CONCERN.a11y.ai', { 본문: all })} style={styles.gap}>
        <AitAiLabel testID={`${testID}-label`} />
        {groups.map((g, gi) => (
          <View key={gi} style={styles.gap}>
            {KIND_KEY[g.kind] ? <AppText variant="captionMedium">{ait(KIND_KEY[g.kind])}</AppText> : null}
            {g.list.map((s, si) => (
              <Sentence key={si} s={s} testID={`${testID}-s${gi}-${si}`} />
            ))}
          </View>
        ))}
      </View>
      {noteKeys(d.notes).map((k) => (
        <AppText key={k} variant="caption" testID={`${testID}-note-${k}`}>
          {ait(k)}
        </AppText>
      ))}
    </AitPaper>
  );
}

function Sentence({ s, testID }: { s: AitSentence; testID: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={styles.gap}>
      <AppText variant="body" testID={testID}>
        {s.text}
      </AppText>
      {s.weak ? (
        <AppText variant="caption" testID={`${testID}-weak`}>
          {ait('CONCERN.weak')}
        </AppText>
      ) : null}
      {s.refs.length > 0 ? (
        <View style={styles.row}>
          {s.refs.map((r, i) => (
            <TextButton key={i} label={`[${r.label}]`} variant="captionMedium" onPress={() => setOpen(open === i ? null : i)} testID={`${testID}-ref-${i}`} />
          ))}
        </View>
      ) : null}
      {open !== null && s.refs[open] ? <RefPanel r={s.refs[open]} testID={`${testID}-ref-panel`} /> : null}
    </View>
  );
}

function RefPanel({ r, testID }: { r: AitRef; testID: string }) {
  return (
    <View style={styles.refPanel} testID={testID}>
      <AppText variant="captionMedium">{ait('CONCERN.ref.title')}</AppText>
      {r.type === 'user' ? (
        <>
          <AppText variant="caption">{ait('CONCERN.ref.mine')}</AppText>
          {r.quote ? <AppText variant="small">{r.quote}</AppText> : null}
        </>
      ) : (
        <>
          <AppText variant="caption">{ait('CONCERN.ref.card')}</AppText>
          {r.citation ? <AppText variant="small">{r.citation}</AppText> : null}
          {r.limit ? (
            <>
              <AppText variant="caption">{ait('CONCERN.ref.limit')}</AppText>
              <AppText variant="small">{r.limit}</AppText>
            </>
          ) : null}
          {r.practical ? <AppText variant="caption">{ait('CONCERN.practical')}</AppText> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.s20, gap: space.s12, paddingBottom: space.s40 },
  gap: { gap: space.s8 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  buttons: { flexDirection: 'row', gap: space.s8 },
  stage: { gap: space.s4 },
  bubble: { borderRadius: radius.lg, padding: space.s12, maxWidth: '92%' },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accentSoft },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  refPanel: { gap: space.s4, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.s12 },
});
