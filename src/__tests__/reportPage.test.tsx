// F14 조건 1 · 16-1 내 성향 리포트(카피 16-M): 구간(0~33 · 34~66 · 67~100)별 해설 15문장, 머리 글 NV11 · NV12, 수정본 우선, 확정 전 빈 상태, 실패.
import { act, type ReactTestRenderer } from 'react-test-renderer';

import { REPORT16 } from '@/content/shopCopy';
import { AXIS_ORDER } from '@/content/traitsContent';
import { bandOf, explainOf, ReportBody } from '@/features/shop/ReportPage';
import type { AiRow, Traits } from '@/types/ai';

import { has, mount, textOf } from './renderHelpers';

jest.mock('@/lib/services', () => ({ aiApi: {} }));

const shown: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const t of shown.splice(0)) t.unmount();
  });
});

const T = (n: number): Traits => ({ extraversion: n, planning: n, family: n, economy: n, conflict: n });
const row = ({ traits, edited, ...over }: Partial<Omit<AiRow, 'edited'>> & { traits?: Traits; edited?: Traits }): AiRow => ({
  id: 'r1',
  status: 'ok',
  source: 'ai',
  retryCount: 0,
  createdAt: null,
  confirmedAt: '2026-10-01T00:00:00Z',
  original: { traits: traits ?? T(50), tags: [], summary: '', evidence: null },
  edited: edited ? { traits: edited, tags: [], summary: '' } : null,
  ...over,
});
const open = async (loadLatest: () => Promise<unknown>) => {
  const tree = await mount(<ReportBody deps={{ ai: { loadLatest } as never }} />);
  shown.push(tree);
  return tree;
};

describe('16-1 내 성향 리포트', () => {
  test('구간 경계: 0~33 낮은 쪽 · 34~66 가운데 · 67~100 높은 쪽, 해설 15문장이 모두 다르다', () => {
    expect([0, 33, 34, 66, 67, 100].map(bandOf)).toEqual([0, 0, 1, 1, 2, 2]);
    const all = AXIS_ORDER.flatMap((k) => REPORT16[k]);
    expect(all).toHaveLength(15);
    expect(new Set(all).size).toBe(15);
    expect(explainOf('planning', 10)).toBe(REPORT16.planning[0]);
    expect(explainOf('planning', 50)).toBe(REPORT16.planning[1]);
    expect(explainOf('planning', 90)).toBe(REPORT16.planning[2]);
  });

  test('AI 결과: NV11 · 막대 5 · 막대 아래 한 줄 · 소제목 · 축마다 해설 한 문장', async () => {
    const tree = await open(async () => ({ ok: true, row: row({ traits: { extraversion: 20, planning: 50, family: 80, economy: 33, conflict: 67 } }) }));
    expect(textOf(tree, 'report-note')).toBe('AI가 정리하고 내가 확정한 성향이에요.');
    for (const k of AXIS_ORDER) expect(has(tree, `report-bar-${k}`)).toBe(true);
    expect(textOf(tree, 'report-bar-note')).toBe('숫자가 높거나 낮다고 좋고 나쁜 건 아니에요.');
    expect(textOf(tree, 'report-explain-title')).toBe('말로 풀어 보면');
    expect(textOf(tree, 'report-explain-extraversion')).toBe(REPORT16.extraversion[0]);
    expect(textOf(tree, 'report-explain-planning')).toBe(REPORT16.planning[1]);
    expect(textOf(tree, 'report-explain-family')).toBe(REPORT16.family[2]);
    expect(textOf(tree, 'report-explain-economy')).toBe(REPORT16.economy[0]);
    expect(textOf(tree, 'report-explain-conflict')).toBe(REPORT16.conflict[2]);
  });

  test('직접 입력은 NV12 · 수정본이 있으면 수정본 값으로 해설', async () => {
    const tree = await open(async () => ({ ok: true, row: row({ source: 'manual', traits: T(10), edited: T(90) }) }));
    expect(textOf(tree, 'report-note')).toBe('직접 입력해 확정한 성향이에요.');
    expect(textOf(tree, 'report-explain-conflict')).toBe(REPORT16.conflict[2]);
  });

  test('확정 전(confirmedAt 없음)이거나 결과가 없으면 해설을 그리지 않는다 · 읽기 실패는 다시 시도', async () => {
    const none = await open(async () => ({ ok: true, row: row({ confirmedAt: null }) }));
    expect(has(none, 'report-body')).toBe(false);
    expect(has(none, 'report-empty')).toBe(true);
    const bad = await open(async () => ({ ok: false, reason: 'server' }));
    expect(has(bad, 'report-retry')).toBe(true);
  });
});
