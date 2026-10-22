// F21 웹 점검(UI v2 + 움직임 v2 '흐르는 결정사'). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 사람이 하는 순서대로 누르며 움직임 중간 · 끝을 캡처한다.
//  잰 것: 09 기한 알약 · 종이 카드 · 탭바 현재 탭 알약 · 화면마다 주 버튼 1개 이하 · 큰 제목 줄어듦(작은 제목 · 아래 선) ·
//         09 → 10 사진 이어 붙임 덮개(움직임) / 없음(동작 줄이기) · 10 하단 고정(위 24 흐림 · 위 선 없음) · 신고 시트(위 모서리 24 · 손잡이 36 × 4 ·
//         뒤 어둡게 40%) · 천천히 조금 끌면 제자리 · 빠르게 튕기면 닫힘 · 탭 넘김 투명도만 · 30초 가만히 두면 움직이는 것 없음 ·
//         동작 줄이기면 이동 · 크기 변화 없음 · 가로 넘침 0 · 글자 13 · 터치 48 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR]/F21_*.png · 폭은 SHOT_WIDTH(기본 390)
// 사용: SHOT_SUBDIR=F21_390 node scripts/web-f21.mjs [번들 폴더] [--reduced-motion]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const args = process.argv.slice(2);
const reduced = args.includes('--reduced-motion');
const distDir = path.resolve(APP_DIR, args.find((a) => !a.startsWith('--')) ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const tag = reduced ? '줄이기_' : '';

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 npm run check:web:demo 를 하세요.`);
  process.exit(2);
}
if (!findBrowser()) {
  console.log('[미확인] Edge 또는 Chrome 을 찾지 못했어요. BROWSER_PATH 에 실행 파일 경로를 주면 돼요.');
  process.exit(2);
}

const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, title, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? ` — ${detail}` : ''}`);
}

