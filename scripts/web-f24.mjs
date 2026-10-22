// F24 웹 점검(데모 인물 24명 · 인물 사진 · 끼리끼리 장면). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/, 또는 같은 설정으로 다른 폴더). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 09 오늘의 추천(기본 계정): 김OO · 박OO · 최OO 3장 · 세 장 모두 인물 사진(기본 그림 0 · 파일이 실제로 읽힘) · 머리 오른쪽 위 '나' 사진
//  2 10 상대 상세: 사진 3장(사진 1 / 3 · 넘기면 전신) · 한눈에 줄(결혼 시기) · 비구독자에게 등급 칸 0
//    + 질문 카드 칸(저를 소개해요 · 2장 · 받는 쪽 한 줄) → 결혼관 칸(켠 줄만, 숫자 · 등급 말 0) · 박OO(결혼관 켠 칸 없음)은 결혼관 칸 0 (D-142 · F21 이 넣은 두 칸)
//  3 11 호감: 받은 · 보낸 · 연결됨 행이 인물 이름과 얼굴 사진(기본 그림 0)
//  4 16 1회 매칭: 받기 → 09 추가 3장도 인물 사진
//  5 끼리끼리(구독 · kk4 계정): 09 위 데모 줄 · 같은 등급 가까운 분 3장 + 동의한 분만 칩 → 데모 줄로 '나' 5 → 목록이 바뀐다 · 내 등급 화면 5
//  6 남성 '나'(asmale): 09 · 11 이 여성 인물 · 사진
//  7 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 F24_<폭>]/F24_*.png
// 사용: node scripts/web-f24.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-f24.mjs [번들 폴더]
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `F24_${width}`;
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

const b = await openBrowser({ distDir, shotDir, width, height: 800 });
const shot = async (name) => {
  const file = `F24_${name}.png`;
  await b.shot(file);
  console.log(`       스크린샷 확인/스크린샷/${subdir}/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const wait = (expr, ms = 10000) => b.waitFor(expr, ms);
const path0 = () => b.evaluate('location.pathname');
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-f24-target]').forEach((e) => e.removeAttribute('data-f24-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-f24-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(200);
  await b.click('[data-f24-target="1"]');
  await sleep(400);
};
// 사진 칸 하나: 기본 그림이 있나 · 그림 주소 · 실제로 읽혔나(웹 Image 는 숨은 img 와 바탕 그림을 함께 둔다)
const photoInfo = (id) =>
  b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return null; const img = el.querySelector('img'); const bg = [...el.querySelectorAll('div')].map((d) => getComputedStyle(d).backgroundImage).find((x) => x && x !== 'none') || ''; return { def: !!el.querySelector('[data-testid$="-default"]'), src: img ? img.getAttribute('src') || '' : '', loaded: !!img && img.complete && img.naturalWidth > 0, bg }; })()`);
const photoOk = async (id, key) => {
  await wait(`(() => { const el = ${visQ(id)}; const img = el && el.querySelector('img'); return !!img && img.complete && img.naturalWidth > 0; })()`, 8000);
  const p = await photoInfo(id);
  const ok = !!p && !p.def && p.loaded && (p.src + p.bg).includes('/demo/people/') && (!key || (p.src + p.bg).includes(key));
  return { ok, detail: p ? `${(p.src || p.bg).split('/').pop()?.slice(0, 30) ?? ''}${p.def ? ' · 기본 그림' : ''}${p.loaded ? '' : ' · 안 읽힘'}` : '칸 없음' };
};
const allPhotos = async (ids) => {
  const out = [];
  for (const [id, key] of ids) out.push({ id, ...(await photoOk(id, key)) });
  return { ok: out.every((x) => x.ok), detail: out.map((x) => `${x.id}:${x.detail}`).join(' / ') };
};
// 보이는 화면에 기본 그림(사진 칸 · 원)이 하나도 없나
const defaultArtCount = () => b.evaluate(`[...document.querySelectorAll('[data-testid$="-default"]')].filter((e) => window.__visible(e)).length`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('7', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}
const goTab = async (label, pathname) => {
  for (let i = 0; i < 3; i += 1) {
    await b.click(`[role=tab][aria-label="${label}"]`);
    if (await wait(`location.pathname === '${pathname}'`, 4000)) return true;
  }
  return false;
};
const heads = async (n, prefix = 'rec-head-') => {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(await visText(`${prefix}${i}`));
  return out;
};
const RECEIVER_NOTE = '서로 수락한 뒤의 연락 방법은 준비 중이에요. 불편한 글은 신고할 수 있어요.'; // NF10-04(content/contactHintCopy)
const startsAll = (got, want) => want.every((w, i) => (got[i] ?? '').startsWith(w));

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000);
  await b.type(sel('signin-email'), email.replace('@', 'v4on@')); // V5(W10): 숨긴 v4 화면(09 · 11 · 16)을 켜는 데모 장면
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
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-card-0')`, 20000);
}
const backFromCandidate = async () => {
  if (await vis('candidate-header-back')) await tap('candidate-header-back');
  else await b.evaluate('history.back()');
  return wait(`location.pathname === '/recommendations' || location.pathname === '/likes'`, 6000);
};

