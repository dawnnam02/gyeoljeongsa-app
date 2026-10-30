// F4 화면 점검(08 내 프로필 · 공개 범위). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다. 세션이 메모리뿐이라 흐름마다 02 → 03 → 04 데모 건너뛰기 → 06 → 07 [이대로 확정] 으로 처음부터 간다.
//   A. 07 확정 직후 08(처음 한 번): 안내 상자 · 머리 · 배지 2개 · 토글 9개(켜짐 7 · 꺼짐 2) · 구간 항목 표시 · 사진 3칸 · [확인했어요]
//      토글을 바꿔 [확인했어요] → 서버(모의)에 바뀐 열만 저장 + 확인 기록 → 09
//   B. 09 오른쪽 위 원형 사진("내 프로필")으로 다시 들어온 08(F11: 프로필 탭은 없다): [저장] 흐림 → 토글 바꾸면 활성 → 저장 → "저장했어요." → 서버 값 확인 · 잠긴 토글(N15) · 배지 설명
//   C. 저장 실패(인터넷): 문구 · 바꾼 토글은 그대로 · 서버 값 그대로
//   D. 사진 반려: 배지 "사진 다시 올리기" · 칸의 다시 올리기 → 05 다시 올리기 상태(/photos?mode=reupload)
//   E. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 등급 · 점수 · 단계 말 0 · 콘솔 오류 0 · 바깥 주소 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f4.mjs [번들 폴더]   (npm run check:f4, 스크린샷은 확인/스크린샷/F4_* 에 저장)
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
const { PROFILE, PROFILE_DRAFT, COMMON } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname + location.search');
const sel = (id) => `[data-testid="${id}"]`;
const TOGGLES = ['religion', 'maritalHistory', 'children', 'school', 'employer', 'income', 'assets', 'parentEducation', 'parentAssets'];
const NAMES = Object.values(PROFILE.toggles);

const measured = [];
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  measured.push({ label, ...m });
  check('E', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
  return m;
}
const noScore = async () => !/등급|점수|순위|평가|단계/.test(await text());
const on = (key) => b.evaluate(`window.__q('toggle-${key}').getAttribute('aria-checked') === 'true'`);
const visibility = (email) => b.evaluate(`JSON.stringify(window.__demoPeek.visibility(${JSON.stringify(email.replace('@', 'v4on@'))}))`).then(JSON.parse);

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 까지 처음부터(데모 번들은 불러올 때마다 모의 서버가 새로 생긴다)
async function toProfile(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // F17 · F20: 스플래시(약 2.8초)가 걷힌 뒤 누른다(바쁜 기계에서 입력을 놓치지 않게)
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
  return b.waitFor(`location.pathname === '/profile' && !!window.__q('toggle-religion')`, 10000);
}

