// IF5-A2 · 중립 이름표(neutral_names5.json) 읽기 · 검사 · 서버 원격 패치 적용. 의존성 0.
// 원격 패치 규칙: 패치의 모든 새 글이 check_text5 를 통과해야 쓰고, 하나라도 걸리거나 모르는 칸이면 패치 전체를 버린다(기본값 유지).
// 숨기기: hide_sinsal · hide_stages · hide_fragments 에 든 항목은 화면에 안 나간다(운영 중 글 문제가 생기면 앱 업데이트 없이 뺀다).

import namesJson from './data/neutral_names5.json';
import { checkText5 } from './check_text5.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Names5 = typeof namesJson & { [k: string]: any };
export interface NamesPatch5 {
  version: string;
  hide_sinsal?: string[];
  hide_stages?: string[];
  hide_fragments?: string[];
  /** 'sinsal.dohwa.name' 같은 점 경로 → 새 글 */
  rename?: Record<string, string>;
}
export interface Applied5 { names: Names5; hidden: { sinsal: Set<string>; stages: Set<string>; fragments: Set<string> }; applied: boolean; reason?: string }

export const NAMES5: Names5 = namesJson as Names5;

/** 화면에 내보내는 글 칸 전부: [점 경로, 글, 종류]. editor_only · remote · version · status 는 화면 글이 아니다. */
export function displayStrings(names: Names5): Array<[string, string, 'label' | 'line']> {
  const out: Array<[string, string, 'label' | 'line']> = [];
  const LINE_KEYS = new Set(['hint', 'plain', 'tone_hint', 'lacking']);
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string') {
      const leaf = path.split('.').pop() ?? '';
      // 숫자 인덱스 경로는 [i] 대신 점으로 쓴다
      out.push([path, v, LINE_KEYS.has(leaf) ? 'line' : 'label']);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}.${i}`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  for (const k of ['sinsal', 'stages', 'relations', 'relation_for_a', 'tones', 'officers', 'sipsung', 'elements', 'zodiac']) walk((names as Record<string, unknown>)[k], k);
  // 코드 칸(한글 코드 이름)은 화면 글이 아니다 — 'code' 로 끝나는 경로는 뺀다
  return out.filter(([p]) => !p.endsWith('.code'));
}

/** 이름표 전체 검사: 통과하지 못한 칸 목록(빈 배열이면 전부 통과) */
export function checkNames5(names: Names5 = NAMES5): Array<{ path: string; text: string; ids: string[] }> {
  const bad: Array<{ path: string; text: string; ids: string[] }> = [];
  for (const [path, text, kind] of displayStrings(names)) {
    const hits = checkText5(text, { stage: 'fragment', kind });
    if (hits.length) bad.push({ path, text, ids: hits.map((h) => h.id) });
  }
  return bad;
}

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
const SAFE_PATH = /^(sinsal|stages|relations|relation_for_a|tones|officers|sipsung|elements|zodiac)(\.[0-9A-Za-z_가-힣]+)+$/;

function setPath(root: Record<string, unknown>, path: string, value: string): boolean {
  const parts = path.split('.');
  let cur: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') return false;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur === null || typeof cur !== 'object') return false;
  const last = parts[parts.length - 1];
  if (typeof (cur as Record<string, unknown>)[last] !== 'string') return false;      // 있는 글 칸만 바꾼다(새 칸 만들기 0)
  (cur as Record<string, unknown>)[last] = value;
  return true;
}

/** 서버 패치를 이름표에 적용한다. 안전하지 않으면 base 그대로 돌려주고 reason 을 단다. */
export function applyRemoteNames(base: Names5, patch: unknown): Applied5 {
  const keep = (reason: string): Applied5 => ({ names: base, hidden: { sinsal: new Set(), stages: new Set(), fragments: new Set() }, applied: false, reason });
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return keep('not_object');
  const p = patch as Record<string, unknown>;
  const allowedKeys = new Set(['version', 'hide_sinsal', 'hide_stages', 'hide_fragments', 'rename']);
  if (Object.keys(p).some((k) => !allowedKeys.has(k))) return keep('unknown_key');
  if (typeof p.version !== 'string' || !/^[0-9A-Za-z.\-]{1,32}$/.test(p.version)) return keep('bad_version');
  const strList = (v: unknown, re: RegExp, max: number): string[] | null => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > max || !v.every((x) => typeof x === 'string' && re.test(x))) return null;
    return v as string[];
  };
  const hs = strList(p.hide_sinsal, /^[a-z_]{2,16}$/, 12);
  const ht = strList(p.hide_stages, /^[가-힣]{1,2}$/, 12);
  const hf = strList(p.hide_fragments, /^[0-9A-Za-z_.\-\/@가-힣 ]{3,80}$/, 400);
  if (hs === null || ht === null || hf === null) return keep('bad_list');
  if (hs.some((c) => !(c in base.sinsal))) return keep('unknown_sinsal');
  const next = clone(base) as Names5;
  const ren = p.rename;
  if (ren !== undefined) {
    if (ren === null || typeof ren !== 'object' || Array.isArray(ren)) return keep('bad_rename');
    const entries = Object.entries(ren as Record<string, unknown>);
    if (entries.length > 80) return keep('too_many');
    for (const [path, val] of entries) {
      if (!SAFE_PATH.test(path) || typeof val !== 'string' || val.length > 80) return keep('bad_rename_entry');
      if (path.endsWith('.code')) return keep('code_not_renamable');
      const leaf = path.split('.').pop() ?? '';
      const kind = ['hint', 'plain', 'tone_hint', 'lacking'].includes(leaf) ? 'line' : 'label';
      if (checkText5(val, { stage: 'fragment', kind }).length) return keep('unsafe_text:' + path);
      if (!setPath(next as unknown as Record<string, unknown>, path, val)) return keep('no_such_path:' + path);
    }
  }
  return { names: next, hidden: { sinsal: new Set(hs), stages: new Set(ht), fragments: new Set(hf) }, applied: true };
}

// ---------------------------------------------------------------- 낱말 찾기
export const sinsalName = (code: string, names: Names5 = NAMES5): string => (names.sinsal as Record<string, { name: string }>)[code]?.name ?? '';
export const stageName = (i: number, names: Names5 = NAMES5): string => names.stages[((i % 12) + 12) % 12].name;
export const officerName = (code: string, names: Names5 = NAMES5): string => names.officers.find((o) => o.code === code)?.name ?? '';
export const sipsungName = (code: string, names: Names5 = NAMES5): string => names.sipsung.find((o) => o.code === code)?.name ?? '';
