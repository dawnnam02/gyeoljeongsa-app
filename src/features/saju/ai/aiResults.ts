// AI 맞춤 풀이 저장본 · 사주 이야기 이력(IF5-F2 ⑩ · 설계안 S-11 · 법무 4-18 4-19 '이야기는 내 기기에 있어요').
//  · 결과는 이 기기에만(lib/secureStorage if5Storage — 네이티브 SecureStore 조각 저장 · 열쇠 목록 withKeyIndex · 이 기기 전용 · 웹은 메모리). 서버 저장 0 · 로그 0
//  · 저장하는 것: 내 사주 풀이 · 대운 · 올해(같은 결과를 다시 열면 무료 · 다시 뽑기 0) + 사주 이야기(말풍선 · 서버가 서명한 이력 묶음). 상대 생일이 든 맞춰 보기 결과 · 날짜 설명은 저장하지 않는다(상대 값 저장 0)
//  · 열쇠 이름에 생일 · 상대 · 사주 · 마일리지 낱말 0(check_sec2 IF5-aa). 지움: 로그아웃 · 탈퇴(forgetSajuDevice) · 새로 깐 기기 · [새로 시작]
import type { InputStorage } from '../deviceInput';

export const AI_RESULT_FEATURES = ['reading', 'daewoon', 'sinyeon', 'full'] as const;
export type AiResultFeature = (typeof AI_RESULT_FEATURES)[number];
const KEY = (f: AiResultFeature): string => `fx.${f}.v1`;
export const TALK_KEY = 'fx.talk.v1';

export type StoredResult = { at: string; display: unknown };

const memory = (): InputStorage => {
  const m = new Map<string, string>();
  return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };
};

export type AiResults = {
  get: (f: AiResultFeature) => Promise<StoredResult | null>;
  put: (f: AiResultFeature, display: unknown, now?: Date) => Promise<void>;
  getTalk: () => Promise<unknown>;
  putTalk: (v: unknown) => Promise<void>;
  clearTalk: () => Promise<void>;
  clearAll: () => Promise<void>;
};

export function createAiResults(storage: InputStorage = memory()): AiResults {
  const read = async (key: string): Promise<unknown> => {
    try {
      const raw = await storage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  };
  return {
    async get(f) {
      const v = await read(KEY(f));
      return typeof v === 'object' && v !== null && typeof (v as StoredResult).at === 'string' && 'display' in v ? (v as StoredResult) : null;
    },
    async put(f, display, now = new Date()) {
      await storage.setItem(KEY(f), JSON.stringify({ at: now.toISOString(), display })).catch(() => undefined);
    },
    getTalk: () => read(TALK_KEY),
    async putTalk(v) {
      await storage.setItem(TALK_KEY, JSON.stringify(v)).catch(() => undefined);
    },
    async clearTalk() {
      await storage.removeItem(TALK_KEY).catch(() => undefined);
    },
    async clearAll() {
      await Promise.all([...AI_RESULT_FEATURES.map((f) => KEY(f)), TALK_KEY].map((k) => storage.removeItem(k).catch(() => undefined)));
    },
  };
}

let app: AiResults | null = null;
export function aiResults(): AiResults {
  if (!app) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { if5Storage } = require('@/lib/secureStorage') as typeof import('@/lib/secureStorage');
    app = createAiResults(if5Storage);
  }
  return app;
}
export function setAiResultsForTest(store: AiResults | null): void {
  app = store;
}
export function forgetAiResults(): Promise<void> {
  try {
    return aiResults().clearAll();
  } catch {
    return Promise.resolve(); // 기기 저장소를 못 쓰는 환경(시험 등)
  }
}
