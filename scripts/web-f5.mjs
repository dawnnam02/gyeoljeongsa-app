// F5 화면 점검(09 오늘의 추천 · 13 추천 없음 · 10 상대 프로필 · 신고 · 차단 시트). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다. 세션이 메모리뿐이라 흐름마다 02 → 03 → 04 데모 건너뛰기 → 06 → 07 [이대로 확정] → 08 [확인했어요] → 09 로 처음부터 간다.
//   A. 09 카드 3장 · 10 공개/비공개 · 사진 1/3 넘김 · 왜 추천했나요 · 넘기기 · 호감(중복 금지) · 신고(사유 8) · 차단(목록에서 즉시 사라짐) · 서버(모의)에 남은 행
//   B. 추천 0명 빈 상태(13) · 준비 중(NK02) · 첫 추천 대기(NK01)   C. 시간이 끝나면 새 목록   D. 불러오기 실패 → 다시 시도   E. 호감 한도   F. 볼 수 없는 프로필
//   (응답 JSON 에 grade · score · rank 키 0 은 jest 시험 recsScreen 이 모의 서버 응답 전체에서 찾는다)   H. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0 · 바깥 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f5.mjs [번들 폴더]   (npm run check:f5, 스크린샷은 확인/스크린샷/F5_* 에 저장)
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
const { RECS, CANDIDATE, REPORT_SHEET, SAFETY, COMMON } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));

