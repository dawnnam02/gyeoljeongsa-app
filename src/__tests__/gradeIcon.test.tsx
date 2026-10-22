// W9 · D-154 등급 아이콘(1안 여행지 풍경): 9 모양이 서로 다름 · 숫자 · 순서 말 0 · 서버 키가 오면 그 키를 쓴다 · 점검 규칙(check:grade)이 숫자 글을 잡는다
import fs from 'node:fs';
import path from 'node:path';

import { GRADE_ICON_KEYS, GRADE_ICON_PARTS, GradeIcon, MyFlock, gradeIconName } from '@/features/grade/GradeIcon';
import { iconOf } from '@/features/grade/iconBridge';
import { GI } from '@/features/grade/iconCopy';

import { allTexts, has, mount, must, textOf } from './renderHelpers';

const ORDER_WORDS = /\d\s*(?:등급|단계|번째)|일곱|아홉|단계|위 등급|아래 등급|높|낮|올리|내려|작을수록|순위|첫째|마지막/;

describe('풍경 아이콘 9개', () => {
  test('키 9개 · 이름 9개 · 그림 9개가 모두 서로 다르다(같은 색 · 같은 굵기, 모양으로만 가름)', () => {
    expect(GRADE_ICON_KEYS).toHaveLength(9);
    expect(new Set(GRADE_ICON_KEYS.map(gradeIconName)).size).toBe(9);
    expect(new Set(GRADE_ICON_KEYS.map((k) => JSON.stringify(GRADE_ICON_PARTS[k].parts))).size).toBe(9);
    expect(GRADE_ICON_KEYS.map(gradeIconName)).toEqual(['바다', '산', '달', '구름', '섬', '다리', '숲', '해', '들판']); // 디자인 V5 시안 SETS[0]
  });

  test('풍경 이름 · 화면 글(GI)에 숫자 · 순서 말이 없다', () => {
    for (const k of GRADE_ICON_KEYS) expect(gradeIconName(k)).not.toMatch(ORDER_WORDS);
    for (const [key, v] of Object.entries(GI)) {
      const text = typeof v === 'function' ? (v as (...a: string[]) => string)('10월 14일', '바다') : v;
      expect([key, text.replace('10월 14일', '')]).not.toEqual([key, expect.stringMatching(ORDER_WORDS)]);
    }
  });

  test('모르는 키 · 번호 없음이면 아무것도 그리지 않는다', async () => {
    const tree = await mount(<GradeIcon icon={'gold' as never} testID="x" />);
    expect(tree.toJSON()).toBeNull();
    const none = await mount(<MyFlock icon={null} />);
    expect(none.toJSON()).toBeNull();
  });

  test('임시 다리: 서버가 풍경 키를 주면 그 키, 아니면 데모 가정 짝(번호는 화면에 나오지 않음)', () => {
    expect(iconOf('moon', 4)).toBe('moon');
    expect(iconOf(undefined, 4)).toBe('bridge');
    expect(iconOf(undefined, 0)).toBeNull();
    expect(iconOf('xx', null)).toBeNull();
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => iconOf(undefined, n))).size).toBe(9);
  });
});

describe('내 무리(시안 p8)', () => {
  test('타일 아이콘 + 내 무리 · 풍경 이름 · 한 줄 + 같은 모양 무리 7 + 나만 보여요, 숫자 글 0', async () => {
    const tree = await mount(<MyFlock icon="sea" />);
    expect(textOf(tree, 'my-flock-name')).toBe('바다');
    expect(textOf(tree, 'my-flock-line')).toBe(GI.flockLine);
    expect(textOf(tree, 'my-flock-note')).toBe(GI.flockNote);
    expect(must(tree, 'my-flock-mine').props.accessibilityLabel).toBe('내 무리 아이콘, 바다');
    expect(has(tree, 'my-flock-icon-sea')).toBe(true);
    const flock = must(tree, 'my-flock-flock');
    expect(flock.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(allTexts(tree).join(' ')).not.toMatch(/\d|등급/);
  });
});

describe('check:grade 규칙', () => {
  // 스크립트는 .mjs 라 jest 에서 바로 부르지 않고 규칙 글을 같은 식으로 확인한다
  const src = fs.readFileSync(path.join(__dirname, '../../scripts/check-grade-icon.mjs'), 'utf8');
  test('숫자 등급 · 순서 말 · 숫자 그림 · 숫자 카피 함수를 잡는 규칙이 있고, 등급 표시 부품은 0 이어야 한다', () => {
    expect(src).toContain("const STRICT_DIRS = ['features/grade/']");
    for (const piece of ['\\d\\s*등급', '숫자가 작을수록', 'TIER_BADGES', 'BADGE16\\.(?:chip']) expect(src).toContain(piece);
  });
  test('등급 표시 부품 파일에는 숫자 등급 글 · 숫자 그림이 없다', () => {
    const dir = path.join(__dirname, '../features/grade');
    for (const f of fs.readdirSync(dir)) {
      const body = fs
        .readFileSync(path.join(dir, f), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
      expect([f, /\d\s*등급|\$\{[^}]*\}\s*등급|숫자가 작을수록|\bTIER_BADGES\b/.test(body)]).toEqual([f, false]);
    }
  });
});
