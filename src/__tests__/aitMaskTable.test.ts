/**
 * @jest-environment node
 */
// AI-FIX10 ③ 연락처 가리기 공통 입출력 표(백엔드 시험/mask_cases.json 36줄: base 8 · q226b 13 · keep 15).
// 서버 함수가 쓰는 앱 사본 둘(src/server/ait/text.ts · src/saju5/ait/text.ts)이 백엔드 기준 구현(backend/functions/_shared/ai/mask.ts)과 같은 입력에 같은 출력 · 같은 횟수를 낸다.
// 정규식 글자가 아니라 입출력으로 약속한다 — 사본이 어긋나면 이 표의 한 줄씩 맞춘다. 표는 AI 원본 쪽 고정 복사본(ai/AIT/ts/tests/fixtures/mask_cases.json)과 백엔드 원본 둘 다 읽어 같은지도 본다.
import fs from 'node:fs';
import path from 'node:path';

import { maskText as saju5Mask } from '@/saju5/ait/text';
import { maskText as serverMask } from '@/server/ait/text';

interface Row { id: string; group: 'base' | 'q226b' | 'keep'; in: string; out: string; count: number }
const root = path.join(__dirname, '..', '..', '..');
const FIXTURE = path.join(root, 'ai', 'AIT', 'ts', 'tests', 'fixtures', 'mask_cases.json');
const BACKEND = path.join(root, 'backend', '시험', 'mask_cases.json');
const read = (f: string): { cases: Row[] } => JSON.parse(fs.readFileSync(f, 'utf8'));
const table = read(fs.existsSync(BACKEND) ? BACKEND : FIXTURE);

describe('가리기 공통 표 36줄', () => {
  test('표 모양: 36줄 = base 8 + q226b 13 + keep 15 (오탐 점검 15줄 포함)', () => {
    expect(table.cases).toHaveLength(36);
    expect((['base', 'q226b', 'keep'] as const).map((g) => table.cases.filter((c) => c.group === g).length)).toEqual([8, 13, 15]);
  });

  test.each([
    ['서버 함수 사본(src/server/ait/text.ts)', serverMask],
    ['사주 화면 쪽 사본(src/saju5/ait/text.ts)', saju5Mask],
  ])('%s: 36줄 모두 같은 출력 · 같은 횟수', (_name, mask) => {
    for (const c of table.cases) {
      const r = mask(c.in, {});
      expect({ id: c.id, text: r.text, count: r.count }).toEqual({ id: c.id, text: c.out, count: c.count });
    }
  });

  test('멀쩡한 문장 15줄(keep)은 그대로 · 가린 횟수 0 — 두 사본 모두', () => {
    for (const c of table.cases.filter((x) => x.group === 'keep')) {
      for (const mask of [serverMask, saju5Mask]) {
        const r = mask(c.in, {});
        expect([c.id, r.text, r.count]).toEqual([c.id, c.in, 0]);
      }
    }
  });

  test('백엔드 표 원본과 AI 쪽 고정 복사본이 같다(어느 한쪽만 고쳐지지 않았는지)', () => {
    if (!fs.existsSync(BACKEND) || !fs.existsSync(FIXTURE)) return;
    expect(read(FIXTURE).cases).toEqual(read(BACKEND).cases);
  });
});
