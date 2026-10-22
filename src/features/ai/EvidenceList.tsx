// 07 근거 문항 보기(접기 · 펼치기). 5축마다 AI가 근거로 본 설문 문항의 '질문 글'만 보인다(답은 보이지 않는다).
// 기본은 접힘. AI 원본(result.evidence)이 있을 때만 쓴다 — 직접 입력한 결과에는 근거가 없다.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { TextButton } from '@/components/TextButton';
import { AXIS_NAMES, AXIS_ORDER, EVIDENCE_LABELS } from '@/content/traitsContent';
import { TRAITS } from '@/content/copy';
import { space } from '@/theme/tokens';
import type { Evidence } from '@/types/ai';

export function EvidenceList({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <TextButton
        label={open ? TRAITS.evidenceHide : TRAITS.evidenceShow}
        align="start"
        onPress={() => setOpen((v) => !v)}
        testID="evidence-toggle"
      />
      {open ? (
        <Card style={styles.card} testID="evidence-list">
          <AppText variant="caption">{TRAITS.evidenceIntro}</AppText>
          {AXIS_ORDER.map((key) => (
            <View key={key} style={styles.axis}>
              <AppText variant="bodyBold">{AXIS_NAMES[key]}</AppText>
              {evidence[key].map((id) => (
                <AppText key={id} variant="caption" tone="text">
                  {`· ${EVIDENCE_LABELS[id] ?? id}`}
                </AppText>
              ))}
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s8 },
  card: { gap: space.s12 },
  axis: { gap: space.s4 },
});
