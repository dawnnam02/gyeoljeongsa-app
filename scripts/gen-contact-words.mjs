// 연락처 안내(V10 · K15 10-03)가 쓰는 연락 수단 이름 · 링크 낱말의 앱 사본을 만든다(R1 A⑦). 읽기는 backend/migrations/*.sql, 쓰기는 app/src/content/contactWords.ts 하나.
//  원본: private.text_guard_terms 의 kind 'contact' · 'url' 행(0016 시드 · 뒤 번호가 더하면 같이). money · abuse 낱말은 앱에 가져오지 않는다(안내 부품이 쓰지 않음)
//  · 'http://' · 'https://' · 'www.' 은 앱 판정식(lib/contactShape.ts 링크 모양)이 이미 잡아서 빼고 쓴다(앱 코드에 http:// 글자를 두지 않는 F-01 규칙과도 맞음)
//  · 서버 목록과 어긋나도 안내용일 뿐이라 허용(K15 2-1 데이터 표). 운영이 표를 고치면 다음 빌드 전에 다시 만든다
// 사용: node scripts/gen-contact-words.mjs          → 파일을 다시 쓴다
//       node scripts/gen-contact-words.mjs --check  → 파일이 최신인지 보기만(어긋나면 종료 코드 1)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.resolve(appDir, '..', 'backend', 'migrations');
const outFile = path.join(appDir, 'src', 'content', 'contactWords.ts');
const COVERED_BY_SHAPE = ['http://', 'https://', 'www.'];

export function readTerms(dir = migrationsDir) {
  const contact = new Set();
  const url = new Set();
  if (!fs.existsSync(dir)) return null;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    // insert into private.text_guard_terms (kind, term) values (...), (...) ... ; 덩어리만 본다
    for (const block of sql.matchAll(/insert\s+into\s+private\.text_guard_terms\s*\(kind,\s*term\)\s*values([\s\S]*?);/gi)) {
      for (const m of block[1].matchAll(/\(\s*'(contact|url)'\s*,\s*'((?:[^']|'')*)'\s*\)/g)) {
        const term = m[2].replace(/''/g, "'");
        if (m[1] === 'contact') contact.add(term);
        else if (!COVERED_BY_SHAPE.includes(term)) url.add(term);
      }
    }
  }
  return { contact: [...contact], url: [...url] };
}

export function render(terms) {
  const list = (xs) => xs.map((x) => `  ${JSON.stringify(x)},`).join('\n');
  return [
    '// 생성 파일 — 손으로 고치지 않는다. 다시 만들기: node scripts/gen-contact-words.mjs (R1 A⑦)',
    '// 원본: backend/migrations/*.sql 의 private.text_guard_terms (contact · url). 링크 머리(웹 주소 앞부분 3가지)는 lib/contactShape.ts 판정식이 잡아서 뺐다.',
    '// 쓰는 곳: lib/contactShape.ts(연락처 안내 V10). 서버 목록과 어긋나도 안내용이라 허용(K15 2-1).',
    '',
    'export const CONTACT_WORDS: readonly string[] = [',
    list(terms.contact),
    '];',
    '',
    'export const LINK_WORDS: readonly string[] = [',
    list(terms.url),
    '];',
    '',
  ].join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const terms = readTerms();
  if (!terms) {
    console.log(`[미확인] backend/migrations 폴더가 없어 만들지 못했어요: ${migrationsDir}`);
    process.exit(2);
  }
  const text = render(terms);
  if (process.argv.includes('--check')) {
    const same = fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') === text;
    console.log(same ? `[통과] contactWords.ts 가 최신(연락 수단 ${terms.contact.length} · 링크 ${terms.url.length})` : '[실패] contactWords.ts 가 원본과 다르다 — node scripts/gen-contact-words.mjs');
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(outFile, text, 'utf8');
  console.log(`썼어요: src/content/contactWords.ts (연락 수단 ${terms.contact.length} · 링크 ${terms.url.length})`);
}
