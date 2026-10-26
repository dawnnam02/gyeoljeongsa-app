// 출시 전 11 호감 · 16 상점(+ 16-G 내 등급) 탭(K20 4-1 · 4-5 · P-D8 · NP-15 · NP-16): 빈 상태 한 줄씩. 상품 목록 · 구매 권유 · 등급 숫자 0.
//  · 머리는 원래 탭 이름(호감 · 상점)과 같은 자리 · 같은 모양(TabHeader + 프로필 원). 하단 탭은 그대로
//  · 날짜는 서버 launch_day 의 월 · 일만('상점은 12월 25일에 열려요.'). 날짜가 없으면 '출시일에 열려요.' 남은 날 수 0
//  · 상점 탭 하나로 16-G(내 등급) 줄을 함께 보인다 — 등급 쪽은 상점 안의 쪽이라 상점이 닫히면 같이 닫힌다
//  · v5(QP-A, 카피.md 14-1): '상점은 … 열려요' · 호감 한 줄은 없다(두 탭 모두 v5 숨김). 상점 쪽은 첫 등급 계산 줄만 남는다
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { TabHeader } from '@/components/TabHeader';
import { TABS } from '@/content/copy';
import { LogoTile, logoTile } from '@/motion';
import { size, space } from '@/theme/tokens';

import { PRELAUNCH_TABS } from './prelaunchCopy';

// launchDay 는 부르는 쪽(PrelaunchGate)과 모양을 맞추려고 받는다 — v5에서는 날짜 글이 없다
export function PrelaunchTabScreen({ kind }: { kind: 'likes' | 'shop'; launchDay: string | null }) {
  const lines: string[] = kind === 'likes' ? [] : [PRELAUNCH_TABS.firstCalc];
  return (
    <Screen edges={['top']} testID={`prelaunch-tab-${kind}`}>
      <TabHeader title={kind === 'likes' ? TABS.likes : TABS.shop} testID={`prelaunch-tab-${kind}-header`} />
      <View style={styles.body}>
        <LogoTile size={logoTile.moment} />
        {lines.map((line, i) => (
          <AppText key={line} variant={i === 0 ? 'bodyMedium' : 'body'} tone={i === 0 ? 'text' : 'sub'} style={styles.line} testID={`prelaunch-tab-${kind}-line-${i}`}>
            {line}
          </AppText>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: size.screenPadding, gap: space.s12, paddingBottom: space.s48 },
  line: { textAlign: 'center' },
});
