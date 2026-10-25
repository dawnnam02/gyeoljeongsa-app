// D42-I 그림 4안 확정본(요즘 여행 포스터, D-172) → 앱 그림 데이터. 읽기 전용 원본 → 쓰기 1개, 네트워크 없음.
//  원본: ../디자인/D42_새판/그림/4안_원본/NN_이름.svg · NN_이름_다크.svg (320×240, 필터 0 · linearGradient · clipPath 만)
//  출력: assets/illustrations/d42i.json  { 장면 키: { light: svg 글, dark: svg 글 } }
//  · 그림 색은 그림 원본(에셋) 안에만 있다 — PNG 그림과 같은 자리. src 코드에는 색 0(check:tokens B)
//  · 고치는 것: xml 머리 · 바깥 width/height · aria-hidden/focusable 를 빼고(크기는 부품이 정한다), id 를 장면마다 다르게(웹에서 같은 쪽 id 겹침 0)
// 사용: node scripts/gen-illustrations.mjs   (원본 SVG 가 바뀌면 다시 돌린다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(appDir, '..', '디자인', 'D42_새판', '그림', '4안_원본');
const outFile = path.join(appDir, 'assets', 'illustrations', 'd42i.json');

// 파일 번호 → 앱 장면 키(디자인 index.html SCENES2 순서)
const SCENES = {
  '01': 'onboarding1',
  '02': 'onboarding2',
  '03': 'onboarding3',
  '04': 'waiting',
  '05': 'ticket',
  '06': 'reveal',
  '07': 'noMatch',
  '08': 'error',
  '09': 'preopen',
  '10': 'chatEmpty',
  '11': 'soldOut',
  '12': 'organizing',
};

function clean(svg, prefix) {
  let s = svg.replace(/^<\?xml[^>]*\?>\s*/, '').trim();
  s = s.replace(/<svg ([^>]*)>/, (_m, attrs) => `<svg ${attrs.replace(/\s*(width|height|aria-hidden|focusable)="[^"]*"/g, '').trim()}>`);
  const ids = [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) s = s.split(`id="${id}"`).join(`id="${prefix}${id}"`).split(`url(#${id})`).join(`url(#${prefix}${id})`);
  if (/filter|mix-blend|non-scaling-stroke/.test(s)) throw new Error(`${prefix}: react-native-svg 에서 안 되는 속성이 있어요`);
  return s;
}

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.svg'));
const out = {};
for (const [no, key] of Object.entries(SCENES)) {
  const light = files.find((f) => f.startsWith(`${no}_`) && !f.endsWith('_다크.svg'));
  const dark = files.find((f) => f.startsWith(`${no}_`) && f.endsWith('_다크.svg'));
  if (!light || !dark) throw new Error(`${no} 장면 원본(라이트 · 다크)이 모두 있어야 해요`);
  out[key] = {
    light: clean(fs.readFileSync(path.join(srcDir, light), 'utf8'), `d42${no}l`),
    dark: clean(fs.readFileSync(path.join(srcDir, dark), 'utf8'), `d42${no}d`),
  };
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
console.log(`그림 ${Object.keys(out).length}장면 × 2(라이트 · 다크) → ${path.relative(appDir, outFile)} (${fs.statSync(outFile).size} B)`);
