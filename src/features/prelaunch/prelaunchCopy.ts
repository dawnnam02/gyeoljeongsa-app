// 사전 오픈 화면 글(F22). 원본: 마케팅/카피.md 11장 '사전 오픈 · 출연자 신청서'(C① · D-123, NP-xx · NFK20-01~10) — 그 장의 '→ 개선안' 글 그대로.
//  · 11장에 아직 없는 줄(미룸 공지 · 먼저 시작 · 11 · 16 · 01 줄 · link.errors.already 의 S18 뜻)은 app/F22_변경기록.md 3장에 카피 키 제안으로 적었다(C① 이 합치면 그 글로 바꾼다)
//  · V5(W6 · D-152): 하루 세 분 추천 → 주 1회 1:1 매칭. 출시 = 2026-12-23(수) 18:00 첫 매칭(T-24). '첫 추천' 글을 '첫 매칭' · 탑승권 흐름으로 바꿨다(카피 키 제안 — app/W6_변경기록.md)
//  · 사용자 글은 해요체 · 느낌표 0 · 남은 날 수 · 시간 · 초 · 순서 번호 0(K20 2-6 · P-11)
//  · 쓰지 않는 말(K20 2-1): 방송 · 촬영(고지 한 줄 밖) · 제작진 · 시즌 · 회차 · 기수 · 합격 · 불합격 · 탈락 · 선발 · 최종 · 마감 임박 · 한정 · 남은 자리 · 경쟁률
//  · 사과 말(죄송 · 미안 · 양해) 0 — 글 규칙 R2. 미룸 공지(NP-19)의 사과 한 줄은 '기다려 주셔서 고마워요.'로 바꿨다(C① 확인)
//  · 이 파일은 타입만 가져온다(값을 가져오지 않음 — 시험 · 글 점검 도구가 글만 읽는다)
import type { DeclineReason, FixReason, StepKey, StepState } from './launchApi';
import type { TodoKind, WaitTask } from './launchLogic';

export const PRELAUNCH = {
  headerTitle: '출연 준비',
  applicantNo: (no: string) => `신청 번호 ${no}`, // NP-02
  applicantNoNote: '순서를 뜻하는 번호는 아니에요.', // NP-02
  stepsTitle: '확정까지', // P-D2 단계표 제목
  steps: { identity: '본인 확인 · 나이', photos: '사진 · 셀피', survey: '결혼관 설문', docs: '서류(선택)', confirm: '확정' } satisfies Record<StepKey, string>, // NP-03
  states: { todo: '아직', checking: '확인 중', done: '확인됨', fix: '보완 필요', na: '준비 중' } satisfies Record<StepState, string>, // NP-03
  todo: {
    surveyTodo: '설문을 이어서 해 주세요.',
    photosTodo: '사진을 올려 주세요.',
    photosFix: '사진에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    surveyFix: '설문에 보완이 필요해요. 다시 답해 주시면 이어서 확인할게요.',
    docsFix: '서류에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    checking: '올려 주신 내용을 확인하고 있어요. 확인이 끝나면 이 화면에 보여 드려요.',
  } satisfies Record<Exclude<TodoKind, null>, string>, // NP-04 · NP-06
  // 보완 이유 한 줄(S18 review.fix_reason — 칸에 '보완 필요'가 있을 때 앞 칸 먼저). K20 2-3 '이유 한 줄 + 다시 올려 주시면 이어서 확인할게요.' 새 글(C① 확인)
  fixReason: {
    identity_age: '생년월일 확인이 더 필요해요. 고객센터로 문의해 주시면 이어서 확인할게요.',
    photo_face: '얼굴 정면 사진에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    photo_full: '전신 사진에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    photo_free: '자유 사진에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    doc_school: '학교 서류에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    doc_job: '직업 서류에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
    doc_asset: '자산 서류에 보완이 필요해요. 다시 올려 주시면 이어서 확인할게요.',
  } satisfies Record<FixReason, string>,
  firstRecLabel: '첫 매칭', // NP-09(V5)
  firstRec: (when: string) => when, // NP-09: '12월 23일 수요일 오후 6시' — 날짜 · 요일 · 시각만(서버 launch_text 그대로)
  firstRecUnknown: '첫 매칭 날짜가 정해지면 여기에 보여 드려요.',
  confirmedTitle: '출연 확정', // K20 2-1 화면 말
  confirmed: (when: string) => `확정됐어요. 첫 매칭은 ${when}에 열려요. 탑승권을 사면 그날 나와 수준이 가장 잘 맞는 한 분과 이어져요.`, // NP-05(V5)
  confirmedNoDay: '확정됐어요. 탑승권을 사면 나와 수준이 가장 잘 맞는 한 분과 이어져요.',
  confirmedA11y: (when: string) => `확정. 첫 매칭 ${when}`, // NP-22
  declinedTitle: '지금은 함께하기 어려워요', // NP-07(11장)
  declined: {
    under_24: '결정사는 만 24세부터 함께해요.',
    married: '혼인 중인 것으로 확인되어 지금은 함께하기 어려워요.',
    fake: '본인 사진이 아니거나 같은 분의 계정이 여럿인 것으로 확인됐어요.',
    forged: '제출한 서류가 사실과 다른 것으로 확인됐어요.',
  } satisfies Record<DeclineReason, string>, // NP-07(11장 · K20 2-3)
  declinedNext: {
    under_24: '만 24세 생일이 지나면 다시 가입할 수 있어요.',
    married: '잘못 확인됐다면 혼인관계증명서를 보내 주세요. 다시 확인할게요.',
    fake: '잘못 확인됐다고 생각되면 고객센터로 알려 주세요.',
    forged: '잘못 확인됐다고 생각되면 고객센터로 알려 주세요.',
  } satisfies Record<DeclineReason, string>, // NFK20-05(11장)
  declinedUnknown: '지금은 함께하기 어려워요. 문의는 고객센터로 해 주세요.',
  vouchedBy: (name: string) => `${name}님이 아는 사이라고 확인해 주셨어요. 확정 순서나 결과는 달라지지 않아요.`, // NP-14 받는 쪽(11장 · '지인 확인' D-123 ③)
  region: {
    count: (name: string) => `${name}은 함께 시작할 분들을 모으고 있어요. 시작하면 이 화면에 탑승권이 열려요.`, // NP-17(인원 · 칸 · 판정 전)
    countNoName: '내 지역은 함께 시작할 분들을 모으고 있어요. 시작하면 이 화면에 탑승권이 열려요.',
    ratio: '같은 지역 분들이 고르게 모이면 첫 매칭을 시작해요.', // NP-17(성비)
    title: '내 지역 첫 매칭',
    early: '지역 넓혀 먼저 시작하기', // NP-18 버튼
    earlyTitle: '지역을 넓혀 먼저 시작할까요?',
    earlyBody: '다른 지역 분과 매칭될 수 있어요.', // NP-18 확인 한 줄
    earlyConfirm: '먼저 시작하기',
    earlyCancel: '취소',
    earlyJoined: (day: string) => `${day}부터 다른 지역 분과도 매칭될 수 있어요.`,
    earlyJoinedNoDay: '다음 주부터 다른 지역 분과도 매칭될 수 있어요.',
    earlyLocked: '지역 조건을 양보할 수 없게 두셨어요. 지역 조건을 바꾸면 먼저 시작할 수 있어요.', // K20 3-4 ② — 서버가 대신 풀지 않음
  },
  defer: {
    title: '첫 매칭 날짜가 바뀌었어요', // NP-19 제목(새 글)
    body: (when: string) => `첫 매칭을 ${when}로 미뤘어요. 잘 맞는 분과 이어 드리려고 회원이 조금 더 모일 때까지 기다리기로 했어요. 기다려 주셔서 고마워요.`, // NP-19
    ok: '확인했어요',
  },
  tasksTitle: '기다리는 동안 할 일', // NP-21
  tasks: {
    avoid: { name: '아는 분 미리 피하기', line: '적어 둔 회사와 학교 분과는 매칭되지 않아요.' }, // NP-13
    docs: { name: '서류 인증', line: '학교 · 직업 · 자산 서류 중 낼 것만 골라요. 확정에는 필요 없어요.' },
    vouch: { name: '지인 확인', line: '결혼을 진지하게 생각하는 지인에게 확인 코드를 보낼 수 있어요. 세 분까지이고, 이어진 두 분은 서로 매칭되지 않아요.' }, // 11장(D-123 ③ '지인 보증' → '지인 확인')
    link: { name: '신청 잇기', line: '인스타그램으로 먼저 신청하셨나요?' }, // NP-12 첫 줄
  } satisfies Record<WaitTask, { name: string; line: string }>,
  linkOpen: '신청 잇기',
  notice: "'출연'은 결정사에서 쓰는 말이에요. 방송이나 촬영은 없어요.", // NP-08: 3곳 같은 글(대기 화면 · 확정 카드 · 신청 잇기 시트)
  loadFailed: '출연 준비 상태를 불러오지 못했어요. 다시 시도해 주세요.', // NFK20-07(11장)
  stepsA11y: (parts: string) => `확정까지 단계. ${parts}`, // NP-22
} as const;

