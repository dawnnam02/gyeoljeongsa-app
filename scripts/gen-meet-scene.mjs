// D46-A 만남 장면 그림(디자인 D46-D 원본 · 본인 D-206 연출 ④ '예능 결') → 앱 그림 데이터. 읽기 전용 원본 → 쓰기 1개, 네트워크 없음.
//  원본: ../디자인/D46_만남장면/원본/scene.js(장소 10곳 · 고정 두 인물 생성기, node 겸용) — 이 파일은 원본을 고치지 않고 불러 쓴다
//  출력: assets/illustrations/d46meet.json
//   · places[키] = { prop, base, fore } — base = 하늘 · 먼 곳 · 가운데 · 의자(L0 ~ L3) + 먼저 앉은 사람(A) 몸, fore = 앞(L4, 없으면 null)
//   · people = 움직이는 부품(디자인 6장 메모의 pA · bS · bSb · lgL/lgR · bT · ft · fa · pr): 모든 장소에 같은 그림이라 한 벌만
//   · light = 저녁 빛 + 가장자리 어둠(glow · vig) 한 장 · parts = 부품마다 잘라 담는 칸(장면 좌표 360×480)과 도는 축
//  · 그림 색은 원본(4안 색 · 인물 1안 색)에만 있고 이 에셋 안에만 있다 — src 코드에는 색 0(check:tokens B)
//  · 움직임은 앱이 RN View 의 transform · opacity 로 한다(SVG 속성 움직임 0). 그래서 부품마다 따로 그린 SVG 를 칸에 겹쳐 놓는다
//  · 시작 모습으로 고친 것: 얼굴(ft)은 정면(시선 0 — 앱이 옮김) · 걸어오는 사람(bSs)은 보이게(원본 정지 그림에서는 숨김)
// 사용: node scripts/gen-meet-scene.mjs   (디자인 원본이 바뀌면 다시 돌린다)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcFile = path.join(appDir, '..', '디자인', 'D46_만남장면', '원본', 'scene.js');
const outFile = path.join(appDir, 'assets', 'illustrations', 'd46meet.json');
const S = createRequire(import.meta.url)(srcFile);

// ── 작은 XML 나무(생성기 출력은 태그 · 큰따옴표 속성뿐, 글 0) ──
function parse(xml) {
  const root = { tag: '#root', attrs: [], kids: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let at = 0;
  for (const m of xml.matchAll(re)) {
    if (xml.slice(at, m.index).trim()) throw new Error(`글 조각이 있어요: ${xml.slice(at, m.index).slice(0, 40)}`);
    at = m.index + m[0].length;
    if (m[1]) {
      const top = stack.pop();
      if (top.tag !== m[2]) throw new Error(`닫는 태그가 맞지 않아요: ${top.tag} / ${m[2]}`);
      continue;
    }
    const node = { tag: m[2], attrs: [...m[3].matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]), kids: [] };
    stack[stack.length - 1].kids.push(node);
    if (!m[4]) stack.push(node);
  }
  if (stack.length !== 1) throw new Error('닫히지 않은 태그가 있어요');
  return root.kids[0];
}
const attr = (n, k) => n.attrs.find((a) => a[0] === k)?.[1];
const cls = (n) => attr(n, 'class');
const without = (n, keys) => ({ ...n, attrs: n.attrs.filter(([k]) => !keys.includes(k)) });
const serialize = (n) => {
  const a = n.attrs.map(([k, v]) => ` ${k}="${v}"`).join('');
  return n.kids.length ? `<${n.tag}${a}>${n.kids.map(serialize).join('')}</${n.tag}>` : `<${n.tag}${a}/>`;
};
// 조건에 맞는 첫 마디까지의 길(뿌리 → 그 마디)
function pathTo(n, pred, trail = []) {
  const here = [...trail, n];
  if (pred(n, trail)) return here;
  for (const k of n.kids) {
    const p = pathTo(k, pred, here);
    if (p) return p;
  }
  return null;
}
// 가지치기: 조건에 맞는 마디(와 아래)를 뺀 복사본
const prune = (n, pred, trail = []) => ({ ...n, kids: n.kids.filter((k) => !pred(k, [...trail, n])).map((k) => prune(k, pred, [...trail, n])) });
// 한 마디만 남기기: 뿌리에서 그 마디까지 조상(변환 · 투명도 속성 그대로)과 그 마디 아래 전부. 조상의 다른 아이는 뺀다
function isolate(n, pred, edit = (x) => x) {
  const p = pathTo(n, pred);
  if (!p) throw new Error('찾는 부품이 없어요');
  let node = edit(p[p.length - 1]);
  for (let i = p.length - 2; i >= 0; i -= 1) node = { ...p[i], kids: [node] };
  return node;
}
// class 는 앱에서 쓰지 않는다 · 걸어오는 사람 묶음의 opacity="0"(원본 정지 그림용)은 뺀다
const tidy = (n) => {
  const base = cls(n) === 'bSs' ? without(n, ['opacity']) : n;
  return { ...without(base, ['class']), kids: n.kids.map(tidy) };
};
const inPA = (trail) => trail.some((t) => cls(t) === 'pA');
const inBT = (trail) => trail.some((t) => cls(t) === 'bT');

