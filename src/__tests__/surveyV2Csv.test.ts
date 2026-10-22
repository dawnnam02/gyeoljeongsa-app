// F20 조건 1: 설문 v2 문항 정의가 원본 CSV(기획/설문_v2_문항표.csv)와 한 칸씩 같다(설문_인수조건 A-1 · A-2 · A-4 정신: CSV 가 원본).
//  화면 04 의 78행: 순서 · ID · 섹션 · 형식 · 보기 코드 · 필수 · 공개 범위 · 토글 열 · '말하고 싶지 않아요' · 글자/숫자 범위
import fs from 'node:fs';
import path from 'node:path';

import { FLOW, STORY, APPEAL } from '@/features/surveyV2/model';
import { QUESTIONS } from '@/features/surveyV2/questions';

const CSV = path.resolve(__dirname, '..', '..', '..', '기획', '설문_v2_문항표.csv');

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^﻿/, '')).filter((r) => r['화면'] === '04');
const SEC: Record<string, string> = { 기본: 'basic', 학력: 'edu', 직업: 'job', 경제: 'money', 가족: 'family', 생활: 'life', 가치관: 'values', 결혼관: 'marriage', '희망 조건': 'wish', '결혼 이야기': 'story', 세부사항: 'appeal' };
const VIS: Record<string, string> = { 나만: 'private', '구간 공개': 'bucket', 공개: 'public' };
function formatOf(r: Record<string, string>): string {
  const f = r['형식'];
  const v = r['변형'];
  if (f === '하나 고르기') return v === '지역 2단' ? 'region' : 'choice';
  if (f.startsWith('검색')) return 'school';
  if (f === '여러 개') return 'multi';
  if (f === '구간') return 'bucket';
  if (f === '슬라이더') return ({ '5단계': 'scale5', '숫자 하나': 'number', 양끝: 'range' } as Record<string, string>)[v];
  if (f === '순위') return ({ 전부: 'rankAll', '상위 3개': 'rankTop' } as Record<string, string>)[v];
  return ({ '한 줄': 'line', '여러 줄': 'para', '질문 카드': 'story', '어필 카드': 'appeal' } as Record<string, string>)[v];
}

describe('설문 v2 문항 = CSV 화면 04 의 78행', () => {
  test('78행 · 필수 흐름 64(9섹션) · 결혼 이야기 8 · 세부사항 6', () => {
    expect(rows).toHaveLength(78);
    expect(QUESTIONS).toHaveLength(78);
    expect(FLOW).toHaveLength(64);
    expect(STORY).toHaveLength(8);
    expect(APPEAL).toHaveLength(6);
  });

  test('순서 · ID · 섹션 · 형식이 같다', () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual(rows.map((r) => r['문항ID']));
    expect(QUESTIONS.map((q) => q.section)).toEqual(rows.map((r) => SEC[r['섹션']]));
    expect(QUESTIONS.map((q) => q.format)).toEqual(rows.map(formatOf));
  });

  test('보기 코드(null = decline)가 같다', () => {
    for (const [i, q] of QUESTIONS.entries()) {
      const r = rows[i];
      if (!['choice', 'bucket', 'multi', 'rankAll', 'rankTop', 'school'].includes(q.format)) continue;
      const want = r['선택지 코드'].split(' / ').filter((c) => !c.startsWith('{')).map((c) => (c === 'null' ? 'decline' : c));
      expect([q.id, ...q.codes]).toEqual([q.id, ...want]);
    }
  });

  test('필수 · 공개 범위 · 토글 열 · 말하고 싶지 않아요가 같다', () => {
    for (const [i, q] of QUESTIONS.entries()) {
      const r = rows[i];
      expect([q.id, q.required]).toEqual([q.id, r['필수'].startsWith('예')]);
      expect([q.id, q.vis]).toEqual([q.id, VIS[r['공개 범위']]]);
      const tog = r['본인 끄기(토글)'] === '-' ? null : r['본인 끄기(토글)'].replace(/\(.*$/, '').trim();
      expect([q.id, q.toggle]).toEqual([q.id, tog]);
      expect([q.id, q.decline]).toEqual([q.id, r['말하고 싶지 않아요'] === '예']);
    }
  });

  test('글자 수 · 숫자 범위가 CSV 선택지 칸과 같다', () => {
    for (const [i, q] of QUESTIONS.entries()) {
      const m = /(\d+)~(\d+)/.exec(rows[i]['선택지']);
      if (['line', 'para', 'story', 'appeal', 'number'].includes(q.format)) expect([q.id, q.min, q.max]).toEqual([q.id, Number(m?.[1]), Number(m?.[2])]);
    }
  });

  test("'말하고 싶지 않아요'는 7문항(A07 A08 C05 C06 D04 D08 D09), 종교 A06 · F07 에는 없다", () => {
    expect(QUESTIONS.filter((q) => q.decline).map((q) => q.id).sort()).toEqual(['A07', 'A08', 'C05', 'C06', 'D04', 'D08', 'D09']);
    expect(QUESTIONS.find((q) => q.id === 'A06')?.required).toBe(true);
    expect(QUESTIONS.find((q) => q.id === 'A06')?.codes).toContain('none'); // 무교 포함
  });
});
