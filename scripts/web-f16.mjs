// F16 화면 점검(09 지역 안내 · 부제 1/2/3명 · 16 구독 준비 중 · 상점 닫힘 · 16-9 복원 이용권 · 16-10 판매자 준비 중). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 폭 360(SHOT_WIDTH 로 바꿈)에서 사람이 하는 순서대로 누르며 잰다.
//  장면은 이메일 앞부분으로 고른다(lib/shopDemo.ts · lib/demoRecs.ts 머리말): plain 기본(데모 결제 · 문턱 0) · recone / rectwo 추천 1 / 2명(지역 안내) · subprep 구독 문턱 미만 · shopclosed 결제 닫힘 · shoplive0 실결제 0단계 · shopsub-subprep 구독 중 + 문턱 미만 · moslot 이용권 보유
//  캡처: 확인/스크린샷/F16_*.png (SHOT_SUBDIR 로 하위 폴더)
// 사용: node scripts/web-f16.mjs [번들 폴더]   (npm run check:f16)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');

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

const width = Number(process.env.SHOT_WIDTH ?? 360);
const b = await openBrowser({ distDir, shotDir, width, height: 740 });
const shots = [];
const shot = async (name) => {
  const file = `F16_${name}.png`;
  await b.shot(file);
  shots.push(file);
  console.log(`       스크린샷 확인/스크린샷/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const path0 = () => b.evaluate('location.pathname');
const wait = (expr, ms = 8000) => b.waitFor(expr, ms);
const tap = async (id) => {
  await b.click(sel(id));
  await sleep(350);
};
const scrollTo = (id, block = 'start') => b.evaluate(`(() => { const el = window.__q(${JSON.stringify(id)}); if (el) el.scrollIntoView({ block: ${JSON.stringify(block)} }); return !!el; })()`);
const scrollTop = () => b.evaluate(`(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0; return true; })()`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecsOnce(email) {
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
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 60000);
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error') || !!window.__q('recs-first-wait') || !!window.__q('recs-preparing'))`, 12000);
}
// 데모 AI 정리 시간이 기계가 바쁠 때 길어질 수 있어 처음 가는 길이 막히면 한 번 더 처음부터 간다
async function toRecs(email) {
  try {
    return await toRecsOnce(email);
  } catch {
    return toRecsOnce(email);
  }
}
const goTab = async (name, pathname) => {
  await b.click(`[role=tab][aria-label="${name}"]`);
  return b.waitFor(`location.pathname === ${JSON.stringify(pathname)}`, 8000);
};
const toShop = async () => {
  await goTab('상점', '/shop');
  return wait(`!!window.__q('screen-16') || !!window.__q('shop-error')`);
};
const cardCount = () => b.evaluate(`[...document.querySelectorAll('[data-testid^="rec-card-"]')].filter((el) => window.__visible(el)).length`);

const WIDEN1 = '오늘은 1분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.';
const WIDEN2 = '오늘은 2분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.';
const OWN = '조건은 내가 직접 바꿀 때만 달라져요.';
const CLOSED = '지금은 구매할 수 없어요.';
const PREP_LINE = '함께하는 분이 더 모이면 열려요';
const PREP_DETAIL = '나보다 위 등급 분을 먼저 추천받는 구독은 함께하는 분이 더 모이면 열려요. 지금은 구매할 수 없어요.';

