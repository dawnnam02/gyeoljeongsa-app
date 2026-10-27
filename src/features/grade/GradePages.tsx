// 내 등급 쪽 넷(수익/상점_화면.md 7-3 ~ 7-6, 카피 16-E ~ 16-H, Figma 313:97 ~ 314:308). 16 상점 안의 쪽이라 탭바 · 원형 사진이 없다.
// W9(청사진_v5 6-1 · 6-2, 결정 #15): 단계 숫자 · 점수 막대 · '+n점' · 방향 문구(숫자가 작을수록) · 위/아래 말 · 9칸 격자 · 목표 단계 고르기를 지웠다
//  → 아이콘 하나 + 짧은 설명. 새 글은 GI(iconCopy.ts, 카피 키 제안). 아이콘은 임시 그림(GradeIcon)
//  16-G1 내 등급: 구독자 = 내 무리(MyFlock, 시안 p8) + 참고 문구 + 바뀔 수 있는 일 + 서류 인증 + 링크 4 + 한계 문구
//                 비구독자 = 잠금 안내(GI5) + [내 등급 알려 주세요] + [구독 알아보기] + 링크(잠김 그림은 여기만)
//                 첫 계산 전(NV46) · 나이대 합침(NV48) · 계산 멈춤(reason 'stopped') · 불러오기 실패(R8)
//  16-G2 변화 기록(날짜 · 이유 + 전/새 아이콘 그림) · 16-G3 도움이 되는 일 · 16-G4 등급은 어떻게 정해지나요(모든 회원 무료)
//  3부-사(0039 get_my_grade v5): 그림은 서버 grade_icon 그대로(숫자 0). 구독 잠금이 없어져 '내 등급 알려 주세요'(16-G5 무료 열람 요청, 법상 필수)는
//   보기 · 계산 전 · 멈춤 화면의 링크 줄 맨 위에 둔다(잠금 화면에만 있던 단추 — 길이 사라지지 않게). 서버가 주지 않는 칸(나이대 합침 · 매너 · 올릴 여지)은 그리지 않는다
// 서버 값만 그린다: 총 원점수 · 추천 점수는 받지도 보이지도 않는다. 영역 점수(areas)도 W9 부터 그리지 않는다.
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { StateArt } from '@/components/StateArt';
import { GRADE16, SHOP16 } from '@/content/shopCopy';
import type { MyGrade } from '@/lib/gradeApi';
import type { ShopState } from '@/lib/shopApi';
import { LinkRow } from '@/features/shop/parts';
import { formatDay, subViewOf } from '@/features/shop/shopLogic';
import type { ShopDeps, ShopNav } from '@/features/shop/shopTypes';
import { LoadState } from '@/features/settings/SettingsParts';
import { V5_HOME } from '@/navigation/v5Hide';
import { useLoad } from '@/features/settings/useLoad';
import { layout } from '@/theme/layout';
import { colors, space } from '@/theme/tokens';
import { H2_EMPTY_ART, STATE_ART } from '@/theme/uiAssets';

import { GradeIcon, MyFlock } from './GradeIcon';
import { iconOf } from './iconBridge';
import { goalTasks, reasonText, upTasks } from './gradeLogic';
import { GI } from './iconCopy';

type Deps = Pick<ShopDeps, 'grade' | 'now'>;

