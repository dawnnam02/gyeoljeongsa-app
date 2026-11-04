// 운세 정리 D-245(팀장/세부청사진/LV-2_운세정리.md 2장 '끔'): 스위치(featureKeys)가 없는 칸을 코드에서 숨긴다.
//  · 코드 · 글은 지우지 않는다 — 값을 true 로 하면 그대로 돌아온다(시험: __tests__/qf2aFortune.test.tsx 가 켜서 돌아오는 것을 본다)
//  · 스위치가 있는 칸(이번 달 · 날짜 고르기 · 만난 날의 하늘 · 하늘 도감 · 창밖 하늘 · 생일 엽서 · 이번 주 타로)은 featureKeys.json 의 demo: false
//  · 연애 풀이가 켜진 뒤 끄기로 한 칸(인연 이야기 · 사랑하는 방식 · 말하는 방식, LV-2 3장)은 지금 끄지 않는다
export const FORTUNE_TRIM: {
  workMoneyPeople: boolean; // 일 · 돈 · 사람 이야기 카드(F5-04) — 칩당 140자, 연애 앱과 겉돎
  fullReading: boolean; // 종합 풀이 — 세 풀이를 이어 부를 뿐 새 내용 0
  zodiacLine: boolean; // 띠 한 줄(F5-18) — 네 기둥이 있는데 띠는 얕음
  inflightAiTrial: boolean; // 기내지 안 별자리 · 사주 AI 시험판 — 시험용
} = {
  workMoneyPeople: false,
  fullReading: false,
  zodiacLine: false,
  inflightAiTrial: false,
};
