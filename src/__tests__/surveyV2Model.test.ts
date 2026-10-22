// F20 조건 1~4: 설문 v2 규칙(건너뛰기 · 자동 값 · 검증 · 진행 · 확인 문구) — 기획/설문_v2.md 2-5 · 2-6 · 2-7 · 4-2.
import {
  activeConditions,
  answersOf,
  autoValue,
  check,
  choicesFor,
  draftFromValue,
  emptyDraft,
  firstMissing,
  FLOW,
  isPassable,
  isShown,
  normalizeAnswers,
  progressOf,
  qOf,
  seededShuffle,
  toggleMulti,
  toggleTop,
  visibleFlow,
  warnings,
  blockMessage,
  answerText,
} from '@/features/surveyV2/model';
import { SV2, PROPOSED } from '@/features/surveyV2/copy';
import type { V2Answers } from '@/features/surveyV2/types';

const noSchool = () => null;

describe('건너뛰기(2-6)', () => {
  test('여성이면 병역 A11 숨김 · 자동 na', () => {
    expect(isShown('A11', { A02: 'female' })).toBe(false);
    expect(autoValue('A11', { A02: 'female' })).toBe('na');
    expect(isShown('A11', { A02: 'male' })).toBe(true);
  });
  test("종교 '그 외'면 F07 숨김 · 자동 other(조건 있음), 아니면 F07 의 '그 외' 칩은 꺼짐", () => {
    expect(isShown('F07', { A06: 'other' })).toBe(false);
    expect(autoValue('F07', { A06: 'other' })).toEqual(['other']);
    expect(activeConditions({ A06: 'other' })).toContain('F07');
    const f07 = choicesFor(qOf('F07'), { A06: 'none' });
    expect(f07.find((o) => o.code === 'other')?.disabled).toBe(true);
    expect(f07.find((o) => o.code === 'none')?.disabled).toBe(false);
  });
  test('고등학교까지면 학교 · 학적 상태 · 전공 숨김, 대학원이면 학부 학교 B05 · 편입 B07 보임', () => {
    for (const id of ['B02', 'B06', 'B03', 'B05', 'B07']) expect(isShown(id, { B01: 'hs' })).toBe(false);
    expect(isShown('B05', { B01: 'master' })).toBe(true);
    expect(isShown('B07', { B01: 'univ' })).toBe(true);
    expect(isShown('B07', { B01: 'college' })).toBe(false);
    expect(isShown('B05', { B01: 'univ' })).toBe(false);
  });
  test('직업: 전문 자격직이면 자격 C08, 학생이면 회사 이름 C02 숨김, 직급 · 고용 형태는 자동 na', () => {
    expect(isShown('C08', { C01: 'licensed' })).toBe(true);
    expect(isShown('C02', { C01: 'student' })).toBe(false);
    expect(isShown('C03', { C01: 'self' })).toBe(false);
    expect(autoValue('C03', { C01: 'self' })).toBe('na');
    expect(autoValue('C04', { C01: 'licensed' })).toBe('na');
    expect(isShown('C04', { C01: 'large' })).toBe(true);
    expect(autoValue('C04', { C01: 'large' })).toBeUndefined();
  });
  test('형제자매 없음이면 몇째 D06 숨김 · 자동 only', () => {
    expect(isShown('D06', { D05: '0' })).toBe(false);
    expect(autoValue('D06', { D05: '0' })).toBe('only');
  });
  test('희망 조건이 모두 상관없어요면 F12 · F13 숨김', () => {
    const allAny: V2Answers = { F01: 'any', F02: 'any', F03: 'any', F04: ['any'], F05: 'any', F06: ['any'], F07: ['any'], F08: ['any'], F09: ['any'], F10: ['any'], F14: 'any', F15: 'any', F16: 'any' };
    expect(activeConditions(allAny)).toEqual([]);
    expect(isShown('F12', allAny)).toBe(false);
    expect(isShown('F13', { ...allAny, F03: 'univ' })).toBe(true);
  });
  test('앞 답을 바꾸면 숨은 문항은 자동 값으로 바뀌거나 지워지고, F12 · F13 은 활성 조건만 남는다', () => {
    const a: V2Answers = { B01: 'hs', B02: { school_key: 'K0109' }, B06: 'grad', A02: 'female', A11: 'done', F03: 'univ', F05: 'inc05', F12: ['F03', 'F05'], F13: ['F05', 'F03'] };
    const n = normalizeAnswers({ ...a, F05: 'any' });
    expect(n.clear.sort()).toEqual(['B02', 'B06']);
    expect(n.values.A11).toBe('na');
    expect(n.values.F12).toEqual(['F03']);
    expect(n.values.F13).toEqual(['F03']); // 활성 조건이 1개면 순서도 1개
    const m = normalizeAnswers({ ...a, F01: { older: 3 } }); // 활성 3개인데 순서가 2개뿐 → 다시 묻는다
    expect(m.clear).toContain('F13');
  });
});

