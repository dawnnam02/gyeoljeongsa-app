// 탑승권 · 기다림 · 공개 순간 · 크레딧 글(V5 W6). 카피.md 에 아직 없는 새 글 — app/W6_변경기록.md 에 카피 키 제안으로 적었다(W13 카피 직원이 다듬으면 그 글로 바꾼다).
//  · 해요체 · 느낌표 0 · 재촉 0(남은 자리 · 매진 임박 · 서두르세요 · 마감 임박 0) · 순서 번호 0 · 남은 때는 날 단위만
//  · 비유는 차분하게: 탑승권 · 탑승 · 여행에서 만난 분. 점수 · 순위 말 0
import type { CreditReason, Ineligible } from './boardingApi';

// 탑승권 값 한 곳(구매 시트 '가격' · 계약 설명 요약 블록 ② 가 같은 값을 쓴다 — 카피 14-6 '구매 화면과 같은 값에서 읽어 넣고')
export const TICKET_PRICE = '26,900원';

export const BOARDING = {
  headerTitle: '탑승권',
  ticketTitle: '결정사 탑승권',
  round: (n: number) => `${n}회차`,
  from: '출발',
  fromDefault: '내 지역',
  to: '도착',
  toValue: '여행지에서 만날 한 분',
  when: '만나는 때',
  state: '상태',
  stateNone: '아직 사지 않았어요',
  stateBoarded: '탑승 완료',
  stateCredit: '크레딧으로 탑승',
  beforeSale: {
    title: '탑승권 판매 전이에요',
    body: (open: string) => `${open}부터 이번 회차 탑승권을 살 수 있어요.`,
  },
  onSale: {
    title: '이번 주 탑승권',
    body: '탑승권을 사면 수요일 오후 6시에 나와 수준이 가장 잘 맞는 한 분과 이어져요. 수락 단계 없이 바로 대화방이 열려요.',
    buy: '탑승권 사기',
    buyCredit: '크레딧으로 타기',
    credits: (n: number) => `쓸 수 있는 크레딧이 ${n}장 있어요.`,
  },
  full: {
    title: '이번 회차 좌석이 모두 찼어요',
    body: (next: string) => `같은 지역 남녀 수를 맞추느라 좌석을 정해 두고 있어요. 다음 회차 탑승권은 ${next}부터 살 수 있어요.`,
  },
  closed: {
    title: '이번 회차 판매가 끝났어요',
    body: (next: string) => `다음 회차 탑승권은 ${next}부터 살 수 있어요.`,
  },
  boarded: {
    title: '탑승했어요',
    today: '오늘 오후 6시에 만나요',
    days: (n: number) => `${n}일 뒤에 만나요`,
    body: '기다리는 동안 프로필과 설문을 다듬어 두면 매칭에 그대로 쓰여요.',
  },
  tasksTitle: '기다리는 동안',
  tasks: {
    profile: { name: '프로필 다듬기', line: '사진과 공개 항목을 한 번 더 살펴봐요.' },
    survey: { name: '설문 다듬기', line: '바뀐 답이 있으면 고쳐 둘 수 있어요.' },
    chats: { name: '지난 매칭 대화', line: (n: number) => `대화방 ${n}개가 있어요.` },
  },
  matched: {
    title: '이번 주에 만난 분이 있어요',
    body: (name: string) => `${name}님과의 대화방이 열려 있어요.`,
    open: '만난 분 보기',
  },
  noMatch: {
    title: '완벽한 사람을 찾지 못했어요',
    body: '탑승권 1장을 크레딧으로 돌려드렸어요. 다음 회차에 그대로 쓸 수 있어요.',
    // 이유 줄(balance · no_fit · gap)은 화면에 두지 않는다 — 이유 코드는 기록용, 화면은 제목 한 줄(카피.md 14-5-2 · 청사진 4-3, QPM 3-2)
    credits: '크레딧 보기',
  },
  ineligible: {
    not_confirmed: { title: '확정을 마치면 탈 수 있어요', body: '사진과 설문 확인이 끝나면 탑승권을 살 수 있어요.', action: null },
    politics_missing: { title: '설문 한 문항이 남았어요', body: '정치 성향 문항에 답하면 탑승권을 살 수 있어요.', action: '설문으로' },
    paused: { title: '등급 계산이 멈춰 있어요', body: '등급 계산을 멈춰 두면 짝을 고를 수 없어 탑승권을 살 수 없어요. 설정에서 다시 켤 수 있어요.', action: '설정으로' }, // 카피.md 14-5-2(QPM 3-2) — 설정 줄 '등급 계산 멈추기'와 같은 말
    religion_missing: { title: '설문 한 문항이 남았어요', body: '종교 문항에 답하면 탑승권을 살 수 있어요.', action: '설문으로' }, // 카피.md 17-2(M-CK4 · 3부-사) — 누르면 설문(종교 동의가 없으면 카드부터)
  } satisfies Record<Ineligible, { title: string; body: string; action: string | null }>,
  creditsLink: (n: number) => `크레딧 ${n}장`,
  saleCloseNote: '판매는 수요일 오후 5시 30분에 마감해요.', // 카피 14-7(D-200 ④) — T1 판매 중 · T2 탑 카드 아래. 남은 시간 · 카운트다운 0
  // T2 [탑승 취소](D-200 ④ · D-201, 카피 14-7 · 화면_요구사항 T1 · T2 · 약관 제14조의2 ⑥ ⑦). 마감(수 17:30) 전에만 버튼이 보인다.
  //  확인창의 돌려받는 길: D-202(본인) — 마감 전 취소는 크레딧 1장, 돈은 회원이 결제한 스토어에 직접 요청(법무 L20 21장 · 카피 14-7)
  cancel: {
    button: '탑승 취소',
    title: '탑승을 취소할까요?',
    body: '자리를 바로 풀고, 탑승권 1장만큼 크레딧을 드려요. 크레딧은 기한 없이 다음 회차에 쓸 수 있어요. 돈으로 돌려받으려면 결제한 스토어에 환불을 요청해 주세요.', // 결제로 탄 좌석
    bodyCredit: '자리를 바로 풀고, 크레딧 1장을 다시 드려요. 크레딧은 기한 없이 다음 회차에 쓸 수 있어요.', // 크레딧으로 탄 좌석(카피 14-7 · 팀장 10-27) — 스토어 환불 문장 없음
    confirm: '탑승 취소',
    keep: '그대로 두기',
    done: '탑승을 취소했어요.',
    closed: '판매가 마감되어 취소할 수 없어요.',
    failed: '취소하지 못했어요. 다시 시도해 주세요.',
    supportNote: '고객센터로도 취소할 수 있어요.',
  },
  sheet: {
    title: '탑승권 사기',
    summary: (round: string, when: string) => `${round} · ${when} 매칭`,
    price: TICKET_PRICE,
    priceLabel: '가격',
    rules: ['탑승권은 회차마다 1장이에요.', '크레딧은 기한 없이 다음 회차에 쓸 수 있어요.', '판매 마감 전에는 취소할 수 있고, 결과가 공개된 뒤에는 돌려드리지 않아요.'], // 카피 14-7(D-200 ③ ④)
    deadlineNote: '판매 마감(수요일 오후 5시 30분) 전에 취소하면 크레딧으로 돌려드려요. 마감 뒤에는 취소할 수 없어요.', // 카피 14-7 · 법무 L20 15장 #3 — [결제하기] 바로 위(구매 전 고지)
    // 결혼중개 계약 설명 요약 블록(D-199 · 카피 14-6 · 동의문구 5-8 · 약관 제14조의2 ③). {…} 자리는 값이 없으면 그 줄째 숨김(content/fillLegal)
    contractSummaryTitle: '결혼중개 계약 주요 내용',
    contractSummary: [
      '무엇을: 매주 수요일 오후 6시에, 결혼 조건과 꼭 맞아야 할 조건(권역 · 본인 종교 · 정치 성향)으로 고른 한 분과 이어 드려요. 수락 단계 없이 7일 동안 대화방이 열려요.',
      `값: 탑승권 한 장 ${TICKET_PRICE}(부가세 포함)이에요. 누구나 같은 값이고, 이 밖에 가입비 · 회비 · 성사 요금은 없어요.`,
      '짝이 없을 때: 탑승권 한 장만큼 크레딧으로 돌려드려요. 크레딧은 기한 없이 다음 회차에 쓸 수 있어요.',
      '돌려받기: 판매 마감(수요일 오후 5시 30분) 전에 취소하면 크레딧 1장으로 돌려드려요. 돈으로 돌려받으려면 결제한 스토어에 환불을 요청해 주세요. 마감 뒤와 결과 공개 뒤에는 돌려드리지 않아요.',
      '약속하지 않는 것: 만남 · 교제 · 결혼을 약속하지 않아요.',
      '손해배상: 운영자의 고의나 과실로 손해가 생기면 법에 따라 배상해요.',
      '사업자: 국내결혼중개업 신고번호 {결혼중개업 신고번호} · 수수료표 보기 ›',
    ],
    pay: '결제하기',
    payCredit: '크레딧 1장으로 타기',
    close: '닫기',
    demo: '데모 결제예요. 실제 돈은 나가지 않아요.',
    contract: '결혼중개 계약 설명 보기', // [제안 L17A · D-190 ⑤] 약관 제14조의2 ③(BR09) — 누르면 약관 제14조의2 글 그대로(TermsArticleSheet)
  },
  bought: '탑승했어요. 수요일 오후 6시에 만나요.',
  buyErrors: {
    sold_out: '이번 회차 좌석이 모두 찼어요. 결제되지 않았어요.',
    already: '이번 회차 탑승권이 이미 있어요.',
    closed: '이번 회차 판매가 끝났어요. 결제되지 않았어요.',
    not_eligible: '지금은 탑승권을 살 수 없어요.',
    no_credit: '쓸 수 있는 크레딧이 없어요.',
    network: '인터넷 연결을 확인하고 다시 시도해 주세요.',
    server: '결제를 마치지 못했어요. 다시 시도해 주세요.',
    credited: '결제는 됐지만 그사이 자리가 모두 차서 크레딧 1장으로 돌려드렸어요. 다음 회차에 쓸 수 있어요.', // 카피 14-7(결제 뒤 자리 없음 전용 — 0030 paid_no_seat)
  },
  loadFailed: '탑승권을 불러오지 못했어요. 다시 시도해 주세요.',
  retry: '다시 시도',
} as const;

