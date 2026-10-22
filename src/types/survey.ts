// 설문 답의 모양. 문항ID 는 K1(기획/설문_문항표.csv)의 ID 그대로다(예 A02, E13, T01).
// 입력 형태 11종(K2 4장 04 '입력 검증 규칙 1')의 저장값을 한 곳에 모았다. 칸별 검증은 F2가 정한다.
// 이 앱의 어떤 타입에도 내부 평가값이나 점수 필드는 없다(청사진 Q6, K2 R2).
import type { SurveyStep } from '@/navigation/surveySteps';

export type QuestionId = string;

export type SurveyAnswer =
  | string // 선택 · 텍스트 · 날짜(YYYYMMDD)
  | number // 숫자 · 척도 · 구간 번호
  | readonly string[] // 복수 선택 · 순위(순서가 곧 순위)
  | { readonly min: number | null; readonly max: number | null } // 범위
  | { readonly sido: string; readonly sigungu: string } // 지역
  | null; // '답하지 않음'(답했지만 값 없음). 아직 안 답한 문항은 키 자체가 없다

// 설문 임시 저장분. K2 04: 입력값은 앱이 쪽마다 들고 있어 돌아와도 남는다.
// 서버 저장([다음] · [임시 저장])이 원본이고, 이것은 앱을 닫았다 열 때 쓰는 기기 안 사본이다.
export type SurveyDraft = {
  readonly answers: Readonly<Record<QuestionId, SurveyAnswer>>;
  readonly lastStep: SurveyStep | null;
  readonly updatedAt: number | null; // 마지막으로 고친 시각(ms). 기기 시계라 화면 안내용으로만 쓴다
};
