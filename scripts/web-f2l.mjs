// 임시(F2L) — AYLA'S 설문으로 교체 예정
// F2L 화면 점검(04 설문 · 05 사진 등록). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  F20(팀장 결정 D-123): 스위치 survey_v2 가 켜지면(데모 처음값) 04 는 정식 설문 v2 다. 이 점검은 새 흐름(v2 → 05)을 따라간다.
//   A. 02 → 03 → 04: /survey/01(데모 = 대화형 V6-F) → 로그인 그대로 /survey/v2 = 정식 설문 v2 시작 안내(D-186)
//   B. v2 필수 흐름을 끝까지(scripts/lib/surveyV2Driver) → 검토 → [제출하고 사진 올리기] → 05 · 모의 서버에 첫 빈 문항 없음
//   C. 05: 사진 3칸(데모 예시 그림) → '확인 중' 행 3 · 스타일(여러 개) · 안내 박스 5줄 · 내부 평가 고지
//   D. [올리고 설문 마치기](05 가 v2 진행을 본다) → ai-profile start → 06 → 07(모의 정상 4초)
//   E. 저장 실패 장면(v2savefail): [다음]이 머물고 "저장하지 못했어요. 다시 시도해 주세요."
//   (스위치 꺼짐 = 임시 설문 길은 데모 모의 서버가 get_feature_flags 를 아직 내지 않아 웹에서 고를 수 없다 → jest surveyV2Photos · surveyLiteScreen 이 본다)
//   H. 어느 화면이든: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 등급 · 점수 말 0(05) · 콘솔 오류 0 · 바깥 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f2l.mjs [번들 폴더]   (npm run check:f2l. 스크린샷은 확인/스크린샷/F2L_*)
// 종료 코드: 0 통과 · 1 실패 · 2 번들 · 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findBrowser, openBrowser } from './lib/browser.mjs';
import { fillSurveyV2 } from './lib/surveyV2Driver.mjs';
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

