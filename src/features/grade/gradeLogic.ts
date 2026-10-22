// 내 등급 화면(16-G1 ~ G4)의 규칙(순수 함수). 원본: 수익/상점_화면.md 7-3 ~ 7-6 · 마케팅/카피.md 16-E ~ 16-H · backend/스키마.md 11-2 get_my_grade.
//  · 앱은 서버가 준 값만 그린다(R5): 등급을 계산 · 정렬 · 거르지 않는다. 서버가 주는 항목은 상위 3개(top)와 올릴 수 있는 항목(actionable)이다
//  · 막대 '조건 / 인증 / 답변 성실도'(NV86)는 서버가 준 areas{cond, verify, sincere}(S8d)를 그대로 쓴다. 앱이 더하거나 나누지 않는다
//  · 총 원점수는 받지도 보이지도 않는다(NV74)
import { GRADE16 } from '@/content/shopCopy';
import type { GradeAreaKey, GradeAreas, GradeItemKey, GradePoint } from '@/lib/gradeApi';

export const AREA_ORDER: readonly GradeAreaKey[] = ['cond', 'verify', 'sincere'];
export const AREA_NAMES: Readonly<Record<GradeAreaKey, string>> = { cond: GRADE16.bars[0], verify: GRADE16.bars[1], sincere: GRADE16.bars[2] };

// 점수 글: 0.95 이상이면 정수, 그 밑이면 소수 한 자리(0.6점이 '0점'으로 읽히지 않게. 0.96이 '1.0'으로 갈리지 않게 — Q5A-13)
export function ptsText(n: number): string {
  return n >= 0.95 ? String(Math.round(n)) : n.toFixed(1);
}

export type AreaBar = { area: GradeAreaKey; name: string; pts: number | null };
// 막대 세 줄: 서버가 준 영역별 점수(S8d areas)를 그대로 쓴다. 세 값을 더하지 않는다(합 비공개, NV86). 서버가 안 주면 이름만(숫자 없음)
export function areaBars(areas: GradeAreas | null): AreaBar[] {
  return AREA_ORDER.map((area) => ({ area, name: AREA_NAMES[area], pts: areas ? areas[area] : null }));
}

// 막대 길이(0~1): 가장 큰 영역을 1 로 놓는다. 숫자가 없는 영역은 0
export function barRatio(pts: number | null, max: number): number {
  if (pts === null || max <= 0) return 0;
  return Math.max(0.02, Math.min(1, pts / max));
}

// 올리는 방법 3줄(NV77): 서류 인증하기 · 프로필 선택 항목 채우기 · 앱에 접속하기. 서버가 올릴 여지가 있다고 준 항목만(최대 3줄), 서류 인증 3종은 한 줄로 합친다
export type UpTask = { key: 'verify' | 'ans' | 'act'; text: string; upTo: number };
const TASK_OF: Partial<Record<GradeItemKey, UpTask['key']>> = { v_sch: 'verify', v_job: 'verify', v_ast: 'verify', ans: 'ans', act: 'act' };
const TASK_TEXT: Readonly<Record<UpTask['key'], string>> = { verify: GRADE16.upTasks[0], ans: GRADE16.upTasks[1], act: GRADE16.upTasks[2] };

export function upTasks(actionable: readonly GradePoint[]): UpTask[] {
  const out: UpTask[] = [];
  for (const p of actionable) {
    const key = TASK_OF[p.item];
    if (!key) continue;
    const found = out.find((t) => t.key === key);
    if (found) found.upTo += p.pts;
    else out.push({ key, text: TASK_TEXT[key], upTo: p.pts });
  }
  return out.slice(0, 3);
}

// 16-G3 체크 상태: 올릴 여지가 아직 있으면(actionable 에 있으면) 아직, 없으면 끝(서버 값으로 자동)
export type GoalTask = { key: UpTask['key']; text: string; done: boolean; doneText: string };
export function goalTasks(actionable: readonly GradePoint[]): GoalTask[] {
  const open = new Set(upTasks(actionable).map((t) => t.key));
  const keys: UpTask['key'][] = ['verify', 'ans', 'act'];
  return keys.map((key, i) => ({ key, text: TASK_TEXT[key], done: !open.has(key), doneText: GRADE16.goalStates[i] }));
}

// 목표 후보: 지금보다 숫자가 작은 등급(위 단계) 전부. 1등급이면 없다
export function goalChoices(gradeNo: number): number[] {
  return Array.from({ length: Math.max(0, gradeNo - 1) }, (_, i) => gradeNo - 1 - i);
}

// 변화 기록 한 줄에 쓰는 이유 글. 모르는 이유 코드는 이유를 붙이지 않는다
export function reasonText(code: string): string | null {
  return (GRADE16.reasons as Readonly<Record<string, string>>)[code] ?? null;
}