// 출시 전 다른 탭 · 01(K20 4-1 · 4-5 · NP-01 · NP-15 · NP-16)
export const PRELAUNCH_TABS = {
  likes: '호감은 첫 매칭이 시작되는 날부터 주고받을 수 있어요.', // NP-15(V5 숨김 탭 — 켜면 보임)
  shop: (monthDay: string) => `상점은 ${monthDay}에 열려요.`, // NP-16 — 상품 목록 · 구매 권유 0
  shopNoDay: '상점은 출시일에 열려요.',
  firstCalc: '등급은 출시일 새벽에 처음 계산해요.', // NP-16(16-G 내 등급 쪽) — 키 이름에 영어 등급 낱말을 쓰지 않는다(staticRules 등급 낱말 허용 목록 밖 파일)
  onboarding: (monthDay: string) => `지금은 출시 전이에요. 첫 매칭은 ${monthDay}에 시작해요.`, // NP-01(V5)
} as const;

// 신청 잇기 시트(NP-12 · P-D6)
export const LINK_SHEET = {
  title: '신청 잇기',
  body: '신청 번호와 잇기 코드 6자리를 넣어 주세요.', // NP-12
  noLabel: '신청 번호',
  noPlaceholder: '예) 1018-4721',
  codeLabel: '잇기 코드',
  codePlaceholder: '6자리',
  same: '잇지 않아도 쓰는 데 차이는 없어요.', // B22 done.link 둘째 문장(B21)
  submit: '잇기',
  close: '닫기',
  linkedToast: (no: string) => `신청 번호 ${no}로 이었어요.`, // NP-12 성공(토스트 40자 안)
  errors: {
    invalid: '신청 번호나 잇기 코드가 맞지 않아요. 신청 완료 화면에 적힌 값을 다시 확인해 주세요.',
    already: '이미 신청을 이은 계정이에요. 다시 이을 필요는 없어요.', // S18 4-2: already_linked = 이미 이은 계정
    limit: '오늘은 더 이을 수 없어요. 내일 다시 시도해 주세요.',
    session: '로그인이 풀렸어요. 다시 로그인해 주세요.', // 카피.md 4장 COMMON.sessionLost 와 같은 글
  },
} as const;
