// 12 설정 규칙(화면 없이 시험한다): 줄 차례 · 하위 화면 이름 · 날짜 글 · 차단한 사람 이름 줄 · 고객센터 값 채우기 · 탈퇴 인증번호 오류 글.
import type { IconName } from '@/components/Icon';
import { PREFERENCES_EDIT_ENABLED } from '@/config/flags';
import { COMMON, SIGN_IN } from '@/content/copy';
import { REPORTS, SETTINGS, WITHDRAW } from '@/content/settingsCopy';
import { SUPPORT_CONTACT, type SupportContact } from '@/content/supportContact';
import type { WithdrawConfirmFailure, WithdrawStartFailure } from '@/lib/settingsApi';

// 하위 화면(navigation/flow.ts 의 sub:* 와 같은 이름. 'safety' 는 flow.ts 에 아직 없다 — 2단계에서 더한다)
export type SettingsPage = 'list' | 'notifications' | 'security' | 'consent-management' | 'blocked-list' | 'report-history' | 'support' | 'safety' | 'licenses' | 'image-credit' | 'business-info' | 'avoid';

export type RowAction =
  | { kind: 'page'; page: Exclude<SettingsPage, 'list'> }
  | { kind: 'visibility' } // 08 프로필 탭의 공개 범위 구역
  | { kind: 'preferences' } // 04-25 '희망 조건 수정' 상태(12 로 돌아옴)
  | { kind: 'soon' } // 인증 서류 제출: 이동 없음, "준비 중이에요"
  | { kind: 'legal' } // 이용약관 · 개인정보 처리방침 읽기(03 과 같은 시트)
  | { kind: 'credits' } // 크레딧 · 구매 내역(카피.md 12-Q, 옛 NV35 '구매 · 등급 구독' 자리) → T5 크레딧 · 내역. 상점이 꺼져도 보인다
  | { kind: 'grade' }; // 내 등급(D-200 ② · 정책 P3-10) → 16-G(/grade, 상점 밖에서 여는 화면)

// icon: 줄 앞 아이콘(D43 A · 1안 24 · text). 디자인 QA 14곳 중 설정 몫(A3 ~ A7) + 함께 붙일 것(공개 범위 · 보안 · 동의 관리 · 안전 안내)
export type RowDef = { key: string; label: string; action: RowAction; group: 'main' | 'info'; right?: string; icon?: IconName };

// 차례: Figma 12 3:473 · 12b 201:36 = K2 12 '설정 줄과 이동' + 카피.md 12 목록. '희망 조건 수정'은 임시 설문(F2L) 동안 숨긴다(D-48, config/flags.ts)
const ALL_ROWS: readonly RowDef[] = [
  { key: 'notifications', label: SETTINGS.rows.notifications, action: { kind: 'page', page: 'notifications' }, group: 'main', icon: 'bell' },
  { key: 'visibility', label: SETTINGS.rows.visibility, action: { kind: 'visibility' }, group: 'main', icon: 'visibility' },
  { key: 'grade', label: SETTINGS.rows.grade, action: { kind: 'grade' }, group: 'main', icon: 'my_icon_view' }, // D-200 ②(화면_요구사항 12-1 차례)
  { key: 'avoid', label: SETTINGS.rows.avoid, action: { kind: 'page', page: 'avoid' }, group: 'main', icon: 'profile' }, // D-200 ① 12-5
  { key: 'preferences', label: SETTINGS.rows.preferences, action: { kind: 'preferences' }, group: 'main', icon: 'how_to' },
  { key: 'verification', label: SETTINGS.rows.verification, action: { kind: 'soon' }, group: 'main', right: SETTINGS.verificationSoon, icon: 'doc_verify' },
  { key: 'credits', label: SETTINGS.rows.credits, action: { kind: 'credits' }, group: 'main', icon: 'credit' },
  { key: 'blocked', label: SETTINGS.rows.blocked, action: { kind: 'page', page: 'blocked-list' }, group: 'main', icon: 'block' },
  { key: 'reports', label: SETTINGS.rows.reports, action: { kind: 'page', page: 'report-history' }, group: 'main', icon: 'report' },
  { key: 'security', label: SETTINGS.rows.security, action: { kind: 'page', page: 'security' }, group: 'main', icon: 'security' },
  { key: 'support', label: SETTINGS.rows.support, action: { kind: 'page', page: 'support' }, group: 'main', icon: 'support' },
  { key: 'consents', label: SETTINGS.rows.consents, action: { kind: 'page', page: 'consent-management' }, group: 'main', icon: 'consent' },
  { key: 'legal', label: SETTINGS.rows.legal, action: { kind: 'legal' }, group: 'main', icon: 'document' },
  { key: 'safety', label: SETTINGS.rows.safety, action: { kind: 'page', page: 'safety' }, group: 'main', icon: 'safety' },
  { key: 'licenses', label: SETTINGS.rows.licenses, action: { kind: 'page', page: 'licenses' }, group: 'info', icon: 'document' },
  { key: 'image-credit', label: SETTINGS.rows.imageCredit, action: { kind: 'page', page: 'image-credit' }, group: 'info', icon: 'document' },
  { key: 'business-info', label: SETTINGS.rows.businessInfo, action: { kind: 'page', page: 'business-info' }, group: 'info', icon: 'document' }, // 값 6개가 모두 있을 때만(SettingsScreen 이 거른다)
];
export const SETTINGS_ROWS: readonly RowDef[] = ALL_ROWS.filter((r) => PREFERENCES_EDIT_ENABLED || r.key !== 'preferences');

