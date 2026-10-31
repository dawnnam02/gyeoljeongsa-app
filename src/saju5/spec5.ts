// IF5-A · 사주 확장 AI 기능 8개의 출력 모양(한 곳) — 출력 JSON 틀(schemas/*.json)과 검사기가 모두 여기서 나온다.
// 의존성 0. 같은 ai/AIT/ts 모듈을 읽어 쓴다(고치지 않음).

import type { ModelId } from '../server/ait/types.ts';

export type Feature5 = 'reading' | 'compat' | 'daewoon' | 'sinyeon' | 'wolun' | 'daily' | 'taekil' | 'chat' | 'summary';
export const FEATURES5: readonly Feature5[] = ['reading', 'compat', 'daewoon', 'sinyeon', 'wolun', 'daily', 'taekil', 'chat', 'summary'];
/** 사용자에게 보이는 기능 8개(요약은 내부) */
export const USER_FEATURES5: readonly Feature5[] = ['reading', 'compat', 'daewoon', 'sinyeon', 'wolun', 'daily', 'taekil', 'chat'];

export type FieldSpec =
  | { t: 'label'; min: number; max: number }                                            // 제목 · 이름표 한 줄(문장 끝 요 불필요 · 마침표 없음)
  | { t: 'text'; minS: number; maxS: number; max: number; empty?: boolean; question?: boolean }   // 해요체 문장 minS ~ maxS 개, 글자 max 이하
  | { t: 'list'; min: number; max: number; of: FieldSpec }
  | { t: 'obj'; fields: Record<string, FieldSpec> }
  | { t: 'enums'; values: readonly string[]; max: number };                               // 고정 낱말 목록

const label = (min: number, max: number): FieldSpec => ({ t: 'label', min, max });
const text = (minS: number, maxS: number, max: number, extra: { empty?: boolean; question?: boolean } = {}): FieldSpec => ({ t: 'text', minS, maxS, max, ...extra });
const list = (min: number, max: number, of: FieldSpec): FieldSpec => ({ t: 'list', min, max, of });
const obj = (fields: Record<string, FieldSpec>): FieldSpec => ({ t: 'obj', fields });

export const CHAT_FLAGS = ['crisis', 'medical', 'legal', 'invest', 'minor', 'off_topic'] as const;

export const SPEC5: Readonly<Record<Feature5, FieldSpec>> = {
  reading: obj({
    headline: label(6, 30),
    sections: list(4, 5, obj({ title: label(2, 14), body: text(2, 4, 230) })),
    closing: text(1, 2, 110),
  }),
  compat: obj({
    headline: label(6, 30),
    summary: text(1, 2, 130),
    sections: list(3, 4, obj({ title: label(2, 14), body: text(2, 3, 210) })),
    tips: list(2, 3, text(1, 1, 95)),
  }),
  daewoon: obj({
    overview: text(2, 3, 210),
    periods: list(3, 4, obj({ ganji: label(2, 2), ages: label(3, 16), theme: label(2, 16), body: text(2, 3, 190) })),
    now: text(1, 2, 130),
  }),
  sinyeon: obj({
    headline: label(6, 30),
    flow: text(2, 3, 210),
    months: list(12, 12, obj({ month: label(2, 10), body: text(1, 2, 100) })),
    keep: text(1, 1, 95),
  }),
  wolun: obj({
    headline: label(6, 30),
    body: text(2, 3, 230),
    do: list(2, 3, text(1, 1, 85)),
    ease: list(1, 2, text(1, 1, 85)),
  }),
  daily: obj({
    headline: label(6, 26),
    body: text(2, 3, 210),
    small_step: text(1, 1, 85),
  }),
  taekil: obj({
    intro: text(1, 2, 130),
    picks: list(1, 5, obj({ date: label(10, 10), why: text(1, 2, 110) })),
    rest: text(0, 2, 110, { empty: true }),
    tip: text(1, 1, 95),
  }),
  chat: obj({
    reply: text(2, 6, 520),
    ask: text(0, 1, 95, { empty: true, question: true }),
    flags: { t: 'enums', values: CHAT_FLAGS, max: 3 },
  }),
  summary: obj({
    summary: text(3, 14, 1300),
  }),
};

// ---------------------------------------------------------------- 모델 · 깊이 · max_tokens (요청당 상한은 유지)
export interface Plan5 { model: ModelId; effort: 'low' | 'medium' | 'high'; maxTokens: number; cache: boolean }
/** 기능별 추천: 글이 길고 말투가 민감한 것 · 대화는 Sonnet 5.5, 짧고 틀이 정해진 것은 Haiku 5.5. 품질은 실호출 1회 평가 뒤 확정(미확인). */
/** maxTokens = 칸 최대 글자 × 1.4(높음 시나리오) + 틀 + 생각(low) 700 이 들어가는 값 — 모자라 잘리면 그 답은 버려지고 돈만 든다 */
export const PLAN5: Readonly<Record<Feature5, Plan5>> = {
  reading: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 3600, cache: false },
  compat: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 3600, cache: false },
  daewoon: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 3600, cache: false },
  sinyeon: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 4600, cache: false },
  wolun: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 2000, cache: false },
  daily: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 1400, cache: false },
  taekil: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 2600, cache: false },
  chat: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 2200, cache: true },
  summary: { model: 'claude-haiku-5-5', effort: 'low', maxTokens: 1800, cache: false },
};

// ---------------------------------------------------------------- 출력 JSON 틀(구조화 출력용): 모양에서 만든다. minItems · maxLength 같은 제약은 틀에 넣지 않고 검사기가 본다.
export function schemaOf(spec: FieldSpec): Record<string, unknown> {
  switch (spec.t) {
    case 'label':
    case 'text': return { type: 'string' };
    case 'list': return { type: 'array', items: schemaOf(spec.of) };
    case 'enums': return { type: 'array', items: { type: 'string', enum: [...spec.values] } };
    case 'obj': return {
      type: 'object', additionalProperties: false, required: Object.keys(spec.fields),
      properties: Object.fromEntries(Object.entries(spec.fields).map(([k, v]) => [k, schemaOf(v)])),
    };
  }
}
