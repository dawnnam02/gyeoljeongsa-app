// F11 화면 점검(하단 탭 상점 · 머리 오른쪽 위 원형 프로필 사진 · 기본 프로필 그림 · 08 탭 밖 · 16 상점). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다.
//   A. 탭바 4개(추천 · 호감 · 상점 · 설정, 프로필 칸 없음) · 켜진 탭 1개(채움 + Bold) · 상점 탭 → 16
//   B. 머리 오른쪽 위 원형 사진: 09 · 11 · 12 · 16 에서 터치 44 × 44 · 원 32 · 오른쪽 끝(원 20 / 터치 14) · 이름 "내 프로필" → 누르면 08
//   C. 09 "다음 추천까지"가 머리가 아니라 부제 아래 작은 글 한 줄 / 추천 0명(rec0) 빈 상태는 content 맨 위 시간 줄만
//   D. 08: 탭바 없음 · 왼쪽 위 ‹ → 들어온 탭(09 · 16) · 처음 한 번 확인(?first=1)도 ‹ 가 있다 · 저장 바가 화면 바닥에 붙는다(아래 여백 20) · 프로필 탭 주소(/profile)를 바로 열어도 열린다, 세션이 없으면 ‹ 는 09 로
//   E. 16 상점: 카드 1개(내 성향 리포트 · 무료 · 설명) · 준비 중 · 가격 · 등급 말 없음
//   F. 사진: 승인·확인 중이면 원 안에 사진, 반려(photoreject)면 기본 프로필 그림. 08 큰 사진 칸도 같은 그림
//   G. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0 · 바깥 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f11.mjs [번들 폴더]   (npm run check:f11, 스크린샷은 확인/스크린샷/F11_탭_* 에 저장)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findBrowser, openBrowser } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷');

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

