// IF5-A2 · 미리 쓴 글 조각(무료 층) 고르는 함수. 조각 표는 ts/data/fragments5.json(원본 fragments/part*.json 에서 make_fragments5.py 가 합침).
// 계산값(일간 · 오행 · 십성 · 12운성 중립 이름 · 신살 · 대운 · 세운 · 월운 · 일진 · 건제 12신 · 궁합 관계) → 키 → 글 한 줄.
// 층: 한 문장(one) · 세 줄(three) · 펼침(more). 점수 · 판정 · 재회 갈래 없음. 업체 호출 0 · 네트워크 0 · 의존성 0.
// 모든 글은 check_text5(stage 'fragment')를 전수 통과해야 한다(fragments5.test.ts). 모르는 키는 건너뛴다(빈 카드가 날 수는 있어도 틀린 글은 안 나감).

import fragJson from './data/fragments5.json';
import { NAMES5 } from './names5.ts';
import { BRANCHES, ELEMENTS, STEMS, branch_relations, chart_relations, element_counts, sipsung, sipsung_list } from './saju_calc5.ts';
import type { Chart, Rec } from './saju_calc5.ts';

export type Topic = 'period' | 'year' | 'month' | 'day';
export type Tone = 'up' | 'mid' | 'rest';
export interface PickInput {
  /** 내 원국(F5-01 ~ 04 · 18) */
  chart?: Chart;
  /** F5-04 칩(work · money · people · rest) · F5-14 신살 코드 · F5-16 낱말 */
  variant?: string;
  /** 운 글에 들어가는 때: 이 계절 / 올해 / 이번 달 / 오늘 */
  topic?: Topic;
  /** 운 한 칸(대운 항목 · seun · wolun_at · wolun 의 한 달 · iljin — saju_calc5 의 luck_facts 모양) */
  luck?: Rec;
  samjae_step?: number | null;
  quarter_tones?: readonly Tone[];
  /** F5-09 */
  purpose?: string; tone?: string; officer_code?: string; clash?: boolean;
  /** F5-10 · 11: compat(a, b) 결과 또는 facts_compat 결과 */
  compat?: Rec;
  /** F5-12 */
  jeolgi?: string; day_element?: string;
  /** F5-18: 내 태어난 해의 지지 번호(0~11) · 올해 지지 번호 */
  birth_branch?: number; this_year_branch?: number;
}
export interface Piece { id: string; text: string }
export interface Card5 { feature: string; variant: string; row: Piece | null; one: Piece | null; day_one: Piece | null; three: Piece[]; more: Piece[] }
export interface PickOpts { hidden?: ReadonlySet<string> }

interface NodeDef { by?: string; map?: Record<string, string>; ref?: string; kind?: 'line' | 'label' }
interface FeatureDef { name: string; row?: NodeDef; one?: NodeDef; day_one?: NodeDef; three?: NodeDef[]; more?: NodeDef[]; chips?: Record<string, FeatureDef> }
interface FragFile { version: string; slots: { topic: Record<string, string>; q: string[] }; shared: Record<string, NodeDef>; features: Record<string, FeatureDef> }
export const FRAGMENTS5 = fragJson as unknown as FragFile;

// ---------------------------------------------------------------- 키 계산(선택자)
const GROUP_OF: Record<string, string> = { 비견: 'peer', 겁재: 'peer', 식신: 'express', 상관: 'express', 편재: 'build', 정재: 'build', 편관: 'order', 정관: 'order', 편인: 'learn', 정인: 'learn' };
export const GROUPS = ['peer', 'express', 'build', 'order', 'learn'] as const;
export const SIPSUNG10 = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
const REST_STAGES = new Set(['쉬어 가는 때', '거두는 때', '갈무리하는 때', '비우는 때']);
const UP_STAGES = new Set(['싹트는 때', '자라나는 때', '자리 잡는 때', '한창인 때']);
const REL_PRIORITY = ['branch_triad_full', 'stem_combine', 'branch_combine', 'branch_triad_half', 'stem_clash', 'branch_clash', 'branch_punish', 'branch_self'] as const;
const PAIR_REL = ['branch_combine', 'branch_triad_half', 'branch_clash', 'branch_punish', 'branch_self'] as const;
const FLAG_KEYS = ['yaja_si', 'date_shifted_by_solar_time', 'near_jie_edge', 'ambiguous_clock_time', 'dst_adjusted'] as const;

