// 12 › 정보 › 오픈소스 라이선스 목록 만들기(F7, 법무 5-6 · 생성물_이용조건 5-4 · U22). 읽기 전용 원본 · 네트워크 없음.
//  · Lucide: assets/licenses/lucide-LICENSE.txt(법무가 정한 원본 주소의 LICENSE 를 그대로 복사해 둔 것)
//  · Pretendard: assets/fonts/Pretendard-LICENSE.txt
//  · npm 패키지: package.json 의 dependencies(앱에 실리는 것). 기본은 직접 의존만, --all 이면 의존 트리 전체(빌드 · 스토어 제출 전, R2)
//    같은 전문은 한 번만 싣고 패키지는 textId 로 가리킨다(번역하지 않고 영어 원문 그대로)
// 사용: node scripts/gen-licenses.mjs [--all]   (npm run gen:licenses)   → src/features/settings/licenses.json
// 왜 JSON 인가: 원문에 http 주소 · 여러 글자가 있어 앱 코드(.ts) 규칙(F-01 https 만 등)을 피하지 않고 글자 그대로 싣기 위해서다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP_DIR, 'src', 'features', 'settings', 'licenses.json');
const all = process.argv.includes('--all');

const readText = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

// node 의 찾는 차례: 패키지 폴더의 node_modules → 위 폴더들 → 앱의 node_modules
function resolvePackage(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === APP_DIR || path.dirname(dir) === dir) return null;
    dir = path.dirname(dir);
  }
}

function licenseFile(dir) {
  const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.md|\.txt)?$/i.test(f));
  return file ? readText(path.join(dir, file)) : null;
}

const licenseName = (meta) => (typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? (Array.isArray(meta.licenses) ? meta.licenses.map((l) => l.type).join(' OR ') : 'UNKNOWN')));

const root = readJson(path.join(APP_DIR, 'package.json'));
const seen = new Map(); // name@version → { name, version, license, text }
const queue = Object.keys(root.dependencies ?? {}).map((name) => ({ name, from: APP_DIR }));
const missing = [];
while (queue.length > 0) {
  const { name, from } = queue.shift();
  const dir = resolvePackage(name, from);
  if (!dir) {
    missing.push(name);
    continue;
  }
  const meta = readJson(path.join(dir, 'package.json'));
  const key = `${meta.name}@${meta.version}`;
  if (seen.has(key)) continue;
  seen.set(key, { name: meta.name, version: meta.version, license: licenseName(meta), text: licenseFile(dir) });
  if (all) for (const dep of Object.keys(meta.dependencies ?? {})) queue.push({ name: dep, from: dir });
}

const texts = {};
const packages = [...seen.values()]
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
  .map((p) => {
    if (!p.text) return { name: p.name, version: p.version, license: p.license, textId: null };
    const id = crypto.createHash('sha256').update(p.text).digest('hex').slice(0, 12);
    texts[id] = p.text;
    return { name: p.name, version: p.version, license: p.license, textId: id };
  });

const out = {
  note: all ? 'generated: full dependency tree (gen:licenses --all)' : 'generated: direct dependencies only (gen:licenses; full tree at build time with --all, U22)',
  lucide: { name: 'Lucide', license: 'ISC · MIT', text: readText(path.join(APP_DIR, 'assets', 'licenses', 'lucide-LICENSE.txt')) },
  pretendard: { name: 'Pretendard', license: 'OFL', text: readText(path.join(APP_DIR, 'assets', 'fonts', 'Pretendard-LICENSE.txt')) },
  packages,
  texts,
};
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
const noText = packages.filter((p) => !p.textId).map((p) => p.name);
console.log(`쓴 파일 src/features/settings/licenses.json: 패키지 ${packages.length}개 · 전문 ${Object.keys(texts).length}종 (${Buffer.byteLength(JSON.stringify(out), 'utf8')} 바이트)`);
if (noText.length) console.log(`[참고] 패키지 안에 LICENSE 파일이 없어 이름 · 라이선스만 싣는 것 ${noText.length}개: ${noText.join(', ')}`);
if (missing.length) console.log(`[참고] node_modules 에 없는 의존(설치 안 된 선택 의존 등) ${missing.length}개: ${[...new Set(missing)].join(', ')}`);
