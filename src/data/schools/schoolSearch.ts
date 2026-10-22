// F20 학교 검색 자동완성 — M14 기준 구현(데이터/학교/m14_autocomplete.py)을 그대로 옮겼다. 규칙 원본: 데이터/M14_학교목록.md 3장.
//  1. 정규화: NFC → 소문자 → 한글 · 영문 · 숫자 · 자모만(띄어쓰기 · 괄호 · 가운뎃점 무시)
//  2. 찾는 글자: 이름 · 정식이름 · 이름형 = 이름(0) / 옛 이름 · 줄임말 · 다른 이름 · 영문 = 별칭(1)
//  3. 단계: 0 이름 정확 → 1 별칭 정확 → 2 이름 앞부분 → 3 별칭 앞부분 → 4 이름 중간 → 5 별칭 중간 → 6 · 7 오타 1글자
//     앞부분은 자모 단위('연세대하' · '연섿'), 초성은 자음 한 글자를 그 자리 글자의 초성과 비교(ㅅㅇㄷ · 서ㅇㄷ)
//  4. 같은 단계 안: 학교 종류(rank) → 입력과 같은 길이 → 줄임말이 널리 쓰이는 학교(pop) → 이름 길이 → 가나다. 학교 수준은 순서에 쓰지 않는다
//  5. 옛 이름 · 통합 전 학교는 지금 이름(now)을 함께 돌려준다
// 시험: src/__tests__/surveyV2Schools.test.ts 가 파이썬 기준 결과(schoolSearch.golden.json)와 같은지 본다.
// 학교 목록은 처음 검색할 때 한 번 읽는다(앱 시작을 무겁게 하지 않게). 목록 · 검색어는 기기 밖으로 보내지 않는다.

export type SchoolCourse = 'U' | 'C' | 'G' | 'H' | 'X'; // 대학교(해외 · 학위과정 포함) · 전문대학 · 대학원 · 고졸 보기 · 그 밖
export type SchoolRow = {
  readonly key: string;
  readonly name: string;
  readonly course: SchoolCourse;
  readonly kind: string; // 대학알리미 구분(대학교 · 전문대학 · 일반대학원 · 해외 대학 …) — 결과 둘째 줄
  readonly status: number; // 0 운영 · 1 이름바뀜 · 2 통합 · 3 폐교·통합 · 4 확인 필요
  readonly now: string; // 지금 이름(같으면 '')
  readonly pop: number;
  readonly rank: number;
};
export type MatchVia = 'name' | 'old' | 'alias' | 'en';
export type SchoolHit = {
  readonly row: SchoolRow;
  readonly step: number; // 0~7(M14 3장 단계)
  readonly via: MatchVia;
  readonly matched: string; // 맞은 글자(원래 모양)
  readonly cho: boolean; // 초성으로 찾음
};
export type SchoolIndexDoc = { version: string; source_sha256: string; fields: string[]; rows: unknown[][] };

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅗㅏ', 'ㅗㅐ', 'ㅗㅣ', 'ㅛ', 'ㅜ', 'ㅜㅓ', 'ㅜㅔ', 'ㅜㅣ', 'ㅠ', 'ㅡ', 'ㅡㅣ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const COMPAT: Readonly<Record<string, string>> = {
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
  ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
};

const isSyllable = (ch: string) => ch >= '가' && ch <= '힣';
const isCho = (ch: string) => ch.length === 1 && CHO.includes(ch);

export function normalize(text: string): string {
  const s = (text ?? '').normalize('NFC').toLowerCase();
  let out = '';
  for (const ch of s) if (isSyllable(ch) || (ch >= 'ㄱ' && ch <= 'ㅣ') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) out += ch;
  return out;
}

export function jamo(text: string): string {
  let out = '';
  for (const ch of text) {
    if (isSyllable(ch)) {
      const i = ch.charCodeAt(0) - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
    } else out += COMPAT[ch] ?? ch;
  }
  return out;
}

const choOf = (ch: string) => (isSyllable(ch) ? CHO[Math.floor((ch.charCodeAt(0) - 0xac00) / 588)] : ch);

function charOk(qc: string, cc: string, last: boolean): boolean {
  if (qc === cc) return true;
  if (isCho(qc)) return choOf(cc) === qc; // 초성 하나
  if (last && isSyllable(qc) && isSyllable(cc)) return jamo(cc).startsWith(jamo(qc)); // 마지막 글자는 쓰는 중일 수 있다
  return false;
}

// 한글 · 영문 · 숫자만 남긴 글이라 모두 한 글자 = 한 칸(BMP)이다
function patternAt(q: string, c: string, start: number): boolean {
  if (start + q.length > c.length) return false;
  for (let i = 0; i < q.length; i += 1) if (!charOk(q[i], c[start + i], i === q.length - 1)) return false;
  return true;
}

// 두 글의 거리가 1 이하(바꿈 · 빠짐 · 더함 · 이웃 뒤바뀜)
function osa1(a0: string, b0: string): boolean {
  if (a0 === b0) return true;
  let a = a0;
  let b = b0;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) return true;
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  if (a.length > b.length) [a, b] = [b, a];
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return a.slice(i) === b.slice(i + 1);
}

