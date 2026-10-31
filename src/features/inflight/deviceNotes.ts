// 나만 쓰고 나만 보는 글 · 표시 9종 — 이 휴대폰에만(정책 PF-10 · 보안 IC-12 · S-2 · IFF-02 · IFF-03).
//  ① 아직 모르는 분께 엽서 ② 미리 답해 둔 답 ③ 꼭 나눌 이야기 표시 ④ 첫 만남 준비 표시 ⑤ 돌아보기 메모 ⑥ 내 여행 타입 고른 짐
//  ⑦ 안전 안내 카드 본 방 ⑧ 같은 취미 띠 닫음 ⑨ 홈 접힘 줄 펼침
//  · 저장은 민감한 값 저장소(lib/secureStorage if2Storage — 네이티브 SecureStore 조각 저장 · 이 기기 전용 · OS 백업에 옮겨지지 않음, 웹은 메모리)
//    브라우저 저장소 · 서버 · 분석 · 오류 기록 0. 시험은 메모리만
//  · 지움: 로그아웃 · 탈퇴(forgetInflightNotes) · 엽서 · 미리 답은 회차 끝 · 표시 · 메모는 방이 닫힌 날 + 30일(purge — 홈 상태를 읽을 때)
//    스위치를 껐다고 바로 지우지 않는다(PF-93 — 다시 켤 때 그 회차 안이면 이어 씀)
//  · 상대 이름 · 연락처 칸 0. 글은 기기 안 상태로만 쓰고 로그에 남기지 않는다
import { useEffect, useSyncExternalStore } from 'react';

export const NOTE_KEYS = {
  postcard: 'if2.postcard.v1',
  preAnswers: 'if2.preAnswers.v1',
  mustTalk: 'if2.mustTalk.v1',
  meetPrep: 'if2.meetPrep.v1',
  memos: 'if2.memos.v1',
  typeBag: 'if2.typeBag.v1',
  wordSafety: 'if2.wordSafety.v1',
  hobbyNotice: 'if2.hobbyNotice.v1',
  homeFold: 'if2.homeFold.v1',
} as const;
export type NoteKind = keyof typeof NOTE_KEYS;

export type Postcard = { round: number; line: number; extra: string; at: number };
export type PreAnswer = { q: string; text: string; at: number };
export type Memo = { room: string; texts: string[]; at: number; closedAt: number | null; skyDay?: string | null }; // skyDay = G-06 만난 날(yyyy-mm-dd · IF5-F1b) — 메모와 같은 기기 보관 · 방이 닫힌 날 + 30일에 같이 지워짐
export type Notes = {
  postcard: Postcard | null;
  preAnswers: { round: number; items: PreAnswer[] } | null;
  mustTalk: Record<string, number[]>; // 방 → 표시한 주제 차례
  meetPrep: Record<string, string[]>; // 방 → 챙겼어요 줄 키
  memos: Record<string, Memo>; // 방 → 메모
  typeBag: string[]; // 고른 짐(그림 이름만)
  wordSafety: string[]; // 안전 안내 카드를 본 방(최근 20)
  hobbyNotice: boolean; // 같은 취미 띠를 닫았나
  homeFold: boolean; // 접힘 줄을 펼쳐 두었나
};
export const EMPTY_NOTES: Notes = { postcard: null, preAnswers: null, mustTalk: {}, meetPrep: {}, memos: {}, typeBag: [], wordSafety: [], hobbyNotice: false, homeFold: false };

export const PRE_ANSWER_MAX = 10; // 답은 10개까지(PF-36)
export const PRE_ANSWER_LEN = 200;
export const POSTCARD_EXTRA_LEN = 60; // 더할 한 줄(PF-37)
export const MEMO_LEN = 100; // 칸마다(PF-72)
export const KEEP_AFTER_CLOSE_DAYS = 30;
const DAY = 86_400_000;

export type NoteStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
export const memoryNoteStorage = (): NoteStorage => {
  const m = new Map<string, string>();
  return { getItem: async (k) => m.get(k) ?? null, setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };
};

export type DeviceNotes = {
  get: () => Notes;
  ready: () => boolean;
  subscribe: (listener: () => void) => () => void;
  load: () => Promise<void>;
  set: <K extends NoteKind>(kind: K, value: Notes[K]) => void;
  clearAll: () => Promise<void>;
  // 회차 끝 · 방 닫힘 + 30일 지움(홈 상태를 읽을 때 부른다)
  purge: (ctx: PurgeContext) => void;
};

export type PurgeContext = {
  now: number;
  inflightRound: number | null; // 지금 탄 회차(비행 중 · 착륙 준비 · 겹침)
  openRoom: string | null; // 지금 열린 방(짝 있음 · 겹침)
  openRoomRound: number | null; // 그 방이 열린 회차
  reflectOk: boolean; // 서버: 닫힌 방 + 30일 안이 있나
};

