// IF5-F1 ①②④: 사주 계산 · 미리 쓴 글 모듈을 원본(ai/IF5/ts)에서 앱(src/saju5)으로 복사한다. 원본은 읽기만 한다(수정 0).
//  · 복사 대상: 계산 saju_calc5 · 조각 고르기 fragments5 · 이름표 names5 · 검사기 check_text5 · 규칙 rules5 · rules_extra5 · 타입 spec5(rules5 가 타입만 부름)
//    + 데이터 data/jie5.json · sun5.json · fragments5.json · neutral_names5.json (모두 기기 안 계산 · 네트워크 0)
//  · 들이지 않는 것: partner5(F2 AI 맞춤이 부르는 줄임 문 — AI 요청 모듈 request5 · generated5 가 따라와 지시문이 번들에 든다) · AI 요청 · 원가 · 대화 모듈 전부(IFF5-35 번들 점검)
//  · 바꾸는 것은 두 가지뿐: ① 원본의 AIT 상대 경로 '../../AIT/ts/' → 앱 서버 사본 '../server/ait/' ② JSON 가져오기 꼴 `with { type: 'json' }` 지움(앱 번들러가 그대로 읽음). 그 밖은 한 글자도 안 바꾼다
//  · 줄끝: 원본은 CRLF 라 복사본은 LF 로 바꿔 쓴다(앱 저장소의 '새 CRLF 0')
// 사용: node scripts/sync-if5.mjs          → 복사본을 원본에 맞춰 다시 쓴다
//       node scripts/sync-if5.mjs --check  → 쓰지 않고 같은지만 본다(어긋나면 종료 코드 1)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = path.resolve(appDir, '..', 'ai', 'IF5', 'ts');
export const DEST_DIR = path.join(appDir, 'src', 'saju5');
export const TS_FILES = ['saju_calc5.ts', 'fragments5.ts', 'names5.ts', 'check_text5.ts', 'rules5.ts', 'rules_extra5.ts', 'spec5.ts'];
export const DATA_FILES = ['data/jie5.json', 'data/sun5.json', 'data/fragments5.json', 'data/neutral_names5.json'];
export const FILES = [...TS_FILES, ...DATA_FILES];

const norm = (text) => text.replace(/\r\n/g, '\n');
export function transform(name, text) {
  const t = norm(text);
  if (!name.endsWith('.ts')) return t;
  return t.split("'../../AIT/ts/").join("'../server/ait/").split(" with { type: 'json' }").join('');
}

/** 어긋난 것 목록 { missing, differ, extra } (모두 비어 있으면 같음) + 지문 */
export function compare(srcDir = SRC_DIR, destDir = DEST_DIR) {
  const missing = [];
  const differ = [];
  const hash = crypto.createHash('sha256');
  for (const f of FILES) {
    const s = transform(f, fs.readFileSync(path.join(srcDir, f), 'utf8'));
    hash.update(f + '\n' + s);
    const dp = path.join(destDir, f);
    if (!fs.existsSync(dp)) missing.push(f);
    else if (fs.readFileSync(dp, 'utf8') !== s) differ.push(f);
  }
  const found = [];
  const walk = (dir, prefix) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else found.push(`${prefix}${e.name}`);
    }
  };
  walk(destDir, '');
  const extra = found.filter((n) => !FILES.includes(n));
  return { files: FILES, missing, differ, extra, fingerprint: hash.digest('hex').slice(0, 12) };
}

export function sync(srcDir = SRC_DIR, destDir = DEST_DIR) {
  const before = compare(srcDir, destDir);
  for (const f of FILES) {
    fs.mkdirSync(path.dirname(path.join(destDir, f)), { recursive: true });
    fs.writeFileSync(path.join(destDir, f), transform(f, fs.readFileSync(path.join(srcDir, f), 'utf8')));
  }
  for (const f of before.extra) fs.rmSync(path.join(destDir, f), { force: true });
  return before;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('원본 ai/IF5/ts 를 찾지 못했어요(저장소 복제본에서는 이 점검을 건너뛰어요).');
    process.exit(2);
  }
  if (process.argv.includes('--check')) {
    const r = compare();
    const bad = r.missing.length + r.differ.length + r.extra.length;
    if (bad) {
      console.error(`IF5 동기 어긋남: 없음 ${r.missing.length} · 다름 ${r.differ.length} · 남는 파일 ${r.extra.length} — node scripts/sync-if5.mjs 로 다시 맞추세요`);
      for (const [k, v] of [['없음', r.missing], ['다름', r.differ], ['남는 파일', r.extra]]) if (v.length) console.error(`  ${k}: ${v.join(', ')}`);
      process.exit(1);
    }
    console.log(`IF5 동기 같음: 파일 ${r.files.length}개 · 지문 ${r.fingerprint}`);
  } else {
    const r = sync();
    const changed = r.missing.length + r.differ.length + r.extra.length;
    console.log(`IF5 동기: 파일 ${r.files.length}개 · 바뀐 것 ${changed}개(새로 ${r.missing.length} · 다시 씀 ${r.differ.length} · 지움 ${r.extra.length}) · 지문 ${r.fingerprint}`);
  }
}