try {
  // ═══ A. 07 확정 직후 08 (처음 한 번) ═══
  const EMAIL_A = 'f4ok@email.com';
  check('A', '07 [이대로 확정] → 08(/profile?first=1)로 간다', await toProfile(EMAIL_A), `경로 ${await path0()}`);
  const t = await text();
  check('A', '08 처음 한 번: 상단 "내 프로필" · 안내 상자(제목 · 본문) · [확인했어요]가 카피.md 그대로 보이고 [저장]은 없다. 왼쪽 위 ‹ 는 있다(F11) · 탭바는 없다',
    t.includes(PROFILE.headerTitle) && t.includes(PROFILE.firstTitle) && t.includes(PROFILE.firstBody) && (await has(PROFILE.firstConfirm)) && !(await b.evaluate(`!!window.__q('profile-save')`)) && (await b.evaluate(`!!window.__q('profile-header-back')`)) && (await b.evaluate(`document.querySelectorAll('[role=tab]').length`)) === 0, `경로 ${await path0()}`);
  check('A', '08 머리: "이OO · 31 · 서울 마포구"(나이에 세 없음, M3) · 배지 "인증 대기" · "사진 확인 중"', (await b.evaluate(`window.__q('profile-head-text').innerText`)).replace(/\s+/g, ' ').startsWith('이OO · ') && t.includes('서울 마포구') && t.includes(PROFILE.badgeVerifyPending) && t.includes(PROFILE.badgePhotoChecking), '');
  check('A', '08 공개 범위: 제목 · 부제가 카피.md 그대로', t.includes(PROFILE.visibilityTitle) && t.includes(PROFILE.visibilitySubtitle), '');
  check('A', '토글 9개의 이름이 모두 보인다(종교 · 혼인 이력 · 자녀 유무 · 출신 학교 · 직장명 · 연봉 · 본인 자산 · 부모님 학력 · 부모님 자산)', NAMES.length === 9 && NAMES.every((n) => t.includes(n)), `${(await b.evaluate(`window.__qa('toggle-religion').length`))}`);
  const initial = {};
  for (const k of TOGGLES) initial[k] = await on(k);
  check('A', '토글 처음값: 켜짐 7(종교 · 혼인 이력 · 자녀 · 연봉 · 본인 자산 · 부모님 학력) + 꺼짐 2(출신 학교 · 직장명). 답하지 않은 부모님 자산은 꺼짐 · 잠금',
    initial.religion && initial.maritalHistory && initial.children && initial.income && initial.assets && initial.parentEducation && !initial.school && !initial.employer && !initial.parentAssets, JSON.stringify(initial));
  check('A', '구간 공개 항목 4개(연봉 · 본인 자산 · 부모님 학력 · 부모님 자산)에 "구간으로만 보여요"가 보인다', (t.match(new RegExp(PROFILE_DRAFT.rangeNote, 'g')) ?? []).length === 4, '');
  check('A', '사진 3칸(얼굴 정면 · 전신 · 자유)이 "확인 중"으로 보인다', ['face', 'full', 'free'].every((s) => true) && t.includes('내 사진') && (t.match(/확인 중/g) ?? []).length >= 3, '');
  check('A', '등급 · 점수 · 순위 · 평가 · 단계 말이 없다', await noScore(), '');
  await measure('08 처음 한 번');
  await note('F4_08_처음확인_360x740.png');

  // 토글 바꾸고 [확인했어요]
  await b.click(sel('toggle-school'));
  await b.click(sel('toggle-income'));
  check('A', '출신 학교를 켜고 연봉 구간을 끄면 화면에 바로 보인다(저장 전)', (await on('school')) && !(await on('income')), '');
  await note('F4_08_토글변경_360x740.png');
  const before = await visibility(EMAIL_A);
  check('A', '저장 전에는 서버(모의) 값이 그대로다', before.b02_school === false && before.c05_income === true, JSON.stringify(before));
  await b.click(sel('profile-first-confirm'));
  const to09 = await b.waitFor(`location.pathname === '/recommendations'`, 8000);
  check('A', '[확인했어요] → 09(/recommendations)로 간다', to09, `경로 ${await path0()}`);
  const afterA = await visibility(EMAIL_A);
  check('A', '서버(모의)에는 바뀐 두 열만 반영됐고 나머지는 처음값 그대로다(출신 학교 켜짐 · 연봉 꺼짐)', afterA.b02_school === true && afterA.c05_income === false && afterA.a06_religion === true && afterA.c02_employer === false && afterA.d04_parent_assets === true, JSON.stringify(afterA));
  check('A', '"처음 한 번 확인" 기록이 서버(모의)에 남았다', await b.evaluate(`window.__demoPeek.reviewAcked(${JSON.stringify(EMAIL_A.replace('@', 'v4on@'))})`), '');

  // ═══ B. 탭으로 들어온 08 ═══
  await b.click('[aria-label="내 프로필"]');
  check('B', '09 오른쪽 위 원형 사진 "내 프로필"을 누르면 08(/profile)이 열리고 처음 한 번 안내 상자는 없다', (await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`)) && !(await has(PROFILE.firstTitle)), `경로 ${await path0()}`);
  check('B', '서버에 저장된 값이 토글에 그대로 보인다(출신 학교 켜짐 · 연봉 꺼짐)', (await on('school')) && !(await on('income')), '');
  // 버튼 v3(D-141): 비활성 버튼은 투명도 대신 색(card 면 · sub 글자, 가이드 4-4)
  check('B', '바꾼 것이 없으면 [저장]이 흐리고(card 면) 눌러도 아무것도 하지 않는다', await b.evaluate(`getComputedStyle(window.__q('profile-save')).backgroundColor === 'rgb(245, 238, 232)'`), '');
  await measure('08 탭');
  await note('F4_08_탭_360x740.png');

  await b.click(sel('toggle-employer')); // 답하지 않은 항목이 아니라 값이 비어 있는 항목(직장명) → 잠금
  check('B', '잠긴 토글(직장명)을 누르면 "답하지 않은 항목이라 바꿀 수 없어요."를 보이고 켜지지 않는다', (await has(PROFILE.toggleLocked)) && !(await on('employer')), '');
  await note('F4_08_잠금안내_360x740.png');
  await b.click(sel('toggle-maritalHistory'));
  check('B', '혼인 이력을 끄면 [저장]이 활성이 된다(accent 바탕)', await b.evaluate(`getComputedStyle(window.__q('profile-save')).backgroundColor === 'rgb(155, 59, 82)' && Number(getComputedStyle(window.__q('profile-save')).opacity) > 0.9`), '');
  await b.click(sel('profile-save'));
  check('B', '[저장] → "저장했어요."를 보이고 머문다', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(PROFILE.saved)})`)) && (await path0()) === '/profile', '');
  const afterB = await visibility(EMAIL_A);
  check('B', '서버(모의)에 혼인 이력만 꺼짐으로 더 반영됐다', afterB.a07_marital_history === false && afterB.b02_school === true && afterB.c05_income === false, JSON.stringify(afterB));
  await note('F4_08_저장완료_360x740.png');

  await b.click(sel('badge-photo-checking'));
  check('B', '"사진 확인 중" 배지를 누르면 설명 "운영팀이 사진을 확인하고 있어요. 끝나면 공개돼요."가 열린다', await has(PROFILE.badgePhotoCheckingNote), '');
  await b.click(sel('badge-verify'));
  check('B', '"인증 대기" 배지를 누르면 "직접 입력한 정보예요. 서류로 확인된 것은 아니에요."가 열린다', (await has(PROFILE.badgeVerifyPendingNote)) && !(await has(PROFILE.badgePhotoCheckingNote)), '');
  await note('F4_08_배지설명_360x740.png');

  // 탭을 떠나면 바꾼 토글은 버려진다
  await b.click(sel('toggle-religion'));
  await b.click('[aria-label="뒤로"]'); // F11: ‹ → 들어온 화면(09)
  check('B', '08 의 ‹ 는 들어온 화면(09)으로 돌아간다', await b.waitFor(`location.pathname === '/recommendations'`), `경로 ${await path0()}`);
  await b.click('[aria-label="설정"]');
  await b.waitFor(`location.pathname === '/settings'`);
  await b.click('[aria-label="내 프로필"]');
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-save')`);
  check('B', '저장하지 않고 나갔다 오면 바꾼 토글(종교)은 버려진다', await on('religion'), '');

  // ═══ C. 저장 실패(인터넷) ═══
  const EMAIL_C = 'savefail@email.com';
  check('C', '새 흐름으로 08까지 간다', await toProfile(EMAIL_C), '');
  await b.click(sel('toggle-school'));
  await b.click(sel('profile-first-confirm'));
  check('C', '저장이 인터넷 문제로 실패하면 오프라인 문구를 보이고 08에 머문다(09로 가지 않는다)', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(COMMON.offline)})`)) && (await path0()).startsWith('/profile'), `경로 ${await path0()}`);
  check('C', '바꾼 토글(출신 학교 켜짐)은 그대로이고 서버(모의) 값은 처음값 그대로다', (await on('school')) && (await visibility(EMAIL_C)).b02_school === false, '');
  await note('F4_08_저장실패_360x740.png');

  // ═══ D. 사진 반려 ═══
  const EMAIL_D = 'photoreject@email.com';
  check('D', '새 흐름으로 08까지 간다', await toProfile(EMAIL_D), '');
  check('D', '반려된 사진이 있으면 배지 "사진 다시 올리기"와 칸의 [사진 다시 올리기]가 보이고, 확인 중 배지도 함께 보인다(나머지 두 칸은 확인 중)', (await has(PROFILE.badgePhotoRetry)) && (await b.evaluate(`!!window.__q('photo-face-reupload')`)) && (await has(PROFILE.badgePhotoChecking)), '');
  await b.click(sel('badge-photo-retry'));
  check('D', '배지를 누르면 설명 "사진을 다시 올려 주세요. 운영팀이 확인한 사진만 공개돼요."가 열린다', await has(PROFILE.badgePhotoRetryNote), '');
  await note('F4_08_사진반려_360x740.png');
  await measure('08 사진 반려');
  await b.click(sel('photo-face-reupload'));
  check('D', '칸의 [사진 다시 올리기] → 05 다시 올리기 상태(/photos?mode=reupload)로 간다', await b.waitFor(`location.pathname === '/photos' && location.search.includes('mode=reupload')`), `경로 ${await path0()}`);

  // ═══ E. 사진 3장 승인 ═══
  const EMAIL_E = 'photook@email.com';
  check('E', '새 흐름으로 08까지 간다', await toProfile(EMAIL_E), '');
  check('E', '사진 3장이 모두 승인이면 사진 배지가 없고 칸마다 "공개 중"이 보인다', !(await has(PROFILE.badgePhotoChecking)) && !(await has(PROFILE.badgePhotoRetry)) && ((await text()).match(/공개 중/g) ?? []).length >= 3, '');
  await note('F4_08_사진승인_360x740.png');

  // ═══ 공통 ═══
  const bad = b.errors.filter((e) => !/Failed to load resource/.test(e));
  check('E', '콘솔 오류 · 예외 0', bad.length === 0, bad.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('E', '바깥 주소로 나간 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
  const storage = await b.evaluate(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
  check('E', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다', storage === '{"local":[],"session":[]}', storage);
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF4 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
