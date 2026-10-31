// 별자리 · 사주 풀이 AI판(AIT-F ⑥ · 카피 23-9 `STAR_AI`) — 기내지 ① 쪽 안 버튼. 내 별자리 코드 + 일간 오행 코드만 보낸다(생년월일 · 세 기둥 · 금성 · 수성 0 — ATF-28).
//  · 별자리가 바뀌는 무렵(경계) 태어난 분은 AI를 부르지 않고 `STAR_AI.cusp` 글(미리 쓴 글은 위에 그대로)
//  · 코드 없음 → 서버 요청 0 · 미리 쓴 글 + 코드 넣기 안내. 예언 · 판정 0 — 서버 검사를 거친 글만. 끝줄 `STAR_AI.footer`
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { space } from '@/theme/tokens';

import { AitAiLabel, AitConsentSheet, AitDemoNote, AitError, AitHead, AitLoading, AitPaper } from './AitParts';
import { ait } from './aitText';
import { parseHoroscopeDisplay } from './aitTypes';
import { useAitRun } from './useAitRun';

const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
const SIGNS = ['aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn'];

/** 기내지 ① 쪽의 값에서 보낼 코드를 뽑는다. 별자리가 하나가 아니면(경계 날) cusp, 코드가 맞지 않으면 null */
export function horoscopeBody(signs: readonly string[], stem: number): { sun_sign: string; day_element: string } | 'cusp' | null {
  if (signs.length > 1) return 'cusp';
  const sign = signs[0];
  const element = ELEMENTS[Math.floor(stem / 2)];
  if (!sign || !SIGNS.includes(sign) || !element) return null;
  return { sun_sign: sign, day_element: element };
}

export function StarAiBlock({ signs, stem, onSettings, testID = 'star-ai' }: { signs: readonly string[]; stem: number; onSettings: () => void; testID?: string }) {
  const { phase, locked, run, confirmConsent, cancelConsent } = useAitRun('horoscope', parseHoroscopeDisplay);
  const body = horoscopeBody(signs, stem);
  const start = useCallback(() => {
    if (body && body !== 'cusp') void run(body);
  }, [run, body]);
  if (body === null) return null;
  if (body === 'cusp') {
    return (
      <AppText variant="caption" testID={`${testID}-cusp`}>
        {ait('STAR_AI.cusp')}
      </AppText>
    );
  }
  return (
    <View style={styles.gap} testID={testID}>
      {phase.k !== 'idle' ? <AitHead testID={`${testID}-head`} /> : null}
      {phase.k === 'idle' || phase.k === 'consent' ? <Button label={ait('STAR_AI.button')} variant="secondary" onPress={start} testID={`${testID}-go`} /> : null}
      {phase.k === 'nocode' ? <AitDemoNote onSettings={onSettings} testID={`${testID}-demo`} /> : null}
      {phase.k === 'loading' ? <AitLoading testID={`${testID}-loading`} /> : null}
      {phase.k === 'error' || phase.k === 'card' ? (
        <AitError code={phase.k === 'error' ? phase.code : 'unavailable'} fallback locked={locked} onRetry={start} onSettings={onSettings} testID={`${testID}-error`} />
      ) : null}
      {phase.k === 'ok' ? (
        <View style={styles.gap} testID={`${testID}-result`}>
          <AppText variant="bodyBold" accessibilityRole="header">
            {ait('STAR_AI.title')}
          </AppText>
          <AppText variant="caption">{ait('STAR_AI.lead')}</AppText>
          <AitPaper testID={`${testID}-star`}>
            <View accessible accessibilityLabel={ait('STAR_AI.a11y', { '편 이름': ait('STAR_AI.star.title'), 본문: phase.data.star })} style={styles.gap}>
              <AitAiLabel testID={`${testID}-star-label`} />
              <AppText variant="bodyBold">{ait('STAR_AI.star.title')}</AppText>
              <AppText variant="body" testID={`${testID}-star-text`}>
                {phase.data.star}
              </AppText>
            </View>
          </AitPaper>
          <AitPaper testID={`${testID}-saju`}>
            <View accessible accessibilityLabel={ait('STAR_AI.a11y', { '편 이름': ait('STAR_AI.saju.title'), 본문: phase.data.saju })} style={styles.gap}>
              <AitAiLabel testID={`${testID}-saju-label`} />
              <AppText variant="bodyBold">{ait('STAR_AI.saju.title')}</AppText>
              <AppText variant="body" testID={`${testID}-saju-text`}>
                {phase.data.saju}
              </AppText>
            </View>
          </AitPaper>
          <AppText variant="caption" testID={`${testID}-footer`}>
            {ait('STAR_AI.footer')}
          </AppText>
        </View>
      ) : null}
      <AitConsentSheet visible={phase.k === 'consent'} confirmLabel={ait('STAR_AI.button')} onConfirm={() => void confirmConsent()} onClose={cancelConsent} testID={`${testID}-consent`} />
    </View>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.s8 } });
