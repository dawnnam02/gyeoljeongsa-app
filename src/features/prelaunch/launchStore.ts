// 사전 오픈 상태(get_launch_state) 한 곳 저장소 — 09 · 11 · 16 탭이 나눠 쓴다(같은 때 여러 탭이 불러도 요청은 하나).
//  · 화면이 읽는 것은 한 덩이(snapshot): load · seenOpen(이번 실행에서 '열림'을 받은 적이 있나 — 인터넷이 잠깐 끊겨도 오늘의 추천을 대기 화면으로 바꾸지 않게) ·
//    deferSeen(이 기기에서 본 미룸 횟수 — 미룸 공지를 한 번만). 바뀔 때마다 새 덩이라 화면이 낡은 값을 쥐지 않는다
//  · 미룸 본 횟수: 네이티브는 기기 저장(AsyncStorage, prelaunchServices 가 넘김), 웹 · 시험은 메모리만(웹 저장소에 쓰지 않는다 — 보안/구성.md)
//  · 시각 타이머 · 카운트다운 0. 다시 읽는 때는 화면이 정한다(탭 포커스 · 앱이 앞으로 올 때 · 잇기 뒤 · 데모 장면)
import { useSyncExternalStore } from 'react';

import type { LaunchApi, LaunchLoad } from './launchApi';
import { isOpen } from './launchLogic';

// linkedHere: 이 실행에서 잇기에 성공했거나 서버가 '이미 이은 계정'이라 했다 — 서버 응답에 이은 여부 키가 없을 때(S18 지금) 할 일 ④를 숨기는 데 쓴다
export type LaunchSnapshot = { load: LaunchLoad | null; seenOpen: boolean; deferSeen: number; linkedHere: boolean };
export type LaunchStore = {
  get: () => LaunchSnapshot;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<LaunchLoad>;
  markDeferSeen: (count: number) => void;
  markLinked: () => void;
};
export type DeferMemory = { read: () => Promise<number | null>; write: (n: number) => Promise<void> };
export const memoryOnly: DeferMemory = { read: async () => null, write: async () => undefined };

export function createLaunchStore(api: Pick<LaunchApi, 'load'>, memory: DeferMemory = memoryOnly): LaunchStore {
  let snap: LaunchSnapshot = { load: null, seenOpen: false, deferSeen: 0, linkedHere: false };
  let inflight: Promise<LaunchLoad> | null = null;
  let seenLoaded = false;
  const listeners = new Set<() => void>();
  const set = (next: Partial<LaunchSnapshot>) => {
    snap = { ...snap, ...next };
    listeners.forEach((l) => l());
  };
  return {
    get: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      if (inflight) return inflight;
      inflight = (async () => {
        let deferSeen = snap.deferSeen;
        if (!seenLoaded) {
          seenLoaded = true;
          deferSeen = Math.max(deferSeen, (await memory.read().catch(() => null)) ?? 0);
        }
        const load = await api.load().catch((): LaunchLoad => ({ ok: false, reason: 'network' }));
        if (load.ok && load.state.deferredCount < deferSeen) deferSeen = load.state.deferredCount; // 출시일을 다시 정해 0 이 되면 다음 미룸에 다시 보인다
        inflight = null;
        set({ load, seenOpen: snap.seenOpen || (load.ok && isOpen(load.state)), deferSeen });
        return load;
      })();
      return inflight;
    },
    markDeferSeen(count) {
      const deferSeen = Math.max(snap.deferSeen, count);
      void memory.write(deferSeen).catch(() => undefined);
      set({ deferSeen });
    },
    markLinked() {
      if (!snap.linkedHere) set({ linkedHere: true });
    },
  };
}

// 저장소를 화면에서 읽는다
export function useLaunch(store: LaunchStore): LaunchSnapshot {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
