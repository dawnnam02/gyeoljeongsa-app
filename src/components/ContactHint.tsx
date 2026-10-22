// V10 연락처 입력 안내 한 줄(R1 A⑦ · K15 2-1 · D-75 · 카피.md 7장 공통 연락처 안내). 글 칸 바로 아래에 둔다.
//  · 글을 쓰다 0.5초 멈추면 나타나고, 모양이 없어지면 바로 사라진다(10-05). 팝업 · 시트 · 진동 · 빨간색 · 흔들기 없음. 버튼 · [닫기] 없음
//  · 막지 않는다: [보내기] · [저장]을 흐리게 하거나 끄지 않는다(편지를 실제로 막는 일은 서버 contact_blocked, D-75)
//  · 판정은 기기 안(lib/contactShape). 글 · 판정 사실을 서버 · 로그로 보내지 않는다(10-04 · T10-14)
//  · 스크린리더는 '안내, {글}'을 한 번 읽는다(polite, 10-18). 색만으로 알리지 않는다(앞 표시 + 글)
//  · 서버 스위치 contact_hint 가 꺼지면 enabled=false 로 그리지 않는다(10-17). 부모가 hooks/useFeatureFlags 로 읽어 넘긴다
//  · 붙일 칸(2단계, 각 화면 주인): 10 호감 시트 편지 칸(field='letter') · 08 질문 소개(field='public') · 04 직접 쓴 칸(public) · 04 자유 서술(private, AYLA'S 협의 뒤)
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CONTACT_HINT } from '@/content/contactHintCopy';
import { hintFor, type HintField, type HintKind } from '@/lib/contactShape';
import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

export const CONTACT_HINT_DELAY_MS = 500; // 0.5초 멈추면(K15 10-05)

export const hintText = (kind: HintKind): string => CONTACT_HINT[kind];

type Props = { text: string; field: HintField; enabled?: boolean; delayMs?: number; testID?: string };

export function ContactHint({ text, field, enabled = true, delayMs = CONTACT_HINT_DELAY_MS, testID = 'contact-hint' }: Props) {
  const [settled, setSettled] = useState<string | null>(null); // 마지막으로 멈춘 때의 글
  useEffect(() => {
    const id = setTimeout(() => setSettled(text), delayMs);
    return () => clearTimeout(id);
  }, [text, delayMs]);
  if (!enabled) return null;
  const now = hintFor(field, text);
  // 지금 글에 모양이 없으면 바로 사라진다. 있으면 멈춘 뒤의 글에도 있을 때만(쓰는 중에 깜빡이지 않게)
  const kind = now && settled !== null && hintFor(field, settled) ? now : null;
  if (!kind) return null;
  const message = hintText(kind);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${CONTACT_HINT.a11yPrefix}${message}`}
      accessibilityLiveRegion="polite"
      testID={testID}>
      <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <AppText variant="caption" tone="text" style={styles.text} testID={`${testID}-text`}>
        {message}
      </AppText>
    </View>
  );
}

// 받는 쪽 고정 한 줄(NF10-04 · 10-13): 글을 판정하지 않고 편지 · 질문 소개가 보이는 자리에 늘 보인다
export function ContactReceiverNote({ testID = 'contact-receiver-note' }: { testID?: string }) {
  return (
    <AppText variant="caption" testID={testID}>
      {CONTACT_HINT.receiverNote}
    </AppText>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s8, backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: space.s12, paddingVertical: space.s8, marginTop: space.s8 },
  mark: { width: space.s4, alignSelf: 'stretch', borderRadius: radius.pill, backgroundColor: colors.sub },
  text: { flex: 1 },
});
