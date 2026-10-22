// 고객센터 값(본인 결정 D-28): 법무/판_관리.md 7장 '값' 칸 5 · 13번과 한 곳이다(팀장 결정 10-15 ⑦). FILL_INS 는 gen:legal 생성물.
// 값이 비어 있으면 null — 화면은 원본 글의 {고객센터 이메일} · {고객센터 운영 시간} 자리를 그대로 보이고 [복사] · [메일 앱 열기]를 끈다.
import { FILL_INS } from './fillIns';

export type SupportContact = { readonly email: string | null; readonly hours: string | null };

export const SUPPORT_CONTACT: SupportContact = {
  email: FILL_INS['고객센터 이메일'] ?? null,
  hours: FILL_INS['고객센터 운영 시간'] ?? null,
};
