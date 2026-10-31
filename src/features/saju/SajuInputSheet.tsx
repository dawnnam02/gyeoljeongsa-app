// IF-SJ-IN 입력 시트(IF5-F1 ① · 디자인 IN-1 ~ 3 · 정책 PS-11 ~ PS-16 · 카피 24-4).
//  · 생년월일: 저장된 값을 그대로 보여 줌(읽기만 — 고치려면 프로필) · 태어난 시각: '모름'이 처음값(미리 체크 0 · 정오로 채우기 0) · 태어난 곳: 대표 지점 23곳 목록(자유 글 0 · 위치 권한 0) + 모름 + 한국 밖
//  · 성별은 프로필 값(읽기 전용 — 값은 서버가 읽어 대운에만 쓴다) · 항목별 저장 동의 칸 둘(시각 · 곳) 미리 체크 0 · 비워도 [저장하고 보기]가 눌린다
//  · 시각 · 곳은 이 휴대폰에만(deviceInput) — 서버에는 계산 요청 인자로만 간다. 입력 값은 로그 · 접근성 라벨에 싣지 않는다
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckBox } from '@/components/CheckBox';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { TextButton } from '@/components/TextButton';
import { IF5_TEXT } from '@/content/if5Copy';
import { alpha, space } from '@/theme/tokens';

import { type DeviceInput, type InputStore, type TimeValue } from './deviceInput';
import { PLACE_IDS, placeKey } from './sajuLogic';
import { clockText, sajuStyles, TimePicker } from './SajuParts';

type Props = { visible: boolean; store: InputStore; current: DeviceInput; birthDate: string | null; onClose: () => void; onSaved: () => void; testID?: string };

