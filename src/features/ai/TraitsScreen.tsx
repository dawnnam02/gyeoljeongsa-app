// 화면 ID 07 내 성향(K2 4장 07 · 카피.md 07 · Figma 3:188 + 수정 상태 메모 34:7).
//  보기: 제목 · 부제 · 5축 막대(0~100) · 안내 · "나를 나타내는 말" 칩 ≤5 · 요약 3문장 · 근거 접기/펼치기 · [수정하기] [이대로 확정]
//  수정: 막대를 끌고 · 칩을 ×로 지우거나 더하고 · 요약을 고친다. [취소] [저장] — [저장]은 user_edited 에만 쓴다(AI 원본 result 는 그대로), 확정이 아니다
//  직접 입력(?mode=manual, 06 에서 옴): 막대 처음값은 서버가 준 값(없으면 50) · 칩은 후보에서 고른다 · 요약은 비워도 된다 · [이대로 확정] 한 번으로 저장 + 확정
//  [이대로 확정] → confirm_profile → 08(처음 한 번). 정리 결과가 없으면 06 으로 되돌린다.
//  3부-아(검수 QP-09 · 화면_요구사항 2-1 F2): 대화형 설문 '내 성향'을 마친 분(인터뷰 정리 status done)은 같은 확인을 두 번 하지 않는다 —
//   07 을 보이지 않고 그 결과로 확정(confirm_profile) → 08. 확정이 안 되면 지금처럼 07 을 보인다. 06(AI 정리)을 건너뛰려면 서버가 인터뷰 확정으로 계정을 여는 길이 필요(백엔드 넘김)
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native';

import { CTA_PADDING, CtaFade, Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Card } from '@/components/Card';
import { KeyboardAvoid } from '@/components/KeyboardAvoid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { OfflineArt } from '@/components/StateArt';
import { TextField } from '@/components/TextField';
import { COMMON, TRAITS } from '@/content/copy';
import { AXIS_NAMES, AXIS_ORDER, MANUAL_TAG_FALLBACK } from '@/content/traitsContent';
import { aiApi } from '@/lib/services';
import type { AiApi } from '@/lib/aiApi';
import { goBackOr, goForward } from '@/navigation/go';
import { resolveDest } from '@/navigation/resolve';
import { useSignupStore } from '@/store';
import { colors, size, space } from '@/theme/tokens';
import type { AiRow, TraitKey, Traits, TraitsView } from '@/types/ai';

import { EvidenceList } from './EvidenceList';
import { manualOfferStore } from './manualOffer';
import { TagEditor, TagList, TagPicker } from './TagEditor';
import { TraitBar, TraitSlider } from './TraitBar';
import { checkDraft, clipSummary, sameView, setTrait, SUMMARY_MAX_LEN, toEdited } from './traitsLogic';

export type TraitsDeps = {
  api: Pick<AiApi, 'loadLatest' | 'saveEdited' | 'confirm' | 'manual'>;
  setStage: (stage: 'traits-pending' | 'traits-confirmed') => void;
  chatDone?: () => Promise<boolean>; // 대화형 설문 '내 성향'을 마쳤나(get_interview_summary status done). 없으면 늘 07 을 보인다(옛 시험)
};

// 대화형 설문 정리를 마쳤나 — 처음 쓸 때 대화형 설문 연결을 만든다(기기 모듈 · 서버 연결을 07 을 열 때만)
const interviewDone = async (): Promise<boolean> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { surveyChatDeps } = require('@/features/surveyChat/deps') as typeof import('@/features/surveyChat/deps');
    const r = await surveyChatDeps().chat.summary();
    return r.ok && r.data.status === 'done';
  } catch {
    return false;
  }
};

const defaultDeps: TraitsDeps = {
  api: aiApi,
  setStage: (stage) => useSignupStore.getState().setStage(stage),
  chatDone: interviewDone,
};

