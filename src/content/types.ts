// 화면에 싣는 글(법무 문서에서 뽑은 것)의 모양. 값이 아니라 모양만 있다.
// 이 파일은 다른 파일을 가져오지 않는다: scripts/check-copy.mjs 가 Node 로 바로 읽을 수 있게 하려는 것이다.

// 법무 문서(약관 · 처리방침 · 동의문구 전문)를 화면에 그리는 조각. 마크다운에서 뽑는다(scripts/lib/legal-source.mjs).
export type LegalBlock =
  | { readonly type: 'h'; readonly level: 2 | 3 | 4; readonly text: string } // 장 · 조 · 소제목
  | { readonly type: 'p'; readonly text: string } // 한 줄 문단
  | { readonly type: 'li'; readonly depth: number; readonly marker: string; readonly text: string } // 목록(marker: '•' 또는 '1.')
  | { readonly type: 'table'; readonly header: readonly string[]; readonly rows: readonly (readonly string[])[] };

export const CONSENT_CODES = ['CK1', 'CK2', 'CK3', 'CK4', 'CK5', 'CK6', 'CK7', 'CK8', 'CK9'] as const;
export type ConsentCode = (typeof CONSENT_CODES)[number];

// 03 동의 화면의 체크 칸 하나(법무/동의문구.md 4장). 글은 한 글자도 바꾸지 않는다.
export type ConsentItemContent = {
  readonly code: ConsentCode;
  readonly required: boolean; // 필수 7 · 선택 2
  readonly label: string; // 체크 문구(예: [필수] 이용약관에 동의해요)
  readonly why: string; // 왜 필요한지(요약 맨 위 한 줄)
  readonly note: string | null; // 덧붙이는 안내(선택 칸 · 확인 칸만)
  readonly summary: readonly string[]; // 요약(보기 ›)
  readonly declinedLabel: string; // '동의하지 않으면' · '확인하지 않으면'
  readonly declined: string; // 동의하지 않으면 어떻게 되는지
  readonly fullText: readonly LegalBlock[] | 'terms'; // 전문. CK1 은 이용약관 전체('terms')
};

// 03 밖에서 기능을 처음 쓸 때 받는 선택 동의(동의문구 1-1, L17). DB 검사 0033: CK1 ~ CK16
export const LATER_CONSENT_CODES = ['CK11', 'CK12', 'CK13', 'CK14', 'CK15', 'CK16'] as const;
export type LaterConsentCode = (typeof LATER_CONSENT_CODES)[number];

// 요약 시트(ConsentSummarySheet)가 그리는 모양 — 03 칸 · 03 밖 칸 공통
export type ConsentSheetContent = Omit<ConsentItemContent, 'code'> & { readonly code: ConsentCode | LaterConsentCode };

// 03 밖 칸의 글(동의문구 4-11 ~ 4-16): 03 칸 모양 + 시트 제목(없으면 null) · '전문 보기 ›' 글
export type LaterConsentContent = Omit<ConsentItemContent, 'code' | 'fullText'> & {
  readonly code: LaterConsentCode;
  readonly fullText: readonly LegalBlock[];
  readonly title: string | null; // 제목(시트 위) — CK15 · CK16 만 있다
  readonly more: string; // 요약 끝 '전문 보기 ›'
};
