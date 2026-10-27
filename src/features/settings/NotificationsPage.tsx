// 12 › 알림(Figma 12h 230:2): 서비스 알림 스위치 3개(추천 도착 · 받은 호감 · 연결, profiles.notify_*) + 마케팅 알림(CK9 동의와 같은 값) + 아래 글 3줄(법무 4-9).
//  · 바꾸면 바로 저장한다. 실패하면 스위치를 되돌리고 이유를 보인다(같은 스위치를 저장 중에 다시 눌러도 요청은 한 번)
//  · 마케팅 알림은 동의 관리의 CK9 스위치와 같은 기록을 바꾼다: 켜면 동의, 끄면 철회(확인창 없음) + 토스트 "저장했어요."(N10)
//  · 푸시 권한: 아직 묻지 않았으면 위에 동의문구 5-5 안내 글을 먼저 보이고, 서비스 알림을 켤 때 시스템 권한 창을 띄운다(거부해도 저장은 그대로, 앱은 다 쓸 수 있다)
//    거부된 채 서비스 알림이 켜져 있으면 "알림이 꺼져 있어요. 설정에서 허용해 주세요."(R-D18-3)
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { COMMON } from '@/content/copy';
import { NOTIFY } from '@/content/settingsCopy';
import type { NotifyKey, NotifyPrefs, OptionalConsents, SettingsApi } from '@/lib/settingsApi';
import { space } from '@/theme/tokens';

import { LoadState, RowGroup, SubPage, SwitchRow } from './SettingsParts';
import type { PushStatus } from './deviceDeps';
import { useLoad } from './useLoad';

type Data = { prefs: NotifyPrefs; marketing: boolean };
type Api = Pick<SettingsApi, 'loadNotify' | 'saveNotify' | 'loadConsents' | 'setOptional'>;

// v5(카피.md 12-Q · 화면_요구사항 12-2): 서비스 알림 2줄 — '이번 주 만날 분이 정해졌을 때'(서버 P8 · P8b 가 읽는 notify_match 열, 0036) ·
//  '대화방에 새 글이 왔을 때'(notify_chat, D-199, 처음 켜짐 + 아래 작은 글). 옛 v4 줄(호감 · 연결)은 그리지 않는다
const SERVICE: readonly { key: NotifyKey; label: string; note?: string }[] = [
  { key: 'match', label: NOTIFY.recommendation },
  { key: 'chat', label: NOTIFY.chat, note: NOTIFY.chatNote },
];

export function NotificationsPage({ api, pushStatus, onRequestPush, onBack, onToast }: { api: Api; pushStatus: PushStatus; onRequestPush: () => Promise<PushStatus>; onBack: () => void; onToast: (text: string) => void }) {
  const read = useCallback(async () => {
    const [prefs, consents] = await Promise.all([api.loadNotify(), api.loadConsents()]);
    if (!prefs.ok) return prefs;
    if (!consents.ok) return consents;
    return { ok: true as const, data: { prefs: prefs.data, marketing: (consents.data as OptionalConsents).CK9 } };
  }, [api]);
  const { phase, data, setData, reload, alive } = useLoad<Data>(read);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(new Set<string>());

  const failText = (reason: string) => (reason === 'network' ? COMMON.offline : reason === 'session' ? COMMON.sessionLost : NOTIFY.saveFailed);

  const toggleService = async (key: NotifyKey) => {
    if (!data || pending.current.has(key)) return;
    pending.current.add(key);
    const next = !data.prefs[key];
    setError(null);
    setData((d) => (d ? { ...d, prefs: { ...d.prefs, [key]: next } } : d));
    const result = await api.saveNotify(key, next);
    pending.current.delete(key);
    if (!alive.current) return;
    if (!result.ok) {
      setData((d) => (d ? { ...d, prefs: { ...d.prefs, [key]: !next } } : d));
      setError(failText(result.reason));
      return;
    }
    if (next && pushStatus === 'undetermined') await onRequestPush(); // 켤 때만, 안내 글(pushPrime)을 먼저 보인 상태에서
  };

  const toggleMarketing = async () => {
    if (!data || pending.current.has('CK9')) return;
    pending.current.add('CK9');
    const next = !data.marketing;
    setError(null);
    setData((d) => (d ? { ...d, marketing: next } : d));
    const result = await api.setOptional('CK9', next);
    pending.current.delete('CK9');
    if (!alive.current) return;
    if (result.ok) {
      onToast(NOTIFY.saved);
      return;
    }
    setData((d) => (d ? { ...d, marketing: !next } : d));
    setError(failText(result.reason));
  };

  const anyServiceOn = data ? SERVICE.some((s) => data.prefs[s.key]) : false;
  return (
    <SubPage title={NOTIFY.headerTitle} onBack={onBack} testID="settings-notifications">
      {phase !== 'ready' || !data ? (
        <LoadState state={phase === 'ready' ? 'server' : phase} onRetry={reload} testID="settings-notifications" />
      ) : (
        <>
          {pushStatus === 'undetermined' ? (
            <AppText variant="caption" testID="settings-push-prime">
              {NOTIFY.pushPrime}
            </AppText>
          ) : null}
          {pushStatus === 'denied' && anyServiceOn ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID="settings-push-denied">
              {NOTIFY.pushDenied}
            </AppText>
          ) : null}
          <RowGroup testID="settings-notify-service">
            {SERVICE.map((s, i) => (
              <SwitchRow key={s.key} label={s.label} note={s.note} on={data.prefs[s.key]} last={i === SERVICE.length - 1} onPress={() => void toggleService(s.key)} testID={`settings-notify-${s.key}`} />
            ))}
          </RowGroup>
          <RowGroup testID="settings-notify-marketing-group">
            <SwitchRow label={NOTIFY.marketing} on={data.marketing} last onPress={() => void toggleMarketing()} testID="settings-notify-marketing" />
            <View style={styles.notes}>
              {NOTIFY.marketingNotes.map((line, i) => (
                <AppText key={line} variant="caption" testID={`settings-marketing-note-${i}`}>
                  {line}
                </AppText>
              ))}
            </View>
          </RowGroup>
          {error ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID="settings-notifications-error">
              {error}
            </AppText>
          ) : null}
        </>
      )}
    </SubPage>
  );
}

const styles = StyleSheet.create({
  notes: { paddingHorizontal: space.s16, paddingBottom: space.s16, gap: space.s4 },
});
