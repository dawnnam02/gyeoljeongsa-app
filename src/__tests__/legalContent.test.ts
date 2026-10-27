// 법무 문서에서 옮긴 글(src/content) — 법무 확정 문구가 한 글자도 바뀌지 않고 앱에 들어와 있는가(F1 통과 조건 3).
// 원본과의 자세한 대조(카피.md · 동의문구.md · 화면_요구사항.md · 정책.md)는 scripts/check-copy.mjs 가 하고, 여기서는 그 점검을 시험 안에서도 돌린다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { CONSENT_ERROR, CONSENT_ITEMS, CONSENT_LINKS, CONSENT_NOTICE, CONSENT_SUBTITLE, CONSENT_TOP, SIGNUP_NOTICE } from '@/content/consentContent';
import { LEGAL_PRIVACY } from '@/content/legalPrivacy';
import { LEGAL_TERMS } from '@/content/legalTerms';
import type { LegalBlock } from '@/content/types';

import { CHECK_COPY_DOCS, describeOutside } from './helpers/outsideDocs';

const APP_DIR = path.resolve(__dirname, '..', '..');

const headings = (blocks: readonly LegalBlock[], level: number) => blocks.filter((b): b is Extract<LegalBlock, { type: 'h' }> => b.type === 'h' && b.level === level).map((b) => b.text);

