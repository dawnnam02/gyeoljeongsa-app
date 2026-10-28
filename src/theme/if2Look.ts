// 기내 서비스 · 연애 기능 화면 치수(IF2-F · 디자인 IF2-D 안 1 · 6칸 ①). 색은 tokens · 그림 색은 에셋(assets/illustrations/if2art.json) 안에만
import { space } from './tokens';

export const if2Look = {
  cellMinH: 104, // 블록 안 칸 높이 104 ~ 112(디자인 안 1)
  cellMaxH: 112,
  cellIcon: 24,
  foldRowH: 56, // 접힘 줄(B7) 높이
  pocketArtW: 72, // 주머니 소품 그림 72 × 68(원본 pocket_*)
  pocketArtH: 68,
  tarotW: 96, // 이번 주 카드 세 장(원본 120 × 180 비율)
  tarotH: 144,
  tarotBigW: 160,
  tarotBigH: 240,
  artRatio: 320 / 200, // 표지 · 여행지 · 타입 엽서 앞 그림 칸
  stampW: 64,
  chipGap: space.s8,
  sheetGap: space.s12,
  flipMs: 600, // 카드 뒤집기 · 기내지 넘김 · 질문 카드 펼침 1초 안(C3)
  reduceMs: 150, // 동작 줄이기면 투명도 150 만
} as const;
