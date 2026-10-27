// 사전 오픈 대기 화면(09 자리, K20 2-4 · 4-5 · P-D1 · F22 2). 추천 탭에 오늘의 추천 대신 그린다(features/prelaunch/PrelaunchGate 가 고른다).
//  위에서 아래: 머리(출연 준비 + 프로필 원) → (미룸 공지, 한 번) → 로고 타일 · 신청 번호 + '순서를 뜻하는 번호는 아니에요.' → 상태 카드(확정 · 함께하기 어려워요 · 할 일 한 줄)
//   → 단계표 5칸 → 첫 추천 날짜 · 요일 · 시각(또는 내 지역 첫 추천 안내 + [지역 넓혀 먼저 시작하기]) → 기다리는 동안 할 일 ①~④ → '방송 아님' 고지 → (데모 모드) 장면 줄
//  · 날짜 · 요일 · 시각 글만. 남은 날 수 · 카운트다운 · 움직이는 숫자 · 깜빡임 0(K20 2-6 · P-11). 순번 · 앞사람 수 · 진행 % · 대기 인원 0(P-10)
//  · 매일 바뀌는 내용(오늘의 팁 · 출석) 0 — 매일 들어올 이유를 만들지 않는다. 알림 권한 묻기(NP-10)는 넣지 않는다(푸시 0, F22 · D-123)
//  · 상태를 못 읽으면 틀만 보이고 날짜는 숨긴다 + [다시 시도](K20 4-1)
//  · 확정이면 로고 타일이 한 번 찍힌다(D-76 성공 순간 · 동작 줄이기는 투명도만 — motion/StampTile)
//  · '방송 아님' 고지: 확정이면 확정 카드 안에, 아니면 화면 아래에 한 줄(같은 화면에 두 번 보이지 않게). 신청 잇기 시트에도 한 줄(K20 2-1 고지 3곳)
//  · 미룸 공지(K20 2-6 · P-21 · NP-19): 서버 미룸 횟수가 이 기기에서 본 것보다 늘었을 때 맨 위 카드 한 번 → [확인했어요]. 날짜 줄은 서버 새 날짜 그대로. 푸시 0
//  · 먼저 시작(K20 3-4 ② · NP-18): 서버가 can_early_join 일 때만 버튼. 확인 한 줄 뒤 본인이 누를 때만 early_join. 양보 불가면 서버가 풀지 않고 안내만
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { PREFERENCES_EDIT_ENABLED } from '@/config/flags';
import { COMMON, RECS } from '@/content/copy';
import { useFeatureFlags, type FlagsStore } from '@/hooks/useFeatureFlags';
import { logoTile, StampTile, TOAST_MS } from '@/motion';
import { openSettingsPage } from '@/features/settings/settingsIntent';
import { resolveDest } from '@/navigation/resolve';
import { colors, radius, size, space } from '@/theme/tokens';

import type { LaunchApi, LaunchState, Region } from './launchApi';
import { dayText, firstRecWhen, showsLaunchDay, todoOf, waitTasks, type WaitTask } from './launchLogic';
import { LinkSheet } from './LinkSheet';
import { LINK_SHEET, PRELAUNCH } from './prelaunchCopy';
import { StepTable } from './StepTable';

type Props = {
  state: LaunchState | null; // null = 못 읽음(틀만)
  failure: 'network' | 'server' | null;
  onRetry: () => void;
  onChanged: () => void; // 잇기 · 먼저 시작 뒤 다시 읽기
  api: Pick<LaunchApi, 'link' | 'earlyJoin'>;
  flags: FlagsStore;
  deferDue?: boolean; // 미룸 공지를 보일 때
  onDeferSeen?: () => void;
  linkedHere?: boolean; // 이 실행에서 이었음(서버 응답에 이은 여부 키가 없을 때)
  onLinkedHere?: () => void;
  toastMs?: number;
  demoBar?: ReactNode;
};

