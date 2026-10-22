// 상대 사진 칸. 승인된 사진은 서명 URL 로 그리고, 사진이 없거나(미등록 · 반려 · 못 불러옴) 확인 중이라 못 보이면 기본 프로필 그림을 그린다
// (accentSoft 면 + 사람 모양, 칸 = 짧은 변 × 62.5% 최대 64 — 가이드 11-3, 앱 F11). 확인 중이면 그림 아래에 "사진 확인 중"(NK03, 겹치지 않음).
// 그림은 장식이 아니라 사진 자리라 접근성 이름을 단다.
import { useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { RECS } from '@/content/copy';
import { layout } from '@/theme/layout';
import { colors, radius, space } from '@/theme/tokens';
import { AVATAR_ART } from '@/theme/uiAssets';

import type { PhotoSlotState } from './recsLogic';

type Props = { state: PhotoSlotState; uri?: string | null; label?: string; style?: StyleProp<ViewStyle>; testID?: string };

export function PhotoBox({ state, uri, label = RECS.photoA11y, style, testID }: Props) {
  const [brokenUri, setBrokenUri] = useState<string | null>(null); // 읽기에 실패한 주소. 새 주소를 받으면 다시 시도한다(굳지 않게)
  const broken = !!uri && uri === brokenUri;
  const [side, setSide] = useState(0); // 칸의 짧은 변(사람 칸 크기를 정한다)
  const showImage = state === 'approved' && !!uri && !broken;
  const person = Math.min(side * layout.avatarPersonRatio, layout.avatarPersonMax);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSide(Math.min(width, height));
  };
  return (
    <View style={[styles.box, showImage ? null : styles.soft, style]} accessible accessibilityLabel={label} testID={testID} onLayout={onLayout}>
      {showImage ? <Image source={{ uri }} style={styles.image} onError={() => setBrokenUri(uri ?? null)} accessibilityIgnoresInvertColors /> : null}
      {!showImage && person > 0 ? (
        <Image source={AVATAR_ART.person} style={{ width: person, height: person }} resizeMode="contain" accessibilityIgnoresInvertColors testID={testID ? `${testID}-default` : undefined} />
      ) : null}
      {state === 'pending' ? (
        <AppText variant="caption" style={styles.center} testID={testID ? `${testID}-checking` : undefined}>
          {RECS.photoChecking}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.line, borderRadius: radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: space.s4 }, // 09 카드 사진 둥글기 8(가이드 4장, D8 4차 M7)
  soft: { backgroundColor: colors.accentSoft },
  image: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
});
