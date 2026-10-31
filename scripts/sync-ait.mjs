// AIT-F ②: 실제 AI 시험 연결(서버 함수)의 모듈을 원본(ai/AIT/ts)에서 앱(src/server/ait)으로 복사한다. 원본은 읽기만 한다(수정 0).
//  · 복사 대상: ai/AIT/ts/*.ts 가운데 시험(tests/)과 상수 만들기 도구(gen.ts)를 뺀 것 — generated.ts 는 이미 만들어진 상수라 포함
//  · 줄끝: 원본은 CRLF 라 복사본은 LF 로 바꿔 쓴다(앱 저장소의 '새 CRLF 0'). 같음 판단도 원본의 CRLF 를 LF 로 바꾼 뒤 비교한다 — 그 밖은 한 글자도 안 바꾼다
//  · 앱이 따로 두는 파일(OWN_FILES)은 이 스크립트가 만들지도 지우지도 않는다. 그 밖의 파일이 src/server/ait 에 있으면 --check 가 실패한다
// 사용: node scripts/sync-ait.mjs          → 복사본을 원본에 맞춰 다시 쓴다
//       node scripts/sync-ait.mjs --check  → 쓰지 않고 같은지만 본다(어긋나면 종료 코드 1)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = path.resolve(appDir, '..', 'ai', 'AIT', 'ts');
export const DEST_DIR = path.join(appDir, 'src', 'server', 'ait');
export const EXCLUDE = ['gen.ts'];
/** 앱이 따로 쓰는 파일(원본에 없음) — 동기 대상이 아니다 */
export const OWN_FILES = ['route.ts', 'sajuRoute.ts']; // IF5-F2: sajuRoute.ts = 사주 AI 맞춤 서버 핸들러(원본 없음)

const norm = (text) => text.replace(/\r\n/g, '\n');

export function sourceFiles(srcDir = SRC_DIR) {
  return fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !EXCLUDE.includes(e.name))
    .map((e) => e.name)
    .sort();
}

/** 어긋난 것 목록 { missing, differ, extra } (모두 비어 있으면 같음) + 지문 */
export function compare(srcDir = SRC_DIR, destDir = DEST_DIR) {
  const files = sourceFiles(srcDir);
  const missing = [];
  const differ = [];
  const hash = crypto.createHash('sha256');
  for (const f of files) {
    const s = norm(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    hash.update(f + '\n' + s);
    const dp = path.join(destDir, f);
    if (!fs.existsSync(dp)) missing.push(f);
    else if (fs.readFileSync(dp, 'utf8') !== s) differ.push(f);
  }
  const extra = fs.existsSync(destDir) ? fs.readdirSync(destDir).filter((n) => !files.includes(n) && !OWN_FILES.includes(n)) : [];
  return { files, missing, differ, extra, fingerprint: hash.digest('hex').slice(0, 12) };
}

export function sync(srcDir = SRC_DIR, destDir = DEST_DIR) {
  fs.mkdirSync(destDir, { recursive: true });
  const before = compare(srcDir, destDir);
  for (const f of before.files) fs.writeFileSync(path.join(destDir, f), norm(fs.readFileSync(path.join(srcDir, f), 'utf8')));
  for (const f of before.extra) fs.rmSync(path.join(destDir, f), { force: true }); // 원본에서 사라진 파일
  return before;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('원본 ai/AIT/ts 를 찾지 못했어요(저장소 복제본에서는 이 점검을 건너뛰어요).');
    process.exit(2);
  }
  if (process.argv.includes('--check')) {
    const r = compare();
    const bad = r.missing.length + r.differ.length + r.extra.length;
    if (bad) {
      console.error(`AIT 동기 어긋남: 없음 ${r.missing.length} · 다름 ${r.differ.length} · 남는 파일 ${r.extra.length} — node scripts/sync-ait.mjs 로 다시 맞추세요`);
      for (const [k, v] of [['없음', r.missing], ['다름', r.differ], ['남는 파일', r.extra]]) if (v.length) console.error(`  ${k}: ${v.join(', ')}`);
      process.exit(1);
    }
    console.log(`AIT 동기 같음: 파일 ${r.files.length}개 · 지문 ${r.fingerprint}`);
  } else {
    const r = sync();
    const changed = r.missing.length + r.differ.length + r.extra.length;
    console.log(`AIT 동기: 파일 ${r.files.length}개 · 바뀐 것 ${changed}개(새로 ${r.missing.length} · 다시 씀 ${r.differ.length} · 지움 ${r.extra.length}) · 지문 ${r.fingerprint}`);
  }
}
