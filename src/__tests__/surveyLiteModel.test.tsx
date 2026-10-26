// 임시(F2L) — AYLA'S 설문으로 교체 예정
// F2L 1단계 조건 1 · 2 · 5: 임시 설문 12문항(실제 ID) · 입력형태 11종 · 답하지 않음 · 필수 규칙 · 값 모양 · 쪽 · 진행바 · 글자 원본 대조
import fs from 'node:fs';
import path from 'node:path';

import { SIGN_IN } from '@/content/copy';
import { LITE_COMMON, LITE_QUESTIONS, PHOTOS_LITE, SURVEY_LITE } from '@/content/surveyLiteCopy';
import {
  blockMessage,
  checkDraft,
  chipProgress,
  choicesOf,
  DECLINE,
  draftFromValue,
  emptyDraft,
  firstMissingPage,
  isPassable,
  LITE_PAGES,
  LITE_PROGRESS_TOTAL,
  LITE_TYPES,
  liteEntryOf,
  moveRank,
  numberOf,
  PHOTO_PAGE_IDS,
  pickSido,
  QUESTIONS,
  questionOf,
  rangeOf,
  scaleOf,
  startPage,
  textOf,
  toggleMulti,
  visibilityLine,
  type Draft,
} from '@/features/surveyLite/liteModel';
import { SIDO, SIGUNGU } from '@/features/surveyLite/regions';
import { splitForServer, uploadFailCode } from '@/lib/surveyLiteApi';
import { demoValueOk } from '@/lib/surveyLiteDemo';

import { APP_DIR, readOutside, testOutside } from './helpers/outsideDocs';

const read = (...parts: string[]) => readOutside(parts.join('/')); // 저장소 밖 문서(없으면 빈 글, 그 시험은 건너뜀)
const TODAY = '2026-10-15';

// CSV 한 줄 나누기(따옴표 칸 지원)
function csvRows(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  const split = (line: string) => {
    const out: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        out.push(cell);
        cell = '';
      } else cell += ch;
    }
    out.push(cell);
    return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((v, i) => [head[i], v])));
}

describe('조건 1: 문항 12개 · 실제 ID · 입력형태 11종', () => {
  const csv = csvRows(read('기획', '설문_문항표.csv'));

  testOutside(['기획/설문_문항표.csv'])('12문항이고, 모두 문항표에 있는 사용 문항이며 질문 · 입력형태 · 선택지 · 필수 · 공개 · 매칭 · 민감 칸이 CSV 와 글자까지 같다', () => {
    expect(LITE_QUESTIONS).toHaveLength(12);
    expect(new Set(LITE_QUESTIONS.map((q) => q.id)).size).toBe(12);
    for (const q of LITE_QUESTIONS) {
      const row = csv.find((r) => r['문항ID'] === q.id);
      expect(row).toBeDefined();
      expect(row?.['상태']).toBe('사용');
      expect([row?.['섹션'], row?.['질문'], row?.['입력형태'], row?.['선택지'], row?.['필수'], row?.['공개기본값'], row?.['매칭사용'], row?.['민감']]).toEqual([
        q.section, q.question, q.type, q.options, q.required, q.visibility, q.matching, q.sensitive,
      ]);
    }
  });

  testOutside(['기획/설문_문항표.csv'])('입력형태 11종(CSV 의 종류 전부)이 한 번 이상 나온다', () => {
    const csvTypes = new Set(csv.filter((r) => r['상태'] === '사용').map((r) => r['입력형태']));
    expect(csvTypes.size).toBe(11);
    expect([...csvTypes].sort()).toEqual([...LITE_TYPES].sort());
    expect(new Set(LITE_QUESTIONS.map((q) => q.type)).size).toBe(11);
  });

  test('섹션 A~G 와 T 가 모두 들어 있다(섹션마다 1~3개)', () => {
    const count = (s: string) => LITE_QUESTIONS.filter((q) => q.section === s).length;
    expect(['A', 'B', 'C', 'D', 'E', 'T', 'F', 'G'].map(count)).toEqual([3, 1, 1, 1, 2, 1, 1, 2]);
  });

  testOutside(['기획/화면_요구사항.md'])('04 는 10쪽(한 쪽에 한 문항), 05 는 G01 사진 · G03 스타일 = 12', () => {
    expect(LITE_PAGES.map((p) => p.id)).toEqual(['A01', 'A03', 'A05', 'B01', 'C05', 'D03', 'E08', 'E13', 'T01', 'F01']);
    expect([...LITE_PAGES.map((p) => p.id), ...PHOTO_PAGE_IDS].sort()).toEqual(LITE_QUESTIONS.map((q) => q.id).sort());
    // 쪽 번호는 정식 설문에서 그 문항이 놓이는 쪽(화면_요구사항 3-2). A01 은 02 에서 받는 문항이라 임시판 01 쪽
    const plan = read('기획', '화면_요구사항.md');
    for (const p of LITE_PAGES.filter((x) => x.id !== 'A01')) expect(plan).toMatch(new RegExp(`\\| 04-${p.step} \\| ${p.chip} \\|[^\\n]*${p.id} `));
  });

  test("'답하지 않음' 허용 문항(C05 · D03)은 민감 문항이고, 고르면 값 없음(JSON null)으로 답한 것이 된다", () => {
    for (const id of ['C05', 'D03']) {
      const q = questionOf(id);
      expect(q.sensitive).toBe(true);
      expect(choicesOf(q)).toContain(DECLINE);
      const check = checkDraft(q, { kind: 'choice', choice: DECLINE }, TODAY);
      expect(check).toEqual({ state: 'ok', value: null });
      expect(draftFromValue(q, null)).toEqual({ kind: 'choice', choice: DECLINE });
      expect(firstMissingPage({ A01: '1995-03-12', A03: { sido: '서울', sigungu: '마포구' }, A05: 170, B01: '대졸', C05: null, D03: null })).toBe(6);
    }
  });
});

