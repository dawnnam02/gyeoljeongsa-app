// IF2-F(D-223): 기내 서비스 · 연애 기능 1.0 화면 글의 앱 사본을 만든다. 읽기는 마케팅 문서, 쓰기는 src/features/inflight/if2CopyData.ts 하나.
//  원본 차례(팀장 지시 10-28): ① 마케팅/카피.md 21장(마케팅이 초안을 합치는 중 — 팀장이 '21장 끝'을 알리면 그 장이 원본)
//                            ② 21장이 아직 없으면 마케팅/IF2_카피초안.md 1 ~ 18장(초안 키)
//  · 표 줄 가운데 첫 칸에 IF2 접두어 키(`HOME.me.title` 꼴)가 있는 줄만 읽는다. 둘째 칸이 '('로 시작하면 끌어 쓰는 자리(새 글 0)라 뺀다
//  · 스토어 줄(STORE) · 기존 키 바꿀 글 제안(PROFILE.firstBody — 법무 원본 gen:legal 로 이미 앱에 있음)은 뺀다
//  · 원본에 아직 없는 '기획 새 키'(기획/화면_요구사항.md 6장 '새로 요청하는 키' 가안)는 PENDING 으로 채운다 — 원본에 같은 키가 생기면 원본이 앞선다
//  · 글자는 한 글자도 바꾸지 않는다(마크다운 ** · ` 만 걷음). {…} 자리는 앱이 채운다(if2Text.tx)
// 사용: node scripts/gen-if2-copy.mjs          → 파일을 다시 쓴다
//       node scripts/gen-if2-copy.mjs --check  → 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(appDir, '..');
export const IF2_COPY_FILE = path.join(appDir, 'src', 'features', 'inflight', 'if2CopyData.ts');
const COPY_DOC = process.env.CHECK_COPY_DOC ?? path.join(root, '마케팅', '카피.md');
const DRAFT_DOC = path.join(root, '마케팅', 'IF2_카피초안.md');

export const IF2_PREFIXES = ['FUN', 'HOME', 'MAGAZINE', 'WEEK_CARD', 'TYPE_CARD', 'PREVIEW_ME', 'HELLO_POSTCARD', 'PRE_ANSWER', 'PAIR_CARD', 'SAME_POINT', 'FIRST_HINT', 'TOPICS', 'OPEN_TOGETHER', 'ABOUT_ME', 'MUST_TALK', 'MEET_PREP', 'MONEY_SAFETY', 'FAREWELL', 'MEET_MEMO', 'PROFILE', 'INFO'];
const SKIP = new Set(['PROFILE.firstBody']);

// 기획 새 키(화면_요구사항 6장 '새로 요청하는 키' · 정책 PF-22 · PF-31 · PF-34 · PF-49 가안). 원본(21장 · 초안)에 같은 키가 생기면 쓰지 않는다
export const PENDING = {
  'MAGAZINE.page.skyGrain': ['하늘과 결', '기획 PF-22 · 화면 6장'],
  'TYPE_CARD.quiz.picksNote': ['고른 짐은 엽서 그림에만 들어가요. 타입은 성향 정리 결과로 정해져요.', '기획 PF-31 · 화면 6장'],
  'PREVIEW_ME.ck17Note': ['짝과 둘 다 동의하면 궁합 카드에 별자리 · 사주 이야기가 보여요.', '기획 PF-34(법무 안)'],
  'PREVIEW_ME.hobbyNote': ['짝과 같은 취미가 있으면 그 취미 이름이 궁합 카드에 보여요.', '기획 PF-34(기획 제안)'],
  'PAIR_CARD.hobbyGroup.move': ['몸을 움직이는 일', '기획 PF-49 · 화면 6장'],
  'PAIR_CARD.hobbyGroup.out': ['밖에서 즐기는 일', '기획 PF-49 · 화면 6장'],
  'PAIR_CARD.hobbyGroup.home': ['집에서 즐기는 일', '기획 PF-49 · 화면 6장'],
  'PAIR_CARD.talkLink': ['꼭 나눌 이야기 보기', '화면 6장'],
};