const b = await openBrowser({ distDir, shotDir, width: 360, height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname + location.search');
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const peek = (email) => b.evaluate(`JSON.stringify(window.__demoPeek.recs(${JSON.stringify(email.replace('@', 'v4on@'))}))`).then(JSON.parse);
const SCORE_WORDS = /등급|점수|순위|퍼센트|% 일치/;
const noScore = async () => !SCORE_WORDS.test(await text()); // 09 · 13: 예외 없음
// 10: '왜 추천했나요' 둘째 문장(copy.ts CANDIDATE.whyNote, 팀장 결정 J13 유지)은 반드시 한 번 그려져야 하고, 그 문장을 뺀 나머지에는 등급 · 점수 말이 없어야 한다. 글자는 D-50 뒤 새로 정해지므로 키 값으로만 본다
// v4(F13 · 척추 v2): 10 의 등급 자리(candidate-grade*)는 허용 구역 — 그 밖의 글에 등급 · 점수 · 순위 말이 없는지 본다
const textOutsideGrade = () => b.evaluate(`(() => { let t = document.body.innerText; for (const e of document.querySelectorAll('[data-testid^="candidate-grade"]')) if (e.innerText) t = t.split(e.innerText).join(' '); return t; })()`);
const noScoreWithNote = async () => { const t = await text(); const rest = await textOutsideGrade(); return t.split(CANDIDATE.whyNote).length === 2 && !SCORE_WORDS.test(rest.replace(CANDIDATE.whyNote, '')); };

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('H', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
async function toRecsOnce(email) {
  await b.open('/sign-in', `document.body.innerText.includes('이메일로 시작해요')`);
  await b.waitFor(`!window.__q('splash')`, 8000); // F17 · F20: 스플래시(약 2.8초)가 걷힌 뒤 누른다(바쁜 기계에서 입력을 놓치지 않게)
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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error') || !!window.__q('recs-preparing') || !!window.__q('recs-first-wait'))`, 10000);
}


// 바쁜 기계에서 설문 데모 누름이 빠져 가입 흐름이 끊기면 한 번 더 처음부터(F21 회귀 때 덧붙임 — 설문 길 줄은 그대로)
const toRecs = (email) => toRecsOnce(email).catch(() => toRecsOnce(email));

try {
  // ═══ A. 카드 3장 · 상세 · 넘기기 · 호감 · 신고 · 차단 ═══
  const EMAIL_A = 'f5okphotocheck@email.com'; // F24: 사진 확인 중 상태를 보려면 photocheck 장면
  check('A', '07 → 08 [확인했어요] → 09 에 카드가 나온다', await toRecs(EMAIL_A), `경로 ${await path0()}`);
  let t = await text();
  check('A', '09 상단 "오늘의 추천" · 우측 "다음 추천까지 N시간 M분"(한국 시각 갱신 기준) · 부제 "조건과 성향을 살펴 고른 세 분이에요."', t.includes(RECS.headerTitle) && /다음 추천까지 (\d+시간( \d+분)?|\d+분|1분 미만)/.test(await inner('recs-remaining')) && t.includes(RECS.subtitle), await inner('recs-remaining'));
  check('A', '카드 3장: 이름 줄 · 한 줄 정보 · "맞는 점" + 칩이 보이고 사진 칸이 있다', (await q('rec-card-0')) && (await q('rec-card-1')) && (await q('rec-card-2')) && !(await q('rec-card-3')) && (await inner('rec-head-0')) === '김OO · 32 · 서울 강남구' && (await inner('rec-info-0')) === '대기업 · 석사 · 기독교 · 초혼' && (await inner('rec-match-0')) === RECS.matchLabel && (await q('rec-photo-0')), `${await inner('rec-head-1')} / ${await inner('rec-info-1')}`);
  check('A', '박OO 카드는 종교를 가려서 한 줄 정보에 종교가 없고, 사진 확인 중이면 "사진 확인 중"을 보인다', !(await inner('rec-info-1')).includes('무교') && (await inner('rec-photo-1')).includes(RECS.photoChecking), await inner('rec-info-1'));
  const chips0 = await inner('rec-chips-0');
  check('A', '칩은 카드당 최대 3개이고 이름만 있다(값 · 방향 · 숫자 없음)', chips0 === '지역 자녀 계획 맞벌이', chips0);
  check('A', '화면에 등급 · 점수 · 순위 말이 없다', await noScore(), '');
  await measure('09 카드 3장');
  await note('F5_09_추천3장_360x740.png');
  const cardLook = await b.evaluate(`(() => { const h = window.__q('rec-head-0'); const m = window.__q('rec-match-0'); const p = window.__q('rec-photo-0'); return { head: getComputedStyle(h).fontFamily, match: getComputedStyle(m).fontFamily, radius: parseFloat(getComputedStyle(p).borderTopLeftRadius) }; })()`);
  check('A', 'D8 4차: 카드 이름 15 Bold(M6) · "맞는 점" 12 Medium(M8) · 카드 사진 둥글기 8(M7)', /Bold/.test(cardLook.head) && /Medium/.test(cardLook.match) && cardLook.radius === 8, JSON.stringify(cardLook));

  // 10: 첫 카드
  await b.click(sel('rec-card-0'));
  check('A', '카드를 누르면 10(/candidate/…)이 열린다', await b.waitFor(`location.pathname.startsWith('/candidate/') && !!window.__q('candidate-head')`), `경로 ${await path0()}`);
  t = await text();
  check('A', '10 공개 항목: 이름 줄 "김OO · 32 · 서울 강남구" · 한 줄 정보 · 연봉 구간 · 부모님 학력 값, 가린 부모님 자산은 "비공개"',
    (await inner('candidate-head')) === '김OO · 32 · 서울 강남구' && (await inner('candidate-info')).startsWith('대기업 · 석사 · 기독교 · 초혼') && (await inner('candidate-row-income')).includes('7천만') && (await inner('candidate-row-parentAssets')).includes(CANDIDATE.hidden), await inner('candidate-table'));
  // F18(N1): 번호는 승인된 사진만 센다 — 김OO 은 승인 2 · 확인 중 1 이라 '사진 1 / 2', 확인 중 칸은 보이지 않는다
  check('A', '사진 "사진 1 / 2" (승인 2 · 확인 중 1 — 확인 중 칸은 세지도 보이지도 않음, F18)', (await inner('candidate-photo-index')) === '사진 1 / 2' && (await b.evaluate(`window.__qa('candidate-photo-checking').length + window.__qa('candidate-photo-2-checking').length`)) === 0, await inner('candidate-photo-index'));
  check('A', '"왜 추천했나요" 박스에 맞은 항목이 1개 이상: "지역 · 종교 · 자녀 계획 · 맞벌이 · 결혼 후 지역…이 맞아요." 와 법무 유지 문장', t.includes(CANDIDATE.whyTitle) && /맞아요\./.test(await inner('candidate-why-body')) && (await inner('candidate-why-body')).includes('지역') && (await inner('candidate-why-note')) === CANDIDATE.whyNote, await inner('candidate-why-body'));
  check('A', '하단 안내 "이 프로필은 회원이 직접 입력한 내용이에요…" · 안전 한 줄', (await inner('candidate-disclaimer')) === CANDIDATE.disclaimer && (await inner('candidate-safety')) === SAFETY.line, '');
  check('A', '10 에 등급 · 점수 · 순위 말이 없고, "왜 추천했나요" 둘째 문장(CANDIDATE.whyNote)은 반드시 한 번 있다(J13)', await noScoreWithNote(), '');
  await measure('10 상대 프로필');
  await note('F5_10_상세_360x740.png');
  await b.click(sel('candidate-photo-next'));
  const idx2 = await b.waitFor(`window.__q('candidate-photo-index').innerText.includes('2 / 2')`);
  const idx3 = true; // 승인 2장이라 '2 / 2' 가 끝(F18)
  check('A', '사진 넘김: 다음 버튼으로 "사진 2 / 2", 끝에서는 다음 버튼이 없다(F18 승인 사진만)', idx2 && idx3 && !(await q('candidate-photo-next')), '');
  await note('F5_10_사진넘김_360x740.png');
  await b.click(sel('candidate-photo-prev'));
  check('A', '이전 버튼으로 "사진 1 / 2" 로 돌아온다', await b.waitFor(`window.__q('candidate-photo-index').innerText.includes('1 / 2')`), '');

  // 박OO(둘째): 비공개 항목이 많은 사람 → 넘기기
  await b.click(sel('candidate-header-back'));
  await b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-card-1')`);
  await b.click(sel('rec-card-1'));
  await b.waitFor(`!!window.__q('candidate-head')`);
  const hiddenCount = await b.evaluate(`['candidate-row-income','candidate-row-parentEducation','candidate-row-parentAssets'].filter((id) => window.__q(id).innerText.includes(${JSON.stringify(CANDIDATE.hidden)})).length`);
  check('A', '박OO 은 연봉 구간 · 부모님 학력 · 부모님 자산을 모두 비공개로 두어 표 3줄이 "비공개"로 나온다(줄은 항상 3개)', hiddenCount === 3, `비공개 ${hiddenCount}줄`);
  check('A', '박OO 상세의 이유에는 종교가 없다(상대가 가린 항목은 이름도 쓰지 않는다)', !(await inner('candidate-why-body')).includes('종교'), await inner('candidate-why-body'));
  await note('F5_10_비공개_360x740.png');
  await b.click(sel('candidate-pass'));
  check('A', '[넘기기] → 확인창 없이 09 로 돌아가고 그 카드는 "넘김"이다', (await b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-status-1')`)) && (await inner('rec-status-1')) === RECS.passedLabel, `경로 ${await path0()}`);
  check('A', '서버(모의)에 넘김이 남았다(passed = demo-cand-2)', (await peek(EMAIL_A)).passed.join() === 'demo-cand-2', JSON.stringify((await peek(EMAIL_A)).passed));
  await b.click(sel('rec-card-1'));
  await b.waitFor(`true`, 300);
  check('A', '넘김 카드는 눌러도 열리지 않는다', (await path0()) === '/recommendations', `경로 ${await path0()}`);
  await note('F5_09_넘김_360x740.png');
  check('A', 'D8 4차 M9: 넘김 카드는 카드 전체가 40%("넘김" 알약 포함)', (await b.evaluate(`Number(getComputedStyle(window.__q('rec-card-1')).opacity)`)) <= 0.41, String(await b.evaluate(`getComputedStyle(window.__q('rec-card-1')).opacity`)));

  // 호감
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-like')`);
  await b.click(sel('candidate-like'));
  check('A', '[호감 보내기] → 09 로 돌아가 "호감을 보냈어요. 상대가 수락하면 알려 드릴게요." 토스트', (await b.waitFor(`location.pathname === '/recommendations' && document.body.innerText.includes(${JSON.stringify(CANDIDATE.likeDone)})`)), '');
  await note('F5_09_호감토스트_360x740.png');
  check('A', '그 카드에 "호감 보냄"이 붙고 서버(모의)에 호감 1건이 생겼다', (await inner('rec-status-0')) === RECS.sentLabel && (await peek(EMAIL_A)).liked.join() === 'demo-cand-1', JSON.stringify((await peek(EMAIL_A)).liked));
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-like')`);
  await b.click(sel('candidate-like'));
  check('A', '중복 금지: 이미 보낸 분께 다시 누르면 "호감 보냄"으로 흐려지고 서버(모의) 호감은 그대로 1건이다', (await b.waitFor(`window.__q('candidate-like').innerText.includes(${JSON.stringify(CANDIDATE.liked)})`)) && (await peek(EMAIL_A)).liked.length === 1, JSON.stringify((await peek(EMAIL_A)).liked));
  await note('F5_10_호감보냄_360x740.png'); // D8 4차 M15 재촬영(가림 없는 상태)
  await b.evaluate(`(() => { const el = window.__q('screen-10'); if (el) el.scrollTop = 99999; })()`);
  check('A', '10 스크롤 끝: 하단 안내 두 줄(서류 확인 · 안전 한 줄)이 하단 바 위에 보인다', await b.evaluate(`(() => { const bar = window.__q('candidate-like').getBoundingClientRect().top; const a = window.__q('candidate-disclaimer').getBoundingClientRect(); const c = window.__q('candidate-safety').getBoundingClientRect(); return a.bottom <= bar && c.bottom <= bar && a.top >= 0; })()`), '');
  await note('F5_10_스크롤끝_360x740.png');
  const photoRadius = await b.evaluate(`parseFloat(getComputedStyle(window.__q('candidate-gallery')).borderTopLeftRadius)`);
  check('A', 'D8 4차: 10 큰 사진 둥글기 12(M7)', photoRadius === 12, `${photoRadius}px`);

  // 신고: 셋째(최OO)
  await b.click(sel('candidate-header-back'));
  await b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-card-2')`);
  await b.click(sel('rec-card-2'));
  await b.waitFor(`!!window.__q('candidate-head')`);
  await b.click(sel('candidate-header-right'));
  check('A', '상단 "신고 · 차단" → 시트: 제목 · 신고하기(+작은 글) · 차단하기(+작은 글) · 취소', (await b.waitFor(`!!window.__q('report-menu-report')`)) && (await has(REPORT_SHEET.reportHint)) && (await has(REPORT_SHEET.blockHint)) && (await has(REPORT_SHEET.cancel)), '');
  await measure('신고 · 차단 시트');
  await note('F5_11b_시트_360x740.png');
  await b.click(sel('report-menu-report'));
  await b.waitFor(`!!window.__q('report-reason-RP1')`);
  const reasonsOk = (await Promise.all(REPORT_SHEET.reasons.map((r) => has(r)))).every(Boolean);
  check('A', '신고 사유 8개가 정책 5-2 이름 그대로 보이고, 미성년자로 보임 아래에 24시간 안내, 맨 아래 익명 안내가 있다', reasonsOk && (await q('report-reason-RP8')) && (await inner('report-minor-note')) === REPORT_SHEET.reasonRP6Note && (await inner('report-anonymous-note')) === REPORT_SHEET.anonymousNote, '');
  await measure('신고 사유');
  await note('F5_11b_사유_360x740.png');
  await b.click(sel('report-submit'));
  check('A', '사유를 안 고르고 [제출하기] → "신고 사유를 골라 주세요." 이고 서버(모의)에는 아무것도 가지 않는다', (await inner('report-reason-error')) === REPORT_SHEET.errors.noReason && (await peek(EMAIL_A)).reports.length === 0, '');
  await b.click(sel('report-reason-RP8'));
  await b.type(sel('report-desc'), '짧아요');
  await b.click(sel('report-submit'));
  check('A', '기타 + 설명 10자 미만 → "10자 이상 써 주세요."', (await inner('report-desc-error')) === REPORT_SHEET.errors.descShort, '');
  await b.click(sel('report-reason-RP6'));
  await b.type(sel('report-desc'), '');
  await b.type(sel('report-desc'), '프로필 사진이 어려 보여요');
  await b.click(sel('report-submit'));
  check('A', '미성년자로 보임 + 설명 → 제출 → 이 화면에 머물고 토스트 "신고했어요. 확인한 뒤에 처리할게요."', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(REPORT_SHEET.done)})`)) && (await path0()).startsWith('/candidate/'), `경로 ${await path0()}`);
  const rp = (await peek(EMAIL_A)).reports;
  check('A', '서버(모의)에 신고 행 1건: 사유 RP6 · 설명 · 대상 demo-cand-3', rp.length === 1 && rp[0].reason === 'RP6' && rp[0].target === 'demo-cand-3' && rp[0].description === '프로필 사진이 어려 보여요', JSON.stringify(rp));
  await note('F5_10_신고완료_360x740.png');
  check('A', 'D8 4차 M14: 신고 완료 토스트가 하단 바 버튼을 가리지 않는다(토스트 아래 끝 ≤ 버튼 위 − 12)', await b.evaluate(`(() => { const t = window.__q('candidate-toast').getBoundingClientRect(); const btn = window.__q('candidate-pass').getBoundingClientRect(); return t.bottom <= btn.top - 11; })()`), '');
  await b.click(sel('candidate-header-back'));
  await b.waitFor(`location.pathname === '/recommendations' && !!window.__q('rec-card-1')`);
  check('A', '신고한 상대는 신고자의 09 목록에서 즉시 사라진다(카드 2장, 부제 "두 분")', !(await q('rec-card-2')) && (await has('두 분')), await inner('recs-subtitle'));

  // 차단: 첫째(김OO, 호감 보낸 카드)
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-head')`);
  await b.click(sel('candidate-header-right'));
  await b.waitFor(`!!window.__q('report-menu-block')`);
  await b.click(sel('report-menu-block'));
  check('A', '[차단하기] → 확인창 "이분을 차단할까요? 서로 보이지 않게 돼요." [차단하기] [취소]', (await b.waitFor(`!!window.__q('report-block-confirm-confirm')`)) && (await has(REPORT_SHEET.blockConfirm)), '');
  await measure('차단 확인창');
  await note('F5_11b_차단확인_360x740.png');
  await b.click(sel('report-block-confirm-cancel'));
  check('A', '[취소] → 아무것도 일어나지 않는다(서버 차단 0)', (await peek(EMAIL_A)).blocked.every((x) => x === 'demo-cand-3') && (await path0()).startsWith('/candidate/'), JSON.stringify((await peek(EMAIL_A)).blocked));
  await b.waitFor(`!!window.__q('report-menu-block')`); // 취소하면 선택 시트로 돌아온다
  await b.click(sel('report-menu-block'));
  await b.waitFor(`!!window.__q('report-block-confirm-confirm')`);
  await b.click(sel('report-block-confirm-confirm'));
  check('A', '차단 확인 → 진입한 화면(09)으로 돌아가고 그 사람은 목록에서 즉시 사라진다', (await b.waitFor(`location.pathname === '/recommendations' && !window.__q('rec-head-1') && !!window.__q('rec-head-0')`)) && !(await text()).includes('김OO'), `경로 ${await path0()}`);
  check('A', '서버(모의)에 차단 행이 생겼다(demo-cand-1)', (await peek(EMAIL_A)).blocked.includes('demo-cand-1'), JSON.stringify((await peek(EMAIL_A)).blocked));
  await note('F5_09_차단후_360x740.png');

  // ═══ B. 추천 0명 ═══
  check('B', '새 흐름으로 09 까지 간다(추천 0명 계정)', await toRecs('rec0@email.com'), '');
  t = await text();
  check('B', '빈 상태: 제목 · 본문이 카피 그대로이고 남은 시간은 그대로, 임시 설문 동안 보조 · [희망 조건 보기]는 숨김(D-48)', t.includes(RECS.emptyTitle) && t.includes(RECS.emptyBody) && !t.includes(RECS.emptyHint) && !(await q('recs-empty-prefs')) && (await q('recs-remaining')) && !(await q('rec-card-0')), '');
  await measure('09 추천 0명');
  await note('F5_13_추천없음_360x740.png');
  check('B', 'D8 4차 M10: 빈 상태 그림(140) · 본문 sub', (await q('recs-empty-art')) && (await b.evaluate(`Math.round(window.__q('recs-empty-art').querySelector('img')?.getBoundingClientRect().width ?? window.__q('recs-empty-art').getBoundingClientRect().width)`)) >= 140, '');

  // ═══ B2. 0장 + 서버 신호(0008 · D-40): 준비 중(NK02) · 첫 추천 대기(NK01) ═══
  check('B', '새 흐름으로 09 까지 간다(오늘 배치 전 계정 recprep)', await toRecs('recprep@email.com'), '');
  check('B', 'ready=false → "추천을 준비하고 있어요." + 보조, 남은 시간은 그대로', (await q('recs-preparing')) && (await inner('recs-wait-title')) === RECS.preparing && (await inner('recs-wait-note')) === RECS.preparingNote && (await q('recs-remaining')) && !(await q('recs-empty-prefs')), '');
  await measure('09 준비 중(NK02)');
  await note('F5_13c_준비중_360x740.png');
  check('B', '새 흐름으로 09 까지 간다(첫 목록 차례 전 계정 recfirst)', await toRecs('recfirst@email.com'), '');
  const firstTitle = await inner('recs-wait-title');
  check('B', 'first_list_pending → "첫 추천은 N시간 뒤에 도착해요."(또는 오늘 오전 9시 · N분) + 보조', (await q('recs-first-wait')) && /^(첫 추천은 \d+(시간|분) 뒤에 도착해요\.|오늘 오전 9시에 도착해요\.)$/.test(firstTitle) && (await inner('recs-wait-note')) === RECS.firstWaitNote, firstTitle);
  await measure('09 첫 추천 대기(NK01)');
  await note('F5_13b_첫추천대기_360x740.png');

  // ═══ C. 시간이 끝나면 새 목록 ═══
  check('C', '새 흐름으로 09 까지 간다(곧 갱신되는 계정)', await toRecs('recexpired@email.com'), '');
  const before = await inner('rec-head-0');
  await note('F5_09_만료전_360x740.png');
  check('C', '남은 시간이 0 이 되면 자동으로 다시 불러와 카드가 새 사람으로 바뀐다', (await b.waitFor(`window.__q('rec-head-0') && window.__q('rec-head-0').innerText !== ${JSON.stringify(before)}`, 20000)) && (await inner('rec-head-0')).startsWith('문OO · 32'), `${before} → ${await inner('rec-head-0')}`); // F24 인물: 정OO 31 → 문OO 32
  await note('F5_09_만료후_360x740.png');

  // ═══ D. 불러오기 실패 ═══
  await b.open('/sign-in', `true`);
  check('D', '새 흐름으로 09 까지 간다(처음 한 번 실패하는 계정)', await toRecs('recflaky@email.com'), '');
  check('D', '불러오기에 실패하면 인터넷 문구 + [다시 시도]를 보인다', (await q('recs-error')) && (await has(COMMON.offline)) && (await q('recs-retry')), await inner('recs-error'));
  await measure('09 불러오기 실패');
  await note('F5_09_오류_360x740.png');
  await b.click(sel('recs-retry'));
  check('D', '[다시 시도] → 카드가 나온다', await b.waitFor(`!!window.__q('rec-card-0')`), '');

  // ═══ E. 호감 한도 ═══
  check('E', '새 흐름으로 09 까지 간다(호감 한도를 다 쓴 계정)', await toRecs('reclimit@email.com'), '');
  await b.click(sel('rec-card-0'));
  await b.waitFor(`!!window.__q('candidate-like')`);
  await b.click(sel('candidate-like'));
  check('E', '한도를 다 쓰면 [호감 보내기]가 흐려지고 안내 "오늘 보낼 수 있는 호감을 모두 보냈어요…"가 나온다', (await b.waitFor(`!!window.__q('candidate-limit')`)) && (await inner('candidate-limit')) === CANDIDATE.likeLimit && (await path0()).startsWith('/candidate/'), '');
  await note('F5_10_호감한도_360x740.png');

  // ═══ F. 볼 수 없는 프로필 ═══
  check('F', '새 흐름으로 09 까지 간다(상대 프로필을 볼 수 없는 계정)', await toRecs('recgone@email.com'), '');
  await b.click(sel('rec-card-0'));
  check('F', '"이 프로필은 더 이상 볼 수 없어요." + [확인]', (await b.waitFor(`!!window.__q('candidate-unavailable-ok')`)) && (await has(CANDIDATE.unavailable)), '');
  await note('F5_10_볼수없음_360x740.png');
  await b.click(sel('candidate-unavailable-ok'));
  check('F', '[확인] → 진입한 화면(09)으로', await b.waitFor(`location.pathname === '/recommendations'`), `경로 ${await path0()}`);

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
console.log(`\nF5 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