describe('보이는 문항 · 진행(2-1)', () => {
  test('필수 흐름 64 중 남성 · 대학원 석사 · 대기업이면 B05 · B07 · A11 이 보이고 C08 은 숨는다', () => {
    const v = visibleFlow({ A02: 'male', B01: 'master', C01: 'large', D05: '1', A06: 'none', F03: 'univ' }).map((q) => q.id);
    expect(v).toEqual(expect.arrayContaining(['A11', 'B05', 'B07', 'C03', 'C04', 'D06', 'F07', 'F12', 'F13']));
    expect(v).not.toContain('C08');
  });
  test('첫 빈 필수 문항: 선택 문항(B03 · F12)은 건너뛴다', () => {
    expect(firstMissing({})).toBe('A12');
    expect(firstMissing({ A12: '김하나', A02: 'female', A03: { sido: 'sejong', sigungu: '세종시' }, A05: 165, A06: 'none', A07: 'never', A08: 'none' })).toBe('B01');
  });
  test('진행: 끝낸 문항 ÷ 보이는 문항, 섹션 막대 9칸, 지금 섹션 안 순번', () => {
    const p = progressOf({ A12: '김하나', A02: 'female' }, 'A03');
    expect(p.bars).toHaveLength(9);
    expect(p.done).toBe(2);
    expect(p.total).toBe(visibleFlow({ A12: '김하나', A02: 'female' }).length);
    expect(p.label).toEqual({ section: 'basic', index: 3, total: 7 }); // 여성: A11 숨김 → 기본 7
    expect(p.bars[0].ratio).toBeCloseTo(2 / 7);
  });
});

describe('검증(2-7 · CSV 검증 규칙)', () => {
  test('이름은 한글 2~10자', () => {
    const q = qOf('A12');
    expect(check(q, { kind: 'text', text: '김' }, {})).toEqual({ state: 'invalid', message: SV2.error.name });
    expect(check(q, { kind: 'text', text: 'Kim하나' }, {}).state).toBe('invalid');
    expect(check(q, { kind: 'text', text: ' 김하나 ' }, {})).toEqual({ state: 'ok', value: '김하나' });
  });
  test('키 130~220 정수, 범위 밖은 막는다', () => {
    const q = qOf('A05');
    expect(check(q, { kind: 'number', text: '129' }, {})).toEqual({ state: 'invalid', message: PROPOSED.rangeError(130, 220) });
    expect(check(q, { kind: 'number', text: '175' }, {})).toEqual({ state: 'ok', value: 175 });
  });
  test("'말하고 싶지 않아요'는 값 null(답한 것), 종교에는 없다", () => {
    expect(check(qOf('C05'), { kind: 'choice', code: 'decline' }, {})).toEqual({ state: 'ok', value: null });
    expect(check(qOf('A06'), { kind: 'choice', code: 'decline' }, {}).state).toBe('empty');
    expect(check(qOf('D08'), { kind: 'school', pick: { code: 'decline' } }, {})).toEqual({ state: 'ok', value: null });
    expect(check(qOf('D08'), { kind: 'school', pick: { code: 'unknown' } }, {})).toEqual({ state: 'ok', value: 'unknown' });
    expect(check(qOf('B02'), { kind: 'school', pick: { key: 'K0109' } }, {})).toEqual({ state: 'ok', value: { school_key: 'K0109' } });
  });
  test("여러 개: '상관없어요'는 혼자만, 취미는 5개까지", () => {
    const codes = qOf('E11').codes;
    let picks: string[] = [];
    for (const c of codes.slice(0, 6)) picks = toggleMulti(codes, picks, c, 5);
    expect(picks).toHaveLength(5);
    expect(toggleMulti(qOf('F04').codes, ['large', 'civil'], 'any', null)).toEqual(['any']);
    expect(toggleMulti(qOf('F04').codes, ['any'], 'large', null)).toEqual(['large']);
  });
  test('지역은 시·군·구까지 골라야 한다(세종은 자동)', () => {
    const q = qOf('A03');
    expect(check(q, { kind: 'region', sido: 'seoul', sigungu: null }, {})).toEqual({ state: 'invalid', message: SV2.error.region });
    expect(check(q, { kind: 'region', sido: 'seoul', sigungu: '강남구' }, {})).toEqual({ state: 'ok', value: { sido: 'seoul', sigungu: '강남구' } });
  });
  test('양끝: 한쪽만 정해도 되고 키는 최소 ≤ 최대', () => {
    expect(check(qOf('F01'), { kind: 'range', any: false, a: '3', b: '' }, {})).toEqual({ state: 'ok', value: { younger: 3 } });
    expect(check(qOf('F02'), { kind: 'range', any: false, a: '180', b: '170' }, {})).toEqual({ state: 'invalid', message: SV2.error.minMax });
    expect(check(qOf('F02'), { kind: 'range', any: true, a: '', b: '' }, {})).toEqual({ state: 'ok', value: 'any' });
  });
  test('순위: 처음 순서는 사람마다 섞이고, 옮기거나 [이대로 괜찮아요]를 눌러야 답한 것', () => {
    const q = qOf('E13');
    const a = emptyDraft(q, 'user-a');
    const b = emptyDraft(q, 'user-b');
    expect(a.kind === 'rankAll' && [...a.order].sort()).toEqual([...q.codes].sort());
    expect(seededShuffle(q.codes, 'x:E13')).toEqual(seededShuffle(q.codes, 'x:E13'));
    expect(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(seededShuffle(q.codes, 'u1')) === JSON.stringify(seededShuffle(q.codes, 'u2'))).toBe(false);
    expect(check(q, a, {}).state).toBe('empty');
    expect(blockMessage(q, check(q, a, {}))).toBe(SV2.error.rankTouch);
  });
  test('상위 3개: 활성 조건 수만큼(3개 미만이면 그 수)', () => {
    const ans: V2Answers = { F03: 'univ', F05: 'inc05', F01: 'any' };
    expect(check(qOf('F13'), { kind: 'rankTop', order: ['F05'] }, ans).state).toBe('empty');
    expect(check(qOf('F13'), { kind: 'rankTop', order: ['F05', 'F03'] }, ans)).toEqual({ state: 'ok', value: ['F05', 'F03'] });
    expect(toggleTop(['F05', 'F03'], 'F01', 2)).toEqual(['F05', 'F03']);
  });
  test('선택 문항(전공 B03 · 결혼 이야기 · 세부사항)은 비워도 넘어간다, 쓰면 글자 수를 본다', () => {
    expect(isPassable(qOf('B03'), check(qOf('B03'), { kind: 'text', text: '' }, {}))).toBe(true);
    expect(check(qOf('Q17'), { kind: 'text', text: '짧아요' }, {})).toEqual({ state: 'invalid', message: SV2.error.minChars(10) });
    expect(check(qOf('T04'), { kind: 'text', text: '미국 2년 대학원 석사 과정을 마쳤어요' }, {}).state).toBe('ok');
  });
  test('저장된 값 → 입력 중 값 → 같은 값(되돌리기)', () => {
    const vals: V2Answers = { A03: { sido: 'busan', sigungu: '해운대구' }, C05: null, B02: { school_key: 'K0138' }, F01: { older: 4 }, E11: ['travel', 'food'], E13: ['work', 'family', 'money', 'leisure', 'health'] };
    for (const [id, v] of Object.entries(vals)) {
      const q = qOf(id);
      expect([id, check(q, draftFromValue(q, v, 's'), {})]).toEqual([id, { state: 'ok', value: v }]);
    }
  });
});

