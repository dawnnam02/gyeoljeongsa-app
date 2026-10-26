// 대화형 설문 기기 저장(이어서 하기). 답 값은 서버(설문 v2 save_answers)가 원본이고, 여기는 대화 자리만 둔다:
//  단계 · 건너뛴 선택 문항 · 정치 '나중에' · CK16 을 물었는지 · 인터뷰 세션 번호 · 멈춘 날. 글 · 숫자 · 행동 숫자는 두지 않는다.
//  저장소는 설문 v2 와 같은 민감한 값 저장소(appStateStorage — SecureStore 조각 저장, 웹은 메모리). 열쇠는 사용자마다 따로
export type ChatStage = 'intro' | 'part1' | 'bridge' | 'part2' | 'wrap' | 'traits' | 'texts' | 'done' | 'paused';
export type LocalChat = {
  readonly v: 1;
  readonly stage: ChatStage;
  readonly skipped: readonly string[];
  readonly polLater: boolean;
  readonly ck16Asked: boolean;
  readonly sessionId: number | null;
  readonly updatedAt: number; // 멈춘 날(기기 시각, '{월}월 {일}일 · 여기서 멈췄어요')
};

type KeyValue = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
export type LocalChatStore = { load(userKey: string): Promise<LocalChat | null>; save(userKey: string, value: LocalChat): Promise<void>; clear(userKey: string): Promise<void> };

export const chatKey = (userKey: string) => `survey_chat.${userKey.replace(/[^A-Za-z0-9._-]/g, '_')}`;
const STAGES: readonly ChatStage[] = ['intro', 'part1', 'bridge', 'part2', 'wrap', 'traits', 'texts', 'done', 'paused'];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseLocalChat(text: string | null): LocalChat | null {
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.v !== 1) return null;
    return {
      v: 1,
      stage: STAGES.includes(raw.stage as ChatStage) ? (raw.stage as ChatStage) : 'part1',
      skipped: Array.isArray(raw.skipped) ? raw.skipped.filter((x): x is string => typeof x === 'string' && /^[A-F]\d\d$/.test(x)) : [],
      polLater: raw.polLater === true,
      ck16Asked: raw.ck16Asked === true,
      sessionId: typeof raw.sessionId === 'number' && Number.isInteger(raw.sessionId) && raw.sessionId > 0 ? raw.sessionId : null,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function createLocalChatStore(kv: KeyValue): LocalChatStore {
  return {
    async load(userKey) {
      try {
        return parseLocalChat(await kv.getItem(chatKey(userKey)));
      } catch {
        return null; // 못 읽어도 서버 답으로 이어 간다
      }
    },
    async save(userKey, value) {
      try {
        await kv.setItem(chatKey(userKey), JSON.stringify(value));
      } catch {
        // 기기에 못 써도 막지 않는다
      }
    },
    async clear(userKey) {
      try {
        await kv.removeItem(chatKey(userKey));
      } catch {
        // 다음 저장이 덮어쓴다
      }
    },
  };
}
