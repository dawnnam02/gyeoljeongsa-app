// 사주 '오늘 하루' 아침 알림 줄(QF2 Q2-04 · 디자인 3-4 · 카피 24-17-1 SAJU.morning.*) — 오늘 하루 화면 맨 아래 카드 한 장.
//  · 기본 꺼짐 · 직접 켠 분만 · 하루 한 번 · 오전 8 ~ 11시 가운데 고른 시각 · 기기 안 예약(서버 푸시 아님 — lib/morningNotice). 웹 · 알림이 없는 기기 · 스위치 saju_morning 꺼짐이면 줄 없음
//  · 켜는 순간에만 안내 시트(이유 · 담기지 않는 것 · 거부해도 쓸 수 있음) → [알림 받기] → 시스템 권한 창. 거부하면 켜지 않고 안내 한 줄 + [설정 열기]
//  · 연속 일수 · 놓친 날 · 도장 · 숫자 배지 · 새 점 · 뽑기 0. 알림 글은 모든 회원에게 같은 고정 한 줄(사주 값 · 이름 0)
//  · 이 폴더는 알림 모듈을 직접 부르지 않는다 — 켜기 · 끄기는 lib/morningNotice 의 함수만 부른다(IFF5-21 · 30 정적 점검: 예외는 이 호출 하나)
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { Toast } from '@/components/Toast';
import { Toggle } from '@/components/Toggle';
import { IF5_TEXT, t5 } from '@/content/if5Copy';
import { NOTIFY_PRIME } from '@/content/qf2Copy';
import { MORNING_FLAG, MORNING_HOURS, morning, useMorning, type MorningHour, type MorningStore } from '@/lib/morningNotice';
import { TOAST_MS } from '@/motion';
import { colors, radius, size, space } from '@/theme/tokens';

export function MorningRow({ isOn, store, toastMs = TOAST_MS, testID = 'saju-morning' }: { isOn: (key: string) => boolean; store?: MorningStore; toastMs?: number; testID?: string }) {
  const s = store ?? morning();
  const rec = useMorning(s);
  const [hour, setHour] = useState<MorningHour | null>(null); // 켜기 전에 고른 시각(켜 두었으면 기록의 시각)
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'none' | 'denied' | 'failed'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(t);
  }, [toast, toastMs]);

  if (!isOn(MORNING_FLAG) || !s.supported()) return null; // 꺼짐 · 웹: 줄 없음
  const shown: MorningHour = rec.on ? rec.hour : (hour ?? rec.hour);

  const turnOn = async () => {
    if (busy) return;
    setSheet(false);
    setBusy(true);
    setNotice('none');
    const r = await s.enable(shown);
    if (!alive.current) return;
    setBusy(false);
    if (r === 'on') setToast(IF5_TEXT['SAJU.morning.onToast']);
    else if (r === 'denied') setNotice('denied');
    else setNotice('failed');
  };
  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setNotice('none');
    await s.disable();
    if (!alive.current) return;
    setBusy(false);
    setToast(IF5_TEXT['SAJU.morning.offToast']);
  };
  const pickHour = async (h: MorningHour) => {
    setHour(h);
    if (!rec.on || busy) return;
    setBusy(true);
    const r = await s.setHour(h);
    if (!alive.current) return;
    setBusy(false);
    if (r !== 'on') setNotice('failed');
  };

  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={IF5_TEXT['SAJU.morning.name']}
        accessibilityState={{ checked: rec.on, disabled: busy }}
        aria-checked={rec.on}
        disabled={busy}
        onPress={() => (rec.on ? void turnOff() : setSheet(true))}
        effect="none"
        style={styles.row}
        testID={`${testID}-toggle`}>
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{IF5_TEXT['SAJU.morning.name']}</AppText>
          <AppText variant="caption">{IF5_TEXT['SAJU.morning.sub']}</AppText>
        </View>
        <Toggle on={rec.on} />
      </Pressable>
      <View style={styles.times} accessibilityRole="radiogroup" accessibilityLabel={IF5_TEXT['SAJU.morning.timeLabel']}>
        <AppText variant="caption">{IF5_TEXT['SAJU.morning.timeLabel']}</AppText>
        <View style={styles.chips}>
          {MORNING_HOURS.map((h) => (
            <Chip key={h} label={t5('SAJU.morning.timeChip', { n: h })} variant="tab" selected={shown === h} onPress={() => void pickHour(h)} testID={`${testID}-hour-${h}`} />
          ))}
        </View>
      </View>
      {notice === 'denied' ? (
        <View style={styles.gap} testID={`${testID}-denied`}>
          <AppText variant="captionMedium" tone="accent" accessibilityRole="alert">
            {IF5_TEXT['SAJU.morning.denied']}
          </AppText>
          <TextButton label={NOTIFY_PRIME.openSettings} align="start" onPress={() => void Linking.openSettings().catch(() => undefined)} testID={`${testID}-open-settings`} />
        </View>
      ) : null}
      {notice === 'failed' ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-failed`}>
          {IF5_TEXT['SAJU.morning.failed']}
        </AppText>
      ) : null}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} testID={`${testID}-prime`}>
        <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-prime-title`}>
          {IF5_TEXT['SAJU.morning.prime.title']}
        </AppText>
        <AppText variant="body" testID={`${testID}-prime-body`}>
          {IF5_TEXT['SAJU.morning.prime.body']}
        </AppText>
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Button label={NOTIFY_PRIME.allow} variant="secondary" onPress={() => void turnOn()} testID={`${testID}-prime-allow`} />
          </View>
          <View style={styles.flex}>
            <Button label={NOTIFY_PRIME.later} variant="secondary" onPress={() => setSheet(false)} testID={`${testID}-prime-later`} />
          </View>
        </View>
      </BottomSheet>
      <Toast text={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, padding: space.s16, gap: space.s12 },
  row: { minHeight: size.touchMin, flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  flex: { flex: 1, gap: space.s4 },
  times: { gap: space.s8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
  gap: { gap: space.s8 },
  pair: { flexDirection: 'row', gap: space.s12 },
});
