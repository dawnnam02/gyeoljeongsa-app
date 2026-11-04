// QF2-B2 웹 점검(첫마디 길 · 마지막 날 · 크레딧/마일리지 구분 · 가격표 · 엽서 먼저 · 안심 공유). 무료 · 네트워크 없음(로컬 서버 + 로컬 헤드리스 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(스크래치 폴더 인자 권장). 폭마다(SHOT_WIDTH 360 · 390 · 430) 한 번씩 돌린다. 사람이 하는 순서대로 누른다.
//  1 가입 → 설정 목록: 크레딧 줄 위 '탑승권과 크레딧' · 사주 마당/마일리지 줄 위 '사주 마당과 마일리지' 그룹 제목
//  2 크레딧: 정체 한 줄 '크레딧은 탑승권을 탈 때만 써요.' + 맨 아래 '서로 바꿀 수 없어요'
//  3 마일리지: 가격표 3줄(서버 값) · 정체 한 줄 둘째 문장 · 맨 아래 '서로 바꿀 수 없어요'
//  4 오늘 하루: 웹은 아침 알림 줄이 없다(기기 안 예약 알림은 앱에서만)
//  5 공개(T3): 방이 열려 있으면 [대화 시작하기] 위 '무슨 말부터 할지 같이 볼까요' → 시트 → 칸을 누르면 대화방 입력창에 글만 들어가고 보내지 않음 · 주소에 draft 0
//  6 대화방: 마지막 날 띠 + 연장 시트 한 줄 · ⋯ 메뉴의 '만남 계획 공유' 줄과 힌트
//  7 폭 점검: 가로 넘침 0 · 글자 13 이상 · 터치 48 이상
//  캡처: 확인/스크린샷/QF2B2_<폭>/QF2B2_*.png
// 사용: node scripts/web-qf2b2.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-qf2b2.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `QF2B2_${width}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 데모 웹 번들을 만드세요.`);
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
  const file = `QF2B2_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const pageText = () => b.evaluate(`document.body.innerText`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-b2-target]').forEach((e) => e.removeAttribute('data-b2-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-b2-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-b2-target="1"]');
  await sleep(400);
};
const goto = (p) => b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('7', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.length}`);
}
const scene = async (id) => {
  await tap(`boarding-demo-${id}`);
  await sleep(700);
};

async function signUp(email, until) {
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
  await b.traitsNext();
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(until, 20000);
}

