// F20 카피: 설문 v2 화면 글이 마케팅/카피.md 9장 '→ 개선안'(문항 · 공통 · 시작 · 검토 · 섹션 머리)과 한 글자씩 같고, 글 규칙을 지킨다.
//  · 문항 글(questionCopy.ts): survey.{ID}.q · .help · .opt.{코드} · .low · .high · .publicToggle · .publicText.{값} · .example
//  · 공통 글(copy.ts SV2 · SECTION_COPY): 9장 키 · 4장 공통 · 3장 04(임시 저장 · 순위 버튼 이름) · 화면_요구사항 N03 · N12
//  · 규칙: 느낌표 0 · 사과 말 0 · 합니다체 0 · '등급'은 카피 16-J L-7 세 자리(declineHint · A06 도움말 · 세부사항 머리)만 · '점수' 0
//  · 카피에 아직 없는 글은 PROPOSED 에만 있다(변경기록 '카피 키 제안')
import fs from 'node:fs';
import path from 'node:path';

import { PROPOSED, SECTION_COPY, SV2 } from '@/features/surveyV2/copy';
import { QUESTION_COPY } from '@/features/surveyV2/questionCopy';
import { QUESTIONS } from '@/features/surveyV2/questions';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const copyDoc = fs.readFileSync(path.join(ROOT, '마케팅', '카피.md'), 'utf8').replace(/\r\n/g, '\n');
const reqDoc = fs.readFileSync(path.join(ROOT, '기획', '화면_요구사항.md'), 'utf8').replace(/\r\n/g, '\n');

// 9장 표: 키 칸의 `survey.X.part(.{코드 · …})` → '→ 개선안' 글(여럿이면 ' / ' 로 나뉨)
const from9 = copyDoc.indexOf('## 9. 설문 v2 문구');
const to9 = copyDoc.indexOf('\n## 10. ', from9);
const section9 = copyDoc.slice(from9, to9);
type Cell = { keys: string; text: string };
const cells: Cell[] = section9
  .split('\n')
  .filter((l) => l.startsWith('| ') && !l.startsWith('| 위치') && !l.startsWith('|---'))
  .map((l) => l.split('|').map((x) => x.trim()))
  .map((c) => ({ keys: c[4], text: c[3] }));
const cellOf = (key: string): Cell => {
  const hit = cells.find((c) => c.keys.includes('`' + key));
  if (!hit) throw new Error(`카피 9장에 ${key} 가 없어요`);
  return hit;
};
// 카피.md 전체의 '→ 개선안' 칸(셋째 칸)
const improved = copyDoc
  .split('\n')
  .filter((l) => l.startsWith('| ') && !/^\|\s*-/.test(l))
  .map((l) => l.split('|').map((x) => x.trim())[3] ?? '')
  .join('\n');

describe('문항 글 = 카피 9장', () => {
  test('78문항 모두 질문 글이 있다', () => {
    for (const q of QUESTIONS) expect([q.id, typeof QUESTION_COPY[q.id]?.q]).toEqual([q.id, 'string']);
  });

  test.each(QUESTIONS.map((q) => [q.id]))('%s 질문 · 도움말 · 보기 · 양 끝 · 공개 글 · 예시', (id) => {
    const c = QUESTION_COPY[id];
    expect(c.q).toBe(cellOf(`survey.${id}.q`).text);
    if (c.help) expect(c.help).toBe(cellOf(`survey.${id}.help`).text);
    if (c.example) expect(c.example).toBe(cellOf(`survey.${id}.example`).text);
    if (c.publicToggle) expect(c.publicToggle).toBe(cellOf(`survey.${id}.publicToggle`).text);
    if (c.low) expect(`${c.low} / ${c.high}`).toBe(cellOf(`survey.${id}.low`).text);
    if (c.opt) expect(Object.values(c.opt).join(' / ')).toBe(cellOf(`survey.${id}.opt`).text);
    if (c.publicText) expect(Object.values(c.publicText).join(' / ')).toBe(cellOf(`survey.${id}.publicText`).text);
  });

  test('보기 글이 있는 문항은 CSV 보기 코드마다 글이 있다(학교는 목록 밖 보기만)', () => {
    for (const q of QUESTIONS) {
      if (!['choice', 'bucket', 'multi', 'rankAll', 'rankTop', 'school'].includes(q.format)) continue;
      const opt = QUESTION_COPY[q.id].opt ?? {};
      for (const code of q.codes) expect([q.id, code, typeof opt[code]]).toEqual([q.id, code, 'string']);
    }
  });
});

