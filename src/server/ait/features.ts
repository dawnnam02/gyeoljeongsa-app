// AIT-A · 단발 기능 셋: 궁합 카드 AI판(B1) · 프로필 문장 코치(A9) · 별자리 · 사주 풀이(A2).
// 입력 허용 목록 · 가리기 · 감싸기 · 출력 검사. 업체를 부르지 않는다.

import type { ModelId } from './types.ts';
import { FEATURE_MODEL } from './types.ts';
import type { ResponseCode } from './codes.ts';
import type { FixedCard } from './fixed.ts';
import { COACH_NOTE, COMPAT_NOTE, CRISIS_CARD, FUN_FOOTER, MINOR_CARD } from './fixed.ts';
import { charLen, endsWithHaeyo, hasResidualPii, maskText, quoteInSource, sanitize, splitSentences } from './text.ts';
import { classifyHit } from './lexicon.ts';
import { COACH_RULES, RULESETS, checkText, contactHit, newDigitRuns } from './rules.ts';

export type Effort = 'low' | 'medium' | 'high';

export interface OneShotSpec {
  feature: 'compat' | 'coach' | 'horoscope';
  model: ModelId;
  effort: Effort;
  maxTokens: number;
}
export const ONE_SHOT: Readonly<Record<'compat' | 'coach' | 'horoscope', OneShotSpec>> = {
  compat: { feature: 'compat', model: FEATURE_MODEL.compat, effort: 'low', maxTokens: 1200 },
  coach: { feature: 'coach', model: FEATURE_MODEL.coach, effort: 'low', maxTokens: 2200 },
  horoscope: { feature: 'horoscope', model: FEATURE_MODEL.horoscope, effort: 'low', maxTokens: 1400 },
};
export const ONE_SHOT_LIMITS = { coachTextMax: 800, coachTextMin: 6 } as const;

export type OneShotPrep =
  | { kind: 'reject'; code: ResponseCode; why: string }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard }
  | { kind: 'call'; spec: OneShotSpec; userContent: string; input: Record<string, unknown> };

export type OneShotDone<T> =
  | { kind: 'ok'; code: 'ok'; display: T }
  | { kind: 'blocked'; code: 'blocked_output'; reasons: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function onlyKeys(o: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(o).every((k) => keys.includes(k));
}
function textOf(content: unknown[]): string {
  return content
    .filter((b): b is { type: string; text: string } => isRecord(b) && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text).join('');
}
function parseJson(resp: { stop_reason: string | null; content: unknown[] }): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (resp.stop_reason !== 'end_turn') return { ok: false, reason: 'stop:' + String(resp.stop_reason) };
  try { return { ok: true, value: JSON.parse(textOf(resp.content)) }; } catch { return { ok: false, reason: 'json' }; }
}
export interface ApiResultLike { stop_reason: string | null; content: unknown[] }

// ================================================================ 궁합 카드 AI판 (B1 · Haiku 5.5)
/** 두 사람이 모두 공개했고 값이 같은 항목의 사전. 기획 확정 전 가안 — 항목을 바꾸면 이 표 한 곳만 고친다 */
export const COMPAT_DICT: Readonly<Record<string, { label: string; values: Readonly<Record<string, string>> }>> = {
  hobby: {
    label: '취미',
    values: {
      sport: '운동이나 헬스', travel: '여행', outdoor: '캠핑이나 등산', food: '맛집과 카페', culture: '영화, 공연, 전시',
      reading: '독서나 공부', game: '게임', music: '음악이나 악기', cooking: '요리나 베이킹', pet: '반려동물',
      volunteer: '봉사 활동', home: '집에서 쉬는 시간', other: '그 밖의 취미',
    },
  },
  marriage_timing: {
    label: '결혼 시기에 대한 생각',
    values: { m6: '여섯 달 안', y1: '여섯 달에서 한 해 사이', y2: '한 해에서 두 해 사이', y3: '두 해에서 세 해 사이', later: '세 해 뒤', together: '만나는 분과 함께 정하기' },
  },
  money_style: {
    label: '결혼 뒤 살림 관리 방식',
    values: { one: '한 사람이 맡아서 관리하기', joint: '한 통장으로 합쳐서 같이 관리하기', separate: '각자 관리하고 생활비만 나누기', together: '만나는 분과 의논해서 정하기' },
  },
  axis: {
    label: '성향 축에서 같은 구간',
    values: {
      'extraversion:low': '혼자 쉬는 시간을 중요하게 여기는 쪽', 'extraversion:mid': '사람 만나는 시간과 혼자 쉬는 시간의 균형을 보는 쪽', 'extraversion:high': '사람들과 어울려 지내는 시간을 즐기는 쪽',
      'planning:low': '그때그때 흐름에 맡기는 쪽', 'planning:mid': '큰 틀은 잡고 나머지는 유연하게 두는 쪽', 'planning:high': '미리 계획을 세우고 지키는 쪽',
      'family:low': '각자의 생활을 소중히 여기는 쪽', 'family:mid': '가족과 각자의 생활을 함께 챙기는 쪽', 'family:high': '가정을 삶의 중심에 두는 쪽',
      'economy:low': '그때그때 쓰임을 중요하게 여기는 쪽', 'economy:mid': '쓰는 일과 모으는 일의 균형을 보는 쪽', 'economy:high': '함께 계획해 모으고 안정을 우선하는 쪽',
      'conflict:low': '숨을 고르고 시간을 둔 뒤에 이야기하는 쪽', 'conflict:mid': '상황을 보며 이야기 시기를 정하는 쪽', 'conflict:high': '갈등이 생기면 바로 대화로 푸는 쪽',
    },
  },
};
export const COMPAT_MAX_ITEMS = 6;

