// IF5-F1(사주 마당 · 마일리지): 화면 글의 앱 사본을 만든다. 읽기는 마케팅/카피.md 24장, 쓰기는 src/content/if5Copy.ts 하나.
//  · 24장 24-2 ~ 24-11 표 가운데 첫 칸 끝에 키(`SAJU.…` · `MILEAGE.…` · `REST_HINT.…`)가 있는 줄의 둘째 칸 글을 한 글자도 바꾸지 않고 옮긴다(마크다운 ** · ` 만 걷음). 318키
//  · 24-15-2 표의 새 글은 같은 키를 덮는다(SAJU.status.balanceFailed 마침표 — 앱과 같은 커밋)
//  · IF5-F1b: 24-15-1 표의 새 키 12(네 기둥 칸 이름 5 · {n}시 · {n}분 · {n}세 · 상대와 합쳐 보기 4)를 24-4 ~ 24-6 표 키와 똑같이 읽어 키 수 330 으로 더하고, 24-16-1(M-F2)의 `MILEAGE.shop.locked` · `SAJU.full.label` 둘로 332, IF5-F1c 에서 윤달 `SAJU.cal.day.lunarLeap` · 충전 잠김 둘째 줄 `MILEAGE.shop.lockedKeep` 둘을 더해 334.
//    카피 파일은 앱이 고치지 않으므로(마케팅 몫) 표를 24-4 ~ 24-6 으로 옮기는 일은 기다리지 않는다 — 마케팅이 옮겨도(같은 키 · 같은 글) 키 수는 그대로다
//  · 24-12(금지어) · 24-13(디자인 시안 대응표 — 첫 칸이 '시안 `키`' 꼴) · 24-14 는 읽지 않는다
//  · {…} 자리는 앱이 채운다(if5Copy.t5). 글이 {…} 하나뿐인 줄(40개)은 AI 라이브러리 · 서버 값이 들어오는 자리라 앱 글이 아니다 — 사본에는 틀 그대로 두되 화면은 값을 넣어 쓴다
//  · F1(무료 층)이 쓰는 글과 F2(마일리지 · AI 맞춤 · 동의)가 쓰는 글이 한 사본에 있다. F2 몫 글은 F1 화면이 부르지 않는다(시험이 잡는다)
// 사용: node scripts/gen-if5-copy.mjs          → 파일을 다시 쓴다
//       node scripts/gen-if5-copy.mjs --check  → 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
export const IF5_COPY_FILE = path.join(appDir, 'src', 'content', 'if5Copy.ts');
const COPY_DOC = process.env.CHECK_COPY_DOC ?? path.join(root, '마케팅', '카피.md');

export const IF5_PREFIXES = ['SAJU', 'MILEAGE', 'REST_HINT'];
export const IF5_KEY_COUNT = 334; // 318(24-2 ~ 24-11) + 24-15-1 새 키 12(IF5-F1b) + 24-16-1 새 키 2(M-F2) + F1c 새 키 2(윤달 SAJU.cal.day.lunarLeap · 충전 잠김 둘째 줄 MILEAGE.shop.lockedKeep)

const NL = String.fromCharCode(10);
const cellsOf = (line) => {
  const t = line.trim();
  return t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
};
// 첫 칸 맨 끝의 백틱 키
const keyRe = new RegExp('`((?:' + IF5_PREFIXES.join('|') + ')\\.[A-Za-z0-9_.]+)`\\s*$');

