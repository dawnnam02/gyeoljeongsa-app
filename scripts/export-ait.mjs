// AIT-F ①: 서버 판(API 경로 /api/ai/* 가 도는 판)을 따로 만든다. 무료 · 네트워크 없음(번들 만들기만) · 배포 아님(AIT-W 몫).
//  정적 데모 판(web.output 'single' · scripts/export-demo.mjs → dist-demo)은 그대로 두고, 이 명령만 app.config.js 에 AIT_SERVER_EXPORT=1 을 줘서 'server' 출력으로 만든다.
//  결과 폴더 dist-ait/ (client/ + server/) — check_sec2 가 보는 dist · dist-demo 와 섞이지 않고, .gitignore 의 dist-*/ 로 저장소에 올라가지 않는다.
//  열쇠 · 접근 코드 · 서명 키는 번들에 들어가지 않는다(서버가 실행 때 process.env 에서 읽는다). EXPO_NO_DOTENV: app/.env 를 읽지 않는다.
// 사용: node scripts/export-ait.mjs   (npm run check:web:ait)  → 끝나면 node scripts/check-ait-bundle.mjs 로 번들을 검사한다
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, AIT_SERVER_EXPORT: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_DEMO_MODE: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
const win = process.platform === 'win32';
const result = spawnSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-ait', '--clear', '--max-workers', '2'], { cwd: appDir, env, stdio: 'inherit', shell: win });
process.exit(result.status ?? 1);
