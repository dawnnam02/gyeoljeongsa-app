// 07 내 성향의 수정 규칙(순수 함수). 원본: 기획/화면_요구사항.md 07 '입력 검증 규칙' · N14, ai/설계.md 3·9-3장, 서버 검사식 validate_ai_edit.
//  막대 0~100 정수(5단위) · 칩 1~5개, 한 개 2~8자(서버 검사 8자 이하, 태그 스키마 2~8자), 같은 글 중복 불가, 전화번호 · 주소 · 링크 모양 불가
//  요약 20~200자(전화번호 · 링크 모양 불가). 직접 입력 모드는 요약을 비워도 된다.
import { TRAITS } from '@/content/copy';
import { TRAIT_KEYS, type TraitKey, type Traits, type TraitsView } from '@/types/ai';

export const TRAIT_STEP = 5;
export const TAG_MIN_LEN = 2;
export const TAG_MAX_LEN = 8;
export const TAG_MAX_COUNT = 5;
export const SUMMARY_MIN_LEN = 20;
export const SUMMARY_MAX_LEN = 200;

export const clampTrait = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));
export const snapTrait = (value: number): number => clampTrait(Math.round(value / TRAIT_STEP) * TRAIT_STEP);

export function setTrait(traits: Traits, key: TraitKey, value: number): Traits {
  return { ...traits, [key]: snapTrait(value) };
}

export const sameTraits = (a: Traits, b: Traits): boolean => TRAIT_KEYS.every((k) => a[k] === b[k]);

// 전화번호(숫자 7개 이상이 이어지거나 010 꼴) · 링크(http · www · 점 뒤 흔한 주소 끝) · 이메일(@) 모양
const CONTACT = /(\d[\s.-]?){7,}|https?:|www\.|@|\.(com|net|kr|io|me|co)\b/i;
export const looksLikeContact = (text: string): boolean => CONTACT.test(text);

export type TagCheck = { ok: true; tag: string } | { ok: false; message: string };

// 칩 하나를 더할 때 검사한다. '#'은 화면이 붙이므로 사용자가 쓴 '#'은 떼고 센다.
export function checkNewTag(raw: string, existing: readonly string[]): TagCheck {
  const tag = raw.trim().replace(/^#+/, '').trim();
  if (looksLikeContact(tag)) return { ok: false, message: TRAITS.errors.contact }; // 긴 전화번호는 글자 수 오류보다 먼저 알려 준다
  if (tag.length < TAG_MIN_LEN || tag.length > TAG_MAX_LEN) return { ok: false, message: TRAITS.errors.tagLength };
  if (existing.includes(tag)) return { ok: false, message: TRAITS.errors.tagDuplicate };
  return { ok: true, tag };
}

// 요약 검사. 비어 있으면 allowEmpty(직접 입력)일 때만 통과.
export function checkSummary(raw: string, allowEmpty: boolean): { ok: true } | { ok: false; message: string } {
  const text = raw.trim();
  if (text.length === 0) return allowEmpty ? { ok: true } : { ok: false, message: TRAITS.errors.summaryShort(SUMMARY_MIN_LEN) };
  if (text.length < SUMMARY_MIN_LEN) return { ok: false, message: TRAITS.errors.summaryShort(SUMMARY_MIN_LEN) };
  if (looksLikeContact(text)) return { ok: false, message: TRAITS.errors.contact };
  return { ok: true };
}

// 요약 칸 길이 제한: 200자를 넘게 쓰지 못하게 한다
export const clipSummary = (text: string): string => text.slice(0, SUMMARY_MAX_LEN);

export function removeTag(tags: readonly string[], tag: string): string[] {
  return tags.filter((t) => t !== tag);
}

// 후보에서 고르기(직접 입력): 이미 골랐으면 빼고, 아니면 더한다(최대 5)
export function toggleCandidate(tags: readonly string[], tag: string): string[] {
  if (tags.includes(tag)) return removeTag(tags, tag);
  return tags.length >= TAG_MAX_COUNT ? [...tags] : [...tags, tag];
}

// 저장할 수정본: 서버(validate_ai_edit)가 받는 모양 그대로. 앞뒤 공백은 뗀다.
export function toEdited(view: TraitsView): TraitsView {
  return { traits: view.traits, tags: [...view.tags], summary: view.summary.trim() };
}

export const sameView = (a: TraitsView, b: TraitsView): boolean =>
  sameTraits(a.traits, b.traits) && a.summary.trim() === b.summary.trim() && a.tags.length === b.tags.length && a.tags.every((t, i) => t === b.tags[i]);

// 편집 중인 값이 저장해도 되는 값인가(칩 1개 이상 · 요약 검사). 직접 입력도 칩은 1개 이상 고르게 한다(K2 07).
export function checkDraft(view: TraitsView, opts: { manual: boolean }): { ok: true } | { ok: false; field: 'tags' | 'summary'; message: string } {
  if (view.tags.length < 1) return { ok: false, field: 'tags', message: '' };
  const summary = checkSummary(view.summary, opts.manual);
  if (!summary.ok) return { ok: false, field: 'summary', message: summary.message };
  return { ok: true };
}
