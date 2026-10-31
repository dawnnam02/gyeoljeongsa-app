// IF5-A · 사주 확장 AI 출력 검사기. 업체를 부르지 않는다. 모양 → 문장 → 금지 규칙 → 사실 대조 → 기능별 추가 검사.
// 하나라도 걸리면 그 답은 통째로 버린다(blocked_output). 걸린 이유는 시험·로그용 짧은 코드이고 사용자에게 내보내지 않는다.

import type { Hit } from '../ait/rules.ts';
import { checkText, contactHit, newDigitRuns } from '../ait/rules.ts';
import { charLen, endsWithHaeyo, splitSentences } from '../ait/text.ts';
import { CRISIS_CARD, MINOR_CARD } from '../ait/fixed.ts';
import type { FixedCard } from '../ait/fixed.ts';
import type { FieldSpec, Feature5 } from '../../saju5/spec5.ts';
import { SPEC5 } from '../../saju5/spec5.ts';
import { rulesFor } from '../../saju5/rules5.ts';

export interface ApiResultLike { stop_reason: string | null; content: unknown[] }

// ---------------------------------------------------------------- 고정 안내(서버가 쓴 글 — 출력 규칙을 적용하지 않는다)
export const FOOTER5: Readonly<Record<Feature5, readonly string[]>> = {
  reading: ['재미로 보는 이야기예요.'],
  compat: ['재미로 보는 이야기예요.', '판정이나 점수가 아니라 서로의 결을 견준 글이에요.'],
  daewoon: ['재미로 보는 이야기예요.'],
  sinyeon: ['재미로 보는 이야기예요.'],
  wolun: ['재미로 보는 이야기예요.'],
  daily: ['재미로 보는 이야기예요.'],
  taekil: ['재미로 보는 이야기예요.', '전통 달력의 한 가지 방식으로 본 참고예요. 중요한 날은 두 분의 일정과 사정을 먼저 봐 주세요.'],
  chat: ['재미로 보는 이야기예요. AI가 쓴 글이고 상담이나 진단이 아니에요.'],
  summary: [],
};
/** 건강 · 법 · 투자 이야기가 오면 풀이 대신 나가는 고정 한 줄(서버 글) */
export const REDIRECT_LINES = {
  medical: '건강이나 몸 이야기는 사주로 답하기 어려워요. 몸이 걱정되면 의료기관에서 확인해 보세요.',
  legal: '법과 관련된 이야기는 사주로 답하기 어려워요. 필요하면 법률 도움을 받을 수 있는 기관에 문의해 보세요.',
  invest: '돈을 불리는 투자 이야기는 사주로 답하기 어려워요. 중요한 결정은 직접 꼼꼼히 확인해 주세요.',
  off_topic: '그 이야기는 사주 풀이로 답하기 어려워요. 사주나 요즘 마음 이야기는 얼마든지 이어 가요.',
} as const;

// ---------------------------------------------------------------- 사실 대조
const STEMS = '갑을병정무기경신임계';
const BRANCHES = '자축인묘진사오미신유술해';
export const GANJI60: readonly string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < 60; i++) out.push(STEMS[i % 10] + BRANCHES[i % 12]);
  return out;
})();
const SIPSUNG = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
/** '상관없어요'처럼 십성이 아닌 일상어는 빼고 찾는다 */
const SIPSUNG_RE: Record<(typeof SIPSUNG)[number], RegExp> = Object.fromEntries(
  SIPSUNG.map((n) => [n, new RegExp(n + (n === '상관' ? '(?!없|있|하지|하는|하게|하고)' : ''))]),
) as Record<(typeof SIPSUNG)[number], RegExp>;
const PARTICLE = '(?:년|월|일|시|주|생|이|가|은|는|을|를|의|에|로|와|과|도|인|예요|이에요|라|랑|에서|처럼|부터|까지|으로|이라|이고|이며|입니다|때|쪽|운)';
const GANJI_RE = new RegExp('(?<![가-힣])(' + GANJI60.join('|') + ')(?![가-힣])|(?<![가-힣])(' + GANJI60.join('|') + ')(?=' + PARTICLE + ')', 'g');
/** 일상어와 모양이 같은 간지(정해 · 기사 · 임신 …)는 바로 뒤에 년 · 월 · 일 · 시 · 주 · 생 · 운이 붙을 때만 간지로 센다 */
const AMBIGUOUS = new Set(['정해', '기사', '경신', '임신', '정사', '신사', '기미', '무술', '정유', '병신']);
const AMBIGUOUS_SUFFIX = /^(?:년|월|일|시|주|생|운|대운)/;

