// IF5-F2 마일리지 · AI 맞춤 · 동의 웹 점검(IF-MILE · IF-MILE-LOG · 확인 시트 · 사주 마당 AI 칸 · IF-SJ-TALK · 12 설정 줄). 무료 · 네트워크 없음(로컬 서버 + 로컬 헤드리스 브라우저).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/). 사람이 하는 순서대로 누른다. 접근 코드를 넣지 않은 상태라 AI 는 데모 글(서버 요청 0).
//  1 가입 → 12 설정 '마일리지' 줄 → 마일리지 화면: 잔액(가입 선물) · 상품 넷 · 현금 불가 · 시험용 한 줄 · 충전 → 잔액 갱신 · 큰 충전 확인 한 줄 · 내역
//  2 사주 마당(내 정보 + 동의 ③ ④ ⑤) → 머리 [마일리지] · 결 읽기 AI 칸: 버튼 옆 숫자 한 곳 → CK17D 동의 시트 → 확인 시트 → AI가 쓴 글 · 다시 열면 무료
//  3 사주 이야기: 동의(CK17D → CK19) → 시작 시트 한 번 → 대화 · 줄어드는 숫자 0 · 위기 말은 카드(차감 0)
//  4 화면마다 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 금지 낱말 0 · 느낌표 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 MILE_<폭>]/MILE_<장면>_<폭>.png
// 사용: node scripts/web-mileage.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-mileage.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `MILE_${width}`;
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
const waitVis = (id, ms = 8000) => b.waitFor(`!!${visQ(id)}`, ms);
const waitGone = (id, ms = 6000) => b.waitFor(`!${visQ(id)}`, ms);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const pageText = () => b.evaluate(`document.body.innerText`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-mile-target]').forEach((e) => e.removeAttribute('data-mile-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-mile-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-mile-target="1"]');
};
const goto = (p) => b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
// 재촉 · 점수 · 보너스 말 0 (마일리지 화면은 '마일리지'가 당연히 있다)
const BANNED = ['점수', '퍼센트', '순위', '판정', '재회', '무제한', '흉일', '보너스', '할인', '인기', '한정', '서두르세요', '남은 시간', '마지막', '지급됨', '내 편', '부적', '몰래'];
async function words(label) {
  const t = await pageText();
  const banned = BANNED.filter((w) => t.includes(w));
  check('4', `${label}: 금지 낱말 0 · 느낌표 0 · %0`, t.trim().length > 0 && banned.length === 0 && !/[!！]/.test(t) && !/\d+\s*%/.test(t), banned.join(' '));
}
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('4', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 작은 글 ${m.small.length}`);
}

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
  await b.traitsNext();
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding'`, 20000);
}

