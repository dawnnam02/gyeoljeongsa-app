// 데모 모드에서만 보이는 기내 서비스 홈 장면 줄(IF2-F). 스토어 빌드(데모 모드 꺼짐)에는 그려지지 않는다 — boardingServices 가 데모일 때만 넘긴다.
//  장면 칩을 누르면 데모 서버(demo_inflight_scene — 탑승권 데모 장면도 같이)에 장면을 두고 홈을 다시 읽는다. 글은 데모 안내라 카피 대조 대상이 아니다(boardingDemoBar 와 같은 취급)
import type { SupabaseClient } from '@supabase/supabase-js';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import type { OpenedRounds } from '@/features/boarding/openedRounds';
import { colors, radius, space } from '@/theme/tokens';

import type { InflightScene } from './inflightDemo';

export const INFLIGHT_DEMO = {
  note: '데모 모드예요. 기내 서비스 홈 장면을 골라 볼 수 있어요.',
  scenes: [
    ['before', '탑승 전'],
    ['inflight', '비행 중'],
    ['magBefore', '기내지 발행 전'],
    ['landing', '착륙 준비'],
    ['matched', '공개 뒤 짝 있음'],
    ['noMatch', '공개 뒤 짝 없음'],
    ['overlap', '겹칠 때'],
    ['reflect', '방이 닫힌 뒤'],
  ] as readonly (readonly [InflightScene, string])[],
} as const;

export function inflightDemoBar(client: Pick<SupabaseClient, 'rpc'>, opened?: OpenedRounds) {
  return function InflightBar(reload: () => void) {
    return (
      <View style={styles.bar} testID="if2-demo">
        <AppText variant="caption" tone="text">
          {INFLIGHT_DEMO.note}
        </AppText>
        <View style={styles.chips}>
          {INFLIGHT_DEMO.scenes.map(([scene, label]) => (
            <Chip
              key={scene}
              label={label}
              variant="inactive"
              onPress={() => {
                if (scene === 'matched') opened?.mark(1); // 데모 1회차 공개를 이미 열어 본 것으로(도착 화면 다음)
                void Promise.resolve(client.rpc('demo_inflight_scene', { p_scene: scene })).then(reload);
              }}
              testID={`if2-demo-${scene}`}
            />
          ))}
        </View>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  bar: { gap: space.s8, padding: space.s16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.s8, rowGap: space.s8 },
});
