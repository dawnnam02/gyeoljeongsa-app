// 06 AI 정리 중의 시간 규칙(순수 함수). 원본: 기획/화면_요구사항.md 06, ai/설계.md 9·14장.
//  상태 확인 3초 간격 · 60초가 넘으면 "평소보다 오래 걸리고 있어요" · 120초 안에 결과가 없으면 실패로 본다(서버는 105초 안에 끝낸다)
//  서버가 단계를 알려 주지 않으므로 진행바와 단계 글은 시간에 맞춰 움직인다.
export const POLL_INTERVAL_MS = 3_000;
export const SLOW_AFTER_MS = 60_000;
export const GIVE_UP_AFTER_MS = 120_000;
export const RETRY_LOCK_MS = 3_000; // [다시 시도]를 누른 뒤 3초 동안은 다시 눌러도 요청이 늘지 않는다

export const STEP_COUNT = 3;
// 0~20초 정리 · 20~40초 성향 파악 · 40초 뒤 중요도 제안
export const STEP_LENGTH_MS = 20_000;

export const isSlow = (elapsedMs: number): boolean => elapsedMs >= SLOW_AFTER_MS;
export const isGiveUp = (elapsedMs: number): boolean => elapsedMs >= GIVE_UP_AFTER_MS;

export function currentStep(elapsedMs: number): number {
  return Math.min(STEP_COUNT - 1, Math.max(0, Math.floor(elapsedMs / STEP_LENGTH_MS)));
}

// 진행바 채움 비율(0~1). 60초에 가까워질수록 느리게 차오르고 95% 에서 멈춘다(끝나기 전에는 가득 차지 않는다)
export function progressRatio(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / SLOW_AFTER_MS;
  return Math.min(0.95, 0.05 + 0.9 * (1 - Math.exp(-2 * t)) / (1 - Math.exp(-2)));
}
