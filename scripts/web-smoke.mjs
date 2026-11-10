// 웹 번들 스모크 점검(F0 통과 조건 1 · 2 · 최종 청사진 F-9의 웹 대체 확인). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저).
//  먼저 `npm run check:web`(= expo export --platform web)으로 dist/ 를 만든 뒤 쓴다.
//  dist/ 를 로컬 주소로 열고 헤드리스 Edge(없으면 Chrome)를 CDP 로 움직여 다음을 잰다. 앱 코드는 고치지 않는다.
//   A. 첫 화면: 앱 시작(/) → 01 온보딩, 문서 언어 ko · 제목 결정사 · 글꼴 3종 불러옴 · 콘솔 오류 0 · 브라우저 저장소 비어 있음(토큰은 메모리뿐)
//   (탭바 칸 = 아이콘이 있는 role=tab. 11 호감 화면 안의 '보낸 호감 · 받은 호감 · 연결됨' 칸(F6)은 탭바가 아니다)
//   B. 16개 화면: 주소마다 열려서 'NN 이름'(F1 이 본문을 채운 01 · 02 · 03 · 15 는 본문 글)이 보이고, 탭바는 09 · 11 · 12 · 13 · 14 · 16 에만(F11: 08 내 프로필은 탭 밖), 폭 360 에서 가로 넘침 0 · 글자 12 이상
//   C. 탭바: 현재 탭 = 채움 아이콘 + 라벨 Bold 브랜드색 + aria-selected, 나머지 = 선형 회색 · 13 · 14 에서도 부모 탭이 켜짐 · 탭을 누르면 이동
//   D. 눌림 효과: 주 버튼(01 [시작하기]) 누르는 동안 0.96배 + 흰색 20% 원, 보조 버튼(02 [인증번호 받기], 강조 윤곽형)은 장미 20% 원, 떼면 1배 · 원 사라짐, 탭 칸은 크기 변화 없이 원만,
//      '동작 줄이기'(prefers-reduced-motion) 에서는 크기 변화 없음 · 원 최대 0.5배
//   E. 화면 이동: 01 의 [시작하기]를 눌러 02 로 간다
//   (F1 이후: 01 · 02 · 03 · 15 의 본문 점검은 scripts/web-f1.mjs 가 데모 모드 번들로 한다. 이 점검은 F0 가 만든 것을 그대로 지킨다)
// QF2-A Q2-14(T1-06): 기대값을 V5 구조(탑승권 · 채팅 · 설정 3탭, 09 · 10 · 11 · 13 · 14 · 16 은 스위치로 숨겨 홈으로, 탭 아이콘은 svg)에 맞췄다. 번들 폴더를 인자로 줄 수 있다.
//    데모 번들(로그인 없이 직접 주소)에서 확인했다 — 서버를 쓰는 일반 번들에서는 돌려 보지 않았다(미확인).
// 사용: node scripts/web-smoke.mjs [번들 폴더]   (스크린샷은 확인/스크린샷/ 에 저장)
// 종료 코드: 0 통과 · 1 실패 · 2 브라우저가 없어 못 봄(미확인)
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { killBrowserTree } from './lib/browser.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.resolve(appDir, process.argv[2] ?? 'dist'); // 인자로 번들 폴더를 줄 수 있다(스크래치에 만든 번들 등)
const shotDir = path.join(appDir, '확인', '스크린샷');

const BROWSER = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => p && fs.existsSync(p));

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('[미확인] dist/index.html 이 없어요. 먼저 npm run check:web 을 하세요.');
  process.exit(2);
}
if (!BROWSER) {
  console.log('[미확인] Edge 또는 Chrome 을 찾지 못했어요. BROWSER_PATH 에 실행 파일 경로를 주면 돼요.');
  process.exit(2);
}

// 토큰 색(디자인/가이드.md 1장)을 브라우저가 돌려주는 rgb 꼴로 적는다. 값이 바뀌면 tokens.ts 와 함께 고친다.
const ROSE = 'rgb(155, 59, 82)'; // accent #9B3B52
const GRAY = 'rgb(117, 102, 95)'; // sub #75665F (F9 v2)

