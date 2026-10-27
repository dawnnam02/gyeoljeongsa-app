// 화면 04 정식 설문 v2(F20 · K17 · D35). 원본: 기획/설문_v2.md · 설문_v2_문항표.csv · 설문_인수조건.md C-1~C-5 · 마케팅/카피.md 9장.
//  흐름: 시작 안내 → 기본 → 학력 → 직업 → 경제 → 가족 → 생활 → 가치관 → 결혼관 → 희망 조건(한 쪽에 한 문항, 64) → 결혼 이야기(선택) → 세부사항(선택) → 검토 → 05 사진
//  · 위: ‹ + '설문' + [임시 저장] · 섹션 9칸 진행 막대(지난 섹션 꽉 참 · 지금 섹션 비율) + '{섹션} · {n}/{섹션 문항 수}'(보이는 문항만 센다)
//  · 문항 머리: 섹션 첫 문항에 섹션 머리 · 질문 · 도움말 · 공개 범위 줄 · 자물쇠 · AI 미전송 · (T01~T03) AI 안내 상자 · (결혼관 6) '내 프로필에 보이기'
//  · 하나 고르기 · 구간 · 5단계는 고르면 잠깐 뒤 다음 문항(motion scene.survey). '말하고 싶지 않아요'(안내 한 줄을 읽게) · 종교 '그 외' · 공개 스위치 문항은 넘기지 않는다
//  · [다음]은 그 문항(과 자동 값 · 숨은 문항 지우기)을 서버에 저장한 뒤 이동. 실패하면 머물고 문구. [이전] · ‹ 는 저장 없이 앞으로(값은 남는다)
//  · [임시 저장]은 검증 없이 맞게 쓴 답을 저장하고 머문다 + 토스트 · 앱이 백그라운드로 가면 조용히 저장 · 입력은 곧바로 기기(민감 저장소)에도 남긴다
//  · 다시 열면 서버 답 + 기기에 남은 답으로 채우고 첫 빈 필수 문항부터(N03). 다 찼으면 선택 단계 · 검토로
//  · 검토: 주제별 답 · [고치기](고친 뒤 새로 생긴 빈 문항을 지나 검토로 돌아옴) · W1~W5 · [제출하고 사진 올리기] → 05
// 등급 · 점수 숫자는 화면 · 코드에 없다(등급은 서버만). 글은 copy.ts · questionCopy.ts 만.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { Ring } from '@/components/Ring';
import { BottomCTA, CtaPair, Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { schoolIndex } from '@/data/schools/schoolSearch';
import { ConsentSummarySheet } from '@/features/consent/ConsentSummarySheet';
import { RelCard } from '@/features/surveyChat/ChatInput';
import { REL, REL_SHEET } from '@/features/surveyChat/relCopy';
import { dist, ProgressBar, Rise, scene, TOAST_MS } from '@/motion';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

import type { LoadOutcome, SaveBatch, V2Snapshot } from './api';
import { SECTION_COPY, SV2 } from './copy';
import { surveyV2Deps, type SurveyV2Deps } from './deps';
import { QuestionInput } from './inputs';
import type { LocalDraft, Stage } from './localDraft';
import {
  AI_BOX_IDS,
  answersOf,
  answerText,
  APPEAL,
  blockMessage,
  check,
  copyOf,
  DECLINE_HINT_IDS,
  draftFromValue,
  emptyDraft,
  firstMissing,
  FLOW,
  FLOW_SECTIONS,
  isPassable,
  NO_AI_IDS,
  normalizeAnswers,
  progressOf,
  PUBLIC_TOGGLE_IDS,
  qOf,
  RELIGION_ID,
  SENSITIVE_IDS,
  STORY,
  visibleFlow,
  warnings as warningsOf,
  type Draft,
} from './model';
import { PublicToggle, QuestionHead } from './parts';
import { POL } from './politicsCopy';
import { emptyPol, polBlock, PoliticsReviewRow, PoliticsStage, type PolDraft } from './PoliticsStage';
import { coursesFor, SchoolInput, schoolLabel } from './SchoolInput';
import { AppealStage, ReviewStage, StoryStage, type ReviewSection } from './stages';
import type { ProofState, V2Value } from './types';

export type SurveyV2Entry = 'resume' | 'missing';
type Props = { deps?: SurveyV2Deps; entry?: SurveyV2Entry; onDone?: () => void };

const T_TEXT = ['T01', 'T02', 'T03'];
const A06_OTHER_NOTE = "'그 외'를 고르면 '그 외'를 고른 분끼리 이어져요."; // 카피.md 14-2 A06_OTHER_NOTE(v5, QP-A) — '그 외'를 고르면 한 번 더 보인다
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const AUTO_FORMATS = ['choice', 'bucket', 'scale5'];

type Saved = { answers: Record<string, V2Value>; texts: Record<string, string>; stories: Record<string, string>; publicOn: Record<string, boolean> };

// 처음 상태: 서버 답 → 입력 중 값, 기기에 남은 답(pending)을 그 위에
function initialDrafts(snap: V2Snapshot, local: LocalDraft | null): Record<string, Draft> {
  const out: Record<string, Draft> = {};
  for (const q of FLOW) out[q.id] = draftFromValue(q, snap.answers[q.id], snap.userKey);
  for (const q of STORY) out[q.id] = draftFromValue(q, snap.stories[q.id], snap.userKey);
  for (const q of APPEAL) out[q.id] = draftFromValue(q, snap.appeal[q.id], snap.userKey);
  if (local) for (const id of local.pending) if (local.drafts[id] && out[id] && local.drafts[id].kind === out[id].kind) out[id] = local.drafts[id];
  return out;
}

export function SurveyV2Screen({ deps: given, entry = 'resume', onDone }: Props) {
  const router = useRouter();
  const [deps] = useState<SurveyV2Deps>(() => given ?? surveyV2Deps());
  const { api, local, politics, religion } = deps;
  // 3부-사 종교 동의 카드(설문 v2 · 답 확인 화면에서 A06 을 열 때도 — 카피 17-1 '답 확인 화면에서 종교를 누르면 이 카드가 다시'): null = 모름(카드 없이)
  const [relOn, setRelOn] = useState<boolean | null>(null);
  const [relCheck, setRelCheck] = useState(false);
  const [relReason, setRelReason] = useState<string | null>(null);
  const [relSheet, setRelSheet] = useState(false);

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadReason, setLoadReason] = useState<'network' | 'server'>('server');
  const [userKey, setUserKey] = useState('guest');
  const [stage, setStage] = useState<Stage>('intro');
  const [at, setAt] = useState<string>(FLOW[0].id);
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [publicOn, setPublicOn] = useState<Readonly<Record<string, boolean>>>({});
  const [proofs, setProofs] = useState<Readonly<Record<string, ProofState>>>({});
  const [storyMax, setStoryMax] = useState(3);
  const [openCards, setOpenCards] = useState<readonly string[]>([]);
  const [cardErrors, setCardErrors] = useState<Readonly<Record<string, string>>>({});
  const [seen, setSeen] = useState<readonly ('story' | 'appeal')[]>([]);
  const [skipped, setSkipped] = useState<readonly ('story' | 'appeal')[]>([]);
  const [fromReview, setFromReview] = useState(false);
  const [shown, setShown] = useState(false); // [다음]을 눌러 이유 문구를 보이는 중
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  const [pol, setPol] = useState<PolDraft>(emptyPol); // W8 정치성향(설문 답과 따로 저장 · CK15)
  const [polReason, setPolReason] = useState<string | null>(null);

  const saved = useRef<Saved>({ answers: {}, texts: {}, stories: {}, publicOn: {} });
  const busyRef = useRef(false);
  const alive = useRef(true);
  const scroller = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answers = useMemo(() => answersOf(drafts), [drafts]);
  const visible = useMemo(() => visibleFlow(answers), [answers]);
  const stateRef = useRef({ drafts, answers, publicOn, stage, at, seen, userKey });
  const nextRef = useRef<() => Promise<void>>(async () => undefined);
  const flushRef = useRef<() => void>(() => undefined);
  const actsRef = useRef({ next: async () => undefined as void, save: async () => undefined as void, leave: async () => undefined as void, submit: async () => undefined as void });

  // ── 읽기 ──
  const apply = useCallback(async (result: LoadOutcome) => {
    if (!alive.current) return;
    if (!result.ok) {
      setLoadReason(result.reason);
      setPhase('error');
      return;
    }
    const snap = result.data;
    const mine = await local.load(snap.userKey);
    if (!alive.current) return;
    const nextDrafts = initialDrafts(snap, mine);
    const a = answersOf(nextDrafts);
    saved.current = {
      answers: Object.fromEntries(Object.entries(snap.answers).filter(([id]) => !T_TEXT.includes(id))),
      texts: { ...Object.fromEntries(Object.entries(snap.answers).filter(([id]) => T_TEXT.includes(id)).map(([id, v]) => [id, String(v)])), ...snap.appeal },
      stories: { ...snap.stories },
      publicOn: { ...snap.publicOn },
    };
    setUserKey(snap.userKey);
    setDrafts(nextDrafts);
    setPublicOn({ ...snap.publicOn, ...(mine?.publicOn ?? {}) });
    setProofs(snap.proofs);
    setStoryMax(snap.storySlotsFree);
    setSeen(mine?.seen ?? []);
    const appealOpen = a.B04 !== undefined && a.B04 !== 'none' ? ['T04'] : [];
    setOpenCards(appealOpen);
    // 자리: 첫 빈 필수 문항(서버가 알려 준 값 우선, 기기에 남은 답이 있으면 합친 답으로 다시 센다)
    const missing = mine?.pending.length ? firstMissing(a) : snap.firstMissing ?? firstMissing(a);
    const started = Object.keys(snap.answers).length > 0 || (mine?.pending.length ?? 0) > 0;
    if (missing) {
      setStage(started ? 'flow' : 'intro');
      setAt(missing);
      if (entry === 'missing') {
        setNotice(SV2.missing);
        setShown(true);
      } else if (started) setNotice(SV2.resume);
    } else {
      setStage(mine && ['story', 'appeal', 'review'].includes(mine.stage) ? mine.stage : 'review');
      if (started) setNotice(SV2.resume);
    }
    setPhase('ready');
    if (politics) {
      void politics.load().then((r) => {
        if (!alive.current || !r.ok) return;
        setPol({ loaded: true, serverConsent: r.data.consent, checked: false, value: r.data.position, savedValue: r.data.answered ? r.data.position : null });
      });
    }
    if (religion) {
      void religion.load().then((r) => {
        if (alive.current && r.ok) setRelOn(r.on);
      });
    }
  }, [local, entry, politics, religion]);

  useEffect(() => {
    alive.current = true;
    void api.load().then(apply);
    return () => {
      alive.current = false;
      for (const t of [toastTimer.current, autoTimer.current]) if (t) clearTimeout(t);
      if (localTimer.current) {
        clearTimeout(localTimer.current);
        flushRef.current(); // 화면을 떠날 때 기다리던 기기 저장을 바로 한다
      }
    };
    // 처음 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 저장 ──
  // 지금 값과 마지막으로 서버에 저장한 값의 차이(숨은 문항 지우기 · 자동 값 포함)
  const diff = useCallback((): { batch: SaveBatch; empty: boolean } => {
    const { drafts: d, answers: a, publicOn: pub } = stateRef.current;
    const { values, clear } = normalizeAnswers(a);
    const s = saved.current;
    const answersOut: Record<string, V2Value> = {};
    const texts: Record<string, string | null> = {};
    for (const [id, v] of Object.entries(values)) {
      if (T_TEXT.includes(id)) {
        if (typeof v === 'string' && s.texts[id] !== v) texts[id] = v;
      } else if (!same(s.answers[id], v)) answersOut[id] = v;
    }
    const clearOut = clear.filter((id) => id in s.answers);
    for (const q of APPEAL) {
      const c = check(q, d[q.id] ?? emptyDraft(q), a);
      const v = c.state === 'ok' && typeof c.value === 'string' ? c.value : c.state === 'empty' ? null : undefined;
      if (v === undefined) continue; // 글자 수가 틀린 칸은 저장하지 않는다(막는 검증은 [답 확인하기]에서)
      if (v === null ? q.id in s.texts : s.texts[q.id] !== v) texts[q.id] = v;
    }
    const stories: Record<string, string | null> = {};
    for (const q of STORY) {
      const c = check(q, d[q.id] ?? emptyDraft(q), a);
      const v = c.state === 'ok' && typeof c.value === 'string' ? c.value : c.state === 'empty' ? null : undefined;
      if (v === undefined) continue;
      if (v === null ? q.id in s.stories : s.stories[q.id] !== v) stories[q.id] = v;
    }
    const pubOut: Record<string, boolean> = {};
    for (const id of PUBLIC_TOGGLE_IDS) if ((pub[id] ?? false) !== (s.publicOn[id] ?? false)) pubOut[id] = pub[id] ?? false;
    const batch: SaveBatch = { answers: answersOut, clear: clearOut, texts, stories, publicOn: pubOut };
    const empty = Object.keys(answersOut).length + clearOut.length + Object.keys(texts).length + Object.keys(stories).length + Object.keys(pubOut).length === 0;
    return { batch, empty };
  }, []);

  const writeLocal = useCallback(() => {
    const st = stateRef.current;
    const { batch } = diff();
    const pending = [...Object.keys(batch.answers ?? {}), ...Object.keys(batch.texts ?? {}), ...Object.keys(batch.stories ?? {})].filter((id) => st.drafts[id]);
    const value: LocalDraft = {
      v: 1,
      drafts: Object.fromEntries(pending.map((id) => [id, st.drafts[id]])),
      pending,
      publicOn: { ...st.publicOn },
      stage: st.stage,
      at: st.at,
      seen: st.seen,
      updatedAt: deps.now(),
    };
    void local.save(st.userKey, value);
  }, [diff, local, deps]);

  const persist = useCallback(async (): Promise<boolean> => {
    const { batch, empty } = diff();
    if (empty) return true;
    const result = await api.save(batch);
    if (!result.ok) return false;
    const s = saved.current;
    for (const [id, v] of Object.entries(batch.answers ?? {})) s.answers[id] = v;
    for (const id of batch.clear ?? []) delete s.answers[id];
    for (const [id, v] of Object.entries(batch.texts ?? {})) {
      if (v === null) delete s.texts[id];
      else s.texts[id] = v;
    }
    for (const [id, v] of Object.entries(batch.stories ?? {})) {
      if (v === null) delete s.stories[id];
      else s.stories[id] = v;
    }
    Object.assign(s.publicOn, batch.publicOn ?? {});
    writeLocal();
    return true;
  }, [api, diff, writeLocal]);

  // 입력이 바뀌면 곧 기기에도 남긴다(서버에 못 보낸 답 · 자리)
  useEffect(() => {
    if (phase !== 'ready') return;
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(writeLocal, 300);
  }, [drafts, publicOn, stage, at, phase, writeLocal]);

  // 앱이 백그라운드로 가면 조용히 저장(실패해도 문구 없음, 설문_인수조건 C-1)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' || phase !== 'ready') return;
      writeLocal();
      void persist();
    });
    return () => sub.remove();
  }, [persist, phase, writeLocal]);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (alive.current) setToast(null);
    }, TOAST_MS);
  };

  // ── 이동 ──
  const clearAuto = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
  };
  const goTo = useCallback((nextStage: Stage, nextAt?: string) => {
    clearAuto();
    setStage(nextStage);
    if (nextAt) setAt(nextAt);
    setShown(false);
    setNotice(null);
    setSaveError(null);
    setCardErrors({});
    setPolReason(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const current = qOf(at);
  const draft = drafts[at];
  const c = draft ? check(current, draft, answers) : ({ state: 'empty' } as const);
  const passable = isPassable(current, c);
  const reason = shown ? blockMessage(current, c) : null;

  const run = async (task: () => Promise<boolean>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    const ok = await task();
    busyRef.current = false;
    if (alive.current) setBusy(false);
    return ok;
  };

  const afterFlow = () => {
    const a = stateRef.current.answers;
    const miss = firstMissing(a);
    if (fromReview) {
      if (miss) goTo('flow', miss);
      else {
        setFromReview(false);
        goTo('review');
      }
      return;
    }
    if (politics) {
      goTo('politics'); // W8: 흐름 끝 → 정치성향 → 결혼 이야기
      return;
    }
    toStory();
  };

  const toStory = () => {
    goTo('story');
    setSeen((s) => (s.includes('story') ? s : [...s, 'story']));
  };

  // 정치성향 단계 떠나기: 검토에서 왔으면 검토로, 아니면 결혼 이야기로
  const leavePolitics = () => {
    if (fromReview) {
      setFromReview(false);
      goTo('review');
      return;
    }
    toStory();
  };

  // [다음]: 동의 · 값이 없으면 이유 한 줄. 새 동의면 CK15 기록 → set_politics(누르기 전 저장 0). 바뀐 게 없으면 그냥 넘어간다
  const nextPolitics = async () => {
    if (!politics || busyRef.current) return;
    const p = pol;
    const why = polBlock(p);
    if (why) {
      setPolReason(why);
      return;
    }
    if (p.serverConsent && p.value === p.savedValue) {
      leavePolitics();
      return;
    }
    const ok = await run(async () => {
      if (!p.serverConsent) {
        const agreed = await politics.agree();
        if (!agreed.ok) return false;
        if (alive.current) setPol((x) => ({ ...x, serverConsent: true, checked: false }));
      }
      const saved2 = await politics.save(p.value ?? 50);
      if (!saved2.ok) return false;
      if (alive.current) setPol((x) => ({ ...x, serverConsent: true, checked: false, value: saved2.data, savedValue: saved2.data }));
      return true;
    });
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    leavePolitics();
  };

  const nextFlow = async () => {
    clearAuto();
    if (busyRef.current) return;
    if (!passable) {
      setShown(true); // 이동하지 않고 이유 문구
      return;
    }
    const ok = await run(persist);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    const list = visibleFlow(stateRef.current.answers);
    const i = list.findIndex((q) => q.id === at);
    if (fromReview) {
      const miss = firstMissing(stateRef.current.answers);
      if (miss && miss !== at) goTo('flow', miss);
      else afterFlow();
      return;
    }
    const nextQ = list[i + 1];
    if (nextQ) goTo('flow', nextQ.id);
    else afterFlow();
  };

  // 자동 넘김: 고른 뒤 scene.survey.select + delay 만큼 기다렸다가 다음(그 사이 바꾸면 다시 센다)
  useEffect(() => {
    if (autoTick === 0) return;
    clearAuto();
    autoTimer.current = setTimeout(() => void nextRef.current(), scene.survey.select + scene.survey.delay);
  }, [autoTick]);

  const prev = useCallback(() => {
    if (busyRef.current) return;
    const st = stateRef.current;
    if (st.stage === 'flow') {
      const list = visibleFlow(st.answers);
      const i = list.findIndex((q) => q.id === st.at);
      if (i > 0) goTo('flow', list[i - 1].id);
      return;
    }
    if (st.stage === 'story' && politics) {
      goTo('politics');
      return;
    }
    if (st.stage === 'story' || st.stage === 'politics') {
      const list = visibleFlow(st.answers);
      goTo('flow', list[list.length - 1].id);
    } else if (st.stage === 'appeal') goTo('story');
    else if (st.stage === 'review') goTo('appeal');
  }, [goTo, politics]);

  const canBack = stage !== 'intro' && !(stage === 'flow' && visible[0]?.id === at);

  // Android 뒤로가기: 앞 문항 · 단계로, 첫 문항은 기본 동작
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canBack) return false;
      prev();
      return true;
    });
    return () => sub.remove();
  }, [canBack, prev]);

  const onDraft = (id: string, value: Draft) => {
    setDrafts((d) => ({ ...d, [id]: value }));
    setSaveError(null);
    setCardErrors((e) => (e[id] ? { ...e, [id]: '' } : e));
    clearAuto();
    const q = qOf(id);
    if (stage !== 'flow' || !AUTO_FORMATS.includes(q.format) || q.toggle?.startsWith('e0')) return;
    const nextAnswers = answersOf({ ...stateRef.current.drafts, [id]: value });
    const res = check(q, value, nextAnswers);
    if (res.state !== 'ok') return;
    if (res.value === null && DECLINE_HINT_IDS.includes(id)) return; // '말하고 싶지 않아요' + 등급 안내 한 줄: 읽게 넘기지 않는다
    if (id === 'A06' && res.value === 'other') return; // '그 외' 안내를 읽게
    setAutoTick((t) => t + 1);
  };

  const tempSave = async () => {
    if (phase !== 'ready') return;
    clearAuto();
    const ok = await run(persist);
    if (!alive.current) return;
    if (ok) {
      setSaveError(null);
      showToast(SV2.savedToast);
    } else setSaveError(SV2.saveFailed);
  };

  // 세부사항에 들어갈 때 유학(B04)이 '없어요'가 아니면 T04 를 펼친 채 시작(설문_v2 2-6)
  const openAppeal = () => {
    const b04 = stateRef.current.answers.B04;
    if (typeof b04 === 'string' && b04 !== 'none') setOpenCards((o) => (o.includes('T04') ? o : [...o, 'T04']));
  };

  // 선택 단계: 쓴 카드는 10자 이상이어야 넘어간다(비우면 됨)
  const cardCheck = (ids: readonly string[]) => {
    const errs: Record<string, string> = {};
    for (const id of ids) {
      const res = check(qOf(id), drafts[id] ?? emptyDraft(qOf(id)), answers);
      if (res.state === 'invalid') errs[id] = res.message;
    }
    return errs;
  };

  const leaveCards = async (ids: readonly string[], to: Stage) => {
    const errs = cardCheck(ids);
    if (Object.keys(errs).length > 0) {
      setCardErrors(errs);
      setOpenCards((o) => [...new Set([...o, ...Object.keys(errs)])]);
      return;
    }
    const ok = await run(persist);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    setSkipped((s) => s.filter((x) => (to === 'appeal' ? x !== 'story' : x !== 'appeal')));
    if (to === 'appeal') setSeen((s) => (s.includes('appeal') ? s : [...s, 'appeal']));
    if (!fromReview && to === 'appeal') openAppeal();
    goTo(fromReview ? 'review' : to);
    if (fromReview) setFromReview(false);
  };

  // [건너뛰기]: 저장하지 않은 글은 되돌리고 다음 단계로
  const skipCards = (kind: 'story' | 'appeal') => {
    const qs = kind === 'story' ? STORY : APPEAL;
    const s = saved.current;
    setDrafts((d) => {
      const out = { ...d };
      for (const q of qs) out[q.id] = draftFromValue(q, kind === 'story' ? s.stories[q.id] : s.texts[q.id], userKey);
      return out;
    });
    setSkipped((x) => (x.includes(kind) ? x : [...x, kind]));
    if (kind === 'story') setSeen((x) => (x.includes('appeal') ? x : [...x, 'appeal']));
    if (kind === 'story' && !fromReview) openAppeal();
    goTo(kind === 'story' ? (fromReview ? 'review' : 'appeal') : 'review');
    if (fromReview) setFromReview(false);
  };

  const upload = async (card: string) => {
    if (uploading) return;
    setUploading(card);
    const r = await api.uploadProof(card);
    if (!alive.current) return;
    setUploading(null);
    setProofs((p) => ({ ...p, [card]: r.ok ? r.state : 'retry' }));
  };

  const submit = async () => {
    const miss = firstMissing(answers);
    if (miss) {
      goTo('flow', miss);
      setNotice(SV2.missing); // N12
      setShown(true);
      return;
    }
    const ok = await run(async () => (await persist()) && (await api.submit()).ok);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    void local.clear(userKey);
    if (onDone) onDone();
    else router.push('/photos');
  };

  const edit = (id: string) => {
    if (STORY.some((q) => q.id === id)) {
      setFromReview(true);
      goTo('story');
      return;
    }
    if (APPEAL.some((q) => q.id === id)) {
      setFromReview(true);
      openAppeal();
      goTo('appeal');
      return;
    }
    setFromReview(true);
    goTo('flow', id);
  };

  // 시간 뒤에 부르는 일(자동 넘김 · 저장)이 늘 마지막 그림의 값을 읽게 한다
  useEffect(() => {
    stateRef.current = { drafts, answers, publicOn, stage, at, seen, userKey };
    nextRef.current = nextFlow;
    flushRef.current = writeLocal;
    actsRef.current = {
      next: nextFlow,
      save: tempSave,
      leave: () => leaveCards(stage === 'story' ? STORY.map((q) => q.id) : APPEAL.map((q) => q.id), stage === 'story' ? 'appeal' : 'review'),
      submit,
    };
  });

  // 글 칸에서 한글을 조합하는 중에 버튼을 눌러도, 조합을 먼저 끝내고(끝난 글이 상태에 들어온 뒤) 마지막 그림의 일을 한다(F23 · P10).
  //  조합 끝내기는 공통 Button · TextButton(상단 바 오른쪽 글자 포함)이 누르기 전에 한다(F21 · D-143, components/commitThenPress) — 여기서는 마지막 그림의 일만 부른다
  const after = (act: 'next' | 'save' | 'leave' | 'submit') => {
    actsRef.current[act]();
  };

  // 종교 동의 카드: 동의 = CK4 기록 → 그 자리에서 A06 보기 / 거절 = '동의 안 함' 기록 + A06 '답하지 않음'(null) → 다음 문항(저장은 [다음]과 같은 길)
  const relCard = stage === 'flow' && at === RELIGION_ID && !!religion && relOn === false;
  const agreeReligion = async () => {
    if (!religion || busyRef.current) return;
    if (!relCheck) {
      setRelReason(REL.needCheck);
      return;
    }
    const ok = await run(async () => (await religion.record(true)).ok);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    setSaveError(null);
    setRelReason(null);
    setRelCheck(false);
    setRelOn(true);
  };
  const declineReligion = async () => {
    if (!religion || busyRef.current) return;
    const ok = await run(async () => (await religion.record(false)).ok);
    if (!alive.current) return;
    if (!ok) {
      setSaveError(SV2.saveFailed);
      return;
    }
    setSaveError(null);
    setRelReason(null);
    setRelCheck(false);
    setDrafts((d) => ({ ...d, [RELIGION_ID]: { kind: 'choice', code: 'decline' } }));
    setAutoTick((n) => n + 1); // 고른 뒤 넘김과 같은 길(새 값으로 저장 → 다음 문항)
  };

  // ── 검토 자료 ──
  const reviewSections = useMemo((): ReviewSection[] => {
    const name = (key: string) => schoolLabel(key);
    const flow: ReviewSection[] = FLOW_SECTIONS.map((key) => ({
      key,
      name: SECTION_COPY[key].name,
      edit: visible.find((q) => q.section === key)?.id ?? FLOW[0].id,
      skipped: false,
      rows: visible.filter((q) => q.section === key && q.id in answers).map((q) => ({ id: q.id, question: copyOf(q.id)?.q ?? q.id, answer: answerText(q, answers[q.id], name) })),
    }));
    const cards = (key: 'story' | 'appeal'): ReviewSection => {
      const qs = key === 'story' ? STORY : APPEAL;
      const rows = qs.filter((q) => typeof answers[q.id] === 'string').map((q) => ({ id: q.id, question: copyOf(q.id)?.q ?? q.id, answer: String(answers[q.id]) }));
      return { key, name: SECTION_COPY[key].name, edit: qs[0].id, skipped: rows.length === 0 && (skipped.includes(key) || seen.includes(key)), rows };
    };
    return [...flow, cards('story'), cards('appeal')];
  }, [answers, visible, skipped, seen]);

  const warnList = useMemo(
    () =>
      warningsOf(answers, (key) => {
        const row = schoolIndex().byKey(key);
        return row ? { course: row.course, overseas: row.kind === '해외 대학' } : null;
      }),
    [answers],
  );

  // ── 그리기 ──
  if (phase !== 'ready') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="v2-screen">
        <ScreenHeader title={SV2.headerTitle} testID="v2-header" />
        <View style={styles.center}>
          {phase === 'loading' ? (
            <>
              <Ring size={layout.splashRing} stroke={layout.splashRingStroke} testID="v2-loading-ring" />
              <AppText variant="body" testID="v2-loading">
                {SV2.loading}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="body" style={styles.centerText} testID="v2-load-error">
                {loadReason === 'network' ? SV2.offline : SV2.server}
              </AppText>
              <Button
                label={SV2.retry}
                variant="secondary"
                onPress={() => {
                  setPhase('loading');
                  void api.load().then(apply);
                }}
                testID="v2-retry"
              />
            </>
          )}
        </View>
      </Screen>
    );
  }

  const prog = progressOf(answers, stage === 'flow' ? at : null);
  const sectionFirst = stage === 'flow' && visible.find((q) => q.section === current.section)?.id === at;
  const value = answers[at];
  const lines: { text: string; tone?: 'sub' | 'accent'; testID?: string }[] = [];
  if (stage === 'flow') {
    const vis = current.vis === 'public' ? `${SV2.common.vis.public}${current.toggle && !current.toggle.startsWith('e0') ? ` ${SV2.common.vis.toggle}` : ''}` : current.vis === 'bucket' ? SV2.common.vis.bucket : SV2.common.vis.private;
    lines.push({ text: vis, testID: 'v2-visibility' });
    if (SENSITIVE_IDS.includes(at)) lines.push({ text: SV2.common.sensitive, testID: 'v2-sensitive' });
    if (NO_AI_IDS.includes(at)) lines.push({ text: SV2.common.noAi, testID: 'v2-noai' });
  }
  const pubCopy = copyOf(at)?.publicToggle;
  const pubText = value !== undefined && value !== null ? copyOf(at)?.publicText?.[String(value)] : undefined;

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} testID="v2-screen">
      <KeyboardAvoid>
        <ScreenHeader title={SV2.headerTitle} onBack={canBack ? prev : undefined} rightLabel={stage === 'intro' ? undefined : SV2.tempSave} onRight={() => after('save')} testID="v2-header" />
        <ScrollView ref={scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="v2-scroll">
          {stage !== 'intro' ? (
            <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={SV2.common.progressA11y(prog.done, prog.total)} accessibilityValue={{ min: 0, max: prog.total, now: prog.done }} aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done} testID="v2-progress">
              <View style={styles.bars}>
                {prog.bars.map((b) => (
                  <ProgressBar key={b.key} ratio={b.ratio} style={styles.bar} fillTestID={`v2-bar-${b.key}`} />
                ))}
              </View>
              {prog.label && stage === 'flow' ? (
                <AppText variant="captionMedium" tone="accent" testID="v2-step">
                  {`${SECTION_COPY[prog.label.section].name} · ${SV2.common.count(prog.label.index, prog.label.total)}`}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {notice ? (
            <AppText variant="captionMedium" tone="accent" accessibilityLiveRegion="polite" testID="v2-notice">
              {notice}
            </AppText>
          ) : null}

          {stage === 'intro' ? (
            <Rise distance={dist.s} testID="v2-intro">
              <View style={styles.block}>
                <AppText variant="heading" accessibilityRole="header">
                  {SV2.intro.title}
                </AppText>
                {SV2.intro.points.map((p, i) => (
                  <AppText key={p} variant="body" testID={`v2-intro-${i}`}>
                    {p}
                  </AppText>
                ))}
              </View>
            </Rise>
          ) : null}

          {stage === 'flow' && draft ? (
            <Rise key={at} axis="x" distance={scene.survey.dist} duration={scene.survey.slide} testID={`v2-block-${at}`}>
              <View style={styles.block}>
                {sectionFirst ? (
                  <View style={styles.sectionHead} testID="v2-section-head">
                    <AppText variant="bodyBold" tone="accent">
                      {SECTION_COPY[current.section].name}
                    </AppText>
                    <AppText variant="caption" tone="text">
                      {SECTION_COPY[current.section].lead}
                    </AppText>
                  </View>
                ) : null}
                <QuestionHead question={copyOf(at)?.q ?? at} help={copyOf(at)?.help} lines={lines} />
                {AI_BOX_IDS.includes(at) ? (
                  <Card testID="v2-aibox">
                    <AppText variant="caption" tone="text">
                      {SV2.common.aiBox}
                    </AppText>
                  </Card>
                ) : null}
                {relCard ? (
                  <RelCard
                    checked={relCheck}
                    reason={relReason}
                    busy={busy}
                    play={false}
                    onCheck={() => {
                      setRelCheck((c) => !c);
                      setRelReason(null);
                    }}
                    onAgree={() => void agreeReligion()}
                    onDecline={() => void declineReligion()}
                    onMore={() => setRelSheet(true)}
                  />
                ) : current.format === 'school' && draft.kind === 'school' ? (
                  <SchoolInput q={current} draft={draft} onChange={(d) => onDraft(at, d)} search={(query, courses) => api.searchSchools(query, { courses: courses ?? coursesFor(at), limit: 8 })} />
                ) : (
                  <QuestionInput q={current} draft={draft} answers={answers} onChange={(d) => onDraft(at, d)} invalid={reason !== null} />
                )}
                {DECLINE_HINT_IDS.includes(at) && value === null ? (
                  <AppText variant="captionMedium" tone="accent" testID="v2-decline-hint">
                    {SV2.common.declineHint}
                  </AppText>
                ) : null}
                {at === 'A06' && value === 'other' ? (
                  <AppText variant="captionMedium" tone="accent" testID="v2-other-note">
                    {A06_OTHER_NOTE}
                  </AppText>
                ) : null}
                {pubCopy ? (
                  <PublicToggle
                    label={pubCopy}
                    on={publicOn[at] ?? false}
                    onPress={() => setPublicOn((p) => ({ ...p, [at]: !(p[at] ?? false) }))}
                    preview={
                      pubText ? (
                        <View style={styles.preview} testID="v2-public-preview">
                          <AppText variant="captionMedium" tone="accent">
                            {SV2.story.preview}
                          </AppText>
                          <AppText variant="body">{pubText}</AppText>
                        </View>
                      ) : null
                    }
                    testID="v2-public"
                  />
                ) : null}
                {reason ? (
                  <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="v2-error">
                    {reason}
                  </AppText>
                ) : null}
                {!current.required && c.state === 'empty' ? <TextButton label={SV2.common.skip} align="start" onPress={() => after('next')} testID="v2-skip-one" /> : null}
              </View>
            </Rise>
          ) : null}

          {stage === 'politics' ? (
            <PoliticsStage
              pol={pol}
              reason={polReason}
              onCheck={() => {
                setPol((x) => ({ ...x, checked: !x.checked }));
                setPolReason(null);
                setSaveError(null);
              }}
              onChange={(v) => {
                setPol((x) => ({ ...x, value: v }));
                setPolReason(null);
                setSaveError(null);
              }}
            />
          ) : null}
          {stage === 'story' ? (
            <StoryStage drafts={drafts} open={openCards} max={storyMax} errors={cardErrors} onToggle={(id) => setOpenCards((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))} onChange={(id, d) => onDraft(id, d)} />
          ) : null}
          {stage === 'appeal' ? (
            <AppealStage
              drafts={drafts}
              open={openCards}
              proofs={proofs}
              proofUpload={api.proofUpload}
              uploading={uploading}
              errors={cardErrors}
              onToggle={(id) => setOpenCards((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))}
              onChange={(id, d) => onDraft(id, d)}
              onUpload={(id) => void upload(id)}
            />
          ) : null}
          {stage === 'review' && politics ? (
            <PoliticsReviewRow
              pol={pol}
              onEdit={() => {
                setFromReview(true);
                goTo('politics');
              }}
            />
          ) : null}
          {stage === 'review' ? <ReviewStage sections={reviewSections} warnings={warnList} onEdit={edit} /> : null}

          {saveError ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="v2-save-error">
              {saveError}
            </AppText>
          ) : null}
        </ScrollView>

        {/* 하단 고정(공통 BottomCTA: 위 선 대신 흐림 · 이전 : 다음 = 1 : 2, D-141) */}
        <BottomCTA testID="v2-cta">
          {stage === 'intro' ? <Button label={SV2.intro.start} onPress={() => goTo('flow', firstMissing(answers) ?? visible[0]?.id ?? FLOW[0].id)} testID="v2-start" /> : null}
          {stage === 'flow' && relCard ? (canBack ? <Button label={SV2.common.prev} variant="secondary" onPress={prev} disabled={busy} testID="v2-prev" /> : null) : null}
          {stage === 'flow' && !relCard ? (
            canBack ? (
              <CtaPair
                secondary={<Button label={SV2.common.prev} variant="secondary" onPress={prev} disabled={busy} testID="v2-prev" />}
                primary={<Button label={SV2.common.next} onPress={() => after('next')} dimmed={!passable} loading={busy} testID="v2-next" />}
              />
            ) : (
              <Button label={SV2.common.next} onPress={() => after('next')} dimmed={!passable} loading={busy} testID="v2-next" />
            )
          ) : null}
          {stage === 'politics' ? (
            <CtaPair
              secondary={<Button label={POL.later} variant="secondary" onPress={leavePolitics} disabled={busy} testID="v2-pol-later" />}
              primary={<Button label={SV2.common.next} onPress={() => void nextPolitics()} dimmed={polBlock(pol) !== null} loading={busy} testID="v2-next" />}
            />
          ) : null}
          {stage === 'story' || stage === 'appeal' ? (
            <CtaPair
              secondary={<Button label={SV2.common.skip} variant="secondary" onPress={() => skipCards(stage)} disabled={busy} testID="v2-skip" />}
              primary={<Button label={stage === 'story' ? SV2.common.next : SV2.appeal.toReview} onPress={() => after('leave')} loading={busy} testID="v2-next" />}
            />
          ) : null}
          {stage === 'review' ? <Button label={SV2.review.submit} onPress={() => after('submit')} dimmed={firstMissing(answers) !== null} loading={busy} testID="v2-submit" /> : null}
        </BottomCTA>
        <ConsentSummarySheet item={relSheet ? REL_SHEET : null} onClose={() => setRelSheet(false)} />
        <Toast text={toast} testID="v2-toast" />
      </KeyboardAvoid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s48, gap: space.s16 }, // 아래 48: 하단 고정 위 흐림(24)에 마지막 줄이 가리지 않게,
  progress: { gap: space.s8 },
  bars: { flexDirection: 'row', gap: space.s4 },
  bar: { flex: 1 },
  block: { gap: space.s12 },
  sectionHead: { gap: space.s4, borderRadius: radius.lg, backgroundColor: colors.accentSoft, paddingHorizontal: space.s16, paddingVertical: space.s12 },
  preview: { gap: space.s4, borderRadius: radius.md, backgroundColor: colors.card, padding: space.s12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centerText: { textAlign: 'center' },
});
