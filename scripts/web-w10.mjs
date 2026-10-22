// V5 파도 1 W10 웹 점검: 09 하루 세 분 · 11 호감 · 16 상점 · 등급 구독 · 1회 매칭이 스위치로 숨겨져 '숨긴 화면 진입 0'인가.
//  데모 처음값(v4on 장면 없음)으로 가입 → 첫 화면이 09 가 아니라 V5_HOME(/boarding 탑승권, 앱 C) · 탭바에 추천 · 호감 · 상점 칸 없음 ·
//  주소로 /recommendations · /likes · /shop · /recommendations-empty · /likes-empty 를 열어도 그 화면을 그리지 않고 V5_HOME 으로 · 12 에 '구매 · 등급 구독' 줄 없음 ·
//  콘솔 오류 0 · 바깥 요청 0. 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버)
// 사용: SHOT_SUBDIR=W10_390 SHOT_WIDTH=390 node scripts/web-w10.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const HOME = '/boarding'; // navigation/v5Hide V5_HOME — 탑승권 탭(앱 C W6)

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 npm run check:web:demo 를 하세요.`);
  process.exit(2);
}
if (!findBrowser()) {
  console.log('[미확인] Edge 또는 Chrome 을 찾지 못했어요.');
  process.exit(2);
}

const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, title, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? ` — ${detail}` : ''}`);
}

const b = await openBrowser({ distDir, shotDir, width, height: 844 });
const shot = async (name) => {
  const file = `W10_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const path0 = () => b.evaluate('location.pathname');
// 한 번이라도 숨긴 화면이 그려졌는지 화면 그리기마다 본다
const HIDDEN_IDS = ['screen-09', 'screen-11', 'screen-16', 'likes-tabs', 'shop-free', 'rec-card-0', 'recs-remaining'];
const watchHidden = () =>
  b.evaluate(`(() => { window.__seenHidden = window.__seenHidden || []; const ids = ${JSON.stringify(HIDDEN_IDS)}; const until = performance.now() + 4000; const look = () => { for (const id of ids) { const e = document.querySelector('[data-testid="' + id + '"]'); if (e && window.__visible(e) && !window.__seenHidden.includes(id)) window.__seenHidden.push(id); } if (performance.now() < until) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);

async function signIn(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await sleep(3200);
  await b.waitFor(`!window.__q('splash') && !!document.querySelector('${sel('signin-email')}')`, 30000);
  await b.type(sel('signin-email'), email);
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
  for (let i = 0; i < 3; i += 1) {
    await sleep(500);
    if (await b.evaluate(`location.pathname.startsWith('/survey') && document.body.innerText.includes('설문 완료 · 정상 응답')`)) await b.clickText('설문 완료 · 정상 응답');
    if (await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000)) break;
  }
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await watchHidden();
  await b.click(sel('profile-first-confirm'));
}

// 앱 안에서 주소를 바꾼다(새로 불러오면 데모 세션이 사라지므로 history 로)
async function goPath(p) {
  await watchHidden();
  await b.evaluate(`(() => { window.history.pushState(null, '', ${JSON.stringify(p)}); window.dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
  await sleep(1500);
}

let exitCode = 0;
try {
  await signIn('w10plain@email.com');
  const landed = await b.waitFor(`location.pathname === ${JSON.stringify(HOME)}`, 20000);
  await sleep(800);
  await shot('첫화면_탑승권');
  check('1', `가입을 마치면 09 가 아니라 V5_HOME(${HOME})으로`, landed, await path0());
  const tabs = await b.evaluate(`[...document.querySelectorAll('[role=tab]')].filter((e) => window.__visible(e)).map((e) => e.getAttribute('aria-label'))`);
  check('2', '탭바에 추천 · 호감 · 상점 칸이 없다(숨긴 탭만 빠짐)', !tabs.some((t) => ['추천', '호감', '상점'].includes(t)), JSON.stringify(tabs));
  await b.click(`[role=tab][aria-label="설정"]`);
  await b.waitFor(`location.pathname === '/settings' && !!window.__q('settings-rows')`, 10000);
  await sleep(500);
  check('3', "12 에 '구매 · 등급 구독' 줄이 없다", !(await b.evaluate(`!!window.__q('settings-row-purchase')`)), await path0());
  for (const p of ['/recommendations', '/likes', '/shop', '/recommendations-empty', '/likes-empty']) {
    await goPath(p);
    const at = await path0();
    check('4', `주소 ${p} 로 와도 그 화면을 그리지 않고 V5_HOME(${HOME})으로`, at === HOME, at);
  }
  const seen = await b.evaluate('window.__seenHidden || []');
  check('5', '처음부터 끝까지 숨긴 화면(09 · 11 · 16)의 요소가 한 번도 보이지 않았다(진입 0)', seen.length === 0, JSON.stringify(seen));
  await shot('주소로_와도_탑승권');
  const m = await b.evaluate('window.__metrics()');
  check('G', `${width} 폭 가로 넘침 0 · 글자 13 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13, `최소 글자 ${m.minFont}`);
  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('Z', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('Z', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
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
console.log(`\nW10 점검: 통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
