// 토스트: 화면 아래(탭바 위)에 잠깐 뜨는 글 한 줄. 스크린리더에는 알림으로 읽힌다. 보이는 시간은 부모가 정한다(visible 로 켜고 끈다, 기본 5초 = theme/motion TOAST_MS).
// 아래에 고정 바가 있는 화면(10)은 bottom 으로 바 높이 + 12 를 넘겨 버튼을 가리지 않게 한다(D8 4차 M14). 없으면 아래 24.
// 움직임(D25 장면표 '토스트'): 아래 8px 에서 올라오며 나타남 250(out) → 사라짐 150(투명도). 동작 줄이기: 투명도만 150
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { Rise, scene } from '@/motion';
import { colors, radius, space } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = { text: string | null; bottom?: number; testID?: string };

export function Toast({ text, bottom, testID }: Props) {
  if (!text) return null;
  return (
    <Animated.View exiting={FadeOut.duration(scene.toast.out)} style={[styles.wrap, bottom !== undefined && bottom > 0 ? { bottom } : null]} pointerEvents="none">
      <Rise key={text} distance={scene.toast.rise} duration={scene.toast.in}>
        <View style={styles.toast} accessible accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID ?? 'toast'}>
          <AppText variant="captionMedium" tone="inverse">
            {text}
          </AppText>
        </View>
      </Rise>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: space.s24, alignItems: 'center', paddingHorizontal: space.s20 },
  toast: { backgroundColor: colors.text, borderRadius: radius.pill, paddingHorizontal: space.s16, paddingVertical: space.s12 },
});
