// 만남 장면을 본 방(D46 · 정책 P4-22): 방마다 처음 한 번. 서버에 '장면 봄' 열이 없어 이 기기에 둔다 — 도착 화면 '회차마다 한 번'(openedRounds, D-178)과 같은 방식.
//  · 네이티브는 기기 저장(AsyncStorage 키 chat.meetScene.v1, 본 방 id 최근 20개), 웹 · 시험은 메모리만(웹 저장소에 쓰지 않는다 — 보안/구성.md) → 웹은 새로 고침마다 다시
//  · 기록은 장면이 시작될 때 남긴다(장면 도중 앱이 꺼져도 다음엔 바로 대화방) · 로그아웃 · 탈퇴 때 지운다(다른 계정이 같은 기기를 쓸 때)
//  · 방 id 는 서버가 만든 무작위 값(0031 uuid)이라 회원 정보가 아니다. 상대에게 보이지 않고 짝 · 점수 · 등급에 쓰지 않는다(P4-27)
import { useEffect, useSyncExternalStore } from 'react';

export type MeetSeenSnapshot = { ready: boolean; ids: readonly string[] };
export type MeetSeenMemory = { read: () => Promise<string[] | null>; write: (ids: string[]) => Promise<void> };
export type MeetSeen = {
  get: () => MeetSeenSnapshot;
  subscribe: (listener: () => void) => () => void;
  load: () => Promise<void>;
  has: (id: string) => boolean | null; // null = 기록을 아직 못 읽음
  mark: (id: string) => void;
  clear: () => void;
};

export const meetMemoryOnly: MeetSeenMemory = { read: async () => null, write: async () => undefined };
export const MEET_SEEN_KEY = 'chat.meetScene.v1';
const KEEP = 20; // 한 주 한 방이라 5개월 남짓. 닫힌 방은 어차피 장면이 없다

export function createMeetSeen(memory: MeetSeenMemory = meetMemoryOnly): MeetSeen {
  let snap: MeetSeenSnapshot = { ready: false, ids: [] };
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const set = (ids: readonly string[], ready = true) => {
    snap = { ready, ids };
    listeners.forEach((l) => l());
  };
  const save = (ids: readonly string[]) => void memory.write([...ids]).catch(() => undefined);
  return {
    get: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      if (snap.ready) return Promise.resolve();
      if (!loading) {
        loading = memory
          .read()
          .catch(() => null)
          .then((saved) => set([...new Set([...(saved ?? []), ...snap.ids])].slice(-KEEP)));
      }
      return loading;
    },
    has: (id) => (snap.ready ? snap.ids.includes(id) : null),
    mark(id) {
      if (snap.ids.includes(id)) return;
      const ids = [...snap.ids, id].slice(-KEEP);
      set(ids, snap.ready);
      save(ids);
    },
    clear() {
      set([], true);
      save([]);
    },
  };
}

// 앱 기본 기록: 처음 쓸 때 만든다(시험이 기기 모듈 없이 이 파일을 읽을 수 있게 — boardingServices 와 같은 방식)
let app: MeetSeen | null = null;
export function meetSeenStore(): MeetSeen {
  if (!app) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Platform } = require('react-native') as typeof import('react-native');
    let memory: MeetSeenMemory = meetMemoryOnly;
    if (Platform.OS !== 'web') {
      const AsyncStorage = (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;
      memory = {
        read: async () => {
          const raw = await AsyncStorage.getItem(MEET_SEEN_KEY);
          const v: unknown = raw ? JSON.parse(raw) : null;
          return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80) : null;
        },
        write: async (ids) => (ids.length ? AsyncStorage.setItem(MEET_SEEN_KEY, JSON.stringify(ids)) : AsyncStorage.removeItem(MEET_SEEN_KEY)),
      };
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
    app = createMeetSeen(memory);
  }
  return app;
}

// 로그아웃 · 탈퇴(12 설정 leaveToStart) · 데모 장면 바꾸기(채팅 목록 데모 줄 = '장면 다시 보기')
export function forgetMeetScenes(): void {
  try {
    meetSeenStore().clear();
  } catch {
    // 기기 저장소를 못 쓰는 환경(시험 등) — 메모리 기록도 없다
  }
}

export function useMeetSeen(store: MeetSeen): MeetSeenSnapshot {
  useEffect(() => {
    void store.load();
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
