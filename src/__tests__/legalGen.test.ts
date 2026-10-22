// 법무 문서 → 앱 게시본 생성 규칙 시험 8개(F10 · 법무/L4_생성규칙_요청.md 3-3).
// 규칙 코드는 scripts/lib/*.mjs (Node ESM) 라서 별도 node 프로세스로 돌려 JSON 결과만 받는다. 원본 문서는 읽기만 한다.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { LEGAL_PRIVACY } from '@/content/legalPrivacy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import { CONSENT_ITEMS } from '@/content/consentContent';
import { CONSENT_TEXT_FINGERPRINTS, CONSENT_TEXT_VERSIONS, LEGAL_DOC_FINGERPRINTS, LEGAL_DOC_VERSIONS } from '@/config/consent';

const APP_DIR = path.resolve(__dirname, '..', '..');
const LIB = path.join(APP_DIR, 'scripts', 'lib');

function runModule(body: string): unknown {
  const code = `
    import fs from 'node:fs';
    import { pathToFileURL } from 'node:url';
    const L = (n) => import(pathToFileURL(${JSON.stringify(LIB)} + '/' + n).href);
    const markers = await L('legal-markers.mjs');
    const source = await L('legal-source.mjs');
    const output = await L('legal-output.mjs');
    const read = (f) => fs.readFileSync(f, 'utf8').replace(/\\r\\n/g, '\\n');
    const out = await (async () => { ${body} })();
    process.stdout.write(JSON.stringify(out));
  `;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: APP_DIR, encoding: 'utf8' });
  return JSON.parse(stdout);
}

const allText = (blocks: readonly { type: string }[]) => JSON.stringify(blocks);
const BANNED = ['변호사 확인', '법무 제안', '가정 D-', '결정 대기', 'app:', '상태: 초안'];

