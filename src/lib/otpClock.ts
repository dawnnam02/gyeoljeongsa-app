// 인증번호 시계(K2 02 · 정책 P3-03). 값은 가안이고 S3 가 확정한다(U1).
//  · 인증번호는 보낸 뒤 3분 안에 입력한다. 3분이 지나면 '다시 받을 수 있어요' 안내가 끝나고 [인증번호 받기]가 다시 켜진다
//  · 5번 틀리면 10분 동안 [인증번호 받기]를 막는다
export const OTP_VALID_SECONDS = 180;
export const OTP_LOCK_SECONDS = 600;
export const OTP_LENGTH = 6;

// 남은 초 → '02:59'
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 보낸 시각(ms)과 지금(ms)에서 남은 초(올림). 보낸 적이 없으면 0
export function secondsLeft(sentAt: number | null, now: number): number {
  if (sentAt === null) return 0;
  return Math.max(0, Math.ceil((sentAt + OTP_VALID_SECONDS * 1000 - now) / 1000));
}
