// LG-F 탑승객 라운지 웹 점검(T4 라운지 줄 · T6 · 데모 loungefirst). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 가입 → 채팅 탭: 맨 위 '라운지 줄'(제목 + '들어가면 좌석이 정해져요.' · 좌석 · 숫자 0 · 빈 좌석 칸) → 누르면 /lounge
//  2 첫 입장: 버튼 하나 '약속을 지키고 들어갈게요'(체크 칸 0) + [나중에] · 짝 안내 → 쪽지 [입장권 뜯기] → 좌석 배정 · 좌석표(내 자리만 점) → 객실
//  3 객실: 좌석 꼬리표 읽기 이름 '13A 좌석' · 글 보내기 → 가상 탑승객 답이 실시간으로 옴 · 신고 사유 5
//  4 데모 줄로 장면 12 돌기(평소 · 아침 · 불 끈 시간 · 착륙 준비 · 닫힘 · 기장 안내만 · 빈 객실 · 쓰기 멈춤 · 이용 멈춤 · 나감 · 약속 바뀜 · 처음) — 장면마다 상태 글
//  5 장면마다 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 숫자 0(좌석 꼬리표 · 때 빼고) · 금지어 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 LG_<폭>]/LG_<장면>_<폭>.png
// 사용: node scripts/web-lounge.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-lounge.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `LG_${width}`;
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

const b = await openBrowser({ distDir, shotDir, width, height: width >= 390 ? 844 : 740 });
const sel = (id) => `[data-testid="${id}"]`;
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const waitVis = (id, ms = 8000) => b.waitFor(`!!${visQ(id)}`, ms);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-lg-target]').forEach((e) => e.removeAttribute('data-lg-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-lg-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-lg-target="1"]');
};
const BANNED = ['익명', '랜덤', '무작위', '비밀', '아무도 몰라요', '흔적 없이', '완전히 지워져요', '누가 내 짝일까', '이상형 찾기', '미리 만나요', '명 접속', '인기 좌석', '안전 100%', '24시간 지켜요', '창가', '통로', '가운데'];
// 화면 글: 좌석 꼬리표(13A) · 때(오후 9:10) · 위기 안내 번호 · 데모 줄을 빼면 숫자 0(인원 · 순위 · 공감 수 · 객실 번호 · 남은 시간 0)
async function words(label) {
  const t = await b.evaluate(`document.body.innerText`);
  const stripped = t.replace(/1[1-9][A-F]/g, '').replace(/(오전|오후) \d{1,2}:\d{2}/g, '').replace(/\(109\)/g, '');
  const digits = (stripped.match(/[^\n]*\d[^\n]*/g) ?? []).slice(0, 3);
  const banned = BANNED.filter((w) => t.includes(w));
  check('5', `${label}: 숫자 0(좌석 · 때 빼고) · 금지어 0 · 느낌표 0`, digits.length === 0 && banned.length === 0 && !/[!！]/.test(t), `${digits.join(' | ')} ${banned.join(',')}`.trim());
}
// 넘침 · 글자 · 터치: 공통 __metrics(가로 넘침 · 13 미만 글자 · 48 미만 터치)
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('5', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.slice(0, 4).join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 탑승권 탭(web-d46 과 같은 길)
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
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding'`, 20000);
}
async function chatTab() {
  await b.evaluate(`document.querySelectorAll('[data-lg-target]').forEach((e) => e.removeAttribute('data-lg-target'))`);
  const tab = await b.evaluate(`(() => { const el = [...document.querySelectorAll('[role=tab]')].find((e) => e.getAttribute('aria-label') === '채팅' && window.__visible(e)); if (el) el.setAttribute('data-lg-target', '1'); return !!el; })()`);
  if (!tab) throw new Error('채팅 탭이 없어요');
  await b.click('[data-lg-target="1"]');
  return b.waitFor(`location.pathname === '/chat'`, 10000);
}

