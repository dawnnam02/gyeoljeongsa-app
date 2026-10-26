// 03 밖 선택 동의(CK11 ~ CK16, 동의문구 4-11 ~ 4-16)의 '보기 ›' · '전문 보기 ›' 글자 버튼 + 요약 시트(L17A).
//  · 설문 정치 막대(CK15, '보기 ›' → 요약 → 전문 보기) · 대화형 설문 CK16 카드('전문 보기 ›' → 전문까지 펼친 시트)에서 쓴다
//  · 글은 모두 법무 문서에서 뽑은 CONSENT_LATER_ITEMS(gen:legal) 그대로
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Pressable } from '@/components/Pressable';
import { CONSENT_LATER_ITEMS } from '@/content/consentContent';
import type { LaterConsentCode } from '@/content/types';
import { size } from '@/theme/tokens';

import { ConsentSummarySheet } from './ConsentSummarySheet';

type Props = { code: LaterConsentCode; label: string; full?: boolean; testID?: string };

export function LaterConsentLink({ code, label, full = false, testID }: Props) {
  const [open, setOpen] = useState(false);
  const item = CONSENT_LATER_ITEMS.find((i) => i.code === code) ?? null;
  if (!item) return null;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.title ?? item.label} ${label.replace(/\s*›$/, '')}`} onPress={() => setOpen(true)} effect="none" testID={testID} style={styles.link}>
        <AppText variant="captionMedium" tone="accent">
          {label}
        </AppText>
      </Pressable>
      <ConsentSummarySheet item={open ? item : null} initialFull={full} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: size.touchMin, minWidth: size.touchMin, justifyContent: 'center', alignSelf: 'flex-start' },
});
