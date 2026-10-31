// IF5-F1 ①②④: 사주 계산 · 미리 쓴 글 모듈을 원본(ai/IF5/ts)에서 앱(src/saju5)으로 복사한다. 원본은 읽기만 한다(수정 0).
//  · 복사 대상: 계산 saju_calc5 · 조각 고르기 fragments5 · 이름표 names5 · 검사기 check_text5 · 규칙 rules5 · rules_extra5 · 타입 spec5(rules5 가 타입만 부름)
//  · IF5-F1c: pair5.ts(ai/IF5/ts) 를 클라이언트 복사 대상에 더했다 — 순수 함수(saju_calc5 만 가져옴)라 AI 요청 · 지시문 · 네트워크가 없다
//    + 데이터 data/jie5.json · sun5.json · fragments5.json · neutral_names5.json (모두 기기 안 계산 · 네트워크 0)
//  · 순수 글 검사기 셋도 같이 복사한다: ai/AIT/ts 의 rules.ts · text.ts · types.ts(정규식 목록 · 타입뿐, 지시문 · 열쇠 · 업체 호출 0) + lexicon.ts(IF5-QF · 낱말 사전 — 가져오는 것 0) + fixed.ts · safety.ts(IF5-QF2 · 고정 카드 · 겹침 합치기 — 같은 폴더 안만 가져옴) → src/saju5/ait/. 앱 서버 사본(src/server/ait)을 가져오지 않는 까닭: 화면 쪽 코드가 src/server 를 가져오면 안 된다(시험 aitServer ATF-16 · 보안 check_sec2 P5-e2)
//  · 들이지 않는 것(src/saju5 쪽): AI 요청 · 지시문 · 원가 · 대화 모듈 전부(IFF5-35 번들 점검). 그 모듈은 서버 폴더 src/server/saju5 로만 간다 — IF5-F2 ⑯:
//    request5 · chat5 · ai_facts5 · partner5(상대 간지 없는 2단계 문 guardCompatFacts) · generated5(지시문 · 출력 틀) · input5 · validate5. (mock5 = 미리 만든 모의 글이라 src/saju5 쪽 — 코드 없는 데모 글에도 쓰인다) 원본의 AIT 상대 경로는 '../ait/'(앱 서버 사본) ·
//    같은 폴더에 있던 계산 모듈(spec5 · saju_calc5 · names5 · rules5)은 '../../saju5/' 로 바꾼다. 화면 쪽 코드는 이 서버 폴더를 가져오지 않는다(시험 if5Ai · aitServer ATF-16)
//  · 바꾸는 것은 두 가지뿐: ① 원본의 AIT 상대 경로 '../../AIT/ts/' → 이 폴더의 './ait/' ② JSON 가져오기 꼴 `with { type: 'json' }` 지움(앱 번들러가 그대로 읽음). 그 밖은 한 글자도 안 바꾼다
//  · 줄끝: 원본은 CRLF 라 복사본은 LF 로 바꿔 쓴다(앱 저장소의 '새 CRLF 0')
// 사용: node scripts/sync-if5.mjs          → 복사본을 원본에 맞춰 다시 쓴다
//       node scripts/sync-if5.mjs --check  → 쓰지 않고 같은지만 본다(어긋나면 종료 코드 1)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC_DIR = path.resolve(appDir, '..', 'ai', 'IF5', 'ts');
export const AIT_SRC_DIR = path.resolve(appDir, '..', 'ai', 'AIT', 'ts');
export const DEST_DIR = path.join(appDir, 'src', 'saju5');
export const TS_FILES = ['saju_calc5.ts', 'fragments5.ts', 'names5.ts', 'check_text5.ts', 'rules5.ts', 'rules_extra5.ts', 'spec5.ts', 'mock5.ts', 'lunar5.ts', 'jijanggan5.ts', 'pair5.ts']; // IF5-F1c: pair5 = 날짜 고르기 '상대와 함께 보기'(함께 무난한 날 — 상대는 일지 숫자 하나 · 네트워크 · 저장 0) / IF5-F1b: lunar5 = 음양력 바꾸기(1960 ~ 2051) · jijanggan5 = 숨은 글자(통설 표 · P0 가안) / mock5 = 미리 만든 모의 글(지시문 · 요청 0) — 코드 없는 데모 글과 서버 모의 모드가 같이 쓴다
export const DATA_FILES = ['data/jie5.json', 'data/sun5.json', 'data/fragments5.json', 'data/neutral_names5.json', 'data/lunar5.json', 'data/jijanggan5.json'];
export const AIT_FILES = ['ait/rules.ts', 'ait/text.ts', 'ait/types.ts', 'ait/lexicon.ts', 'ait/fixed.ts', 'ait/safety.ts']; // IF5-QF: lexicon = 위기 · 폭력 · 오용 · 미성년 낱말 사전(서버와 한 벌 — 데모 · 코드 없는 길의 위기 앞거름이 같은 사전을 쓴다. 가져오는 것 0 · 순수 함수) / IF5-QF2: fixed = 고정 카드 · 확정 번호 줄(가져오는 것 0) · safety = 갈래 겹침 합치기 composeSafety(lexicon · fixed 만 가져옴) — 화면 쪽 앞거름이 서버와 같은 카드를 그리게 한 벌로 둔다
/** IF5-F2 ⑯: AI 요청 쪽 서버 전용 모듈 — src/server/saju5 로 간다 */
export const SERVER_DEST_DIR = path.join(appDir, 'src', 'server', 'saju5');
export const SERVER_FILES = ['request5.ts', 'chat5.ts', 'ai_facts5.ts', 'partner5.ts', 'generated5.ts', 'input5.ts', 'validate5.ts'];
const SERVER_LOCAL = ['spec5', 'saju_calc5', 'names5', 'rules5'];
export const FILES = [...TS_FILES, ...AIT_FILES, ...DATA_FILES];
// 원본 경로: ait/ 는 ai/AIT/ts, 나머지는 ai/IF5/ts
const sourceOf = (f, srcDir) => (f.startsWith('ait/') ? path.join(srcDir === SRC_DIR ? AIT_SRC_DIR : path.join(srcDir, '..', '..', 'AIT', 'ts'), f.slice(4)) : path.join(srcDir, f));