type Entry = { row: number; n: string; typ: 0 | 1; raw: string; via: MatchVia; nj: string };

export type SchoolIndex = {
  readonly version: string;
  readonly sourceSha256: string;
  readonly rows: readonly SchoolRow[];
  byKey(key: string): SchoolRow | null;
  search(query: string, options?: { limit?: number; courses?: readonly SchoolCourse[]; includeClosed?: boolean }): SchoolHit[];
};

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

export function buildSchoolIndex(doc: SchoolIndexDoc): SchoolIndex {
  const f = Object.fromEntries(doc.fields.map((name, i) => [name, i])) as Record<string, number>;
  const rows: SchoolRow[] = [];
  const entries: Entry[] = [];
  doc.rows.forEach((r, i) => {
    const row: SchoolRow = {
      key: String(r[f.key]),
      name: String(r[f.name]),
      course: String(r[f.course]) as SchoolCourse,
      kind: String(r[f.kind]),
      status: Number(r[f.status]),
      now: String(r[f.now] ?? ''),
      pop: Number(r[f.pop]),
      rank: Number(r[f.rank]),
    };
    rows.push(row);
    const seen = new Set<string>();
    const groups: [0 | 1, MatchVia, string[]][] = [
      [0, 'name', [row.name, ...strArr(r[f.names])]],
      [1, 'old', strArr(r[f.old])],
      [1, 'alias', strArr(r[f.alias])],
      [1, 'en', strArr(r[f.en])],
    ];
    for (const [typ, via, items] of groups) {
      for (const s of items) {
        const n = normalize(s);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        entries.push({ row: i, n, typ, raw: s.trim(), via, nj: jamo(n) });
      }
    }
  });
  const keyMap = new Map(rows.map((r) => [r.key, r]));

  function search(query: string, options: { limit?: number; courses?: readonly SchoolCourse[]; includeClosed?: boolean } = {}): SchoolHit[] {
    const limit = options.limit ?? 10;
    const q = normalize(query);
    if (!q) return [];
    const qj = jamo(q);
    const hasCho = [...q].some(isCho);
    const asciiQ = /^[\x00-\x7f]*$/.test(q);
    const best = new Map<number, { step: number; e: Entry }>();
    const put = (i: number, step: number, e: Entry) => {
      const cur = best.get(i);
      if (!cur || step < cur.step) best.set(i, { step, e });
    };
    for (const e of entries) {
      if (e.n === q) put(e.row, 0 + e.typ, e);
      else if (e.nj.startsWith(qj) || (hasCho && patternAt(q, e.n, 0))) put(e.row, 2 + e.typ, e);
      else if (q.length >= 2 && (e.n.includes(q) || (hasCho && middleCho(q, e.n)))) put(e.row, 4 + e.typ, e);
    }
    if (best.size < limit && !hasCho && q.length >= (asciiQ ? 4 : 3)) {
      const q0 = q[0];
      const q1 = q[1];
      for (const e of entries) {
        if (best.has(e.row) || !(e.n.slice(0, 2).includes(q0) || e.n.slice(0, 3).includes(q1))) continue;
        let hit = osa1(q, e.n);
        if (!hit) {
          for (const d of [-1, 0, 1]) {
            const len = q.length + d;
            if (len > 0 && len <= e.n.length && osa1(q, e.n.slice(0, len))) {
              hit = true;
              break;
            }
          }
        }
        if (hit) put(e.row, 6 + e.typ, e);
      }
    }
    type Cand = { step: number; rank: number; complete: number; pop: number; len: number; name: string; i: number; e: Entry };
    const out: Cand[] = [];
    for (const [i, { step, e }] of best) {
      const r = rows[i];
      if (options.courses && !options.courses.includes(r.course)) continue;
      if (options.includeClosed === false && (r.status === 2 || r.status === 3)) continue;
      out.push({ step, rank: r.rank, complete: e.n.length === q.length ? 0 : 1, pop: r.pop ? 0 : 1, len: [...r.name].length, name: r.name, i, e });
    }
    out.sort((a, b) => cmp(a.step, b.step) || cmp(a.rank, b.rank) || cmp(a.complete, b.complete) || cmp(a.pop, b.pop) || cmp(a.len, b.len) || cmp(a.name, b.name));
    return out.slice(0, limit).map((c) => ({ row: rows[c.i], step: c.step, via: c.e.via, matched: c.e.raw, cho: hasCho && c.step >= 2 && c.step <= 5 }));
  }

  return {
    version: doc.version,
    sourceSha256: doc.source_sha256,
    rows,
    byKey: (key) => keyMap.get(key) ?? null,
    search,
  };
}

// 이름 중간의 초성 일치(1번째 자리부터)
function middleCho(q: string, n: string): boolean {
  for (let s = 1; s <= n.length - q.length; s += 1) if (patternAt(q, n, s)) return true;
  return false;
}

let shared: SchoolIndex | null = null;

// 앱 내장 목록(src/data/schools/schoolIndex.json, scripts/gen-schools.mjs 가 M14 판에서 만든다). 처음 부를 때 읽는다
export function schoolIndex(): SchoolIndex {
  if (!shared) {
    const doc = require('./schoolIndex.json') as SchoolIndexDoc;
    shared = buildSchoolIndex(doc);
  }
  return shared;
}