export function readRows(docPath = COPY_DOC) {
  const text = fs.readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');
  const from = text.search(/^## 24\. /m);
  const rest = from >= 0 ? text.slice(from + 5) : '';
  const next = rest.search(/^## \d+\. /m);
  const sec = from >= 0 ? text.slice(from, from + 5 + (next >= 0 ? next : rest.length)) : '';
  const end = sec.search(/^### 24-12\. /m);
  const rows = new Map();
  for (const line of (end >= 0 ? sec.slice(0, end) : sec).split('\n')) {
    if (!line.startsWith('| ')) continue;
    const c = cellsOf(line);
    const m = keyRe.exec(c[0] ?? '');
    if (!m) continue;
    if (c[1] === undefined) continue;
    rows.set(m[1], c[1].replace(/\*\*/g, '').replace(/`/g, ''));
  }
  // 24-15-1(IF5-F1b) 새 키 12 · 24-16-1(M-F2) 새 키 2: 앱 반영 전 꼴 절의 표를 24-4 ~ 24-10 표와 같게 읽는다. 이미 있는 키면(마케팅이 표로 옮긴 뒤) 글이 같아야 하고 키 수는 늘지 않는다
  for (const [head, tail] of [[/^#### 24-15-1\. /m, /^#### 24-15-2\. /m], [/^#### 24-16-1\. /m, /^### 24-17\. |^## \d+\. /m]] ) {
    const a = sec.search(head);
    if (a < 0) continue;
    const after = sec.slice(a + 5);
    const b = after.search(tail);
    for (const line of (b >= 0 ? after.slice(0, b) : after).split(NL)) {
      if (!line.startsWith('| ')) continue;
      const c = cellsOf(line);
      const m = keyRe.exec(c[0] ?? '');
      if (m && c[1] !== undefined) rows.set(m[1], c[1].replace(/\*\*/g, '').replace(/`/g, ''));
    }
  }
  // 24-15-2(앱과 같은 커밋으로 바꿀 줄 — F2 첫 커밋): 이미 있는 키의 새 글만 덮는다
  const from2 = sec.search(/^#### 24-15-2\. /m);
  const to2 = sec.search(/^#### 24-15-3\. /m);
  if (from2 >= 0) {
    for (const line of sec.slice(from2, to2 >= 0 ? to2 : undefined).split('\n')) {
      if (!line.startsWith('| ')) continue;
      const c = cellsOf(line);
      const m = keyRe.exec(c[0] ?? '');
      if (m && c[1] !== undefined && rows.has(m[1])) rows.set(m[1], c[1].replace(/\*\*/g, '').replace(/`/g, ''));
    }
  }
  return rows;
}

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function build(rows) {
  const keys = [...rows.keys()];
  const lines = keys.map((k) => `  ${q(k)}: ${q(rows.get(k))},`);
  return `// 사주 마당 · 마일리지(IF5 · 카피 24장) 글의 앱 사본 — scripts/gen-if5-copy.mjs 가 마케팅/카피.md 24장에서 만든다(손으로 고치지 않는다). ${keys.length}키.
//  · 무료 층(F1)은 MILEAGE.* · SAJU.talk.* · REST_HINT.* · SAJU.card.aiButton 계열을 부르지 않는다 — 그 글은 마일리지 · AI 맞춤(F2)이 부른다. 아직 어느 화면도 안 부르는 키는 '앱 반영 전'(F1b 몫 포함).
//  · 글이 {…} 하나뿐인 키(값 틀)는 AI 라이브러리 · 서버 값이 들어오는 자리다. 화면은 이 틀 대신 값을 쓴다.
//  · check:copy IF5 그룹이 24장 표와 한 글자씩 대조한다. 이 파일은 check:copy 가 Node 로 바로 읽으므로 경로 별칭 없이 홀로 선다
// 받침이 있으면 앞 글자, 없으면 뒤 글자 — 하늘 읽기 글 사본(if3)의 t3 와 같은 규칙
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

export const IF5_TEXT = {
${lines.join('\n')}
} as const;

export type If5Key = keyof typeof IF5_TEXT;

// {이름} 자리를 채운다. {이름}{을/를} 꼴이면 값의 받침으로 조사도 고른다. 값이 없는 자리는 그대로 둔다
export function t5(key: If5Key, vals: Readonly<Record<string, string | number>> = {}): string {
  let out: string = IF5_TEXT[key];
  for (const [name, raw] of Object.entries(vals)) {
    const v = String(raw);
    for (const [pair, a, b] of JOSA_PAIRS) out = out.split(\`{\${name}}{\${pair}}\`).join(v + pickJosa(v, a, b));
    out = out.split(\`{\${name}}\`).join(v);
  }
  return out;
}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = readRows();
  if (rows.size !== IF5_KEY_COUNT) {
    console.error(`카피 24장에서 읽은 키 ${rows.size}개 (기대 ${IF5_KEY_COUNT}) — 24장 표가 바뀌었는지 확인하세요`);
    process.exit(1);
  }
  const out = build(rows);
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(IF5_COPY_FILE) ? fs.readFileSync(IF5_COPY_FILE, 'utf8') : '';
    if (cur !== out) {
      console.error('src/content/if5Copy.ts 가 카피 24장과 어긋남 — node scripts/gen-if5-copy.mjs 로 다시 만드세요');
      process.exit(1);
    }
    console.log('if5Copy.ts 최신');
  } else {
    fs.writeFileSync(IF5_COPY_FILE, out);
    console.log(`쓴 파일: ${path.relative(appDir, IF5_COPY_FILE)} (키 ${rows.size})`);
  }
}
