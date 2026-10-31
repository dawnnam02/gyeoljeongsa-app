// D42-I 그림 4안 웹 점검(D-176). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버). 앱 코드는 고치지 않는다.
//  먼저 데모 모드 웹 번들을 만든다(npm run check:web:demo → dist-demo/, 또는 같은 설정으로 다른 폴더).
//  1 온보딩: 장마다 장면 그림 온보딩 1 · 2 · 3 · 4:3 · 그림 위 글자 0 · 새 글(v5)
//  2 탑승권: 상태마다 장면 그림(판매 중 = 탑승권 · 판매 전 = 사전 오픈 대기 · 다 참 · 판매 끝 = 마감 · 탑승 완료 = 기다림 · 공개 = 공개 순간 · 못 찾음)
//  3 채팅 빈 목록: 장면 그림 '채팅 빈 목록'
//  4 폭마다 가로 넘침 0 · 콘솔 오류 0 · 바깥 요청 0
//  DARK=1 이면 시스템 색 모드를 다크로 흉내 내고 다크 판(id 끝 d)이 그려지는지 본다
//  캡처: 확인/스크린샷/D42I_<폭>[_다크]/D42I_*.png
// 사용: SHOT_WIDTH=360 [DARK=1] node scripts/web-d42i.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const dark = process.env.DARK === '1';
const subdir = `D42I_${width}${dark ? '_다크' : ''}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);
const mode = dark ? 'd' : 'l';

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

const b = await openBrowser({ distDir, shotDir, width, height: width === 390 ? 844 : 740 });
if (dark) await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
const shot = async (name) => {
  const file = `D42I_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-d42-target]').forEach((e) => e.removeAttribute('data-d42-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-d42-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-d42-target="1"]');
  await sleep(400);
};
// 그림 칸 하나: 크기 · 둥글기 · 장면 번호(원본 파일 번호) · 판(l/d) · 칸 안 글자
const art = (id) =>
  b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const m = /id="d42(\\d\\d)([ld])/.exec(el.innerHTML) || []; return { w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), no: m[1] || '', mode: m[2] || '', text: el.innerText.trim(), svg: !!el.querySelector('svg') }; })()`);
const artOk = (a, no) => !!a && a.svg && a.no === no && a.mode === mode && Math.abs(a.w * 0.75 - a.h) <= 1.5 && a.text === '';
const artLine = (a) => (a ? `${a.w}x${a.h} · 장면 ${a.no}${a.mode} · 둥글기 ${a.radius}` : '그림 없음');
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('4', `${label}: ${width} 폭 가로 넘침 0`, m.scrollW <= m.innerW && m.over.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')})`);
}

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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(until, 20000);
}

let exitCode = 0;
try {
  // ═══ 1. 온보딩 ═══
  await b.open('/onboarding', `document.body.innerText.includes('시작하기')`);
  await wait(`!window.__q('splash') && !!${visQ('intro-art')}`, 10000);
  await sleep(900);
  const slides = [
    ['01', '결혼을 정말 하고 싶은 사람들', '설문 · 사진 · 인증으로 결혼 조건을 꼼꼼히 살펴요.'],
    ['02', '일주일에 한 번, 한 분', '탑승권 한 장으로 수요일 18:00에 나와 가장 잘 맞는 한 분을 만나요.'],
    ['03', '여행지에서 천천히', '만난 분과 7일 동안 이야기해요. 서로 원하면 더 이어 가요.'],
  ];
  for (const [i, [no, title, body]] of slides.entries()) {
    if (i > 0) await b.click(sel(`intro-dot-${i + 1}`));
    await sleep(900);
    const a = await art('intro-art');
    const t = await b.evaluate('window.__text()');
    check('1', `온보딩 ${i + 1}장: 장면 그림 ${no}(${dark ? '다크' : '라이트'} 판) · 4:3 · 둥글기 20 · 그림 위 글자 0`, artOk(a, no) && a.radius === 20, artLine(a));
    check('1', `온보딩 ${i + 1}장 글: '${title}' · 부제`, t.includes(title) && t.includes(body), '');
    await shot(`01_온보딩${i + 1}`);
  }
  await measure('온보딩');

  // ═══ 3. 채팅 빈 목록(가입 전에도 데모 목록이 열린다) ═══
  check('3', '/chat 가 열린다', await b.open('/chat', `!!window.__q('chat-row-0') || !!window.__q('chat-list-empty') || !!window.__q('chat-list-failed')`), '');
  // 3부-카(FB-019): 데모 장면이 여덟 가지(막 열린 방 · 상대가 먼저 … 방 없음)로 늘어 '방 없음'까지 일곱 번 눌러야 한다 — 아홉 번까지 본다
  for (let n = 0; n < 9 && !(await b.evaluate(`!!${visQ('chat-list-empty')}`)); n++) {
    await tap('chat-demo-scene');
    await sleep(600);
  }
  const chat = await art('chat-list-empty-art');
  check('3', "채팅 빈 목록: 장면 그림 '채팅 빈 목록'(10) · 4:3 · 글 '아직 열린 대화방이 없어요'", artOk(chat, '10') && (await b.evaluate('window.__text()')).includes('아직 열린 대화방이 없어요'), artLine(chat));
  await b.evaluate(`window.scrollTo(0, 0); document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })`);
  await shot('10_채팅빈목록');
  await measure('채팅 빈 목록');

  // ═══ 2. 탑승권 상태마다 그림 ═══
  check('2', '가입을 마치면 탑승권(판매 중)', await signUp(`d42i${width}${mode}@email.com`, `location.pathname === '/boarding' && !!${visQ('boarding-status-on_sale')}`), '');
  await sleep(800);
  const scenes = [
    [null, 'on_sale', '05', '판매 중 = 탑승권'],
    ['before', 'before_sale', '09', '판매 전 = 사전 오픈 대기'],
    ['full', 'full', '11', '좌석 다 참 = 마감'],
    ['closed', 'closed', '11', '판매 끝 = 마감'],
    ['boarded', 'boarded', '04', '탑승 완료 = 기다림'],
    ['matched', 'matched', '06', '공개 = 공개 순간'],
    ['none', 'no_match', '07', '못 찾음 = 크레딧'],
  ];
  for (const [demo, view, no, label] of scenes) {
    if (demo) {
      await tap(`boarding-demo-${demo}`);
      await wait(`!!${visQ(`boarding-status-${view}`)}`, 8000);
      await sleep(600);
    }
    const a = await art('boarding-art');
    check('2', `${label}: 장면 그림 ${no} · 4:3`, artOk(a, no), artLine(a));
    await b.evaluate(`(() => { const el = ${visQ('boarding-scroll')}; if (el) el.scrollTop = 0; })()`);
    await sleep(300);
    await shot(`T_${view}`);
  }
  await measure('탑승권');
  await tap('boarding-demo-politics');
  await wait(`!!${visQ('boarding-status-ineligible')}`, 8000);
  check('2', '살 수 없음(정치 문항 빈칸): 그림 없음', !(await b.evaluate(`!!${visQ('boarding-art')}`)), '');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('4', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('4', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
} catch (error) {
  check('X', '점검 중 오류', false, String(error?.message ?? error));
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  await b.close?.();
}

const failed = results.filter((x) => !x.ok).length;
console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width}${dark ? ' · 다크' : ''})`);
exitCode = failed === 0 ? 0 : 1;
process.exit(exitCode);
