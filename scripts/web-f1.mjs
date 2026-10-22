// F1 화면 점검(01 온보딩 · 02 가입 · 03 동의 · 15 인증 실패). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  헤드리스 Edge 로 폭 360 에서 처음부터 끝까지 사람이 하는 순서대로 누르고 입력하며 잰다. 앱 코드는 고치지 않는다.
//   A. 01 온보딩: 글 · 점 3개 · 장 넘김 · 두 버튼 · 02 로 이동
//   B. 02 가입: 이메일 형식 오류 · 발송 · 재전송 시계 · 인증번호 틀림(오류 모양) · 맞음 → 생년월일 → 미성년 거절 → 통과 → 03
//   C. 03 동의: 체크 9칸 글(법무 문서와 같은지) · 안내 상자 자리 · 필수 미체크 오류 · 모두 동의 연동 · 요약 · 전문 시트 · 링크 읽기 화면 → 04-01
//   D. 15 인증 실패(점검용 화면)
//   F. 스플래시(D15): 글꼴을 붙들어 준비가 늦어지게 만들어 로고 정중앙 · 한 줄 · 링 · 3초 넘으면 안내 · 풀리면 페이드로 01 · 동작 줄이기에서 링 정지 / 01 소개 그림 3장
//   E. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0 · 바깥 주소 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f1.mjs [번들 폴더]   (기본 dist-demo, 스크린샷은 확인/스크린샷/ 에 저장)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR, SOURCES, parseConsentDoc, readDoc } from './lib/legal-source.mjs';

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

// 법무 문서에서 직접 읽은 확정 문구(앱 코드가 아니라 원본과 대조한다)
const doc = parseConsentDoc(readDoc(SOURCES.consent));
const ITEMS = doc.items;
const REQUIRED = ITEMS.filter((i) => i.required).map((i) => i.code);

// 한국 날짜 계산(서버 규칙과 같다): 오늘 − 가입 나이 24년(D-100 · F22, 없는 날은 그 달 마지막 날), 하루 더하기
const pad = (n, w = 2) => String(n).padStart(w, '0');
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const cutoff = (todayIso) => {
  const y = Number(todayIso.slice(0, 4)) - 24;
  const m = Number(todayIso.slice(5, 7));
  const d = Math.min(Number(todayIso.slice(8, 10)), daysIn(y, m));
  return `${pad(y, 4)}${pad(m)}${pad(d)}`;
};
const nextDay = (digits) => {
  const t = Date.UTC(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)) - 1, Number(digits.slice(6, 8)) + 1);
  const d = new Date(t);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
