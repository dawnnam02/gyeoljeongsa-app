// D42-M 2안 '지면' 웹 점검(핵심 3곳 + 스플래시 캡처 · 동작 줄이기). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/).
//  보통: 스플래시(선 · 잉크 · 글자 중간 / 다 그려짐) · 탑승권 받기(시트 올라옴 · 도장 잉크 번짐 중간 / 끝) · 도착 화면(D-178, 중간 / 끝) · 공개(표지 넘김 중간 / 끝) · 채팅 첫 글(걷힘 중간 / 끝) 캡처
//  --reduced-motion: 같은 순서를 동작 줄이기로 — 넘김 · 시트 · 도장 · 표지 · 첫 글 동안 transform 이 바뀐 요소 0(투명도만)
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 D42M_<폭>(_줄이기)]/D42M_*.png
// 사용: node scripts/web-d42m.mjs [번들 폴더] [--reduced-motion]   SHOT_WIDTH=360 node scripts/web-d42m.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const args = process.argv.slice(2);
const reduced = args.includes('--reduced-motion');
const distDir = path.resolve(APP_DIR, args.find((a) => !a.startsWith('--')) ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `D42M_${width}${reduced ? '_줄이기' : ''}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);

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

const b = await openBrowser({ distDir, shotDir, width, height: 800 });
if (reduced) await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const shot = async (name) => {
  const file = `D42M_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const waitVis = (id, ms = 8000) => wait(`!!${visQ(id)}`, ms);
const tap = async (id, settle = 400) => {
  await b.evaluate(`document.querySelectorAll('[data-d42-target]').forEach((e) => e.removeAttribute('data-d42-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-d42-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-d42-target="1"]');
  if (settle > 0) await sleep(settle);
};

// 일(fn)을 하는 동안 화면 그리기마다 transform 이 바뀐 요소를 모은다(제자리 matrix → none 은 움직임 아님 · 화면에서 빠져 안 보이는 요소는 세지 않음)
async function watchTransforms(fn, ms = 1300) {
  await b.evaluate(`(() => { window.__tf = new Map(); window.__changed = new Set(); const until = performance.now() + ${ms}; const look = () => { for (const el of document.querySelectorAll('body *')) { if (!window.__visible(el)) continue; const raw = getComputedStyle(el).transform; const t = raw === 'matrix(1, 0, 0, 1, 0, 0)' ? 'none' : raw; const prev = window.__tf.get(el); if (prev !== undefined && prev !== t) { const ids = []; for (let x = el; x && ids.length < 3; x = x.parentElement) if (x.dataset && x.dataset.testid) ids.push(x.dataset.testid); window.__changed.add(prev + ' → ' + t + ' [' + ids.join('<') + ']'); } window.__tf.set(el, t); } if (performance.now() < until) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);
  await fn();
  await sleep(ms + 200);
  return b.evaluate('[...window.__changed]');
}
async function moment(group, label, fn, shots) {
  if (reduced) {
    const moved = await watchTransforms(fn);
    check(group, `동작 줄이기: ${label} 동안 이동 · 크기 · 회전 변화 0(투명도만)`, moved.length === 0, `바뀐 요소 ${moved.length} ${moved.slice(0, 3).join(' | ')}`);
    await shot(`${shots[1]}`);
    return;
  }
  await fn();
  await sleep(shots[2] ?? 250);
  await shot(shots[0]); // 움직이는 중
  await sleep(1100);
  await shot(shots[1]); // 끝
}

// 가입(데모) → 탑승권 탭
async function signUp(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000);
  await b.type(sel('signin-email'), email);
  await b.clickText('인증번호 받기');
  await b.waitFor(`(() => { const el = document.querySelector('${sel('signin-code')}'); return !el.readOnly && !el.disabled; })()`);
  await b.type(sel('signin-code'), '123456');
  await b.clickText('확인');
  await b.waitFor(`!!document.querySelector('${sel('signin-birth')}')`);
  await b.type(sel('signin-birth'), '19970312');
  await b.clickText('확인');
  await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await b.click(sel('consent-all'));
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);
  await b.click(sel('consent-submit'));
  await b.waitFor(`location.pathname === '/survey/01'`);
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 40000);
  await b.click(sel('traits-confirm'));
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding' && !!${visQ('boarding-status-on_sale')}`, 20000);
}

let exitCode = 0;
try {
  // ═══ S. 스플래시(하루 한 번) ═══
  await b.open('/sign-in', `!!window.__q('splash')`);
  if (reduced) {
    const moved = await watchTransforms(async () => undefined, 1400);
    check('S', '동작 줄이기: 스플래시 선 · 로고 · 글자에 이동 · 크기 변화 0(투명도만)', moved.length === 0, `바뀐 요소 ${moved.length} ${moved.slice(0, 3).join(' | ')}`);
  } else {
    await sleep(650);
    await shot('S1_스플래시_중간');
    await sleep(700);
    await shot('S2_스플래시_다그림');
  }
  check('S', `스플래시가 걷힌다(보통 1.9초 + 0.64초 · 줄이기 1.5초 + 0.15초)`, await wait(`!window.__q('splash')`, 6000), '');

  // ═══ C. 칩 글자 가운데(D-179): 문서 탭 칩(켬 · 끔) · 데모 장면 칩(끔) ═══
  if (!reduced) {
    await tap('signin-privacy-link', 600);
    if (await waitVis('legal-tab-terms', 5000)) {
      const off = await b.evaluate(`(() => { const el = ${visQ('legal-tab-terms')}; const chip = el && el.firstElementChild; const t = chip && [...chip.querySelectorAll('div')].find((d) => d.innerText && !d.children.length); if (!chip || !t) return 99; const c = chip.getBoundingClientRect(); const r = t.getBoundingClientRect(); return Math.abs((r.left - c.left) - (c.right - r.right)); })()`);
      check('C', '끈 칩(문서 탭)도 글자가 가운데(좌우 여백 차 2px 이하)', off <= 2, `차 ${off}px`);
      await shot('C1_문서탭칩');
    }
  }

  // ═══ 1. 탑승권 받기 ═══
  check('1', '데모 가입 → 탑승권 탭(판매 중)', await signUp(`d42m${width}${reduced ? 'r' : ''}@email.com`), '');
  if (!reduced) {
    await b.evaluate(`(() => { const el = ${visQ('boarding-demo')}; if (el) el.scrollIntoView({ block: 'center' }); })()`);
    await sleep(400);
    await shot('C2_데모장면칩');
    await b.evaluate(`(() => { const el = ${visQ('boarding-scroll')}; if (el) el.scrollTop = 0; })()`);
    await sleep(300);
  }
  await sleep(800);
  await moment('1', '결제 시트 열림', () => tap('boarding-buy', 0), ['1a_시트_올라옴', '1b_시트', 260]);
  await waitVis('boarding-sheet-summary');
  await sleep(600);
  await moment('1', '결제 확인 → 시트 닫힘 · 도장 잉크 번짐 · 제목 줄 가림 · 부제 걷힘', () => tap('boarding-pay', 0), ['1c_도장_번짐중', '1d_탑승권받음', 520]);
  check('1', `탑승 완료 카드 · 로고 타일 도장 · '3일 뒤에 만나요'`, (await wait(`!!${visQ('boarding-status-boarded')}`, 6000)) && (await vis('boarding-stamp')), '');

  // ═══ 2. 수 18:00 공개: 도착 화면(D-178) → [지금 열어 보기] → 공개 순간 ═══
  await moment('2', '도착 화면(알약 · 그림 걷힘 · 제목 줄 가림 · 부제 · 버튼)', () => tap('boarding-demo-arrived', 0), ['2a_도착_중간', '2b_도착', 350]);
  check('2', `도착 화면: 알약 '12월 23일(수) 18:00' · "여행지에 도착했어요" · 부제 · [지금 열어 보기] · 그림`, (await waitVis('boarding-arrive-open')) && (await b.evaluate(`(${visQ('boarding-arrive-when')} || {}).innerText === '12월 23일(수) 18:00'`)) && (await b.evaluate(`(${visQ('boarding-arrive-title')} || {}).innerText === '여행지에 도착했어요'`)) && (await vis('boarding-arrive-art')), '');
  check('2', '도착 화면에 카운트다운 · 재촉 · 느낌표 0', !/남은 시간|서두르|마감|지금 바로|d+:dd:dd|[!！]/.test(await b.evaluate(`(${visQ('boarding-arrive')} || {}).innerText || ''`)), '');
  await moment('2', '공개 화면(표지 넘김 · 사진 걷힘 · 이름 줄 가림)', () => tap('boarding-arrive-open', 0), ['2c_표지_넘김중', '2d_공개', 520]);
  check('2', '공개 화면: 제목 · 사진 · 이름 · [대화 시작하기]', (await wait(`location.pathname === '/reveal' && !!${visQ('reveal-name')}`, 8000)) && (await vis('reveal-photo')) && (await vis('reveal-chat')), '');
  check('2', '표지는 넘긴 뒤 치워진다', !(await vis('reveal-card-cover')), '');

  // ═══ 3. 채팅 첫 글 ═══
  await tap('reveal-chat', 800);
  check('3', '[대화 시작하기] → 대화방', await wait(`location.pathname.startsWith('/chat/') && !!${visQ('chat-composer-input')}`, 10000), '');
  await sleep(600);
  await b.type(sel('chat-composer-input'), '안녕하세요. 반가워요.');
  await moment('3', '첫 보낸 말풍선(보낸 쪽에서 걷힘)', () => tap('chat-composer-send', 0), ['3a_첫글_걷힘중', '3b_첫글', 200]);
  check('3', '첫 글이 보인다', await b.evaluate(`document.body.innerText.includes('안녕하세요. 반가워요.')`), '');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('9', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('9', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
} catch (error) {
  check('X', '점검 중 오류', false, String(error?.message ?? error));
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  await b.close();
}
const failed = results.filter((r) => !r.ok).length;
if (failed > 0) exitCode = 1;
console.log(`\nD42-M 점검${reduced ? '(동작 줄이기)' : ''}: 통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(exitCode);