// 한 층 → <svg viewBox="칸"> 글. 쓰는 그라데이션만 defs 에 담는다
function svgOf(body, defs, box) {
  const text = serialize(tidy(body));
  const used = defs.kids.filter((d) => text.includes(`url(#${attr(d, 'id')})`));
  const head = used.length ? `<defs>${used.map(serialize).join('')}</defs>` : '';
  if (/filter|mix-blend|non-scaling-stroke|<text/.test(text)) throw new Error('react-native-svg 에서 안 되는 속성이 있어요');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}">${head}${text}</svg>`;
}

// ── 부품 칸(장면 좌표 · 원본 scene.js 좌표에서 셈) ──
const W = S.W;
const H = S.H;
const A = [S.AX, S.SEAT]; // 먼저 앉은 사람(왼쪽 · 남 · 종이컵)
const BS = [S.BX, S.FLOOR]; // 걸어오는 사람(선 모습, 원점 = 두 발 가운데 바닥)
const BT = [S.BX, S.SEAT]; // 걸어온 사람(앉은 모습)
const ELBOW = [A[0] - 26, A[1] - 28]; // 원본 page.js cine: 팔꿈치 기준 -109.5° → 0
const HAND = [A[0] - 11, A[1] - 6]; // 컵은 손 기준으로 반대로 돌아 똑바로(앱은 이동만)
const FACE = (o) => [o[0] - 40 + 0.4 * 77 - 6, o[1] - 142 + 0.4 * 86, 24, 24].map((v) => Math.round(v)); // 눈 · 코 · 입 · 눈썹(머리 0.4배)
const parts = {
  cam: { origin: [180, 300] }, // 원본 cine: 장면 전체 1 → 1.1 의 기준점
  aFore: { box: [ELBOW[0] - 34, ELBOW[1] - 34, 68, 68], pivot: ELBOW }, // 칸 가운데 = 팔꿈치
  aCup: { box: [HAND[0] - 10, HAND[1] - 18, 20, 24], pivot: HAND, elbow: ELBOW },
  aFace: { box: FACE(A), turn: 7 * 0.4 }, // 원본 turn 7(머리 단위) = 장면 2.8
  bBody: { box: [BS[0] - 36, BS[1] - 226, 72, 136] },
  bLegL: { box: [BS[0] - 13 - 24, BS[1] - 102 - 106, 48, 212], pivot: [BS[0] - 13, BS[1] - 102], swing: 7 },
  bLegR: { box: [BS[0] + 13 - 24, BS[1] - 102 - 106, 48, 212], pivot: [BS[0] + 13, BS[1] - 102], swing: -7 },
  bSit: { box: [BT[0] - 36, BT[1] - 146, 72, 210] },
  bFace: { box: FACE(BT), turn: -7 * 0.4 },
};
const FULL = [0, 0, W, H];

