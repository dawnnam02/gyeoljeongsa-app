// 이용약관 · 개인정보 처리방침 읽기 화면(02 가입 안내의 '개인정보 처리방침' 링크 · 03 링크 줄 '이용약관 · 개인정보 처리방침 보기').
// 화면 15개에 들지 않는 시트다(라우트를 늘리지 않는다). 글은 법무/약관.md · 법무/개인정보처리방침.md 의 전체(src/content/legal*.ts, 자동 생성).
// 탭 칩은 공통 Chip 의 selected(bg 면 + accent 1px 선 + accent 글자) · inactive(bg 면 + line 1px + sub 글자)다(D8 M1).
// 12 설정의 '이용약관' · '개인정보 처리방침' 하위 화면(F7)도 같은 글을 쓸 수 있다.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { FullSheet } from '@/components/FullSheet';
import { LegalBlockList } from '@/components/LegalBlocks';
import { CONSENT } from '@/content/copy';
import { LEGAL_PRIVACY } from '@/content/legalPrivacy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import { space } from '@/theme/tokens';

export type LegalDocKey = 'terms' | 'privacy';
const DOCS = ['terms', 'privacy'] as const;

type Props = {
  visible: boolean;
  initial: LegalDocKey; // 처음 보이는 문서
  onClose: () => void;
};

export function LegalReader({ visible, initial, onClose }: Props) {
  // 사용자가 탭으로 고른 문서. 시트를 닫으면 지우므로 다음에 열 때는 처음 보일 문서(initial)로 시작한다
  const [chosen, setChosen] = useState<LegalDocKey | null>(null);
  const doc = chosen ?? initial;
  const close = () => {
    setChosen(null);
    onClose();
  };

  const tabs = (
    <View style={styles.tabs}>
      {DOCS.map((key) => (
        <Chip key={key} label={CONSENT.documents[key]} variant={key === doc ? 'selected' : 'inactive'} onPress={() => setChosen(key)} testID={`legal-tab-${key}`} />
      ))}
    </View>
  );

  return (
    <FullSheet visible={visible} title={CONSENT.documents[doc]} onClose={close} testID="legal-reader">
      <LegalBlockList blocks={doc === 'terms' ? LEGAL_TERMS : LEGAL_PRIVACY} header={tabs} testID="legal-reader-list" />
    </FullSheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.s8 },
});
