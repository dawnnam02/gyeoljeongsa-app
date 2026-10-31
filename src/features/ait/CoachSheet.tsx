// 문장 다듬기 = 프로필 문장 코치(AIT-F ⑥ · 카피 23-8 `COACH`) — 내 공개 문구 하나를 붙여 넣으면 모호한 곳을 최대 셋 짚는다. 대신 써 주지 않는다.
//  · 짚기 → 되묻기 → 고친 안 한두 개. 고친 안은 [입력칸에 넣기]로 이 화면 입력칸에 넣고 내가 고친다(자동 적용 0 · 복사 · 공유 단추 0 · 저장 0)
//  · 보내는 것: 칸 이름(intro · headline · photo_caption) + 문구(6 ~ 800자)뿐. 사진 · 성향 · 인터뷰 답 · 상대 정보 0(ATF-28)
//  · 코드 없음 → 서버 요청 0. 이 기능은 미리 쓴 글이 없어 `AIT_SET.rowLine`('코드를 넣으면 AI가 새로 쓴 글로 보여 줘요') + 코드 넣기
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { FullSheet } from '@/components/FullSheet';
import { TextField } from '@/components/TextField';
import { space } from '@/theme/tokens';

import { AitAiLabel, AitCardView, AitConsentSheet, AitError, AitHead, AitLoading, AitNoCode, AitPaper, AitPrivacyLines, cardKind } from './AitParts';
import { ait, type AitKey } from './aitText';
import { parseCoachDisplay, type AitCoachFinding } from './aitTypes';
import { useAitRun } from './useAitRun';

export const COACH_MIN = 6;
export const COACH_MAX = 800;
const FIELDS: readonly { id: 'intro' | 'headline' | 'photo_caption'; label: AitKey }[] = [
  { id: 'intro', label: 'COACH.field.intro' },
  { id: 'headline', label: 'COACH.field.headline' },
  { id: 'photo_caption', label: 'COACH.field.photo' },
];

/** 고친 안을 입력칸 글에 넣는다: 짚은 조각이 그대로 있으면 그 자리를 바꾸고, 없으면 새 줄로 붙인다(자동 적용 0 — 누를 때만) */
export function applyOption(text: string, quote: string, option: string): string {
  return quote && text.includes(quote) ? text.replace(quote, option) : text ? `${text}\n${option}` : option;
}

export function CoachSheet({ visible, onClose, onSettings, testID = 'coach' }: { visible: boolean; onClose: () => void; onSettings: () => void; testID?: string }) {
  return (
    <FullSheet visible={visible} title={ait('COACH.name')} onClose={onClose} testID={testID}>
      {visible ? <CoachBody onSettings={onSettings} testID={testID} /> : null}
    </FullSheet>
  );
}

