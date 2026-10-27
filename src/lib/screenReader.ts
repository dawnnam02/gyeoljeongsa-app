// 기기의 화면 읽기(iOS VoiceOver · Android TalkBack)가 켜져 있는지 읽는다(lib/reduceMotion 과 같은 틀 — 앱 전체에서 구독 하나).
//  쓰는 곳: 만남 장면(T4S) — 켜져 있으면 저절로 넘기지 않고 [대화방으로 가기] 버튼 하나(정책 P4-25 · 화면 T4S '화면 읽기')
//  웹은 알 수 없어(브라우저가 알려 주지 않음) 꺼진 것으로 본다
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

let on = false;
let started = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (value === on) return;
  on = value;
  listeners.forEach((notify) => notify());
}

function start(): void {
  if (started) return;
  started = true;
  // react-native-web 의 isScreenReaderEnabled 는 늘 참을 준다(SurveyChatScreen 메모와 같음) — 웹에서는 읽지 않고 꺼진 것으로 둔다
  if (Platform.OS === 'web') return;
  AccessibilityInfo.isScreenReaderEnabled()
    .then(set)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('screenReaderChanged', set);
}

// 시험에서 값을 바꾸려고 밖으로 낸다. 앱 코드는 useScreenReader 만 쓴다
export const screenReaderStore = {
  get: () => on,
  set,
  subscribe(onChange: () => void): () => void {
    start();
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  },
};

export function useScreenReader(): boolean {
  return useSyncExternalStore(screenReaderStore.subscribe, screenReaderStore.get, () => false);
}
