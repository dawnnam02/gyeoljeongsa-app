// F22 웹 점검(사전 오픈 화면 · 신청 잇기 · 장면). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/, 또는 같은 설정으로 다른 폴더). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 대기 화면(prelaunch… 계정 · 확인 중): 09 자리에 대기 화면 · 신청 번호 + 순서 뜻 0 · 단계표 5칸 · 첫 추천 '12월 23일 수요일 오후 6시' · 할 일 · 고지 · 카드 0
//  2 카운트다운 0: 3초 사이 화면 글이 바뀌지 않는다 · 남은 날 · 시간 · 초 · 진행 % · 인원 글 0 · 느낌표 0 · '소개' 0
//  3 신청 잇기 시트: 틀림 · 남이 이은 번호(틀림 글) → 맞는 번호 · 코드 → 시트 닫힘 · 토스트 · 번호가 신청 번호로 · 잇기 줄 사라짐 · 시트 안 고지
//  4 장면(데모 줄): 확정(카드 · 로고 타일 · 고지 카드 안) · 보완 필요(서버 보완 이유) · 출시 뒤 확정 전(screen review) · 함께하기 어려워요 · 미룸 공지(한 번) · 지역 기다림(인원 · 성비) · 먼저 시작(확인 한 줄 → 시작하는 날) ·
//    양보 불가(안내만) · 끄기 → 09 카드 · 다시 켜기 → 대기 화면
//  6 11 호감 · 16 상점 탭(출시 전 빈 상태 한 줄 · 상점 날짜 · 등급 첫 계산) → 끈 뒤에는 원래 화면
//  5 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 콘솔 오류 0 · 바깥 요청 0
//  V5(W6): 출시 = 12-23(수) 18:00 첫 매칭 · '첫 추천' 글 → '첫 매칭'. 09 · 11 · 16 은 스위치로 숨겨져서 계정 이메일에 v4on 을 넣어 예전 자리(09 대기 화면)를 본다 — 탑승권 탭 쪽은 web-w6
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 F22_<폭>]/F22_*.png
// 사용: node scripts/web-f22.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-f22.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `F22_${width}`;
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
const shot = async (name) => {
  const file = `F22_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const path0 = () => b.evaluate('location.pathname');
// 웹은 앞 화면의 요소를 숨겨서 DOM 에 남겨 둔다 — 보이는 것만 센다
const vis = (id) => b.evaluate(`[...document.querySelectorAll('[data-testid="${id}"]')].some((el) => window.__visible(el))`);
const visText = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-f22-target]').forEach((e) => e.removeAttribute('data-f22-target'))`);
  const found = await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); if (el) el.setAttribute('data-f22-target', '1'); return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await b.click('[data-f22-target="1"]');
  await sleep(400);
};
const typeVisible = async (id, text) => {
  await b.evaluate(`document.querySelectorAll('[data-f22-input]').forEach((e) => e.removeAttribute('data-f22-input'))`);
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); if (el) el.setAttribute('data-f22-input', '1'); })()`);
  await b.type('[data-f22-input="1"]', text);
};
// 화면(대기 화면) 안의 보이는 글
const screenText = () => b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-screen"]')].find((e) => window.__visible(e)); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const BANNED = /[!！]|D-\d|남은 (날|시간|자리)|\d+일 남|초 후|\d+:\d\d:\d\d|\d+\s?%|\d+명|제작진|시즌|회차|합격|불합격|탈락|선발|최종|마감 임박|한정|경쟁률|소개|순위|번째/;
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('5', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}
const scene = async (id) => {
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-demo"]')].find((e) => window.__visible(e)); if (el) el.scrollIntoView({ block: 'center' }); })()`);
  await tap(`prelaunch-demo-${id}`);
  await sleep(500);
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-scroll"]')].find((e) => window.__visible(e)); if (el) el.scrollTop = 0; })()`);
  await sleep(300);
};

