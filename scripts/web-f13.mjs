// F13 화면 점검(16 상점 · 내 등급 · 09/10 등급 배지 · 1회 매칭 · 12 등급 스위치 · 데모 사진). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다. 헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다.
//  장면은 이메일 앞부분으로 고른다(lib/shopDemo.ts 머리말): plain 비구독 · shopsub 구독 중 · shopgrace 결제 문제 · shopend 끝남 · shopfail 읽기 실패 · shoplive 실결제 모드 · payfail 결제 실패 · mofew 못 채움 …
//  캡처: 확인/스크린샷/F13_*.png
// 사용: node scripts/web-f13.mjs [번들 폴더]   (npm run check:f13)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const distDir = path.resolve(APP_DIR, process.argv[2] ?? 'dist-demo');
const shotDir = path.join(APP_DIR, '확인', '스크린샷', process.env.SHOT_SUBDIR ?? '');

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

const b = await openBrowser({ distDir, shotDir, width: Number(process.env.SHOT_WIDTH ?? 360), height: 740 });
const shots = [];
const shot = async (name) => {
  const file = `F13_${name}.png`;
  await b.shot(file);
  shots.push(file);
  console.log(`       스크린샷 확인/스크린샷/${file}`);
};
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
// 웹은 앞 화면의 요소를 숨겨서 DOM 에 남겨 둔다 — 눈에 보이는 것만 센다
const vis = (id) =>
  b.evaluate(`[...document.querySelectorAll('[data-testid="${id}"]')].some((el) => { if (!window.__visible(el)) return false; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!top && (el === top || el.contains(top) || top.contains(el)); })`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const path0 = () => b.evaluate('location.pathname');
const wait = (expr, ms = 8000) => b.waitFor(expr, ms);
const tap = async (id) => {
  await b.click(sel(id));
  await sleep(350);
};
const scrollTo = (id, block = 'start') => b.evaluate(`(() => { const el = window.__q(${JSON.stringify(id)}); if (el) el.scrollIntoView({ block: ${JSON.stringify(block)} }); return !!el; })()`);
const scrollTop = () => b.evaluate(`(() => { for (const el of document.querySelectorAll('*')) if (el.scrollTop > 0) el.scrollTop = 0; return true; })()`);
const visibleCount = (testIdPrefix) => b.evaluate(`[...document.querySelectorAll('[data-testid^="${testIdPrefix}"]')].filter((el) => window.__visible(el)).length`);
async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('G', `${label}: ${b.width ?? process.env.SHOT_WIDTH ?? 360} 폭 가로 넘침 0 · 글자 13 이상 · 터치 48 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 13 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecs(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // F17: 스플래시(로고 타일 찍힘 → 종이 펼침, 약 2.8초)가 걷힌 뒤 누른다 — 바쁜 기계에서 입력 반영이 늦어 눌림을 놓치지 않게
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
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error') || !!window.__q('recs-first-wait') || !!window.__q('recs-preparing'))`, 12000);
}
const goTab = async (name, pathname) => {
  await b.click(`[role=tab][aria-label="${name}"]`);
  return b.waitFor(`location.pathname === ${JSON.stringify(pathname)}`, 8000);
};
const toShop = async () => {
  await goTab('상점', '/shop');
  return wait(`!!window.__q('screen-16') || !!window.__q('shop-error')`);
};
const tabCount = () => b.evaluate(`[...document.querySelectorAll('[role=tab]')].filter((el) => window.__visible(el)).length`);

