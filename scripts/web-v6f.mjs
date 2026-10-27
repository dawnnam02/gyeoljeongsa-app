// V6-F 웹 점검: 대화형 설문(/survey/01 — 데모는 스위치 survey_chat 켜짐). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버 · 실제 AI 호출 0).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/).
//  헤드리스 Edge 로 사람처럼 누른다: 시작(AI 고지) → 이름은 한글 입력기 흉내(CDP imeSetComposition)로 → 1부 전부(하나 고르기는 바로 · 나머지 [이렇게 할게요])
//        → 지난 답 고치기 → 정치 막대 [나중에] → CK16(같은 무게 버튼 둘) 동의 → 2부 글 입력(한글 조합) → AI 대본 답 → [여기까지 할게요] → 07 내 성향 → 글 문항 → [답 한눈에 보기]
//  점검: 진행 표시는 섹션 이름(숫자 0) · 저장 키(모의 서버 창구 __surveyV2Peek) · 행동 숫자는 동의자만 6개 키(__surveyChatPeek — 값 0) · 내 성향 숫자 0
//        · 가로 넘침 0 · 글자 12 이상 · 누르는 면 44 이상 · 콘솔 오류 0 · 바깥 요청 0
//  --reduced-motion: 동작 줄이기 — 새 말풍선이 나올 때 위치가 움직이는 요소 0(투명도만) · 입력 중 점은 멈춤
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 또는 V6F_{폭}]/V6F_*.png · 폭 SHOT_WIDTH(기본 390)
// 사용: SHOT_WIDTH=360 node scripts/web-v6f.mjs [번들 폴더] [--reduced-motion]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const args = process.argv.slice(2);
const reduced = args.includes('--reduced-motion');
const distDir = path.resolve(APP_DIR, args.find((a) => !a.startsWith('--')) ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? `V6F_${width}${reduced ? '_줄이기' : ''}`);

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

const b = await openBrowser({ distDir, shotDir, width, height: 800 });
if (reduced) await b.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const shot = async (name) => {
  const file = `V6F_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${path.basename(shotDir)}/${file}`);
};
const S = (id) => `[data-testid="${id}"]`;
const q = (id) => `window.__q(${JSON.stringify(id)})`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const visible = (id) => b.evaluate(`[...document.querySelectorAll('${S(id)}')].some((e) => window.__visible(e))`);
const tap = async (id) => {
  await b.click(S(id));
  await sleep(200);
};
const type = async (id, value) => {
  await b.type(S(id), value);
  await sleep(150);
};
const peekV2 = async () => ((await b.evaluate('(window.__surveyV2Peek ? window.__surveyV2Peek() : [])')) ?? [])[0] ?? {};
const peekChat = async () => ((await b.evaluate('(window.__surveyChatPeek ? window.__surveyChatPeek() : [])')) ?? [])[0] ?? {};
const card = () => b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid^="chat-card-"]')].find((e) => window.__visible(e)); return el ? el.getAttribute('data-testid').slice(10) : null; })()`);
const nowLine = () => b.evaluate(`(() => { const el = ${q('chat-now')}; return el ? el.innerText.trim() : ''; })()`);

// 가로 넘침 · 글자 · 누르는 면(설문_인수조건 E-5)
async function layoutOk(label) {
  const m = await b.evaluate(`(() => {
    const iw = window.innerWidth;
    let minFont = 99;
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && window.__visible(el)) minFont = Math.min(minFont, parseFloat(getComputedStyle(el).fontSize));
    }
    const small = [];
    for (const el of document.querySelectorAll('[role=button],[role=checkbox],[role=radio],[role=switch],[role=link],button,a')) {
      if (!window.__visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 43.5 || r.height < 43.5) small.push((el.getAttribute('data-testid') || el.getAttribute('aria-label') || '').slice(0, 24) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
    return { scrollW: document.documentElement.scrollWidth, innerW: iw, minFont, small };
  })()`);
  check('E', `${label}: 가로 넘침 0 · 글자 12 이상 · 누르는 면 44 이상`, m.scrollW <= m.innerW && m.minFont >= 12 && m.small.length === 0, `폭 ${m.scrollW}/${m.innerW} · 최소 글자 ${m.minFont} · 작은 면 ${m.small.slice(0, 6).join(' ')}`);
}