describe('조건 2: 필수 · 입력 규칙 · 값 모양(스키마 4장)', () => {
  const ok = (id: string, draft: Draft) => checkDraft(questionOf(id), draft, TODAY);

  test('날짜 A01: 8자리 · 실제 날짜 · 1950 이후 · 만 19세. 틀리면 N02, 02 에서 받은 값은 잠긴다', () => {
    expect(ok('A01', { kind: 'date', text: '19950312', locked: false })).toEqual({ state: 'ok', value: '1995-03-12' });
    expect(ok('A01', { kind: 'date', text: '19950230', locked: false })).toEqual({ state: 'invalid', message: SIGN_IN.errors.birthFormat });
    expect(ok('A01', { kind: 'date', text: '20100101', locked: false }).state).toBe('invalid'); // 만 19세 미만
    expect(ok('A01', { kind: 'date', text: '19491231', locked: false }).state).toBe('invalid');
    expect(ok('A01', { kind: 'date', text: '', locked: false })).toEqual({ state: 'empty' });
    expect(draftFromValue(questionOf('A01'), '1995-03-12', true)).toEqual({ kind: 'date', text: '19950312', locked: true });
  });

  test('지역 A03: 시·도 17곳 → 시·군·구, 시·도를 바꾸면 비우고 세종은 자동. 비면 "지역을 골라 주세요."', () => {
    expect(SIDO).toHaveLength(17);
    expect(Object.values(SIGUNGU).reduce((n, list) => n + list.length, 0)).toBe(230);
    expect(pickSido('서울')).toEqual({ kind: 'region', sido: '서울', sigungu: null });
    expect(pickSido('세종')).toEqual({ kind: 'region', sido: '세종', sigungu: '세종시' });
    expect(ok('A03', { kind: 'region', sido: '서울', sigungu: '강남구' })).toEqual({ state: 'ok', value: { sido: '서울', sigungu: '강남구' } });
    expect(ok('A03', { kind: 'region', sido: '서울', sigungu: null })).toEqual({ state: 'empty' });
    expect(blockMessage(questionOf('A03'), { state: 'empty' })).toBe(SURVEY_LITE.regionRequired);
  });

  test('숫자 A05: 130~220 정수(cm). 범위 밖은 넘어갈 수 없다', () => {
    expect(numberOf(questionOf('A05'))).toEqual({ min: 130, max: 220, unit: 'cm' });
    expect(ok('A05', { kind: 'number', text: '172' })).toEqual({ state: 'ok', value: 172 });
    expect(ok('A05', { kind: 'number', text: '129' }).state).toBe('invalid');
    expect(ok('A05', { kind: 'number', text: '221' }).state).toBe('invalid');
  });

  test('선택 B01 · 구간 C05: 하나만, 보기 글자 그대로 저장', () => {
    expect(ok('B01', { kind: 'choice', choice: '대졸' })).toEqual({ state: 'ok', value: '대졸' });
    expect(ok('C05', { kind: 'choice', choice: '5천만~7천만' })).toEqual({ state: 'ok', value: '5천만~7천만' });
    expect(ok('B01', { kind: 'choice', choice: null })).toEqual({ state: 'empty' });
    expect(ok('B01', { kind: 'choice', choice: '없는 보기' })).toEqual({ state: 'empty' });
  });

  test('척도 E08: 1~5, 처음엔 아무것도 골라져 있지 않다. 양 끝 라벨은 CSV 그대로', () => {
    expect(scaleOf(questionOf('E08'))).toEqual({ min: 1, max: 5, low: '매우 내향적', high: '매우 외향적' });
    expect(emptyDraft(questionOf('E08'))).toEqual({ kind: 'scale', value: null });
    expect(ok('E08', { kind: 'scale', value: 4 })).toEqual({ state: 'ok', value: 4 });
  });

  test('순위 E13: 처음 순서는 답이 아니다 — 옮기거나 N05 를 체크해야 답한 것. 값은 1위부터 5개 전부', () => {
    const q = questionOf('E13');
    const start = emptyDraft(q);
    expect(start).toEqual({ kind: 'rank', order: ['가족', '일', '돈', '신앙', '여가'], confirmed: false });
    expect(checkDraft(q, start, TODAY)).toEqual({ state: 'empty' });
    expect(moveRank(['가족', '일', '돈', '신앙', '여가'], 2, -1)).toEqual(['가족', '돈', '일', '신앙', '여가']);
    expect(moveRank(['가족', '일'], 0, -1)).toEqual(['가족', '일']); // 끝에서는 그대로
    expect(checkDraft(q, { kind: 'rank', order: ['돈', '가족', '일', '여가', '신앙'], confirmed: true }, TODAY)).toEqual({ state: 'ok', value: ['돈', '가족', '일', '여가', '신앙'] });
  });

  test('텍스트 T01: 앞뒤 공백 제거 · 20~300자 · 모자라거나 넘치면 N08', () => {
    expect(textOf(questionOf('T01'))).toEqual({ min: 20, max: 300 });
    expect(ok('T01', { kind: 'text', text: '   ' })).toEqual({ state: 'empty' });
    expect(ok('T01', { kind: 'text', text: '짧은 글' })).toEqual({ state: 'invalid', message: SURVEY_LITE.minChars(20) });
    expect(ok('T01', { kind: 'text', text: '가'.repeat(301) })).toEqual({ state: 'invalid', message: SURVEY_LITE.maxChars(300) });
    expect(ok('T01', { kind: 'text', text: `  ${'가'.repeat(20)}  ` })).toEqual({ state: 'ok', value: '가'.repeat(20) });
  });

  test("범위 F01: '상관없음' 또는 {younger, older}(0~15, 한쪽만 있어도 된다)", () => {
    const spec = rangeOf(questionOf('F01'));
    expect(spec).toEqual({ younger: { label: '연하 최대', min: 0, max: 15, unit: '세' }, older: { label: '연상 최대', min: 0, max: 15, unit: '세' }, any: '상관없음' });
    expect(ok('F01', { kind: 'range', any: true, younger: '3', older: '' })).toEqual({ state: 'ok', value: '상관없음' });
    expect(ok('F01', { kind: 'range', any: false, younger: '3', older: '' })).toEqual({ state: 'ok', value: { younger: 3 } });
    expect(ok('F01', { kind: 'range', any: false, younger: '0', older: '5' })).toEqual({ state: 'ok', value: { younger: 0, older: 5 } });
    expect(ok('F01', { kind: 'range', any: false, younger: '16', older: '' }).state).toBe('invalid');
    expect(ok('F01', { kind: 'range', any: false, younger: '', older: '' })).toEqual({ state: 'empty' });
  });

  test('복수 선택 G03: 필수 아님(비어도 넘어간다), 보기 순서로 저장 · 상관없음/답하지 않음은 혼자만', () => {
    const q = questionOf('G03');
    expect(q.required).toBe(false);
    expect(isPassable(q, { state: 'empty' })).toBe(true);
    expect(checkDraft(q, { kind: 'multi', picks: ['미니멀', '단정'] }, TODAY)).toEqual({ state: 'ok', value: ['단정', '미니멀'] });
    expect(toggleMulti(['A', 'B', '상관없음'], ['A'], '상관없음')).toEqual(['상관없음']);
    expect(toggleMulti(['A', 'B', '상관없음'], ['상관없음'], 'B')).toEqual(['B']);
    expect(toggleMulti(['A', 'B'], ['A', 'B'], 'A')).toEqual(['B']);
  });

  test('필수 문항이 비면 넘어갈 수 없고 "이 질문에 답해 주세요."', () => {
    const required = QUESTIONS.filter((q) => q.required && q.type !== '사진');
    expect(required).toHaveLength(10);
    for (const q of required) {
      expect(isPassable(q, { state: 'empty' })).toBe(false);
      expect(blockMessage(q, { state: 'empty' })).toBe(q.type === '지역' ? SURVEY_LITE.regionRequired : SURVEY_LITE.required);
    }
  });

  test('저장했던 값으로 다시 채운다(이어서 작성)', () => {
    const values: Record<string, unknown> = { A03: { sido: '부산', sigungu: '해운대구' }, A05: 180, B01: '석사', E08: 2, E13: ['일', '가족', '돈', '신앙', '여가'], T01: '가'.repeat(30), F01: { older: 4 }, G03: ['캐주얼'] };
    for (const [id, value] of Object.entries(values)) {
      const q = questionOf(id);
      const draft = draftFromValue(q, value as never);
      expect(checkDraft(q, draft, TODAY)).toEqual({ state: 'ok', value });
    }
  });
});

