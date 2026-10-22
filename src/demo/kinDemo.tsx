// 09 위 데모 줄(F24 · 청사진 v4 10-5 P8 '끼리끼리 보이기'): '나'의 등급을 1~9 로 바꿔 오늘 추천이 서버 S16 규칙 흉내(같은 등급 먼저 → 한 단계씩 넓힘)로 바뀌는 걸 본다.
//  · 데모 모드에서만 만든다(features/prelaunch/prelaunchServices 가 데모일 때만 넘김). 끼리끼리 장면 계정(이메일에 kk1~kk9)에서만 보인다 — 다른 데모 계정의 09 는 그대로
//  · 누르면 데모 서버(demo_kin_me)에 다음 등급을 두고, 부르는 쪽이 09 를 다시 그려 새 목록을 읽는다. 상점 '내 등급' 화면도 같은 값을 쓴다
//  · 글은 원본 문서에 없는 데모 안내라 카피 대조 대상이 아니다(prelaunchDemoBar 와 같은 취급)
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { size, space } from '@/theme/tokens';

export type KinState = { no: number; on: boolean };
export type KinDemo = { read: () => Promise<KinState | null>; set: (no: number) => Promise<KinState | null> };

const readState = (data: unknown): KinState | null => {
  if (typeof data !== 'object' || data === null) return null;
  const { no, on } = data as { no?: unknown; on?: unknown };
  return typeof no === 'number' && typeof on === 'boolean' ? { no, on } : null;
};

export function createKinDemo(client: Pick<SupabaseClient, 'rpc'>): KinDemo {
  const call = async (args: Record<string, unknown>) => {
    try {
      const { data, error } = await client.rpc('demo_kin_me', args);
      return error ? null : readState(data);
    } catch {
      return null;
    }
  };
  return { read: () => call({}), set: (no) => call({ p_no: no }) };
}

export const KIN_DEMO = {
  label: (no: number, next: number) => `데모 · 끼리끼리: 내 등급 ${no} (누르면 ${next})`,
} as const;
export const nextKin = (no: number): number => (no % 9) + 1;

export function KinDemoChip({ kin, onChanged }: { kin: KinDemo; onChanged: () => void }) {
  const [state, setState] = useState<KinState | null>(null);
  useEffect(() => {
    let alive = true;
    void kin.read().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [kin]);
  if (!state?.on) return null;
  const next = nextKin(state.no);
  return (
    <View style={styles.wrap} pointerEvents="box-none" testID="kin-demo-wrap">
      <Chip
        label={KIN_DEMO.label(state.no, next)}
        variant="inactive"
        onPress={() => {
          void kin.set(next).then((s) => {
            if (s) {
              setState(s);
              onChanged();
            }
          });
        }}
        testID="kin-demo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: size.screenPadding, bottom: space.s8 },
});
