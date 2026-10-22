// W5 채팅 웹 점검(목록 · 방 · 글 · 사진 · 음성 · 7일 · 연장 · 나가기 · 차단 · 닫힌 방). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 채팅).
//  먼저 node scripts/export-w5.mjs 로 dist-w5/ 를 만든다(채팅 라우트가 아직 없으면 번들을 만드는 동안만 임시 라우트를 둔다).
//  1 목록: 열린 방 줄(이름 · 나이 · 지역 · 마지막 글 · 읽지 않은 1 · 얼굴 사진 = 데모 인물)
//  2 방: 위 띠 = '12월 30일 수요일 오후 6시까지 열려 있어요.'(카운트다운 · 재촉 말 0) · 사진 말풍선이 실제로 읽힘 · 음성 말풍선 · 글쓰기 줄
//  3 글: 보내기 → 내 말풍선 → 1.5초 뒤 상대 답(실시간 흉내) · 연락처는 보내짐 · 금전 요구는 '보낼 수 없는 표현' + [다시 보내기][지우기]
//  4 음성: 마이크 → 녹음 줄 → 보내기 → 음성 말풍선 하나 더 · 재생 → 멈춤 단추 / 5 사진: 보내기 → 크게 보기 → 닫기
//  6 연장(혼자): 띠가 '연장을 원한다고 골랐어요…' / 7 나가기 → 닫힌 방(글쓰기 줄 없음 · 지우는 날) → 목록 '닫힌 대화방'
//  8 데모 장면: 마지막 날 띠 '오늘 오후 6시까지…' · 상대가 연장을 원함 → 연장 → '1월 6일 …' · 닫힌 방(7일 지남) · 방 없음
//  9 차단: 신고 · 차단 시트 → 차단 → 목록으로 · 토스트 · 방이 목록에서 빠짐
//  M 화면마다 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 / R --reduced-motion: 새 말풍선 · 시트 · 화면 넘김에 transform 바뀜 0
//  Z 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 W5_<폭>]/W5_*.png
// 사용: node scripts/web-w5.mjs [번들 폴더] [--reduced-motion]   SHOT_WIDTH=360 node scripts/web-w5.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const args = process.argv.slice(2);
const reduced = args.includes('--reduced-motion');
const distDir = path.resolve(APP_DIR, args.find((a) => !a.startsWith('--')) ?? 'dist-w5');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `W5_${width}${reduced ? '_줄이기' : ''}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 node scripts/export-w5.mjs 를 하세요.`);
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
if (reduced) await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const shot = async (name) => {
  const file = `W5_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const countRe = (re) => b.evaluate(`[...document.querySelectorAll('[data-testid]')].filter((e) => ${re}.test(e.dataset.testid) && window.__visible(e)).length`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-w5-target]').forEach((e) => e.removeAttribute('data-w5-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-w5-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-w5-target="1"]');
  await sleep(350);
};
// 마지막(가장 아래) 보이는 testID 정규식 요소를 누른다
const tapLast = async (re) => {
  const id = await b.evaluate(`(() => { const els = [...document.querySelectorAll('[data-testid]')].filter((e) => ${re}.test(e.dataset.testid) && window.__visible(e)); return els.length ? els[els.length - 1].dataset.testid : null; })()`);
  if (!id) throw new Error(`보이는 ${re} 가 없어요`);
  await tap(id);
  return id;
};
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('M', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}
const COUNTDOWN = /\d+\s*(시간|분|초)\s*(남|뒤)|남았어요|서두르|곧 닫|마감 임박/;
const typeAndSend = async (text) => {
  await b.type('[data-testid="chat-composer-input"]', text);
  await tap('chat-composer-send');
  await sleep(500);
};
// 동작 줄이기: 일(fn)을 하는 동안 화면 그리기마다 transform 이 바뀐 요소를 센다(제자리 matrix → none 은 움직임 아님)
async function noMotionDuring(label, fn, ms = 1200) {
  if (!reduced) {
    await fn();
    return;
  }
  await b.evaluate(`(() => { window.__tf = new Map(); window.__changed = new Set(); const until = performance.now() + ${ms}; const look = () => { for (const el of document.querySelectorAll('body *')) { const raw = getComputedStyle(el).transform; const t = raw === 'matrix(1, 0, 0, 1, 0, 0)' ? 'none' : raw; const prev = window.__tf.get(el); if (prev !== undefined && prev !== t) { const ids = []; for (let x = el; x && ids.length < 3; x = x.parentElement) if (x.dataset && x.dataset.testid) ids.push(x.dataset.testid); window.__changed.add(prev + ' → ' + t + ' [' + ids.join('<') + ']'); } window.__tf.set(el, t); } if (performance.now() < until) requestAnimationFrame(look); }; requestAnimationFrame(look); return true; })()`);
  await fn();
  await sleep(ms + 200);
  const rm = await b.evaluate('[...window.__changed]');
  check('R', `동작 줄이기: ${label} 동안 이동 · 크기 변화 0`, rm.length === 0, `바뀐 요소 ${rm.length} ${rm.slice(0, 3).join(' | ')}`);
}
const openFirstRoom = async () => {
  await tap('chat-row-0');
  return wait(`location.pathname.startsWith('/chat/') && !!${visQ('chat-room-messages')}`, 10000);
};
const backToList = async () => {
  await tap('chat-room-header-back');
  return wait(`location.pathname === '/chat' && (!!${visQ('chat-row-0')} || !!${visQ('chat-list-empty')})`, 8000);
};
const nextScene = async (label) => {
  await tap('chat-demo-scene');
  await wait(`(${visQ('chat-demo-scene')} || {}).innerText?.includes(${JSON.stringify(label)})`, 5000);
};

let exitCode = 0;
try {
  // ═══ 1. 목록 ═══
  check('1', '/chat 가 열리고 대화방 줄이 보인다', await b.open('/chat', `!!window.__q('chat-row-0') || !!window.__q('chat-list-failed')`), '');
  await b.waitFor(`!window.__q('splash')`, 8000);
  await sleep(800);
  const head = await visText('chat-row-0-head');
  check('1', '줄 = 데모 인물 성 + OO · 나이 · 지역', /^[가-힣]OO · \d+ · \S+/.test(head), head);
  check('1', '마지막 글 · 읽지 않은 수 1', (await visText('chat-row-0-last')).length > 0 && (await visText('chat-row-0-unread')) === '1', `${await visText('chat-row-0-last')} / ${await visText('chat-row-0-unread')}`);
  await wait(`(() => { const img = document.querySelector('[data-testid="chat-row-0-face"] img'); return !!img && img.complete && img.naturalWidth > 0; })()`, 8000);
  const face = await b.evaluate(`(() => { const el = document.querySelector('[data-testid="chat-row-0-face"]'); const img = el && el.querySelector('img'); return { src: img ? img.getAttribute('src') : '', def: !!el?.querySelector('[data-testid$="-default"]') }; })()`);
  check('1', '얼굴 원 = 데모 인물 사진(기본 그림 아님)', face.src.includes('/demo/people/') && !face.def, face.src.split('/').pop());
  await shot('01_목록');
  await measure('목록');

  // ═══ 2. 방 ═══
  await noMotionDuring('목록 → 방 넘김', async () => {
    check('2', '줄을 누르면 /chat/{id} 대화방', await openFirstRoom(), await b.evaluate('location.pathname'));
  });
  await sleep(600);
  const banner = await visText('chat-room-banner-text');
  check('2', "위 띠 = '12월 30일 수요일 오후 6시까지 열려 있어요.'(날짜 글만)", banner === '12월 30일 수요일 오후 6시까지 열려 있어요.', banner);
  check('2', '화면에 카운트다운 · 재촉 말 0', !COUNTDOWN.test(await b.evaluate('window.__text()')), '');
  await wait(`[...document.querySelectorAll('[data-testid$="-photo"] img')].some((i) => i.complete && i.naturalWidth > 0)`, 8000);
  const photos = await b.evaluate(`[...document.querySelectorAll('[data-testid$="-photo"] img')].map((i) => ({ ok: i.complete && i.naturalWidth > 0, src: (i.getAttribute('src') || '').split('/').pop() }))`);
  check('2', '사진 말풍선이 실제로 읽힌다(데모 사진 파일)', photos.length > 0 && photos.every((p) => p.ok), photos.map((p) => p.src.slice(0, 20)).join(', '));
  check('2', '음성 말풍선 1 · 글쓰기 줄(사진 · 마이크 · 칸 · 보내기)', (await countRe('/^chat-msg-\\d+-voice$/')) === 1 && (await vis('chat-composer-photo')) && (await vis('chat-composer-voice')) && (await vis('chat-composer-input')) && (await vis('chat-composer-send')), '');
  await shot('02_방');
  await measure('방');

  // ═══ 3. 글 ═══
  const before = await countRe('/^chat-msg-\\d+$/');
  await noMotionDuring('새 말풍선 나타남', () => typeAndSend('안녕하세요. 토요일 오후는 어떠세요.'));
  // 동작 줄이기 점검은 1.4초를 기다려 상대 답까지 올 수 있어 '하나 이상'으로 센다
  check('3', '보내면 내 말풍선이 생기고 칸이 비워진다', (await countRe('/^chat-msg-\\d+$/')) >= before + 1 && (await b.evaluate(`window.__text()`)).includes('토요일 오후는 어떠세요.') && (await b.evaluate(`document.querySelector('[data-testid="chat-composer-input"]').value`)) === '', '');
  check('3', '1.5초 뒤 상대가 답한다(실시간 흉내)', await wait(`window.__text().includes('네, 좋아요. 천천히 이야기 나눠요.')`, 6000), '');
  await typeAndSend('제 번호는 010-1234-5678이에요.');
  check('3', '연락처는 막지 않는다(T-20)', (await b.evaluate(`window.__text()`)).includes('010-1234-5678') && !(await b.evaluate(`!!document.querySelector('[data-testid$="-fail-text"]')`)), '');
  await typeAndSend('계좌로 송금해 주세요');
  check('3', "금전 요구는 '보낼 수 없는 표현이 있어요…' + [다시 보내기][지우기]", (await b.evaluate(`window.__text()`)).includes('보낼 수 없는 표현이 있어요.') && (await countRe('/-retry$/')) > 0 && (await countRe('/-discard$/')) > 0, '');
  await shot('03_글_막힘');
  await tapLast('/^chat-msg-\\d+-discard$/');
  check('3', '[지우기]를 누르면 못 보낸 말풍선이 사라진다', !(await b.evaluate(`!!document.querySelector('[data-testid$="-fail-text"]')`)), '');

  // ═══ 4. 음성 ═══
  const voices = await countRe('/^chat-msg-\\d+-voice$/');
  await tap('chat-composer-voice');
  check('4', "마이크 → 녹음 줄('녹음 중 0:00' · 취소 · 보내기)", (await vis('chat-composer-recording')) && (await visText('chat-composer-rec-time')).startsWith('녹음 중'), await visText('chat-composer-rec-time'));
  await sleep(2200);
  await shot('04_녹음');
  await measure('녹음 줄');
  await tap('chat-composer-rec-send');
  await sleep(500);
  check('4', '보내면 음성 말풍선이 하나 더', (await countRe('/^chat-msg-\\d+-voice$/')) === voices + 1, '');
  const playId = await tapLast('/^chat-msg-\\d+-play$/');
  check('4', '재생을 누르면 멈춤 단추로 바뀐다', (await b.evaluate(`document.querySelector('[data-testid="${playId}"]').getAttribute('aria-label')`)) === '음성 멈춤', '');
  await sleep(1200);
  const len = await b.evaluate(`document.querySelector('[data-testid="${playId.replace('-play', '-len')}"]').innerText`);
  check('4', "재생 중 '0:01 / 0:02' 꼴로 시간이 흐른다", /^\d:\d\d \/ \d:\d\d$/.test(len), len);
  await shot('05_음성재생');

  // ═══ 5. 사진 ═══
  const nPhoto = await countRe('/^chat-msg-\\d+-photo$/');
  await tap('chat-composer-photo');
  await sleep(600);
  check('5', '사진을 고르면 바로 보낸다(데모: 내 사진)', (await countRe('/^chat-msg-\\d+-photo$/')) === nPhoto + 1, '');
  await tapLast('/^chat-msg-\\d+-photo$/');
  check('5', '사진을 누르면 크게 보기', await wait(`!!${visQ('chat-viewer-close')}`, 4000), '');
  await shot('06_사진크게');
  await tap('chat-viewer-close');

  // ═══ 6. 연장(혼자) ═══
  await noMotionDuring('연장 시트 열림', () => tap('chat-room-banner-action'));
  check('6', '연장 시트: 둘 다 원하면 7일 더 · [연장을 원해요]', (await visText('chat-extend-body')).startsWith('둘 다 원하면 대화방이 7일 더 열려요.') && (await vis('chat-extend-want')), '');
  await shot('07_연장시트');
  await measure('연장 시트');
  await tap('chat-extend-want');
  await sleep(800);
  check('6', "혼자 원하면 띠가 '연장을 원한다고 골랐어요…'(상대의 선택은 보이지 않음)", (await visText('chat-room-banner-text')) === '연장을 원한다고 골랐어요. 상대도 원하면 7일 더 열려요.', await visText('chat-room-banner-text'));

  // ═══ 7. 나가기 ═══
  await tap('chat-room-more');
  await shot('08_메뉴');
  await measure('메뉴 시트');
  await tap('chat-menu-leave');
  check('7', '나가기 확인창', await wait(`!!${visQ('chat-leave-confirm')}`, 4000), '');
  await tap('chat-leave-confirm');
  await sleep(800);
  check('7', '닫힌 방: 글쓰기 줄 없음 · 지우는 날 안내', !(await vis('chat-composer')) && /^대화방에서 나왔어요\. 지난 글은 .+까지 읽을 수 있어요\.$/.test(await visText('chat-room-closed-body')), await visText('chat-room-closed-body'));
  await shot('09_나간방');
  await measure('닫힌 방');
  check('7', "목록으로 돌아가면 '닫힌 대화방'", (await backToList()) && (await visText('chat-row-0-last')) === '닫힌 대화방', await visText('chat-row-0-last'));

  // ═══ 8. 데모 장면 ═══
  await nextScene('마지막 날');
  await openFirstRoom();
  await sleep(500);
  check('8', "마지막 날 띠 = '오늘 오후 6시까지 열려 있어요.'(시 · 분 카운트다운 0)", (await visText('chat-room-banner-text')) === '오늘 오후 6시까지 열려 있어요.', await visText('chat-room-banner-text'));
  await shot('10_마지막날');
  await backToList();
  await nextScene('상대가 연장을 원함');
  await openFirstRoom();
  await tap('chat-room-banner-action');
  await tap('chat-extend-want');
  await sleep(800);
  check('8', "둘 다 원하면 7일 더 → 띠 '1월 6일 수요일 오후 6시까지…' · 토스트", (await visText('chat-room-banner-text')) === '1월 6일 수요일 오후 6시까지 열려 있어요.' && (await b.evaluate('window.__text()')).includes('둘 다 원해서 7일 더 열렸어요.'), await visText('chat-room-banner-text'));
  await shot('11_연장됨');
  await backToList();
  await nextScene('닫힌 방');
  await openFirstRoom();
  await sleep(500);
  check('8', '7일 지난 방: 읽기만 · 위 띠 없음 · 지우는 날 1월 29일', !(await vis('chat-composer')) && !(await vis('chat-room-banner')) && (await visText('chat-room-closed-body')).includes('1월 29일 금요일까지'), await visText('chat-room-closed-body'));
  await tap('chat-room-more');
  check('8', '닫힌 방 메뉴 = 신고 · 차단만(연장 · 나가기 없음)', (await vis('chat-menu-safety')) && !(await vis('chat-menu-extend')) && !(await vis('chat-menu-leave')), '');
  await shot('12_닫힌방');
  await measure('닫힌 방(7일)');
  await tap('chat-menu-cancel');
  await sleep(400);

  // ═══ 9. 차단(닫힌 방에서도) ═══
  await tap('chat-room-more');
  await tap('chat-menu-safety');
  check('9', '공용 신고 · 차단 시트', await wait(`!!${visQ('chat-report-menu-block')}`, 4000), '');
  await tap('chat-report-menu-block');
  await tap('chat-report-block-confirm-confirm');
  check('9', "차단하면 목록으로 · '차단했어요' 토스트 · 방이 빠짐", (await wait(`location.pathname === '/chat'`, 6000)) && (await wait(`window.__text().includes('차단했어요')`, 4000)) && (await vis('chat-list-empty')), '');
  await shot('13_차단뒤목록');
  await nextScene('방 없음');
  check('8', '방 없음 장면: 빈 상태 글', (await visText('chat-list-empty')).includes('아직 열린 대화방이 없어요'), '');
  await shot('14_빈목록');
  await measure('빈 목록');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('Z', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('Z', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
} catch (error) {
  console.log(`[실패] 실행 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n')}`);
  exitCode = 1;
  try {
    await shot('오류');
  } catch {
    /* 캡처 실패 */
  }
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nW5 점검${reduced ? '(동작 줄이기)' : ''}: 통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