const parse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// 읽은 값이 모양이 틀리면 버린다
function shape<K extends NoteKind>(kind: K, v: unknown): Notes[K] {
  const empty = EMPTY_NOTES[kind];
  switch (kind) {
    case 'postcard':
      return (isRecord(v) && typeof v.round === 'number' && typeof v.line === 'number' && typeof v.extra === 'string' ? { round: v.round, line: v.line, extra: v.extra.slice(0, POSTCARD_EXTRA_LEN), at: Number(v.at) || 0 } : null) as Notes[K];
    case 'preAnswers':
      return (isRecord(v) && typeof v.round === 'number' && Array.isArray(v.items)
        ? { round: v.round, items: v.items.filter((x): x is PreAnswer => isRecord(x) && typeof x.q === 'string' && typeof x.text === 'string').slice(0, PRE_ANSWER_MAX) }
        : null) as Notes[K];
    case 'typeBag':
    case 'wordSafety':
      return (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : empty) as Notes[K];
    case 'hobbyNotice':
    case 'homeFold':
      return (v === true) as Notes[K];
    default:
      return (isRecord(v) ? v : empty) as Notes[K];
  }
}

export function createDeviceNotes(storage: NoteStorage = memoryNoteStorage()): DeviceNotes {
  let snap: Notes = { ...EMPTY_NOTES };
  let loaded = false;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const save = (kind: NoteKind, value: unknown) => {
    const empty = value === null || value === false || (Array.isArray(value) && value.length === 0) || (isRecord(value) && Object.keys(value).length === 0);
    void (empty ? storage.removeItem(NOTE_KEYS[kind]) : storage.setItem(NOTE_KEYS[kind], JSON.stringify(value))).catch(() => undefined);
  };
  const api: DeviceNotes = {
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
        loading = Promise.all(
          (Object.keys(NOTE_KEYS) as NoteKind[]).map(async (k) => {
            const raw = await storage.getItem(NOTE_KEYS[k]).catch(() => null);
            return [k, shape(k, parse(raw))] as const;
          }),
        ).then((pairs) => {
          snap = { ...snap, ...Object.fromEntries(pairs) };
          loaded = true;
          emit();
        });
      }
      return loading;
    },
    set(kind, value) {
      snap = { ...snap, [kind]: value };
      save(kind, value);
      emit();
    },
    async clearAll() {
      snap = { ...EMPTY_NOTES };
      loaded = true;
      emit();
      await Promise.all(Object.values(NOTE_KEYS).map((k) => storage.removeItem(k).catch(() => undefined)));
    },
    purge(ctx) {
      const keepRound = (r: number) => r === ctx.inflightRound || r === ctx.openRoomRound;
      if (snap.postcard && !keepRound(snap.postcard.round)) api.set('postcard', null);
      if (snap.preAnswers && !keepRound(snap.preAnswers.round)) api.set('preAnswers', null);
      // 방에 붙은 표시 · 메모: 열린 방이거나 닫힌 지 30일 안(서버 reflect_ok)이면 둔다. 닫힌 때를 아는 메모는 그날 + 30일
      const keepRoom = (room: string, closedAt: number | null) => room === ctx.openRoom || (ctx.reflectOk && (closedAt === null || ctx.now < closedAt + KEEP_AFTER_CLOSE_DAYS * DAY));
      const memos = Object.fromEntries(Object.entries(snap.memos).filter(([room, m]) => keepRoom(room, m.closedAt)));
      if (Object.keys(memos).length !== Object.keys(snap.memos).length) api.set('memos', memos);
      for (const kind of ['mustTalk', 'meetPrep'] as const) {
        const cur = snap[kind] as Record<string, unknown>;
        const kept = Object.fromEntries(Object.entries(cur).filter(([room]) => keepRoom(room, snap.memos[room]?.closedAt ?? null)));
        if (Object.keys(kept).length !== Object.keys(cur).length) api.set(kind, kept as Notes[typeof kind]);
      }
    },
  };
  return api;
}

// 앱 기본 저장: 처음 쓸 때 만든다(시험이 기기 모듈 없이 이 파일을 읽을 수 있게 — meetSeen 과 같은 방식)
let app: DeviceNotes | null = null;
export function deviceNotes(): DeviceNotes {
  if (!app) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { if2Storage } = require('@/lib/secureStorage') as typeof import('@/lib/secureStorage');
    app = createDeviceNotes(if2Storage);
  }
  return app;
}
// 시험: 기본 저장을 바꿔 끼운다
export function setDeviceNotesForTest(notes: DeviceNotes | null): void {
  app = notes;
}

// 로그아웃 · 탈퇴(12 설정 leaveToStart) — 같은 기기를 다른 계정이 쓸 때 남지 않게
export function forgetInflightNotes(): Promise<void> {
  try {
    return deviceNotes().clearAll();
  } catch {
    return Promise.resolve(); // 기기 저장소를 못 쓰는 환경(시험 등)
  }
}

export function useDeviceNotes(store?: DeviceNotes): Notes {
  const s = store ?? deviceNotes();
  useEffect(() => {
    void s.load();
  }, [s]);
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}