export function renderCompatDict(): string {
  return Object.entries(COMPAT_DICT)
    .map(([k, d]) => `- k=${k} (${d.label}): ` + Object.entries(d.values).map(([v, l]) => `${v}=${l}`).join(', '))
    .join('\n');
}
export function buildCompatSystem(template: string): string {
  if (!template.includes('{{DICT}}')) throw new Error('prompt:no_dict_slot');
  return template.replace('{{DICT}}', renderCompatDict());
}

export interface CompatInput { shared: Array<{ k: string; v: string }> }

/** 입력 허용 목록: shared 한 키만 · 항목 1 ~ 6개 · 사전에 있는 k · v만 · 중복 없음. 글 자유 입력 0 */
export function prepareCompat(raw: unknown): OneShotPrep {
  if (!isRecord(raw) || !onlyKeys(raw, ['shared']) || !Array.isArray(raw.shared)) return { kind: 'reject', code: 'bad_request', why: 'shape' };
  const items = raw.shared;
  if (items.length < 1 || items.length > COMPAT_MAX_ITEMS) return { kind: 'reject', code: 'bad_request', why: 'count' };
  const seen = new Set<string>();
  const clean: Array<{ k: string; v: string }> = [];
  for (const it of items) {
    if (!isRecord(it) || !onlyKeys(it, ['k', 'v']) || typeof it.k !== 'string' || typeof it.v !== 'string') return { kind: 'reject', code: 'bad_request', why: 'item' };
    const d = Object.prototype.hasOwnProperty.call(COMPAT_DICT, it.k) ? COMPAT_DICT[it.k] : undefined;
    if (!d || !Object.prototype.hasOwnProperty.call(d.values, it.v)) return { kind: 'reject', code: 'bad_request', why: 'code' };
    const key = it.k + '=' + it.v;
    if (seen.has(key)) return { kind: 'reject', code: 'bad_request', why: 'dup' };
    seen.add(key);
    clean.push({ k: it.k, v: it.v });
  }
  return { kind: 'call', spec: ONE_SHOT.compat, userContent: '<같은값>' + JSON.stringify({ shared: clean }) + '</같은값>', input: { shared: clean } };
}

export interface CompatDisplay { same_line: string; topics: string[]; notes: string[] }
const COMPAT_DIFF = /다른 점|다르|차이|반면|반대로|하지만|그러나/;

export function finishCompat(resp: ApiResultLike): OneShotDone<CompatDisplay> {
  const p = parseJson(resp);
  if (!p.ok) return { kind: 'blocked', code: 'blocked_output', reasons: [p.reason] };
  const o = p.value;
  const reasons: string[] = [];
  if (!isRecord(o) || !onlyKeys(o, ['same_line', 'topics']) || typeof o.same_line !== 'string' || !Array.isArray(o.topics)) return { kind: 'blocked', code: 'blocked_output', reasons: ['shape'] };
  const same = o.same_line.trim();
  const topics = o.topics.filter((t): t is string => typeof t === 'string').map((t) => t.trim());
  if (topics.length !== 2 || topics.length !== o.topics.length) reasons.push('topics_count');
  if (charLen(same) < 8 || charLen(same) > 60) reasons.push('same_len');
  if (!same.startsWith('두 분 다')) reasons.push('same_prefix');
  if (splitSentences(same).length !== 1) reasons.push('same_one_sentence');
  for (const t of topics) if (charLen(t) < 6 || charLen(t) > 45) reasons.push('topic_len');
  for (const s of [same, ...topics]) {
    if (!endsWithHaeyo(s)) reasons.push('ending');
    for (const h of checkText(s, RULESETS.compat)) reasons.push('rule:' + h.id);
    if (COMPAT_DIFF.test(s)) reasons.push('rule:diff');
    if (contactHit(s)) reasons.push('contact');
  }
  if (reasons.length) return { kind: 'blocked', code: 'blocked_output', reasons: [...new Set(reasons)] };
  return { kind: 'ok', code: 'ok', display: { same_line: same, topics, notes: [COMPAT_NOTE] } };
}

