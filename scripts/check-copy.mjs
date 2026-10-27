// 화면 글 점검(F1). 읽기 전용, 네트워크 없음.
//  03 동의 화면의 글(체크 칸 10줄 · 안내 상자 · 요약 · 링크 줄 · 오류 문구)과 01 · 02 화면의 글이
//  마케팅/카피.md · 법무/동의문구.md · 기획/화면_요구사항.md(N문구) · 기획/정책.md(NK문구)와 글자 그대로 같은지 본다.
//  A. src/content 의 생성 파일이 법무 문서에서 다시 뽑은 것과 같은가(원본이 바뀌었는데 안 옮겼는지)
//  B. 03 체크 칸 10줄: 카피.md 03-1 · 동의문구.md 1장 · 4장이 서로 같고 앱 글과 같은가
//  C. 필수 7 · 선택 2, [필수] · [선택] 글자 표시
//  D. 칸마다 요약 줄 · 동의하지 않으면 줄: 카피.md 03-2 · 동의문구.md 4장 · 앱 글
//  E. 안내 상자 · 부제 · 링크 줄 · 작은 글씨 · 오류 문구 · 버튼 글
//  F. 02 가입 안내(5-2)와 링크
//  G. 01 소개 3장 글
//  H. 01 · 02 · 03 앱 글이 모두 원본 문서 어딘가에 그대로 있는가
//  I. 동의 칸의 글이 바뀌었는데 문구 판을 안 올렸는지(글 지문)
//  K. 앱에 게시되는 약관 · 처리방침 · 동의문구에 작업 표시(변호사 확인 · 법무 제안 · 가정 D- · 결정 대기 · app: · 부록 · 목차 · 상태: 초안)가 없는가(F10)
//  O. 12 설정 · 하위 화면 · 탈퇴 글(F7, settingsCopy.ts)이 카피.md 12 · 동의문구 · 정책과 같은가
//  P. 04 · 05 임시 설문 글(F2L, surveyLiteCopy.ts)이 문항표 CSV · 카피.md 04 · 05 · 화면_요구사항과 같은가
//  Q. 11 호감 글(F6, likesCopy.ts)이 카피.md 11 · 화면_요구사항 · 정책과 같은가
//  R. 16 상점 글(F11, copy.ts 의 SHOP · TABS)이 카피.md 16 · 디자인 가이드 11-5 와 같은가
//  S. 16 상점 · 등급 화면 글(F13, shopCopy.ts · productCopy.ts)이 카피.md 16장과 한 글자씩 같은가 · 상품 46개/빨간 라벨 이유 27줄 · 금지어 · '매칭'은 1회 매칭만 · 등급/점수 허용 구역 · 작업 표시 새지 않음 · 카피 밖 글 목록
//  V. 공개 전 도착 화면 글(D42-M · D-178, boardingCopy.ts ARRIVE)이 카피.md 12장과 같은가 · 느낌표 · 재촉 0
//  W. 대화형 설문 글(V6-F, surveyChatCopy.ts CHAT_V6)이 카피.md 13장 표와 한 글자씩 같은가 · 느낌표 · 등급 · 점수 말 0 · CK16 카드 글 = 동의문구 4-16(L17A)
//  QP-A(D-196): 카피.md 14장 'v5 문구 바꿈'(14-0 '1장 표보다 앞선다')의 14-1 · 14-2 표는 같은 키의 옛 줄(08 표 · 13장 표)보다 앞선다(V5_COPY).
//        12-Q · 14장 글도 P · S 대조 원본에 넣는다. '매칭'은 '1회 매칭'(숨김 v4)과 '주간 매칭'(14-1 v5 글) 자리에만.
//  X. v5 새 화면 글(탑승권 T1 · 공개 T3 · 크레딧 T5 · 채팅 T4 — boardingCopy.ts · chatCopy.ts)이 카피.md 14-5-1 · 14-5-2 표(첫 칸 'T1 `키`' 꼴)와 같은가(QP-A 2부-나, 팀장 결정)
//        글 함수는 자리마다 표시 글자를 넣어 부르고, 카피의 {…} 자리와 같은 자리인지 본다. '(줄 없음)'은 앱에 그 키가 없어야 한다
//        D46-A: 만남 장면 글(T4S MEET_SCENE · T4 CHAT.room.metAt — meetCopy.ts · chatCopy.ts)도 카피.md 16장 표 18줄과 같은가 · 16-3 쓰지 않을 낱말 0(같은 X 점검 안에서, 점검 수 그대로)
//  J. 06 AI 정리 중 · 07 내 성향의 글이 카피.md 06 · 07 · 화면_요구사항(N13 · N14)에 그대로 있는가 · 근거 문항 이름 · 직접 입력 태그 후보(F3)
// 사용: node scripts/check-copy.mjs   (npm run check:copy)
// 종료 코드: 0 통과 · 1 실패
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { VERSIONS_BEGIN, VERSIONS_END, buildGenerated, consentFingerprints, legalDocFingerprints, readAllEditions, versionsBlock } from './lib/legal-output.mjs';
import { APP_DIR, SOURCES, cells, inline, parseConsentDoc, parseCopyConsent, parseLaterConsents, readCopyDoc, readDoc, readPlanDoc } from './lib/legal-source.mjs';
import { runCopyRules } from './check-copy-rules.mjs'; // R1 A⑦: T04(B17 5장 R1~R18) · K11 글 규칙 — 그룹 'T04' · 'K11'

// .ts 를 바로 불러올 때 Node 가 내는 안내(모듈 형식 미지정)는 글 점검과 상관없어서 끈다.
process.removeAllListeners('warning');

const rel = (file) => path.relative(APP_DIR, file).split(path.sep).join('/');
const results = [];
function check(group, title, ok, detail = '') {
  results.push({ group, ok });
  console.log(`[${ok ? '통과' : '실패'}] ${group}. ${title}${detail ? `\n       ${detail.split('\n').join('\n       ')}` : ''}`);
}
const note = (text) => console.log(`[참고] ${text}`);
const load = (file) => import(pathToFileURL(file).href);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);


// 정책 2-3 토글 표(종교 A06 … 부모님 자산 D04)와 앱 토글 정의(features/profile/profileLogic.ts)가 같은가
async function toggleTableMatches() {
  // 앱 파일은 별칭(@/) 때문에 Node 가 바로 읽지 못해서 TOGGLE_DEFS 줄을 글에서 읽는다
  const logicText = fs.readFileSync(path.join(APP_DIR, 'src', 'features', 'profile', 'profileLogic.ts'), 'utf8');
  const defs = [...logicText.matchAll(/question: '([A-D]\d\d)', range: (?:true|false), initial: (true|false)/g)].map((m) => ({ question: m[1], initial: m[2] === 'true' }));
  const policy = readPlanDoc('policy');
  const from = policy.indexOf('### 2-3. 토글 9개');
  const rows = policy.slice(from, policy.indexOf('\n### 2-4.', from)).split('\n').filter((l) => /^\| [^|]+ \| [A-D]\d\d \|/.test(l)).map(cells);
  if (rows.length !== defs.length) return false;
  return rows.every((r, i) => r[1] === defs[i].question && (r[3] === '켜짐') === defs[i].initial);
}

