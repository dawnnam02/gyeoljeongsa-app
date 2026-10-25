// 데모 모드에서만 보이는 탑승권 장면 줄(V5 W6). 스토어 빌드(데모 모드 꺼짐)에는 그려지지 않는다 — features/boarding/boardingServices 가 데모일 때만 넘긴다.
//  장면 칩을 누르면 데모 서버(demo_boarding_scene)에 장면을 두고 탑승권 화면을 다시 읽는다. 글은 데모 안내라 카피 대조 대상이 아니다(prelaunchDemoBar 와 같은 취급)
import type { SupabaseClient } from '@supabase/supabase-js';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { colors, radius, space } from '@/theme/tokens';

import type { OpenedRounds } from '@/features/boarding/openedRounds';

import type { BoardingScene } from './boardingDemo';

// 데모 회차는 1회차(boardingDemo ROUNDS[0]). '도착(아직 안 엶)' = 공개 장면 + 열어 본 표시 지움 · '수요일 18:00 공개' = 이미 열어 본 회차(D-178)
const DEMO_ROUND = 1;
type DemoChip = BoardingScene | 'arrived';

export const BOARDING_DEMO = {
  note: '데모 모드예요. 탑승권 장면을 골라 볼 수 있어요.',
  scenes: [
    ['before', '판매 전'],
    ['onsale', '판매 중'],
    ['credit', '크레딧 1장'],
    ['full', '좌석 모두 참'],
    ['boarded', '탑승 완료'],
    ['arrived', '도착(아직 안 엶)'],
    ['matched', '수요일 18:00 공개'],
    ['none', '찾지 못함'],
    ['closed', '판매 끝'],
    ['politics', '정치 문항 빈칸'],
  ] as readonly (readonly [DemoChip, string])[],
} as const;

export function boardingDemoBar(client: Pick<SupabaseClient, 'rpc'>, opened?: OpenedRounds) {
  return function DemoBar(reload: () => void) {
    return (
      <View style={styles.bar} testID="boarding-demo">
        <AppText variant="caption" tone="text">
          {BOARDING_DEMO.note}
        </AppText>
        <View style={styles.chips}>
          {BOARDING_DEMO.scenes.map(([scene, label]) => (
            <Chip
              key={scene}
              label={label}
              variant="inactive"
              onPress={() => {
                if (scene === 'arrived') opened?.forget(DEMO_ROUND);
                if (scene === 'matched') opened?.mark(DEMO_ROUND);
                void Promise.resolve(client.rpc('demo_boarding_scene', { p_scene: scene === 'arrived' ? 'matched' : scene })).then(reload);
              }}
              testID={`boarding-demo-${scene}`}
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
