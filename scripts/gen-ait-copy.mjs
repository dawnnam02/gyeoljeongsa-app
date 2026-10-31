// AIT-F ⑥: AI 시험판 화면 글(마케팅/카피.md 23장)의 앱 사본을 만든다. 읽기는 카피.md 23-2 ~ 23-9, 쓰기는 src/content/aitCopy.ts 하나.
//  · 접두어 일곱 — AIT 27 · AIT_SET 17 · CONCERN 91 · CONCERN_CARD 19 · PAIR_AI 8 · COACH 23 · STAR_AI 8 = 193키(카피 23-12). 표 줄의 첫 칸에 `접두어.키` 가 있으면 둘째 칸 글을 한 글자도 바꾸지 않고 옮긴다(마크다운 ** · ` 만 걷음)
//  · 글 칸이 '('로 시작하는 줄(글 없음 · 다른 키를 그대로 쓴다는 뜻) 4개는 글을 만들지 않고 NO_TEXT_KEYS 에 이름만 둔다 → 글이 있는 키 189
//  · {…} 자리는 앱이 채운다(aitText.ait)
// 사용: node scripts/gen-ait-copy.mjs          → 파일을 다시 쓴다
//       node scripts/gen-ait-copy.mjs --check  → 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
export const AIT_COPY_FILE = path.join(appDir, 'src', 'content', 'aitCopy.ts');
const COPY_DOC = process.env.CHECK_COPY_DOC ?? path.join(root, '마케팅', '카피.md');

// 긴 접두어를 먼저 쓴다(CONCERN_CARD 가 CONCERN 보다 앞)
export const AIT_PREFIXES = ['AIT_SET', 'CONCERN_CARD', 'AIT', 'CONCERN', 'PAIR_AI', 'COACH', 'STAR_AI'];
export const AIT_KEY_COUNT = 193;
export const AIT_TEXT_COUNT = 189;

const cellsOf = (line) => {
  const t = line.trim();
  return t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
};
const keyRe = new RegExp('`((?:' + AIT_PREFIXES.join('|') + ')\\.[A-Za-z0-9_.]+)`');

/** { rows: Map<키, 글>, noText: 키[] } — 23-2 ~ 23-9 표만 읽는다(23-10 이후 표의 첫 칸에는 키가 아닌 낱말이 있다) */
export function readRows(docPath = COPY_DOC) {
  const text = fs.readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');
  const from = text.search(/^## 23\. /m);
  const rest = from >= 0 ? text.slice(from + 5) : '';
  const next = rest.search(/^## \d+\. /m);
  const sec = from >= 0 ? text.slice(from, from + 5 + (next >= 0 ? next : rest.length)) : '';
  const end = sec.search(/^### 23-10\. /m);
  const rows = new Map();
  const noText = [];
  const seen = new Set();
  for (const line of (end >= 0 ? sec.slice(0, end) : sec).split('\n')) {
    if (!line.startsWith('| ')) continue;
    const c = cellsOf(line);
    const m = keyRe.exec(c[0] ?? '');
    if (!m || c[1] === undefined) continue;
    const key = m[1];
    seen.add(key);
    if (c[1].startsWith('(')) {
      noText.push(key);
      continue;
    }
    rows.set(key, c[1].replace(/\*\*/g, '').replace(/`/g, ''));
  }
  return { rows, noText, keyCount: seen.size };
}

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function build({ rows, noText }) {
  const keys = [...rows.keys()];
  const lines = keys.map((k) => `  ${q(k)}: ${q(rows.get(k))},`);
  return `// AI 시험판(AIT · 카피 23장) 화면 글의 앱 사본 — scripts/gen-ait-copy.mjs 가 마케팅/카피.md 23장에서 만든다(손으로 고치지 않는다).
//  · 접두어 일곱 193키 가운데 글이 있는 ${keys.length}키. 글 칸이 '(' 로 시작하는 ${noText.length}키(${noText.join(' · ')})는 글 없이 NO_TEXT_KEYS 에만 이름을 둔다.
//  · 쓰지 않는 글(보류 · 조건부): AIT.privacy.keep(켜는 조건은 features/ait/aitConfig) · CONCERN.end.keep(보류) · CONCERN_CARD.violence.l3b(보류) · CONCERN_CARD.body.l1(신체 위험 카드 없음) · PAIR_AI.needBoth(실서비스 전용) — 사본에는 글만 두고 화면은 그리지 않는다.
//  · check:copy AIT 그룹이 카피 23장 표와 한 글자씩 대조한다. 서버 고정 문구(src/server/ait/fixed.ts)와 겹치는 줄도 함께 본다.
//  · 이 파일은 check:copy 가 Node 로 바로 읽으므로 경로 별칭 없이 홀로 선다
export const AIT_TEXT = {
${lines.join('\n')}
} as const;

export type AitKey = keyof typeof AIT_TEXT;

/** 글 칸이 '(' 로 시작하는 키 — 글을 만들지 않는다(응답 코드 crisis · refused_intent · ok 는 고정 카드 · 답 본문이 글을 대신하고, soft.l2 는 crisis.l2 를 그대로 쓴다) */
export const NO_TEXT_KEYS = [${noText.map(q).join(', ')}] as const;
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = readRows();
  if (read.keyCount !== AIT_KEY_COUNT || read.rows.size !== AIT_TEXT_COUNT) {
    console.error(`카피 23장에서 읽은 키 ${read.keyCount}개 · 글 ${read.rows.size}개 (기대 ${AIT_KEY_COUNT} · ${AIT_TEXT_COUNT}) — 23장 표가 바뀌었는지 확인하세요`);
    process.exit(1);
  }
  const out = build(read);
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(AIT_COPY_FILE) ? fs.readFileSync(AIT_COPY_FILE, 'utf8') : '';
    if (cur !== out) {
      console.error('src/content/aitCopy.ts 가 카피 23장과 어긋남 — node scripts/gen-ait-copy.mjs 로 다시 만드세요');
      process.exit(1);
    }
    console.log('aitCopy.ts 최신');
  } else {
    fs.writeFileSync(AIT_COPY_FILE, out);
    console.log(`쓴 파일: ${path.relative(appDir, AIT_COPY_FILE)} (글 ${read.rows.size}키 + 글 없는 ${read.noText.length}키)`);
  }
}
