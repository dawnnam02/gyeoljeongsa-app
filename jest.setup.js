// 시험 공통 준비(F17): Reanimated 4 · worklets 는 기기 모듈이 없어 시험에서 공식 대역(mock)을 쓴다.
//  대역에서는 움직임이 바로 끝 값으로 가고(withTiming → 끝 값), useAnimatedStyle 은 그릴 때 한 번 계산된다 — 그래서 시험은
//  '처음 그려질 때의 모양'(보통: 자리 밖에서 시작 · 동작 줄이기: 제자리 + 투명)과 '어떤 장면 · 햅틱이 불렸나'를 본다.
/* global jest */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// F21: 시트 끌어 닫기(react-native-gesture-handler)의 시험용 준비(패키지가 주는 것)
require('react-native-gesture-handler/jestSetup');
// V5(W10 · D-152): 숨긴 v4 화면 스위치는 서버(get_feature_flags)를 읽는다. 예전 화면 시험(09 · 10 · 11 · 12 · 16)은 켜진 상태 그대로 돌고,
//  숨김 자체는 v5Hide.test 가 jest.requireActual 로 진짜 동작을 본다
jest.mock('@/navigation/v5Hide', () => {
  const actual = jest.requireActual('@/navigation/v5Hide');
  return {
    ...actual,
    useV4Screens: () => ({ ready: true, dailyRecs: true, likes: true, shop: true }),
    V4Gate: ({ children }) => children,
    CandidateGate: ({ children }) => children, // 3부-바: 10 라우트 문 — 진짜 동작은 v5Hide.test
  };
});
