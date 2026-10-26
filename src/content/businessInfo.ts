// 사업자 정보 · 국내결혼중개업 신고번호 값(QP-A, 카피.md 12-Q · 청사진 v5 10장 신고 요건).
// 값은 한 곳: 법무/판_관리.md 7장 '공개 전에 채울 값' → npm run gen:legal → content/fillIns.ts(FILL_INS). 여기서는 그 값을 읽기만 한다.
// 지금은 모두 비어 있다(신고 수리 전). 값이 비면 화면은 그 줄을 아예 그리지 않는다 — 빈칸 · '준비 중' · {변수} 글도 보이지 않는다.
import { FILL_INS } from './fillIns';
import { BUSINESS } from './settingsCopy';

export type BusinessInfo = {
  readonly name: string | null;
  readonly ceo: string | null;
  readonly reportNo: string | null;
  readonly bizRegNo: string | null;
  readonly address: string | null;
  readonly phone: string | null;
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
  address: val('주소'),
  phone: val('전화번호'),
};

const filled = (v: string | null): v is string => typeof v === 'string' && v.trim() !== '';

// 설정 목록 맨 아래 · 약관 화면 맨 아래 한 줄. 신고번호가 없으면 null(줄 없음)
export function reportNoLine(info: BusinessInfo = BUSINESS_INFO): string | null {
  return filled(info.reportNo) ? BUSINESS.reportLine(info.reportNo.trim()) : null;
}

export type BusinessRow = { readonly key: keyof BusinessInfo; readonly label: string; readonly value: string };

// 사업자 정보 화면 줄 6개(12-Q 차례). 값이 하나라도 비면 null — 정보 묶음의 '사업자 정보' 줄도 숨긴다
export function businessRows(info: BusinessInfo = BUSINESS_INFO): readonly BusinessRow[] | null {
  const order: (keyof BusinessInfo)[] = ['name', 'ceo', 'reportNo', 'bizRegNo', 'address', 'phone'];
  if (!order.every((k) => filled(info[k]))) return null;
  return order.map((k) => ({ key: k, label: BUSINESS.labels[k], value: (info[k] as string).trim() }));
}
