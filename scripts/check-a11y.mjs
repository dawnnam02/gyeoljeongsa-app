// 접근성 자동 점검(R1 A⑦ · T11 · T09 · T12 · K13 47 · 50 · 51). 읽기 전용, 네트워크 없음, 새 패키지 없음.
//  K15 3장 13번은 eslint-plugin-react-native-a11y 설치를 적었지만 package.json 은 지금 F17 이 고치는 중이라(R1 배정) 같은 일을 TypeScript 구문 나무로 한다.
//  대상: app/src/**/*.tsx (시험 폴더 제외)
//  A1 이름 없는 눌림 요소 0(T11): <Pressable> · onPress 가 있는 <Card> 에 accessibilityLabel(또는 aria-label · accessibilityLabelledBy · 펼침 {...props})이 있다
//     (Button · TextButton · Chip 은 label 이 곧 이름이라 대상 밖. 공통 Pressable 정의 파일은 감싸는 곳이라 뺀다)
//  A2 날 입력 칸 이름 0 없음(T11): react-native <TextInput> 을 직접 쓰면 accessibilityLabel 이 있다(TextField 는 label 이 필수)
//  A3 이름에 역할 말 0(T09 · K13 47): accessibilityLabel · aria-label 의 글 조각에 '버튼' · '단추'가 없다(역할은 accessibilityRole 이 읽는다)
//  참고 T12: 글자만 있는 링크(<TextButton>) 쓰는 곳 목록 — '버튼 모양으로' 규칙은 디자인 D22 한 줄이 정한 뒤 고친다(지금은 실패로 세지 않음)
//  참고 T09: 읽는 차례 · 한 포커스 묶기는 기계로 다 못 잰다 → 앱 시험 도우미(src/__tests__/a11yOrder.ts)로 부품마다 본다
// 사용: node scripts/check-a11y.mjs [--json] [--src <폴더>]   (종료 코드 0 통과 · 1 실패)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME_ATTRS = ['accessibilityLabel', 'aria-label', 'accessibilityLabelledBy', 'aria-labelledby'];
const ROLE_WORD = /버튼|단추/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(full);
    return e.name.endsWith('.tsx') ? [full] : [];
  });
}

// 속성 값 식 안의 글 조각(글자 · 템플릿의 고정 부분)
function literalPieces(node, out = []) {
  if (!node) return out;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
  else if (ts.isTemplateExpression(node)) {
    out.push(node.head.text, ...node.templateSpans.map((s) => s.literal.text));
    node.templateSpans.forEach((s) => literalPieces(s.expression, out));
  } else ts.forEachChild(node, (c) => literalPieces(c, out));
  return out;
}

export function auditFile(file, srcDir) {
  const rel = path.relative(srcDir, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importsRnTextInput = /import\s*\{[^}]*\bTextInput\b[^}]*\}\s*from\s*['"]react-native['"]/.test(text);
  const found = { A1: [], A2: [], A3: [], T12: [] };
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      const attrs = node.attributes.properties;
      const has = (name) => attrs.some((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
      const spread = attrs.some((a) => ts.isJsxSpreadAttribute(a));
      const named = spread || NAME_ATTRS.some(has);
      if (tag === 'Pressable' && rel !== 'components/Pressable.tsx' && !named) found.A1.push(`${at(node)} <Pressable> 이름 없음`);
      if (tag === 'Card' && has('onPress') && !named) found.A1.push(`${at(node)} <Card onPress> 이름 없음`);
      if (tag === 'TextInput' && importsRnTextInput && !named) found.A2.push(`${at(node)} <TextInput> 이름 없음`);
      if (tag === 'TextButton') found.T12.push(at(node));
      for (const a of attrs) {
        if (!ts.isJsxAttribute(a) || !['accessibilityLabel', 'aria-label'].includes(a.name.getText()) || !a.initializer) continue;
        const pieces = literalPieces(a.initializer);
        const word = pieces.map((p) => ROLE_WORD.exec(p)?.[0]).find(Boolean);
        if (word) found.A3.push(`${at(a)} 이름에 '${word}'`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

export function auditA11y(srcDir = path.join(APP_DIR, 'src')) {
  const files = walk(srcDir);
  const total = { A1: [], A2: [], A3: [], T12: [] };
  for (const f of files) {
    const r = auditFile(f, srcDir);
    for (const k of Object.keys(total)) total[k].push(...r[k]);
  }
  return { files: files.length, ...total };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf('--src');
  const out = auditA11y(i > 0 ? path.resolve(process.argv[i + 1]) : undefined);
  if (process.argv.includes('--json')) console.log(JSON.stringify(out));
  else {
    const line = (ok, title, list) => console.log(`[${ok ? '통과' : '실패'}] ${title}${list.length ? `\n       ${list.join('\n       ')}` : ''}`);
    line(out.A1.length === 0, `A1 이름 없는 눌림 요소 0 (T11, .tsx ${out.files}개)`, out.A1);
    line(out.A2.length === 0, 'A2 react-native TextInput 을 직접 쓸 때 이름이 있다 (T11)', out.A2);
    line(out.A3.length === 0, "A3 스크린리더 이름에 '버튼' · '단추' 0 (T09 · K13 47)", out.A3);
    console.log(`[참고] T12 글자만 있는 링크(TextButton) ${out.T12.length}곳 — 버튼 모양 규칙은 디자인 D22 결정 뒤: ${out.T12.slice(0, 12).join(' · ')}${out.T12.length > 12 ? ' …' : ''}`);
    console.log('[참고] T09 읽는 차례 · 한 포커스 묶기는 앱 시험 도우미(src/__tests__/a11yOrder.ts)로 부품마다 본다');
  }
  process.exit(out.A1.length + out.A2.length + out.A3.length > 0 ? 1 : 0);
}
