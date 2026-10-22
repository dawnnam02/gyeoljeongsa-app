// 법무 문서의 앱 게시 표식(<!-- app:… -->)과 본문 안 작업 표시를 걸러내는 규칙 + 판 읽기. 읽기 전용, 네트워크 없음.
// 원본 규칙: 법무/앱_게시본_규칙.md · 법무/L4_생성규칙_요청.md · 법무/판_관리.md  (세부청사진 F10)
// 글자는 바꾸지 않는다. 걸러낼 줄 · 표시만 지운다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HEAD = /^(#{1,6}) /;

// 공개 전에 채울 값: 법무/판_관리.md 7장 표의 "변수" 칸이 원본이다(P5 는 이 값들을 지우지 않는다). 개수는 표의 행 수에서 센다(박지 않는다).
// 표에 "값" 칸이 있고 채워져 있으면 그 값으로 게시 글의 {변수}를 바꾼다. 비어 있으면(또는 - · —) 변수를 그대로 둔다 — --release 는 변수가 남으면 실패한다.
export function readFillInTable(text) {
  const lines = text.split('\u000a').map((l) => l.split('\u000d').join(''));
  const at = lines.findIndex((l) => /^## 7\. 공개 전에 채울 값/.test(l));
  if (at < 0) throw new Error('판_관리.md 에서 "## 7. 공개 전에 채울 값" 을 찾지 못했어요');
  const rows = [];
  let valueCol = -1;
  for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const cols = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
    if (cols[1] === '변수') {
      valueCol = cols.indexOf('값');
      continue;
    }
    const m = /^`\{([^}]+)\}`$/.exec(cols[1] ?? '');
    if (!/^\d+$/.test(cols[0] ?? '') || !m) continue;
    let value = valueCol >= 0 ? (cols[valueCol] ?? '').replace(/^`|`$/g, '').trim() : '';
    if (value === '-' || value === '—' || value === '–') value = '';
    rows.push({ name: m[1], value });
  }
  if (rows.length === 0) throw new Error('판_관리.md 7장에서 공개 전에 채울 값 행을 찾지 못했어요');
  return rows;
}

export function readFillInValues(text) {
  return readFillInTable(text).map((r) => r.name);
}

const EDITIONS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '법무', '판_관리.md');
const FILL_IN_TABLE = readFillInTable(fs.readFileSync(EDITIONS_FILE, 'utf8'));
export const FILL_IN_VALUES = FILL_IN_TABLE.map((r) => r.name);
export const FILL_IN_SUBSTITUTIONS = new Map(FILL_IN_TABLE.filter((r) => r.value !== '').map((r) => [`{${r.name}}`, r.value]));

// 값이 채워진 변수만 바꾼다(없으면 글 그대로)
export function substituteFillIns(text, substitutions = FILL_IN_SUBSTITUTIONS) {
  let out = text;
  for (const [token, value] of substitutions) out = out.split(token).join(value);
  return out;
}

