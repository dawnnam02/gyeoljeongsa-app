// 임시(F2L) — AYLA'S 설문으로 교체 예정
// 화면 ID 04 설문의 짧은 판(테스트용, 본인 지시 2026-10-15). 정식 설문(62문항 · 31쪽)은 공동대표 AYLA'S 가 만들고, 오면 이 폴더를 통째로 뺀다.
//  한 쪽에 한 문항 · 10쪽(A01 · A03 · A05 · B01 · C05 · D03 · E08 · E13 · T01 · F01). 05 에서 G01 사진 · G03 스타일을 받아 12문항이 된다.
//  · 상단: ‹(첫 쪽은 숨김) + '설문' + [임시 저장] · 섹션 칩 6 · 진행바(끝낸 쪽 ÷ 11) · 쪽 표시 "기본 · 2 / 3"
//  · 필수가 비었거나 틀리면 [다음]이 흐리고, 누르면 이동하지 않고 문항 아래에 이유 문구(R7)
//  · [다음]은 그 쪽 답을 저장한 뒤 이동(실패하면 머물고 "저장하지 못했어요…"). [이전] · ‹ 는 저장하지 않고 앞 쪽으로(값은 남는다)
//  · [임시 저장]은 검증 없이 지금까지 맞게 쓴 답을 저장하고 머문다 + "임시 저장했어요." · 앱이 백그라운드로 가면 조용히 같은 저장
//  · 다시 열면 저장된 답으로 채우고 처음 빈 쪽에서 이어간다(N03). 05 에서 빠진 문항으로 보내면 그 쪽 + N12
//  · 마지막 쪽 [다음] → 05 사진 등록
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { ProgressBar, Rise, scene, TOAST_MS } from '@/motion';
import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import { LITE_COMMON, SURVEY_LITE } from '@/content/surveyLiteCopy';
import { kstToday } from '@/lib/birthDate';
import type { LiteValue, LoadOutcome, SurveyLiteApi } from '@/lib/surveyLiteApi';
import { colors, size, space } from '@/theme/tokens';

import { QuestionInput } from './inputs';
import { surveyLiteApi } from './liteDeps';
import {
  blockMessage,
  checkDraft,
  chipProgress,
  draftFromValue,
  isPassable,
  LITE_PAGES,
  LITE_PROGRESS_TOTAL,
  questionOf,
  startPage,
  visibilityLine,
  type Draft,
  type LiteEntry,
} from './liteModel';

export type SurveyLiteDeps = { api: Pick<SurveyLiteApi, 'load' | 'saveAnswers'>; now: () => number };
const defaultDeps = (): SurveyLiteDeps => ({ api: surveyLiteApi(), now: Date.now });
export const LITE_TOAST_MS = TOAST_MS; // 토스트 5초(카피 규칙 1-1 · K15 · 팀장 10-17)

type Props = { deps?: SurveyLiteDeps; entry?: LiteEntry; onDone?: () => void };

// 저장할 값: 맞게 쓴 답만(02 에서 받은 A01 은 다시 보내지 않는다 — 가입 뒤 바꿀 수 없다)
function savable(drafts: Readonly<Record<string, Draft>>, todayIso: string, only?: string): Record<string, LiteValue> {
  const out: Record<string, LiteValue> = {};
  for (const p of LITE_PAGES) {
    if (only && p.id !== only) continue;
    const draft = drafts[p.id];
    if (!draft || (draft.kind === 'date' && draft.locked)) continue;
    const check = checkDraft(questionOf(p.id), draft, todayIso);
    if (check.state === 'ok') out[p.id] = check.value;
  }
  return out;
}