const KST_MS = 9 * 3_600_000;
const kstParts = (ms: number) => {
  const d = new Date(ms + KST_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};

// R-D18-2: 올해는 "10월 15일", 해가 다르면 "2025년 12월 3일"(한국 날짜, 시각 없음). 읽을 수 없는 값은 빈 글
export function reportDate(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const day = kstParts(t);
  return day.y === kstParts(nowMs).y ? REPORTS.dateThisYear(day.m, day.d) : REPORTS.dateOtherYear(day.y, day.m, day.d);
}

// 차단 목록 한 줄: "박OO · 29"(K2 12). 나이를 모르면 이름만
export const blockedHead = (name: string, age: number | null): string => [name, age === null ? null : String(age)].filter((x): x is string => Boolean(x)).join(' · ');

// 고객센터 글의 {고객센터 이메일} · {고객센터 운영 시간} 자리에 값(D-28)을 넣는다. 값이 아직 없으면 원본 글 그대로
export function fillContact(text: string, contact: SupportContact = SUPPORT_CONTACT): string {
  let out = text;
  if (contact.email) out = out.split('{고객센터 이메일}').join(contact.email);
  if (contact.hours) out = out.split('{고객센터 운영 시간}').join(contact.hours);
  return out;
}

// 12 고객센터 › 아동 안전 문의 본문(3부-사 · 검수 Q9-N6): 연락처 값이 없으면(신고번호 · 고객센터 값은 법인 뒤) '아래 연락처로 알려 주세요' 문장은 빼고
//  앱 안 신고 길 문장만 남긴다 — 아래에 연락처가 없는데 '아래 연락처'를 말하지 않게. 글은 카피 원본 문장 그대로(새 글 0)
export function childSafetyBody(body: string, hasContact: boolean): string {
  if (hasContact) return body;
  return body
    .split(/(?<=\.) /)
    .filter((sentence) => !sentence.includes('아래 연락처'))
    .join(' ');
}

// 탈퇴 인증번호 단계의 오류 글(02 와 같은 글 · N31)
export function withdrawStartError(reason: WithdrawStartFailure): string {
  switch (reason) {
    case 'network':
      return COMMON.offline;
    case 'limit':
      return SIGN_IN.errors.tooMany;
    case 'send':
      return WITHDRAW.sendFailed;
    case 'session':
      return COMMON.sessionLost;
    default:
      return SETTINGS.actionFailed;
  }
}

export function withdrawConfirmError(reason: WithdrawConfirmFailure): string {
  switch (reason) {
    case 'network':
      return COMMON.offline;
    case 'wrong':
      return SIGN_IN.errors.codeWrong;
    case 'limit':
      return SIGN_IN.errors.tooMany;
    case 'session':
      return COMMON.sessionLost;
    default:
      return SETTINGS.actionFailed;
  }
}

export const onlyDigits = (value: string, max: number): string => value.replace(/\D/g, '').slice(0, max);
