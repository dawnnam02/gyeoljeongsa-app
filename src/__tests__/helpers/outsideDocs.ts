// 저장소 밖 문서 도우미(GH1). 앱 저장소(app/)만 받은 곳 — 동업자 복제본 · CI — 에는 옆 폴더(법무 · 기획 · 마케팅 · 디자인 · 데이터 · ai · backend)가 없다.
//  그 문서를 읽는 검사만 건너뛰고(이유 한 줄 출력), 문서가 있는 팀 컴퓨터에서는 지금처럼 모두 돈다.
//  쓰는 법: describeOutside(['기획/설문_v2_문항표.csv'])('이름', () => { ... }) · testOutside(['마케팅/카피.md'])('이름', () => { ... })
//  경로는 작업 폴더(app 의 부모) 기준, '/' 로 적는다.
import fs from 'node:fs';
import path from 'node:path';

/** 앱 저장소 맨 위(package.json 이 있는 곳). 폴더 이름이 app 이 아니어도(복제본 gyeoljeongsa-app) 맞다 */
export const APP_DIR = path.resolve(__dirname, '..', '..', '..');
/** 앱 저장소의 부모 = 팀 작업 폴더(결정사/) */
export const WORKSPACE = path.resolve(APP_DIR, '..');

/** 법무 게시본 생성(scripts/lib/legal-source.mjs · legal-markers.mjs)이 읽는 문서 */
export const LEGAL_DOCS = ['법무/동의문구.md', '법무/판_관리.md', '법무/약관.md', '법무/개인정보처리방침.md', '마케팅/카피.md', '기획/화면_요구사항.md', '기획/정책.md'] as const;
/** 글 점검(scripts/check-copy.mjs)이 읽는 문서 = 법무 게시본 문서 + 설문 문항표 + AI 규칙 */
export const CHECK_COPY_DOCS = [...LEGAL_DOCS, '기획/설문_문항표.csv', 'backend/functions/ai-profile/rules.ts'] as const;

/** 작업 폴더 기준 경로 → 절대 경로 */
export const outsidePath = (rel: string): string => path.join(WORKSPACE, ...rel.split('/'));

/** 없는 문서 목록(모두 있으면 빈 배열) */
export const missingOutside = (rels: readonly string[]): string[] => rels.filter((rel) => !fs.existsSync(outsidePath(rel)));

/** 모두 있으면 true */
export const hasOutside = (...rels: string[]): boolean => missingOutside(rels).length === 0;

const told = new Set<string>();
function tell(missing: string[]): void {
  const line = `[건너뜀] 저장소 밖 문서 없음: ${missing.join(' · ')} — 이 문서를 읽는 검사만 건너뜁니다(팀 작업 폴더에서는 돕니다)`;
  if (told.has(line)) return;
  told.add(line);
  process.stdout.write(`${line}\n`);
}

/** 문서가 모두 있으면 describe, 하나라도 없으면 describe.skip(이유 한 줄) */
export function describeOutside(rels: readonly string[]): jest.Describe {
  const missing = missingOutside(rels);
  if (missing.length === 0) return describe;
  tell(missing);
  return describe.skip;
}

/** 문서가 모두 있으면 test, 하나라도 없으면 test.skip(이유 한 줄) */
export function testOutside(rels: readonly string[]): jest.It {
  const missing = missingOutside(rels);
  if (missing.length === 0) return test;
  tell(missing);
  return test.skip;
}

/** 시험 하나 안에서 문서가 필요한 마지막 확인만 따로 돌린다: 있으면 fn 실행, 없으면 이유 한 줄 */
export function whenOutside(rels: readonly string[], fn: () => void): void {
  const missing = missingOutside(rels);
  if (missing.length === 0) fn();
  else tell(missing);
}

/** 문서를 글로 읽는다(기본: 줄바꿈 \n 로 맞춤, keepCrlf 면 그대로). 문서가 없을 때는 빈 글 — 그 검사는 describeOutside/testOutside 로 이미 건너뛴다.
 *  describe 본문(모으는 단계)에서 읽어도 터지지 않게 하려는 것이다(describe.skip 도 본문은 실행된다) */
// R-A(D-199): 기획 정책 · 화면_요구사항은 10-27 v5판(글 키 · 규칙)으로 새로 썼다. v4판의 N문구 · NK문구 · 표는 '그대로' 화면 · 숨긴 v4 화면 글의
//  원본이라 보관본(보관/정책_v4판.md · 화면_요구사항_v4판.md)을 뒤에 붙여 읽는다(scripts/lib/legal-source.mjs readPlanDoc 와 같은 규칙)
const PLAN_V4: Readonly<Record<string, string>> = { '기획/화면_요구사항.md': '보관/화면_요구사항_v4판.md', '기획/정책.md': '보관/정책_v4판.md' };

// F25 안 '나'(팀장 10-27): 카피.md '## 15. 폐지 기록장' 줄을 원래 자리(같은 이름 소제목) 표 끝으로 되돌려 읽는다 — 마케팅이 v4 줄을 15장으로 옮겨도
//  숨김 v4 화면 글 대조가 깨지지 않게. 같은 규칙: scripts/lib/legal-source.mjs restoreArchivedCopy
export function restoreArchivedCopy(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const s15 = lines.findIndex((l) => /^## 15\. /.test(l));
  if (s15 < 0) return lines.join('\n');
  let e15 = lines.findIndex((l, i) => i > s15 && /^## \d/.test(l));
  if (e15 < 0) e15 = lines.length;
  const plain = (x: string) => x.replace(/\*\*|`/g, '').trim();
  const isHead = (l: string) => /^#{2,6} /.test(l);
  const body = [...lines.slice(0, s15), ...lines.slice(e15)];
  const extra = new Map<number, string[]>();
  for (const l of lines.slice(s15, e15)) {
    if (!/^\|\s*폐지\(D-/.test(l)) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 3) continue;
    const h = body.findIndex((x) => isHead(x) && plain(x.replace(/^#+\s+/, '')) === plain(c[1]));
    if (h < 0) continue;
    let end = body.findIndex((x, j) => j > h && isHead(x));
    if (end < 0) end = body.length;
    let after = end - 1;
    for (let j = h + 1; j < end; j += 1) if (body[j].startsWith('|')) after = j;
    extra.set(after, [...(extra.get(after) ?? []), `| ${c.slice(2).join(' | ').split(' ¦ ').join(' | ')} |`]);
  }
  return body.flatMap((l, i) => [l, ...(extra.get(i) ?? [])]).join('\n');
}

export function readOutside(rel: string, opts: { keepCrlf?: boolean } = {}): string {
  const file = rel === '마케팅/카피.md' && process.env.CHECK_COPY_DOC ? process.env.CHECK_COPY_DOC : outsidePath(rel); // CHECK_COPY_DOC: 다른 판으로 대조해 볼 때만
  if (!fs.existsSync(file)) return '';
  let text = fs.readFileSync(file, 'utf8');
  if (rel === '마케팅/카피.md') text = restoreArchivedCopy(text); // 줄바꿈은 LF 로 맞춰진다
  const old = PLAN_V4[rel] ? outsidePath(PLAN_V4[rel]) : null;
  if (old && fs.existsSync(old)) text = `${text}\n\n<!-- 보관 v4판 -->\n${fs.readFileSync(old, 'utf8')}`;
  return opts.keepCrlf ? text : text.replace(/\r\n/g, '\n');
}
