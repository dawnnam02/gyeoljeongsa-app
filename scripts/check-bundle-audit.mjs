// 번들에 실제로 들어가는 패키지만 골라 npm audit 결과와 교차한다(보안 점검 V-01). 무료 · npm 레지스트리에 조회 1번(npm audit).
//  `npm audit` 는 개발 도구(jest · metro · expo cli …)의 취약점까지 세어서 높음 26 · 중간 16 이 나온다. 그중 앱에 실려 사용자 기기에 가는 것은 웹 번들(소스맵 sources)에 나온 패키지뿐이다.
//  1) 소스맵이 있는 번들 폴더를 받거나(첫 인자), 없으면 임시 폴더(.bundle-audit/)에 `expo export --platform web --dump-sourcemap` 으로 만든다(서버 주소 · 키는 비운다)
//  2) 소스맵 sources 에서 node_modules/<패키지> 이름을 모은다
//  3) `npm audit --omit=dev --json` 의 취약 패키지와 맞춰, 번들 안에서 자체 권고가 있는 치명 · 높음이 0 인지 판정한다(위로 전파만 된 표시는 따로 센다). 번들 밖(빌드 도구 · 시험 도구) 것은 "번들 밖"으로 나눠 센다
// 사용: node scripts/check-bundle-audit.mjs [소스맵이 든 번들 폴더]   (npm run check:bundle-audit)
// 종료 코드: 0 번들 안 치명 · 높음 0 · 1 있음 · 2 번들이나 audit 결과를 못 얻음(미확인)
// 주의: `npm audit fix --force` 는 쓰지 않는다(expo 44 · 옛 버전으로 내리라는 잘못된 제안이다).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';

function listMaps(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.map')) out.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

// 소스맵 sources 의 경로 → 패키지 이름(가장 안쪽 node_modules 기준, @scope/name 포함)
export function packagesFromSources(sources) {
  const names = new Set();
  for (const source of sources) {
    const parts = String(source).split(/[\\/]/);
    const at = parts.lastIndexOf('node_modules');
    if (at < 0 || at + 1 >= parts.length) continue;
    const first = parts[at + 1];
    if (!first) continue;
    names.add(first.startsWith('@') && parts[at + 2] ? `${first}/${parts[at + 2]}` : first);
  }
  return names;
}

// audit 취약 목록 + 번들 패키지 → { bundled, outside }
export function crossCheck(vulnerabilities, bundled) {
  // own: 그 패키지 자신에게 붙은 권고(via 에 같은 이름의 권고 객체)가 있는가. 없으면 의존하는 다른 패키지의 취약점이 npm 에서 위로 전파돼 표시된 것(예: expo ← @expo/cli ← braces)이라
  // 그 패키지의 코드가 위험하다는 뜻이 아니다 — 위험의 뿌리 패키지가 번들에 있는지는 그 뿌리 줄이 따로 판정한다.
  const rows = Object.values(vulnerabilities).map((v) => ({
    name: v.name,
    severity: v.severity,
    direct: v.isDirect === true,
    own: Array.isArray(v.via) && v.via.some((x) => typeof x === 'object' && x !== null && x.name === v.name),
    inBundle: bundled.has(v.name),
  }));
  return { bundled: rows.filter((r) => r.inBundle), outside: rows.filter((r) => !r.inBundle) };
}

const count = (rows, sev) => rows.filter((r) => r.severity === sev).length;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let dir = process.argv[2] ? path.resolve(appDir, process.argv[2]) : null;
  let temp = null;
  if (!dir || listMaps(dir).length === 0) {
    temp = path.join(appDir, '.bundle-audit');
    console.log('[알림] 소스맵이 있는 번들이 없어 임시 폴더(.bundle-audit/)에 만들어요(몇 분 걸려요).');
    // 환경 변수를 덮어쓰지 않는다: Metro 변환 캐시가 EXPO_PUBLIC_* 값을 번들에 박아 두므로, 다른 값으로 만들면 뒤따르는 check:web · smoke 가 그 값을 물려받는다. 그래서 check:web 과 같은 조건(.env 포함)으로 만든다
    const env = { ...process.env };
    const res = spawnSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', '.bundle-audit', '--dump-sourcemap', '--clear'], { cwd: appDir, env, stdio: 'inherit', shell: win });
    if (res.status !== 0) {
      console.log('[미확인] 번들을 만들지 못했어요.');
      process.exit(2);
    }
    dir = temp;
  }
  const bundled = new Set();
  for (const file of listMaps(dir)) {
    try {
      for (const name of packagesFromSources(JSON.parse(fs.readFileSync(file, 'utf8')).sources ?? [])) bundled.add(name);
    } catch {
      /* 소스맵이 아닌 .map */
    }
  }
  if (bundled.size === 0) {
    console.log('[미확인] 소스맵에서 패키지를 하나도 읽지 못했어요(번들을 --dump-sourcemap 으로 만들었는지 확인).');
    process.exit(2);
  }
  const audit = spawnSync(win ? 'npm.cmd' : 'npm', ['audit', '--omit=dev', '--json'], { cwd: appDir, encoding: 'utf8', shell: win, maxBuffer: 64 * 1024 * 1024 });
  let json;
  try {
    json = JSON.parse(audit.stdout);
  } catch {
    console.log('[미확인] npm audit 결과를 읽지 못했어요(인터넷 · 레지스트리 확인).');
    process.exit(2);
  }
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  const { bundled: inB, outside } = crossCheck(json.vulnerabilities ?? {}, bundled);
  console.log(`번들에 들어간 패키지 ${bundled.size}개 · npm audit(--omit=dev) 취약 패키지 ${inB.length + outside.length}개`);
  console.log(`  번들 밖(빌드 · 시험 도구): 치명 ${count(outside, 'critical')} · 높음 ${count(outside, 'high')} · 중간 ${count(outside, 'moderate')} · 낮음 ${count(outside, 'low')}`);
  const own = inB.filter((r) => r.own);
  console.log(`  번들 안(자체 권고 있음): 치명 ${count(own, 'critical')} · 높음 ${count(own, 'high')} · 중간 ${count(own, 'moderate')} · 낮음 ${count(own, 'low')}`);
  console.log(`  번들 안(전파만, 자체 권고 없음): ${inB.length - own.length}개`);
  for (const r of inB.sort((a, b) => a.severity.localeCompare(b.severity))) console.log(`    번들 안 ${r.severity}: ${r.name}${r.direct ? ' (직접)' : ''}${r.own ? '' : ' — 전파만'}`);
  const bad = count(own, 'critical') + count(own, 'high');
  console.log(`\n번들 포함(자체 권고) 치명 · 높음: ${bad}${bad === 0 ? ' — 통과' : ' — 실패(SDK 업그레이드 또는 overrides 로 고친다)'}`);
  process.exit(bad === 0 ? 0 : 1);
}
