// 신고 · 차단 규칙(정책 5-1 · 5-2, 카피.md 11 N33). 화면 없이 시험할 수 있게 따로 둔다.
//  사유 8개 RP1~RP8 중 1개(필수) · 설명 200자 이하(선택) · RP8 '기타'는 설명 10자 이상 · 같은 상대 1번(서버 already_reported)
import { COMMON, REPORT_SHEET } from '@/content/copy';

export const REPORT_CODES = ['RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6', 'RP7', 'RP8'] as const;
export type ReportCode = (typeof REPORT_CODES)[number];
export const MINOR_INDEX = 5; // RP6 미성년자로 보임 — 아래에 24시간 안내 한 줄
export const OTHER_INDEX = 7; // RP8 기타 — 설명 10자 이상
export const DESC_MAX = 200;
export const OTHER_MIN = 10;

export type ReportFailure = 'network' | 'server' | 'already' | 'invalid_reason' | 'description_required' | 'invalid_description' | 'unavailable';
export type BlockFailure = 'network' | 'server' | 'unavailable';

// 10 · 11 이 넘겨 주는 서버 연결. lib/recsApi.ts 의 report · block 과 같은 모양이라 그대로 넘길 수 있다
export type SafetyApi = {
  report: (targetId: string, reasonCode: string, description: string) => Promise<{ ok: true } | { ok: false; reason: ReportFailure }>;
  block: (targetId: string) => Promise<{ ok: true } | { ok: false; reason: BlockFailure }>;
};

export type ReportField = 'reason' | 'desc';
export type ReportCheck = { field: ReportField; text: string } | null;

// [제출하기] 전에 앱이 먼저 보는 것(서버도 같은 규칙으로 다시 본다)
export function checkReport(picked: number | null, description: string): ReportCheck {
  if (picked === null || picked < 0 || picked >= REPORT_CODES.length) return { field: 'reason', text: REPORT_SHEET.errors.noReason };
  const text = description.trim();
  if (text.length > DESC_MAX) return { field: 'desc', text: REPORT_SHEET.errors.descLong };
  if (picked === OTHER_INDEX && text.length < OTHER_MIN) return { field: 'desc', text: REPORT_SHEET.errors.descShort };
  return null;
}

// 서버가 거절한 이유 → 보일 글과 자리
export function reportFailure(reason: Exclude<ReportFailure, 'unavailable'>): { field: ReportField | 'form'; text: string } {
  switch (reason) {
    case 'network':
      return { field: 'form', text: COMMON.offline };
    case 'already':
      return { field: 'form', text: REPORT_SHEET.errors.already };
    case 'invalid_reason':
      return { field: 'reason', text: REPORT_SHEET.errors.noReason };
    case 'description_required':
      return { field: 'desc', text: REPORT_SHEET.errors.descShort };
    case 'invalid_description':
      return { field: 'desc', text: REPORT_SHEET.errors.descLong };
    default:
      return { field: 'form', text: REPORT_SHEET.errors.failed };
  }
}

export const blockFailureText = (reason: Exclude<BlockFailure, 'unavailable'>): string => (reason === 'network' ? COMMON.offline : REPORT_SHEET.blockFailed);
