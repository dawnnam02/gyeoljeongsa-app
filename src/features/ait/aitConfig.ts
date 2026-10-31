// AI 시험판(AIT-F) 켜기 · 표시 조건. 코드로 정하는 값만 둔다(값 · 열쇠 0).
/**
 * 카피 23-2 `AIT.privacy.keep`(운영 서버에는 저장하지 않아요. AI 업체에는 … 남아요)은 보안 서버 시험(저장 0 · 로그 값 0)이 통과한 기록이 있을 때만 켠다.
 * 서버 쪽 시험(src/__tests__/aitServer.test.ts — 로그에 입력 글 · 코드 · 키 0, 서버 저장 모듈 0)이 통과해 켠다. 법무 16-4 #7(`운영 서버에는` 한정 + 업체 30일 문장)이 시험 시작 조건이라 끌 수 없다.
 */
export const AIT_KEEP_NOTE_ON = true;

/** 코드 칸 길이 상한(복붙 실수만 막는다. 형식 검사는 서버가 한다 — 틀림 · 없음을 서로 구분해 알리지 않는다) */
export const AIT_CODE_MAX = 64;

/** 기다림 표시를 길게 두지 않는다: 요청 하나의 상한(서버 업체 대기 60초보다 조금 길게) */
export const AIT_REQUEST_TIMEOUT_MS = 75_000;

/** 같은 화면에서 '잠깐 쉬어 가요'(CONCERN.rest)를 한 번 보이는 AI 답 수(뜨는 때는 기획 확정 전 가정) */
export const AIT_REST_AFTER_ANSWERS = 8;