export const toneOfStage = (stage: string): Tone => (REST_STAGES.has(stage) ? 'rest' : UP_STAGES.has(stage) ? 'up' : 'mid');
/** 월운 12개(입춘부터) → 분기 네 칸의 대표 분위기 */
export function quarterTones(wolunItems: readonly Rec[]): Tone[] {
  const out: Tone[] = [];
  for (let q = 0; q < 4; q++) {
    const tones = wolunItems.slice(q * 3, q * 3 + 3).map((m) => toneOfStage(String(m.stage)));
    const up = tones.filter((t) => t === 'up').length; const rest = tones.filter((t) => t === 'rest').length;
    out.push(rest > up ? 'rest' : up > rest ? 'up' : 'mid');
  }
  return out;
}
function groupCounts(chart: Chart): Record<string, number> {
  const c: Record<string, number> = { peer: 0, express: 0, build: 0, order: 0, learn: 0 };
  for (const s of sipsung_list(chart)) c[GROUP_OF[s.name]] += 1;
  return c;
}
const need = <T,>(v: T | undefined, why: string): T => { if (v === undefined) throw new Error('input_missing:' + why); return v; };
const relCodesOf = (luck: Rec): string[] => (luck.relations as Rec[]).map((r) => String(r.code ?? r.label));
function pairBranchKey(list: Rec[] | undefined): string | null {
  if (!Array.isArray(list)) return null;
  const codes = list.map((r) => String(r.code));
  return PAIR_REL.find((c) => codes.includes(c)) ?? 'none';
}

type Sel = (i: PickInput) => string | string[] | null;
const SEL: Record<string, Sel> = {
  all: () => ['all'],
  all3: () => ['1', '2', '3'],
  day_stem: (i) => STEMS[need(i.chart, 'chart').day_master.stem],
  day_element: (i) => (i.day_element ?? need(i.chart, 'chart').day_master.element),
  el_note: (i) => {
    const e = element_counts(need(i.chart, 'chart'));
    return e.lacking.length ? 'lack_' + e.lacking[0] : e.abundant.length ? 'rich_' + e.abundant[0] : 'even';
  },
  season: (i) => {
    const b = need(i.chart, 'chart').pillars.month % 12;
    return b >= 2 && b <= 4 ? 'spring' : b >= 5 && b <= 7 ? 'summer' : b >= 8 && b <= 10 ? 'autumn' : 'winter';
  },
  hour: (i) => {
    const c = need(i.chart, 'chart');
    return c.pillars.hour !== null ? 'known' : c.combos.length > 1 ? ['unknown', 'two'] : 'unknown';
  },
  flags: (i) => FLAG_KEYS.filter((f) => need(i.chart, 'chart').flags.includes(f)),
  group_top: (i) => {
    const c = groupCounts(need(i.chart, 'chart'));
    let best: string = GROUPS[0];
    for (const g of GROUPS) if (c[g] > c[best]) best = g;
    return best;
  },
  group_gap: (i) => {
    const c = groupCounts(need(i.chart, 'chart'));
    const g = GROUPS.find((x) => c[x] === 0);
    return g ? 'gap_' + g : 'gap_none';
  },
  month_ss: (i) => { const c = need(i.chart, 'chart'); return sipsung(c.day_master.stem, c.pillars.month % 10); },
  rel_note: (i) => {
    const codes = chart_relations(need(i.chart, 'chart')).map((r) => String(r.code));
    const combine = codes.some((c) => ['stem_combine', 'branch_combine', 'branch_triad_half', 'branch_triad_full'].includes(c));
    const clash = codes.some((c) => ['stem_clash', 'branch_clash', 'branch_punish', 'branch_self'].includes(c));
    return combine && clash ? 'both' : combine ? 'combine' : clash ? 'clash' : 'calm';
  },
  // ---- 운
  l_ss: (i) => String(need(i.luck, 'luck').stem_sipsung),
  l_stage: (i) => String(need(i.luck, 'luck').stage),
  l_fills: (i) => { const f = need(i.luck, 'luck').fills_lacking as string[]; return f.length ? 'fill_' + f[0] : 'none'; },
  l_rel: (i) => { const codes = relCodesOf(need(i.luck, 'luck')); return REL_PRIORITY.find((c) => codes.includes(c)) ?? 'none'; },
  samjae: (i) => (i.samjae_step === null || i.samjae_step === undefined ? 'none' : 's' + String(i.samjae_step + 1)),
  quarters: (i) => (i.quarter_tones ? i.quarter_tones.map((t, n) => `${t}@${n}`) : null),
  month_tone: (i) => toneOfStage(String(need(i.luck, 'luck').stage)),
  // ---- 날짜 고르기
  purpose: (i) => need(i.purpose, 'purpose'),
  tone: (i) => need(i.tone, 'tone'),
  officer: (i) => NAMES5.officers.find((o) => o.code === need(i.officer_code, 'officer_code'))?.name ?? null,
  clash: (i) => (need(i.clash, 'clash') ? 'yes' : 'no'),
  // ---- 둘이 맞춰 보기
  c_rel_a: (i) => String(need(i.compat, 'compat').day_master.relation_for_a),
  c_ss_ab: (i) => String(need(i.compat, 'compat').day_master.a_to_b_sipsung),
  c_day_branch: (i) => pairBranchKey(need(i.compat, 'compat').day_branch),
  c_year_branch: (i) => pairBranchKey(need(i.compat, 'compat').year_branch),
  c_stem: (i) => { const s = need(i.compat, 'compat').day_master.stem_relations as Rec[]; return s.length ? String(s[0].code) : 'none'; },
  c_fill: (i) => {
    const e = need(i.compat, 'compat').elements as Rec;
    return (e.a_gets_from_b as string[]).length ? 'a_' + (e.a_gets_from_b as string[])[0] : (e.b_gets_from_a as string[]).length ? 'b_' + (e.b_gets_from_a as string[])[0] : 'none';
  },
  c_triad: (i) => { const t = need(i.compat, 'compat').triad_together; return Array.isArray(t) ? (t.length ? 'yes' : 'no') : null; },
  c_partial: (i) => (need(i.compat, 'compat').partial ? 'yes' : 'no'),
  // ---- 달력 · 띠
  jeolgi: (i) => i.jeolgi ?? null,
  z_self: (i) => BRANCHES[need(i.birth_branch, 'birth_branch')],
  z_rel: (i) => {
    const codes = branch_relations(need(i.this_year_branch, 'this_year_branch'), need(i.birth_branch, 'birth_branch')).map(([c]) => c);
    if (codes.includes('branch_same')) return 'same';
    return PAIR_REL.find((c) => codes.includes(c)) ?? 'none';
  },
};

