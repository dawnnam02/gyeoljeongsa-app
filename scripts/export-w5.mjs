// W5 채팅 점검용 데모 웹 번들(dist-w5/)을 만든다. 무료 · 네트워크 없음(번들 만들기만).
//  채팅 라우트(app/(tabs)/chat.tsx · app/chat/[id].tsx)가 생겨(D-159) 예전의 임시 라우트 넣기 · 지우기는 뺐다.
//  dist-demo(다른 직원 점검용)를 건드리지 않으려고 따로 dist-w5 로 만든다. 설정은 export-demo.mjs 와 같다.
// 사용: node scripts/export-w5.mjs   → node scripts/web-w5.mjs [dist-w5]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// EXPO_NO_DOTENV: app/.env(진짜 서버 주소 · 키)를 읽지 않게 한다
const env = { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_DEMO_MODE: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
const win = process.platform === 'win32';
const r = spawnSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-w5', '--clear'], { cwd: appDir, env, stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);
