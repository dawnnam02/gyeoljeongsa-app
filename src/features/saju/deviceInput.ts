// 내 태어난 시각 · 곳(지점 id) — 이 휴대폰에만(IF5-F1 ① · 설계안 M-5 · S-4 · 보안 IC5-55 (a)안).
//  · 서버에는 계산 요청 인자로만 보낸다(저장 0). 항목별 저장 동의 칸을 켠 칸만 기기 저장소(lib/secureStorage if5Storage — 네이티브 SecureStore 조각 저장 · 열쇠 목록 withKeyIndex · 이 기기 전용)에 두고,
//    켜지 않은 칸은 이 앱을 켜 둔 동안 메모리에만 둔다(저장하지 않으면 올 때마다 다시 넣는다). 웹은 메모리(브라우저 저장소 0)
//  · 열쇠 이름에 생일 · 상대 · 사주 · 마일리지 낱말 0(check_sec2 IF5-aa). 로그 0 · 접근성 라벨 0
//  · 지움: 로그아웃 · 탈퇴(forgetSajuDevice) · 새로 깐 기기(secureStorage.forgetStaleIf5Storage) · 시트의 '지우기'(저장 칸을 끔)
//  · 상대 생일은 여기에 오지 않는다(저장 0 — partnerLocal.ts)
import { useEffect, useSyncExternalStore } from 'react';

import { forgetIf5Consent } from '@/features/consent/if5Consent';

import { forgetAiResults } from './ai/aiResults';

export const INPUT_KEYS = { time: 'my.time.v1', place: 'my.spot.v1', answered: 'my.asked.v1' } as const;

export type TimeValue = { hour: number; minute: number };
export type DeviceInput = {
  time: TimeValue | null;
  place: string | null; // 대표 지점 id(이름) — 자유 글 0
  saveTime: boolean; // 시각을 이 휴대폰에 저장해 두는가(항목별 동의 · 미리 체크 0)
  savePlace: boolean;
  answered: boolean; // [저장하고 보기]를 한 번 눌렀다(다시 묻지 않음)
};
export const EMPTY_INPUT: DeviceInput = { time: null, place: null, saveTime: false, savePlace: false, answered: false };

export type InputStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
export const memoryInputStorage = (): InputStorage => {
  const m = new Map<string, string>();
  return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };
};

export type InputStore = {
  get: () => DeviceInput;
  ready: () => boolean;
  subscribe: (listener: () => void) => () => void;
  load: () => Promise<void>;
  save: (next: { time: TimeValue | null; place: string | null; saveTime: boolean; savePlace: boolean }) => Promise<void>;
  clearAll: () => Promise<void>;
};

const parse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};
const isTime = (v: unknown): v is TimeValue =>
  typeof v === 'object' && v !== null && Number.isInteger((v as TimeValue).hour) && Number.isInteger((v as TimeValue).minute) && (v as TimeValue).hour >= 0 && (v as TimeValue).hour <= 23 && (v as TimeValue).minute >= 0 && (v as TimeValue).minute <= 59;

export function createInputStore(storage: InputStorage = memoryInputStorage(), placeIds: readonly string[] = []): InputStore {
  let snap: DeviceInput = { ...EMPTY_INPUT };
  let loaded = false;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => snap,
    ready: () => loaded,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load() {
      if (loaded) return Promise.resolve();
      if (!loading) {
        loading = Promise.all([storage.getItem(INPUT_KEYS.time).catch(() => null), storage.getItem(INPUT_KEYS.place).catch(() => null), storage.getItem(INPUT_KEYS.answered).catch(() => null)]).then(([t, p, a]) => {
          const time = parse(t);
          const place = parse(p);
          // 읽은 값이 모양이 틀리면 버린다(목록에 없는 지점 id 도 버림)
          const okPlace = typeof place === 'string' && (placeIds.length === 0 || placeIds.includes(place)) ? place : null;
          // 이미 사용자가 이 세션에서 넣은 값이 있으면 저장본으로 덮지 않는다
          snap = {
            time: snap.time ?? (isTime(time) ? time : null),
            place: snap.place ?? okPlace,
            saveTime: snap.saveTime || isTime(time),
            savePlace: snap.savePlace || okPlace !== null,
            answered: snap.answered || a === '1',
          };
          loaded = true;
          emit();
        });
      }
      return loading;
    },
    async save(next) {
      snap = { ...next, answered: true };
      loaded = true;
      emit();
      const ops: Promise<void>[] = [];
      ops.push(next.saveTime && next.time ? storage.setItem(INPUT_KEYS.time, JSON.stringify(next.time)) : storage.removeItem(INPUT_KEYS.time));
      ops.push(next.savePlace && next.place ? storage.setItem(INPUT_KEYS.place, JSON.stringify(next.place)) : storage.removeItem(INPUT_KEYS.place));
      ops.push(storage.setItem(INPUT_KEYS.answered, '1'));
      await Promise.all(ops.map((p) => p.catch(() => undefined)));
    },
    async clearAll() {
      snap = { ...EMPTY_INPUT };
      loaded = true;
      emit();
      await Promise.all(Object.values(INPUT_KEYS).map((k) => storage.removeItem(k).catch(() => undefined)));
    },
  };
}

// 앱 기본 저장: 처음 쓸 때 만든다(시험이 기기 모듈 없이 이 파일을 읽을 수 있게 — deviceNotes 와 같은 방식)
let app: InputStore | null = null;
export function inputStore(): InputStore {
  if (!app) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { if5Storage } = require('@/lib/secureStorage') as typeof import('@/lib/secureStorage');
    const { BIRTH_PLACES } = require('@/saju5/saju_calc5') as typeof import('@/saju5/saju_calc5');
    /* eslint-enable @typescript-eslint/no-require-imports */
    app = createInputStore(if5Storage, Object.keys(BIRTH_PLACES));
  }
  return app;
}
export function setInputStoreForTest(store: InputStore | null): void {
  app = store;
}

// 로그아웃 · 탈퇴 — 같은 기기를 다른 계정이 쓸 때 남지 않게
export async function forgetSajuDevice(): Promise<void> {
  try {
    await inputStore().clearAll();
  } catch {
    // 기기 저장소를 못 쓰는 환경(시험 등)
  }
  // IF5-F2: 이 기기에 둔 동의 기록(③ ④ ⑤ · CK17D · CK19 · CK20)과 AI 풀이 저장본도 함께 지운다(IFF5-31)
  await forgetIf5Consent();
  await forgetAiResults();
}

export function useInputStore(store?: InputStore): DeviceInput {
  const s = store ?? inputStore();
  useEffect(() => {
    void s.load();
  }, [s]);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

/** 서버 요청 인자 꼴(시각 · 곳) — 요청에만 싣고 저장 0 */
export const requestInputOf = (d: DeviceInput): { hour: number | null; minute: number | null; place: string | null } => ({ hour: d.time?.hour ?? null, minute: d.time?.minute ?? null, place: d.place });
