// [2] 만남 뒤 피드백 시트(K12 2-2 · 2-D2 · 2-D3). 아래에서 올라오는 시트(공통 BottomSheet) 두 단계:
//  1단계 '만나 보셨나요?' → 만났어요 / 아직 만나지 않았어요 / 만나지 않기로 했어요 (만났어요면 [다음], 아니면 [보내기])
//  2단계 '어떠셨나요?'   → 좋았어요 / 보통이었어요 / 기대와 달랐어요 — 기대와 달랐으면 달랐던 점 칩(맞는 점 19개 + 2개, 최대 3개)
//        '프로필과 달랐어요' · '불편했어요'를 고르면 신고 안내 + [신고하기](부모가 기존 신고 시트를 연다). 답을 보내도 자동 신고는 없다(2-09)
//  · 고치기: initial(서버가 준 내 답)을 채워 연다. 48시간이 지났거나 이미 한 번 고쳤으면 서버가 edit_window_closed → 잠김 글 · [보내기] 막힘
//  · 숫자 값 · 별 모양 평가 · 상대 평가 칸 없음(2-07 · 2-13). 같은 버튼을 두 번 눌러도 요청은 한 번(R9)
//  · 저장되면 부모가 토스트(V4W01.meet.thanks)를 띄우고 카드를 다시 불러온다. 시트를 닫으면 고른 것은 사라진다
//  · 글은 키 자리(content/v4Wave01Copy.ts, 1단계 임시). 인터넷 문제는 기존 공통 글(COMMON.offline)
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Pressable } from '@/components/Pressable';
import { COMMON } from '@/content/copy';
import { V4W01 } from '@/content/v4Wave01Copy';
import { Radio } from '@/features/safety/Radio';
import { MISMATCH_CODES, type MeetAnswer, type MeetFeedbackApi, type MetValue, type OutcomeValue } from '@/lib/meetFeedbackApi';
import { colors, radius, size, space } from '@/theme/tokens';

import { answerFrom, MET_OPTIONS, mismatchLabel, needsReportHint, OUTCOME_OPTIONS, toggleMismatch } from './meetFeedbackLogic';

type Step = 'met' | 'how';
type Props = {
  visible: boolean;
  matchId: string;
  head: string; // 11 행과 같은 표기('성OO · 나이 · 지역')
  initial?: MeetAnswer | null; // 고치기: 서버가 준 내 답
  api: Pick<MeetFeedbackApi, 'submit'>;
  onClose: () => void;
  onDone: () => void; // 저장됨
  onReport: () => void; // [신고하기] — 신고 접수는 기존 신고 시트에서 사용자가 직접
  onGone?: (reason: 'off' | 'unavailable') => void; // 스위치가 꺼졌거나 끊긴 쌍 → 부모가 카드를 거둔다
  testID?: string;
};

export function MeetFeedbackSheet({ visible, matchId, head, initial = null, api, onClose, onDone, onReport, onGone, testID = 'meet-sheet' }: Props) {
  const [step, setStep] = useState<Step>('met');
  const [met, setMet] = useState<MetValue | null>(initial?.met ?? null);
  const [outcome, setOutcome] = useState<OutcomeValue | null>(initial?.outcome ?? null);
  const [mismatch, setMismatch] = useState<string[]>(initial?.mismatch ?? []);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // 열릴 때마다 처음 상태(고치기면 내 답)로. 렌더 중에 이전 값과 비교해 바꾸는 방식(effect 없이)
  const [shown, setShown] = useState(visible);
  if (visible !== shown) {
    setShown(visible);
    if (visible) {
      setStep('met');
      setMet(initial?.met ?? null);
      setOutcome(initial?.outcome ?? null);
      setMismatch(initial?.mismatch ?? []);
      setError(null);
      setLocked(false);
    }
  }

  const close = () => {
    if (busyRef.current) return;
    onClose();
  };

  const submit = async () => {
    if (busyRef.current || met === null) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.submit(matchId, answerFrom(met, outcome, mismatch));
      if (result.ok) {
        onDone();
        return;
      }
      if (result.reason === 'off' || result.reason === 'unavailable') {
        onGone?.(result.reason);
        return;
      }
      if (result.reason === 'edit_closed') {
        setLocked(true);
        return;
      }
      setError(result.reason === 'network' ? COMMON.offline : V4W01.meet.saveFailed);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const goNext = met === 'met' && step === 'met';
  const ready = step === 'met' ? met !== null : outcome !== null;
  const primary = () => {
    if (goNext) {
      setStep('how');
      return;
    }
    void submit();
  };

  const id = (part: string) => `${testID}-${part}`;
  const options = step === 'met' ? MET_OPTIONS : OUTCOME_OPTIONS;
  const picked: string | null = step === 'met' ? met : outcome;

  return (
    <BottomSheet visible={visible} onClose={close} dismissable={!busy} testID={testID}>
      <View style={styles.head}>
        <AppText variant="bodyBold" accessibilityRole="header" testID={id('title')}>
          {step === 'met' ? V4W01.meet.cardTitle : V4W01.meet.howTitle}
        </AppText>
        <AppText variant="caption" numberOfLines={1} testID={id('head')}>
          {head}
        </AppText>
      </View>

      <View accessibilityRole="radiogroup" style={styles.group} testID={id(`${step}-group`)}>
        {options.map((option, i) => {
          const checked = picked === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              aria-checked={checked}
              disabled={locked}
              onPress={() => {
                setError(null);
                if (step === 'met') setMet(option.value as MetValue);
                else setOutcome(option.value as OutcomeValue);
              }}
              effect="none"
              style={[styles.row, i < options.length - 1 ? styles.rowLine : null]}
              testID={id(`${step}-${option.value}`)}>
              <Radio checked={checked} />
              <AppText variant={checked ? 'bodyMedium' : 'body'} style={styles.flex}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {step === 'how' && outcome === 'off' ? (
        <View style={styles.mismatch} testID={id('mismatch')}>
          <AppText variant="caption" testID={id('mismatch-guide')}>
            {V4W01.meet.mismatchGuide}
          </AppText>
          <View style={styles.chips} testID={id('chips')}>
            {MISMATCH_CODES.map((code) => (
              <Chip
                key={code}
                label={mismatchLabel(code)}
                variant={mismatch.includes(code) ? 'selected' : 'inactive'}
                onPress={locked ? undefined : () => setMismatch((list) => toggleMismatch(list, code))}
                testID={id(`chip-${code}`)}
              />
            ))}
          </View>
          {needsReportHint(mismatch) ? (
            <View style={styles.reportBox} testID={id('report-box')}>
              <AppText variant="caption" tone="text" testID={id('report-note')}>
                {V4W01.meet.reportNote}
              </AppText>
              <Button label={V4W01.meet.reportButton} variant="secondary" onPress={onReport} testID={id('report')} />
            </View>
          ) : null}
        </View>
      ) : null}

      {locked ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('locked')}>
          {V4W01.meet.editLocked}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('error')}>
          {error}
        </AppText>
      ) : null}
      <Button label={goNext ? V4W01.meet.next : V4W01.meet.send} onPress={primary} disabled={!ready || locked} loading={busy} testID={id('primary')} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.s4 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space.s16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s12, minHeight: size.listRow },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1 },
  mismatch: { gap: space.s8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8 },
  reportBox: { gap: space.s8, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.s12 },
});
