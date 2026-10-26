// 등급 숫자 0 점검(W9, 청사진_v5 6-2 · 결정 #15 · T-9). 읽기 전용, 네트워크 없음. npm run check:copy 끝에 같이 돈다.
//  화면에 나갈 글(문자열 · 템플릿)과 그림 사용에서 '등급 숫자 · 순서 말 · 숫자 그림'을 찾는다. 주석은 보지 않는다. 시험 파일은 보지 않는다.
//   A. '{숫자}등급' · '${…}등급' · '1등급부터' 같은 단계 숫자 글
//   B. 순서 말: '숫자가 작을수록' · '위 등급' · '아래 등급' · '높은 등급' · '낮은 등급' · '등급을 올리' · '등급이 오르' · '등급이 내려'
//   C. 숫자가 그려진 tier-N.png(TIER_BADGES)를 쓰는 곳(정의한 theme/uiAssets.ts 는 빼고)
//   D. 숫자가 들어가는 카피 함수 부르기(BADGE16.chip · a11y · bubbleTitle · detail · direction · bubbleNote, GRADE16.big · barLine · historyLine · historyFirst · howGrid · howTop · howFew · direction)
//  판정: 등급 표시 부품(features/grade/**)은 0 이어야 통과. 그 밖의 파일은 아래 BASELINE(10-22 기준, W10 앱 A 목록 재료) 수를 넘으면 실패 —
//        새로 생기는 곳을 막고, 남은 곳은 [남음] 줄로 보인다. 남은 곳을 고치면 BASELINE 에서 그 줄을 지운다(수가 줄면 [참고]로 알려 준다).
// 사용: node scripts/check-grade-icon.mjs   (npm run check:grade)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(APP, 'src');
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');

// 0 이어야 하는 곳(이 점검의 주인 파일)
const STRICT_DIRS = ['features/grade/'];
// 10-22 남은 곳(파일 → 걸린 수). W10(앱 A)이 숨기거나 카피 담당이 카피.md 16장과 함께 지우면 줄을 지운다
const BASELINE = {
  'content/legalPrivacy.ts': 5, // 처리방침 등급 설명(법무 · 생성 파일)
  'content/legalTerms.ts': 11, // 약관 등급 설명(법무 · 생성 파일)
  'content/productCopy.ts': 2, // 등급 구독 상품 설명
  'content/shopCopy.ts': 25, // QP-A 32 → 25(구독 · 위 등급 줄 지움) · 카피 16장 원본(GRADE16 · BADGE16 · SETTINGS16 · 상점) — 등급 표시 부품은 더 부르지 않는다
  'features/recs/CandidateScreen.tsx': 3, // 10 상대 상세 배지 글(V5: 배지 삭제)
  'features/recs/RecommendationsScreen.tsx': 1, // 09 카드 스크린리더 이름(V5: 09 숨김)
};

const RULES = [
  ['A', /\d\s*등급/g],
  ['A', /\$\{[^}]*\}\s*등급/g],
  ['A', /(?<!\$)\{n\}\s*등급/g],
  ['B', /숫자가 작을수록|(?:위|아래|높은|낮은) 등급|등급을 올리|등급이 오르|등급이 내려/g],
  ['C', /\bTIER_BADGES\b/g],
  ['D', /\bBADGE16\.(?:chip|a11y|bubbleTitle|detail|direction|bubbleNote)\b/g],
  ['D', /\bGRADE16\.(?:big|barLine|historyLine|historyFirst|howGrid|howTop|howFew|direction)\b/g],
];
const SKIP_FILES = new Set(['theme/uiAssets.ts']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// 주석 지우기: /* … */ 와 따옴표 밖의 // 뒤
function stripComments(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => {
      let q = null;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (q) {
          if (c === '\\') i += 1;
          else if (c === q) q = null;
        } else if (c === "'" || c === '"' || c === '`') q = c;
        else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

// 시험에서도 쓰려고 내보낸다
export function findHits(text, file = '') {
  if (SKIP_FILES.has(file)) return [];
  const body = stripComments(text);
  const hits = [];
  for (const [group, re] of RULES) {
    for (const m of body.matchAll(re)) {
      const line = body.slice(0, m.index).split('\n').length;
      hits.push({ group, line, text: m[0] });
    }
  }
  return hits;
}

function main() {
  let fail = 0;
  const seen = {};
  for (const f of walk(SRC)) {
    const r = rel(f);
    const hits = findHits(fs.readFileSync(f, 'utf8'), r);
    if (hits.length === 0) continue;
    seen[r] = hits.length;
    const strict = STRICT_DIRS.some((d) => r.startsWith(d));
    const base = BASELINE[r];
    const where = hits.map((h) => `${h.group}:${h.line} ${h.text}`).join(' · ');
    if (strict) {
      fail += 1;
      console.log(`[실패] ${r} — 등급 표시 부품에 등급 숫자 · 순서 말 ${hits.length}곳: ${where}`);
    } else if (base === undefined || hits.length > base) {
      fail += 1;
      console.log(`[실패] ${r} — 새로 생긴 등급 숫자 · 순서 말 ${hits.length}곳(기준 ${base ?? 0}): ${where}`);
    } else {
      console.log(`[남음] ${r} — ${hits.length}곳(W10 목록): ${where}`);
    }
  }
  for (const [r, n] of Object.entries(BASELINE)) {
    if ((seen[r] ?? 0) < n) console.log(`[참고] ${r} — 기준 ${n}곳 → 지금 ${seen[r] ?? 0}곳. 다 고쳤으면 BASELINE 줄을 줄이거나 지운다`);
  }
  console.log(fail === 0 ? '[통과] W9. 등급 숫자 0(등급 표시 부품) · 새로 생긴 곳 0' : `[실패] W9. ${fail}개 파일`);
  process.exit(fail === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