describe('쪽 · 진행바 · 이어서 작성', () => {
  test('칩 6개 중 현재 칩 · 쪽 표시 "기본 · 2 / 3" · 진행바 분모 11(04 10쪽 + 05)', () => {
    expect(SURVEY_LITE.chips).toEqual(['기본', '학력', '직업', '가족', '성향', '희망']);
    expect(new Set(LITE_PAGES.map((p) => p.chip)).size).toBe(6);
    expect(chipProgress(1)).toEqual({ chip: '기본', index: 2, total: 3 });
    expect(chipProgress(8)).toEqual({ chip: '성향', index: 3, total: 3 });
    expect(SURVEY_LITE.stepLabel('기본', 2, 3)).toBe('기본 · 2 / 3');
    expect(LITE_PROGRESS_TOTAL).toBe(11);
  });

  test('처음 빈 쪽에서 이어간다 · 다 찼으면 마지막 쪽 · 05 의 ‹ 는 마지막 쪽 · 라우트 값 읽기', () => {
    expect(startPage('resume', { A01: '1995-03-12' })).toBe(1);
    expect(startPage('resume', { A01: '1995-03-12', A03: { sido: '서울', sigungu: '중구' }, A05: 170 })).toBe(3);
    const full = Object.fromEntries(LITE_PAGES.map((p) => [p.id, 1]));
    expect(firstMissingPage(full)).toBeNull();
    expect(startPage('resume', full)).toBe(LITE_PAGES.length - 1);
    expect(startPage('last', {})).toBe(LITE_PAGES.length - 1);
    expect(liteEntryOf('01', undefined)).toBe('resume');
    expect(liteEntryOf('32', undefined)).toBe('last');
    expect(liteEntryOf('05', 'missing')).toBe('missing');
  });

  test('공개 범위 한 줄: 공개 · 구간(토글 있음) · 부모님 학력(법무 문구) · 비공개(짝을 고를 때 쓰임, 카피 14-2 v5)', () => {
    expect(visibilityLine(questionOf('A03'))).toBe('이 항목은 상대에게 보여요.');
    expect(visibilityLine(questionOf('C05'))).toBe('이 항목은 구간으로만 보여요. 프로필에서 바꿀 수 있어요.');
    expect(visibilityLine(questionOf('D03'))).toBe(SURVEY_LITE.parentRangeLine);
    expect(visibilityLine(questionOf('E08'))).toBe('이 항목은 상대에게 보이지 않아요. 짝을 고를 때만 쓰여요.');
    expect(visibilityLine(questionOf('G03'))).toBe('이 항목은 상대에게 보여요.');
  });
});

