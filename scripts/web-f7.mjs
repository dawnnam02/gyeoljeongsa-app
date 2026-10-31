// F7 화면 점검(12 설정 · 하위 화면 9개 · 약관 시트 · 탈퇴 2단계 · 로그아웃 · 10 신고 → 12 신고 내역 · 차단 목록). 무료 · 네트워크 없음(로컬 서버 + 로컬 브라우저, 데모 모드 모의 서버).
//  먼저 `npm run check:web:demo`(= 데모 모드 웹 번들 dist-demo/)를 만든 뒤 쓴다.
//  헤드리스 Edge 로 폭 360 에서 사람이 하는 순서대로 누르며 잰다. 세션이 메모리뿐이라 흐름마다 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → 08 → 09 → 탭 '설정' 으로 처음부터 간다.
//   A. 12 목록(줄 13 · 정보 묶음 · 로그아웃 · 탈퇴하기) · 인증 서류 "준비 중이에요"   B. 알림(스위치 저장 → 서버 열)   C. 보안(처음 꺼짐 → 켬)
//   D. 동의 관리(CK9 켜기 · CK4 켜기 → 끄기 확인창 → 철회)   E. 차단 목록(장면 settings: 2명 → 해제)   F. 신고 내역(상태 3 · 날짜)   G. 고객센터 · 안전 안내 · 라이선스 · 이미지 고지 · 약관 시트
//   I. 10 에서 신고 → 12 신고 내역 · 차단 목록에 오른다   W. 탈퇴(확인창 → 인증번호 틀림 → 맞음 → 01, 서버 탈퇴) · 발송 실패 → 취소 → 로그아웃 → 01
//   H. 어느 화면이든: 가로 넘침 0 · 글자 12 이상 · 터치 44 이상 · 콘솔 오류 0 · 바깥 요청 0 · 브라우저 저장소 비어 있음
// 사용: node scripts/web-f7.mjs [번들 폴더]   (npm run check:f7, 스크린샷은 확인/스크린샷/F7_* 에 저장)
// 종료 코드: 0 통과 · 1 실패 · 2 번들이나 브라우저가 없어 못 봄(미확인)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findBrowser, openBrowser, sleep } from './lib/browser.mjs';
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
const { REPORT_SHEET, SAFETY_GUIDE, CHILD_SAFETY, SUPPORT, SIGN_IN } = await load(path.join(APP_DIR, 'src', 'content', 'copy.ts'));
const S = await load(path.join(APP_DIR, 'src', 'content', 'settingsCopy.ts'));
const CK16_VERSION = (await load(path.join(APP_DIR, 'src', 'config', 'laterConsent.ts'))).LATER_CONSENT_VERSIONS.CK16; // 판은 한 곳(판_관리 2-1 → laterConsent.ts)