describe('공통 글 = 카피 9장 · 4장 · 3장 04 · 화면_요구사항', () => {
  const flat: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') flat.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(SV2);
  walk(SECTION_COPY);

  test('글자 그대로 있는 글(고정 글)은 모두 카피.md 개선안 칸 또는 화면_요구사항 N 문구에 있다', () => {
    const lost = flat.filter((t) => !improved.includes(t) && !reqDoc.includes(t));
    expect(lost).toEqual([]);
  });

  test('틀 글(숫자 · 이름이 들어가는 글)은 카피의 틀과 같다', () => {
    expect(cellOf('survey.common.count(n, max)').text).toBe('{n}/{최대} / {지금}/{최대}');
    expect(SV2.common.count(2, 5)).toBe('2/5');
    expect(cellOf('survey.common.progressA11y(n, total)').text).toBe('설문 진행, {n}/{전체}');
    expect(SV2.common.progressA11y(3, 64)).toBe('설문 진행, 3/64');
    expect(SV2.F13pickedA11y('키', 2)).toBe(cellOf('survey.F13.pickedA11y(label, n)').text.replace('{보기}', '키').replace('{n}', '2'));
    expect(`${SV2.F01.younger(3)} / ${SV2.F01.older(5)} / ${SV2.F01.zeroYounger} / ${SV2.F01.zeroOlder}`).toBe(cellOf('survey.F01.younger(n)').text.replace('{n}', '3').replace('{n}', '5'));
    expect(SV2.F02range(160, 180)).toBe('160~180 cm');
    expect(cellOf('survey.F02.range(min, max)').text).toContain('{최소}~{최대} cm');
    expect(SV2.search.oldName('관동대학교')).toBe('(옛 이름 관동대학교)');
    expect(SV2.story.count(2)).toBe('2/3');
    expect(SV2.error.minChars(20)).toBe('20자 이상 써 주세요.');
    expect(SV2.error.maxChars(300)).toBe('300자까지 쓸 수 있어요.');
    expect(SV2.error.maxPick(5)).toBe('5개까지 고를 수 있어요.');
    expect(SV2.rankUp('가족')).toBe('가족 위로 옮기기');
    expect(SV2.rankDown('가족')).toBe('가족 아래로 옮기기');
  });

  test('섹션 이름 · 머리 한 줄 11개가 9장 survey.section.{key} 와 같다', () => {
    for (const [key, v] of Object.entries(SECTION_COPY)) expect(`${v.name} / ${v.lead}`).toBe(cellOf(`survey.section.${key}.name`).text);
  });

  test('A06 "그 외" 안내는 A06 도움말의 둘째 문장 그대로다', () => {
    expect(QUESTION_COPY.A06.help).toContain("'그 외'를 고르면 '그 외'를 고른 분끼리만 추천해요.");
  });
});

describe('글 규칙(카피 1-1 · 16-J L-7)', () => {
  const all: { key: string; text: string }[] = [];
  const walk = (key: string, v: unknown) => {
    if (typeof v === 'string') all.push({ key, text: v });
    else if (typeof v === 'function') all.push({ key, text: String((v as (...a: unknown[]) => unknown)('가', 1, 2)) });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(`${key}.${i}`, x));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(`${key}.${k}`, x));
  };
  walk('SV2', SV2);
  walk('SECTION', SECTION_COPY);
  walk('Q', QUESTION_COPY);
  walk('PROPOSED', PROPOSED);

  test('느낌표 · 사과 말 · 합니다체가 없다', () => {
    expect(all.filter((s) => /[!！]|죄송|미안|양해|(습니다|십시오|합니다|입니다)\.?$/.test(s.text)).map((s) => s.key)).toEqual([]);
  });

  test("'등급'은 L-7 세 자리(declineHint · A06 도움말 · 세부사항 머리)에만, '점수' · 퍼센트는 0", () => {
    expect(all.filter((s) => /등급/.test(s.text)).map((s) => s.key).sort()).toEqual(['Q.A06.help', 'SECTION.appeal.lead', 'SV2.common.declineHint']);
    expect(all.filter((s) => /점수|%|퍼센트|순위|등수/.test(s.text)).map((s) => s.key)).toEqual([]);
  });

  test('카피 키 제안(PROPOSED)은 7개뿐이다(늘면 변경기록 · 마케팅 확인)', () => {
    expect(Object.keys(PROPOSED).sort()).toEqual(['F01older', 'F01younger', 'F02max', 'F02min', 'minusA11y', 'plusA11y', 'rangeError']);
  });
});