/** 선택자별 가능한 키 전부(시험이 조각 표가 빠짐없는지 본다) */
export const DOMAIN5: Record<string, readonly string[]> = {
  all: ['all'], all3: ['1', '2', '3'],
  day_stem: STEMS, day_element: ELEMENTS,
  el_note: [...ELEMENTS.map((e) => 'lack_' + e), ...ELEMENTS.map((e) => 'rich_' + e), 'even'],
  season: ['spring', 'summer', 'autumn', 'winter'], hour: ['known', 'unknown', 'two'], flags: FLAG_KEYS,
  group_top: GROUPS, group_gap: [...GROUPS.map((g) => 'gap_' + g), 'gap_none'], month_ss: SIPSUNG10,
  rel_note: ['combine', 'clash', 'both', 'calm'],
  l_ss: SIPSUNG10, l_stage: NAMES5.stages.map((s) => s.name), l_fills: [...ELEMENTS.map((e) => 'fill_' + e), 'none'],
  l_rel: [...REL_PRIORITY, 'none'], samjae: ['none', 's1', 's2', 's3'], quarters: ['up', 'mid', 'rest'], month_tone: ['up', 'mid', 'rest'],
  purpose: ['wedding', 'moving', 'business', 'travel', 'new_start', 'cleanup', 'important_talk'], tone: ['good', 'neutral', 'rest'],
  officer: NAMES5.officers.map((o) => o.name), clash: ['yes', 'no'],
  c_rel_a: Object.keys(NAMES5.relation_for_a), c_ss_ab: SIPSUNG10, c_day_branch: ['none', ...PAIR_REL], c_year_branch: ['none', ...PAIR_REL],
  c_stem: ['stem_combine', 'stem_clash', 'none'], c_fill: [...ELEMENTS.map((e) => 'a_' + e), ...ELEMENTS.map((e) => 'b_' + e), 'none'],
  c_triad: ['yes', 'no'], c_partial: ['yes', 'no'],
  jeolgi: ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'],
  z_self: BRANCHES, z_rel: ['none', 'same', ...PAIR_REL],
};