// 탭 누르기: 바쁜 기계에서 첫 누름을 놓치면 한 번 더 누른다
const goTab = async (label, pathname) => {
  for (let i = 0; i < 3; i += 1) {
    await b.click(`[role=tab][aria-label="${label}"]`);
    if (await wait(`location.pathname === '${pathname}'`, 4000)) return true;
  }
  return false;
};
// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09 자리
async function toWaiting(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // 스플래시가 걷힌 뒤 누른다
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
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 40000);
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && !!window.__q('prelaunch-screen')`, 20000);
}

let exitCode = 0;
try {
  // ═══ 1. 대기 화면(확인 중) ═══
  check('1', 'prelaunch… 계정으로 가입을 마치면 09 자리에 대기 화면이 뜬다(오늘의 추천 카드 0)', (await toWaiting('prelaunchv4on@email.com')) && !(await b.evaluate(`!!window.__q('rec-card-0')`)), await path0());
  await wait(`!!window.__q('prelaunch-no')`);
  await sleep(600);
  const no = await visText('prelaunch-no');
  check('1', `머리 '출연 준비' · 신청 번호(접수 날짜 + 4자리) + '순서를 뜻하는 번호는 아니에요.'`, (await visText('prelaunch-header')).startsWith('출연 준비') && /^신청 번호 \d{4}-\d{4}$/.test(no) && (await visText('prelaunch-no-note')) === '순서를 뜻하는 번호는 아니에요.', no);
  const steps = [];
  for (const s of ['identity', 'photos', 'survey', 'docs', 'confirm']) steps.push(await visText(`prelaunch-steps-${s}`));
  check('1', '단계표 5칸: 본인 확인 · 나이 확인됨 → 사진 · 셀피 확인 중 → 결혼관 설문 확인됨 → 서류(선택) 아직 → 확정 아직', steps.join(' / ') === '본인 확인 · 나이 확인됨 / 사진 · 셀피 확인 중 / 결혼관 설문 확인됨 / 서류(선택) 아직 / 확정 아직', steps.join(' / '));
  check('1', "첫 추천: '12월 23일 수요일 오후 6시'(날짜 · 요일 · 시각만)", (await visText('prelaunch-first-rec-when')) === '12월 23일 수요일 오후 6시', await visText('prelaunch-first-rec-when'));
  check('1', '기다리는 동안 할 일: 아는 분 미리 피하기 · 서류 인증 · 신청 잇기(보증은 확정 뒤)', (await vis('prelaunch-task-avoid')) && (await vis('prelaunch-task-docs')) && !(await vis('prelaunch-task-vouch')) && (await vis('prelaunch-task-link')), '');
  check('1', "'방송 아님' 고지 한 줄", (await visText('prelaunch-notice')) === "'출연'은 결정사에서 쓰는 말이에요. 방송이나 촬영은 없어요.", await visText('prelaunch-notice'));
  check('1', '탭바는 그대로(추천 탭 켜짐)', await b.evaluate(`[...document.querySelectorAll('[role=tab]')].some((t) => t.getAttribute('aria-selected') === 'true' && t.innerText.includes('추천'))`), '');
  await shot('1_대기_확인중');
  await measure('대기 화면(확인 중)');

  // ═══ 2. 카운트다운 0 ═══
  const t1 = await screenText();
  await sleep(3000);
  const t2 = await screenText();
  check('2', '3초 사이 화면 글이 그대로(움직이는 숫자 · 카운트다운 0)', t1 === t2 && t1.length > 50, `${t1.length}자`);
  check('2', '남은 날 · 시간 · 초 · 진행 % · 인원 · 느낌표 · 쓰지 않는 말 · 소개 0', !BANNED.test(t1), (t1.match(BANNED) ?? [''])[0]);

  // ═══ 6. 11 호감 · 16 상점 탭(출시 전) ═══
  await goTab('호감', '/likes');
  check('6', "11 호감(출시 전): '호감은 첫 매칭이 시작되는 날부터 주고받을 수 있어요.' 한 줄 · 머리 '호감'", (await wait(`location.pathname === '/likes' && [...document.querySelectorAll('[data-testid="prelaunch-tab-likes-line-0"]')].some((e) => window.__visible(e))`)) && (await visText('prelaunch-tab-likes-line-0')) === '호감은 첫 매칭이 시작되는 날부터 주고받을 수 있어요.', await path0());
  await sleep(400);
  await shot('6_호감_출시전');
  await measure('11 호감(출시 전)');
  await goTab('상점', '/shop');
  check('6', "16 상점(출시 전): '상점은 12월 23일에 열려요.' + '등급은 출시일 새벽에 처음 계산해요.' · 상품 목록 0", (await wait(`location.pathname === '/shop' && [...document.querySelectorAll('[data-testid="prelaunch-tab-shop-line-0"]')].some((e) => window.__visible(e))`)) && (await visText('prelaunch-tab-shop-line-0')) === '상점은 12월 23일에 열려요.' && (await visText('prelaunch-tab-shop-line-1')) === '등급은 출시일 새벽에 처음 계산해요.' && !(await vis('shop-page-product')), await path0());
  await sleep(400);
  await shot('6_상점_출시전');
  await measure('16 상점(출시 전)');
  await goTab('추천', '/recommendations');
  check('6', '추천 탭으로 돌아오면 대기 화면 그대로', await wait(`location.pathname === '/recommendations' && [...document.querySelectorAll('[data-testid="prelaunch-screen"]')].some((e) => window.__visible(e))`), await path0());
  await sleep(400);

  // ═══ 3. 신청 잇기 시트 ═══
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-link-open"]')].find((e) => window.__visible(e)); if (el) el.scrollIntoView({ block: 'center' }); })()`);
  await tap('prelaunch-link-open');
  check('3', '[신청 잇기] → 시트(번호 · 코드 6자리 · 같은 글 · 고지)', (await wait(`!!window.__q('prelaunch-link-no') && window.__visible(window.__q('prelaunch-link-no'))`)) && (await visText('prelaunch-link-notice')) === "'출연'은 결정사에서 쓰는 말이에요. 방송이나 촬영은 없어요." && (await visText('prelaunch-link-same')) === '잇지 않아도 쓰는 데 차이는 없어요.', '');
  await sleep(500);
  await shot('3_잇기_시트');
  await measure('신청 잇기 시트');
  check('3', '모양이 맞기 전에는 [잇기]가 비활성', (await b.evaluate(`window.__q('prelaunch-link-submit').getAttribute('aria-disabled')`)) === 'true', '');
  await typeVisible('prelaunch-link-no', '1018-0000');
  await typeVisible('prelaunch-link-code', '000000');
  await tap('prelaunch-link-submit');
  check('3', '틀린 번호 · 코드 → "신청 번호나 잇기 코드가 맞지 않아요. …"', await wait(`(window.__q('prelaunch-link-error')?.innerText ?? '').startsWith('신청 번호나 잇기 코드가 맞지 않아요.')`), '');
  await shot('3_잇기_틀림');
  await typeVisible('prelaunch-link-no', '1017-3388');
  await typeVisible('prelaunch-link-code', '135790');
  await tap('prelaunch-link-submit');
  await sleep(300);
  check('3', '남이 이은 번호 → 같은 틀림 글(남의 번호가 이어졌는지 떠보지 못하게, S18 6장)', await wait(`(window.__q('prelaunch-link-error')?.innerText ?? '').startsWith('신청 번호나 잇기 코드가 맞지 않아요.')`), '');
  await typeVisible('prelaunch-link-no', '10184721');
  await typeVisible('prelaunch-link-code', '246810');
  await tap('prelaunch-link-submit');
  const linked = await wait(`document.body.innerText.includes('신청 번호 1018-4721로 이었어요.')`);
  await sleep(300);
  await shot('3_잇기_성공_토스트');
  await sleep(700);
  check('3', '맞는 번호 · 코드 → 시트 닫힘 · 토스트 · 머리 번호가 신청 번호(1018-4721)로 · 잇기 줄 사라짐', linked && !(await vis('prelaunch-link-no')) && (await visText('prelaunch-no')) === '신청 번호 1018-4721' && !(await vis('prelaunch-task-link')), await visText('prelaunch-no'));

  // ═══ 4. 장면 ═══
  await scene('confirmed');
  check('4', '확정: 확정 카드(첫 추천 12월 23일 수요일 오후 6시 · 하루 세 분 추천) · 로고 타일 찍힘 · 고지는 카드 안 한 번 · 보증 할 일', (await visText('prelaunch-confirmed-body')) === '확정됐어요. 첫 매칭은 12월 23일 수요일 오후 6시에 열려요. 탑승권을 사면 그날 나와 수준이 가장 잘 맞는 한 분과 이어져요.' && (await vis('prelaunch-stamp')) && (await vis('prelaunch-confirmed-notice')) && !(await vis('prelaunch-notice')) && (await vis('prelaunch-task-vouch')), await visText('prelaunch-confirmed-body'));
  await sleep(800);
  await shot('4_확정');
  await measure('확정');
  await scene('fix');
  check('4', '보완 필요: 서버 보완 이유(fix_reason photo_face) 한 줄 + 사진 칸 "보완 필요"', (await visText('prelaunch-todo')).startsWith('얼굴 정면 사진에 보완이 필요해요.') && (await visText('prelaunch-steps-photos-state')) === '보완 필요', await visText('prelaunch-todo'));
  await shot('4_보완필요');
  await scene('reviewOpen');
  check('4', '출시 뒤 확정 전(screen review, D-123): 대기 화면 그대로 · 지난 출시일 줄 없음 · 오늘의 추천 카드 0', (await vis('prelaunch-steps')) && !(await vis('prelaunch-first-rec')) && !(await b.evaluate(`!!window.__q('rec-card-0')`)) && !(await screenText()).includes('12월 25일'), '');
  await shot('4_출시뒤_확정전');
  await scene('declined');
  check('4', '함께하기 어려워요: 사유(혼인 확인) · 단계표 없음', (await visText('prelaunch-declined-reason')).startsWith('혼인 중인 것으로 확인되어') && !(await vis('prelaunch-steps')), await visText('prelaunch-declined-reason'));
  await shot('4_함께하기어려워요');
  await scene('confirmed');
  await scene('deferred');
  check('4', '출시일 7일 미룸: 맨 위 공지 한 번("첫 매칭을 1월 1일 금요일 오후 6시로 미뤘어요. … 기다려 주셔서 고마워요.") · 날짜 줄도 새 날짜', (await visText('prelaunch-defer-body')).startsWith('첫 매칭을 1월 1일 금요일 오후 6시로 미뤘어요.') && (await visText('prelaunch-defer-body')).endsWith('기다려 주셔서 고마워요.') && (await visText('prelaunch-first-rec-when')) === '1월 1일 금요일 오후 6시', await visText('prelaunch-defer-body'));
  await shot('4_미룸_공지');
  await measure('미룸 공지');
  await tap('prelaunch-defer-ok');
  check('4', '[확인했어요] → 공지가 사라지고 다시 오지 않는다(같은 미룸)', (await wait(`![...document.querySelectorAll('[data-testid="prelaunch-defer"]')].some((e) => window.__visible(e))`, 5000)) && (await visText('prelaunch-first-rec-when')) === '1월 1일 금요일 오후 6시', '');
  await scene('regionWait');
  check('4', '출시 뒤 지역 기다림(인원): "동남권은 함께 시작할 분들을 모으고 있어요. …" · 날짜 줄 대신 · 인원 · 게이지 0', (await visText('prelaunch-region-text')).startsWith('동남권은 함께 시작할 분들을 모으고 있어요.') && !(await vis('prelaunch-first-rec')) && !BANNED.test(await screenText()), await visText('prelaunch-region-text'));
  await shot('4_지역기다림_인원');
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-early"]')].find((e) => window.__visible(e)); if (el) el.scrollIntoView({ block: 'center' }); })()`);
  await tap('prelaunch-early');
  check('4', '[지역 넓혀 먼저 시작하기] → 확인 한 줄 "다른 지역 분과 매칭될 수 있어요."(누르기 전에는 시작 0)', (await wait(`[...document.querySelectorAll('[data-testid="prelaunch-early-confirm-body"]')].some((e) => window.__visible(e))`, 5000)) && (await visText('prelaunch-early-confirm-body')) === '다른 지역 분과 매칭될 수 있어요.' && !(await vis('prelaunch-early-joined')), '');
  await sleep(300);
  await shot('4_먼저시작_확인');
  await tap('prelaunch-early-confirm-confirm');
  check('4', '[먼저 시작하기] → 시작하는 날 한 줄(다음 날 오전 9시부터) · 버튼 사라짐', (await wait(`[...document.querySelectorAll('[data-testid="prelaunch-early-joined"]')].some((e) => window.__visible(e))`, 6000)) && (await visText('prelaunch-early-joined')).endsWith('부터 다른 지역 분과도 매칭될 수 있어요.') && !(await vis('prelaunch-early')), await visText('prelaunch-early-joined'));
  await shot('4_먼저시작_됨');
  await scene('regionLocked');
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="prelaunch-early"]')].find((e) => window.__visible(e)); if (el) el.scrollIntoView({ block: 'center' }); })()`);
  await tap('prelaunch-early');
  await wait(`[...document.querySelectorAll('[data-testid="prelaunch-early-confirm-confirm"]')].some((e) => window.__visible(e))`, 5000);
  await tap('prelaunch-early-confirm-confirm');
  check('4', '지역 양보 불가 → 서버가 대신 풀지 않고 안내 한 줄만', (await wait(`[...document.querySelectorAll('[data-testid="prelaunch-early-locked"]')].some((e) => window.__visible(e))`, 6000)) && (await visText('prelaunch-early-locked')).startsWith('지역 조건을 양보할 수 없게 두셨어요.'), await visText('prelaunch-early-locked'));
  await shot('4_양보불가');
  await scene('regionRatio');
  check('4', '출시 뒤 지역 기다림(성비): 이유 한 줄', (await visText('prelaunch-region-text')) === '같은 지역 분들이 고르게 모이면 첫 매칭을 시작해요.', await visText('prelaunch-region-text'));
  await shot('4_지역기다림_성비');
  await scene('open');
  check('4', '[사전 오픈 끄기] → 같은 자리에 오늘의 추천 카드', await wait(`!!window.__q('rec-card-0') && !window.__q('prelaunch-screen')`, 12000), await path0());
  await sleep(1200);
  await shot('4_끔_오늘의추천');
  await goTab('상점', '/shop');
  check('6', '끈 뒤 16 상점은 원래 화면(출시 전 한 줄 없음)', (await wait(`location.pathname === '/shop'`)) && (await sleep(600), !(await vis('prelaunch-tab-shop-line-0'))), await path0());
  await goTab('추천', '/recommendations');
  await sleep(400);
  await tap('prelaunch-demo-reopen');
  check('4', '[사전 오픈 다시 켜기] → 대기 화면으로 돌아온다(되돌리기)', await wait(`[...document.querySelectorAll('[data-testid="prelaunch-screen"]')].some((e) => window.__visible(e)) && !window.__q('rec-card-0')`, 8000), '');
  await shot('4_다시켬');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('5', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('5', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
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
