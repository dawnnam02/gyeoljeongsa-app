// IF5-F1b ⓕ: 사주 마당 · 마일리지 디자인 아이콘 22(디자인/IF5/원본/icon_*.svg)를 앱 경로 표로 옮긴다. 쓰기는 src/features/saju/if5IconPaths.ts 하나.
//  · 원본 도형(rect · circle · path)을 24 격자 path 글자로 바꾼다. 선 색(#…) · 굵기는 버린다 — 앱 Icon 부품이 토큰 색 · 굵기(1.5 / 작은 크기 1.75)를 입힌다(토큰 밖 색 0)
//  · 원본 파일 이름 icon_<이름>.svg → 이름. 손으로 고치지 않는다
// 사용: node scripts/gen-if5-assets.mjs          → 파일을 다시 쓴다
//       node scripts/gen-if5-assets.mjs --check  → 최신인지 보기만(어긋나면 종료 코드 1 · 원본이 없으면 건너뜀)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.resolve(appDir, '..', '디자인', 'IF5', '원본');
export const ICON_OUT = path.join(appDir, 'src', 'features', 'saju', 'if5IconPaths.ts');

const NAMES_KO = {
  bag: '가방', boarding: '탑승권', calendar: '달력', chat: '대화', check: '체크', chev_down: '아래로', chev_left: '왼쪽으로', chev_right: '오른쪽으로', chev_up: '위로', close: '닫기', coin: '마일리지',
  diamond: '마름모', doc: '문서', face: '얼굴', help: '도움말', info: '안내', lock: '자물쇠', person: '사람', pillars: '기둥', send: '보내기', settings: '설정', sun: '해',
};
const num = (v) => Number(v);
const fmt = (n) => String(Math.round(n * 1000) / 1000);
const attr = (tag, name) => {
  const m = new RegExp(String.raw`\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};
function shapeToPath(tag) {
  const kind = /^<(\w+)/.exec(tag)?.[1];
  if (kind === 'path') return attr(tag, 'd');
  if (kind === 'circle') {
    const [cx, cy, r] = [num(attr(tag, 'cx')), num(attr(tag, 'cy')), num(attr(tag, 'r'))];
    return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0z`;
  }
  if (kind === 'rect') {
    const [x, y, w, h] = [num(attr(tag, 'x')), num(attr(tag, 'y')), num(attr(tag, 'width')), num(attr(tag, 'height'))];
    const r = num(attr(tag, 'rx') ?? '0');
    return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}V${fmt(y + h - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)}H${fmt(x + r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)}z`;
  }
  throw new Error(`지원하지 않는 도형 ${kind}`);
}

export function buildIcons(dir = SRC_DIR) {
  const files = fs.readdirSync(dir).filter((f) => /^icon_.+\.svg$/.test(f)).sort();
  const lines = files.map((f) => {
    const key = f.replace(/^icon_/, '').replace(/\.svg$/, '');
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    const parts = [...svg.matchAll(/<(?:path|circle|rect)\b[^>]*>/g)].map((m) => shapeToPath(m[0]));
    return `  ${key}: { name: ${JSON.stringify(NAMES_KO[key] ?? key)}, parts: [${parts.map((d) => `{ role: 'line', d: ${JSON.stringify(d)} }`).join(', ')}] },`;
  });
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if5-assets.mjs (IF5-F1b ⓕ)',
    '// 원본: 디자인/IF5/원본/icon_*.svg 22개(24 격자 · 선 1.5 · 둥근 끝). 색은 버리고 앱 Icon 부품이 토큰 색을 입힌다',
    "import type { IconPart } from '@/components/iconPaths';",
    '',
    'export const IF5_ICON_PATHS = {',
    ...lines,
    '} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;',
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('원본 디자인/IF5/원본 을 찾지 못했어요(저장소 복제본에서는 이 점검을 건너뛰어요).');
    process.exit(process.argv.includes('--check') ? 0 : 2);
  }
  const out = buildIcons();
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(ICON_OUT) || fs.readFileSync(ICON_OUT, 'utf8') !== out) {
      console.error('src/features/saju/if5IconPaths.ts 가 디자인 원본과 어긋남 — node scripts/gen-if5-assets.mjs 로 다시 만드세요');
      process.exit(1);
    }
    console.log('if5 아이콘 최신');
  } else {
    fs.writeFileSync(ICON_OUT, out);
    console.log(`쓴 파일: ${path.relative(appDir, ICON_OUT)} (아이콘 ${out.split('\n').filter((l) => /^ {2}\w+: \{/.test(l)).length})`);
  }
}