const birthText = (iso: string | null): string => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${Number(iso.slice(0, 4))}년 ${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일` : '');

export function SajuInputSheet(props: Props) {
  const testID = props.testID ?? 'saju-in';
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <Body {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}

function Body({ store, current, birthDate, onClose, onSaved, testID = 'saju-in' }: Props) {
  const router = useRouter();
  const [time, setTime] = useState<TimeValue | null>(current.time); // 처음값은 '모름'(null) — 미리 체크 0
  const [timeOpen, setTimeOpen] = useState(false);
  const [place, setPlace] = useState<string | null>(current.place);
  const [abroad, setAbroad] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [saveTime, setSaveTime] = useState(current.saveTime);
  const [savePlace, setSavePlace] = useState(current.savePlace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const save = async () => {
    if (busy) return; // 연타 방지
    setBusy(true);
    setError(false);
    try {
      await store.save({ time, place: abroad ? null : place, saveTime: saveTime && !!time, savePlace: savePlace && !!place && !abroad });
      onSaved();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const zi = time !== null && (time.hour >= 23 || time.hour === 0);
  return (
    <ScrollView contentContainerStyle={sajuStyles.gap} testID={`${testID}-scroll`}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {IF5_TEXT['SAJU.input.title']}
      </AppText>
      <AppText variant="body">{IF5_TEXT['SAJU.input.lead']}</AppText>

      <View style={sajuStyles.gapSmall}>
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.input.birth']}</AppText>
        <AppText variant="body" testID={`${testID}-birth`}>
          {birthText(birthDate)}
        </AppText>
        <TextButton label={IF5_TEXT['SAJU.input.toProfile']} align="start" onPress={() => router.push('/profile' as Href)} testID={`${testID}-profile`} />
      </View>

      <View style={sajuStyles.gapSmall}>
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.input.time']}</AppText>
        <View style={sajuStyles.wrap}>
          <Chip label={IF5_TEXT['SAJU.input.unknown']} variant={time === null ? 'selected' : 'inactive'} onPress={() => (setTime(null), setTimeOpen(false))} testID={`${testID}-time-unknown`} />
          <Chip label={time ? clockText(time.hour, time.minute) : IF5_TEXT['SAJU.input.timePick']} variant={time ? 'selected' : 'inactive'} onPress={() => setTimeOpen(!timeOpen)} testID={`${testID}-time-pick`} />
        </View>
        {timeOpen ? <TimePicker hour={time?.hour ?? null} minute={time?.minute ?? null} onPick={(h, m) => setTime({ hour: h, minute: m })} id={`${testID}-timegrid`} /> : null}
        {time === null ? (
          <AppText variant="caption" testID={`${testID}-hour-unknown`}>
            {IF5_TEXT['SAJU.hour.unknown']}
          </AppText>
        ) : null}
        {zi ? (
          <AppText variant="caption" testID={`${testID}-zi`}>
            {IF5_TEXT['SAJU.input.zi']}
          </AppText>
        ) : null}
      </View>

      <View style={sajuStyles.gapSmall}>
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.input.place']}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={IF5_TEXT['SAJU.input.place.title']} onPress={() => setPlaceOpen(!placeOpen)} effect="none" style={({ pressed }) => [styles.pick, pressed && styles.pressed]} testID={`${testID}-place-pick`}>
          <AppText variant="body">{abroad ? IF5_TEXT['SAJU.input.place.abroad'] : place ?? IF5_TEXT['SAJU.input.placeNone']}</AppText>
        </Pressable>
        {placeOpen ? (
          <View style={sajuStyles.gapSmall} testID={`${testID}-places`}>
            <AppText variant="caption">{IF5_TEXT['SAJU.input.place.lead']}</AppText>
            <View style={sajuStyles.wrap}>
              {PLACE_IDS.map((id, i) => (
                <Chip key={id} label={IF5_TEXT[placeKey(i)]} variant={!abroad && place === id ? 'selected' : 'inactive'} onPress={() => (setPlace(id), setAbroad(false), setPlaceOpen(false))} testID={`${testID}-place-${i}`} />
              ))}
              <Chip label={IF5_TEXT['SAJU.input.place.unknown']} variant={!abroad && place === null ? 'selected' : 'inactive'} onPress={() => (setPlace(null), setAbroad(false), setPlaceOpen(false))} testID={`${testID}-place-unknown`} />
              <Chip label={IF5_TEXT['SAJU.input.place.abroad']} variant={abroad ? 'selected' : 'inactive'} onPress={() => (setAbroad(true), setPlace(null), setPlaceOpen(false))} testID={`${testID}-place-abroad`} />
            </View>
          </View>
        ) : null}
        <AppText variant="caption">{IF5_TEXT['SAJU.input.placeNote']}</AppText>
        {abroad ? (
          <AppText variant="caption" tone="text" testID={`${testID}-abroad`}>
            {IF5_TEXT['SAJU.range.abroad']}
          </AppText>
        ) : null}
      </View>

      <View style={sajuStyles.gapSmall}>
        <AppText variant="bodyMedium">{IF5_TEXT['SAJU.input.gender']}</AppText>
        <AppText variant="caption" testID={`${testID}-gender-note`}>
          {IF5_TEXT['SAJU.input.genderNote']}
        </AppText>
      </View>

      <Check on={saveTime} label={IF5_TEXT['SAJU.input.consent.time']} onPress={() => setSaveTime(!saveTime)} testID={`${testID}-save-time`} />
      <Check on={savePlace} label={IF5_TEXT['SAJU.input.consent.place']} onPress={() => setSavePlace(!savePlace)} testID={`${testID}-save-place`} />
      <AppText variant="caption">{IF5_TEXT['SAJU.input.consentNote']}</AppText>

      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-error`}>
          {IF5_TEXT['SAJU.status.errBody']}
        </AppText>
      ) : null}
      <Button label={IF5_TEXT['SAJU.input.save']} loading={busy} onPress={() => void save()} testID={`${testID}-save`} />
      <Button label={IF5_TEXT['SAJU.input.later']} variant="secondary" onPress={onClose} testID={`${testID}-later`} />
    </ScrollView>
  );
}

function Check({ on, label, onPress, testID }: { on: boolean; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={label} onPress={onPress} effect="none" style={({ pressed }) => [styles.check, pressed && styles.pressed]} testID={testID}>
      <CheckBox checked={on} />
      <AppText variant="body" style={sajuStyles.flex}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pick: { minHeight: 48, justifyContent: 'center' },
  check: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.s12 },
  pressed: { opacity: alpha.pressed },
});
