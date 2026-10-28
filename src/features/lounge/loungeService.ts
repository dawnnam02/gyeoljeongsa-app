// 라운지 화면이 쓰는 연결 하나(LG-F). 실서버 · 데모 모두 lib/supabase 의 클라이언트(데모 모드면 메모리 모의 서버 demo/loungeDemo — 0042 와 같은 응답 모양).
//  처음 쓸 때 한 번 만든다(시험이 서버 설정 없이 화면 파일을 읽을 수 있게 — chatService · boardingServices 와 같은 방식). 시험은 화면에 deps 를 직접 넣는다
import { appFlagsStore, type FlagsStore } from '@/hooks/useFeatureFlags';
import { isOn } from '@/lib/featureFlagsApi';

import { createLoungeApi, type LoungeApi } from './loungeApi';

export const LOUNGE_SWITCH = 'lounge'; // 기능 스위치(config/featureKeys.json — live 꺼짐 · 데모 켜짐, 정책 PL-34). 서버 0042 require_feature('lounge')와 같은 이름
export const LOUNGE_HREF = '/lounge'; // T6(탭 밖 · 새 탭 0)
export const LOUNGE_CHAT_HREF = '/chat'; // T4 목록(PL-35: 꺼짐 · 탑승 아님으로 T6 주소에 오면 여기로)
export const LOUNGE_BOARDING_HREF = '/boarding'; // [탑승권으로](19-5)

// 데모 줄(데모 모드에서만): 지금 장면 읽기 · 다음 장면
export type LoungeDemoControls = { scene: () => Promise<string | null>; next: () => Promise<string | null>; line: (scene: string | null) => string };
export type LoungeDeps = { api: LoungeApi; switchOn: () => Promise<boolean>; demo?: LoungeDemoControls };

// 스위치: 아직 못 읽었으면 한 번 읽고, 못 읽으면 live 값(꺼짐)
export async function loungeSwitchOn(store: FlagsStore): Promise<boolean> {
  const cur = store.get();
  const flags = cur.loaded ? cur : await store.refresh();
  return isOn(flags, LOUNGE_SWITCH);
}

let made: LoungeDeps | null = null;
export function appLoungeDeps(): LoungeDeps {
  if (!made) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { env } = require('@/config/env') as typeof import('@/config/env');
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const api = createLoungeApi(supabase);
    const switchOn = () => loungeSwitchOn(appFlagsStore());
    if (env.demoMode) {
      const { loungeSceneLine } = require('@/demo/loungeDemoScenes') as typeof import('@/demo/loungeDemoScenes');
      const sceneCall = async (args: Record<string, unknown>) => {
        const { data } = await supabase.rpc('demo_lounge_scene', args);
        const scene = (data as { scene?: unknown } | null)?.scene;
        return typeof scene === 'string' ? scene : null;
      };
      made = { api, switchOn, demo: { scene: () => sceneCall({ p_peek: true }), next: () => sceneCall({ p_scene: null }), line: loungeSceneLine } };
    } else {
      made = { api, switchOn };
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
  }
  return made;
}
