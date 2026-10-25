// 16 상점 화면 조각(Figma D20 305:48): 테스트 화면 띠 · 빨간 라벨 · 구매 전 확인 줄 · 구역 제목 · 누르는 줄. 색 · 글자 · 간격은 토큰만 쓴다.
//  글은 content/shopCopy.ts · productCopy.ts. 이 파일은 글을 만들지 않고 놓을 자리만 정한다.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { BEFORE_BUY, SHOP16 } from '@/content/shopCopy';
import { FILL_INS } from '@/content/fillIns';
import { layout } from '@/theme/layout';
import { colors, radius, size, space } from '@/theme/tokens';

// 테스트 화면 맨 위 띠(NV56, payment_mode = demo 에서만)
export function TestBand({ testID = 'shop-test-band' }: { testID?: string }) {
  return (
    <View style={styles.band} accessible accessibilityRole="alert" testID={testID}>
      <AppText variant="captionMedium" tone="accent" style={styles.bandText}>
        {SHOP16.testBand}
      </AppText>
    </View>
  );
}

// 빨간 라벨(NV57) + 이유 한 줄(카피 16-C). 테스트 화면의 위험 C 상품에만. 색은 accent(토큰 밖 빨강은 쓰지 않는다)
export function RiskNote({ reason, testID }: { reason: string | null; testID?: string }) {
  return (
    <View style={styles.risk} testID={testID}>
      <View style={styles.riskChip}>
        <AppText variant="captionMedium" tone="accent">
          {SHOP16.riskLabel}
        </AppText>
      </View>
      {reason ? (
        <AppText variant="caption" testID={testID ? `${testID}-reason` : undefined}>
          {reason}
        </AppText>
      ) : null}
    </View>
  );
}

// 구역 제목 한 줄(예: "필요할 때 하나씩" · "무료로 볼 수 있어요")
export function SectionTitle({ text, testID }: { text: string; testID?: string }) {
  return (
    <AppText variant="bodyBold" accessibilityRole="header" style={styles.sectionTitle} testID={testID}>
      {text}
    </AppText>
  );
}

// 구매 전 확인 줄(법정 문구): "라벨: 글" 한 줄씩. 라벨은 굵게
export function LegalLines({ lines, testID }: { lines: readonly { label: string; text: string }[]; testID?: string }) {
  return (
    <View style={styles.legal} testID={testID}>
      {lines.map((line) => (
        <AppText key={line.label} variant="caption" tone="text" testID={testID ? `${testID}-${line.label}` : undefined}>
          <AppText variant="captionBold" tone="text">{`${line.label}: `}</AppText>
          {line.text}
        </AppText>
      ))}
    </View>
  );
}

// 판매자 정보 한 줄(Q5A-03): {운영자 상호 …} 같은 값은 법무 판_관리 7장에 값이 있으면 넣는다.
// 값이 없는 칸은 변수 글을 보이지 않고 그 칸만 뺀다. 남은 값이 하나도 없으면 null(호출한 쪽이 '준비 중' 한 줄을 보인다. D-28 보류).
export function sellerText(text: string): string | null {
  const parts = text
    .split(' · ')
    .map((part) => {
      let missing = false;
      const filled = part.replace(/\{([^}]+)\}/g, (_whole, name: string) => {
        const value = FILL_INS[name];
        if (value == null) missing = true;
        return value ?? '';
      });
      return missing ? null : filled;
    })
    .filter((part): part is string => part != null);
  const withoutLead = parts.filter((part) => !part.startsWith('판매자:') || part.slice('판매자:'.length).trim() !== '');
  return withoutLead.length > 0 ? withoutLead.join(' · ') : null;
}

// 목록의 이동 줄(›, D42-C 1안 chevron 20 · sub): 한 줄 전체가 터치 영역
const CHEVRON = 20;
export function LinkRow({ label, onPress, last = false, icon, testID }: { label: string; onPress: () => void; last?: boolean; icon?: IconName | null; testID?: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} effect="none" testID={testID} style={({ pressed }) => [styles.linkRow, !last && styles.linkDivider, pressed && styles.linkPressed]}>
      {icon ? <Icon name={icon} size={layout.shopRowIcon} /> : null}
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <Icon name="chevron" size={CHEVRON} color={colors.sub} />
    </Pressable>
  );
}

// 카드 안의 한 줄 + 오른쪽 칩 자리 같은 가로 배치
export function Row({ children, gap = space.s12 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

// 법정 문구 맨 아래 링크 줄 이름
export const BEFORE_BUY_LINKS = { refund: BEFORE_BUY.refundLink, docs: BEFORE_BUY.docsLink } as const;

const styles = StyleSheet.create({
  band: { backgroundColor: colors.accentSoft, borderRadius: radius.md, paddingHorizontal: space.s12, paddingVertical: space.s8 },
  bandText: { textAlign: 'center' },
  risk: { gap: space.s4, alignItems: 'flex-start' },
  riskChip: { minHeight: size.chip, borderRadius: radius.pill, paddingHorizontal: space.s12, justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bg },
  sectionTitle: { paddingTop: space.s8 },
  legal: { gap: space.s8 },
  linkRow: { minHeight: size.listRow, flexDirection: 'row', alignItems: 'center', gap: space.s12, paddingHorizontal: space.s16, paddingVertical: space.s8 },
  linkDivider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  linkPressed: { backgroundColor: colors.line },
  flex: { flex: 1, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
