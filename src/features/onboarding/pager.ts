// 01 온보딩 소개 3장을 넘기는 계산. 점을 누르거나 좌우로 밀면 장이 바뀐다. 자동으로 넘기지 않는다(K2 01).

// 장 번호를 한 칸 옮긴다(처음 · 끝에서는 그 자리에 머문다)
export function stepIndex(index: number, delta: -1 | 1, total: number): number {
  return Math.min(total - 1, Math.max(0, index + delta));
}

// 손가락이 가로로 dx(px) 움직였을 때 어느 쪽으로 넘기나. 왼쪽으로 밀면 다음 장(+1), 오른쪽으로 밀면 이전 장(-1). distance 보다 적게 움직이면 0
export function swipeDelta(dx: number, distance: number): -1 | 0 | 1 {
  if (dx <= -distance) return 1;
  if (dx >= distance) return -1;
  return 0;
}
