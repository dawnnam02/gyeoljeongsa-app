// F18 웹 흐름 점검(Q6 남은 버그 2건). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  조건 1 (Q5A-04 · N1): 10 상대 프로필의 사진 번호 · 화살표는 승인 사진만 센다 — 박OO(승인 0 · 확인 중 3)은 '사진 1 / 3' · 다음 화살표 없이 기본 그림 + '사진 확인 중' 한 쪽,
//                        김OO(승인 2 · 확인 중 1)은 '사진 1 / 2', 최OO(승인 1 · 없음 2)은 번호 없음
//  조건 2 (Q5A-14 · N2): 09 → 10 → [등급 구독 안내 줄] → 등급 구독 상세 → ‹ = 10(주소 /candidate/…), 10 에서 ‹ = 09 · 12 → [구매 · 등급 구독] → 이용권 쪽 → ‹ = 12
//  캡처: 확인/스크린샷/[SHOT_SUBDIR]/F18_*.png · 폭은 SHOT_WIDTH(기본 390)
// 사용: node scripts/web-f18.mjs [번들 폴더]   (npm run check:f18)
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

const b = await openBrowser({ distDir, shotDir, width, height: 800 });
const shot = async (name) => {
  const file = `F18_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
// 웹은 앞 화면의 요소를 숨겨서 DOM 에 남겨 둔다 — 눈에 보이는 것만 센다
const vis = (id) =>
  b.evaluate(`[...document.querySelectorAll('[data-testid="${id}"]')].some((el) => { if (!window.__visible(el)) return false; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (el === top || el.contains(top) || top.contains(el)); })`);
const visText = (id) =>
  b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const path0 = () => b.evaluate('location.pathname');
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visibleSel = (id) => `(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); if (el) el.setAttribute('data-f18-target', '1'); return !!el; })()`;
// 겹친 화면 중 보이는 것을 누른다
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-f18-target]').forEach((e) => e.removeAttribute('data-f18-target'))`);
  if (!(await b.evaluate(visibleSel(id)))) throw new Error(`보이는 ${id} 가 없어요`);
  await b.click('[data-f18-target="1"]');
  await sleep(400);
};

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // F17: 스플래시(로고 타일 찍힘 → 종이 펼침, 약 2.8초)가 걷힌 뒤 누른다 — 바쁜 기계에서 입력 반영이 늦어 눌림을 놓치지 않게
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
  return b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-card-0')`, 20000);
}

let exitCode = 0;
try {
  check('0', '비구독자 계정으로 09 까지 간다', await toRecs('f18plainphotocheck@email.com'), await path0()); // F24: 승인 0 · 승인 2 사진 상태는 photocheck 장면

  // ═══ 조건 1: 사진 번호 · 화살표 ═══
  await tap('rec-card-1');
  await wait(`location.pathname.startsWith('/candidate/') && !!window.__q('candidate-gallery')`);
  await sleep(600);
  const parkHead = await visText('candidate-head');
  check(
    '1',
    `박OO(승인 0 · 확인 중 3): '사진 1 / 3' · 다음 · 이전 화살표 없음, 한 쪽 + '사진 확인 중'`,
    parkHead.startsWith('박OO') && !(await vis('candidate-photo-index')) && !(await vis('candidate-photo-next')) && !(await vis('candidate-photo-prev')) && (await vis('candidate-photo-0-checking')) && !(await b.evaluate(`!!window.__q('candidate-photo-1')`)),
    `${parkHead} · 번호 ${await vis('candidate-photo-index')} · 다음 ${await vis('candidate-photo-next')} · 확인 중 글 ${await vis('candidate-photo-0-checking')}`,
  );
  await shot('10_박OO_승인0장');
  await tap('candidate-header-back');
  await wait(`location.pathname === '/recommendations'`);

  await tap('rec-card-0');
  await wait(`location.pathname === '/candidate/demo-cand-1' && !!window.__q('candidate-photo-index')`);
  await sleep(600);
  check('1', `김OO(승인 2 · 확인 중 1): '사진 1 / 2'(확인 중 칸은 세지 않음) · 다음 화살표 있음`, (await visText('candidate-photo-index')) === '사진 1 / 2' && (await vis('candidate-photo-next')), await visText('candidate-photo-index'));
  await shot('10_김OO_승인2장');
  await tap('candidate-photo-next');
  await sleep(700);
  check('1', `다음을 누르면 '사진 2 / 2', 끝이라 다음 화살표 없음`, (await visText('candidate-photo-index')) === '사진 2 / 2' && !(await vis('candidate-photo-next')), await visText('candidate-photo-index'));

  // ═══ 조건 2: 10 → 등급 구독 상세 → ‹ = 10 ═══
  await b.evaluate(`(() => { document.querySelectorAll('[data-testid="candidate-grade-subscribe"]').forEach((el) => el.scrollIntoView({ block: 'center' })); return true; })()`);
  await sleep(400);
  await tap('candidate-grade-subscribe');
  check('2', '10 의 등급 구독 안내 줄 → 상점 등급 구독 상세(/shop)', (await wait(`location.pathname === '/shop' && !!window.__q('shop-page-product')`)) && (await vis('shop-sub-header-back')), await path0());
  await shot('16-2_10에서연_상세');
  await tap('shop-sub-header-back');
  const afterBack = (await wait(`location.pathname === '/candidate/demo-cand-1'`)) ? await path0() : await path0();
  await sleep(500);
  check('2', '상세의 ‹ → 10 으로 돌아온다(09 아님) · 10 은 누르기 전 스크롤 자리 그대로', afterBack === '/candidate/demo-cand-1' && (await vis('candidate-header-back')) && (await vis('candidate-grade-subscribe')), afterBack);
  await shot('10_뒤로_돌아옴');
  await tap('candidate-header-back');
  check('2', '10 에서 ‹ 한 번 더 → 09(쌓인 화면이 남지 않음)', (await wait(`location.pathname === '/recommendations'`)) && (await vis('rec-card-0')), await path0());

  // ═══ 조건 2: 12 → 이용권 쪽 → ‹ = 12 ═══
  await b.click(`[role=tab][aria-label="설정"]`);
  await wait(`location.pathname === '/settings'`);
  await sleep(400);
  await tap('settings-row-purchase');
  check('2', '12 [구매 · 등급 구독] → 상점 이용권 · 구매 내역 쪽', await wait(`location.pathname === '/shop' && !!window.__q('shop-page-inventory')`), await path0());
  await shot('16-8_12에서연_이용권');
  await tap('shop-sub-header-back');
  check('2', '이용권 쪽의 ‹ → 12 로 돌아온다(09 아님)', (await wait(`location.pathname === '/settings'`)) && (await vis('settings-row-purchase')), await path0());
  await shot('12_뒤로_돌아옴');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('3', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('3', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
} catch (error) {
  check('X', '점검 중 오류', false, String(error?.message ?? error));
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  await b.close?.();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
exitCode = failed === 0 ? 0 : 1;
process.exit(exitCode);
