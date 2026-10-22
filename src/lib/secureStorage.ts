// SecureStore 를 조각 저장소(chunkedStorage)로 감싼 앱 전용 저장소.
// 토큰 · 세션 · 설문 답처럼 민감한 값은 여기에만 둔다. AsyncStorage 에는 두지 않는다(보안/구성.md 4-1).
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { chunkedStorage, type Store } from './chunkedStorage';

// iOS: 이 기기 전용 · 잠금을 푼 동안에만 읽힌다. 다른 기기 백업으로 옮겨지지 않는다.
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const nativeStore: Store = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  del: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};

// 웹은 개발 미리보기용이다. 브라우저 저장소(localStorage)에 토큰을 두지 않으려고 메모리에만 둔다.
const memory = new Map<string, string>();
const memoryStore: Store = {
  get: async (key) => memory.get(key) ?? null,
  set: async (key, value) => void memory.set(key, value),
  del: async (key) => void memory.delete(key),
};

export const secureStore: Store = Platform.OS === 'web' ? memoryStore : nativeStore;

// 줄 세우기가 저장소 인스턴스마다 따로라서, 용도별로 인스턴스를 나눈다.
export const authStorage = chunkedStorage(secureStore); // Supabase 세션(lib/supabase.ts)
export const appStateStorage = chunkedStorage(secureStore); // 설문 임시 저장(store/)
export const securityStorage = chunkedStorage(secureStore); // 보안 설정: 상대 화면 캡처 차단(store/securityStore.ts, 팀장 결정 10-15 ⑥)
