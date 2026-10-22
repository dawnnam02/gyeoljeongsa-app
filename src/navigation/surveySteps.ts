// 04 설문의 쪽 번호와 섹션 칩. 원본: 기획/화면_요구사항.md 3장(분할표 3-2).
// 라우트는 /survey/[step] 하나이고 [step] 값은 '04-' 뒤 두 자리(01~32)다(K2 3장 S7).
// 04-12 는 결번이다(D01 · D02 삭제, 가정 D-22 ④). 한 번 쓴 번호는 바꾸거나 다시 쓰지 않는다.

export const SURVEY_CHIPS = ['기본', '학력', '직업', '가족', '성향', '희망'] as const;
export type SurveyChip = (typeof SURVEY_CHIPS)[number];

export const SURVEY_STEPS = [
  '01', '02', '03', '04', '05', '06', // 기본 6쪽
  '07', '08', // 학력 2쪽
  '09', '10', '11', // 직업 3쪽
  '13', '14', '15', // 가족 3쪽
  '16', '17', '18', '19', '20', '21', '22', '23', '24', // 성향 9쪽(E 6 + T 3)
  '25', '26', '27', '28', '29', '30', '31', '32', // 희망 8쪽
] as const;
export type SurveyStep = (typeof SURVEY_STEPS)[number];

// 진행바 분모: 04 의 31쪽 + 05 사진(K2 3장 S8)
export const SURVEY_PROGRESS_TOTAL = SURVEY_STEPS.length + 1;

const CHIP_OF_RANGE: readonly (readonly [SurveyChip, SurveyStep, SurveyStep])[] = [
  ['기본', '01', '06'],
  ['학력', '07', '08'],
  ['직업', '09', '11'],
  ['가족', '13', '15'],
  ['성향', '16', '24'],
  ['희망', '25', '32'],
];

// '희망 조건 수정' 상태에서 다시 여는 쪽(K2 04 입력 검증 4)
export const PREFERENCE_STEPS: readonly SurveyStep[] = SURVEY_STEPS.filter((s) => s >= '25');
export const PREFERENCE_FIRST: SurveyStep = '25';
export const PREFERENCE_LAST: SurveyStep = '32';

export function isSurveyStep(value: unknown): value is SurveyStep {
  return typeof value === 'string' && (SURVEY_STEPS as readonly string[]).includes(value);
}

export function chipOf(step: SurveyStep): SurveyChip {
  for (const [chip, from, to] of CHIP_OF_RANGE) if (step >= from && step <= to) return chip;
  throw new Error(`칩 범위 밖의 쪽 ${step}`); // 결번이 아닌 쪽은 항상 칩이 있다
}

export function nextStep(step: SurveyStep): SurveyStep | null {
  const i = SURVEY_STEPS.indexOf(step);
  return SURVEY_STEPS[i + 1] ?? null; // null 이면 마지막 쪽(04-32) → 05
}

export function prevStep(step: SurveyStep): SurveyStep | null {
  const i = SURVEY_STEPS.indexOf(step);
  return i > 0 ? SURVEY_STEPS[i - 1] : null; // null 이면 04-01('<' 숨김)
}

// "{칩} · {칩 안 순번} / {칩 안 쪽 수}" (K2 3장 S8)
export function chipProgress(step: SurveyStep): { chip: SurveyChip; index: number; total: number } {
  const chip = chipOf(step);
  const inChip = SURVEY_STEPS.filter((s) => chipOf(s) === chip);
  return { chip, index: inChip.indexOf(step) + 1, total: inChip.length };
}
