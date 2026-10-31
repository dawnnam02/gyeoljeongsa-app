// IF3-F(3부-카 ③ · 축소판): 하늘 읽기 화면 글의 앱 사본을 만든다. 읽기는 마케팅/카피.md 22장, 쓰기는 src/content/if3Copy.ts 하나.
//  · 3부-카 키(G-02 `SKY_WEEK` 4 · G-03 `SKY_BOOK` 14 · G-04 `MY_WAYS` 14 · G-07 `BIRTH_CARD` 8 · 새 끝줄 `FUN.aiNote` 1 = 41) + IF5-F1(10-31) 22장 남은 36키(G-01 `READ_GUIDE` 5 · G-05 `THREE_PILLARS` 22 · G-06 `MEET_SKY` 9) + 22-14 네 키(`TYPE_CARD.state.none` · `.featureOff` · `.forbidden` · `MY_WAYS.loadFailed`) = 81을 읽는다.
//    `SIGN_CUSP`(22-10) 두 줄은 3부-차 그대로 손으로 둔 함수꼴이다.
//  · 표 줄 가운데 첫 칸에 위 접두어 키(`MY_WAYS.title` 꼴)가 있는 줄의 둘째 칸 글을 한 글자도 바꾸지 않고 옮긴다(마크다운 ** · ` 만 걷음). {…} 자리는 앱이 채운다(if3Copy.t3)
// 사용: node scripts/gen-if3-copy.mjs          → 파일을 다시 쓴다
//       node scripts/gen-if3-copy.mjs --check  → 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
export const IF3_COPY_FILE = path.join(appDir, 'src', 'content', 'if3Copy.ts');
const COPY_DOC = process.env.CHECK_COPY_DOC ?? path.join(root, '마케팅', '카피.md');

export const IF3_PREFIXES = ['SKY_WEEK', 'SKY_BOOK', 'MY_WAYS', 'BIRTH_CARD', 'READ_GUIDE', 'THREE_PILLARS', 'MEET_SKY'];
const EXTRA_KEYS = ['FUN.aiNote'];
// 22-14 (F0-M · 10-31): 표 첫 칸이 'IF-TYPE `키`' 꼴인 새 글 — 타입 화면 상태 글 셋 + G-04 불러오기 오류(접두어 MY_WAYS 는 위 목록에 있음). `TYPE_CARD.loadFailed` 는 21장 재사용이라 읽지 않는다
export const STATE_KEYS = ['TYPE_CARD.state.none', 'TYPE_CARD.state.featureOff', 'TYPE_CARD.state.forbidden'];
export const IF3_KEY_COUNT = 81;

const cellsOf = (line) => {
  const t = line.trim();
  return t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
};
const keyRe = new RegExp('`((?:' + [...IF3_PREFIXES, 'FUN', 'TYPE_CARD'].join('|') + ')\\.[A-Za-z0-9_.]+)`');

