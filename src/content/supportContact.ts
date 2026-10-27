// 고객센터 값(본인 결정 D-28): 법무/판_관리.md 7장 '값' 칸 5 · 13번과 한 곳이다(팀장 결정 10-15 ⑦). FILL_INS 는 gen:legal 생성물.
// 값이 비어 있으면 null — 화면은 원본 글의 {고객센터 이메일} · {고객센터 운영 시간} 자리를 그대로 보이고 [복사] · [메일 앱 열기]를 끈다.
// 이메일은 사업자 정보 '전자우편주소'와 같은 값 하나(content/businessInfo CONTACT_EMAIL — 팀장 결정 10-27 · 법무 L21 10-2)
import { CONTACT_EMAIL } from './businessInfo';
import { FILL_INS } from './fillIns';

export type SupportContact = { readonly email: string | null; readonly hours: string | null };

export const SUPPORT_CONTACT: SupportContact = {
  email: CONTACT_EMAIL,
  hours: FILL_INS['고객센터 운영 시간'] ?? null,
};
