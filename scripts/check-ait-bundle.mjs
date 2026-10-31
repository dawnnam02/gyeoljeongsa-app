// AIT-F ④: 빌드 산출물에 서버 비밀 변수 이름 · 열쇠 꼴 · 접근 코드 꼴 · 서버 모듈 글이 새지 않았는지 본다(보안 AIT_위협 2-5 · ATD-01 · 02 · 05). 읽기만 · 출력은 파일 이름과 건수뿐(값 0).
//  · 클라이언트 쪽(정적 데모 dist-demo 전체 · 서버 판 dist-ait/client 전체 · 서버 판의 화면 html 과 화면 js): 서버 변수 이름 · 열쇠 꼴 · 접근 코드 꼴 · 서버 모듈 글 0
//  · 서버 쪽(dist-ait/server/_expo/functions): 변수 이름은 허용 — 열쇠 꼴 · 접근 코드 꼴 · JWT 는 어디에도 0
//  · 한글은 번들 안에서 \uXXXX 로 쓰이므로 풀어서 본다
// 사용: node scripts/check-ait-bundle.mjs [--dirs a,b,c]   종료 코드 0 깨끗 · 1 걸림 · 2 폴더 없음
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const decode = (s) => s.replace(/\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// 패턴은 조각으로 이어 붙여 이 파일 자체가 푸시 전 검사에 걸리지 않게 한다
const NAMES = ['ANTHROPIC_' + 'API_KEY', 'AI_ACCESS_' + 'CODE', 'AIT_SIGN_' + 'KEY', 'AIT_WORKSPACE_' + 'ID', 'AIT_' + 'MODE', 'AIT_CHAT_' + 'MODEL'];
const KEY_RES = [
  ['열쇠 꼴', new RegExp('sk-an' + 't-[A-Za-z0-9_-]{8,}')],
  ['접근 코드 꼴', /ait-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}/],
  ['JWT 꼴', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['sb_secret', new RegExp('sb_se' + 'cret_[A-Za-z0-9_-]{12,}')],
];
// 서버 모듈에만 있어야 하는 글(요청 꼴 · 업체 오류 분류 · 작업 공간 확인 · 지시문 첫 문장 · SDK)
const SERVER_MARKERS = ['anthropic-workspace-id', 'workspace_mismatch', 'enforced_spend_limit_reached', '@anthropic-ai', 'api.anthropic.com', 'handleAi', 'UpstreamError', 'ait:upstream', '연애 때문에 마음이 복잡한 사람이 고민을 차근차근', 'output_config'];

const out = path.join(appDir, 'dist-ait');
const serverFns = path.join(out, 'server', '_expo', 'functions');
const clientDirs = (arg('--dirs') ? arg('--dirs').split(',').map((d) => path.resolve(appDir, d)) : [path.join(appDir, 'dist-demo'), path.join(out, 'client')]).filter((d) => fs.existsSync(d));
const clientFiles = clientDirs.flatMap(walk);
// 서버 판의 server/ 안 화면 html · 화면 js(함수 폴더 제외)도 사용자 쪽으로 간다
const ssrFiles = walk(path.join(out, 'server')).filter((f) => !f.startsWith(serverFns));
const serverFiles = walk(serverFns);
if (clientFiles.length === 0 && serverFiles.length === 0) {
  console.error('검사할 산출물 폴더가 없어요(dist-demo · dist-ait) — 먼저 node scripts/export-demo.mjs · node scripts/export-ait.mjs');
  process.exit(2);
}
const TEXT = /\.(js|html|json|map|txt|css|mjs)$/;
const rel = (f) => path.relative(appDir, f).split(path.sep).join('/');
const hits = [];
let scanned = 0;
function scan(files, label, { names, markers }) {
  for (const f of files.filter((x) => TEXT.test(x))) {
    scanned += 1;
    const s = decode(fs.readFileSync(f, 'utf8'));
    for (const [n, re] of KEY_RES) if (re.test(s)) hits.push(`${label} ${rel(f)}: ${n}`);
    if (names) for (const n of NAMES) if (s.includes(n)) hits.push(`${label} ${rel(f)}: 서버 변수 이름 ${n.slice(0, 4)}…`);
    if (markers) for (const m of SERVER_MARKERS) if (s.includes(m)) hits.push(`${label} ${rel(f)}: 서버 모듈 글 "${m.slice(0, 12)}"`);
  }
}
scan(clientFiles, '클라이언트', { names: true, markers: true });
scan(ssrFiles, '서버 판 화면', { names: true, markers: true });
scan(serverFiles, '서버 함수', { names: false, markers: false });
const serverNames = serverFiles.filter((f) => /\.js$/.test(f) && NAMES.some((n) => fs.readFileSync(f, 'utf8').includes(n))).length;
console.log(`AIT 번들 검사: 파일 ${scanned}개(클라이언트 ${clientFiles.filter((f) => TEXT.test(f)).length} · 서버 판 화면 ${ssrFiles.filter((f) => TEXT.test(f)).length} · 서버 함수 ${serverFiles.filter((f) => TEXT.test(f)).length}) · 서버 함수에서 변수 이름을 읽는 파일 ${serverNames}개(허용) · 걸린 것 ${hits.length}건`);
for (const h of hits) console.log(`  ${h}`);
process.exit(hits.length ? 1 : 0);