// 동작 줄이기: 방금 나온 말풍선 · 카드가 위치를 옮기며 나오지 않는다(transform 이동 0). 보통 모드에서는 아래에서 떠오른다(이동 있음)
//  누르기 전에 화면 안에서 1.5초 동안 프레임마다 이동 중인 요소를 모은다
const startSampler = () =>
  b.evaluate(`(() => {
    window.__mv = new Set();
    const until = performance.now() + 1500;
    const tick = () => {
      for (const el of document.querySelectorAll('[data-testid="chat-scroll"] *')) {
        const t = getComputedStyle(el).transform;
        const m = t && t !== 'none' ? t.match(/matrix\\(([^)]+)\\)/) : null;
        if (!m) continue;
        const v = m[1].split(',').map(Number);
        if (Math.abs(v[4]) > 0.5 || Math.abs(v[5]) > 0.5) window.__mv.add((el.getAttribute('data-testid') || el.tagName).slice(0, 20));
      }
      if (performance.now() < until) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  })()`);
const movedList = () => b.evaluate('[...(window.__mv ?? [])]');

// 한글 → 조합 단계(초성 → 초성+중성 → 받침까지)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function stepsOf(ch) {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return [ch];
  const cho = Math.floor(code / 588);
  const jung = Math.floor((code % 588) / 28);
  const open = String.fromCharCode(0xac00 + cho * 588 + jung * 28);
  return code % 28 ? [CHO[cho], open, ch] : [CHO[cho], ch];
}
const domVal = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('${S(id)}')].find((e) => window.__visible(e) && 'value' in e) ?? [...document.querySelectorAll('${S(id)}')].find((e) => 'value' in e); return el ? el.value : null; })()`);
const focus = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('${S(id)}')].find((e) => window.__visible(e) && 'value' in e); el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); return true; })()`);
// 음절마다 조합 → 확정(윈도 · 맥 입력기). 조합 단계마다 칸 글 = 앞 글 + 조합 글인지 기록
async function compose(id, text) {
  await focus(id);
  const before = (await domVal(id)) ?? '';
  const bad = [];
  let acc = '';
  for (const ch of text) {
    for (const st of stepsOf(ch)) {
      await b.cdp.send('Input.imeSetComposition', { text: st, selectionStart: st.length, selectionEnd: st.length });
      await sleep(25);
      const now = await domVal(id);
      if (now !== before + acc + st) bad.push(`${st}: ${JSON.stringify((now ?? '').slice(-3))}`);
    }
    await b.cdp.send('Input.insertText', { text: ch });
    acc += ch;
    await sleep(15);
  }
  await sleep(250);
  return { value: await domVal(id), bad };
}