describe('법무 게시본 생성 규칙 (F10)', () => {
  test('1. 게시 결과에 작업 표시 · 표식 · 부록 · 목차가 없다', () => {
    const texts = [allText(LEGAL_TERMS), allText(LEGAL_PRIVACY), JSON.stringify(CONSENT_ITEMS)];
    for (const text of texts) for (const word of BANNED) expect(text).not.toContain(word);
    for (const blocks of [LEGAL_TERMS, LEGAL_PRIVACY]) {
      const titles = blocks.filter((b): b is Extract<typeof b, { type: 'h' }> => b.type === 'h').map((b) => b.text);
      expect(titles.filter((t) => /^부록 [A-E]/.test(t) || t.startsWith('목차') || t.includes('숫자 출처'))).toEqual([]);
    }
  });

  test('2. 약관 조 제목 29개가 순서대로 있다', () => {
    const articles = LEGAL_TERMS.filter((b) => b.type === 'h' && /^제\d+조 /.test(b.text)).map((b) => (b as { text: string }).text);
    expect(articles).toHaveLength(29);
    articles.forEach((title, i) => expect(title.startsWith(`제${i + 1}조 `)).toBe(true));
  });

  test('3. 처리방침 장 15 · 소절 39 · 1장 표 R행(R01 부터 빈 번호 없이 30개 이상)', () => {
    const h = (level: number) => LEGAL_PRIVACY.filter((b) => b.type === 'h' && b.level === level);
    expect(h(2).filter((b) => /^\d+\. /.test((b as { text: string }).text))).toHaveLength(15);
    expect(h(3)).toHaveLength(39); // 법무 L10: 6-3 · 7-3 · 9-4 신설
    const rRows = LEGAL_PRIVACY.flatMap((b) => (b.type === 'table' ? b.rows : [])).filter((r) => /^R\d+$/.test(r[0]));
    // R행 수는 법무가 늘릴 수 있다: R01 부터 빈 번호 없이 이어지고 30개 이상이면 된다(R13 을 빼지 않고 전부 싣는다)
    expect(rRows.length).toBeGreaterThanOrEqual(30);
    expect(rRows.map((r) => r[0])).toEqual(rRows.map((_, i) => `R${String(i + 1).padStart(2, '0')}`));
  });

  test('4. 동의 9칸은 표식을 모두 뺀 원문에서 뽑은 것과 같다', () => {
    const same = runModule(`
      const raw = read(source.SOURCES.consent);
      const plain = raw.split('\\n').filter((l) => !/^<!-- \\/?app:[a-z-]+ -->$/.test(l.trim())).join('\\n');
      return JSON.stringify(source.parseConsentDoc(raw)) === JSON.stringify(source.parseConsentDoc(plain));
    `);
    expect(same).toBe(true);
    expect(CONSENT_ITEMS.map((i) => i.code)).toEqual(['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6', 'CK7', 'CK8', 'CK9']);
  });

  test('5. skip 을 닫지 않거나 짝이 없으면 오류로 멈춘다', () => {
    const r = runModule(`
      const tryIt = (t) => { try { markers.applyAppMarkers(t); return 'ok'; } catch (e) { return String(e.message); } };
      return [
        tryIt('# a\\n<!-- app:skip -->\\nx\\n'),
        tryIt('# a\\n<!-- /app:skip -->\\n'),
        tryIt('# a\\n<!-- app:skip -->\\n<!-- app:skip -->\\n<!-- /app:skip -->\\n'),
        tryIt('# a\\n<!-- app:skip-section -->\\n본문\\n'),
      ];
    `) as string[];
    for (const message of r) expect(message).not.toBe('ok');
  });

  test('5b. 표식 예시: skip-section 이 연이어 오면 함께 빠지고, 줄 안 표시 · 가정 · 결정 대기가 지워진다', () => {
    const r = runModule(`
      const t = [
        '# 문서', '', '## 15. 끝', '내용 \`[변호사 확인]\` (L1 6장 #9)', '이 동의는 선택입니다(결정 대기 D-16). 동의하지', '… 다시 확인. 가정 D-23 BD-5)를', '',
        '<!-- app:skip-section -->', '## 부록 A', 'a', '<!-- app:skip-section -->', '## 부록 B', 'b', '고객센터(\`{고객센터 이메일}\`)',
      ].join('\\n');
      return markers.applyAppMarkers(t);
    `) as string;
    expect(r).not.toContain('부록');
    expect(r).toContain('내용\n');
    expect(r).toContain('이 동의는 선택입니다. 동의하지');
    expect(r).not.toContain('가정 D-');
  });

  test('6. 판_관리.md 에서 키를 하나 지우면 오류로 멈춘다 / 현재 판은 13개를 모두 읽는다', () => {
    const r = runModule(`
      const text = read(source.SOURCES.editions);
      const ok = Object.keys(markers.readEditions(text)).length;
      let broken = 'ok';
      try { markers.readEditions(text.split('\\n').filter((l) => !l.startsWith('| consent.CK4 |')).join('\\n')); } catch (e) { broken = e.message; }
      return { ok, broken };
    `) as { ok: number; broken: string };
    expect(r.ok).toBe(13);
    expect(r.broken).toContain('consent.CK4');
  });

  test('7. 글 지문: 현재 글은 기록과 같고, 한 글자 고치면 달라진다 / 판 블록은 판_관리.md 와 같다', () => {
    const r = runModule(`
      const now = output.legalDocFingerprints();
      const termsRaw = read(source.SOURCES.terms);
      const changed = markers.filterAppText(termsRaw.replace('**제1조 (목적)**', '**제1조 (목 적)**')).text;
      const crypto = await import('node:crypto');
      const h = (x) => crypto.createHash('sha256').update(x).digest('hex').slice(0, 12);
      const editions = output.readAllEditions();
      return { now, changed: h(changed), consent: output.consentFingerprints(), editions };
    `) as { now: Record<string, string>; changed: string; consent: Record<string, string>; editions: Record<string, string> };
    expect(r.now).toEqual(LEGAL_DOC_FINGERPRINTS);
    expect(r.changed).not.toBe(LEGAL_DOC_FINGERPRINTS.terms);
    expect(r.consent).toEqual(CONSENT_TEXT_FINGERPRINTS);
    for (let i = 1; i <= 9; i += 1) expect(CONSENT_TEXT_VERSIONS[`CK${i}` as keyof typeof CONSENT_TEXT_VERSIONS]).toBe(r.editions[`consent.CK${i}`]);
    expect(LEGAL_DOC_VERSIONS.terms.version).toBe(r.editions['terms.version']);
    expect(LEGAL_DOC_VERSIONS.privacy.effective).toBe(r.editions['privacy.effective']);
  });

  test('8. --release: {…}가 남으면 실패하고 파일은 쓰지 않는다 / 일반 빌드는 경고만(공개 전 값 11종)', () => {
    const before = fs.statSync(path.join(APP_DIR, 'src', 'content', 'legalTerms.ts')).mtimeMs;
    const res = spawnSync(process.execPath, [path.join('scripts', 'gen-legal-content.mjs'), '--release'], { cwd: APP_DIR, encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('출시 빌드 실패');
    expect(fs.statSync(path.join(APP_DIR, 'src', 'content', 'legalTerms.ts')).mtimeMs).toBe(before);
    // 표에 값 칸이 비어 있으면 변수가 그대로 남는다(개수는 표의 행 수와 같다 — 11이든 12든 박지 않는다)
    const r = runModule(`const l = output.leftoverPlaceholders(); return { left: [...l.counts.keys()], names: markers.FILL_IN_VALUES, filled: [...markers.FILL_IN_SUBSTITUTIONS.keys()] };`) as { left: string[]; names: string[]; filled: string[] };
    expect(r.names.length).toBeGreaterThanOrEqual(11);
    expect(r.left.length).toBe(r.names.length - r.filled.length);
  });

  test('10. 출시 빌드 검사(V-07): 데모 모드가 켜져 있으면 gen:legal --release 와 EAS production 설정 읽기(app.config.js)가 실패한다 / eas.json env 도 본다', () => {
    const run = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, [path.join('scripts', 'gen-legal-content.mjs'), '--release'], { cwd: APP_DIR, encoding: 'utf8', env });
    const on = run({ ...process.env, EXPO_PUBLIC_DEMO_MODE: '1' });
    expect(on.status).toBe(1);
    expect(on.stderr).toContain('데모 모드가 섞여 있어요');
    expect(run({ ...process.env, EXPO_PUBLIC_DEMO_MODE: '' }).stderr).not.toContain('데모 모드가 섞여 있어요');
    const cfg = (env: Record<string, string>) =>
      spawnSync(process.execPath, ['-e', "const f = require('./app.config.js'); const c = f({ config: { name: 'x' } }); process.stdout.write(c.name);"], { cwd: APP_DIR, encoding: 'utf8', env: { ...process.env, EAS_BUILD_PROFILE: '', EXPO_PUBLIC_DEMO_MODE: '', ...env } });
    expect(cfg({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_DEMO_MODE: '1' }).status).not.toBe(0);
    expect(cfg({ EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_DEMO_MODE: '1' }).stderr).toContain('EXPO_PUBLIC_DEMO_MODE=1');
    expect(cfg({ EAS_BUILD_PROFILE: 'production' }).stdout).toBe('x'); // 꺼져 있으면 app.json 설정 그대로
    expect(cfg({ EAS_BUILD_PROFILE: 'preview', EXPO_PUBLIC_DEMO_MODE: '1' }).stdout).toBe('x'); // 내부 배포 미리보기는 데모를 켤 수 있다
    expect(cfg({ EXPO_PUBLIC_DEMO_MODE: '1' }).stdout).toBe('x'); // 로컬 개발 · 웹 데모 번들
    const r = runModule(`
      const guard = await L('release-guard.mjs');
      const eas = JSON.stringify({ build: { production: { env: { EXPO_PUBLIC_DEMO_MODE: '1' } }, preview: {} } });
      return { clean: guard.demoModeProblems({}, '{"build":{}}'), env: guard.demoModeProblems({ EXPO_PUBLIC_DEMO_MODE: '1' }, '{"build":{}}').length, eas: guard.demoModeProblems({}, eas), broken: guard.demoModeProblems({}, 'x').length };
    `) as { clean: string[]; env: number; eas: string[]; broken: number };
    expect(r.clean).toEqual([]);
    expect(r.env).toBe(1);
    expect(r.eas).toHaveLength(1);
    expect(r.eas[0]).toContain('production');
    expect(r.broken).toBe(1);
  });

  test('9. 판_관리.md 7장 "값" 칸: 채워진 변수만 그 값으로 바뀌고, 비어 있으면 변수가 남는다 / 행 수는 표에서 센다', () => {
    const r = runModule(`
      const table = [
        '## 7. 공개 전에 채울 값 3개 (L5)', '',
        '| 번호 | 변수 | 값 | 채울 곳 |', '|---|---|---|---|',
        '| 1 | \`{대표자}\` | 홍길동 | a |', '| 2 | \`{주소}\` |  | b |', '| 3 | \`{공개일}\` | - | c |', '', '## 8. 다음'].join(String.fromCharCode(10));
      const rows = markers.readFillInTable(table);
      const subs = new Map(rows.filter((x) => x.value !== '').map((x) => ['{' + x.name + '}', x.value]));
      return { names: markers.readFillInValues(table), subs: [...subs], text: markers.substituteFillIns('대표자 {대표자} · 주소 {주소} · {공개일}', subs) };
    `) as { names: string[]; subs: string[][]; text: string };
    expect(r.names).toEqual(['대표자', '주소', '공개일']);
    expect(r.subs).toEqual([['{대표자}', '홍길동']]);
    expect(r.text).toBe('대표자 홍길동 · 주소 {주소} · {공개일}');
  });
});