const load = (file) => import(pathToFileURL(file).href);
const { SHOP, TABS, A11Y, RECS } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname + location.search');
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const rect = (selector) =>
  b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; })()`);
const tabs = () =>
  b.evaluate(`(() => [...document.querySelectorAll('[role=tab]')].filter((el) => el.querySelector('svg')).map((el) => {
    const label = [...el.querySelectorAll('*')].find((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
    const svg = el.querySelector('svg');
    const faced = [...svg.querySelectorAll('path')].some((p) => (p.getAttribute('fill') || '').toUpperCase() === '#F6E9EC' || getComputedStyle(p).fill === 'rgb(246, 233, 236)');
    const ls = label ? getComputedStyle(label) : null;
    return { text: label ? label.textContent.trim() : '', x: Math.round(el.getBoundingClientRect().left), selected: el.getAttribute('aria-selected'), family: ls ? ls.fontFamily : '', icon: faced ? 'filled' : 'line' }; // D42-C: 켜진 탭 = 닫힌 면 accentSoft, 꺼진 탭 = 선만
  }).sort((a, c) => a.x - c.x))()`);
// 눈에 보이는 것만 센다(웹에서는 가려진 앞 화면도 DOM 에 남아 있다)
const visibleCount = (selector) => b.evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => window.__visible(el)).length`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  return null;
}
async function confirmFirst() {
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error') || !!window.__q('recs-first-wait') || !!window.__q('recs-preparing'))`, 10000);
}
const goTab = async (name, pathname) => {
  await b.click(`[role=tab][aria-label="${name}"]`);
  return b.waitFor(`location.pathname === ${JSON.stringify(pathname)}`, 8000);
};

// 원 안에 사진이 있는가(true) · 기본 그림인가(false). 웹에서 Image 는 배경 그림이거나 img 다.
const avatarKind = (id) =>
  b.evaluate(`(() => {
    const root = window.__q(${JSON.stringify(id)});
    if (!root) return 'none';
    const d = window.__q(${JSON.stringify(id + '-default')});
    return d ? 'default' : 'photo';
  })()`);

try {
  // ═══ A · B · C · E · F(승인) · G: 기본 계정 ═══
  const EMAIL = 'f11ok@email.com';
  await toRecs(EMAIL);
  // 08 처음 한 번 확인(?first=1)에도 ‹ 가 있고 탭바는 없다
  const tabs08 = await b.evaluate(`document.querySelectorAll('[role=tab]').length`);
  check('D', '07 확정 직후 08(처음 한 번): 탭바 없음 · 왼쪽 위 ‹ 있음 · 오른쪽 위 원형 사진 없음', tabs08 === 0 && (await q('profile-header-back')) && !(await q('profile-button')), `탭 ${tabs08}`);
  const foot = await rect(sel('profile-first-confirm'));
  const inner08 = await b.evaluate('window.innerHeight');
  check('D', '08 저장 바(버튼)는 화면 바닥에 붙는다: 버튼 아래 여백 20', foot && Math.abs(inner08 - foot.b - 20) <= 1.5, foot ? `버튼 아래 ${Math.round(inner08 - foot.b)}` : '버튼 없음');
  await note('F11_탭_08_처음확인_바닥저장바_360x740.png');
  await measure('08 처음 한 번');
  // ‹ → 쌓인 화면이 없으니(07 을 갈아 끼웠다) 09
  await b.click(sel('profile-header-back'));
  check('D', '08(처음 한 번) 의 ‹ → 09(스택이 없으면 09, T5)', await b.waitFor(`location.pathname === '/recommendations'`, 8000), `경로 ${await path0()}`);
  await b.open('/sign-in', `true`); // 세션은 메모리뿐이라 아래 흐름은 새로 시작한다
  await toRecs(EMAIL);
  check('A', '[확인했어요] → 09', await confirmFirst(), `경로 ${await path0()}`);

  const t1 = await tabs();
  check('A', '탭 4개: 추천 · 호감 · 상점 · 설정 순서, 프로필 칸 없음', t1.map((t) => t.text).join(',') === '추천,호감,상점,설정' && t1.map((t) => t.text).join(',') === Object.values(TABS).join(','), t1.map((t) => t.text).join(','));
  const on1 = t1.filter((t) => t.selected === 'true');
  check('A', '현재 탭 1개(추천) = 면 accentSoft 아이콘 + Bold, 나머지 3개 = 선만(D42-C)', on1.length === 1 && on1[0].text === '추천' && on1[0].icon === 'filled' && /Bold/.test(on1[0].family) && t1.filter((t) => t.icon === 'line').length === 3, JSON.stringify(t1.map((t) => `${t.text}:${t.icon}`)));

  // B. 09 머리 오른쪽 위 원형 사진
  const btn = await rect('[aria-label="내 프로필"]');
  const av = await rect(sel('profile-button-avatar'));
  const innerW = await b.evaluate('window.innerWidth');
  check('B', '09 머리 오른쪽 위: 버튼 터치 44 × 44 · 사진 원 32 × 32, 원의 오른쪽 끝이 화면 끝에서 20(터치 끝은 14) · 원이 터치 영역 가운데', btn && av && Math.round(btn.w) === 44 && Math.round(btn.h) === 44 && Math.round(av.w) === 32 && Math.round(av.h) === 32 && Math.abs(innerW - av.r - 20) <= 1 && Math.abs(innerW - btn.r - 14) <= 1 && Math.abs(btn.l + 22 - (av.l + 16)) <= 1,
    btn && av ? `버튼 ${Math.round(btn.w)}×${Math.round(btn.h)} 끝 ${Math.round(innerW - btn.r)} · 원 ${Math.round(av.w)}×${Math.round(av.h)} 끝 ${Math.round(innerW - av.r)}` : '못 찾음');
  const round = await b.evaluate(`getComputedStyle(window.__q('profile-button-avatar')).borderRadius`);
  check('B', '원은 둥글다(지름의 절반 둥글기)', parseFloat(round) >= 16, round);
  const head = await rect(sel('recs-header'));
  check('B', '머리 높이 52 · 버튼은 머리 세로 가운데', head && btn && Math.round(head.h) === 52 && Math.abs((btn.t + btn.h / 2) - (head.t + head.h / 2)) <= 1, head ? `머리 ${Math.round(head.h)}` : '');
  const label = await b.evaluate(`document.querySelector('[aria-label="내 프로필"]')?.getAttribute('role') + '|' + document.querySelector('[aria-label="내 프로필"]')?.getAttribute('aria-label')`);
  check('B', '접근성: 이름 "내 프로필" · 역할 버튼', label === `button|${A11Y.myProfile}`, label);
  // C. 다음 추천까지: 머리가 아니라 부제 아래
  const sub = await rect(sel('recs-subtitle'));
  const rem = await rect(sel('recs-remaining'));
  check('C', '09 "다음 추천까지"는 머리 오른쪽이 아니라 부제 바로 아래 작은 글 한 줄(간격 4, 글자 12)', head && sub && rem && rem.t >= head.b && rem.t >= sub.b && rem.t - sub.b <= 8 && rem.t - sub.b >= 2 && (await b.evaluate(`parseFloat(getComputedStyle(window.__q('recs-remaining')).fontSize)`)) === 12 && /다음 추천까지/.test(await inner('recs-remaining')), sub && rem ? `부제 아래 ${Math.round(rem.t - sub.b)}` : '');
  await b.waitFor(`!!window.__q('profile-button-avatar') && !window.__q('profile-button-avatar-default')`, 6000);
  check('F', '확인 중인 사진은 본인 화면에서 원 안에 사진으로 보인다(기본 그림이 아님)', (await avatarKind('profile-button-avatar')) === 'photo', await avatarKind('profile-button-avatar'));
  await measure('09 오늘의 추천');
  await note('F11_탭_09_원형사진_360x740.png');

  // 누르면 08
  await b.click('[aria-label="내 프로필"]');
  check('B', '09 의 원형 사진을 누르면 08(/profile)이 열린다', await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`), `경로 ${await path0()}`);
  const tabs08b = await visibleCount('[role=tab]');
  check('D', '08: 탭바 없음 · ‹ 있음 · 제목 "내 프로필" · 원형 사진 버튼 없음(보이는 것 기준)', tabs08b === 0 && (await q('profile-header-back')) && (await has('내 프로필')) && (await visibleCount('[aria-label="내 프로필"]')) === 0, `보이는 탭 ${tabs08b}`);
  const save = await rect(sel('profile-save'));
  const ih = await b.evaluate('window.innerHeight');
  check('D', '08 저장 바: 버튼이 화면 바닥에 붙는다(아래 여백 20, 좌우 20)', save && Math.abs(ih - save.b - 20) <= 1.5 && Math.abs(save.l - 20) <= 1 && Math.abs(360 - save.r - 20) <= 1, save ? `아래 ${Math.round(ih - save.b)} · 좌 ${Math.round(save.l)} · 우 ${Math.round(360 - save.r)}` : '');
  const big = await rect(sel('profile-face-avatar'));
  check('F', '08 큰 사진 칸 72 원(사진 확인 중이면 사진, 없으면 기본 그림)', big && Math.round(big.w) === 72 && Math.round(big.h) === 72, big ? `${Math.round(big.w)}×${Math.round(big.h)}` : '');
  await measure('08 내 프로필');
  await note('F11_탭_08_탭밖_뒤로_360x740.png');
  await b.click(sel('profile-header-back'));
  check('D', '08 의 ‹ → 들어온 화면(09)', await b.waitFor(`location.pathname === '/recommendations'`, 8000), `경로 ${await path0()}`);

  // 상점 탭
  check('A', '상점 탭을 누르면 16(/shop)이 열리고 상점 탭만 채움 + Bold', await goTab('상점', '/shop'), `경로 ${await path0()}`);
  const t2 = await tabs();
  const on2 = t2.filter((t) => t.selected === 'true' && t.icon === 'filled' && /Bold/.test(t.family));
  check('A', '16 에서 켜진 탭은 상점 하나', on2.length === 1 && on2[0].text === '상점' && t2.filter((t) => t.icon === 'filled').length === 1, on2.map((t) => t.text).join(','));
  const t16 = await text();
  check('E', '16 상점: 머리 "상점" · 카드 하나(내 성향 리포트 · 무료 · 한 줄 설명) · "준비 중" · 가격 · 등급 · 구독 말 없음', t16.includes(SHOP.headerTitle) && (await inner('shop-report-title')) === SHOP.reportTitle && (await inner('shop-report-free')) === SHOP.reportFree && (await inner('shop-report-body')) === SHOP.reportBody && !/준비 중|원|등급|구독|결제|구매/.test(await inner('screen-16')) && (await b.evaluate(`document.querySelectorAll('[data-testid="shop-report"]').length`)) === 1, '');
  const btn16 = await rect('[aria-label="내 프로필"]');
  check('B', '16 머리 오른쪽 위에도 같은 자리의 원형 사진', btn16 && Math.abs(btn16.r - btn.r) <= 0.5 && Math.abs(btn16.t - btn.t) <= 0.5, btn16 ? `끝 ${Math.round(360 - btn16.r)}` : '');
  await measure('16 상점');
  await note('F11_탭_16_상점_360x740.png');
  await b.click('[aria-label="내 프로필"]');
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`);
  await b.click(sel('profile-header-back'));
  check('D', '16 에서 들어온 08 의 ‹ → 16', await b.waitFor(`location.pathname === '/shop'`, 8000), `경로 ${await path0()}`);

  // 호감 · 설정
  check('B', '호감 탭 → 11, 머리 오른쪽 위 원형 사진 같은 자리', (await goTab('호감', '/likes')) && (await b.waitFor(`!!window.__q('likes-tabs')`)) && (await rect('[aria-label="내 프로필"]'))?.r === btn.r, `경로 ${await path0()}`);
  await measure('11 호감');
  await note('F11_탭_11_원형사진_360x740.png');
  await b.click('[aria-label="내 프로필"]');
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`);
  await b.click(sel('profile-header-back'));
  check('D', '11 에서 들어온 08 의 ‹ → 11', await b.waitFor(`location.pathname === '/likes'`, 8000), `경로 ${await path0()}`);
  check('B', '설정 탭 → 12, 머리 오른쪽 위 원형 사진 같은 자리 · 설정 하위 화면(‹ 머리)에는 없다', (await goTab('설정', '/settings')) && (await b.waitFor(`!!window.__q('settings-rows')`)) && (await rect('[aria-label="내 프로필"]'))?.r === btn.r, `경로 ${await path0()}`);
  await measure('12 설정');
  await note('F11_탭_12_원형사진_360x740.png');
  await b.click(sel('settings-row-notifications'));
  await new Promise((r) => setTimeout(r, 600));
  const inSettings = (sub) => b.evaluate(`!!window.__q('settings-screen')?.querySelector(${JSON.stringify(sub)})`);
  check('B', '12 하위 화면(알림)은 ‹ 머리이고 그 화면 안에 원형 사진이 없다', !(await inSettings('[aria-label="내 프로필"]')) && (await inSettings('[aria-label="뒤로"]')), '');

} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
}

try {
  // ═══ F. 반려 → 기본 프로필 그림 ═══
  await toRecs('photoreject@email.com');
  await confirmFirst();
  await b.waitFor(`!!window.__q('profile-button')`, 8000);
  await b.waitFor(`window.__q('profile-button-avatar')`, 4000);
  await new Promise((r) => setTimeout(r, 800));
  check('F', '얼굴 사진이 반려된 계정: 09 머리의 원이 기본 프로필 그림이다(accentSoft 원 + 사람)', (await avatarKind('profile-button-avatar')) === 'default', await avatarKind('profile-button-avatar'));
  const av32 = await rect(sel('profile-button-avatar-default'));
  check('F', '기본 그림은 지름 32 원 안에 꽉 찬다(테두리 · 이니셜 · 회색 원 없음)', av32 && Math.round(av32.w) === 32 && Math.round(av32.h) === 32 && !/[가-힣A-Za-z]/.test(await inner('profile-button')), av32 ? `${Math.round(av32.w)}×${Math.round(av32.h)}` : '');
  await note('F11_탭_09_기본프로필그림_360x740.png');
  await b.click('[aria-label="내 프로필"]');
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`);
  await b.waitFor(`!!window.__q('profile-face-avatar-default')`, 4000);
  check('F', '반려된 계정의 08 큰 사진 칸(72)도 같은 기본 그림', (await avatarKind('profile-face-avatar')) === 'default', '');
  await note('F11_탭_08_기본프로필그림_360x740.png');

  // 추천 0명(rec0): 13 모양 — 시간 줄만 content 맨 위
  await toRecs('rec0@email.com');
  await confirmFirst();
  await b.waitFor(`!!window.__q('recs-empty')`, 8000);
  const head0 = await rect(sel('recs-header'));
  const rem0 = await rect(sel('recs-remaining'));
  check('C', '추천 0명 빈 상태(13 모양): 시간 줄만 content 맨 위(머리 아래)에 있다', head0 && rem0 && rem0.t >= head0.b && rem0.t - head0.b <= 32, rem0 && head0 ? `머리 아래 ${Math.round(rem0.t - head0.b)}` : '');
  await measure('09 추천 0명');
  await note('F11_탭_13_추천없음_360x740.png');

  // 받은 호감 0건(14)
  await toRecs('like0@email.com');
  await confirmFirst();
  check('B', '14 호감 없음 모양도 머리 오른쪽 위 원형 사진', (await goTab('호감', '/likes')) && (await b.waitFor(`!!window.__q('screen-14')`, 8000)) && (await q('profile-button')), '');
  await note('F11_탭_14_호감없음_360x740.png');

  // 프로필 탭 주소를 바로 연다(링크가 깨지지 않는다): 세션이 없어도 08 이 열리고 ‹ 는 09 로
  await b.open('/profile', `!!window.__q('profile-header') || document.body.innerText.includes('내 프로필')`);
  check('D', '옛 프로필 탭 주소(/profile)를 바로 열어도 08 이 열린다(탭바 없음 · ‹ 있음)', (await path0()) === '/profile' && (await has('내 프로필')) && (await visibleCount('[role=tab]')) === 0 && (await q('profile-header-back')), `경로 ${await path0()}`);
  await b.click(sel('profile-header-back'));
  check('D', '쌓인 화면이 없을 때 ‹ → 09(/recommendations)', await b.waitFor(`location.pathname === '/recommendations'`, 8000), `경로 ${await path0()}`);

  // ═══ G. 공통 ═══
  const bad = b.errors.filter((e) => !/Failed to load resource/.test(e));
  check('G', '콘솔 오류 · 예외 0', bad.length === 0, bad.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('G', '바깥 주소로 나간 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
  const storage = await b.evaluate(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
  check('G', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다', storage === '{"local":[],"session":[]}', storage);
} catch (error) {
  check('실행', '점검 도중 오류가 없다(2)', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF11 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
void RECS;
process.exit(exitCode || (failed > 0 ? 1 : 0));
