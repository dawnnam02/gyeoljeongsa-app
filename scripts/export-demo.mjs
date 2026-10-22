// 데모 모드 웹 번들(dist-demo/)을 만든다. 무료 · 네트워크 없음(번들 만들기만 한다).
//  EXPO_PUBLIC_DEMO_MODE=1 이면 서버 대신 메모리 모의 클라이언트를 쓴다(src/lib/demoClient.ts). 서버 주소 · 키는 비워서 번들에 넣지 않는다.
//  Windows 에서는 npm 스크립트 안에서 환경 변수를 바로 줄 수 없어서 이 파일이 대신 준다.
// 사용: node scripts/export-demo.mjs   (npm run check:web:demo)  → 끝나면 node scripts/web-f1.mjs 로 화면을 점검한다.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// EXPO_NO_DOTENV: app/.env(진짜 서버 주소 · 키)를 읽지 않게 한다. 안 그러면 .env 값이 아래 값들을 덮어쓴다.
const env = { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_DEMO_MODE: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
const win = process.platform === 'win32';
const result = spawnSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-demo', '--clear'], { cwd: appDir, env, stdio: 'inherit', shell: win });
process.exit(result.status ?? 1);