// 데모 장면(데모 줄 차례)과 그 장면에서 보여야 하는 것
const SCENES = [
  { name: 'open', test: 'lounge-input', text: null },
  { name: 'morning', test: 'lounge-messages', text: '이 객실의 선택' },
  { name: 'lightsOut', test: 'lounge-band', text: '불을 끈 시간이에요. 아침에 불을 켜면 다시 쓰고 공감할 수 있어요.' },
  { name: 'landing', test: 'lounge-band', text: '착륙을 준비하고 있어요. 이제 글과 공감은 남길 수 없고, 공개와 함께 라운지가 닫혀요.' },
  { name: 'closed', test: 'lounge-closed', text: '착륙했어요' },
  { name: 'captainOnly', test: 'lounge-captain-only', text: '이번 회차 라운지는 기장 안내로 열려요' },
  { name: 'emptyRoom', test: 'lounge-room-gathering', text: '탑승객이 더 모이면 이야기를 쓸 수 있어요. 그동안 기장 안내는 읽을 수 있어요.' },
  { name: 'paused', test: 'lounge-band', text: '이번 회차에는 읽기만 할 수 있어요' },
  { name: 'kicked', test: 'lounge-kicked', text: '이번 회차 라운지는 이용할 수 없어요' },
  { name: 'left', test: 'lounge-left', text: '라운지에서 나왔어요' },
  { name: 'rules', test: 'lounge-intro-rules-changed', text: '라운지 약속이 바뀌었어요. 바뀐 약속을 읽고 다시 들어가 주세요.' },
  { name: 'first', test: 'lounge-intro', text: '라운지에 들어가기 전에' },
];