const b = await openBrowser({ distDir, shotDir, width, height: 844 });
const shot = async (name) => {
  const file = `F21_${tag}${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const path0 = () => b.evaluate('location.pathname');
const wait = (expr, ms = 12000) => b.waitFor(expr, ms);
const visSel = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e) && (() => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!t && (t === e || e.contains(t) || t.contains(e)); })())`;
const vis = (id) => b.evaluate(`!!(${visSel(id)})`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-f21]').forEach((e) => e.removeAttribute('data-f21'))`);
  const ok = await b.evaluate(`(() => { const el = ${visSel(id)} ?? [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); if (!el) return false; el.setAttribute('data-f21', '1'); return true; })()`);
  if (!ok) throw new Error(`보이는 ${id} 가 없어요`);
  await b.click('[data-f21="1"]');
};
// 보이는 요소의 상자 · 계산된 모양
const box = (id) =>
  b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].filter((e) => window.__visible(e)).pop(); if (!el) return null; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.left, y: r.top, w: r.width, h: r.height, bg: s.backgroundColor, img: s.backgroundImage, rad: s.borderTopLeftRadius, bw: s.borderTopWidth, bc: s.borderTopColor, op: Number(s.opacity) }; })()`);
// 화면 안 이동 · 크기 · 회전 transform 수
const moving = (rootSel) =>
  b.evaluate(`(() => { const root = document.querySelector(${JSON.stringify(rootSel)}) ?? document.body; let n = 0; for (const el of root.querySelectorAll('*')) { if (!window.__visible(el)) continue; const t = getComputedStyle(el).transform; if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') n += 1; } return n; })()`);
// 보이는 주 버튼(accent 면 · role=button) 수 — 한 화면에 하나(가이드 4-4)
const primaries = () =>
  b.evaluate(`[...document.querySelectorAll('[role=button]')].filter((e) => window.__visible(e) && getComputedStyle(e).backgroundColor === 'rgb(155, 59, 82)' && (() => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 120; })()).length`);
// 움직임이 있는가: 모든 보이는 요소의 transform · opacity 지문
const fingerprint = () =>
  b.evaluate(`[...document.querySelectorAll('body *')].filter((e) => window.__visible(e)).map((e) => { const s = getComputedStyle(e); return s.transform + '|' + s.opacity; }).join(';')`);
// 요소와 조상 투명도를 곱한 실제 보이는 정도
const effOp = (id) =>
  b.evaluate(`(() => { const t = [...document.querySelectorAll('[data-testid="${id}"]')].filter((e) => window.__visible(e)).pop(); if (!t) return null; let op = 1; for (let e = t; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity); return op; })()`);
// 사진 이어 붙임 덮개를 화면 그리기마다(rAF) 3초 동안 지켜본다 — 덮개는 0.4초만 있어서 바깥에서 묻는 것으로는 놓칠 수 있다
const watchHandoff = () =>
  b.evaluate(`(() => { window.__handoffSeen = false; const until = performance.now() + 3000; const look = () => { const o = window.__q('photo-handoff'); if (o && [...o.querySelectorAll('*')].some((e) => e.getBoundingClientRect().width > 20)) window.__handoffSeen = true; if (performance.now() < until && !window.__handoffSeen) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}
// 마우스로 끌기: steps 번 나눠 ms 동안 dy 만큼. 사건 시각(timestamp)도 그 간격으로 준다(기계가 바빠도 속도가 같게)
async function drag(x, y, dy, steps, ms) {
  const t0 = Date.now() / 1000;
  const ev = (type, yy, i) => b.cdp.send('Input.dispatchMouseEvent', { type, x, y: yy, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, timestamp: t0 + (ms / 1000) * (i / steps) });
  await ev('mouseMoved', y, 0);
  await ev('mousePressed', y, 0);
  for (let i = 1; i <= steps; i += 1) {
    await ev('mouseMoved', y + (dy * i) / steps, i);
    if (ms > 100) await sleep(ms / steps);
  }
  await ev('mouseReleased', y + dy, steps);
}

async function signIn(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await sleep(3200); // 스플래시가 걷힐 때까지
  await b.waitFor(`!window.__q('splash') && !!document.querySelector('${sel('signin-email')}')`, 30000); // 기계가 바쁘면 더 걸린다
  await b.type(sel('signin-email'), email.replace('@', 'v4on@')); // V5(W10): 숨긴 v4 화면(09 · 11 · 16)을 켜는 데모 장면
  await b.clickText('인증번호 받기');
  await b.waitFor(`(() => { const el = document.querySelector('${sel('signin-code')}'); return !el.readOnly && !el.disabled; })()`);
  await b.type(sel('signin-code'), '123456');
  await b.clickText('확인');
  await b.waitFor(`!!document.querySelector('${sel('signin-birth')}')`);
  await b.type(sel('signin-birth'), '19950312');
  await b.clickText('확인');
  await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await b.click(sel('consent-all'));
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);
  await b.click(sel('consent-submit'));
  await b.waitFor(`location.pathname === '/survey/01'`);
  // 기계가 바쁘면 첫 누름이 들어가지 않을 때가 있어 세 번까지 다시 누른다(설문 첫 화면이 들어오는 중)
  for (let i = 0; i < 3; i += 1) {
    await sleep(500);
    if (await b.evaluate(`location.pathname.startsWith('/survey') && document.body.innerText.includes('설문 완료 · 정상 응답')`)) await b.clickText('설문 완료 · 정상 응답');
    if (await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000)) break;
  }
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
}

let exitCode = 0;
try {
  if (reduced) await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  // ═══ 1. 09 추천: 기한 알약 · 종이 카드 · 탭 알약 · 주 버튼 ═══
  await signIn('f21plain@email.com');
  await wait(`location.pathname === '/recommendations' && !!window.__q('rec-card-0')`, 20000);
  await sleep(1200);
  await shot('09_추천');
  // 기한 알약: 글(testID)을 감싼 알약 면
  const pill = await b.evaluate(`(() => { const t = [...document.querySelectorAll('[data-testid="recs-remaining"]')].filter((e) => window.__visible(e)).pop(); if (!t) return null; const p = t.parentElement; const r = p.getBoundingClientRect(); const s = getComputedStyle(p); return { h: r.height, bg: s.backgroundColor, rad: s.borderTopLeftRadius }; })()`);
  const card = await box('rec-card-0');
  const tabPill = await box('tab-pill-recommendations');
  check('1', '다음 추천까지 = accentSoft 알약', !pill || (pill.bg === 'rgb(246, 233, 236)' && parseFloat(pill.rad) >= pill.h / 2 - 1), JSON.stringify(pill));
  check('1', '추천 카드 = 종이(bg · line 1 · 둥글기 20)', !!card && card.bg === 'rgb(255, 251, 247)' && card.bw === '1px' && card.rad === '20px', JSON.stringify(card));
  check('1', '탭바 현재 탭 = 아이콘 뒤 accentSoft 알약 56 × 28', !!tabPill && Math.round(tabPill.w) === 56 && Math.round(tabPill.h) === 28 && tabPill.bg === 'rgb(246, 233, 236)', JSON.stringify(tabPill));
  check('1', '09 주 버튼 1개 이하', (await primaries()) <= 1, `${await primaries()}`);
  await measure('09 추천');

  // (2. 큰 제목 줄어듦은 길어서 스크롤되는 16 상점에서 잰다 — 09 는 844 높이에 다 들어간다)

  // ═══ 3. 30초 가만히: 기다림 표시 말고는 움직이는 것 없음 ═══
  const f0 = await fingerprint();
  let changed = 0;
  for (let i = 0; i < 6; i += 1) {
    await sleep(5000);
    if ((await fingerprint()) !== f0) changed += 1;
  }
  check('3', '09 를 30초 가만히 두면 transform · 투명도가 바뀌는 것이 없다(반복 장식 없음)', changed === 0, `바뀐 표본 ${changed}/6`);

  // ═══ 4. 09 → 10 사진 이어 붙임 ═══
  await watchHandoff();
  await tap('rec-card-0');
  await sleep(120);
  await shot('10_사진이어붙임_중');
  await wait(`location.pathname.startsWith('/candidate/') && !!window.__q('candidate-like')`);
  await sleep(1500);
  const overlaySeen = await b.evaluate('window.__handoffSeen');
  if (reduced) check('4', '동작 줄이기: 사진 이어 붙임 덮개 없이 투명도 넘김', !overlaySeen, `덮개 ${overlaySeen}`);
  else check('4', '카드 사진이 10 위쪽 사진 자리로 이어 붙는다(덮개가 보임 · 끝나면 사라짐)', overlaySeen && (await wait(`!window.__q('photo-handoff')?.querySelector('*') || ![...window.__q('photo-handoff').querySelectorAll('*')].some((e) => e.getBoundingClientRect().width > 20)`, 3000)), `덮개 ${overlaySeen}`);
  await sleep(700);
  await shot('10_후보');
  const cta = await box('candidate-cta');
  const fade = await b.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="candidate-cta"]')].filter((e) => window.__visible(e)).pop(); if (!c) return null; const g = [...c.querySelectorAll('*')].find((e) => getComputedStyle(e).backgroundImage.includes('gradient')); if (!g) return null; const r = g.getBoundingClientRect(); return { h: Math.round(r.height), above: Math.round(c.getBoundingClientRect().top - r.top) }; })()`);
  check('4', '10 하단 고정: 위 선 없음 · 위 24 흐림(bg 투명 → bg)', !!cta && cta.bw === '0px' && !!fade && fade.h === 24 && fade.above === 24, `${JSON.stringify(cta?.bw)} · ${JSON.stringify(fade)}`);
  check('4', '10 주 버튼 1개 이하(보조 1 : 주 2)', (await primaries()) <= 1, `${await primaries()}`);
  // 버튼 v3 A안(D-141): 주 = 와인 면 + 와인빛 그림자 + 모서리 16 / 보조 = 아이보리 면 + line 1 선 + 옅은 그림자 / 사진 › 아이콘 원 = 아이보리 + 선
  const like = await box('candidate-like');
  const likeShadow = await b.evaluate(`getComputedStyle([...document.querySelectorAll('[data-testid="candidate-like"]')].filter((e) => window.__visible(e)).pop()).boxShadow`);
  const pass = await box('candidate-pass');
  const passShadow = await b.evaluate(`getComputedStyle([...document.querySelectorAll('[data-testid="candidate-pass"]')].filter((e) => window.__visible(e)).pop()).boxShadow`);
  check('4', '버튼 v3: 주 = 와인 면 · 모서리 16 · 와인빛 그림자(+ 윗면 빛) / 보조 = 아이보리 면 · line 1 선 · 옅은 그림자', !!like && like.bg === 'rgb(155, 59, 82)' && like.rad === '16px' && /rgba\(155, 59, 82, 0\.55\)/.test(likeShadow) && /inset/.test(likeShadow) && !!pass && pass.bg === 'rgb(255, 251, 247)' && pass.bw === '1px' && pass.bc === 'rgb(234, 223, 214)' && passShadow !== 'none', `주 ${like?.bg} ${like?.rad} | 보조 ${pass?.bg} ${pass?.bw} ${pass?.bc}`);
  const arrow = await b.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="candidate-photo-next-circle"]')].filter((e) => window.__visible(e)).pop(); if (!c) return null; const s = getComputedStyle(c); return { bg: s.backgroundColor, bw: s.borderTopWidth, shadow: s.boxShadow !== 'none' }; })()`);
  check('4', '버튼 v3: 사진 › 아이콘 원 = 아이보리 면 + line 1 선 + 옅은 그림자', !arrow || (arrow.bg === 'rgb(255, 251, 247)' && arrow.bw === '1px' && arrow.shadow), JSON.stringify(arrow));
  await measure('10 후보');
  // 포커스 고리는 키보드로 왔을 때만(D-141): 마우스로 사진 › 를 누른 뒤에는 고리 없음 → Tab 으로 옮기면 와인 고리
  if (await vis('candidate-photo-next')) {
    await tap('candidate-photo-next');
    await sleep(300);
  }
  const ringAfterClick = await b.evaluate(`[...document.querySelectorAll('[data-testid$="-focus"]')].some((e) => window.__visible(e))`);
  await b.cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await b.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(300);
  check('4', '포커스 고리: 마우스로 누른 뒤에는 없다(키보드로 왔을 때만)', !ringAfterClick, `누른 뒤 고리 ${ringAfterClick}`);

  // ═══ 5. 신고 · 차단 시트: 모양 · 끌어 닫기 ═══
  await tap('candidate-header-right');
  await sleep(150);
  await shot('10_신고시트_열리는중');
  await wait(`!!window.__q('report-menu-report')`, 4000);
  await sleep(500);
  await shot('10_신고시트');
  const handle = await b.evaluate(`(() => { const g = [...document.querySelectorAll('[data-testid="report-menu-handle"]')].filter((e) => window.__visible(e)).pop(); if (!g) return null; const r = g.getBoundingClientRect(); const bar = [...g.querySelectorAll('*')].map((e) => e.getBoundingClientRect()).find((q) => Math.round(q.width) === 36 && Math.round(q.height) === 4); let rad = '0px'; for (let e = g.parentElement, i = 0; e && i < 4; e = e.parentElement, i += 1) { const v = getComputedStyle(e).borderTopLeftRadius; if (v !== '0px') { rad = v; break; } } let sh = g; for (let e = g.parentElement, i = 0; e && i < 4; e = e.parentElement, i += 1) if (getComputedStyle(e).borderTopLeftRadius !== '0px') { sh = e; break; } return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: Math.round(r.height), bar: !!bar, rad, sheetH: Math.round(sh.getBoundingClientRect().height) }; })()`);
  const dim = await b.evaluate(`[...document.querySelectorAll('*')].some((e) => getComputedStyle(e).backgroundColor === 'rgba(43, 34, 32, 0.4)')`);
  check('5', '시트: 위 모서리 24 · 손잡이 36 × 4(터치 44) · 뒤 어둡게 text 40%', !!handle && handle.bar && handle.h === 44 && handle.rad === '24px' && dim, JSON.stringify(handle));
  if (handle) {
    const small = Math.round(handle.sheetH * 0.25);
    await drag(handle.x, handle.y, small, 10, 1000); // 천천히 조금(높이 25% · 초당 약 small)
    await sleep(800);
    check('5', `천천히 조금(${small}px) 끌고 놓으면 제자리로 돌아온다(닫히지 않음)`, await vis('report-menu-report'), '');
    await drag(handle.x, handle.y, small, 4, 40); // 같은 거리를 빠르게 튕김(초당 800 넘음)
    await sleep(900);
    const flicked = !(await vis('report-menu-report'));
    await shot('10_신고시트_튕겨닫힘');
    check('5', `같은 거리라도 빠르게 아래로 튕기면 닫힌다(초당 ${Math.round(small / 0.04)}px)`, flicked, '');
    if (!flicked) {
      await tap('report-menu-scrim');
      await sleep(800);
    }
    await tap('candidate-header-right');
    await wait(`!!window.__q('report-menu-report')`, 4000);
    await sleep(600);
    await drag(handle.x, handle.y, Math.round(handle.sheetH * 0.6), 12, 1200); // 천천히 길게(높이 60%)
    await sleep(900);
    check('5', '천천히라도 높이 40% 넘게 끌면 닫힌다', !(await vis('report-menu-report')), '');
    if (await vis('report-menu-report')) {
      await tap('report-menu-scrim');
      await sleep(800);
    }
  }

  // ═══ 6. 뒤로: 사진이 카드 자리로 돌아감 ═══
  await watchHandoff();
  await tap('candidate-header-back');
  await wait(`location.pathname === '/recommendations' && !!window.__q('rec-card-0')`);
  await sleep(1500);
  const backSeen = await b.evaluate('window.__handoffSeen');
  if (!reduced) check('6', '‹ 뒤로: 사진이 카드 자리로 돌아간다(덮개)', backSeen, `덮개 ${backSeen}`);
  await sleep(500);

  // ═══ 7. 탭 넘김(투명도만) ═══
  await b.click(`[role=tab][aria-label="호감"]`);
  let mid = 1;
  let moved = 0;
  for (let i = 0; i < 40; i += 1) {
    const s = await b.evaluate(`(() => { const sc = [...document.querySelectorAll('[data-testid="screen-11"]')].filter((e) => window.__visible(e)).pop(); if (!sc) return null; let op = 1; for (let e = sc; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity); return op; })()`);
    if (s !== null) mid = Math.min(mid, s);
  }
  moved = await moving(sel('screen-11'));
  await wait(`location.pathname === '/likes'`);
  await sleep(400);
  await shot('11_호감');
  check('7', '탭 넘김(첫 방문): 화면 이동 없음 · 현재 탭 알약이 11 로 옮겨 감', moved === 0 && (await box('tab-pill-likes')) !== null && (await box('tab-pill-recommendations')) === null, `가장 흐린 투명도 ${mid.toFixed(2)} · 움직이는 요소 ${moved}`);
  check('7', '11 주 버튼 1개 이하', (await primaries()) <= 1, `${await primaries()}`);
  await measure('11 호감');
  // 두 번째 방문: 09 로 갔다가 11 로 돌아오며 화면 그리기마다 11 의 실제 투명도를 잰다
  await b.click(`[role=tab][aria-label="추천"]`);
  await wait(`location.pathname === '/recommendations'`);
  await sleep(800);
  await b.evaluate(`(() => { window.__minOp = 1; window.__moved = 0; const until = performance.now() + 1500; const look = () => { const sc = [...document.querySelectorAll('[data-testid="screen-11"]')].filter((e) => window.__visible(e)).pop(); if (sc) { let op = 1; for (let e = sc; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity); window.__minOp = Math.min(window.__minOp, op); for (let e = sc; e; e = e.parentElement) { const t = getComputedStyle(e).transform; if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') window.__moved += 1; } } if (performance.now() < until) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);
  await b.click(`[role=tab][aria-label="호감"]`);
  await sleep(1700);
  const fadeMin = await b.evaluate('window.__minOp');
  const fadeMoved = await b.evaluate('window.__moved');
  if (reduced) check('7', '동작 줄이기: 두 번째 방문 탭 넘김도 화면 이동 0 · 바로 또렷함(Reanimated ReduceMotion.System 이 페이드를 건너뜀)', fadeMoved === 0 && (await effOp('screen-11')) > 0.99, `가장 흐린 투명도 ${Number(fadeMin).toFixed(2)} · 이동 ${fadeMoved}`);
  else check('7', '두 번째 방문부터 탭 넘김 = 페이드 스루(흐리게 시작해 또렷해짐 · 화면 이동 0)', fadeMin < 0.5 && fadeMoved === 0 && (await effOp('screen-11')) > 0.99, `가장 흐린 투명도 ${Number(fadeMin).toFixed(2)} · 이동 ${fadeMoved}`);

  // ═══ 8. 설정: 스위치 ═══
  await b.click(`[role=tab][aria-label="설정"]`);
  await wait(`location.pathname === '/settings' && !!window.__q('settings-rows')`);
  await sleep(600);
  await shot('12_설정');
  await b.evaluate(`window.__q('settings-grade-show')?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
  check('8', '12 등급 스위치 줄이 있다', await vis('settings-grade-show'), '');
  if (await vis('settings-grade-show')) {
    const before = await b.evaluate(`document.querySelector('${sel('settings-grade-show')}').getAttribute('aria-checked')`);
    await tap('settings-grade-show');
    await sleep(80);
    await shot('12_스위치_움직임중');
    await wait(`document.querySelector('${sel('settings-grade-show')}').getAttribute('aria-checked') !== '${before}'`, 5000);
    await sleep(500);
    check('8', '스위치: 누르면 켜짐 · 꺼짐이 바뀌고 손잡이가 끝까지 간다', (await b.evaluate(`document.querySelector('${sel('settings-grade-show')}').getAttribute('aria-checked')`)) !== before, before);
  }
  check('8', '12 주 버튼 1개 이하', (await primaries()) <= 1, `${await primaries()}`);
  await measure('12 설정');

  // ═══ 9. 상점 ═══
  await b.click(`[role=tab][aria-label="상점"]`);
  await wait(`location.pathname === '/shop' && !!window.__q('shop-grade-detail')`);
  await sleep(600);
  await shot('16_상점');
  check('9', '16 주 버튼 1개 이하', (await primaries()) <= 1, `${await primaries()}`);
  await measure('16 상점');
  const before = [await effOp('shop-header-small'), await effOp('shop-header-line')];
  await b.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(width / 2), y: 400, deltaX: 0, deltaY: 200 });
  await sleep(700);
  const after = [await effOp('shop-header-small'), await effOp('shop-header-line')];
  await shot('16_제목줄어듦');
  check('2', '16 을 아래로 내리면 머리 가운데 작은 제목(16 Bold)과 아래 선이 생긴다(맨 위에선 없음)', before[0] < 0.1 && before[1] < 0.1 && after[0] > 0.9 && after[1] > 0.9, `전 ${before.map((v) => v?.toFixed(2))} · 뒤 ${after.map((v) => v?.toFixed(2))}`);
  await b.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(width / 2), y: 400, deltaX: 0, deltaY: -400 });
  await sleep(700);
  check('2', '맨 위로 돌아가면 작은 제목과 선이 사라진다', ((await effOp('shop-header-small')) ?? 1) < 0.1, '');

  if (reduced) {
    // 넘기는 동안 화면 그리기마다 모든 요소의 transform 을 적어 두고, 값이 바뀐 요소(= 움직인 것)를 센다. 제자리에 놓인 transform(예: 켜진 스위치 손잡이)은 움직임이 아니다
    await b.evaluate(`(() => { window.__tf = new Map(); window.__changed = new Set(); const until = performance.now() + 1200; const look = () => { for (const el of document.querySelectorAll('body *')) { const raw = getComputedStyle(el).transform; const t = raw === 'matrix(1, 0, 0, 1, 0, 0)' ? 'none' : raw; const prev = window.__tf.get(el); if (prev !== undefined && prev !== t) { const ids = []; for (let x = el; x && ids.length < 3; x = x.parentElement) if (x.dataset && x.dataset.testid) ids.push(x.dataset.testid); window.__changed.add(prev + ' → ' + t + ' [' + ids.join('<') + ']'); } window.__tf.set(el, t); } if (performance.now() < until) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);
    await tap('shop-grade-detail');
    await sleep(1400);
    const rm = await b.evaluate('[...window.__changed]');
    check('9', '동작 줄이기: 화면 넘김 · 누름에 이동 · 크기 변화 없음(넘기는 1.2초 동안 transform 이 바뀐 요소 0)', rm.length === 0, `바뀐 요소 ${rm.length} ${rm.slice(0, 3).join(' | ')}`);
  }

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('Z', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('Z', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
  console.log(`       (참고) 경로 ${await path0()}`);
} catch (error) {
  console.log(`[실패] 실행 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n')}`);
  exitCode = 1;
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF21 점검${reduced ? '(동작 줄이기)' : ''}: 통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
