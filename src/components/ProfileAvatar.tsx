// 프로필 사진 부품 하나(F11, 기획 K7 A14 · 가이드 11장): 사진이 있으면 그 사진, 없으면 같은 기본 그림.
//  · 사진 있음 / 없음 판정은 이 부품 한 곳에서만 한다: uri 가 없거나 못 불러오면(onError) 기본 그림 — 미등록 · 확인 중이라 안 보임 · 반려 · 못 불러옴이 모두 같은 그림이다
//  · 기본 그림 = '빛 실루엣' 한 장(D42-P · D-176, AVATAR_ART.silhouette). 원 · 사각 · 크기와 상관없이 칸을 꽉 채운다(cover — 4:5 그림의 가운데, 원에서는 머리와 어깨)
//  · 사진 칸도 accentSoft 바탕 위에 올린다(F13a: 사진이 오는 동안 · 투명 · 아주 작은 사진에서 칸이 비거나 다른 색 원으로 보이지 않게)
//  · 이니셜 원 · 회색 원은 쓰지 않는다(본인 지시 10-15). 사진에는 테두리를 두지 않는다
//  · testID: 바깥 칸 = testID, 기본 그림을 그릴 때 안쪽 그림 = `${testID}-default`
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/tokens';
import { AVATAR_ART } from '@/theme/uiAssets';

type Props = {
  uri?: string | null;
  width: number;
  height?: number; // 없으면 width(정사각)
  round?: boolean; // 원(기본) · false 면 radiusSize 만큼 둥근 사각
  radiusSize?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ProfileAvatar({ uri, width, height = width, round = true, radiusSize = 0, style, testID }: Props) {
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = !!uri && broken !== uri;
  const corner = round ? Math.min(width, height) / 2 : radiusSize;
  const base = { width, height, borderRadius: corner };

  return (
    <View style={[styles.box, base, style]} testID={testID}>
      {showPhoto ? (
        <Image source={{ uri }} style={styles.fill} onError={() => setBroken(uri)} accessibilityIgnoresInvertColors />
      ) : (
        <Image source={AVATAR_ART.silhouette} style={styles.fill} resizeMode="cover" accessibilityIgnoresInvertColors testID={testID ? `${testID}-default` : undefined} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  fill: { width: '100%', height: '100%' },
});