export function PrelaunchScreen({ state, failure, onRetry, onChanged, api, flags, deferDue = false, onDeferSeen, linkedHere = false, onLinkedHere, toastMs = TOAST_MS, demoBar }: Props) {
  const { isOn } = useFeatureFlags(flags);
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  const review = state?.review ?? null;
  const status = review?.status ?? null;
  const confirmed = status === 'confirmed';
  const declined = status === 'declined';
  const when = state && showsLaunchDay(state) ? firstRecWhen(state) : null; // 공개 뒤(review · region_wait)에는 지난 날짜라 쓰지 않는다
  const fixLine = review?.fixReason ? PRELAUNCH.fixReason[review.fixReason] : null; // S18 review.fix_reason — 보완 이유 한 줄
  const regionWait = state?.region?.state === 'wait' ? state.region : null;
  const tasks = state && !declined ? waitTasks({ ...state, linked: state.linked || linkedHere }, isOn) : [];
  const todo = review && !confirmed && !declined ? todoOf(review.steps) : null;
  // 할 일 한 줄: 서버가 보완 이유를 주면 그 줄(본인 확인 칸 보완도), 아니면 칸으로 고른 글
  const todoText = review && !confirmed && !declined && fixLine ? fixLine : todo ? PRELAUNCH.todo[todo] : null;
  const todoIsFix = Boolean((fixLine && !confirmed && !declined) || todo?.endsWith('Fix'));

  const linked = (no: string) => {
    setSheet(false);
    setToast(LINK_SHEET.linkedToast(no));
    onLinkedHere?.();
    onChanged();
  };

  return (
    <Screen edges={['top']} backdrop="recommendations" testID="prelaunch-screen">
      <TabHeader title={PRELAUNCH.headerTitle} testID="prelaunch-header" />
      <ScrollView contentContainerStyle={styles.content} testID="prelaunch-scroll">
        {deferDue && when ? (
          <Card style={[styles.gap8, styles.defer]} accessibilityLiveRegion="polite" testID="prelaunch-defer">
            <AppText variant="bodyBold">{PRELAUNCH.defer.title}</AppText>
            <AppText variant="body" testID="prelaunch-defer-body">
              {PRELAUNCH.defer.body(when)}
            </AppText>
            <Button label={PRELAUNCH.defer.ok} variant="secondary" onPress={() => onDeferSeen?.()} testID="prelaunch-defer-ok" />
          </Card>
        ) : null}

        <View style={styles.head} testID="prelaunch-head">
          <StampTile key={confirmed ? 'stamp' : 'still'} size={logoTile.moment} play={confirmed} testID={confirmed ? 'prelaunch-stamp' : 'prelaunch-tile'} />
          {state?.applicantNo ? (
            <View style={styles.headText}>
              <AppText variant="bodyBold" testID="prelaunch-no">
                {PRELAUNCH.applicantNo(state.applicantNo)}
              </AppText>
              <AppText variant="caption" testID="prelaunch-no-note">
                {PRELAUNCH.applicantNoNote}
              </AppText>
            </View>
          ) : null}
        </View>

        {failure ? (
          <Card style={styles.gap8} testID="prelaunch-error">
            <AppText variant="bodyMedium">{PRELAUNCH.loadFailed}</AppText>
            <AppText variant="caption" tone="text">
              {failure === 'network' ? COMMON.offline : COMMON.server}
            </AppText>
            <Button label={COMMON.retry} variant="secondary" onPress={onRetry} testID="prelaunch-retry" />
          </Card>
        ) : null}

        {confirmed ? (
          <Card accessible accessibilityLabel={when ? PRELAUNCH.confirmedA11y(when) : PRELAUNCH.confirmedTitle} style={styles.gap8} testID="prelaunch-confirmed">
            <AppText variant="title">{PRELAUNCH.confirmedTitle}</AppText>
            <AppText variant="body" testID="prelaunch-confirmed-body">
              {when ? PRELAUNCH.confirmed(when) : PRELAUNCH.confirmedNoDay}
            </AppText>
            <AppText variant="caption" testID="prelaunch-confirmed-notice">
              {PRELAUNCH.notice}
            </AppText>
          </Card>
        ) : null}

        {declined && review ? (
          <Card style={styles.gap8} testID="prelaunch-declined">
            <AppText variant="title">{PRELAUNCH.declinedTitle}</AppText>
            <AppText variant="body" testID="prelaunch-declined-reason">
              {review.declineReason ? PRELAUNCH.declined[review.declineReason] : PRELAUNCH.declinedUnknown}
            </AppText>
            {review.declineReason && PRELAUNCH.declinedNext[review.declineReason] ? (
              <AppText variant="caption" tone="text" testID="prelaunch-declined-next">
                {PRELAUNCH.declinedNext[review.declineReason]}
              </AppText>
            ) : null}
          </Card>
        ) : null}

        {todoText ? (
          <View style={[styles.todo, todoIsFix ? styles.todoFix : null]} accessibilityLiveRegion="polite" testID="prelaunch-todo">
            <AppText variant={todoIsFix ? 'bodyMedium' : 'body'}>{todoText}</AppText>
          </View>
        ) : null}

        {review?.vouchedBy && !declined ? (
          <AppText variant="small" testID="prelaunch-vouched">
            {PRELAUNCH.vouchedBy(review.vouchedBy)}
          </AppText>
        ) : null}

        {review && !declined ? <StepTable steps={review.steps} /> : null}

        {state && !declined ? (
          regionWait ? (
            <RegionCard region={regionWait} api={api} onChanged={onChanged} />
          ) : !showsLaunchDay(state) ? null : (
            <View style={styles.first} testID="prelaunch-first-rec">
              <AppText variant="smallMedium" tone="sub">
                {PRELAUNCH.firstRecLabel}
              </AppText>
              <AppText variant={when ? 'title' : 'body'} testID="prelaunch-first-rec-when">
                {when ? PRELAUNCH.firstRec(when) : PRELAUNCH.firstRecUnknown}
              </AppText>
            </View>
          )
        ) : null}

        {tasks.length > 0 ? (
          <View style={styles.tasks} testID="prelaunch-tasks">
            <AppText variant="bodyBold">{PRELAUNCH.tasksTitle}</AppText>
            {tasks.map((t) => (
              <TaskRow key={t} task={t} onLink={() => setSheet(true)} onAvoid={() => openSettingsPage(router, 'avoid')} />
            ))}
          </View>
        ) : null}

        {!confirmed ? (
          <AppText variant="caption" testID="prelaunch-notice">
            {PRELAUNCH.notice}
          </AppText>
        ) : null}

        {demoBar}
      </ScrollView>
      <LinkSheet visible={sheet} api={api} onClose={() => setSheet(false)} onLinked={linked} onAlready={onLinkedHere} />
      <Toast text={toast} testID="prelaunch-toast" />
    </Screen>
  );
}

