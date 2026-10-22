// W5 채팅 점검용 데모 웹 번들(dist-w5/)을 만든다. 무료 · 네트워크 없음(번들 만들기만).
//  채팅 라우트(/chat · /chat/[id])는 앱 A 몫이라 아직 src/app 에 없다. 그래서 이 스크립트가 번들을 만드는 동안만
//  얇은 라우트 두 개를 잠깐 넣었다가 끝나면 지운다(이미 있으면 건드리지 않음 — A 가 만든 뒤에는 그 라우트로 만든다).
//  A 가 라우트를 만들면 이 파일의 STUBS 는 쓰이지 않는다(그대로 두어도 됨).
// 사용: node scripts/export-w5.mjs   → node scripts/web-w5.mjs [dist-w5]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chatDir = path.join(appDir, 'src', 'app', 'chat');
const STUBS = {
  'index.tsx': "import { ChatListScreen } from '@/features/chat/ChatListScreen';\n\n// W5 점검용 임시 라우트(scripts/export-w5.mjs 가 번들을 만드는 동안만 둔다)\nexport default function ChatListRoute() {\n  return <ChatListScreen />;\n}\n",
  '[id].tsx': "import { useLocalSearchParams } from 'expo-router';\n\nimport { ChatRoomScreen } from '@/features/chat/ChatRoomScreen';\n\n// W5 점검용 임시 라우트(scripts/export-w5.mjs 가 번들을 만드는 동안만 둔다)\nexport default function ChatRoomRoute() {\n  const { id } = useLocalSearchParams<{ id: string }>();\n  return <ChatRoomScreen id={String(id ?? '')} />;\n}\n",
};

const tabChat = path.join(appDir, 'src', 'app', '(tabs)', 'chat.tsx');
const made = [];
const madeDir = !fs.existsSync(chatDir);
let status = 1;
try {
  if (!fs.existsSync(tabChat)) {
    fs.mkdirSync(chatDir, { recursive: true });
    for (const [name, body] of Object.entries(STUBS)) {
      const file = path.join(chatDir, name);
      if (fs.existsSync(file)) continue;
      fs.writeFileSync(file, body, 'utf8');
      made.push(file);
    }
  } else if (!fs.existsSync(path.join(chatDir, '[id].tsx'))) {
    fs.mkdirSync(chatDir, { recursive: true });
    const file = path.join(chatDir, '[id].tsx');
    fs.writeFileSync(file, STUBS['[id].tsx'], 'utf8');
    made.push(file);
  }
  const env = { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_DEMO_MODE: '1', EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
  const win = process.platform === 'win32';
  const r = spawnSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-w5', '--clear'], { cwd: appDir, env, stdio: 'inherit', shell: win });
  status = r.status ?? 1;
} finally {
  for (const file of made) fs.rmSync(file, { force: true });
  if (madeDir && fs.existsSync(chatDir) && fs.readdirSync(chatDir).length === 0) fs.rmdirSync(chatDir);
  console.log(made.length ? `임시 라우트 ${made.length}개를 넣었다가 지웠어요.` : '이미 있는 채팅 라우트로 만들었어요.');
}
process.exit(status);
