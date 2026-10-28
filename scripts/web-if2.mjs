// IF2-F 기내 서비스 · 연애 기능 웹 점검(T2 홈 새 구성 · IF-MAG · IF-CARD · IF-PAIR · T4 대화방 칸 · 08 같은 취미). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 데모 모드 웹 번들을 만든 뒤 쓴다(npm run check:web:demo → dist-demo/). 헤드리스 Edge 로 사람이 하는 순서대로 누른다.
//  1 가입(데모 if2inflight) → 탑승권 탭 홈: 블록 B3 · B4 · B7 · 같은 취미 띠 → [그대로 두기] · 홈 블록 숫자 0 · 상대 이름 0
//  2 기내지: 표지 → 동의 시트(미리 체크 0 · ②는 ① 뒤) → 6쪽 쪽 이름 · 끝 쪽 뒤 넘김 0 · 끝줄 · 쪽 번호 0
//  3 이번 주 카드: 세 장 → 한 장(다시 뽑기 0)
//  4 데모 줄 장면 8(탑승 전 · 비행 중 · 기내지 발행 전 · 착륙 준비 · 짝 있음 · 짝 없음 · 겹칠 때 · 방이 닫힌 뒤) — 장면마다 블록 차례 · 숫자 0
//  5 짝 있음: 궁합 카드 시트(별자리 이름 · 일간 0 · 끝줄) → 대화방: 첫마디 실마리 칩 3 → 입력창 · [이야깃거리] 시트 · 안전 안내 카드 · 작별 엽서(같은 크기 두 단추 · 고르기 전 고침 칸 0)
//  6 08 같은 취미 줄(처음 켜짐)
//  7 화면마다 폭(SHOT_WIDTH, 기본 390) 가로 넘침 0 · 글자 13 이상 · 터치 48 이상 · 금지 낱말 0 · 느낌표 0 · 콘솔 오류 0 · 바깥 요청 0
//  캡처: 확인/스크린샷/[SHOT_SUBDIR 기본 IF2_<폭>]/IF2_<장면>_<폭>.png
// 사용: node scripts/web-if2.mjs [번들 폴더]   SHOT_WIDTH=360 node scripts/web-if2.mjs
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const width = Number(process.env.SHOT_WIDTH ?? 390);
const subdir = process.env.SHOT_SUBDIR ?? `IF2_${width}`;
const shotDir = path.join(APP_DIR, '확인', '스크린샷', subdir);

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log(`[미확인] ${path.relative(APP_DIR, distDir)}/index.html 이 없어요. 먼저 npm run check:web:demo 를 하세요.`);
  process.exit(2);
}
if (!findBrowser()) {
  console.log('[미확인] Edge 또는 Chrome 을 찾지 못했어요. BROWSER_PATH 에 실행 파일 경로를 주면 돼요.');
  process.exit(2);
}

const lib = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'src', 'content', 'if2Library.json'), 'utf8'));
const SIGN_NAMES = lib.codes.signs.map((s) => s.name);