// 출시 뒤 권역 기다림(K20 3-4 ②): 이유 한 줄(인원 · 칸 · 판정 전은 인원 글, 성비는 성비 글) · 인원 · 게이지 · 예상 날짜 0.
// 서버가 can_early_join 이면 [지역 넓혀 먼저 시작하기] → 확인 한 줄 → early_join. 이미 골랐으면 시작하는 날 한 줄
function RegionCard({ region, api, onChanged }: { region: Region; api: Pick<LaunchApi, 'earlyJoin'>; onChanged: () => void }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const text = region.reason === 'ratio' ? PRELAUNCH.region.ratio : region.name ? PRELAUNCH.region.count(region.name) : PRELAUNCH.region.countNoName;
  const joinedDay = dayText(region.earlyJoinOn);

  const join = async () => {
    setBusy(true);
    setError(null);
    const r = await api.earlyJoin();
    setBusy(false);
    if (r.ok) {
      setAsk(false);
      onChanged();
      return;
    }
    if (r.reason === 'locked') {
      setAsk(false);
      setLocked(true);
      return;
    }
    setError(r.reason === 'network' ? COMMON.offline : COMMON.server);
  };
  const goWiden = () => {
    const next = resolveDest('04:25', { origin: '09' }); // 09 의 지역 안내와 같은 길(12 희망 조건 수정 · 지역). 서버 값은 본인이 그 화면에서 바꿀 때만
    if (next.kind === 'href') router.push(next.href);
  };

  return (
    <Card style={styles.gap8} testID="prelaunch-region">
      <AppText variant="smallMedium" tone="sub">
        {PRELAUNCH.region.title}
      </AppText>
      <AppText variant="body" testID="prelaunch-region-text">
        {text}
      </AppText>
      {region.earlyJoinOn !== null ? (
        <AppText variant="bodyMedium" testID="prelaunch-early-joined">
          {joinedDay ? PRELAUNCH.region.earlyJoined(joinedDay) : PRELAUNCH.region.earlyJoinedNoDay}
        </AppText>
      ) : region.canEarlyJoin ? (
        <Button label={PRELAUNCH.region.early} variant="secondary" onPress={() => setAsk(true)} testID="prelaunch-early" />
      ) : null}
      {locked ? (
        <>
          <AppText variant="caption" tone="text" accessibilityLiveRegion="polite" testID="prelaunch-early-locked">
            {PRELAUNCH.region.earlyLocked}
          </AppText>
          {PREFERENCES_EDIT_ENABLED ? <Button label={RECS.widenButton} variant="secondary" onPress={goWiden} testID="prelaunch-early-widen" /> : null}
        </>
      ) : null}
      <ConfirmDialog
        visible={ask}
        title={PRELAUNCH.region.earlyTitle}
        body={PRELAUNCH.region.earlyBody}
        confirmLabel={PRELAUNCH.region.earlyConfirm}
        cancelLabel={PRELAUNCH.region.earlyCancel}
        busy={busy}
        error={error}
        onConfirm={() => void join()}
        onCancel={() => {
          if (busy) return;
          setAsk(false);
          setError(null);
        }}
        testID="prelaunch-early-confirm"
      />
    </Card>
  );
}