export function SurveyLiteScreen({ deps: given, entry = 'resume', onDone }: Props) {
  const router = useRouter();
  const [deps] = useState<SurveyLiteDeps>(() => given ?? defaultDeps());
  const { api, now } = deps;

  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadReason, setLoadReason] = useState<'network' | 'server'>('server');
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<-1 | 0 | 1>(0); // 설문 넘김(F21 · D25 10-4): 다음은 오른쪽 16 에서, 앞은 왼쪽 16 에서 들어옴(250). 처음 쪽은 움직이지 않음
  const [shown, setShown] = useState(false); // [다음]을 눌러 이유 문구를 보이는 중
  const [notice, setNotice] = useState<string | null>(null); // N03 · N12
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const draftsRef = useRef(drafts); // 백그라운드 저장이 최신 값을 읽는다
  const scroller = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 읽은 결과를 화면에 놓는다
  const apply = useCallback(
    (result: LoadOutcome) => {
      if (!alive.current) return;
      if (!result.ok) {
        setLoadReason(result.reason);
        setPhase('error');
        return;
      }
      const { answers, birthLocked } = result.data;
      const next: Record<string, Draft> = {};
      for (const p of LITE_PAGES) next[p.id] = draftFromValue(questionOf(p.id), answers[p.id], p.id === 'A01' && birthLocked);
      setDrafts(next);
      setPage(startPage(entry, answers));
      const started = LITE_PAGES.some((p) => p.id !== 'A01' && p.id in answers); // A01 은 02 에서 이미 받았다
      if (entry === 'missing') {
        setNotice(SURVEY_LITE.missing);
        setShown(true);
      } else if (entry === 'resume' && started) setNotice(SURVEY_LITE.resume);
      setPhase('ready');
    },
    [entry],
  );
  const load = useCallback(async () => apply(await api.load()), [api, apply]);

  useEffect(() => {
    alive.current = true;
    void (async () => apply(await api.load()))();
    return () => {
      alive.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // 처음 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((index: number) => {
    setTurn(index < page ? -1 : 1);
    setPage(index);
    setShown(false);
    setNotice(null);
    setSaveError(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const prev = useCallback(() => {
    if (page > 0 && !busyRef.current) go(page - 1);
  }, [go, page]);

  // Android 뒤로가기: 둘째 쪽부터는 앞 쪽으로, 첫 쪽은 기본 동작(앱을 백그라운드로)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 0) return false;
      prev();
      return true;
    });
    return () => sub.remove();
  }, [page, prev]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  // 앱이 백그라운드로 가면 조용히 저장(실패해도 문구 없음, 화면_요구사항 04 임시 저장)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || phase !== 'ready') return;
      const values = savable(draftsRef.current, kstToday(now()));
      if (Object.keys(values).length > 0) void api.saveAnswers(values);
    });
    return () => sub.remove();
  }, [api, now, phase]);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      if (alive.current) setToast(null);
    }, LITE_TOAST_MS);
  };

  const today = kstToday(now());
  const current = LITE_PAGES[page];
  const q = questionOf(current.id);
  const draft = drafts[current.id];
  const check = draft ? checkDraft(q, draft, today) : ({ state: 'empty' } as const);
  const passable = isPassable(q, check);
  const reason = shown ? blockMessage(q, check) : null;
  const done = LITE_PAGES.filter((p) => drafts[p.id] && checkDraft(questionOf(p.id), drafts[p.id], today).state === 'ok').length;
  const chip = chipProgress(page);
  const last = page === LITE_PAGES.length - 1;

  const next = async () => {
    if (busyRef.current) return;
    if (!passable) {
      setShown(true); // 이동하지 않고 이유 문구
      return;
    }
    const values = savable(drafts, today, current.id);
    if (Object.keys(values).length > 0) {
      busyRef.current = true;
      setBusy(true);
      const result = await api.saveAnswers(values);
      busyRef.current = false;
      if (!alive.current) return;
      setBusy(false);
      if (!result.ok) {
        setSaveError(SURVEY_LITE.saveFailed); // 저장이 실패하면 이동하지 않는다
        return;
      }
    }
    if (last) {
      if (onDone) onDone();
      else router.push('/photos');
    } else go(page + 1);
  };

  const tempSave = async () => {
    if (busyRef.current || phase !== 'ready') return;
    const values = savable(drafts, today);
    busyRef.current = true;
    setBusy(true);
    const result = Object.keys(values).length > 0 ? await api.saveAnswers(values) : ({ ok: true } as const);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (result.ok) {
      setSaveError(null);
      showToast(SURVEY_LITE.savedToast);
    } else setSaveError(SURVEY_LITE.saveFailed);
  };

  const change = (id: string) => (value: Draft) => {
    setDrafts((d) => ({ ...d, [id]: value }));
    setSaveError(null);
  };

  if (phase !== 'ready') {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="surveylite-screen">
        <ScreenHeader title={SURVEY_LITE.headerTitle} testID="surveylite-header" />
        <View style={styles.center}>
          {phase === 'loading' ? (
            <>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="body" testID="surveylite-loading">
                {LITE_COMMON.loading}
              </AppText>
            </>
          ) : (
            <>
              <AppText variant="body" style={styles.centerText} testID="surveylite-load-error">
                {loadReason === 'network' ? LITE_COMMON.offline : LITE_COMMON.server}
              </AppText>
              <Button label={LITE_COMMON.retry} variant="secondary" inline onPress={() => {
                  setPhase('loading');
                  void load();
                }}
                testID="surveylite-retry" />
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} testID="surveylite-screen">
      <KeyboardAvoid>
      <ScreenHeader
        title={SURVEY_LITE.headerTitle}
        onBack={page > 0 ? prev : undefined}
        rightLabel={SURVEY_LITE.tempSave}
        onRight={() => void tempSave()}
        testID="surveylite-header"
      />
      <ScrollView ref={scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="surveylite-scroll">
        <View style={styles.chips} testID="surveylite-chips">
          {SURVEY_LITE.chips.map((name) => (
            <Chip key={name} label={name} variant={name === chip.chip ? 'selected' : 'inactive'} testID={name === chip.chip ? 'surveylite-chip-current' : undefined} />
          ))}
        </View>
        {/* 진행 막대(F21): 안쪽을 scaleX 로 250(std) 채움 — 너비를 움직이지 않는다 */}
        <ProgressBar ratio={done / LITE_PROGRESS_TOTAL} accessibilityValue={{ min: 0, max: LITE_PROGRESS_TOTAL, now: done }} testID="surveylite-progress" fillTestID="surveylite-progress-fill" />
        <AppText variant="caption" testID="surveylite-step">
          {SURVEY_LITE.stepLabel(chip.chip, chip.index, chip.total)}
        </AppText>

        {notice ? (
          <AppText variant="captionMedium" tone="accent" accessibilityLiveRegion="polite" testID="surveylite-notice">
            {notice}
          </AppText>
        ) : null}

        {current.id === 'D03' ? (
          <Card testID="surveylite-parent-banner">
            <AppText variant="caption" tone="text">
              {SURVEY_LITE.parentBanner}
            </AppText>
          </Card>
        ) : null}
        {current.id === 'T01' ? (
          <Card testID="surveylite-text-guide">
            <AppText variant="caption" tone="text">
              {SURVEY_LITE.freeTextGuide}
            </AppText>
          </Card>
        ) : null}

        <Rise key={current.id} play={turn !== 0} axis="x" distance={turn * scene.survey.dist} duration={scene.survey.slide} style={styles.block} testID={`surveylite-block-${current.id}`}>
          <AppText variant="title" accessibilityRole="header" testID="surveylite-question">
            {q.question}
          </AppText>
          {draft ? <QuestionInput q={q} draft={draft} onChange={change(current.id)} invalid={reason !== null} /> : null}
          {reason ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="surveylite-error">
              {reason}
            </AppText>
          ) : null}
          <AppText variant="caption" testID="surveylite-visibility">
            {visibilityLine(q)}
          </AppText>
        </Rise>

        {saveError ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="surveylite-save-error">
            {saveError}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <CtaFade />
        {page > 0 ? (
          <View style={styles.half}>
            <Button label={SURVEY_LITE.prev} variant="secondary" onPress={prev} disabled={busy} testID="surveylite-prev" />
          </View>
        ) : null}
        <View style={styles.half}>
          <Button label={SURVEY_LITE.next} onPress={() => void next()} dimmed={!passable} loading={busy} testID="surveylite-next" />
        </View>
      </View>
      <Toast text={toast} testID="surveylite-toast" />
      </KeyboardAvoid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s16, paddingBottom: space.s24, gap: space.s16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s4 },
  block: { gap: space.s12 },
  footer: { flexDirection: 'row', gap: space.s8, paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  half: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centerText: { textAlign: 'center' },
});
