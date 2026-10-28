// 정치성향 문항 글(W8) — 모두 카피 키 제안(W8W9_변경기록 3장). POL9 ~ POL12 는 동의문구 4-15 화면 문구 그대로(L17A · 카피.md 13-1, check:copy W 가 대조).
//  · 양 끝 '진보' · '보수'는 청사진_v5 4-3 가안(마케팅이 다듬음)
//  · 숫자 · 칸 · 눈금 말 0. 해요체 · 느낌표 0
import { CONSENT_LATER_ITEMS } from '@/content/consentContent';

// POL9 ~ POL12 는 동의문구 4-15 화면 문구(생성 파일 CONSENT_LATER_ITEMS CK15)를 그대로 쓴다 — 옮겨 적지 않는다(L17A · D-190)
const CK15 = CONSENT_LATER_ITEMS.find((i) => i.code === 'CK15')!;

export const POL = {
  question: '정치 성향은 어느 쪽에 가까운가요?', // POL1
  help: '막대를 끌어 가까운 곳에 놓아 주세요. 가운데도 괜찮아요. 이 답은 나만 보고, 상대 프로필에는 보이지 않아요.', // POL2
  left: '진보', // POL3 (가안)
  right: '보수', // POL4 (가안)
  sliderLabel: '정치 성향 막대', // POL5 스크린리더 이름
  sliderHint: '왼쪽 오른쪽 화살표로 옮길 수 있어요.', // POL6 스크린리더 도움말
  unset: '아직 정하지 않았어요', // POL7 값 없을 때 막대 아래 한 줄 · 스크린리더 값
  // 스크린리더 값 말(칸 숫자 대신). 화면에는 보이지 않는다
  where: ['진보 쪽', '조금 진보 쪽', '가운데', '조금 보수 쪽', '보수 쪽'] as const, // POL8
  consentTitle: CK15.title ?? '', // POL9 = 4-15 '제목(시트 위)'
  consentBody: CK15.why, // POL10 = 동의문구 4-15 '왜 필요한지'(L17A). 나만 봄 · 거두기 · 탑승권은 '보기 ›' 요약(4-15)
  consentNote: CK15.note ?? '', // POL11 = 4-15 '덧붙이는 안내'
  consentCheck: CK15.label, // POL12 체크 칸 = 4-15 '체크 문구'(L17A: 앞에 [선택])
  consentDone: '별도 동의를 마쳤어요.', // POL13 이미 동의한 분
  needConsent: '동의 칸을 눌러야 답을 저장할 수 있어요.', // POL14 [다음] 막힘 이유 — 카피 13-1(3부-아 · QP-07, CHAT.REL.needCheck 와 같은 꼴)
  needValue: '막대를 한 번 움직여 주세요.', // POL15 [다음] 막힘 이유
  later: '나중에', // POL16 보조 버튼(1:2 짝에서 한 줄로)
  reviewTitle: '정치 성향', // POL17 검토 줄
  reviewDone: '답했어요', // POL18
  reviewTodo: '아직 답하지 않았어요. 탑승권을 사려면 답해 주세요.', // POL19
  reviewEdit: '고치기', // POL20
} as const;
