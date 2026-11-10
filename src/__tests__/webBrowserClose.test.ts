/**
 * @jest-environment node
 */
// RS2-01 [마]3 웹 점검 도구 공용 종료 처리 — 처음 프로세스가 자식을 남기고 먼저 끝나도(부모 없는 고아 나무) 프로필 폴더로 찾아 모두 닫는다.
//  진짜 브라우저 대신 가짜 프로세스(node)로 확인한다: 부모가 자식을 띄우고 먼저 끝난다 → 자식 명령줄에만 프로필 경로가 있다 → killBrowserTree 가 그 자식을 찾아 끝낸다.
//  Windows 에서만 의미가 있다(taskkill · PowerShell). 다른 컴퓨터에서는 건너뛴다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const win = process.platform === 'win32';
const root = path.join(__dirname, '..', '..');

// 제어 프로세스: 프로필 경로는 환경 변수로만 받는다(제어 프로세스 명령줄에 경로가 들면 같이 끝나 버린다)
const CONTROL = `
import { spawn, spawnSync } from 'node:child_process';
import { killBrowserTree } from './scripts/lib/browser.mjs';
const profile = process.env.GJS_TEST_PROFILE;
const parentCode = "const { spawn } = require('child_process'); spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', '--user-data-dir=' + process.env.GJS_TEST_PROFILE], { stdio: 'ignore', detached: true }); setTimeout(() => process.exit(0), 300);";
const parent = spawn(process.execPath, ['-e', parentCode], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = () => {
  const ps = "$p = $env:GJS_TEST_PROFILE; @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($p) }).Count";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
  return Number(String(r.stdout).trim());
};
await sleep(2500);
const before = count();
killBrowserTree(parent, profile, /^node/i);
const after = count();
console.log(JSON.stringify({ before, after }));
`;

// 감시 시험: 가짜 '점검 node'(M) · 가짜 브라우저(B, 떨어져 사는 프로세스) · 감시(browser-reaper). M 을 강제로 끝내면 감시가 B 를 프로필로 찾아 닫는다
const REAPER_CONTROL = `
import { spawn, spawnSync } from 'node:child_process';
const profile = process.env.GJS_TEST_PROFILE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const main = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
const fake = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', '--user-data-dir=' + profile], { stdio: 'ignore', detached: true });
fake.unref();
const reaper = spawn(process.execPath, ['./scripts/lib/browser-reaper.mjs', String(main.pid), profile, String(fake.pid), '^node'], { stdio: 'ignore', detached: true });
reaper.unref();
const count = () => {
  const ps = "$p = $env:GJS_TEST_PROFILE; @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($p) -and $_.CommandLine -notlike '*browser-reaper*' }).Count";
  return Number(String(spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' }).stdout).trim());
};
await sleep(2000);
const before = count();
spawnSync('taskkill', ['/pid', String(main.pid), '/F'], { stdio: 'ignore' });
let after = count();
for (let i = 0; i < 15 && after > 0; i += 1) { await sleep(1000); after = count(); }
console.log(JSON.stringify({ before, after }));
`;

(win ? describe : describe.skip)('웹 점검 공용 종료 처리: 부모가 먼저 끝난 고아 나무도 프로필로 찾아 닫는다 (RS2-01 마 3)', () => {
  jest.setTimeout(60_000);
  test('가짜 브라우저(부모 → 자식, 부모는 먼저 끝남): 닫기 전 1 → 닫은 뒤 0', () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gjs-f1-selftest-'));
    try {
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', CONTROL], { cwd: root, env: { ...process.env, GJS_TEST_PROFILE: profile }, encoding: 'utf8', timeout: 50_000 });
      const out = String(r.stdout).trim().split('\n').pop() ?? '';
      const got = JSON.parse(out) as { before: number; after: number };
      expect(got.before).toBeGreaterThanOrEqual(1); // 고아가 실제로 남아 있었다
      expect(got.after).toBe(0); // 처음 pid 만으로는 못 찾던 것까지 모두 닫혔다
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('점검 node 가 알림 없이 강제로 죽어도 감시 프로세스가 프로필로 찾아 닫는다(시간 초과로 프로세스째 끝나는 경우)', () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gjs-f1-selftest-'));
    try {
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', REAPER_CONTROL], { cwd: root, env: { ...process.env, GJS_TEST_PROFILE: profile }, encoding: 'utf8', timeout: 50_000 });
      const got = JSON.parse(String(r.stdout).trim().split('\n').pop() ?? '') as { before: number; after: number };
      expect(got.before).toBeGreaterThanOrEqual(1); // 가짜 브라우저가 떠 있었다
      expect(got.after).toBe(0); // 점검 node 를 강제로 끝내자 감시가 닫았다
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  });

  test('소스 점검: 공용 처리 한 곳 — 웹 점검 스크립트가 taskkill 을 따로 부르지 않는다', () => {
    const dir = path.join(root, 'scripts');
    const files = [...fs.readdirSync(dir).filter((n) => n.endsWith('.mjs')).map((n) => path.join(dir, n)), ...fs.readdirSync(path.join(dir, 'lib')).filter((n) => n.endsWith('.mjs')).map((n) => path.join(dir, 'lib', n))];
    const callers = files.filter((f) => /taskkill/.test(fs.readFileSync(f, 'utf8')) && path.basename(f) !== 'browser.mjs');
    expect(callers.map((f) => path.basename(f))).toEqual([]);
    const lib = fs.readFileSync(path.join(dir, 'lib', 'browser.mjs'), 'utf8');
    expect(lib).toContain('export function killBrowserTree');
    expect((lib.match(/killBrowserTree\(/g) ?? []).length).toBeGreaterThanOrEqual(4); // 정의 + 뜨다 만 시도 + 끝날 때 + close()
  });
});
