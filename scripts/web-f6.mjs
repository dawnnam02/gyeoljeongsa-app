// F6 화면 점검(11 호감 · 14 호감 없음 · 행 ⋯ 신고 · 차단 · T2 거절 뒤 [호감 보내기] 숨김). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 2단계 통합(app/확인/F6_통합목록.md 2 데모 연결 · 5 10 하단)을 한 뒤 `npm run check:web:demo`(= dist-demo/)를 만들고 쓴다. 1단계에서는 통합 전이라 돌리지 않는다.
//  헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다. 세션이 메모리뿐이라 흐름마다 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → 08 → 09 → 탭 '호감'으로 간다.
//   A. 기본 장면: 탭 3개 · 받은 2(최신순 · 만료까지 남은 날) · 보낸(10 에서 보낸 것 포함) · 연결 · 수락 → 연결됨 · 거절 → 14 · ⋯ 차단 · 행 → 10 · 등급 · 점수 말 0
//   B. 빈 상태 3종(like0)   C. 만료(likeexp, 90초 뒤 '만료' — 오래 걸린다)   D. 불러오기 실패 → 다시 시도(likeflaky) · 늘 실패(likefail)   E. 연결할 수 없는 상대(likegone)
//   F. 0011 거절 숨김: 보낸 호감을 상대가 바로 거절(likedecl)해도 09 '호감 보냄' · 10 '호감 보냄' · 11 '수락 대기' 그대로, 거절 글 없음
//   H. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0 · 바깥 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f6.mjs [번들 폴더]   (2단계에서 package.json 에 "check:f6" 를 더한다. 스크린샷은 확인/스크린샷/F6_* 에 저장)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findBrowser, openBrowser } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷');

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

const load = (file) => import(pathToFileURL(file).href);
const { CANDIDATE, REPORT_SHEET, SAFETY, COMMON } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));
const { LIKES } = await load(path.join(APP_DIR, 'src', 'content', 'likesCopy.ts'));

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname + location.search');
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const rows = (tab) => b.evaluate(`[...document.querySelectorAll('[data-testid^="like-row-${tab}-"]')].length`);
const peek = (email) => b.evaluate(`JSON.stringify(window.__demoPeek.likes ? window.__demoPeek.likes(${JSON.stringify(email.replace('@', 'v4on@'))}) : null)`).then(JSON.parse);
const noScore = async () => !/등급|점수|순위|퍼센트|% 일치/.test(await text());

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('H', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09 (web-f5 와 같은 길)
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.type(sel('signin-email'), email.replace('@', 'v4on@')); // V5(W10): 숨긴 v4 화면(09 · 11 · 16)을 켜는 데모 장면
  await b.clickText('인증번호 받기');
  await b.waitFor(`(() => { const el = document.querySelector('${sel('signin-code')}'); return !el.readOnly && !el.disabled; })()`);
  await b.type(sel('signin-code'), '123456');
  await b.clickText('확인');
  await b.waitFor(`!!document.querySelector('${sel('signin-birth')}')`);
  await b.type(sel('signin-birth'), '19950312');
  await b.clickText('확인');
  await b.waitFor(`location.pathname === '/consent' && document.body.innerText.includes('시작하려면 동의가 필요해요')`);
  await b.click(sel('consent-all'));
  await b.evaluate(`(() => { const el = window.__q('screen-03'); el.scrollTop = 0; })()`);
  await b.click(sel('consent-submit'));
  await b.waitFor(`location.pathname === '/survey/01'`);
  await b.clickText('설문 완료 · 정상 응답');
  await b.waitFor(`location.pathname === '/traits' && !!window.__q('traits-confirm')`, 25000);
  await b.click(sel('traits-confirm'));
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error'))`, 10000);
}

// 탭바 '호감'(글자가 정확히 '호감'인 탭 칸 — 위쪽 '보낸 호감' · '받은 호감' 칩과 겹치지 않는다)
async function toLikes() {
  await b.clickText('호감', 'tab');
  return b.waitFor(`location.pathname === '/likes' && !!window.__q('likes-tabs') && (!!window.__q('likes-list-received') || !!window.__q('screen-14') || !!window.__q('likes-error'))`, 10000);
}

