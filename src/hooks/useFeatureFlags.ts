// 기능 켜기 스위치 훅(R1 A⑦ · K12 C1 · K19 2-5). 화면은 이 훅 하나로 스위치를 읽는다.
//  · 앱 실행 동안 한 번 불러 모든 화면이 나눠 쓴다(같은 때 여러 화면이 불러도 요청은 하나). refresh() 로 다시 부른다(예: 로그인 직후)
//  · 불러오기 전 · 못 불러온 동안은 키마다 live 값(구현된 기능만 켜짐, 새 기능 꺼짐 — lib/featureFlagsApi FLAGS_FALLBACK)
//  · 꺼진 기능은 화면을 그리지 않는다. 오류 글은 보이지 않는다
//  · 키 목록은 src/config/featureKeys.json 하나. 목록 밖 키는 늘 꺼짐
//  · 시험은 createFlagsStore 에 가짜 load 를 넣어 쓴다. 앱 기본 저장소는 처음 쓸 때 서버 연결을 불러온다(시험 환경이 서버 설정 없이 이 파일을 읽을 수 있게)
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { FLAGS_FALLBACK, isOn as flagOn, type FeatureFlags, type FeatureKey } from '@/lib/featureFlagsApi';

export type FlagsStore = {
  get: () => FeatureFlags;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<FeatureFlags>;
  started: () => boolean; // 한 번이라도 불러 봤나
};

export function createFlagsStore(load: () => Promise<FeatureFlags>, initial: FeatureFlags = FLAGS_FALLBACK): FlagsStore {
  let value = initial;
  let inflight: Promise<FeatureFlags> | null = null;
  let tried = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (inflight) return inflight;
      tried = true;
      inflight = load()
        .catch(() => FLAGS_FALLBACK)
        .then((next) => {
          value = next;
          inflight = null;
          listeners.forEach((l) => l());
          return next;
        });
      return inflight;
    },
    started: () => tried,
  };
}

let appStore: FlagsStore | null = null;
// 앱 기본 저장소: 처음 부를 때 서버 연결(데모 모드면 모의 서버)을 불러 만든다
export function appFlagsStore(): FlagsStore {
  if (!appStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createFeatureFlagsApi } = require('@/lib/featureFlagsApi') as typeof import('@/lib/featureFlagsApi');
    const api = createFeatureFlagsApi(supabase);
    appStore = createFlagsStore(() => api.load());
  }
  return appStore;
}

export function useFeatureFlags(store?: FlagsStore): { flags: FeatureFlags; isOn: (key: FeatureKey) => boolean; refresh: () => Promise<FeatureFlags> } {
  const s = store ?? appFlagsStore();
  const flags = useSyncExternalStore(s.subscribe, s.get, s.get);
  useEffect(() => {
    if (!s.started()) void s.refresh();
  }, [s]);
  const isOn = useCallback((key: FeatureKey) => flagOn(flags, key), [flags]);
  return { flags, isOn, refresh: s.refresh };
}
