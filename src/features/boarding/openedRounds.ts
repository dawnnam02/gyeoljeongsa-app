// 공개를 열어 본 회차(D42-M · D-178): 도착 화면은 한 회차에 한 번만. 열어 본 회차는 탑승권 탭 · /reveal 에서 바로 상대 화면.
//  · 서버에 '열어 봄' 키가 없어 이 기기에 둔다: 네이티브는 기기 저장(AsyncStorage, boardingServices 가 넘김), 웹 · 시험은 메모리만(웹 저장소에 쓰지 않는다 — 보안/구성.md)
//  · 화면은 useOpenedRounds 로 한 덩이(snapshot)를 읽는다. 처음 읽기 전(ready=false)에는 도착 화면도 상대 화면도 그리지 않는다(깜빡임 0)
import { useEffect, useSyncExternalStore } from 'react';

export type OpenedSnapshot = { ready: boolean; rounds: readonly number[] };
export type OpenedMemory = { read: () => Promise<number[] | null>; write: (rounds: number[]) => Promise<void> };
export type OpenedRounds = {
  get: () => OpenedSnapshot;
  subscribe: (listener: () => void) => () => void;
  load: () => Promise<void>;
  mark: (round: number) => void;
  forget: (round: number) => void;
};

export const openedMemoryOnly: OpenedMemory = { read: async () => null, write: async () => undefined };
const KEEP = 20; // 최근 회차만 기억한다

export function createOpenedRounds(memory: OpenedMemory = openedMemoryOnly): OpenedRounds {
  let snap: OpenedSnapshot = { ready: false, rounds: [] };
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const set = (rounds: readonly number[], ready = true) => {
    snap = { ready, rounds };
    listeners.forEach((l) => l());
  };
  const save = (rounds: readonly number[]) => void memory.write([...rounds]).catch(() => undefined);
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
          .then((saved) => set([...new Set([...(saved ?? []), ...snap.rounds])].slice(-KEEP)));
      }
      return loading;
    },
    mark(round) {
      if (snap.rounds.includes(round)) return;
      const rounds = [...snap.rounds, round].slice(-KEEP);
      set(rounds, snap.ready);
      save(rounds);
    },
    forget(round) {
      if (!snap.rounds.includes(round)) return;
      const rounds = snap.rounds.filter((r) => r !== round);
      set(rounds, snap.ready);
      save(rounds);
    },
  };
}

// 시험 · 서비스 없이 그린 화면이 같이 쓰는 기본 저장소(메모리만)
export const defaultOpenedRounds = createOpenedRounds();

export function useOpenedRounds(store: OpenedRounds): OpenedSnapshot {
  useEffect(() => {
    void store.load();
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
