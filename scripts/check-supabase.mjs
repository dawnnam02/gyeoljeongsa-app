// Supabase 연결 점검(F0 통과 조건 4). 읽기 전용 · 무료. 주소와 키 값은 어디에도 출력하지 않는다.
//  1. app/.env 의 변수 이름이 주소 · publishable 키(와 선택 표시 EXPO_PUBLIC_DEMO_MODE)뿐인가 (보안 점검표 E-01 · D-01)
//  2. 주소는 https, 키는 publishable 형식인가 (보안/구성.md 9-1 · F-01)
//  3. 공개 설정 API(GET /auth/v1/settings)가 키와 함께 200, 키 없이 4xx 인가 (키가 실제로 쓰임)
//  4. 로그인 제공자 설정이 점검표 A-03 기대(이메일 켬 · 전화 꺼짐 · 익명 꺼짐)와 같은가
// 익명 로그인(signInAnonymously)은 일부러 부르지 않는다. 점검표 A-03 이 "익명 꺼짐"을 기대값으로 하고,
// 켜면 익명 사용자가 authenticated 역할을 얻어 RLS 가정이 달라지기 때문이다.
// 사용: node scripts/check-supabase.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 네트워크 때문에 못 봄(미확인)
// (Windows 의 Node 에서 fetch 직후 process.exit() 를 부르면 libuv 오류가 나서 exitCode 만 정한다.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_NAME = 'EXPO_PUBLIC_SUPABASE_URL';
const KEY_NAME = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
const DEMO_NAME = 'EXPO_PUBLIC_DEMO_MODE'; // 선택. 1 이면 앱이 서버 대신 모의 클라이언트를 쓴다(비밀 아님)

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

let failed = 0;
const pass = (title, detail = '') => console.log(`[통과] ${title}${detail ? ` — ${detail}` : ''}`);
const fail = (title, detail = '') => {
  failed += 1;
  console.log(`[실패] ${title}${detail ? ` — ${detail}` : ''}`);
};
const note = (title, detail = '') => console.log(`[참고] ${title}${detail ? ` — ${detail}` : ''}`);

async function main() {
  // ── 1. 변수 이름 ────────────────────────────────────────────────────
  const envPath = path.join(appDir, '.env');
  const fileEnv = loadEnvFile(envPath);
  const names = Object.keys(fileEnv);
  const url = fileEnv[URL_NAME] ?? process.env[URL_NAME];
  const key = fileEnv[KEY_NAME] ?? process.env[KEY_NAME];

  const extra = names.filter((n) => ![URL_NAME, KEY_NAME, DEMO_NAME].includes(n));
  const missing = [URL_NAME, KEY_NAME].filter((n) => !names.includes(n));
  if (!fs.existsSync(envPath)) {
    fail('1. app/.env 가 없음', 'app/.env.example 을 보고 만들어요');
  } else if (extra.length === 0 && missing.length === 0) {
    pass('1. app/.env 변수 이름은 주소 · publishable 키(+ 선택 데모 표시)뿐', names.join(' · '));
  } else {
    fail('1. app/.env 변수 이름이 맞지 않음', `다른 이름: ${extra.join(', ') || '없음'} / 빠진 이름: ${missing.join(', ') || '없음'}`);
  }

  // 데모 모드가 켜져 있으면 앱은 서버에 닿지 않는다. 연결 점검은 뜻이 없어 건너뛴다(미확인).
  if ((fileEnv[DEMO_NAME] ?? process.env[DEMO_NAME]) === '1') {
    console.log(`[미확인] 데모 모드(${DEMO_NAME}=1)가 켜져 있어 서버 연결 점검을 건너뜀`);
    return failed > 0 ? 1 : 2;
  }

  if (!url || !key) {
    fail('2. 주소 또는 키가 비어 있음');
    return 1;
  }

  // ── 2. 모양 ─────────────────────────────────────────────────────────
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) pass('2-a. 주소는 https://<프로젝트>.supabase.co 모양');
  else fail('2-a. 주소 모양이 다름', 'https 이고 *.supabase.co 여야 해요');
  if (key.startsWith('sb_publishable_')) pass('2-b. 키는 publishable 형식(sb_publishable_…)');
  else fail('2-b. 키가 publishable 형식이 아님', '서비스 · secret 키를 앱에 넣으면 안 돼요');

  // ── 3. 공개 설정 API ────────────────────────────────────────────────
  const base = url.replace(/\/$/, '');
  const get = async (pathname, withKey) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${base}${pathname}`, { headers: withKey ? { apikey: key } : {}, signal: controller.signal });
      const body = await res.text(); // 연결을 닫으려고 본문을 끝까지 읽는다
      return { status: res.status, body };
    } finally {
      clearTimeout(timer);
    }
  };

  let settings = null;
  try {
    const withKey = await get('/auth/v1/settings', true);
    if (withKey.status === 200) {
      pass('3-a. GET /auth/v1/settings (키 있음)', 'HTTP 200');
      settings = JSON.parse(withKey.body);
    } else {
      fail('3-a. GET /auth/v1/settings (키 있음)', `HTTP ${withKey.status} — 키가 거부됐어요`);
    }
    const noKey = await get('/auth/v1/settings', false);
    if (noKey.status >= 400 && noKey.status < 500) pass('3-b. 같은 요청 키 없음', `HTTP ${noKey.status} (키가 실제로 쓰임)`);
    else fail('3-b. 같은 요청 키 없음', `HTTP ${noKey.status} — 4xx 가 아니에요`);
  } catch (error) {
    console.log(`[미확인] 3. 서버에 닿지 못함(네트워크) — ${error?.name ?? 'Error'}`);
    return failed > 0 ? 1 : 2;
  }

  // ── 4. 로그인 제공자 설정 ───────────────────────────────────────────
  if (settings) {
    const external = settings.external ?? {};
    const on = Object.entries(external).filter(([, v]) => v === true).map(([k]) => k);
    const flag = (v) => (v === undefined ? '응답에 없음' : v ? '켬' : '꺼짐');
    note('4-a. 켜진 로그인 제공자(응답의 external)', on.join(' · ') || '없음');
    note('4-b. 이메일', flag(external.email));
    note('4-c. 전화', flag(external.phone));
    note('4-d. 익명 로그인', flag(external.anonymous_users));
    note('4-e. 가입 막음(disable_signup)', flag(settings.disable_signup));
    note('4-f. 이메일 자동 확인(mailer_autoconfirm)', flag(settings.mailer_autoconfirm));
    const a03 = external.email === true && external.phone !== true && external.anonymous_users !== true;
    if (a03) pass('4. 점검표 A-03 기대와 같음', '이메일 켬 · 전화 꺼짐 · 익명 꺼짐');
    else fail('4. 점검표 A-03 기대와 다름', '이메일 켬 · 전화 꺼짐 · 익명 꺼짐이어야 해요(백엔드 S3 담당)');
  }
  return failed > 0 ? 1 : 0;
}

const code = await main();
console.log(`\nSupabase 점검: 실패 ${failed}${code === 2 ? ' · 미확인 1' : ''}`);
process.exitCode = code;
