// 사업자 정보 · 국내결혼중개업 신고번호 값(QP-A, 카피.md 12-Q · 청사진 v5 10장 신고 요건 · 법무 QPL 3-2 D-197).
// 값은 한 곳: 법무/판_관리.md 7장 '공개 전에 채울 값' → npm run gen:legal → content/fillIns.ts(FILL_INS). 여기서는 그 값을 읽기만 한다.
// 지금은 모두 비어 있다(신고 수리 전). 값이 비면 화면은 그 줄을 아예 그리지 않는다 — 빈칸 · '준비 중' · {변수} 글도 보이지 않는다.
//  · 법정 6줄(상호 · 대표자 · 신고번호 · 사업자등록번호 · 사무소 주소 · 전화번호): 하나라도 비면 '사업자 정보' 줄 자체를 숨긴다
//  · 통신판매업 신고번호(D-197 새 줄): 비면 그 줄만 숨긴다(면제 · 신고 전일 수 있음)
//  · 연결 3줄(D-197): 수수료표 · 보증보험 청구 절차는 웹 주소가 비면 그 줄만 숨김, 이용약관은 앱 안 약관 화면이라 늘 있다
import { FILL_INS } from './fillIns';
import { BUSINESS } from './settingsCopy';

export type BusinessInfo = {
  readonly name: string | null;
  readonly ceo: string | null;
  readonly reportNo: string | null;
  readonly bizRegNo: string | null;
  readonly ecomNo?: string | null; // 통신판매업 신고번호(없어도 됨)
  readonly address: string | null;
  readonly phone: string | null;
  readonly feeTableUrl?: string | null; // 수수료표 웹 주소
  readonly bondClaimUrl?: string | null; // 보증보험 손해배상 청구 절차 웹 주소
};

const val = (key: string): string | null => {
  const v = FILL_INS[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

export const BUSINESS_INFO: BusinessInfo = {
  name: val('운영자 상호 또는 성명'),
  ceo: val('대표자'),
  reportNo: val('결혼중개업 신고번호'),
  bizRegNo: val('사업자등록번호'),
  ecomNo: val('통신판매업 신고번호'),
  address: val('주소'), // 판_관리 7장 · 약관과 같은 {주소} 하나(D-197). 화면 줄 이름은 '사무소 주소'
  phone: val('전화번호'),
  feeTableUrl: val('수수료표 웹 주소'),
  bondClaimUrl: val('보증보험 청구 절차 웹 주소'),
};

const filled = (v: string | null | undefined): v is string => typeof v === 'string' && v.trim() !== '';

// 설정 목록 맨 아래 · 약관 화면 맨 아래 한 줄. 신고번호가 없으면 null(줄 없음)
export function reportNoLine(info: BusinessInfo = BUSINESS_INFO): string | null {
  return filled(info.reportNo) ? BUSINESS.reportLine(info.reportNo.trim()) : null;
}

type RowKey = 'name' | 'ceo' | 'reportNo' | 'bizRegNo' | 'ecomNo' | 'address' | 'phone';
export type BusinessRow = { readonly key: RowKey; readonly label: string; readonly value: string };
export type BusinessLink = { readonly key: 'feeTable' | 'terms' | 'bondClaim'; readonly label: string; readonly url: string | null }; // url null = 앱 안 약관 화면

const REQUIRED: RowKey[] = ['name', 'ceo', 'reportNo', 'bizRegNo', 'address', 'phone'];
const ORDER: RowKey[] = ['name', 'ceo', 'reportNo', 'bizRegNo', 'ecomNo', 'address', 'phone']; // 카피.md 12-Q · QPL 7-2 차례(통신판매업은 사업자등록번호 다음)

// 사업자 정보 화면 줄. 법정 6줄 가운데 하나라도 비면 null — 정보 묶음의 '사업자 정보' 줄도 숨긴다. 통신판매업 줄은 비면 그 줄만 뺀다
export function businessRows(info: BusinessInfo = BUSINESS_INFO): readonly BusinessRow[] | null {
  if (!REQUIRED.every((k) => filled(info[k]))) return null;
  return ORDER.filter((k) => filled(info[k])).map((k) => ({ key: k, label: BUSINESS.labels[k], value: (info[k] as string).trim() }));
}

// 사업자 정보 화면 아래 연결 줄(결혼중개업법 제8조 ② · 시행규칙 제8조 ④). 웹 주소가 빈 줄은 뺀다
export function businessLinks(info: BusinessInfo = BUSINESS_INFO): readonly BusinessLink[] {
  const links: BusinessLink[] = [];
  if (filled(info.feeTableUrl)) links.push({ key: 'feeTable', label: BUSINESS.links.feeTable, url: info.feeTableUrl.trim() });
  links.push({ key: 'terms', label: BUSINESS.links.terms, url: null });
  if (filled(info.bondClaimUrl)) links.push({ key: 'bondClaim', label: BUSINESS.links.bondClaim, url: info.bondClaimUrl.trim() });
  return links;
}
