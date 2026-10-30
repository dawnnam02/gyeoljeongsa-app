// F3 화면 점검(06 AI 정리 중 · 07 내 성향). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버 · Claude 호출 없음).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르고 입력하며 잰다. 세션이 메모리뿐이라 흐름마다 새로 불러와 처음부터(02 → 03 → 04 데모 건너뛰기) 간다.
//   A. 정상 응답: 04 데모 건너뛰기 → 06 처리 중(글 · 단계 · 진행바) → 07 보기(모의 20건 첫 사례 그대로) → 근거 접기/펼치기 →
//      수정(막대 끌기 · 칩 지우기 · 더하기 · 오류 · 요약 고치기) → 저장 → 서버 쪽 user_edited 저장 · 원본 보존 → 이대로 확정 → 08
//   B. 실패 응답: 06 오류(다시 시도) → 2번째 → 3번째(직접 입력하기 + 안내) → 07 직접 입력(막대 처음값 · 칩 고르기 최대 5 · 칩 없이는 확정 안 됨) → 확정
//   C. 지연 응답: 60초 전에는 안내 없음 → 60초가 넘으면 "평소보다 오래 걸리고 있어요…" → 끝나면 07
//   E. 07 확정 실패 4종 확인창(동의 · 설문 · 사진 · 기타): 제목 20 Bold · 버튼 세로 · 캡처 F3_07_확정실패_{동의,설문,사진,기타}
//   D. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 등급 · 점수 말 0 · 콘솔 오류 0 · 바깥 주소 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f3.mjs [번들 폴더]   (npm run check:f3, 스크린샷은 확인/스크린샷/F3_* 에 저장. 약 2분 걸린다: 지연 응답이 75초)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
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

// 원본 문서의 값을 앱 코드가 아니라 파일에서 직접 읽는다
const load = (file) => import(pathToFileURL(file).href);
const { ANALYSIS, TRAITS, COMMON } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));
const { AXIS_NAMES, AXIS_ORDER, EVIDENCE_LABELS } = await load(path.join(APP_DIR, 'src', 'content', 'traitsContent.ts'));
const mock = JSON.parse(fs.readFileSync(path.join(APP_DIR, '..', 'ai', '시험', 'mock_20.json'), 'utf8'));
const WANT = mock.cases[0].output; // 모의 모드 첫 사례(clean)의 출력 = 모의 서버가 주는 결과

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname');
const sel = (id) => `[data-testid="${id}"]`;

const measured = [];
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  measured.push({ label, ...m });
  return m;
}
const noScore = async () => !/등급|점수|순위/.test(await text());

// 02 → 03 → 04 까지 처음부터(데모 번들은 불러올 때마다 모의 서버가 새로 생긴다)
async function toSurvey(email) {
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
  return b.waitFor(`location.pathname === '/survey/01'`);
}
const peek = (email) => b.evaluate(`JSON.stringify({ rows: window.__demoPeek.aiRows(${JSON.stringify(email.replace('@', 'v4on@'))}), active: window.__demoPeek.active(${JSON.stringify(email.replace('@', 'v4on@'))}) })`).then(JSON.parse);
// 3부-사(검수 웹점검_f1f3_원인 2장 · Q9-N4): 07 막대 옆 숫자 글자는 QP-09 로 지웠다 → 화면 읽기 값(aria-valuenow)을 읽는다(앱이 웹에도 aria-value* 를 준다)
const ariaNow = async (id) => b.evaluate(`(() => { const el = window.__q(${JSON.stringify(id)}); const v = el ? el.getAttribute('aria-valuenow') : null; return v === null ? NaN : Number(v); })()`);
const slider = async (key) => ariaNow(`trait-slider-${key}`);
const bar = async (key) => ariaNow(`trait-bar-${key}`);

