/**
 * @jest-environment node
 */
// AI-FIX10 ③ 연락처 가리기 공통 입출력 표(백엔드 시험/mask_cases.json 36줄: base 8 · q226b 13 · keep 15) + AI-FIX11 RS2-03 나쁜 입력 줄(redos: 긴 공백 · 줄바꿈 · 탭 · 같은 글자 반복 · 붙은 이메일).
// 서버 함수가 쓰는 앱 사본 둘(src/server/ait/text.ts · src/saju5/ait/text.ts)이 백엔드 기준 구현(backend/functions/_shared/ai/mask.ts)과 같은 입력에 같은 출력 · 같은 횟수를 낸다.
// 정규식 글자가 아니라 입출력으로 약속한다 — 사본이 어긋나면 이 표의 한 줄씩 맞춘다. 표는 AI 원본 쪽 고정 복사본(ai/AIT/ts/tests/fixtures/mask_cases.json)과 백엔드 원본 둘 다 읽어 같은지도 본다.
import fs from 'node:fs';
import path from 'node:path';

import { maskText as saju5Mask } from '@/saju5/ait/text';
import { maskText as serverMask } from '@/server/ait/text';

// 시간 단정은 벽시계 한 번으로 판정하지 않는다(AI-FIX11 보강): 문턱을 넘긴 표본만 간격을 두고 다시 재서 가장 작은 값으로 판정하고, 증가 비율도 본다.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const onceMs = (run: () => unknown): number => { const t0 = performance.now(); run(); return performance.now() - t0; };
async function stableMs(run: () => unknown, limit: number, tries = 8, gapMs = 25): Promise<number> {
  let best = Infinity;
  for (let i = 0; i < tries; i++) {
    best = Math.min(best, onceMs(run));
    if (best < limit) return best;
    await sleep(gapMs);
  }
  return best;
}
// 한 번 돌리는 데 쓴 CPU 시간(ms) — 벽시계가 아니라 CPU 시간이라 다른 작업이 CPU 를 나눠 써도 거의 안 부푼다. 이 PC(Windows)의 눈금이 약 15ms 라 같은 계산을 250ms 어치 되풀이해 평균을 낸다.
function cpuMs(run: () => unknown, targetMs = 250): number {
  const w0 = performance.now();                                       // 먼저 약 40ms 데운다(버림) — 정규식 컴파일 · JIT 가 끝나기 전의 느린 첫 몇 번이 되풀이 횟수를 잘못 잡게 하지 않으려고
  for (let n = 0; n < 3 || performance.now() - w0 < 40; n++) run();
  let tw = Infinity;
  for (let i = 0; i < 3; i++) tw = Math.min(tw, onceMs(run));
  const reps = Math.max(1, Math.min(200_000, Math.ceil(targetMs / Math.max(tw, 0.005))));
  const c0 = process.cpuUsage();
  for (let i = 0; i < reps; i++) run();
  const c = process.cpuUsage(c0);
  return (c.user + c.system) / 1000 / reps;
}

interface Row { id: string; group: 'base' | 'q226b' | 'keep' | 'redos'; in: string; out: string; count: number }
const root = path.join(__dirname, '..', '..', '..');
const FIXTURE = path.join(root, 'ai', 'AIT', 'ts', 'tests', 'fixtures', 'mask_cases.json');
const BACKEND = path.join(root, 'backend', '시험', 'mask_cases.json');
const read = (f: string): { cases: Row[] } => JSON.parse(fs.readFileSync(f, 'utf8'));
const table = read(fs.existsSync(BACKEND) ? BACKEND : FIXTURE);