function CoachBody({ onSettings, testID }: { onSettings: () => void; testID: string }) {
  const [field, setField] = useState<'intro' | 'headline' | 'photo_caption'>('intro');
  const [text, setText] = useState('');
  const [short, setShort] = useState(false);
  const [put, setPut] = useState(false);
  const { phase, locked, run, confirmConsent, cancelConsent, reset } = useAitRun('coach', parseCoachDisplay);
  const send = () => {
    const n = Array.from(text.trim()).length;
    if (n < COACH_MIN) {
      setShort(true);
      return;
    }
    setShort(false);
    setPut(false);
    void run({ field, text: text.trim() });
  };
  const busy = phase.k === 'loading';
  const cardNode = (() => {
    if (phase.k !== 'card') return null;
    const kind = cardKind(phase.card);
    return kind ? (
      <AitCardView kind={kind} options={phase.card.options.filter((o) => o === 'end')} onEnd={reset} testID={`${testID}-card`} />
    ) : (
      <AitError code="unavailable" onSettings={onSettings} testID={`${testID}-error`} />
    );
  })();
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" testID={`${testID}-scroll`}>
      <AitHead testID={`${testID}-head`} />
      <AppText variant="body" testID={`${testID}-lead`}>
        {ait('COACH.lead')}
      </AppText>
      <AppText variant="caption" testID={`${testID}-fact`}>
        {ait('COACH.factNote')}
      </AppText>
      <AitPrivacyLines testID={`${testID}-privacy`} />
      <AppText variant="bodyMedium">{ait('COACH.field.label')}</AppText>
      <View style={styles.row}>
        {FIELDS.map((f) => (
          <Chip key={f.id} label={ait(f.label)} variant="tab" selected={field === f.id} onPress={() => setField(f.id)} testID={`${testID}-field-${f.id}`} />
        ))}
      </View>
      {field === 'photo_caption' ? (
        <AppText variant="caption" testID={`${testID}-photo-note`}>
          {ait('COACH.photoNote')}
        </AppText>
      ) : null}
      <AppText variant="captionMedium">{ait('COACH.text.label')}</AppText>
      <TextField
        label={ait('COACH.text.label')}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setShort(false);
        }}
        placeholder={ait('COACH.text.placeholder')}
        multiline
        maxLength={COACH_MAX}
        autoCorrect={false}
        error={short ? ait('COACH.tooShort') : null}
        testID={`${testID}-text`}
      />
      <Button label={ait('COACH.send')} loading={busy} onPress={send} testID={`${testID}-send`} />
      {phase.k === 'nocode' ? <AitNoCode feature="coach" onSettings={onSettings} testID={`${testID}-nocode`} /> : null}
      {phase.k === 'loading' ? <AitLoading testID={`${testID}-loading`} /> : null}
      {phase.k === 'error' ? <AitError code={phase.code} locked={locked} onRetry={send} onSettings={onSettings} testID={`${testID}-error`} /> : null}
      {cardNode}
      {phase.k === 'ok' ? (
        <View style={styles.gap} testID={`${testID}-result`}>
          <AitAiLabel testID={`${testID}-label`} />
          {phase.data.keep ? (
            <AitPaper testID={`${testID}-keep`}>
              <AppText variant="bodyBold">{ait('COACH.keep')}</AppText>
              <AppText variant="body">{phase.data.keep}</AppText>
            </AitPaper>
          ) : null}
          {phase.data.findings.length === 0 ? (
            <AppText variant="body" testID={`${testID}-none`}>
              {ait('COACH.none')}
            </AppText>
          ) : (
            phase.data.findings.map((f, i) => (
              <Finding
                key={`${f.quote}-${i}`}
                f={f}
                testID={`${testID}-f${i}`}
                onPut={(option) => {
                  setText((t) => applyOption(t, f.quote, option).slice(0, COACH_MAX));
                  setPut(true);
                }}
              />
            ))
          )}
          {put ? (
            <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" testID={`${testID}-put-done`}>
              {ait('COACH.putDone')}
            </AppText>
          ) : null}
          <AppText variant="caption" testID={`${testID}-note`}>
            {ait('COACH.note')}
          </AppText>
        </View>
      ) : null}
      <AitConsentSheet visible={phase.k === 'consent'} onConfirm={() => void confirmConsent()} onClose={cancelConsent} testID={`${testID}-consent`} />
    </ScrollView>
  );
}

function Finding({ f, onPut, testID }: { f: AitCoachFinding; onPut: (option: string) => void; testID: string }) {
  return (
    <AitPaper testID={testID}>
      <View accessible accessibilityLabel={ait('COACH.a11y.finding', { '문구 조각': f.quote, '짚은 말': f.point, 질문: f.ask })} style={styles.gap}>
        <AppText variant="captionMedium">{ait('COACH.find.quote')}</AppText>
        <AppText variant="body">{f.quote}</AppText>
        <AppText variant="captionMedium">{ait('COACH.find.point')}</AppText>
        <AppText variant="body">{f.point}</AppText>
        <AppText variant="captionMedium">{ait('COACH.find.ask')}</AppText>
        <AppText variant="body">{f.ask}</AppText>
      </View>
      {f.options.length > 0 ? <AppText variant="captionMedium">{ait('COACH.find.options')}</AppText> : null}
      {f.options.map((o, j) => (
        <View key={o} style={styles.gap}>
          <AppText variant="body" testID={`${testID}-o${j}`}>
            {o}
          </AppText>
          {o.includes('○○') ? <AppText variant="caption">{ait('COACH.blank')}</AppText> : null}
          <Button label={ait('COACH.put')} variant="secondary" onPress={() => onPut(o)} testID={`${testID}-o${j}-put`} />
        </View>
      ))}
    </AitPaper>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.s20, gap: space.s12, paddingBottom: space.s40 },
  gap: { gap: space.s8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 },
});
