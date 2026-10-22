// check:bundle-audit(V-01)의 판정 규칙: 소스맵 경로 → 패키지 이름 · 번들 안 / 밖 나누기 · 치명 · 높음 세기
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const APP_DIR = path.resolve(__dirname, '..', '..');

function run(body: string): unknown {
  const file = path.join(APP_DIR, 'scripts', 'check-bundle-audit.mjs').split(path.sep).join('/');
  const code = `const m = await import('file:///${file}'); const out = await (async () => { ${body} })(); process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: APP_DIR, encoding: 'utf8' }));
}

describe('번들 포함 취약점 판정 (V-01)', () => {
  test('소스맵 경로에서 패키지 이름을 읽는다: 안쪽 node_modules · @scope · 앱 소스는 제외', () => {
    const names = run(`return [...m.packagesFromSources([
      '/x/node_modules/react-native-web/dist/index.js', ['C:', 'a', 'node_modules', '@supabase', 'supabase-js', 'dist', 'main.js'].join(String.fromCharCode(92)),
      '/x/node_modules/expo-router/node_modules/query-string/index.js', '/x/src/app/index.tsx', '/x/node_modules/']) ].sort()`) as string[];
    expect(names).toEqual(['@supabase/supabase-js', 'query-string', 'react-native-web']);
  });

  test('번들 안 · 밖으로 나누고 치명 · 높음은 번들 안만 실패로 센다', () => {
    const r = run(`
      const vulns = { braces: { name: 'braces', severity: 'high', isDirect: false, via: [{ name: 'braces', title: 'x' }] }, 'query-string': { name: 'query-string', severity: 'moderate', isDirect: false, via: ['decode-uri-component'] }, jest: { name: 'jest', severity: 'high', isDirect: false, via: [] } };
      const c = m.crossCheck(vulns, new Set(['query-string', 'react']));
      return { inB: c.bundled.map((x) => x.name + ':' + x.severity + ':' + x.own), out: c.outside.map((x) => x.name + ':' + x.severity).sort() };
    `) as { inB: string[]; out: string[] };
    expect(r.inB).toEqual(['query-string:moderate:false']); // 전파만
    expect(r.out).toEqual(['braces:high', 'jest:high']);
  });
});