// 본문 안 표시를 지우는 정규식 P1 ~ P7 (적용 순서 그대로: P4b 가 P4a 보다 먼저면 괄호가 남는다)
export const STRIP = [
  ['P1', '변호사 확인', /[ \t]*`?\[변호사 확인\]`?(?:[ \t]*\((?:[^()\n]|\([^()\n]*\))*\))?/g],
  ['P2', '법무 제안', /[ \t]*\[법무 제안\]/g],
  ['P3', '가정 표시(괄호)', /[ \t]*\(가정 D-2[23](?:[^()\n]|\([^()\n]*\))*\)/g],
  ['P3b', '가정 표시(괄호 안 끝)', /\.[ \t]*가정 D-2[23][^()\n]*(?=\))/g],
  ['P4a', '결정 대기(괄호)', /[ \t]*\(결정 대기[^()\n]*\)/g],
  ['P4b', '결정 대기(문장 안)', /[ \t]*결정 대기[ ]?\(?D-\d+(?:[,·][ ]?D-\d+)*\)?\.?/g],
  ['P5', '작성 메모 중괄호', new RegExp('[ \t]*`\{(?!(?:' + FILL_IN_VALUES.join('|') + ')\})[^}\n]*\}`', 'g')],
  ['P6', '제목의 앞 네 줄', /[ \t]*\(앞 네 줄:[^()\n]*\)/g],
  ['P7', '파일 경로 괄호', /[ \t]*\(`[^`\n]*\.md`[^()\n]*\)/g],
];

// P1 ~ P7 과 끝손질(줄 끝 공백 · 겹친 공백 · 빈 줄 3개 이상)을 적용한다. 지운 표시 수도 센다.
export function stripMarks(text) {
  let removed = 0;
  let s = text;
  for (const [, , re] of STRIP) {
    s = s.replace(re, () => {
      removed += 1;
      return '';
    });
  }
  const cleaned = s
    .split('\n')
    .map((x) => x.replace(/[ \t]+$/, '').replace(/(\S)[ \t]{2,}(?=\S)/g, '$1 '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return { text: cleaned, removed };
}

// 표식 처리 → P1 ~ P7. { text, stats } 를 돌려준다. 짝이 안 맞는 표식은 오류.
export function filterAppText(text, { version = null, history = null } = {}) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const stats = { skipBlocks: 0, skipSections: 0, skipLines: 0, versionRows: 0, historyTables: 0, removedMarks: 0 };
  let skip = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const t = l.trim();
    if (t === '<!-- app:skip -->') {
      if (skip) throw new Error(`app:skip 이 중첩됐어요: ${i + 1}행 (앞 skip ${skip}행)`);
      skip = i + 1;
      stats.skipBlocks += 1;
      continue;
    }
    if (t === '<!-- /app:skip -->') {
      if (!skip) throw new Error(`짝 없는 /app:skip: ${i + 1}행`);
      skip = 0;
      continue;
    }
    if (skip) continue;
    if (t === '<!-- app:skip-section -->') {
      const m = HEAD.exec(lines[i + 1] ?? '');
      if (!m) throw new Error(`app:skip-section 다음 줄이 제목이 아니에요: ${i + 1}행`);
      stats.skipSections += 1;
      let j = i + 2;
      while (j < lines.length) {
        const n = HEAD.exec(lines[j]);
        if (n && n[1].length <= m[1].length) break;
        j += 1;
      }
      // 다음 제목 바로 위가 또 다른 skip-section 표식이면 그 표식 줄은 남기지 않고 다음 바퀴에서 함께 처리한다
      while (j - 1 > i + 1 && lines[j - 1].trim() === '<!-- app:skip-section -->') j -= 1;
      i = j - 1;
      continue;
    }
    if (t.endsWith('<!-- app:skip-line -->')) {
      stats.skipLines += 1;
      continue;
    }
    if (t === '<!-- app:version-history -->') {
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('|')) j += 1;
      if (history) out.push(...history);
      stats.historyTables += 1;
      i = j - 1;
      continue;
    }
    if (t.endsWith('<!-- app:version -->')) {
      const cells = l.replace('<!-- app:version -->', '').trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      out.push(`| ${cells[0]} | ${version ?? cells[1]} |`);
      stats.versionRows += 1;
      continue;
    }
    out.push(l);
  }
  if (skip) throw new Error(`닫히지 않은 app:skip: ${skip}행`);
  const stripped = stripMarks(out.join('\n'));
  stats.removedMarks = stripped.removed;
  return { text: stripped.text, stats };
}

export const applyAppMarkers = (text, options) => filterAppText(text, options).text;

// ── 법무/판_관리.md ─────────────────────────────────────────────────
export const EDITION_KEYS = ['terms.version', 'terms.effective', 'privacy.version', 'privacy.effective', ...Array.from({ length: 9 }, (_, i) => `consent.CK${i + 1}`)];

const firstTableAfter = (lines, headingPattern) => {
  const at = lines.findIndex((l) => headingPattern.test(l));
  if (at < 0) throw new Error(`판_관리.md 에서 제목을 찾지 못했어요: ${headingPattern}`);
  const rows = [];
  for (let i = at + 1; i < lines.length && !/^## /.test(lines[i]); i += 1) {
    if (lines[i].trim().startsWith('|')) rows.push(lines[i].trim());
    else if (rows.length > 0) break;
  }
  return rows;
};

const rowCells = (line) => line.slice(1, -1).split('|').map((x) => x.trim());

// 2장 첫 표 → { 'terms.version': …, … }. 키 13개 · 값 모양 · 날짜 일치를 검사한다(오류면 던진다).
export function readEditions(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const map = {};
  for (const line of firstTableAfter(lines, /^## 2\. 현재 판/)) {
    const c = rowCells(line).map((x) => substituteFillIns(x));
    if (c[0] === '키' || /^:?-+:?$/.test(c[0])) continue;
    if (c[0] in map) throw new Error(`판 키가 겹쳐요: ${c[0]}`);
    map[c[0]] = c[1];
  }
  const missing = EDITION_KEYS.filter((k) => !(k in map));
  if (missing.length > 0) throw new Error(`판_관리.md 2장 표에 없는 키: ${missing.join(', ')}`);
  const extra = Object.keys(map).filter((k) => !EDITION_KEYS.includes(k));
  if (extra.length > 0) throw new Error(`판_관리.md 2장 표에 모르는 키: ${extra.join(', ')}`);
  for (let i = 1; i <= 9; i += 1) {
    if (!/^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/.test(map[`consent.CK${i}`])) throw new Error(`consent.CK${i} 값 모양이 달라요: ${map[`consent.CK${i}`]}`);
  }
  for (const kind of ['terms', 'privacy']) {
    const version = map[`${kind}.version`];
    const effective = map[`${kind}.effective`];
    if (!new RegExp(String.raw`^${kind}-(\d{4}\.\d{2}\.\d{2}|\{공개일\})-v\d+$`).test(version)) throw new Error(`${kind}.version 값 모양이 달라요: ${version}`);
    if (!/^(\d{4}\.\d{2}\.\d{2}|\{공개일\})$/.test(effective)) throw new Error(`${kind}.effective 값 모양이 달라요: ${effective}`);
    const datePart = new RegExp(String.raw`^${kind}-(.+)-v\d+$`).exec(version)[1];
    if (datePart !== effective) throw new Error(`${kind} 판의 날짜(${datePart})와 시행일(${effective})이 달라요`);
  }
  return map;
}

// 3장 첫 표(머리 줄 포함)를 줄 배열로
export function readHistory(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const rows = firstTableAfter(lines, /^## 3\. 게시용 변경 이력/);
  if (rows.length < 3 || rowCells(rows[0]).length !== 3) throw new Error('판_관리.md 3장 변경 이력 표가 머리 + 구분 + 1줄 이상, 3칸이어야 해요');
  return rows;
}

// 약관 화면에 보이는 모양: "판 1 · 시행일 2026.11.01"
export function termsVersionLabel(editions) {
  const n = /-v(\d+)$/.exec(editions['terms.version'])[1];
  return `판 ${n} · 시행일 ${editions['terms.effective']}`;
}

// 출시 빌드에서 막는 판: 시행일이 아직 {공개일}
export function editionReleaseProblems(editions) {
  return ['terms.effective', 'privacy.effective'].filter((k) => editions[k].includes('{')).map((k) => `${k} 가 ${editions[k]} (시행일을 정해야 해요)`);
}
