// IF5-F1 사주 마당 웹 점검(IF-MADANG · IF-SJ-IN · IF-SJ-PARTNER · IF-SJ-CAL · IF-SJ-TODAY · 12 설정 줄). 무료 · 네트워크 없음(로컬 서버 + 로컬 헤드리스 브라우저).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/). 사람이 하는 순서대로 누른다.
//  1 가입 → 12 설정 '사주 마당' 줄 → 사주 마당: 동의 전엔 카드 0 + [동의하고 보기](저절로 시트 0) → 동의 시트 → [내 정보 넣기] 시트(시각 모름 처음값 · 미리 체크 0 · 지점 23)
//  2 저장하고 보기 → 카드 열한 장(순서) · 숫자 막대 라벨 0 · 점수 · 퍼센트 · 판정 · 재회 · 마일리지 0 · 시각 모름 줄 · 캡처 안내 줄 · [?] 풀이 시트
//  3 상대 생일 시트: CK20 확인 전 잠김 → 입력 → 결과 · 19세 미만 한 줄 · 닫으면 값 0 · 바깥 요청 0
//  4 날짜 고르기(용도 칩 → 달력 색 두 가지 + 모양) · 만세력 달력(칸 글자 · 절기) · 오늘 하루
//  5 화면마다 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 금지 낱말 0 · 느낌표 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 SAJU_<폭>]/SAJU_<장면>_<폭>.png
// 사용: node scripts/web-saju.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-saju.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `SAJU_${width}`;
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
  await b.evaluate(`document.querySelectorAll('[data-saju-target]').forEach((e) => e.removeAttribute('data-saju-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-saju-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-saju-target="1"]');
};
const goto = (p) => b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
// 사주 마당 자리 글: 금지 낱말 0 · 느낌표 0 · 숫자 막대 라벨 0(점수 · 퍼센트 · 순위 · 판정 · 재회 · 마일리지 · 무제한)
const BANNED = ['점수', '퍼센트', '순위', '판정', '재회', '잔액', '무제한', '흉일', '적중', '내 편', '부적', '개운', '몰래', '전 애인'];
async function words(label) {
  const t = await pageText();
  const banned = BANNED.filter((w) => t.includes(w));
  check('5', `${label}: 금지 낱말 0 · 느낌표 0 · %0`, t.trim().length > 0 && banned.length === 0 && !/[!！]/.test(t) && !/\d+\s*%/.test(t), banned.join(' '));
}
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('5', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.length}(${m.small.slice(0, 2).join(',')})`);
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
  await signUp('sj1@email.com');
  // ═══ 1. 설정 줄 → 사주 마당 · 동의 · 입력 시트 ═══
  await goto('/settings');
  await waitVis('settings-rows', 10000);
  check('1', "12 설정에 '사주 마당' 줄(숫자 · 새 점 0)", await vis('settings-row-saju-yard'), await visText('settings-row-saju-yard'));
  await tap('settings-row-saju-yard');
  check('1', '줄 → 사주 마당', await b.waitFor(`location.pathname === '/saju'`, 8000), await b.evaluate('location.pathname'));
  check('1', "동의 전엔 카드 0 · [동의하고 보기] · 시트가 저절로 안 뜸", (await waitVis('saju-ck17-off', 8000)) && !(await vis('saju-pillars')) && !(await vis('if2-ck17')), '');
  await words('동의 전');
  await measure('동의 전');
  await b.shot(`SAJU_동의전_${width}.png`);
  await tap('saju-ck17-agree');
  check('1', '동의 시트(미리 체크 0)', (await waitVis('if2-ck17', 6000)) && (await b.evaluate(`(${visQ('if2-ck17-a')}).getAttribute('aria-checked')`)) === 'false', '');
  await tap('if2-ck17-a');
  await tap('if2-ck17-c'); // IF5-F2: ③ 태어난 시각 · ④ 태어난 곳은 항목별 동의 — 동의해야 요청에 실린다
  await tap('if2-ck17-d');
  await tap('if2-ck17-go');
  check('1', '동의 뒤 → 내 정보 안내 한 줄 + [내 정보 넣기]', await waitVis('saju-empty', 8000), '');
  await measure('빈 상태');
  await b.shot(`SAJU_빈_${width}.png`);
  await tap('saju-fill');
  check('1', '입력 시트: 시각 모름 처음값 · 저장 칸 둘 미리 체크 0', (await waitVis('saju-in-time-unknown', 6000)) && (await b.evaluate(`(${visQ('saju-in-save-time')}).getAttribute('aria-checked')`)) === 'false', '');
  await tap('saju-in-place-pick');
  const places = await b.evaluate(`new Set([...document.querySelectorAll('[data-testid^="saju-in-place-"]')].filter((e) => /^saju-in-place-\\d+$/.test(e.getAttribute('data-testid'))).map((e) => e.getAttribute('data-testid'))).size`);
  check('1', '태어난 곳 목록 23곳(자유 글 · 위치 권한 0)', places === 23, String(places));
  await words('입력 시트');
  await measure('입력 시트');
  await b.shot(`SAJU_입력_${width}.png`);
  await tap('saju-in-place-0');
  await tap('saju-in-save');

  // ═══ 2. 카드 ═══
  check('2', '저장하고 보기 → 내 네 기둥(시각 모름 세 칸 + 흐린 칸)', (await waitVis('saju-pillars', 12000)) && (await vis('saju-pillar-table-hour-unknown')), '');
  const ids = ['saju-pillars', 'saju-kyeol', 'saju-year', 'saju-month', 'saju-love', 'saju-work', 'saju-season', 'saju-pick', 'saju-partner-card', 'saju-cal-card', 'saju-guide-card', 'saju-end'];
  const present = await b.evaluate(`${JSON.stringify(ids)}.filter((id) => !!document.querySelector('[data-testid="' + id + '"]'))`);
  check('2', '카드 열한 장 + 끝줄 모두 있음', present.length === ids.length, `${present.length}/${ids.length}`);
  check('2', '캡처 안내 한 줄 · 재미 문구 · 짝에 쓰이지 않아요', (await pageText()).includes('이 화면은 캡처할 수 없어요') && (await pageText()).includes('재미로 보는 이야기예요') && (await pageText()).includes('쓰이지 않아요'), '');
  await words('사주 마당');
  await measure('사주 마당 위쪽');
  await b.shot(`SAJU_마당_${width}.png`);
  await tap('saju-kyeol-toggle');
  check('2', '[펼쳐 보기] → 펼침(기억 0 — 다시 누르면 접힘)', await waitVis('saju-kyeol-body', 4000), '');
  await tap('saju-kyeol-toggle');
  check('2', '다시 누르면 접힘', await waitGone('saju-kyeol-body', 4000), '');
  await tap('saju-guide-help-1');
  check('2', '[?] 풀이 시트: 제목 틀 + 쉬운 말', (await waitVis('saju-guide', 4000)) && (await visText('saju-guide-title')) === '다섯 기운 이 뭐예요?', '');
  await words('읽는 법 시트');
  await b.shot(`SAJU_읽는법_${width}.png`);
  await tap('saju-guide-ok');
  await waitGone('saju-guide', 4000);

  // ═══ 3. 상대 생일 ═══
  await tap('saju-partner-open');
  check('3', 'CK20 확인 전엔 생년월일 칸이 잠김 · 이름 · 성별 · 별명 칸 0', (await waitVis('saju-partner-birth', 5000)) && (await b.evaluate(`!!(${visQ('saju-partner-birth')}).disabled || (${visQ('saju-partner-birth')}).querySelector('input')?.disabled || (${visQ('saju-partner-birth')}).getAttribute('aria-disabled') === 'true'`)), '');
  await measure('상대 생일 시트');
  await b.shot(`SAJU_상대_${width}.png`);
  await tap('saju-partner-ck20-check');
  await b.type(sel('saju-partner-birth'), '19920802');
  await tap('saju-partner-go');
  check('3', '결과: 세 줄 + 이 화면을 닫으면 지워져요 · 점수 0', (await waitVis('saju-partner-result', 6000)) && (await visText('saju-partner-result-gone')).includes('지워져요'), '');
  await words('상대 결과');
  await b.shot(`SAJU_상대결과_${width}.png`);
  await tap('saju-partner-close');
  await waitGone('saju-partner-result', 4000);
  await tap('saju-partner-open'); // CK20 확인은 이 기기에 한 번 기록돼 있어 다시 누르지 않는다
  await b.type(sel('saju-partner-birth'), '20180101');
  await tap('saju-partner-go');
  check('3', '만 19세 미만 → 맞춰 보지 않아요 한 줄 · 결과 0', (await waitVis('saju-partner-minor', 5000)) && !(await vis('saju-partner-result')), await visText('saju-partner-minor'));
  await b.shot(`SAJU_상대미성년_${width}.png`);
  await tap('saju-partner-minor-close');
  await waitGone('saju-partner-minor', 4000);

  // ═══ 4. 날짜 고르기 · 달력 · 오늘 하루 ═══
  await tap('saju-pick-use-0');
  await tap('saju-pick-open');
  check('4', '날짜 고르기 달력 화면', (await b.waitFor(`location.pathname === '/saju-calendar'`, 8000)) && (await waitVis('saju-cal-grid', 8000)), '');
  await b.waitFor(`document.querySelectorAll('[aria-label*="좋은"]').length + document.querySelectorAll('[aria-label*="쉬어 가는"]').length > 0`, 8000).catch(() => false);
  const marks = await b.evaluate(`[document.querySelectorAll('[aria-label*="좋은"]').length, document.querySelectorAll('[aria-label*="쉬어 가는"]').length]`);
  check('4', '달력에 고르기 좋은 날 · 쉬어 가는 날 표시(둘 다 있음)', marks[0] > 0 && marks[1] > 0, marks.join(' / '));
  await words('날짜 고르기');
  await measure('날짜 고르기');
  await b.shot(`SAJU_날짜고르기_${width}.png`);
  await goto('/saju-calendar?mode=cal');
  check('4', '만세력 달력: 칸마다 그날의 글자', await waitVis('saju-cal-day-10', 8000), '');
  await tap('saju-cal-day-10');
  check('4', '날짜를 누르면 그날 한 장(그날의 글자 · 절기)', (await waitVis('saju-cal-day-glyph', 4000)) && (await visText('saju-cal-day-glyph')).startsWith('그날의 글자 · '), '');
  await words('만세력 달력');
  await measure('만세력 달력');
  await b.shot(`SAJU_만세력_${width}.png`);
  await goto('/saju-today');
  check('4', '오늘 하루: 오늘의 바탕 한 줄 + 하루 쓰는 법 두 줄', (await waitVis('saju-today-one', 8000)) && (await waitVis('saju-today-howto', 8000)), '');
  await words('오늘 하루');
  await measure('오늘 하루');
  await b.shot(`SAJU_오늘_${width}.png`);

  const external = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('5', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && external.length === 0, [...b.errors.slice(0, 2), ...external.slice(0, 2).map((r) => r.url)].join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.message ?? error).slice(0, 200));
  exitCode = 1;
} finally {
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n사주 마당 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 || exitCode ? 1 : 0);
