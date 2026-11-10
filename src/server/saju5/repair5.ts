// IF5 · 사주 AI 칸 고쳐 쓰기(AI-FIX10). 검사기(validate5.finish5)나 심사층(judge5.applyJudge5)이 **글의 몇 칸**만 빼서 답이 닫힐 때, 갈래 전체를 다시 쓰지 않고
// 그 칸만 앞뒤 글과 함께 다시 쓰게 한다. 규칙을 느슨하게 해서 통과시키는 방식이 아니다 — 고친 글도 같은 검사기와 같은 심사층을 다시 지난다. 숫자 규칙(사실 대조)은 그대로다.
// 한 갈래당 호출은 첫 시도 1번 + 칸 고쳐 쓰기 1번까지(재시도를 늘려 통과시키지 않는다). 연애 풀이(repair_love5.ts)에서 배운 틀을 이 서비스 모양(SPEC5)에 맞게 새로 썼다 — love* 파일은 읽기만 했다.
// 이 파일은 업체를 부르지 않는다(요청 꼴을 만들고 답을 적용할 뿐). 호출은 sajuRoute.ts 가 한다.

import type { ApiMessage } from '../ait/types.ts';
import type { MessagesBody } from '../ait/request.ts';
import { PLAN5 } from '../../saju5/spec5.ts';
import type { FieldSpec, Feature5 } from '../../saju5/spec5.ts';
import { SPEC5 } from '../../saju5/spec5.ts';
import { systemFor } from './request5.ts';
import { rulesFor } from '../../saju5/rules5.ts';
import { checkText } from '../ait/rules.ts';
import { charLen, splitSentences } from '../ait/text.ts';
import type { Cell5 } from './validate5.ts';

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAX_REPAIR5 = 6;
export const REPAIR5_FEATURES: readonly Feature5[] = ['reading', 'daewoon', 'sinyeon', 'compat', 'taekil'];

const PART = /([^.[\]]+)|\[(\d+)\]/g;
function steps(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  for (const m of path.matchAll(PART)) out.push(m[2] !== undefined ? +m[2] : m[1]);
  return out;
}
export function getAt(o: unknown, path: string): unknown {
  let cur: any = o; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const k of steps(path)) { if (cur == null) return undefined; cur = cur[k as never]; }
  return cur;
}
function setAt(o: Rec, path: string, v: string): boolean {
  const st = steps(path); let cur: any = o; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < st.length - 1; i++) { cur = cur?.[st[i] as never]; if (cur == null) return false; }
  const last = st[st.length - 1] as never;
  if (cur == null || typeof cur[last] !== 'string') return false;
  cur[last] = v;
  return true;
}
/** 칸 경로가 가리키는 칸 규칙(SPEC5). 글 칸(label · text)만 돌려준다 */
export function specAt(feature: Feature5, path: string): Extract<FieldSpec, { t: 'label' | 'text' }> | null {
  let spec: FieldSpec = SPEC5[feature];
  for (const k of steps(path)) {
    if (typeof k === 'number') { if (spec.t !== 'list') return null; spec = spec.of; }
    else { if (spec.t !== 'obj' || !(k in spec.fields)) return null; spec = spec.fields[k]; }
  }
  return spec.t === 'label' || spec.t === 'text' ? spec : null;
}

/** 다시 쓸 칸 고르기: 같은 경로는 하나로, 글 칸이어야 하고, 1 ~ MAX_REPAIR5 칸. 아니면 null(고쳐 쓰기 없이 닫는다) */
export function repairableCells(feature: Feature5, current: unknown, cells: readonly Cell5[] | undefined): Cell5[] | null {
  if (!cells?.length || !REPAIR5_FEATURES.includes(feature)) return null;
  const seen = new Map<string, string>();
  for (const c of cells) if (!seen.has(c.path)) seen.set(c.path, c.why);
  const out = [...seen].map(([path, why]) => ({ path, why }));
  if (out.length < 1 || out.length > MAX_REPAIR5) return null;
  if (!out.every((c) => specAt(feature, c.path) !== null && typeof getAt(current, c.path) === 'string')) return null;
  return out;
}

const WHY_TEXT = (feature: Feature5, why: string): string => (
  why === 'sentences' ? '문장 수가 맞지 않았다'
  : why === 'ending' ? '해요체로 끝나지 않는 문장이 있었다'
  : why === 'text_len' ? '글자 수가 너무 많았다'
  : why === 'label_len' ? '이름표 길이가 맞지 않았다'
  : why === 'label_punct' ? '이름표 끝에 마침표나 줄바꿈이 있었다'
  : why === 'empty' ? '비어 있었다'
  : why === 'not_question' ? '물음표로 끝나지 않았다'
  : why === 'new_digit' ? '사실에 없는 숫자를 썼다 — 숫자(나이 · 햇수 · 기간 · 날짜)는 쓰지 않고 말로 풀어 쓴다'
  : why === 'fact:ganji' ? '사실에 없는 간지 이름을 썼다 — 사실에 적힌 간지만 쓴다'
  : why === 'fact:sipsung' ? '사실에 없는 십성 이름을 썼다 — 사실에 적힌 십성만 쓴다'
  : why.startsWith('judge:') ? '직전 글의 이 칸이 금지선(겁주기 · 조건 서열 · 구매 유도 · 특정인 접근 · 여러 사람 만남 · 재회 · 건강 · 임신 · 사별 · 실제 회원 지목)에 걸려 빠졌다 — 그 말과 같은 꼴은 쓰지 않는다'
  : why === 'contact' ? '연락처 · 링크 모양이 있었다'
  : why.startsWith('rule:') ? `'${rulesFor(feature).find((r) => r.id === why.slice(5))?.label ?? why.slice(5)}' 규칙에 걸렸다 — 그 말과 같은 꼴은 쓰지 않는다`
  : '금지 규칙에 걸렸다 — 단정 · 겁주기 · 건강 · 돈 · 이름 · 점수 같은 말은 쓰지 않는다'
);

