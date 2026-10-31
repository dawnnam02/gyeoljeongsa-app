// IF-SJ-TALK 사주 이야기 나누기(IF5-F2 ⑩ · F5-17 · 화면 요구 IF-SJ-TALK · 정책 PS-38 · PS-45 ~ PS-53 · 디자인 CH-1 ~ 3 · 카피 24-9 · 설계안 M-13 · S-10 · A-8).
//  순서: (처음) CK17D 동의 → CK19 동의 → **시작 시트 한 번**('한 번 말할 때마다 N 마일리지를 써요') → 말풍선 대화. 이후 턴은 시트 0 · 자동 차감. **대화 화면에 줄어드는 숫자 · 남은 횟수 · 글자 수 카운터 0**
//  · 턴마다: 위기 앞거름(차감 0 · 잔액이 0이어도 · **동의 전이어도 · 접근 코드가 없어도** 카드 — IF5-QF F-01: 낱말 사전을 동의 · 잔액 · 코드 확인보다 먼저 본다) → 예치 → 서버 호출(접근 코드가 있으면 실제 · 없으면 데모 글) → 확정 / 해제. 부족하면 그 턴만 멈추고 한 줄 + [충전하러 가기](쓰던 글 그대로)
//  · 위기 카드: 고정 글 · 전화 걸기 0 · 상한 없음 · 닫으면(이어서 하기) 대화로 돌아감. **한 세션에서 5번째 위기 카드가 나오면 세션이 닫힌다**(카드 · 번호는 계속 보임, 입력 닫힘 · [새로 시작])
//  · AI 답 **30번째 뒤 '쉬어 가요' 한 줄을 한 번** — 막지 않음 · 숫자 0 · 닫으면 다시 안 뜸. 긴 이야기는 서버가 앞부분을 요약해 이어 가고 화면에는 '앞부분은 요약해서 이어 가요' 한 줄뿐
//  · 이력은 이 기기에만(서명 묶음 + 말풍선 — aiResults) · 서버 저장 0. 캡처 막기 · 공유 · 복사 0 · 먼저 말 걸기 · 푸시 0. 끝줄은 앱 한 곳(SAJU.card.footer)에서만 · 답마다 'AI가 쓴 글' 표시
import { Redirect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { IF5_TEXT } from '@/content/if5Copy';
import { AitCardView, cardView } from '@/features/ait/AitParts';
import { ait } from '@/features/ait/aitText';
import type { AitCard } from '@/features/ait/aitTypes';
import { localPrecheckCard } from '@/features/ait/localPrecheck';
import { cardEndsSession } from '@/features/ait/safetyCard';
import { Ck17dSheet, Ck19Sheet } from '@/features/consent/If5ConsentSheets';
import { useIf5Consent } from '@/features/consent/if5Consent';
import { Footnote } from '@/features/inflight/If2Parts';
import { costOf } from '@/features/mileage/mileageLogic';
import { MILEAGE_HREF } from '@/features/mileage/MileageScreen';
import { LowBalance, TalkStartSheet } from '@/features/mileage/MileageSheets';
import { useMileageState } from '@/features/mileage/useMileage';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import { colors, radius, size, space } from '@/theme/tokens';

import { chatFacts } from './ai/aiFacts';
import { newRequestId, runAi } from './ai/aiRun';
import { aiServices, type AiServices } from './ai/aiService';
import { inputStore, useInputStore, type InputStore } from './deviceInput';
import { chartOf, nowIso } from './sajuLogic';
import { sajuServices, type SajuDeps } from './sajuService';
import { useCk17, useSajuData } from './useSajuData';

/** 한 세션에서 5번째 위기 카드가 나오면 닫힌다(설계안 A-8 · 팀장 정함 10-31 — 카드 · 번호는 계속 보인다) */
export const CRISIS_CLOSE_AT = 5;
/** AI 답 30번째 뒤 '쉬어 가요' 한 줄을 한 번(설계안 S-10) */
export const REST_AFTER_ANSWERS = 30;

type Msg = { id: number; role: 'me' | 'ai' | 'card'; text: string; card?: AitCard };
type Saved = { v: 1; msgs: Msg[]; bundle: unknown; answers: number; crisis: number; restShown: boolean; started: boolean; closed: boolean };

export function SajuTalkScreen({ deps: injected, store }: { deps?: SajuDeps; store?: InputStore }) {
  return injected ? <Talk deps={injected} ai={injected.ai} store={store} /> : <TalkWithDefaults />;
}
function TalkWithDefaults() {
  const { flags, isOn } = useFeatureFlags();
  const deps = useMemo(() => {
    let ai: AiServices | undefined;
    try {
      ai = aiServices();
    } catch {
      ai = undefined;
    }
    return { ...sajuServices(), isOn, ai };
  }, [isOn]);
  if (flags.loaded && !(isOn('saju_yard') && isOn('saju_talk'))) return <Redirect href={'/boarding' as Href} />; // 스위치 꺼짐: 주소로 와도 홈으로(PF-93)
  return <Talk deps={deps} ai={deps.ai} />;
}

function Talk({ deps, ai, store: injectedStore }: { deps: SajuDeps; ai?: AiServices; store?: InputStore }) {
  const router = useRouter();
  const store = injectedStore ?? inputStore();
  const input = useInputStore(store);
  const [loaded, setLoaded] = useState(store.ready());
  useEffect(() => {
    let alive = true;
    void store.load().then(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [store]);
  const ck = useCk17(deps);
  const consent = useIf5Consent(ai?.consent);
  const enabled = ck.slot.kind === 'on' && loaded && input.answered;
  const data = useSajuData(deps, input, enabled, consent.items);
  const nowFn = deps.now ?? Date.now;
  const today = nowIso(nowFn());
  const ready = data.chart.kind === 'ready' && data.chart.data.state === 'ready' ? data.chart.data : null;
  const outOfRange = data.chart.kind === 'ready' && data.chart.data.state === 'out_of_range';
  const luck = data.luck.kind === 'ready' && data.luck.data.state === 'ready' ? data.luck.data : null;
  const my = useMemo(() => (ready ? chartOf(ready) : null), [ready]);
  useAlwaysCaptureBlock(true); // 이야기 화면은 늘 캡처 · 녹화를 막는다(IFF5-22)
  const { slot: bal, reload: reloadBal } = useMileageState(ai?.mileage ?? DEAD_API, !!ai);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'none' | 'failed' | 'blocked' | 'maint' | 'declined'>('none');
  const [low, setLow] = useState<{ need: number; have: number } | null>(null);
  const [sheet, setSheet] = useState<'none' | 'd' | 'c19' | 'start'>('none');
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState(0);
  const [crisis, setCrisis] = useState(0);
  const [restShown, setRestShown] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [summarized, setSummarized] = useState(false);
  const bundle = useRef<unknown>(null);
  const reqId = useRef<string | null>(null);
  const seq = useRef(1);
  const scroll = useRef<ScrollView>(null);

  // 기기에 둔 이력 불러오기(이어 가기)
  useEffect(() => {
    if (!ai) return undefined;
    let live = true;
    void ai.results.getTalk().then((v) => {
      const s = v as Saved | null;
      if (!live || !s || s.v !== 1 || !Array.isArray(s.msgs)) return;
      setMsgs(s.msgs);
      bundle.current = s.bundle ?? null;
      setAnswers(s.answers);
      setCrisis(s.crisis);
      setRestShown(s.restShown);
      setStarted(s.started);
      setClosed(s.closed);
      seq.current = s.msgs.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    });
    return () => {
      live = false;
    };
  }, [ai]);
  const saveSession = useCallback(
    (next: Partial<Saved> & { msgs: Msg[] }) => {
      void ai?.results.putTalk({ v: 1, bundle: bundle.current, answers, crisis, restShown, started, closed, ...next });
    },
    [ai, answers, crisis, restShown, started, closed],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/saju' as Href));
  const costNow = bal.kind === 'ready' ? costOf(bal.state, 'saju_chat_turn') : null;

  // 처음 들어와 말할 때까지의 문: CK17D → CK19 → 시작 시트(한 번)
  const gate = async (): Promise<boolean> => {
    if (!ai) return false;
    await ai.consent.load();
    const c = ai.consent.get();
    if (!c.d) {
      setSheet('d');
      return false;
    }
    if (!c.t) {
      setSheet('c19');
      return false;
    }
    if (!started) {
      setSheet('start');
      return false;
    }
    return true;
  };

  /** 고정 카드 한 장을 대화에 붙인다(위기 · 폭력 · 거절 · 미성년) — 차감 0 · 쓴 글은 말풍선 · 입력 칸에 남기지 않는다(위기 글 저장 0) */
  const takeCard = (card: AitCard, newBundle?: unknown): void => {
    reqId.current = null;
    if (newBundle) bundle.current = newBundle;
    const n = card.id === 'crisis' || card.id === 'harm_intent' ? crisis + 1 : crisis; // 가해 의도 카드도 위기 카드처럼 횟수에 센다(차감 0)
    const next = [...msgs, { id: seq.current++, role: 'card' as const, text: '', card }];
    setText('');
    setNotice('none');
    setLow(null);
    setCrisis(n);
    const close = n >= CRISIS_CLOSE_AT || cardEndsSession(card); // 미성년이 한 갈래라도 끼면(겹침 포함) 세션을 마친다
    if (close) setClosed(true);
    setMsgs(next);
    saveSession({ msgs: next, crisis: n, closed: close });
    setTimeout(() => scroll.current?.scrollToEnd?.({ animated: false }), 0);
  };

  const send = async (): Promise<void> => {
    const t = text.trim();
    if (!ai || !t || busy || closed || !my) return;
    // 위기 앞거름이 제일 먼저(IF5-QF F-01) — 동의 전이어도 · 잔액 0이어도 · 접근 코드가 없어도 카드. 서버 요청 0 · 마일리지 0
    const early = localPrecheckCard(t);
    if (early) {
      takeCard(early);
      return;
    }
    if (!(await gate())) return;
    const facts = chatFacts(my, luck, today);
    if (!facts) {
      setNotice('maint');
      return;
    }
    setBusy(true);
    setNotice('none');
    setLow(null);
    const id = (reqId.current ??= (ai.newId ?? newRequestId)());
    const code = await ai.code();
    const out = await runAi({ edge: ai.edge, code: () => code, post: ai.post }, { kind: 'chat', requestId: id, chars: Array.from(t).length, text: t, bundle: bundle.current ?? undefined, facts });
    setBusy(false);
    if (out.kind === 'ok') {
      reqId.current = null;
      const d = out.display as { reply?: string; ask?: string; summarized?: boolean };
      if (out.bundle) bundle.current = out.bundle;
      const reply = [d.reply, d.ask].filter((x) => typeof x === 'string' && x).join(' ');
      const next = [...msgs, { id: seq.current++, role: 'me' as const, text: t }, { id: seq.current++, role: 'ai' as const, text: reply }];
      setText('');
      const n = answers + 1;
      setAnswers(n);
      setSummarized(summarized || d.summarized === true);
      if (n >= REST_AFTER_ANSWERS && !restShown) {
        setRestShown(true);
        setRestOpen(true);
      }
      setMsgs(next);
      saveSession({ msgs: next, answers: n, restShown: restShown || n >= REST_AFTER_ANSWERS });
    } else if (out.kind === 'card') {
      takeCard(out.card, out.bundle);
    } else if (out.kind === 'low') setLow({ need: out.need, have: out.have });
    else if (out.kind === 'blocked') setNotice('blocked');
    else if (out.kind === 'failed') setNotice('failed');
    else setNotice('maint');
    void reloadBal();
    setTimeout(() => scroll.current?.scrollToEnd?.({ animated: false }), 0);
  };

  const restart = async (): Promise<void> => {
    bundle.current = null;
    reqId.current = null;
    setMsgs([]);
    setAnswers(0);
    setCrisis(0);
    setRestShown(false);
    setRestOpen(false);
    setClosed(false);
    setSummarized(false);
    setNotice('none');
    setLow(null);
    setStarted(false);
    await ai?.results.clearTalk();
  };

  const body = (): React.ReactNode => {
    if (!ai) return <AppText variant="body">{IF5_TEXT['SAJU.status.maint']}</AppText>;
    if (ck.slot.kind === 'loading' || !loaded || data.chart.kind === 'idle' || data.chart.kind === 'loading') return <AppText variant="caption" testID="saju-talk-loading">{IF5_TEXT['SAJU.status.loadLab']}</AppText>;
    if (outOfRange) return <AppText variant="body" testID="saju-talk-norange">{IF5_TEXT['SAJU.talk.noRange']}</AppText>; // 사주 사실 없이 대화 길 0
    if (!my) {
      return (
        <View style={styles.gap} testID="saju-talk-empty">
          <AppText variant="body">{IF5_TEXT['SAJU.status.empty']}</AppText>
          <Button label={IF5_TEXT['SAJU.madang.fillIn']} variant="secondary" onPress={() => router.replace('/saju' as Href)} testID="saju-talk-fill" />
        </View>
      );
    }
    return (
      <>
        {!ready?.hourKnown ? (
          <AppText variant="caption" testID="saju-talk-hour">
            {IF5_TEXT['SAJU.talk.hourUnknown']}
          </AppText>
        ) : null}
        {msgs.length === 0 ? (
          <AppText variant="body" testID="saju-talk-intro">
            {IF5_TEXT['SAJU.talk.entry.body']}
          </AppText>
        ) : null}
        {msgs.map((m) =>
          m.role === 'card' && m.card ? (
            <CardRow key={m.id} card={m.card} last={m.id === msgs[msgs.length - 1].id} closed={closed} onContinue={() => setMsgs(msgs.map((x) => (x.id === m.id ? { ...x, card: { ...x.card!, options: [] } } : x)))} onRestart={() => void restart()} />
          ) : (
            <View key={m.id} style={[styles.bubble, m.role === 'me' ? styles.me : styles.bot]} testID={`saju-talk-msg-${m.id}`}>
              {m.role === 'ai' ? (
                <AppText variant="captionMedium" tone="accent">
                  {IF5_TEXT['SAJU.card.aiTag']}
                </AppText>
              ) : null}
              <AppText variant="body">{m.text}</AppText>
            </View>
          ),
        )}
        {summarized ? (
          <AppText variant="caption" testID="saju-talk-summary">
            {IF5_TEXT['SAJU.talk.summary']}
          </AppText>
        ) : null}
        {restOpen ? (
          <View style={styles.rest} testID="saju-talk-rest">
            <AppText variant="body" style={styles.flex}>
              {IF5_TEXT['REST_HINT.line']}
            </AppText>
            <TextButton label={IF5_TEXT['REST_HINT.close']} onPress={() => setRestOpen(false)} testID="saju-talk-rest-close" />
          </View>
        ) : null}
        {busy ? (
          <AppText variant="caption" accessibilityRole="progressbar" testID="saju-talk-running">
            {IF5_TEXT['SAJU.status.aiRunning']}
          </AppText>
        ) : null}
        {notice === 'failed' || notice === 'blocked' ? (
          <View style={styles.gap}>
            <AppText variant="body" accessibilityRole="alert" testID="saju-talk-notice">
              {notice === 'failed' ? IF5_TEXT['SAJU.status.sendFailed'] : IF5_TEXT['SAJU.status.aiBlocked']}
            </AppText>
          </View>
        ) : null}
        {notice === 'maint' ? <AppText variant="body" testID="saju-talk-maint">{IF5_TEXT['SAJU.status.maint']}</AppText> : null}
        {notice === 'declined' ? <AppText variant="body" testID="saju-talk-declined">{IF5_TEXT['SAJU.talk.entry.body']}</AppText> : null}
        {low ? <LowBalance need={low.need} have={low.have} chat onCharge={() => router.push(MILEAGE_HREF as Href)} testID="saju-talk-low" /> : null}
        {!closed ? (
          <View style={styles.gap}>
            <TextField
              label={IF5_TEXT['SAJU.talk.ph']}
              placeholder={IF5_TEXT['SAJU.talk.ph']}
              value={text}
              onChangeText={setText}
              multiline
              autoComplete="off"
              autoCorrect={false}
              autoCapitalize="none"
              textContentType="none"
              disabled={busy}
              testID="saju-talk-input"
            />
            <Button label={notice === 'failed' || notice === 'blocked' ? IF5_TEXT['SAJU.status.retry'] : IF5_TEXT['SAJU.talk.send']} loading={busy} disabled={text.trim() === ''} onPress={() => void send()} testID="saju-talk-send" />
          </View>
        ) : null}
      </>
    );
  };

  return (
    <Screen edges={['top']} testID="screen-saju-talk">
      <ScreenHeader title={IF5_TEXT['SAJU.talk.title']} onBack={back} testID="saju-talk-header" />
      <ScrollView ref={scroll} contentContainerStyle={styles.body} testID="saju-talk-scroll">
        <AppText variant="caption" testID="saju-talk-capture">
          {IF5_TEXT['SAJU.talk.capture']}
        </AppText>
        {body()}
        <AppText variant="bodyMedium" testID="saju-talk-end">
          {IF5_TEXT['SAJU.card.end']}
        </AppText>
        <Footnote text={IF5_TEXT['SAJU.card.footer']} testID="saju-talk-footer" />
        <AppText variant="caption" testID="saju-talk-always">
          {ait('CONCERN.always')}
        </AppText>
      </ScrollView>

      <Ck17dSheet
        visible={sheet === 'd'}
        onClose={() => setSheet('none')}
        onNo={() => {
          setSheet('none');
          setNotice('declined');
        }}
        onYes={async () => {
          await ai?.consent.agreeD();
          setSheet(ai?.consent.get().t ? 'start' : 'c19');
        }}
        testID="saju-talk-ck17d"
      />
      <Ck19Sheet
        visible={sheet === 'c19'}
        onClose={() => setSheet('none')}
        onNo={() => {
          setSheet('none');
          setNotice('declined');
        }}
        onYes={async (health) => {
          await ai?.consent.agreeT(health);
          setSheet(started ? 'none' : 'start');
        }}
        testID="saju-talk-ck19"
      />
      <TalkStartSheet
        visible={sheet === 'start'}
        kind="saju"
        cost={costNow ?? 0}
        balance={bal.kind === 'ready' ? bal.state.total : 0}
        onClose={() => setSheet('none')}
        onGo={() => {
          setStarted(true);
          setSheet('none');
          saveSession({ msgs, started: true });
        }}
        testID="saju-talk-start"
      />
    </Screen>
  );
}

function CardRow({ card, last, closed, onContinue, onRestart }: { card: AitCard; last: boolean; closed: boolean; onContinue: () => void; onRestart: () => void }) {
  const view = cardView(card);
  if (!view) return null;
  return (
    <View style={styles.gap} testID={`saju-talk-card-${card.id}`}>
      <AitCardView kind={view.kind} lines={view.lines} ends={view.ends} options={last && !closed ? card.options.filter((o) => o === 'continue') : []} onContinue={onContinue} testID="saju-talk-cardview" />
      {last && closed ? (
        <View style={styles.gap} testID="saju-talk-closed">
          <AitCardView kind="session_end" options={[]} testID="saju-talk-end-card" />
          <Button label={IF5_TEXT['SAJU.card.close']} variant="secondary" onPress={onRestart} testID="saju-talk-restart" />
        </View>
      ) : null}
    </View>
  );
}

const DEAD_API = {
  state: async () => ({ ok: false as const, code: 'not_ready' as const }),
  history: async () => ({ ok: false as const, code: 'not_ready' as const }),
  cost: async () => ({ ok: false as const, code: 'not_ready' as const }),
  charge: async () => ({ ok: false as const, code: 'not_ready' as const }),
};

const styles = StyleSheet.create({
  body: { padding: size.screenPadding, paddingBottom: space.s40, gap: space.s16 },
  gap: { gap: space.s12 },
  flex: { flex: 1 },
  bubble: { padding: space.s12, borderRadius: radius.lg, gap: space.s4, maxWidth: '88%' },
  me: { alignSelf: 'flex-end', backgroundColor: colors.accentSoft },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.card },
  rest: { flexDirection: 'row', alignItems: 'center', gap: space.s12, padding: space.s12, borderRadius: radius.lg, backgroundColor: colors.card },
});
