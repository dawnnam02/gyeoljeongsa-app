// 법무 문서(동의문구 · 약관 · 처리방침)와 마케팅 카피에서 앱이 쓰는 글을 뽑는 함수 모음. 읽기 전용, 네트워크 없음.
//  · gen-legal-content.mjs 가 이 함수로 src/content/*.ts 를 만든다(글자를 손으로 옮기지 않는다)
//  · check-copy.mjs 가 같은 함수로 원본과 다시 대조한다
// 원본을 고치는 일은 하지 않는다. 글자는 한 글자도 바꾸지 않고, 마크다운 표시(** · `)만 걷어 낸다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { filterAppText, stripMarks } from './legal-markers.mjs';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROOT = path.resolve(APP_DIR, '..');

export const SOURCES = {
  consent: path.join(ROOT, '법무', '동의문구.md'),
  editions: path.join(ROOT, '법무', '판_관리.md'),
  terms: path.join(ROOT, '법무', '약관.md'),
  privacy: path.join(ROOT, '법무', '개인정보처리방침.md'),
  copy: path.join(ROOT, '마케팅', '카피.md'),
  screens: path.join(ROOT, '기획', '화면_요구사항.md'),
  policy: path.join(ROOT, '기획', '정책.md'),
  // R-A(D-199): 기획이 10-27 정책 · 화면_요구사항을 v5판(글 키 · 규칙 표)으로 새로 썼다. v4판의 N문구 · NK문구 · 표(토글 9 · 맞는 점 19 · R12 시간 꼴)는
  //  '그대로' 화면(02 · 04 임시 · 05 ~ 08)과 숨긴 v4 화면(09 · 11)의 글 원본이라 보관본을 함께 읽는다(readPlanDoc)
  screensV4: path.join(ROOT, '보관', '화면_요구사항_v4판.md'),
  policyV4: path.join(ROOT, '보관', '정책_v4판.md'),
};

export function readDoc(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

// 기획 문서 원본: v5판 + v4판 보관본(있으면). v5판이 먼저라 같은 머리가 있으면 v5판을 읽는다
export function readPlanDoc(kind) {
  const v5 = readDoc(SOURCES[kind]);
  const old = SOURCES[`${kind}V4`];
  return old && fs.existsSync(old) ? `${v5}\n\n<!-- 보관 v4판 -->\n${readDoc(old)}` : v5;
}

// 마크다운 표시만 걷는다: **굵게** · `코드`
export const inline = (text) => text.replace(/\*\*/g, '').replace(/`/g, '');

// 표의 한 줄 → 칸 배열. 앞뒤 | 를 떼고 칸마다 공백을 지운다.
export function cells(line) {
  const t = line.trim();
  return t
    .slice(t.startsWith('|') ? 1 : 0, t.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((c) => c.trim());
}

const isSeparatorRow = (line) => /^\|\s*:?-{2,}/.test(line.trim());

// ── 마크다운(쓰는 만큼만) → 화면 조각 ─────────────────────────────────
// 제목(# ~ ####) · 줄 전체가 **굵게**인 줄(조 · 소제목) · 목록(- · 1.) · 표(|) · 그 밖의 한 줄 = 한 문단
export function mdToBlocks(lines) {
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'h', level: Math.min(Math.max(heading[1].length, 2), 4), text: inline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (/^\*\*[^*].*\*\*$/.test(line.trim()) && !line.trim().slice(2, -2).includes('**')) {
      blocks.push({ type: 'h', level: 4, text: inline(line.trim()) });
      i += 1;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isSeparatorRow(lines[i])) rows.push(cells(lines[i]).map(inline));
        i += 1;
      }
      const [header, ...body] = rows;
      blocks.push({ type: 'table', header, rows: body });
      continue;
    }
    const bullet = /^(\s*)[-*] (.*)$/.exec(line);
    if (bullet) {
      blocks.push({ type: 'li', depth: Math.floor(bullet[1].length / 2), marker: '•', text: inline(bullet[2].trim()) });
      i += 1;
      continue;
    }
    const ordered = /^(\s*)(\d+\.) (.*)$/.exec(line);
    if (ordered) {
      blocks.push({ type: 'li', depth: Math.floor(ordered[1].length / 2), marker: ordered[2], text: inline(ordered[3].trim()) });
      i += 1;
      continue;
    }
    blocks.push({ type: 'p', text: inline(line.trim()) });
    i += 1;
  }
  return blocks;
}

// 약관 · 처리방침: 표식 구간 · 작업 표시를 먼저 걸러내고(legal-markers.mjs), 첫 줄(# 제목)은 시트 제목으로 대신하고, 나머지는 한 줄도 빼지 않고 싣는다("전체를 그대로", 동의문구 4-1).
// options: { version, history } — 약관 "판 · 시행일" 표시와 처리방침 변경 이력 표(판_관리.md)
export function parseLegalDoc(text, options = {}) {
  const filtered = filterAppText(text, options);
  const lines = filtered.text.split('\n');
  const first = lines.findIndex((l) => /^# /.test(l));
  if (first < 0) throw new Error('문서에 # 제목 줄이 없어요');
  return { title: inline(lines[first].slice(2).trim()), blocks: mdToBlocks(lines.slice(first + 1)), stats: filtered.stats, filteredText: filtered.text };
}

// ── 법무/동의문구.md ────────────────────────────────────────────────
const CODES = ['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6', 'CK7', 'CK8', 'CK9'];

function tick(lines, label) {
  for (const line of lines) {
    const m = new RegExp(`^- ${label}: \`(.*)\`$`).exec(line);
    if (m) return m[1];
  }
  return null;
}