/** 칸 하나를 어떻게 고쳐 쓸지 서버가 아는 만큼 알려 준다(지금 몇 문장 · 몇 자였는지). current 가 없으면 칸 규칙만 */
export function hintFor(feature: Feature5, c: Cell5, current?: unknown): string {
  const spec = specAt(feature, c.path);
  const shape = !spec ? '같은 길이와 말투로'
    : spec.t === 'label' ? `이름표 ${spec.min}~${spec.max}자, 마침표 없음`
    : `해요체 ${spec.minS}~${spec.maxS}문장, ${spec.max}자 이하${spec.question ? ', 물음표로 끝' : ''}`;
  const now = current === undefined ? undefined : getAt(current, c.path);
  const word = typeof now === 'string' && c.why.startsWith('rule:') ? checkText(now, rulesFor(feature)).find((h) => h.id === c.why.slice(5))?.word : undefined;
  const seen = typeof now !== 'string' ? ''
    : c.why === 'sentences' ? ` 직전 글은 ${splitSentences(now).length}문장이었다.`
    : c.why === 'text_len' ? ` 직전 글은 ${charLen(now)}자였다.`
    : word ? ` 직전 글에서 걸린 말: "${word}".` : '';
  return `${c.path} — ${shape}.${seen} (문제: ${WHY_TEXT(feature, c.why)})`;
}

export const REPAIR5_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: { cells: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, text: { type: 'string' } }, required: ['path', 'text'], additionalProperties: false } } },
  required: ['cells'], additionalProperties: false,
};

/** 칸 고쳐 쓰기 요청의 마지막 글. 앞의 입력 블록 · 지시문은 첫 시도와 같다 */
export function repairInstruction5(feature: Feature5, current: unknown, cells: readonly Cell5[]): string {
  return [
    '[칸 고쳐 쓰기] 방금 쓴 글(아래 JSON)에서 다음 칸만 새로 쓴다. 다른 칸은 그대로 두고, 앞뒤 칸과 이어지게 쓰되 같은 말을 되풀이하지 않는다. 글을 어떻게 고쳤는지는 말하지 않는다.',
    '숫자 · 간지 · 십성은 <사실>에 있는 것만 쓴다. 사실에 없는 숫자는 쓰지 않고 숫자 없이 말한다. 규칙은 그대로다.',
    '답은 {"cells":[{"path":칸 경로,"text":새 글}]} 모양으로, 아래 칸만 모두 담는다.',
    '다시 쓸 칸:', ...cells.map((c) => `- ${hintFor(feature, c, current)}`),
    '현재 글:', JSON.stringify(current),
  ].join('\n');
}

export function buildRepairRequest5(feature: Feature5, messages: ApiMessage[], current: unknown, cells: readonly Cell5[]): MessagesBody {
  const plan = PLAN5[feature];
  return {
    model: plan.model,
    max_tokens: Math.min(plan.maxTokens, 900 + cells.length * 400),      // 칸 하나는 최대 230자(약 330토큰) + 틀 · 생각. 여섯 칸까지 잘리지 않게 칸 수에 맞춰 늘리되 갈래 상한은 넘기지 않는다
    system: systemFor(feature),
    messages: [...messages, { role: 'assistant', content: JSON.stringify(current) }, { role: 'user', content: repairInstruction5(feature, current, cells) }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPAIR5_SCHEMA } },
  };
}

export function parseRepair5(res: { stop_reason: string | null; content: unknown[] }): Array<{ path: string; text: string }> | null {
  if (res.stop_reason !== 'end_turn') return null;
  const text = res.content.filter((b): b is { type: string; text: string } => typeof b === 'object' && b !== null && (b as Rec).type === 'text' && typeof (b as Rec).text === 'string').map((b) => b.text).join('');
  try {
    const j = JSON.parse(text) as Rec;
    if (!Array.isArray(j.cells)) return null;
    return j.cells.filter((x: Rec) => typeof x?.path === 'string' && typeof x?.text === 'string');
  } catch { return null; }
}

/** 답을 현재 글에 적용한다. 요청한 칸만 바꾸고, 하나라도 빠지거나 비면 null(고쳐 쓰기 실패 → 그 답을 닫는다) */
export function applyRepair5(current: unknown, replies: ReadonlyArray<{ path: string; text: string }>, cells: readonly Cell5[]): Rec | null {
  const next = JSON.parse(JSON.stringify(current)) as Rec;
  const byPath = new Map(replies.map((r) => [r.path, r.text]));
  for (const c of cells) {
    const t = byPath.get(c.path);
    if (typeof t !== 'string' || !t.trim()) return null;
    if (!setAt(next, c.path, t.trim())) return null;
  }
  return next;
}
