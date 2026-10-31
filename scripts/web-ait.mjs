// AIT-F 웹 점검(12 설정 › 시험용 AI 코드 칸). 무료 · 네트워크 없음(로컬 서버, 정적 데모 번들 dist-demo — /api/ai 서버 함수는 이 번들에 없다).
//  먼저 `npm run check:web:demo` 로 데모 번들을 만든 뒤 쓴다. 헤드리스 Edge 로 사람이 하는 순서대로 누르며 잰다: 가입 → 09 → 탭 "설정" → [시험용 AI 코드].
//   A. 12 목록에 줄이 있고(데모 판) 열면 쪽 글이 카피 23-6 그대로 · 입력 칸이 글자를 가린다(password) · 처음엔 [코드 넣기] 잠김
//   B. 코드 넣기 → '코드가 들어 있어요' · 입력 칸 비움 · 화면 글 어디에도 코드 값 0 · 브라우저 저장소(localStorage · sessionStorage) 비어 있음 · /api/ai 요청 0 · 바깥 요청 0
//   D. 탑승권 홈 B6 셋째 칸 [연애 고민 정리] → 시트 첫 화면 · 입력 화면 · 코드 없이 보내면 안내 + 요청 0
//   C. 코드 지우기 → '코드가 없어요' · 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0
// 사용: node scripts/web-ait.mjs [번들 폴더]   스크린샷은 확인/스크린샷/AIT_* 에 저장
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
const AIT = (await load(path.join(APP_DIR, 'src', 'content', 'aitCopy.ts'))).AIT_TEXT;
// 시험 코드는 실행 때 만든다(소스에 완성된 꼴 0)
const CODE = ['ait', 'abcd', 'efgh', 'jkmn', 'pqrs'].join('-');

