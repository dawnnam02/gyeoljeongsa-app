// 만남 장면 시간표(연출 ④ '예능 결' — 디자인 D46_만남장면/원본/page.js TL.cine 를 시각 t 하나의 순수 함수로). 값은 theme/motion.ts scene2.meet 한 곳.
//  · 화면은 공유 값 t(ms) 하나를 0 → total 로 곧게 흘리고, 부품마다 이 함수들로 transform · opacity 를 셈한다(worklet — UI 스레드)
//  · 거리는 장면 좌표(폭 360) 단위다. 화면 px 은 부르는 쪽이 배율 s(= 그림 폭 / 360)를 곱한다
//  · 곡선은 theme/motion.ts ease 이름만(edOut · edInOut · std · in). 새 곡선 0
import { ease, scene2, type EaseName } from '@/theme/motion';

const M = scene2.meet;

// cubic-bezier(x1, y1, x2, y2) 의 x → y(뉴턴 8번 + 모자라면 반 나누기)
export function cubic(x1: number, y1: number, x2: number, y2: number, x: number): number {
  'worklet';
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let u = x;
  for (let i = 0; i < 8; i += 1) {
    const xu = ((ax * u + bx) * u + cx) * u - x;
    const d = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(xu) < 1e-6 || Math.abs(d) < 1e-6) break;
    u -= xu / d;
  }
  if (u < 0 || u > 1 || Math.abs(((ax * u + bx) * u + cx) * u - x) > 1e-4) {
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < 40; i += 1) {
      const xu = ((ax * u + bx) * u + cx) * u;
      if (Math.abs(xu - x) < 1e-6) break;
      if (xu < x) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
  }
  return ((ay * u + by) * u + cy) * u;
}

// 구간 진행: start 전 0 · start + dur 뒤 1 · 사이는 곡선
export function seg(t: number, start: number, dur: number, name: EaseName = 'edOut'): number {
  'worklet';
  if (t <= start) return 0;
  if (t >= start + dur) return 1;
  const [x1, y1, x2, y2] = ease[name];
  return cubic(x1, y1, x2, y2, (t - start) / dur);
}

// ── 장면 ──
export const sceneIn = (t: number) => {
  'worklet';
  return seg(t, 0, M.in, 'std');
};
export const artIn = (t: number) => {
  'worklet';
  return seg(t, 0, M.art, 'std');
};
export const camScale = (t: number) => {
  'worklet';
  return 1 + (M.camTo - 1) * seg(t, 0, M.cam, 'std');
};
// 대화방으로: 장면 덮개가 위에서부터 걷힌다(0 → 1)
export const handoff = (t: number) => {
  'worklet';
  return seg(t, M.handoff, M.handoffFor, 'edOut');
};

// ── 걸어오는 사람(bS · bSb · lgL/lgR · bSs) ──
export const walkX = (t: number) => {
  'worklet';
  return (1 - seg(t, M.walk, M.walkFor, 'std')) * M.walkFrom;
};
// 몸 위아래: 걸음 하나(500)마다 0 → -2.5 → 0(std)
export const bobY = (t: number) => {
  'worklet';
  if (t <= M.walk || t >= M.walk + M.walkFor) return 0;
  const q = ((t - M.walk) % M.bob) / M.bob;
  const [x1, y1, x2, y2] = ease.std;
  const e = cubic(x1, y1, x2, y2, q);
  return -M.bobLift * (1 - Math.abs(2 * e - 1));
};
// 다리: 1000 마다 0 → a → 0 → -a → 0(곧게) · 1.5번
export const legDeg = (t: number, a: number) => {
  'worklet';
  if (t <= M.walk || t >= M.walk + M.walkFor) return 0;
  const q = ((t - M.walk) % M.step) / M.step;
  if (q < 0.25) return (a * q) / 0.25;
  if (q < 0.5) return a * (1 - (q - 0.25) / 0.25);
  if (q < 0.75) return (-a * (q - 0.5)) / 0.25;
  return -a * (1 - (q - 0.75) / 0.25);
};
// 선 모습이 사라짐(앉음): 투명도 1 → 0 · 아래로 18
export const standOut = (t: number) => {
  'worklet';
  return seg(t, M.sit, M.standOut, 'in');
};
// 앉은 모습이 나타남: 투명도 0 → 1 · 위 16 → 0
export const sitIn = (t: number) => {
  'worklet';
  return seg(t, M.sit + M.sitDelay, M.sitIn, 'edOut');
};

// ── 먼저 앉은 사람의 컵(fa · pr) ──
export const cupDeg = (t: number) => {
  'worklet';
  return M.cupFrom * (1 - seg(t, M.cup, M.cupFor, 'edInOut')) + 0; // + 0: 끝에서 -0 이 아닌 0
};
// 컵은 팔꿈치 기준으로 돈 팔 끝에서 똑바로 — 손 자리가 옮겨 간 만큼만 이동(vx, vy = 손 - 팔꿈치)
export const cupShift = (deg: number, vx: number, vy: number): readonly [number, number] => {
  'worklet';
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [vx * c - vy * s - vx, vx * s + vy * c - vy];
};

// ── 시선(눈 · 코 · 입만 옆으로) ──
export const lookB = (t: number) => {
  'worklet';
  return seg(t, M.lookB, M.look, 'edOut');
};
export const lookA = (t: number) => {
  'worklet';
  return seg(t, M.lookA, M.look, 'edOut');
};

// ── 빛(저녁 빛 + 가장자리 어둠 한 층) ──
export const lightO = (t: number) => {
  'worklet';
  return M.lightFrom + (1 - M.lightFrom) * seg(t, M.light, M.lightFor, 'std');
};

// ── 글(자막 카드 · 끝 줄) ──
// 카드 묶음: 2초 머문 뒤 옅어짐. 정지 그림(동작 줄이기 · 화면 읽기)에서는 늘 보인다
export const cardKeep = (t: number, still: boolean) => {
  'worklet';
  return still ? 1 : 1 - seg(t, M.card + M.cardHold, M.cardOut, 'in');
};
export const cardIn = (t: number) => {
  'worklet';
  return seg(t, M.card, M.cardIn, 'edOut');
};
export const ruleIn = (t: number) => {
  'worklet';
  return seg(t, M.card + M.ruleDelay, M.rule, 'edOut');
};
export const cardLine = (t: number, i: 0 | 1) => {
  'worklet';
  return seg(t, M.card + (i === 0 ? M.line1Delay : M.line2Delay), M.maskIn, 'edOut');
};
export const endLineIn = (t: number) => {
  'worklet';
  return seg(t, M.line, M.maskIn, 'edOut');
};
