// 법무 문서에서 뽑은 글을 src/content/*.ts 파일 글자로 만든다(쓰지는 않는다).
//  · gen-legal-content.mjs 는 이 결과를 파일에 쓰고
//  · check-copy.mjs 는 이 결과가 지금 파일과 같은지 비교한다(원본이 바뀌었는데 다시 만들지 않았는지 잡는다).
// 표식 · 판 읽기 규칙: legal-markers.mjs (세부청사진 F10, 법무/L4_생성규칙_요청.md)
import crypto from 'node:crypto';
import path from 'node:path';

import { editionReleaseProblems, filterAppText, readEditions, readFillInTable, readHistory, termsVersionLabel } from './legal-markers.mjs';
import { APP_DIR, SOURCES, parseConsentDoc, parseLegalDoc, readDoc } from './legal-source.mjs';

const js = (value) => JSON.stringify(value);

// 값 → TS 글자. 칸마다 한 줄씩, 법무 문서 조각(type 이 있는 객체)은 한 줄에 하나씩 적어 diff 가 읽히게 한다.
function fmt(value, indent = '') {
  const next = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((v) => `${next}${js(v)},`).join('\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${next}${k}: ${fmt(v, next)},`);
    return `{\n${entries.join('\n')}\n${indent}}`;
  }
  return js(value);
}

// 표식 구간 N곳 · 지운 표시 N곳 (눈으로 확인하는 한 줄, L4 요청서 할 일 8)
const markLine = (stats) =>
  `// 표식 구간 ${stats.skipBlocks + stats.skipSections + stats.skipLines}곳(skip ${stats.skipBlocks} · skip-section ${stats.skipSections} · skip-line ${stats.skipLines}) · 지운 표시 ${stats.removedMarks}곳\n`;

const HEADER = (source, stats) =>
  `// 자동 생성 파일 — 직접 고치지 않는다. 글자는 법무 문서에서 그대로 뽑았다.\n// 원본: ${source}\n${markLine(stats)}// 다시 만들기: npm run gen:legal   (원본이 바뀌면 npm run check:copy 가 이 파일이 낡았다고 알려 준다)\n`;

// 판_관리.md 에서 읽은 값(키 13개). 약관 · 처리방침 판 · 시행일 + 동의 문구 판 9개
export const readAllEditions = () => readEditions(readDoc(SOURCES.editions));

function parseAll() {
  const editionsText = readDoc(SOURCES.editions);
  const editions = readEditions(editionsText);
  const history = readHistory(editionsText);
  const consentRaw = readDoc(SOURCES.consent);
  return {
    editions,
    consent: parseConsentDoc(consentRaw),
    consentStats: filterAppText(consentRaw).stats,
    terms: parseLegalDoc(readDoc(SOURCES.terms), { version: termsVersionLabel(editions), history }),
    privacy: parseLegalDoc(readDoc(SOURCES.privacy), { history }),
  };
}

export function buildGenerated() {
  const { consent, consentStats, terms, privacy } = parseAll();
  const dir = path.join(APP_DIR, 'src', 'content');

  const consentTs =
    `${HEADER('법무/동의문구.md (1장 · 3장 · 4장 · 5-1 · 5-2)', consentStats)}` +
    `import type { ConsentItemContent } from './types';\n\n` +
    `// 맨 위 칸 "필수 항목 모두 동의"(필수 7개만 묶는다)\nexport const CONSENT_TOP = ${fmt(consent.top)} as const;\n\n` +
    `// 제목 아래 부제\nexport const CONSENT_SUBTITLE = ${js(consent.subtitle)};\n\n` +
    `// 체크 칸 9개(CK1 ~ CK9, 필수 7 · 선택 2). 위에서 아래 순서\nexport const CONSENT_ITEMS: readonly ConsentItemContent[] = ${fmt(consent.items)};\n\n` +
    `// 안내 상자(CK3 와 CK4 사이). 체크 칸이 아니라 알림이다\nexport const CONSENT_NOTICE = ${fmt(consent.notice)} as const;\n\n` +
    `// 칸 아래 링크 줄과 작은 글씨\nexport const CONSENT_LINKS = ${fmt(consent.links)} as const;\n\n` +
    `// 필수 칸이 비었을 때 문구\nexport const CONSENT_ERROR = ${js(consent.error)};\n\n` +
    `// 02 화면 아래 가입 안내(5-2)와 만 19세 미만 안내\nexport const SIGNUP_NOTICE = ${fmt(consent.signup)} as const;\n`;

  const legalTs = (name, doc, source) =>
    `${HEADER(source, doc.stats)}import type { LegalBlock } from './types';\n\n` +
    `// ${doc.title} — 첫 줄(제목)을 뺀 나머지 전체\nexport const ${name}: readonly LegalBlock[] = ${fmt(doc.blocks)};\n`;

  // 판_관리.md 7장 '공개 전에 채울 값' 표: 변수 이름 → 값(빈 칸이면 null). 앱 화면(12 고객센터 등)이 법무 게시 글과 같은 값을 쓰게 한 곳에서 읽는다(팀장 결정 10-15 ⑦)
  const fillIns = Object.fromEntries(readFillInTable(readDoc(SOURCES.editions)).map((r) => [r.name, r.value === '' ? null : r.value]));
  const fillInsTs =
    `// 자동 생성 파일 — 직접 고치지 않는다. 값은 법무 문서에서 그대로 뽑았다.
// 원본: 법무/판_관리.md 7장 '공개 전에 채울 값' 표의 '값' 칸(비어 있으면 null — 화면은 원본 글의 {변수} 자리를 그대로 보인다)
` +
    `// 다시 만들기: npm run gen:legal   (원본이 바뀌면 npm run check:copy 가 이 파일이 낡았다고 알려 준다)
` +
    `export const FILL_INS: Readonly<Record<string, string | null>> = ${fmt(Object.fromEntries(Object.entries(fillIns).map(([k, v]) => [js(k), v])))};
`;

  return {
    [path.join(dir, 'fillIns.ts')]: fillInsTs,
    [path.join(dir, 'consentContent.ts')]: consentTs,
    [path.join(dir, 'legalTerms.ts')]: legalTs('LEGAL_TERMS', terms, '법무/약관.md'),
    [path.join(dir, 'legalPrivacy.ts')]: legalTs('LEGAL_PRIVACY', privacy, '법무/개인정보처리방침.md'),
  };
}