// 1부 답(남성 · 대학교 · 대기업 · 희망 조건 대부분 '상관없어요')
const CHOICE = { A02: 'male', A06: 'none', A07: 'never', A08: 'none', A11: 'done', B01: 'univ', B06: 'grad', B07: 'no', B04: 'none', C01: 'large', C03: 'staff', C04: 'regular', D05: '1', D06: 'first', A09: 'no', A10: 'rare', E12: 'morning', E10: 'talk_now', E01: 'y1', E02: 'yes', E06: 'seoul', E07: 'joint', F03: 'univ', F14: 'any' };
const BUCKET = { C05: 'inc06', C06: 'ast04', D04: 'pas03', F05: 'any', F15: 'any', F16: 'any' };
const shots = new Set(['A05', 'B02', 'C05', 'E14', 'E11', 'F01']);
async function answer(id) {
  if (shots.has(id)) await shot(`02_${id}`);
  if (CHOICE[id]) return tap(`v2-${id}-opt-${CHOICE[id]}`);
  if (BUCKET[id]) {
    await tap(`v2-${id}-opt-${BUCKET[id]}`);
    return tap('chat-send');
  }
  if (id === 'B03' || id === 'F12') return tap('chat-skip');
  if (id === 'C02') {
    await type('v2-C02-input', '한빛전자');
    return tap('chat-send');
  }
  if (id === 'A05') {
    await type('v2-A05-input', '172');
    return tap('chat-send');
  }
  if (id === 'A03') {
    await tap('v2-A03-sido-seoul');
    await tap('v2-A03-sigungu-22');
    return tap('chat-send');
  }
  if (id === 'B02' || id === 'B05') {
    await type(`v2-${id}-search`, '연대');
    await wait(`!!${q(`v2-${id}-hit-0`)}`, 5000);
    await tap(`v2-${id}-hit-0`);
    return tap('chat-send');
  }
  if (id === 'D08' || id === 'D09') {
    await tap(`v2-${id}-opt-unknown`);
    return tap('chat-send');
  }
  if (id === 'E11') {
    await tap('v2-E11-opt-travel');
    await tap('v2-E11-opt-food');
    return tap('chat-send');
  }
  if (/^E(0[3-5]|0[89]|1[4-6])$|^F11$/.test(id)) {
    await tap(`v2-${id}-opt-3`);
    return tap('chat-send');
  }
  if (id === 'E13') {
    await tap('v2-E13-keep');
    return tap('chat-send');
  }
  if (id === 'F01' || id === 'F02') {
    await tap(`v2-${id}-any`);
    return tap('chat-send');
  }
  if (['F04', 'F06', 'F07', 'F08', 'F09', 'F10'].includes(id)) {
    await tap(`v2-${id}-opt-any`);
    return tap('chat-send');
  }
  if (id === 'F13') {
    await tap('v2-F13-opt-F03');
    return tap('chat-send');
  }
  throw new Error(`답하는 법이 없는 문항 ${id}`);
}