function parseItem(code, body) {
  const label = tick(body, '체크 문구');
  const why = tick(body, '왜 필요한지');
  const note = tick(body, '덧붙이는 안내');
  if (!label || !why) throw new Error(`${code}: 체크 문구 · 왜 필요한지 줄을 찾지 못했어요`);

  const summaryAt = body.findIndex((l) => /^- 요약\(보기 ›\):$/.test(l));
  if (summaryAt < 0) throw new Error(`${code}: 요약(보기 ›) 줄을 찾지 못했어요`);
  const summary = [];
  for (let i = summaryAt + 1; i < body.length && /^ {2}- /.test(body[i]); i += 1) summary.push(inline(body[i].slice(4)));

  let declinedLabel = '동의하지 않으면';
  let declined = tick(body, '동의하지 않으면');
  if (declined === null) {
    declinedLabel = '확인하지 않으면';
    declined = tick(body, '확인하지 않으면');
  }
  if (declined === null) throw new Error(`${code}: 동의하지 않으면 줄을 찾지 못했어요`);

  // 전문: '**전문 …**' 줄 아래 인용(>) 덩어리. CK1 은 인용이 없고 약관 전체를 가리킨다.
  const fullAt = body.findIndex((l) => l.startsWith('**전문'));
  if (fullAt < 0) throw new Error(`${code}: 전문 줄을 찾지 못했어요`);
  const quote = [];
  for (let i = fullAt + 1; i < body.length; i += 1) {
    if (body[i].startsWith('>')) quote.push(body[i].replace(/^> ?/, ''));
    else if (quote.length > 0) break;
    else if (/^\*\*참고/.test(body[i])) break;
  }
  const fullText = quote.length > 0 ? mdToBlocks(quote) : code === 'CK1' ? 'terms' : null;
  if (fullText === null) throw new Error(`${code}: 전문을 찾지 못했어요`);

  return {
    code,
    required: label.startsWith('[필수]'),
    label,
    why,
    note,
    summary,
    declinedLabel,
    declined,
    fullText,
  };
}