// 할 일 한 줄: 이름 + 한 줄 설명. 신청 잇기 · 아는 분 피하기(3부-사 FB-015 — 12-5 를 바로 엶)만 누를 곳이 있다. 그 밖은 화면이 아직 없어 '준비 중'(단계표와 같은 낱말)
function TaskRow({ task, onLink, onAvoid }: { task: WaitTask; onLink: () => void; onAvoid: () => void }) {
  const copy = PRELAUNCH.tasks[task];
  if (task === 'avoid') {
    return (
      <Card onPress={onAvoid} accessibilityLabel={`${copy.name}, ${copy.line}`} testID="prelaunch-task-avoid" style={styles.taskCard}>
        <AppText variant="bodyMedium">{copy.name}</AppText>
        <AppText variant="caption">{copy.line}</AppText>
      </Card>
    );
  }
  return (
    <View style={styles.task} testID={`prelaunch-task-${task}`}>
      <View style={styles.taskText}>
        <AppText variant="bodyMedium">{copy.name}</AppText>
        <AppText variant="caption">{copy.line}</AppText>
      </View>
      {task === 'link' ? (
        <TextButton label={PRELAUNCH.linkOpen} onPress={onLink} testID="prelaunch-link-open" />
      ) : (
        <AppText variant="caption" testID={`prelaunch-task-${task}-soon`}>
          {PRELAUNCH.states.na}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: size.screenPadding, paddingTop: space.s8, paddingBottom: space.s40, gap: space.s16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.s16 },
  headText: { flex: 1, gap: space.s4 },
  gap8: { gap: space.s8 },
  defer: { borderWidth: size.focusRing, borderColor: colors.accent },
  todo: { paddingVertical: space.s12, paddingHorizontal: space.s16, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  todoFix: { borderWidth: size.focusRing, borderColor: colors.accent },
  first: { gap: space.s4 },
  tasks: { gap: space.s12 },
  taskCard: { gap: space.s4 },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.touchMin, paddingVertical: space.s8, borderTopWidth: 1, borderTopColor: colors.line },
  taskText: { flex: 1, gap: space.s4 },
});
