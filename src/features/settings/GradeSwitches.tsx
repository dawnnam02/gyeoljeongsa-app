// 12 설정의 등급 스위치 둘(카피 16-G · 16-J L-2, 법무 C7, 수익/상점_화면.md 7-7): 
//  · '내 등급 보이기' — 켜면 등급 구독 회원이 추천에서 내 등급을 볼 수 있어요(CK10 선택 동의, 처음값 꺼짐). 켜기 = 동의 기록 더하기, 끄기 = 철회(남의 화면의 고정값이 바로 사라진다). 끈 사람에게 '비공개' 낙인 · 반복 권유 없음
//  · '등급 계산 멈추기' — 멈추면 내 등급을 지우고 더 계산하지 않아요(set_grade_processing). 등급 구독 회원의 추천 상대를 고르는 데도 쓰이지 않아요. 구독 중이면 내 등급 화면이 비어요
// 두 스위치는 따로 움직인다. CK10 을 꺼도 계산은 멈추지 않고, 계산을 멈춰도 동의 기록은 그대로다(D-61).
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { COMMON } from '@/content/copy';
import { SETTINGS16 } from '@/content/shopCopy';
import { CONSENT_MANAGE } from '@/content/settingsCopy';
import type { GradeApi } from '@/lib/gradeApi';
import type { SettingsApi } from '@/lib/settingsApi';
import { useGradeSettingsStore } from '@/store/gradeSettingsStore';
import { space } from '@/theme/tokens';

import { RowGroup, SwitchRow } from './SettingsParts';

export type GradeSettingsDeps = { settings: Pick<SettingsApi, 'loadConsents' | 'setOptional'>; grade: Pick<GradeApi, 'loadMine' | 'loadProcessing' | 'setProcessing'> };

export function GradeSwitches({ settings, grade, onToast }: GradeSettingsDeps & { onToast: (text: string) => void }) {
  const stopped = useGradeSettingsStore((s) => s.stopped);
  const [show, setShow] = useState<boolean | null>(null); // CK10 켜짐(읽기 전에는 null → 줄을 그리지 않는다)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false); // 멈추는 쪽(켜기)에서만 묻는다(16-N, D-61)
  const busyRef = useRef(false);
  const alive = useRef(true);

  // 처음 한 번: CK10 값 + 구독 여부 + 서버의 멈춤 여부(S8d). 읽기에 실패하면 줄을 그리지 않는다(없는 값을 만들지 않는다)
  useEffect(() => {
    alive.current = true;
    void settings.loadConsents().then((r) => {
      if (alive.current && r.ok) setShow(r.data.CK10);
    });
    void grade.loadMine().then((r) => {
      if (!alive.current || !r.ok) return;
      if (r.data.kind === 'locked') useGradeSettingsStore.setState({ subscribed: false });
      else useGradeSettingsStore.setState({ subscribed: true });
    });
    // S8d: 멈춤 여부는 구독자 · 비구독자 모두 서버 값(get_grade_processing)을 읽는다. 읽지 못하면 이 기기에 남은 값을 그대로 둔다
    void grade.loadProcessing().then((r) => {
      if (alive.current && r.ok) useGradeSettingsStore.setState({ stopped: !r.data.processing });
    });
    return () => {
      alive.current = false;
    };
  }, [settings, grade]);

  const fail = useCallback((reason: string) => setError(reason === 'network' ? COMMON.offline : reason === 'session' ? COMMON.sessionLost : CONSENT_MANAGE.saveFailed), []);

  const toggleShow = async () => {
    if (show === null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await settings.setOptional('CK10', !show);
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (result.ok) {
      setShow(!show);
      onToast(CONSENT_MANAGE.saved);
    } else fail(result.reason);
  };

  const pressStop = () => {
    if (busyRef.current) return;
    if (stopped) void toggleStop(); // 다시 계산하는 쪽은 바로
    else setConfirmStop(true);
  };

  const toggleStop = async () => {
    if (busyRef.current) return;
    setConfirmStop(false);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const result = await grade.setProcessing(stopped); // 지금 멈춰 있으면 다시 계산(true), 아니면 멈춤(false)
    busyRef.current = false;
    if (!alive.current) return;
    setBusy(false);
    if (result.ok) {
      useGradeSettingsStore.setState({ stopped: !result.processing });
      onToast(CONSENT_MANAGE.saved);
    } else fail(result.reason);
  };

  if (show === null) return null;
  return (
    <>
      <RowGroup testID="settings-grade-switches">
        <SwitchRow label={SETTINGS16.showRow} note={SETTINGS16.showNote} on={show} disabled={busy} onPress={toggleShow} testID="settings-grade-show" />
        <SwitchRow label={SETTINGS16.stopRow} note={SETTINGS16.stopNote} on={stopped} disabled={busy} last onPress={pressStop} testID="settings-grade-stop" />
      </RowGroup>
      <ConfirmDialog
        visible={confirmStop}
        title={SETTINGS16.stopConfirm.title}
        body={SETTINGS16.stopConfirm.body}
        confirmLabel={SETTINGS16.stopConfirm.confirm}
        cancelLabel={SETTINGS16.stopConfirm.cancel}
        busy={busy}
        onConfirm={() => void toggleStop()}
        onCancel={() => setConfirmStop(false)}
        testID="settings-grade-stop-confirm"
      />
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error} testID="settings-grade-error">
          {error}
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { paddingHorizontal: space.s4 },
});