try {
  // ═══ A. 기본 장면 ═══
  const EMAIL_A = 'f6ok@email.com';
  check('A', '09 까지 간다', await toRecs(EMAIL_A), `경로 ${await path0()}`);
  // 10 에서 김OO 에게 호감을 먼저 보낸다(보낸 호감 탭에 생긴다)
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-like')`);
  await b.click(sel('candidate-like'));
  await b.waitFor(`location.pathname === '/recommendations'`);
  check('A', "탭바 '호감' → 11, 처음 탭은 받은 호감", await toLikes(), `경로 ${await path0()}`);
  let t = await text();
  check('A', '머리 "호감" · 안전 한 줄 · 탭 3개(보낸 호감 · 받은 호감 · 연결됨)', t.includes(LIKES.headerTitle) && (await inner('likes-safety')) === SAFETY.line && (await inner('likes-tabs')).replace(/\s/g, '') === '보낸호감받은호감연결됨' && (await b.evaluate(`window.__q('likes-tab-received').getAttribute('aria-selected')`)) === 'true', await inner('likes-tabs'));
  check('A', '받은 호감 2행 최신순: 박OO(2시간 전 · 자정 직후면 어제) → 윤OO(어제 · 2일 전, R12 달력 기준), [수락][거절] · 만료까지 남은 날', (await rows('received')) === 2 && (await inner('like-head-received-0')) === '박OO · 29 · 경기 성남' && (await inner('like-head-received-1')) === '윤OO · 34 · 서울 서초' && /^(2시간 전|어제) · 받은 호감$/.test(await inner('like-sub-received-0')) && /^(어제|2일 전) · 받은 호감$/.test(await inner('like-sub-received-1')) && (await inner('like-expiry-received-0')) === '6일 뒤 만료' && (await q('like-accept-received-0')) && (await q('like-decline-received-0')) && (await q('like-more-received-0')), `${await inner('like-sub-received-0')} / ${await inner('like-expiry-received-0')}`);
  check('A', '화면에 등급 · 점수 · 순위 말이 없다', await noScore(), '');
  await measure('11 받은 호감');
  await note('F6_11_받은호감_360x740.png');

  await b.click(sel('likes-tab-sent'));
  check('A', '보낸 호감: 10 에서 방금 보낸 김OO(1분 전) → 문OO(3일 전) · "수락 대기" · 버튼 없음', (await b.waitFor(`!!window.__q('like-row-sent-1')`)) && (await inner('like-head-sent-0')) === '김OO · 32 · 서울 강남' && (await inner('like-sub-sent-0')) === '1분 전 · 수락 대기' && /^[34]일 전 · 수락 대기$/.test(await inner('like-sub-sent-1')) && !(await q('like-accept-sent-0')), `${await inner('like-head-sent-0')}`);
  await measure('11 보낸 호감');
  await note('F6_11_보낸호감_360x740.png');

  await b.click(sel('likes-tab-connected'));
  check('A', '연결됨: 한OO · "서로 수락했어요 · 연락 방법은 준비 중이에요" · 버튼 없음 · 안전 한 줄은 그대로', (await b.waitFor(`!!window.__q('like-row-connected-0')`)) && (await inner('like-head-connected-0')) === '한OO · 31 · 서울 강서' && (await inner('like-sub-connected-0')) === LIKES.connectedNote && (await inner('likes-safety')) === SAFETY.line, '');
  await measure('11 연결됨');
  await note('F6_11_연결됨_360x740.png');

  // 수락
  await b.click(sel('likes-tab-received'));
  await b.waitFor(`!!window.__q('like-accept-received-0')`);
  await b.click(sel('like-accept-received-0'));
  check('A', '[수락] → 토스트 "서로 수락했어요 · 연락 방법은 준비 중이에요" · 받은 호감 1행 · 탭은 그대로', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(LIKES.acceptDone)}) && document.querySelectorAll('[data-testid^="like-row-received-"]').length === 1`)) && (await b.evaluate(`window.__q('likes-tab-received').getAttribute('aria-selected')`)) === 'true', '');
  await note('F6_11_수락토스트_360x740.png');
  await b.click(sel('likes-tab-connected'));
  check('A', '연결됨 탭 맨 위에 박OO 이 생기고 서버(모의)에 연결이 남았다', (await b.waitFor(`window.__q('like-head-connected-0')?.innerText.includes('박OO')`)) && ((await peek(EMAIL_A))?.connected ?? []).includes('demo-liker-1'), JSON.stringify(await peek(EMAIL_A)));

  // 행 → 10
  await b.click(sel('like-open-connected-0'));
  check('A', '연결됨 행을 누르면 10(/candidate/demo-liker-1)', await b.waitFor(`location.pathname === '/candidate/demo-liker-1' && !!window.__q('candidate-head')`), `경로 ${await path0()}`);
  await b.click(sel('candidate-header-back'));
  check('A', '10 에서 돌아오면 보던 탭(연결됨) 그대로', (await b.waitFor(`location.pathname === '/likes'`)) && (await b.evaluate(`window.__q('likes-tab-connected').getAttribute('aria-selected')`)) === 'true', '');

  // 거절 → 14
  await b.click(sel('likes-tab-received'));
  await b.waitFor(`!!window.__q('like-decline-received-0')`);
  await b.click(sel('like-decline-received-0'));
  check('A', '[거절] → 확인창 없이 사라지고 "거절했어요." · 받은 0건(14) · 서버(모의)에 거절', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(LIKES.declineDone)}) && !!window.__q('screen-14')`)) && ((await peek(EMAIL_A))?.declinedByMe ?? []).includes('demo-liker-2'), '');
  await measure('14 호감 없음');
  await note('F6_14_호감없음_360x740.png');

  // ⋯ 차단
  await b.click(sel('likes-tab-connected'));
  await b.waitFor(`!!window.__q('like-more-connected-1')`);
  await b.click(sel('like-more-connected-1'));
  check('A', '행 ⋯ → 신고 · 차단 시트(10 과 같은 시트)', (await b.waitFor(`!!window.__q('report-menu-block')`)) && (await has(REPORT_SHEET.reportHint)) && (await has(REPORT_SHEET.blockHint)), '');
  await measure('11b 시트');
  await note('F6_11b_시트_360x740.png');
  await b.click(sel('report-menu-block'));
  await b.waitFor(`!!window.__q('report-block-confirm-confirm')`);
  await b.click(sel('report-block-confirm-confirm'));
  check('A', '차단 → 이 화면에 머물고 그 행이 사라진다 · "차단했어요."', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(REPORT_SHEET.blockDone)}) && document.querySelectorAll('[data-testid^="like-row-connected-"]').length === 1`)) && (await path0()) === '/likes' && !(await text()).includes('한OO'), '');
  await note('F6_11_차단후_360x740.png');

  // ═══ B. 빈 상태 3종 ═══
  check('B', '새 흐름으로 11 까지 간다(호감 0건 계정)', (await toRecs('like0@email.com')) && (await toLikes()), '');
  t = await text();
  check('B', '받은 0건(14): "아직 받은 호감이 없어요" · 본문 · [오늘의 추천 보기] · 탭 그대로', (await q('screen-14')) && t.includes(LIKES.emptyReceivedTitle) && t.includes(LIKES.emptyReceivedBody) && t.includes(LIKES.emptyReceivedButton) && (await q('likes-tabs')), '');
  await b.click(sel('likes-tab-sent'));
  check('B', '보낸 0건: "보낸 호감이 없어요. 마음에 드는 분께 호감을 보내 보세요."', await b.waitFor(`document.body.innerText.includes(${JSON.stringify(LIKES.emptySent)})`), '');
  await note('F6_11_보낸0_360x740.png');
  await b.click(sel('likes-tab-connected'));
  check('B', '연결 0건: "아직 연결된 분이 없어요" · 본문', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(LIKES.emptyConnectedTitle)})`)) && (await has(LIKES.emptyConnectedBody)), '');
  await measure('11 연결 0');
  await note('F6_11_연결0_360x740.png');
  await b.click(sel('likes-tab-received'));
  await b.waitFor(`!!window.__q('likes-empty-recs')`);
  await b.click(sel('likes-empty-recs'));
  check('B', '[오늘의 추천 보기] → 09', await b.waitFor(`location.pathname === '/recommendations'`), `경로 ${await path0()}`);

  // ═══ C. 만료(시간을 기다린다) ═══
  check('C', '새 흐름으로 11 까지 간다(곧 만료되는 받은 호감)', (await toRecs('likeexp@email.com')) && (await toLikes()), '');
  check('C', '서OO 행에 "오늘 만료"', (await inner('like-head-received-2')).startsWith('서OO') && (await inner('like-expiry-received-2')) === LIKES.expiresToday, await inner('like-expiry-received-2'));
  check('C', '만료 시각이 지나면 "만료"(버튼 없음) — 화면 시계는 1분마다', await b.waitFor(`!!window.__q('like-expired-received-2')`, 160000), '');
  check('C', '만료된 행은 수락 · 거절 버튼이 없다', !(await q('like-accept-received-2')) && (await q('like-accept-received-0')), '');
  await note('F6_11_만료_360x740.png');

  // ═══ D. 불러오기 실패 ═══
  check('D', '새 흐름으로 11 까지 간다(처음 한 번 실패)', (await toRecs('likeflaky@email.com')) && (await toLikes()), '');
  check('D', '불러오기 실패 → 인터넷 문구 + [다시 시도]', (await q('likes-error')) && (await inner('likes-error')) === COMMON.offline && (await q('likes-retry')), await inner('likes-error'));
  await measure('11 불러오기 실패');
  await note('F6_11_오류_360x740.png');
  await b.click(sel('likes-retry'));
  check('D', '[다시 시도] → 목록', await b.waitFor(`!!window.__q('like-row-received-0')`), '');

  // ═══ E. 연결할 수 없는 상대 ═══
  check('E', '새 흐름으로 11 까지 간다(상대가 떠난 받은 호감)', (await toRecs('likegone@email.com')) && (await toLikes()), '');
  await b.click(sel('like-accept-received-0'));
  check('E', '[수락] → "이분과는 더 이상 연결할 수 없어요." · 행이 흐려진다', (await b.waitFor(`window.__q('like-note-received-0')?.innerText.includes(${JSON.stringify(LIKES.unavailable)})`)) && (await path0()) === '/likes', '');
  await note('F6_11_연결불가_360x740.png');

  // ═══ F. 0011 거절 숨김: 보낸 호감을 상대가 바로 거절해도(likedecl) 보낸 사람에게는 만료까지 대기와 같다 ═══
  check('F', '새 흐름으로 09 까지 간다(보낸 호감을 상대가 바로 거절하는 계정)', await toRecs('likedecl@email.com'), '');
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-like')`);
  await b.click(sel('candidate-like'));
  await b.waitFor(`location.pathname === '/recommendations'`);
  check('F', '09 카드는 "호감 보냄" 그대로(거절이 드러나지 않는다)', await b.waitFor(`(window.__q('rec-status-0')?.innerText ?? '').includes('호감 보냄')`), await inner('rec-status-0'));
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-head')`);
  await b.waitFor(`false`, 600); // 하단 상태(get_pair_state)를 읽을 시간
  t = await text();
  check('F', '다시 연 10 은 "호감 보냄"(get_pair_state sent, 0011) · 거절을 알리는 글이 없다', (await inner('candidate-like')).includes(CANDIDATE.liked) && !t.includes('거절'), `버튼 ${await inner('candidate-like')}`);
  const pk = await peek('likedecl@email.com');
  check('F', '서버(모의)에는 거절 기록이 남아 있다(상대 쪽 기록, 보낸 사람 화면에는 안 보임)', Array.isArray(pk?.declinedByThem) && pk.declinedByThem.length === 1, JSON.stringify(pk?.declinedByThem));
  await note('F6_10_거절뒤_360x740.png');
  await b.click(sel('candidate-header-back'));
  await b.waitFor(`location.pathname === '/recommendations'`);
  await b.click('[aria-label="호감"]');
  await b.waitFor(`location.pathname === '/likes'`);
  await b.click(sel('likes-tab-sent'));
  check('F', '11 보낸 호감에도 그 사람이 "수락 대기"로 남아 있다(만료 시각까지)', await b.waitFor(`document.body.innerText.includes(${JSON.stringify(LIKES.sentLabel)}) && document.body.innerText.includes('김OO')`), '');

  // ═══ H. 공통 ═══
  const bad = b.errors.filter((e) => !/Failed to load resource/.test(e));
  check('H', '콘솔 오류 · 예외 0', bad.length === 0, bad.slice(0, 3).join(' | '));
  const outside = [...b.requests.values()].filter((r) => !r.url.startsWith(b.origin) && !r.url.startsWith('data:'));
  check('H', '바깥 주소로 나간 요청 0', outside.length === 0, outside.slice(0, 3).map((r) => r.url).join(' | '));
  const storage = await b.evaluate(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
  check('H', '브라우저 저장소(localStorage · sessionStorage)가 비어 있다', storage === '{"local":[],"session":[]}', storage);
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 3).join(' / '));
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF6 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
