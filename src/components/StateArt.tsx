// 상태 · 빈 목록 그림 한 장(F13a, H2 새 그림). 꾸밈 그림이라 스크린리더는 건너뛴다(글이 뜻을 말한다).
//  · 정사각 칸 size(기본 layout.emptyArt 140)에 그림을 맞춘다. 파일은 144 격자 투명 576(밀도별 @2x · @3x 는 RN 이 고른다)
//  · 인터넷 끊김 그림(52)은 불러오기 실패 화면이 network 일 때만 쓴다: <OfflineArt show={loadError === 'network'} />
import type { ImageSourcePropType } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

import { layout } from '@/theme/layout';
import { space } from '@/theme/tokens';
import { H2_STATE_ART } from '@/theme/uiAssets';

export function StateArt({ source, size = layout.emptyArt, testID }: { source: ImageSourcePropType; size?: number; testID?: string }) {
  return (
    <View style={styles.slot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

export function OfflineArt({ show }: { show: boolean }) {
  return show ? <StateArt source={H2_STATE_ART.stateOffline} size={layout.stateArt} testID="offline-art" /> : null;
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: space.s4 },
});
