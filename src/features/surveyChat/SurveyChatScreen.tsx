// 화면 04 대화형 설문(V6-F · 청사진_v5 14장 · 세부청사진 V6_대화형설문 · 시안 디자인/V6_대화형설문 확정 5건 A · 문구 카피.md 13장).
//  흐름: 시작(AI 고지 · 30분) → 1부 빠른 문답(설문 v2 필수 문항 · 정치 막대, AI 말은 미리 쓴 문구 · 호출 0) → CK16 동의(2부 바로 앞, 같은 무게 버튼 둘)
//        → 2부 인터뷰(글 입력 · 모의/실제는 서버가 정함) → [여기까지 할게요] 또는 끝 → 정리 중 → 07 내 성향(요약 · 결혼에 대한 생각 · 이야기하는 방식 · 자기소개 초안, 숫자 0)
//        → 남은 글 문항(T01~T03, AI 초안을 넣어 두고 본인이 확인) → [답 한눈에 보기](설문 v2 검토 화면 /survey/v2 → 제출 → 05)
//  · 1부 저장 키 · 값은 설문 v2 와 같다: 같은 문항표 · 같은 검사(check) · 같은 정리(normalizeAnswers) · 같은 API(save_answers · clear_answers · save_free_texts · visibility_settings)
//  · 하나 고르기는 누르면 바로 보냄, 나머지는 [이렇게 할게요]. 지난 답 말풍선을 누르면 그 자리에서 고침([그대로 둘게요] · [바꾸기]), 뒤 대화는 흐리게
//  · 진행 표시는 머리 아래 '지금 이야기 · {섹션 · 칸 이름}'뿐(숫자 · 퍼센트 0, 확정 1)
//  · 입력 행동 숫자 6개는 CK16 동의자만 기기에서 메시지마다 계산(behavior.ts) — 키 하나하나 기록 0. 동의가 없으면 계산기 자체가 없다
//  · AI 가 늦으면 점 3개 → '답을 천천히 읽고 있어요.'(확정 3), 실패하면 '다른 이야기로 이어 가 볼게요.' + 다음 빈 칸 예비 질문(멈춤 0)
//  · 3부-사 종교 동의 카드(카피 17-1 · 법무 L22 D2): A06 차례에 유효한 CK4 가 없으면 질문 대신 카드 → 동의 = CK4 기록(지금 판) 뒤 A06 질문 ·
//    거절 = '동의 안 함' 기록 + A06 '답하지 않음'(null) 저장 → 다음 문항(같은 설문에서 다시 묻지 않음). 거절 말풍선을 누르면(고치기) 카드가 다시 — 알림 · 반복 띄우기 0
// 등급 · 점수 숫자는 화면 · 코드에 없다. 글은 content/surveyChatCopy.ts · 설문 v2 글만.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Illustration } from '@/components/Illustration';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { Ring } from '@/components/Ring';
import { BottomCTA, CtaPair, Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { Toast } from '@/components/Toast';
import { schoolIndex } from '@/data/schools/schoolSearch';
import { ConsentSummarySheet } from '@/features/consent/ConsentSummarySheet';
import { LaterConsentLink } from '@/features/consent/LaterConsentLink';
import type { LoadOutcome, SaveBatch } from '@/features/surveyV2/api';
import { SV2 } from '@/features/surveyV2/copy';
import { answersOf, blockMessage, check, draftFromValue, emptyDraft, FLOW, isPassable, normalizeAnswers, optText, PUBLIC_TOGGLE_IDS, qOf, RELIGION_ID, type Draft } from '@/features/surveyV2/model';
import { emptyPol, polBlock, type PolDraft } from '@/features/surveyV2/PoliticsStage';
import { schoolLabel } from '@/features/surveyV2/SchoolInput';
import type { V2Value } from '@/features/surveyV2/types';
import { Rise, TOAST_MS, useReduceMotion } from '@/motion';
import { illustration } from '@/theme/illustrations';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import type { Session, Summary } from './api';
import { createMeter, behaviorPayload, type Meter } from './behavior';
import { ChatInput, PolCard, RelCard } from './ChatInput';
import { fill, pick, sectionName, SLOT_ORDER, slotFallback, slotName, t } from './copy';
import { surveyChatDeps, type SurveyChatDeps } from './deps';
import type { ChatStage, LocalChat } from './localChat';
import { buildPart1, part1List, TEXT_QS, varsFor, type Line, type PolState, type RelState } from './model';
import { REL, REL_SHEET } from './relCopy';
import { AiBubble, Appear, ChatComposer, MeBubble, Note, TopicLine, TypingDots } from './parts';

export const MAX_TURNS = 25; // 2부 내 답 상한(0033 MAX_USER_TURNS) — 앱도 한 번 더 막는다
const STYLE_CODES = ['deliberate', 'warm', 'candid'];
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const has = (a: Readonly<Record<string, unknown>>, id: string) => Object.prototype.hasOwnProperty.call(a, id);

type Props = { deps?: SurveyChatDeps; onDone?: () => void };
type Pending = { key: string; text: string; behavior: ReturnType<typeof behaviorPayload>; no: number }; // no = 처음 보낸 turn 번호
type Saved = { answers: Record<string, V2Value>; texts: Record<string, string>; publicOn: Record<string, boolean> };

export function SurveyChatScreen({ deps: given, onDone }: Props) {
  const router = useRouter();
  const [deps] = useState<SurveyChatDeps>(() => given ?? surveyChatDeps());
  const { v2, chat, store } = deps;
  const { api, politics, religion } = v2;
  const reduce = useReduceMotion();

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadReason, setLoadReason] = useState<'network' | 'server'>('server');
  const [userKey, setUserKey] = useState('guest');
  const [stage, setStage] = useState<ChatStage>('intro');
  const [committed, setCommitted] = useState<Readonly<Record<string, Draft>>>({}); // 서버에 저장된 답(입력 중 값과 따로)
  const [work, setWork] = useState<Readonly<Record<string, Draft>>>({}); // 지금 · 고치는 문항의 입력 중 값
  const [publicOn, setPublicOn] = useState<Readonly<Record<string, boolean>>>({});
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const [polLater, setPolLater] = useState(false);
  const [pol, setPol] = useState<PolDraft>(emptyPol);
  // 종교 동의(CK4): null = 모름(읽기 전 · 실패 · 기능 없음 → 카드 없이) · relAgreed = 이 설문에서 카드로 동의 · relCheck = 카드 체크 칸 · relSheet = '보기 ›' 시트
  const [relOn, setRelOn] = useState<boolean | null>(null);
  const [relAgreed, setRelAgreed] = useState(false);
  const [relCheck, setRelCheck] = useState(false);
  const [relSheet, setRelSheet] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ after: string; texts: string[] } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null); // 1부 중간에 돌아옴(멈춘 날)
  // 2부
  const [session, setSession] = useState<Session | null>(null);
  const [ck16, setCk16] = useState(false);
  const [ck16Asked, setCk16Asked] = useState(false);
  const [bridge, setBridge] = useState<'starting' | 'ask' | 'daily'>('starting');
  const [talk, setTalk] = useState<Line[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [asked, setAsked] = useState<readonly string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [text, setText] = useState('');
  const [userTurns, setUserTurns] = useState(0);
  const [unsent, setUnsent] = useState<Readonly<Record<string, Pending>>>({}); // 두 번 못 보낸 글(말풍선 열쇠 → 글) — 다시 보내기
  // 정리 · 내 성향
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analysis, setAnalysis] = useState<'running' | 'waiting' | 'done'>('running');
  const [traitsEdit, setTraitsEdit] = useState<{ summary: string; intro: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [wrapNote, setWrapNote] = useState<string | null>(null);

  const saved = useRef<Saved>({ answers: {}, texts: {}, publicOn: {} });
  const alive = useRef(true);
  const busyRef = useRef(false);
  const scroller = useRef<ScrollView>(null);
  const meter = useRef<Meter | null>(null);
  const screenReader = useRef(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const pending = useRef<Pending | null>(null); // 한 번 못 보낸 글(기기 메모리에만) — 다음 턴 앞에 한 번 다시 보낸다(D-186)
  const confirmed = useRef(0); // 서버가 받았다고 알려 준 내 답 수 — 다음 요청의 turn 은 이것 + 1(서버: 같은 번호 = duplicate, 앞지르면 400 · D-187)

  const answers = useMemo(() => answersOf(committed), [committed]);
  const schoolName = useCallback((key: string) => schoolLabel(key) ?? schoolIndex().byKey(key)?.name ?? null, []);
  const polState: PolState = !politics ? 'off' : pol.serverConsent && pol.savedValue !== null ? 'answered' : polLater ? 'later' : 'ask';
  const relState: RelState = relAgreed ? 'agreed' : religion && relOn === false ? 'ask' : 'off';
  const view = useMemo(() => buildPart1(answers, { userKey, interview: true, skipped, pol: polState, rel: relState, schoolName }), [answers, userKey, skipped, polState, relState, schoolName]);

  const stateRef = useRef({ committed, publicOn, stage, skipped, polLater, ck16Asked, session, userKey, asked, userTurns, ck16 });
  useEffect(() => {
    stateRef.current = { committed, publicOn, stage, skipped, polLater, ck16Asked, session, userKey, asked, userTurns, ck16 };
  });

  const nextKey = (p: string) => {
    counter.current += 1;
    return `${p}-${counter.current}`;
  };

  // ── 기기 저장(대화 자리만) ──
  const writeLocal = useCallback(
    (over: Partial<LocalChat> = {}) => {
      const st = stateRef.current;
      const value: LocalChat = { v: 1, stage: st.stage, skipped: [...st.skipped], polLater: st.polLater, ck16Asked: st.ck16Asked, sessionId: st.session?.id ?? null, updatedAt: v2.now(), ...over };
      void store.save(st.userKey, value);
    },
    [store, v2],
  );
  useEffect(() => {
    if (phase === 'ready') writeLocal();
  }, [phase, stage, skipped, polLater, ck16Asked, session, writeLocal]);

  // ── 서버 저장(설문 v2 와 같은 차이 계산) ──
  const persist = useCallback(
    async (next: Readonly<Record<string, Draft>>, pub: Readonly<Record<string, boolean>>): Promise<boolean> => {
      const a = answersOf(next);
      const { values, clear } = normalizeAnswers(a);
      const s = saved.current;
      const answersOut: Record<string, V2Value> = {};
      const texts: Record<string, string | null> = {};
      for (const [id, v] of Object.entries(values)) {
        if (TEXT_QS.includes(id)) {
          if (typeof v === 'string' && s.texts[id] !== v) texts[id] = v;
        } else if (!same(s.answers[id], v)) answersOut[id] = v;
      }
      const clearOut = clear.filter((id) => id in s.answers);
      const pubOut: Record<string, boolean> = {};
      for (const id of PUBLIC_TOGGLE_IDS) if ((pub[id] ?? false) !== (s.publicOn[id] ?? false)) pubOut[id] = pub[id] ?? false;
      const batch: SaveBatch = { answers: answersOut, clear: clearOut, texts, publicOn: pubOut };
      if (Object.keys(answersOut).length + clearOut.length + Object.keys(texts).length + Object.keys(pubOut).length === 0) return true;
      const r = await api.save(batch);
      if (!r.ok) return false;
      Object.assign(s.answers, answersOut);
      for (const id of clearOut) delete s.answers[id];
      for (const [id, v] of Object.entries(texts)) if (v !== null) s.texts[id] = v;
      Object.assign(s.publicOn, pubOut);
      return true;
    },
    [api],
  );

  const run = async (task: () => Promise<boolean>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    const ok = await task();
    busyRef.current = false;
    if (alive.current) setBusy(false);
    return ok;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (alive.current) setToast(null);
    }, TOAST_MS);
  };

  // ── 2부 · 정리 ──
  const startTexts = useCallback(
    (sum: Summary | null) => {
      const a = answersOf(stateRef.current.committed);
      const left = TEXT_QS.filter((id) => !has(a, id));
      const prefill: Record<string, Draft> = {};
      for (const id of left) {
        const draftText = sum?.edited?.facts?.[id] ?? sum?.facts[id];
        if (draftText) prefill[id] = { kind: 'text', text: draftText };
      }
      setWork((w) => ({ ...w, ...prefill }));
      setStage(left.length ? 'texts' : 'done');
    },
    [],
  );

  const loadSummary = useCallback(async (): Promise<Summary | null> => {
    const r = await chat.summary();
    return r.ok ? r.data : null;
  }, [chat]);

  const analyzeNow = useCallback(
    async (sessionId: number) => {
      setStage('wrap');
      setAnalysis('running');
      const r = await chat.analyze(sessionId);
      if (!alive.current) return;
      const sum = r.ok && r.data === 'done' ? await loadSummary() : null;
      if (!alive.current) return;
      if (sum && sum.status === 'done') {
        setSummary(sum);
        setAnalysis('done');
        setStage('traits');
        return;
      }
      setAnalysis('waiting');
      setWrapNote(t('CHAT.SUMMARY.pending'));
      startTexts(sum);
    },
    [chat, loadSummary, startTexts],
  );

  const finishTalk = useCallback(
    async (how: 'done' | 'stop' | 'limit') => {
      const s = stateRef.current.session;
      if (slowTimer.current) clearTimeout(slowTimer.current);
      meter.current = null;
      if (how === 'stop') setTalk((l) => [...l, { kind: 'me', key: nextKey('stop'), qid: '', text: t('CHAT.UI.stopPressed') }, { kind: 'ai', key: nextKey('stopack'), text: t('CHAT.TALK.stopAck') }]);
      if (how === 'limit') setTalk((l) => [...l, { kind: 'ai', key: nextKey('limit'), text: t('CHAT.TALK.turnLimit') }]);
      if (!s) {
        startTexts(null);
        return;
      }
      await chat.setState(s.id, 'wrap'); // 실패해도 정리는 이어 간다(서버가 다음 분석에서 다시 본다)
      if (!alive.current) return;
      await analyzeNow(s.id);
    },
    [chat, analyzeNow, startTexts],
  );

  const aiShown = useCallback(() => {
    if (meter.current) meter.current.shown(); // AI 말이 다 나온 때 = 첫 글자까지 시간의 시작
  }, []);

  const enterPart2 = useCallback(
    async (s: Session, agreed: boolean) => {
      setBusy(true);
      let cur = s;
      if (cur.state === 'part1') {
        const r = await chat.setState(cur.id, 'part2');
        if (!alive.current) return;
        if (!r.ok) {
          setBusy(false);
          startTexts(null); // 2부를 못 열면 글 문항을 1부 말로 묻는다
          return;
        }
        cur = r.data;
      }
      const o = await chat.open(cur.id);
      if (!alive.current) return;
      setBusy(false);
      const first = o.ok ? o.data.reply : null;
      const head: Line[] = [
        ...(agreed ? [{ kind: 'ai' as const, key: nextKey('ck16done'), text: t('CHAT.CK16.done') }] : []),
        { kind: 'ai', key: nextKey('b2'), text: t('CHAT.BRIDGE.2'), badge: true },
        { kind: 'ai', key: nextKey('b3'), text: t('CHAT.BRIDGE.3') },
        { kind: 'ai', key: nextKey('open'), text: first?.text ?? slotFallback('intro') },
      ];
      setSession(cur);
      confirmed.current = cur.userTurns;
      setUserTurns(cur.userTurns);
      setTalk(head);
      setSlot(first?.slot ?? 'intro');
      setAsked(['intro']);
      meter.current = stateRef.current.ck16 || agreed ? createMeter(deps.monotonic) : null;
      setStage('part2');
      aiShown();
    },
    [chat, deps.monotonic, aiShown, startTexts],
  );

  const goBridge = useCallback(async () => {
    setStage('bridge');
    setBridge('starting');
    const r = await chat.start(deps.device);
    if (!alive.current) return;
    if (!r.ok) {
      if (r.reason === 'daily_limit') {
        setBridge('daily');
        setStage('paused');
        return;
      }
      startTexts(null); // 스위치 꺼짐 · 오류: 2부 없이 글 문항(1부 말)으로
      return;
    }
    setSession(r.data);
    setCk16(r.data.ck16);
    if (r.data.ck16 || stateRef.current.ck16Asked) {
      void enterPart2(r.data, false);
      return;
    }
    setBridge('ask');
  }, [chat, deps.device, enterPart2, startTexts]);

  // ── 읽기 · 이어서 하기 ──
  const apply = useCallback(async (result: LoadOutcome) => {
    if (!alive.current) return;
    if (!result.ok) {
      setLoadReason(result.reason);
      setPhase('error');
      return;
    }
    const snap = result.data;
    const mine = await store.load(snap.userKey);
    if (!alive.current) return;
    const drafts: Record<string, Draft> = {};
    for (const q of FLOW) drafts[q.id] = draftFromValue(q, snap.answers[q.id], snap.userKey);
    saved.current = {
      answers: Object.fromEntries(Object.entries(snap.answers).filter(([id]) => !TEXT_QS.includes(id))),
      texts: Object.fromEntries(Object.entries(snap.answers).filter(([id]) => TEXT_QS.includes(id)).map(([id, v]) => [id, String(v)])),
      publicOn: { ...snap.publicOn },
    };
    // 다른 화면(설문 v2)에서 이미 지나간 선택 문항은 건너뛴 것으로 본다: 첫 빈 필수 문항 앞의 빈 선택 문항
    const list = part1List(answersOf(drafts), true);
    const firstGap = list.findIndex((q) => q.required && !has(snap.answers, q.id));
    const passed = list.slice(0, firstGap < 0 ? list.length : firstGap).filter((q) => !q.required && !has(snap.answers, q.id)).map((q) => q.id);
    const skippedNow = [...new Set([...(mine?.skipped ?? []), ...passed])];
    setUserKey(snap.userKey);
    setCommitted(drafts);
    setPublicOn({ ...snap.publicOn });
    setSkipped(skippedNow);
    setPolLater(mine?.polLater ?? false);
    setCk16Asked(mine?.ck16Asked ?? false);
    stateRef.current = { ...stateRef.current, committed: drafts, userKey: snap.userKey, skipped: skippedNow, polLater: mine?.polLater ?? false, ck16Asked: mine?.ck16Asked ?? false };
    if (politics) {
      const p = await politics.load();
      if (!alive.current) return;
      if (p.ok) setPol({ loaded: true, serverConsent: p.data.consent, checked: false, value: p.data.position, savedValue: p.data.answered ? p.data.position : null });
    }
    if (religion) {
      const r = await religion.load();
      if (!alive.current) return;
      if (r.ok) setRelOn(r.on);
    }
    const started = Object.keys(snap.answers).length > 0;
    const later = mine && ['part2', 'wrap', 'traits', 'texts', 'done', 'paused'].includes(mine.stage) ? mine.stage : null;
    setPhase('ready');
    if (later && mine?.sessionId && ['part2', 'wrap', 'traits'].includes(later)) {
      const r = await chat.resume(mine.sessionId);
      if (!alive.current) return;
      const s = r.ok ? r.data.session : null;
      if (s) {
        setSession(s);
        setCk16(s.ck16);
        confirmed.current = s.userTurns;
        setUserTurns(s.userTurns);
        if (s.state === 'part2') {
          const lines: Line[] = r.ok ? r.data.turns.map((x) => (x.role === 'ai' ? { kind: 'ai' as const, key: `t-${x.seq}`, text: x.text ?? '' } : { kind: 'me' as const, key: `t-${x.seq}`, qid: '', text: x.text ?? '' })) : [];
          lines.push({ kind: 'ai', key: 'resume2', text: t('CHAT.RESUME.part2') });
          const slots = r.ok ? r.data.turns.filter((x) => x.role === 'ai' && x.slot).map((x) => x.slot as string) : [];
          setTalk(lines);
          setAsked(slots);
          setSlot(slots.at(-1) ?? null);
          meter.current = s.ck16 ? createMeter(deps.monotonic) : null; // 이어하기 중이던 메시지는 재지 않는다(다음 AI 말부터)
          setStage('part2');
          return;
        }
        setWrapNote(t('CHAT.RESUME.summary'));
        if (later === 'traits') {
          const sum = await loadSummary();
          if (!alive.current) return;
          if (sum && sum.status === 'done') {
            setSummary(sum);
            setAnalysis('done');
            setStage('traits');
            return;
          }
        }
        void analyzeNow(s.id);
        return;
      }
    }
    if (later === 'texts' || later === 'done') {
      startTexts(await loadSummary());
      return;
    }
    if (!started) {
      setStage('intro');
      return;
    }
    setStage('part1');
    setResumeAt(mine?.updatedAt ?? 0);
  }, [store, politics, religion, chat, deps.monotonic, loadSummary, analyzeNow, startTexts]);

  useEffect(() => {
    alive.current = true;
    void api.load().then(apply);
    // 스크린리더가 켜져 있으면 행동 숫자를 보내지 않는다(행동지표 4-2 ③). 웹은 이 값을 늘 참으로 주어 기기 앱에서만 본다
    if (Platform.OS !== 'web')
      void AccessibilityInfo.isScreenReaderEnabled()
        .then((on) => {
          screenReader.current = on;
        })
        .catch(() => undefined);
    return () => {
      alive.current = false;
      for (const x of [slowTimer.current, toastTimer.current]) if (x) clearTimeout(x);
    };
    // 처음 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 앱이 뒤로 가면 행동 숫자 시계에서 그 시간을 뺀다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => meter.current?.background(next === 'active'));
    return () => sub.remove();
  }, []);

  // 1부가 끝나면(물을 문항 0 · 정치 답 또는 나중에) 2부 다리로
  useEffect(() => {
    if (phase !== 'ready' || stage !== 'part1' || editing || resumeAt !== null) return;
    if (view.ask !== null) return undefined;
    const go = setTimeout(() => void goBridge(), 0);
    return () => clearTimeout(go);
  }, [phase, stage, editing, resumeAt, view.ask, goBridge]);

  // ── 1부 보내기 · 건너뛰기 · 고치기 ──
  const draftFor = (id: string): Draft => work[id] ?? committed[id] ?? emptyDraft(qOf(id), userKey);

  // 보낸 뒤 저장된 답 묶음(실패 · 막힘이면 null)
  const sendAnswer = async (id: string, d: Draft): Promise<Readonly<Record<string, Draft>> | null> => {
    if (busyRef.current) return null;
    const q = qOf(id);
    const next = { ...committed, [id]: d };
    const c = check(q, d, answersOf(next));
    if (c.state === 'empty' && isPassable(q, c) && editing !== id) {
      skipOne(id); // 빈 선택 문항 = 건너뛰기
      return null;
    }
    if (c.state !== 'ok') {
      setReason(blockMessage(q, c));
      return null;
    }
    const before = view.ask && typeof view.ask !== 'string' ? view.ask.id : null;
    const ok = await run(() => persist(next, publicOn));
    if (!alive.current) return null;
    if (!ok) {
      setSaveError(t('CHAT.SAVE.failed'));
      return null;
    }
    setSaveError(null);
    setReason(null);
    setCommitted(next);
    setWork((w) => {
      const out = { ...w };
      delete out[id];
      return out;
    });
    if (editing === id) {
      setEditing(null);
      const after = buildPart1(answersOf(next), { userKey, interview: true, skipped, pol: polState, rel: relState, schoolName });
      const nowAsk = after.ask && typeof after.ask !== 'string' ? after.ask.id : null;
      const chain = nowAsk !== null && nowAsk !== before && FLOW.findIndex((x) => x.id === nowAsk) < FLOW.findIndex((x) => x.id === (before ?? 'zz'));
      setFlash({ after: id, texts: [t('CHAT.EDIT.done'), ...(chain ? [t('CHAT.EDIT.chain')] : [])] });
    } else setFlash(null);
    return next;
  };

  const skipOne = (id: string) => {
    setSkipped((s) => (s.includes(id) ? s : [...s, id]));
    setReason(null);
    setFlash(null);
  };

  const startEdit = (id: string) => {
    if (busy || stage !== 'part1') return;
    setEditing(id);
    setReason(null);
    setFlash(null);
    setWork((w) => ({ ...w, [id]: draftFromValue(qOf(id), answers[id], userKey) }));
  };

  const keepEdit = () => {
    if (!editing) return;
    const id = editing;
    setEditing(null);
    setReason(null);
    setWork((w) => {
      const out = { ...w };
      delete out[id];
      return out;
    });
  };

  // 정치 막대: 새 동의면 CK15 기록 → set_politics(누르기 전 저장 0, 설문 v2 와 같은 순서)
  const sendPolitics = async () => {
    if (!politics || busyRef.current) return;
    const why = polBlock(pol);
    if (why) {
      setReason(why);
      return;
    }
    const p = pol;
    const ok = await run(async () => {
      if (!p.serverConsent) {
        const agreed = await politics.agree();
        if (!agreed.ok) return false;
      }
      const r = await politics.save(p.value ?? 50);
      if (!r.ok) return false;
      if (alive.current) setPol((x) => ({ ...x, serverConsent: true, checked: false, value: r.data, savedValue: r.data }));
      return true;
    });
    if (!alive.current) return;
    if (!ok) setSaveError(t('CHAT.SAVE.failed'));
    else {
      setSaveError(null);
      setReason(null);
    }
  };

  // 종교 동의 카드(3부-사): [동의하고 답할게요] = 체크가 있어야 CK4 동의 기록 → A06 질문(고치는 중이면 그 자리 입력) · [동의하지 않을게요] = '동의 안 함' 기록 + A06 '답하지 않음'
  const agreeReligion = async () => {
    if (!religion || busyRef.current) return;
    if (!relCheck) {
      setReason(REL.needCheck);
      return;
    }
    const ok = await run(async () => (await religion.record(true)).ok);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(t('CHAT.SAVE.failed'));
      return;
    }
    setSaveError(null);
    setReason(null);
    setRelCheck(false);
    setRelOn(true);
    setRelAgreed(true);
    if (editing === RELIGION_ID) setWork((w) => ({ ...w, [RELIGION_ID]: emptyDraft(qOf(RELIGION_ID), userKey) }));
  };
  const declineReligion = async () => {
    if (!religion || busyRef.current) return;
    const next = { ...committed, [RELIGION_ID]: { kind: 'choice', code: 'decline' } as Draft };
    const ok = await run(async () => (await religion.record(false)).ok && (await persist(next, publicOn)));
    if (!alive.current) return;
    if (!ok) {
      setSaveError(t('CHAT.SAVE.failed'));
      return;
    }
    setSaveError(null);
    setReason(null);
    setRelCheck(false);
    setCommitted(next);
    setWork((w) => {
      const out = { ...w };
      delete out[RELIGION_ID];
      return out;
    });
    if (editing === RELIGION_ID) setEditing(null);
  };
  const relCardNode = (key: string) => (
    <RelCard
      key={key}
      checked={relCheck}
      reason={reason}
      busy={busy}
      play
      onCheck={() => {
        setRelCheck((c) => !c);
        setReason(null);
        setSaveError(null);
      }}
      onAgree={() => void agreeReligion()}
      onDecline={() => void declineReligion()}
      onMore={() => setRelSheet(true)}
    />
  );

  const tempSave = async () => {
    const ok = await run(() => persist(committed, publicOn));
    if (!alive.current) return;
    writeLocal();
    if (ok) showToast(SV2.savedToast);
    else setSaveError(t('CHAT.SAVE.failed'));
  };

  // ── CK16 ──
  const answerCk16 = async (agree: boolean) => {
    const s = session;
    if (!s || busyRef.current) return;
    if (agree) {
      const ok = await run(async () => (await chat.agreeCk16()).ok);
      if (!alive.current) return;
      if (!ok) {
        setSaveError(t('CHAT.SAVE.failed'));
        return;
      }
      setCk16(true);
      stateRef.current = { ...stateRef.current, ck16: true };
    }
    setSaveError(null);
    setCk16Asked(true);
    void enterPart2(s, agree);
  };

  // ── 2부 보내기 ──
  const sendTurn = async () => {
    const st = stateRef.current;
    const body = text.normalize('NFC').trim();
    if (!body || waiting || !st.session) return;
    if (st.userTurns >= MAX_TURNS) {
      void finishTalk('limit');
      return;
    }
    const measured = st.ck16 && meter.current ? meter.current.finish(body) : null;
    const behavior = behaviorPayload(st.ck16, screenReader.current ? null : measured);
    const meKey = nextKey('me');
    const mine: Pending = { key: meKey, text: body, behavior, no: 0 };
    setText('');
    setTalk((l) => [...l, { kind: 'me', key: meKey, qid: '', text: body }]);
    setWaiting(true);
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => {
      if (alive.current) setSlow(true);
    }, deps.slowMs);
    // 앞 턴에서 못 보낸 글을 먼저 한 번 다시 보낸다(답은 이미 예비 질문으로 이어 갔으니 버린다). 또 실패하면 그 자리에 '보내지 못한 글'
    const before = pending.current;
    if (before) {
      pending.current = null;
      const r0 = await chat.turn(st.session.id, before.text, before.behavior, before.no);
      if (!alive.current) return;
      if (!r0.ok && r0.reason === 'turn_limit') {
        setWaiting(false);
        void finishTalk('limit');
        return;
      }
      if (!r0.ok) setUnsent((u) => ({ ...u, [before.key]: before }));
      else {
        confirmed.current = Math.max(confirmed.current, r0.data.turn);
        // 서버가 이미 받았던 턴(duplicate)이면 그때의 AI 말을 그 글 뒤(지금 말풍선 앞)에 이어 붙인다. 새로 받은 턴의 답은 버린다(대화는 예비 질문으로 이어 갔다)
        if (r0.data.duplicate) {
          const dup: Line = { kind: 'ai', key: nextKey('dup'), text: r0.data.reply.text };
          setTalk((l) => {
            const at = l.findIndex((x) => x.key === meKey);
            return at < 0 ? [...l, dup] : [...l.slice(0, at), dup, ...l.slice(at)];
          });
        }
      }
    }
    mine.no = confirmed.current + 1;
    const r = await chat.turn(st.session.id, body, behavior, mine.no);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (!alive.current) return;
    setWaiting(false);
    setSlow(false);
    if (r.ok) {
      const d = r.data;
      confirmed.current = Math.max(confirmed.current, d.turn);
      setUserTurns(d.turn);
      const notes: Line[] = d.guard === 'flagged' ? [{ kind: 'note', key: nextKey('mask'), text: t('CHAT.TALK.masked') }] : d.guard === 'blocked' ? [{ kind: 'note', key: nextKey('guard'), text: t('CHAT.TALK.guard') }] : [];
      setTalk((l) => [...l, ...notes, { kind: 'ai', key: nextKey('ai'), text: d.reply.text }]);
      if (d.reply.slot) {
        setSlot(d.reply.slot);
        setAsked((a) => (a.includes(d.reply.slot as string) ? a : [...a, d.reply.slot as string]));
      }
      if (d.done) {
        void finishTalk('done');
        return;
      }
      if (d.turnsLeft <= 0 || d.turn >= MAX_TURNS) {
        void finishTalk('limit');
        return;
      }
      aiShown();
      return;
    }
    if (r.reason === 'turn_limit') {
      void finishTalk('limit');
      return;
    }
    // 앱 쪽 예비 질문: 통신 · 서버 실패에도 멈추지 않는다(다음 빈 칸). 못 보낸 글은 기기에 잠시 두었다가 다음 턴 앞에 다시
    pending.current = mine;
    setUserTurns((n) => n + 1);
    const nextSlot = SLOT_ORDER.find((x) => !st.asked.includes(x));
    if (!nextSlot) {
      setTalk((l) => [...l, { kind: 'ai', key: nextKey('end'), text: pick('CHAT.END', st.userKey) }]);
      void finishTalk('done');
      return;
    }
    setTalk((l) => [...l, { kind: 'ai', key: nextKey('fbl'), text: t('CHAT.TALK.fallbackLead') }, { kind: 'ai', key: nextKey('fb'), text: slotFallback(nextSlot) }]);
    setSlot(nextSlot);
    setAsked((a) => [...a, nextSlot]);
    aiShown();
  };

  // '보내지 못한 글' 다시 보내기(답은 버린다 — 대화는 이미 이어 갔다)
  const resend = async (key: string) => {
    const p = unsent[key];
    const s = stateRef.current.session;
    if (!p || !s || busyRef.current) return;
    let dupText: string | null = null;
    const ok = await run(async () => {
      const r = await chat.turn(s.id, p.text, p.behavior, confirmed.current + 1);
      if (!r.ok) return false;
      confirmed.current = Math.max(confirmed.current, r.data.turn);
      if (r.data.duplicate) dupText = r.data.reply.text;
      return true;
    });
    if (!alive.current || !ok) return;
    const dupLine = dupText;
    if (dupLine !== null) setTalk((l) => [...l, { kind: 'ai', key: nextKey('dup'), text: dupLine }]);
    setUnsent((u) => {
      const out = { ...u };
      delete out[key];
      return out;
    });
  };

  const onType = (v: string) => {
    setText(v);
    meter.current?.change(v);
  };

  // ── 07 내 성향 ──
  const introOf = (s: Summary | null) => s?.edited?.facts?.T01 ?? s?.facts.T01 ?? '';
  const summaryOf = (s: Summary | null) => s?.edited?.summary ?? s?.summary ?? '';

  const traitsOk = async () => {
    const intro = introOf(summary);
    const q = qOf('T01');
    const d: Draft = { kind: 'text', text: intro };
    if (intro && !has(answers, 'T01') && check(q, d, answers).state === 'ok') {
      // 자기소개 초안을 본인이 확인 → 설문 글 T01 로(save_free_texts, 설문 v2 와 같은 길)
      const next = { ...committed, T01: d };
      const ok = await run(() => persist(next, publicOn));
      if (!alive.current) return;
      if (!ok) {
        setSaveError(t('CHAT.SAVE.failed'));
        return;
      }
      setCommitted(next);
      stateRef.current = { ...stateRef.current, committed: next };
    }
    setSaveError(null);
    startTexts(summary);
  };

  const traitsSave = async () => {
    if (!traitsEdit || busyRef.current) return;
    const e = traitsEdit;
    const ok = await run(async () => (await chat.edit({ summary: e.summary.trim() || null, facts: { T01: e.intro.trim() || null } })).ok);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(t('CHAT.SAVE.failed'));
      return;
    }
    const sum = await loadSummary();
    if (!alive.current) return;
    if (sum) setSummary(sum);
    setTraitsEdit(null);
    setShowOriginal(false);
    setSaveError(null);
  };

  const review = () => {
    writeLocal();
    if (onDone) onDone();
    else router.push({ pathname: '/survey/[step]', params: { step: 'v2' } });
  };

  // ── 그리기 ──
  if (phase !== 'ready') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="chat-screen">
        <ScreenHeader title={SV2.headerTitle} testID="chat-header" />
        <View style={styles.center}>
          {phase === 'loading' ? (
            <>
              <Ring size={layout.splashRing} stroke={layout.splashRingStroke} testID="chat-loading-ring" />
              <AppText variant="body" testID="chat-loading">
                {SV2.loading}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="body" style={styles.centerText} testID="chat-load-error">
                {loadReason === 'network' ? SV2.offline : SV2.server}
              </AppText>
              <Button
                label={SV2.retry}
                variant="secondary"
                onPress={() => {
                  setPhase('loading');
                  void api.load().then(apply);
                }}
                testID="chat-retry"
              />
            </>
          )}
        </View>
      </Screen>
    );
  }

  // 말풍선은 처음 놓일 때 한 번 떠오른다(열쇠가 같으면 다시 그려도 그대로)
  const renderLine = (l: Line, dim: boolean) => {
    const play = true;
    if (l.kind === 'topic') return <Appear key={l.key} play={play}><TopicLine text={l.text} testID={`chat-${l.key}`} /></Appear>;
    if (l.kind === 'note') return <Appear key={l.key} play={play}><Note text={l.text} testID={`chat-${l.key}`} /></Appear>;
    if (l.kind === 'me') {
      const editable = stage === 'part1' && l.qid !== '' && l.qid !== 'POL' && editing === null;
      return (
        <Appear key={l.key} play={play}>
          <MeBubble text={l.text} dim={dim} onPress={editable ? () => startEdit(l.qid) : undefined} testID={`chat-${l.key}`} />
          {unsent[l.key] ? (
            <View style={styles.unsent} testID={`chat-unsent-${l.key}`}>
              <AppText variant="caption" tone="accent">
                {t('CHAT.TALK.unsent')}
              </AppText>
              <TextButton label={t('CHAT.TALK.resend')} onPress={() => void resend(l.key)} testID={`chat-resend-${l.key}`} />
            </View>
          ) : null}
        </Appear>
      );
    }
    return (
      <Appear key={l.key} play={play}>
        <AiBubble text={l.text} badge={l.badge} small={l.small} dim={dim} testID={`chat-${l.key}`} />
      </Appear>
    );
  };

  const search = (query: string, courses: Parameters<typeof api.searchSchools>[1]['courses']) => api.searchSchools(query, { courses, limit: 8 });

  // 1부 대화(고치는 중이면 그 답 자리에 입력 부품, 뒤는 흐리게)
  const part1Nodes = () => {
    const out: ReactNode[] = [];
    let dim = false;
    for (const l of view.lines) {
      if (l.kind === 'me' && l.qid === editing && editing) {
        const q = qOf(editing);
        out.push(<Appear key={`edit-${editing}`} play><AiBubble text={t('CHAT.EDIT.start')} testID="chat-edit-start" /></Appear>);
        if (editing === RELIGION_ID && religion && relOn === false) {
          out.push(relCardNode('card-edit-REL')); // 유효한 CK4 가 없으면 고칠 때도 카드부터(L22 D2 ④ — 회원이 누를 때만 다시 연다)
          dim = true;
          continue;
        }
        out.push(
          <ChatInput
            key={`card-edit-${editing}`}
            q={q}
            draft={draftFor(editing)}
            answers={answers}
            publicOn={publicOn[editing] ?? false}
            reason={reason}
            editing
            busy={busy}
            play={false}
            onDraft={(d) => {
              setWork((w) => ({ ...w, [q.id]: d }));
              setReason(null);
            }}
            onSend={(d) => void sendAnswer(q.id, d)}
            onSkip={() => undefined}
            onKeep={keepEdit}
            onPublic={() => setPublicOn((p) => ({ ...p, [q.id]: !(p[q.id] ?? false) }))}
            search={search}
          />,
        );
        dim = true;
        continue;
      }
      out.push(renderLine(l, dim));
      if (flash && l.kind === 'me' && l.qid === flash.after) flash.texts.forEach((x, i) => out.push(<Appear key={`flash-${flash.after}-${i}`} play><AiBubble text={x} testID={`chat-flash-${i}`} /></Appear>));
    }
    return out;
  };

  const ask = view.ask;
  const showPart1 = stage === 'part1' || stage === 'bridge' || stage === 'paused';
  const nowName = stage === 'part2' ? slotName(slot) : showPart1 ? (view.section ? sectionName(view.section) : null) : null;
  const rightLabel = stage === 'part1' || stage === 'bridge' ? t('CHAT.UI.pause') : stage === 'part2' ? t('CHAT.TALK.stop') : undefined;
  const onRight = stage === 'part2' ? () => void finishTalk('stop') : () => void tempSave();

  // 남은 글 문항(T01~T03): 답한 것은 말풍선, 지금 것은 입력 부품
  const textNodes = () => {
    const out: ReactNode[] = [];
    if (wrapNote) out.push(renderLine({ kind: 'ai', key: 'wrapnote', text: wrapNote }, false));
    for (const id of TEXT_QS) {
      const q = qOf(id);
      out.push(renderLine({ kind: 'ai', key: `tq-${id}`, text: pick(`CHAT.${id}`, userKey) }, false));
      if (has(answers, id)) {
        out.push(renderLine({ kind: 'me', key: `tme-${id}`, qid: '', text: String(answers[id]) }, false));
        out.push(renderLine({ kind: 'ai', key: `tack-${id}`, text: fill(t(`CHAT.${id}.ack.any`), varsFor(id, answers, schoolName)) }, false));
        continue;
      }
      if (stage === 'texts') {
        out.push(
          <ChatInput
            key={`card-${id}`}
            q={q}
            draft={draftFor(id)}
            answers={answers}
            publicOn={false}
            reason={reason}
            editing={false}
            busy={busy}
            play
            onDraft={(d) => {
              setWork((w) => ({ ...w, [id]: d }));
              setReason(null);
            }}
            onSend={(d) =>
              void (async () => {
                const next = await sendAnswer(id, d);
                if (next && TEXT_QS.every((x) => has(answersOf(next), x))) setStage('done');
              })()
            }
            onSkip={() => undefined}
            onKeep={() => undefined}
            onPublic={() => undefined}
            search={search}
          />,
        );
      }
      break;
    }
    return out;
  };

  const sum = summary;
  const chips = (sum?.styleChips ?? []).filter((c) => STYLE_CODES.includes(c));
  const marriageLines = [
    ...(sum?.reason ? [sum.reason] : []),
    ...(typeof answers.E01 === 'string' ? [`${t('CHAT.TRAITS.when')} · ${optText('E01', answers.E01)}`] : []),
    ...(typeof answers.E07 === 'string' ? [`${t('CHAT.TRAITS.money')} · ${optText('E07', answers.E07)}`] : []),
  ];

  const body = (
    <>
      {stage === 'intro' ? (
        <Rise testID="chat-intro">
          <View style={styles.block}>
            <AppText variant="captionMedium" tone="accent" testID="chat-ai-notice">
              {t('CHAT.START.title')}
            </AppText>
            {[0, 1, 2, 3, 4].map((i) => (
              <AiBubble key={i} text={t(`CHAT.START.points.${i}`)} badge={i === 0} testID={`chat-intro-${i}`} />
            ))}
          </View>
        </Rise>
      ) : null}

      {showPart1 && resumeAt !== null ? (
        <>
          {part1Nodes()}
          {resumeAt > 0 ? <TopicLine text={fill(t('CHAT.UI.stopped'), { 월: String(new Date(resumeAt).getMonth() + 1), 일: String(new Date(resumeAt).getDate()) })} testID="chat-stopped" /> : null}
          <AiBubble text={t('CHAT.RESUME.part1')} testID="chat-resume" />
        </>
      ) : null}

      {showPart1 && resumeAt === null ? (
        <>
          {part1Nodes()}
          {stage === 'part1' && !editing && ask === 'REL' ? relCardNode('card-REL') : null}
          {stage === 'part1' && !editing && ask && typeof ask !== 'string' ? (
            <ChatInput
              key={`card-${ask.id}`}
              q={ask}
              draft={draftFor(ask.id)}
              answers={answers}
              publicOn={publicOn[ask.id] ?? false}
              reason={reason}
              editing={false}
              busy={busy}
              play
              onDraft={(d) => {
                setWork((w) => ({ ...w, [ask.id]: d }));
                setReason(null);
                setSaveError(null);
              }}
              onSend={(d) => void sendAnswer(ask.id, d)}
              onSkip={() => skipOne(ask.id)}
              onKeep={() => undefined}
              onPublic={() => setPublicOn((p) => ({ ...p, [ask.id]: !(p[ask.id] ?? false) }))}
              search={search}
            />
          ) : null}
          {stage === 'part1' && !editing && ask === 'POL' ? (
            <PolCard
              pol={pol}
              reason={reason}
              busy={busy}
              play
              onCheck={() => {
                setPol((x) => ({ ...x, checked: !x.checked }));
                setReason(null);
              }}
              onChange={(v) => {
                setPol((x) => ({ ...x, value: v }));
                setReason(null);
              }}
              onSend={() => void sendPolitics()}
              onLater={() => {
                setPolLater(true);
                setReason(null);
              }}
            />
          ) : null}
          {stage === 'bridge' || stage === 'paused' ? renderLine({ kind: 'ai', key: 'bridge1', text: t('CHAT.BRIDGE.1') }, false) : null}
          {stage === 'paused' ? renderLine({ kind: 'ai', key: 'daily', text: t('CHAT.TALK.dailyLimit') }, false) : null}
          {stage === 'bridge' && bridge === 'ask' ? (
            <Appear play testID="chat-ck16">
              <View style={styles.ck16}>
                <View style={styles.ck16Head}>
                  <AppText variant="bodyBold" accessibilityRole="header">
                    {t('CHAT.CK16.title')}
                  </AppText>
                </View>
                {(['what', 'why', 'keys', 'keep', 'withdraw', 'optional'] as const).map((k) => (
                  <AppText key={k} variant="caption" tone="text" testID={`chat-ck16-${k}`}>
                    {t(`CHAT.CK16.${k}`)}
                  </AppText>
                ))}
                <LaterConsentLink code="CK16" label={t('CHAT.CK16.more')} full testID="chat-ck16-more" />
                {/* QP-17: 두 버튼 글이 길어 360 폭에서 두 줄로 꺾이므로 나란히 대신 위아래로 둔다 */}
                <View style={styles.stack}>
                  <Button label={t('CHAT.CK16.agree')} variant="secondary" onPress={() => void answerCk16(true)} disabled={busy} testID="chat-ck16-agree" />
                  <Button label={t('CHAT.CK16.skip')} variant="secondary" onPress={() => void answerCk16(false)} disabled={busy} testID="chat-ck16-skip" />
                </View>
              </View>
            </Appear>
          ) : null}
        </>
      ) : null}

      {stage === 'part2' || stage === 'wrap' ? (
        <>
          {talk.map((l) => renderLine(l, false))}
          {waiting ? <TypingDots slow={slow} testID="chat-typing" /> : null}
        </>
      ) : null}

      {stage === 'wrap' ? (
        <Appear play testID="chat-wrap">
          <View style={styles.wrapCard}>
            <Illustration scene="organizing" maxWidth={illustration.state} />
            <AppText variant="title" accessibilityRole="header" style={styles.centerText}>
              {t('CHAT.SUMMARY.title')}
            </AppText>
            <AppText variant="body" style={styles.centerText}>
              {analysis === 'waiting' ? t('CHAT.SUMMARY.pending') : t('CHAT.SUMMARY.body')}
            </AppText>
            {wrapNote ? (
              <AppText variant="caption" tone="sub" style={styles.centerText} testID="chat-wrap-note">
                {wrapNote}
              </AppText>
            ) : null}
          </View>
        </Appear>
      ) : null}

      {stage === 'traits' && sum ? (
        <Appear play testID="chat-traits">
          <View style={styles.block}>
            <AppText variant="captionBold" tone="accent" accessibilityLabel={t('CHAT.START.aiBadgeA11y')}>
              {t('CHAT.START.aiBadge')}
            </AppText>
            <AppText variant="heading" accessibilityRole="header">
              {t('CHAT.TRAITS.title')}
            </AppText>
            <AppText variant="body" tone="text">
              {t('CHAT.TRAITS.lead')}
            </AppText>
            <View style={styles.paper}>
              <Field label={t('CHAT.TRAITS.summary')}>
                {traitsEdit ? (
                  <TextField label={t('CHAT.TRAITS.summary')} value={traitsEdit.summary} onChangeText={(v) => setTraitsEdit((x) => (x ? { ...x, summary: v } : x))} multiline maxLength={200} testID="chat-traits-summary-input" />
                ) : (
                  <AppText variant="body" testID="chat-traits-summary">
                    {summaryOf(sum)}
                  </AppText>
                )}
              </Field>
              {marriageLines.length > 0 ? (
                <Field label={t('CHAT.TRAITS.marriage')}>
                  {marriageLines.map((x) => (
                    <AppText key={x} variant="body">
                      {x}
                    </AppText>
                  ))}
                </Field>
              ) : null}
              <Field label={t('CHAT.TRAITS.intro')}>
                {traitsEdit ? (
                  <TextField label={t('CHAT.TRAITS.intro')} value={traitsEdit.intro} onChangeText={(v) => setTraitsEdit((x) => (x ? { ...x, intro: v } : x))} multiline maxLength={300} testID="chat-traits-intro-input" />
                ) : (
                  <AppText variant="body" testID="chat-traits-intro">
                    {introOf(sum)}
                  </AppText>
                )}
              </Field>
              {traitsEdit ? (
                <>
                  <TextButton label={t('CHAT.TRAITS.original')} align="start" onPress={() => setShowOriginal((x) => !x)} testID="chat-traits-original" />
                  {showOriginal ? (
                    <View style={styles.original} testID="chat-traits-original-text">
                      <AppText variant="caption" tone="sub">
                        {sum.summary ?? ''}
                      </AppText>
                      <AppText variant="caption" tone="sub">
                        {sum.facts.T01 ?? ''}
                      </AppText>
                    </View>
                  ) : null}
                </>
              ) : chips.length > 0 ? (
                <Field label={t('CHAT.TRAITS.style')}>
                  <View style={styles.chips}>
                    {chips.map((c) => (
                      <View key={c} style={styles.styleChip} testID={`chat-style-${c}`}>
                        <AppText variant="captionMedium" tone="accent">
                          {t(`CHAT.TRAITS.style.${c}`)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </Field>
              ) : null}
            </View>
            <AppText variant="caption" tone="sub" testID="chat-traits-note">
              {t('CHAT.TRAITS.note')}
            </AppText>
          </View>
        </Appear>
      ) : null}

      {stage === 'texts' || stage === 'done' ? textNodes() : null}

      {saveError ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="chat-save-error">
          {saveError}
        </AppText>
      ) : null}
    </>
  );

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} testID="chat-screen">
      <KeyboardAvoid>
        <ScreenHeader title={stage === 'traits' ? t('CHAT.TRAITS.header') : SV2.headerTitle} rightLabel={rightLabel} onRight={rightLabel ? onRight : undefined} testID="chat-header" />
        {nowName ? (
          <View style={styles.now} accessible accessibilityRole="text" testID="chat-now">
            <Rise key={nowName} distance={0} duration={150}>
              <AppText variant="captionMedium" tone="sub">
                {`${t('CHAT.UI.now')} · ${nowName}`}
              </AppText>
            </Rise>
          </View>
        ) : null}
        <ScrollView
          ref={scroller}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!editing) scroller.current?.scrollToEnd({ animated: !reduce });
          }}
          testID="chat-scroll">
          {body}
        </ScrollView>

        <BottomCTA testID="chat-cta">
          {stage === 'intro' ? (
            <Button
              label={t('CHAT.START.start')}
              onPress={() => {
                setStage('part1');
                setResumeAt(null);
              }}
              testID="chat-start"
            />
          ) : null}
          {showPart1 && resumeAt !== null ? (
            <CtaPair
              secondary={<Button label={t('CHAT.SUMMARY.next')} variant="secondary" onPress={review} testID="chat-review" />}
              primary={<Button label={t('CHAT.RESUME.button')} onPress={() => setResumeAt(null)} testID="chat-resume-go" />}
            />
          ) : null}
          {stage === 'part1' && resumeAt === null ? (
            <AppText variant="caption" tone="sub" style={styles.centerText} testID="chat-edit-hint">
              {t('CHAT.UI.editHint')}
            </AppText>
          ) : null}
          {stage === 'part2' ? <ChatComposer value={text} onChange={onType} onSend={() => void sendTurn()} disabled={waiting} /> : null}
          {stage === 'wrap' || stage === 'done' || stage === 'paused' ? <Button label={t('CHAT.SUMMARY.next')} variant={stage === 'done' ? 'primary' : 'secondary'} onPress={review} testID="chat-review" /> : null}
          {stage === 'traits' && !traitsEdit ? (
            <CtaPair
              secondary={<Button label={t('CHAT.TRAITS.edit')} variant="secondary" onPress={() => setTraitsEdit({ summary: summaryOf(sum), intro: introOf(sum) })} testID="chat-traits-edit" />}
              primary={<Button label={t('CHAT.TRAITS.ok')} onPress={() => void traitsOk()} loading={busy} testID="chat-traits-ok" />}
            />
          ) : null}
          {stage === 'traits' && traitsEdit ? (
            <CtaPair
              secondary={
                <Button
                  label={t('CHAT.TRAITS.cancel')}
                  variant="secondary"
                  onPress={() => {
                    setTraitsEdit(null);
                    setShowOriginal(false);
                  }}
                  testID="chat-traits-cancel"
                />
              }
              primary={<Button label={t('CHAT.TRAITS.save')} onPress={() => void traitsSave()} loading={busy} testID="chat-traits-save" />}
            />
          ) : null}
        </BottomCTA>
        <ConsentSummarySheet item={relSheet ? REL_SHEET : null} onClose={() => setRelSheet(false)} />
        <Toast text={toast} testID="chat-toast" />
      </KeyboardAvoid>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="sub">
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s8, marginTop: space.s8 },
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s48, gap: space.s12 },
  now: { paddingHorizontal: size.screenPadding, paddingBottom: space.s8 },
  block: { gap: space.s12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centerText: { textAlign: 'center' },
  ck16: { gap: space.s8, borderRadius: radius.lg, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, padding: space.s16 },
  ck16Head: { flexDirection: 'row', alignItems: 'center', gap: space.s8 },
  wrapCard: { alignItems: 'center', gap: space.s12, paddingVertical: space.s16 },
  paper: { gap: space.s16, borderRadius: radius.xl, backgroundColor: colors.card, padding: space.s16 },
  field: { gap: space.s4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  styleChip: { minHeight: size.chip, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.accentSoft, paddingHorizontal: space.s12 },
  unsent: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.s8 },
  original: { gap: space.s4, borderRadius: radius.md, backgroundColor: colors.bg, padding: space.s12 },
});
