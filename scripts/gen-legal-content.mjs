// 법무 문서(동의문구 · 약관 · 처리방침 · 판_관리)의 글을 앱 코드(src/content/*.ts · src/config/consent.ts 의 판 블록)로 옮긴다. 읽기 전용 원본 · 네트워크 없음.
// 사용: node scripts/gen-legal-content.mjs   (npm run gen:legal)
//       node scripts/gen-legal-content.mjs --fingerprints   (판을 올린 뒤 글 지문을 새로 적는다)
//       node scripts/gen-legal-content.mjs --release        (출시 빌드: 데모 모드가 켜져 있거나 게시 글에 {…}가 남거나 시행일이 {공개일}이면 실패. 파일은 쓰지 않는다)
// 원본이 바뀌면 다시 돌린다. 안 돌리면 npm run check:copy 가 "낡았다"고 실패한다.
// 표식(<!-- app:… -->)이 짝이 안 맞거나 판_관리.md 키가 모자라면 오류로 멈춘다(규칙: 법무/앱_게시본_규칙.md).
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

import {
  FINGERPRINT_BEGIN,
  FINGERPRINT_END,
  VERSIONS_BEGIN,
  VERSIONS_END,
  buildGenerated,
  consentFingerprints,
  fingerprintBlock,
  leftoverPlaceholders,
  legalDocFingerprints,
  readAllEditions,
  versionsBlock,
} from './lib/legal-output.mjs';
import { demoModeProblems } from './lib/release-guard.mjs';
import { APP_DIR } from './lib/legal-source.mjs';

const release = process.argv.includes('--release');
const consentFile = path.join(APP_DIR, 'src', 'config', 'consent.ts');

// 판 블록·지문 블록 바꾸기: 표시 두 줄 사이만 바꾼다
export function replaceBlock(text, begin, end, block) {
  const from = text.indexOf(begin);
  const to = text.indexOf(end);
  if (from < 0 || to < 0) throw new Error(`src/config/consent.ts 에서 ${begin} 표시를 찾지 못했어요`);
  return text.slice(0, from) + block + text.slice(to + end.length);
}

const left = leftoverPlaceholders();
const tokens = [...left.counts.keys()];
if (release) {
  const demo = demoModeProblems(process.env, fs.readFileSync(path.join(APP_DIR, 'eas.json'), 'utf8'));
  if (demo.length > 0) {
    console.error(`출시 빌드 실패: 데모 모드가 섞여 있어요. (파일은 쓰지 않았어요)\n  ${demo.join('\n  ')}`);
    process.exit(1);
  }
  const problems = [...tokens.map((t) => `${t} ×${left.counts.get(t)}`), ...left.editionProblems];
  if (problems.length > 0) {
    console.error(`출시 빌드 실패: 공개 전에 채울 값이 ${problems.length}곳 남아 있어요. (파일은 쓰지 않았어요)\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('출시 빌드 점검 통과: 게시 글에 {…} 없음 · 시행일 확정');
  process.exit(0);
}
if (tokens.length > 0 || left.editionProblems.length > 0) {
  console.warn(`[경고] 공개 전에 채울 값 ${tokens.length}종이 게시 글에 남아 있어요(시험·데모 빌드는 통과, 출시 빌드 --release 는 실패): ${tokens.join(' ')}${left.editionProblems.length ? ` · ${left.editionProblems.join(', ')}` : ''}`);
}

const outputs = buildGenerated();
for (const [file, text] of Object.entries(outputs)) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  console.log(`쓴 파일 ${path.relative(APP_DIR, file).split(path.sep).join('/')} (${Buffer.byteLength(text, 'utf8')} 바이트)`);
}

// 판은 판_관리.md 2장 값 그대로 consent.ts 에 쓴다(판 한 곳 관리)
let consentText = fs.readFileSync(consentFile, 'utf8').replaceAll('\r\n', '\n');
consentText = replaceBlock(consentText, VERSIONS_BEGIN, VERSIONS_END, versionsBlock(readAllEditions()));
console.log('판 13개를 판_관리.md 에서 옮겼어요: src/config/consent.ts');

// 판을 올린 뒤에는 글 지문도 새로 적는다. 안 올렸으면 이 옵션을 쓰지 않는다.
if (process.argv.includes('--fingerprints')) {
  consentText = replaceBlock(consentText, FINGERPRINT_BEGIN, FINGERPRINT_END, fingerprintBlock(consentFingerprints(), legalDocFingerprints()));
  console.log('글 지문을 새로 적었어요: src/config/consent.ts');
}
fs.writeFileSync(consentFile, consentText, 'utf8');