const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, title, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 정적 서버: 파일이 없는 주소는 index.html 로 보낸다(web.output single)
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(distDir, pathname);
  if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// ── 아주 작은 CDP 클라이언트(Node 내장 WebSocket)
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      } else if (m.method) this.listeners.forEach((fn) => fn(m));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) {
    this.listeners.push(fn);
  }
  once(method, ms = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} 대기 시간 초과`)), ms);
      this.on((m) => {
        if (m.method === method) {
          clearTimeout(timer);
          resolve(m.params);
        }
      });
    });
  }
}

async function waitJson(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* 아직 안 떴다 */
    }
    await sleep(250);
  }
  throw new Error('브라우저 디버그 포트가 열리지 않았어요');
}

const port = 9700 + Math.floor(Math.random() * 200);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gjs-smoke-'));
const proc = spawn(
  BROWSER,
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'],
  { stdio: 'ignore' },
);

// T1-10(QF2-A): 브라우저가 답하지 않거나 전체 시간(기본 10분, WEB_TOTAL_MS)이 지나면 브라우저(프로세스 나무)를 닫고 끝낸다 · 끝난 뒤에도 남은 Edge 한 벌이 없게 한다
const killBrowser = () => killBrowserTree(proc, profile); // RS2-01 [마]3: 공용 종료 처리(처음 프로세스 + 프로필로 찾은 나무)
process.once('exit', killBrowser);
const totalMs = Number(process.env.WEB_TOTAL_MS ?? 600000);
function hardStop(why) {
  console.log(`[실패] ${why} — 브라우저를 닫고 끝내요`);
  killBrowser();
  setTimeout(() => process.exit(1), 10000);
}
const guard = setTimeout(() => hardStop(`점검 전체 시간 ${Math.round(totalMs / 1000)}초 초과`), totalMs);
guard.unref();

const errors = []; // 콘솔 오류 · 예외
const requests = new Map();
let cdp;
let ws;

const evaluate = async (expression) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`브라우저가 60초 동안 답하지 않음 — 식: ${String(expression).slice(0, 80)}`)), Number(process.env.EVAL_TIMEOUT_MS ?? 60000));
  });
  const r = await Promise.race([cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), timeout])
    .catch((error) => {
      if (String(error?.message).includes('동안 답하지 않음')) hardStop(String(error.message));
      throw error;
    })
    .finally(() => clearTimeout(timer));
  if (r.exceptionDetails) throw new Error(`브라우저 식 오류: ${r.exceptionDetails.text}`);
  return r.result.value;
};
const viewport = (width, height) => cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
async function open(pathname, until) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: origin + pathname });
  await loaded;
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`(${until})()`)) return true;
    await sleep(250);
  }
  return false;
}
async function shot(name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(shotDir, { recursive: true });
  fs.writeFileSync(path.join(shotDir, name), Buffer.from(r.data, 'base64'));
  return `확인/스크린샷/${name}`;
}
const mouse = (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });

// 페이지 안에서 쓰는 도우미: 글자로 누르는 요소(role)를 찾는다
const HELPERS = `
  window.__findAll = (text, role) => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if ((el.innerText || '').trim() !== text) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width < 1 || rc.height < 1) continue;
      let node = el;
      while (node && node !== document.body) {
        if (node.getAttribute && node.getAttribute('role') === role) { if (!out.includes(node)) out.push(node); break; }
        node = node.parentElement;
      }
    }
    return out;
  };
  window.__find = (text, role, nth = 0) => window.__findAll(text, role)[nth] || null;
  window.__scale = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 1;
    const m = t.match(/matrix\\(([^)]+)\\)/);
    return m ? Number(m[1].split(',')[0]) : NaN;
  };
  window.__circle = (el) => [...el.children].find((c) => { const s = getComputedStyle(c); return s.position === 'absolute' && s.pointerEvents === 'none'; }) || null;
  window.__center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