let exitCode = 0;
try {
  // ═══ 기본(plain): 09 세 분 — 지역 안내 없음 · 부제 세 분 / 16 구독 카드는 그대로 열림(테스트 웹 그대로) ═══
  check('A', '09 까지 간다(plain)', await toRecs('f16plain@email.com'), await path0());
  check('A', '09 세 분: 부제 "세 분" · 지역 안내 없음', (await cardCount()) === 3 && (await inner('recs-subtitle')) === '조건과 성향을 살펴 고른 세 분이에요.' && !(await q('recs-widen')), await inner('recs-subtitle'));
  await shot('09_세분_안내없음');
  await toShop();
  check('A', '16 기본 장면: 테스트 띠 · 등급 구독 [자세히] · 준비 중 줄 없음(데모 결제 · 문턱 0)', (await has('테스트 화면이에요.')) && (await q('shop-grade-detail')) && !(await q('shop-grade-prep')) && !(await q('shop-closed')), '');
  await measure('16 기본 목록');

  // ═══ 09 지역 안내: 추천 1명 ═══
  check('B', '09 까지 간다(recone)', await toRecs('recone@email.com'), await path0());
  check('B', '09 추천 1명: 부제 "한 분" · 카드 1장', (await cardCount()) === 1 && (await inner('recs-subtitle')) === '조건과 성향을 살펴 고른 한 분이에요.', `${await cardCount()}장 · ${await inner('recs-subtitle')}`);
  check('B', '09 지역 안내 3줄: "오늘은 1분만…" · "조건은 내가 직접 바꿀 때만 달라져요." · [지역 조건 바꾸기]', (await inner('recs-widen-note')) === WIDEN1 && (await inner('recs-widen-own')) === OWN && (await has('지역 조건 바꾸기')), await inner('recs-widen-note'));
  await shot('09_추천1명_지역안내');
  await measure('09 추천 1명');
  await tap('recs-widen-button');
  check('B', '[지역 조건 바꾸기]는 이동만 한다(희망 조건 길 /survey/25) — 서버 값이 안 바뀐다(추천 목록 그대로)', (await path0()).startsWith('/survey/'), await path0());
  await shot('09_지역조건바꾸기_이동');
  await b.evaluate('history.back()');
  await wait(`location.pathname === '/recommendations' && !!window.__q('rec-card-0')`, 8000);
  check('B', '돌아오면 같은 안내와 같은 1명(서버 값 그대로)', (await cardCount()) === 1 && (await inner('recs-widen-note')) === WIDEN1, await path0());

  // ═══ 09 지역 안내: 추천 2명 ═══
  check('C', '09 까지 간다(rectwo)', await toRecs('rectwo@email.com'), await path0());
  check('C', '09 추천 2명: 부제 "두 분" · 안내 "오늘은 2분만…"', (await cardCount()) === 2 && (await inner('recs-subtitle')) === '조건과 성향을 살펴 고른 두 분이에요.' && (await inner('recs-widen-note')) === WIDEN2, await inner('recs-widen-note'));
  await shot('09_추천2명_지역안내');
  await measure('09 추천 2명');
  await scrollTo('recs-widen-button', 'center');
  await sleep(250);
  await shot('09_추천2명_지역안내_단추');

  // ═══ 16 구독 준비 중 ═══
  check('D', '09 까지 간다(subprep)', await toRecs('subprep@email.com'), await path0());
  await toShop();
  check('D', '16 구독 카드 준비 중: "함께하는 분이 더 모이면 열려요" + 흐린 [준비 중이에요], 혜택 · 가격 · [자세히] 없음', (await inner('shop-grade-prep')) === PREP_LINE && (await inner('shop-grade-soon')) === '준비 중이에요' && !(await q('shop-grade-detail')) && !(await q('shop-grade-price')) && !(await q('shop-grade-benefits')), await inner('shop-grade-prep'));
  check('D', '3개월은 "지금은 준비하지 않아요"(보류) 그대로 · 1회 매칭은 그대로', (await inner('shop-three-held')) === '지금은 준비하지 않아요' && (await q('shop-match-detail')), '');
  check('D', '화면에 사람 수 · 날짜 · 2,000 같은 숫자 기준이 없다', !/2,000|2000|명이 모이면|곧/.test(await inner('shop-card-grade')), await inner('shop-card-grade'));
  await scrollTop();
  await sleep(200);
  await shot('16_구독_준비중');
  await measure('16 구독 준비 중');
  await tap('shop-grade-soon');
  check('D', '16-2 상세 준비 중: 안내 글 · 구매 단추 · 가격 · 1개월 선택 · 구매 전 확인 없음', (await wait(`!!window.__q('detail-prep')`)) && (await inner('detail-prep')) === PREP_DETAIL && !(await q('detail-buy')) && !(await q('detail-price')) && !(await q('detail-options')) && !(await q('detail-before')), await inner('detail-prep'));
  await shot('16-2_구독상세_준비중');
  await measure('16-2 구독 상세 준비 중');
  await tap('shop-sub-header-back');
  await wait(`!!window.__q('screen-16')`);

  // 구독 중인 사람은 문턱 미만이어도 이용 중 카드
  check('D', '09 까지 간다(shopsub-subprep)', await toRecs('shopsub-subprep@email.com'), await path0());
  await toShop();
  check('D', '구독 중(문턱 미만 장면): 이용 중 카드 · [내 등급 보기] · [등급 구독 관리], 준비 중 줄 없음', (await q('shop-grade-inuse')) && (await q('shop-grade-manage')) && !(await q('shop-grade-prep')), '');
  await shot('16_구독중_문턱미만');

  // ═══ 16 상점 닫힘 ═══
  check('E', '09 까지 간다(shopclosed)', await toRecs('shopclosed@email.com'), await path0());
  await toShop();
  check('E', '16 상점 닫힘: "지금은 구매할 수 없어요." 한 줄 · 테스트 띠 없음 · 무료 구역 · 링크 그대로', (await inner('shop-closed-text')) === CLOSED && !(await has('테스트 화면이에요.')) && (await q('shop-free')) && (await q('shop-links')), await inner('shop-closed-text'));
  await shot('16_상점_닫힘');
  await measure('16 상점 닫힘');
  await scrollTo('shop-link-inventory', 'center');
  await tap('shop-link-inventory');
  await wait(`!!window.__q('inventory-restore')`);
  await tap('inventory-restore');
  check('E', '닫힌 상점의 구매 복원은 서버가 closed 로 거절 → 일반 오류 글', (await wait(`!!window.__q('restore-text')`)) && (await inner('restore-text')) === '잠시 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.', await inner('restore-text'));
  await shot('16-9_닫힘_복원_일반오류');
  await tap('restore-ok');

  check('E', '09 까지 간다(shoplive0)', await toRecs('shoplive0@email.com'), await path0());
  await toShop();
  check('E', '실결제 0단계도 같은 닫힘 한 줄', (await inner('shop-closed-text')) === CLOSED, await inner('shop-closed-text'));

  // ═══ 16-9 복원: 이용권만 있는 계정 → NV30 ═══
  check('F', '09 까지 간다(moslot)', await toRecs('moslot@email.com'), await path0());
  await toShop();
  await scrollTo('shop-link-inventory', 'center');
  await tap('shop-link-inventory');
  await wait(`!!window.__q('inventory-restore')`);
  await tap('inventory-restore');
  check('F', '16-9 복원(이용권만 있음): "다시 연결할 구매가 없어요. 이용권은 계정에 저장돼 있어 그대로예요."', (await wait(`!!window.__q('restore-text')`)) && (await inner('restore-text')) === '다시 연결할 구매가 없어요. 이용권은 계정에 저장돼 있어 그대로예요.', await inner('restore-text'));
  await shot('16-9_복원_이용권만있음_NV30');
  await tap('restore-ok');

  // ═══ 16-10 판매자 줄 비었을 때 ═══
  await tap('inventory-refund');
  check('G', '16-10 결제 · 환불 안내: 판매자 줄이 "판매자 정보는 준비 중이에요."(정식 글)', (await wait(`!!window.__q('refund-seller')`)) && (await inner('refund-seller')) === '판매자 정보는 준비 중이에요.', await inner('refund-seller'));
  await shot('16-10_판매자_비었을때');
  await measure('16-10 판매자 줄');

  check('G', '화면 점검 중 콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && [...b.requests.values()].every((r) => r.url.startsWith(b.origin) || r.url.startsWith('data:')), `오류 ${b.errors.length}: ${b.errors.slice(0, 2).join(' | ')}`);
} catch (error) {
  console.log(`[실패] 실행 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n')}`);
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF16 화면 점검: 통과 ${results.length - failed} · 실패 ${failed} · 스크린샷 ${shots.length}장`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