// 동의문구는 구간을 걸러내지 않고 P1 ~ P7 만 적용한 글에서 필드를 뽑는다(필드만 뽑아서 표식 구간은 어차피 읽지 않는다).
export function parseConsentDoc(rawText) {
  const stripped = stripMarks(rawText);
  const text = stripped.text;
  const lines = text.split('\n');
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^### 4-\d\. (CK\d) /.exec(lines[i]);
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && !/^#{2,3} /.test(lines[end])) end += 1;
    items.push(parseItem(m[1], lines.slice(i + 1, end)));
  }
  if (items.map((x) => x.code).join() !== CODES.join()) throw new Error(`체크 칸이 ${CODES.join(' ')} 순서로 9개가 아니에요: ${items.map((x) => x.code).join(' ')}`);

  // 1장 표: 상단 행(필수 항목 모두 동의)과 칸마다 한 줄. 4장과 같은지 check-copy 가 따로 비교한다.
  const ch1 = lines.findIndex((l) => /^## 1\. /.test(l));
  const ch2 = lines.findIndex((l, i) => i > ch1 && /^## 2\. /.test(l));
  const table = lines
    .slice(ch1, ch2)
    .filter((l) => /^\| (상단|\d) \|/.test(l))
    .map(cells);
  const topRow = table.find((r) => r[0] === '상단');
  if (!topRow) throw new Error('1장 표에서 상단 행을 찾지 못했어요');
  const top = { label: topRow[3], why: topRow[4], note: topRow[5] === '—' ? null : topRow[5] };
  const tableRows = table
    .filter((r) => r[0] !== '상단')
    .map((r) => ({ code: r[1], required: r[2] === '필수', label: r[3], why: r[4], note: r[5] === '—' ? null : r[5] }));

  const subtitle = /제목 아래 부제를 한 줄 더한다\(신규\): "([^"]+)"/.exec(text)?.[1];
  const rule6 = lines.find((l) => /^6\. 링크 줄 "/.test(l)) ?? '';
  const quoted = [...rule6.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const error = /카피 03 오류 문구 그대로 "([^"]+)"/.exec(text)?.[1];

  const at5_1 = lines.findIndex((l) => /^### 5-1\./.test(l));
  const at5_2 = lines.findIndex((l) => /^### 5-2\./.test(l));
  const block = (from) => lines.slice(from + 1, lines.findIndex((l, i) => i > from && /^#{2,3} /.test(l)));
  const notice = { title: tick(block(at5_1), '제목'), body: tick(block(at5_1), '본문') };
  const signup = { text: tick(block(at5_2), '안내'), link: tick(block(at5_2), '링크') };
  const under19 = /만 19세 미만 안내는 카피 02 그대로: `([^`]+)`/.exec(text)?.[1];

  const missing = [
    ['부제', subtitle],
    ['링크 줄', quoted[0]],
    ['작은 글씨', quoted[1]],
    ['오류 문구', error],
    ['안내 상자 제목', notice.title],
    ['안내 상자 본문', notice.body],
    ['가입 안내', signup.text],
    ['가입 안내 링크', signup.link],
  ].filter(([, v]) => !v);
  if (missing.length > 0) throw new Error(`동의문구.md 에서 찾지 못한 글: ${missing.map(([k]) => k).join(', ')}`);

  return {
    top,
    items,
    tableRows,
    subtitle,
    links: { line: quoted[0], small: quoted[1] },
    error,
    notice,
    signup: { ...signup, under19 },
  };
}

// ── 동의문구 1-1 · 4-16: 03 밖에서 받는 선택 동의 CK11 ~ CK16 (L17A) ──────────
//  · 1-1 표의 번호 · 이름(안) → 12 동의 관리 줄 이름
//  · 4-11 ~ 4-16 절 → 4장 칸과 같은 모양(체크 문구 · 왜 · 덧붙임 · 요약 · 동의하지 않으면 · 전문) + 제목(시트 위, 없으면 null)
//    요약 끝의 '전문 보기 ›' 줄은 글이 아니라 버튼이라 요약에서 빼고 more 로 둔다
//  03 칸(CK1 ~ CK9 · CONSENT_ITEMS)과 지문 · 판 블록은 건드리지 않는다
export const LATER_CODES = ['CK11', 'CK12', 'CK13', 'CK14', 'CK15', 'CK16'];

export function parseLaterConsents(rawText) {
  const lines = stripMarks(rawText).text.split('\n');
  const at11 = lines.findIndex((l) => /^### 1-1\. /.test(l));
  if (at11 < 0) throw new Error('동의문구.md 1-1 절(CK11 ~ CK16)을 찾지 못했어요');
  const names = [];
  for (let i = at11 + 1; i < lines.length && !/^#{2,3} /.test(lines[i]); i += 1) {
    if (!/^\| CK1[1-6] \|/.test(lines[i])) continue;
    const r = cells(lines[i]);
    names.push({ code: r[0], name: r[2] });
  }
  if (names.map((x) => x.code).join() !== LATER_CODES.join()) throw new Error(`1-1 표가 ${LATER_CODES.join(' ')} 순서가 아니에요: ${names.map((x) => x.code).join(' ')}`);

  const items = LATER_CODES.map((code) => {
    const n = code.slice(2);
    const at = lines.findIndex((l) => new RegExp(`^### 4-${n}\\. ${code} `).test(l));
    if (at < 0) throw new Error(`동의문구.md 4-${n} 절(${code})을 찾지 못했어요`);
    let end = at + 1;
    while (end < lines.length && !/^#{2,3} /.test(lines[end])) end += 1;
    const body = lines.slice(at + 1, end);
    const item = parseItem(code, body);
    const more = item.summary.find((s) => /^전문 보기/.test(s));
    if (!more) throw new Error(`${code}: 요약 끝 전문 보기 줄을 찾지 못했어요`);
    return { ...item, title: tick(body, '제목\\(시트 위\\)'), summary: item.summary.filter((s) => s !== more), more };
  });
  return { names, items };
}

