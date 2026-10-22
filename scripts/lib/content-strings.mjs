// app/src/content/*.ts 의 화면 글을 '키 경로 · 글 · 줄'로 꺼낸다(R1 A⑦ · T04). 파일을 실행하지 않고 TypeScript 구문 나무만 읽는다(주석은 들어오지 않음).
//  · 키 경로: 변수 이름 → 속성 이름 → 배열 칸 번호. 예 LIKES.time.minutes · REPORT_SHEET.reasons.3
//  · 값을 넣는 글(`${n}분 전`)은 넣는 자리를 '{}' 로 둔다 → '{}분 전'
//  · 글이 아닌 곳은 뺀다: import · 타입 · 속성 이름 · 비교(=== 'x') · switch case
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

function keyOf(node) {
  const parts = [];
  let cur = node;
  while (cur && !ts.isSourceFile(cur)) {
    const parent = cur.parent;
    if (ts.isPropertyAssignment(parent) && parent.initializer === cur) parts.push(parent.name.getText().replace(/^['"]|['"]$/g, ''));
    else if (ts.isVariableDeclaration(parent) && parent.initializer === cur) parts.push(parent.name.getText());
    else if (ts.isArrayLiteralExpression(parent)) parts.push(String(parent.elements.indexOf(cur)));
    else if (ts.isFunctionDeclaration(parent) && parent.name) parts.push(parent.name.getText());
    cur = parent;
  }
  return parts.reverse().join('.');
}

function skip(node) {
  const p = node.parent;
  if (!p) return false;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
  if (ts.isCaseClause(p)) return true;
  return false;
}

export function stringsOf(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const push = (node, value) => {
    if (skip(node)) return;
    out.push({ file: path.basename(file), key: keyOf(node), text: value, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) return;
    if (ts.isTypeNode(node)) return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      push(node, node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      push(node, node.head.text + node.templateSpans.map((s) => `{}${s.literal.text}`).join(''));
      node.templateSpans.forEach((s) => visit(s.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

// content 폴더 전체. skipFiles 는 화면 글이 아닌 파일(타입 · 생성 자료)
export function contentStrings(contentDir, skipFiles = []) {
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.ts') && !skipFiles.includes(f))
    .sort()
    .flatMap((f) => stringsOf(path.join(contentDir, f)));
}
