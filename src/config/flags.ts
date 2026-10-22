// 코드로 켜고 끄는 값 모음. 값을 바꾸는 결정은 팀장/세부계획.md 5장 · 8장이 원본이다.

// D-23 BD-4: 상대 상세(10)에서 화면 캡처 · 앱 전환 화면 가림. 가정: 기본 끔, 설정에서 켠다.
// 켜는 코드는 lib/captureBlock.ts(09 · 10 · 11), 켜고 끄는 스위치는 12 보안 화면(F7). 값은 store/securityStore.ts 가 기기에 저장한다.
export const SCREEN_CAPTURE_BLOCK_DEFAULT = false;

// D-20 / D-4b: AI 정리는 모의 모드로 만든다. 실제 호출은 서버 함수(A3)가 하고 유료라 완성 뒤에 승인한다.
// 앱은 모드를 모른다. 서버가 같은 모양의 결과를 준다. 이 값은 화면에 '모의' 표시를 둘지 정하는 개발용 안내다.
export const AI_MODE = 'mock' as const;

// 사진 올리기 한도(K2 05 가안): 형식 · 용량. F2가 읽는다.
export const PHOTO_ALLOWED_FORMATS = ['JPG', 'PNG', 'HEIC'] as const;
export const PHOTO_MAX_MB = 10;
export const PHOTO_MAX_LONG_SIDE_PX = 1600;

// D-48(F2L 임시 설문 · 데모 전용): 임시판에는 희망 조건 수정(04-25~32)이 없어서, 그 동안 09 빈 상태의 [희망 조건 보기] · 보조 한 줄과
// 12 설정의 '희망 조건 수정' 줄을 숨긴다. AYLA'S 정식 설문이 들어오면 true 로 바꾼다(교체 절차 README '임시 설문').
export const PREFERENCES_EDIT_ENABLED = false;