// 게시되는 글에 남은 {…} (공개 전에 채울 값)와 아직 {공개일}인 시행일. 출시 빌드(--release)는 하나라도 있으면 실패한다.
export function leftoverPlaceholders() {
  const { editions, consent, terms, privacy } = parseAll();
  const found = new Map();
  const walk = (node, where) => {
    if (typeof node === 'string') {
      for (const m of node.matchAll(/\{[^{}\n]*\}/g)) found.set(m[0], (found.get(m[0]) ?? 0) + 1);
    } else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${where}[${i}]`));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, `${where}.${k}`));
  };
  walk(consent, '동의문구');
  walk(terms.blocks, '약관');
  walk(privacy.blocks, '처리방침');
  return { counts: found, editionProblems: editionReleaseProblems(editions) };
}

// 칸마다 '글의 지문'(체크 문구 · 왜 필요한지 · 안내 · 요약 · 동의하지 않으면 · 전문). 법무가 글을 고치면 지문이 바뀐다.
// 글이 바뀌었는데 동의 문구 판(src/config/consent.ts 의 CONSENT_TEXT_VERSIONS)을 안 올렸는지 check-copy 가 이 지문으로 잡는다
// (동의문구 3-5 · 6장 3번: 문구가 바뀌면 새 판으로 기록하고, 뜻이 바뀐 칸은 다시 동의를 받는다). CK1 의 전문(이용약관 전체)은 지문에서 뺀다.
export function consentFingerprints() {
  const consent = parseConsentDoc(readDoc(SOURCES.consent));
  return Object.fromEntries(
    consent.items.map((item) => {
      const body = { label: item.label, why: item.why, note: item.note, summary: item.summary, declinedLabel: item.declinedLabel, declined: item.declined, fullText: item.fullText };
      return [item.code, crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12)];
    }),
  );
}

// 약관 · 처리방침의 글 지문: 표식 구간과 작업 표시를 걸러낸 글의 sha256 앞 12자.
// 판(version · history)으로 바뀌는 줄은 넣지 않는다(판을 올려도 글 지문은 그대로여야 "글이 바뀌었나"만 가려낸다).
export function legalDocFingerprints() {
  const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
  return {
    terms: hash(filterAppText(readDoc(SOURCES.terms)).text),
    privacy: hash(filterAppText(readDoc(SOURCES.privacy)).text),
  };
}

export const FINGERPRINT_BEGIN = '// <fingerprints:begin>';
export const FINGERPRINT_END = '// <fingerprints:end>';
export const VERSIONS_BEGIN = '// <versions:begin>';
export const VERSIONS_END = '// <versions:end>';

// src/config/consent.ts 안의 지문 블록 글
export function fingerprintBlock(prints, docPrints) {
  return [
    FINGERPRINT_BEGIN,
    '// 법무 문서의 글 지문(npm run gen:legal -- --fingerprints 가 고친다. 문구 판을 올린 뒤에만 고친다)',
    'export const CONSENT_TEXT_FINGERPRINTS: Readonly<Record<ConsentCode, string>> = {',
    ...Object.entries(prints).map(([code, hash]) => `  ${code}: ${js(hash)},`),
    '};',
    '// 약관 · 처리방침: 표식 구간과 작업 표시를 걸러낸 글의 지문',
    'export const LEGAL_DOC_FINGERPRINTS = {',
    ...Object.entries(docPrints).map(([key, hash]) => `  ${key}: ${js(hash)},`),
    '} as const;',
    FINGERPRINT_END,
  ].join('\n');
}

// src/config/consent.ts 안의 판 블록 글(법무/판_관리.md 2장이 원본, gen:legal 이 쓴다)
export function versionsBlock(editions) {
  return [
    VERSIONS_BEGIN,
    '// 법무/판_관리.md 2장 표에서 npm run gen:legal 이 쓴다(손으로 고치지 않는다. 손으로 고치면 npm run check:copy 가 "판_관리.md와 다름"으로 실패한다)',
    'export const CONSENT_TEXT_VERSIONS: Readonly<Record<ConsentCode, string>> = {',
    ...Array.from({ length: 9 }, (_, i) => `  CK${i + 1}: ${js(editions[`consent.CK${i + 1}`])},`),
    '};',
    '// 약관 · 처리방침 판과 시행일(시행 전에는 {공개일}). 출시 빌드는 {공개일}이 남으면 막힌다',
    'export const LEGAL_DOC_VERSIONS = {',
    `  terms: { version: ${js(editions['terms.version'])}, effective: ${js(editions['terms.effective'])} },`,
    `  privacy: { version: ${js(editions['privacy.version'])}, effective: ${js(editions['privacy.effective'])} },`,
    '} as const;',
    VERSIONS_END,
  ].join('\n');
}