const b = await openBrowser({ distDir, shotDir, width: Number(process.env.SHOT_WIDTH ?? 360), height: 740 });
let exitCode = 0;
const note = async (name) => console.log(`       스크린샷 ${await b.shot(name)}`);
const text = () => b.evaluate('window.__text()');
const has = async (s) => (await text()).includes(s);
const path0 = () => b.evaluate('location.pathname + location.search');
const sel = (id) => `[data-testid="${id}"]`;
const q = (id) => b.evaluate(`!!window.__q(${JSON.stringify(id)})`);
const inner = (id) => b.evaluate(`(window.__q(${JSON.stringify(id)})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
const checked = (id) => b.evaluate(`window.__q(${JSON.stringify(id)})?.getAttribute('aria-checked') === 'true'`);
const peekSettings = (email) => b.evaluate(`JSON.stringify(window.__demoPeek.settings(${JSON.stringify(email.replace('@', 'v4on@'))}))`).then(JSON.parse);
const peekConsents = (email) => b.evaluate(`JSON.stringify(window.__demoPeek.consents(${JSON.stringify(email.replace('@', 'v4on@'))}))`).then(JSON.parse);
// D-191(v5 청사진 6-2): 등급은 아이콘 + 짧은 설명으로 남는다 — '등급' 말 자체는 있어도 되고, 숫자 · 점수 · 순위 · 높음/낮음 · 'N등급'은 없어야 한다
const noScore = async () => !/점수|순위|[0-9]s*등급|등급s*[0-9]|높은 등급|낮은 등급|상위|하위/.test(await text());
const back = async (page) => {
  await b.click(sel(`settings-${page}-header-back`));
  return b.waitFor(`!!window.__q('settings-rows')`);
};
const openRow = async (row, until) => {
  await b.click(sel(`settings-row-${row}`));
  return b.waitFor(until);
};

async function measure(label) {
  const m = await b.evaluate('window.__metrics()');
  check('H', `${label}: 360 폭 가로 넘침 0 · 글자 12 이상 · 터치 44 이상`, m.scrollW <= m.innerW && m.over.length === 0 && m.minFont >= 12 && m.small.length === 0, `넘침 ${m.over.length}(${m.over.slice(0, 2).join(',')}) · 최소 글자 ${m.minFont} · 작은 터치 ${m.small.join(',') || '없음'}`);
}

// 02 → 03 → 04 데모 건너뛰기 → 06 → 07 → [이대로 확정] → 08 [확인했어요] → 09
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
  await b.traitsNext(); // 3부-자: type_card 켜짐이면 [다음] 한 번 더
  await b.waitFor(`location.pathname === '/profile' && !!window.__q('profile-first-confirm')`, 10000);
  await b.click(sel('profile-first-confirm'));
  return b.waitFor(`location.pathname === '/recommendations' && (!!window.__q('rec-card-0') || !!window.__q('recs-empty') || !!window.__q('recs-error'))`, 10000);
}

async function toSettings(email) {
  const ok = await toRecs(email);
  await b.click('[aria-label="설정"]');
  return ok && (await b.waitFor(`location.pathname === '/settings' && !!window.__q('settings-rows')`));
}

try {
  // ═══ A. 목록 ═══
  const EMAIL = 'settingsf7@email.com'; // 장면 settings: 차단 2명 · 신고 3건이 미리 있다
  check('A', '09 → 탭 "설정" → 12(/settings) 목록', await toSettings(EMAIL), `경로 ${await path0()}`);
  const rowsShown = await b.evaluate(`[...document.querySelectorAll('[data-testid^="settings-row-"]:not([data-testid$="-chevron"]):not([data-testid$="-icon"])')].map((el) => el.innerText.replace(/\\s+/g, ' ').trim())`);
  // QP-A(v5 · 카피.md 12-Q): '구매 · 등급 구독' 자리에 '크레딧 · 구매 내역'(→ T5, 상점 스위치와 상관없이). 사업자 정보 줄은 값이 비어 숨김 → 13줄
  // R-A(D-200): '내 등급'(→ 16-G) · '아는 분 피하기'(12-5) 두 줄이 공개 범위 다음에 → 15줄
  // 3부-카(IF3-F · G-03): 스위치 sky_book 이 켜진 데모에는 정보 묶음 맨 아래 '하늘 도감' 줄이 더해진다(실서버 처음값 꺼짐 — 줄 0) → 16줄
  // AIT-F ⑤: 데모 판에는 기본 묶음 맨 끝(안전 안내 다음)에 '시험용 AI 코드' 줄이 더해진다(실서버 판 줄 0) → 17줄
  // IF5-F1(12-1): 스위치 saju_yard 가 켜진 데모에는 정보 묶음 바로 위(안전 안내 다음)에 '사주 마당' 줄이 더해진다(실서버 처음값 꺼짐 — 줄 0) → 18줄
  check('A', '줄 18개(v5 + 사주 마당 + 시험용 AI 코드 + 하늘 도감): 알림 · 공개 · 내 등급 · 아는 분 피하기 · 인증(오른쪽 "준비 중") · 크레딧 · 구매 내역 · 차단 · 신고 · 보안 · 고객센터 · 동의 · 이용약관 · 안전 안내 · 사주 마당(데모, 스위치 saju_yard) · 시험용 AI 코드(데모 판) · 정보 › 오픈소스 라이선스 · 이미지 출처 고지 · 하늘 도감(데모, 스위치 sky_book), 임시 설문 동안 희망 조건 수정 숨김 D-48 · 사업자 정보(값 비어) 숨김',
    rowsShown.length === 18 && rowsShown[0].startsWith(S.SETTINGS.rows.notifications) && rowsShown[2].startsWith(S.SETTINGS.rows.grade) && rowsShown[3].startsWith(S.SETTINGS.rows.avoid) && rowsShown[4].includes(S.SETTINGS.verificationSoon) && rowsShown[5].startsWith(S.SETTINGS.rows.credits) && rowsShown[12].startsWith(S.SETTINGS.rows.safety) && rowsShown[13].startsWith('사주 마당') && rowsShown[14].startsWith('시험용 AI 코드') && rowsShown[16].startsWith(S.SETTINGS.rows.imageCredit) && rowsShown[17].startsWith('하늘 도감') && !rowsShown.some((r) => r.startsWith(S.SETTINGS.rows.preferences)), rowsShown.map((r) => r.split(' ')[0]).join(' / '));
  check('A', '"정보" 묶음 글 · [로그아웃] · [탈퇴하기]가 있고 "모든 데이터 삭제"라는 말은 없다', (await inner('settings-info-label')) === S.SETTINGS.rows.infoGroup && (await q('settings-logout')) && (await q('settings-withdraw')) && !(await has('모든 데이터 삭제')), '');
  check('A', '12 에 등급 숫자 · 점수 · 순위 · 높음/낮음 말이 없다(v5 6-2: 등급 말은 아이콘 설명으로 남음)', await noScore(), '');
  await measure('12 목록 위');
  await note('F7_12_목록_360x740.png');
  await b.evaluate(`(() => { const el = window.__q('settings-list'); if (el) el.scrollTop = 99999; })()`);
  await measure('12 목록 아래');
  await note('F7_12b_목록아래_360x740.png');
  await b.click(sel('settings-row-verification'));
  check('A', '인증 서류 제출 → 이동 없이 토스트 "준비 중이에요"', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(S.SETTINGS.verificationToast)})`)) && (await path0()) === '/settings', '');

  // ═══ B. 알림 ═══
  // R-A(D-199 · 12-Q · 화면_요구사항 12-2): 서비스 알림 2줄 — '이번 주 만날 분이 정해졌을 때'(notify_match, 서버 P8 · P8b) · '대화방에 새 글이 왔을 때'(notify_chat, 0036). 호감 · 연결 줄 없음
  check('B', '알림 → 서비스 스위치 2개(만날 분 · 대화방 새 글 + 아래 글) + 마케팅 알림 + 아래 글 3줄 · 호감 · 옛 추천 줄 없음', (await openRow('notifications', `!!window.__q('settings-notify-match')`)) && (await has(S.NOTIFY.recommendation)) && (await has(S.NOTIFY.chat)) && (await has(S.NOTIFY.chatNote)) && (await has(S.NOTIFY.marketing)) && (await has(S.NOTIFY.marketingNotes[2])) && !(await q('settings-notify-like')) && !(await q('settings-notify-recommendation')), '');
  check('B', '서비스 알림 2줄 처음값 켜짐 · 마케팅 꺼짐(03 에서 선택 동의 안 함)', (await checked('settings-notify-match')) && (await checked('settings-notify-chat')) && !(await checked('settings-notify-marketing')), '');
  await b.click(sel('settings-notify-chat'));
  await b.waitFor(`window.__q('settings-notify-chat').getAttribute('aria-checked') === 'false'`);
  const notify = (await peekSettings(EMAIL)).notify;
  check('B', '"대화방에 새 글이 왔을 때"를 끄면 서버(모의) profiles.notify_chat 만 false', notify && notify.notify_chat === false && notify.notify_match === true && notify.notify_like === true && notify.notify_recommendation === true, JSON.stringify(notify));
  await measure('12 알림');
  await note('F7_12h_알림_360x740.png');
  await back('notifications');

  // ═══ C. 보안 ═══
  await openRow('security', `!!window.__q('settings-capture-block')`);
  check('C', '보안: "상대 화면 캡처 차단" 처음값 꺼짐 · 아래 글(N32)', !(await checked('settings-capture-block')) && (await inner('settings-capture-note')) === S.SECURITY.captureBlockNote, '');
  await b.click(sel('settings-capture-block'));
  check('C', '누르면 확인창 없이 바로 켜짐', await b.waitFor(`window.__q('settings-capture-block').getAttribute('aria-checked') === 'true'`), '');
  await measure('12 보안');
  await note('F7_12d_보안_360x740.png');
  await back('security');

  // ═══ D. 동의 관리 ═══
  await openRow('consents', `!!window.__q('settings-consent-CK4')`);
  check('D', '선택 동의 2줄(CK4 · CK9, 03 글 그대로) · 동의한 내용 7줄(보기 ›) · 필수 칸 안내', (await b.evaluate(`window.__qa('settings-consent-view-CK1').length + document.querySelectorAll('[data-testid^="settings-consent-view-"]').length`)) >= 7 && (await inner('settings-consents-required-note')) === S.CONSENT_MANAGE.requiredNote, '');
  await b.click(sel('settings-consent-CK9'));
  await b.waitFor(`window.__q('settings-consent-CK9').getAttribute('aria-checked') === 'true'`);
  const c1 = await peekConsents(EMAIL);
  check('D', 'CK9 켜기 → 확인창 없이 동의 기록(agreed) + 토스트 "저장했어요."', c1.some((c) => c.item_code === 'CK9' && c.agreed && c.revoked_at === null) && (await has(S.CONSENT_MANAGE.saved)), '');
  // 3부-사(법무 L22 C5): CK4 켜기는 토글 한 번이 아니라 설문과 같은 종교 동의 카드(고지 전부 · 체크 · 같은 무게 버튼) → 체크 + [동의하고 답할게요]
  await b.click(sel('settings-consent-CK4'));
  const relCard = await b.waitFor(`!!window.__q('chat-card-REL') && !!window.__q('chat-rel-what') && !!window.__q('chat-rel-decline')`);
  check('D', 'CK4 켜기 → 종교 동의 카드(네 줄 상자 · 체크 · 같은 무게 버튼 둘) · 토글 한 번으로 켜짐 0', relCard && (await b.evaluate(`window.__q('settings-consent-CK4').getAttribute('aria-checked') === 'false'`)), '');
  await note('F7_12j_종교동의카드_360x740.png');
  await b.click(sel('chat-rel-check'));
  await b.click(sel('chat-rel-agree'));
  await b.waitFor(`window.__q('settings-consent-CK4').getAttribute('aria-checked') === 'true'`);
  check('D', "CK4 켜짐이면 덧붙이는 안내 대신 '끄면 종교 답을 바로 지워요…'(카피 12-Q M9)", await has(S.CONSENT_MANAGE.ck4OnNote), '');
  await b.click(sel('settings-consent-CK4'));
  check('D', 'CK4 끄기 → 확인창 "종교 정보 동의를 끌까요?"(N25) [끄기] [취소]', (await b.waitFor(`!!window.__q('settings-ck4-off-confirm')`)) && (await inner('settings-ck4-off-title')) === S.CONSENT_MANAGE.ck4OffTitle, '');
  await measure('12 동의 관리 끄기 확인창');
  await note('F7_12j_종교동의끄기_360x740.png');
  await b.click(sel('settings-ck4-off-confirm'));
  await b.waitFor(`window.__q('settings-consent-CK4').getAttribute('aria-checked') === 'false'`);
  const c2 = await peekConsents(EMAIL);
  check('D', '[끄기] → 서버(모의) CK4 동의에 철회 시각이 적힌다(revoke_consent)', c2.filter((c) => c.item_code === 'CK4' && c.agreed).every((c) => c.revoked_at !== null), JSON.stringify(c2.filter((c) => c.item_code === 'CK4')));
  await measure('12 동의 관리');
  await note('F7_12i_동의관리_360x740.png');
  await b.click(sel('settings-consent-view-CK1'));
  check('D', '보기 › → 03 과 같은 요약 시트', await b.waitFor(`!!window.__q('consent-summary-CK1')`), '');
  await b.click('[aria-label="닫기"]');
  await b.waitFor(`!window.__q('consent-summary-CK1')`);
  // L17A: 03 밖 선택 동의 CK11 ~ CK16 줄 · CK16 켜기 → 끄기(확인창 → 철회) · CK15 보기 › 요약
  const laterCodes = ['CK11', 'CK12', 'CK13', 'CK14', 'CK15', 'CK16'];
  check('D', 'L17A: 선택 동의 CK11 ~ CK16 6줄 · 보기 › 6줄 · 꺼진 CK11 ~ CK15 잠김', (await b.evaluate(`${JSON.stringify(laterCodes)}.every((c) => !!window.__q('settings-consent-' + c) && !!window.__q('settings-consent-view-' + c))`)) && (await b.evaluate(`['CK11','CK12','CK13','CK14','CK15'].every((c) => window.__q('settings-consent-' + c).getAttribute('aria-disabled') === 'true')`)), '');
  await b.click(sel('settings-consent-CK16'));
  await b.waitFor(`window.__q('settings-consent-CK16').getAttribute('aria-checked') === 'true'`);
  const c3 = await peekConsents(EMAIL);
  check('D', `L17A: CK16 켜기 → 동의 기록(판 ${CK16_VERSION})`, c3.some((c) => c.item_code === 'CK16' && c.agreed && c.revoked_at === null && c.text_version === CK16_VERSION), JSON.stringify(c3.filter((c) => c.item_code === 'CK16')));
  await b.click(sel('settings-consent-CK16'));
  check('D', 'L17A: CK16 끄기 → 확인창 "동의를 거둘까요?"', (await b.waitFor(`!!window.__q('settings-later-off-confirm')`)) && (await inner('settings-later-off-title')) === S.CONSENT_MANAGE.offTitle, '');
  await b.click(sel('settings-later-off-confirm'));
  await b.waitFor(`window.__q('settings-consent-CK16').getAttribute('aria-checked') === 'false'`);
  const c4 = await peekConsents(EMAIL);
  check('D', 'L17A: [거두기] → CK16 동의에 철회 시각(revoke_consent)', c4.filter((c) => c.item_code === 'CK16' && c.agreed).every((c) => c.revoked_at !== null), '');
  await measure('12 동의 관리 CK11 ~ CK16');
  await b.click(sel('settings-consent-view-CK15'));
  check('D', 'L17A: CK15 보기 › → 동의문구 4-15 요약 시트', await b.waitFor(`!!window.__q('consent-summary-CK15')`), '');
  await b.waitFor(`!!document.querySelector('[aria-label="닫기"]')`, 5000); // QP-21: 시트가 열리는 동안 [닫기]가 늦게 붙는다
  await b.click('[aria-label="닫기"]');
  await b.waitFor(`!window.__q('consent-summary-CK15')`);
  await back('consents');

  // ═══ E. 차단 목록 ═══
  await openRow('blocked', `!!window.__q('settings-blocked-list') || !!window.__q('settings-blocked-empty')`);
  check('E', '차단 목록: "박OO · 29" · "최OO · 33" + [차단 해제]', (await inner('settings-blocked-head-demo-blocked-1')) === '박OO · 29' && (await inner('settings-blocked-head-demo-blocked-2')) === '최OO · 33' && (await has(S.BLOCKED.unblock)), '');
  await measure('12 차단 목록');
  await note('F7_12l_차단목록_360x740.png');
  await b.click(sel('settings-unblock-demo-blocked-1'));
  check('E', '[차단 해제] → 그 줄이 사라지고 서버(모의) 차단에서 빠진다', (await b.waitFor(`!window.__q('settings-blocked-row-demo-blocked-1')`)) && !(await peekSettings(EMAIL)).blocked.includes('demo-blocked-1'), JSON.stringify((await peekSettings(EMAIL)).blocked));
  await back('blocked');

  // ═══ F. 신고 내역 ═══
  await openRow('reports', `!!window.__q('settings-reports-list')`);
  const reportRows = await b.evaluate(`[...document.querySelectorAll('[data-testid^="settings-report-row-"]')].map((el) => el.innerText.replace(/\\s+/g, ' ').trim())`);
  check('F', '신고 내역 3건: 날짜(올해 "10월 15일" 꼴 · 다른 해 "2025년 12월 3일") + 상태(확인 중 · 처리됨 · 접수됨), 상대 이름 없음',
    reportRows.length === 3 && reportRows.some((r) => r.includes('2025년 12월 3일') && r.includes('접수됨')) && reportRows.some((r) => r.includes('확인 중')) && reportRows.some((r) => r.includes('처리됨')) && reportRows.every((r) => !r.includes('OO')), reportRows.join(' / '));
  await measure('12 신고 내역');
  await note('F7_12n_신고내역_360x740.png');
  await back('reports');

  // ═══ G. 고객센터 · 안전 안내 · 라이선스 · 이미지 고지 · 약관 ═══
  await openRow('support', `!!window.__q('settings-child-safety')`);
  // QP-04: 값(FILL_INS)이 비면 이메일 · 운영 시간 · 연락처 줄과 [복사] · [메일 앱 열기]를 그리지 않는다 — 자리 글 {…} 0
  check('G', '고객센터(QP-04): 값이 정해지기 전에는 이메일 · 운영 시간 줄 없음 · 자리 글 {…} 0 + 아동 안전 문의(N35)', !(await has(SUPPORT.emailLabel)) && !(await q('settings-support-copy')) && !(await b.evaluate(`/\{[^}]+\}/.test(document.body.innerText)`)) && (await has(CHILD_SAFETY.row)) && (await has(CHILD_SAFETY.policy)), '');
  await measure('12 고객센터');
  await note('F7_12c_고객센터_360x740.png');
  await back('support');
  await openRow('safety', `!!window.__q('settings-safety-lines')`);
  check('G', '안전 안내: 제목 + 맨 위 두 줄(112 · 119 먼저 / 상담전화 109 — 3부-차) + 7줄(N34)', (await inner('settings-safety-title')) === SAFETY_GUIDE.title && (await inner('settings-safety-emergency')) === SAFETY_GUIDE.emergency && (await inner('settings-safety-crisis')) === SAFETY_GUIDE.crisis && (await has(SAFETY_GUIDE.lines[5])) && (await has(SAFETY_GUIDE.minorNote)), '');
  await measure('12 안전 안내');
  await note('F7_12f_안전안내_360x740.png');
  await back('safety');
  await openRow('licenses', `!!window.__q('settings-licenses-list')`);
  check('G', '오픈소스 라이선스: 안내(법무 5-6) + Lucide · Pretendard · npm 패키지', (await inner('settings-licenses-intro')) === S.LICENSES.intro && (await has('Lucide · ISC · MIT')) && (await has('Pretendard · OFL')), '');
  await measure('12 오픈소스 라이선스');
  await note('F7_12p_라이선스_360x740.png');
  await b.click(sel('settings-license-lucide'));
  check('G', '줄을 누르면 전문(영어 원문)이 시트로 열린다', await b.waitFor(`document.body.innerText.includes('ISC License')`), '');
  await measure('12 라이선스 전문');
  await b.click('[aria-label="닫기"]');
  await b.waitFor(`!document.body.innerText.includes('ISC License')`);
  await back('licenses');
  await openRow('image-credit', `!!window.__q('settings-image-credit-body')`);
  check('G', '이미지 출처 고지(N30)', (await inner('settings-image-credit-body')) === S.IMAGE_CREDIT.body, '');
  await back('image-credit');
  await b.click(sel('settings-row-legal'));
  check('G', '이용약관 · 개인정보 처리방침 → 03 과 같은 읽기 시트(탭 2개)', (await b.waitFor(`!!window.__q('legal-tab-terms') && !!window.__q('legal-tab-privacy')`)), '');
  await measure('12 약관 시트');
  // QP-04: 약관 · 처리방침의 자리 글({운영자 상호 또는 성명} · {공개일} …)은 값이 비면 그 줄째 숨김 — 끝까지 내려 보며 확인
  const legalHoles = async () => {
    let found = [];
    for (let i = 0; i < 40; i += 1) {
      found = found.concat(await b.evaluate(`(document.body.innerText.match(/[{][^}]{1,20}[}]/g) || [])`));
      const end = await b.evaluate(`(() => { const el = window.__q('legal-reader-list'); if (!el) return true; const before = el.scrollTop; el.scrollTop = before + 600; return el.scrollTop === before; })()`);
      await sleep(80);
      if (end) break;
    }
    return [...new Set(found)];
  };
  const termsHoles = await legalHoles();
  await b.click(sel('legal-tab-privacy'));
  await sleep(300);
  const privacyHoles = await legalHoles();
  check('G', 'QP-04: 약관 · 처리방침 화면에 자리 글 {…} 0(값이 빈 줄은 숨김)', termsHoles.length === 0 && privacyHoles.length === 0, [...termsHoles, ...privacyHoles].join(' '));
  await b.click('[aria-label="닫기"]');
  await b.waitFor(`!window.__q('legal-tab-terms')`);

  // ═══ W. 탈퇴 ═══
  await b.click(sel('settings-withdraw'));
  check('W', '[탈퇴하기] → 확인창(법무 5-6 제목 · 본문 · 보조) [탈퇴하기] [취소], 버튼 세로', (await b.waitFor(`!!window.__q('withdraw-confirm-confirm')`)) && (await inner('withdraw-confirm-title')) === S.WITHDRAW.title && (await inner('withdraw-confirm-sub')) === S.WITHDRAW.sub &&
    (await b.evaluate(`window.__q('withdraw-confirm-confirm').getBoundingClientRect().bottom <= window.__q('withdraw-confirm-cancel').getBoundingClientRect().top`)), '');
  await measure('12 탈퇴 확인창');
  await note('F7_12g_탈퇴확인_360x740.png');
  await b.click(sel('withdraw-confirm-confirm'));
  check('W', '확인창 [탈퇴하기] → 같은 자리에서 인증번호 재확인(N31): 제목 · 안내 · 다시 받기 안내', (await b.waitFor(`!!window.__q('withdraw-code')`)) && (await inner('withdraw-otp-title')) === S.WITHDRAW.otpTitle && /뒤에 다시 받을 수 있어요/.test(await inner('withdraw-retry-after')), '');
  await measure('12 탈퇴 재확인');
  await note('F7_12e_탈퇴재확인_360x740.png');
  await b.type(sel('withdraw-code'), '000000');
  await b.click(sel('withdraw-submit'));
  check('W', '틀린 번호 → "인증번호가 맞지 않아요…"(02 글) · 칸이 비고 탈퇴가 아니다', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(SIGN_IN.errors.codeWrong)})`)) && (await b.evaluate(`window.__q('withdraw-code').value === ''`)) && !(await peekSettings(EMAIL)).withdrawn, '');
  await note('F7_12e_탈퇴틀림_360x740.png');
  await b.type(sel('withdraw-code'), '123456');
  await b.click(sel('withdraw-submit'));
  check('W', '맞는 번호 → 서버(모의) 탈퇴 확정 · 로그인 정보를 지우고 01(/onboarding)', (await b.waitFor(`location.pathname === '/onboarding'`)) && (await peekSettings(EMAIL)).withdrawn, `경로 ${await path0()}`);

  // 발송 실패 → 취소 → 로그아웃
  const EMAIL2 = 'wdsendfail@email.com';
  check('W', '새 흐름으로 12 까지 간다(탈퇴 인증번호 발송 실패 계정)', await toSettings(EMAIL2), '');
  await b.click(sel('settings-withdraw'));
  await b.waitFor(`!!window.__q('withdraw-confirm-confirm')`);
  await b.click(sel('withdraw-confirm-confirm'));
  check('W', '발송 실패 → 재확인 단계에 머물며 "인증번호를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요."(N31) · [인증번호 다시 받기]', (await b.waitFor(`document.body.innerText.includes(${JSON.stringify(S.WITHDRAW.sendFailed)})`)) && (await q('withdraw-resend')), '');
  await b.click(sel('withdraw-cancel'));
  check('W', '[취소] → 탈퇴 없이 12 목록', (await b.waitFor(`!!window.__q('settings-rows') && !window.__q('withdraw-code')`)) && !(await peekSettings(EMAIL2)).withdrawn, '');
  await b.click(sel('settings-logout'));
  check('W', '[로그아웃] → 확인창 없이 01(/onboarding)', await b.waitFor(`location.pathname === '/onboarding'`), `경로 ${await path0()}`);

  // ═══ I. 10 에서 신고 → 12 에 오른다 ═══
  const EMAIL3 = 'f7report@email.com';
  check('I', '새 흐름으로 09 까지 간다', await toRecs(EMAIL3), '');
  await b.click(sel('rec-card-2'));
  await b.waitFor(`!!window.__q('candidate-head')`);
  await b.click(sel('candidate-header-right'));
  await b.waitFor(`!!window.__q('report-menu-report')`);
  await b.click(sel('report-menu-report'));
  await b.waitFor(`!!window.__q('report-reason-RP1')`);
  check('I', '공용 시트(ReportBlockSheet): 사유 화면 ‹ + 제목 · 동그라미 8개 · RP6 안내 늘 보임', (await q('report-reasons-header-back')) && (await inner('report-minor-note')) === REPORT_SHEET.reasonRP6Note, '');
  await measure('10 신고 사유(공용 시트)');
  await note('F7_11c_신고사유_360x740.png');
  await b.click(sel('report-reason-RP8'));
  await b.type(sel('report-desc'), '짧아요');
  await b.click(sel('report-submit'));
  check('I', '기타 + 짧은 설명 → 설명 칸 아래 "10자 이상 써 주세요."', (await inner('report-desc-error')) === REPORT_SHEET.errors.descShort, '');
  await note('F7_11e_기타짧음_360x740.png');
  await b.click(sel('report-reason-RP1'));
  await b.click(sel('report-submit'));
  await b.waitFor(`document.body.innerText.includes(${JSON.stringify(REPORT_SHEET.done)})`);
  await b.click(sel('candidate-header-back'));
  await b.waitFor(`location.pathname === '/recommendations'`);
  await b.click('[aria-label="설정"]');
  await b.waitFor(`!!window.__q('settings-rows')`);
  await openRow('reports', `!!window.__q('settings-reports-list')`);
  const rep = await b.evaluate(`[...document.querySelectorAll('[data-testid^="settings-report-row-"]')].map((el) => el.innerText.replace(/\\s+/g, ' ').trim())`);
  check('I', '방금 신고가 12 신고 내역에 "접수됨"으로 1건', rep.length === 1 && rep[0].includes('접수됨'), rep.join(' / '));
  await back('reports');
  await openRow('blocked', `!!window.__q('settings-blocked-list')`);
  check('I', '신고한 상대는 차단 목록에도 오른다(P5-03): "최OO · 33"', (await inner('settings-blocked-head-demo-cand-3')) === '최OO · 33', await inner('settings-blocked-list'));

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
console.log(`\nF7 화면 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(exitCode || (failed > 0 ? 1 : 0));