// ---------------------------------------------------------------- 노드 펼치기 · 글 채우기
export interface NodeInfo { id: string; feature: string; variant: string; layer: 'row' | 'one' | 'day_one' | 'three' | 'more'; node: NodeDef & { by: string; map: Record<string, string> }; ref: boolean; kind: 'line' | 'label' }
function resolve(n: NodeDef, ownId: string): { id: string; node: NodeInfo['node']; ref: boolean } {
  if (n.ref) {
    const s = FRAGMENTS5.shared[n.ref];
    if (!s) throw new Error('no_shared:' + n.ref);
    return { id: 'shared.' + n.ref, node: s as NodeInfo['node'], ref: true };
  }
  return { id: ownId, node: n as NodeInfo['node'], ref: false };
}
function layersOf(base: string, spec: FeatureDef, feature: string, variant: string): NodeInfo[] {
  const out: NodeInfo[] = [];
  const push = (layer: NodeInfo['layer'], n: NodeDef, ownId: string): void => {
    const r = resolve(n, ownId);
    out.push({ id: r.id, feature, variant, layer, node: r.node, ref: r.ref, kind: r.node.kind ?? 'line' });
  };
  for (const l of ['row', 'one', 'day_one'] as const) if (spec[l]) push(l, spec[l] as NodeDef, `${base}.${l}`);
  (spec.three ?? []).forEach((n, i) => push('three', n, `${base}.three.${i}`));
  (spec.more ?? []).forEach((n, i) => push('more', n, `${base}.more.${i}`));
  return out;
}
/** 조각 표의 모든 노드(공통 조각은 쓰는 자리마다 한 번씩 나오지만 id 는 같다) */
export function allNodes5(): NodeInfo[] {
  const out: NodeInfo[] = [];
  for (const [fid, f] of Object.entries(FRAGMENTS5.features)) {
    if (f.chips) for (const [chip, spec] of Object.entries(f.chips)) out.push(...layersOf(`${fid}.${chip}`, spec, fid, chip));
    else out.push(...layersOf(fid, f, fid, ''));
  }
  return out;
}
export function sharedNodes5(): Array<{ id: string; node: NodeInfo['node']; kind: 'line' | 'label' }> {
  return Object.entries(FRAGMENTS5.shared).map(([k, n]) => ({ id: 'shared.' + k, node: n as NodeInfo['node'], kind: n.kind ?? 'line' }));
}

/** 슬롯 {topic} · {q} 채우기. 모르는 슬롯이 남으면 던진다. */
export function fillSlots(text: string, topic: Topic, qIndex: number): string {
  const out = text.replace(/\{topic\}/g, FRAGMENTS5.slots.topic[topic]).replace(/\{q\}/g, FRAGMENTS5.slots.q[qIndex] ?? FRAGMENTS5.slots.q[0]);
  if (/[{}]/.test(out)) throw new Error('unknown_slot');
  return out;
}

function piecesOf(info: NodeInfo, input: PickInput, hidden: ReadonlySet<string> | undefined): Piece[] {
  if (hidden?.has(info.id)) return [];
  const by = info.node.by;
  const sel = SEL[by];
  if (!sel) throw new Error('no_selector:' + by);
  const raw = sel(input);
  if (raw === null) return [];
  const keys = Array.isArray(raw) ? raw : [raw];
  const out: Piece[] = [];
  for (const k of keys) {
    const [base, qs] = k.split('@');
    const t = info.node.map[base];
    if (t === undefined || t === '') continue;
    const pid = `${info.id}/${base}`;
    if (hidden?.has(pid)) continue;
    out.push({ id: pid, text: fillSlots(t, input.topic ?? 'period', qs === undefined ? 0 : Number(qs)) });
  }
  return out;
}

/** 기능 하나의 카드를 계산값으로 고른다. 한 문장(one) 하나 · 세 줄(three) 최대 셋 · 펼침(more) 여러 줄. 층마다 비면 비어 있다. */
export function pickCard(feature: string, input: PickInput = {}, opts: PickOpts = {}): Card5 {
  const f = FRAGMENTS5.features[feature];
  if (!f) throw new Error('unknown_feature:' + feature);
  let spec: FeatureDef = f; let base = feature; let variant = '';
  if (f.chips) {
    variant = need(input.variant, 'variant');
    const c = f.chips[variant];
    if (!c) throw new Error('unknown_variant:' + variant);
    spec = c; base = `${feature}.${variant}`;
  }
  const card: Card5 = { feature, variant, row: null, one: null, day_one: null, three: [], more: [] };
  for (const info of layersOf(base, spec, feature, variant)) {
    const ps = piecesOf(info, input, opts.hidden);
    if (info.layer === 'row' || info.layer === 'one' || info.layer === 'day_one') card[info.layer] = ps[0] ?? null;
    else if (info.layer === 'three') { if (ps[0] && card.three.length < 3) card.three.push(ps[0]); }
    else card.more.push(...ps);
  }
  return card;
}
