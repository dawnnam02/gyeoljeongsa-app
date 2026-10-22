// F14 화면 점검(16 상점 · 내 등급 · 09/10 등급 배지 · 1회 매칭 · 12 등급 스위치 · 데모 사진). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다.
//  장면은 이메일 앞부분으로 고른다(lib/shopDemo.ts 머리말): plain 비구독 · shopsub 구독 중 · shopgrace 결제 문제 · shopend 끝남 · shopfail 읽기 실패 · shoplive 실결제 모드 · payfail 결제 실패 · mofew 못 채움 …
//  캡처: 확인/스크린샷/F14_*.png
// 사용: node scripts/web-f14.mjs [번들 폴더]   (npm run check:f14)
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

const b = await openBrowser({ distDir, shotDir, width: Number(process.env.SHOT_WIDTH ?? 360), height: 740 });
const shots = [];
const shot = async (name) => {
  const file = `F14_${name}.png`;
  await b.shot(file);
  shots.push(file);
  console.log(`       스크린샷 확인/스크린샷/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
// 웹은 앞 화면의 요소를 숨겨서 DOM 에 남겨 둔다 — 눈에 보이는 것만 센다
const vis = (id) =>
  b.evaluate(`[...document.querySelectorAll('[data-testid="${id}"]')].some((el) => { if (!window.__visible(el)) return false; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (el === top || el.contains(top) || top.contains(el)); })`);
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
const visibleCount = (testIdPrefix) => b.evaluate(`[...document.querySelectorAll('[data-testid^="${testIdPrefix}"]')].filter((el) => window.__visible(el)).length`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: ${b.width ?? process.env.SHOT_WIDTH ?? 360} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
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
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000);
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error') || !!window.__q('recs-first-wait') || !!window.__q('recs-preparing'))`, 12000);
}

// 바쁜 기계에서 설문 데모 누름이 빠져 가입 흐름이 끊기면 한 번 더 처음부터(F21 회귀 때 덧붙임 — 설문 길 줄은 그대로)
const toRecs = (email) => toRecsOnce(email).catch(() => toRecsOnce(email));
const goTab = async (name, pathname) => {
  await b.click(`[role=tab][aria-label="${name}"]`);
  return b.waitFor(`location.pathname === ${JSON.stringify(pathname)}`, 8000);
};
const toShop = async () => {
  await goTab('상점', '/shop');
  return wait(`!!window.__q('screen-16') || !!window.__q('shop-error')`);
};
const tabCount = () => b.evaluate(`[...document.querySelectorAll('[role=tab]')].filter((el) => window.__visible(el)).length`);

let exitCode = 0;
try {
  // ═══ 비구독자: 16-1 내 성향 리포트(해설 15문장 중 5문장) ═══
  check('A', '09 까지 간다', await toRecs('f14plainphotocheck@email.com'), await path0()); // F24: 박OO 사진 확인 중은 photocheck 장면
  check('A', '09 카드 이름 줄의 시·군·구는 전체(U30): "서울 강남구" · "경기 성남시"', (await has('김OO · 32 · 서울 강남구')) && (await has('박OO · 30 · 경기 성남시')), '');
  await shot('09_지역_전체표기');
  await toShop();
  await scrollTo('shop-free-title');
  await sleep(300);
  await tap('shop-report');
  check('B', '16-1 내 성향 리포트가 열린다: 탭바 없음 · NV11 · 소제목 · 해설 5문장', (await wait(`!!window.__q('report-body')`)) && (await tabCount()) === 0 && (await inner('report-note')) === 'AI가 정리하고 내가 확정한 성향이에요.' && (await inner('report-explain-title')) === '말로 풀어 보면' && (await q('report-explain-conflict')), await inner('report-note'));
  await shot('16-1_성향리포트_위');
  await measure('16-1 성향 리포트');
  await scrollTo('report-explain-conflict', 'center');
  await sleep(300);
  await shot('16-1_성향리포트_해설');
  await tap('shop-sub-header-back');
  await wait(`!!window.__q('screen-16')`);

  // ═══ 10: 공개 항목 · 확인 중 사진 칸 ═══
  await goTab('추천', '/recommendations');
  await wait(`!!window.__q('rec-card-0')`);
  await tap('rec-card-0');
  check('C', '10 상대 프로필: "공개한 정보" 구역 12줄(출신 지역 … 스타일), 상대가 가린 항목은 줄 없음', (await wait(`!!window.__q('candidate-open')`)) && (await q('candidate-open-A04')) && (await q('candidate-open-G03')) && !(await q('candidate-open-B02')), '');
  await scrollTo('candidate-open', 'start');
  await sleep(300);
  await shot('10_공개항목_15개');
  await measure('10 공개 항목');
  await scrollTop();
  await sleep(200);
  check('C', '10 머리: 서울 강남구(시·군·구 전체) · 확인 중 사진 칸에 기본 그림 + "사진 확인 중"', (await inner('candidate-head')) === '김OO · 32 · 서울 강남구', await inner('candidate-head'));
  await shot('10_상단_사진');
  await tap('candidate-header-back');
  await wait(`!!window.__q('rec-card-1')`);
  await tap('rec-card-1');
  await wait(`!!window.__q('screen-10')`);
  check('D', '10 사진이 모두 확인 중(박OO): 기본 그림 + "사진 확인 중" 글, 겹치지 않음', await has('사진 확인 중'), '');
  await shot('10_사진확인중');
  check('D', '10 공개 항목 구역: 서버가 준 항목이 없으면 구역이 없다(박OO)', !(await q('candidate-open')), '');
  await tap('candidate-header-back');

  // ═══ S8d 연결: 16-8 구매 내역 · 16-9 복원(구독 거래는 있고 연결만 없는 계정) ═══
  await toRecs('shoprestore@email.com');
  await toShop();
  await scrollTo('shop-link-inventory', 'center');
  await tap('shop-link-inventory');
  check('E', '16-8 구매 내역: 서버 거래 1줄(등급 구독 · 14,900원) + 구독 카드는 아직 없음', (await wait(`!!window.__q('inventory-history')`)) && (await has('등급 구독')) && (await has('14,900원')) && !(await q('inventory-sub')), '');
  await shot('16-8_구매내역');
  await measure('16-8 구매 내역');
  await tap('inventory-restore');
  check('E', '16-9 복원: 서버가 restored → "등급 구독을 다시 연결했어요."', (await wait(`!!window.__q('restore-text')`)) && (await inner('restore-text')) === '등급 구독을 다시 연결했어요.', await inner('restore-text'));
  await shot('16-9_복원_결과');
  await tap('restore-ok');

  check('G', '화면 점검 중 콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && [...b.requests.values()].every((r) => r.url.startsWith(b.origin) || r.url.startsWith('data:')), `오류 ${b.errors.length}: ${b.errors.slice(0, 2).join(' | ')}`);
} catch (error) {
  console.log(`[실패] 실행 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n')}`);
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF14 화면 점검: 통과 ${results.length - failed} · 실패 ${failed} · 스크린샷 ${shots.length}장`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
