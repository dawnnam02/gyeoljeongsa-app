// 프로필 사진 부품 하나(F11, 기획 K7 A14 · 가이드 11장): 사진이 있으면 그 사진, 없으면 같은 기본 프로필 그림.
//  · 사진 있음 / 없음 판정은 이 부품 한 곳에서만 한다: uri 가 없거나 못 불러오면(onError) 기본 그림 — 미등록 · 확인 중이라 안 보임 · 반려 · 못 불러옴이 모두 같은 그림이다
//  · 사진 칸도 기본 그림과 같은 accentSoft 바탕 위에 올린다(F13a: 사진이 오는 동안 · 투명 · 아주 작은 사진에서 칸이 비거나 다른 색 원으로 보이지 않게)
//  · 이니셜 원 · 회색 원은 쓰지 않는다(본인 지시 10-15). 사진에는 테두리를 두지 않는다
//  · 그림 규칙(가이드 11-2 · 11-3): 지름 44 이하의 원 = 기본_프로필_32(원 + 사람이 든 그림 한 장), 그보다 크거나 사각 자리 = accentSoft 면 + 사람 모양(칸 = 짧은 변 × 62.5%, 최대 64)
//  · testID: 바깥 칸 = testID, 기본 그림을 그릴 때 안쪽 그림 = `${testID}-default`
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { layout } from '@/theme/layout';
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
  const personSize = Math.min(Math.min(width, height) * layout.avatarPersonRatio, layout.avatarPersonMax);
  const wholeArt = round && width === height && width <= layout.avatarArtMaxSize;
  const defaultId = testID ? `${testID}-default` : undefined;

  if (showPhoto) {
    return (
      <View style={[styles.box, styles.soft, base, style]} testID={testID}>
        <Image source={{ uri }} style={styles.fill} onError={() => setBroken(uri)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  if (wholeArt) {
    return (
      <View style={[styles.box, base, style]} testID={testID}>
        <Image source={AVATAR_ART.profile} style={styles.fill} resizeMode="contain" accessibilityIgnoresInvertColors testID={defaultId} />
      </View>
    );
  }
  return (
    <View style={[styles.box, styles.soft, base, style]} testID={testID}>
      <Image source={AVATAR_ART.person} style={{ width: personSize, height: personSize }} resizeMode="contain" accessibilityIgnoresInvertColors testID={defaultId} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  soft: { backgroundColor: colors.accentSoft },
});