/** 출력에 나온 간지 이름(경계가 분명한 것만) */
export function ganjiIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(GANJI_RE)) {
    const g = m[1] ?? m[2];
    if (AMBIGUOUS.has(g) && !AMBIGUOUS_SUFFIX.test(text.slice((m.index ?? 0) + g.length))) continue;
    out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------- 모양 · 문장
function isRec(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }
function textOf(content: unknown[]): string {
  return content.filter((b): b is { type: string; text: string } => isRec(b) && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
}

interface Ctx { reasons: Set<string>; strings: string[] }

function walk(spec: FieldSpec, v: unknown, path: string, ctx: Ctx): unknown {
  const bad = (why: string): undefined => { ctx.reasons.add(`${why}@${path}`); return undefined; };
  switch (spec.t) {
    case 'label': {
      if (typeof v !== 'string') return bad('type');
      const s = v.trim();
      const n = charLen(s);
      if (n < spec.min || n > spec.max) bad('label_len');
      if (/[.?!\n]$/.test(s) || s.includes('\n')) bad('label_punct');
      ctx.strings.push(s);
      return s;
    }
    case 'text': {
      if (typeof v !== 'string') return bad('type');
      const s = v.trim();
      if (s === '') { if (!spec.empty) bad('empty'); return s; }
      const n = charLen(s);
      if (n > spec.max) bad('text_len');
      const sents = splitSentences(s);
      if (sents.length < spec.minS || sents.length > spec.maxS) bad('sentences');
      for (const x of sents) if (!endsWithHaeyo(x)) { bad('ending'); break; }
      if (spec.question && !/\?\s*$/.test(s)) bad('not_question');
      ctx.strings.push(s);
      return s;
    }
    case 'enums': {
      if (!Array.isArray(v) || v.length > spec.max || !v.every((x) => typeof x === 'string' && spec.values.includes(x))) return bad('enums');
      return v;
    }
    case 'list': {
      if (!Array.isArray(v)) return bad('type');
      if (v.length < spec.min || v.length > spec.max) bad('list_len');
      return v.map((x, i) => walk(spec.of, x, `${path}[${i}]`, ctx));
    }
    case 'obj': {
      if (!isRec(v)) return bad('type');
      const keys = Object.keys(spec.fields);
      if (Object.keys(v).some((k) => !keys.includes(k)) || keys.some((k) => !(k in v))) return bad('keys');
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = walk(spec.fields[k], v[k], path ? `${path}.${k}` : k, ctx);
      return out;
    }
  }
}

// ---------------------------------------------------------------- 결과
export type Done5 =
  | { kind: 'ok'; code: 'ok'; display: Record<string, unknown>; notes: readonly string[] }
  | { kind: 'card'; code: 'crisis' | 'refused_intent'; card: FixedCard }
  | { kind: 'redirect'; code: 'ok'; line: string; flag: keyof typeof REDIRECT_LINES }
  | { kind: 'blocked'; code: 'blocked_output'; reasons: string[] };

export interface FinishOpts {
  /** 이번에 모델이 본 사실(JSON 문자열로 바꿔 대조) */
  facts: unknown;
  /** 대화 요약처럼 사실 밖에서 온 허용 글(간지 · 숫자 대조에 같이 쓴다) */
  extraSource?: string;
  /** 사용자가 이번 턴에 쓴 글(숫자 대조에만) */
  userText?: string;
}

/** 모델 답 → 화면용. 걸리면 blocked. 채팅은 flags 에 따라 고정 카드 · 안내로 바꾼다. */
export function finish5(feature: Feature5, resp: ApiResultLike, opts: FinishOpts): Done5 {
  if (resp.stop_reason !== 'end_turn') return { kind: 'blocked', code: 'blocked_output', reasons: ['stop:' + String(resp.stop_reason)] };
  let parsed: unknown;
  try { parsed = JSON.parse(textOf(resp.content)); } catch { return { kind: 'blocked', code: 'blocked_output', reasons: ['json'] }; }

  const ctx: Ctx = { reasons: new Set(), strings: [] };
  const display = walk(SPEC5[feature], parsed, '', ctx) as Record<string, unknown> | undefined;
  if (ctx.reasons.size || !display) return { kind: 'blocked', code: 'blocked_output', reasons: [...ctx.reasons] };

  // 채팅: 서버가 아는 위기 · 미성년 · 의료 · 법 · 투자 신호는 풀이 글보다 먼저 고정 안내로
  if (feature === 'chat') {
    const flags = display.flags as string[];
    if (flags.includes('crisis')) return { kind: 'card', code: 'crisis', card: CRISIS_CARD };
    if (flags.includes('minor')) return { kind: 'card', code: 'refused_intent', card: MINOR_CARD };
    for (const f of ['medical', 'legal', 'invest', 'off_topic'] as const) if (flags.includes(f)) return { kind: 'redirect', code: 'ok', line: REDIRECT_LINES[f], flag: f };
  }

  const reasons = new Set<string>();
  const rules = rulesFor(feature);
  const factsStr = JSON.stringify(opts.facts ?? '') + (opts.extraSource ?? '');
  const digitSource = factsStr + (opts.userText ?? '');
  const dateLabels = new Set<string>();
  if (feature === 'taekil') for (const p of (display.picks as Array<{ date: string }>)) { if (/^\d{4}-\d{2}-\d{2}$/.test(p.date)) dateLabels.add(p.date); else reasons.add('taekil:date_format'); }
  for (const s of ctx.strings) {
    if (dateLabels.has(s)) continue;                 // 날짜 이름표는 형식과 사실 대조(아래)로만 본다
    for (const h of checkText(s, rules)) reasons.add('rule:' + h.id);
    const c = contactHit(s); if (c) reasons.add('contact');
    if (newDigitRuns(s, digitSource).length) reasons.add('new_digit');
    for (const g of ganjiIn(s)) if (!factsStr.includes(g)) reasons.add('fact:ganji');
    for (const n of SIPSUNG) if (SIPSUNG_RE[n].test(s) && !factsStr.includes(n)) reasons.add('fact:sipsung');
  }

  if (feature === 'taekil') {
    const days = (isRec(opts.facts) && Array.isArray(opts.facts.days) ? opts.facts.days : []) as Array<{ date: string; tone: string }>;
    const good = new Set(days.filter((d) => d.tone === 'good').map((d) => d.date));
    const nonRest = new Set(days.filter((d) => d.tone !== 'rest').map((d) => d.date));
    const picks = display.picks as Array<{ date: string }>;
    const seen = new Set<string>();
    for (const p of picks) {
      if (seen.has(p.date)) reasons.add('taekil:dup');
      seen.add(p.date);
      if (good.size > 0 ? !good.has(p.date) : !nonRest.has(p.date)) reasons.add('taekil:date_not_in_facts');
    }
    const rest = String(display.rest ?? '');
    const hasRest = days.some((d) => d.tone === 'rest');
    if (rest !== '' && !hasRest) reasons.add('taekil:rest_without_days');
  }
  if (feature === 'compat') {
    const f = opts.facts as { a?: unknown; b?: unknown };
    if (!isRec(f) || !f.a || !f.b) reasons.add('compat:no_facts');
  }
  if (reasons.size) return { kind: 'blocked', code: 'blocked_output', reasons: [...reasons] };

  // 화면용: 앞뒤 공백 제거본 그대로 + 고정 안내
  // 끝줄(FOOTER5)은 앱이 한 곳에서 보여 준다 → 서버 응답 경로는 AI 글에 덧붙이지 않는다(상수는 앱 · 카피가 쓰도록 남김).
  return { kind: 'ok', code: 'ok', display, notes: [] };
}

/** 요약(내부)은 사용자에게 안 보이지만 다음 턴 지시문 옆에 들어가므로 같은 규칙으로 걸러 낸다. 걸리면 호출하는 쪽이 결정적 요약으로 대신한다. */
export function finishSummary(resp: ApiResultLike, source: string): { ok: true; summary: string } | { ok: false; reasons: string[] } {
  const d = finish5('summary', resp, { facts: '', extraSource: source });
  if (d.kind !== 'ok') return { ok: false, reasons: d.kind === 'blocked' ? d.reasons : [d.kind] };
  return { ok: true, summary: String(d.display.summary) };
}

export type { Hit };
