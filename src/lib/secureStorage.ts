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

// 열쇠 목록을 함께 적는 저장소(3부-카 ⑤ · 보안 IC3-20): 설문 임시 저장 · 피할 회사 · 학교는 열쇠 끝에 회원 id 가 붙어, 앱을 지웠다 새로 깐 기기(iOS 키체인에 값이 남음)에서는 어떤 열쇠가 있는지 알 수 없다.
//  쓴 열쇠를 목록 한 곳(indexKey)에 적어 두고, clearAll 이 목록대로 지운다. 목록에는 열쇠 이름만 있다(값 · 회원 정보 0 — 이름 끝의 회원 id 는 이미 열쇠에 있던 것). 같은 저장소의 작업은 줄을 서서 한다.
function withKeyIndex(base: ReturnType<typeof chunkedStorage>, indexKey: string) {
  let tail: Promise<unknown> = Promise.resolve();
  const inOrder = <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
  const readIndex = async (): Promise<string[]> => {
    try {
      const raw = await base.getItem(indexKey);
      const v: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    getItem: (key: string): Promise<string | null> => base.getItem(key),
    setItem: (key: string, value: string): Promise<void> =>
      inOrder(async () => {
        await base.setItem(key, value);
        const idx = await readIndex();
        if (!idx.includes(key)) await base.setItem(indexKey, JSON.stringify([...idx, key]));
      }),
    removeItem: (key: string): Promise<void> =>
      inOrder(async () => {
        await base.removeItem(key);
        const idx = await readIndex();
        if (idx.includes(key)) {
          const next = idx.filter((k) => k !== key);
          if (next.length) await base.setItem(indexKey, JSON.stringify(next));
          else await base.removeItem(indexKey);
        }
      }),
    // 목록의 열쇠 + 목록이 생기기 전부터 있던 고정 열쇠(extraKeys)를 모두 지우고 목록도 지운다
    clearAll: (extraKeys: readonly string[] = []): Promise<void> =>
      inOrder(async () => {
        const idx = await readIndex();
        for (const k of new Set([...idx, ...extraKeys])) await base.removeItem(k);
        await base.removeItem(indexKey);
      }),
  };
}

// 줄 세우기가 저장소 인스턴스마다 따로라서, 용도별로 인스턴스를 나눈다.
export const authStorage = chunkedStorage(secureStore); // Supabase 세션(lib/supabase.ts)
export const appStateStorage = withKeyIndex(chunkedStorage(secureStore), 'device.keys.appState'); // 설문 임시 저장 · 가입 진행 · 만남 장면 본 표시(store/ · features/surveyV2 · surveyChat · chat/meetSeen) — 새로 깐 기기에서 비울 수 있게 열쇠 목록을 함께 둔다(3부-카 ⑤)
export const securityStorage = chunkedStorage(secureStore); // 보안 설정: 상대 화면 캡처 차단(store/securityStore.ts, 팀장 결정 10-15 ⑥)
export const avoidStorage = withKeyIndex(chunkedStorage(secureStore), 'device.keys.avoid'); // 12-5 피할 회사 · 학교 이름 원문(lib/avoidLocal, 보안 T126 · 3부-바) — 열쇠 목록을 함께 둔다(3부-카 ⑤)
export const if2Storage = chunkedStorage(secureStore); // IF2-F 기내 서비스 · 연애 기능 나만 쓰는 글 9종(features/inflight/deviceNotes, 정책 PF-10 · 보안 IC-12)

// 새로 깐 기기(설치 표식 없음)에서 키체인에 남은 설문 임시 저장 · 피할 회사 · 학교 원문을 비운다(lib/supabase.purgeStaleSessionOnFreshInstall 이 부름 · 3부-카 ⑤ · 보안 IC3-20).
//  목록이 생기기 전에 쓴 고정 열쇠 둘(가입 진행 'gyeoljeongsa.signup' = store/signupStore SIGNUP_STORE_KEY · 만남 장면 'chat.meetScene.v1' = chat/meetSeen MEET_SEEN_KEY — 시험이 같은 글자인지 대조)도 함께 지운다.
//  한쪽이 실패해도 던지지 않고 다음으로 간다(저장소를 못 쓰는 환경)
export const APP_STATE_FIXED_KEYS = ['gyeoljeongsa.signup', 'chat.meetScene.v1'] as const;
export async function forgetStaleDeviceStorage(): Promise<void> {
  try {
    await appStateStorage.clearAll(APP_STATE_FIXED_KEYS);
  } catch {
    // 지우지 못해도 앱은 계속 켜진다
  }
  try {
    await avoidStorage.clearAll();
  } catch {
    // 위와 같다
  }
  await forgetStaleIf5Storage(); // IF5-F1: 내 시각 · 곳도 새로 깐 기기에서는 비운다
}

// IF5-F1 사주 마당: 내가 고른 태어난 시각 · 곳(지점 id)만 기기에 둔다(서버 저장 0 · 보안 IC5-55 (a)안). 열쇠 목록을 함께 둬 새로 깐 기기(iOS 키체인 잔존)에서 비운다(withKeyIndex 꼴 — 3부-카 ⑤ 지킴).
//  열쇠 이름에는 생일 · 상대 · 사주 · 마일리지 낱말을 쓰지 않는다(check_sec2 IF5-aa) — 값은 features/saju/deviceInput.ts 가 정한 짧은 이름
export const if5Storage = withKeyIndex(chunkedStorage(secureStore), 'device.keys.if5');
export async function forgetStaleIf5Storage(): Promise<void> {
  try {
    await if5Storage.clearAll();
  } catch {
    // 지우지 못해도 앱은 계속 켜진다
  }
}
