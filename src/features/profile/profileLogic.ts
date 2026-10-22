// 08 내 프로필의 규칙(순수 함수). 원본: 기획/정책.md 2-3 토글 9개(P2-03 · P2-04) · 기획/화면_요구사항.md 08 · backend/스키마.md visibility_settings.
//  · 토글 9개의 이름 · 열 · 문항 · 처음값은 여기 한 곳에 둔다(코드 곳곳에 개수를 박지 않는다 — 목록 길이에서 센다)
//  · 값이 없는 항목(비워 둔 선택 문항 · '답하지 않음')의 토글은 꺼짐 · 잠금(P2-08)
//  · 저장은 바뀐 토글의 열만 보낸다
import { PROFILE } from '@/content/copy';

export const TOGGLE_DEFS = [
  { key: 'religion', column: 'a06_religion', question: 'A06', range: false, initial: true },
  { key: 'maritalHistory', column: 'a07_marital_history', question: 'A07', range: false, initial: true },
  { key: 'children', column: 'a08_children', question: 'A08', range: false, initial: true },
  { key: 'school', column: 'b02_school', question: 'B02', range: false, initial: false },
  { key: 'employer', column: 'c02_employer', question: 'C02', range: false, initial: false },
  { key: 'income', column: 'c05_income', question: 'C05', range: true, initial: true },
  { key: 'assets', column: 'c06_assets', question: 'C06', range: true, initial: true },
  { key: 'parentEducation', column: 'd03_parent_education', question: 'D03', range: true, initial: true },
  { key: 'parentAssets', column: 'd04_parent_assets', question: 'D04', range: true, initial: true },
] as const;

export type ToggleKey = (typeof TOGGLE_DEFS)[number]['key'];
export type ToggleColumn = (typeof TOGGLE_DEFS)[number]['column'];
export type ToggleState = Readonly<Record<ToggleKey, boolean>>;
export type ToggleChanges = Partial<Record<ToggleColumn, boolean>>;

export const TOGGLE_QUESTIONS: readonly string[] = TOGGLE_DEFS.map((d) => d.question);
export const toggleLabel = (key: ToggleKey): string => PROFILE.toggles[key];

export const initialToggles = (): ToggleState => Object.fromEntries(TOGGLE_DEFS.map((d) => [d.key, d.initial])) as ToggleState;

// 답이 있는가: 비어 있거나(null · 빈 글) '답하지 않음'이면 값 없음
export function hasAnswerValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== '답하지 않음';
  if (Array.isArray(value)) return value.length > 0 && !(value.length === 1 && value[0] === '답하지 않음');
  return true;
}

// 문항 ID → 값이 있는 토글만 true. 잠긴 토글(false)은 꺼짐으로 보이고 누를 수 없다
export function availability(answers: Readonly<Record<string, unknown>>): Readonly<Record<ToggleKey, boolean>> {
  return Object.fromEntries(TOGGLE_DEFS.map((d) => [d.key, hasAnswerValue(answers[d.question])])) as Record<ToggleKey, boolean>;
}

// 화면에 보이는 값: 잠긴 토글은 항상 꺼짐
export function shownToggles(state: ToggleState, available: Readonly<Record<ToggleKey, boolean>>): ToggleState {
  return Object.fromEntries(TOGGLE_DEFS.map((d) => [d.key, available[d.key] && state[d.key]])) as ToggleState;
}

// 바뀐 토글의 열만 모은다(저장은 바뀐 것만 보낸다). 잠긴 토글은 보내지 않는다
export function diffToggles(saved: ToggleState, draft: ToggleState, available: Readonly<Record<ToggleKey, boolean>>): ToggleChanges {
  const out: ToggleChanges = {};
  for (const d of TOGGLE_DEFS) {
    if (available[d.key] && saved[d.key] !== draft[d.key]) out[d.column] = draft[d.key];
  }
  return out;
}

// 이름 → 성 1자 + OO(정책 P2-06, 본인 화면에서도 목업대로 가려서 보인다)
export const maskedName = (name: string): string => (name.trim() === '' ? '' : `${[...name.trim()][0]}OO`);

// 'YYYY-MM-DD' 생일 → 만 나이(오늘도 'YYYY-MM-DD', 한국 날짜)
export function ageOn(birthIso: string, todayIso: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthIso);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayIso);
  if (!b || !t) return null;
  const age = Number(t[1]) - Number(b[1]) - (t[2] + t[3] < b[2] + b[3] ? 1 : 0);
  return age >= 0 ? age : null;
}

export type PhotoSlot = 'face' | 'full' | 'free';
export type PhotoStatus = 'approved' | 'pending' | 'rejected' | 'none';
export type PhotoView = { readonly slot: PhotoSlot; readonly status: PhotoStatus; readonly id: string | null };

export const PHOTO_SLOTS: readonly PhotoSlot[] = ['face', 'full', 'free'];

type PhotoRow = { id: string; slot: string; status: string; submitted_at?: string | null };

// 칸마다 가장 최근 제출의 상태(교체됨은 제외)
export function photoViews(rows: readonly PhotoRow[]): PhotoView[] {
  return PHOTO_SLOTS.map((slot) => {
    const mine = rows
      .filter((r) => r.slot === slot && r.status !== 'replaced')
      .sort((a, b) => String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? '')));
    const top = mine[0];
    if (!top) return { slot, status: 'none', id: null };
    const status: PhotoStatus = top.status === 'approved' || top.status === 'pending' || top.status === 'rejected' ? top.status : 'none';
    return { slot, status, id: top.id };
  });
}

// 배지(사진): 확인 중이 하나라도 있으면 '사진 확인 중', 반려가 하나라도 있으면 '사진 다시 올리기'. 둘 다 있을 수 있다
export function photoBadges(photos: readonly PhotoView[]): { checking: boolean; retry: boolean } {
  return { checking: photos.some((p) => p.status === 'pending'), retry: photos.some((p) => p.status === 'rejected') };
}