process.removeAllListeners('warning');
const load = (file) => import(pathToFileURL(file).href);
const { PHOTOS_LITE } = await load(path.join(APP_DIR, 'src', 'content', 'surveyLiteCopy.ts'));

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const path0 = () => b.evaluate('location.pathname + location.search');
const peek = () => b.evaluate('JSON.stringify(window.__surveyLitePeek ? window.__surveyLitePeek() : null)').then(JSON.parse);
const noScore = async () => !/등급|점수|순위표|퍼센트/.test(await text());

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('H', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04(스위치 켜짐 = 정식 설문 v2, 꺼짐 = 임시 설문). 04 가 뜨지 않으면 false
async function toSurvey(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // F17: 스플래시가 걷힌 뒤 누른다
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
  await b.waitFor(`location.pathname.startsWith('/survey/')`);
  // V6-F(D-186): 데모는 대화형 설문(survey_chat)이 켜져 /survey/01 이 대화형이다. 이 점검은 v2 화면을 보므로 로그인을 지닌 채 /survey/v2 로 옮긴다
  if (await b.waitFor(`!!window.__q('chat-screen')`, 5000)) {
    await b.evaluate(`(() => { history.pushState(null, '', '/survey/v2'); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
    await b.waitFor(`location.pathname === '/survey/v2'`, 5000);
  }
  return b.waitFor(`!!window.__q('v2-intro') || !!window.__q('v2-block-A12') || !!window.__q('surveylite-question')`, 10000);
}
const v2peek = () => b.evaluate('JSON.stringify(window.__surveyV2Peek ? window.__surveyV2Peek() : null)').then(JSON.parse);


try {
  // ═══ A · B. 04 = 정식 설문 v2(스위치 survey_v2 데모 켜짐) ═══
  await toSurvey('f2l@email.com');
  check('A', '/survey/v2 = 정식 설문 v2 시작 안내(04 /survey/01 은 대화형 V6-F — D-186)', (await b.evaluate(`location.pathname`)) === '/survey/v2' && (await q('v2-intro')), await path0());
  await measure('04 v2 시작 안내');
  await note('F2L_04_v2시작_360x740.png');
  const walk = await fillSurveyV2(b);
  check('B', 'v2 필수 흐름을 끝까지 답하고 결혼 이야기 · 세부사항은 건너뛰어 검토 화면', walk.ok, `답한 문항 ${walk.answered} · ${walk.stage}`);
  const v2 = (await v2peek())?.find((u) => u.answered.length > 0);
  check('B', '모의 서버(v2)에 첫 빈 문항 없음 · 학교 키 · 생년월일은 다시 묻지 않음', v2?.firstMissing === null && v2?.answers?.B02?.school_key === 'K0138' && !('A01' in (v2?.answers ?? {})), `${v2?.firstMissing} · ${v2?.answered?.length}`);
  await measure('04 v2 검토');
  await note('F2L_04_v2검토_360x740.png');
  await b.click(sel('v2-submit'));
  check('B', '[제출하고 사진 올리기] → 05 사진 등록', await b.waitFor(`location.pathname === '/photos' && !!window.__q('photoslite-title')`, 8000), await path0());

  // ═══ C. 05 ═══
  let t = await text();
  check('C', '05 제목 · 부제 · 안내 박스 5줄 · 내부 평가 고지 · 스타일', [PHOTOS_LITE.title, PHOTOS_LITE.subtitle, ...PHOTOS_LITE.guideLines, PHOTOS_LITE.internalNote, PHOTOS_LITE.styleLabel].every((s) => t.includes(s.replace(/\s+/g, ' '))), '');
  await measure('05 사진 등록(빈 칸)');
  await note('F2L_05_빈칸_360x740.png');
  await b.click(sel('photoslite-finish'));
  // 05 는 먼저 설문(v2) 빈 문항을 모의 서버에 물어본 뒤 사진 수를 본다(F20 · D-123) → 문구가 뜰 때까지 기다린다
  await b.waitFor(`(window.__q('photoslite-message')?.innerText ?? '').trim() === ${JSON.stringify(PHOTOS_LITE.needThree)}`, 6000);
  check('C', '사진 없이 [올리고 설문 마치기] → (설문 v2 는 다 찼으므로) "사진 3장을 모두 올려야 설문을 마칠 수 있어요."', (await inner('photoslite-message')) === PHOTOS_LITE.needThree && (await path0()) === '/photos', await inner('photoslite-message'));
  for (const slot of ['face', 'full', 'free']) {
    await b.click(sel(`photoslite-slot-${slot}`));
    await b.waitFor(`!!window.__q('photoslite-done-${slot}')`, 5000);
  }
  const photos = (await peek())?.[0]?.photos ?? [];
  check('C', "칸 3개 모두 예시 그림이 올라가 '확인 중'(pending) 행 3", photos.length === 3 && photos.every((p) => p.status === 'pending'), JSON.stringify(photos));
  await b.click(sel('lite-G03-opt-0'));
  await measure('05 사진 3장');
  await note('F2L_05_사진3장_360x740.png');
  check('H', '05 에 등급 · 점수 말이 없다', await noScore(), '');

  // ═══ D. 마치기 → start → 06 → 07 ═══
  await b.click(sel('photoslite-finish'));
  check('D', '[올리고 설문 마치기] → 06 AI 정리 중', await b.waitFor(`location.pathname === '/analysis'`, 8000), await path0());
  check('D', '설문 제출 표시 · 스타일 저장(단정)', (await peek())?.[0]?.submitted === true && JSON.stringify((await peek())?.[0]?.answers?.G03) === '["단정"]', '');
  check('D', '모의 AI 처리가 끝나면 07 내 성향', await b.waitFor(`location.pathname === '/traits'`, 25000), await path0());

  // ═══ E. 저장 실패 장면(v2) ═══
  check('E', '새 흐름(v2savefail)으로 04 까지 간다', await toSurvey('v2savefail@email.com'), '');
  await b.click(sel('v2-start'));
  await b.type(sel('v2-A12-input'), '김하나');
  await b.click(sel('v2-next'));
  check('E', '저장 실패 → 머물고 "저장하지 못했어요. 다시 시도해 주세요."', (await b.waitFor(`!!window.__q('v2-save-error')`, 5000)) && (await inner('v2-question')) === '이름을 알려 주세요' && (await inner('v2-save-error')) === '저장하지 못했어요. 다시 시도해 주세요.', await inner('v2-save-error'));
  await note('F2L_04_저장실패_360x740.png');

  // ═══ H. 공통 ═══
  const bad = b.errors.filter((e) => !/Failed to load resource/.test(e));
  check('H', '콘솔 오류 · 예외 0', bad.length === 0, bad.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('H', '바깥 주소로 나간 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
  const storage = await b.evaluate(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
  check('H', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다', storage === '{"local":[],"session":[]}', storage);
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF2L 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
