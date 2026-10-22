// AI 정리(06) · 내 성향(07)이 다루는 값의 모양. 원본: ai/스키마.json(traits · tags · summary · evidence) · backend/스키마.md ai_results.
// 이 앱의 어떤 타입에도 내부 평가값이나 등급 필드는 없다. 5축 값은 0~100의 '성향 위치'일 뿐이다.

export const TRAIT_KEYS = ['extraversion', 'planning', 'family', 'economy', 'conflict'] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];
export type Traits = Readonly<Record<TraitKey, number>>;

// 화면에 보이는 세 가지(AI 원본 result 의 일부 · 사용자 수정본 user_edited 와 같은 모양). tags 는 '#' 없이 담는다.
export type TraitsView = { readonly traits: Traits; readonly tags: readonly string[]; readonly summary: string };

// 근거 문항 ID(E01~E13 · T01~T03) 목록, 5축마다
export type Evidence = Readonly<Record<TraitKey, readonly string[]>>;

export type AiStatus = 'pending' | 'ok' | 'failed';

// ai_results 한 줄 중 앱이 읽는 열
export type AiRow = {
  readonly id: string;
  readonly status: AiStatus;
  readonly source: 'ai' | 'manual';
  readonly retryCount: number; // 이 건에서 [다시 시도]한 횟수 0~3
  readonly createdAt: string | null;
  readonly confirmedAt: string | null;
  readonly original: (TraitsView & { readonly evidence: Evidence | null }) | null; // result 열(AI 원본, 읽기만)
  readonly edited: TraitsView | null; // user_edited 열(사용자 수정본)
};

// 직접 입력(수동) 모드에 서버가 주는 것(실패 응답의 manual)
export type ManualOffer = { readonly initialTraits: Traits; readonly tagCandidates: readonly string[] };

// 실패 상태에 필요한 것: 실패 단계(1~4)와 그에 따른 버튼
export type FailureInfo = {
  readonly stage: number;
  readonly retriesLeft: number;
  readonly showRetry: boolean;
  readonly showManual: boolean;
  readonly manual: ManualOffer | null;
};
