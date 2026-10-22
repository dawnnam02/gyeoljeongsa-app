// 상단 바(가이드 3장: 높이 52). 왼쪽 ‹ 뒤로 아이콘(터치 44 × 44)과 화면 제목(20 Bold).
// ‹ 는 디자인/아이콘/투명/05_뒤로가기.png. 가이드 10-3: 상단 바 아이콘은 3장 눌림 색만 쓴다(scale · ripple 없음).
import { Image, StyleSheet, View } from 'react-native';

import { A11Y } from '@/content/copy';
import { layout } from '@/theme/layout';
import { UI_ICONS } from '@/theme/uiAssets';
import { alpha, size, space } from '@/theme/tokens';

import { AppText, HEADER_MAX_SCALE } from './AppText';
import { Pressable } from './Pressable';
import { TextButton } from './TextButton';

type Props = {
  title: string;
  onBack?: () => void; // 없으면 ‹ 를 그리지 않는다
  rightLabel?: string; // 있으면 오른쪽에 글자 링크(accent Medium 15)
  onRight?: () => void;
  testID?: string;
};

export function ScreenHeader({ title, onBack, rightLabel, onRight, testID }: Props) {
  return (
    <View style={styles.bar} testID={testID}>
      {onBack ? (
        <Pressable
          accessibilityLabel={A11Y.back}
          onPress={onBack}
          effect="none"
          testID={testID ? `${testID}-back` : undefined}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}>
          <Image source={UI_ICONS.back} style={styles.icon} />
        </Pressable>
      ) : null}
      <AppText variant="title" numberOfLines={1} maxFontSizeMultiplier={HEADER_MAX_SCALE} accessibilityRole="header" style={onBack ? styles.titleAfterBack : styles.title}>
        {title}
      </AppText>
      {rightLabel ? <TextButton label={rightLabel} onPress={onRight} testID={testID ? `${testID}-right` : undefined} /> : null}
    </View>
  );
}

const iconPadding = (size.touchMin - layout.headerIcon) / 2;

const styles = StyleSheet.create({
  bar: { minHeight: size.header, flexDirection: 'row', alignItems: 'center', paddingLeft: space.s4, paddingRight: size.screenPadding },
  back: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  icon: { width: layout.headerIcon, height: layout.headerIcon },
  pressed: { opacity: alpha.pressed },
  title: { flex: 1, marginLeft: size.screenPadding - space.s4 },
  // 아이콘 둘레의 빈 터치 자리(10)만큼 제목을 당겨 ‹ 와 글자를 붙여 둔다(Figma: ‹ 바로 옆에 제목)
  titleAfterBack: { flex: 1, marginLeft: -iconPadding },
});
