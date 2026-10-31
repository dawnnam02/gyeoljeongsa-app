// 시험판 입구(설정 코드 줄 · 홈 칸 · 시트 버튼 · 문장 다듬기 단추)는 데모 판에서만 보인다. 스토어 빌드(실서버 판)에는 입구 0.
//  테스트 웹(lovedecide--demo.expo.app)이 데모 판이다. 새 EXPO_PUBLIC_ 변수는 만들지 않는다(보안 ATF-02) — config/env.ts 가 읽는 기존 데모 표시를 같은 식으로 읽는다.
//  (config/env.ts 를 가져오지 않는다: 그 파일은 서버 주소가 비면 던져서, 화면 시험 여러 개가 환경 변수 없이 이 길을 지나간다)
//  Metro 가 process.env.EXPO_PUBLIC_* 를 값으로 바꿔 넣으므로 점 표기로만 읽는다.
export const aitEnabled = (): boolean => process.env.EXPO_PUBLIC_DEMO_MODE === '1';
