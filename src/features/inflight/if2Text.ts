// IF2 화면 글을 꺼내는 곳(IF2-F). 글 원본 = if2CopyData.ts(생성 파일 — scripts/gen-if2-copy.mjs, 카피 21장이 오면 21장).
//  · tx(키, 값) — {…} 자리를 채운다. 값의 받침에 따라 {을/를} 꼴 조사도 고른다(AI 계산명세 9장 · fun_calc.josa 와 같은 규칙)
//  · txList(키) — `키[0]`, `키[1]` … 차례 글 목록(엽서 첫 인사 · 작별 문장 · 꼭 나눌 이야기 …)
//  · 화면은 이 두 함수로만 IF2 글을 쓴다(카피 밖 글 0 — check:copy IF2)
import { IF2_COPY } from './if2CopyData';

export type If2Key = keyof typeof IF2_COPY;

const JOSA = ['을/를', '이/가', '은/는', '과/와', '으로/로', '이에요/예요'] as const;

export function josa(word: string, pair: string): string {
  const [a, b] = pair.split('/');
  const last = word.trim().slice(-1);
  const code = last ? last.charCodeAt(0) - 0xac00 : -1;
  const jong = code >= 0 && code <= 11171 ? code % 28 : 0;
  if (pair === '으로/로') return jong === 0 || jong === 8 ? b : a;
  return jong ? a : b;
}

// 틀 채우기: {이름}{을/를} 은 값 + 조사, {이름} 은 값
export function fill(template: string, vals: Readonly<Record<string, string>> = {}): string {
  let out = template;
  for (const [name, v] of Object.entries(vals)) {
    for (const p of JOSA) out = out.split(`{${name}}{${p}}`).join(v + josa(v, p));
    out = out.split(`{${name}}`).join(v);
  }
  return out;
}

export function tx(key: If2Key, vals?: Readonly<Record<string, string>>): string {
  return fill(IF2_COPY[key], vals);
}

// 같은 이름 자리가 글 안에 여럿일 때(앞 {취미}에 첫째 값, 뒤 {취미}에 둘째 값 …): 이름마다 값 목록을 차례로 채운다.
//  '{취미}{과/와} {취미}{을/를} 좋아해요' + 취미: ['독서·공부', '여행'] → '독서·공부와 여행을 좋아해요'. 값이 모자라면 마지막 값을 다시 쓴다
export function txSeq(key: If2Key, vals: Readonly<Record<string, readonly string[]>>): string {
  const used: Record<string, number> = {};
  return IF2_COPY[key].replace(/\{([^{}/]+)\}(\{(?:을\/를|이\/가|은\/는|과\/와|으로\/로|이에요\/예요)\})?/g, (whole, name: string, pair?: string) => {
    const list = vals[name];
    if (!list || list.length === 0) return whole;
    const i = used[name] ?? 0;
    used[name] = i + 1;
    const v = list[Math.min(i, list.length - 1)];
    return pair ? v + josa(v, pair.slice(1, -1)) : v;
  });
}

export function txList(base: string): string[] {
  const out: string[] = [];
  const table = IF2_COPY as Readonly<Record<string, string>>;
  for (let i = 0; `${base}[${i}]` in table; i += 1) out.push(table[`${base}[${i}]`]);
  return out;
}