let exitCode = 0;
try {
  // ═══ 1. 09 기본 계정 ═══
  check('1', '기본 데모 계정으로 가입을 마치면 09 에 카드가 나온다', await toRecs('f24plain@email.com'), await path0());
  await sleep(1500);
  const h1 = await heads(3);
  check('1', '09 세 장 = 데모 인물 김OO 32 · 박OO 30 · 최OO 33(예전 고정 목록 그대로)', startsAll(h1, ['김OO · 32 · 서울 강남', '박OO · 30 · 경기 성남', '최OO · 33 · 서울 송파']), h1.join(' / '));
  const p1 = await allPhotos([
    ['rec-photo-0', 'p21_face'],
    ['rec-photo-1', 'p14_face'],
    ['rec-photo-2', 'p23_face'],
  ]);
  check('1', '09 세 장 모두 인물 사진(B24 종이 컷아웃) · 기본 그림 0 · 파일이 실제로 읽힌다', p1.ok, p1.detail);
  const me = await photoOk('profile-button-avatar', 'p01_face');
  check('1', "머리 오른쪽 위 원 = 데모 '나'(이하나) 사진(p01) · 기본 그림 아님", me.ok, me.detail);
  check('1', '09 화면에 보이는 기본 그림 0', (await defaultArtCount()) === 0, `${await defaultArtCount()}개`);
  check('1', '09 에 등급 말 0(비구독자) · 끼리끼리 데모 줄 없음(장면 계정이 아님)', !(await b.evaluate(`document.body.innerText.includes('등급')`)) && !(await vis('kin-demo')), '');
  await shot('09_기본_인물사진');
  await measure('09');

  // ═══ 2. 10 상대 상세 ═══
  await tap('rec-card-0');
  await wait(`!!${visQ('candidate-head')}`, 10000);
  await sleep(800);
  check('2', '10 머리 "김OO · 32 · 서울 강남구"', (await visText('candidate-head')) === '김OO · 32 · 서울 강남구', await visText('candidate-head'));
  const c0 = await photoOk('candidate-photo-0', 'p21_face');
  check('2', '10 첫 사진 = 얼굴 사진(p21_face) · "사진 1 / 3"', c0.ok && (await visText('candidate-photo-index')) === '사진 1 / 3', `${c0.detail} · ${await visText('candidate-photo-index')}`);
  const glance = await visText('candidate-glance');
  check('2', '10 한눈에 줄: 나이 · 키 · 지역 · 결혼 시기(공개로 켠 결혼관 "1년~2년")', glance.includes('결혼 시기') && glance.includes('1년~2년') && glance.includes('178cm'), glance);
  check('2', '10 비구독자: 등급 칸 0', !(await vis('candidate-grade')), '');
  await shot('10_상세_사진1');
  await tap('candidate-photo-next');
  await sleep(900);
  check('2', '다음 화살표 → "사진 2 / 3"(전신)', (await visText('candidate-photo-index')) === '사진 2 / 3', await visText('candidate-photo-index'));
  const c1 = await photoOk('candidate-photo-1', 'p21_full');
  check('2', '10 둘째 사진 = 전신(p21_full) · 기본 그림 0', c1.ok, c1.detail);
  await shot('10_상세_사진2');
  // 질문 카드 칸 → 결혼관 칸(한눈에 줄 다음, D-142)
  check('2', '질문 카드 칸: 제목 "저를 소개해요" · 2장(명절 · 돈 약속 질문 + 답) · 3장째 없음 · 아래 받는 쪽 한 줄', (await vis('candidate-prompts')) && (await visText('candidate-prompts-title')) === '저를 소개해요' && (await visText('candidate-prompts-0-q')) === '명절을 보내고 싶은 모습은?' && (await visText('candidate-prompts-1-q')) === '둘이 정하고 싶은 돈 약속 하나는?' && (await visText('candidate-prompts-0-a')).length >= 10 && (await visText('candidate-prompts-1-a')).length >= 10 && !(await vis('candidate-prompts-2')) && (await visText('candidate-prompts-note')) === RECEIVER_NOTE, `${await visText('candidate-prompts-0-q')} / ${await visText('candidate-prompts-1-q')} / ${await visText('candidate-prompts-note')}`);
  const mrows = [];
  for (const id of ['E01', 'E02', 'E03', 'E05', 'E06', 'E07']) if (await vis(`candidate-marriage-${id}`)) mrows.push(`${await visText(`candidate-marriage-${id}-label`)}:${await visText(`candidate-marriage-${id}-text`)}`);
  check('2', '결혼관 칸: 제목 "결혼관" · 김OO 이 켠 세 줄만(결혼 시기 · 자녀 · 사는 곳) 완성 글로', (await visText('candidate-marriage-title')) === '결혼관' && JSON.stringify(mrows) === JSON.stringify(['결혼 시기:1년에서 2년 사이에 결혼하고 싶어요', '자녀:자녀를 갖고 싶은 편이에요', '사는 곳:결혼하면 서울에서 살고 싶어요']), mrows.join(' / '));
  const sectionText = await visText('candidate-marriage') + ' ' + (await visText('candidate-prompts'));
  check('2', '두 칸에 점수 · 등급 · 순위 · % 말 0', !/점수|등급|순위|등수|상위|하위|%/.test(sectionText), '');
  const order = await b.evaluate(`['candidate-glance', 'candidate-prompts', 'candidate-marriage'].map((id) => { const el = [...document.querySelectorAll('[data-testid="' + id + '"]')].find((e) => window.__visible(e)); return el ? el.getBoundingClientRect().top : NaN; })`);
  check('2', '놓인 차례: 한눈에 줄 → 질문 카드 → 결혼관', order.every((v) => Number.isFinite(v)) && order[0] < order[1] && order[1] < order[2], order.map((v) => Math.round(v)).join(' < '));
  await b.evaluate(`(() => { const el = ${visQ('candidate-prompts')}; if (el) el.scrollIntoView({ block: 'start' }); })()`);
  await sleep(500);
  await shot('10_질문카드_결혼관');
  await measure('10');
  await backFromCandidate();
  // 박OO: 결혼관을 하나도 켜지 않은 분 → 결혼관 칸 0, 질문 카드는 있음
  await wait(`!!${visQ('rec-card-1')}`, 8000);
  await tap('rec-card-1');
  await wait(`(() => { const el = ${visQ('candidate-head')}; return !!el && el.innerText.startsWith('박OO'); })()`, 10000);
  await sleep(800);
  check('2', '박OO(결혼관 켠 칸 없음): 결혼관 칸 0 · 질문 카드 2장은 있음', !(await vis('candidate-marriage')) && (await vis('candidate-prompts-1')) && !(await vis('candidate-prompts-2')), `결혼관 ${await vis('candidate-marriage')} · 질문 카드 ${await vis('candidate-prompts')}`);
  await shot('10_박OO_결혼관없음');
  await backFromCandidate();

  // ═══ 3. 11 호감 ═══
  check('3', '11 호감 탭으로', await goTab('호감', '/likes'), await path0());
  await wait(`!!${visQ('like-head-received-0')}`, 10000);
  await sleep(800);
  const r = await heads(2, 'like-head-received-');
  check('3', '받은 호감 2행 = 인물 박OO 29 · 윤OO 34', startsAll(r, ['박OO · 29 · 경기 성남', '윤OO · 34 · 서울 서초']), r.join(' / '));
  const lp = await b.evaluate(`[...document.querySelectorAll('[data-testid^="like-photo-"]')].filter((e) => window.__visible(e) && !/-default$/.test(e.getAttribute('data-testid'))).map((e) => e.getAttribute('data-testid'))`);
  const lpr = await allPhotos(lp.map((id) => [id, null]));
  check('3', '받은 호감 행 얼굴 사진 모두 인물 사진(기본 그림 0)', lp.length === 2 && lpr.ok, `${lp.length}칸 · ${lpr.detail}`);
  await shot('11_받은호감');
  await b.click(sel('likes-tab-sent'));
  await wait(`!!${visQ('like-head-sent-0')}`, 6000);
  await sleep(600);
  check('3', '보낸 호감 = 문OO 32 · 얼굴 사진(p18)', (await visText('like-head-sent-0')).startsWith('문OO · 32 · 서울 마포') && (await b.evaluate(`[...document.querySelectorAll('[data-testid^="like-photo-"]')].some((e) => window.__visible(e) && (e.querySelector('img')?.getAttribute('src') || '').includes('p18_face'))`)), await visText('like-head-sent-0'));
  await b.click(sel('likes-tab-connected'));
  await wait(`!!${visQ('like-head-connected-0')}`, 6000);
  await sleep(600);
  check('3', '연결됨 = 한OO 31 · 얼굴 사진(p24)', (await visText('like-head-connected-0')).startsWith('한OO · 31 · 서울 강서') && (await b.evaluate(`[...document.querySelectorAll('[data-testid^="like-photo-"]')].some((e) => window.__visible(e) && (e.querySelector('img')?.getAttribute('src') || '').includes('p24_face'))`)), await visText('like-head-connected-0'));
  check('3', '11 화면에 보이는 기본 그림 0', (await defaultArtCount()) === 0, `${await defaultArtCount()}개`);
  await shot('11_연결됨');
  await measure('11');

  // ═══ 4. 16 1회 매칭 → 09 추가 ═══
  check('4', '16 상점 탭으로', await goTab('상점', '/shop'), await path0());
  await wait(`!!window.__q('screen-16')`);
  await tap('shop-match-detail');
  await wait(`!!window.__q('detail-buy')`);
  await tap('detail-buy');
  await tap('purchase-pay');
  await tap('purchase-demo-buy');
  await wait(`!!window.__q('purchase-done-take')`);
  await tap('purchase-done-take');
  await wait(`!!window.__q('match-take')`);
  await tap('match-take');
  check('4', '1회 매칭 받기 → 09 "추가로 받은 추천"', await wait(`location.pathname === '/recommendations' && !!window.__q('recs-extra-title')`, 10000), await path0());
  await sleep(3800);
  const h4 = [await visText('rec-head-3'), await visText('rec-head-4'), await visText('rec-head-5')];
  check('4', '추가 3장 = 인물 이OO 31 · 장OO 37 · 윤OO 34', startsAll(h4, ['이OO · 31 · 서울 서초', '장OO · 37 · 부산 해운대', '윤OO · 34 · 서울 서초']), h4.join(' / '));
  const p4 = await allPhotos([
    ['rec-photo-3', 'p17_face'],
    ['rec-photo-4', 'p19_face'],
    ['rec-photo-5', 'p16_face'],
  ]);
  check('4', '추가 3장도 인물 사진(기본 그림 0)', p4.ok, p4.detail);
  await b.evaluate(`(() => { const el = window.__q('recs-extra-title'); if (el) el.scrollIntoView({ block: 'start' }); })()`);
  await sleep(500);
  await shot('09_1회매칭_추가');

  // ═══ 5. 끼리끼리(구독 · kk4) ═══
  check('5', '끼리끼리 장면 계정(shopsub-kk4)으로 09', await toRecs('shopsub-kk4@email.com'), await path0());
  await sleep(1500);
  check('5', '09 위 데모 줄 "데모 · 끼리끼리: 내 등급 4 (누르면 5)"', (await wait(`!!${visQ('kin-demo')}`, 6000)) && (await visText('kin-demo')) === '데모 · 끼리끼리: 내 등급 4 (누르면 5)', await visText('kin-demo'));
  const k4 = await heads(3);
  check('5', "'나' 4: 나보다 위(이OO 3) → 같은 등급(문OO 4) → 한 단계 아래(장OO 5) — 같은 등급 가까운 분만", startsAll(k4, ['이OO · 31 · 서울 서초', '문OO · 32 · 서울 마포', '장OO · 37 · 부산 해운대']), k4.join(' / '));
  check('5', '구독자 칩은 지금 규칙대로(동의한 분만): 3등급 · 4등급 · 장OO 은 칩 없음', (await visText('rec-grade-0')).includes('3등급') && (await visText('rec-grade-1')).includes('4등급') && !(await vis('rec-grade-2')), `${await visText('rec-grade-0')} / ${await visText('rec-grade-1')}`);
  const pk = await allPhotos([
    ['rec-photo-0', 'p17_face'],
    ['rec-photo-1', 'p18_face'],
    ['rec-photo-2', 'p19_face'],
  ]);
  check('5', '끼리끼리 3장도 인물 사진', pk.ok, pk.detail);
  await shot('09_끼리끼리_내등급4');
  await tap('kin-demo');
  await wait(`(() => { const el = ${visQ('kin-demo')}; return !!el && el.innerText.includes('내 등급 5'); })()`, 6000);
  await wait(`(() => { const el = ${visQ('rec-head-1')}; return !!el && el.innerText.startsWith('장OO'); })()`, 10000);
  await sleep(1200);
  const k5 = await heads(3);
  check('5', "데모 줄 → '나' 5: 목록이 바뀐다(문OO 4 → 장OO 5 · 신OO 5)", startsAll(k5, ['문OO · 32 · 서울 마포', '장OO · 37 · 부산 해운대', '신OO · 26 · 대전 유성']) && (await visText('kin-demo')) === '데모 · 끼리끼리: 내 등급 5 (누르면 6)', `${k5.join(' / ')} · ${await visText('kin-demo')}`);
  await shot('09_끼리끼리_내등급5');
  await measure('09 끼리끼리');
  check('5', '16 상점 탭으로', await goTab('상점', '/shop'), await path0());
  await wait(`!!window.__q('shop-grade-my')`);
  await tap('shop-grade-my');
  check('5', '내 등급 화면 = "9단계 중 5등급 · 같은 나이대 기준"(데모 줄 값과 같다)', (await wait(`!!window.__q('grade-big')`)) && (await visText('grade-big')) === '9단계 중 5등급 · 같은 나이대 기준', await visText('grade-big'));
  await shot('16G_내등급5');

  // ═══ 6. 남성 '나'(asmale) ═══
  check('6', "남성 '나' 장면(asmale)으로 09", await toRecs('f24asmale@email.com'), await path0());
  await sleep(1500);
  const h6 = await heads(3);
  check('6', '09 세 장 = 여성 인물 강OO 27 · 안OO 28 · 고OO 39', startsAll(h6, ['강OO · 27 · 서울 성동', '안OO · 28 · 대전 유성', '고OO · 39 · 경기 고양']), h6.join(' / '));
  const p6 = await allPhotos([
    ['rec-photo-0', 'p11_face'],
    ['rec-photo-1', 'p09_face'],
    ['rec-photo-2', 'p08_face'],
  ]);
  check('6', '여성 인물 사진(기본 그림 0)', p6.ok, p6.detail);
  await shot('09_남성나_여성인물');
  check('6', '11 호감 탭으로', await goTab('호감', '/likes'), await path0());
  await wait(`!!${visQ('like-head-received-0')}`, 10000);
  await sleep(800);
  const r6 = await heads(2, 'like-head-received-');
  check('6', '받은 호감 = 홍OO 26 · 황OO 35', startsAll(r6, ['홍OO · 26 · 서울 관악', '황OO · 35 · 부산 해운대']), r6.join(' / '));
  await shot('11_남성나_받은호감');

  const errors = b.errors.filter((e) => !/favicon/.test(e));
  check('7', '콘솔 오류 · 예외 0', errors.length === 0, errors.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((x) => !x.url.startsWith(b.origin) && !x.url.startsWith('data:') && !x.url.startsWith('blob:'));
  check('7', '바깥 요청 0', outside.length === 0, outside.slice(0, 3).map((x) => x.url).join(' | '));
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
console.log(`\n통과 ${results.length - failed} · 실패 ${failed} (폭 ${width})`);
exitCode = failed === 0 ? 0 : 1;
process.exit(exitCode);
