// 탑승객 라운지 치수 · 움직임 값(LG-D 확정 1A ~ 5A · 디자인/LG_라운지/비교.html). 색은 tokens.ts 10개와 투명도만(새 색 0).
//  화면 코드는 숫자를 직접 쓰지 않고 여기서 가져다 쓴다(check:tokens C).
import { dur, scene2 } from './motion';
import { size, space } from './tokens';

export const loungeLook = {
  // 자리 1 · T4 라운지 줄(1A 쪽지 미감): 줄 높이 88 · 오른쪽 쪽지 칸 88 · 쪽지 안 빈 좌석 칸 32
  rowHeight: 88,
  stubWidth: 88,
  stubSeatBox: 32,
  perforation: 1, // 절취선(점선) 굵기
  notch: 12, // 절취선 위 · 아래 반원 홈 지름
  // 자리 1 · 쪽지 뜯기(400 edOut): 오른쪽으로 22 · 왼쪽 아래 기준 +5° · 끝 160ms 투명. 동작 줄이기면 투명도 150만
  tear: { ms: 400, dx: 22, deg: 5, fadeMs: 160 },
  // 배정 장면 · 좌석표(2A 위에서 본 기체): 칸 22 × 20 · 사이 4 · 통로 16 · 내 자리 점 6 · 다른 자리 선 55%
  seatW: 22,
  seatH: 20,
  seatGap: 4,
  aisle: 16,
  myDot: 6,
  otherSeatOpacity: 0.55,
  fuselagePad: space.s16,
  // 자리 3 · 말풍선(3A 쪽지 꼬리표): 꼬리표 높이 24 · 공감 · ⋯ 알약 보이는 높이 32(누르는 자리 48)
  tagHeight: 24,
  pillHeight: 32,
  touch: size.touchMin,
  // 기장 쪽지 점선 · 쪽지 폭
  dash: 1,
  captainMaxWidth: 320,
  // 자리 5 · 기장 안내만 그림(5A 창 너머 날개): 창 120 × 150 · 창틀 10
  windowW: 120,
  windowH: 150,
  windowFrame: 10,
  // 움직임(2안 '지면' 일상 값): 새 말풍선 240 · 6 / 소등 · 아침 · 닫힘 전환은 투명도
  bubbleIn: scene2.bubble.in,
  bubbleRise: scene2.bubble.rise,
  fade: dur.short,
  // 다시 읽기: 착륙 준비(17:30 ~ 18:00)에는 닫힘을 알려고 5분마다 한 번(카운트다운 0 · 실시간 이벤트 없음). 그 밖에는 화면에 들어올 때 · 기장 인사 이벤트 때만
  landingPollMs: 5 * 60_000,
} as const;