// ── 마케팅/카피.md 03 ───────────────────────────────────────────────
// 03-1 표(체크 칸 10줄)와 03-2 요약(칸마다 글머리)을 읽는다. 동의문구.md 와 같은지 비교하는 데 쓴다.
export function parseCopyConsent(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^### 03 /.test(l));
  const end = lines.findIndex((l, i) => i > start && /^### 04 /.test(l));
  const body = lines.slice(start, end);

  const checkRows = body
    .filter((l) => /^\| (맨 위|\d) \|/.test(l))
    .map(cells)
    .map((r) => ({ order: r[0], code: r[1], label: r[2], why: r[3], note: r[4] === '—' ? null : r[4] }));

  const summaries = {};
  for (let i = 0; i < body.length; i += 1) {
    const m = /^\*\*(CK\d) /.exec(body[i]);
    if (!m) continue;
    const list = [];
    for (let j = i + 1; j < body.length && !/^\*\*CK\d /.test(body[j]); j += 1) {
      if (/^- /.test(body[j])) list.push(inline(body[j].slice(2)));
      else if (/^>|^#{2,4} /.test(body[j])) break;
    }
    summaries[m[1]] = list;
  }

  // 표의 한 줄(위치 · 현재 목업 · 개선안)에서 개선안 칸. 개선안이 '유지'이면 현재 목업 문구가 그대로 쓰이는 글이다.
  const answer = (row) => (row[2] === '유지' ? inline(row[1]).replace(/^\[[^\]]*\] /, '') : inline(row[2]));
  const pick = (kind, labelStart) => {
    const row = body.map(cells).find((r) => r[0] === kind && (r[1] ?? '').startsWith(labelStart));
    return row ? answer(row) : null;
  };
  return {
    checkRows,
    summaries,
    subtitle: pick('부제', '[제목 아래]'),
    noticeTitle: pick('안내', '[안내 상자 · CK3와 CK4 사이] 제목'),
    noticeBody: pick('안내', '[안내 상자] 본문'),
    linkLine: pick('안내', '[칸 아래 링크 줄]'),
    small: pick('안내', '[링크 줄 아래 작은 글씨]'),
    more: pick('버튼', '[칸 오른쪽]'),
    fullText: pick('버튼', '[요약 아래]'),
    submit: (() => {
      const row = body.map(cells).find((r) => r[0] === '버튼' && r[1] === '동의하고 계속');
      return row ? answer(row) : null;
    })(),
    error: pick('오류', '[필수 항목 빠짐]'),
    title: pick('제목', '[본문] 시작하려면'),
  };
}

// 03 동의 화면의 글이 바뀌었는지 알려 주는 지문(칸마다). 문구 버전을 올려야 하는 때를 찾는 데 쓴다.
export function contentFingerprint(value) {
  return JSON.stringify(value);
}