export const REVEAL = {
  kicker: (round: string) => `${round} · 수요일 오후 6시`,
  title: '이번 여행에서 만난 분이에요',
  body: '수락 단계 없이 대화방이 열려 있어요. 7일 동안 이야기할 수 있고, 둘 다 원하면 늘릴 수 있어요.',
  chat: '대화 시작하기',
  profile: '프로필 자세히 보기',
  back: '탑승권으로',
  photoA11y: '만난 분 사진',
  failed: '만난 분을 불러오지 못했어요. 다시 시도해 주세요.',
} as const;

// 공개 전 도착 화면(D42-M · D-178). 원본 = 마케팅/카피.md 12장(check:copy V 가 글자 그대로 대조). 해요체 · 느낌표 0 · 재촉 0
export const ARRIVE = {
  title: '여행지에 도착했어요',
  body: '이번 주에 만날 한 분이 정해졌어요. 준비되면 열어 보세요.',
  open: '지금 열어 보기',
} as const;

export const CREDITS = {
  headerTitle: '크레딧',
  balanceLabel: '쓸 수 있는 크레딧',
  balance: (n: number) => `${n}장`,
  note: '크레딧 1장으로 다음 회차 탑승권 1장을 탈 수 있어요.', // 카피 14-7(D-200 ③) — '1년' 문장 지움
  noExpiry: '크레딧은 기한 없이 쓸 수 있어요. 탈퇴하면 남은 크레딧은 쓸 수 없어요.', // 카피 14-7 · 약관 ⑤ · 제22조 ⑧
  historyTitle: '내역',
  reasons: {
    // 세 이유를 한 줄로(카피.md 14-5-2 · 청사진 4-3, QPM 3-2) — 남녀 수 · 수준 말을 내역에 남기지 않는다
    balance: '짝을 찾지 못해 돌려받음',
    no_fit: '짝을 찾지 못해 돌려받음',
    gap: '짝을 찾지 못해 돌려받음',
    used: '탑승권으로 씀',
    cancelled: '탑승을 취소해 돌려받음', // 카피 14-7 CREDITS.reason.cancelled
    refund_taken: '스토어 환불로 회수됨', // 카피 14-7 CREDITS.reason.refundTaken
    refund_restored: '스토어 환불이 취소되어 다시 받음', // 카피 14-7 CREDITS.reason.refundRestored
    paid_no_seat: '결제 뒤 자리가 없어 돌려받음', // 카피 14-7 CREDITS.reason.paidNoSeat
    round_cancelled: '회차가 열리지 않아 돌려받음', // 카피 14-7 CREDITS.reason.roundCancelled
    admin: '고객센터에서 바로잡음', // 카피 14-7 CREDITS.reason.admin
    age_rejoin_restore: '다시 가입해 이어받음', // 카피 14-7 CREDITS.reason.ageRejoinRestore
  } satisfies Record<CreditReason, string>,
  // 카피 14-7 키 이름(CREDITS.reason.*)과 같은 글 — 대조용(check:copy X)
  reason: {
    cancelled: '탑승을 취소해 돌려받음',
    refundTaken: '스토어 환불로 회수됨',
    refundRestored: '스토어 환불이 취소되어 다시 받음',
    paidNoSeat: '결제 뒤 자리가 없어 돌려받음',
    roundCancelled: '회차가 열리지 않아 돌려받음',
    admin: '고객센터에서 바로잡음',
    ageRejoinRestore: '다시 가입해 이어받음',
  },
  delta: (d: number) => (d > 0 ? `+${d}장` : `${d}장`),
  round: (n: number) => `${n}회차`,
  empty: '아직 크레딧 내역이 없어요.',
  refund: '현금 환불은 탑승권을 산 앱 스토어에서 요청할 수 있어요.',
  failed: '크레딧 내역을 불러오지 못했어요. 다시 시도해 주세요.',
} as const;
