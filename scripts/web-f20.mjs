// F20 웹 흐름 점검: 정식 설문 v2(/survey/v2). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/, 또는 같은 설정으로 만든 다른 폴더를 인자로).
//  헤드리스 Edge 로 사람처럼 누른다: 시작 안내 → 필수 흐름 64(보이는 것만) → 결혼 이야기 → 세부사항(증빙) → 검토 → [제출하고 사진 올리기] → 05
//  점검: 막는 검증 · 자동 넘김 · 종교 '그 외' 안내 · '말하고 싶지 않아요' 안내 · 학교 검색(줄임말 · 옛 이름 · 2자부터) · 진행 막대 · 저장(모의 서버 창구 __surveyV2Peek)
//        · W8 정치성향 단계: CK15 별도 동의 전 저장 0 · 키보드(← → Home End) · 스크린리더 값 말 · 마우스 끌기 · 저장 뒤 결혼 이야기 · 화면 숫자 0
//        · 가로 넘침 0 · 글자 12 이상 · 누르는 면 44 이상 · 화면 글에 점수 · 등급 숫자 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR]/F20_*.png · 폭은 SHOT_WIDTH(기본 390)
// 사용: SHOT_WIDTH=360 SHOT_SUBDIR=F20_360 node scripts/web-f20.mjs [번들 폴더]   (npm run check:f20)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');
const width = Number(process.env.SHOT_WIDTH ?? 390);

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
const shot = async (name) => {
  const file = `F20_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${process.env.SHOT_SUBDIR ? `${process.env.SHOT_SUBDIR}/` : ''}${file}`);
};
const q = (id) => `window.__q(${JSON.stringify(id)})`;
const text = (id) => b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e)); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const visible = (id) => b.evaluate(`[...document.querySelectorAll('[data-testid="${id}"]')].some((e) => window.__visible(e))`);
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const tap = async (id) => {
  await b.click(`[data-testid="${id}"]`);
  await sleep(150);
};
const type = async (id, value) => {
  await b.type(`[data-testid="${id}"]`, value);
  await sleep(150);
};
const peek = () => b.evaluate('(window.__surveyV2Peek ? window.__surveyV2Peek() : [])');
const currentId = () =>
  b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid^="v2-block-"]')].find((e) => window.__visible(e)); return el ? el.getAttribute('data-testid').slice(9) : null; })()`);
const stageNow = () => b.evaluate(`['v2-intro','v2-politics','v2-story','v2-appeal','v2-review'].find((id) => !!window.__q(id)) ?? 'flow'`);

// 가로 넘침 · 글자 · 누르는 면(설문_인수조건 E-5: 가로 스크롤 0 · 글자 12 이상 · 누르는 면 44 이상)
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

// 지금 문항 하나에 답하고 다음으로(자동 넘김이면 기다린다)
const ANSWER = {
  A07: 'never', A08: 'none', A11: 'done', B01: 'univ', B06: 'grad', B07: 'no', B04: 'degree', C01: 'large', C03: 'staff', C04: 'regular', C05: 'inc06', C06: 'ast04', D04: 'pas03', D05: '1', D06: 'first',
  A09: 'no', A10: 'rare', E12: 'morning', E10: 'talk_now', E01: 'y1', E02: 'yes', E06: 'seoul', E07: 'joint', F03: 'univ', F14: 'any', F15: 'any', F16: 'any', F05: 'any',
};
const TEXT = {
  B03: '경영학', C02: '한빛전자', T01: '조용한 주말을 좋아하고 산책을 자주 하는 편이에요.', T02: '평일 저녁에는 같이 밥을 먹고 주말에는 함께 걷고 싶어요.', T03: '서로를 존중하는 마음이에요.',
};
async function answerCurrent(id) {
  const before = id;
  const moved = () => wait(`!${q(`v2-block-${before}`)} || !window.__visible(${q(`v2-block-${before}`)})`, 1500);
  if (ANSWER[id]) {
    await tap(`v2-${id}-opt-${ANSWER[id]}`);
    if (await moved()) return;
  } else if (TEXT[id]) await type(`v2-${id}-input`, TEXT[id]);
  else if (id === 'A05') await type('v2-A05-input', '172');
  else if (id === 'A03') {
    await tap('v2-A03-sido-seoul');
    await tap('v2-A03-sigungu-22');
  } else if (id === 'B02' || id === 'B05') {
    await type(`v2-${id}-search`, '연대');
    await wait(`!!${q(`v2-${id}-hit-0`)}`, 5000);
    await tap(`v2-${id}-hit-0`);
  } else if (id === 'D08' || id === 'D09') await tap(`v2-${id}-opt-unknown`);
  else if (id === 'E11') {
    await tap('v2-E11-opt-travel');
    await tap('v2-E11-opt-food');
  } else if (/^E(0[3-5]|0[89]|1[4-6])$|^F11$/.test(id)) {
    await tap(`v2-${id}-opt-3`);
    if (await moved()) return;
  } else if (id === 'E13') await tap('v2-E13-keep');
  else if (id === 'F01' || id === 'F02') await tap(`v2-${id}-any`);
  else if (['F04', 'F06', 'F07', 'F08', 'F09', 'F10'].includes(id)) await tap(`v2-${id}-opt-any`);
  else if (id === 'F13') await tap('v2-F13-opt-F03');
  // F12 · 그 밖: 비워 두고 다음
  await tap('v2-next');
  await moved();
}