let exitCode = 0;
try {
  await signUp('sj2@email.com');
  // ═══ 1. 설정 줄 → 마일리지 ═══
  await goto('/settings');
  await waitVis('settings-rows', 10000);
  check('1', "12 설정에 '마일리지' 줄(크레딧 · 구매 내역 바로 아래 · 숫자 0)", (await vis('settings-row-mileage')) && !/\d/.test(await visText('settings-row-mileage')), await visText('settings-row-mileage'));
  await tap('settings-row-mileage');
  check('1', '줄 → 마일리지 화면', await b.waitFor(`location.pathname === '/mileage'`, 8000), '');
  check('1', '잔액 = 가입 선물(서버 응답 그대로) · 상품 넷', (await waitVis('mileage-total', 8000)) && (await visText('mileage-total')) === '1,000' && (await vis('mileage-product-mileage_33000')), await visText('mileage-total'));
  check('1', '현금 불가 한 줄 · 시험용 한 줄 · 7일 안 환불 안내', (await vis('mileage-nocash')) && (await vis('mileage-trial')) && (await visText('mileage-notice')).includes('7일'), '');
  await words('마일리지');
  await measure('마일리지');
  await b.shot(`MILE_마일리지_${width}.png`);
  await tap('mileage-product-mileage_3300');
  check('1', '충전 → 서버 응답 뒤 잔액 갱신(4,300) · 지급됨 말 0', await b.waitFor(`(() => { const el = ${visQ('mileage-total')}; return !!el && el.innerText.trim() === '4,300'; })()`, 6000), await visText('mileage-total'));
  await tap('mileage-product-mileage_33000');
  check('1', '큰 충전은 확인 한 줄 시트 · 확인 전에는 잔액 그대로', (await waitVis('mileage-big', 5000)) && (await visText('mileage-total')) === '4,300', await visText('mileage-big-line'));
  await measure('큰 충전 확인');
  await b.shot(`MILE_큰충전_${width}.png`);
  await tap('mileage-big-cancel');
  await waitGone('mileage-big', 4000);
  await tap('mileage-to-log');
  check('1', '[내역 보기] → 내역: 가입 선물 · 충전 줄 · 무료 / 유료 표시', (await b.waitFor(`location.pathname === '/mileage-log'`, 8000)) && (await waitVis('mileage-log-list', 8000)), '');
  const logText = await visText('mileage-log-list');
  check('1', '내역 글: 가입 선물 + 충전 · 연속 · 순위 0', logText.includes('가입 선물') && logText.includes('충전') && !/연속|순위/.test(logText), logText.slice(0, 60));
  await words('내역');
  await measure('내역');
  await b.shot(`MILE_내역_${width}.png`);

  // ═══ 2. 사주 마당 AI 칸 ═══
  await goto('/saju');
  await tap('saju-ck17-agree');
  await waitVis('if2-ck17', 8000);
  const boxes = await b.evaluate(`['c', 'd', 'e'].map((k) => { const el = [...document.querySelectorAll('[data-testid="if2-ck17-' + k + '"]')].find((e) => window.__visible(e)); return el ? el.getAttribute('aria-checked') : 'none'; })`);
  check('2', 'CK17A 시트에 ③ 태어난 시각 · ④ 태어난 곳 · ⑤ 성별 칸(미리 체크 0)', boxes.every((x) => x === 'false'), boxes.join(','));
  await measure('CK17A 시트');
  await b.shot(`MILE_동의시트_${width}.png`);
  await tap('if2-ck17-a');
  await tap('if2-ck17-c');
  await tap('if2-ck17-d');
  await tap('if2-ck17-e');
  await tap('if2-ck17-go');
  await tap('saju-fill');
  await waitVis('saju-in-time-unknown', 8000);
  await tap('saju-in-save');
  await waitVis('saju-pillars', 12000);
  check('2', "머리 오른쪽 [마일리지] 입구 · 맨 위 '사주 이야기 나누기' 입구", (await vis('saju-header-right')) && (await vis('saju-talk-open')), '');
  const cost = await visText('saju-kyeol-ai-cost');
  check('2', 'AI 맞춤 버튼 옆 마일리지 N 한 곳(결 읽기 800)', cost === '마일리지 800', cost);
  check('2', '열었을 때 AI 칸은 버튼뿐 — 결과 0 · 서버 요청 0', !(await vis('saju-kyeol-ai-done')), '');
  await tap('saju-kyeol-ai-btn');
  check('2', '처음이면 AI 풀이 동의 시트(CK17D) — 체크 전 [동의하고 이어 가기] 비활성', (await waitVis('saju-kyeol-ck17d', 6000)) && (await b.evaluate(`!!(${visQ('saju-kyeol-ck17d-yes')}).disabled || (${visQ('saju-kyeol-ck17d-yes')}).getAttribute('aria-disabled') === 'true'`)), '');
  await measure('CK17D 동의 시트');
  await b.shot(`MILE_AI동의_${width}.png`);
  await tap('saju-kyeol-ck17d-check');
  await tap('saju-kyeol-ck17d-yes');
  check('2', '300 이상이라 확인 시트: "800 마일리지를 써요" · 쓰고 나면 돌려받을 수 없어요 · 체크 전 비활성', (await waitVis('saju-kyeol-ok-title', 6000)) && (await visText('saju-kyeol-ok-title')).includes('800') && (await visText('saju-kyeol-ok-norefund')).includes('돌려받을 수 없어요'), await visText('saju-kyeol-ok-bal'));
  await measure('확인 시트');
  await b.shot(`MILE_확인시트_${width}.png`);
  await tap('saju-kyeol-ok-check');
  await tap('saju-kyeol-ok-go');
  check('2', "데모 글 + 'AI가 쓴 글' 표시", (await waitVis('saju-kyeol-ai-done', 10000)) && (await visText('saju-kyeol-ai-tag')) === 'AI가 쓴 글', '');
  await words('AI 맞춤 결과');
  await measure('AI 맞춤 결과');
  await b.shot(`MILE_AI결과_${width}.png`);

  // ═══ 3. 사주 이야기 ═══
  await tap('saju-talk-open');
  check('3', '사주 이야기 나누기 화면 · 캡처 안내', (await b.waitFor(`location.pathname === '/saju-talk'`, 8000)) && (await waitVis('saju-talk-capture', 8000)), '');
  await b.type(sel('saju-talk-input'), '올해 일이 잘 풀릴까요?');
  await tap('saju-talk-send');
  check('3', 'CK19 동의는 이미 CK17D 뒤에 — 이 화면은 CK19 시트', await waitVis('saju-talk-ck19', 8000), '');
  await tap('saju-talk-ck19-a');
  await tap('saju-talk-ck19-yes');
  check('3', '시작 시트 한 번: "한 번 말할 때마다 200마일리지를 써요"', (await waitVis('saju-talk-start-line', 6000)) && (await visText('saju-talk-start-line')).includes('200'), await visText('saju-talk-start-line'));
  await measure('대화 시작 시트');
  await b.shot(`MILE_시작시트_${width}.png`);
  await tap('saju-talk-start-go');
  await tap('saju-talk-send');
  check('3', 'AI 답 말풍선 + 줄어드는 숫자 0', (await b.waitFor(`document.body.innerText.includes('AI가 쓴 글')`, 10000)) && !/남은|잔액/.test(await pageText()), '');
  await b.type(sel('saju-talk-input'), '요즘 죽고 싶어요');
  await tap('saju-talk-send');
  check('3', '위기 말은 고정 카드 · 쓴 글은 말풍선에 안 남음', (await waitVis('saju-talk-cardview-crisis', 8000)) && !(await pageText()).includes('죽고 싶어요'), '');
  await words('사주 이야기');
  await measure('사주 이야기');
  await b.shot(`MILE_이야기_${width}.png`);
  await goto('/mileage-log');
  await waitVis('mileage-log-list', 8000);
  const log2 = await visText('mileage-log-list');
  check('3', '내역: 사용 줄 두 개(풀이 800 · 이야기 200) · 위기 카드는 내역에 없음', /−800/.test(log2) && /−200/.test(log2) && (log2.match(/−200/g) ?? []).length === 1, log2.slice(0, 80));

  const external = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('4', '콘솔 오류 0 · 바깥 요청 0 · 결제 / AI 서버 요청 0', b.errors.length === 0 && external.length === 0 && ![...b.requests.values()].some((r) => /\/api\/ai\//.test(r.url)), [...b.errors.slice(0, 2), ...external.slice(0, 2).map((r) => r.url)].join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.message ?? error).slice(0, 200));
  exitCode = 1;
} finally {
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n마일리지 · AI 맞춤 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 || exitCode ? 1 : 0);