const norm = (text) => text.replace(/\r\n/g, '\n');
export function transform(name, text) {
  const t = norm(text);
  if (!name.endsWith('.ts')) return t;
  if (name.startsWith('ait/')) return t;
  return t.split("'../../AIT/ts/").join("'./ait/").split(" with { type: 'json' }").join('');
}

/** 서버 폴더용: AIT 상대 경로 → '../ait/' · 계산 모듈 → '../../saju5/' · JSON 가져오기 꼴 지움 */
export function serverTransform(text) {
  let t = norm(text).split("'../../AIT/ts/").join("'../ait/").split(" with { type: 'json' }").join('');
  for (const m of SERVER_LOCAL) t = t.split(`'./${m}.ts'`).join(`'../../saju5/${m}.ts'`);
  return t;
}

/** 서버 폴더 어긋남 { missing, differ, extra } + 지문 */
export function compareServer(srcDir = SRC_DIR, destDir = SERVER_DEST_DIR) {
  const missing = [];
  const differ = [];
  const hash = crypto.createHash('sha256');
  for (const f of SERVER_FILES) {
    const s = serverTransform(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    hash.update(`server/${f}\n${s}`);
    const dp = path.join(destDir, f);
    if (!fs.existsSync(dp)) missing.push(f);
    else if (fs.readFileSync(dp, 'utf8') !== s) differ.push(f);
  }
  const extra = fs.existsSync(destDir) ? fs.readdirSync(destDir).filter((n) => !SERVER_FILES.includes(n) && !SERVER_OWN_FILES.includes(n)) : [];
  return { files: SERVER_FILES, missing, differ, extra, fingerprint: hash.digest('hex').slice(0, 12) };
}
/** 앱이 따로 쓰는 서버 파일(원본에 없음 — 동기 대상 아님) */
export const SERVER_OWN_FILES = [];

export function syncServer(srcDir = SRC_DIR, destDir = SERVER_DEST_DIR) {
  fs.mkdirSync(destDir, { recursive: true });
  const before = compareServer(srcDir, destDir);
  for (const f of SERVER_FILES) fs.writeFileSync(path.join(destDir, f), serverTransform(fs.readFileSync(path.join(srcDir, f), 'utf8')));
  for (const f of before.extra) fs.rmSync(path.join(destDir, f), { force: true });
  return before;
}

/** 어긋난 것 목록 { missing, differ, extra } (모두 비어 있으면 같음) + 지문 */
export function compare(srcDir = SRC_DIR, destDir = DEST_DIR) {
  const missing = [];
  const differ = [];
  const hash = crypto.createHash('sha256');
  for (const f of FILES) {
    const s = transform(f, fs.readFileSync(sourceOf(f, srcDir), 'utf8'));
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
    fs.writeFileSync(path.join(destDir, f), transform(f, fs.readFileSync(sourceOf(f, srcDir), 'utf8')));
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
    const s = compareServer();
    const bad = r.missing.length + r.differ.length + r.extra.length + s.missing.length + s.differ.length + s.extra.length;
    if (bad) {
      console.error(`IF5 동기 어긋남: 없음 ${r.missing.length + s.missing.length} · 다름 ${r.differ.length + s.differ.length} · 남는 파일 ${r.extra.length + s.extra.length} — node scripts/sync-if5.mjs 로 다시 맞추세요`);
      for (const [k, v] of [['없음', [...r.missing, ...s.missing.map((n) => 'server/' + n)]], ['다름', [...r.differ, ...s.differ.map((n) => 'server/' + n)]], ['남는 파일', [...r.extra, ...s.extra.map((n) => 'server/' + n)]]]) if (v.length) console.error(`  ${k}: ${v.join(', ')}`);
      process.exit(1);
    }
    console.log(`IF5 동기 같음: 파일 ${r.files.length}개(src/saju5) + ${s.files.length}개(src/server/saju5) · 지문 ${r.fingerprint} / ${s.fingerprint}`);
  } else {
    const r = sync();
    const s = syncServer();
    const changed = r.missing.length + r.differ.length + r.extra.length + s.missing.length + s.differ.length + s.extra.length;
    console.log(`IF5 동기: 파일 ${r.files.length}개 + 서버 ${s.files.length}개 · 바뀐 것 ${changed}개(새로 ${r.missing.length + s.missing.length} · 다시 씀 ${r.differ.length + s.differ.length} · 지움 ${r.extra.length + s.extra.length}) · 지문 ${r.fingerprint} / ${s.fingerprint}`);
  }
}