describe('확인 문구 W1~W5(막지 않음)', () => {
  test('W1 키 · W2 학생 소득 · W3 학력과 학교 · W4 같은 글 · W5 성실도 쌍', () => {
    const a: V2Answers = { A05: 139, C01: 'student', C05: 'inc07', B01: 'univ', B02: { school_key: 'C1' }, B06: 'enrolled', T01: '같은 글이에요 같은 글이에요 같은 글', T02: '같은 글이에요 같은 글이에요 같은 글', E08: 5, E14: 5, E09: 3, E15: 3 };
    const w = warnings(a, () => ({ course: 'C', overseas: false }));
    expect(w.map((x) => x.code)).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect(w.find((x) => x.code === 'W5')?.ids).toEqual(['E08', 'E14']);
    expect(warnings({ A05: 170, E08: 5, E14: 1 }, noSchool)).toEqual([]);
  });
  test('해외 학교는 과정을 가리지 않는다', () => {
    expect(warnings({ B01: 'master', B02: { school_key: 'OQ1' } }, () => ({ course: 'U', overseas: true }))).toEqual([]);
  });
});

describe('검토 화면 답 글 · 숫자(등급 · 점수 아님)', () => {
  test('보기 글 · 지역 · 학교 · 양끝 · 5단계', () => {
    expect(answerText(qOf('C05'), null, noSchool)).toBe('말하고 싶지 않아요');
    expect(answerText(qOf('A03'), { sido: 'seoul', sigungu: '강남구' }, noSchool)).toBe('서울 강남구');
    expect(answerText(qOf('B02'), { school_key: 'K0109' }, () => '서울대학교')).toBe('서울대학교');
    expect(answerText(qOf('F01'), { younger: 0, older: 4 }, noSchool)).toBe('어린 쪽은 동갑까지 · 나보다 많은 쪽 4살까지');
    expect(answerText(qOf('E14'), 3, noSchool)).toBe('전혀 아니에요 · 3/5 · 정말 그래요');
  });
  test('answersOf 는 맞게 쓴 값만 모은다', () => {
    const d = { A12: { kind: 'text' as const, text: '김' }, A02: { kind: 'choice' as const, code: 'female' } };
    expect(answersOf(d)).toEqual({ A02: 'female' });
    expect(FLOW.length).toBe(64);
  });
});
