// 토스트 글 규칙(R1 A⑦ · T04 · K15 3장 4번 · 카피.md 1장 1-1 '토스트'). 보이는 시간은 F17 이 움직임 토큰에 둔 값 하나를 그대로 쓴다(theme/motion.ts TOAST_MS = 5초, 팀장 결정 10-17).
//  · 지금 09 · 10 · 11 은 3.5초, 16 은 3.0초, 12 는 2.5초를 따로 쓴다 → 2단계에 각 화면 주인이 TOAST_MS 로 바꾼다(app/R1_A⑦_변경기록.md 3장)
//  · 글은 40자 이하 · 두 문장까지. 다시 해야 하는 오류(저장 · 보내기 · 결제 실패)는 토스트로 끝내지 않고 칸 아래 · 시트 안에 남긴다(카피.md 1-1)
export { TOAST_MS } from '@/theme/motion';

export const TOAST_MAX_CHARS = 40;
export const TOAST_MAX_SENTENCES = 2;

const sentences = (text: string) => text.split(/(?<=[.?])\s+/).filter((s) => s.trim() !== '');

// 토스트로 써도 되는 글인가(길이 · 문장 수). check:copy R7 과 같은 규칙
export const toastFits = (text: string): boolean => Array.from(text).length <= TOAST_MAX_CHARS && sentences(text).length <= TOAST_MAX_SENTENCES;
