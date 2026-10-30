// V5 W6 웹 점검(탑승권 · 기다림 · 공개 순간 · 크레딧 · 새 탭 바 · 사전 오픈 → 탑승권). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/, 또는 같은 설정으로 다른 폴더). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 탭 바: 가입을 마치면 탑승권 탭(첫 탭)으로 · 추천 · 호감 · 상점 칸 없음(V5 숨김) · 탑승권이 켜진 탭
//  2 T1 판매 중: 상태 카드 · 탑승권 한 장(회차 · 출발 · 만나는 때 '12월 23일 수요일 오후 6시') · 재촉 · 카운트다운 · 남은 좌석 0
//  3 사기: [탑승권 사기] → 시트(회차 · 매칭 시각 · 26,900원 · 규칙 3줄 · 데모 결제 안내) → [결제하기] → 토스트 · 로고 타일 찍힘 · '3일 뒤에 만나요'(T2 기다림) · 할 일
//  4 공개(데모 줄 '수요일 18:00 공개'): [만난 분 보기] → T3(회차 · 제목 · 사진 · 이름 줄 · [대화 시작하기] · [프로필 자세히 보기]) → 10 상대 상세
//  5 찾지 못함 → '완벽한 사람을 찾지 못했어요' + 크레딧 → T5(잔액 1장 · 내역 · 스토어 환불 한 줄) · 좌석 모두 참 · 판매 전 · 정치 문항 빈칸
//  6 동작 줄이기: 공개 순간에 이동(transform) 0
//  7 사전 오픈 → 탑승권: 확정 전에는 탑승권 탭에 대기 화면(첫 매칭 '12월 23일 수요일 오후 6시') → 확정 장면이면 탑승권(판매 전)
//  (IF2-F 10-28) 1 ~ 6 가입 이메일 w6plainif2off = 기내 서비스 스위치(그룹 IF2)를 끈 데모 장면 — 지금 T1 · T2(새 홈 전, live 처음값과 같은 모습)를 본다. 새 홈은 web-if2
//  8 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 W6_<폭>]/W6_*.png
// 사용: node scripts/web-w6.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-w6.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `W6_${width}`;
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
  const file = `W6_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const path0 = () => b.evaluate('location.pathname');
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const waitVis = (id, ms = 8000) => wait(`!!${visQ(id)}`, ms);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-w6-target]').forEach((e) => e.removeAttribute('data-w6-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-w6-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-w6-target="1"]');
  await sleep(400);
};
const screenText = (id) => visText(id);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('8', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}
const PUSHY = /남은 (자리|좌석|시간)|매진|서두르|마감 임박|지금 바로|놓치지|\d+:\d\d:\d\d|\d+석|\d+명 남|[!！]/;
const tabLabels = () => b.evaluate(`[...document.querySelectorAll('[role=tab]')].filter((e) => window.__visible(e)).map((e) => e.getAttribute('aria-label'))`);
const scene = async (id) => {
  await tap(`boarding-demo-${id}`);
  await sleep(700);
  await b.evaluate(`(() => { const el = ${visQ('boarding-scroll')}; if (el) el.scrollTop = 0; })()`);
  await sleep(300);
};

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → (09 는 숨김 → 탑승권)
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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(until, 20000);
}

let exitCode = 0;
try {
  // ═══ 1. 탭 바 ═══
  check('1', '가입을 마치면 탑승권 탭으로 온다(09 하루 세 분은 숨김)', await signUp('w6plainif2off@email.com', `location.pathname === '/boarding' && !!${visQ('boarding-status-on_sale')}`), await path0());
  await sleep(800);
  const tabs = await tabLabels();
  check('1', `탭 바 첫 칸 '탑승권' · 추천 · 호감 · 상점 칸 없음 · 설정 있음`, tabs[0] === '탑승권' && !tabs.includes('추천') && !tabs.includes('호감') && !tabs.includes('상점') && tabs.includes('설정'), tabs.join(' · '));
  check('1', '탑승권 탭이 켜진 탭(막대, D42-C)', await vis('tab-bar-boarding'), '');

  // ═══ 2. T1 판매 중 ═══
  check('2', `상태 카드 '이번 주 탑승권' + 수락 없이 대화방 한 줄 + [탑승권 사기]`, (await visText('boarding-status-title')) === '이번 주 탑승권' && (await visText('boarding-status-body')).includes('수락 단계 없이') && (await vis('boarding-buy')), await visText('boarding-status-title'));
  check('2', `탑승권 한 장: 이번 주(회차 번호 0 — 3부-자 QP-44) · 출발 수도권 · 만나는 때 '12월 23일 수요일 오후 6시' · 상태 '아직 사지 않았어요'`, (await visText('ticket-round')) === '이번 주' && (await visText('ticket-from')) === '수도권' && (await visText('ticket-when')) === '12월 23일 수요일 오후 6시' && (await visText('ticket-status')) === '아직 사지 않았어요', await visText('ticket-when'));
  check('2', '재촉 · 카운트다운 · 남은 좌석 · 느낌표 0', !PUSHY.test(await screenText('screen-boarding')), '');
  await shot('T1_판매중');
  await measure('T1 판매 중');

  // ═══ 3. 사기 ═══
  await tap('boarding-buy');
  await waitVis('boarding-sheet-summary');
  await sleep(500);
  check('3', `시트: '1회차 · 12월 23일 수요일 오후 6시 매칭' · 26,900원 · 데모 결제 안내`, (await visText('boarding-sheet-summary')) === '1회차 · 12월 23일 수요일 오후 6시 매칭' && (await visText('boarding-sheet-price')) === '26,900원' && (await vis('boarding-sheet-demo')), await visText('boarding-sheet-summary'));
  await shot('T1_사기_시트');
  await measure('사기 시트');
  await tap('boarding-pay');
  check('3', `[결제하기] → 토스트 '탑승했어요. 수요일 오후 6시에 만나요.' · 상태 '탑승했어요'`, (await wait(`document.body.innerText.includes('탑승했어요. 수요일 오후 6시에 만나요.')`, 6000)) && (await wait(`!!${visQ('boarding-status-boarded')}`, 6000)), await visText('boarding-status-title'));
  check('3', `T2 기다림: '3일 뒤에 만나요'(날 단위만) · 탑승 완료 · 로고 타일 찍힘 · 할 일(프로필 · 설문 다듬기)`, (await visText('boarding-days')) === '3일 뒤에 만나요' && (await visText('ticket-status')) === '탑승 완료' && (await vis('boarding-stamp')) && (await vis('boarding-task-profile')) && (await vis('boarding-task-survey')), await visText('boarding-days'));
  await sleep(1200);
  await shot('T2_기다림');
  await measure('T2 기다림');

  // ═══ 4. 공개 ═══
  await scene('matched');
  check('4', `데모 '수요일 18:00 공개' → '이번 주에 만난 분이 있어요' · [만난 분 보기]`, (await visText('boarding-status-title')) === '이번 주에 만난 분이 있어요' && (await vis('boarding-open-reveal')), await visText('boarding-status-title'));
  await tap('boarding-open-reveal');
  check('4', 'T3 공개 순간 열림(/reveal · 탭바 없음)', (await wait(`location.pathname === '/reveal' && !!${visQ('reveal-name')}`, 8000)) && !(await b.evaluate(`[...document.querySelectorAll('[role=tab]')].some((e) => window.__visible(e))`)), await path0());
  await sleep(1500);
  check('4', `회차 '1회차 · 수요일 오후 6시' · 제목 '이번 여행에서 만난 분이에요' · 이름 줄 '문OO · 32 · 서울 마포구'`, (await visText('reveal-kicker')) === '1회차 · 수요일 오후 6시' && (await visText('reveal-title')) === '이번 여행에서 만난 분이에요' && (await visText('reveal-name')) === '문OO · 32 · 서울 마포구', await visText('reveal-name'));
  const photoOk = await wait(`(() => { const el = ${visQ('reveal-photo')}; const img = el && el.querySelector('img'); return !!img && img.complete && img.naturalWidth > 0 && (img.getAttribute('src') || '').includes('p18_face'); })()`, 8000);
  check('4', '만난 분 사진(데모 인물 사진 · 기본 그림 아님)', photoOk && !(await vis('reveal-photo-default')), '');
  check('4', '[대화 시작하기] · [프로필 자세히 보기] · 점수 · 등급 · % 0', (await vis('reveal-chat')) && (await vis('reveal-profile')) && !/점수|등급|%|\d+점/.test(await screenText('screen-reveal')), '');
  await shot('T3_공개순간');
  await measure('T3 공개 순간');
  await tap('reveal-profile');
  check('4', '[프로필 자세히 보기] → 10 상대 상세(문OO)', (await wait(`location.pathname.startsWith('/candidate/') && !!${visQ('candidate-head')}`, 8000)) && (await visText('candidate-head')).startsWith('문OO · 32'), await visText('candidate-head'));
  // QP-01(치명): 공개된 한 분 상세는 보기 + [대화 시작하기]만 — 넘기기 · 호감 · 수락/거절 · '왜 추천했나요' · 등급 · '서로 수락한 뒤의 연락 방법' 0
  const tenText = await screenText('screen-10');
  check('4', 'QP-01: 10 상대 상세(공개 뒤)에 [넘기기] · [호감 보내기] · 수락/거절 · 왜 추천 · 등급 · 수락 뒤 연락 줄 0, 아래 버튼은 [대화 시작하기] 하나',
    !(await vis('candidate-pass')) && !(await vis('candidate-like')) && !(await vis('candidate-accept')) && !(await vis('candidate-decline')) && !(await vis('candidate-why')) && !(await vis('candidate-grade')) && !/추천|호감|수락한 뒤|등급/.test(tenText) && (await visText('candidate-chat')) === '대화 시작하기',
    tenText.slice(0, 80));
  await b.evaluate(`(() => { const el = ${visQ('screen-10')}; if (el) el.scrollTop = 99999; })()`);
  await shot('T3_10_상대상세_아래');
  await measure('10 상대 상세(공개 뒤)');
  await tap('candidate-chat');
  check('4', 'QP-01: [대화 시작하기] → 대화방(/chat/…) · 호감 토스트 0', (await wait(`location.pathname.startsWith('/chat/')`, 6000)) && !(await b.evaluate(`document.body.innerText.includes('호감을 보냈어요')`)), await b.evaluate('location.pathname'));
  await b.evaluate('history.back()');
  await wait(`location.pathname.startsWith('/candidate/')`, 6000);
  await b.evaluate('history.back()');
  await wait(`location.pathname === '/reveal'`, 6000);
  await b.evaluate('history.back()');
  await wait(`location.pathname === '/boarding' && !!${visQ('boarding-scroll')}`, 6000);

  // ═══ 5. 찾지 못함 · 크레딧 · 다른 장면 ═══
  await scene('none');
  check('5', `'완벽한 사람을 찾지 못했어요' + 크레딧으로 돌려드림 + [크레딧 보기] · 이유 줄 없음(카피 14-5-2)`, (await visText('boarding-status-title')) === '완벽한 사람을 찾지 못했어요' && (await visText('boarding-status-body')).startsWith('탑승권 1장을 크레딧으로 돌려드렸어요.') && !(await vis('boarding-nomatch-reason')) && (await vis('boarding-open-credits')), await visText('boarding-status-body'));
  await shot('T1_찾지못함');
  await tap('boarding-open-credits');
  check('5', `T5 크레딧: 잔액 '1장' · 내역 '짝을 찾지 못해 돌려받음 · +1장'(카피 14-5-2) · 스토어 환불 한 줄`, (await wait(`location.pathname === '/credits' && !!${visQ('credits-balance')}`, 6000)) && (await visText('credits-balance')) === '1장' && (await visText('credits-row-0')).includes('짝을 찾지 못해 돌려받음') && (await visText('credits-row-0-delta')) === '+1장' && (await vis('credits-refund')), await visText('credits-row-0'));
  await shot('T5_크레딧');
  await measure('T5 크레딧');
  await b.evaluate('history.back()');
  await wait(`location.pathname === '/boarding' && !!${visQ('boarding-scroll')}`, 6000);
  await scene('full');
  check('5', `좌석 모두 참: 다음 판매 시각만 · [탑승권 사기] 없음 · 남은 좌석 숫자 0`, (await visText('boarding-status-title')) === '이번 회차 좌석이 모두 찼어요' && (await visText('boarding-status-body')).endsWith('12월 24일 목요일 오전 0시부터 살 수 있어요.') && !(await vis('boarding-buy')) && !PUSHY.test(await screenText('screen-boarding')), await visText('boarding-status-body'));
  await shot('T1_좌석모두참');
  await scene('before');
  check('5', `판매 전: '탑승권 판매 전이에요' · '12월 17일 목요일 오전 0시부터'`, (await visText('boarding-status-title')) === '탑승권 판매 전이에요' && (await visText('boarding-status-body')).startsWith('12월 17일 목요일 오전 0시부터'), await visText('boarding-status-body'));
  await scene('politics');
  check('5', `정치 문항 빈칸: 살 수 없는 이유 + [설문으로]`, (await visText('boarding-status-title')) === '설문 한 문항이 남았어요' && (await vis('boarding-ineligible-action')), await visText('boarding-status-title'));
  await scene('credit');
  check('5', `크레딧 1장: 크레딧 줄 · '쓸 수 있는 크레딧이 1장 있어요.' · [크레딧으로 타기]`, (await vis('boarding-credits')) && (await visText('boarding-credit-note')) === '쓸 수 있는 크레딧이 1장 있어요.' && (await visText('boarding-buy')) === '크레딧으로 타기', await visText('boarding-buy'));
  await shot('T1_크레딧');

  // ═══ 6. 동작 줄이기 ═══
  await scene('matched');
  await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await tap('boarding-open-reveal');
  await wait(`location.pathname === '/reveal' && !!window.__q('screen-reveal')`, 8000);
  await sleep(120);
  const moving = await b.evaluate(`(() => { const root = ${visQ('screen-reveal')}; if (!root) return -1; return [...root.querySelectorAll('*')].filter((e) => { const t = getComputedStyle(e).transform; if (!t || t === 'none') return false; const m = t.match(/matrix\\(([^)]+)\\)/); if (!m) return true; const v = m[1].split(',').map(Number); return Math.abs(v[4]) > 0.5 || Math.abs(v[5]) > 0.5 || Math.abs(v[0] - 1) > 0.01; }).length; })()`);
  check('6', '동작 줄이기면 공개 순간에 이동 · 크기 바뀜 0(투명도만)', moving === 0, `움직이는 요소 ${moving}`);
  await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  // ═══ 7. 사전 오픈 → 탑승권 ═══
  check('7', '사전 오픈 계정(확인 중): 탑승권 탭 자리에 대기 화면(단계표)', await signUp('prelaunchw6@email.com', `location.pathname === '/boarding' && !!${visQ('prelaunch-screen')}`), await path0());
  await sleep(600);
  check('7', `첫 매칭 줄 '12월 23일 수요일 오후 6시' · '첫 추천' 글 0`, (await visText('prelaunch-first-rec-when')) === '12월 23일 수요일 오후 6시' && !(await screenText('prelaunch-screen')).includes('첫 추천'), await visText('prelaunch-first-rec-when'));
  await shot('7_대기화면');
  await b.evaluate(`(() => { const el = ${visQ('prelaunch-demo')}; if (el) el.scrollIntoView({ block: 'center' }); })()`);
  await tap('prelaunch-demo-confirmed');
  check('7', `확정되면 출시 전이어도 탑승권(판매 전 상태)이 열린다`, await wait(`!!${visQ('boarding-status-before_sale')} || !!${visQ('boarding-status-on_sale')}`, 10000), await visText('boarding-status-title'));
  await shot('7_확정_탑승권');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('8', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  // QP-14: 화면이 바뀔 때 숨는 쪽에 포커스가 남으면 브라우저가 'Blocked aria-hidden …' 경고를 낸다 — 0 이어야 한다
  const ariaWarn = (b.warnings ?? []).filter((w) => /aria-hidden/i.test(w));
  check('8', '콘솔 경고 aria-hidden 0(QP-14)', ariaWarn.length === 0, `${ariaWarn.length}건 ${ariaWarn.slice(0, 2).join(' | ')}`);
  const outside = [...b.requests.values()].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('8', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
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

const failed = results.filter((x) => !x.ok).length;
console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
exitCode = failed === 0 ? 0 : 1;
process.exit(exitCode);