let exitCode = 0;
try {
  await b.open('/survey/v2', `!!${q('v2-intro')} || !!${q('v2-screen')}`);
  await b.waitFor(`!window.__q('splash')`, 8000); // 스플래시(약 2.8초)가 걷힌 뒤 누른다
  check('1', '시작 안내: 제목 · 다섯 줄 · [시작하기]', (await wait(`!!${q('v2-intro')}`)) && (await text('v2-intro')).includes('설문은 10분쯤 걸려요') && (await visible('v2-start')), await text('v2-intro-0'));
  await shot('01_시작안내');
  await layoutOk('시작 안내');

  await tap('v2-start');
  check('1', '이름 문항 · 섹션 머리 · 진행 표시 기본 · 1/7(성별 전에는 병역 숨김) · 공개 범위 · AI 미전송 줄', (await currentId()) === 'A12' && (await visible('v2-section-head')) && (await text('v2-step')) === '기본 · 1/7' && (await visible('v2-noai')), `${await currentId()} · ${await text('v2-step')}`);
  await tap('v2-next');
  check('2', '빈 칸으로 [다음] → 이동하지 않고 이유(답을 써 주세요.)', (await currentId()) === 'A12' && (await text('v2-error')) === '답을 써 주세요.', await text('v2-error'));
  await shot('02_막는검증');
  await type('v2-A12-input', '김하나');
  await tap('v2-next');
  await wait(`!!${q('v2-block-A02')}`);
  await tap('v2-A02-opt-male');
  const auto = await wait(`!!${q('v2-block-A03')}`, 3000);
  check('2', '하나 고르기는 고르면 잠깐 뒤 저장하고 다음 문항(자동 넘김)', auto && (await peek())[0]?.answers?.A02 === 'male', `지금 ${await currentId()}`);
  await shot('03_지역2단');
  await tap('v2-A03-sido-seoul');
  await tap('v2-A03-sigungu-22');
  await tap('v2-next');
  await wait(`!!${q('v2-block-A05')}`);
  await type('v2-A05-input', '172');
  await tap('v2-next');
  await wait(`!!${q('v2-block-A06')}`);
  await tap('v2-A06-opt-other');
  await sleep(900);
  check('4', "종교 '그 외' → '그 외'끼리만 추천 안내 · 자동으로 넘어가지 않음 · 자물쇠 줄", (await currentId()) === 'A06' && (await text('v2-other-note')).includes("'그 외'를 고른 분끼리만 추천해요") && (await visible('v2-sensitive')), await text('v2-other-note'));
  await shot('04_종교_그외');
  await tap('v2-A06-opt-none'); // 무교
  await wait(`!!${q('v2-block-A07')}`, 3000);
  check('4', '종교 필수 · 무교를 고를 수 있다 · 저장값 none', (await peek())[0]?.answers?.A06 === 'none', JSON.stringify((await peek())[0]?.answers?.A06));

  // 필수 흐름 나머지: 보이는 문항만 차례로
  let guard = 0;
  let sawSchool = false;
  let sawDecline = false;
  for (let id = await currentId(); id && (await stageNow()) === 'flow' && guard < 90; id = await currentId(), guard += 1) {
    if (id === 'B02' && !sawSchool) {
      sawSchool = true;
      await type('v2-B02-search', '연');
      await sleep(500);
      const oneChar = !(await visible('v2-B02-results'));
      await type('v2-B02-search', '관동대학교');
      await wait(`!!${q('v2-B02-hit-0')}`, 5000);
      const oldName = (await text('v2-B02-hit-0-name')) === '가톨릭관동대학교' && (await text('v2-B02-hit-0-sub')).includes('(옛 이름 관동대학교)');
      await type('v2-B02-search', 'ㅅㅇㄷ');
      await wait(`window.__q('v2-B02-hit-0-name') && window.__q('v2-B02-hit-0-name').innerText.includes('서울대학교')`, 5000);
      const cho = (await text('v2-B02-hit-0-name')) === '서울대학교';
      await type('v2-B02-search', '독학사');
      await wait(`window.__q('v2-B02-hit-0-name') && window.__q('v2-B02-hit-0-name').innerText.includes('독학')`, 5000);
      const dok = (await text('v2-B02-hit-0-name')).includes('독학학위제');
      await type('v2-B02-search', '연대');
      await wait(`window.__q('v2-B02-hit-0-name') && window.__q('v2-B02-hit-0-name').innerText.includes('연세')`, 5000);
      check('3', '학교 검색: 1자는 목록 없음 · 옛 이름(관동대 → 가톨릭관동대) · 초성(ㅅㅇㄷ) · 독학사 행 · 줄임말(연대)', oneChar && oldName && cho && dok && (await text('v2-B02-hit-0-name')) === '연세대학교', `1자 ${oneChar} · 옛 이름 ${oldName} · 초성 ${cho} · 독학사 ${dok}`);
      check('3', '목록 밖 보기(목록에 없는 국내 · 해외 학교)가 결과 아래에 늘 보인다', (await visible('v2-B02-opt-unlisted_kr')) && (await visible('v2-B02-opt-unlisted_abroad')));
      await shot('05_학교검색');
      await layoutOk('학교 검색');
      await tap('v2-B02-hit-0');
      check('3', '고르면 한 장으로 접히고 [바꾸기]', (await text('v2-B02-picked-name')) === '연세대학교' && (await visible('v2-B02-change')));
      await tap('v2-next');
      await wait(`!${q('v2-block-B02')}`, 3000);
      continue;
    }
    if (id === 'C05' && !sawDecline) {
      sawDecline = true;
      await tap('v2-C05-opt-decline');
      await sleep(700);
      check('2', "'말하고 싶지 않아요' → '답하면 등급이 오를 수 있어요.' · 자동으로 넘어가지 않음 · 구간 공개 줄", (await currentId()) === 'C05' && (await text('v2-decline-hint')) === '답하면 등급이 오를 수 있어요.' && (await text('v2-visibility')).includes('구간'), await text('v2-decline-hint'));
      await shot('06_말하고싶지않아요');
      await tap('v2-C05-opt-inc06');
      await wait(`!${q('v2-block-C05')}`, 3000);
      continue;
    }
    if (id === 'E01') {
      await tap('v2-E01-opt-y1');
      await sleep(700);
      const stay = (await currentId()) === 'E01';
      await tap('v2-public');
      await b.evaluate(`(() => { const el = window.__q('v2-public-preview'); if (el) el.scrollIntoView({ block: 'center' }); })()`);
      await sleep(300);
      check('1', "결혼관 '내 프로필에 보이기'(처음 꺼짐) → 켜면 상대에게 보일 글 미리보기", stay && (await text('v2-public-preview')).includes('1년 사이에 결혼하고 싶어요'), await text('v2-public-preview'));
      await shot('07_결혼관_공개');
      await tap('v2-next');
      await wait(`!${q('v2-block-E01')}`, 3000);
      continue;
    }
    if (id === 'F13') await shot('08_상위3개');
    await answerCurrent(id);
  }
  // ── W8 정치성향(흐름 끝 → 결혼 이야기 앞) ──
  const polText = async () => (await text('v2-politics')) + ' ' + (await text('v2-cta'));
  check('W8', '필수 흐름 끝 → 정치성향 단계 · CK15 별도 동의 안내 · 양 끝 진보 · 보수 · 화면 글에 숫자 0', (await wait(`!!${q('v2-politics')}`, 4000)) && (await text('v2-pol-consent')).includes('민감정보') && (await polText()).includes('진보') && (await polText()).includes('보수') && !/\d/.test(await polText()), (await polText()).slice(0, 80));
  await shot('W8_01_정치_동의전');
  await layoutOk('정치성향');
  await tap('v2-next');
  check('W8', '동의 전 [다음] → 이유 한 줄 · 서버 저장 0', (await text('v2-pol-reason')) === '동의해야 답을 저장할 수 있어요.' && (await peek())[0]?.ck15 === false && (await peek())[0]?.politicsSet === false, await text('v2-pol-reason'));
  await tap('v2-pol-check');
  const TRACK = `[...document.querySelectorAll('[data-testid="v2-pol-slider-track"]')].find((e) => window.__visible(e))`;
  const sliderInfo = () => b.evaluate(`(() => { const el = ${TRACK}; return el ? { role: el.getAttribute('role'), tab: el.getAttribute('tabindex'), vt: el.getAttribute('aria-valuetext'), label: el.getAttribute('aria-label'), dis: el.getAttribute('aria-disabled') } : null; })()`);
  const key = async (k, code) => {
    await b.cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code: k, windowsVirtualKeyCode: code });
    await b.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
    await sleep(120);
  };
  let si = await sliderInfo();
  check('W8', '막대: 역할 slider · 키보드로 갈 수 있음(tabindex 0) · 이름 · 값은 말(아직 정하지 않았어요)', si?.role === 'slider' && si?.tab === '0' && si?.label === '정치 성향 막대' && si?.vt === '아직 정하지 않았어요' && si?.dis !== 'true', JSON.stringify(si));
  await b.evaluate(`(() => { const el = ${TRACK}; el.scrollIntoView({ block: 'center' }); el.focus(); })()`);
  await key('ArrowRight', 39);
  const first = (await sliderInfo())?.vt;
  for (let i = 0; i < 4; i += 1) await key('ArrowRight', 39);
  const right4 = (await sliderInfo())?.vt;
  await key('Home', 36);
  const home = (await sliderInfo())?.vt;
  await key('End', 35);
  const end = (await sliderInfo())?.vt;
  check('W8', '키보드: 첫 → 가운데 · → 네 번 조금 보수 쪽 · Home 진보 쪽 · End 보수 쪽', first === '가운데' && right4 === '조금 보수 쪽' && home === '진보 쪽' && end === '보수 쪽', [first, right4, home, end].join(' / '));
  const rect = await b.evaluate(`(() => { const r = ${TRACK}.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; })()`);
  await b.mouse('mouseMoved', rect.x + rect.w * 0.5, rect.y);
  await b.mouse('mousePressed', rect.x + rect.w * 0.5, rect.y);
  await sleep(80);
  for (const f of [0.45, 0.38, 0.3, 0.25]) {
    await b.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + rect.w * f, y: rect.y, button: 'left', buttons: 1 });
    await sleep(60);
  }
  await b.mouse('mouseReleased', rect.x + rect.w * 0.25, rect.y);
  await sleep(200);
  const dragged = (await sliderInfo())?.vt;
  check('W8', '마우스: 가운데를 눌러 왼쪽으로 끌면 조금 진보 쪽(손잡이가 따라옴) · 숫자 0', dragged === '조금 진보 쪽' && !/\d/.test(await polText()), dragged);
  await shot('W8_02_정치_끌기');
  await tap('v2-next');
  await wait(`!!${q('v2-story')}`, 5000);
  const pp = (await peek())[0] ?? {};
  check('W8', '[다음] → CK15 기록 · 저장(칸 2 = 조금 진보) → 결혼 이야기 · 설문 답에 정치 값 없음', pp.ck15 === true && pp.politicsSet === true && pp.politicsBand === 2 && (await stageNow()) === 'v2-story' && !Object.keys(pp.answers ?? {}).some((k) => /pol/i.test(k)), `ck15 ${pp.ck15} · 칸 ${pp.politicsBand} · ${await stageNow()}`);

  const p = (await peek())[0] ?? {};
  check('1', '필수 흐름을 끝내면 결혼 이야기 단계 · 서버에 첫 빈 문항 없음', (await stageNow()) === 'v2-story' && p.firstMissing === null, `단계 ${await stageNow()} · 첫 빈 ${p.firstMissing} · 저장 ${p.answered?.length}`);
  check('1', "자동 값: 형제 1명 → 몇째 저장 · 남성 → 병역 답 · '그 외' 아님 → F07 저장", p.answers?.D06 === 'first' && p.answers?.A11 === 'done' && Array.isArray(p.answers?.F07));

  // 결혼 이야기
  await tap('v2-Q17-head');
  await type('v2-Q17-input', '명절에는 양가를 번갈아 하루씩 다녀오고 싶어요.');
  check('1', '결혼 이야기: 카드를 펼쳐 쓰면 미리보기 · {n}/3', (await visible('v2-Q17-preview')) && (await text('v2-story-count')) === '1/3', await text('v2-story-count'));
  await shot('09_결혼이야기');
  await tap('v2-next');
  await wait(`!!${q('v2-appeal')}`, 5000);

  // 세부사항
  check('3', '세부사항: 유학이 있으면 T04 를 펼친 채 시작 · AI 안내 상자', (await visible('v2-T04-input')) && (await visible('v2-appeal-aibox')));
  await type('v2-T04-input', '미국에서 2년 동안 대학원 석사 과정을 마쳤어요. 연락은 010-1234-5678');
  await sleep(900);
  check('3', '연락처 모양은 막지 않고 안내(text_guard 같은 규칙, 나만 칸 글)', await visible('v2-T04-contact'), await text('v2-T04-contact'));
  await tap('v2-T04-upload');
  await wait(`window.__q('v2-T04-proof') && window.__q('v2-T04-proof').innerText.includes('확인 중')`, 5000);
  check('3', '[증빙 올리기] → 확인 중', (await text('v2-T04-proof')) === '확인 중', await text('v2-T04-proof'));
  await tap('v2-T08-head');
  await type('v2-T08-input', '온라인 가게를 2년째 운영하고 있어요.');
  await shot('10_세부사항');
  await layoutOk('세부사항');
  await tap('v2-next');
  await wait(`!!${q('v2-review')}`, 5000);

  // 검토
  const p2 = (await peek())[0] ?? {};
  check('1', '세부사항 글 · 결혼 이야기가 저장됐다(free_texts · 질문 소개 칸)', !!p2.texts?.T04 && !!p2.texts?.T08 && p2.prompts?.some((x) => x.code === 'Q17'), `${Object.keys(p2.texts ?? {}).join(',')} · ${JSON.stringify(p2.prompts?.map((x) => x.code))}`);
  check('1', '검토: 주제별 답 · 학교 · 소득 구간 글', (await text('v2-review-answer-B02')) === '연세대학교' && (await text('v2-review-answer-C05')) === '6천만~7천만 원', `${await text('v2-review-answer-B02')} · ${await text('v2-review-answer-C05')}`);
  const bodyText = await b.evaluate('document.body.innerText');
  check('E', '화면 글에 점수 · 등급 숫자 · 순위 말이 없다', !/점수|등급\s*\d|\d\s*등급|순위/.test(bodyText));
  await shot('11_검토');
  await layoutOk('검토');
  await b.evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid="v2-scroll"]')].find((e) => window.__visible(e)); if (el) el.scrollTop = el.scrollHeight; })()`);
  await sleep(300);
  await shot('12_검토_아래');
  await tap('v2-submit');
  check('1', '[제출하고 사진 올리기] → 05 사진', await wait(`location.pathname === '/photos'`, 8000), await b.evaluate('location.pathname'));

  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('E', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && outside.length === 0, `${b.errors.slice(0, 3).join(' | ')} ${outside.slice(0, 3).map((r) => r.url).join(' ')}`);
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
console.log(`\nF20 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
