// 선택 동의 CK10 '내 등급 보이기'(F13, 12 설정 › 내 등급 보이기). 문구 판은 법무/판_관리.md 2장 표 'consent.CK10'(consent-2026.10.15-v1, L10 시행 전 첫 판)이 원본이다.
// 03 동의 화면의 생성 파일(config/consent.ts 의 versions 블록 · content/consentContent.ts)은 아직 CK10 을 읽지 않는다(앱 생성기가 CK1~CK9 고정, 판_관리.md 1장 메모) —
// 그래서 12 설정이 쓰는 이 한 값만 여기에 따로 둔다. 생성기가 CK10 을 읽게 되면 이 파일을 지우고 생성 파일로 합친다.
export const CK10_CODE = 'CK10' as const;
export const CK10_TEXT_VERSION = 'consent-2026.10.15-v1';
