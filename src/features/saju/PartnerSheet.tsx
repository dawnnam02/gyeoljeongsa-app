// IF-SJ-PARTNER 상대 생일 시트 — 둘이 맞춰 보기(F5-10 · IF5-F1 ② ③ · 디자인 PT-1 ~ 4 · PR-1 · 정책 PS-21 ~ PS-26 · 카피 24-7).
//  · 입력은 생년월일 칸 하나 + 선택 시각뿐 — 이름 · 성별 · 별명 · 관계 · 연락처 · 사진 · 링크 칸 0 · 자동완성 · 자동수정 끔
//  · CK20 확인(동의문구 4-20 — features/consent/If5ConsentSheets Ck20Block · 확인은 이 기기에 한 번 기록) 전에는 입력칸이 잠긴다(미리 체크 0) · 계산은 기기 안(partnerLocal — 네트워크 0) · 저장 0(기기 · 서버 · 로그) · 시트를 닫으면 값이 사라진다
//  · 만 19세 미만이면 맞춰 보지 않는다(부드러운 한 줄 · 결과 0 · 다른 생일을 권하는 말 0) · 점수 · 판정 · 순위 0 · 앱이 뒤로 가면 입력을 가린다 · 캡처 막기
import { useEffect, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { IF5_TEXT } from '@/content/if5Copy';
import { useAlwaysCaptureBlock } from '@/lib/captureBlock';
import type { Chart } from '@/saju5/saju_calc5';
import { Ck20Block } from '@/features/consent/If5ConsentSheets';
import { if5Consent, useIf5Consent, type If5ConsentStore } from '@/features/consent/if5Consent';

import { AiBlock } from './ai/AiBlock';
import type { AiServices } from './ai/aiService';
import { matchPartner, partnerAiFacts, partnerBranch, type PartnerBranch, type PartnerResult } from './partnerLocal';
import { clockText, sajuStyles, TimePicker } from './SajuParts';

// pick: 날짜 고르기 '상대와 함께 보기'용(IF5-F1c) — 맞춰 보기 카드 대신 상대의 일지 숫자 하나만 부른 화면에 넘기고 닫는다(mine 필요 없음 · AI 칸 0)
type Props = { visible: boolean; mine: Chart | null; today: () => string; onClose: () => void; consent?: If5ConsentStore; ai?: AiServices; pick?: (r: Extract<PartnerBranch, { kind: 'ok' }>) => void; testID?: string };

export function PartnerSheet(props: Props) {
  const testID = props.testID ?? 'saju-partner';
  useAlwaysCaptureBlock(props.visible);
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} testID={testID}>
      {props.visible ? <Body {...props} testID={testID} /> : null}
    </BottomSheet>
  );
}

const LABELS = ['SAJU.partner.result.l1.label', 'SAJU.partner.result.l2.label', 'SAJU.partner.result.l3.label'] as const;

