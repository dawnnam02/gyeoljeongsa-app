// 12 설정의 등급 스위치(카피 16-G · 16-J L-2, 법무 C7 · v5 카피.md 12-Q, QP-A):
//  · '등급 계산 멈추기' — 멈추면 내 등급을 지우고 더 계산하지 않아요(set_grade_processing). 등급이 없으면 짝을 고를 수 없어서, 다시 켜기 전까지 탑승권을 살 수 없어요
//  · v5: '내 등급 보이기'(CK10) 줄은 없다 — 상대 등급이 누구에게도 보이지 않는다(청사진 6-2 · 12-Q SETTINGS16.showRow '(줄 없음)'). 이미 받은 CK10 기록 처리는 법무 · 서버 몫
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { COMMON } from '@/content/copy';
import { SETTINGS16 } from '@/content/shopCopy';
import { CONSENT_MANAGE } from '@/content/settingsCopy';
import type { GradeApi } from '@/lib/gradeApi';
import { useGradeSettingsStore } from '@/store/gradeSettingsStore';
import { space } from '@/theme/tokens';

import { RowGroup, SwitchRow } from './SettingsParts';

export type GradeSettingsDeps = { grade: Pick<GradeApi, 'loadProcessing' | 'setProcessing'> };

export function GradeSwitches({ grade, onToast }: GradeSettingsDeps & { onToast: (text: string) => void }) {
  const stopped = useGradeSettingsStore((s) => s.stopped);
  const [ready, setReady] = useState(false); // 서버의 멈춤 여부를 한 번 읽은 뒤에 줄을 그린다
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false); // 멈추는 쪽(켜기)에서만 묻는다(16-N, D-61)
  const [resumed, setResumed] = useState(false); // 다시 켠 뒤 '다음 날 새벽에 다시 계산해요.'(SETTINGS16.resumeNote, 정책 P3-09)
  const busyRef = useRef(false);
  const alive = useRef(true);

  // 처음 한 번: 서버의 멈춤 여부(S8d, get_grade_processing). 읽지 못하면 이 기기에 남은 값을 그대로 둔다
  useEffect(() => {
    alive.current = true;
    void grade.loadProcessing().then((r) => {
      if (!alive.current) return;
      if (r.ok) useGradeSettingsStore.setState({ stopped: !r.data.processing });
      setReady(true);
    });
    return () => {
      alive.current = false;
    };
  }, [grade]);

  const fail = useCallback((reason: string) => setError(reason === 'network' ? COMMON.offline : reason === 'session' ? COMMON.sessionLost : CONSENT_MANAGE.saveFailed), []);

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
      setResumed(result.processing);
      onToast(CONSENT_MANAGE.saved);
    } else fail(result.reason);
  };

  if (!ready) return null;
  return (
    <>
      <RowGroup testID="settings-grade-switches">
        <SwitchRow label={SETTINGS16.stopRow} note={SETTINGS16.stopNote} on={stopped} disabled={busy} last onPress={pressStop} testID="settings-grade-stop" />
      </RowGroup>
      {resumed && !stopped ? (
        <AppText variant="caption" style={styles.error} testID="settings-grade-resume-note">
          {SETTINGS16.resumeNote}
        </AppText>
      ) : null}
      <ConfirmDialog
        visible={confirmStop}
        title={SETTINGS16.stopConfirm.title}
        body={SETTINGS16.stopConfirm.body}
        note={{ text: SETTINGS16.stopConfirm.boarded }} // D-199: 본문 끝 한 줄 — 늘 보인다(서버를 한 번 더 부르지 않음, 화면_요구사항 12-3 ④)
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
