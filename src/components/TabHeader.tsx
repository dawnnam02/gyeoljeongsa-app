// 탭 화면 머리(F11): 높이 56 · 제목 20 Bold(왼쪽) · 오른쪽 위 원형 프로필 버튼(가이드 11-1).
// 제목은 왼쪽 여백 20, 버튼의 터치 영역 오른쪽 끝은 화면 끝에서 14(= 원의 오른쪽 끝이 여백 20, layout.profileButtonInset).
// 09 · 11 · 12 · 13 · 14 · 16 이 쓴다. 뒤로가기가 있는 하위 화면(ScreenHeader)과 08 · 10 에는 쓰지 않는다.
// 큰 제목 줄어듦(D25 10-4 · F21): collapse(useCollapsingTitle)를 주면 목록을 0 → 48 내리는 동안 제목이 투명해지며 8 위로 · 0.9배로 줄고,
//  머리 가운데 작은 제목(본문 Bold 16, D-118 ④)이 나타나며 48 에서 아래 선이 생긴다. 시간 없이 스크롤에 묶임. 동작 줄이기면 투명도만.
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { useCollapsingTitle } from '@/motion';
import { layout } from '@/theme/layout';
import { colors, size } from '@/theme/tokens';

import { AppText, HEADER_MAX_SCALE } from './AppText';
import { ProfileButton } from './ProfileButton';

type Props = { title: string; collapse?: ReturnType<typeof useCollapsingTitle>; testID?: string };

export function TabHeader({ title, collapse, testID }: Props) {
  return (
    <View style={styles.bar} testID={testID}>
      <Animated.View style={[styles.title, collapse?.big]}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={HEADER_MAX_SCALE}>
          {title}
        </AppText>
      </Animated.View>
      {collapse ? (
        <Animated.View style={[styles.small, collapse.small]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText variant="bodyBold" numberOfLines={1} maxFontSizeMultiplier={HEADER_MAX_SCALE} testID={testID ? `${testID}-small` : undefined}>
            {title}
          </AppText>
        </Animated.View>
      ) : null}
      <ProfileButton />
      {collapse ? <Animated.View style={[styles.line, collapse.line]} pointerEvents="none" testID={testID ? `${testID}-line` : undefined} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: size.header, flexDirection: 'row', alignItems: 'center', paddingLeft: size.screenPadding, paddingRight: layout.profileButtonInset },
  title: { flex: 1, transformOrigin: 'left' },
  small: { position: 'absolute', left: size.touchMin + size.screenPadding, right: size.touchMin + size.screenPadding, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line },
});
