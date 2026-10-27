// 종교 동의 카드 글(3부-사 · D-219). 원본 = 마케팅/카피.md 17장(17-1 · 17-4, M-CK4 · RC-M M5) — check:copy W 가 17장 표와 한 글자씩 대조한다.
//  CHAT_V6(13장 표) 밖 객체에 둔다(정치 카드 POL 과 같은 자리 — 카피 17장 머리 말 '앱 판단').
//  체크 줄은 옮겨 적지 않고 생성 파일(법무 동의문구 4-4 → content/consentContent CONSENT_ITEMS CK4)의 체크 문구를 가리킨다(POL12 와 같은 방식)
//  해요체 · 느낌표 0 · 재촉 0 · 등급 말은 '등급 계산에는 쓰지 않아요'(쓰지 않는다는 사실 — CHAT.A06.why 와 같은 예외) 하나
import { CONSENT_ITEMS } from '@/content/consentContent';

const CK4 = CONSENT_ITEMS.find((i) => i.code === 'CK4');

export const REL = {
  consent: '종교를 여쭙기 전에 먼저 동의를 받을게요.', // CHAT.REL.consent — 카드 앞 AI 말풍선
  consentTitle: '종교 정보 별도 동의 [선택]', // CHAT.REL.consentTitle
  consentBody: '종교는 민감한 정보라서 따로 동의를 받아요. 종교가 같은 분끼리만 이어 드려요.', // CHAT.REL.consentBody
  what: "받는 것: 내 종교 하나예요. '종교 없음'도 여기에 들어가요.", // CHAT.REL.what — 네 줄 상자 1
  use: '쓰는 곳: 종교가 같은 분과 이어 드리는 데 써요. 등급 계산에는 쓰지 않아요.', // CHAT.REL.use — 네 줄 상자 2
  keep: '보관: 탈퇴하면 바로 안 보이고 30일 뒤에 지워요. 동의를 거두면 바로 지워요.', // CHAT.REL.keep — 네 줄 상자 3
  consentNote: "동의하지 않으면: 종교는 '답하지 않음'이 되고, 가입과 다른 문항은 그대로지만 탑승권은 살 수 없어요.", // CHAT.REL.consentNote — 네 줄 상자 4
  vis: "내 종교는 처음에 다른 분에게 보여요. 프로필의 '공개 범위'에서 끌 수 있어요.", // CHAT.REL.vis — 공개 줄
  withdraw: "설정의 '동의 관리'에서 언제든 거둘 수 있어요.", // CHAT.REL.withdraw — 거두기 줄
  consentCheck: CK4?.label ?? '', // CHAT.REL.consentCheck = 동의문구 4-4 체크 문구(03 CK4 와 같은 글)
  needCheck: '동의 칸을 눌러야 이어서 답할 수 있어요.', // CHAT.REL.needCheck
  agree: '동의하고 답할게요', // CHAT.REL.agree
  decline: '동의하지 않을게요', // CHAT.REL.decline
  consentDone: '동의를 마쳤어요. 설정에서 언제든 끌 수 있어요.', // CHAT.REL.consentDone
  ack: { decline: "알겠어요. 종교는 '답하지 않음'으로 적어 둘게요. 나중에 답 확인 화면에서 답할 수 있어요." }, // CHAT.REL.ack.decline
  moreA11y: '종교 정보 별도 동의 내용 보기', // CHAT.REL.moreA11y — '보기 ›' 읽기 이름
} as const;

// 카드 '보기 ›' 가 여는 요약 · 전문(03 · 동의 관리와 같은 시트 · 같은 판)
export const REL_SHEET = CK4 ?? null;
