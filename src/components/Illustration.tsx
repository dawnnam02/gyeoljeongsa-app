// D42-I 장면 그림 한 장(4안 요즘 여행 포스터 · react-native-svg). 꾸밈 그림이라 스크린리더는 건너뛴다(글이 뜻을 말한다).
//  · 칸은 4:3(원본 320×240) · 둥글기 20 · 잘라 담기. 폭은 부모를 채우고 maxWidth(기본 390, D43 D1)까지 · 늘 가운데
//  · 다크 모드면 다크 판(시스템 색 모드). 앱이 라이트 고정(app.json userInterfaceStyle)인 동안 휴대폰에서는 라이트 판만 보인다
//  · 데이터 · 장면 목록은 theme/illustrations.ts
import { StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { illustration, ILLUSTRATIONS, type IllustrationMode, type IllustrationScene } from '@/theme/illustrations';
import { radius } from '@/theme/tokens';

type Props = { scene: IllustrationScene; maxWidth?: number; mode?: IllustrationMode; style?: StyleProp<ViewStyle>; testID?: string };

export function Illustration({ scene, maxWidth = illustration.hero, mode, style, testID }: Props) {
  const scheme = useColorScheme();
  const m: IllustrationMode = mode ?? (scheme === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.box, { maxWidth }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <SvgXml xml={ILLUSTRATIONS[scene][m]} width="100%" height="100%" testID={`illustration-${scene}-${m}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: illustration.ratio, alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden' },
});
