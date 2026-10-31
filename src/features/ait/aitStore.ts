// AI 시험판 접근 코드 · 시험자 동의 기록의 기기 보관(AIT-F ⑤ · 보안 AC-19 · ATF-03 ~ 05 · 법무 16-4 #2).
//  · 웹: 메모리만 — 새로 고치거나 창을 닫으면 사라진다(본인 결정 D-7). localStorage · sessionStorage · IndexedDB · 쿠키에 쓰지 않는다
//  · 네이티브: SecureStore(이 기기 전용 · 잠금 푼 동안만 읽힘, lib/secureStorage 의 secureStore)
//  · 코드 값은 화면 · 로그 · 읽기 이름 · 테스트 ID 어디에도 내지 않는다. 있는지(참/거짓)만 알린다
import { useSyncExternalStore } from 'react';

import { secureStore } from '@/lib/secureStorage';

import { AIT_CODE_MAX } from './aitConfig';

export const AIT_CODE_KEY = 'ait.code';
export const AIT_CONSENT_KEY = 'ait.consent';
/** 시험자 동의 판 이름(글이 바뀌면 올린다). v2 = 시트 글을 법무 13-3 문안(받는 업체 이름 · 더 오래 남을 수 있음 · 거부 효과)으로 바꿈 — v1 로 받은 동의는 다시 받는다 */
export const AIT_CONSENT_VERSION = 'ait-2026.10.31-v2';

export type AitConsent = { version: string; at: string };
type State = { loaded: boolean; code: string | null; consent: AitConsent | null };

let state: State = { loaded: false, code: null, consent: null };
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

/** 입력 정리: 앞뒤 공백 · 속 공백 제거, 소문자, 길이 상한. 형식이 맞는지는 보지 않는다(서버가 본다 — 틀림 · 없음을 구분해 알리지 않음) */
export function cleanCode(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase().slice(0, AIT_CODE_MAX);
}

function parseConsent(raw: string | null): AitConsent | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === 'object' && v !== null && typeof (v as AitConsent).version === 'string' && typeof (v as AitConsent).at === 'string') return { version: (v as AitConsent).version, at: (v as AitConsent).at };
  } catch {
    // 깨진 기록은 없는 것으로 본다
  }
  return null;
}

export const aitStore = {
  get: (): State => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  /** 기기에서 한 번 읽는다(웹은 메모리라 비어 있다). 실패해도 비어 있는 것으로 시작한다 */
  async load(): Promise<void> {
    if (state.loaded) return;
    let code: string | null = null;
    let consent: AitConsent | null = null;
    try {
      code = (await secureStore.get(AIT_CODE_KEY)) || null;
      consent = parseConsent(await secureStore.get(AIT_CONSENT_KEY));
    } catch {
      // 저장소를 못 읽으면 코드 없음으로 시작(데모 글)
    }
    set({ loaded: true, code, consent });
  },
  async setCode(raw: string): Promise<boolean> {
    const code = cleanCode(raw);
    if (!code) return false;
    set({ ...state, code });
    try {
      await secureStore.set(AIT_CODE_KEY, code);
    } catch {
      // 기기에 못 써도 이번 실행 동안은 메모리 값으로 쓴다
    }
    return true;
  },
  async clearCode(): Promise<void> {
    set({ ...state, code: null });
    try {
      await secureStore.del(AIT_CODE_KEY);
    } catch {
      // 지우기 실패는 메모리에서 이미 지웠다
    }
  },
  async setConsent(now: Date = new Date()): Promise<void> {
    const consent: AitConsent = { version: AIT_CONSENT_VERSION, at: now.toISOString() };
    set({ ...state, consent });
    try {
      await secureStore.set(AIT_CONSENT_KEY, JSON.stringify(consent));
    } catch {
      // 못 써도 이번 실행 동안은 동의한 것으로 본다
    }
  },
  /** 로그아웃 · 탈퇴 · 코드 지우기: 코드와 동의 기록을 모두 비운다 */
  async forget(): Promise<void> {
    set({ loaded: true, code: null, consent: null });
    try {
      await secureStore.del(AIT_CODE_KEY);
      await secureStore.del(AIT_CONSENT_KEY);
    } catch {
      // 메모리는 이미 비었다
    }
  },
  /** 시험용: 상태를 처음으로 되돌린다 */
  reset(): void {
    state = { loaded: false, code: null, consent: null };
    listeners.forEach((l) => l());
  },
};

export function useAitState(): State {
  return useSyncExternalStore(aitStore.subscribe, aitStore.get, aitStore.get);
}

/** 동의가 이 판으로 기록돼 있나 */
export const hasConsent = (s: State): boolean => s.consent?.version === AIT_CONSENT_VERSION;