try {
  // ═══ A. 정상 응답 ═══
  const EMAIL_A = 'ok@email.com';
  check('A', '02 → 03 → 04-01 까지 처음부터 간다(데모 모의 서버)', await toSurvey(EMAIL_A), `경로 ${await path0()}`);

  const skipText = await text();
  check('A', '04 데모 건너뛰기: 안내 글과 버튼 셋(정상 · 실패 · 지연)이 보인다', skipText.includes('설문 완료 · 정상 응답') && skipText.includes('설문 완료 · 실패 응답') && skipText.includes('설문 완료 · 지연 응답'), '');
  check('A', '04 = 설문 화면(대화형 V6-F 또는 정식 설문 v2) 아래에 데모 건너뛰기 줄', await b.waitFor(`(!!window.__q('chat-screen') || !!window.__q('v2-screen')) && !!window.__q('demo-skip')`, 8000), '');
  await note('F3_04_데모_건너뛰기_360x740.png');
  const mSkip = await measure('04 데모 건너뛰기');
  check('D', '04 데모 건너뛰기: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mSkip.scrollW <= mSkip.innerW && mSkip.over.length === 0 && mSkip.minFont >= 12 && mSkip.small.length === 0, `넘침 ${mSkip.over.length} · 최소 글자 ${mSkip.minFont} · 작은 터치 ${mSkip.small.join(',') || '없음'}`);

  await b.clickText('설문 완료 · 정상 응답');
  const on06 = await b.waitFor(`location.pathname === '/analysis' && document.body.innerText.includes(${JSON.stringify(ANALYSIS.title)})`);
  check('A', '[설문 완료 · 정상 응답] → 06 AI 정리 중(/analysis)으로 간다', on06, `경로 ${await path0()}`);
  const t06 = await text();
  check('A', '06: 상단 바 "AI 정리 중" · 제목 · 부제(1분쯤 걸려요) · AI 이용 고지가 카피.md 그대로 보인다',
    [ANALYSIS.headerTitle, ANALYSIS.title, ANALYSIS.subtitle, ANALYSIS.aiNotice].every((s) => t06.includes(s)), '');
  check('A', '06: 단계 글 정리 → 성향 파악 → 중요도 제안이 보이고 ‹ 는 없다', ANALYSIS.steps.every((s) => t06.includes(s)) && !(await b.evaluate(`!!window.__q('analysis-header-back')`)), '');
  check('A', '06: 진행바가 있고 오래 걸림 안내 · 다시 시도는 없다', (await b.evaluate(`!!window.__q('analysis-progress')`)) && !t06.includes(ANALYSIS.slow) && !t06.includes(ANALYSIS.retry), '');
  check('A', '06: 등급 · 점수 말이 없다', await noScore(), '');
  const m06 = await measure('06 처리 중');
  check('D', '06 처리 중: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m06.scrollW <= m06.innerW && m06.over.length === 0 && m06.minFont >= 12 && m06.small.length === 0, `넘침 ${m06.over.length} · 최소 글자 ${m06.minFont} · 작은 터치 ${m06.small.join(',') || '없음'}`);
  await note('F3_06_처리중_360x740.png');

  const on07 = await b.waitFor(`location.pathname === '/traits' && document.body.innerText.includes(${JSON.stringify(TRAITS.title)})`, 20000);
  check('A', '정리가 끝나면(약 4초, 3초 간격으로 읽음) 자동으로 07 내 성향(/traits)으로 간다', on07, `경로 ${await path0()}`);

  // 07 보기
  const t07 = await text();
  check('A', '07: 제목 · 부제 · 막대 아래 안내 · 소제목 · 요약 제목 · 두 버튼이 카피.md 그대로 보인다',
    [TRAITS.title, TRAITS.subtitle, TRAITS.axisNote, TRAITS.tagsTitle, TRAITS.summaryTitle, TRAITS.edit, TRAITS.confirm].every((s) => t07.includes(s)), '');
  const values = {};
  for (const key of AXIS_ORDER) values[key] = await bar(key);
  check('A', '07: 막대 5개의 이름과 숫자가 AI 결과(스키마 traits) 그대로다', AXIS_ORDER.every((k) => t07.includes(AXIS_NAMES[k]) && values[k] === WANT.traits[k]), JSON.stringify(values));
  const barWidths = await b.evaluate(`['extraversion','planning','family','economy','conflict'].map((k) => { const row = window.__q('trait-bar-' + k); const track = row.children[1]; const fill = track && track.children[0]; return fill ? Math.round(fill.getBoundingClientRect().width / track.getBoundingClientRect().width * 100) : -1; })`);
  check('A', '07: 막대 길이가 값(0~100)에 비례한다', barWidths.every((w, i) => Math.abs(w - WANT.traits[AXIS_ORDER[i]]) <= 2), barWidths.join(','));
  check('A', '07: 태그 5개가 # 을 붙여 그대로 보인다', WANT.tags.length === 5 && WANT.tags.every((t) => t07.includes(`#${t}`)), WANT.tags.join(' · '));
  check('A', '07: 요약 세 문장이 그대로 보인다', t07.includes(WANT.summary), '');
  check('A', '07: 등급 · 점수 말이 없다', await noScore(), '');
  const m07 = await measure('07 보기');
  check('D', '07 보기: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m07.scrollW <= m07.innerW && m07.over.length === 0 && m07.minFont >= 12 && m07.small.length === 0, `넘침 ${m07.over.length}(${m07.over.slice(0, 2).join(',')}) · 최소 글자 ${m07.minFont} · 작은 터치 ${m07.small.join(',') || '없음'}`);
  await note('F3_07_내성향_보기_360x740.png');

  // 근거 접기/펼치기
  check('A', '07: 근거 문항은 처음에 접혀 있다', !(await b.evaluate(`!!window.__q('evidence-list')`)) && (await has(TRAITS.evidenceShow)), '');
  await b.click(sel('evidence-toggle'));
  const evText = await text();
  check('A', '07: 눌러서 펼치면 5축마다 근거 문항의 질문 글이 보인다(답은 없다)',
    (await b.evaluate(`!!window.__q('evidence-list')`)) && WANT.evidence.extraversion.every((id) => evText.includes(EVIDENCE_LABELS[id])) && evText.includes(TRAITS.evidenceHide), `외향성 근거 ${WANT.evidence.extraversion.join(',')}`);
  const mEv = await measure('07 근거 펼침');
  check('D', '07 근거 펼침: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mEv.scrollW <= mEv.innerW && mEv.over.length === 0 && mEv.minFont >= 12 && mEv.small.length === 0, `넘침 ${mEv.over.length} · 최소 글자 ${mEv.minFont} · 작은 터치 ${mEv.small.join(',') || '없음'}`);
  await b.evaluate(`(() => { const el = window.__q('screen-07'); el.scrollTop = el.scrollHeight; })()`);
  await sleep(250);
  await note('F3_07_근거_펼침_360x740.png');
  await b.click(sel('evidence-toggle'));
  check('A', '07: 다시 누르면 접힌다', !(await b.evaluate(`!!window.__q('evidence-list')`)), '');
  await b.evaluate(`(() => { const el = window.__q('screen-07'); el.scrollTop = 0; })()`);

  // 수정 상태
  await b.click(sel('traits-edit'));
  check('A', '07: [수정하기] → 수정 상태: 버튼이 [취소] [저장]이 되고 막대가 끌 수 있는 막대로 바뀐다', (await has(TRAITS.cancel)) && (await has(TRAITS.save)) && !(await has(TRAITS.edit)) && (await b.evaluate(`!!window.__q('trait-slider-extraversion')`)), '');
  const mEdit = await measure('07 수정');
  check('D', '07 수정 상태: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mEdit.scrollW <= mEdit.innerW && mEdit.over.length === 0 && mEdit.minFont >= 12 && mEdit.small.length === 0, `넘침 ${mEdit.over.length}(${mEdit.over.slice(0, 2).join(',')}) · 최소 글자 ${mEdit.minFont} · 작은 터치 ${mEdit.small.join(',') || '없음'}`);
  await note('F3_07_수정_360x740.png');

  // 막대: 가운데를 누르면 50, 끌면 따라온다
  await b.click(sel('trait-slider-extraversion'));
  const tapped = await slider('extraversion');
  check('A', '수정: 막대를 누르면 그 자리 값(가운데 → 50 안팎, 5단위)이 된다', tapped >= 45 && tapped <= 55 && tapped % 5 === 0, `값 ${tapped}`);
  const box = await b.evaluate(`window.__center(window.__q('trait-slider-planning'))`);
  const left = box.x - box.w / 2;
  await b.mouse('mouseMoved', left + box.w * 0.2, box.y);
  await b.mouse('mousePressed', left + box.w * 0.2, box.y);
  for (let i = 1; i <= 10; i += 1) {
    await b.mouse('mouseMoved', left + box.w * (0.2 + 0.06 * i), box.y);
    await sleep(30);
  }
  await b.mouse('mouseReleased', left + box.w * 0.8, box.y);
  await sleep(250);
  const dragged = await slider('planning');
  check('A', '수정: 막대를 끌어 오른쪽으로 옮기면 값이 커진다(0~100, 5단위)', dragged >= 70 && dragged <= 85 && dragged % 5 === 0, `값 ${dragged}`);

  // 칩
  await b.click(sel('tag-remove-꼼꼼함'));
  check('A', '수정: 칩 × 를 누르면 그 칩이 지워진다(5 → 4)', !(await b.evaluate(`!!window.__q('tag-remove-꼼꼼함')`)) && (await b.evaluate(`window.__q('traits-tag-count').innerText`)) === TRAITS.tagCount(4, 5), '');
  await b.click(sel('tag-add'));
  await b.type(sel('tag-input'), '가');
  await b.click(sel('tag-add-done'));
  check('A', '수정: 한 글자를 더하면 N14 "2~8자로 써 주세요."가 보이고 더해지지 않는다', (await has(TRAITS.errors.tagLength)) && (await b.evaluate(`window.__q('traits-tag-count').innerText`)) === TRAITS.tagCount(4, 5), '');
  await b.type(sel('tag-input'), '조용한 편');
  await b.click(sel('tag-add-done'));
  check('A', '수정: 이미 있는 말은 "이미 있는 말이에요."', await has(TRAITS.errors.tagDuplicate), '');
  await b.type(sel('tag-input'), '010-1234-5678');
  await b.click(sel('tag-add-done'));
  check('A', '수정: 전화번호는 "전화번호나 링크는 쓸 수 없어요."', await has(TRAITS.errors.contact), '');
  await note('F3_07_수정_칩오류_360x740.png');
  await b.type(sel('tag-input'), '유머러스');
  await b.click(sel('tag-add-done'));
  check('A', '수정: 올바른 말을 더하면 5개가 되고 더하기 버튼이 사라진다(최대 5)', (await b.evaluate(`!!window.__q('tag-remove-유머러스')`)) && (await b.evaluate(`window.__q('traits-tag-count').innerText`)) === TRAITS.tagCount(5, 5) && !(await b.evaluate(`!!window.__q('tag-add')`)), '');

  // 요약
  await b.evaluate(`(() => { const el = window.__q('summary-input'); el.scrollIntoView({ block: 'center' }); })()`);
  await b.type(sel('summary-input'), '너무 짧아요.');
  await b.click(sel('traits-save'));
  check('A', '수정: 요약이 20자보다 짧으면 저장되지 않고 "20자 이상 써 주세요."가 보인다', (await has(TRAITS.errors.summaryShort(20))) && (await has(TRAITS.save)), '');
  await note('F3_07_수정_요약오류_360x740.png');
  const NEW_SUMMARY = '계획을 세우고 지키는 편이고, 가족과 보내는 시간을 중요하게 여겨요. 돈은 함께 관리해요.';
  await b.type(sel('summary-input'), NEW_SUMMARY);

  // 취소 → 버리기
  const editedDraft = { ext: await slider('extraversion'), plan: await slider('planning') };
  await b.click(sel('traits-cancel'));
  const afterCancel = { ext: await bar('extraversion'), plan: await bar('planning') };
  check('A', '수정: [취소]를 누르면 고친 내용을 버리고 보기 상태로 돌아간다(막대 · 태그 · 요약 원래대로)',
    afterCancel.ext === WANT.traits.extraversion && afterCancel.plan === WANT.traits.planning && (await has('#꼼꼼함')) && (await has(WANT.summary)) && !(await has('#유머러스')), JSON.stringify(afterCancel));
  const peekCancel = await peek(EMAIL_A);
  check('A', '서버 쪽: 취소하면 아무것도 저장되지 않았다(user_edited 없음)', peekCancel.rows[0].edited === null, '');

  // 다시 수정해서 저장
  await b.click(sel('traits-edit'));
  await b.click(sel('trait-slider-extraversion'));
  await b.click(sel('tag-remove-꼼꼼함'));
  await b.click(sel('tag-add'));
  await b.type(sel('tag-input'), '유머러스');
  await b.click(sel('tag-add-done'));
  await b.type(sel('summary-input'), NEW_SUMMARY);
  const draftExt = await slider('extraversion');
  await b.click(sel('traits-save'));
  const backToView = await b.waitFor(`!!window.__q('screen-07')`);
  check('A', '수정: [저장]을 누르면 보기 상태로 돌아가고 고친 값(막대 · 태그 · 요약)이 보인다', backToView && (await bar('extraversion')) === draftExt && (await has('#유머러스')) && !(await has('#꼼꼼함')) && (await has(NEW_SUMMARY)) && (await path0()) === '/traits', `외향성 ${draftExt}`);
  await note('F3_07_저장후_360x740.png');

  const afterSave = await peek(EMAIL_A);
  const serverRow = afterSave.rows[0];
  check('A', '서버 쪽(SQL 대용): 저장하면 user_edited 에 수정본(traits · tags · 요약)이 들어갔다', serverRow.edited && serverRow.edited.traits.extraversion === draftExt && serverRow.edited.tags.includes('유머러스') && serverRow.edited.summary === NEW_SUMMARY, JSON.stringify(serverRow.edited?.traits));
  check('A', '서버 쪽: AI 원본(result)은 그대로다 — 5축 · 태그 · 요약 · 근거가 처음 값과 같다(덮어쓰기 없음)',
    JSON.stringify(serverRow.original.traits) === JSON.stringify(WANT.traits) && JSON.stringify(serverRow.original.tags) === JSON.stringify(WANT.tags) && serverRow.original.summary === WANT.summary && JSON.stringify(serverRow.original.evidence) === JSON.stringify(WANT.evidence), '');
  check('A', '서버 쪽: 저장은 확정이 아니다(confirmed false · 계정 정상 아님)', serverRow.confirmed === false && afterSave.active === false, '');

  // 확정
  await b.click(sel('traits-confirm'));
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  const on08 = await b.waitFor(`location.pathname === '/profile'`);
  check('A', '[이대로 확정] → 08 내 프로필(/profile)로 간다', on08, `경로 ${await path0()}`);
  const afterConfirm = await peek(EMAIL_A);
  check('A', '서버 쪽: 확정되었고(confirmed · 계정 정상) 수정본과 원본이 둘 다 남아 있다',
    afterConfirm.rows[0].confirmed === true && afterConfirm.active === true && afterConfirm.rows[0].edited?.summary === NEW_SUMMARY && afterConfirm.rows[0].original.summary === WANT.summary, '');

  // ═══ B. 실패 응답 ═══
  const EMAIL_B = 'broken@email.com';
  check('B', '새 흐름: 02 → 03 → 04-01 까지 간다', await toSurvey(EMAIL_B), `경로 ${await path0()}`);
  await b.clickText('설문 완료 · 실패 응답');
  const failed1 = await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ANALYSIS.failTitle)})`, 20000);
  check('B', '06: 처리가 실패하면(약 4초) 오류 상태가 된다 — 제목 · 본문 · [다시 시도]가 카피.md 그대로', failed1 && (await has(ANALYSIS.failBody)) && (await has(ANALYSIS.retry)), '');
  check('B', '06: 1번째 실패에는 [직접 입력하기]가 없다', !(await has(ANALYSIS.manual)), '');
  check('B', '06: 오류 상태에는 도는 원 · 제목 "답변을 정리하고 있어요"가 없다', !(await has(ANALYSIS.title)), '');
  const mFail = await measure('06 실패');
  check('D', '06 실패: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mFail.scrollW <= mFail.innerW && mFail.over.length === 0 && mFail.minFont >= 12 && mFail.small.length === 0, `넘침 ${mFail.over.length} · 최소 글자 ${mFail.minFont} · 작은 터치 ${mFail.small.join(',') || '없음'}`);
  await note('F3_06_실패_360x740.png');

  await b.click(sel('analysis-retry'));
  check('B', '[다시 시도]를 누르면 바로 처리 중 화면으로 돌아간다', await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ANALYSIS.title)})`, 5000), '');
  const failed2 = await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ANALYSIS.failTitle)})`, 20000);
  check('B', '다시 시도도 실패하면 오류 상태로 돌아온다(2번째 실패 — 아직 직접 입력 없음)', failed2 && !(await has(ANALYSIS.manual)) && (await has(ANALYSIS.retry)), '');
  await sleep(3200); // 다시 시도 3초 잠금
  await b.click(sel('analysis-retry'));
  const failed3 = await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ANALYSIS.manual)}) && document.body.innerText.includes(${JSON.stringify(ANALYSIS.failTitle)})`, 20000);
  check('B', '3번째 실패부터 [직접 입력하기]와 안내 "정리가 계속 되지 않아요…"가 더해지고 [다시 시도]도 남는다', failed3 && (await has(ANALYSIS.manualNote)) && (await has(ANALYSIS.retry)), '');
  const m3 = await measure('06 실패 3번째');
  check('D', '06 실패 3번째: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', m3.scrollW <= m3.innerW && m3.over.length === 0 && m3.minFont >= 12 && m3.small.length === 0, `넘침 ${m3.over.length} · 최소 글자 ${m3.minFont} · 작은 터치 ${m3.small.join(',') || '없음'}`);
  await note('F3_06_실패_직접입력_360x740.png');

  await b.click(sel('analysis-manual'));
  const onManual = await b.waitFor(`location.pathname === '/traits' && !!window.__q('screen-07-manual')`);
  check('B', '[직접 입력하기] → 07 직접 입력 상태(/traits)', onManual, `경로 ${await path0()}`);
  const initial = {};
  for (const key of AXIS_ORDER) initial[key] = await slider(key);
  check('B', '07 직접 입력: 막대 5개는 서버가 준 처음값으로 시작한다(모의: 30 · 70 · 80 · 60 · 70)', initial.extraversion === 30 && initial.planning === 70 && initial.family === 80 && initial.economy === 60 && initial.conflict === 70, JSON.stringify(initial));
  check('B', '07 직접 입력: 제목 · 안내가 보이고 근거 보기는 없다', (await has(TRAITS.manualTitle)) && (await has(TRAITS.manualTagsHint)) && !(await b.evaluate(`!!window.__q('evidence-toggle')`)), '');
  const mManual = await measure('07 직접 입력');
  check('D', '07 직접 입력: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mManual.scrollW <= mManual.innerW && mManual.over.length === 0 && mManual.minFont >= 12 && mManual.small.length === 0, `넘침 ${mManual.over.length}(${mManual.over.slice(0, 2).join(',')}) · 최소 글자 ${mManual.minFont} · 작은 터치 ${mManual.small.join(',') || '없음'}`);
  await note('F3_07_직접입력_360x740.png');

  await b.click(sel('traits-confirm'));
  check('B', '칩을 하나도 안 골랐으면 [이대로 확정]이 "나를 나타내는 말을 1개 이상 골라 주세요."를 보이고 머문다', (await has(TRAITS.manualTagMin)) && (await path0()) === '/traits', '');
  const tags = ['활발함', '차분함', '조용한 편', '계획적', '꼼꼼함', '즉흥적'];
  for (const t of tags) await b.click(sel(`tag-pick-${t}`));
  const picked = await b.evaluate(`[...document.querySelectorAll('[data-testid^="tag-pick-"]')].filter((el) => el.getAttribute('aria-selected') === 'true').map((el) => el.getAttribute('aria-label'))`);
  check('B', '칩은 후보에서 최대 5개까지만 골라진다(6번째는 무시)', picked.length === 5 && !picked.includes('즉흥적'), picked.join(','));
  await b.click(sel('trait-slider-extraversion'));
  const manualExt = await slider('extraversion');
  await note('F3_07_직접입력_칩선택_360x740.png');
  await b.click(sel('traits-confirm'));
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  const on08b = await b.waitFor(`location.pathname === '/profile'`);
  check('B', '요약을 비운 채 [이대로 확정] → 08 로 간다', on08b, `경로 ${await path0()}`);
  const manualServer = (await peek(EMAIL_B)).rows[0];
  check('B', '서버 쪽: 직접 입력은 source=manual · 원본 없음 · user_edited 에 5축 · 태그 5개 · 빈 요약이 저장되고 확정되었다',
    manualServer.source === 'manual' && manualServer.original === null && manualServer.edited.traits.extraversion === manualExt && manualServer.edited.tags.length === 5 && manualServer.edited.summary === '' && manualServer.confirmed === true, JSON.stringify(manualServer.edited?.tags));

  // ═══ C. 지연 응답 ═══
  const EMAIL_C = 'slow@email.com';
  check('C', '새 흐름: 02 → 03 → 04-01 까지 간다', await toSurvey(EMAIL_C), `경로 ${await path0()}`);
  await b.clickText('설문 완료 · 지연 응답');
  await b.waitFor(`location.pathname === '/analysis' && document.body.innerText.includes(${JSON.stringify(ANALYSIS.title)})`);
  const t0 = Date.now();
  await sleep(30_000);
  check('C', '30초가 지나도 안내가 없고 처리 중 화면이다', !(await has(ANALYSIS.slow)) && (await has(ANALYSIS.title)), '');
  await sleep(Math.max(0, 57_000 - (Date.now() - t0)));
  check('C', '57초: 아직 오래 걸림 안내가 없다', !(await has(ANALYSIS.slow)), '');
  const sawSlow = await b.waitFor(`document.body.innerText.includes(${JSON.stringify(ANALYSIS.slow)})`, 8000);
  const slowAt = Math.round((Date.now() - t0) / 1000);
  check('C', '60초가 넘으면 "평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요."가 나온다(처리 중 화면은 그대로)', sawSlow && slowAt >= 59 && slowAt <= 70 && (await has(ANALYSIS.title)), `${slowAt}초에 나타남`);
  const mSlow = await measure('06 지연');
  check('D', '06 지연: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상', mSlow.scrollW <= mSlow.innerW && mSlow.over.length === 0 && mSlow.minFont >= 12 && mSlow.small.length === 0, `넘침 ${mSlow.over.length} · 최소 글자 ${mSlow.minFont} · 작은 터치 ${mSlow.small.join(',') || '없음'}`);
  await note('F3_06_지연_60초넘음_360x740.png');
  const slowDone = await b.waitFor(`location.pathname === '/traits' && document.body.innerText.includes(${JSON.stringify(TRAITS.title)})`, 40_000);
  check('C', '지연 응답도 끝나면(75초) 07 로 간다', slowDone, `경로 ${await path0()} · ${Math.round((Date.now() - t0) / 1000)}초`);

  // ═══ E. 07 확정 실패 4종 확인창(D8 3차 M4 · M5: 제목 20 Bold · 버튼 세로, 주 버튼 위) ═══
  const EMAIL_E = 'cfcycle@email.com'; // 모의 서버가 확정을 동의 → 설문 → 사진 → 그 밖 순서로 거절한다
  check('E', '새 흐름: 02 → 03 → 04-01 까지 간다', await toSurvey(EMAIL_E), `경로 ${await path0()}`);
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000);
  for (const [kind, label] of [['consent_missing', '동의'], ['survey_incomplete', '설문'], ['photos_incomplete', '사진'], ['other', '기타']]) {
    const want = TRAITS.confirmErrors[kind];
    await b.click(sel('traits-confirm'));
    const open = await b.waitFor(`!!window.__q('traits-confirm-fail-confirm')`);
    const geo = await b.evaluate(`(() => { const t = window.__q('traits-confirm-fail-title'); const c = window.__q('traits-confirm-fail-confirm').getBoundingClientRect(); const x = window.__q('traits-confirm-fail-cancel').getBoundingClientRect(); return { title: t.innerText.trim(), body: window.__q('traits-confirm-fail-body').innerText.trim(), size: parseFloat(getComputedStyle(t).fontSize), weight: getComputedStyle(t).fontWeight + ' ' + getComputedStyle(t).fontFamily, vertical: c.bottom <= x.top, sameWidth: Math.abs(c.width - x.width) < 1 }; })()`);
    check('E', `확정 실패 · ${label}: 제목 · 본문 · [${want.go}] [${want.cancel}] 카피 그대로, 제목 20 Bold, 버튼 세로(주 버튼 위)`,
      open && geo.title === want.title && geo.body === want.body && geo.size === 20 && /Bold/.test(geo.weight) && geo.vertical && geo.sameWidth && (await has(want.go)), `${geo.size}px ${geo.weight} · 세로 ${geo.vertical}`);
    await measure(`07 확정 실패 · ${label}`);
    await note(`F3_07_확정실패_${label}_360x740.png`);
    await b.click(sel('traits-confirm-fail-cancel'));
    await b.waitFor(`!window.__q('traits-confirm-fail-confirm')`);
  }
  await b.click(sel('traits-confirm'));
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  check('E', '다섯 번째 [이대로 확정] → 08', await b.waitFor(`location.pathname === '/profile'`), `경로 ${await path0()}`);

  // ═══ D. 마무리 ═══
  const overAll = measured.filter((m) => m.scrollW > m.innerW || m.over.length > 0).map((m) => m.label);
  const tinyAll = measured.filter((m) => m.minFont < 12).map((m) => `${m.label}(${m.minFont}px)`);
  const smallAll = measured.filter((m) => m.small.length > 0).map((m) => `${m.label}: ${m.small.join(',')}`);
  check('D', `점검한 화면 모양 ${measured.length}곳에서 가로 넘침 0`, overAll.length === 0, overAll.join(', '));
  check('D', '글자 크기가 모두 12 이상', tinyAll.length === 0, tinyAll.join(', '));
  check('D', '누르는 요소(버튼 · 칩 · 링크)가 모두 44 × 44 이상', smallAll.length === 0, smallAll.join(' | '));
  const storage = await b.evaluate('localStorage.length + sessionStorage.length');
  check('D', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다', storage === 0, `항목 ${storage}개`);
  check('D', '콘솔 오류 · 예외 0', b.errors.length === 0, b.errors.slice(0, 3).join(' | '));
  const reqs = [...b.requests.values()];
  const outside = reqs.filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  const failedReq = reqs.filter((r) => r.failed || (r.status && r.status >= 400));
  check('D', '바깥 주소(서버 · Claude 포함)로 나간 요청 0 · 실패한 요청 0', outside.length === 0 && failedReq.length === 0, `바깥 ${outside.length}(${outside.slice(0, 2).map((r) => r.url).join(',')}) · 실패 ${failedReq.length}`);
} catch (error) {
  exitCode = 1;
  results.push({ group: 'E', title: '점검 도중 오류', ok: false }); // 3부-사(T2): 예외도 실패 수에 넣는다('실패 0' 오해 방지)
  console.log(`[실패] 점검 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  b.close();
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\nF3 화면 점검: 통과 ${results.length - failedCount} · 실패 ${failedCount}`);
void COMMON;
process.exitCode = exitCode || (failedCount > 0 ? 1 : 0);
