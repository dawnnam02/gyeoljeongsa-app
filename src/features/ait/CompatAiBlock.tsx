// 궁합 카드 AI판(AIT-F ⑥ · 카피 23-7 `PAIR_AI`) — 궁합 카드 시트 안 한 칸. 미리 쓴 글(0원판)은 그대로 위에 두고 옆에 따로 둔다.
//  · 두 분이 모두 공개한 같은 값(취미 코드 최대 여섯)만 보낸다 — 시험판은 데모 가상 짝의 값. 비공개 값 · 회원 id · 방 id 0(ATF-27 · 18)
//  · 코드 없음 → 서버 요청 0 · 미리 쓴 글 + '설정의 시험용 AI 코드를 넣으면…'(AIT.demo.note)
//  · 점수 · 퍼센트 · 잘 맞음 말 0 — 서버가 검사를 거친 글만 준다. 결과에는 'AI가 쓴 글이에요'가 붙는다
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import type { HobbyItem } from '@/features/inflight/inflightApi';
import { tx } from '@/features/inflight/if2Text';
import { space } from '@/theme/tokens';

import { AitAiLabel, AitConsentSheet, AitDemoNote, AitError, AitHead, AitLoading, AitPaper } from './AitParts';
import { ait } from './aitText';
import { parseCompatDisplay } from './aitTypes';
import { useAitRun } from './useAitRun';

/** 같은 취미 코드 → 서버 허용 사전의 {k, v}. 갈래({group}) 항목은 사전에 없어 보내지 않는다 */
export function sharedOf(same: readonly HobbyItem[]): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = [];
  for (const h of same) if ('code' in h && !out.some((o) => o.v === h.code)) out.push({ k: 'hobby', v: h.code });
  return out.slice(0, 6);
}

export function CompatAiBlock({ same, onSettings, testID = 'pair-ai' }: { same: readonly HobbyItem[]; onSettings: () => void; testID?: string }) {
  const { phase, locked, run, confirmConsent, cancelConsent } = useAitRun('compat', parseCompatDisplay);
  const shared = sharedOf(same);
  const start = useCallback(() => void run({ shared }), [run, shared]);
  if (shared.length === 0) {
    return (
      <AppText variant="caption" testID={`${testID}-none`}>
        {ait('PAIR_AI.noShared')}
      </AppText>
    );
  }
  return (
    <View style={styles.gap} testID={testID}>
      {phase.k !== 'idle' ? <AitHead testID={`${testID}-head`} /> : null}
      {phase.k === 'idle' || phase.k === 'consent' ? <Button label={ait('PAIR_AI.button')} variant="secondary" onPress={start} testID={`${testID}-go`} /> : null}
      {phase.k === 'nocode' ? <AitDemoNote onSettings={onSettings} testID={`${testID}-demo`} /> : null}
      {phase.k === 'loading' ? <AitLoading testID={`${testID}-loading`} /> : null}
      {phase.k === 'error' || phase.k === 'card' ? (
        <AitError code={phase.k === 'error' ? phase.code : 'unavailable'} fallback locked={locked} onRetry={start} onSettings={onSettings} testID={`${testID}-error`} />
      ) : null}
      {phase.k === 'ok' ? (
        <AitPaper testID={`${testID}-result`}>
          <View accessible accessibilityLabel={ait('PAIR_AI.a11y', { 본문: [phase.data.sameLine, ...phase.data.topics].join(' ') })} style={styles.gap}>
            <AitAiLabel testID={`${testID}-label`} />
            <AppText variant="bodyBold">{tx('PAIR_CARD.same.title')}</AppText>
            <AppText variant="body" testID={`${testID}-same`}>
              {phase.data.sameLine}
            </AppText>
            <AppText variant="bodyBold">{ait('PAIR_AI.topics.title')}</AppText>
            {phase.data.topics.map((t, i) => (
              <AppText key={t} variant="body" testID={`${testID}-topic-${i}`}>
                {t}
              </AppText>
            ))}
          </View>
          <AppText variant="caption" testID={`${testID}-note`}>
            {ait('PAIR_AI.note')}
          </AppText>
          <AppText variant="caption" testID={`${testID}-demo-note`}>
            {ait('PAIR_AI.demo')}
          </AppText>
          <Button label={ait('PAIR_AI.regen')} variant="secondary" disabled={locked} onPress={start} testID={`${testID}-regen`} />
        </AitPaper>
      ) : null}
      <AitConsentSheet visible={phase.k === 'consent'} confirmLabel={ait('PAIR_AI.button')} onConfirm={() => void confirmConsent()} onClose={cancelConsent} testID={`${testID}-consent`} />
    </View>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.s8 } });