// 흐린 모양(x40%)인가: 눌림은 받지만 흐린 버튼(R7)은 aria-disabled 가 웹에 안 나가서 그려진 불투명도로 본다
const dimmed = (testId) => b.evaluate(`getComputedStyle(window.__q(${JSON.stringify(testId)})).opacity < 0.6`);
// 입력 칸이 잠겨 있는가(react-native-web 은 editable=false 를 readOnly 로 그린다)
const isLocked = (selector) => b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!(el.readOnly || el.disabled); })()`);

// 화면이 바뀔 때마다 재는 공통 점검(E): 가로 넘침 · 글자 12 이상 · 터치 44 이상
const measured = [];
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  measured.push({ label, ...m });
  return m;
}

try {
  // ═══ A. 01 온보딩 ═══
  const ready01 = await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);
  check('A', '01 온보딩이 열리고 "시작하기"가 보인다', ready01);
  const first = await b.evaluate(`({ lang: document.documentElement.lang, title: document.title, text: window.__text(), storage: localStorage.length + sessionStorage.length })`);
  check('A', '상단 바 글자 "결정사" · 제목 "결혼을 정말 하고 싶은 사람들" · 부제 · 두 버튼이 카피 그대로 보인다',
    first.text.includes('결정사') && first.text.includes('결혼을 정말 하고 싶은 사람들') && first.text.includes('설문에 답하면 AI가 내용을 정리하고, 성향과 조건을 살펴 하루 세 분을 추천해요.') &&
      first.text.includes('시작하기') && first.text.includes('이미 계정이 있어요'),
    first.text.slice(0, 80));
  check('A', '시안용 글자 "온보딩"은 화면에 없다(K2 4장 01)', !/\b온보딩\b/.test(first.text), '');
  const dots = await b.evaluate(`window.__qa('intro-dot-1').length + window.__qa('intro-dot-2').length + window.__qa('intro-dot-3').length`);
  check('A', '장 표시 점 3개가 있다', dots === 3, `점 ${dots}개`);
  const m01 = await measure('01');
  check('A', '360 폭에서 가로 스크롤 0 · 글자 12 이상 · 터치 44 이상', m01.scrollW <= m01.innerW && m01.over.length === 0 && m01.minFont >= 12 && m01.small.length === 0,
    `scrollW ${m01.scrollW}/${m01.innerW} · 넘침 ${m01.over.length} · 최소 글자 ${m01.minFont} · 작은 터치 ${m01.small.join(',') || '없음'}`);
  await note('F1_01_온보딩_360x740.png');

  await b.click('[data-testid="intro-dot-2"]');
  const slide2 = await b.evaluate(`window.__text()`);
  check('A', '점 2를 누르면 2장으로 바뀐다(제목 "설문은 20~30분쯤 걸려요")', slide2.includes('설문은 20~30분쯤 걸려요') && slide2.includes('중간에 저장하고 나가도 돼요.'), '');
  await note('F1_01_온보딩_2장_360x740.png');
  await b.click('[data-testid="intro-dot-3"]');
  const slide3 = await b.evaluate(`window.__text()`);
  check('A', '점 3을 누르면 3장으로 바뀐다(제목 "하루 세 분, 서로 수락하면 연결돼요")', slide3.includes('하루 세 분, 서로 수락하면 연결돼요'), '');
  check('A', '2 · 3장에서도 [시작하기] · [이미 계정이 있어요]가 그대로 있다', slide3.includes('시작하기') && slide3.includes('이미 계정이 있어요'), '');
  await note('F1_01_온보딩_3장_360x740.png');

  // 밀기: 오른쪽으로 밀면 이전 장(마우스 끌기로 흉내 낸다)
  const slide = await b.evaluate(`window.__center(window.__q('intro-slide'))`);
  const drag = async (dx) => {
    await b.mouse('mouseMoved', slide.x - dx / 2, slide.y);
    await b.mouse('mousePressed', slide.x - dx / 2, slide.y);
    for (let i = 1; i <= 8; i++) {
      await b.mouse('mouseMoved', slide.x - dx / 2 + (dx * i) / 8, slide.y);
      await sleep(25);
    }
    await b.mouse('mouseReleased', slide.x + dx / 2, slide.y);
    await sleep(300);
  };
  await drag(120);
  const afterSwipeRight = await text();
  check('A', '오른쪽으로 밀면 이전 장(2장)으로 간다', afterSwipeRight.includes('설문은 20~30분쯤 걸려요'), '');
  await drag(-120);
  const afterSwipeLeft = await text();
  check('A', '왼쪽으로 밀면 다음 장(3장)으로 간다', afterSwipeLeft.includes('하루 세 분, 서로 수락하면 연결돼요'), '');
  await drag(-120);
  check('A', '끝(3장)에서 더 밀어도 그 자리에 머문다', (await text()).includes('하루 세 분, 서로 수락하면 연결돼요'), '');
  await sleep(2500);
  check('A', '자동으로 넘기지 않는다(2.5초 뒤에도 3장)', (await text()).includes('하루 세 분, 서로 수락하면 연결돼요'), '');

  // 390 × 844(Figma 프레임 크기)
  await b.viewport(390, 844);
  await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);
  await note('F1_01_온보딩_390x844.png');
  await b.viewport(360, 740);
  await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);

  await b.clickText('이미 계정이 있어요');
  const onSignIn = await b.waitFor(`location.pathname === '/sign-in' && document.body.innerText.includes('이메일로 시작해요')`);
  check('A', '[이미 계정이 있어요]를 누르면 02 가입 · 로그인(/sign-in)으로 간다', onSignIn, `경로 ${await b.evaluate('location.pathname')}`);
  await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);
  await b.clickText('시작하기');
  check('A', '[시작하기]를 누르면 02 가입 · 로그인(/sign-in)으로 간다', await b.waitFor(`location.pathname === '/sign-in'`), '');

  // ═══ B. 02 가입 · 로그인 ═══
  const ready02 = await b.waitFor(`document.body.innerText.includes('이메일로 시작해요')`);
  check('B', '02 가입 · 로그인이 열린다', ready02);
  const t02 = await text();
  check('B', '제목 · 부제 · 안내가 카피.md · 동의문구 5-2 그대로 보인다',
    t02.includes('가입 · 로그인') && t02.includes('이메일로 시작해요') && t02.includes('인증번호를 이메일로 보내드려요.') &&
      t02.includes(doc.signup.text) && t02.includes(doc.signup.link) && t02.includes('만 24세 이상만 가입할 수 있어요.'), '');
  const emailSel = '[data-testid="signin-email"]';
  const codeSel = '[data-testid="signin-code"]';
  const birthSel = '[data-testid="signin-birth"]';
  const init02 = await b.evaluate(`({
    email: document.querySelector('${emailSel}').placeholder, code: document.querySelector('${codeSel}').placeholder,
    codeDisabled: document.querySelector('${codeSel}').disabled || document.querySelector('${codeSel}').readOnly,
    birth: !!document.querySelector('${birthSel}'),
    confirmDisabled: window.__q('signin-confirm').getAttribute('aria-disabled') === 'true',
    demoHint: window.__q('signin-demo-hint') ? window.__q('signin-demo-hint').innerText : '' })`);
  check('B', '이메일 칸 자리표시 "example@email.com" · 인증번호 칸 "인증번호 6자리"가 있고 인증번호 칸은 잠겨 있다', init02.email === 'example@email.com' && init02.code === '인증번호 6자리' && init02.codeDisabled, JSON.stringify(init02));
  check('B', '처음에는 생년월일 칸이 없고 [확인]이 비활성이다', !init02.birth && init02.confirmDisabled, '');
  check('B', '데모 모드에서만 인증번호 안내(123456)가 보인다', init02.demoHint.includes('123456'), init02.demoHint);
  const m02 = await measure('02 처음');
  check('B', '02 처음 모양: 360 폭 가로 스크롤 0 · 글자 12 이상 · 터치 44 이상', m02.scrollW <= m02.innerW && m02.over.length === 0 && m02.minFont >= 12 && m02.small.length === 0,
    `넘침 ${m02.over.length} · 최소 글자 ${m02.minFont} · 작은 터치 ${m02.small.join(',') || '없음'}`);
  await note('F1_02_가입_처음_360x740.png');

  // 이메일 형식 오류(흐린 버튼도 눌리고 이유 문구가 보인다)
  await b.type(emailSel, 'abc');
  await b.clickText('인증번호 받기');
  check('B', '형식이 틀린 이메일로 [인증번호 받기]를 누르면 "이메일 주소를 다시 확인해 주세요."가 보인다', await has('이메일 주소를 다시 확인해 주세요.'), '');
  await note('F1_02_이메일_형식오류_360x740.png');

  // 발송
  await b.type(emailSel, 'hello@email.com');
  check('B', '이메일을 고치면 오류 문구가 사라진다', !(await has('이메일 주소를 다시 확인해 주세요.')), '');
  await b.clickText('인증번호 받기');
  const sent = await b.waitFor(`/0[23]:[0-5][0-9] 뒤에 다시 받을 수 있어요/.test(document.body.innerText)`);
  check('B', '받으면 "03:00(02:59) 뒤에 다시 받을 수 있어요"가 보이고 인증번호 칸이 열린다', sent && !(await isLocked(codeSel)), '');
  const clock1 = await b.evaluate(`(document.body.innerText.match(/(\\d\\d):(\\d\\d) 뒤에 다시 받을 수 있어요/) || []).slice(1).join(':')`);
  await sleep(2300);
  const clock2 = await b.evaluate(`(document.body.innerText.match(/(\\d\\d):(\\d\\d) 뒤에 다시 받을 수 있어요/) || []).slice(1).join(':')`);
  const secs = (s) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
  check('B', '시계가 줄어든다(2초 남짓 사이에 1~3초 줄어듦)', clock1 && clock2 && secs(clock1) - secs(clock2) >= 1 && secs(clock1) - secs(clock2) <= 4, `${clock1} → ${clock2}`);
  check('B', '다시 받을 수 있을 때까지 [인증번호 받기]는 흐리다(누르는 효과 없음)', (await dimmed('signin-send')), '');
  await note('F1_02_인증번호_입력_360x740.png');

  // 인증번호 틀림 = 15 인증 실패 모양
  await b.type(codeSel, '000000');
  await b.clickText('확인');
  const wrong = await b.waitFor(`document.body.innerText.includes('인증번호가 맞지 않아요. 다시 확인해 주세요.')`);
  check('B', '틀린 인증번호: "인증번호가 맞지 않아요. 다시 확인해 주세요."가 인증번호 칸 아래에 보인다', wrong, '');
  const keep = await b.evaluate(`({ email: document.querySelector('${emailSel}').value, code: document.querySelector('${codeSel}').value })`);
  check('B', '틀리면 인증번호 칸만 비우고 이메일은 남는다', keep.email === 'hello@email.com' && keep.code === '', JSON.stringify(keep));
  const m02e = await measure('02 오류');
  check('B', '오류 상태에서도 가로 넘침 0 · 글자 12 이상', m02e.scrollW <= m02e.innerW && m02e.over.length === 0 && m02e.minFont >= 12, `넘침 ${m02e.over.length} · 최소 글자 ${m02e.minFont}`);
  await note('F1_02_인증번호_틀림_360x740.png');

  // 맞는 번호 → 새 이메일: 생년월일
  await b.type(codeSel, '123456');
  await b.clickText('확인');
  const birthOpen = await b.waitFor(`!!document.querySelector('${birthSel}')`);
  check('B', '인증번호가 맞으면 새 이메일이라 생년월일 칸이 열린다(자리표시 "생년월일 8자리 (예: 19950312)")', birthOpen && (await b.evaluate(`document.querySelector('${birthSel}').placeholder`)) === '생년월일 8자리 (예: 19950312)', '');
  check('B', '생년월일 칸이 열리면 이메일 · 인증번호 칸은 잠기고 [확인]은 8자리가 찰 때까지 비활성이다',
    (await isLocked(emailSel)) && (await isLocked(codeSel)) && (await b.evaluate(`window.__q('signin-confirm').getAttribute('aria-disabled')`)) === 'true', '');
  await note('F1_02_생년월일_360x740.png');

  // 미성년 거절 → 경계
  const todayKst = await b.evaluate(`new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)`);
  const adultBirth = cutoff(todayKst); // 오늘 만 24세 생일(통과)
  const minorBirth = nextDay(adultBirth); // 내일이 생일(거절)
  await b.type(birthSel, minorBirth);
  await b.clickText('확인');
  const minor = await b.waitFor(`document.body.innerText.includes('만 24세 이상만 가입할 수 있어요.') && document.querySelector('[data-testid="signin-birth-error"]')`);
  check('B', `경계: 생일 하루 전(${minorBirth})은 "만 24세 이상만 가입할 수 있어요."가 생년월일 칸 아래에 보이고 02 에 머문다`, minor && (await b.evaluate('location.pathname')) === '/sign-in', `오늘(KST) ${todayKst}`);
  await note('F1_02_미성년_거절_360x740.png');
  await b.type(birthSel, '19951345');
  await b.clickText('확인');
  check('B', '없는 날짜(19951345)는 "생년월일을 다시 확인해 주세요."', await b.waitFor(`document.body.innerText.includes('생년월일을 다시 확인해 주세요.')`), '');

  // 통과(생일 당일) → 03
  await b.type(birthSel, adultBirth);
  await b.clickText('확인');
  const on03 = await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  check('B', `경계: 만 24세 생일 당일(${adultBirth})은 통과해 03 약관 · 동의(/consent)로 간다`, on03, `경로 ${await b.evaluate('location.pathname')}`);

  // ═══ C. 03 약관 · 동의 ═══
  const t03 = await text();
  check('C', '상단 바 "약관 동의" · 제목 · 부제가 카피.md 03 그대로 보인다',
    t03.includes('약관 동의') && t03.includes('시작하려면 동의가 필요해요') && t03.includes(doc.subtitle), doc.subtitle);
  const labelsMissing = ITEMS.filter((i) => !t03.includes(i.label)).map((i) => i.code);
  check('C', `체크 문구 9줄이 법무 문서(동의문구.md 4장)와 글자 그대로 같다`, labelsMissing.length === 0, labelsMissing.length ? `없는 칸: ${labelsMissing.join(',')}` : ITEMS.map((i) => i.label.slice(0, 8)).join(' / '));
  const notesMissing = ITEMS.filter((i) => i.note && !t03.includes(i.note)).map((i) => i.code);
  check('C', '덧붙이는 안내(선택 칸 · 확인 칸)와 맨 위 칸 글이 보인다', notesMissing.length === 0 && t03.includes(doc.top.label) && t03.includes(doc.top.note), '');
  const pos = (s) => t03.indexOf(s);
  check('C', '안내 상자 "알아 두세요"가 CK3 와 CK4 사이에 있다', pos(ITEMS[2].label) < pos(doc.notice.title) && pos(doc.notice.title) < pos(ITEMS[3].label) && t03.includes(doc.notice.body), '');
  check('C', '체크 줄 순서가 CK1 → CK9 이다', ITEMS.every((it, i) => i === 0 || pos(ITEMS[i - 1].label) < pos(it.label)), '');
  check('C', '링크 줄 "이용약관 · 개인정보 처리방침 보기"와 작은 글씨가 있다', t03.includes(doc.links.line) && t03.includes(doc.links.small), '');
  const marks = await b.evaluate(`(() => ({
    boxes: [...document.querySelectorAll('[role=checkbox]')].length,
    checked: [...document.querySelectorAll('[role=checkbox][aria-checked=true]')].length,
    more: document.body.innerText.split('보기 ›').length - 1 }))()`);
  check('C', '처음에는 체크 줄 10개(맨 위 1 + 칸 9)가 모두 해제이고 "보기 ›"가 9개다', marks.boxes === 10 && marks.checked === 0 && marks.more === 9, JSON.stringify(marks));
  check('C', '처음에는 [동의하고 계속]이 흐리고 오류 문구가 없다', (await dimmed('consent-submit')) && !(await has(doc.error)), '');
  const m03 = await measure('03 처음');
  check('C', '03 처음 모양: 360 폭 가로 스크롤 0 · 글자 12 이상 · 터치 44 이상', m03.scrollW <= m03.innerW && m03.over.length === 0 && m03.minFont >= 12 && m03.small.length === 0,
    `넘침 ${m03.over.length}(${m03.over.slice(0, 2).join(',')}) · 최소 글자 ${m03.minFont} · 작은 터치 ${m03.small.join(',') || '없음'}`);
  await note('F1_03_동의_처음_360x740.png');
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = el.scrollHeight; })()`);
  await sleep(300);
  await note('F1_03_동의_아래_360x740.png');
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);

  // 필수 미체크 오류(R7)
  await b.click('[data-testid="consent-submit"]');
  check('C', `비어 있는 채로 [동의하고 계속]을 누르면 "${doc.error}"가 보이고 03 에 머문다`, (await has(doc.error)) && (await b.evaluate('location.pathname')) === '/consent', '');
  await note('F1_03_동의_오류_360x740.png');

  // 맨 위 칸 연동
  await b.click('[data-testid="consent-all"]');
  const afterAll = await b.evaluate(`(() => ({
    checked: [...document.querySelectorAll('[role=checkbox][aria-checked=true]')].length,
    req: ${JSON.stringify(REQUIRED)}.map((c) => window.__q('consent-check-' + c).getAttribute('aria-checked')),
    opt: ['CK4', 'CK9'].map((c) => window.__q('consent-check-' + c).getAttribute('aria-checked')),
    top: window.__q('consent-all').getAttribute('aria-checked') }))()`);
  check('C', '맨 위 칸을 켜면 필수 7칸이 모두 켜지고 선택 2칸(CK4 · CK9)은 그대로 꺼져 있다', afterAll.req.every((v) => v === 'true') && afterAll.opt.every((v) => v === 'false') && afterAll.top === 'true' && afterAll.checked === 8, JSON.stringify(afterAll));
  check('C', '필수를 모두 켜면 오류 문구가 사라지고 버튼이 켜진다', !(await has(doc.error)) && !(await dimmed('consent-submit')), '');
  await note('F1_03_동의_필수모두_360x740.png');
  await b.click('[data-testid="consent-check-CK6"]');
  check('C', '필수 7칸 중 하나(CK6)를 끄면 맨 위 칸도 꺼진다', (await b.evaluate(`window.__q('consent-all').getAttribute('aria-checked')`)) === 'false', '');
  await b.click('[data-testid="consent-check-CK6"]');
  check('C', '다시 켜면 맨 위 칸도 다시 켜진다', (await b.evaluate(`window.__q('consent-all').getAttribute('aria-checked')`)) === 'true', '');
  await b.click('[data-testid="consent-check-CK4"]');
  await b.click('[data-testid="consent-all"]');
  await b.click('[data-testid="consent-all"]');
  const optionalKept = await b.evaluate(`window.__q('consent-check-CK4').getAttribute('aria-checked')`);
  check('C', '선택 칸(CK4)을 켜 두고 맨 위 칸을 끄고 켜도 선택 칸은 그대로 켜져 있다', optionalKept === 'true', '');

  // 요약 · 전문 시트
  const ck3 = ITEMS.find((i) => i.code === 'CK3');
  await b.click('[data-testid="consent-more-CK3"]');
  const sheetOpen = await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ck3.why)})`);
  const sheetText = await text();
  check('C', "'보기 ›'를 누르면 요약 시트가 열린다: 왜 필요한지 · 요약 5줄 · 동의하지 않으면 · [전문 보기]",
    sheetOpen && ck3.summary.every((s) => sheetText.includes(s)) && sheetText.includes(`${ck3.declinedLabel}: ${ck3.declined}`) && sheetText.includes('전문 보기'), '');
  check('C', '요약 맨 위에 "왜 필요한지" 한 줄이 요약 줄보다 먼저 나온다', sheetText.lastIndexOf(ck3.why) < sheetText.lastIndexOf(ck3.summary[0]), '');
  const m03s = await measure('03 요약 시트');
  check('C', '요약 시트: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m03s.scrollW <= m03s.innerW && m03s.over.length === 0 && m03s.minFont >= 12 && m03s.small.length === 0, `넘침 ${m03s.over.length} · 최소 글자 ${m03s.minFont} · 작은 터치 ${m03s.small.join(',') || '없음'}`);
  await note('F1_03_요약시트_360x740.png');
  await b.clickText('전문 보기');
  const fullOpen = await b.waitFor(`document.body.innerText.includes('운영자는 아래와 같이 개인정보를 수집·이용합니다.')`);
  check('C', '[전문 보기]를 누르면 같은 시트 아래에 전문(합니다체)이 열린다', fullOpen && !(await has('전문 보기')), '');
  await note('F1_03_전문_360x740.png');
  await b.click('[aria-label="닫기"]');
  check('C', '시트를 닫으면 03 으로 돌아오고 체크는 그대로다', (await b.waitFor(`!document.body.innerText.includes(${JSON.stringify(ck3.why)})`)) && (await b.evaluate(`window.__q('consent-check-CK3').getAttribute('aria-checked')`)) === 'true', '');

  // 링크 줄 → 읽기 화면
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = el.scrollHeight; })()`);
  await sleep(200);
  await b.click('[data-testid="consent-links"]');
  const reader = await b.waitFor(`!!window.__q('legal-reader') && document.body.innerText.includes('운영자 정보')`, 40000); // 약관 전문이 길어 컴퓨터가 바쁠 때는 그리기가 늦다
  check('C', '링크 줄을 누르면 이용약관 읽기 화면이 열린다(탭: 이용약관 · 개인정보 처리방침)', reader && (await has('이용약관')) && (await has('개인정보 처리방침')), '');
  await note('F1_03_약관읽기_360x740.png');
  await b.click('[data-testid="legal-tab-privacy"]');
  check('C', '"개인정보 처리방침" 탭으로 바꿀 수 있다', await b.waitFor(`document.body.innerText.includes('처리하는 개인정보의 항목') || document.body.innerText.includes('이 방침의 구성')`), '');
  await b.click('[aria-label="닫기"]');

  // 저장 → 04-01
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);
  await b.click('[data-testid="consent-submit"]');
  const on04 = await b.waitFor(`location.pathname === '/survey/01'`);
  check('C', '[동의하고 계속]을 누르면 동의 기록을 저장하고 04-01 설문(/survey/01)으로 간다', on04, `경로 ${await b.evaluate('location.pathname')}`);

  // 390 × 844 (Figma 프레임 크기): 02 · 03 의 모양
  await b.viewport(390, 844);
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await note('F1_02_가입_처음_390x844.png');
  await b.open('/consent', `document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await note('F1_03_동의_처음_390x844.png');
  await b.viewport(360, 740);

  // ═══ D. 15 인증 실패(점검용 화면) ═══
  const ready15 = await b.open('/sign-in-code-error', `document.body.innerText.includes('인증번호가 맞지 않아요. 다시 확인해 주세요.')`);
  check('D', '15 인증 실패: 인증번호 칸이 오류 모양이고 아래에 "인증번호가 맞지 않아요. 다시 확인해 주세요."', ready15, '');
  const t15 = await text();
  check('D', '15: 이메일 "hello@email.com"과 "02:59 뒤에 다시 받을 수 있어요"가 멈춰 있다', (await b.evaluate(`document.querySelector('${emailSel}').value`)) === 'hello@email.com' && t15.includes('02:59 뒤에 다시 받을 수 있어요'), '');
  const m15 = await measure('15');
  check('D', '15: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m15.scrollW <= m15.innerW && m15.over.length === 0 && m15.minFont >= 12 && m15.small.length === 0, `넘침 ${m15.over.length} · 최소 글자 ${m15.minFont} · 작은 터치 ${m15.small.join(',') || '없음'}`);
  await note('F1_15_인증실패_360x740.png');

  // ═══ F. 스플래시 · 01 소개 그림(D15) ═══
  // F-1. 01 소개 그림: 장마다 다른 그림 · 정사각 · 둥글기 16 · 그림 칸 안에 글자 없음
  await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);
  await b.waitFor(`!!window.__q('intro-art-image')`);
  const artInfo = async () => b.evaluate(`(() => { const card = window.__q('intro-art'); const img = window.__q('intro-art-image'); const r = card.getBoundingClientRect(); const bg = getComputedStyle(img).backgroundImage; const src = img.tagName === 'IMG' ? img.src : ((img.querySelector('img') || {}).src || bg); return { w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(getComputedStyle(card).borderTopLeftRadius), src: String(src).slice(-60), text: card.innerText.trim() }; })()`);
  const art1 = await artInfo();
  await note('F11_01_소개그림_1장_360x740.png');
  await b.click('[data-testid="intro-dot-2"]');
  const art2 = await artInfo();
  await note('F11_01_소개그림_2장_360x740.png');
  await b.click('[data-testid="intro-dot-3"]');
  const art3 = await artInfo();
  await note('F11_01_소개그림_3장_360x740.png');
  check('F', '01 소개 그림 칸: 정사각(가로 = 세로) · 둥글기 16 · 그림 위에 글자 없음', [art1, art2, art3].every((a) => Math.abs(a.w - a.h) <= 1 && a.radius === 16 && a.text === ''), `${art1.w}x${art1.h} · 둥글기 ${art1.radius}`);
  check('F', '01 소개 그림: 장마다 다른 그림이 보인다(1 · 2 · 3장)', new Set([art1.src, art2.src, art3.src]).size === 3 && [art1, art2, art3].every((a) => /intro_[123]/.test(a.src)), [art1.src, art2.src, art3.src].map((x) => x.slice(-28)).join(' | '));
  const m01art = await measure('01 소개 그림');
  check('F', '01 소개 그림 있는 모양: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m01art.scrollW <= m01art.innerW && m01art.over.length === 0 && m01art.minFont >= 12 && m01art.small.length === 0, `넘침 ${m01art.over.length} · 최소 글자 ${m01art.minFont}`);

  // F-2. 스플래시: 글꼴 요청을 붙들어 앱 준비를 늦춘다(앱은 글꼴이 오면 준비가 끝난다)
  const held = [];
  let release = false;
  b.cdp.on((m) => {
    if (m.method !== 'Fetch.requestPaused') return;
    if (release) void b.cdp.send('Fetch.continueRequest', { requestId: m.params.requestId });
    else held.push(m.params.requestId);
  });
  await b.cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'Font' }] });
  await b.cdp.send('Page.navigate', { url: b.origin + '/onboarding' });
  const splashUp = await b.waitFor(`!!document.querySelector('[data-testid="splash"]')`, 10000);
  await b.installHelpers();
  check('F', '앱을 열면 스플래시가 먼저 보인다(글꼴이 오기 전)', splashUp, '');
  if (splashUp) {
    await sleep(500);
    const geo = await b.evaluate(`(() => { const logo = document.querySelector('[data-testid="splash"] img'); const r = logo.getBoundingClientRect(); const ring = window.__q('splash-ring').getBoundingClientRect(); const line = window.__q('splash-line').getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), lw: Math.round(r.width), vw: innerWidth, vh: innerHeight, ring: Math.round(ring.width), ringTop: Math.round(ring.top), lineTop: Math.round(line.top), logoBottom: Math.round(r.bottom), lineBottom: Math.round(line.bottom), ringBottom: Math.round(ring.bottom), hasSlow: !!window.__q('splash-slow'), text: window.__text() }; })()`);
    check('F', '로고가 화면 정중앙(가로 · 세로 ±1)이고 폭이 160이다', Math.abs(geo.cx - geo.vw / 2) <= 1 && Math.abs(geo.cy - geo.vh / 2) <= 1 && geo.lw === 160, `중앙 ${geo.cx},${geo.cy} / 화면 ${geo.vw}x${geo.vh} · 로고 폭 ${geo.lw}`);
    check('F', '브랜드 한 줄이 로고 아래 24, 링(24)이 한 줄 아래 24에 있다', Math.abs(geo.lineTop - geo.logoBottom - 24) <= 3 && geo.ring === 24 && Math.abs(geo.ringTop - geo.lineBottom - 24) <= 2, `한 줄 간격 ${geo.lineTop - geo.logoBottom} · 링 ${geo.ring} · 링 간격 ${geo.ringTop - geo.lineBottom}`);
    check('F', '0.5초 때는 "불러오는 중이에요" 안내가 없다', !geo.hasSlow && geo.text.includes('결혼을 정말 하고 싶은 사람들'), '');
    await note('F11_스플래시_360x740.png');

    // 링이 도는가: 같은 요소의 transform 이 시간에 따라 바뀐다
    const spin = async () => b.evaluate(`getComputedStyle(window.__q('splash-ring-arc')).transform`);
    // 번들을 막 만든 직후나 컴퓨터가 바쁠 때는 첫 화면 그리기가 늦어 두 번 읽은 값이 같을 수 있다(B-Q1-01). 앱 결함이 아니라 점검 타이밍이라, 최대 4초 동안 230ms 간격으로 읽어 값이 한 번이라도 달라지면 돈 것으로 본다
    const t1 = await spin();
    let t2 = t1;
    for (let i = 0; i < 18 && t2 === t1; i += 1) {
      await sleep(230);
      t2 = await spin();
    }
    // 실패했을 때 원인을 가린다: 브라우저가 프레임을 그리고 있는데도 값이 안 바뀌면 앱, 프레임이 0이면 브라우저(환경)
    const frames = t1 !== t2 ? null : await b.evaluate(`new Promise((resolve) => { let n = 0; const stop = Date.now() + 400; const tick = () => { n += 1; if (Date.now() < stop) requestAnimationFrame(tick); else resolve(n); }; requestAnimationFrame(tick); })`);
    check('F', '링이 돈다(호의 회전 값이 시간에 따라 바뀐다)', t1 !== t2, `${t1.slice(0, 40)} → ${t2.slice(0, 40)}${frames === null ? '' : ` · 0.4초 동안 그려진 프레임 ${frames}`}`);

    await sleep(3000);
    const slowShown = await b.evaluate(`!!window.__q('splash-slow') && window.__q('splash-slow').innerText`);
    check('F', '3초가 넘도록 준비가 안 끝나면 링 아래에 "불러오는 중이에요"가 나온다', slowShown === '불러오는 중이에요', String(slowShown));
    await note('F11_스플래시_로딩길어짐_360x740.png');

    // 동작 줄이기: 링 정지
    await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await sleep(400);
    const r1 = await spin();
    await sleep(300);
    const r2 = await spin();
    check('F', '동작 줄이기: 링이 멈춘다(회전 값이 그대로) · 안내 문구는 그대로 있다', r1 === r2 && (await b.evaluate(`!!window.__q('splash-slow')`)), `${r1.slice(0, 40)}`);
    await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

    // 글꼴을 풀어 준다 → 준비 끝 → 페이드 → 01
    release = true;
    for (const id of held) await b.cdp.send('Fetch.continueRequest', { requestId: id });
    const mid = await b.waitFor(`!window.__q('splash') || Number(getComputedStyle(window.__q('splash')).opacity) < 1`, 8000);
    const on01 = await b.waitFor(`!window.__q('splash') && document.body.innerText.includes('시작하기')`, 8000);
    check('F', '준비가 끝나면 스플래시가 걷히고(페이드) 01 온보딩이 보인다', mid && on01, `경로 ${await b.evaluate('location.pathname')}`);
  }
  await b.cdp.send('Fetch.disable');

  // ═══ E. 마무리 ═══
  const overAll = measured.filter((m) => m.scrollW > m.innerW || m.over.length > 0).map((m) => m.label);
  const tinyAll = measured.filter((m) => m.minFont < 12).map((m) => `${m.label}(${m.minFont}px)`);
  const smallAll = measured.filter((m) => m.small.length > 0).map((m) => `${m.label}: ${m.small.join(',')}`);
  check('E', `점검한 화면 모양 ${measured.length}곳에서 가로 넘침 0`, overAll.length === 0, overAll.join(', '));
  check('E', '글자 크기가 모두 12 이상', tinyAll.length === 0, tinyAll.join(', '));
  check('E', '누르는 요소(버튼 · 체크 칸 · 링크)가 모두 44 × 44 이상', smallAll.length === 0, smallAll.join(' | '));
  const storage = await b.evaluate('localStorage.length + sessionStorage.length');
  check('E', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다(세션은 메모리뿐)', storage === 0, `항목 ${storage}개`);
  check('E', '콘솔 오류 · 예외 0', b.errors.length === 0, b.errors.slice(0, 3).join(' | '));
  const reqs = [...b.requests.values()];
  const outside = reqs.filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  const failed = reqs.filter((r) => r.failed || (r.status && r.status >= 400));
  check('E', '바깥 주소(서버 포함)로 나간 요청 0 · 실패한 요청 0(데모 모드는 서버에 닿지 않는다)', outside.length === 0 && failed.length === 0, `바깥 ${outside.length} · 실패 ${failed.length}`);
  // 데모 번들에 서버 주소가 들어 있지 않다
  const envFile = path.join(APP_DIR, '.env');
  const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
  const host = /EXPO_PUBLIC_SUPABASE_URL=https?:\/\/([^\s/]+)/.exec(envText)?.[1];
  let leaked = false;
  if (host) {
    const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
    for (const f of fs.existsSync(jsDir) ? fs.readdirSync(jsDir) : []) if (fs.readFileSync(path.join(jsDir, f), 'utf8').includes(host)) leaked = true;
  }
  check('E', '데모 번들에 서버 주소가 들어 있지 않다', !leaked, host ? '(.env 의 서버 주소로 번들을 찾아봄)' : '(.env 가 없어 건너뜀)');
} catch (error) {
  exitCode = 1;
  console.log(`[실패] 점검 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  b.close();
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\nF1 화면 점검: 통과 ${results.length - failedCount} · 실패 ${failedCount}`);
process.exitCode = exitCode || (failedCount > 0 ? 1 : 0);