`;
const installHelpers = () => evaluate(HELPERS);

// 눌러 보고 값을 돌려준다(같은 글자가 여럿이면 nth 번째). 요소 밖에서 떼서 이동 없이 끝낸다.
// shotName 을 주면 누르고 있는 동안(퍼짐이 끝난 때)의 화면을 저장한다.
async function pressProbe(text, role, nth = 0, shotName = null) {
  const target = `window.__find(${JSON.stringify(text)}, ${JSON.stringify(role)}, ${nth})`;
  const info = await evaluate(`(() => { const el = ${target}; return el ? window.__center(el) : null; })()`);
  if (!info) return null;
  const read = () =>
    evaluate(`(() => {
      const el = ${target}; const c = window.__circle(el);
      const cs = c ? getComputedStyle(c) : null;
      return { scale: window.__scale(el), circle: !!c, bg: cs ? cs.backgroundColor : null, opacity: cs ? Number(cs.opacity) : null,
        circleScale: c ? window.__scale(c) : null, circleW: c ? c.getBoundingClientRect().width : null, boxW: el.getBoundingClientRect().width };
    })()`);
  await mouse('mouseMoved', info.x, info.y);
  await mouse('mousePressed', info.x, info.y);
  await sleep(400); // 퍼짐(250ms)이 끝나고도 손가락은 누르고 있는 때
  const during = await read();
  if (shotName) console.log(`       스크린샷 ${await shot(shotName)}`);
  await mouse('mouseMoved', 2, 2);
  await mouse('mouseReleased', 2, 2);
  await sleep(700); // 크기 복귀(120ms) + 사라짐(150ms) 뒤
  return { during, after: await read() };
}

let exitCode = 0;
try {
  const targets = await waitJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  cdp = new CDP(ws);
  cdp.on((m) => {
    const p = m.params;
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type)) {
      errors.push(`console.${p.type}: ${p.args.map((x) => x.value ?? x.description ?? x.type).join(' ').slice(0, 200)}`);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(`예외: ${(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split('\n')[0].slice(0, 200)}`);
    } else if (m.method === 'Network.requestWillBeSent') {
      requests.set(p.requestId, { url: p.request.url, type: p.type, status: null, failed: null });
    } else if (m.method === 'Network.responseReceived') {
      const r = requests.get(p.requestId);
      if (r) r.status = p.response.status;
    } else if (m.method === 'Network.loadingFailed') {
      const r = requests.get(p.requestId);
      if (r) r.failed = p.errorText;
    }
  });
  for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`);

  // ── A. 첫 화면 (390 × 844)
  await viewport(390, 844);
  const reached = await open('/', `() => location.pathname === '/onboarding' && document.body.innerText.includes('시작하기')`);
  await installHelpers();
  await sleep(600);
  const first = await evaluate(`({
    path: location.pathname, lang: document.documentElement.lang, title: document.title,
    text: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140),
    fonts: [...document.fonts].map((f) => f.family.replace(/["']/g, '') + ':' + f.status),
    storage: localStorage.length + sessionStorage.length,
    scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
  })`);
  check('A', '앱 시작(/)이 01 온보딩(/onboarding)으로 간다', reached && first.path === '/onboarding', `경로 ${first.path}`);
  check('A', '문서 언어 ko · 제목 결정사', first.lang === 'ko' && first.title === '결정사', `lang=${first.lang} title=${first.title}`);
  check('A', '01 온보딩 본문(제목 · [시작하기] · [이미 계정이 있어요])이 보인다', /결혼을 정말 하고 싶은 사람들/.test(first.text) && /시작하기/.test(first.text) && /이미 계정이 있어요/.test(first.text), first.text.slice(0, 60));
  const fontNames = ['Pretendard-Regular', 'Pretendard-Medium', 'Pretendard-Bold'];
  check('A', 'Pretendard 3종이 불러와졌다', fontNames.every((n) => first.fonts.some((f) => f === `${n}:loaded`)), first.fonts.join(' '));
  check('A', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다(토큰은 메모리뿐)', first.storage === 0, `항목 ${first.storage}개`);
  check('A', '390 폭에서 가로 스크롤 0', first.scrollW <= first.innerW, `${first.scrollW} / ${first.innerW}`);
  // (F0 가 찍은 F0_01_온보딩_390x844.png 는 자리 표시 화면 기록이라 덮어쓰지 않는다. F1 의 01 은 web-f1.mjs 가 F1_01_… 로 찍는다)

  // 앱 시작(A)까지의 요청만 "네트워크를 쓰지 않는다"로 센다. B 이후는 본문이 있는 화면(07 · 08 · 09 · 10 · 12 · 13)이 로그인 없이 열려 서버를 부르는 것이 정상이다
  const startupRequests = [...requests.values()];
  // ── B. 화면 (360 × 740)
  //  V5(D-152 · W10): 09 · 10 · 11 · 13 · 14 · 16 은 스위치로 숨겨 로그인 없이 직접 열면 홈(탑승권 /boarding)으로 간다 — 아래 별도 점검.
  //  탑승권(/boarding) · 채팅(/chat)은 V5 에서 생긴 탭 화면이다.
  const SCREENS = [
    ['01', '온보딩', '/onboarding', false],
    ['02', '가입·로그인', '/sign-in', false],
    ['03', '약관·동의', '/consent', false],
    ['04', '설문', '/survey/01', false],
    ['05', '사진 등록', '/photos', false],
    ['06', 'AI 정리 중', '/analysis', false],
    ['07', '내 성향', '/traits', false],
    ['08', '내 프로필', '/profile', false], // F11: 탭이 아니라 탭 위에 열리는 화면(탭바 없음)
    ['12', '설정', '/settings', true],
    ['15', '인증 실패', '/sign-in-code-error', false],
    ['T1', '탑승권', '/boarding', true],
    ['T4', '채팅', '/chat', true],
  ];
  await viewport(360, 740);
  const failedScreens = [];
  const overflow = [];
  const tinyText = [];
  const mismatchTab = [];
  // 본문이 채워진 화면은 자리 표시 글('NN 이름') 대신 그 화면의 본문 글이 보인다(F1: 01 · 02 · 03 · 15, F3: 06 은 상단 바 제목, 07 은 로그인 · 정리 결과가 없으면 06 으로 되돌린다(K2 07)) · F4: 08 은 본문의 상단 바 제목
  const WANT = { '01': '시작하기', '02': '이메일로 시작해요', '03': '시작하려면 동의가 필요해요', '04': '설문', '05': '사진 등록', '06': 'AI 정리 중', '07': 'AI 정리 중', '08': '내 프로필', '12': '설정', '15': '인증번호가 맞지 않아요. 다시 확인해 주세요.', T1: '탑승권', T4: '채팅' };
  const TAB_COUNT = `[...document.querySelectorAll('[role=tab]')].filter((el) => el.querySelector('svg')).length`;
  for (const [id, name, route, tabBar] of SCREENS) {
    const want = WANT[id] ?? `${id} ${name}`;
    // 07 은 로그인 · 정리 결과가 없으면 06 으로 되돌아가거나, 서버가 응답하지 않을 때 자기 상단 바 제목(내 성향)만 보인다
    const alt = id === '07' ? '내 성향' : want;
    const ok = await open(route, `() => document.body.innerText.includes(${JSON.stringify(want)}) || document.body.innerText.includes(${JSON.stringify(alt)})`);
    if (!ok) {
      failedScreens.push(`${id} ${route}`);
      continue;
    }
    await sleep(300);
    const m = await evaluate(`(() => {
      const tabs = ${TAB_COUNT};
      const over = document.documentElement.scrollWidth > window.innerWidth + 1 ||
        [...document.querySelectorAll('body *')].some((el) => { const s = getComputedStyle(el); if (s.position === 'absolute' && s.pointerEvents === 'none') return false; const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1); });
      let minFont = 99;
      for (const el of document.querySelectorAll('body *')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own) minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
      }
      return { tabs, over, minFont };
    })()`);
    if (m.over) overflow.push(id);
    if (m.minFont < 12) tinyText.push(`${id}(${m.minFont}px)`);
    if ((m.tabs > 0) !== tabBar) mismatchTab.push(id);
  }
  check('B', `${SCREENS.length}개 주소(01 ~ 08 · 12 · 15 · 탑승권 · 채팅)가 모두 열려서 화면 이름이 보인다`, failedScreens.length === 0, failedScreens.length ? `안 열림: ${failedScreens.join(', ')}` : SCREENS.map((x) => x[0]).join(' '));
  check('B', '탭바(탭 칸)는 12 · 탑승권 · 채팅 에만 있다', mismatchTab.length === 0, mismatchTab.length ? `어긋남: ${mismatchTab.join(', ')}` : '');
  check('B', `폭 360 에서 가로 넘침 0 (${SCREENS.length}개 화면)`, overflow.length === 0, overflow.length ? `넘침: ${overflow.join(', ')}` : '');
  check('B', '글자 크기가 모두 12 이상', tinyText.length === 0, tinyText.length ? tinyText.join(', ') : '');
  // 숨긴 v4 화면(스위치 꺼짐): 로그인 없이 주소로 와도 홈으로
  const hidden = [];
  for (const route of ['/recommendations', '/candidate/preview', '/likes', '/recommendations-empty', '/likes-empty', '/shop']) {
    const went = await open(route, `() => location.pathname === '/boarding'`); // 스위치를 읽은 뒤에 가므로 잠깐 기다린다
    if (!went) hidden.push(route);
  }
  check('B', '숨긴 v4 화면 주소(09 · 10 · 11 · 13 · 14 · 16)를 직접 열면 홈(/boarding)으로 간다', hidden.length === 0, hidden.length ? `안 간 주소: ${hidden.join(', ')}` : '');

  // ── C. 탭바 (390 × 844)
  //  V5: 로그인 없이 열면 탭은 탑승권 · 채팅 · 설정 3개(v4 탭 추천 · 호감 · 상점은 스위치로 숨김). 아이콘은 svg — 켜진 탭은 닫힌 면(accentSoft #F6E9EC), 꺼진 탭은 선만(D42-C)
  await viewport(390, 844);
  await open('/boarding', `() => document.body.innerText.includes('탑승권')`);
  await installHelpers();
  await sleep(500);
  const tabState = () => evaluate(`(() => [...document.querySelectorAll('[role=tab]')].filter((el) => el.querySelector('svg')).map((el) => {
    const label = [...el.querySelectorAll('*')].find((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    const svg = el.querySelector('svg');
    const faced = [...svg.querySelectorAll('path')].some((p) => (p.getAttribute('fill') || '').toUpperCase() === '#F6E9EC' || getComputedStyle(p).fill === 'rgb(246, 233, 236)');
    const ls = label ? getComputedStyle(label) : null;
    const r = el.getBoundingClientRect();
    return { text: label ? label.textContent.trim() : '', x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), selected: el.getAttribute('aria-selected'),
      family: ls ? ls.fontFamily : '', color: ls ? ls.color : '', size: ls ? ls.fontSize : '', icon: faced ? 'filled' : 'line' };
  }).sort((a, b) => a.x - b.x))()`);
  const t1 = await tabState();
  check('C', '탭 3개: 탑승권 · 채팅 · 설정 순서(V5)', t1.map((t) => t.text).join(',') === '탑승권,채팅,설정', t1.map((t) => t.text).join(','));
  const active1 = t1.filter((t) => t.selected === 'true');
  check('C', '현재 탭은 한 번에 1개(탑승권)이고 aria-selected 가 켜진다', active1.length === 1 && active1[0].text === '탑승권', `켜진 탭 ${active1.map((t) => t.text).join(',') || '없음'}`);
  check('C', '현재 탭 = 닫힌 면 아이콘 + 라벨 Bold 장미색', !!t1[0] && t1[0].icon === 'filled' && /Pretendard-Bold/.test(t1[0].family) && t1[0].color === ROSE, t1[0] ? `${t1[0].icon} · ${t1[0].family} · ${t1[0].color}` : '탭 없음');
  check('C', '나머지 2탭 = 선형 아이콘 + 라벨 Regular 회색', t1.length > 1 && t1.slice(1).every((t) => t.icon === 'line' && /Pretendard-Regular/.test(t.family) && t.color === GRAY), t1.slice(1).map((t) => `${t.icon}/${t.color}`).join(' '));
  check('C', '라벨 크기 13 이상 · 탭 칸 높이 48 이상(터치 영역 48 이상, D22)', t1.length > 0 && t1.every((t) => parseFloat(t.size) >= 13 && t.h >= 48), `크기 ${t1.map((t) => t.size).join(',')} · 높이 ${t1.map((t) => t.h).join(',')}`);
  console.log(`       스크린샷 ${await shot('F0_탑승권_탭바_390x844.png')}`);

  // 탭 누르기 → 이동 + 활성 이동
  const chatPos = await evaluate(`(() => { const el = window.__find('채팅', 'tab'); return el ? window.__center(el) : null; })()`);
  if (chatPos) {
    await mouse('mouseMoved', chatPos.x, chatPos.y);
    await mouse('mousePressed', chatPos.x, chatPos.y);
    await sleep(120);
    await mouse('mouseReleased', chatPos.x, chatPos.y);
    await sleep(900);
  }
  const t2 = await tabState();
  const onChat = await evaluate('location.pathname');
  check('C', '채팅 탭을 누르면 /chat 으로 가고 채팅 탭만 닫힌 면 + Bold 가 된다', onChat === '/chat' && t2.length > 1 && t2[1].icon === 'filled' && /Bold/.test(t2[1].family) && t2.filter((t) => t.icon === 'filled').length === 1, `경로 ${onChat}, 채움 ${t2.filter((t) => t.icon === 'filled').map((t) => t.text).join(',')}`);
  for (const [route, tab] of [['/settings', '설정'], ['/boarding', '탑승권']]) {
    await open(route, `() => ${TAB_COUNT} === 3`);
    await sleep(400);
    const t = await tabState();
    const on = t.filter((x) => x.icon === 'filled' && x.selected === 'true' && /Bold/.test(x.family)).map((x) => x.text);
    check('C', `${route} 에서 켜진 탭은 ${tab} 하나다`, on.length === 1 && on[0] === tab, `켜진 탭 ${on.join(',') || '없음'}`);
  }

  // ── D. 눌림 효과 (2안 '지면' D42-M 명세 4-1 press · 가이드 10-3, 앱 Pressable.tsx — 퍼지는 물결은 지웠다)
  //  버튼 = 크기 0.985 로 살짝 줄었다 놓으면 1 · 탭 칸 = 크기 그대로 + text 6% 덮개 · 동작 줄이기 = 크기 변화 0
  //  (QF2-A Q2-14: 옛 F0 기대 '0.96배 · 흰색 · 장미 20% 원'은 물결을 쓰던 때의 값이라 지금 규격으로 바꿨다)
  await viewport(390, 844);
  await open('/onboarding', `() => document.body.innerText.includes('시작하기')`);
  await installHelpers();
  await sleep(500);
  const primaryText = '시작하기'; // 01 의 주 버튼
  const primaryBefore = await evaluate(`(() => { const el = window.__find(${JSON.stringify(primaryText)}, 'button'); return { scale: window.__scale(el) }; })()`);
  check('D', '눌리기 전에는 크기 1', primaryBefore && primaryBefore.scale === 1, JSON.stringify(primaryBefore));

  // 주 버튼: 누르는 동안의 모습을 캡처하려고 눌러 둔 채로 찍는다(pressProbe 가 400ms 누른 뒤 재고 떼서 크기 복귀를 잰다)
  const primary = await pressProbe(primaryText, 'button', 0, 'F0_눌림_주버튼_누르는중_390x844.png');
  check('D', '주 버튼을 누르면 0.985배로 줄어든다', primary && Math.abs(primary.during.scale - 0.985) < 0.004, primary ? `크기 ${primary.during.scale.toFixed(3)}` : '버튼을 못 찾음');
  check('D', '주 버튼 위에는 퍼지는 원이 없다(물결 삭제)', primary && !primary.during.circle, primary ? `원 ${primary.during.circle}` : '');
  check('D', '떼면 1배로 돌아온다', primary && Math.abs(primary.after.scale - 1) < 0.005, primary ? `크기 ${primary.after.scale.toFixed(3)}` : '');

  // 보조 버튼(강조 윤곽형): 02 의 [인증번호 받기]. 이메일 형식이 맞아야 켜지므로 이메일을 넣어 둔다(누른 채로 밖에서 떼므로 요청은 가지 않는다)
  await open('/sign-in', `() => document.body.innerText.includes('이메일로 시작해요')`);
  await installHelpers();
  await sleep(400);
  await evaluate(`document.querySelector('input[placeholder="example@email.com"]').focus()`);
  await cdp.send('Input.insertText', { text: 'a@b.co' });
  await sleep(300);
  const sec = await pressProbe('인증번호 받기', 'button', 0);
  check('D', '보조 버튼(02 [인증번호 받기])도 0.985배로 줄고 떼면 1배', sec && Math.abs(sec.during.scale - 0.985) < 0.004 && Math.abs(sec.after.scale - 1) < 0.005, sec ? `누를 때 ${sec.during.scale.toFixed(3)} · 뗀 뒤 ${sec.after.scale.toFixed(3)}` : '버튼을 못 찾음');

  // 탭 칸: 크기 변화 없이 text 6% 덮개만
  await open('/boarding', `() => document.body.innerText.includes('탑승권')`);
  await installHelpers();
  await sleep(500);
  const tab = await pressProbe('설정', 'tab', 0, 'F0_눌림_탭칸_390x844.png');
  check('D', '탭 칸은 크기가 변하지 않고 text 6% 덮개만 덮인다', tab && Math.abs(tab.during.scale - 1) < 0.005 && tab.during.circle && /, 0\.06\)$/.test(tab.during.bg) && tab.during.opacity > 0.9,
    tab ? `크기 ${tab.during.scale.toFixed(3)} · 덮개 ${tab.during.bg} · 투명도 ${tab.during.opacity}` : '탭을 못 찾음');
  check('D', '탭에서 떼면 덮개가 사라진다', tab && (!tab.after.circle || tab.after.opacity < 0.01), tab ? `투명도 ${tab.after.opacity}` : '');

  // 동작 줄이기
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await open('/onboarding', `() => document.body.innerText.includes('시작하기')`);
  await installHelpers();
  await sleep(700);
  const reduced = await pressProbe(primaryText, 'button', 0, 'F0_눌림_동작줄이기_누르는중_390x844.png');
  check('D', "'동작 줄이기'에서는 버튼 크기가 변하지 않는다", reduced && Math.abs(reduced.during.scale - 1) < 0.005, reduced ? `크기 ${reduced.during.scale.toFixed(3)}` : '버튼을 못 찾음');
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // ── E. 화면 이동
  await open('/onboarding', `() => document.body.innerText.includes('시작하기')`);
  await installHelpers();
  const goInfo = await evaluate(`(() => { const el = window.__find(${JSON.stringify(primaryText)}, 'button'); return el ? window.__center(el) : null; })()`);
  await mouse('mouseMoved', goInfo.x, goInfo.y);
  await mouse('mousePressed', goInfo.x, goInfo.y);
  await sleep(150);
  await mouse('mouseReleased', goInfo.x, goInfo.y);
  await sleep(1200);
  const afterGo = await evaluate(`({ path: location.pathname, text: document.body.innerText.includes('이메일로 시작해요') })`);
  check('E', '01 의 [시작하기]를 누르면 /sign-in(02 가입 · 로그인)으로 간다', afterGo.path === '/sign-in' && afterGo.text, `경로 ${afterGo.path}`);

  // ── 마무리: 콘솔 오류 · 요청
  const reqList = [...requests.values()];
  const failed = startupRequests.filter((r) => r.failed || (r.status && r.status >= 400));
  const outside = startupRequests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('F', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('F', '실패한 요청(4xx 이상) 0', failed.length === 0, failed.slice(0, 3).map((r) => `${r.status ?? r.failed} ${new URL(r.url).pathname}`).join(' | '));
  check('F', '서버(Supabase) 등 바깥 주소로 나간 요청 0 (앱 시작 때 네트워크를 쓰지 않는다)', outside.length === 0, `${outside.length}건 ${outside.slice(0, 2).map((r) => new URL(r.url).host.replace(/^[a-z0-9]{12,}\./, '<project>.')).join(',')}`);
  console.log(`       요청 ${reqList.length}건 (앱 시작까지 ${startupRequests.length}건 중 바깥 ${outside.length}건)`);
} catch (error) {
  exitCode = 1;
  console.log(`[실패] 점검 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  try {
    ws?.close();
  } catch {
    /* 이미 닫힘 */
  }
  killBrowser();
  server.closeAllConnections?.(); // 브라우저가 남긴 keep-alive 연결 때문에 server.close() 가 끝나지 않던 것
  server.close();
  setTimeout(() => {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* 브라우저가 아직 파일을 쥐고 있을 수 있다 */
    }
  }, 2000).unref();
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n웹 스모크 점검: 통과 ${results.length - failedCount} · 실패 ${failedCount}`);
process.exitCode = exitCode || (failedCount > 0 ? 1 : 0);
setTimeout(() => process.exit(process.exitCode ?? 0), 3000).unref(); // 마지막 줄 뒤 무엇이 남아 있어도 3초 안에 끝낸다