const out = { about: '', W, H, parts, light: '', people: {}, places: {}, order: [] };
const peopleSeen = {};
for (const pl of S.PLACES) {
  const uid = `m${pl.id}`;
  const tree = parse(S.scene(pl.id, 'light', { uid, cine: true, bubble: false }));
  const defs = tree.kids.find((k) => k.tag === 'defs');
  const cam = tree.kids.find((k) => cls(k) === 'cam');
  const L4 = pathTo(cam, (n) => cls(n) === 'L4').pop();
  // 바탕: 사람 층에서 걸어오는 사람 · 앉는 사람 · A 의 팔뚝(컵) · 얼굴 부품을 빼고, 앞(L4)도 뺀다
  const base = prune(cam, (n, trail) => ['bS', 'bT', 'fa', 'L4'].includes(cls(n)) || (cls(n) === 'ft' && inPA(trail)));
  const fore = L4.kids.length ? svgOf(isolate(cam, (n) => cls(n) === 'L4'), defs, FULL) : null;
  const faceStart = (n) => without(n, ['transform']); // 정면에서 시작(앱이 시선을 옮김)
  const fa = (trail) => trail.some((t) => cls(t) === 'fa');
  const people = {
    aFore: svgOf(prune(isolate(cam, (n) => cls(n) === 'fa'), (n, trail) => fa([...trail]) && (cls(n) === 'pr' || n.tag === 'ellipse')), defs, parts.aFore.box),
    aCup: svgOf(prune(isolate(cam, (n) => cls(n) === 'fa'), (n, trail) => cls(trail[trail.length - 1] ?? {attrs: []}) === 'fa' && n.tag === 'path'), defs, parts.aCup.box),
    aFace: svgOf(isolate(cam, (n, trail) => cls(n) === 'ft' && inPA(trail), faceStart), defs, parts.aFace.box),
    bBody: svgOf(prune(isolate(cam, (n) => cls(n) === 'bSb'), (n) => cls(n) === 'lgL' || cls(n) === 'lgR'), defs, parts.bBody.box),
    bLegL: svgOf(isolate(cam, (n) => cls(n) === 'lgL'), defs, parts.bLegL.box),
    bLegR: svgOf(isolate(cam, (n) => cls(n) === 'lgR'), defs, parts.bLegR.box),
    bSit: svgOf(prune(isolate(cam, (n) => cls(n) === 'bT'), (n) => cls(n) === 'ft'), defs, parts.bSit.box),
    bFace: svgOf(isolate(cam, (n, trail) => cls(n) === 'ft' && inBT(trail), faceStart), defs, parts.bFace.box),
  };
  // 사람 부품은 모든 장소에 같아야 한다(소품만 컵 · 책으로 갈림)
  for (const [k, v] of Object.entries(people)) {
    const key = k === 'aCup' ? `aCup_${pl.prop}` : k;
    if (peopleSeen[key] !== undefined && peopleSeen[key] !== v) throw new Error(`${pl.key}: 사람 부품 ${key} 가 장소마다 달라요`);
    peopleSeen[key] = v;
  }
  if (!out.light) {
    const glow = tree.kids.find((k) => cls(k) === 'glow');
    const vig = tree.kids.find((k) => cls(k) === 'vig');
    // 빛 한 장: 원본 끝 값(glow .5 · vig .45) 그대로 담고, 앱은 이 층의 투명도를 0.3 → 1 로(원본 시작 값 0.1 · 0.15 에 가깝게)
    out.light = svgOf({ tag: 'g', attrs: [], kids: [glow, vig] }, defs, FULL).split(`${uid}w`).join('mlw').split(`${uid}v`).join('mlv');
  }
  out.places[pl.key] = { prop: pl.prop, base: svgOf(base, defs, FULL), fore };
  out.order.push(pl.key);
}
out.people = peopleSeen;
out.about = 'D46-A 만남 장면 그림 — scripts/gen-meet-scene.mjs 가 디자인/D46_만남장면/원본/scene.js(D46-D, 본인 D-206 연출 ④)에서 만든다. 손으로 고치지 않는다. 장면 좌표 360×480 · 장소 10곳 차례 = order(K27 5-3 · 카피 16-1) · 부품 칸 = parts';
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 1)}\n`);
console.log(`만남 장면 ${out.order.length}곳 · 사람 부품 ${Object.keys(out.people).length}개 → ${path.relative(appDir, outFile)} (${fs.statSync(outFile).size} B)`);
