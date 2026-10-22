// 기기의 '동작 줄이기' 설정(iOS 동작 줄이기 · Android 애니메이션 제거 · 웹 prefers-reduced-motion)을 읽는다.
// 설정을 읽는 구독은 앱 전체에서 하나만 두고, 누르는 컴포넌트마다 이 값을 나눠 쓴다.
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

let reduced = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (value === reduced) return;
  reduced = value;
  listeners.forEach((notify) => notify());
}

// 처음 쓰일 때 한 번만 기기 설정을 읽고, 바뀌면 따라간다.
function start(): void {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then(set)
    .catch(() => undefined); // 읽지 못하면 동작을 줄이지 않는 쪽으로 둔다
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

// 시험에서 값을 바꾸려고 밖으로 낸다. 앱 코드는 useReduceMotion 만 쓴다.
export const reduceMotionStore = {
  get: () => reduced,
  set,
  subscribe(onChange: () => void): () => void {
    start();
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
};

export function useReduceMotion(): boolean {
  return useSyncExternalStore(reduceMotionStore.subscribe, reduceMotionStore.get, () => false);
}
