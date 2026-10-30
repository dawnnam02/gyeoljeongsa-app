// D46-A 만남 장면 웹 점검(T4S · 데모 chatnew · chatfirst). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 chatnew(막 열린 방 · 글 0): 가입 → 채팅 탭 → 방 줄 → 장면(카드 '한강 벤치 / 수요일 저녁' · 끝 줄 '눈이 마주쳤어요' · [건너뛰기]) → 3.5초에 캡처
//    → 6.24초 뒤 저절로 대화방 · 맨 위 기억 한 줄 → 목록으로 갔다 다시 열면 장면 0(한 번만)
//  2 chatfirst(상대가 먼저): 끝 줄 '먼저 말을 걸어왔어요' → [건너뛰기]로 바로 대화방
//  3 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 장면 글에 숫자 · 느낌표 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 D46_<폭>]/D46_장면_<폭>.png
// 사용: node scripts/web-d46.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-d46.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `D46_${width}`;
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
  await b.evaluate(`document.querySelectorAll('[data-d46-target]').forEach((e) => e.removeAttribute('data-d46-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-d46-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-d46-target="1"]');
};
// 넘침: 공통 __metrics 에서, 화면 안에 있는 잘림 틀(overflow hidden — 그림 칸) 안의 요소는 뺀다(카메라 1.1 배로 커진 그림은 그림 칸이 자른다 · 페이지 가로 스크롤 0)
async function measure(label) {
  const m = await b.evaluate(`(() => {
    const base = window.__metrics();
    const iw = window.innerWidth;
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX === 'hidden' || s.overflowX === 'clip') { const r = p.getBoundingClientRect(); if (r.left >= -1 && r.right <= iw + 1) return true; }
      }
      return false;
    };
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.position === 'absolute' && s.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > iw + 1 || r.left < -1) && !clipped(el)) over.push((el.getAttribute('data-testid') || el.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right));
    }
    return { ...base, over };
  })()`);
  check('3', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 탑승권 탭(web-w6 와 같은 길)
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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding'`, 20000);
}
// 채팅 탭 → 첫 방 줄
async function openFirstRoom() {
  await b.evaluate(`document.querySelectorAll('[data-d46-target]').forEach((e) => e.removeAttribute('data-d46-target'))`);
  const tab = await b.evaluate(`(() => { const el = [...document.querySelectorAll('[role=tab]')].find((e) => e.getAttribute('aria-label') === '채팅' && window.__visible(e)); if (el) el.setAttribute('data-d46-target', '1'); return !!el; })()`);
  if (!tab) throw new Error('채팅 탭이 없어요');
  await b.click('[data-d46-target="1"]');
  await waitVis('chat-row-0', 10000);
  await tap('chat-row-0');
  return b.waitFor(`location.pathname.startsWith('/chat/')`, 10000);
}

let exitCode = 0;
try {
  // ═══ 1. chatnew ═══
  check('1', '가입(데모 chatnew)', await signUp(`chatnew${width}@email.com`), '');
  check('1', '채팅 탭 → 방 줄 → /chat/{id}', await openFirstRoom(), await b.evaluate('location.pathname'));
  const t0 = Date.now();
  check('1', '장면이 대화방 위에 덮인다(T4S)', await waitVis('chat-meet', 4000), '');
  check('1', "자막 카드 '한강 벤치 / 수요일 저녁'", (await visText('chat-meet-place')) === '한강 벤치' && (await visText('chat-meet-when')) === '수요일 저녁', `${await visText('chat-meet-place')} / ${await visText('chat-meet-when')}`);
  check('1', "[건너뛰기] 처음부터 보임 · 이름 '장면 건너뛰고 대화방으로 가기'", (await vis('chat-meet-skip')) && (await b.evaluate(`(${visQ('chat-meet-skip')}).getAttribute('aria-label')`)) === '장면 건너뛰고 대화방으로 가기', '');
  check('1', "끝 줄 '옆에 앉은 분과 눈이 마주쳤어요.'(3.8초)", await b.waitFor(`(${visQ('chat-meet-line')} || {}).innerText === '옆에 앉은 분과 눈이 마주쳤어요.'`, 6000), await visText('chat-meet-line'));
  // 캡처: 끝 줄이 다 올라온 뒤 여운 박자 근처(약 4.8초 — 두 사람이 앉아 서로 봄 · 빛이 따뜻해짐)
  await sleep(Math.max(600, 4_800 - (Date.now() - t0)));
  await b.shot(`D46_장면_${width}.png`);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/D46_장면_${width}.png`);
  const words = await b.evaluate(`(() => { const el = ${visQ('chat-meet')}; return el ? el.innerText : ''; })()`);
  check('3', '장면 글에 숫자 · 느낌표 · 진행 막대 0', !/\d|[!！]/.test(words) && !(await b.evaluate(`!!document.querySelector('[role=progressbar]')`)), words.replace(/\s+/g, ' ').slice(0, 80));
  await measure('장면');
  check('1', '6.24초 뒤 저절로 대화방(장면 사라짐)', await b.waitFor(`!${visQ('chat-meet')}`, 6000), `${((Date.now() - t0) / 1000).toFixed(1)}초`);
  check('1', "대화방 맨 위 기억 한 줄 '수요일 저녁, 한강 벤치에서 처음 만났어요.'", (await visText('chat-room-met-at')) === '수요일 저녁, 한강 벤치에서 처음 만났어요.', await visText('chat-room-met-at'));
  check('1', '키보드 저절로 열기 0(글 칸에 초점 없음)', await b.evaluate(`document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT'`), '');
  await tap('chat-room-header-back');
  await waitVis('chat-row-0', 8000);
  await tap('chat-row-0');
  await b.waitFor(`location.pathname.startsWith('/chat/') && !!${visQ('chat-room-messages')}`, 10000);
  await sleep(1_200);
  check('1', '같은 방 두 번째: 장면 0 · 바로 대화방(한 번만)', !(await vis('chat-meet')) && (await vis('chat-room-messages')), '');

  // ═══ 2. chatfirst ═══
  check('2', '가입(데모 chatfirst)', await signUp(`chatfirst${width}@email.com`), '');
  check('2', '채팅 탭 → 방 줄', await openFirstRoom(), '');
  check('2', "장면 끝 줄 두 갈래: '옆에 앉은 분이 먼저 말을 걸어왔어요.'", (await waitVis('chat-meet', 4000)) && (await b.waitFor(`(${visQ('chat-meet-line')} || {}).innerText === '옆에 앉은 분이 먼저 말을 걸어왔어요.'`, 6000)), await visText('chat-meet-line'));
  await tap('chat-meet-skip');
  check('2', '[건너뛰기] → 바로 대화방 · 상대 첫 글이 보임', await b.waitFor(`!${visQ('chat-meet')} && !!${visQ('chat-room-messages')}`, 3000), '');

  const external = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('3', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && external.length === 0, [...b.errors.slice(0, 2), ...external.slice(0, 2).map((r) => r.url)].join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.message ?? error).slice(0, 200));
  exitCode = 1;
} finally {
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n만남 장면 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 || exitCode ? 1 : 0);