describe('가리기 공통 표 36줄 + 나쁜 입력 줄', () => {
  test('표 모양: 앞 36줄 = base 8 + q226b 13 + keep 15 (오탐 점검 15줄 포함) 그대로, 나쁜 입력 줄(redos)이 더해졌다', () => {
    expect(table.cases.filter((c) => c.group !== 'redos')).toHaveLength(36);
    expect((['base', 'q226b', 'keep'] as const).map((g) => table.cases.filter((c) => c.group === g).length)).toEqual([8, 13, 15]);
    expect(table.cases.filter((c) => c.group === 'redos').length).toBeGreaterThanOrEqual(15);
  });

  test.each([
    ['서버 함수 사본(src/server/ait/text.ts)', serverMask],
    ['사주 화면 쪽 사본(src/saju5/ait/text.ts)', saju5Mask],
  ])('%s: 표 모든 줄(앞 36줄 + 나쁜 입력 줄) 같은 출력 · 같은 횟수', (_name, mask) => {
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

  test.each([
    ['서버 함수 사본', serverMask],
    ['사주 화면 쪽 사본', saju5Mask],
  ])('%s: 나쁜 입력(RS2-03 재현 — 카톡 + 공백 590칸, 소띠 + 공백 600칸, 3시 + 공백 2,000칸 …)이 maskText 전체 50ms 안 — 느리게 나오면 간격 두고 다시 재서 가장 빠른 값', async (_name, mask) => {
    const bad = ['카톡' + ' '.repeat(590) + '!', '카톡' + '\n'.repeat(300) + 'x', '소띠' + ' '.repeat(600) + 'x', '소띠' + ' '.repeat(2000) + 'x', '3시' + ' '.repeat(2000) + 'x', '생시' + ' '.repeat(2000) + 'x', 'a.'.repeat(1000), '1-'.repeat(1000), '공 '.repeat(1000)];
    for (const s of bad) {
      const ms = await stableMs(() => mask(s, {}), 50);
      expect([s.slice(0, 6), ms < 50]).toEqual([s.slice(0, 6), true]);
    }
  });

  test.each([
    ['서버 함수 사본', serverMask],
    ['사주 화면 쪽 사본', saju5Mask],
  ])('%s: 길이를 2배씩 늘려도(125 → 2,000자) 나쁜 입력 시간이 선형이다(증가 비율 ≤ 3.4배 — 이메일 꼴 덩어리는 알려진 n² 이라 제외). CPU 시간으로 4번 다시 재도 넘을 때만 실패', async (_name, mask) => {
    const triggers = ['', '카톡', '카톡 아이디', '소띠', '85년', '3시', '생시', '태어난 시간'];
    const units = [' ', '\n', '1 '];
    const lengths = [125, 250, 500, 1000, 2000];
    const bad: string[] = [];
    for (const t of triggers) {
      for (const u of units) {
        const mk = (len: number) => t + u.repeat(Math.ceil(len / u.length)).slice(0, len) + '!';
        let prev = 0;
        for (let i = 0; i < lengths.length; i++) {
          const cur = onceMs(() => mask(mk(lengths[i]), {}));
          if (cur > 400) { bad.push(`${JSON.stringify(t)}+${JSON.stringify(u)} ${lengths[i]}자 ${cur.toFixed(0)}ms`); break; }
          if (i > 0 && cur >= 0.25 && cur / Math.max(prev, 0.01) > 3.4) {
            let exceeded: string | null = null;
            for (let attempt = 0; attempt < 4; attempt++) {         // CPU 가 꽉 찬 PC 에서는 한 번 틀어질 수 있다 — CPU 시간으로 다시 재서 한 번이라도 선형이면 통과
              const big = cpuMs(() => mask(mk(lengths[i]), {}));
              if (big < 0.25) { exceeded = null; break; }
              const small = cpuMs(() => mask(mk(lengths[i - 1]), {}));
              if (big / Math.max(small, 0.001) <= 3.4) { exceeded = null; break; }
              exceeded = `${JSON.stringify(t)}+${JSON.stringify(u)} ${lengths[i - 1]}→${lengths[i]}자 CPU ${small.toFixed(2)}→${big.toFixed(2)}ms`;
              await sleep(40);
            }
            if (exceeded) { bad.push(exceeded); break; }
          }
          prev = cur;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test('백엔드 표 원본과 AI 쪽 고정 복사본이 같다(어느 한쪽만 고쳐지지 않았는지)', () => {
    if (!fs.existsSync(BACKEND) || !fs.existsSync(FIXTURE)) return;
    expect(read(FIXTURE).cases).toEqual(read(BACKEND).cases);
  });
});