const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, title, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? ` — ${detail}` : ''}`);
}

const b = await openBrowser({ distDir, shotDir, width, height: width >= 390 ? 844 : 740 });
const sel = (id) => `[data-testid="${id}"]`;
const visQ = (id) => `[...document.querySelectorAll('[data-testid="${id}"]')].find((e) => window.__visible(e))`;
const vis = (id) => b.evaluate(`!!${visQ(id)}`);
const exists = (id) => b.evaluate(`!!document.querySelector('${sel(id)}')`);
const visText = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`);
const waitVis = (id, ms = 8000) => b.waitFor(`!!${visQ(id)}`, ms);
const waitGone = (id, ms = 6000) => b.waitFor(`!${visQ(id)}`, ms);
const visIds = (re) => b.evaluate(`[...new Set([...document.querySelectorAll('[data-testid]')].filter((e) => ${re}.test(e.getAttribute('data-testid')) && window.__visible(e)).map((e) => e.getAttribute('data-testid')))]`);
const tap = async (id) => {
  await b.evaluate(`document.querySelectorAll('[data-if2-target]').forEach((e) => e.removeAttribute('data-if2-target'))`);
  const found = await b.evaluate(`(() => { const el = ${visQ(id)}; if (el) { el.scrollIntoView({ block: 'center' }); el.setAttribute('data-if2-target', '1'); } return !!el; })()`);
  if (!found) throw new Error(`보이는 ${id} 가 없어요`);
  await sleep(150);
  await b.click('[data-if2-target="1"]');
};
// 정책 PF-18 금지 낱말(check:copy 그룹 IF2 와 같은 목록)
const BANNED = ['운명의 짝', '별이 이어 준', '사주가 맞는 분', '궁합으로 찾은', '궁합 ○점', '잘 맞아요', '안 맞아요', '천생연분', '상극', '최고의 궁합', '결혼 시기', '이별', '조심하세요', '연애운', '행운 물건', '부적', '전문 상담', '심리 진단', '애착 유형', 'AI 연애 상담사', '졸업', '성혼', '커플', 'AI가 봐 드려요', 'AI 궁합', '운세', '타로', '점수', '퍼센트', '%'];
// 기내 서비스 자리(홈 블록 · 기내지 · 시트 · 대화방 칸) 글: 숫자 0 · 금지 낱말 0 · 느낌표 0 · 상대 이름(김OO 꼴) 0
async function words(label, ids, { digits = true, partner = true } = {}) {
  const t = await b.evaluate(`${JSON.stringify(ids)}.map((id) => [...document.querySelectorAll('[data-testid="' + id + '"]')].filter((e) => window.__visible(e)).map((e) => e.innerText).join('\\n')).join('\\n')`);
  const dig = digits ? (t.match(/[^\n]*\d[^\n]*/g) ?? []).slice(0, 3) : [];
  const banned = BANNED.filter((w) => t.includes(w));
  const name = partner ? (t.match(/[가-힣]OO/g) ?? []) : [];
  check('7', `${label}: ${digits ? '숫자 0 · ' : ''}금지 낱말 0 · 느낌표 0${partner ? ' · 상대 이름 0' : ''}`, t.trim().length > 0 && dig.length === 0 && banned.length === 0 && name.length === 0 && !/[!！]/.test(t), `${dig.join(' | ')} ${banned.join(',')} ${name.join(',')}`.trim());
}
// 넘침 · 글자 · 터치: 공통 __metrics(가로 넘침 · 13 미만 글자 · 48 미만 터치)
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('7', `${label}: ${width} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.slice(0, 4).join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 탑승권 탭(web-d46 · web-lounge 와 같은 길)
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
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 15000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/boarding'`, 20000);
}
async function homeBack() {
  if ((await b.evaluate('location.pathname')) !== '/boarding') await b.evaluate('history.back()');
  return b.waitFor(`location.pathname === '/boarding' && !!${visQ('home-blocks')}`, 10000);
}

// 데모 장면(데모 줄 차례)과 그 장면의 홈 표시 · 블록 차례(B1 탑승권은 그대로 — 기내 서비스 블록만 센다)
const SCENES = [
  { name: 'before', code: 'before', blocks: ['home-B6', 'home-B7'] },
  { name: 'inflight', code: 'inflight', blocks: ['home-B3', 'home-B4', 'home-B7'] },
  { name: 'magBefore', code: 'inflight', blocks: ['home-B3', 'home-B4', 'home-B7'] },
  { name: 'landing', code: 'landing', blocks: ['home-B3', 'home-B4', 'home-B7'] },
  { name: 'matched', code: 'matched', blocks: ['home-B2', 'home-B4', 'home-B7'] },
  { name: 'noMatch', code: 'noMatch', blocks: ['home-B6', 'home-B7'] },
  { name: 'overlap', code: 'overlap', blocks: ['home-B3', 'home-B4', 'home-B5', 'home-B7'] },
  { name: 'reflect', code: 'before', blocks: ['home-B6', 'home-B7'] },
];
const PAGE_NAMES = ['하늘과 결', '이번 주 카드', '연애 이야기', '오늘의 질문', '이번 여행지', '뒤표지'];

