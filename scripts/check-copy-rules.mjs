// 화면 글 규칙 점검(R1 A⑦ · T04 · K11). 읽기 전용, 네트워크 없음. check-copy.mjs 가 이 파일의 runCopyRules 를 불러 그룹 'T04' · 'K11' 로 함께 돈다.
//  T04 = 마케팅/B17_변경기록.md 5장 R1~R18(카피.md 1장 1-1 오류 · 안내 문구 규칙). K11 = K13 22 · 23 · 28 · 43 · 52 · 53 중 기계로 잴 수 있는 것.
//  대상: app/src/content/*.ts 의 글(주석 제외, scripts/lib/content-strings.mjs). 법무 생성 파일(약관 · 처리방침 · 동의문구)은 R13 · K11 에서만 뺀다.
//  v4 묶음 = 첫 이름이 V4W01 · FEATURED · MEET_FEEDBACK · SAFE_SHARE · CONTACT_HINT 인 글. 그중 '키 이름이 그대로 보이는 임시 글'(F19 1단계)은 대조를 미루고 [참고]로 센다.
//  정규식은 B17 제안 그대로. 오탐은 아래 ALLOW 에 이유와 함께 넣고 마케팅에 알린다.
// 사용: node scripts/check-copy-rules.mjs [--content <폴더>] [--copy <카피.md>] [--json]   (종료 코드 0 통과 · 1 실패)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentStrings } from './lib/content-strings.mjs';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOT_COPY = ['types.ts', 'fillIns.ts', 'contactWords.ts']; // 타입 · 채움 값 · 생성 낱말 목록(화면 글이 아님)
const LEGAL = ['legalTerms.ts', 'legalPrivacy.ts', 'consentContent.ts'];
const V4_ROOTS = ['V4W01', 'FEATURED', 'MEET_FEEDBACK', 'SAFE_SHARE', 'CONTACT_HINT'];

// 허용 목록(키 경로 → 이유). '예외' = 규칙상 맞는 글(키 이름만 걸림) · '고칠 것' = 주인(C① 문구)에게 넘긴 글 — 고치면 여기서 지운다
const ALLOW = {
  R5: {
    'LIKES.acceptDone': '예외 대기: B17 8장 4번 — 연결됨 둘째 줄과 같은 글이라 마침표 없이 둔다(팀장 결정 대기, 마케팅 의견 = 허용)',
    'TRAITS.addTagDone': "예외: 키 끝이 Done 이지만 [더하기] 버튼 글이다(버튼은 마침표 없이, 1-1 '마침표')",
    'SETTINGS.verificationToast': "고칠 것(C①): 토스트인데 마침표가 없다 — '준비 중이에요' → '준비 중이에요.'(앱 글과 카피.md 를 같이 고친다)",
  },
  K11: {
    'CHILD_SAFETY.policy': "예외: 아동 안전 정책 고지(N35)의 '법적 조치'는 위협이 아니라 법정 안내다",
  },
};

const isV4 = (s) => V4_ROOTS.includes(s.key.split('.')[0]);
// F19 1단계 임시 글: 'V4W01.featured.label' 의 글이 'featured.label'
const isTemp = (s) => s.key.startsWith('V4W01.') && (s.text === s.key.slice('V4W01.'.length) || /^[a-z]+(\.[a-zA-Z0-9]+)+$/.test(s.text));
const last = (key) => key.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? '';
const sentences = (text) => text.split(/(?<=[.?])\s+/).map((t) => t.trim()).filter(Boolean);
const ERROR_KEY = /(Failed|failed|[Ee]rror|Blocked|Closed|unavailable|[Uu]navailable|rateLimited)$/;
const TOAST_KEY = /(Toast|Done)$/;
const isErrorKey = (key) => ERROR_KEY.test(last(key)) || key.split('.').includes('errors');
const show = (s) => `${s.file}:${s.line} ${s.key}: "${s.text.slice(0, 40)}"`;

