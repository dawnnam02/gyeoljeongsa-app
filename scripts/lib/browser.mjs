// 웹 번들을 헤드리스 Edge(없으면 Chrome)로 열어 움직이는 도우미. 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저).
// web-f1.mjs 가 쓴다(web-smoke.mjs 는 자기 안에 같은 코드를 따로 갖고 있다: F0 점검을 건드리지 않으려고).
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findBrowser() {
  return [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].find((p) => p && fs.existsSync(p));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
};

// 정적 서버: 파일이 없는 주소는 index.html 로 보낸다(web.output single)
export async function serve(distDir) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(distDir, pathname);
    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// 아주 작은 CDP 클라이언트(Node 내장 WebSocket)
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
  once(method, ms = 60000) {
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

// 페이지 안에서 쓰는 도우미. 앱의 testID 는 웹에서 data-testid 가 된다.
const HELPERS = `
  window.__q = (id) => document.querySelector('[data-testid="' + id + '"]');
  window.__qa = (id) => [...document.querySelectorAll('[data-testid="' + id + '"]')];
  window.__text = () => document.body.innerText.replace(/\\s+/g, ' ');
  window.__center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
  window.__visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // 가로 넘침 · 13 미만 글자 · 터치 48 미만 요소 (D22: 글자 5단계 최소 13 · 터치 최소 48)
  window.__metrics = () => {
    const iw = window.innerWidth;
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.position === 'absolute' && s.pointerEvents === 'none') continue;
      // 일부러 만든 가로 스크롤 칸(사진 넘김)의 안쪽 칸은 화면 밖에 있어도 넘침이 아니다. 그 칸 자신이 화면 안에 있을 때만 건너뛴다
      let inHScroller = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if ((ps.overflowX === 'auto' || ps.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) {
          const pr = p.getBoundingClientRect();
          if (pr.left >= -1 && pr.right <= iw + 1) inHScroller = true;
          break;
        }
      }
      if (inHScroller) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > iw + 1 || r.left < -1)) over.push((el.getAttribute('data-testid') || el.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right));
    }
    let minFont = 99;
    const tiny = [];
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && window.__visible(el)) { const f = parseFloat(getComputedStyle(el).fontSize); if (f < minFont) minFont = f; if (f < 13) tiny.push(el.textContent.trim().slice(0, 12)); }
    }
    const small = [];
    for (const el of document.querySelectorAll('[role=button],[role=checkbox],[role=link],[role=tab],button,a')) {
      if (!window.__visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5) small.push((el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 10)) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return { scrollW: document.documentElement.scrollWidth, innerW: iw, over, minFont, tiny, small };
  };
`;

export async function openBrowser({ distDir, shotDir, width = 360, height = 740 }) {
  const browser = findBrowser();
  if (!browser) throw new Error('Edge 또는 Chrome 을 찾지 못했어요. BROWSER_PATH 에 실행 파일 경로를 주면 돼요.');
  const web = await serve(distDir);
  // 다른 점검이 같은 포트를 쓰거나 컴퓨터가 바빠 브라우저가 늦게 뜨면 새 포트로 최대 3번 다시 띄운다(같은 컴퓨터에서 여러 작업이 점검을 돌린다)
  let port = 0;
  let profile = '';
  let proc;
  let targets;
  for (let attempt = 1; ; attempt += 1) {
    port = 9300 + Math.floor(Math.random() * 600);
    profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gjs-f1-'));
    proc = spawn(
      browser,
      ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank'],
      { stdio: 'ignore' },
    );
    try {
      targets = await waitJson(`http://127.0.0.1:${port}/json/list`, 120);
      break;
    } catch (error) {
      try {
        proc.kill();
      } catch {
        /* 이미 끝남 */
      }
      if (attempt >= 3) throw error;
    }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new CDP(ws);

  const errors = [];
  const requests = new Map();
  cdp.on((m) => {
    const p = m.params;
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(p.type)) errors.push(`console.${p.type}: ${p.args.map((x) => x.value ?? x.description ?? x.type).join(' ').slice(0, 200)}`);
    else if (m.method === 'Runtime.exceptionThrown') errors.push(`예외: ${(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).split('\n')[0].slice(0, 200)}`);
    else if (m.method === 'Network.requestWillBeSent') requests.set(p.requestId, { url: p.request.url, status: null, failed: null });
    else if (m.method === 'Network.responseReceived') {
      const r = requests.get(p.requestId);
      if (r) r.status = p.response.status;
    } else if (m.method === 'Network.loadingFailed') {
      const r = requests.get(p.requestId);
      if (r) r.failed = p.errorText;
    }
  });
  for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`);
  // 다른 창이 앞에 있거나 컴퓨터가 바쁠 때 브라우저가 이 페이지를 '안 보이는 창'으로 보고 애니메이션 프레임을 멈추는 것을 막는다(B-Q1-01 "링이 돈다" 가끔 실패)
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
  await cdp.send('Page.bringToFront').catch(() => undefined);

  // QP-15: 페이지가 멈추거나(무한 반복 · 렌더 고리) 연결이 끊기면 Runtime.evaluate 가 영원히 답하지 않아 점검이 15분 넘게 멈췄다(1/3 재현).
  //  60초(EVAL_TIMEOUT_MS)를 넘기면 멈춘 곳을 알리며 실패로 끝낸다 — 무한 대기 대신 '어느 단계에서 페이지가 답하지 않았는지'가 남는다
  const evalTimeoutMs = Number(process.env.EVAL_TIMEOUT_MS ?? 60000);
  const evaluate = async (expression) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`브라우저가 ${evalTimeoutMs / 1000}초 동안 답하지 않음(페이지 멈춤 또는 연결 끊김) — 식: ${String(expression).slice(0, 80)}`)), evalTimeoutMs);
    });
    const r = await Promise.race([cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), timeout]).finally(() => clearTimeout(timer));
    if (r.exceptionDetails) throw new Error(`브라우저 식 오류: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const viewport = (w, h) => cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await viewport(width, height);

  const api = {
    origin: web.origin,
    cdp,
    evaluate,
    errors,
    requests,
    viewport,
    // 주소를 열고(새로 불러온다) 조건 식이 참이 될 때까지 기다린다
    async open(pathname, until) {
      const loaded = cdp.once('Page.loadEventFired');
      await cdp.send('Page.navigate', { url: web.origin + pathname });
      await loaded;
      await evaluate(HELPERS);
      return api.waitFor(until);
    },
    async installHelpers() {
      await evaluate(HELPERS);
    },
    // 식(문자열)이 참이 될 때까지 기다린다. 참이면 true, 시간이 지나면 false
    async waitFor(expression, ms = 15000) {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        try {
          if (await evaluate(`(() => { try { return !!(${expression}); } catch (e) { return false; } })()`)) return true;
        } catch {
          /* 아직 */
        }
        await sleep(150);
      }
      return false;
    },
    async shot(name) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(shotDir, { recursive: true });
      fs.writeFileSync(path.join(shotDir, name), Buffer.from(r.data, 'base64'));
      return `확인/스크린샷/${name}`;
    },
    mouse: (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 }),
    // 요소(css 선택자)의 가운데를 마우스로 누른다. holdMs 동안 누르고 있는다
    async click(selector, holdMs = 80) {
      const info = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); return window.__center(el); })()`);
      if (!info) throw new Error(`누를 요소가 없어요: ${selector}`);
      await sleep(60);
      const fresh = await evaluate(`window.__center(document.querySelector(${JSON.stringify(selector)}))`);
      await api.mouse('mouseMoved', fresh.x, fresh.y);
      await api.mouse('mousePressed', fresh.x, fresh.y);
      await sleep(holdMs);
      await api.mouse('mouseReleased', fresh.x, fresh.y);
      await sleep(250);
    },
    // 이 글자를 가진 누를 수 있는 요소를 누른다(role 로 거른다)
    async clickText(text, role = 'button', nth = 0, holdMs = 80) {
      const tag = `data-click-${Date.now()}`;
      const ok = await evaluate(`(() => {
        const out = [];
        for (const el of document.querySelectorAll('body *')) {
          if ((el.innerText || '').trim() !== ${JSON.stringify(text)}) continue;
          if (!window.__visible(el)) continue;
          let node = el;
          while (node && node !== document.body) { if (node.getAttribute && node.getAttribute('role') === ${JSON.stringify(role)}) { if (!out.includes(node)) out.push(node); break; } node = node.parentElement; }
        }
        const target = out[${nth}];
        if (!target) return false;
        target.setAttribute(${JSON.stringify(tag)}, '1');
        return true;
      })()`);
      if (!ok) throw new Error(`누를 요소가 없어요: "${text}" (${role})`);
      await api.click(`[${tag}]`, holdMs);
      await evaluate(`document.querySelector('[${tag}]')?.removeAttribute(${JSON.stringify(tag)})`);
    },
    // 입력 칸에 글자를 넣는다(원래 값은 바꿔 넣는다)
    async type(selector, text) {
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); if (el.select) el.select(); })()`);
      if (text === '') await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }).then(() => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }));
      else await cdp.send('Input.insertText', { text });
      await sleep(250);
    },
    close() {
      try {
        ws.close();
      } catch {
        /* 이미 닫힘 */
      }
      try {
        proc.kill();
      } catch {
        /* 이미 끝남 */
      }
      web.close();
      setTimeout(() => {
        try {
          fs.rmSync(profile, { recursive: true, force: true });
        } catch {
          /* 브라우저가 아직 파일을 쥐고 있을 수 있다 */
        }
      }, 2000).unref();
    },
  };
  return api;
}