let exitCode = 0;
try {
  // ═══ 1. 채팅 탭 라운지 줄 ═══
  check('1', '가입(데모 loungefirst)', await signUp(`loungefirst${width}@email.com`), '');
  check('1', '채팅 탭', await chatTab(), '');
  check('1', '맨 위 라운지 줄이 보인다', await waitVis('lounge-row', 10000), '');
  check('1', "줄 글: '탑승객 라운지' + '들어가면 좌석이 정해져요.'", (await visText('lounge-row-title')) === '탑승객 라운지' && (await visText('lounge-row-line')) === '들어가면 좌석이 정해져요.', await visText('lounge-row'));
  check('1', "줄 읽기 이름 '탑승객 라운지, 들어가면 좌석이 정해져요.' · 줄 글에 숫자 · 좌석 0 · 빈 좌석 칸(1A)", (await b.evaluate(`(${visQ('lounge-row')}).getAttribute('aria-label')`)) === '탑승객 라운지, 들어가면 좌석이 정해져요.' && !/\d/.test(await visText('lounge-row')) && (await vis('lounge-row-seat-box')), '');
  await measure('T4 라운지 줄');
  await b.shot(`LG_T4줄_${width}.png`);
  // ═══ 2. 첫 입장 ═══
  await tap('lounge-row');
  check('2', '/lounge 첫 입장 안내', await b.waitFor(`location.pathname === '/lounge' && !!${visQ('lounge-intro')}`, 10000), await b.evaluate('location.pathname'));
  check('2', "동의 버튼 하나 '약속을 지키고 들어갈게요' + [나중에] · 체크 칸 0", (await visText('lounge-intro-agree')) === '약속을 지키고 들어갈게요' && (await visText('lounge-intro-later')) === '나중에' && (await b.evaluate(`document.querySelectorAll('[role=checkbox],input[type=checkbox]').length`)) === 0, '');
  check('2', '짝 안내 한 줄 · 약속 세 줄', (await visText('lounge-intro-pair')).startsWith('이번 주에 이어질 분이 있다면') && (await vis('lounge-intro-promise-2')), '');
  await measure('첫 입장 안내');
  await words('첫 입장 안내');
  await b.shot(`LG_첫입장_${width}.png`);
  await tap('lounge-intro-agree');
  check('2', "입장권 쪽지 '입장권을 뜯으면 좌석이 정해져요.'", (await waitVis('lounge-stub', 8000)) && (await visText('lounge-stub-body')) === '입장권을 뜯으면 좌석이 정해져요.', '');
  await measure('입장권 쪽지');
  await tap('lounge-stub-tear');
  check('2', '뜯기 400ms → 좌석 배정 한 줄 · 좌석표', await b.waitFor(`!!${visQ('lounge-seat-assigned')}`, 6000), await visText('lounge-seat-assigned'));
  const assigned = await visText('lounge-seat-assigned');
  const mySeat = (/^(1[1-9][A-F]) 좌석에 앉았어요/.exec(assigned) ?? [])[1] ?? '';
  check('2', `좌석표: 읽기 이름 '좌석표, 내 자리는 ${mySeat} 좌석' · 점 하나`, (await b.evaluate(`(${visQ('lounge-seatmap')}).getAttribute('aria-label')`)) === `좌석표, 내 자리는 ${mySeat} 좌석` && (await b.evaluate(`document.querySelectorAll('[data-testid="lounge-seatmap"] circle').length`)) === 1, mySeat);
  await sleep(500);
  await b.shot(`LG_좌석배정_${width}.png`);
  await measure('좌석 배정 · 좌석표');
  await tap('lounge-seat-close');
  // ═══ 3. 객실 ═══
  check('3', '객실(말풍선 목록 · 입력칸)', (await waitVis('lounge-messages', 6000)) && (await waitVis('lounge-input', 6000)), '');
  const tags = await b.evaluate(`[...document.querySelectorAll('[data-testid^="lounge-post-"][data-testid$="-seat"][aria-label]')].filter((e) => window.__visible(e)).map((e) => e.getAttribute('aria-label'))`);
  check('3', "좌석 꼬리표 읽기 이름 '13A 좌석' 꼴 · 누를 수 없음", tags.length > 3 && tags.every((t) => /^1[1-9][A-F] 좌석$/.test(t)) && (await b.evaluate(`[...document.querySelectorAll('[data-testid^="lounge-post-"][data-testid$="-seat"][aria-label]')].every((e) => e.getAttribute('role') !== 'button' && e.tagName !== 'BUTTON')`)), `${tags.length}개`);
  check('3', `머리 '내 좌석 ${mySeat}' · 부제 '경주행'`, (await b.evaluate(`document.body.innerText.includes('내 좌석 ${mySeat}') && document.body.innerText.includes('경주행')`)), '');
  await words('객실');
  await measure('객실');
  await b.type(sel('lounge-input'), '안녕하세요. 이번 주가 처음이라 조금 설레요.');
  await tap('lounge-send');
  check('3', '내 글이 붙는다', await b.waitFor(`document.body.innerText.includes('이번 주가 처음이라 조금 설레요')`, 6000), '');
  check('3', '가상 탑승객 답이 실시간으로 온다(그 글 하나만 다시 읽기)', await b.waitFor(`document.body.innerText.includes('반가워요. 천천히 이야기 나눠요.')`, 8000), '');
  await sleep(400);
  await b.shot(`LG_객실_${width}.png`);
  // 남의 글 메뉴 → 신고 사유 5
  const otherMore = await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid$="-more"]')].find((e) => window.__visible(e) && !e.closest('[data-testid$="-me"]')); return el ? el.getAttribute('data-testid') : null; })()`);
  if (otherMore) {
    await tap(otherMore);
    await sleep(500);
    if (await vis('lounge-msg-report')) {
      await tap('lounge-msg-report');
      await sleep(500);
      const reasons = await b.evaluate(`[...document.querySelectorAll('[data-testid^="lounge-report-RP"]')].filter((e) => window.__visible(e)).map((e) => e.getAttribute('data-testid').replace('lounge-report-', ''))`);
      check('3', '신고 사유 5(RP4 ~ RP8)', JSON.stringify(reasons) === JSON.stringify(['RP4', 'RP5', 'RP6', 'RP7', 'RP8']), reasons.join(','));
      await measure('신고 시트');
      await tap('lounge-report-cancel');
      await sleep(400);
    } else {
      await tap('lounge-msg-close');
      await sleep(400);
    }
  }
  // ═══ 4. 데모 장면 12 ═══
  for (const sc of SCENES) {
    const before = await visText('lounge-demo-scene');
    await tap('lounge-demo-scene');
    await b.waitFor(`(${visQ('lounge-demo-scene')} || {}).innerText !== ${JSON.stringify(before)}`, 6000);
    const ok = await waitVis(sc.test, 6000);
    const text = sc.text ? await b.evaluate(`document.body.innerText.includes(${JSON.stringify(sc.text)})`) : true;
    check('4', `장면 ${sc.name}: ${sc.test}${sc.text ? ` · '${sc.text.slice(0, 18)}…'` : ''}`, ok && text, await visText('lounge-demo-scene'));
    if (sc.name === 'lightsOut' || sc.name === 'landing') {
      const emp = await b.evaluate(`[...document.querySelectorAll('[data-testid$="-empathy"]')].filter((e) => window.__visible(e)).length`);
      const recv = await b.evaluate(`[...document.querySelectorAll('[data-testid$="-received"]')].filter((e) => window.__visible(e)).length`);
      check('4', `장면 ${sc.name}: 공감 단추 · '공감받았어요' 0 · 입력칸 0`, emp === 0 && recv === 0 && !(await vis('lounge-input')), `공감 ${emp} · 받음 ${recv}`);
    }
    await words(`장면 ${sc.name}`);
    await measure(`장면 ${sc.name}`);
    if (['lightsOut', 'landing', 'closed', 'captainOnly', 'morning'].includes(sc.name)) await b.shot(`LG_${sc.name}_${width}.png`);
  }

  const external = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('5', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && external.length === 0, [...b.errors.slice(0, 2), ...external.slice(0, 2).map((r) => r.url)].join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.message ?? error).slice(0, 200));
  exitCode = 1;
} finally {
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n탑승객 라운지 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 || exitCode ? 1 : 0);