// 카피.md 7장(v4)의 '→ 개선안' 칸(표 셋째 칸)을 모은 글
function copyV4Cells(copyFile) {
  if (!copyFile || !fs.existsSync(copyFile)) return null;
  const doc = fs.readFileSync(copyFile, 'utf8').replace(/\r\n/g, '\n');
  const from = doc.search(/^## 7\. /m);
  if (from < 0) return null;
  return doc
    .slice(from)
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| 위치') && !/^\|\s*-/.test(l))
    .map((l) => l.split('|').map((c) => c.trim())[3] ?? '')
    .join('\n');
}

// 규칙을 돌려 [{ group, title, ok, detail }] · notes 를 돌려준다
export function evaluateCopyRules({ contentDir = path.join(APP_DIR, 'src', 'content'), copyFile = path.resolve(APP_DIR, '..', '마케팅', '카피.md') } = {}) {
  const every = contentStrings(contentDir, NOT_COPY).filter((s) => s.text.trim() !== '');
  const temp = every.filter((s) => isV4(s) && isTemp(s)); // 임시 키 글은 모든 규칙에서 빼고 따로 센다
  const all = every.filter((s) => !temp.includes(s));
  const plain = all.filter((s) => !LEGAL.includes(s.file));
  const v4 = all.filter((s) => isV4(s));
  const results = [];
  const notes = [];
  const rule = (group, id, title, hits, allow = {}) => {
    const bad = hits.filter((s) => !(s.key in allow));
    const allowed = hits.filter((s) => s.key in allow);
    results.push({ group, title: `${id} ${title}`, ok: bad.length === 0, detail: bad.map(show).join('\n') });
    for (const s of allowed) notes.push(`${id} 허용 목록: ${s.key} — ${allow[s.key]}`);
  };
  const where = (list, re) => list.filter((s) => re.test(s.text));

  // ── T04: B17 5장 R1~R18 ──
  rule('T04', 'R1', '느낌표 0(전체)', where(all, /[!！]/));
  rule('T04', 'R2', '사과 말 0(죄송 · 미안 · 양해, 전체)', where(all, /죄송|미안|양해/));
  rule('T04', 'R3', '사용자 탓 말 0(잘못 입력하셨 · 실수하셨 · 틀리셨, 전체)', where(all, /잘못 (입력|누르|고르)하셨|실수(하셨|로 )|틀리셨/));
  const r4 = plain.filter((s) => isErrorKey(s.key) && !(sentences(s.text).length >= 2 || /(주세요|보세요|할 수 있어요|보낼 수 있어요)\.$/.test(s.text)));
  notes.push(`R4 오류 글 꼴(무슨 일 + 어떻게) 사람 검토 목록 ${r4.length}줄 — 상태만 말하는 글은 1-1 예외${r4.length ? `: ${r4.slice(0, 8).map((s) => s.key).join(' · ')}${r4.length > 8 ? ' …' : ''}` : ''}`);
  rule('T04', 'R5', '오류 · 토스트 글은 마침표로 끝난다(제목 꼴 제외)', plain.filter((s) => (isErrorKey(s.key) || TOAST_KEY.test(last(s.key))) && !/Title$/.test(last(s.key)) && !/[.?]$/.test(s.text.trim())), ALLOW.R5);
  rule('T04', 'R6', '한 글 안에 같은 문장 반복 0', all.filter((s) => { const xs = sentences(s.text); return new Set(xs).size !== xs.length; }));
  rule('T04', 'R7', '토스트 글 40자 이하 · 두 문장까지', plain.filter((s) => TOAST_KEY.test(last(s.key)) && (Array.from(s.text).length > 40 || sentences(s.text).length > 2)));
  rule('T04', 'R8', 'v4 글에 점수 · 서열 말 0', where(v4, /점수|순위|등급|등수|1등|1위|가장|최고|최상|제일|상위|하위|별점|평점|%|퍼센트|인기|베스트/));
  rule('T04', 'R9', 'v4 글에 재촉 말 0', where(v4, /놓치지|서두르|지금 바로|마감|곧 사라|남은 시간|오늘까지|마지막 기회/));
  rule('T04', 'R10', '강조 라벨 · 강조 카드 이름에 숫자 0', v4.filter((s) => /^(FEATURED\.(label|cardA11y)|V4W01\.featured\.(label|a11y))$/.test(s.key) && /\d/.test(s.text)));
  rule('T04', 'R11', 'v4 안내 글에 쓰지 않을 말 0(금지 · 위반 · 제재 · 불가 · 의심 · 처벌 · 경고 · 차단)', where(v4, /금지|위반|제재|불가|의심|처벌|경고|차단/));
  // D-197(법무 QPL 3-2): '보증보험'은 결혼중개업법 제8조 ② 연결 줄 · 약관 운영자 표의 법 낱말이라 뺀다(사람 · 만남을 보증한다는 말이 아님)
  rule('T04', 'R12', "보증 말 0(검증됨 · 보증 · 안전한 사람, 전체 · 법 낱말 '보증보험' 제외)", where(all, /검증됨|보증(?!보험)|안전한 (사람|분|회원)/));
  rule('T04', 'R13', '해요체(합니다체 끝맺음 0, 법무 생성 파일 제외)', where(plain, /(습니다|십시오|합니다|입니다)\.?$/));
  rule('T04', 'R14', 'v4 글에 기술 말 · 작업 표시 0', where(v4, /서버|오류 코드|error|null|undefined|NF\d|D-\d\d|B17/));
  const LIMITS = [
    [/^(FEATURED\.label|V4W01\.featured\.label)$/, 14],
    [/^(MEET_FEEDBACK\.(metChoices|outcomeChoices)\.\w+|V4W01\.meet\.(met|notYet|declined|good|ok|off))$/, 12],
    [/^(SAFE_SHARE\.entry|V4W01\.share\.entry)$/, 12],
    [/^(SAFE_SHARE\.fields\.\w+|V4W01\.share\.(whenLabel|placeLabel|memoLabel|partnerLabel))$/, 10],
    [/^CONTACT_HINT\.(publicField|privateField)$/, 35],
  ];
  rule('T04', 'R15', 'v4 자리별 글자 수 상한', v4.filter((s) => LIMITS.some(([re, max]) => re.test(s.key) && Array.from(s.text).length > max)));
  rule('T04', 'R16', "스크린리더 이름(…A11y 키)에 '버튼' 0(전체)", all.filter((s) => /a11y/i.test(last(s.key)) && /버튼/.test(s.text)));
  const cells = copyV4Cells(copyFile);
  if (cells === null) {
    notes.push('R17 카피.md 7장을 찾지 못해 v4 글 대조를 건너뜀(미확인)');
  } else {
    const lost = v4.filter((s) => s.text.split('{}').map((p) => p.trim()).filter((p) => p !== '').some((p) => !cells.includes(p)));
    rule('T04', 'R17', `v4 글 ${v4.length}줄이 카피.md 7장 '→ 개선안' 칸에 글자 그대로 있다`, lost);
  }
  if (temp.length) notes.push(`R17 · R8~R15 대조 미룸: F19 1단계 임시 글(키 이름이 그대로 보임) ${temp.length}줄 — F19 2단계에서 카피.md 7장 글로 바꾼다`);
  notes.push('R18 안심 공유 문장(조합 예 3개 · 500자 · R1 · R12)은 앱 단위 시험 T3-02(f19Wave01Parts)가 맡는다 — 문장 틀이 임시 키라 F19 2단계 뒤에 기대 문장을 카피.md 조합 예로 바꾼다');

  // ── K11: K13 문구 다듬기 묶음 중 잴 수 있는 것(법무 생성 파일 제외) ──
  const k1 = where(plain, /심사|검수|합격|불합격|판정/);
  rule('K11', 'K11-28', "시험 · 심사 느낌 낱말 0(심사 · 검수 · 합격 · 판정 → '확인')", k1);
  rule('K11', 'K11-43', '원인을 기술 말로 돌리지 않는다(서버 · 네트워크 · 에러 · 오류 코드 0)', where(plain, /서버|네트워크|에러|오류 코드/));
  rule('K11', 'K11-52', '공포 · 위협 말 0(불이익 · 큰일 · 영구 정지 · 법적 조치)', where(plain, /불이익|큰일|영구 정지|법적 조치/), ALLOW.K11);
  notes.push('K11-22 한 화면 한 일 · K11-23 권한 이유 먼저 · K11-53 다음 화면 예상 · 군더더기는 기계로 재지 못해 사람 검토(C① 문구 주인 · 디자인)');
  return { results, notes, counts: { all: all.length, v4: v4.length, temp: temp.length } };
}

// check-copy.mjs 가 부른다
export function runCopyRules({ check, note, appDir = APP_DIR }) {
  const { results, notes } = evaluateCopyRules({ contentDir: path.join(appDir, 'src', 'content'), copyFile: path.resolve(appDir, '..', '마케팅', '카피.md') });
  for (const r of results) check(r.group, r.title, r.ok, r.detail);
  for (const n of notes) note(n);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? path.resolve(process.argv[i + 1]) : undefined;
  };
  const out = evaluateCopyRules({ contentDir: arg('--content'), copyFile: arg('--copy') });
  if (process.argv.includes('--json')) console.log(JSON.stringify(out));
  else {
    for (const r of out.results) console.log(`[${r.ok ? '통과' : '실패'}] ${r.group}. ${r.title}${r.detail ? `\n       ${r.detail.split('\n').join('\n       ')}` : ''}`);
    for (const n of out.notes) console.log(`[참고] ${n}`);
    const failed = out.results.filter((r) => !r.ok).length;
    console.log(`\n글 규칙 점검: 통과 ${out.results.length - failed} · 실패 ${failed} (글 ${out.counts.all}줄 · v4 ${out.counts.v4}줄 · 임시 ${out.counts.temp}줄)`);
  }
  process.exit(out.results.some((r) => !r.ok) ? 1 : 0);
}