function Body({ mine, today, onClose, consent, ai, pick, testID = 'saju-partner' }: Props) {
  // 상대 값은 모두 이 화면의 메모리뿐 — 시트를 닫으면 Body 가 사라져 값도 사라진다(저장 0). 기기에 남기는 것은 CK20 확인 기록 하나(상대 값 0)
  const store = consent ?? if5Consent();
  const ck20 = useIf5Consent(store).c20 !== null;
  const setCk20 = (on: boolean) => void (on ? store.agreeC20() : store.revoke('c20'));
  const [digits, setDigits] = useState('');
  const [time, setTime] = useState<{ hour: number; minute: number } | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [result, setResult] = useState<PartnerResult | null>(null);
  const [hidden, setHidden] = useState(false); // 앱이 뒤로 가면 입력을 가린다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setHidden(s !== 'active'));
    return () => sub.remove();
  }, []);

  const go = () => {
    if ((!mine && !pick) || !ck20 || digits.length !== 8) return;
    if (pick) {
      const r = partnerBranch({ birthDigits: digits, time }, today());
      if (r.kind === 'ok') {
        pick(r);
        onClose();
      } else setResult(r);
      return;
    }
    setResult(matchPartner(mine as Chart, { birthDigits: digits, time }, today()));
  };
  const again = () => setResult(null);

  if (hidden) return <View style={{ minHeight: 160 }} testID={`${testID}-covered`} />;
  return (
    <ScrollView contentContainerStyle={sajuStyles.gap} testID={`${testID}-scroll`}>
      <AppText variant="bodyBold" accessibilityRole="header" testID={`${testID}-title`}>
        {IF5_TEXT['SAJU.partner.title']}
      </AppText>
      <AppText variant="body">{IF5_TEXT['SAJU.partner.lead']}</AppText>
      <AppText variant="caption" tone="text" testID={`${testID}-notice`}>
        {IF5_TEXT['SAJU.partner.notice']}
      </AppText>

      {result === null ? (
        <>
          <Ck20Block checked={ck20} onToggle={() => setCk20(!ck20)} testID={`${testID}-ck20`} />
          <TextField
            label={IF5_TEXT['SAJU.partner.birth']}
            value={digits}
            onChangeText={(v) => setDigits(v.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
            autoCorrect={false}
            autoCapitalize="none"
            textContentType="none"
            disabled={!ck20}
            testID={`${testID}-birth`}
          />
          <View style={sajuStyles.gapSmall}>
            <AppText variant="bodyMedium">{IF5_TEXT['SAJU.partner.time']}</AppText>
            <View style={sajuStyles.wrap}>
              <Chip label={IF5_TEXT['SAJU.input.unknown']} variant={time === null ? 'selected' : 'inactive'} onPress={() => ck20 && (setTime(null), setTimeOpen(false))} testID={`${testID}-time-unknown`} />
              <Chip label={time ? clockText(time.hour, time.minute) : IF5_TEXT['SAJU.input.timePick']} variant={time ? 'selected' : 'inactive'} onPress={() => ck20 && setTimeOpen(!timeOpen)} testID={`${testID}-time-pick`} />
            </View>
            {timeOpen && ck20 ? <TimePicker hour={time?.hour ?? null} minute={time?.minute ?? null} onPick={(h, m) => setTime({ hour: h, minute: m })} id={`${testID}-timegrid`} /> : null}
          </View>
          <AppText variant="caption" testID={`${testID}-gone`}>
            {IF5_TEXT['SAJU.partner.gone']}
          </AppText>
          <Button label={IF5_TEXT['SAJU.partner.go']} disabled={!ck20 || digits.length !== 8 || (!mine && !pick)} onPress={go} testID={`${testID}-go`} />
        </>
      ) : (
        <ResultBody result={result} onAgain={again} onClose={onClose} testID={testID} aiBlock={ai && mine ? <AiBlock id={`${testID}-compat`} kind="compat" svc={ai} facts={() => partnerAiFacts(mine, { birthDigits: digits, time }, today())} /> : null} />
      )}
    </ScrollView>
  );
}

function ResultBody({ result, onAgain, onClose, testID, aiBlock }: { result: PartnerResult; onAgain: () => void; onClose: () => void; testID: string; aiBlock?: React.ReactNode }) {
  if (result.kind === 'minor') {
    // 만 19세 미만 — 계산 · 결과 0. 이 분의 나이를 되묻거나 다른 생일을 권하는 말 0
    return (
      <View style={sajuStyles.gap} testID={`${testID}-minor`}>
        <AppText variant="body">{IF5_TEXT['SAJU.partner.minor']}</AppText>
        <Button label={IF5_TEXT['SAJU.card.close']} variant="secondary" onPress={onClose} testID={`${testID}-minor-close`} />
      </View>
    );
  }
  if (result.kind === 'outOfRange') {
    return (
      <View style={sajuStyles.gap} testID={`${testID}-range`}>
        <AppText variant="body">{IF5_TEXT['SAJU.range.partner']}</AppText>
        <Button label={IF5_TEXT['SAJU.partner.again']} variant="secondary" onPress={onAgain} testID={`${testID}-again`} />
      </View>
    );
  }
  if (result.kind === 'calcError') {
    return (
      <View style={sajuStyles.gap} testID={`${testID}-error`}>
        <AppText variant="bodyBold" accessibilityRole="alert">
          {IF5_TEXT['SAJU.status.errTitle']}
        </AppText>
        <AppText variant="body">{IF5_TEXT['SAJU.status.errBody']}</AppText>
        <Button label={IF5_TEXT['SAJU.partner.again']} variant="secondary" onPress={onAgain} testID={`${testID}-again`} />
      </View>
    );
  }
  const c = result.card;
  return (
    <View style={sajuStyles.gap} testID={`${testID}-result`}>
      <AppText variant="bodyBold" accessibilityRole="header">
        {IF5_TEXT['SAJU.partner.result.title']}
      </AppText>
      {c.one ? (
        <AppText variant="bodyBold" testID={`${testID}-one`}>
          {c.one}
        </AppText>
      ) : null}
      {c.three.map((l, i) => (
        <AppText key={l} variant="body" testID={`${testID}-line-${i}`}>
          {`${IF5_TEXT[LABELS[i]]} · ${l}`}
        </AppText>
      ))}
      {result.hourUnknown ? (
        <AppText variant="caption" testID={`${testID}-hour-unknown`}>
          {IF5_TEXT['SAJU.partner.hourUnknown']}
        </AppText>
      ) : null}
      {c.more.length > 0 ? (
        <View style={sajuStyles.gapSmall}>
          <AppText variant="bodyMedium">{IF5_TEXT['SAJU.partner.result.d.title']}</AppText>
          {c.more.map((m) => (
            <AppText key={m} variant="body">
              {m}
            </AppText>
          ))}
        </View>
      ) : null}
      {aiBlock}
      <AppText variant="caption" testID={`${testID}-result-gone`}>
        {IF5_TEXT['SAJU.partner.result.gone']}
      </AppText>
      <AppText variant="bodyMedium">{IF5_TEXT['SAJU.card.end']}</AppText>
      <Button label={IF5_TEXT['SAJU.card.close']} variant="secondary" onPress={onClose} testID={`${testID}-close`} />
    </View>
  );
}
