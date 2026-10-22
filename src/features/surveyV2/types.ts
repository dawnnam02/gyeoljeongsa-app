// 설문 v2(F20) 공용 타입. 값 모양은 기획/설문_v2.md 2-5 표 · backend/스키마.md 4장(답 JSON)을 따른다.

export type SectionKey = 'basic' | 'edu' | 'job' | 'money' | 'family' | 'life' | 'values' | 'marriage' | 'wish' | 'story' | 'appeal';
// 형식 7종(설문_v2 0장)을 화면 부품 단위로 나눈 것
export type Format =
  | 'choice' // 하나 고르기 · 목록
  | 'region' // 하나 고르기 · 지역 2단
  | 'school' // 검색 · 자동완성 선택
  | 'multi' // 여러 개 고르기 · 칩
  | 'bucket' // 구간 · 금액
  | 'scale5' // 슬라이더 · 5단계
  | 'number' // 슬라이더 · 숫자 하나(키)
  | 'range' // 슬라이더 · 양끝(F01 나이 차 · F02 키)
  | 'rankAll' // 순위 · 전부(E13)
  | 'rankTop' // 순위 · 상위 3개(F13)
  | 'line' // 짧은 글 · 한 줄
  | 'para' // 짧은 글 · 여러 줄
  | 'story' // 짧은 글 · 질문 카드(결혼 이야기)
  | 'appeal'; // 짧은 글 · 어필 카드(세부사항)
export type Vis = 'private' | 'bucket' | 'public';

export type QuestionDef = {
  readonly id: string;
  readonly section: SectionKey;
  readonly format: Format;
  readonly codes: readonly string[]; // 보기 코드(CSV 순서). 'decline' = 말하고 싶지 않아요(값 null)
  readonly required: boolean;
  readonly vis: Vis;
  readonly toggle: string | null; // visibility_settings 열 이름(정책 2-3 · K18)
  readonly decline: boolean;
  readonly min?: number; // 글자 수 · 숫자 범위
  readonly max?: number;
};

// 서버에 저장하는 값(설문_v2 2-5). null = 말하고 싶지 않아요(답했지만 값 없음)
export type SchoolValue = { readonly school_key: string };
export type RegionValue = { readonly sido: string; readonly sigungu: string };
export type AgeGapValue = { readonly younger?: number; readonly older?: number };
export type HeightRangeValue = { readonly min?: number; readonly max?: number };
export type V2Value = string | number | null | readonly string[] | SchoolValue | RegionValue | AgeGapValue | HeightRangeValue;
export type V2Answers = Readonly<Record<string, V2Value>>;

export type ProofState = 'none' | 'pending' | 'ok' | 'retry';