describe('서버 계약 모양(실서버 · 데모 같은 규칙)', () => {
  test('저장: T01 은 free_texts, 사진 G01 은 어디에도 보내지 않고, 나머지는 survey_answers', () => {
    expect(splitForServer({ A05: 170, T01: '가'.repeat(20), G01: 'x', C05: null, G03: ['단정'] })).toEqual({ answers: { A05: 170, C05: null, G03: ['단정'] }, texts: { T01: '가'.repeat(20) } });
  });

  test('사진 함수 오류 코드 → 앱 코드(415 · 413 · 422 · 429 · 인터넷)', () => {
    const f = (code: string | null, status: number | null = 400, network = false) => uploadFailCode({ network, status, code });
    expect([f('not_jpeg', 415), f('too_large', 413), f('has_gps', 422), f('slot_limit', 429), f('daily_limit', 429), f(null, null, true), f('server_error', 500)]).toEqual(['format', 'size', 'gps', 'limit', 'limit', 'network', 'server']);
  });

  test('데모 값 검사는 서버 검사식과 같은 모양을 받는다', () => {
    expect(demoValueOk('A03', { sido: '서울', sigungu: '강남구' })).toBe(true);
    expect(demoValueOk('A03', { sido: '서울시', sigungu: '강남구' })).toBe(false);
    expect(demoValueOk('A05', 172)).toBe(true);
    expect(demoValueOk('A05', 300)).toBe(false);
    expect(demoValueOk('C05', null)).toBe(true);
    expect(demoValueOk('B01', null)).toBe(false); // 답하지 않음이 없는 문항
    expect(demoValueOk('E13', ['일', '가족', '돈', '신앙', '여가'])).toBe(true);
    expect(demoValueOk('E13', ['일', '가족'])).toBe(false);
    expect(demoValueOk('T01', '짧음')).toBe(false);
    expect(demoValueOk('F01', { younger: 3 })).toBe(true);
    expect(demoValueOk('F01', { min: 3 } as never)).toBe(false); // F02 모양은 F01 에 안 된다
    expect(demoValueOk('G03', [])).toBe(false);
  });
});

