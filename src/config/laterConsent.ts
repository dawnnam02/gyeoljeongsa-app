// 03 밖에서 받는 선택 동의 CK11 ~ CK16 의 문구 판(L17A). 원본은 법무/판_관리.md 2-1 표('앱 반영 대기 판' — 앱 생성기가 아직 판을 읽지 않는 칸).
// DB 검사(0001 consents.text_version): ^consent-YYYY.MM.DD-vN$. 이 모양이 아니면 실서버가 동의 기록을 거부한다(23514 check violation).
//  · CK11 ~ CK16: 모두 consent-2026.10.26-v1(법무 L17 2차 메모 판, 팀장 D-190). 변호사 검토 · 기능을 켤 때 확정 날짜로 바뀐다(판_관리 4장: 새 날짜 → 다시 동의)
//  · CK15 옛 값 'consent-2026.10.22-가정'은 DB 검사에 걸려 실서버 저장이 거부될 수 있었다(L17 4장 6번 · 9-5 11번)
// 글(요약 · 전문)은 동의문구 4-11 ~ 4-16 → content/consentContent.ts CONSENT_LATER_ITEMS(gen:legal)
import type { LaterConsentCode } from '@/content/types';

export const CONSENT_TEXT_VERSION_SHAPE = /^consent-\d{4}\.\d{2}\.\d{2}-v\d+$/;

export const LATER_CONSENT_VERSIONS: Readonly<Record<LaterConsentCode, string>> = {
  CK11: 'consent-2026.10.26-v1',
  CK12: 'consent-2026.10.26-v1',
  CK13: 'consent-2026.10.26-v1',
  CK14: 'consent-2026.10.26-v1',
  CK15: 'consent-2026.10.26-v1',
  CK16: 'consent-2026.10.26-v2', // D-197: 4-16 글 v5('이어 드릴 때' · '짝을 고를 때') — 판_관리 2-1
};

export const CK15_TEXT_VERSION = LATER_CONSENT_VERSIONS.CK15;
export const CK16_TEXT_VERSION = LATER_CONSENT_VERSIONS.CK16;