// ── 16-G1 ───────────────────────────────────────────────────────────
// shop: 상점 안에서 열면 상점 상태(구독 끝남 안내), 12 '내 등급' 줄(MyGradeScreen, D-200 ②)로 열면 null
export function GradeBody({ shop, deps, nav, onAccess }: { shop: ShopState | null; deps: Deps; nav: ShopNav; onAccess: () => void }) {
  const router = useRouter();
  const read = useCallback(() => deps.grade.loadMine(), [deps]);
  const { phase, data, reload } = useLoad<MyGrade>(read);

  if (phase !== 'ready' || !data) {
    return <LoadState state={phase === 'ready' ? 'loading' : phase} onRetry={reload} testID="grade" />;
  }

  if (data.kind === 'locked') {
    const ended = shop ? subViewOf(shop) === 'ended' : false;
    return (
      <View style={styles.page} testID="grade-locked">
        {ended ? (
          <Card style={styles.card}>
            <AppText variant="body" tone="text" testID="grade-ended">
              {SHOP16.endedSub}
            </AppText>
          </Card>
        ) : null}
        <View style={styles.lockedHead}>
          <Icon name="grade_locked" size={layout.tierBadgeBig} color={colors.accent} testID="grade-locked-art" />
        </View>
        {/* v5(QP-A, 카피.md 14-1): 구독 잠금 안내 글(GI5) · '구독 알아보기' 줄 없음 */}
        <Button label={GRADE16.lockedAccess} onPress={onAccess} testID="grade-locked-access" />
        <Card style={styles.linksCard}>
          <LinkRow label={GRADE16.lockedHow} onPress={() => nav.push({ name: 'grade-how' })} last testID="grade-locked-how" />
        </Card>
      </View>
    );
  }

  if (data.kind === 'pending') {
    return (
      <View style={styles.page} testID="grade-pending">
        <StateArt source={STATE_ART.noTier} size={layout.stateArt} testID="grade-pending-art" />
        {data.reason === 'stopped' ? (
          <>
            <AppText variant="bodyBold" style={styles.centered} testID="grade-stopped-big">
              {GRADE16.stoppedBig}
            </AppText>
            <AppText variant="body" tone="text" style={styles.centered} testID="grade-stopped">
              {GRADE16.stoppedBody}
            </AppText>
            <AppText variant="body" tone="text" style={styles.centered} testID="grade-stopped-how">
              {GRADE16.stoppedHow}
            </AppText>
            {data.firstReadyAt !== null ? (
              <AppText variant="caption" tone="text" style={styles.centered} testID="grade-stopped-first">
                {GRADE16.notYet(formatDay(data.firstReadyAt))}
              </AppText>
            ) : null}
            <Button label={GRADE16.stoppedButton} onPress={() => router.navigate('/settings')} testID="grade-stopped-go" />
          </>
        ) : (
          <AppText variant="bodyBold" style={styles.centered} testID="grade-first">
            {GRADE16.notYet(formatDay(data.firstReadyAt ?? deps.now()))}
          </AppText>
        )}
        <Card style={styles.linksCard}>
          <LinkRow label={GRADE16.lockedAccess} onPress={onAccess} testID="grade-pending-access" />
          <LinkRow label={GRADE16.links[2]} onPress={() => nav.push({ name: 'grade-how' })} last testID="grade-pending-how" />
        </Card>
      </View>
    );
  }

  const tasks = upTasks(data.actionable ?? []);
  const go = (key: 'verify' | 'ans' | 'act') => {
    if (key === 'verify') router.navigate('/settings'); // 12 인증 서류 제출(준비 중 줄)
    else if (key === 'ans') router.push('/profile'); // 08 프로필 선택 항목
    else router.navigate(V5_HOME); // 앱에 접속하기 → v5 홈(탑승권 탭). 옛 09 오늘의 추천은 숨김
  };

  return (
    <View style={styles.page} testID="grade-ready">
      <MyFlock icon={data.icon} testID="grade-flock" />
      {data.bandMerged ? (
        <AppText variant="caption" testID="grade-merged">
          {GRADE16.merged}
        </AppText>
      ) : null}
      <AppText variant="caption" tone="text" testID="grade-reference">
        {GRADE16.reference}
      </AppText>
      {data.shownAt !== null ? (
        <AppText variant="caption" testID="grade-shown">
          {GRADE16.shown(formatDay(data.shownAt))}
        </AppText>
      ) : null}
      {data.mannerOk ? (
        <AppText variant="caption" tone="text" testID="grade-manner">
          {GRADE16.manner}
        </AppText>
      ) : null}

      {tasks.length > 0 ? (
        <Card style={styles.card} testID="grade-up">
          <AppText variant="bodyBold">{GI.tasksTitle}</AppText>
          {tasks.map((t) => (
            <View key={t.key} style={styles.task} testID={`grade-up-${t.key}`}>
              <AppText variant="body" tone="text" style={styles.flex}>
                {t.text}
              </AppText>
              <Button label={GRADE16.upGo} variant="secondary" onPress={() => go(t.key)} testID={`grade-up-${t.key}-go`} />
            </View>
          ))}
          <AppText variant="caption" testID="grade-up-note">
            {GRADE16.upNote}
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.card} testID="grade-verify">
        <AppText variant="bodyBold">{GI.verifyTitle}</AppText>
        {GRADE16.verifyRows.map((name) => (
          <AppText key={name} variant="body" tone="text">
            {name}
          </AppText>
        ))}
        {data.verifyOn ? (
          <Button label={GRADE16.verifyGo} variant="secondary" onPress={() => go('verify')} testID="grade-verify-go" />
        ) : (
          <AppText variant="caption" testID="grade-verify-soon">
            {GRADE16.verifySoon}
          </AppText>
        )}
      </Card>

      <Card style={styles.linksCard} testID="grade-links">
        <LinkRow label={GRADE16.lockedAccess} onPress={onAccess} testID="grade-link-access" />
        <LinkRow label={GRADE16.links[0]} onPress={() => nav.push({ name: 'grade-history' })} testID="grade-link-history" />
        <LinkRow label={GRADE16.links[1]} onPress={() => nav.push({ name: 'grade-goal' })} testID="grade-link-goal" />
        <LinkRow label={GRADE16.links[2]} onPress={() => nav.push({ name: 'grade-how' })} testID="grade-link-how" />
        <LinkRow label={GRADE16.links[3]} onPress={() => router.navigate('/settings')} last testID="grade-link-review" />
      </Card>

      <AppText variant="caption" testID="grade-limits">
        {GRADE16.limits}
      </AppText>
    </View>
  );
}

// ── 16-G2 ───────────────────────────────────────────────────────────
export function HistoryBody({ deps }: { deps: Deps }) {
  const read = useCallback(() => deps.grade.loadHistory(), [deps]);
  const { phase, data, reload } = useLoad(read);
  if (phase !== 'ready' || !data) return <LoadState state={phase === 'ready' ? 'loading' : phase} onRetry={reload} testID="history" />;
  // 전 단계가 없는 기록은 이유 코드 first(첫 계산)만 줄로 보인다(16-L-4). 그 밖의 전 단계 없는 기록은 넣지 않는다
  const items = data.kind === 'items' ? data.items.filter((i) => i.fromNo !== null || i.reason === 'first') : [];
  return (
    <View style={styles.page} testID="history-body">
      <AppText variant="caption" tone="text" testID="history-schedule">
        {GI.historySchedule}
      </AppText>
      {items.length === 0 ? (
        <View style={styles.empty} testID="history-empty">
          <StateArt source={H2_EMPTY_ART.emptyHistory} size={layout.stateArt} testID="history-empty-art" />
          <AppText variant="body" tone="sub" testID="history-empty-text">
            {GRADE16.historyEmpty}
          </AppText>
        </View>
      ) : (
        <Card style={styles.card}>
          {items.map((item, i) => {
            const reason = reasonText(item.reason);
            const line = item.fromNo === null ? GI.historyFirst(formatDay(item.at)) : GI.historyLine(formatDay(item.at), reason ?? '');
            return (
              <View key={`${item.at}-${i}`} style={styles.task} testID={`history-row-${i}`}>
                {item.fromNo !== null ? <GradeIcon icon={iconOf(undefined, item.fromNo)} size={layout.tierBadgeCard} testID={`history-from-${i}`} /> : null}
                <GradeIcon icon={iconOf(undefined, item.toNo)} size={layout.tierBadgeCard} testID={`history-to-${i}`} />
                <AppText variant="body" tone="text" style={styles.flex} testID={`history-item-${i}`}>
                  {line}
                </AppText>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

// ── 16-G3 ───────────────────────────────────────────────────────────
// W9: 목표 단계 고르기(숫자 칩)는 없앴다. 도움이 되는 일과 그 상태만 보인다
export function GoalBody({ deps }: { deps: Deps }) {
  const read = useCallback(() => deps.grade.loadMine(), [deps]);
  const { phase, data, reload } = useLoad<MyGrade>(read);
  if (phase !== 'ready' || !data) return <LoadState state={phase === 'ready' ? 'loading' : phase} onRetry={reload} testID="goal" />;
  if (data.kind !== 'ready') {
    return (
      <View style={styles.page} testID="goal-body">
        <AppText variant="caption" tone="text" testID="goal-promise">
          {GRADE16.goalPromise}
        </AppText>
      </View>
    );
  }
  // v5 서버(0039)는 올릴 여지(actionable)를 보내지 않는다 — 그때는 할 일 줄만 보이고 '완료' 표시를 만들지 않는다(사실이 아닌 완료 0)
  const known = data.actionable !== null;
  const tasks = goalTasks(data.actionable ?? []);
  return (
    <View style={styles.page} testID="goal-body">
      <AppText variant="bodyBold" testID="goal-pick">
        {GI.goalHead}
      </AppText>
      <Card style={styles.card} testID="goal-tasks">
        {tasks.map((t) => (
          <View key={t.key} style={styles.task} testID={`goal-task-${t.key}`}>
            <AppText variant="body" tone="text" style={styles.flex}>
              {t.text}
            </AppText>
            {known && t.done ? <Chip label={t.doneText} variant="tag" testID={`goal-task-${t.key}-done`} /> : null}
          </View>
        ))}
      </Card>
      <AppText variant="caption" tone="text" testID="goal-promise">
        {GRADE16.goalPromise}
      </AppText>
    </View>
  );
}

// ── 16-G4 ───────────────────────────────────────────────────────────
// W9: 9칸 격자(1등급부터 9등급까지) · 방향 문구 · NV83 · NV84 는 없앴다. 아이콘을 차례대로 늘어놓는 곳도 두지 않는다
export function HowBody() {
  return (
    <View style={styles.page} testID="how-body">
      <AppText variant="body" tone="text" testID="how-head">
        {GI.howHead}
      </AppText>
      <AppText variant="body" tone="text" testID="how-shapes">
        {GI.howShapes}
      </AppText>
      <AppText variant="caption" tone="text" testID="how-common">
        {GRADE16.howCommon}
      </AppText>
      <Card style={styles.card}>
        {[GRADE16.howWho, GRADE16.howUses, GI.howProcess, GRADE16.howNot, GRADE16.howReview].map((text, i) => (
          <AppText key={i} variant="caption" tone="text" testID={`how-part-${i}`}>
            {text}
          </AppText>
        ))}
      </Card>
      <Card style={styles.card}>
        <AppText variant="caption" tone="text" testID="how-relation">
          {GI.payNote}
        </AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.s12 },
  card: { gap: space.s12 },
  linksCard: { padding: 0, overflow: 'hidden' },
  flex: { flex: 1, flexShrink: 1 },
  centered: { textAlign: 'center' },
  lockedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  empty: { alignItems: 'center', gap: space.s8, paddingVertical: space.s24 },
});
