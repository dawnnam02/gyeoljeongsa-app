// 디자인 토큰 점검(F0 통과 조건 3 · 최종 청사진 F-3). 읽기 전용, 네트워크 없음.
//  A. src/theme/tokens.ts 가 디자인/가이드.md 8장 코드 값과 같은가 (const 블록마다 비교)
//  B. 색(#RRGGBB)이 tokens.ts 밖에 있는가 — grep "#[0-9A-F]{6}" src = tokens.ts뿐
//  C. src/theme 밖 코드가 글자 크기 · 행간 · 글꼴 · 간격 · 둥글기 숫자를 직접 쓰는가
//  D. app.json 의 색이 토큰 색인가
//  E. 화면 바탕 그라데이션 bgGrad 가 한 곳(값 tokens.ts · 그리기 components/Screen.tsx)인가 (F17)
// 사용: node scripts/check-tokens.mjs [가이드.md 경로]
// 종료 코드: 0 통과 · 1 실패 · 2 가이드 파일이 없어 A를 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(appDir, 'src');
const tokensFile = path.join(srcDir, 'theme', 'tokens.ts');
const guideFile = path.resolve(process.argv[2] ?? path.join(appDir, '..', '디자인', '가이드.md'));

const rel = (file) => path.relative(appDir, file).split(path.sep).join('/');
const results = [];
const record = (status, title, detail = '') => {
  results.push({ status, title });
  console.log(`[${status}] ${title}${detail ? `\n       ${detail.split('\n').join('\n       ')}` : ''}`);
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

// 주석을 지우고 공백을 없애 값만 비교한다
const normalize = (text) => text.replace(/\/\/.*$/gm, '').replace(/\s+/g, '');

// "export const NAME = …" 덩어리를 이름별로 자른다
function constBlocks(text) {
  const marks = [...text.matchAll(/export const (\w+)\s*=/g)];
  return Object.fromEntries(
    marks.map((m, i) => [m[1], normalize(text.slice(m.index, marks[i + 1]?.index ?? text.length))]),
  );
}

const tokensText = fs.readFileSync(tokensFile, 'utf8');

// ── A. 가이드 8장과 비교 ─────────────────────────────────────────────
let guideMissing = false;
if (!fs.existsSync(guideFile)) {
  guideMissing = true;
  record('미확인', 'A. tokens.ts = 가이드 8장', `가이드 파일이 없어 비교하지 못했어요: ${guideFile}`);
} else {
  const guide = fs.readFileSync(guideFile, 'utf8');
  const start = guide.search(/^## 8\./m);
  const fence = start < 0 ? null : /```ts\r?\n([\s\S]*?)```/.exec(guide.slice(start));
  if (!fence) {
    record('실패', 'A. tokens.ts = 가이드 8장', '가이드에서 "## 8." 아래 ts 코드 블록을 찾지 못했어요.');
  } else {
    const want = constBlocks(fence[1]);
    const have = constBlocks(tokensText);
    const names = [...new Set([...Object.keys(want), ...Object.keys(have)])];
    const diff = names.filter((name) => want[name] !== have[name]);
    if (diff.length === 0) {
      record('통과', `A. tokens.ts = 가이드 8장 (const ${names.length}개: ${names.join(' · ')} 값이 같음)`);
    } else {
      record(
        '실패',
        'A. tokens.ts ≠ 가이드 8장',
        diff.map((name) => `${name}: ${want[name] ? (have[name] ? '값이 다름' : 'tokens.ts에 없음') : '가이드에 없음'}`).join('\n'),
      );
    }
  }
}

// ── B. 색은 tokens.ts 에만 ────────────────────────────────────────────
const sources = walk(srcDir);
const hex = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})\b/;
const hexFiles = sources.filter((file) => hex.test(fs.readFileSync(file, 'utf8'))).map(rel);
if (hexFiles.length === 1 && hexFiles[0] === 'src/theme/tokens.ts') {
  record('통과', `B. 색 #RRGGBB 는 tokens.ts 에만 있음 (src ${sources.length}개 파일 검사)`);
} else {
  record('실패', 'B. 색 #RRGGBB 가 tokens.ts 밖에 있음', `찾은 파일: ${hexFiles.join(', ') || '없음(tokens.ts 에도 없음)'}`);
}

