// 12 › 차단 목록(Figma 12l 231:2 · 12m) · 신고 내역(12n 231:60 · 12o). K2 12 · 정책 P5-11 · P5-14 · 카피.md 12(R-D18-1 · R-D18-2).
//  차단 목록: "박OO · 29" + [차단 해제]. 해제하면 그 줄이 사라진다(해제 뒤 30일은 추천에 나오지 않는 일은 서버가 한다)
//  신고 내역: 신고한 날 + 상태(접수됨 · 확인 중 · 처리됨)만. 누구를 신고했는지 · 상대가 받은 조치는 보이지 않는다
//    (Figma 12n 은 상대 이름 · "처리 완료" · 2026.10.14 를 그렸지만, 서버 list_my_reports 는 상대를 주지 않고 카피.md 12 확정 글이 원본이다)
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { COMMON } from '@/content/copy';
import { BLOCKED, REPORTS } from '@/content/settingsCopy';
import type { BlockedPerson, MyReport, SettingsApi } from '@/lib/settingsApi';
import { layout } from '@/theme/layout';
import { H2_EMPTY_ART } from '@/theme/uiAssets';
import { colors, radius, size, space } from '@/theme/tokens';

import { blockedHead, reportDate } from './settingsLogic';
import { LoadState, OutlineButton, RowGroup, SubPage } from './SettingsParts';
import { useLoad } from './useLoad';

export function BlockedListPage({ api, onBack, onToast }: { api: Pick<SettingsApi, 'loadBlocked' | 'unblock'>; onBack: () => void; onToast?: (text: string) => void }) {
  const read = useCallback(() => api.loadBlocked(), [api]);
  const { phase, data, setData, reload, alive } = useLoad<BlockedPerson[]>(read);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unblock = async (person: BlockedPerson) => {
    if (busyId) return;
    setBusyId(person.userId);
    setError(null);
    const result = await api.unblock(person.userId);
    if (!alive.current) return;
    setBusyId(null);
    if (result.ok) {
      setData((list) => (list ?? []).filter((p) => p.userId !== person.userId));
      onToast?.(BLOCKED.unblocked); // U28: 확인창 없이 바로 풀고 토스트
      return;
    }
    setError(result.reason === 'network' ? COMMON.offline : BLOCKED.unblockFailed);
  };

  const list = data ?? [];
  return (
    <SubPage title={BLOCKED.headerTitle} onBack={onBack} testID="settings-blocked">
      {phase !== 'ready' ? (
        <LoadState state={phase} onRetry={reload} testID="settings-blocked" />
      ) : list.length === 0 ? (
        <LoadState state="empty" empty={BLOCKED.empty} art={H2_EMPTY_ART.emptyBlocked} onRetry={reload} testID="settings-blocked" />
      ) : (
        <RowGroup testID="settings-blocked-list">
          {list.map((person, i) => {
            const head = blockedHead(person.name, person.age);
            return (
              <View key={person.userId} style={[styles.row, i < list.length - 1 && styles.divider]} testID={`settings-blocked-row-${person.userId}`}>
                <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                <AppText variant="bodyMedium" style={styles.flex} testID={`settings-blocked-head-${person.userId}`}>
                  {head}
                </AppText>
                <OutlineButton
                  small
                  label={BLOCKED.unblock}
                  accessibilityLabel={BLOCKED.unblockA11y(head)}
                  busy={busyId === person.userId}
                  onPress={() => void unblock(person)}
                  testID={`settings-unblock-${person.userId}`}
                />
              </View>
            );
          })}
        </RowGroup>
      )}
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="settings-blocked-action-error">
          {error}
        </AppText>
      ) : null}
    </SubPage>
  );
}

export function ReportHistoryPage({ api, now, onBack }: { api: Pick<SettingsApi, 'loadReports'>; now: () => number; onBack: () => void }) {
  const read = useCallback(() => api.loadReports(), [api]);
  const { phase, data, reload } = useLoad<MyReport[]>(read);
  const list = data ?? [];
  const today = now();
  return (
    <SubPage title={REPORTS.headerTitle} onBack={onBack} testID="settings-reports">
      {phase !== 'ready' ? (
        <LoadState state={phase} onRetry={reload} testID="settings-reports" />
      ) : list.length === 0 ? (
        <LoadState state="empty" empty={REPORTS.empty} art={H2_EMPTY_ART.emptyReports} onRetry={reload} testID="settings-reports" />
      ) : (
        <RowGroup testID="settings-reports-list">
          {list.map((r, i) => {
            const date = reportDate(r.createdAt, today);
            const status = REPORTS.status[r.status];
            return (
              <View key={r.id} style={[styles.row, i < list.length - 1 && styles.divider]} accessible accessibilityLabel={`${date}, ${status}`} testID={`settings-report-row-${r.id}`}>
                <AppText variant="body" style={styles.flex} testID={`settings-report-date-${r.id}`}>
                  {date}
                </AppText>
                <Chip label={status} variant={r.status === 'done' ? 'inactive' : 'tag'} testID={`settings-report-status-${r.id}`} />
              </View>
            );
          })}
        </RowGroup>
      )}
    </SubPage>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s12, paddingVertical: space.s8 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: layout.avatar, height: layout.avatar, borderRadius: radius.pill, backgroundColor: colors.line },
  flex: { flex: 1, flexShrink: 1 },
});