// ================================================================ 프로필 문장 코치 (A9 · Sonnet 5.5)
/** 내 공개 문구 칸만(보안 IT4-44). 성향 · 어필 입력 칸 · 인터뷰 답은 여기에 없다. 칸 이름은 앱 확정 전 가안 */
export const COACH_FIELDS = ['intro', 'headline', 'photo_caption'] as const;
export type CoachField = (typeof COACH_FIELDS)[number];

export function prepareCoach(raw: unknown): OneShotPrep {
  if (!isRecord(raw) || !onlyKeys(raw, ['field', 'text']) || typeof raw.field !== 'string' || typeof raw.text !== 'string') return { kind: 'reject', code: 'bad_request', why: 'shape' };
  if (!(COACH_FIELDS as readonly string[]).includes(raw.field)) return { kind: 'reject', code: 'bad_request', why: 'field' };
  const text = sanitize(raw.text).trim();
  const hit = classifyHit(text);
  if (hit === 'crisis_db' || hit === 'crisis_ext') return { kind: 'card', code: 'crisis', card: CRISIS_CARD };
  if (hit === 'minor') return { kind: 'card', code: 'refused_intent', card: MINOR_CARD };
  const n = charLen(text);
  if (n < ONE_SHOT_LIMITS.coachTextMin) return { kind: 'reject', code: 'bad_request', why: 'short' };
  if (n > ONE_SHOT_LIMITS.coachTextMax) return { kind: 'reject', code: 'too_long', why: 'length' };
  const m = maskText(text);
  if (hasResidualPii(m.text)) return { kind: 'reject', code: 'bad_request', why: 'residual_pii' };
  return { kind: 'call', spec: ONE_SHOT.coach, userContent: '<문구>' + JSON.stringify({ field: raw.field, text: m.text }) + '</문구>', input: { field: raw.field, text: m.text } };
}

export interface CoachFinding { quote: string; point: string; ask: string; options: string[] }
export interface CoachDisplay { keep: string; findings: CoachFinding[]; notes: string[]; autoApply: false }

const OPTION_RULE_IDS = ['k_exclaim', 'k_emoji', 'k_looks', 'k_grade', 'k_condition', 'k_gender', 'k_rush', 'k_pro', 'k_praise', 'k_auto'];

export function finishCoach(resp: ApiResultLike, input: { field: string; text: string }): OneShotDone<CoachDisplay> {
  const p = parseJson(resp);
  if (!p.ok) return { kind: 'blocked', code: 'blocked_output', reasons: [p.reason] };
  const o = p.value;
  if (!isRecord(o) || !onlyKeys(o, ['keep', 'findings']) || typeof o.keep !== 'string' || !Array.isArray(o.findings)) return { kind: 'blocked', code: 'blocked_output', reasons: ['shape'] };
  const reasons: string[] = [];
  const keep = o.keep.trim();
  const text = input.text;
  const checkLine = (s: string, rules: typeof COACH_RULES): boolean => {
    let bad = false;
    for (const h of checkText(s, rules, { input: text })) { reasons.push('rule:' + h.id); bad = true; }
    if (contactHit(s)) { reasons.push('contact'); bad = true; }
    if (newDigitRuns(s, text).length) { reasons.push('new_digit'); bad = true; }
    return bad;
  };
  if (charLen(keep) > 90 || (keep && !endsWithHaeyo(keep)) || (keep && checkLine(keep, COACH_RULES))) reasons.push('keep');
  const findings: CoachFinding[] = [];
  let droppedAny = false;
  for (const f of (o.findings as unknown[]).slice(0, 6)) {
    if (!isRecord(f) || !onlyKeys(f, ['quote', 'point', 'ask', 'options']) || typeof f.quote !== 'string' || typeof f.point !== 'string' || typeof f.ask !== 'string' || !Array.isArray(f.options)) { droppedAny = true; continue; }
    const quote = f.quote.trim(); const point = f.point.trim(); const ask = f.ask.trim();
    const options = f.options.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
    const qlen = charLen(quote);
    let bad = false;
    if (qlen < 2 || qlen > 30 || !quoteInSource(quote, text)) bad = true;                 // 원문에서 글자 그대로 옮긴 조각
    if (charLen(point) > 100 || !endsWithHaeyo(point)) bad = true;
    if (charLen(ask) > 90 || !/\?\s*$/.test(ask) || !endsWithHaeyo(ask)) bad = true;
    if (options.length < 1 || options.length > 2) bad = true;
    for (const opt of options) {
      const n = charLen(opt);
      if (n < Math.max(6, Math.floor(qlen * 0.5)) || n > Math.ceil(qlen * 3) + 10) bad = true;   // 길이: 원문 조각의 절반 ~ 세 배(여유 10자)
      if (checkLine(opt, COACH_RULES.filter((r) => OPTION_RULE_IDS.includes(r.id)))) bad = true;
    }
    if (checkLine(point, COACH_RULES) || checkLine(ask, COACH_RULES)) bad = true;
    if (bad) { droppedAny = true; continue; }
    findings.push({ quote, point, ask, options });
  }
  const hardRules = reasons.filter((r) => r.startsWith('rule:k_pro') || r.startsWith('rule:k_auto') || r === 'contact');
  if (hardRules.length) return { kind: 'blocked', code: 'blocked_output', reasons: [...new Set(hardRules)] };
  if (o.findings.length > 0 && findings.length === 0 && droppedAny) return { kind: 'blocked', code: 'blocked_output', reasons: [...new Set(['findings', ...reasons])] };
  return { kind: 'ok', code: 'ok', display: { keep: reasons.includes('keep') ? '' : keep, findings: findings.slice(0, 3), notes: [COACH_NOTE], autoApply: false } };
}