describe('동의 칸 9개의 글 (동의문구.md 4장)', () => {
  test('요약 줄 수: CK1 7 · CK2 3 · CK3 6 · CK4 6 · CK5 7 · CK6 8 · CK7 7 · CK8 8 · CK9 5 (법무 QPL D-197: CK1 v5 요약 7줄, 법무 L17 10-26: CK8 대화형 설문 한 줄 더함, 법무 L10 10-15: CK3 · CK6 한 줄씩 더함, B10 · L13 10-16: CK5 한 줄 더함)', () => {
    expect(CONSENT_ITEMS.map((i) => i.summary.length)).toEqual([7, 3, 6, 6, 7, 8, 7, 8, 5]);
  });

  test('모든 칸에 전문이 있다: CK1 은 이용약관 전체, 나머지 8개는 동의문구의 전문', () => {
    expect(CONSENT_ITEMS[0].fullText).toBe('terms');
    for (const item of CONSENT_ITEMS.slice(1)) {
      expect(Array.isArray(item.fullText) && item.fullText.length > 0).toBe(true);
    }
  });

  test('CK3 · CK6 · CK8 의 전문에는 표가 들어 있다', () => {
    for (const code of ['CK3', 'CK6', 'CK8']) {
      const item = CONSENT_ITEMS.find((i) => i.code === code);
      expect(Array.isArray(item?.fullText) && item.fullText.some((b) => b.type === 'table')).toBe(true);
    }
  });

  test('"동의하지 않으면" 줄: CK5 만 "확인하지 않으면"이다', () => {
    for (const item of CONSENT_ITEMS) expect(item.declinedLabel).toBe(item.code === 'CK5' ? '확인하지 않으면' : '동의하지 않으면');
  });

  test('필수 칸의 요약 · 전문에는 마크다운 표시(** · `)가 남아 있지 않다', () => {
    const texts = CONSENT_ITEMS.flatMap((i) => [i.label, i.why, i.note ?? '', ...i.summary, i.declined, ...(Array.isArray(i.fullText) ? i.fullText.flatMap((b) => (b.type === 'table' ? [...b.header, ...b.rows.flat()] : [b.text])) : [])]);
    for (const text of texts) expect(text).not.toMatch(/\*\*|`/);
  });

  test('화면 글 낱개: 부제 · 안내 상자 · 링크 줄 · 오류 문구 · 가입 안내', () => {
    expect(CONSENT_TOP).toEqual({ label: '필수 항목 모두 동의', why: '필수 7개를 한 번에 체크해요.', note: '선택 항목은 따로 골라요.' });
    expect(CONSENT_SUBTITLE).toBe('꼭 필요한 항목에만 [필수]를 붙였어요. [선택] 항목은 동의하지 않아도 가입할 수 있어요.');
    expect(CONSENT_NOTICE).toEqual({
      title: '알아 두세요',
      body: "종교는 민감한 정보예요. 입력하면 처음에는 다른 분에게 보이도록 설정돼요. 프로필의 '공개 범위'에서 언제든 끌 수 있어요.", // 법무 L10(가족 종교 문항 삭제)
    });
    expect(CONSENT_LINKS).toEqual({ line: '이용약관 · 개인정보 처리방침 보기', small: '동의한 내용과 처리방침은 설정에서 다시 볼 수 있어요.' });
    expect(CONSENT_ERROR).toBe('필수 항목에 모두 동의해야 시작할 수 있어요.');
    expect(SIGNUP_NOTICE).toEqual({
      text: '이메일과 생년월일은 가입 확인에만 써요. 동의하기 전에 멈추면 7일 뒤에 삭제돼요. 자세한 내용은 개인정보 처리방침에서 볼 수 있어요.',
      link: '개인정보 처리방침',
      under19: '만 24세 이상만 가입할 수 있어요.', // D-100 · D-123(동의문구 5-2) — 키 이름 under19 는 생성기 표지라 그대로
    });
  });
});

describe('이용약관 · 개인정보 처리방침 전체 (읽기 화면)', () => {
  test('약관: 제1조(목적) ~ 제29조 · 부칙까지 조 29개가 모두 있다', () => {
    const articles = headings(LEGAL_TERMS, 4).filter((t) => /^제\d+조 /.test(t));
    expect(articles).toHaveLength(29);
    expect(articles[0]).toBe('제1조 (목적)');
    expect(articles[28]).toMatch(/^제29조 /);
  });

  test('처리방침: 장 15개 · 소절 42개, 부록 · 목차는 게시하지 않는다', () => {
    const chapters = headings(LEGAL_PRIVACY, 2).filter((t) => /^[0-9]+. /.test(t));
    expect(chapters).toHaveLength(15);
    expect(headings(LEGAL_PRIVACY, 3)).toHaveLength(42); // 법무 L10: 6-3 · 7-3 · 9-4 신설 · L17: 5-7 · 8-5 · 9-5 신설
    expect(headings(LEGAL_PRIVACY, 2).filter((t) => t.startsWith('부록'))).toHaveLength(0);
  });

  test('문서 안의 표는 모두 머리 칸과 줄 칸이 맞는다(그릴 수 있다)', () => {
    for (const block of [...LEGAL_TERMS, ...LEGAL_PRIVACY]) {
      if (block.type !== 'table') continue;
      expect(block.header.length).toBeGreaterThan(0);
      for (const row of block.rows) expect(row.length).toBe(block.header.length);
    }
  });

  test('마크다운 표시(** · `)가 글에 남아 있지 않다', () => {
    for (const block of [...LEGAL_TERMS, ...LEGAL_PRIVACY]) {
      const texts = block.type === 'table' ? [...block.header, ...block.rows.flat()] : [block.text];
      for (const text of texts) expect(text).not.toMatch(/\*\*|`/);
    }
  });
});

describeOutside(CHECK_COPY_DOCS)('글 점검 스크립트(npm run check:copy)', () => {
  test('카피.md · 동의문구.md · 화면_요구사항.md · 정책.md 와 앱 글이 모두 같고 생성 파일이 낡지 않았다', () => {
    let output = '';
    try {
      output = execFileSync(process.execPath, [path.join('scripts', 'check-copy.mjs')], { cwd: APP_DIR, encoding: 'utf8' });
    } catch (error) {
      throw new Error(`글 점검 실패:\n${String((error as { stdout?: unknown }).stdout ?? error)}`);
    }
    expect(output).toMatch(/실패 0/);
    expect(output).not.toMatch(/\[실패\]/);
  });
});