let exitCode = 0;
try {
  // ═══ 1. 홈 새 구성(비행 중) ═══
  check('1', '가입(데모 if2inflight)', await signUp(`if2inflight${width}@email.com`), '');
  check('1', '홈 블록이 보인다(스위치 inflight_home 데모 켜짐)', await waitVis('home-blocks', 12000), '');
  check('1', '홈 표시 inflight · 블록 B3 · B4 · B7(5 이하)', (await exists('home-state-inflight')) && JSON.stringify(await visIds(/^home-B\d$/)) === JSON.stringify(['home-B3', 'home-B4', 'home-B7']), (await visIds(/^home-B\d$/)).join(','));
  check('1', '할 일 줄(지금 T2) 0 — 새 구성으로 바뀜', !(await vis('boarding-tasks')), '');
  check('1', "위 탑승권 칸도 같은 장면(탑승 완료 — '탑승권 사기' 0)", !(await b.evaluate(`document.body.innerText.includes('탑승권 사기')`)), '');
  check('1', '첫 회차 같은 취미 띠', await vis('home-hobby-notice'), await visText('home-hobby-notice'));
  await words('홈 비행 중', ['home-blocks']);
  await measure('홈 비행 중');
  await b.shot(`IF2_홈_비행중_${width}.png`);
  await tap('home-hobby-keep');
  check('1', '[그대로 두기] → 띠 닫힘', await waitGone('home-hobby-notice'), '');
  // ═══ 2. 기내지 ═══
  await tap('home-B3-mag');
  check('2', '/magazine 표지', await b.waitFor(`location.pathname === '/magazine' && !!${visQ('mag-cover')}`, 10000), await b.evaluate('location.pathname'));
  await words('기내지 표지', ['screen-mag'], { partner: false });
  await measure('기내지 표지');
  await b.shot(`IF2_기내지_표지_${width}.png`);
  await tap('mag-next');
  check('2', '하늘과 결 쪽에 처음 오면 재미 정보 동의 시트', await waitVis('if2-ck17', 6000), '');
  check('2', "동의 시트: 미리 체크 0 · ②는 ① 뒤에만(비활성)", (await b.evaluate(`(${visQ('if2-ck17-a')}).getAttribute('aria-checked')`)) === 'false' && (await b.evaluate(`(${visQ('if2-ck17-b')}).getAttribute('aria-disabled')`)) === 'true', '');
  await measure('재미 정보 동의 시트');
  await b.shot(`IF2_동의시트_${width}.png`);
  await tap('if2-ck17-a');
  await tap('if2-ck17-b');
  check('2', '①을 고르면 ② 고를 수 있음', (await b.evaluate(`(${visQ('if2-ck17-b')}).getAttribute('aria-checked')`)) === 'true', '');
  await tap('if2-ck17-go');
  check('2', '[이어 가기] → 시트 닫힘', await waitGone('if2-ck17', 6000), '');
  const names = [];
  names.push(await visText('mag-page-name'));
  await words('기내지 하늘과 결', ['screen-mag'], { partner: false });
  await measure('기내지 하늘과 결');
  await b.shot(`IF2_기내지_하늘과결_${width}.png`);
  for (let i = 1; i < PAGE_NAMES.length; i += 1) {
    await tap('mag-next');
    await sleep(500);
    names.push(await visText('mag-page-name'));
    await words(`기내지 ${PAGE_NAMES[i]}`, ['screen-mag'], { partner: false });
    await measure(`기내지 ${PAGE_NAMES[i]}`);
  }
  check('2', `쪽 이름 6 · 쪽 번호 0`, names.length === 6 && names.every((n) => n && !/\d/.test(n)), names.join(' · '));
  check('2', '끝 쪽(뒤표지) 뒤 넘김 0 · AI 고지 끝줄', !(await vis('mag-next')) && (await vis('mag-ai-note')), await visText('mag-ai-note'));
  await b.shot(`IF2_기내지_뒤표지_${width}.png`);
  await tap('mag-close');
  check('2', '[닫기] → 홈', await homeBack(), '');
  // ═══ 3. 이번 주 카드 ═══
  await tap('home-B3-card');
  check('3', '카드 세 장(뒤집힘)', await b.waitFor(`[...document.querySelectorAll('[data-testid^="card-slot-"]')].filter((e) => window.__visible(e)).length === 3`, 10000), '');
  await measure('이번 주 카드 세 장');
  await tap('card-slot-1');
  check('3', '한 장 → 그 장만 · 다시 뽑기 0', (await waitVis('card-revealed', 6000)) && (await visIds(/^card-slot-\d$/)).length === 0 && !(await b.evaluate(`/다시 뽑|한 장 더/.test(document.body.innerText)`)), await visText('card-name'));
  check('3', '카드 이름은 라이브러리 22장 가운데 하나', lib.tarot.map((t) => t.name).includes(await visText('card-name')), '');
  await words('이번 주 카드', ['screen-mag'], { partner: false });
  await measure('이번 주 카드 한 장');
  await b.shot(`IF2_이번주카드_${width}.png`);
  await tap('mag-close');
  check('3', '[닫기] → 홈', await homeBack(), '');
  // ═══ 4. 데모 장면 8 ═══
  for (const sc of SCENES) {
    await tap(`if2-demo-${sc.name}`);
    const ok = await b.waitFor(`!!document.querySelector('${sel(`home-state-${sc.code}`)}') && !!${visQ('home-blocks')}`, 8000);
    await sleep(300);
    const got = await visIds(/^home-B\d$/);
    check('4', `장면 ${sc.name}: 표시 ${sc.code} · 블록 ${sc.blocks.map((x) => x.slice(5)).join(' · ')}`, ok && JSON.stringify(got) === JSON.stringify(sc.blocks), got.join(','));
    if (['before', 'noMatch', 'reflect'].includes(sc.name)) check('4', `장면 ${sc.name}: 탑승 전 맛보기(주머니 · 기내지) 0`, !(await vis('home-B3')), '');
    await words(`장면 ${sc.name}`, ['home-blocks']);
    await measure(`장면 ${sc.name}`);
    await b.shot(`IF2_홈_${sc.name}_${width}.png`);
  }
  // ═══ 5. 짝 있음: 궁합 카드 → 대화방 칸 ═══
  await tap('if2-demo-matched');
  await b.waitFor(`!!document.querySelector('${sel('home-state-matched')}')`, 8000);
  await sleep(300);
  check('5', '홈 짝 블록: 상대 이름 · 사진 0(길 안내 한 줄)', !/[가-힣]OO/.test(await visText('home-B2')) && (await b.evaluate(`!(${visQ('home-B2')}).querySelector('img')`)), await visText('home-B2-line'));
  await tap('home-B2-pair');
  check('5', '궁합 카드 시트', await waitVis('if2-pair', 6000), '');
  check('5', '같은 점 · 사주로 보면 · 별자리로 보면 · 끝줄', (await waitVis('if2-pair-same-line', 6000)) && (await vis('if2-pair-saju')) && (await vis('if2-pair-star')) && (await vis('if2-pair-footer')), await visText('if2-pair-same-line'));
  const pairText = await visText('if2-pair');
  const leak = [...SIGN_NAMES, '일간', '일주', '천간'].filter((w) => pairText.includes(w));
  check('5', '궁합 카드 시트: 별자리 이름 · 일간 · 일주 0', leak.length === 0, leak.join(','));
  await words('궁합 카드 시트', ['if2-pair']);
  await measure('궁합 카드 시트');
  await b.shot(`IF2_궁합카드_${width}.png`);
  await tap('if2-pair-close');
  await waitGone('if2-pair-same-line', 6000);
  await tap('home-B2-chat');
  check('5', '[대화방으로] → 대화방', await b.waitFor(`location.pathname.startsWith('/chat/') && !!${visQ('chat-composer-input')}`, 10000), await b.evaluate('location.pathname'));
  // 처음 들어올 때 한 번 덮이는 만남 장면(D46 · 지금 그대로)은 [건너뛰기]
  if (await b.waitFor(`!!${visQ('chat-meet-skip')}`, 4000)) {
    await tap('chat-meet-skip');
    await waitGone('chat-meet', 8000);
    await sleep(400);
  }
  check('5', '첫마디 실마리 칩 3(입력창 위)', await b.waitFor(`[...document.querySelectorAll('[data-testid^="if2-chips-"]')].filter((e) => /^if2-chips-\\d$/.test(e.getAttribute('data-testid')) && window.__visible(e)).length === 3`, 8000), '');
  await words('첫마디 실마리', ['if2-chips']);
  await measure('대화방 첫마디 실마리');
  await b.shot(`IF2_대화방_실마리_${width}.png`);
  const chip = await visText('if2-chips-0');
  await tap('if2-chips-0');
  const typed = await b.evaluate(`(${visQ('chat-composer-input')}).value`);
  check('5', '칩을 누르면 입력창에 들어감(바로 보내지 않음)', typed.length > 0 && chip.includes(typed.slice(0, 6)), typed);
  await tap('chat-topics');
  check('5', '[이야깃거리] 시트 · 1일째 가볍게만', (await waitVis('if2-topics', 6000)) && JSON.stringify(await visIds(/^if2-topics-depth-/)) === JSON.stringify(['if2-topics-depth-light']), (await visIds(/^if2-topics-depth-/)).join(','));
  await words('이야깃거리 시트', ['if2-topics']);
  await measure('이야깃거리 시트');
  await b.shot(`IF2_이야깃거리_${width}.png`);
  await tap('if2-topics-close');
  await waitGone('if2-topics-depth-light', 6000);
  await b.type(sel('chat-composer-input'), '데모안전 안녕하세요');
  await tap('chat-composer-send');
  check('5', '받은 글이 돈 · 투자 꼴이면 안전 안내 카드(나에게만)', await waitVis('if2-money', 10000), await visText('if2-money-body'));
  check('5', '실마리 칩은 내 첫 글 뒤 사라짐', !(await vis('if2-chips')), '');
  await words('안전 안내 카드', ['if2-money']);
  await measure('안전 안내 카드');
  await b.shot(`IF2_안전안내_${width}.png`);
  await tap('chat-room-more');
  await tap('chat-menu-leave');
  check('5', '[나가기] → 작별 엽서 시트', await waitVis('if2-farewell', 6000), '');
  const sizeOf = (id) => b.evaluate(`(() => { const el = ${visQ(id)}; if (!el) return 'none'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); })()`);
  const sizes = [await sizeOf('if2-farewell-with-card'), await sizeOf('if2-farewell-plain')];
  check('5', '[엽서 남기고 나가기] · [그냥 나가기] 같은 크기', sizes.length === 2 && sizes[0] !== 'none' && sizes[0] === sizes[1], sizes.join(' · '));
  await tap('if2-farewell-with-card');
  check('5', '고르기 전엔 고침 칸 0', !(await vis('if2-farewell-edit')), '');
  await tap('if2-farewell-line-1');
  check('5', '고른 뒤 한 줄 고침 칸', await waitVis('if2-farewell-edit', 4000), '');
  await words('작별 엽서 시트', ['if2-farewell']);
  await measure('작별 엽서 시트');
  await b.shot(`IF2_작별엽서_${width}.png`);
  // ═══ 6. 08 같은 취미 줄 ═══
  await b.evaluate('history.back()');
  await b.waitFor(`location.pathname === '/boarding'`, 10000).catch(() => false);
  if ((await b.evaluate('location.pathname')) !== '/boarding') {
    await b.evaluate('history.back()');
    await b.waitFor(`location.pathname === '/boarding'`, 10000);
  }
  await waitVis('home-B7-toggle', 8000);
  await tap('home-B7-toggle');
  await tap('home-B7-row-profile');
  check('6', '접힘 줄 [프로필] → 08', await b.waitFor(`location.pathname === '/profile' && !!${visQ('toggle-sameHobby')}`, 10000), await b.evaluate('location.pathname'));
  check('6', "'같은 취미' 줄 처음 켜짐", (await b.evaluate(`(${visQ('toggle-sameHobby')}).getAttribute('aria-checked')`)) === 'true', '');
  await b.evaluate(`(${visQ('toggle-sameHobby')}).scrollIntoView({ block: 'center' })`);
  await measure('08 같은 취미 줄');
  await b.shot(`IF2_08같은취미_${width}.png`);

  const external = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'));
  check('7', '콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && external.length === 0, [...b.errors.slice(0, 2), ...external.slice(0, 2).map((r) => r.url)].join(' | '));
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.message ?? error).slice(0, 200));
  exitCode = 1;
} finally {
  await b.close?.();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n기내 서비스 · 연애 기능 웹 점검(${width}): 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 || exitCode ? 1 : 0);