// ================================================================ 별자리 · 사주 AI 풀이 (A2 · Haiku 5.5)
export const SIGN_CODES = ['aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn'] as const;
export const ELEMENT_CODES = ['wood', 'fire', 'earth', 'metal', 'water'] as const;

/** 태양 별자리 + 일간 오행만. 세 기둥 · 금성 · 수성 · 생년월일은 받지 않는다. 경계 날(cusp)은 AI로 보내지 않는다(보안 D 갈래) */
export function prepareHoroscope(raw: unknown): OneShotPrep {
  if (!isRecord(raw) || !onlyKeys(raw, ['sun_sign', 'day_element', 'cusp'])) return { kind: 'reject', code: 'bad_request', why: 'shape' };
  if (typeof raw.sun_sign !== 'string' || !(SIGN_CODES as readonly string[]).includes(raw.sun_sign)) return { kind: 'reject', code: 'bad_request', why: 'sign' };
  if (typeof raw.day_element !== 'string' || !(ELEMENT_CODES as readonly string[]).includes(raw.day_element)) return { kind: 'reject', code: 'bad_request', why: 'element' };
  if (raw.cusp !== undefined && typeof raw.cusp !== 'boolean') return { kind: 'reject', code: 'bad_request', why: 'cusp' };
  if (raw.cusp === true) return { kind: 'reject', code: 'unavailable', why: 'cusp' };   // 경계 날: 미리 쓴 글로
  const input = { sun_sign: raw.sun_sign, day_element: raw.day_element };
  return { kind: 'call', spec: ONE_SHOT.horoscope, userContent: '<코드>' + JSON.stringify(input) + '</코드>', input };
}

export interface HoroscopeDisplay { star: string; saju: string; notes: string[] }

export function finishHoroscope(resp: ApiResultLike): OneShotDone<HoroscopeDisplay> {
  const p = parseJson(resp);
  if (!p.ok) return { kind: 'blocked', code: 'blocked_output', reasons: [p.reason] };
  const o = p.value;
  if (!isRecord(o) || !onlyKeys(o, ['star', 'saju']) || typeof o.star !== 'string' || typeof o.saju !== 'string') return { kind: 'blocked', code: 'blocked_output', reasons: ['shape'] };
  const reasons: string[] = [];
  for (const [name, s0] of [['star', o.star], ['saju', o.saju]] as const) {
    const s = s0.trim();
    const n = charLen(s);
    if (n < 20 || n > 270) reasons.push(name + '_len');
    const sents = splitSentences(s);
    if (sents.length < 2 || sents.length > 4) reasons.push(name + '_sentences');
    for (const x of sents) if (!endsWithHaeyo(x)) reasons.push('ending');
    for (const h of checkText(s, RULESETS.horoscope)) reasons.push('rule:' + h.id);
    if (/재미로 보는/.test(s)) reasons.push('footer_duplicate');
    if (contactHit(s)) reasons.push('contact');
  }
  if (reasons.length) return { kind: 'blocked', code: 'blocked_output', reasons: [...new Set(reasons)] };
  return { kind: 'ok', code: 'ok', display: { star: o.star.trim(), saju: o.saju.trim(), notes: [FUN_FOOTER] } };
}