// 정책 5-2 신고 사유 표(RP1~RP8)의 사유 이름
function policyReportReasons() {
  // v5판 정책 P8-02 줄('사유 8개: RP1 가짜 프로필·사칭 · RP2 …')이 있으면 그것을, 없으면 v4판 5-2 표를 읽는다
  const v5 = readDoc(SOURCES.policy).split('\n').find((l) => /^\| P8-02 \|/.test(l));
  if (v5) {
    const names = [...cells(v5)[2].matchAll(/RP\d ([^·|]+?)(?= · RP\d| \(|\.|$)/g)].map((m) => m[1].trim());
    if (names.length === 8) return names;
  }
  const policy = readPlanDoc('policy');
  const from = policy.indexOf('### 5-2. 신고 사유 8개');
  const rows = policy.slice(from, policy.indexOf('\n### 5-3.', from)).split('\n').filter((l) => /^\| RP\d /.test(l)).map(cells);
  return rows.map((r) => r[1]);
}

// 정책 2-4 표(맞는 점 이름 19개: 구분 · 이름 · 문항)와 앱 recsLogic.ts 의 REASON_NAMES 가 같은가
async function reasonNamesMatchPolicy() {
  const logic = fs.readFileSync(path.join(APP_DIR, 'src', 'features', 'recs', 'recsLogic.ts'), 'utf8');
  const app = [...logic.matchAll(/^\s+([FE]\d\d): '([^']+)',$/gm)].map((m) => `${m[1]}=${m[2]}`);
  const policy = readPlanDoc('policy');
  const from = policy.indexOf('### 2-4.');
  const rows = policy.slice(from, policy.indexOf('\n### 2-5.', from)).split('\n').filter((l) => /^\| (조건|성향) \|/.test(l)).map(cells);
  const want = rows.map((r) => `${r[2]}=${r[1]}`);
  return rows.length === 19 && [...app].sort().join() === [...want].sort().join();
}

try {
  // ── A. 생성 파일이 최신인가 ─────────────────────────────────────────
  const generated = buildGenerated();
  const stale = Object.entries(generated)
    .filter(([file, text]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text)
    .map(([file]) => rel(file));
  check('A', `src/content 생성 파일 ${Object.keys(generated).length}개가 법무 문서(동의문구 · 약관 · 처리방침)와 같다`, stale.length === 0,
    stale.length ? `낡은 파일: ${stale.join(', ')} → npm run gen:legal 을 하세요` : '');

  // 판 13개: src/config/consent.ts 의 versions 블록이 법무/판_관리.md 2장과 같은가(손으로 고치면 여기서 막힌다)
  const consentTsText = fs.readFileSync(path.join(APP_DIR, 'src', 'config', 'consent.ts'), 'utf8').replace(/\r\n/g, '\n');
  const editions = readAllEditions();
  const vFrom = consentTsText.indexOf(VERSIONS_BEGIN);
  const vTo = consentTsText.indexOf(VERSIONS_END);
  const versionsSame = vFrom >= 0 && vTo > vFrom && consentTsText.slice(vFrom, vTo + VERSIONS_END.length) === versionsBlock(editions);
  check('A', '판 13개(약관 · 처리방침 판 · 시행일 + 동의 문구 CK1~CK9)가 법무/판_관리.md 2장과 같다(판 한 곳 관리)', versionsSame,
    versionsSame ? '' : 'src/config/consent.ts 의 판이 판_관리.md 와 다름 → 판은 판_관리.md 에서만 고치고 npm run gen:legal 을 하세요');

  const contentDir = path.join(APP_DIR, 'src', 'content');
  const consent = await load(path.join(contentDir, 'consentContent.ts'));
  const copy = await load(path.join(contentDir, 'copy.ts'));

  const doc = parseConsentDoc(readDoc(SOURCES.consent));
  const mk = parseCopyConsent(readCopyDoc());
  const items = consent.CONSENT_ITEMS;

  // ── B. 03 체크 칸 10줄 ──────────────────────────────────────────────
  const stripKind = (label) => label.replace(/^\[(필수|선택)\] /, '');
  const rowsOk = mk.checkRows.length === 10 && mk.checkRows[0].order === '맨 위' && mk.checkRows.slice(1).map((r) => r.code).join() === items.map((i) => i.code).join();
  check('B', '카피.md 03-1 표가 10줄(맨 위 1 + CK1~CK9)이고 앱 칸 순서와 같다', rowsOk, rowsOk ? '' : `카피 ${mk.checkRows.map((r) => r.code).join(' ')}`);

  const topCopy = mk.checkRows[0];
  const topApp = consent.CONSENT_TOP;
  check('B', '맨 위 칸 "필수 항목 모두 동의"의 글 · 왜 필요한지 · 덧붙이는 안내가 카피 · 동의문구 · 앱에서 같다',
    topCopy.label === topApp.label && topCopy.why === topApp.why && topCopy.note === topApp.note &&
      doc.top.label === topApp.label && doc.top.why === topApp.why && doc.top.note === topApp.note,
    `카피 "${topCopy.label}" / 동의문구 "${doc.top.label}" / 앱 "${topApp.label}"`);

  const lineDiffs = [];
  items.forEach((item, i) => {
    const c = mk.checkRows[i + 1];
    const t = doc.tableRows[i];
    if (c.label !== item.label) lineDiffs.push(`${item.code} 체크 문구: 카피 "${c.label}" ≠ 앱 "${item.label}"`);
    if (c.why !== item.why) lineDiffs.push(`${item.code} 왜 필요한지: 카피 ≠ 앱`);
    if (c.note !== item.note) lineDiffs.push(`${item.code} 덧붙이는 안내: 카피 "${c.note}" ≠ 앱 "${item.note}"`);
    if (t.code !== item.code || stripKind(item.label) !== t.label) lineDiffs.push(`${item.code} 동의문구 1장 표의 글(${t.label})이 4장 체크 문구와 다름`);
    if (t.why !== item.why || t.note !== item.note) lineDiffs.push(`${item.code} 동의문구 1장 표의 왜 필요한지 · 덧붙이는 안내가 4장과 다름`);
    if (t.required !== item.required) lineDiffs.push(`${item.code} 필수 · 선택 구분이 1장 표와 다름`);
  });
  check('B', '체크 칸 9개의 체크 문구 · 왜 필요한지 · 덧붙이는 안내가 카피.md 03-1 · 동의문구.md 1장 · 4장 · 앱에서 모두 같다(글자 그대로)', lineDiffs.length === 0, lineDiffs.join('\n'));

  // ── C. 필수 7 · 선택 2 ──────────────────────────────────────────────
  const required = items.filter((i) => i.required).map((i) => i.code);
  const optional = items.filter((i) => !i.required).map((i) => i.code);
  check('C', '필수 7개(CK1 CK2 CK3 CK5 CK6 CK7 CK8) · 선택 2개(CK4 CK9)', same(required, ['CK1', 'CK2', 'CK3', 'CK5', 'CK6', 'CK7', 'CK8']) && same(optional, ['CK4', 'CK9']), `필수 ${required.join(' ')} · 선택 ${optional.join(' ')}`);
  const prefixBad = items.filter((i) => !i.label.startsWith(i.required ? '[필수] ' : '[선택] ')).map((i) => i.code);
  check('C', '[필수] · [선택]이 체크 문구 앞에 글자로 붙어 있다(색만으로 구분하지 않는다)', prefixBad.length === 0, prefixBad.join(' '));
  check('C', '선택 칸 CK4 · CK9 와 확인 칸 CK5 에는 덧붙이는 안내가 있고, 나머지 칸에는 없다(동의문구 3-2 규칙 2)',
    items.every((i) => (['CK4', 'CK5', 'CK9'].includes(i.code) ? typeof i.note === 'string' && i.note.length > 0 : i.note === null)), '');

  // ── D. 요약 줄 · 동의하지 않으면 ────────────────────────────────────
  const summaryDiffs = [];
  for (const item of items) {
    const fromCopy = mk.summaries[item.code] ?? [];
    const wantDeclined = `${item.declinedLabel}: ${item.declined}`;
    const copyLines = [...item.summary, wantDeclined];
    if (!same(fromCopy, copyLines)) {
      const at = copyLines.findIndex((line, i) => line !== fromCopy[i]);
      summaryDiffs.push(`${item.code}: 카피.md 03-2 와 다름(${at + 1}번째 줄) 카피 "${fromCopy[at] ?? '(없음)'}" / 동의문구 "${copyLines[at] ?? '(없음)'}"`);
    }
    if (item.summary.length === 0) summaryDiffs.push(`${item.code}: 요약이 비어 있음`);
  }
  const summaryCount = items.reduce((n, i) => n + i.summary.length + 1, 0);
  check('D', `칸마다 요약 줄과 "동의하지 않으면 · 확인하지 않으면" 줄(모두 ${summaryCount}줄)이 카피.md 03-2 · 동의문구.md 4장 · 앱에서 같다`, summaryDiffs.length === 0, summaryDiffs.join('\n'));
  const fullBad = items.filter((i) => (i.fullText === 'terms' ? i.code !== 'CK1' : i.fullText.length === 0)).map((i) => i.code);
  check('D', '전문이 칸마다 있다(CK1 은 이용약관 전체, 나머지 8개는 동의문구 4장의 전문)', fullBad.length === 0, fullBad.join(' '));

  // ── E. 안내 상자 · 부제 · 링크 줄 · 오류 문구 · 버튼 ─────────────────
  check('E', '안내 상자 제목 · 본문이 카피.md 03 · 동의문구.md 5-1 · 앱에서 같다',
    mk.noticeTitle === consent.CONSENT_NOTICE.title && mk.noticeBody === consent.CONSENT_NOTICE.body && doc.notice.title === consent.CONSENT_NOTICE.title && doc.notice.body === consent.CONSENT_NOTICE.body,
    `제목 "${consent.CONSENT_NOTICE.title}"`);
  check('E', '부제가 카피.md 03 · 동의문구.md 1장 · 앱에서 같다', mk.subtitle === consent.CONSENT_SUBTITLE && doc.subtitle === consent.CONSENT_SUBTITLE, consent.CONSENT_SUBTITLE);
  check('E', '링크 줄 · 작은 글씨가 카피.md 03 · 동의문구.md 3-1 · 앱에서 같다',
    mk.linkLine === consent.CONSENT_LINKS.line && mk.small === consent.CONSENT_LINKS.small && doc.links.line === consent.CONSENT_LINKS.line && doc.links.small === consent.CONSENT_LINKS.small,
    `"${consent.CONSENT_LINKS.line}" / "${consent.CONSENT_LINKS.small}"`);
  check('E', '필수 미체크 오류 문구가 카피.md 03 · 동의문구.md 3-3 · 앱에서 같다', mk.error === consent.CONSENT_ERROR && doc.error === consent.CONSENT_ERROR, consent.CONSENT_ERROR);
  check('E', '제목 · 버튼 · "보기 ›" · "전문 보기" 글이 카피.md 03 과 같다',
    mk.title === copy.CONSENT.title && mk.submit === copy.CONSENT.submit && mk.more === copy.CONSENT.more && mk.fullText === copy.CONSENT.fullText,
    `제목 "${copy.CONSENT.title}" · 버튼 "${copy.CONSENT.submit}" · "${copy.CONSENT.more}" · "${copy.CONSENT.fullText}"`);
  check('E', '읽기 화면의 두 문서 이름(이용약관 · 개인정보 처리방침)이 링크 줄 글 안에 있다',
    consent.CONSENT_LINKS.line.includes(copy.CONSENT.documents.terms) && consent.CONSENT_LINKS.line.includes(copy.CONSENT.documents.privacy), '');

  // ── F. 02 가입 안내 ─────────────────────────────────────────────────
  const copyText = readCopyDoc();
  // QP-A: 카피.md 14장(v5 문구 바꿈) 표의 첫 칸 키(맨 앞 `…`) → v5 글. '(줄 없음)'은 화면에 그 줄이 없다는 뜻이라 대조 값으로 쓰지 않는다
  const sec14 = copyText.slice(copyText.search(/^## 14\. /m));
  const V5_COPY = new Map(
    sec14
      .split(/\r?\n/)
      .filter((l) => /^\| (13장 )?`[A-Za-z]/.test(l))
      .map(cells)
      .map((r) => [(/`([^`]+)`/.exec(r[0]) ?? [])[1], r[1]])
      .filter(([k, v]) => k && v && v !== '(줄 없음)'),
  );
  const sec12Q = copyText.slice(copyText.search(/^#### 12-Q /m), copyText.search(/^### 16 /m));
  const copy02 = copyText.slice(copyText.search(/^### 02 /m), copyText.search(/^### 03 /m));
  const copy02Rows = copy02.split('\n').filter((l) => l.startsWith('|')).map(cells);
  const copy02Cell = (kind, startsWith) => {
    const row = copy02Rows.find((r) => r[0] === kind && (r[1] ?? '').startsWith(startsWith));
    return row ? inline(row[2]) : null;
  };
  check('F', '02 가입 안내 글과 링크("개인정보 처리방침")가 카피.md 02 · 동의문구.md 5-2 · 앱에서 같다',
    copy02Cell('안내', '[화면 아래') === consent.SIGNUP_NOTICE.text && copy02Cell('안내', '[위 안내 속 링크]') === consent.SIGNUP_NOTICE.link &&
      doc.signup.text === consent.SIGNUP_NOTICE.text && doc.signup.link === consent.SIGNUP_NOTICE.link,
    consent.SIGNUP_NOTICE.text);
  check('F', '만 19세 안내 글이 카피.md 02 · 동의문구.md 5-2 · 앱(SIGN_IN.ageNotice · errors.underage)에서 같다',
    copy02Cell('안내', '[하단]') === copy.SIGN_IN.ageNotice && copy.SIGN_IN.ageNotice === consent.SIGNUP_NOTICE.under19 && copy.SIGN_IN.errors.underage === consent.SIGNUP_NOTICE.under19,
    copy.SIGN_IN.ageNotice);
  const errPairs = [
    ['오류', '[인증 실패]', copy.SIGN_IN.errors.codeWrong],
    ['오류', '[시간 지남]', copy.SIGN_IN.errors.codeExpired],
    ['오류', '[발송 실패]', copy.SIGN_IN.errors.sendFailed],
    ['오류', '[횟수 초과]', copy.SIGN_IN.errors.tooMany],
  ];
  const errBad = errPairs.filter(([kind, label, app]) => copy02Cell(kind, label) !== app).map(([, label]) => label);
  check('F', '02 오류 4종(틀림 · 시간 지남 · 발송 실패 · 횟수 초과)이 카피.md 02 와 같다', errBad.length === 0, errBad.length ? `다름: ${errBad.join(', ')}` : '');
  const retry = copy02Cell('안내', '02:59');
  check('F', '재전송 안내 글꼴("02:59 뒤에 다시 받을 수 있어요")이 카피.md 02 개선안과 같다', retry === copy.SIGN_IN.retryAfter('02:59'), `${retry} ↔ ${copy.SIGN_IN.retryAfter('02:59')}`);

  // ── G. 01 소개 3장 ──────────────────────────────────────────────────
  const copy01 = copyText.slice(copyText.search(/^### 01 /m), copyText.search(/^### 02 /m));
  const copy01Rows = copy01.split('\n').filter((l) => l.startsWith('|')).map(cells);
  const slideDiffs = [];
  copy.ONBOARDING.slides.forEach((slide, i) => {
    for (const [kind, key] of [['제목', 'title'], ['부제', 'body']]) {
      const row = copy01Rows.find((r) => r[0] === kind && (r[1] ?? '').startsWith(`[${i + 1}장]`));
      if (!row || inline(row[2]) !== slide[key]) slideDiffs.push(`${i + 1}장 ${kind}: 카피 "${row ? inline(row[2]) : '(없음)'}" ≠ 앱 "${slide[key]}"`);
    }
  });
  check('G', '01 소개 3장의 제목 · 부제가 카피.md 01 개선안과 같다', slideDiffs.length === 0, slideDiffs.join('\n') || copy.ONBOARDING.slides.map((s) => s.title).join(' / '));
  check('G', '01 버튼(시작하기 · 이미 계정이 있어요)이 카피.md 01 과 같다',
    copy01Rows.some((r) => r[0] === '버튼' && r[1] === copy.ONBOARDING.start) && copy01Rows.some((r) => r[0] === '버튼' && r[1] === copy.ONBOARDING.haveAccount), '');

  // ── H. 앱 글이 모두 원본 문서 어딘가에 있는가 ───────────────────────
  const corpus = [readCopyDoc(), readDoc(SOURCES.consent), readPlanDoc('screens'), readPlanDoc('policy')].map((t) => t.replace(/`/g, '')).join('\n');
  const strings = [];
  (function collect(node, where) {
    if (typeof node === 'string') strings.push([where, node]);
    else if (Array.isArray(node)) node.forEach((v, i) => collect(v, `${where}[${i}]`));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collect(v, `${where}.${k}`));
  })({ COMMON: copy.COMMON, ONBOARDING: copy.ONBOARDING, SIGN_IN: { ...copy.SIGN_IN, retryAfter: copy.SIGN_IN.retryAfter('02:59') }, CONSENT: { ...copy.CONSENT, documents: undefined } }, 'copy');
  const lost = strings.filter(([, s]) => !corpus.includes(s)).map(([where, s]) => `${where}: "${s}"`);
  check('H', `앱 글 ${strings.length}개(01 · 02 · 03 · 공통)가 카피.md · 동의문구.md · 화면_요구사항.md(N문구) · 정책.md(NK문구)에 그대로 있다`, lost.length === 0, lost.join('\n'));

  // ── I. 글 지문: 법무가 칸의 글을 고쳤는데 문구 판을 그대로 두면 안 된다 ───
  const versionModule = await load(path.join(APP_DIR, 'src', 'config', 'consent.ts'));
  const now = consentFingerprints();
  const recorded = versionModule.CONSENT_TEXT_FINGERPRINTS;
  const moved = Object.keys(now).filter((code) => now[code] !== recorded[code]);
  const versionBad = Object.entries(versionModule.CONSENT_TEXT_VERSIONS).filter(([, v]) => !/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/.test(String(v))).map(([code]) => code);
  check('I', '동의 칸 9개의 글이 기록해 둔 지문과 같다(글이 바뀌었으면 문구 판을 먼저 올렸는지 확인한다)', moved.length === 0,
    moved.length ? `글이 바뀐 칸: ${moved.join(' ')}
뜻이 바뀌었으면 CONSENT_TEXT_VERSIONS 의 날짜를, 오타 고침이면 뒷자리(-vN)를 올린 뒤 npm run gen:legal -- --fingerprints (동의문구 3-5 · 6장 3번)` : '');
  check('I', '문구 판 9개가 DB 검사식(consent-YYYY.MM.DD-vN)에 맞는다', versionBad.length === 0, versionBad.join(' '));

  const docNow = legalDocFingerprints();
  const docRecorded = versionModule.LEGAL_DOC_FINGERPRINTS;
  const docMoved = Object.keys(docNow).filter((key) => docNow[key] !== docRecorded[key]);
  check('I', '약관 · 처리방침의 글(표식 구간 · 작업 표시를 걸러낸 글)이 기록해 둔 지문과 같다(글이 바뀌었으면 판을 올렸는지 확인한다)', docMoved.length === 0,
    docMoved.length ? `글이 바뀐 문서: ${docMoved.join(' ')}
뜻이 바뀌었으면 법무/판_관리.md 의 시행일 · 판을, 정정이면 뒷자리(-vN)를 올린 뒤 npm run gen:legal -- --fingerprints (판_관리 4장 · 5장)` : '');

  // ── K. 게시되는 글에 작업 표시가 없는가 ─────────────────────────────
  const published = [];
  for (const file of ['consentContent.ts', 'legalTerms.ts', 'legalPrivacy.ts']) {
    const body = fs.readFileSync(path.join(contentDir, file), 'utf8').split('\n').filter((l) => !l.startsWith('//')).join('\n');
    published.push([file, body]);
  }
  const banned = ['[변호사 확인]', '변호사 확인', '[법무 제안]', '법무 제안', '가정 D-', '결정 대기', 'app:', '상태: 초안', '목차', '숫자 출처', '부록 A', '부록 B', '부록 C', '부록 D', '부록 E'];
  const leaked = published.flatMap(([file, body]) => banned.filter((w) => body.includes(w)).map((w) => `${file}: "${w}"`));
  check('K', '게시 글(동의문구 · 약관 · 처리방침)에 작업 표시와 머리말 · 부록이 하나도 없다', leaked.length === 0, leaked.join('\n'));

  // ── J. 06 AI 정리 중 · 07 내 성향 (F3) ─────────────────────────────
  const traitsContent = await load(path.join(contentDir, 'traitsContent.ts'));
  const corpusJ = [readCopyDoc(), readPlanDoc('screens')].map((t) => t.replace(/`/g, '')).join('\n');
  const flatStrings = [];
  (function collectJ(node, where) {
    if (typeof node === 'string') flatStrings.push([where, node]);
    else if (Array.isArray(node)) node.forEach((v, i) => collectJ(v, `${where}[${i}]`));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collectJ(v, `${where}.${k}`));
  })({
    ANALYSIS: { ...copy.ANALYSIS, steps: undefined, stepsLine: copy.ANALYSIS.steps.join(' → ') },
    TRAITS: { ...copy.TRAITS, errors: { tagDuplicate: copy.TRAITS.errors.tagDuplicate, contact: copy.TRAITS.errors.contact, summaryShort: copy.TRAITS.errors.summaryShort(20).replace('20', '{n}') } },
  }, 'copy');
  const lostJ = flatStrings.filter(([, text]) => !corpusJ.includes(text)).map(([where, text]) => `${where}: "${text}"`);
  check('J', `06 · 07 앱 글 ${flatStrings.length}개가 카피.md 06 · 07 · 화면_요구사항.md(06 · 07 · N13 · N14)에 그대로 있다`, lostJ.length === 0, lostJ.join('\n'));

  const screensText = readPlanDoc('screens');
  const copySection = (from, to) => copyText.slice(copyText.search(from), copyText.search(to));
  const copy06 = copySection(/^### 06 /m, /^### 07 /m);
  const copy07 = copySection(/^### 07 /m, /^### 08 /m);
  const cell = (section, kind, startsWith, col = 2) => {
    const row = section.split('\n').filter((l) => l.startsWith('|')).map(cells).find((r) => r[0] === kind && (r[1] ?? '').startsWith(startsWith));
    return row ? inline(row[col]) : null;
  };
  const pairs = [
    ['06 부제', cell(copy06, '부제', '설문 내용을'), copy.ANALYSIS.subtitle],
    ['06 AI 이용 고지', cell(copy06, '안내', '[부제 아래'), copy.ANALYSIS.aiNotice],
    ['06 단계 글', cell(copy06, '안내', '정리 → 성향'), copy.ANALYSIS.steps.join(' → ')],
    ['06 1분이 넘을 때', cell(copy06, '안내', '[1분이 넘을 때]'), copy.ANALYSIS.slow],
    ['06 실패 제목', cell(copy06, '오류', '[AI 정리 실패] 제목'), copy.ANALYSIS.failTitle],
    ['06 실패 본문', cell(copy06, '오류', '[AI 정리 실패] 본문'), copy.ANALYSIS.failBody],
    ['06 버튼', cell(copy06, '버튼', '[AI 정리 실패'), copy.ANALYSIS.retry],
    ['07 부제', cell(copy07, '부제', '맞지 않는'), copy.TRAITS.subtitle],
    ['07 막대 아래 안내', cell(copy07, '안내', '[막대 아래]'), copy.TRAITS.axisNote],
    ['07 칩 소제목', cell(copy07, '안내', '[소제목]'), copy.TRAITS.tagsTitle],
    ['07 수정 저장 실패', cell(copy07, '오류', '[수정 저장 실패]'), copy.TRAITS.saveFailed],
  ];
  const pairBad = pairs.filter(([, want, app]) => want !== app).map(([name, want, app]) => `${name}: 카피 "${want}" ≠ 앱 "${app}"`);
  check('J', '06 · 07 의 부제 · 안내 · 오류 · 버튼이 카피.md 개선안 칸과 같다(11곳)', pairBad.length === 0, pairBad.join('\n'));
  check('J', '직접 입력 안내(N13)와 버튼 "직접 입력하기"가 화면_요구사항.md 와 같다',
    screensText.includes(`버튼 "${copy.ANALYSIS.manual}", 안내 "${copy.ANALYSIS.manualNote}"`), `"${copy.ANALYSIS.manual}" / "${copy.ANALYSIS.manualNote}"`);
  const buttons07 = ['수정하기', '이대로 확정'].every((b) => copy07.includes(b)) && copy.TRAITS.edit === '수정하기' && copy.TRAITS.confirm === '이대로 확정';
  check('J', '07 버튼 "수정하기" · "이대로 확정"이 카피.md 07 과 같다', buttons07, '');

  // 근거 문항 이름: 설문 문항표의 질문 글과 같은가
  const survey = readDoc(path.join(SOURCES.screens, '..', '설문_문항표.md'));
  const questionOf = new Map(survey.split('\n').filter((l) => /^\| (E\d\d|T0\d) \|/.test(l)).map(cells).map((r) => [r[0], r[2]]));
  const labelBad = Object.entries(traitsContent.EVIDENCE_LABELS).filter(([id, label]) => questionOf.get(id) !== label).map(([id, label]) => `${id}: 문항표 "${questionOf.get(id)}" ≠ 앱 "${label}"`);
  check('J', `근거 문항 이름 ${Object.keys(traitsContent.EVIDENCE_LABELS).length}개(E01~E13 · T01~T03)가 설문_문항표.md 의 질문 글과 같다`, labelBad.length === 0 && Object.keys(traitsContent.EVIDENCE_LABELS).length === 16, labelBad.join('\n'));
  const axisNames = Object.values(traitsContent.AXIS_NAMES);
  check('J', '5축 이름이 카피.md 07 의 막대 이름과 같다(외향성 / 계획성 / 가족 중심 / 경제관·저축 / 갈등 대처·대화)', copy07.includes(axisNames.join(' / ')), axisNames.join(' / '));

  // 직접 입력 태그 후보: 서버(rules.ts)의 MANUAL_TAG_CANDIDATES 와 같은가
  const rulesFile = path.join(APP_DIR, '..', 'backend', 'functions', 'ai-profile', 'rules.ts');
  let serverTags = null;
  try {
    serverTags = (await load(rulesFile)).MANUAL_TAG_CANDIDATES;
  } catch (error) {
    note(`서버 태그 후보(rules.ts)를 불러오지 못했어요: ${String(error).split('\n')[0]}`);
  }
  if (serverTags) {
    check('J', `직접 입력 태그 후보 ${traitsContent.MANUAL_TAG_FALLBACK.length}개가 서버 rules.ts MANUAL_TAG_CANDIDATES 와 같다`, same(serverTags, traitsContent.MANUAL_TAG_FALLBACK),
      same(serverTags, traitsContent.MANUAL_TAG_FALLBACK) ? '' : `서버 ${serverTags.length}개 / 앱 ${traitsContent.MANUAL_TAG_FALLBACK.length}개`);
  }
  // ── L. 08 내 프로필 (F4) ────────────────────────────────────────────
  const copy08 = copySection(/^### 08 /m, /^### 09 /m);
  const toggleNames = Object.values(copy.PROFILE.toggles);
  const toggleRow = copy08.split('\n').find((l) => l.startsWith('| 안내 | [토글 이름]')) ?? '';
  const nameBad = toggleNames.filter((n) => !inline(toggleRow).includes(n)).map((n) => `"${n}"`);
  const pairs08 = [
    ['인증 대기 설명', cell(copy08, '안내', '[인증 대기 배지를 눌렀을 때]'), copy.PROFILE.badgeVerifyPendingNote],
    ['사진 확인 중 배지', cell(copy08, '안내', '[배지] 사진 검수 중'), copy.PROFILE.badgePhotoChecking],
    ['사진 확인 중 설명', cell(copy08, '안내', '[사진 확인 중 배지를 눌렀을 때]'), copy.PROFILE.badgePhotoCheckingNote],
    ['공개 범위 부제', V5_COPY.get('PROFILE.visibilitySubtitle') ?? cell(copy08, '부제', '매칭 계산에는'), copy.PROFILE.visibilitySubtitle], // 14-2 가 앞선다(QP-A)
    ['처음 한 번 제목', cell(copy08, '제목', '[처음 한 번 확인] 제목'), copy.PROFILE.firstTitle],
    ['처음 한 번 본문', V5_COPY.get('PROFILE.firstBody') ?? cell(copy08, '안내', '[처음 한 번 확인] 본문'), copy.PROFILE.firstBody], // 14-2 가 앞선다(QP-A)
    ['처음 한 번 버튼', cell(copy08, '버튼', '[처음 한 번 확인]'), copy.PROFILE.firstConfirm],
    ['저장 실패', cell(copy08, '오류', '[저장 실패]'), copy.PROFILE.saveFailed],
  ];
  const pairs08Bad = pairs08.filter(([, want, app]) => want !== app).map(([name, want, app]) => `${name}: 카피 "${want}" ≠ 앱 "${app}"`);
  check('L', '08 배지 · 설명 · 공개 범위 부제 · 처음 한 번 확인(제목 · 본문 · 버튼) · 저장 실패가 카피.md 08 개선안 칸과 같다(8곳)', pairs08Bad.length === 0, pairs08Bad.join('\n'));
  check('L', '08 토글 이름 9개(종교 · 혼인 이력 · 자녀 유무 · 연봉 구간 · 본인 자산 구간 · 부모님 학력/자산 (구간) · 출신 학교 · 직장명)가 카피.md 08 토글 줄에 그대로 있다', toggleNames.length === 9 && nameBad.length === 0, nameBad.join(' ') || toggleNames.join(' / '));
  check('L', 'N15 비활성 토글 · 사진 다시 올리기 배지 · 설명, N10 "저장했어요."가 화면_요구사항.md 와 같다',
    screensText.includes(`비활성 토글 "${copy.PROFILE.toggleLocked}"`) && screensText.includes(`사진 반려 배지 "${copy.PROFILE.badgePhotoRetry}"`) && screensText.includes(`설명 "${copy.PROFILE.badgePhotoRetryNote}"`) && screensText.includes(`토스트 "${copy.PROFILE.saved}"`),
    `"${copy.PROFILE.toggleLocked}" / "${copy.PROFILE.badgePhotoRetry}" / "${copy.PROFILE.saved}"`);
  check('L', '08 토글 목록(열 · 문항 · 처음값)이 정책 2-3 표 9줄과 같다', await toggleTableMatches(), '');

  // ── M. 07 확정 실패 4종 · 10 · 11 신고 · 차단 시트(N33) · 안전 안내(N34) · 12 안전 안내 · 고객센터 · 아동 안전 문의 (B4) ───────────
  const copy10 = copySection(/^### 10 /m, /^### 11 /m);
  const copy11 = copySection(/^### 11 /m, /^### 12 /m);
  const copy12 = copySection(/^### 12 /m, /^## 4\. /m);
  const copy01b = copySection(/^### 01 /m, /^### 02 /m);
  const collectStrings = (node, where, out = []) => {
    if (typeof node === 'string') out.push([where, node]);
    else if (Array.isArray(node)) node.forEach((v, i) => collectStrings(v, `${where}[${i}]`, out));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => collectStrings(v, `${where}.${k}`, out));
    return out;
  };
  const stripCode = (text) => text.replace(/`/g, '');
  const missing = (section, name, node) => collectStrings(node, name).filter(([, text]) => !stripCode(section).includes(text)).map(([where, text]) => `${where}: "${text}"`);
  const lostM = [
    ...missing(copy07, 'TRAITS.confirmErrors', copy.TRAITS.confirmErrors),
    ...missing(copy11, 'REPORT_SHEET', { ...copy.REPORT_SHEET, reasons: undefined, reasonRP6Note: undefined }),
    ...missing(copy12, 'SAFETY_GUIDE', copy.SAFETY_GUIDE),
    ...missing(copy12, 'SUPPORT', copy.SUPPORT),
    ...missing(copy12, 'CHILD_SAFETY', copy.CHILD_SAFETY),
  ];
  const reasonsLine = copy.REPORT_SHEET.reasons.join(' / ');
  if (!stripCode(copy11).includes(reasonsLine)) lostM.push(`REPORT_SHEET.reasons: "${reasonsLine}"`);
  for (const [name, section] of [['01', copy01b], ['10', copy10], ['11', copy11]]) if (!section.includes(copy.SAFETY.line)) lostM.push(`SAFETY.line: ${name}절에 없음`);
  for (const [name, section] of [['10', copy10], ['11', copy11], ['12', copy12]]) if (!section.includes(copy.SAFETY.minorNote)) lostM.push(`SAFETY.minorNote: ${name}절에 없음`);
  check('M', `07 확정 실패 4종 · 11 신고 · 차단 시트 · 01/10/11 안전 한 줄 · 12 안전 안내 · 고객센터 · 아동 안전 문의의 앱 글이 카피.md 07 · 10 · 11 · 12 에 글자 그대로 있다`, lostM.length === 0, lostM.join('\n'));
  check('M', '확정 실패 4종은 제목 · 본문 · 이동 버튼 · 취소가 모두 있고, 이동은 03 · 04 · 05 · 다시 시도 순이다',
    same(Object.keys(copy.TRAITS.confirmErrors), ['consent_missing', 'survey_incomplete', 'photos_incomplete', 'other']) &&
      Object.values(copy.TRAITS.confirmErrors).every((e) => e.title && e.body && e.go && e.cancel === '취소') &&
      same(Object.values(copy.TRAITS.confirmErrors).map((e) => e.go), ['동의 화면으로 가기', '설문으로 가기', '사진 올리러 가기', '다시 시도']), '');
  check('M', '신고 사유 8개가 정책 5-2 표의 사유 이름과 같다', same(copy.REPORT_SHEET.reasons, policyReportReasons()), copy.REPORT_SHEET.reasons.join(' / '));

  // ── N. 09 오늘의 추천 · 10 상대 프로필 (F5) ─────────────────────────
  const copy09 = copySection(/^### 09 /m, /^### 10 /m);
  const policyText = readPlanDoc('policy');
  const lostN = [];
  const need = (section, name, texts) => {
    for (const [key, value] of texts) if (!stripCode(section).includes(value)) lostN.push(`${name}.${key}: "${value}"`);
  };
  need(copy09, '카피 09', [
    ['headerTitle', copy.RECS.headerTitle],
    ['remaining', copy.RECS.remaining('14시간 32분')],
    ['subtitle', copy.RECS.subtitle],
    ['matchLabel', copy.RECS.matchLabel],
    ['emptyTitle', copy.RECS.emptyTitle],
    ['emptyBody', copy.RECS.emptyBody],
    ['emptyHint', copy.RECS.emptyHint],
    ['emptyButton', copy.RECS.emptyButton],
    ['allDone', copy.RECS.allDone('{시간}')],
    ['loadFailed', copy.RECS.loadFailed],
    ['preparing(NK02)', copy.RECS.preparing],
    ['preparingNote(NK02)', copy.RECS.preparingNote],
    ['firstWait(NK01)', copy.RECS.firstWait('{n}')],
    ['firstWaitMinutes(NK01)', copy.RECS.firstWaitMinutes('{m}')],
    ['firstWaitToday(NK01)', copy.RECS.firstWaitToday],
    ['firstWaitNote(NK01)', copy.RECS.firstWaitNote],
    ['widenNote(B15)', copy.RECS.widenNote('{n}')],
    ['widenOwnNote(B15)', copy.RECS.widenOwnNote],
    ['widenButton(B15)', copy.RECS.widenButton],
    ['subtitleFew 한 분(B16)', copy.RECS.subtitleFew(copy.RECS.who.one)],
    ['subtitleFew 두 분(B16)', copy.RECS.subtitleFew(copy.RECS.who.two)],
  ]);
  need(copy10, '카피 10', [
    ['headerTitle', copy.CANDIDATE.headerTitle],
    ['photoIndex', copy.CANDIDATE.photoIndex(1, 3)],
    ['tableLabels', Object.values(copy.CANDIDATE.tableLabels).join(' / ')],
    ['hidden', copy.CANDIDATE.hidden],
    ['openTitle(16-N)', copy.CANDIDATE.openTitle],
    ['openLabels(16-N)', Object.values(copy.CANDIDATE.openLabels).join(' / ')],
    ['whyTitle', copy.CANDIDATE.whyTitle],
    ['whyNote', copy.CANDIDATE.whyNote],
    ['disclaimer', copy.CANDIDATE.disclaimer],
    ['pass/like', `${copy.CANDIDATE.pass} / ${copy.CANDIDATE.like}`],
    ['likeDone', copy.CANDIDATE.likeDone],
    ['likeFailed', copy.CANDIDATE.likeFailed],
    ['unavailable', copy.CANDIDATE.unavailable],
  ]);
  need(copy11, '카피 11', [['likeConnected', copy.CANDIDATE.likeConnected]]);
  need(screensText, '화면_요구사항 N16', [
    ['sent/passed', `"${copy.RECS.sentLabel}" · "${copy.RECS.passedLabel}"`],
    ['few', copy.RECS.subtitleFew(`{${copy.RECS.who.one}/${copy.RECS.who.two}}`)],
  ]);
  need(policyText, '정책 NK03 · NK04', [
    ['photoChecking', `"${copy.RECS.photoChecking}"`],
    ['likeLimit', `"${copy.CANDIDATE.likeLimit}"`],
  ]);
  check('N', '09 · 10 앱 글(제목 · 남은 시간 · 부제 · 맞는 점 · 빈 상태 4개 · NK01 · NK02 제목 · 보조 · 모두 본 뒤 · 불러오기 실패 · 사진 1 / 3 · 표 3줄 · 비공개 · 왜 추천했나요 · 서류 확인 안내 · 호감 토스트 · 오류) + N16 라벨 + NK03 · NK04 가 카피.md · 화면_요구사항 · 정책에 글자 그대로 있다', lostN.length === 0, lostN.join(String.fromCharCode(10)));
  check('N', '10 신고 사유 아래 24시간 안내와 안전 한 줄이 10 절에 있고 맞는 점 이름 19개가 정책 2-4 표와 같다', copy10.includes(copy.SAFETY.line) && copy10.includes(copy.REPORT_SHEET.reasonRP6Note) && (await reasonNamesMatchPolicy()), '');

  // ── O. 12 설정 · 하위 화면 · 탈퇴 (F7, src/content/settingsCopy.ts) ─────────────────
  //  원본: 카피.md 12(B4 · B5 확정: R-D18-1~3 · R-F7-1~10) · 동의문구.md 4-9 · 5-5 · 5-6 · 정책 P5-11. 함수 글은 예시 값으로 만들어 대조한다
  const st = await load(path.join(contentDir, 'settingsCopy.ts'));
  const consentDocText = stripCode(readDoc(SOURCES.consent));
  const copy12s = stripCode(copy12);
  const copyCommon = stripCode(copySection(/^## 4\. /m, /^## 5\. /m));
  const lacks = (where, text, list) => list.filter(([, v]) => !text.includes(v)).map(([k, v]) => `${where} ${k}: "${v}"`);
  const o1 = lacks('카피 12', copy12s, Object.entries(st.SETTINGS.rows));
  check('O', `12 줄 이름 ${Object.keys(st.SETTINGS.rows).length}개(정보 묶음 포함)가 카피.md 12 에 그대로 있다`, o1.length === 0, o1.join('\n'));
  const o2 = [
    ...lacks('카피 12', copy12s, [['title', st.WITHDRAW.title], ['body', st.WITHDRAW.body], ['sub', st.WITHDRAW.sub], ['buttons', `${st.WITHDRAW.confirm} / ${st.WITHDRAW.cancel}`]]),
    ...lacks('동의문구 5-6', consentDocText, [['title', st.WITHDRAW.title], ['body', st.WITHDRAW.body], ['sub', st.WITHDRAW.sub]]),
  ];
  check('O', '탈퇴 확인창(제목 · 본문 · 보조 · 버튼)이 카피.md 12 · 동의문구 5-6 과 글자까지 같다', o2.length === 0, o2.join('\n'));
  const o3 = lacks('카피 12', copy12s, [['otpHeader', st.WITHDRAW.otpHeader], ['otpTitle', st.WITHDRAW.otpTitle], ['otpBody', st.WITHDRAW.otpBody], ['codeLabel', st.WITHDRAW.codeLabel], ['retryAfter', st.WITHDRAW.retryAfter('02:59')], ['resend', st.WITHDRAW.resend], ['submit', st.WITHDRAW.submit], ['sendFailed', st.WITHDRAW.sendFailed]]);
  check('O', '탈퇴 인증번호 재확인 단계(N31 · 상단바 · 다시 받기 · 발송 실패)가 카피.md 12 와 같다', o3.length === 0, o3.join('\n'));
  const o4 = lacks('카피 12', copy12s, Object.entries(st.SECURITY));
  check('O', '보안 화면(상단바 · 스위치 이름 · 아래 글, N32)이 카피.md 12 와 같다', o4.length === 0, o4.join('\n'));
  const o5 = [
    ...lacks('카피 12', copy12s, [['recommendation', st.NOTIFY.recommendation], ['like', st.NOTIFY.like], ['match', st.NOTIFY.match], ['marketing', st.NOTIFY.marketing], ['pushDenied(R-D18-3)', st.NOTIFY.pushDenied]]),
    ...lacks('동의문구 4-9', consentDocText, st.NOTIFY.marketingNotes.map((v, i) => [`marketingNotes[${i}]`, v])),
    ...lacks('동의문구 5-5', consentDocText, [['pushPrime', st.NOTIFY.pushPrime]]),
    ...lacks('카피 4장', copyCommon, [['pushPrime', st.NOTIFY.pushPrime]]),
  ];
  check('O', '알림 화면(스위치 이름 4 · 마케팅 아래 글 3 · 푸시 거부 안내 R-D18-3 · 권한 묻기 전 안내)이 카피.md 12 · 4장 · 동의문구 4-9 · 5-5 와 같다', o5.length === 0, o5.join('\n'));
  const o6 = [
    ...lacks('카피 12', copy12s, [...Object.entries(st.REPORTS.status), ['dateThisYear(R-D18-2)', st.REPORTS.dateThisYear(10, 15)], ['dateOtherYear(R-D18-2)', st.REPORTS.dateOtherYear(2025, 12, 3)], ['reports.empty', st.REPORTS.empty], ['blocked.empty', st.BLOCKED.empty], ['blocked.unblocked', st.BLOCKED.unblocked], ['blocked.unblockFailed', st.BLOCKED.unblockFailed], ['unblockA11y', st.BLOCKED.unblockA11y('{사람}')]]),
    ...lacks('정책 P5-11', policyText, [['status', Object.values(st.REPORTS.status).join(' · ')]]),
  ];
  check('O', '신고 내역 상태 3개(R-D18-1) · 날짜 꼴(R-D18-2) · 빈 상태 2개 · 차단 해제 읽기 이름이 카피.md 12 · 정책 P5-11 과 같다', o6.length === 0, o6.join('\n'));
  const o7 = [
    ...lacks('카피 12', copy12s, [['licenses.intro', st.LICENSES.intro], ['npmGroup', st.LICENSES.npmGroup], ['imageCredit.title', st.IMAGE_CREDIT.headerTitle], ['imageCredit.body', st.IMAGE_CREDIT.body]]),
    ...lacks('동의문구 5-6', consentDocText, [['licenses.intro', st.LICENSES.intro], ['imageCredit.body', st.IMAGE_CREDIT.body]]),
  ];
  check('O', '정보 묶음(오픈소스 라이선스 안내 · npm 패키지 · 이미지 출처 고지 N30)이 카피.md 12 · 동의문구 5-6 과 같다', o7.length === 0, o7.join('\n'));
  const o8 = lacks('카피 12', copy12s, Object.entries(st.CONSENT_MANAGE).filter(([k]) => !['saveFailed', 'view'].includes(k)));
  check('O', '동의 관리(N25: 소제목 2 · 필수 칸 안내 · CK4 끄기 확인창 · 저장 토스트)가 카피.md 12 와 같다', o8.length === 0 && st.CONSENT_MANAGE.view === copy.CONSENT.more && st.CONSENT_MANAGE.saveFailed === copy.PROFILE.saveFailed, o8.join('\n'));
  const o9 = lacks('카피 12', copy12s, [['rowA11yHint', st.SETTINGS.rowA11yHint], ['switchOn', st.SETTINGS.switchOn], ['switchOff', st.SETTINGS.switchOff], ['copied', st.SUPPORT_ACTIONS.copied], ['verificationToast(N19)', st.SETTINGS.verificationToast], ['verificationSoon', st.SETTINGS.verificationSoon]]);
  check('O', '새 글(R-F7: 열기 · 켜짐/꺼짐 · 복사했어요. · 준비 중이에요 · 준비 중)이 카피.md 12 확정 글과 같다', o9.length === 0, o9.join('\n'));
  const o10 = lacks('카피 12', copy12s, [['logout', st.SETTINGS.logout], ['withdraw', st.SETTINGS.withdraw], ['actionFailed', st.SETTINGS.actionFailed], ['copy', st.SUPPORT_ACTIONS.copy], ['openMail', st.SUPPORT_ACTIONS.openMail], ['headerTitle', st.SETTINGS.headerTitle]]);
  check('O', '설정 상단바 · 로그아웃 · 탈퇴하기 · 처리 실패 · 고객센터 버튼 2개가 카피.md 12 와 같다', o10.length === 0, o10.join('\n'));

  // ── P. 04 · 05 임시 설문(F2L, src/content/surveyLiteCopy.ts) ─────────────────
  //  원본: 기획/설문_문항표.csv(12문항 행 그대로 · 상태 '사용') · 카피.md 04 · 05 · 4장 · 화면_요구사항 6장 N03 · N04 · N05 · N08 · N11 · N12
  const sl = await load(path.join(contentDir, 'surveyLiteCopy.ts'));
  const csvRowsOf = (text) => {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
    const split = (line) => {
      const out = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
      }
      out.push(cur);
      return out;
    };
    const head = split(lines[0]);
    return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
  };
  const csv = csvRowsOf(fs.readFileSync(path.join(APP_DIR, '..', '기획', '설문_문항표.csv'), 'utf8'));
  const p1 = [];
  for (const q of sl.LITE_QUESTIONS) {
    const row = csv.find((r) => r['문항ID'] === q.id);
    if (!row) { p1.push(`${q.id}: 문항표에 없음`); continue; }
    if (row['상태'] !== '사용') p1.push(`${q.id}: 상태 ${row['상태']}`);
    const pairs = [['question', '질문'], ['type', '입력형태'], ['options', '선택지'], ['required', '필수'], ['visibility', '공개기본값'], ['matching', '매칭사용'], ['sensitive', '민감']];
    for (const [k, col] of pairs) if (q[k] !== row[col]) p1.push(`${q.id}.${k}: 앱 "${q[k]}" ≠ CSV "${row[col]}"`);
  }
  const usedCount = csv.filter((r) => r['상태'] === '사용').length;
  check('P', `임시 설문 ${sl.LITE_QUESTIONS.length}문항이 문항표(사용 ${usedCount}개, 삭제 문항 없음 · D07 없음)의 행과 글자까지 같다`, sl.LITE_QUESTIONS.length === 12 && p1.length === 0 && !sl.LITE_QUESTIONS.some((q) => q.id === 'D07'), p1.join('\n'));
  const copy04 = stripCode(copySection(/^### 04 /m, /^### 05 /m));
  const copy05 = stripCode(copySection(/^### 05 /m, /^### 06 /m));
  const screensPlain = stripCode(screensText);
  const surveyPool = `${copy04}\n${copyCommon}\n${screensPlain}\n${stripCode(sec14)}`; // QP-A: 14-2 SURVEY_LITE.hiddenUsedLine v5
  const skipKeys = new Set(['quickSido', 'quickOther', 'chips', 'sidoPlaceholder', 'sigunguPlaceholder']); // 칩 · 빠른 시·도 줄은 아래 묶음으로 따로 본다
  const p2 = collectStrings(Object.fromEntries(Object.entries(sl.SURVEY_LITE).filter(([k, v]) => typeof v !== 'function' && !skipKeys.has(k))), 'SURVEY_LITE').filter(([, t]) => !surveyPool.includes(t)).map(([w, t]) => `${w}: "${t}"`);
  for (const [k, t] of [['minChars', sl.SURVEY_LITE.minChars('{n}')], ['maxChars', sl.SURVEY_LITE.maxChars('{n}')], ['chips', sl.SURVEY_LITE.chips.join(' · ')]]) if (!surveyPool.includes(t)) p2.push(`SURVEY_LITE.${k}: "${t}"`);
  check('P', '04 임시 설문 글(상단바 · 임시 저장 · 공개 범위 한 줄 · 부모님 안내 · 직접 쓰는 글 안내 · 저장 토스트 · 이전/다음 · 오류 · N03 · N05 · N08 · N12)이 카피.md 04 · 4장 · 화면_요구사항 6장에 그대로 있다', p2.length === 0, p2.join('\n'));
  const photoPool = `${copy05}\n${copyCommon}\n${screensPlain}\n${consentDocText}`; // R-A: 05 하단 안내는 법무 동의문구 5-4(D-45) 원문
  const p3 = collectStrings(Object.fromEntries(Object.entries(sl.PHOTOS_LITE).filter(([, v]) => typeof v !== 'function')), 'PHOTOS_LITE').filter(([, t]) => !photoPool.includes(t)).map(([w, t]) => `${w}: "${t}"`);
  if (!photoPool.includes(sl.PHOTOS_LITE.badPhoto('{형식}', '{용량}'))) p3.push(`PHOTOS_LITE.badPhoto: "${sl.PHOTOS_LITE.badPhoto('{형식}', '{용량}')}"`);
  check('P', '05 임시 사진 글(제목 · 부제 · 칸 3 · 안내 · 스타일 · 내부 평가 고지 · 권한 2 · 오류 3 · N11)이 카피.md 05 · 화면_요구사항 6장에 그대로 있다', p3.length === 0, p3.join('\n'));
  const p4 = [];
  if (!copy04.includes(sl.SURVEY_LITE_DRAFT.rankUp('{보기}'))) p4.push(`rankUp: "${sl.SURVEY_LITE_DRAFT.rankUp('{보기}')}"`);
  if (!copy04.includes(sl.SURVEY_LITE_DRAFT.rankDown('{보기}'))) p4.push(`rankDown: "${sl.SURVEY_LITE_DRAFT.rankDown('{보기}')}"`);
  if (!copy05.includes(sl.SURVEY_LITE_DRAFT.demoPhotoNote)) p4.push(`demoPhotoNote: "${sl.SURVEY_LITE_DRAFT.demoPhotoNote}"`);
  check('P', '순위 접근성 이름 2 · 테스트 화면 안내(B7 확정, 옛 가안 3줄)가 카피.md 04 · 05 와 같다', p4.length === 0, p4.join('\n'));
  const p5 = collectStrings(sl.LITE_COMMON, 'LITE_COMMON').filter(([, t]) => !copyCommon.includes(t)).map(([w, t]) => `${w}: "${t}"`);
  check('P', '임시 설문 공통 글(불러오는 중 · 인터넷 · 서버 · 다시 시도 · 확인 · 취소)이 카피.md 4장과 같다', p5.length === 0, p5.join('\n'));

  // ── Q. 11 호감(F6, src/content/likesCopy.ts) ─────────────────
  //  원본: 카피.md 11 · 화면_요구사항 4장 11 · 1장 R12 · 6장 N18 · 정책 10-2 NK05. 원본 없는 새 글(스크린리더 이름 3 · '만료' · T2 안)은 [참고]
  const lk = await load(path.join(contentDir, 'likesCopy.ts'));
  const likesPool = `${stripCode(copy11)}\n${screensPlain}\n${stripCode(policyText)}`;
  const qSkip = new Set(['time', 'rowA11y', 'acceptA11y', 'declineA11y', 'cannotSendDraft']);
  const q1 = collectStrings(Object.fromEntries(Object.entries(lk.LIKES).filter(([k, v]) => typeof v !== 'function' && !qSkip.has(k))), 'LIKES').filter(([, t]) => !likesPool.includes(t)).map(([w, t]) => `${w}: "${t}"`);
  check('Q', '11 호감 글(상단바 · 탭 3 · 둘째 줄 · 수락/거절 · 빈 상태 3종 · 오류 · 토스트 · NK05 만료)이 카피.md 11 · 화면_요구사항 · 정책에 그대로 있다', q1.length === 0, q1.join('\n'));
  const q2 = [];
  if (!likesPool.includes(lk.LIKES.expiresIn('{n}'))) q2.push(`expiresIn: "${lk.LIKES.expiresIn('{n}')}"`);
  const r12 = [lk.LIKES.time.minutes('{n}'), lk.LIKES.time.hours('{n}'), lk.LIKES.time.yesterday, lk.LIKES.time.days('{n}'), lk.LIKES.time.date('{월}', '{일}')];
  for (const t of r12) if (!screensPlain.includes(t)) q2.push(`time: "${t}"`);
  check('Q', '11 시간 표기(R12 다섯 꼴) · 만료 "{n}일 뒤 만료"(NK05)가 화면_요구사항 · 정책과 같다', q2.length === 0, q2.join('\n'));
  note(`F6 원본 없는 글(마케팅 확인): '${lk.LIKES.rowA11y('{사람}')}' · '${lk.LIKES.acceptA11y('{사람}')}' · '${lk.LIKES.declineA11y('{사람}')}'`);

  // ── R. 16 상점(F11, copy.ts 의 SHOP · TABS · A11Y.myProfile) ─────────────────
  //  원본: 카피.md 16(NS1 확정 · NS2 가안) · 디자인 D19 5장(태그 칩 "무료"). 결제 전에는 카드 하나뿐이라 상품 글은 없다
  const copy16 = copySection(/^### 16 /m, /^#### 16-A /m);
  const r1 = [];
  if (cell(copy16, '제목', '[상단바]', 2) !== copy.SHOP.headerTitle) r1.push(`상단바 제목: 앱 "${copy.SHOP.headerTitle}" ≠ 카피.md "${cell(copy16, '제목', '[상단바]', 2)}"`);
  if (copy.TABS.shop !== copy.SHOP.headerTitle) r1.push(`탭 이름 "${copy.TABS.shop}" ≠ 상단 제목 "${copy.SHOP.headerTitle}"(NS1: 같은 글)`);
  if (cell(copy16, '제목', '[갈래 B', 2) !== copy.SHOP.reportTitle) r1.push(`카드 제목: 앱 "${copy.SHOP.reportTitle}" ≠ 카피.md "${cell(copy16, '제목', '[갈래 B', 2)}"`);
  if (cell(copy16, '안내', '[갈래 B', 2) !== copy.SHOP.reportBody) r1.push(`카드 설명: 앱 "${copy.SHOP.reportBody}" ≠ 카피.md "${cell(copy16, '안내', '[갈래 B', 2)}"`);
  check('R', '16 상점 글(상단바 · 탭 이름 · 무료 리포트 카드 제목 · 설명)이 카피.md 16(NS1 확정 · NS2 가안)과 같다', r1.length === 0, r1.join('\n'));
  const designGuide = fs.existsSync(path.join(APP_DIR, '..', '디자인', '가이드.md')) ? fs.readFileSync(path.join(APP_DIR, '..', '디자인', '가이드.md'), 'utf8') : '';
  check('R', '탭 4개 이름이 추천 · 호감 · 상점 · 설정이고 카드 칩 "무료"가 디자인 가이드 11-5 에 있다', Object.values(copy.TABS).join(' · ') === '추천 · 호감 · 상점 · 설정' && (designGuide === '' || designGuide.includes(`"${copy.SHOP.reportFree}"`)), Object.values(copy.TABS).join(' · '));
  note(`F11 원본 없는 글(마케팅 확인): 원형 사진 버튼 이름 '${copy.A11Y.myProfile}'(NS3 가안)`);


  // ── S. 16 상점 · 등급 화면(F13, src/content/shopCopy.ts · productCopy.ts) ─────────────────
  //  원본: 카피.md 16장(B10 · B11 반영판). SHOP16 · GRADE16 · BADGE16 · SETTINGS16 · BEFORE_BUY · REFUND_GUIDE 의 글은 16장에 그대로 있어야 하고, 상품 46개 · 빨간 라벨 이유 27줄은 16-B · 16-C 표와 칸마다 같아야 한다.
  //  F14(B13): 옛 SHOP16_DRAFT 41줄은 16-L 에서 확정돼 SHOP16 안으로 옮겼고 이제 같이 대조한다.
  {
  const sc = await load(path.join(contentDir, 'shopCopy.ts'));
  const pc = await load(path.join(contentDir, 'productCopy.ts'));
  const copy16all = `${stripCode(copySection(/^### 16 /m, /^## 4\. /m))}\n${stripCode(sec12Q)}\n${stripCode(sec14)}`; // QP-A: 12-Q(SETTINGS16 v5) · 14-1(GRADE16 v5)도 원본
  const copy16B = copySection(/^#### 16-B /m, /^#### 16-C /m);
  const copy16C = copySection(/^#### 16-C /m, /^#### 16-D /m);
  const strip2 = (t) => t.replace(/\*\*/g, '').replace(/`/g, '');
  const rowCells = (line) => cells(line).map(strip2);
  const G = sc.GRADE16;
  const sPairs = [
    ['SHOP16', {
      ...sc.SHOP16,
      matchPartial: sc.SHOP16.matchPartial('{n}', '{m}'),
      matchBalance: sc.SHOP16.matchBalance('{n}'),
      matchConfirm: sc.SHOP16.matchConfirm('{k}'),
      matchDone: sc.SHOP16.matchDone('{k}'),
      renewOff: sc.SHOP16.renewOff('{날짜}'),
      subActive: sc.SHOP16.subActive('{날짜}'),
      subRenewOff: sc.SHOP16.subRenewOff('{날짜}'),
      gotItem: undefined, // NV18: 아래에서 완성 글 5줄로 따로 본다
      gotGrade: sc.SHOP16.gotGrade('{날짜}'),
      priceUp: sc.SHOP16.priceUp('{날짜}'),
      cancelNote: sc.SHOP16.cancelNote('{날짜}'),
      ok: undefined, // 4장 공통 버튼 '확인'은 아래 공통 확인에서 따로 본다
    }],
    ['GRADE16', {
      ...G,
      big: G.big('{n}'),
      shown: G.shown('{날짜}'),
      notYet: G.notYet('{날짜}'),
      barLine: G.barLine('{항목 이름}', '{n}'),
      accessDone: G.accessDone('{날짜}'),
      accessMerged: G.accessMerged('{날짜}'),
      historyLine: G.historyLine('{날짜}', '{전 n}', '{새 n}', '{이유}'),
      historyFirst: G.historyFirst('{날짜}', '{새 n}'),
      accessButtons: undefined,
      goalStates: undefined,
      reasons: undefined,
      items: undefined,
      bars: undefined,
      upTasks: undefined,
      verifyRows: undefined,
      links: undefined,
      goalPick: undefined,
      goalOptional: undefined,
    }],
    ['BADGE16', { ...sc.BADGE16, chip: sc.BADGE16.chip('{n}'), a11y: sc.BADGE16.a11y('{n}'), bubbleTitle: sc.BADGE16.bubbleTitle('{n}'), detail: sc.BADGE16.detail('{n}') }],
    ['SETTINGS16', sc.SETTINGS16],
    ['REPORT16', sc.REPORT16],
    ['PURCHASES16', { ...sc.PURCHASES16, line: sc.PURCHASES16.line('{날짜}', '{금액}') }],
    ['NV18', [['지난 추천 열람권', '{n}장이'], ['호감 편지', '{n}통이'], ['깊은 성향 리포트', '{n}회가'], ['오늘 한 분 더', '{n}회가'], ['1회 매칭', '{n}명분이']].map(([a, b]) => sc.SHOP16.gotItem(a, b))],
    ['REFUND_GUIDE', sc.REFUND_GUIDE],
    // WITHDRAW_SUB_NOTE(NV36)는 v5에 없다(12-Q '(줄 없음)', QP-A)
    ['BEFORE_BUY', { refundLink: sc.BEFORE_BUY.refundLink, docsLink: sc.BEFORE_BUY.docsLink }],
    ['BEFORE_BUY.lines', [...sc.BEFORE_BUY.grade, ...sc.BEFORE_BUY.match, ...sc.BEFORE_BUY.single].map((l) => `${l.label}: ${l.text}`)],
    ['GRADE16.lists', [
      G.bars.join(' / '),
      G.upTasks.join(' / '),
      G.verifyRows.join(' / '),
      G.goalStates.join(' / '),
      `${G.goalPick} / ${G.goalOptional}`,
      `${G.accessButtons.send} / ${G.accessButtons.cancel}`,
      ...G.links,
      ...Object.values(G.items),
      ...new Set(Object.values(G.reasons)),
    ]],
  ];
  const lostS = [];
  for (const [name, node] of sPairs) lostS.push(...collectStrings(node, name).filter(([, text]) => text !== '' && !copy16all.includes(text)).map(([where, text]) => `${where}: "${text}"`));
  check('S', '16 상점 · 등급 화면 글(shopCopy.ts SHOP16 · GRADE16 · BADGE16 · SETTINGS16 · 구매 전 확인 · 결제 · 환불 안내)이 카피.md 16장에 한 글자씩 그대로 있다', lostS.length === 0, lostS.join('\n'));

  // 카피.md 16-B 상품 표 · 16-C 빨간 라벨 이유와 productCopy.ts 가 칸마다 같다. D-62(10-16): N07 은 상점에서 뺐다 — 카피.md 표에 아직 남아 있어도(마케팅이 고친다) 대조에서 제외한다
  const DROPPED = ['N07'];
  const kept = (l) => !DROPPED.some((id) => l.includes(` · ${id}]`));
  const wantProducts = copy16B.split('\n').filter((l) => /^\| \[상품 \d+ · [A-Z]\d+\]/.test(l) && kept(l)).map((l) => {
    const c = rowCells(l);
    const parts = c[2].split(' / ');
    return { id: /· ([A-Z]\d+)\]/.exec(c[0])[1], name: parts[0], line: parts[1], price: parts.slice(2).join(' / ') };
  });
  const wantReasons = Object.fromEntries(copy16C.split('\n').filter((l) => /^\| \[빨간 라벨 이유 · [A-Z]\d+\]/.test(l) && kept(l)).map((l) => [/· ([A-Z]\d+)\]/.exec(l)[1], rowCells(l)[2]]));
  check('S', `상품 ${wantProducts.length}개의 이름 · 한 줄 · 가격 표기가 카피.md 16-B 개선안 칸(이름 / 한 줄 / 가격)과 같다`, wantProducts.length === 45 && same(pc.PRODUCT_COPY.map((p) => ({ ...p })), wantProducts), `표 ${wantProducts.length}행 ↔ 앱 ${pc.PRODUCT_COPY.length}개`);
  check('S', `빨간 라벨 이유 ${Object.keys(wantReasons).length}줄이 카피.md 16-C 와 같다(라벨 NV57 "${sc.SHOP16.riskLabel}"은 테스트 화면에서만)`, Object.keys(wantReasons).length === 26 && same(pc.RISK_REASONS, wantReasons), '');

  // Q6 금지어 · Q7 '매칭' · 작업 표시 — 앱 화면 글(shopCopy.ts · productCopy.ts)에서
  const shopStrings = [
    ...collectStrings({ ...sc.SHOP16, gotItem: undefined, subActive: '', subRenewOff: '', gotGrade: '', priceUp: '', cancelNote: '', matchPartial: sc.SHOP16.matchPartial(3, 3), matchBalance: sc.SHOP16.matchBalance(3), matchConfirm: sc.SHOP16.matchConfirm(3), matchDone: sc.SHOP16.matchDone(3), renewOff: sc.SHOP16.renewOff('11월 1일') }, 'SHOP16'),
    ...collectStrings({ BEFORE_BUY: sc.BEFORE_BUY, REFUND_GUIDE: sc.REFUND_GUIDE, SETTINGS16: sc.SETTINGS16 }, 'S'),
    ...collectStrings({ ...G, big: G.big(3), shown: '', notYet: '', barLine: '', accessDone: '', accessMerged: '', historyLine: '', historyFirst: '' }, 'GRADE16'),
    ...collectStrings({ ...sc.BADGE16, chip: '', a11y: '', bubbleTitle: '', detail: '' }, 'BADGE16'),
    ...collectStrings(sc.REPORT16, 'REPORT16'),
    ...collectStrings(pc, 'PRODUCT'),
  ];
  const bannedS = /순위|퍼센트|%|인기|상위|하위|최고|등수|결혼정보회사|결혼중개|중매|주선|맞선|배우자|성혼|커플매니저|매니저|정회원|가입비|회비|결혼 전제|보장/;
  const badWords = shopStrings.filter(([, t]) => bannedS.test(t.replace('남은 금액의 10%를 빼고', ''))).map(([where, t]) => `${where}: "${t.slice(0, 40)}"`); // 예외 1개: C1 중도 해지 환급 '남은 금액의 10%'(법정 표시)
  check('S', '16 상점 · 등급 앱 글에 금지어(순위 · 퍼센트 · % · 인기 · 상위 · 하위 · 최고 · 등수 · 중개/주선 말 · 성혼 · 매니저 · 정회원 · 가입비 · 회비 · 보장)가 없다(예외: C1 "남은 금액의 10%" 하나)', badWords.length === 0, badWords.join('\n'));
  const badMatch = shopStrings.filter(([, t]) => t.replace(/1회 매칭|주간 매칭/g, '').includes('매칭')).map(([where, t]) => `${where}: "${t.slice(0, 40)}"`);
  check('S', "'매칭'은 상품 이름 '1회 매칭'(숨김 v4)과 v5 '주간 매칭'(카피 14-1) 자리에만 나온다", badMatch.length === 0, badMatch.join('\n'));
  const marksS = shopStrings.filter(([, t]) => /▲W|\bW\d{1,2}\b|\bNV\d|\bB1[01]\b|D-\d\d/.test(t)).map(([where, t]) => `${where}: "${t.slice(0, 40)}"`);
  check('S', '작업 표시(▲W# · NV 번호 · B10 · D-번호)가 앱 글로 새지 않는다', marksS.length === 0, marksS.join('\n'));
  // 등급 · 점수 말은 허용 구역 글 파일에만(카피 16-J): 이 글 파일(shopCopy · productCopy)과 법무 게시본(consentContent · legalPrivacy · legalTerms) 밖의 content 파일에는 없다
  const zoneFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith('.ts') && !['shopCopy.ts', 'productCopy.ts', 'consentContent.ts', 'legalPrivacy.ts', 'legalTerms.ts', 'types.ts', 'fillIns.ts'].includes(f));
  const leaked = zoneFiles.filter((f) => /등급|점수/.test(fs.readFileSync(path.join(contentDir, f), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !/^\s*whyNote:/.test(l)).map((l) => (/^\s*'CHAT\.A06\.why':/.test(l) ? l.replace(/\/\/.*$/, '').split('등급에는 쓰지 않아요.').join('') : /^\s*grade: '내 등급',/.test(l) ? '' : l.split('외모를 평가하거나 점수를 매기지 않아요.').join(''))).join('\n'))); // 예외: CHAT.A06.why(기획 QPP) · 12 설정 줄 '내 등급'(SETTINGS.rows.grade, D-200 ② — 허용 구역 '12 설정 줄') · 05 법무 5-4 '외모를 평가하거나 점수를 매기지 않아요.'(하지 않는다는 안내)
  check('S', `등급 · 점수 말은 허용 구역 글 파일(16 상점 · 09/10 배지 · 12 설정 줄)에만 있고 그 밖 글 파일(${zoneFiles.length}개)에는 없다(카피 16-J. 예외 하나: 10 상자 whyNote "추천 점수는 보여주지 않아요.", 법무 L10 W1 확정)`, leaked.length === 0, leaked.join(', '));
  // R1 C①(D-123 ④): 설문 v2 글(features/surveyV2 의 copy.ts · questionCopy.ts)도 같은 점검에 넣는다. 등급 말은 카피 16-J L-7 세 자리만(declineHint · A06 도움말 · 세부사항 머리), 점수 말 0
  const sv2Dir = path.join(APP_DIR, 'src', 'features', 'surveyV2');
  const sv2Files = ['copy.ts', 'questionCopy.ts'].filter((f) => fs.existsSync(path.join(sv2Dir, f)));
  const sv2Allowed = ['답하면 등급이 오를 수 있어요.', '종교는 짝을 고르는 데만 쓰고 등급에는 쓰지 않아요.', '쓴 내용은 AI가 읽고 등급 계산에 참고해요.']; // 둘째: 카피 14-2 survey.A06.help v5(QP-A)
  const sv2Lines = sv2Files.flatMap((f) => fs.readFileSync(path.join(sv2Dir, f), 'utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).map((l) => [f, l]));
  const sv2Seen = sv2Allowed.map((t) => sv2Lines.filter(([, l]) => l.includes(t)).length);
  const sv2Leaked = sv2Lines.filter(([, l]) => /등급|점수/.test(sv2Allowed.reduce((s, t) => s.split(t).join(''), l))).map(([f, l]) => `${f}: ${l.trim().slice(0, 50)}`);
  check('S', `설문 v2 글(${sv2Files.length}개 파일)의 등급 말은 카피 16-J L-7 세 자리에 한 번씩만 있고(${sv2Seen.join(' · ')}) 그 밖의 등급 · 점수 말은 없다`, sv2Files.length === 0 || (sv2Leaked.length === 0 && sv2Seen.every((n) => n === 1)), [...sv2Leaked, ...sv2Allowed.filter((_, i) => sv2Seen[i] !== 1).map((t) => `L-7 자리 개수 다름: ${t}`)].join('\n'));
  // '점수' 말은 16 전체(등급 화면 · 상품)와 NV81 방향 문구(09 말풍선 · 10 상세 — BADGE16)에서만. 12 설정 줄 · 구매 전 확인 · 안내 글에는 없다(L-2 등급만 허용)
  const pointWord = shopStrings.filter(([where, t]) => /점수/.test(t) && (where.startsWith('S.SETTINGS16') || where.startsWith('S.BEFORE_BUY') || where.startsWith('S.WITHDRAW'))).map(([where]) => where);
  check('S', "'점수' 말은 12 설정 줄 · 탈퇴 안내 · 구매 전 확인에는 없다(등급만 허용, 카피 16-J L-2 · L-3)", pointWord.length === 0, pointWord.join(', '));
  // F16: 16-O(B15 확정 줄)의 글 5줄이 카피.md 16-O 에 그대로 있다. 구 가안 SELLER_SOON_DRAFT 는 SHOP16.sellerSoon 으로 정식이 됐고 앱 글 중 카피 밖 글은 없다([참고] 0)
  const copy16O = stripCode(copySection(/^#### 16-O /m, /^## 4\. /m));
  const lostO = [['closed', sc.SHOP16.closed], ['subPrepLine', sc.SHOP16.subPrepLine], ['comingButton', sc.SHOP16.comingButton], ['subPrepDetail', sc.SHOP16.subPrepDetail], ['sellerSoon', sc.SHOP16.sellerSoon]].filter(([, text]) => !copy16O.includes(text)).map(([k, text]) => `SHOP16.${k}: "${text}"`);
  check('S', '16-O(B15) 상점 닫힘 · 구독 준비 중 한 줄 · 단추 · 상세 안내 · 판매자 정보 준비 중 5줄이 카피.md 16-O 에 그대로 있다(가안 아님)', lostO.length === 0 && sc.SELLER_SOON_DRAFT === undefined, lostO.join('\n'));
  }


  // N14(K5 확정): 칩 글자 수 안내는 "2~8자로 써 주세요." 이다(서버 검사 8자 이하 · 태그 스키마 2~8자). 기획 원본 문서가 아직 2~10자면 참고로 알린다.
  check('J', '07 N14 칩 글자 수 안내가 기획 확정값 "2~8자로 써 주세요."이고 입력칸 자리표시("2~8자")와 같다',
    copy.TRAITS.errors.tagLength === '2~8자로 써 주세요.' && copy.TRAITS.addTagPlaceholder === '2~8자', `"${copy.TRAITS.errors.tagLength}" / "${copy.TRAITS.addTagPlaceholder}"`);

  // ── V. 공개 전 도착 화면(D42-M · D-178, boardingCopy.ts ARRIVE)이 카피.md 12장 표와 글자 그대로 같은가 · 느낌표 · 재촉 0 ──
  {
    const bc = await load(path.join(APP_DIR, 'src', 'features', 'boarding', 'boardingCopy.ts'));
    const sec12 = copyText.slice(copyText.search(/^## 12\. V5 공개 전 도착 화면/m));
    const rows = sec12.split(/\r?\n/).filter((l) => /^\| (제목|안내|버튼) \|/.test(l)).map(cells);
    const want = { title: rows.find((r) => r[0] === '제목')?.[2], body: rows.find((r) => r[0] === '안내')?.[2], open: rows.find((r) => r[0] === '버튼')?.[2] };
    const diffs = Object.entries(want).filter(([k, v]) => bc.ARRIVE?.[k] !== v).map(([k, v]) => `ARRIVE.${k}: 앱 "${bc.ARRIVE?.[k]}" / 카피 "${v}"`);
    check('V', '도착 화면 제목 · 부제 · 버튼(ARRIVE 3줄)이 카피.md 12장과 같다', rows.length === 3 && diffs.length === 0, diffs.join('\n') || `표 줄 ${rows.length}`);
    const bad = Object.values(bc.ARRIVE ?? {}).filter((t) => /[!！]|서두르|마감|지금 바로|놓치지|남은 (시간|자리)/.test(t));
    check('V', '도착 화면 글에 느낌표 · 재촉 말 0', bad.length === 0, bad.join(' / '));
  }

  // ── W. 대화형 설문 글(V6-F, content/surveyChatCopy.ts CHAT_V6)이 카피.md 13장 표와 한 글자씩 같은가 · 느낌표 · 등급 · 점수 말 0 ──
  {
    const cc = await load(path.join(APP_DIR, 'src', 'content', 'surveyChatCopy.ts'));
    const sec13 = copyText.slice(copyText.search(/^## 13\. V6 대화형 설문/m));
    const rows = new Map(sec13.split(/\r?\n/).filter((l) => /^\| `CHAT\./.test(l)).map(cells).map((r) => [r[0].replace(/`/g, ''), r[1]]));
    for (const [k, v] of V5_COPY) if (k.startsWith('CHAT.') && rows.has(k)) rows.set(k, v); // QP-A: 14-2 '13장 CHAT.…' 줄이 13장 옛 줄보다 앞선다
    const app = Object.entries(cc.CHAT_V6 ?? {});
    const diffs = app.filter(([k, t]) => rows.get(k) !== t).map(([k, t]) => `${k}: 앱 "${t}" / 카피 "${rows.get(k)}"`);
    // R-A(D-199): 13장 표에서 '폐지(D-199)' 표시가 붙은 줄(F07 희망 종교)은 앱에서 뺐다 — 카피에만 있어도 된다(마케팅이 15장으로 옮김)
    const retired = new Set(sec13.split(/\r?\n/).filter((l) => /^\| `CHAT\./.test(l) && /폐지\(D-199\)/.test(l)).map((l) => cells(l)[0].replace(/`/g, '')));
    const only = [...rows.keys()].filter((k) => !(k in (cc.CHAT_V6 ?? {})) && !retired.has(k));
    check('W', `대화형 설문 글 ${app.length}개가 카피.md 13장 표와 한 글자씩 같다(표 ${rows.size}줄)`, app.length > 400 && diffs.length === 0 && only.length === 0, [...diffs, ...only.map((k) => `카피에만 있음: ${k}`)].join('\n'));
    // 기획 QPP(10-27): CHAT.A06.why '…등급에는 쓰지 않아요.'는 쓰지 않는다는 안내라 허용(설문 v2 A06 도움말 · 카피 16-J L-7 과 같은 뜻)
    const NEG_GRADE = '등급에는 쓰지 않아요.';
    const bad = app.filter(([k, t]) => /[!！]|등급|점수/.test(k === 'CHAT.A06.why' ? t.split(NEG_GRADE).join('') : t)).map(([k]) => k);
    check('W', "대화형 설문 글에 느낌표 · 등급 · 점수 말 0(예외: CHAT.A06.why '등급에는 쓰지 않아요.')", bad.length === 0, bad.join(' '));
    // L17A: CK16 카드 글이 동의문구 4-16 화면 문구와 같다(요약 줄은 '모으는 것: ' 같은 머리를 뗀 글). title 은 기획 V6-K 글(법무 '글 쓰는 속도 분석 [선택]'과 다름 — 팀장 확인 대기)
    const ck16 = parseLaterConsents(readDoc(SOURCES.consent)).items.find((i) => i.code === 'CK16');
    const body = (head) => (ck16.summary.find((s) => s.startsWith(`${head}: `)) ?? '').slice(head.length + 2);
    const want = { what: body('모으는 것'), why: ck16.why, keys: body('저장하지 않는 것'), keep: body('보관'), withdraw: body('거두기'), optional: ck16.note, more: ck16.more };
    const ck16Diffs = Object.entries(want).filter(([k, v]) => !v || cc.CHAT_V6?.[`CHAT.CK16.${k}`] !== v).map(([k, v]) => `CHAT.CK16.${k}: 앱 "${cc.CHAT_V6?.[`CHAT.CK16.${k}`]}" / 동의문구 4-16 "${v}"`);
    check('W', 'CK16 카드 글 7개(what · why · keys · keep · withdraw · optional · more)가 동의문구 4-16 화면 문구와 같다', ck16Diffs.length === 0, ck16Diffs.join('\n'));
    // L17A · D-190: 정치 막대 동의 글 POL9 ~ POL12 = 동의문구 4-15 화면 문구 = 카피.md 13-1 표
    const ck15 = parseLaterConsents(readDoc(SOURCES.consent)).items.find((i) => i.code === 'CK15');
    // 앱 POL9 ~ POL12 는 생성 파일(CONSENT_LATER_ITEMS CK15)을 그대로 가리킨다(별칭 @/ 때문에 Node 로 읽지 않고 글에서 확인) — 생성 파일이 낡지 않았는지는 A 가 본다
    const polSrc = fs.readFileSync(path.join(APP_DIR, 'src', 'features', 'surveyV2', 'politicsCopy.ts'), 'utf8');
    const polField = { 'POL.consentTitle': 'title', 'POL.consentBody': 'why', 'POL.consentNote': 'note', 'POL.consentCheck': 'label' };
    const polRows = new Map(sec13.split(/\r?\n/).filter((l) => /^\| `POL\./.test(l)).map(cells).map((r) => [r[0].replace(/`/g, '').split(' ')[0], r[1]]));
    const polDiffs = Object.entries(polField).filter(([k, f]) => !ck15?.[f] || !new RegExp(`${k.slice(4)}: CK15\\.${f}\\b`).test(polSrc) || polRows.get(k) !== ck15[f]).map(([k, f]) => `${k}: 앱이 CK15.${f} 를 가리키나 / 카피 13-1 "${polRows.get(k)}" / 동의문구 4-15 "${ck15?.[f]}"`);
    check('W', '정치 성향 동의 글 4개(POL9 ~ POL12)가 동의문구 4-15 화면 문구 · 카피.md 13-1 과 같다', polDiffs.length === 0, polDiffs.join('\n'));
  }

  // ── X. v5 새 화면 글(카피.md 14-5, 검수 QP-07 · 마케팅 QPM 3차) ──
  {
    const bc = await load(path.join(APP_DIR, 'src', 'features', 'boarding', 'boardingCopy.ts'));
    const ch = await load(path.join(APP_DIR, 'src', 'features', 'chat', 'chatCopy.ts'));
    const st12 = await load(path.join(contentDir, 'settingsCopy.ts'));
    const mc = await load(path.join(APP_DIR, 'src', 'features', 'chat', 'meetCopy.ts'));
    const roots = { BOARDING: bc.BOARDING, REVEAL: bc.REVEAL, CREDITS: bc.CREDITS, CHAT: ch.CHAT, AVOID: st12.AVOID, MEET_SCENE: mc.MEET_SCENE };
    const from = copyText.search(/^#### 14-5-1\. /m);
    const to = copyText.search(/^#### 14-5-3\. /m);
    let rowsX = (from >= 0 && to > from ? copyText.slice(from, to) : '')
      .split(/\r?\n/)
      .filter((l) => /^\| T\d `[A-Z]+\./.test(l))
      .map(cells)
      .map((r) => [(/`([^`]+)`/.exec(r[0]) ?? [])[1], r[1]]);
    // R-A(D-199 · D-200 · D-201): 14-6 · 14-7 표(첫 칸 'T1 `키`' · 'T1 · T2 `키`' · '12-5 `AVOID.키`')가 14-5 옛 줄보다 앞선다.
    //  한 칸에 키가 둘이면 글을 ' / ' 로 나눠 짝짓는다. 다른 곳이 원본인 줄('3장 12-Q …')과 BOARDING · REVEAL · CREDITS · AVOID 밖 키(SAFETY_MINOR · 13장 CHAT_V6)는 대조하지 않는다
    const from146 = copyText.search(/^### 14-6\. /m);
    const to147 = copyText.search(/^## 15\. /m);
    const newer = new Map();
    for (const l of (from146 >= 0 ? copyText.slice(from146, to147 > from146 ? to147 : undefined) : '').split(/\r?\n/)) {
      if (!/^\| [^|`]*`(BOARDING|REVEAL|CREDITS|AVOID)\./.test(l)) continue;
      const c = cells(l);
      const keys = [...c[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((k) => /^(BOARDING|REVEAL|CREDITS|AVOID)\./.test(k));
      if (/^\d+장 /.test(c[1])) continue;
      const parts = keys.length > 1 ? c[1].split(' / ') : [c[1]];
      if (parts.length !== keys.length) continue;
      keys.forEach((k, i) => newer.set(k, parts[i]));
    }
    for (let i = 0; i < rowsX.length; i += 1) if (newer.has(rowsX[i][0])) rowsX[i] = [rowsX[i][0], newer.get(rowsX[i][0])];
    for (const [k, v] of newer) if (!rowsX.some(([key]) => key === k)) rowsX.push([k, v]);
    // D46-A: 카피.md 16장(만남 장면) 표 — 첫 칸 'T4S `MEET_SCENE.키`' · 'T4 `CHAT.room.metAt`'(16장 머리 말: V · W · X 읽기와 부딪히지 않는 꼴)
    const from16 = copyText.search(/^## 16\. /m);
    const sec16 = from16 >= 0 ? copyText.slice(from16) : '';
    const end16 = sec16.slice(3).search(/^## /m);
    const rows16 = (end16 >= 0 ? sec16.slice(0, end16 + 3) : sec16)
      .split(/\r?\n/)
      .filter((l) => /^\| T4S? `(MEET_SCENE|CHAT)\./.test(l))
      .map(cells)
      .map((r) => [(/`([^`]+)`/.exec(r[0]) ?? [])[1], r[1]]);
    for (const row of rows16) if (!rowsX.some(([key]) => key === row[0])) rowsX.push(row);
    const SLOT = '§';
    const MARK = '\u0001';
    const norm = (t) => t.replace(/\{[^{}]+\}/g, SLOT);
    const resolve = (key) => key.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((o, k) => (o == null ? undefined : o[k]), roots);
    // 숫자로 갈래가 나뉘는 함수(+n장 / -n장 등)는 표시 글자로 부를 수 없어 예시 값 둘로 부른다
    const NUMERIC = { 'CREDITS.delta': [[1], [-1]] };
    const diffsX = [];
    let funcs = 0;
    for (const [key, want] of rowsX) {
      const v = resolve(key);
      if (want === '(줄 없음)') {
        if (v !== undefined) diffsX.push(`${key}: 카피 '(줄 없음)'인데 앱에 글이 있음`);
        continue;
      }
      const alts = want.split(' / ').map(norm);
      let got;
      if (typeof v === 'string') got = [norm(v)]; // 앱 글에 남은 {…} 자리(값이 비면 화면에서 숨김)도 같은 자리로 본다
      else if (typeof v === 'function') {
        funcs += 1;
        const calls = NUMERIC[key] ?? [Array.from({ length: Math.max(1, v.length) }, () => MARK)];
        got = calls.map((args) => String(v(...args)).split(MARK).join(SLOT).replace(/\d+/g, (n) => (NUMERIC[key] ? SLOT : n)));
      } else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) got = [v.join(' / ')];
      else {
        diffsX.push(`${key}: 앱에 없음(또는 글이 아님)`);
        continue;
      }
      const whole = norm(want);
      const ok = got.length === 1 ? got[0] === whole || alts.includes(got[0]) : got.every((g) => alts.includes(g));
      if (!ok) diffsX.push(`${key}: 앱 "${got.join(' / ')}" / 카피 "${want}"`);
    }
    // D46-A: 16-3 쓰지 않을 낱말(방송 · 유행어 · '관광지' · 재촉 · 숫자 · 느낌표 · 영문) 0 · 장소 이름이 등급 아이콘 낱말 단독이 아님 · 16장 표 18줄
    const meet = mc.MEET_SCENE;
    const meetTexts = [...Object.values(meet.place), meet.when('수요일'), ...Object.values(meet.line), meet.skip, meet.skipA11y, meet.go, meet.a11y('한강 벤치', '수요일 저녁', meet.line.quiet), ch.CHAT.room.metAt('수요일 저녁', '한강 벤치')];
    const NO_MEET = /시그널|환승|최종 선택|러브라인|썸|설렘|심쿵|운명|직진|출연자|데이트 신청|문자 투표|정보 공개|커플|관광지|지금|곧|놓치지|먼저 말을 걸어 보세요|[!！]|\d|[A-Za-z]/;
    for (const text of meetTexts) if (NO_MEET.test(text)) diffsX.push(`16-3 쓰지 않을 낱말: "${text}"`);
    for (const name of Object.values(meet.place)) if (['바다', '산', '달', '구름', '섬', '다리', '숲', '해', '들판'].includes(name)) diffsX.push(`16-3 등급 아이콘 낱말 단독: "${name}"`);
    if (rows16.length !== 18) diffsX.push(`카피 16장 만남 장면 표가 18줄이 아님(${rows16.length}줄)`);
    check('X', `v5 새 화면 글 ${rowsX.length}줄(14-5-1 · 14-5-2 · 14-6 · 14-7 · 16장 만남 장면 ${rows16.length}줄, 글 함수 ${funcs}개 포함)이 boardingCopy.ts · chatCopy.ts · settingsCopy.ts AVOID · meetCopy.ts 와 같다`, rowsX.length >= 180 && diffsX.length === 0, diffsX.join('\n') || `표 ${rowsX.length}줄`);
  }

  // R1 A⑦ T04 · K11: 오류 · 안내 문구 규칙(카피.md 1-1)과 v4 글 대조(카피.md 7장). 규칙 본문은 check-copy-rules.mjs
  runCopyRules({ check, note, appDir: APP_DIR });

  // 참고: 원본 문서끼리 글이 다른 곳(앱은 마케팅 확정본 카피.md 를 따른다)
  const screens = readPlanDoc('screens');
  if (/인증번호를 이메일로 보내 드려요\./.test(screens)) note('02 부제: 카피.md "보내드려요" ↔ 화면_요구사항 N21 "보내 드려요" — 앱은 카피.md(확정)를 따랐어요. 마케팅직원 확인 필요');
  if (/자리표시 "이메일 주소 \(예: name@example\.com\)"/.test(screens)) note('02 이메일 칸 자리표시: 카피.md "example@email.com"(Figma 와 같음) ↔ 화면_요구사항 N22 "이메일 주소 (예: name@example.com)" — 앱은 카피.md 를 따랐어요');
} catch (error) {
  check('실행', '점검 도중 오류가 없다', false, String(error?.stack ?? error).split('\n').slice(0, 4).join('\n'));
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n화면 글 점검: 통과 ${results.length - failed} · 실패 ${failed}`);
process.exit(failed > 0 ? 1 : 0);
