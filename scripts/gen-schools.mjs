// F20 앱 내장 학교 목록 만들기. 무료 · 네트워크 없음(파일 읽기 · 쓰기만).
//  원본: 데이터/학교/school_index.json(M14 11-5 판 · 해시) + 데이터/학교/학교목록.csv(캠퍼스 · 지금 이름 — 결과 순서에 필요한 두 칸)
//  결과: app/src/data/schools/schoolIndex.json
//   · 줄 모양: [key, name, course, kind, status, now, names, alias, old, en, pop, rank]
//   · 학교 수준(tier) 칸은 빼고 옮긴다: 앱은 수준을 쓰지도 보이지도 않는다(등급은 서버만 계산, M14 7장 · 척추 마디 3)
//   · rank = M14 kind_rank(0 4년제 본교 · 해외 / 1 캠퍼스 · 분교 · 원격 · 사관 / 2 전문대 / 3 대학원 / 4 특수대학원 / 5 통합 · 폐교 / 6 보기)
//   · now = 옛 이름 · 통합 전 학교가 이어진 지금 학교 이름(같으면 빈 글자)
//   · 원본 판(version)과 원본 해시(source_sha256)를 그대로 적어 서버 판과 맞춘다(M14 11-5)
// 사용: node scripts/gen-schools.mjs   (원본 판이 바뀌면 다시 돌리고 jest surveyV2Schools 를 돌린다)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.resolve(APP_DIR, '..', '데이터', '학교');
const OUT = path.join(APP_DIR, 'src', 'data', 'schools', 'schoolIndex.json');

// RFC 4180 CSV(따옴표 · 줄바꿈 포함 칸)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// M14 m14_autocomplete.py kind_rank 그대로
function kindRank(r) {
  const key = r.school_key;
  if (key.startsWith('X') || !/^[A-Z]/.test(key)) return 6;
  if (['통합', '폐교·통합', '이름바뀜', '확인 필요'].includes(r['상태'])) return 5;
  if (r['과정'] === '대학원') return r['구분'] === '특수대학원' ? 4 : 3;
  if (r['과정'] === '전문대학') return 2;
  if (['', '본교'].includes(r['캠퍼스']) && !['사이버대학(대학)', '방송통신대학', '사관학교', '경찰대학'].includes(r['구분'])) return 0;
  return 1;
}

const source = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'school_index.json'), 'utf8'));
const csvText = fs.readFileSync(path.join(SRC_DIR, '학교목록.csv'), 'utf8').replace(/^﻿/, '');
const csvRows = parseCsv(csvText);
const byKey = new Map(csvRows.map((r) => [r.school_key, r]));

// M14 now_name 그대로: 지금학교_key 를 6번까지 따라간다
function nowName(r) {
  let k = r;
  for (let guard = 0; k['지금학교_key'] && byKey.has(k['지금학교_key']) && guard < 6; guard += 1) k = byKey.get(k['지금학교_key']);
  if (k !== r) return k['이름'];
  return r['지금이름'] || r['이름'];
}

// 원본 해시 다시 재기(M14 11-5: fields + rows 를 띄어쓰기 없는 JSON 으로 만든 SHA-256)
const body = JSON.stringify({ fields: source.fields, rows: source.rows });
const sha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
if (sha !== source.sha256) {
  console.log(`[실패] 원본 해시가 다름: 파일 머리 ${source.sha256} · 다시 잰 값 ${sha}`);
  process.exit(1);
}

const f = Object.fromEntries(source.fields.map((name, i) => [name, i]));
const rows = source.rows.map((r) => {
  const key = r[f.key];
  const csv = byKey.get(key);
  if (!csv) throw new Error(`학교목록.csv 에 없는 키 ${key}`);
  const now = nowName(csv);
  return [key, r[f.name], r[f.course], r[f.kind], r[f.status], now === r[f.name] ? '' : now, r[f.names], r[f.alias], r[f.old], r[f.en], r[f.pop], kindRank(csv)];
});

const doc = {
  version: source.version,
  source_sha256: source.sha256,
  rule: 'M14 3장 자동완성 · 11-5 판. 수준(tier) 칸은 앱에 넣지 않음',
  fields: ['key', 'name', 'course', 'kind', 'status', 'now', 'names', 'alias', 'old', 'en', 'pop', 'rank'],
  rows,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc));
const bytes = fs.statSync(OUT).size;
console.log(`[통과] ${path.relative(APP_DIR, OUT)} · 판 ${doc.version} · 원본 해시 ${sha.slice(0, 12)}… 같음 · 줄 ${rows.length} · ${bytes.toLocaleString()} B`);
