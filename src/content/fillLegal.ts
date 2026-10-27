// QP-04(검수): 법무 게시 글 · 고객센터 글의 자리 글({고객센터 이메일} · {대표자} · {공개일} …)을 화면에 그대로 보이지 않게 한다.
// 값은 한 곳: content/fillIns.ts(FILL_INS, 법무/판_관리.md 7장 → gen:legal). 값이 있으면 그 자리에 넣고, 값이 없으면 그 줄(표의 한 행 · 문단 · 목록 한 줄)을 숨긴다.
// 출시 빌드는 값이 비면 gen:legal --release 가 실패하므로(판_관리 7장), 숨김은 출시 전 데모 · 시험 화면에서만 실제로 일어난다.
import { FILL_INS } from './fillIns';
import type { LegalBlock } from './types';

export type FillValues = Readonly<Record<string, string | null>>;

const KEY = /\{([^{}\n]+)\}/g;

// 알고 있는 자리 이름(FILL_INS 의 키)만 자리 글로 본다 — 다른 중괄호 글은 건드리지 않는다
export function fillText(text: string, values: FillValues = FILL_INS): { text: string; missing: boolean } {
  let missing = false;
  const out = text.replace(KEY, (whole, name: string) => {
    if (!(name in values)) return whole;
    const v = values[name];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    missing = true;
    return whole;
  });
  return { text: out, missing };
}

// 법무 문서 조각 목록: 값은 넣고, 값이 빈 자리가 있는 줄은 뺀다. 표는 그 행만 빼고, 남은 행이 없으면 표째 뺀다
export function visibleLegalBlocks(blocks: readonly LegalBlock[], values: FillValues = FILL_INS): LegalBlock[] {
  const out: LegalBlock[] = [];
  for (const b of blocks) {
    if (b.type === 'table') {
      const rows: string[][] = [];
      for (const row of b.rows) {
        const filled = row.map((cell) => fillText(cell, values));
        if (!filled.some((c) => c.missing)) rows.push(filled.map((c) => c.text));
      }
      if (rows.length > 0) out.push({ ...b, rows });
      continue;
    }
    const f = fillText(b.text, values);
    if (f.missing) continue;
    out.push({ ...b, text: f.text });
  }
  return out;
}