const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null);
const cellsOf = (line) => {
  const t = line.trim();
  return t.slice(1, t.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
};
const keyRe = new RegExp('`((?:' + IF2_PREFIXES.join('|') + ')\\.[A-Za-z0-9_.\\[\\]]+)`');

// 표 줄 → [키, 글] (원본 글자 그대로, ** · ` 만 걷음)
export function rowsOf(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const c = cellsOf(line);
    if (c.length < 2) continue;
    const m = keyRe.exec(c[0]);
    if (!m) continue;
    const key = m[1];
    const t = c[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
    if (SKIP.has(key) || t.startsWith('(')) continue;
    out.push([key, t]);
  }
  return out;
}

// 21장(마케팅이 합친 장): '## 21. ' 머리부터 다음 '## ' 머리 앞까지. IF2 키 줄이 하나라도 있으면 원본
export function chapter21(text) {
  if (!text) return null;
  const from = text.search(/^## 21\. /m);
  if (from < 0) return null;
  const rest = text.slice(from + 3);
  const end = rest.search(/^## /m);
  const sec = end >= 0 ? text.slice(from, from + 3 + end) : text.slice(from);
  return rowsOf(sec).length > 0 ? sec : null;
}

// 초안 1 ~ 18장(19장 스토어 · 20장 점검 · 21장 키 목록 · 22장 넘김은 뺀다)
export function draftBody(text) {
  const from = text.search(/^## 1\. /m);
  const to = text.search(/^## 19\. /m);
  return text.slice(from >= 0 ? from : 0, to >= 0 ? to : undefined);
}

export function buildIf2Copy() {
  const copy = read(COPY_DOC);
  const sec21 = chapter21(copy);
  const source = sec21 ? '21' : 'draft';
  const draft = sec21 ? null : read(DRAFT_DOC);
  if (!sec21 && !draft) throw new Error('카피.md 21장도 IF2_카피초안.md 도 없어요');
  const rows = rowsOf(sec21 ?? draftBody(draft));
  const map = new Map();
  const dup = [];
  for (const [k, t] of rows) {
    if (map.has(k) && map.get(k) !== t) dup.push(k);
    map.set(k, t);
  }
  const pending = [];
  for (const [k, [t]] of Object.entries(PENDING)) {
    if (!map.has(k)) {
      map.set(k, t);
      pending.push(k);
    }
  }
  return { source, map, pending, dup };
}

export function renderIf2Copy({ source, map, pending }) {
  const lines = [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-if2-copy.mjs (IF2-F · D-223)',
    source === '21'
      ? '// 원본: 마케팅/카피.md 21장(기내 서비스 · 연애 기능 1.0). 기획 새 키 가안은 21장에 없을 때만(IF2_PENDING_KEYS)'
      : '// 원본: 마케팅/IF2_카피초안.md 1 ~ 18장(초안 키 — 카피.md 21장이 들어오면 21장이 원본). 기획 새 키 가안은 IF2_PENDING_KEYS',
    '// {…} 자리는 앱이 채운다(features/inflight/if2Text.ts tx). 숨김 · 조건부 키(기획 접두어 표 넷째 칸)도 글은 여기 두고 화면이 그리지 않는다',
    '',
    `export const IF2_COPY_SOURCE = ${JSON.stringify(source)} as const;`,
    '',
    'export const IF2_COPY = {',
    ...[...map.entries()].map(([k, t]) => `  ${JSON.stringify(k)}: ${JSON.stringify(t)},`),
    '} as const;',
    '',
    `export const IF2_PENDING_KEYS: readonly string[] = ${JSON.stringify(pending)};`,
    '',
  ];
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const built = buildIf2Copy();
  const text = renderIf2Copy(built);
  if (built.dup.length) console.log(`[참고] 같은 키가 다른 글로 두 번: ${built.dup.join(', ')} — 뒤 줄을 썼어요`);
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(IF2_COPY_FILE) ? fs.readFileSync(IF2_COPY_FILE, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== text) {
      console.log(`[실패] ${path.relative(appDir, IF2_COPY_FILE)} 가 원본(${built.source === '21' ? '카피.md 21장' : 'IF2_카피초안.md'})과 다름 → node scripts/gen-if2-copy.mjs`);
      process.exit(1);
    }
    console.log(`[통과] IF2 글 ${built.map.size}개 = ${built.source === '21' ? '카피.md 21장' : 'IF2_카피초안.md'}(가안 ${built.pending.length})`);
  } else {
    fs.mkdirSync(path.dirname(IF2_COPY_FILE), { recursive: true });
    fs.writeFileSync(IF2_COPY_FILE, text);
    console.log(`IF2 글 ${built.map.size}개 → ${path.relative(appDir, IF2_COPY_FILE)} (원본 ${built.source} · 가안 ${built.pending.length})`);
  }
}