export function readRows(docPath = COPY_DOC) {
  const text = fs.readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');
  const from = text.search(/^## 22\. /m);
  const rest = from >= 0 ? text.slice(from + 5) : '';
  const next = rest.search(/^## \d+\. /m);
  const sec = from >= 0 ? text.slice(from, from + 5 + (next >= 0 ? next : rest.length)) : '';
  const end = sec.search(/^### 22-11\. /m); // 표는 22-2 ~ 22-10 만 읽는다(22-13 팀장 판단 표의 첫 칸에도 키가 적혀 있다)
  const rows = new Map();
  const st = sec.search(/^### 22-14\. /m); // 22-14(F0-M): 새 글 네 줄 — 표 첫 칸 'IF-TYPE `키`' · 'IF-MAG① `키`' 꼴만(같은 절 겹침 판정 표의 줄은 읽지 않는다)
  const stRest = st >= 0 ? sec.slice(st + 5) : '';
  const stEnd = stRest.search(/^#{2,3} /m);
  const stSec = st >= 0 ? sec.slice(st, st + 5 + (stEnd >= 0 ? stEnd : stRest.length)) : '';
  const lines = [...(end >= 0 ? sec.slice(0, end) : sec).split('\n').map((l) => [l, false]), ...stSec.split('\n').map((l) => [l, true])];
  for (const [line, fromState] of lines) {
    if (!line.startsWith('| ')) continue;
    const c = cellsOf(line);
    const m = keyRe.exec(c[0] ?? '');
    if (!m) continue;
    const key = m[1];
    if (fromState && !(STATE_KEYS.includes(key) || key === 'MY_WAYS.loadFailed')) continue;
    if (!fromState && !(IF3_PREFIXES.includes(key.split('.')[0]) || EXTRA_KEYS.includes(key))) continue;
    if (c[1] === undefined || c[1].startsWith('(')) continue;
    rows.set(key, c[1].replace(/\*\*/g, '').replace(/`/g, ''));
  }
  return rows;
}

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function build(rows) {
  const keys = [...rows.keys()];
  const lines = keys.map((k) => `  ${q(k)}: ${q(rows.get(k))},`);
  return `// 재미 기능 2(IF3 · 카피 22장) 글의 앱 사본 — scripts/gen-if3-copy.mjs 가 마케팅/카피.md 22장에서 만든다(손으로 고치지 않는다).
//  · 3부-카(IF3-F 축소판) 41키 + IF5-F1 36키(READ_GUIDE 5 · THREE_PILLARS 22 · MEET_SKY 9) + 22-14 네 키 = ${keys.length}키 + 3부-차 \`SIGN_CUSP\`(22-10) 두 줄. check:copy IF3 그룹이 22장 표와 한 글자씩 대조한다.
//  · 쓰지 않는 글(조건부 · 보류): MY_WAYS.off.body · BIRTH_CARD.off.body — 사본에 글만 두고 화면은 쪽이 따로 갈릴 때(MY_WAYS.off.body)만 부른다. BIRTH_CARD.off.body 는 변호사 답 전까지 그리지 않는다.
//  · 이 파일은 check:copy 가 Node 로 바로 읽으므로 경로 별칭 없이 홀로 선다
// 받침이 있으면 앞 글자, 없으면 뒤 글자 — features/inflight/if2Text.josa 와 같은 규칙
const pickJosa = (word: string, a: string, b: string): string => {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? a : b;
};
const JOSA_PAIRS: readonly (readonly [string, string, string])[] = [
  ['을/를', '을', '를'],
  ['이/가', '이', '가'],
  ['은/는', '은', '는'],
  ['과/와', '과', '와'],
];

export const SIGN_CUSP = {
  // 카피 22-10 \`SIGN_CUSP.pair\` = '{별자리 이름}{과/와} {별자리 이름} 사이에 태어났어요.' — 조사는 받침으로
  pair: (a: string, b: string) => \`\${a}\${pickJosa(a, '과', '와')} \${b} 사이에 태어났어요.\`,
  why: '해마다 경계가 하루쯤 달라서 두 별자리를 함께 보여 드려요.',
} as const;

export const IF3_TEXT = {
${lines.join('\n')}
} as const;

export type If3Key = keyof typeof IF3_TEXT;

// {이름} 자리를 채운다. {이름}{을/를} 꼴이면 값의 받침으로 조사도 고른다. 값이 없는 자리는 그대로 둔다
export function t3(key: If3Key, vals: Readonly<Record<string, string>> = {}): string {
  let out: string = IF3_TEXT[key];
  for (const [name, v] of Object.entries(vals)) {
    for (const [pair, a, b] of JOSA_PAIRS) out = out.split(\`{\${name}}{\${pair}}\`).join(v + pickJosa(v, a, b));
    out = out.split(\`{\${name}}\`).join(v);
  }
  return out;
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = readRows();
  if (rows.size !== IF3_KEY_COUNT) {
    console.error(`카피 22장에서 읽은 키 ${rows.size}개 (기대 ${IF3_KEY_COUNT}) — 22장 표가 바뀌었는지 확인하세요`);
    process.exit(1);
  }
  const out = build(rows);
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(IF3_COPY_FILE) ? fs.readFileSync(IF3_COPY_FILE, 'utf8') : '';
    if (cur !== out) {
      console.error('src/content/if3Copy.ts 가 카피 22장과 어긋남 — node scripts/gen-if3-copy.mjs 로 다시 만드세요');
      process.exit(1);
    }
    console.log('if3Copy.ts 최신');
  } else {
    fs.writeFileSync(IF3_COPY_FILE, out);
    console.log(`쓴 파일: ${path.relative(appDir, IF3_COPY_FILE)} (키 ${rows.size})`);
  }
}
