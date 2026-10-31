// 사주 마당 동의 기록(IF5-F2 ⑪ · 법무 동의문구 4-17 새 칸 ③ ④ ⑤ · 4-18 CK17D · 4-19 CK19 · 4-20 CK20).
//  · 기록은 이 기기에만(lib/secureStorage if5Storage — 네이티브 SecureStore · 열쇠 목록 withKeyIndex · 웹은 메모리). 서버 동의 표에는 이 코드가 아직 없다(백엔드 넘김).
//    판 값 = config/laterConsent IF5_CONSENT_VERSIONS — 글 판이 바뀌면 이전 기록은 없는 것으로 본다(다시 받음)
//  · 항목은 따로따로: ③ 태어난 시각 · ④ 태어난 곳 · ⑤ 성별(대운) — CK17A(①)를 꺼 두면 셋 다 꺼진다. 미리 체크 0
//  · CK17D(AI 풀이 보내기) → CK19(자유 입력 이야기 · 건강 · 성생활은 따로) 순서. CK19 의 ②(건강 · 성생활)는 ①이 있어야만 의미가 있다. CK20 은 확인형(다른 분 정보 넣을 때)
//  · 열쇠 이름에 생일 · 상대 · 사주 · 마일리지 낱말 0(check_sec2 IF5-aa). 로그 0. 지움: 로그아웃 · 탈퇴 · 새로 깐 기기 · 동의 관리의 거두기
import { useEffect, useSyncExternalStore } from 'react';

import { IF5_CONSENT_VERSIONS } from '@/config/laterConsent';

export const IF5_CONSENT_KEYS = { items: 'ck.items.v1', d: 'ck.d.v1', t: 'ck.t.v1', c20: 'ck.c20.v1' } as const;

export type Ck17Items = { time: boolean; place: boolean; gender: boolean };
export type Stamp = { version: string; at: string };
export type If5ConsentState = {
  items: Ck17Items;
  d: Stamp | null; // CK17D
  t: (Stamp & { health: boolean }) | null; // CK19(health = ② 건강 · 성생활도 읽어도 된다)
  c20: Stamp | null; // CK20 안내 확인
};
export const NO_ITEMS: Ck17Items = { time: false, place: false, gender: false };
export const EMPTY_CONSENT: If5ConsentState = { items: NO_ITEMS, d: null, t: null, c20: null };

export type ConsentStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
export const memoryConsentStorage = (): ConsentStorage => {
  const m = new Map<string, string>();
  return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };
};

export type If5ConsentStore = {
  get: () => If5ConsentState;
  ready: () => boolean;
  subscribe: (l: () => void) => () => void;
  load: () => Promise<void>;
  setItems: (items: Ck17Items, now?: Date) => Promise<void>;
  agreeD: (now?: Date) => Promise<void>;
  agreeT: (health: boolean, now?: Date) => Promise<void>;
  agreeC20: (now?: Date) => Promise<void>;
  revoke: (which: 'd' | 't' | 'c20' | 'items') => Promise<void>;
  clearAll: () => Promise<void>;
};

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const stampOf = (raw: string | null, version: string): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isRec(v) && v.version === version && typeof v.at === 'string' ? v : null; // 판이 다르면 없는 것으로(다시 받음)
  } catch {
    return null;
  }
};

export function createIf5ConsentStore(storage: ConsentStorage = memoryConsentStorage()): If5ConsentStore {
  let snap: If5ConsentState = EMPTY_CONSENT;
  let loaded = false;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const put = (next: If5ConsentState) => {
    snap = next;
    loaded = true;
    listeners.forEach((l) => l());
  };
  const write = (key: string, value: unknown) => storage.setItem(key, JSON.stringify(value)).catch(() => undefined);
  const stamp = (version: string, now: Date): Stamp => ({ version, at: now.toISOString() });
  return {
    get: () => snap,
    ready: () => loaded,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    load() {
      if (loaded) return Promise.resolve();
      loading ??= Promise.all(Object.values(IF5_CONSENT_KEYS).map((k) => storage.getItem(k).catch(() => null))).then(([items, d, t, c20]) => {
        let it: Ck17Items = NO_ITEMS;
        try {
          const v: unknown = items ? JSON.parse(items) : null;
          if (isRec(v) && v.version === 'consent-2026.10.31-v1') it = { time: v.time === true, place: v.place === true, gender: v.gender === true };
        } catch {
          it = NO_ITEMS;
        }
        const ds = stampOf(d, IF5_CONSENT_VERSIONS.CK17D);
        const ts = stampOf(t, IF5_CONSENT_VERSIONS.CK19);
        const cs = stampOf(c20, IF5_CONSENT_VERSIONS.CK20);
        // 이미 이 세션에서 받은 동의가 있으면 저장본으로 덮지 않는다
        put({
          items: snap.items.time || snap.items.place || snap.items.gender ? snap.items : it,
          d: snap.d ?? (ds ? { version: String(ds.version), at: String(ds.at) } : null),
          t: snap.t ?? (ts ? { version: String(ts.version), at: String(ts.at), health: ts.health === true } : null),
          c20: snap.c20 ?? (cs ? { version: String(cs.version), at: String(cs.at) } : null),
        });
      });
      return loading;
    },
    async setItems(items, now = new Date()) {
      put({ ...snap, items });
      if (!items.time && !items.place && !items.gender) await storage.removeItem(IF5_CONSENT_KEYS.items).catch(() => undefined);
      else await write(IF5_CONSENT_KEYS.items, { version: 'consent-2026.10.31-v1', ...items, at: now.toISOString() });
    },
    async agreeD(now = new Date()) {
      const s = stamp(IF5_CONSENT_VERSIONS.CK17D, now);
      put({ ...snap, d: s });
      await write(IF5_CONSENT_KEYS.d, s);
    },
    async agreeT(health, now = new Date()) {
      const s = { ...stamp(IF5_CONSENT_VERSIONS.CK19, now), health };
      put({ ...snap, t: s });
      await write(IF5_CONSENT_KEYS.t, s);
    },
    async agreeC20(now = new Date()) {
      const s = stamp(IF5_CONSENT_VERSIONS.CK20, now);
      put({ ...snap, c20: s });
      await write(IF5_CONSENT_KEYS.c20, s);
    },
    async revoke(which) {
      if (which === 'items') {
        put({ ...snap, items: NO_ITEMS });
        await storage.removeItem(IF5_CONSENT_KEYS.items).catch(() => undefined);
        return;
      }
      put({ ...snap, [which]: null });
      await storage.removeItem(IF5_CONSENT_KEYS[which]).catch(() => undefined);
    },
    async clearAll() {
      put(EMPTY_CONSENT);
      await Promise.all(Object.values(IF5_CONSENT_KEYS).map((k) => storage.removeItem(k).catch(() => undefined)));
    },
  };
}

let app: If5ConsentStore | null = null;
export function if5Consent(): If5ConsentStore {
  if (!app) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { if5Storage } = require('@/lib/secureStorage') as typeof import('@/lib/secureStorage');
    app = createIf5ConsentStore(if5Storage);
  }
  return app;
}
export function setIf5ConsentForTest(store: If5ConsentStore | null): void {
  app = store;
}
export function forgetIf5Consent(): Promise<void> {
  try {
    return if5Consent().clearAll();
  } catch {
    return Promise.resolve(); // 기기 저장소를 못 쓰는 환경(시험 등)
  }
}

export function useIf5Consent(store?: If5ConsentStore): If5ConsentState {
  const s = store ?? if5Consent();
  useEffect(() => {
    void s.load();
  }, [s]);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}