describe('조건 5 · 7: 글은 원본 그대로 · 임시 표시', () => {
  const copyMd = read('마케팅', '카피.md');
  const plan = read('기획', '화면_요구사항.md');

  testOutside(['마케팅/카피.md'])('04 · 05 글이 카피.md 에 글자 그대로 있다', () => {
    const fixed = [
      SURVEY_LITE.headerTitle, SURVEY_LITE.tempSave, SURVEY_LITE.publicLine, SURVEY_LITE.parentBanner, SURVEY_LITE.parentRangeLine, SURVEY_LITE.freeTextGuide,
      SURVEY_LITE.savedToast, SURVEY_LITE.required, SURVEY_LITE.regionRequired, SURVEY_LITE.saveFailed,
      `${SURVEY_LITE.publicLine} ${SURVEY_LITE.toggleSuffix}`, SURVEY_LITE.stepLabel('기본', 3, 11), SURVEY_LITE.chips.join(' / '),
      [...SURVEY_LITE.quickSido, SURVEY_LITE.quickOther].join(' / '), `${SURVEY_LITE.sidoPlaceholder} / ${SURVEY_LITE.sigunguPlaceholder}`,
      `${SURVEY_LITE.prev} / ${SURVEY_LITE.next}`,
      PHOTOS_LITE.headerTitle, PHOTOS_LITE.title, PHOTOS_LITE.subtitle, ...Object.values(PHOTOS_LITE.slots), ...PHOTOS_LITE.guideLines, PHOTOS_LITE.styleLabel,
      PHOTOS_LITE.internalNote, PHOTOS_LITE.finish, PHOTOS_LITE.permissionAsk, PHOTOS_LITE.permissionDenied, PHOTOS_LITE.uploadFailed,
      PHOTOS_LITE.badPhoto('{형식}', '{용량}'), PHOTOS_LITE.needThree,
      LITE_COMMON.loading, LITE_COMMON.offline, LITE_COMMON.server, `${LITE_COMMON.retry} / ${LITE_COMMON.confirm} / ${LITE_COMMON.cancel}`,
    ];
    const section = (from: string, to: string) => copyMd.slice(copyMd.indexOf(from), copyMd.indexOf(to, copyMd.indexOf(from)));
    const scope = section('### 04 설문', '### 06 AI') + section('## 4. 공통 문구', '## 5.');
    expect(fixed.filter((text) => !scope.includes(text))).toEqual([]);
  });

  testOutside(['기획/화면_요구사항.md'])('카피에 없는 글은 화면_요구사항 6장 N문구 그대로(N03 · N04 · N05 · N08 · N12)', () => {
    const n = plan.slice(plan.indexOf('# 6. 새 문구 요청'), plan.indexOf('# 7.'));
    const fixed = [SURVEY_LITE.resume, SURVEY_LITE.rangeLine, SURVEY_LITE.hiddenLine, SURVEY_LITE.toggleSuffix, SURVEY_LITE.rankConfirm, SURVEY_LITE.minChars('{n}' as unknown as number), SURVEY_LITE.maxChars('{n}' as unknown as number), SURVEY_LITE.missing];
    expect(fixed.filter((text) => !n.includes(text))).toEqual([]);
    // QP-A: N05 의 비공개 한 줄은 카피.md 14-2 SURVEY_LITE.hiddenUsedLine(v5 '짝')이 화면_요구사항 옛 글('추천')보다 앞선다
    expect(copyMd.slice(copyMd.indexOf('## 14. '))).toContain(`\`SURVEY_LITE.hiddenUsedLine\` (임시 설문) | ${SURVEY_LITE.hiddenUsedLine} |`);
    expect(n).toContain(`버튼 "${PHOTOS_LITE.reupload}"`); // N11 다시 올리기 상태
    expect(plan).toContain('`{지금}/{최대}`');
  });

  test("새로 만든 파일은 모두 첫 줄이 '// 임시(F2L) — AYLA'S 설문으로 교체 예정'이다", () => {
    const app = APP_DIR;
    const files = [
      ...fs.readdirSync(path.join(app, 'src', 'features', 'surveyLite')).map((f) => path.join('src', 'features', 'surveyLite', f)),
      ...fs.readdirSync(path.join(app, 'src', 'features', 'photosLite')).map((f) => path.join('src', 'features', 'photosLite', f)),
      path.join('src', 'content', 'surveyLiteCopy.ts'),
      path.join('src', 'lib', 'surveyLiteApi.ts'),
      path.join('src', 'lib', 'surveyLiteDemo.ts'),
      path.join('scripts', 'web-f2l.mjs'),
      ...fs.readdirSync(path.join(app, 'src', '__tests__')).filter((f) => f.startsWith('surveyLite')).map((f) => path.join('src', '__tests__', f)),
    ];
    expect(files.length).toBeGreaterThanOrEqual(14);
    const bad = files.filter((f) => !fs.readFileSync(path.join(app, f), 'utf8').startsWith("// 임시(F2L) — AYLA'S 설문으로 교체 예정"));
    expect(bad).toEqual([]);
  });

  test('임시 설문 코드에 등급 · 점수 말(영문 grade · rating · score, 한글 등급 · 점수)이 없다', () => {
    const app = path.join(APP_DIR, 'src');
    const files = [
      ...fs.readdirSync(path.join(app, 'features', 'surveyLite')).map((f) => path.join(app, 'features', 'surveyLite', f)),
      ...fs.readdirSync(path.join(app, 'features', 'photosLite')).map((f) => path.join(app, 'features', 'photosLite', f)),
      path.join(app, 'content', 'surveyLiteCopy.ts'),
      path.join(app, 'lib', 'surveyLiteApi.ts'),
      path.join(app, 'lib', 'surveyLiteDemo.ts'),
    ];
    for (const file of files) expect(fs.readFileSync(file, 'utf8')).not.toMatch(/grade|rating|score|등급|점수/i);
  });
});