let exitCode = 0;
try {
  // ═══ A. 시작 ═══
  await b.open('/survey/01', `!!${q('chat-intro')} || !!${q('chat-screen')}`);
  await b.waitFor(`!${q('splash')}`, 8000);
  check('A', '/survey/01 = 대화형 설문 시작(AI와 이야기해요 고지 · 30분 안내)', await wait(`!!${q('chat-intro')} && window.__text().includes('AI와 이야기해요') && window.__text().includes('30분')`, 10000));
  await shot('01_시작');
  await layoutOk('시작');
  await tap('chat-start');
  check('A', '첫 말풍선 위 AI 표시 · 이름 질문 · 진행 표시는 섹션 이름(숫자 0)', (await wait(`!!${q('chat-card-A12')}`)) && /^지금 이야기 · 기본$/.test(await nowLine()), await nowLine());

  // ═══ B. 이름: 한글 입력기 조합 ═══
  const ime = await compose('v2-A12-input', '김민지');
  check('B', "이름 '김민지' 조합 단계마다 칸 글 = 조합 글 · 끝난 뒤 자모 찌꺼기 0", ime.bad.length === 0 && ime.value === '김민지', `${ime.value} ${ime.bad.slice(0, 3).join(' ')}`);
  await tap('chat-send');
  await wait(`!!${q('chat-card-A02')}`);
  check('B', "저장 값 A12 = '김민지' · 받아 주는 말 '민지 님, 반가워요.'", (await peekV2()).answers?.A12 === '김민지' && (await b.evaluate(`window.__text().includes('민지 님, 반가워요.')`)));

  // ═══ C. 1부 전부 ═══
  const order = [];
  let movedNormal = null;
  for (let guard = 0; guard < 90; guard += 1) {
    const id = await card();
    if (!id) {
      await sleep(200);
      if (!(await card())) break;
      continue;
    }
    if (id === 'POL') break;
    order.push(id);
    if (id === 'A06') await startSampler();
    await answer(id);
    if (id === 'A06') {
      await sleep(1600);
      movedNormal = await movedList(); // 고른 뒤 1.5초 동안 위치를 옮긴 요소
    }
    if (!(await wait(`!${q(`chat-card-${id}`)} || !window.__visible(${q(`chat-card-${id}`)})`, 4000))) throw new Error(`${id} 에서 넘어가지 않았어요`);
    if (id === 'A11') {
      // QP-13: 내 답 말풍선(누르면 고치기)의 누르는 면 높이 48 이상
      const meSmall = await b.evaluate(`[...document.querySelectorAll('[data-testid^="chat-me-"]')].filter((e) => window.__visible(e) && e.getAttribute('role') === 'button').map((e) => [e.getAttribute('data-testid'), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 48)`);
      check('E', 'QP-13: 내 답 말풍선 누르는 면 높이 48 이상', Array.isArray(meSmall) && meSmall.length === 0, JSON.stringify(meSmall));
      // 지난 답 고치기: 성별 내 답을 눌러 그 자리에서
      await tap('chat-me-A02');
      const editing = await wait(`!!${q('chat-edit-start')}`, 3000);
      await shot('03_고치기');
      await tap('chat-edit-keep');
      check('C', '지난 답을 누르면 그 자리에서 고치기 · [그대로 둘게요]는 값 그대로', editing && (await peekV2()).answers?.A02 === 'male' && !(await visible('chat-edit-start')));
    }
  }
  if (reduced) check('R', '동작 줄이기: 새 말풍선 · 카드가 위치를 옮기며 나오지 않는다(투명도만)', Array.isArray(movedNormal) && movedNormal.length === 0, (movedNormal ?? []).join(' '));
  else check('R', '보통 모드: 새 말풍선은 아래에서 떠오른다(D42 2안 말풍선 6 · 240ms)', Array.isArray(movedNormal) && movedNormal.length > 0, `${(movedNormal ?? []).length}곳`);
  const p1 = await peekV2();
  const wantKeys = ['A12', 'A02', 'A03', 'A05', 'A06', 'A07', 'A08', 'A11', 'B01', 'B02', 'B06', 'B07', 'B04', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'D08', 'D09', 'D04', 'D05', 'D06', 'E14', 'E15', 'A09', 'A10', 'E12', 'E11', 'E10', 'E13', 'E16', 'E08', 'E09', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10', 'F14', 'F15', 'F16', 'F11', 'F13'];
  const missing = wantKeys.filter((k) => !(p1.answered ?? []).includes(k));
  check('C', `1부 ${order.length + 1}문항 대화로 · 저장 키(설문 v2 save_answers) ${wantKeys.length}개 · T01~T03 은 1부에 없음`, missing.length === 0 && !order.some((x) => /^T0[1-3]$/.test(x)) && p1.firstMissing === 'T01', `빠진 ${missing.join(',')} · 첫 빈 ${p1.firstMissing}`);
  check('C', '저장 값 모양(설문 v2 와 같은 코드): 학교 {school_key} · 지역 {sido, sigungu} · 상관없어요 any', typeof p1.answers?.B02?.school_key === 'string' && p1.answers?.A03?.sido === 'seoul' && p1.answers?.F01 === 'any' && JSON.stringify(p1.answers?.F04) === '["any"]', JSON.stringify({ B02: p1.answers?.B02, A03: p1.answers?.A03 }));

  // ═══ D. 정치 → CK16 ═══
  check('D', '희망 조건 끝 → 정치 막대(CK15 안내)', await wait(`!!${q('chat-card-POL')}`, 4000));
  await shot('04_정치');
  await tap('chat-pol-later');
  check('D', 'CK16 동의 카드(2부 바로 앞) · 다섯 안내', (await wait(`!!${q('chat-ck16')}`, 6000)) && (await b.evaluate(`['what','why','keys','keep','optional'].every((k) => !!window.__q('chat-ck16-' + k))`)));
  const sizes = await b.evaluate(`['chat-ck16-agree','chat-ck16-skip'].map((id) => { const r = window.__q(id).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })`);
  check('D', 'CK16 버튼 둘은 같은 무게(같은 크기 · 같은 모양)', sizes[0][0] === sizes[1][0] && sizes[0][1] === sizes[1][1], JSON.stringify(sizes));
  await shot('05_CK16');
  await layoutOk('CK16');
  check('D', '동의 전 행동 숫자 0', ((await peekChat()).behaviorsReceived ?? 0) === 0);
  await tap('chat-ck16-agree');

  // ═══ E. 2부 ═══
  check('E2', '2부: 동의 완료 · 다리 말 · 첫 질문 · 글 입력칸 · 지금 이야기 · 나를 소개', (await wait(`!!${q('chat-composer-input')}`, 8000)) && /나를 소개/.test(await nowLine()), await nowLine());
  const said = '가까운 사람들은 저를 차분하다고 말해요';
  const c1 = await compose('chat-composer-input', said);
  check('E2', '글 입력칸 한글 조합 깨짐 0', c1.bad.length === 0 && c1.value === said, `${c1.value} ${c1.bad.slice(0, 3).join(' ')}`);
  await tap('chat-composer-send');
  check('E2', '보내면 내 말풍선 · 점 3개 → AI 대본 답(모의)', await wait(`window.__text().includes('${said}') && !${q('chat-typing')} && window.__text().includes('하루가 어떻게 흘러가나요')`, 15000));
  const pc = await peekChat();
  check('E2', 'CK16 동의자: 메시지마다 숫자 6개만 저장(키 이름만 · 값 · 키 기록 0)', pc.behaviorsSaved === 1 && JSON.stringify(pc.savedKeys) === JSON.stringify(['chars_per_sec_x10', 'compose_ms', 'delete_ratio_pm', 'first_key_ms', 'pauses_3s', 'rewrites']), JSON.stringify(pc));
  await shot('06_인터뷰');
  await layoutOk('인터뷰');
  await type('chat-composer-input', '아홉 시에 출근해서 일곱 시쯤 퇴근해요.');
  await tap('chat-composer-send');
  await wait(`window.__text().includes('가족과는')`, 15000);
  await tap('chat-header-right'); // 여기까지 할게요 → 바로 정리(확인 시트 0)

  // ═══ F. 07 내 성향 ═══
  check('F', '[여기까지 할게요] → 정리 → 07 내 성향(요약 · 결혼에 대한 생각 · 자기소개 초안 · 이야기하는 방식)', await wait(`!!${q('chat-traits')} && window.__text().includes('한 줄로 보면') && window.__text().includes('이야기하는 방식')`, 15000));
  const traitsText = await b.evaluate(`window.__q('chat-traits').innerText`);
  check('F', '내 성향에 숫자 · 점수 · 등급 0', !/\d|점수|등급/.test(traitsText.replace(/\d+년|\d+개월|\d~\d/g, '')), traitsText.slice(0, 80));
  await shot('07_내성향');
  await layoutOk('내 성향');
  await tap('chat-traits-ok');
  check('F', '[이대로 좋아요] → 자기소개 초안이 T01 로 저장 · 남은 글 문항(T02) 초안이 칸에', (await wait(`!!${q('chat-card-T02')}`, 6000)) && !!(await peekV2()).texts?.T01 && ((await domVal('v2-T02-input')) ?? '').length >= 20);
  await tap('chat-send');
  await wait(`!!${q('chat-card-T03')}`, 6000);
  await tap('chat-send');
  check('F', '글 문항 끝 → [답 한눈에 보기] · 설문 v2 첫 빈 문항 없음', (await wait(`!!${q('chat-review')}`, 6000)) && (await peekV2()).firstMissing === null, String((await peekV2()).firstMissing));
  await shot('08_끝');
  await tap('chat-review');
  check('F', '[답 한눈에 보기] → 설문 v2 검토 화면', await wait(`location.pathname === '/survey/v2' && !!${q('v2-review')}`, 10000), await b.evaluate('location.pathname'));

  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('Z', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && outside.length === 0, `${b.errors.slice(0, 3).join(' | ')} ${outside.slice(0, 3).map((r) => r.url).join(' ')}`);
} catch (error) {
  console.log(`[실패] 진행 중 멈춤: ${error.message}`);
  try {
    await shot('99_멈춤');
  } catch {
    /* 캡처 못 함 */
  }
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nV6-F 웹 점검(${width}${reduced ? ' · 동작 줄이기' : ''}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