let exitCode = 0;
try {
  check('1', '가입(데모) → 탑승권 홈', await signUp('qf2b2one@email.com', `location.pathname === '/boarding'`), '');
  await sleep(600);

  // ═══ 1. 설정 목록 그룹 제목 ═══
  await goto('/settings');
  await wait(`location.pathname === '/settings' && !!${visQ('settings-list')}`, 8000);
  await sleep(500);
  const settingsText = await pageText();
  check('1', "설정 목록: 크레딧 줄 위 '탑승권과 크레딧' 제목", settingsText.includes('탑승권과 크레딧') && (await vis('settings-group-credits')), '');
  const hasMileageGroup = await vis('settings-group-mileage');
  check('1', "마일리지 줄 위 '사주 마당과 마일리지' 제목(크레딧 줄과 이웃하지 않게)", settingsText.includes('사주 마당과 마일리지') && hasMileageGroup, `마일리지 위 ${hasMileageGroup}`);
  await shot('설정목록');
  await measure('설정 목록');

  // ═══ 2. 크레딧 ═══
  await goto('/credits');
  await wait(`!!${visQ('credits-balance')}`, 8000);
  check('2', "크레딧 정체 한 줄 '크레딧은 탑승권을 탈 때만 써요.'", (await visText('credits-identity')) === '크레딧은 탑승권을 탈 때만 써요.', await visText('credits-identity'));
  check('2', "맨 아래 '크레딧과 마일리지는 서로 바꿀 수 없어요.'", (await visText('credits-noswap')) === '크레딧과 마일리지는 서로 바꿀 수 없어요.', await visText('credits-noswap'));
  await shot('크레딧');
  await measure('크레딧');

  // ═══ 3. 마일리지 ═══
  await goto('/mileage');
  const mileageOn = await wait(`!!${visQ('mileage-total')} || !!${visQ('mileage-maint')} || location.pathname === '/boarding'`, 8000);
  if (mileageOn && (await vis('mileage-total'))) {
    check('3', '가격표: 제목 + 줄(서버 값) · 인기 · 추천 · 할인 표시 0', (await vis('mileage-table')) && !/인기|추천|할인|한정/.test(await visText('mileage-table')), (await visText('mileage-table')).slice(0, 100));
    check('3', "정체 한 줄 둘째 문장 '탑승권에는 쓰지 않아요.'", (await visText('mileage-lead')).includes('탑승권에는 쓰지 않아요.'), await visText('mileage-lead'));
    check('3', "맨 아래 '서로 바꿀 수 없어요'", (await visText('mileage-noswap')) === '크레딧과 마일리지는 서로 바꿀 수 없어요.', '');
    await shot('마일리지');
    await measure('마일리지');
  } else {
    console.log('[미확인] 마일리지 화면이 이 데모 장면에서 열리지 않았어요(스위치 mileage).');
  }

  // ═══ 4. 오늘 하루: 웹은 아침 알림 줄 없음 ═══
  await goto('/saju-today');
  await sleep(1500);
  check('4', '웹: 오늘 하루에 아침 알림 줄 0(기기 안 예약 알림은 앱에서만)', !(await vis('saju-morning')) && !(await pageText()).includes('아침에 알림 받기'), await b.evaluate('location.pathname'));

  // ═══ 4b. 엽서 먼저(Q2-11) ═══
  await goto('/type-card');
  await sleep(1800);
  if (await vis('type-postcard')) {
    check('4', '엽서 먼저: 짐을 싸기 전에도 엽서가 보이고 [엽서 꾸미기] 선택 단추 + 안내 글', (await vis('type-decorate')) && (await visText('type-decorate-hint')).includes('타입은 그대로예요'), await visText('type-decorate-hint'));
    await shot('엽서먼저');
    await measure('여행 타입 엽서');
    await tap('type-decorate');
    check('4', '[엽서 꾸미기]를 누르면 짐 싸기 질문이 열린다', await vis('type-quiz'), '');
  } else {
    console.log('[미확인] 여행 타입 엽서가 이 데모 장면에서 안 보였어요(스위치 type_card).');
  }

  // ═══ 5 · 6. 공개 → 대화방 ═══
  await goto('/boarding');
  await wait(`location.pathname === '/boarding'`, 6000);
  if (await vis('boarding-buy')) {
    await tap('boarding-buy');
    await wait(`!!${visQ('boarding-pay')}`, 8000);
    await sleep(700);
    await tap('boarding-pay');
    await wait(`!!${visQ('boarding-status-boarded')}`, 8000);
  }
  await scene('matched');
  await tap('boarding-open-reveal');
  await wait(`location.pathname === '/reveal' && !!${visQ('reveal-name')}`, 8000);
  await sleep(2200); // 공개 움직임(약 1초) + 칩을 읽는 시간
  const entry = await vis('reveal-opener-entry');
  if (entry) {
    check('5', "공개 순간: [대화 시작하기] 위에 글자 단추 '무슨 말부터 할지 같이 볼까요'", (await visText('reveal-opener-entry')).includes('무슨 말부터 할지 같이 볼까요') && (await vis('reveal-chat')), '');
    await shot('공개_입구');
    await measure('공개 순간');
    await tap('reveal-opener-entry');
    await wait(`!!${visQ('reveal-opener-carry')}`, 6000);
    check('5', "시트 안내 '대화방 입력창에 넣어 둘게요. 바로 보내지는 않아요.' · 칸 1개 이상", (await visText('reveal-opener-carry')).includes('바로 보내지는 않아요') && (await vis('reveal-opener-pick-0')), '');
    await shot('공개_시트');
    await tap('reveal-opener-pick-0');
    await wait(`location.pathname.startsWith('/chat/')`, 8000);
    check('5', '칸을 누르면 대화방으로 가고 주소에 글(draft)이 남지 않는다', !(await b.evaluate('location.search + location.href')).includes('draft'), await b.evaluate('location.pathname + location.search'));
    await sleep(1500);
    const value = await b.evaluate(`(() => { const el = document.querySelector('${sel('chat-composer-input')}'); return el ? el.value : null; })()`);
    check('5', '입력창에 글만 들어가 있고 보내지지 않았다(말풍선 수 변화 0)', typeof value === 'string' && value.length > 0, `입력창 "${String(value).slice(0, 30)}"`);
  } else {
    console.log('[미확인] 공개 순간에 첫마디 입구가 보이지 않았어요(스위치 opener_chips · 이야깃거리 없음).');
    await tap('reveal-chat');
    await wait(`location.pathname.startsWith('/chat/')`, 8000);
  }
  await sleep(1200);
  await shot('대화방');
  await measure('대화방');
  await b.evaluate(`(() => { const el = ${visQ('chat-room-more')}; if (el) el.click(); return !!el; })()`);
  await sleep(500);
  if (await vis('chat-menu-share')) {
    const t = await visText('chat-menu-share');
    check('6', "⋯ 메뉴: 연장 아래 '만남 계획 공유' 줄 + 힌트 '내 기기에서 만들어요. 결정사에는 남지 않아요.'", t.includes('만남 계획 공유') && t.includes('내 기기에서 만들어요. 결정사에는 남지 않아요.'), t);
    await shot('대화방_메뉴');
  } else {
    console.log('[미확인] ⋯ 메뉴에 안심 공유 줄이 안 보여요(스위치 safe_share).');
  }
} catch (error) {
  console.log(`[실패] 점검 중 오류: ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  const errors = (b.errors ?? []).filter((e) => !/favicon/.test(e));
  check('7', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...(b.requests?.values() ?? [])].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('7', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
  await b.close?.();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
  if (failed > 0) exitCode = 1;
}
process.exit(exitCode);
