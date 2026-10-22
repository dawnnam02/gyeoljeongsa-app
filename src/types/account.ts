// 서버가 알려 주는 계정의 '진행 단계'(K2 2-3 표). 앱은 이 표대로 화면을 고른다.
// 서버 쪽 이름과 값은 S1 · S2 가 정한다(미정). 정해지면 이 목록을 그에 맞춘다.
export const PROGRESS_STAGES = [
  'email-verified', // 이메일 인증만 끝나고 생년월일 없음 → 02(생년월일 칸이 바로 열림)
  'birthdate-passed', // 생년월일 통과 · 동의 전 → 03
  'consent-changed', // 동의 문구가 바뀜(항목 · 목적 · 보유 기간 · 받는 자) → 03(바뀐 칸만)
  'consented', // 동의 끝 · 필수 문항 중 빈 곳 있음 → 04 첫 미응답 쪽
  'survey-complete', // 필수 문항 모두 답함 · 사진 3장 미등록 → 05
  'ai-processing', // 설문 제출됨 · AI 정리 중 → 06(진행)
  'ai-failed', // AI 정리 실패 → 06(오류)
  'traits-pending', // 정리 끝 · 성향 미확정 → 07
  'traits-confirmed', // 성향 확정 → 09
  'blocked', // 정지 · 차단된 계정 → 로그인 불가 안내(문구 · 기준은 K3 · L2)
  'withdrawn', // 탈퇴한 이메일 → 새 이메일과 같게 02부터
] as const;

export type ProgressStage = (typeof PROGRESS_STAGES)[number];
