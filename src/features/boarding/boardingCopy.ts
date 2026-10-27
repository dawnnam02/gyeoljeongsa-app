// 탑승권 · 기다림 · 공개 순간 · 크레딧 글(V5 W6). 카피.md 에 아직 없는 새 글 — app/W6_변경기록.md 에 카피 키 제안으로 적었다(W13 카피 직원이 다듬으면 그 글로 바꾼다).
//  · 해요체 · 느낌표 0 · 재촉 0(남은 자리 · 매진 임박 · 서두르세요 · 마감 임박 0) · 순서 번호 0 · 남은 때는 날 단위만
//  · 비유는 차분하게: 탑승권 · 탑승 · 여행에서 만난 분. 점수 · 순위 말 0
import type { CreditReason, Ineligible } from './boardingApi';

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
  } satisfies Record<Ineligible, { title: string; body: string; action: string | null }>,
  creditsLink: (n: number) => `크레딧 ${n}장`,
  sheet: {
    title: '탑승권 사기',
    summary: (round: string, when: string) => `${round} · ${when} 매칭`,
    price: '26,900원',
    priceLabel: '가격',
    rules: ['탑승권은 회차마다 1장이에요.', '짝을 찾지 못하면 크레딧으로 돌려드려요.', '매칭이 이뤄진 뒤에는 돌려드리지 않아요.'],
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
  note: '크레딧 1장으로 다음 회차 탑승권 1장을 탈 수 있어요. 받은 날부터 1년 동안 쓸 수 있어요.',
  historyTitle: '내역',
  reasons: {
    // 세 이유를 한 줄로(카피.md 14-5-2 · 청사진 4-3, QPM 3-2) — 남녀 수 · 수준 말을 내역에 남기지 않는다
    balance: '짝을 찾지 못해 돌려받음',
    no_fit: '짝을 찾지 못해 돌려받음',
    gap: '짝을 찾지 못해 돌려받음',
    used: '탑승권으로 씀',
  } satisfies Record<CreditReason, string>,
  delta: (d: number) => (d > 0 ? `+${d}장` : `${d}장`),
  round: (n: number) => `${n}회차`,
  empty: '아직 크레딧 내역이 없어요.',
  refund: '현금 환불은 탑승권을 산 앱 스토어에서 요청할 수 있어요.',
  failed: '크레딧 내역을 불러오지 못했어요. 다시 시도해 주세요.',
} as const;
