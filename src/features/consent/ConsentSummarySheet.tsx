// '보기 ›' 를 누르면 열리는 요약 시트(동의문구 3-2 규칙 3 · 4, 4장).
//  맨 위에 '왜 필요한지' 한 줄(U21: 자리는 가안) → 요약(해요체) → '동의하지 않으면' 줄 → [전문 보기]
//  [전문 보기]를 누르면 같은 화면 아래에 전문(합니다체)이 이어서 열리고 스크롤로 읽는다. 전문을 읽지 않아도 체크는 할 수 있다.
//  CK1 의 전문은 이용약관 전체, 나머지는 동의문구.md 4장의 전문이다(CK16 은 4-16). 글은 모두 법무 문서에서 그대로 온 것이다.
//  initialFull: 이미 요약을 보여 준 자리(대화형 설문 CK16 카드의 '전문 보기 ›')에서 열 때는 전문까지 펼친 채로 연다
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FullSheet } from '@/components/FullSheet';
import { LegalBlockList } from '@/components/LegalBlocks';
import { CONSENT } from '@/content/copy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import type { ConsentSheetContent, LegalBlock } from '@/content/types';
import { colors, space } from '@/theme/tokens';

type Props = {
  item: ConsentSheetContent | null; // null 이면 닫혀 있다
  onClose: () => void;
  initialFull?: boolean;
};

export function ConsentSummarySheet({ item, onClose, initialFull = false }: Props) {
  // 전문이 열린 칸의 코드. 시트를 닫으면 지우므로 다른 칸을 열면(같은 칸을 다시 열어도) 전문은 닫힌 채로 시작한다
  const [fullFor, setFullFor] = useState<string | null>(null);
  const fullOpen = item !== null && (initialFull || fullFor === item.code);
  const close = () => {
    setFullFor(null);
    onClose();
  };

  const blocks = useMemo<readonly LegalBlock[]>(() => {
    if (!item) return [];
    return item.fullText === 'terms' ? LEGAL_TERMS : item.fullText;
  }, [item]);

  if (!item) return <FullSheet visible={false} title="" onClose={close} />;

  const header = (
    <View testID={`consent-summary-${item.code}`}>
      <AppText variant="bodyMedium" testID="consent-why">
        {item.why}
      </AppText>
      <View style={styles.summary}>
        {item.summary.map((text, i) => (
          <View key={i} style={styles.line}>
            <AppText style={styles.marker}>•</AppText>
            <AppText style={styles.text}>{text}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="bodyMedium" testID="consent-declined" style={styles.declined}>
        {`${item.declinedLabel}: ${item.declined}`}
      </AppText>
      {fullOpen ? <View style={styles.rule} /> : <Button variant="secondary" label={CONSENT.fullText} onPress={() => setFullFor(item.code)} testID="consent-full-open" />}
    </View>
  );

  return (
    <FullSheet visible title={item.label} onClose={close} testID="consent-sheet">
      <LegalBlockList blocks={fullOpen ? blocks : []} header={header} testID="consent-sheet-list" />
    </FullSheet>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: space.s12, gap: space.s8 },
  line: { flexDirection: 'row' },
  marker: { width: space.s24 },
  text: { flex: 1 },
  declined: { marginTop: space.s16, marginBottom: space.s16 },
  rule: { height: 1, backgroundColor: colors.line },
});
