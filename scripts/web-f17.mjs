// F17 웹 점검(v4 완성도: 바탕 bgGrad · 움직임 7장면 · 동작 줄이기 · 뒤 어둡게 40% · 로고 타일). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 사람이 하는 순서대로 누르며 움직임 중간 · 끝을 캡처한다.
//  잰 것: 바탕 덮개(높이 · 위 0 · 폭 전체 · linear-gradient 색) · 탭바 · 카드 · 시트 단색 · 장면별 중간 모양(transform) · 동작 줄이기(prefers-reduced-motion)면 transform 없음 ·
//         시트 뒤 어둡게 rgba(43,34,32,0.4) · 가로 넘침 0 · 글자 13 · 터치 48 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR]/F17_*.png · 폭은 SHOT_WIDTH(기본 390)
// 사용: SHOT_SUBDIR=F17_390 node scripts/web-f17.mjs [번들 폴더]   (npm run check:f17)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');
const width = Number(process.env.SHOT_WIDTH ?? 390);

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
  const file = `F17_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const path0 = () => b.evaluate('location.pathname');
const wait = (expr, ms = 12000) => b.waitFor(expr, ms);
const visSel = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e) && (() => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!t && (t === e || e.contains(t) || t.contains(e)); })())`;
const vis = (id) => b.evaluate(`!!(${visSel(id)})`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-f17]').forEach((e) => e.removeAttribute('data-f17'))`);
  const ok = await b.evaluate(`(() => { const el = ${visSel(id)} ?? [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); if (!el) return false; el.setAttribute('data-f17', '1'); return true; })()`);
  if (!ok) throw new Error(`보이는 ${id} 가 없어요`);
  await b.click('[data-f17="1"]');
};
// 보이는 바탕 덮개(가장 위에 그려진 화면의 것) — 높이 · 위치 · 폭 · 그라데이션 색
const backdrop = (id = 'screen-backdrop') =>
  b.evaluate(`(() => {
    const all = [...document.querySelectorAll('[data-testid="${id}"]')].filter((e) => window.__visible(e));
    const el = all[all.length - 1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const grad = [...el.querySelectorAll('*')].concat(el).map((x) => getComputedStyle(x).backgroundImage).find((v) => v && v.includes('gradient')) ?? '';
    return { h: Math.round(r.height), top: Math.round(r.top), w: Math.round(r.width), iw: window.innerWidth, grad };
  })()`);
const gradOk = (g) => !!g && g.h > 0 && g.top <= 0 && g.w >= g.iw - 1 && /rgb\(246, 233, 236\)/.test(g.grad) && /rgb\(255, 251, 247\)/.test(g.grad);
// 화면에 있는 transform 이 하나라도 이동 · 크기 · 회전인가(동작 줄이기 점검)
const moving = (rootSel) =>
  b.evaluate(`(() => { const root = document.querySelector(${JSON.stringify(rootSel)}) ?? document.body; let n = 0; for (const el of root.querySelectorAll('*')) { const t = getComputedStyle(el).transform; if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') n += 1; } return n; })()`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

async function signIn(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await sleep(3200); // 스플래시가 걷힐 때까지
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
  // 설문 첫 화면이 들어오는 동안 누름이 빠질 때가 있어 세 번까지 다시 누른다(F21 회귀 때 덧붙임)
  for (let i = 0; i < 3; i += 1) {
    await b.waitFor(`document.body.innerText.includes('설문 완료 · 정상 응답') || location.pathname === '/traits'`, 15000);
    await new Promise((r) => setTimeout(r, 500));
    if (await b.evaluate(`location.pathname.startsWith('/survey') && document.body.innerText.includes('설문 완료 · 정상 응답')`)) await b.clickText('설문 완료 · 정상 응답');
    if (await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000)) break;
  }
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 40000);
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
}

