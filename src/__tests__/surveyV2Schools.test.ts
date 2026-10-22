// F20 조건 2: 학교 검색 자동완성 — 앱 내장 목록이 M14 판(해시)과 같고, 검색 결과가 M14 파이썬 기준 구현과 같다.
//  정답(golden)은 데이터/학교/m14_autocomplete.py 로 만든 schoolSearch.golden.json(M14 시험 50개 질의 + 더한 질의 · 과정 거르기)
//  학교 수준(tier) 칸은 앱 목록에 없다(앱은 수준을 쓰지도 보이지도 않는다)
import fs from 'node:fs';
import path from 'node:path';

import golden from '@/data/schools/schoolSearch.golden.json';
import { jamo, normalize, schoolIndex, type SchoolCourse } from '@/data/schools/schoolSearch';

const DATA_DIR = path.resolve(__dirname, '..', '..', '..', '데이터', '학교');

describe('앱 내장 학교 목록(M14 11-5 판)', () => {
  test('판 · 원본 해시가 데이터/학교/school_index.version.txt 한 줄과 같다', () => {
    const line = fs.readFileSync(path.join(DATA_DIR, 'school_index.version.txt'), 'utf8').trim();
    const idx = schoolIndex();
    expect(line).toContain(`version=${idx.version}`);
    expect(line).toContain(`sha256=${idx.sourceSha256}`);
    expect(line).toContain(`rows=${idx.rows.length}`);
  });

  test('수준 칸이 없다: 앱 목록 칸 이름에 tier 가 없고 수준 글자(top · high · mid …)가 값으로 남지 않았다', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'schools', 'schoolIndex.json'), 'utf8')) as { fields: string[]; rows: unknown[][] };
    expect(raw.fields).not.toContain('tier');
    const tierWords = new Set(['top', 'high', 'mid', 'gen', 'remote', 'col', 'ov_top', 'ov_gen']);
    expect(raw.rows.some((r) => r.some((v) => typeof v === 'string' && tierWords.has(v)))).toBe(false);
  });

  test('학점은행 · 독학사 행이 있고 줄임말로 찾힌다', () => {
    const idx = schoolIndex();
    expect(idx.search('학점은행')[0]?.row.key).toBe('X0001');
    expect(idx.search('독학사')[0]?.row.key).toBe('X0002');
  });
});

describe('정규화 · 자모', () => {
  test('띄어쓰기 · 괄호 · 대문자를 무시한다', () => {
    expect(normalize(' 고려대학교(세종) ')).toBe('고려대학교세종');
    expect(normalize('KAIST')).toBe('kaist');
  });
  test('자모로 풀면 쓰는 중인 글자도 앞부분이다', () => {
    expect(jamo('연세대학교').startsWith(jamo('연세대하'))).toBe(true);
  });
});

describe('파이썬 기준 구현과 같은 결과(키 · 단계 · 지금 이름)', () => {
  const idx = schoolIndex();
  const cases = (golden as unknown as { cases: { q: string; courses: SchoolCourse[] | null; out: [string, number, string][] }[] }).cases;
  test('정답 질의가 70개 이상이다', () => expect(cases.length).toBeGreaterThanOrEqual(70));
  test.each(cases.map((c) => [c.q, c.courses ? c.courses.join('') : '-', c] as const))('%s (과정 %s)', (_q, _c, c) => {
    const got = idx.search(c.q, { limit: 10, courses: c.courses ?? undefined }).map((h) => [h.row.key, h.step, h.row.now || h.row.name]);
    expect(got).toEqual(c.out);
  });
});

describe('검색 속도', () => {
  test('한 번 검색이 기기에서 쓸 만한 시간 안이다(시험 기계 기준 평균 60ms 미만)', () => {
    const idx = schoolIndex();
    idx.search('서울');
    const qs = ['ㅅㅇㄷ', '연세대하', '카이스트', '하바드', '관동대학교', '서울대', '부산', '연세대학고'];
    const t0 = Date.now();
    for (const q of qs) idx.search(q);
    expect((Date.now() - t0) / qs.length).toBeLessThan(60);
  });
});
