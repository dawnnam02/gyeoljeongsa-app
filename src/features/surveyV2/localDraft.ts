// 설문 v2 로컬 저장(이어서 하기 · 설문_인수조건 C-1~C-5). 서버에 아직 못 보낸 답(pending)과 마지막 자리를 기기에 둔다.
//  · 저장소는 민감한 값 저장소(appStateStorage — SecureStore 조각 저장, 웹은 메모리)만 받는다. 열쇠는 사용자마다 따로
//  · 다시 열면 서버 답 위에 pending 답을 얹고, 자리(stage · at)를 이어 간다. 서버에 저장되면 pending 에서 뺀다
//  · 값이 깨졌거나 판(v)이 다르면 없는 것으로 본다(서버 답만으로 이어 간다)
import type { Draft } from './model';

export type Stage = 'intro' | 'flow' | 'politics' | 'story' | 'appeal' | 'review'; // politics: W8 정치성향 단계
export type LocalDraft = {
  readonly v: 1;
  readonly drafts: Readonly<Record<string, Draft>>; // pending 문항의 입력 중 값
  readonly pending: readonly string[];
  readonly publicOn: Readonly<Record<string, boolean>>;
  readonly stage: Stage;
  readonly at: string | null; // 마지막으로 본 문항 ID
  readonly seen: readonly ('story' | 'appeal')[]; // 지나간 선택 단계
  readonly updatedAt: number;
};

type KeyValue = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export type LocalDraftStore = {
  load(userKey: string): Promise<LocalDraft | null>;
  save(userKey: string, value: LocalDraft): Promise<void>;
  clear(userKey: string): Promise<void>;
};

// SecureStore 열쇠는 영문 · 숫자 · . - _ 만 된다
export const draftKey = (userKey: string) => `survey_v2.${userKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const STAGES: readonly Stage[] = ['intro', 'flow', 'politics', 'story', 'appeal', 'review'];

export function parseLocalDraft(text: string | null): LocalDraft | null {
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.drafts) || !Array.isArray(raw.pending)) return null;
    return {
      v: 1,
      drafts: raw.drafts as Record<string, Draft>,
      pending: raw.pending.filter((x): x is string => typeof x === 'string'),
      publicOn: isRecord(raw.publicOn) ? (Object.fromEntries(Object.entries(raw.publicOn).filter(([, b]) => typeof b === 'boolean')) as Record<string, boolean>) : {},
      stage: STAGES.includes(raw.stage as Stage) ? (raw.stage as Stage) : 'flow',
      at: typeof raw.at === 'string' ? raw.at : null,
      seen: Array.isArray(raw.seen) ? raw.seen.filter((x): x is 'story' | 'appeal' => x === 'story' || x === 'appeal') : [],
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function createLocalDraftStore(kv: KeyValue): LocalDraftStore {
  return {
    async load(userKey) {
      try {
        return parseLocalDraft(await kv.getItem(draftKey(userKey)));
      } catch {
        return null; // 기기 저장소를 못 읽어도 서버 답으로 이어 간다
      }
    },
    async save(userKey, value) {
      try {
        await kv.setItem(draftKey(userKey), JSON.stringify(value));
      } catch {
        // 기기에 못 써도 막지 않는다(서버 저장이 원본)
      }
    },
    async clear(userKey) {
      try {
        await kv.removeItem(draftKey(userKey));
      } catch {
        // 지우지 못해도 다음 저장이 덮어쓴다
      }
    },
  };
}
