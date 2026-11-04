// QF2-B3 웹 점검(D-248 · 0056): 설문 돈 문항 등급 고지 · 상대 프로필 취미(E11) · 내 등급 '등급은 어떻게 정해지나요'. 무료 · 네트워크 없음(로컬 서버 + 로컬 헤드리스 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(스크래치 폴더 인자 권장). 폭마다(SHOT_WIDTH 360 · 390 · 430) 한 번씩 돌린다.
//  1 정식 설문 v2: 돈 구역 머리 아래 등급 고지 한 번 · C05 · C06 · D08 · D09 · D04 질문 아래 '고르기 전' 늘 보이는 줄(옛 '답하면 등급이 오를 수 있어요' 0) · D08 · D09는 가산 0 글
//  2 상대 프로필(공개 뒤 10): '공개한 정보'에 '취미' 줄 · '봉사' 보기 0
//  3 내 등급 '등급은 어떻게 정해지나요': 쓰는 정보 새 글 + 항목별 영향 5줄
//  4 폭 점검: 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/QF2B3_<폭>/QF2B3_*.png
// 사용: node scripts/web-qf2b3.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-qf2b3.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';
import { fillSurveyV2 } from './lib/surveyV2Driver.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `QF2B3_${width}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 데모 웹 번들을 만드세요.`);
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
  await b.waitFor(`!window.__q('splash')`, 6000);
  await sleep(500);
  const file = `QF2B3_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const pageText = () => b.evaluate(`document.body.innerText`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-b3-target]').forEach((e) => e.removeAttribute('data-b3-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-b3-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-b3-target="1"]');
  await sleep(400);
};
const goto = (p) => b.evaluate(`(() => { history.pushState(null, '', ${JSON.stringify(p)}); dispatchEvent(new PopStateEvent('popstate', { state: null })); return true; })()`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('4', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.length}`);
}

const DECLINE = "'말하고 싶지 않아요'를 고르면 이 항목은 등급 계산에서 가장 낮은 구간으로 세어요.";
const PARENTS = "부모님 학교는 등급 계산에 더해지지 않아서, '말하고 싶지 않아요'를 골라도 달라지지 않아요.";
const MONEY = '연봉 · 자산 · 부모님 자산은 등급 계산에 들어가요.';

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
  await b.traitsNext();
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(until, 20000);
}

try {
  // ═══ 1. 정식 설문 v2: 돈 문항 ═══
  await b.open('/survey/v2', `!!window.__q('v2-intro') || !!window.__q('v2-screen')`);
  await b.waitFor(`!window.__q('splash')`, 8000);
  await b.waitFor(`!!window.__q('v2-intro')`, 8000);
  const targets = ['C05', 'C06', 'D08', 'D09', 'D04'];
  let first = true;
  for (const id of targets) {
    const r = await fillSurveyV2(b, { stopAt: [id] });
    const reached = r.stoppedAt === id;
    check('1', `${id}: 질문이 뜬다`, reached, `멈춘 곳 ${r.stoppedAt ?? r.stage}`);
    if (!reached) break;
    await sleep(500);
    const hint = await visText('v2-decline-hint');
    const parents = id === 'D08' || id === 'D09';
    check('1', `${id}: 칩을 고르기 전에 줄이 이미 보인다(${parents ? '부모님 학교 가산 0 글' : '가장 낮은 구간 글'})`, hint === (parents ? PARENTS : DECLINE), hint);
    check('1', `${id}: 옛 글 '답하면 등급이 오를 수 있어요' 0`, !(await pageText()).includes('등급이 오를 수 있어요'), '');
    if (first) {
      check('1', '돈 구역 머리 아래 등급 고지 한 번', (await visText('v2-money-notice')).startsWith(MONEY), await visText('v2-money-notice'));
      first = false;
    }
    await shot(`설문_${id}`);
    await measure(`설문 ${id}`);
  }

  // ═══ 가입 마무리 → 상대 프로필 · 내 등급 ═══
  check('2', '가입(데모) → 탑승권 홈', await signUp('qf2b3one@email.com', `location.pathname === '/boarding'`), '');
  await sleep(600);
  await wait(`!!${visQ('home-blocks')}`, 10000);
  await tap('if2-demo-matched');
  await b.waitFor(`!!document.querySelector('${sel('home-state-matched')}')`, 8000);
  await goto('/reveal');
  await wait(`location.pathname === '/reveal'`, 8000);
  await sleep(900);
  if (await vis('reveal-arrive-open')) await tap('reveal-arrive-open');
  await wait(`!!${visQ('reveal-profile')}`, 12000);
  await sleep(1500);
  await tap('reveal-profile');
  await wait(`location.pathname.startsWith('/candidate/') && !!${visQ('candidate-open-title')}`, 10000);
  const hobby = await visText('candidate-open-E11');
  check('2', "상대 프로필 '공개한 정보'에 '취미' 줄(고른 취미를 ', '로)", /^취미\s/.test(hobby) && hobby.includes(','), hobby);
  check('2', "'봉사' 보기는 그리지 않는다", !(await pageText()).includes('봉사'), '');
  await b.evaluate(`(() => { const el = ${visQ('candidate-open-E11')}; if (el) el.scrollIntoView({ block: 'center' }); return true; })()`);
  await shot('상대프로필_취미');
  await measure('상대 프로필');

  // ═══ 3. 내 등급 ═══
  await goto('/grade');
  await wait(`location.pathname === '/grade'`, 8000);
  await sleep(1500);
  let opened = false;
  for (const id of ['grade-link-how', 'grade-pending-how', 'grade-locked-how']) {
    if (await vis(id)) {
      await tap(id);
      opened = true;
      break;
    }
  }
  if (opened && (await wait(`!!${visQ('how-body')}`, 6000))) {
    const uses = await visText('how-part-1');
    check('3', "쓰는 정보에 '비슷한 질문에 일관되게 답한 정도' · '가장 낮은 구간'", uses.includes('비슷한 질문에 일관되게 답한 정도') && uses.includes("'말하고 싶지 않아요'로 답하면 그 항목은 가장 낮은 구간으로 세어요"), uses.slice(0, 60));
    const contrib = await visText('how-contrib');
    check('3', '항목별 영향 5줄(연봉 · 자산 · 부모님 자산 · 성실 · 학교)', ['연봉은 고른 구간', '자산도 고른 구간', '부모님 자산도 고른 구간', '일관되게 답한 정도가 들어가요', '마지막으로 다닌 과정'].every((s) => contrib.includes(s)), '');
    await shot('내등급_설명');
    await measure('내 등급 설명');
  } else {
    console.log('[미확인] 내 등급 설명 쪽을 열지 못했어요(이 데모 장면에 등급 칸이 없음).');
  }
} catch (error) {
  check('X', '점검 중 오류', false, error instanceof Error ? error.message : String(error));
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  const errors = (b.errors ?? []).filter((e) => !/favicon/.test(e));
  check('4', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...(b.requests?.values() ?? [])].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('4', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(failed > 0 ? 1 : 0);