let exitCode = 0;
try {
  // ═══ 1. 비구독자 계정 ═══
  check('A', '비구독자 계정으로 09 까지 간다', await toRecs('f13plain@email.com'), await path0());
  check('A', '09: 등급 말 · 칩이 하나도 없다(흐린 배지 · 힌트 없음)', !(await has('등급')) && !(await q('rec-grade-0')), '');
  await shot('09_비구독자');

  await toShop();
  check('B', '16 상점 목록: 테스트 화면 띠(NV56) · 등급 구독 카드 · 1회 매칭 카드 · 상품 줄 · 무료 구역 · 링크 3', (await has('테스트 화면이에요. 실제 결제는 일어나지 않아요.')) && (await q('shop-card-grade')) && (await q('shop-card-match')) && (await q('shop-free')) && (await q('shop-link-inventory')), '');
  check('B', '등급 구독 카드 혜택 첫 줄 = "나보다 위 등급 분을 먼저 추천받기"', (await inner('shop-grade-benefit-0')) === '나보다 위 등급 분을 먼저 추천받기', await inner('shop-grade-benefit-0'));
  check('B', '목록은 탭 화면: 탭바 6개(V5 탑승권 · 채팅 + 데모에서 켜진 추천 · 호감 · 상점 + 설정, W5 D-159) + 오른쪽 위 원형 사진', (await tabCount()) === 6 && (await q('profile-button')), `탭 ${await tabCount()}`);
  await shot('16_상점_목록_위');
  await measure('16 목록(위)');
  await scrollTo('shop-match-detail', 'center');
  await sleep(300);
  await shot('16_상점_목록_1회매칭');
  await scrollTo('shop-singles-title');
  await sleep(300);
  await shot('16_상점_목록_상품줄_빨간라벨');
  await measure('16 목록(상품 줄)');
  await scrollTo('shop-free-title');
  await sleep(300);
  await shot('16_상점_목록_무료구역_링크');
  // S17(D-85: G9 · N14 뺌, N16 C) · S19(D-122: 카드 7개 뺌) 뒤 숫자: 상품 줄 42 → 40 → 33 · 빨간 라벨 26 → 27 → 20
  check('B', '상품 줄 33 + 3개월권 카드 · 위험 C 20개에 빨간 라벨(NV57)', (await b.evaluate(`[...document.querySelectorAll('[data-testid^="shop-row-"]')].filter((el) => /^shop-row-[A-Z]\\d+$/.test(el.dataset.testid)).length`)) === 33 && (await b.evaluate(`document.body.innerText.split('위험 — 본인 판단').length - 1`)) === 20, '');

  // 무료 열람 요청 시트(비구독자도) — G5
  await scrollTo('shop-free-access', 'center');
  await tap('shop-free-access');
  check('G5', '"내 등급 알려 주세요" 시트(NV67 · NV68)가 열린다 — 비구독자도', (await wait(`!!window.__q('access-title')`)) && (await inner('access-body')).startsWith('내 등급과 계산에 쓰인 항목을 무료로'), await inner('access-title'));
  await shot('16-G5_내등급알려주세요_시트');
  await tap('access-send');
  check('G5', '요청하면 토스트(NV69) "요청을 받았어요. {날짜}까지 알려 드릴게요."', await wait(`document.body.innerText.includes('요청을 받았어요.')`), '');
  await shot('16-G5_접수_토스트');
  await sleep(3400);

  // 등급은 어떻게 정해지나요(G4) — 무료
  await scrollTo('shop-free-how', 'center');
  await tap('shop-free-how');
  check('G4', '"등급은 어떻게 정해지나요" 쪽(W9): 탭바 없음 · 원형 사진 없음 · 9칸 격자 없음 · 풍경 안내 한 줄 · 단계 숫자 · 방향 문구 0', (await wait(`!!window.__q('how-body')`)) && (await tabCount()) === 0 && !(await vis('profile-button')) && !(await vis('how-cell-9')) && (await vis('how-shapes')) && !/\d\s*등급|숫자가 작을수록|위 등급|\+\d+점/.test(await b.evaluate('document.body.innerText')), `탭 ${await tabCount()} · 원형 사진 보임 ${await vis('profile-button')} · 격자 ${await vis('how-cell-9')}`);
  await shot('16-G4_해설_위');
  await measure('16-G4');
  await scrollTo('how-part-0');
  await sleep(300);
  await shot('16-G4_해설_본문');
  await tap('shop-sub-header-back');

  // 등급 구독 상세 → 구매
  await scrollTo('shop-grade-detail', 'center');
  await tap('shop-grade-detail');
  check('C', '16-2 등급 구독 상세: 선택지 1개월 · 3개월(보류) · 고르기 전 [구매하기] 흐림', (await wait(`!!window.__q('detail-option-1m')`)) && (await q('detail-option-3m')) && (await b.evaluate(`getComputedStyle(window.__q('detail-buy')).backgroundColor === 'rgb(245, 238, 232)'`)), ''); // 버튼 v3(D-141): 흐림 = 투명도 대신 card 면 · sub 글자
  await shot('16-2_등급구독_상세_선택전');
  await measure('16-2 상세');
  await tap('detail-option-1m');
  await scrollTo('detail-before');
  await sleep(300);
  await shot('16-2_등급구독_구매전확인_C1');
  await scrollTo('detail-buy', 'center');
  await tap('detail-buy');
  check('C', '16-3 구매 확인 시트 "이대로 구매할까요?"', await wait(`!!window.__q('purchase-title')`), await inner('purchase-title'));
  await shot('16-3_구매확인');
  await tap('purchase-pay');
  check('C', '16-D 데모 결제 시트 "데모 결제예요. 돈은 나가지 않아요."', await wait(`!!window.__q('purchase-demo-title')`), await inner('purchase-demo-title'));
  await shot('16-D_데모결제');
  await tap('purchase-demo-buy');
  check('C', '16-5 완료: "등급 구독을 시작했어요. 다음 결제일은 …"', await wait(`!!window.__q('purchase-done-text')`), await inner('purchase-done-text'));
  await shot('16-5_구매완료');
  await tap('purchase-done-ok');
  await sleep(300);

  // 구독 중 상세 → 목록
  await tap('shop-sub-header-back');
  check('C', '구독 후 목록 카드: "이용 중 · …에 갱신돼요" + [내 등급 보기] + [등급 구독 관리]', (await wait(`!!window.__q('shop-grade-my')`)) && (await inner('shop-grade-status')).startsWith('이용 중 · '), await inner('shop-grade-status'));
  await scrollTop();
  await shot('16_상점_구독중_목록');

  // ═══ 내 등급 G1 ═══
  await tap('shop-grade-my');
  check('G1', '내 등급(W9 · D-154): 내 무리(풍경 아이콘 + 이름 + 나만 보여요) · 단계 숫자 · 점수 막대 · 방향 문구 0', (await wait(`!!window.__q('grade-flock')`)) && (await vis('grade-flock-icon-bridge')) && (await inner('grade-flock-name')) === '다리' && !(await q('grade-bars')) && !/\d\s*등급|숫자가 작을수록|위 등급|\+\d+점/.test(await b.evaluate('document.body.innerText')), await inner('grade-flock-name'));
  check('G1', '바뀔 수 있는 일 3줄 · 한계 문구(점수 글 없음)', (await has('서류 인증하기')) && (await has('프로필 선택 항목 채우기')) && (await has('앱에 접속하기')) && (await q('grade-limits')) && !(await has('최대 +')), '');
  await shot('16-G1_내등급_위');
  await measure('16-G1(위)');
  await scrollTo('grade-up');
  await sleep(300);
  await shot('16-G1_내등급_올리는방법');
  await scrollTo('grade-limits', 'end');
  await sleep(300);
  await shot('16-G1_내등급_링크_한계문구');
  await measure('16-G1(아래)');
  await tap('grade-link-history');
  check('G2', '등급 변화 기록(W9): 줄 "10월 … 아이콘이 바뀌었어요 · 서류 인증" + 전/새 아이콘 그림 · 숫자 등급 0', (await wait(`!!window.__q('history-item-0')`)) && (await inner('history-item-0')).endsWith('아이콘이 바뀌었어요 · 서류 인증') && (await vis('history-to-0')) && !/\d\s*등급|숫자가 작을수록|위 등급|\+\d+점/.test(await b.evaluate('document.body.innerText')), await inner('history-item-0'));
  await shot('16-G2_변화기록');
  await tap('shop-sub-header-back');
  await scrollTo('grade-link-goal', 'center');
  await tap('grade-link-goal');
  await wait(`!!window.__q('goal-body')`);
  check('G3', '목표(W9): 단계 고르기 칩 없음 · 할 일 체크 + NV53', (await q('goal-tasks')) && !(await q('goal-choice-3')) && (await has('다 해도 목표 등급이 꼭 되는 건 아니에요.')), '');
  await shot('16-G3_목표');
  await tap('shop-sub-header-back');
  await tap('shop-sub-header-back');
  check('G1', '목록으로 돌아오면 탭바가 다시 보인다(6칸, W5 D-159)', (await wait(`!!window.__q('screen-16')`)) && (await tabCount()) === 6, `탭 ${await tabCount()}`);

  // ═══ 09 / 10 배지 (구독자) ═══
  await goTab('추천', '/recommendations');
  await wait(`!!window.__q('rec-card-0')`);
  check('E', '09 구독자(W9): CK10 동의 카드에만 아이콘 칩(숫자 글 없음), 동의 안 한 카드는 칩 없음', (await q('rec-grade-0')) && (await q('rec-grade-2')) && !(await q('rec-grade-0-text')) && !(await q('rec-grade-1')), '');
  await shot('09_구독자_배지');
  await measure('09 구독자');
  await tap('rec-grade-0');
  check('E', '칩을 누르면 말풍선(W9): NV85 한 줄 · 숫자 · 방향 문구 없음', (await wait(`!!window.__q('rec-grade-0-bubble')`)) && (await inner('rec-grade-0-bubble')) === '등급은 이분의 인생을 대변하지 않아요.', await inner('rec-grade-0-bubble'));
  await shot('09_구독자_말풍선');
  await tap('rec-card-0');
  check('F', '10 상세(동의한 상대): 배지 + NV55 · NV81 · NV85 · 한계 문구', (await wait(`!!window.__q('candidate-grade-text')`)) && (await inner('candidate-grade-text')) === '9단계 중 2등급 · 이분 나이대 기준이에요.' && (await q('candidate-grade-limits')), await inner('candidate-grade-text'));
  await shot('10_구독자_동의상대_등급');
  await measure('10 구독자(동의)');
  await tap('candidate-header-back');
  await wait(`!!window.__q('rec-card-1')`);
  await tap('rec-card-1');
  check('F', '10 상세(동의 안 한 상대): 배지 자리도 "비공개" 글자도 없다', (await wait(`!!window.__q('screen-10')`)) && !(await q('candidate-grade')) && !(await has('등급')), '');
  await shot('10_구독자_미동의상대');
  await tap('candidate-header-back');

  // ═══ 12 설정 ═══
  await goTab('설정', '/settings');
  await wait(`!!window.__q('settings-grade-switches')`);
  check('H', '12 설정: "구매 · 등급 구독" 줄 · "내 등급 보이기" · "등급 계산 멈추기" 스위치 + 설명', (await q('settings-row-purchase')) && (await has('켜면 등급 구독 회원이 추천에서 내 등급을 볼 수 있어요.')) && (await has('멈추면 내 등급을 지우고 더 계산하지 않아요.')), '');
  await shot('12_설정_등급줄과_스위치');
  await measure('12 설정');
  await scrollTo('settings-grade-switches', 'center');
  await tap('settings-grade-show');
  await sleep(500);
  check('H', '내 등급 보이기를 켜면 스위치가 켜지고 "저장했어요."', (await b.evaluate(`window.__q('settings-grade-show').getAttribute('aria-checked') === 'true'`)) && (await has('저장했어요.')), '');
  await shot('12_설정_내등급보이기_켬');
  await sleep(2600);
  await tap('settings-grade-stop');
  await shot('H_stop_confirm');
  await tap('settings-grade-stop-confirm-confirm'); // 16-N 확인창(멈출 때만)
  await sleep(500);
  check('H', '등급 계산 멈추기를 켜면 스위치가 켜진다', await b.evaluate(`window.__q('settings-grade-stop').getAttribute('aria-checked') === 'true'`), '');
  await shot('12_설정_계산멈춤_켬');
  // 멈춤 상태 화면: 상점 → 내 등급 보기
  await toShop();
  await tap('shop-grade-my');
  check('G1', '멈춘 구독자의 내 등급 화면은 비어 있고 C7 설명을 보인다', (await wait(`!!window.__q('grade-stopped')`)) && !(await q('grade-big')), await inner('grade-stopped'));
  await shot('16-G1_계산멈춤_상태');
  await tap('shop-sub-header-back');
  // 탈퇴 확인창(구독 이용 중)
  await goTab('설정', '/settings');
  await scrollTo('settings-withdraw', 'center');
  await tap('settings-withdraw');
  check('H', '탈퇴 확인창(구독 이용 중): NV36 "탈퇴해도 스토어의 등급 구독 결제는 멈추지 않아요…" + [구독 관리]', (await wait(`!!window.__q('withdraw-confirm-note-text')`)) && (await q('withdraw-confirm-note-action')), '');
  await shot('12_탈퇴확인_구독안내');
  await tap('withdraw-confirm-cancel');

  // ═══ 구독 관리(테스트 단추) ═══
  await toShop();
  await tap('shop-grade-manage');
  await wait(`!!window.__q('manage-body')`);
  await tap('manage-store');
  await shot('16-12_구독관리_이용중_테스트단추');
  await tap('manage-test-cancel');
  await sleep(400);
  await shot('16-12_구독관리_갱신꺼짐');
  await tap('manage-test-expire');
  await sleep(400);
  check('M', '16-12 끝남: NV65 "등급 구독이 끝났어요. 내 등급은 계속 계산되고…" + [다시 시작]', (await q('manage-ended')) && (await q('manage-restart')), await inner('manage-ended'));
  await shot('16-12_구독관리_끝남');
  await tap('shop-sub-header-back');
  // 이용권 · 복원 · 환불 안내
  await scrollTo('shop-link-inventory', 'center');
  await tap('shop-link-inventory');
  await wait(`!!window.__q('inventory-restore')`);
  await shot('16-8_이용권');
  await tap('inventory-restore');
  await wait(`!!window.__q('restore-text')`);
  check('M', '16-9 복원: 이용 중 구독이 없으면 NV30', (await inner('restore-text')).startsWith('다시 연결할 구매가 없어요.'), await inner('restore-text'));
  await shot('16-9_복원_결과');
  await tap('restore-ok');
  await tap('shop-sub-header-back');
  await scrollTo('shop-link-refund', 'center');
  await tap('shop-link-refund');
  await wait(`!!window.__q('refund-body')`);
  await shot('16-10_결제환불안내');
  await measure('16-10');
  await tap('shop-sub-header-back');

  // ═══ 2. 1회 매칭: 구매 → 사용 → 09 추가 구역 ═══
  check('A', '1회 매칭용 계정(구독 없음)으로 09 까지 간다', await toRecs('f13match@email.com'), await path0());
  await toShop();
  await scrollTo('shop-match-detail', 'center');
  await tap('shop-match-detail');
  await wait(`!!window.__q('detail-buy')`);
  await shot('16-2_1회매칭_상세');
  await scrollTo('detail-buy', 'center');
  await tap('detail-buy');
  await tap('purchase-pay');
  await tap('purchase-demo-buy');
  await wait(`!!window.__q('purchase-done-take')`);
  check('I', '1회 매칭 구매 완료 시트에 [지금 받기]', await q('purchase-done-take'), await inner('purchase-done-text'));
  await shot('16-5_1회매칭_구매완료');
  await tap('purchase-done-take');
  check('I', '16-M 사용 확인 시트: "지금 3명을 받을까요? 받은 분들은 오늘 하루 볼 수 있어요."', await wait(`!!window.__q('match-confirm-text')`), await inner('match-confirm-text'));
  await shot('16-M_사용확인');
  await tap('match-take');
  check('I', '[받기] → 09 로 이동 + 토스트 "3명을 더 보여 드렸어요."', (await wait(`location.pathname === '/recommendations' && !!window.__q('recs-extra-title')`, 10000)) && (await has('3명을 더 보여 드렸어요.')), await path0());
  await shot('09_추가로받은추천_토스트');
  await sleep(3600);
  await scrollTo('recs-extra-title');
  await sleep(300);
  await shot('09_추가로받은추천_구역');
  check('I', '09: 무료 3장 + 제목 "추가로 받은 추천" + 추가 3장(비구독자라 칩 없음)', (await visibleCount('rec-card-')) >= 3 && (await inner('recs-extra-title')) === '추가로 받은 추천' && !(await q('rec-grade-3')), '');
  await measure('09 추가 구역');
  // 상점으로 돌아가면 오늘 1/2
  await toShop();
  await scrollTo('shop-match-detail', 'center');
  await shot('16_1회매칭_사용뒤_카드');

  // ═══ 3. 장면: 못 채움 · 결제 문제 · 끝남 · 읽기 실패 · 실결제 모드 · 결제 실패 · 사진 ═══
  await toRecs('f13mofew@email.com');
  await toShop();
  await scrollTo('shop-match-detail', 'center');
  await tap('shop-match-detail');
  await wait(`!!window.__q('detail-buy')`);
  await tap('detail-buy');
  await tap('purchase-pay');
  await tap('purchase-demo-buy');
  await wait(`!!window.__q('purchase-done-take')`);
  await tap('purchase-done-take');
  await wait(`!!window.__q('match-take')`);
  await tap('match-take');
  check('I', '못 채움(mofew): 시트에 "2명을 더 보여 드렸어요." + NV50b(나머지 1명분)', (await wait(`!!window.__q('match-partial-done')`)) && (await inner('match-partial-note')).includes('나머지 1명분은 이용권으로 남아'), await inner('match-partial-note'));
  await shot('16-M_못채움');
  await tap('match-partial-ok');
  await wait(`location.pathname === '/recommendations'`);

  await toRecs('shopgrace@email.com');
  await toShop();
  check('B', '결제 문제(shopgrace): 띠 NV10 + [확인하기]', await q('shop-problem'), await inner('shop-problem-text'));
  await shot('16_상점_결제문제_띠');

  await toRecs('shopend@email.com');
  await toShop();
  await tap('shop-link-inventory');
  await wait(`!!window.__q('inventory-restore')`);
  await tap('inventory-manage');
  await wait(`!!window.__q('manage-ended')`);
  await shot('16-12_끝남_상태');
  await tap('shop-sub-header-back');
  await tap('shop-sub-header-back');

  await toRecs('shopfail@email.com');
  await toShop();
  check('B', '읽기 실패(shopfail): 공통 오류 + 무료 구역은 그대로 + [다시 시도]', (await q('shop-error')) && (await q('shop-free')) && (await q('shop-retry')), await inner('shop-error-text'));
  await shot('16_상점_읽기실패');

  await toRecs('shoplive@email.com');
  await toShop();
  check('B', '실결제 모드(shoplive): 테스트 띠 · 빨간 라벨이 없다', !(await has('테스트 화면이에요.')) && !(await has('위험 — 본인 판단')), '');
  await shot('16_상점_실결제모드');
  await scrollTo('shop-grade-detail', 'center');
  await tap('shop-grade-detail');
  await wait(`!!window.__q('detail-option-1m')`);
  await tap('detail-option-1m');
  await scrollTo('detail-buy', 'center');
  await tap('detail-buy');
  await tap('purchase-pay');
  check('B', '실결제 모드에서 구매를 시작하면 "지금은 이 상품을 살 수 없어요."로 끝난다(실결제 연결 없음)', (await wait(`!!window.__q('purchase-blocked-text')`)) && (await inner('purchase-blocked-text')) === '지금은 이 상품을 살 수 없어요.', await inner('purchase-blocked-text'));
  await shot('16-11_실결제모드_구매막힘');

  await toRecs('payfail@email.com');
  await toShop();
  await scrollTo('shop-grade-detail', 'center');
  await tap('shop-grade-detail');
  await wait(`!!window.__q('detail-option-1m')`);
  await tap('detail-option-1m');
  await scrollTo('detail-buy', 'center');
  await tap('detail-buy');
  await tap('purchase-pay');
  await tap('purchase-demo-buy');
  check('C', '결제 실패(payfail): 시트 "결제가 끝나지 않았어요. 다시 시도해 주세요." + [다시 시도] [닫기]', (await wait(`!!window.__q('purchase-failed-text')`)) && (await q('purchase-failed-retry')), await inner('purchase-failed-text'));
  await shot('16-6_결제실패');

  // 데모 사진 → 기본 그림(조건 7)
  await toRecs('f13photo@email.com');
  // F24(10-18)부터 데모 회원에게 그림 사진이 있다 — 머리 원은 기본 그림이거나 실제로 불러온 사진(베이지 한 점이 아님)
  const avatarKind = () => b.evaluate(`(() => { if (window.__q('profile-button-avatar-default')) return 'default'; const a = [...document.querySelectorAll('[data-testid="profile-button-avatar"]')].filter((e) => window.__visible(e)).pop(); const img = a && a.querySelector('img'); const bg = a && [...a.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundImage).find((v) => v && v.startsWith('url(')); return (img && img.naturalWidth > 0) || bg ? 'photo' : 'none'; })()`);
  const kind = await avatarKind();
  check('J', '데모 사진: 09 머리 원 = 기본 프로필 그림 또는 불러온 사진(베이지 한 점이 아님)', kind === 'default' || kind === 'photo', kind);
  await shot('09_머리원_기본그림');
  await toShop();
  check('J', '16 머리 원도 기본 프로필 그림 또는 불러온 사진', ['default', 'photo'].includes(await avatarKind()), '');
  await shot('16_머리원_기본그림');

  check('G', '화면 점검 중 콘솔 오류 0 · 바깥 요청 0', b.errors.length === 0 && [...b.requests.values()].every((r) => r.url.startsWith(b.origin) || r.url.startsWith('data:')), `오류 ${b.errors.length}: ${b.errors.slice(0, 2).join(' | ')}`);
} catch (error) {
  console.log(`[실패] 실행 도중 오류: ${String(error?.stack ?? error).split('\n').slice(0, 4).join('\n')}`);
  exitCode = 1;
} finally {
  b.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nF13 화면 점검: 통과 ${results.length - failed} · 실패 ${failed} · 스크린샷 ${shots.length}장`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