// ── C. 화면 코드의 숫자 직접 쓰기 ─────────────────────────────────────
const themeDir = path.join(srcDir, 'theme');
const testDir = path.join(srcDir, '__tests__');
const styleNumbers = [
  [/\bfontSize\s*:\s*\d/, 'fontSize 숫자'],
  [/\blineHeight\s*:\s*\d/, 'lineHeight 숫자'],
  [/\bfontFamily\s*:\s*['"`]/, 'fontFamily 글자'],
  [/\b(?:padding|margin)(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?\s*:\s*[1-9]/, 'padding · margin 숫자'],
  [/\b(?:gap|rowGap|columnGap)\s*:\s*[1-9]/, 'gap 숫자'],
  [/\bborder(?:Top|Bottom|Left|Right)?(?:Start|End)?Radius\s*:\s*[1-9]/, 'borderRadius 숫자'],
  [/\b(?:rgb|rgba|hsl|hsla)\(/, 'rgb · hsl 색'],
];
const direct = [];
for (const file of sources) {
  if (file.startsWith(themeDir) || file.startsWith(testDir)) continue;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const [pattern, label] of styleNumbers) if (pattern.test(code)) direct.push(`${rel(file)}:${i + 1} ${label}`);
  });
}
if (direct.length === 0) {
  record('통과', 'C. src/theme 밖에 글자 크기 · 행간 · 글꼴 · 간격 · 둥글기 숫자를 직접 쓴 곳 없음');
} else {
  record('실패', `C. 토큰 밖 숫자 ${direct.length}곳`, direct.join('\n'));
}

// ── D. app.json 색 ────────────────────────────────────────────────────
const tokenColors = new Set([...tokensText.matchAll(/'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1].toUpperCase()));
const appJson = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8'));
const jsonColors = [];
(function collect(node) {
  if (typeof node === 'string') {
    if (/^#[0-9a-f]{3,8}$/i.test(node)) jsonColors.push(node);
  } else if (node && typeof node === 'object') Object.values(node).forEach(collect);
})(appJson);
const foreign = jsonColors.filter((c) => !tokenColors.has(c.toUpperCase()));
if (foreign.length === 0) {
  record('통과', `D. app.json 색 ${jsonColors.length}곳이 모두 토큰 색 (${[...new Set(jsonColors.map((c) => c.toUpperCase()))].join(' ')})`);
} else {
  record('실패', 'D. app.json 에 토큰이 아닌 색이 있음', foreign.join(' '));
}

// ── E. 화면 바탕 bgGrad 는 한 곳(F17 · 브랜드색_v2 6장) ───────────────
//  값은 tokens.ts 의 bgGrad 하나, 그리는 곳(expo-linear-gradient)은 화면 공통 감싸개 components/Screen.tsx 하나
const linearFiles = sources.filter((file) => /from\s+['"]expo-linear-gradient['"]/.test(fs.readFileSync(file, 'utf8'))).map(rel);
const gradDefs = sources.filter((file) => /export const bgGrad\b/.test(fs.readFileSync(file, 'utf8'))).map(rel);
if (linearFiles.join() === 'src/components/Screen.tsx' && gradDefs.join() === 'src/theme/tokens.ts') {
  record('통과', 'E. bgGrad 값은 tokens.ts 한 곳 · 그라데이션은 components/Screen.tsx 한 곳에서만 그린다');
} else {
  record('실패', 'E. bgGrad 가 한 곳이 아님', `값: ${gradDefs.join(', ') || '없음'} · 그리는 파일: ${linearFiles.join(', ') || '없음'}`);
}

// ── 요약 ──────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === '실패').length;
const unknown = results.filter((r) => r.status === '미확인').length;
console.log(`\n토큰 점검: 통과 ${results.filter((r) => r.status === '통과').length} · 실패 ${failed} · 미확인 ${unknown}`);
process.exit(failed > 0 ? 1 : guideMissing ? 2 : 0);
