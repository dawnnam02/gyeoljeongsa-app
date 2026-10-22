// [2] 만남 뒤 한 줄 피드백의 규칙(순수 함수). 원본: 기획/K12_v4기능명세.md 2-2(규칙 2-03 · 2-09 · 2-12 · 2-13) · backend/S12_변경기록.md 4-3.
//  · 답은 말 3단계뿐: 만났나(3) → 만났으면 어땠나(3) → 기대와 달랐으면 달랐던 점(최대 3개). 숫자 값 · 별 모양 평가는 없다
//  · '프로필과 달랐어요' · '불편했어요'를 고르면 신고 안내를 보이지만 자동 신고는 아니다(사용자가 [신고하기]를 눌러야 한다)
//  · 답한 뒤 48시간 안에 1번 고칠 수 있다(서버가 최종 판단: can_edit · editable_until · edit_window_closed)
import { V4W01 } from '@/content/v4Wave01Copy';
import { REASON_NAMES } from '@/features/recs/recsLogic';
import { MISMATCH_CODES, MISMATCH_MAX, MISMATCH_REPORTABLE, type MeetAnswer, type MeetPrompt, type MetValue, type OutcomeValue } from '@/lib/meetFeedbackApi';

export const MET_OPTIONS: readonly { value: MetValue; label: string }[] = [
  { value: 'met', label: V4W01.meet.met },
  { value: 'not_yet', label: V4W01.meet.notYet },
  { value: 'declined', label: V4W01.meet.declined },
];
export const OUTCOME_OPTIONS: readonly { value: OutcomeValue; label: string }[] = [
  { value: 'good', label: V4W01.meet.good },
  { value: 'ok', label: V4W01.meet.ok },
  { value: 'off', label: V4W01.meet.off },
];

// 칩 이름: 맞는 점 19개는 정책 2-4 이름 그대로, 나머지 둘은 글 키
export function mismatchLabel(code: string): string {
  if (code === 'profile_diff') return V4W01.meet.profileDiff;
  if (code === 'uncomfortable') return V4W01.meet.uncomfortable;
  return REASON_NAMES[code] ?? code;
}

// 칩 누르기: 고른 것이면 빼고, 아니면 3개 미만일 때만 더한다(4번째는 무시)
export function toggleMismatch(list: readonly string[], code: string): string[] {
  if (list.includes(code)) return list.filter((c) => c !== code);
  if (list.length >= MISMATCH_MAX || !MISMATCH_CODES.includes(code)) return [...list];
  return [...list, code];
}

export const needsReportHint = (list: readonly string[]): boolean => list.some((c) => (MISMATCH_REPORTABLE as readonly string[]).includes(c));

// 화면에서 고른 값 → 보낼 답. 만나지 않았으면 어땠나 · 달랐던 점은 버리고, 기대와 달랐을 때만 달랐던 점을 남긴다
export function answerFrom(met: MetValue, outcome: OutcomeValue | null, mismatch: readonly string[]): MeetAnswer {
  if (met !== 'met') return { met, outcome: null, mismatch: [] };
  return { met, outcome, mismatch: outcome === 'off' ? [...mismatch] : [] };
}

// 답한 뒤 줄에 [고치기]를 보이나: 서버가 고칠 수 있다고 했고(can_edit) 48시간이 아직 안 지났을 때
export function canEditNow(prompt: MeetPrompt, now: number): boolean {
  if (prompt.kind !== 'answered' || !prompt.canEdit) return false;
  return prompt.editableUntil === null || now < prompt.editableUntil;
}
