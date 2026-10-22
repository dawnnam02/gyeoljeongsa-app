// 앱이 쓰는 가입 진행 상태 저장소 하나와, 저장된 값을 다 불러왔는지 알려 주는 훅.
import { useSyncExternalStore } from 'react';

import { appStateStorage } from '@/lib/secureStorage';

import { createSignupStore } from './signupStore';

export const useSignupStore = createSignupStore(appStateStorage);

// 앱을 켠 직후 SecureStore 에서 값이 올라오기 전에 빈 값으로 그리지 않게 기다리는 데 쓴다.
export function useSignupHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useSignupStore.persist.onFinishHydration(onChange),
    () => useSignupStore.persist.hasHydrated(),
    () => false,
  );
}