const b = await openBrowser({ distDir, shotDir, width: Number(process.env.SHOT_WIDTH ?? 360), height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('C', `${label}: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.length}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → 08 → 09 (web-f7 와 같은 길)
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.type(sel('signin-email'), email.replace('@', 'v4on@'));
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
  await b.traitsNext();
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error'))`, 10000);
}

try {
  const ok = await toRecs('aitweb@email.com');
  await b.click('[aria-label="설정"]');
  check('A', '09 → 탭 "설정" → 12 목록', ok && (await b.waitFor(`location.pathname === '/settings' && !!window.__q('settings-rows')`)), '');
  check('A', '데모 판 12 목록에 [시험용 AI 코드] 줄이 있다', await q('settings-row-ait-code'), '');
  await b.click(sel('settings-row-ait-code'));
  check('A', '줄을 누르면 쪽이 열린다', await b.waitFor(`!!window.__q('settings-ait')`), '');
  check('A', '시험판 알약 · 시험 안내 · 쪽 안내 · 코드 없음 · 저장 안내 글이 카피 23장 그대로', (await inner('settings-ait-head-note')) === AIT['AIT.testNote'] && (await inner('settings-ait-lead')) === AIT['AIT_SET.lead'] && (await inner('settings-ait-status')) === AIT['AIT_SET.status.off'] && (await inner('settings-ait-check')) === AIT['AIT_SET.check'] && (await inner('settings-ait-share')) === AIT['AIT_SET.share'] && (await inner('settings-ait-noeffect')) === AIT['AIT_SET.noEffect'], '');
  check('A', '웹에서는 새로 고치면 코드를 다시 넣어야 한다는 글(AIT_SET.web)이 보이고 기기 보관 글은 없다', (await inner('settings-ait-store')) === AIT['AIT_SET.web'] && !(await has(AIT['AIT_SET.native'])), '');
  check('A', '입력 칸이 글자를 가린다(type=password) · 자동완성 끔', await b.evaluate(`(() => { const el = window.__q('settings-ait-input'); const i = el && (el.tagName === 'INPUT' ? el : el.querySelector('input')); return !!i && i.type === 'password' && i.autocomplete === 'off'; })()`), '');
  check('A', '글이 비어 있으면 [코드 넣기]는 잠겨 있다', await b.evaluate(`(() => { const el = window.__q('settings-ait-save'); return !!el && (el.getAttribute('aria-disabled') === 'true' || el.disabled === true); })()`), '');
  await note('AIT_코드칸_빈_360x740.png');
  await measure('코드 칸(빈)');

  await b.type(sel('settings-ait-input'), CODE);
  await b.click(sel('settings-ait-save'));
  check('B', '코드 넣기 → "코드가 들어 있어요" · 토스트 "코드를 넣었어요."', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(AIT['AIT_SET.status.on'])})`)) && (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(AIT['AIT_SET.saved'])})`)), '');
  const shown = await b.evaluate(`(() => { const el = window.__q('settings-ait-input'); const i = el && (el.tagName === 'INPUT' ? el : el.querySelector('input')); return i ? i.value : null; })()`);
  check('B', '입력 칸은 비워진다 · 화면 글 어디에도 코드 값이 없다', shown === '' && !(await has(CODE)), `칸 값 길이 ${String(shown).length}`);
  const storage = await b.evaluate(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookie: document.cookie })`);
  check('B', '브라우저 저장소(localStorage · sessionStorage) · 쿠키가 비어 있다(웹은 메모리만)', storage === '{"local":[],"session":[],"cookie":""}', storage);
  const apiReq = [...b.requests.values()].filter((r) => r.url.includes('/api/ai'));
  check('B', '코드를 넣어도 /api/ai 요청 0(저장할 때 서버를 부르지 않는다)', apiReq.length === 0, `요청 ${apiReq.length}`);
  await note('AIT_코드칸_들어감_360x740.png');
  await measure('코드 칸(들어 있음)');

  await b.click(sel('settings-ait-clear'));
  check('C', '코드 지우기 → "코드가 없어요" · 토스트 "코드를 지웠어요."', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(AIT['AIT_SET.status.off'])})`)) && (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(AIT['AIT_SET.cleared'])})`)), '');

  // ═══ D. 홈 B6 셋째 칸 [연애 고민 정리] — 코드 없이 열고 보내 봐도 서버 요청 0 ═══
  await b.click('[aria-label="탑승권"]');
  check('D', '탭 "탑승권" → 홈 B6 에 [연애 고민 정리] 셋째 칸', await b.waitFor(`!!window.__q('home-B6-concern')`, 15000), '');
  await b.click(sel('home-B6-concern'));
  check('D', '칸을 누르면 시트(첫 화면): 상담 아님 · 캡처해 보내지 말기 · 끝줄 · 상시 번호 줄이 카피 그대로', (await b.waitFor(`!!window.__q('concern-intro')`)) && (await inner('concern-not-counsel')) === AIT['CONCERN.intro.notCounsel'] && (await inner('concern-no-send')) === AIT['CONCERN.intro.noSend'] && (await inner('concern-footer')) === AIT['CONCERN.footer'] && (await inner('concern-always')) === AIT['CONCERN.always'], '');
  await note('AIT_고민정리_첫화면_360x740.png');
  await measure('고민 정리 첫 화면');
  await b.click(sel('concern-start'));
  check('D', '[이야기 시작하기] → 입력 화면(안내 셋 · 칸 둘 + 호칭 칸 · 첫 질문)', (await b.waitFor(`!!window.__q('concern-mine')`)) && (await inner('concern-opening')) === AIT['CONCERN.opening'] && (await inner('concern-notice-name')) === AIT['CONCERN.notice.name'] && (await q('concern-partner')) && (await q('concern-alias')), '');
  await note('AIT_고민정리_입력_360x740.png');
  await measure('고민 정리 입력 화면');
  await b.type(sel('concern-mine'), '요즘 상대의 답이 늦어져서 마음이 쓰여요');
  await b.click(sel('concern-send'));
  check('D', '코드 없이 [보내기] → 코드를 넣으라는 안내(AIT.noCode.concern) · /api/ai 요청 0', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(AIT['AIT.noCode.concern'])})`)) && [...b.requests.values()].filter((r) => r.url.includes('/api/ai')).length === 0, '');
  const bad = b.errors.filter((e) => !/Failed to load resource/.test(e));
  check('C', '콘솔 오류 · 예외 0', bad.length === 0, bad.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('C', '바깥 주소로 나간 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nAIT 웹 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