let exitCode = 0;
try {
  // ═══ 1. 스플래시(로고 타일 찍힘 → 글자 → 종이 펼침) ═══
  const loaded = b.cdp.once('Page.loadEventFired');
  await b.cdp.send('Page.navigate', { url: `${b.origin}/onboarding` });
  await loaded;
  await b.installHelpers();
  await b.waitFor(`!!window.__q('splash-tile')`, 15000);
  // 스플래시는 2.1초 뒤 걷히므로 보이자마자 잰다(기계가 바쁘면 알아채기가 늦다). 모서리 비율은 찍히는 중 크기 · 기울기에 흔들리지 않게 화면 상자 대신 제 폭(offsetWidth)으로 잰다(F21 회귀 때 고침)
  const tileOk = await b.evaluate(`(() => { const t = [...document.querySelectorAll('[data-testid="splash-tile-tile"]')].find((e) => window.__visible(e)); if (!t) return false; const w = t.offsetWidth; const rad = parseFloat(getComputedStyle(t).borderTopLeftRadius); return Math.abs(rad / w - 0.225) < 0.02 && !!window.__q('splash-wordmark'); })()`);
  const sb = await backdrop('splash-backdrop');
  const tileMoving = await moving(sel('splash'));
  await shot('01_스플래시_1_찍힘중');
  check('1', '스플래시: A안 로고 타일(모서리 22.5%) · 글자 로고 · 바탕 bgGrad 360', tileOk, `찍히는 동안 움직이는 요소 ${tileMoving}`);
  check('1', '스플래시 바탕: 위 0 · 폭 전체 · 높이 360 · accentSoft → bg', gradOk(sb) && sb.h === 360, JSON.stringify(sb));
  await sleep(700);
  await shot('01_스플래시_2_타일과글자');
  await sleep(1100);
  await shot('01_스플래시_3_종이펼침');
  check('1', '3초 안에 스플래시가 걷히고 01 온보딩이 보인다', await wait(`!window.__q('splash') && !!window.__q('intro-title')`, 6000), await path0());

  // ═══ 2. 온보딩(바탕 360 · 넘김) ═══
  const ob = await backdrop();
  check('2', '01 온보딩 바탕: 높이 360 · 위 0 · 폭 전체', gradOk(ob) && ob.h === 360, JSON.stringify(ob));
  await shot('02_온보딩_1장_바탕360');
  await measure('01 온보딩');
  await tap('intro-dot-2');
  await sleep(120);
  const obMoving = await moving(sel('intro-slide'));
  await shot('02_온보딩_넘김중');
  await sleep(900);
  await shot('02_온보딩_2장_안착');
  check('2', '점을 누르면 새 장이 옆에서 들어오며 그림이 안착한다(넘기는 중 transform 있음 · 끝나면 제자리)', obMoving > 0 && (await moving(sel('intro-slide'))) === 0, `넘기는 중 ${obMoving} · 끝 ${await moving(sel('intro-slide'))}`);

  // ═══ 3. 가입 화면 바탕 260 · 09 추천 3장 도착 ═══
  await signIn('f17plain@email.com');
  // 카드가 처음 보이는 순간부터 바로 잰다(도착은 약 0.9초 — 기계가 바쁘면 '보임' 알아채기가 늦어 놓칠 수 있어 한 번의 식으로 함께 잰다)
  let landMoving = 0;
  let arrived = false;
  for (let i = 0; i < 200 && landMoving === 0; i += 1) {
    const now = await b.evaluate(`(() => { const s = document.querySelector('[data-testid="screen-09"]'); if (location.pathname !== '/recommendations' || !window.__q('rec-card-0') || !s) return -1; let n = 0; for (const el of s.querySelectorAll('*')) { const t = getComputedStyle(el).transform; if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') n += 1; } return n; })()`);
    if (now >= 0) {
      arrived = true;
      landMoving = now;
      if (now > 0) await shot('09_카드도착중');
      if (now === 0) break;
    } else await sleep(30);
  }
  await sleep(1000);
  await shot('09_추천3장_바탕300');
  const rb = await backdrop();
  check('3', '09 바탕: 높이 300 · 위 0(상태 표시줄 뒤부터) · 폭 전체 · accentSoft → bg', arrived && gradOk(rb) && rb.h === 300, JSON.stringify(rb));
  check('3', '카드가 놓이는 중 transform 이 있고(이동 · 기울기) 1초 뒤에는 제자리', landMoving > 0 && (await moving(sel('screen-09'))) === 0, `도착 중 ${landMoving}`);
  check('3', '카드 · 탭바는 단색(바탕 그라데이션이 비치지 않음)', await b.evaluate(`(() => { const c = window.__q('rec-card-0'); const tab = document.querySelector('[role=tablist]') ?? document.querySelector('[role=tab]')?.parentElement; const bg = (e) => e && getComputedStyle(e).backgroundColor; return ['rgb(245, 238, 232)', 'rgb(255, 251, 247)'].includes(bg(c)) && getComputedStyle(c).backgroundImage === 'none' && (!tab || getComputedStyle(tab).backgroundImage === 'none'); })()`), ''); // F21 UI v2: 추천 카드는 종이(bg 단색)
  await measure('09 추천');

  // ═══ 4. 호감 보내기(편지) ═══
  await tap('rec-card-0');
  await wait(`location.pathname.startsWith('/candidate/') && !!window.__q('candidate-like')`);
  await sleep(500);
  const cb = await backdrop();
  check('4', '10 바탕: 기본 높이 260', gradOk(cb) && cb.h === 260, JSON.stringify(cb));
  await b.evaluate(`window.__q('candidate-like')?.scrollIntoView({ block: 'center' })`);
  await tap('candidate-like');
  let mailSeen = false;
  let sentSeen = false;
  for (let i = 0; i < 60 && !(mailSeen && sentSeen); i += 1) {
    // 편지는 0.7초만 있다 — 쉬지 않고 본다
    const seen = await b.evaluate(`[!!window.__q('candidate-mail'), (window.__q('candidate-like')?.innerText ?? '').includes('호감 보냄')]`);
    mailSeen ||= seen[0];
    sentSeen ||= seen[1];
  }
  await shot('10_호감보내기_편지');
  check('4', '[호감 보내기] → "호감 보냄" + 편지 한 통이 위로 떠난다', mailSeen && sentSeen, `편지 ${mailSeen} · 호감 보냄 ${sentSeen}`);
  check('4', '편지가 떠난 뒤 09 + 토스트', (await wait(`location.pathname === '/recommendations' && document.body.innerText.includes('호감을 보냈어요')`, 6000)), await path0());
  await sleep(200);
  await shot('09_토스트');

  // ═══ 5. 서로 수락(순간) ═══
  await b.click(`[role=tab][aria-label="호감"]`);
  await wait(`location.pathname === '/likes' && !!window.__q('like-accept-received-0')`);
  await sleep(400);
  await tap('like-accept-received-0');
  const moment = await wait(`!!window.__q('match-moment')`, 4000);
  await sleep(500);
  await shot('11_서로수락_순간_찍힘');
  let mb = null;
  for (let i = 0; i < 5 && !mb; i += 1) {
    mb = await backdrop('match-moment-backdrop');
    if (!mb) await sleep(100);
  }
  check('5', '서로 수락 순간: 두 원 · 로고 타일 · 글(카피 그대로) · 바탕 460', moment && (await b.evaluate(`document.body.innerText.includes('서로 수락했어요')`)) && gradOk(mb) && mb.h === 460, JSON.stringify(mb));
  await sleep(900);
  await shot('11_서로수락_순간_글');
  check('5', '2.2초 머문 뒤 걷힌다(탭은 그대로)', await wait(`!window.__q('match-moment')`, 5000), '');

  // ═══ 6. 구매 완료(시트 · 로고 타일) ═══
  await b.click(`[role=tab][aria-label="상점"]`);
  await wait(`location.pathname === '/shop' && !!window.__q('shop-grade-detail')`);
  await tap('shop-grade-detail');
  await wait(`!!window.__q('detail-option-1m')`);
  await tap('detail-option-1m');
  await b.evaluate(`window.__q('detail-buy')?.scrollIntoView({ block: 'center' })`);
  await tap('detail-buy');
  await wait(`!!window.__q('purchase-pay')`);
  await sleep(150);
  await shot('16-3_시트_올라옴');
  check('6', '시트 뒤 어둡게 = text 40%(rgba(43, 34, 32, 0.4)) · 시트는 단색 bg', await b.evaluate(`[...document.querySelectorAll('*')].some((e) => getComputedStyle(e).backgroundColor === 'rgba(43, 34, 32, 0.4)')`), '');
  await sleep(500);
  await tap('purchase-pay');
  await wait(`!!window.__q('purchase-demo-buy')`);
  await tap('purchase-demo-buy');
  const done = await wait(`!!window.__q('purchase-done-art')`, 8000);
  await sleep(250);
  await shot('16-5_구매완료_찍힘');
  await sleep(800);
  await shot('16-5_구매완료');
  check('7', '구매 완료: 로고 타일이 찍히고 글이 올라온다', done && (await vis('purchase-done-text')), '');
  await tap('purchase-done-ok');
  await sleep(600);

  // ═══ 8. 동작 줄이기(prefers-reduced-motion) ═══
  await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const loaded2 = b.cdp.once('Page.loadEventFired');
  await b.cdp.send('Page.navigate', { url: `${b.origin}/onboarding` });
  await loaded2;
  await b.installHelpers();
  await b.waitFor(`!!window.__q('splash-tile')`, 15000);
  await sleep(80);
  const rmSplash = await moving(sel('splash'));
  await shot('줄이기_스플래시');
  check('8', '동작 줄이기: 스플래시 타일 · 글자에 이동 · 크기 변화 없음(투명도만)', rmSplash === 0, `움직이는 요소 ${rmSplash}`);
  check('8', '동작 줄이기: 펼침 없이 1.5초 안에 걷힌다', await wait(`!window.__q('splash') && !!window.__q('intro-title')`, 3000), '');
  await tap('intro-dot-3');
  await sleep(60);
  const rmSlide = await moving(sel('intro-slide'));
  check('8', '동작 줄이기: 온보딩 넘김에 옆 이동 · 그림 크기 변화 없음', rmSlide === 0, `움직이는 요소 ${rmSlide}`);
  await shot('줄이기_온보딩_3장');
  await b.cdp.send('Emulation.setEmulatedMedia', { features: [] });

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('9', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('9', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
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
console.log(`\nF17 점검: 통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
