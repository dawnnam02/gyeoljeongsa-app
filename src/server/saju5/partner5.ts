// IF5-A2 · 상대 생일 → AI 로 가는 사실을 '간지 없는 2단계'로 고정한다(minimize_partner 2단계).
// 근거: 계산명세5.md 6장 — 간지 포함이면 상대 생일 후보 17,311일이 모두 하루로 정해지고, 2단계는 중앙값 175일 · 하루로 정해짐 0%.
// 상대 값(생년월일 · 시각)은 기기 안에서만 계산한다. 이 파일은 계산 결과를 AI 로 넘기기 직전의 마지막 문이다.
//   compat_facts_for_ai(a, b)  = 단계 2 로만 만든다(단계를 고르는 인자가 없다)
//   guardCompatFacts(facts)    = 서버(또는 앱)가 받은 사실이 정확히 단계 2 모양인지 본다 — 간지 · 기둥 · 오행 개수 · 십성 목록이 상대 쪽에 끼면 거절
//   compatMessages(facts)      = 문을 통과한 사실만 업체 요청 메시지로 바꾼다

import type { ApiMessage } from '../ait/types.ts';
import { oneShotMessages } from './request5.ts';
import { ELEMENTS, facts_compat, STEMS, BRANCHES } from '../../saju5/saju_calc5.ts';
import type { Chart, Rec } from '../../saju5/saju_calc5.ts';

export const PARTNER_LEVEL5 = 2 as const;
const TOP_KEYS = new Set(['kind', 'a', 'b', 'day_master', 'day_branch', 'elements', 'partial', 'tags', 'partner_minimal', 'partner_level']);
const TAG_RE = /^(day_stem_|day_branch_|a_fills_|b_fills_)[a-z_가-힣]{1,24}$/;
const DM_KEYS = ['a_to_b_sipsung', 'b_to_a_sipsung', 'a_element', 'b_element', 'relation_for_a', 'stem_relations'];
const SIPSUNG = new Set(['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인']);
const GANJI = new Set<string>();
for (let i = 0; i < 60; i++) GANJI.add(STEMS[i % 10] + BRANCHES[i % 12]);   // 실제 60갑자만(정인 같은 십성 이름은 갑자 짝이 아니다)
const MAX_CHARS = 7000;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const sameKeys = (o: Rec, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every((k) => k in o);
const elList = (v: unknown): boolean => Array.isArray(v) && v.every((x) => (ELEMENTS as readonly string[]).includes(x));
const relList = (v: unknown): boolean => Array.isArray(v) && v.every((r) => isRec(r) && sameKeys(r, r.code === undefined ? ['label', 'element'] : ['code', 'label', 'element']));

/** 상대 값이 들어간 궁합 사실 — 단계는 2 하나뿐이다. */
export function compat_facts_for_ai(a: Chart, b: Chart): Rec {
  return facts_compat(a, b, PARTNER_LEVEL5);
}

/** 정확히 단계 2 모양인가. 아니면 이유 코드를 돌려준다(상대 값을 지키는 문). */
export function guardCompatFacts(facts: unknown): { ok: true } | { ok: false; why: string } {
  const no = (why: string): { ok: false; why: string } => ({ ok: false, why });
  if (!isRec(facts)) return no('not_object');
  if (facts.kind !== 'compat') return no('kind');
  if (facts.partner_minimal !== true || facts.partner_level !== PARTNER_LEVEL5) return no('partner_level_not_2');
  if (Object.keys(facts).some((k) => !TOP_KEYS.has(k))) return no('extra_top_key');
  const b = facts.b;
  if (!isRec(b) || !sameKeys(b, ['hour_known', 'day_master']) || typeof b.hour_known !== 'boolean') return no('partner_shape');
  const bdm = b.day_master;
  if (!isRec(bdm) || !sameKeys(bdm, ['element', 'polarity']) || !(ELEMENTS as readonly string[]).includes(bdm.element) || !['양', '음'].includes(bdm.polarity)) return no('partner_day_master');
  const dm = facts.day_master;
  if (!isRec(dm) || !sameKeys(dm, DM_KEYS) || !SIPSUNG.has(dm.a_to_b_sipsung) || !SIPSUNG.has(dm.b_to_a_sipsung) || !relList(dm.stem_relations)) return no('day_master_shape');
  if (!relList(facts.day_branch)) return no('day_branch_shape');
  const el = facts.elements;
  if (!isRec(el) || !sameKeys(el, ['a_gets_from_b', 'b_gets_from_a']) || !elList(el.a_gets_from_b) || !elList(el.b_gets_from_a)) return no('elements_shape');
  if (typeof facts.partial !== 'boolean') return no('partial');
  if (!Array.isArray(facts.tags) || !facts.tags.every((t) => typeof t === 'string' && TAG_RE.test(t))) return no('tags');
  if (!isRec(facts.a)) return no('a_missing');
  // 상대 쪽(a 를 뺀 나머지)에는 간지 두 글자 · 한자가 어디에도 없어야 한다
  const { a: _a, ...rest } = facts;
  void _a;
  const text = JSON.stringify(rest);
  if (/[㐀-鿿]/.test(text)) return no('hanja');
  for (const m of text.matchAll(/"([^"]*)"/g)) if (GANJI.has(m[1])) return no('ganji_in_partner_side');
  if (/"(pillars|ganji|sipsung|sinsal|combos|two_possibilities|cross|triad_together|year_branch|birth|input|year|month|day|hour)"\s*:/.test(text)) return no('forbidden_key');
  if (JSON.stringify(facts).length > MAX_CHARS) return no('too_long');
  return { ok: true };
}

/** 문을 통과한 사실만 업체 요청 메시지로. 통과하지 못하면 던진다(업체 호출 전에 막힘). */
export function compatMessages(facts: unknown): ApiMessage[] {
  const g = guardCompatFacts(facts);
  if (!g.ok) throw new Error('partner_facts_not_minimal:' + g.why);
  return oneShotMessages(facts);
}
