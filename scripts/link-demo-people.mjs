// 데모 인물 사진 72장 연결(F24 · 청사진 v4 10-5 P9). 무료 · 네트워크 없음.
//  B24 가 만든 디자인/데모인물/앱용/p01_face … p24_free(.webp · .png · .jpg)를 app/assets/demo/people/ 로 옮기고
//  src/demo/peoplePhotoFiles.ts(사진 키 → require)를 다시 만든다. 이 목록은 데모 모드에서만 불러온다(src/demo/peoplePhotos.ts).
//  쓰는 법:
//    node scripts/link-demo-people.mjs            72장이 모두 있으면 옮기고 목록을 만든다(하나라도 없으면 아무것도 바꾸지 않고 빠진 것을 알려 줌)
//    node scripts/link-demo-people.mjs --check    옮기지 않고 몇 장 있는지 · 크기만 본다
//    node scripts/link-demo-people.mjs --src <폴더>   다른 폴더에서 옮긴다(시험용)
//    node scripts/link-demo-people.mjs --clear    목록을 비우고 app/assets/demo/people 의 사진을 지운다(자리 이름만으로 되돌림)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(APP, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const SRC = path.resolve(opt('--src') ?? path.join(ROOT, '디자인', '데모인물', '앱용'));
const DEST = path.join(APP, 'assets', 'demo', 'people');
const LIST = path.join(APP, 'src', 'demo', 'peoplePhotoFiles.ts');
const EXTS = ['.webp', '.png', '.jpg', '.jpeg'];
const SLOTS = ['face', 'full', 'free'];
const KEYS = Array.from({ length: 24 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`).flatMap((p) => SLOTS.map((s) => `${p}_${s}`));
const HEAD = [
  '// 데모 인물 사진 파일 목록 — scripts/link-demo-people.mjs 가 만든다. 손으로 고치지 않는다.',
  "//  · 이 파일은 데모 모드에서만 불러온다(demo/peoplePhotos.ts). 실서버 번들에는 들어가지 않는다",
];

function writeList(entries) {
  const body = entries.length
    ? [
        'export const PEOPLE_PHOTO_FILES: Readonly<Record<string, number>> = {',
        ...entries.map(([key, file]) => `  ${key}: require('../../assets/demo/people/${file}'),`),
        '};',
      ]
    : [
        "//  · 지금: 자리 이름만(사진 0장). B24 의 디자인/데모인물/앱용 72장이 생기면 node scripts/link-demo-people.mjs 로 app/assets/demo/people/ 에 옮기고 이 목록을 채운다",
        'export const PEOPLE_PHOTO_FILES: Readonly<Record<string, number>> = {};',
      ];
  fs.writeFileSync(LIST, [...HEAD, ...body, ''].join('\n'), 'utf8');
}

const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

if (flag('--clear')) {
  if (fs.existsSync(DEST)) for (const f of fs.readdirSync(DEST)) if (/^p\d\d_(face|full|free)\./.test(f)) fs.rmSync(path.join(DEST, f));
  writeList([]);
  console.log('목록을 비웠어요(자리 이름만). app/assets/demo/people 의 사진을 지웠어요.');
  process.exit(0);
}

const found = new Map();
const extra = [];
if (fs.existsSync(SRC)) {
  for (const f of fs.readdirSync(SRC)) {
    const ext = path.extname(f).toLowerCase();
    const key = path.basename(f, path.extname(f));
    if (!EXTS.includes(ext)) continue;
    if (!KEYS.includes(key)) {
      extra.push(f);
      continue;
    }
    if (found.has(key)) {
      console.error(`같은 사진이 두 가지 형식으로 있어요: ${found.get(key)} · ${f}`);
      process.exit(1);
    }
    found.set(key, f);
  }
}
const missing = KEYS.filter((k) => !found.has(k));
const sizes = [...found.values()].map((f) => fs.statSync(path.join(SRC, f)).size);
const total = sizes.reduce((a, b) => a + b, 0);
const big = [...found.values()].filter((f) => fs.statSync(path.join(SRC, f)).size > 200 * 1024);
console.log(`원본 폴더: ${SRC}`);
console.log(`있는 사진 ${found.size} / 72 · 합계 ${kb(total)}${found.size ? ` · 한 장 평균 ${kb(total / found.size)}` : ''}${big.length ? ` · 200KB 넘는 사진 ${big.length}장(${big.slice(0, 5).join(', ')}${big.length > 5 ? ' …' : ''})` : ''}`);
if (extra.length) console.log(`목록 밖 파일(옮기지 않음): ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ' …' : ''}`);
if (flag('--check')) process.exit(0);
if (missing.length) {
  console.error(`아직 없는 사진 ${missing.length}장 — 아무것도 바꾸지 않았어요: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`);
  process.exit(1);
}
fs.mkdirSync(DEST, { recursive: true });
for (const f of fs.readdirSync(DEST)) if (/^p\d\d_(face|full|free)\./.test(f)) fs.rmSync(path.join(DEST, f));
for (const f of found.values()) fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
writeList(KEYS.map((k) => [k, found.get(k)]));
console.log(`옮김 72장 → ${DEST} · 목록 ${path.relative(APP, LIST)} · 데모 번들에 더해지는 크기 약 ${kb(total)}`);
