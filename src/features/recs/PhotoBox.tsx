// 상대 사진 칸. 승인된 사진은 서명 URL 로 그리고, 사진이 없거나(미등록 · 반려 · 못 불러옴) 확인 중이라 못 보이면 기본 그림을 그린다
// (D42-P · D-176: '빛 실루엣' 한 장이 칸을 꽉 채운다, cover). 확인 중이면 그림 아래 띠에 "사진 확인 중"(NK03, 그림과 겹치지 않음).
// 그림은 장식이 아니라 사진 자리라 접근성 이름을 단다.
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/AppText';
import { RECS } from '@/content/copy';
import { colors, radius, space } from '@/theme/tokens';
import { AVATAR_ART } from '@/theme/uiAssets';

import type { PhotoSlotState } from './recsLogic';

type Props = { state: PhotoSlotState; uri?: string | null; label?: string; style?: StyleProp<ViewStyle>; testID?: string };

export function PhotoBox({ state, uri, label = RECS.photoA11y, style, testID }: Props) {
  const [brokenUri, setBrokenUri] = useState<string | null>(null); // 읽기에 실패한 주소. 새 주소를 받으면 다시 시도한다(굳지 않게)
  const broken = !!uri && uri === brokenUri;
  const showImage = state === 'approved' && !!uri && !broken;
  return (
    <View style={[styles.box, showImage ? null : styles.soft, style]} accessible accessibilityLabel={label} testID={testID}>
      {showImage ? (
        <Image source={{ uri }} style={styles.image} onError={() => setBrokenUri(uri ?? null)} accessibilityIgnoresInvertColors />
      ) : (
        <Image source={AVATAR_ART.silhouette} style={styles.art} resizeMode="cover" accessibilityIgnoresInvertColors testID={testID ? `${testID}-default` : undefined} />
      )}
      {state === 'pending' ? (
        <AppText variant="caption" style={styles.checking} testID={testID ? `${testID}-checking` : undefined}>
          {RECS.photoChecking}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' }, // 09 카드 사진 둥글기 8(가이드 4장, D8 4차 M7)
  soft: { backgroundColor: colors.accentSoft },
  image: { width: '100%', height: '100%' },
  art: { width: '100%', flex: 1, minHeight: 0 },
  checking: { textAlign: 'center', paddingVertical: space.s4, backgroundColor: colors.accentSoft },
});
