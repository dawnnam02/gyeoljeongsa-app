// 동의 문구 판(版). 칸마다 따로 정한다: 동의문구 3-5 "항목 · 목적 · 보유 기간 · 받는 자가 바뀌면 해당 칸만 다시 동의를 받는다".
//  · 판 값은 법무/판_관리.md 2장이 원본이다. 아래 versions 블록은 npm run gen:legal 이 쓴다(손으로 고치지 않는다).
//  · 형식: consent-YYYY.MM.DD-vN (DB 검사 consents_text_version_check 와 같다, 백엔드 스키마 consents)
//  · 오타 고침처럼 뜻이 바뀌지 않는 수정은 뒷자리(-vN)만 올리고 다시 받지 않는다. 뜻이 바뀌면 날짜 부분을 새로 정한다.
//  · 문구를 고친 칸의 판은 법무가 정한다. 동의문구.md 6장은 형식만 예로 들었다(consent-2026.10.14-v1).
//  scripts/check-copy.mjs 가 법무 문서의 글이 바뀌었는데 이 판이 그대로인 칸을 찾아낸다(아래 CONSENT_TEXT_FINGERPRINTS).
import type { ConsentCode } from '@/content/types';

// <versions:begin>
// 법무/판_관리.md 2장 표에서 npm run gen:legal 이 쓴다(손으로 고치지 않는다. 손으로 고치면 npm run check:copy 가 "판_관리.md와 다름"으로 실패한다)
export const CONSENT_TEXT_VERSIONS: Readonly<Record<ConsentCode, string>> = {
  CK1: "consent-2026.10.27-v1",
  CK2: "consent-2026.10.18-v1",
  CK3: "consent-2026.10.27-v1",
  CK4: "consent-2026.10.27-v1",
  CK5: "consent-2026.10.14-v1",
  CK6: "consent-2026.10.27-v1",
  CK7: "consent-2026.10.14-v1",
  CK8: "consent-2026.10.27-v1",
  CK9: "consent-2026.10.14-v3",
};
// 약관 · 처리방침 판과 시행일(시행 전에는 {공개일}). 출시 빌드는 {공개일}이 남으면 막힌다
export const LEGAL_DOC_VERSIONS = {
  terms: { version: "terms-{공개일}-v1", effective: "{공개일}" },
  privacy: { version: "privacy-{공개일}-v1", effective: "{공개일}" },
} as const;
// <versions:end>

// 'consent-2026.10.14-v1' → 'consent-2026.10.14'. 뒷자리만 다른 판은 같은 문구로 본다(다시 동의를 받지 않는다).
export const editionOf = (version: string): string => version.replace(/-v\d+$/, '');

export function isCurrentEdition(code: ConsentCode, version: string): boolean {
  return editionOf(version) === editionOf(CONSENT_TEXT_VERSIONS[code]);
}

// <fingerprints:begin>
// 법무 문서의 글 지문(npm run gen:legal -- --fingerprints 가 고친다. 문구 판을 올린 뒤에만 고친다)
export const CONSENT_TEXT_FINGERPRINTS: Readonly<Record<ConsentCode, string>> = {
  CK1: "2a4ec408761f",
  CK2: "f8167545f89d",
  CK3: "e6d212bc5527",
  CK4: "56ea6ad35f51",
  CK5: "bfb551bd3af5",
  CK6: "585658258315",
  CK7: "07b25c716338",
  CK8: "9c5d88f3e4ab",
  CK9: "2e5e24446387",
};
// 약관 · 처리방침: 표식 구간과 작업 표시를 걸러낸 글의 지문
export const LEGAL_DOC_FINGERPRINTS = {
  terms: "e02fbfdb484c",
  privacy: "da8d4a550bc9",
} as const;
// <fingerprints:end>