type Mode = 'view' | 'edit' | 'manual';
const FLAT_50: Traits = { extraversion: 50, planning: 50, family: 50, economy: 50, conflict: 50 };
function resolveDestHref(dest: '04:first'): Href {
  const to = resolveDest(dest);
  return to.kind === 'href' ? to.href : '/survey/01';
}
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function TraitsScreen({ deps = defaultDeps }: { deps?: TraitsDeps }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const manualRequested = first(params.mode) === 'manual';
  const { api, setStage } = deps;

  const [row, setRow] = useState<AiRow | null>(null);
  const [view, setView] = useState<TraitsView | null>(null); // 지금 보이는(저장된) 값
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState<TraitsView | null>(null);
  const [candidates, setCandidates] = useState<readonly string[]>(MANUAL_TAG_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'network' | 'server' | null>(null);
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmFail, setConfirmFail] = useState<keyof typeof TRAITS.confirmErrors | null>(null); // [이대로 확정] 실패 4종 확인창
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const handleLoaded = useCallback(
    (result: Awaited<ReturnType<TraitsDeps['api']['loadLatest']>>) => {
    if (!alive.current) return;
    if (!result.ok) {
      setLoadError(result.reason);
      setLoading(false);
      return;
    }
    const latest = result.row;
    if (manualRequested) {
      // 06 에서 [직접 입력하기]로 왔다: 실패한 최근 건에 직접 입력한다
      if (!latest || latest.status !== 'failed') {
        goForward(router, '/analysis');
        return;
      }
      const offer = manualOfferStore.get();
      const mine = offer && offer.resultId === latest.id ? offer.value : null;
      setRow(latest);
      setCandidates(mine && mine.tagCandidates.length > 0 ? mine.tagCandidates : MANUAL_TAG_FALLBACK);
      const initial: TraitsView = { traits: mine?.initialTraits ?? FLAT_50, tags: [], summary: '' };
      setView(initial);
      setDraft(initial);
      setMode('manual');
      setLoading(false);
      return;
    }
    const shown = latest && latest.status === 'ok' ? (latest.edited ?? latest.original) : null;
    if (!latest || !shown) {
      goForward(router, '/analysis'); // 정리 결과가 없는데 들어왔다: 06 으로 되돌린다(문구 없음)
      return;
    }
    if (latest.confirmedAt) setStage('traits-confirmed');
    else setStage('traits-pending');
    const showNow = () => {
      if (!alive.current) return;
      setRow(latest);
      setView(shown);
      setMode('view');
      setLoading(false);
    };
    if (latest.confirmedAt || !deps.chatDone) {
      showNow();
      return;
    }
    // QP-09: 대화형 '내 성향'을 마쳤으면 07 을 건너뛰고 확정 → 08
    void deps.chatDone().then(async (done) => {
      if (!alive.current) return;
      if (!done) return showNow();
      const r = await api.confirm(latest.id);
      if (!alive.current) return;
      if (!r.ok) return showNow();
      manualOfferStore.clear();
      setStage('traits-confirmed');
      goForward(router, { pathname: '/profile', params: { first: '1' } });
    });
    },
    [manualRequested, router, setStage, deps, api],
  );
  const load = useCallback(() => api.loadLatest().then(handleLoaded), [api, handleLoaded]);

  useEffect(() => {
    void load();
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = () => {
    if (!view) return;
    setDraft({ traits: view.traits, tags: [...view.tags], summary: view.summary });
    setMessage(null);
    setSummaryError(null);
    setMode('edit');
  };

  const cancelEdit = useCallback(() => {
    setMessage(null);
    setSummaryError(null);
    setDraft(null);
    setMode('view');
  }, []);

  const onBack = useCallback(() => {
    if (mode === 'edit') cancelEdit();
    else if (mode === 'manual') goBackOr(router, '/analysis');
    else {
      const to = resolveDest('05');
      goBackOr(router, to.kind === 'href' ? to.href : '/photos');
    }
  }, [mode, cancelEdit, router]);
  const onBackRef = useRef(onBack);
  const modeRef = useRef(mode);
  useLayoutEffect(() => {
    onBackRef.current = onBack;
    modeRef.current = mode;
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (modeRef.current === 'view') return false; // 보기 상태는 ‹ 와 같게 화면 스택이 처리한다
        onBackRef.current();
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  // [저장]: 수정본(user_edited)만 쓴다. 확정이 아니다
  const onSave = async () => {
    if (!row || !draft || busyRef.current) return;
    if (sameView(draft, view ?? draft)) {
      cancelEdit(); // 바뀐 것이 없으면 저장할 것도 없다
      return;
    }
    const check = checkDraft(draft, { manual: false });
    if (!check.ok) {
      if (check.field === 'summary') setSummaryError(check.message);
      else setMessage(TRAITS.manualTagMin);
      return;
    }
    busyRef.current = true;
    setBusy('save');
    setMessage(null);
    const edited = toEdited(draft);
    const result = await api.saveEdited(row.id, edited);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(null);
    if (!result.ok) {
      setMessage(TRAITS.saveFailed); // 입력한 내용은 그대로 둔다
      return;
    }
    setView(edited);
    setRow({ ...row, edited });
    setDraft(null);
    setMode('view');
  };

  // [이대로 확정]: 지금 보이는 값(수정본이 있으면 수정본)을 최종값으로 한다
  const onConfirm = async () => {
    if (!row || !view || busyRef.current) return;
    if (mode === 'manual' && draft) {
      const check = checkDraft(draft, { manual: true });
      if (!check.ok) {
        setMessage(check.field === 'tags' ? TRAITS.manualTagMin : check.message);
        if (check.field === 'summary') setSummaryError(check.message);
        return;
      }
    }
    busyRef.current = true;
    setBusy('confirm');
    setMessage(null);
    if (mode === 'manual' && draft) {
      const saved = await api.manual(row.id, toEdited(draft));
      if (!alive.current) return;
      if (saved.kind !== 'ok') {
        busyRef.current = false;
        setBusy(null);
        setMessage(TRAITS.saveFailed);
        return;
      }
    }
    const done = await api.confirm(row.id);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(null);
    if (!done.ok) {
      // 서버 오류 코드별로 나눈다: 동의 → 03 · 설문 → 04 · 사진 → 05 확인창, 정리가 안 끝났으면 06 으로 되돌린다(문구 없음), 그 밖은 다시 시도
      if (done.reason === 'not-ready') {
        goForward(router, '/analysis');
        return;
      }
      setConfirmFail(done.reason === 'consent_missing' || done.reason === 'survey_incomplete' || done.reason === 'photos_incomplete' ? done.reason : 'other');
      return;
    }
    manualOfferStore.clear();
    setStage('traits-confirmed');
    // 07 확정 직후 한 번은 08 의 '처음 한 번 확인' 상태로 간다(?first=1, 화면_요구사항 08)
    goForward(router, { pathname: '/profile', params: { first: '1' } });
  };

  if (loading || !view || !row) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title={TRAITS.headerTitle} onBack={manualRequested ? onBack : undefined} testID="traits-header" />
        <View style={styles.loading} testID="screen-07-loading">
          {loadError ? (
            <>
              <OfflineArt show={loadError === 'network'} />
              <AppText variant="body" tone="sub" accessibilityRole="alert" style={styles.centered}>
                {loadError === 'network' ? COMMON.offline : COMMON.server}
              </AppText>
              <Button label={COMMON.retry} inline onPress={() => {
                  setLoadError(null);
                  void load();
                }}
                testID="traits-retry" />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.accent} />
              <AppText variant="caption">{COMMON.loading}</AppText>
            </>
          )}
        </View>
      </Screen>
    );
  }

  const editing = mode !== 'view';
  const shown = editing && draft ? draft : view;
  const dirty = mode === 'edit' && draft ? !sameView(draft, view) : true;
  const evidence = mode === 'view' && row.source === 'ai' ? (row.original?.evidence ?? null) : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScreenHeader title={TRAITS.headerTitle} onBack={onBack} testID="traits-header" />
      <KeyboardAvoid>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID={mode === 'view' ? 'screen-07' : mode === 'edit' ? 'screen-07-edit' : 'screen-07-manual'}>
        <View style={styles.titles}>
          <AppText variant="title" accessibilityRole="header" testID="traits-title">
            {mode === 'manual' ? TRAITS.manualTitle : TRAITS.title}
          </AppText>
          <AppText variant="body" tone="sub" testID="traits-subtitle">
            {mode === 'manual' ? TRAITS.manualSubtitle : TRAITS.subtitle}
          </AppText>
        </View>

        <View style={styles.axes} testID="traits-axes">
          {AXIS_ORDER.map((key: TraitKey) =>
            editing && draft ? (
              <TraitSlider
                key={key}
                name={AXIS_NAMES[key]}
                value={draft.traits[key]}
                onChange={(value) => setDraft((d) => (d ? { ...d, traits: setTrait(d.traits, key, value) } : d))}
                testID={`trait-slider-${key}`}
              />
            ) : (
              <TraitBar key={key} name={AXIS_NAMES[key]} value={shown.traits[key]} testID={`trait-bar-${key}`} />
            ),
          )}
          <AppText variant="caption" testID="traits-axis-note">
            {TRAITS.axisNote}
          </AppText>
        </View>

        <View style={styles.section}>
          <AppText variant="bodyBold" accessibilityRole="header">
            {TRAITS.tagsTitle}
          </AppText>
          {mode === 'view' ? (
            <TagList tags={view.tags} />
          ) : mode === 'edit' && draft ? (
            <TagEditor tags={draft.tags} onChange={(tags) => setDraft((d) => (d ? { ...d, tags } : d))} />
          ) : draft ? (
            <TagPicker candidates={candidates} selected={draft.tags} onChange={(tags) => setDraft((d) => (d ? { ...d, tags } : d))} />
          ) : null}
        </View>

        <Card style={styles.summary} testID="traits-summary-card">
          <AppText variant="bodyBold" accessibilityRole="header">
            {TRAITS.summaryTitle}
          </AppText>
          {editing && draft ? (
            <TextField
              label={TRAITS.summaryLabel}
              value={draft.summary}
              onChangeText={(value) => {
                setSummaryError(null);
                setDraft((d) => (d ? { ...d, summary: clipSummary(value) } : d));
              }}
              multiline
              maxLength={SUMMARY_MAX_LEN}
              error={summaryError}
              testID="summary-input"
            />
          ) : (
            <AppText variant="body" testID="traits-summary">
              {view.summary}
            </AppText>
          )}
          {editing && draft ? (
            <AppText variant="caption" testID="summary-count">{`${draft.summary.length} / ${SUMMARY_MAX_LEN}`}</AppText>
          ) : null}
        </Card>

        {evidence ? <EvidenceList evidence={evidence} /> : null}
      </ScrollView>

      {confirmFail ? (
        <ConfirmDialog
          visible
          title={TRAITS.confirmErrors[confirmFail].title}
          body={TRAITS.confirmErrors[confirmFail].body}
          confirmLabel={TRAITS.confirmErrors[confirmFail].go}
          cancelLabel={TRAITS.confirmErrors[confirmFail].cancel}
          onCancel={() => setConfirmFail(null)}
          onConfirm={() => {
            const kind = confirmFail;
            setConfirmFail(null);
            if (kind === 'other') void onConfirm();
            else if (kind === 'consent_missing') router.push('/consent');
            else if (kind === 'survey_incomplete') router.push(resolveDestHref('04:first'));
            else router.push('/photos');
          }}
          testID="traits-confirm-fail"
        />
      ) : null}
      <View style={styles.footer}>
        <CtaFade />
        {message ? (
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="traits-message">
            {message}
          </AppText>
        ) : null}
        <View style={styles.buttons}>
          {mode === 'view' ? (
            <>
              <View style={styles.half}>
                <Button label={TRAITS.edit} variant="secondary" onPress={startEdit} testID="traits-edit" />
              </View>
              <View style={styles.half}>
                <Button label={TRAITS.confirm} loading={busy === 'confirm'} onPress={onConfirm} testID="traits-confirm" />
              </View>
            </>
          ) : mode === 'edit' ? (
            <>
              <View style={styles.half}>
                <Button label={TRAITS.cancel} variant="secondary" onPress={cancelEdit} testID="traits-cancel" />
              </View>
              <View style={styles.half}>
                <Button label={TRAITS.save} loading={busy === 'save'} dimmed={!dirty} onPress={onSave} testID="traits-save" />
              </View>
            </>
          ) : (
            <View style={styles.half}>
              <Button label={TRAITS.confirm} loading={busy === 'confirm'} onPress={onConfirm} testID="traits-confirm" />
            </View>
          )}
        </View>
      </View>
      </KeyboardAvoid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s20, paddingBottom: space.s24, gap: space.s20 },
  titles: { gap: space.s12 },
  axes: { gap: space.s8 },
  section: { gap: space.s8 },
  summary: { gap: space.s12 },
  footer: { paddingHorizontal: CTA_PADDING.paddingHorizontal, paddingTop: CTA_PADDING.paddingTop, paddingBottom: CTA_PADDING.paddingBottom, gap: space.s8, backgroundColor: colors.bg }, // 하단 고정 v2(D36 #10, F21): 위 흐림 24 · 선 없음 · 위 8 · 좌우 20 · 아래 16
  buttons: { flexDirection: 'row', gap: space.s12 },
  half: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s12, paddingHorizontal: size.screenPadding },
  centered: { textAlign: 'center' },
});
