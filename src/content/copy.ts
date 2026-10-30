// 01 온보딩 · 02 가입 · 03 동의 화면의 글(F1). 글자를 바꾸지 않는다.
//  원본: 마케팅/카피.md(01 · 02 · 03 확정) → 거기 없으면 기획/화면_요구사항.md 6장 N문구 · 기획/정책.md 10-2 NK문구.
//  동의 체크 칸 · 요약 · 전문 · 안내 상자 · 가입 안내는 법무 문서에서 자동으로 뽑은 consentContent.ts 에 있다(여기에 옮겨 적지 않는다).
// scripts/check-copy.mjs 가 아래 글이 모두 원본에 그대로 있는지 확인한다. 이 파일은 다른 파일을 가져오지 않는다(Node 가 바로 읽는다).

// 공통 문구(카피.md 4장)
export const COMMON = {
  loading: '불러오는 중이에요',
  offline: '인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.',
  server: '잠시 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.',
  sessionLost: '로그인이 풀렸어요. 다시 로그인해 주세요.',
  retry: '다시 시도',
} as const;

// 01 온보딩(카피.md 01)
export const ONBOARDING = {
  logo: '결정사',
  brandLine: '결혼을 정말 하고 싶은 사람들', // 스플래시의 브랜드 한 줄(D15). 1장 제목과 같은 글
  // v5 티켓 매칭(D42-I · D-176): 그림 장면 글(디자인/D42_새판/그림 '2차 · 4안 확정')과 같은 글. 카피.md 01 개선안 그대로
  slides: [
    {
      title: '결혼을 정말 하고 싶은 사람들',
      body: '설문 · 사진 · 인증으로 결혼 조건을 꼼꼼히 살펴요.',
    },
    {
      title: '일주일에 한 번, 한 분',
      body: '탑승권 한 장으로 수요일 18:00에 나와 가장 잘 맞는 한 분을 만나요.',
    },
    {
      title: '여행지에서 천천히',
      body: '만난 분과 7일 동안 이야기해요. 서로 원하면 더 이어 가요.',
    },
  ],
  start: '시작하기',
  haveAccount: '이미 계정이 있어요',
} as const;

// 02 가입 · 로그인(카피.md 02 · 화면_요구사항 N01 · N02 · N23 · 정책 NK09 · NK10)
export const SIGN_IN = {
  headerTitle: '가입 · 로그인',
  title: '이메일로 시작해요',
  subtitle: '인증번호를 이메일로 보내드려요.',
  emailLabel: '이메일',
  emailPlaceholder: 'example@email.com',
  sendCode: '인증번호 받기',
  codePlaceholder: '인증번호 6자리',
  // 인증번호를 보낸 뒤 다시 받을 수 있을 때까지 남은 시간. mmss 는 '02:59' 꼴
  retryAfter: (mmss: string) => `${mmss} 뒤에 다시 받을 수 있어요`,
  birthLabel: '생년월일',
  birthPlaceholder: '생년월일 8자리 (예: 19950312)',
  confirm: '확인',
  ageNotice: '만 24세 이상만 가입할 수 있어요.', // D-100 · D-123(카피.md 02 · 동의문구 5-2와 같은 날)
  errors: {
    emailFormat: '이메일 주소를 다시 확인해 주세요.',
    sendFailed: '인증번호를 보내지 못했어요. 이메일 주소를 확인하고 다시 시도해 주세요.',
    codeWrong: '인증번호가 맞지 않아요. 다시 확인해 주세요.',
    codeExpired: '입력 시간이 지났어요. 인증번호를 다시 받아 주세요.',
    tooMany: '인증을 너무 많이 시도했어요. 잠시 뒤에 다시 해 주세요.',
    birthFormat: '생년월일을 다시 확인해 주세요.',
    underage: '만 24세 이상만 가입할 수 있어요.',
    emailUnavailable: '지금은 이 이메일로 가입할 수 없어요. 문의가 필요하면 고객센터로 연락해 주세요.',
    accountBlocked: '이용이 일시 정지됐어요. 확인이 끝나면 다시 이용할 수 있어요. 문의는 고객센터로 해 주세요.',
  },
} as const;

// 03 약관 · 동의(카피.md 03 · 화면_요구사항 N28)
export const CONSENT = {
  headerTitle: '약관 동의',
  title: '시작하려면 동의가 필요해요',
  submit: '동의하고 계속',
  more: '보기 ›',
  fullText: '전문 보기',
  // 동의 문구가 바뀐 뒤 로그인했을 때: 바뀐 칸만 다시 받는다(동의문구 3-5)
  reconsentTitle: '동의 내용이 바뀌었어요',
  reconsentSubtitle: '바뀐 항목에만 다시 동의해 주세요.',
  // 링크 줄(이용약관 · 개인정보 처리방침 보기)을 누르면 열리는 읽기 화면의 두 문서 이름
  documents: { terms: '이용약관', privacy: '개인정보 처리방침' },
} as const;

// 화면에 글자로 보이지 않는 스크린리더용 이름(원본 문서에 없는 것은 카피 확정 전 가안)
export const A11Y = {
  back: '뒤로',
  close: '닫기',
  introDot: (n: number, total: number) => `소개 ${n} / ${total}`,
  myProfile: '내 프로필', // 머리 오른쪽 위 원형 사진 버튼의 이름(화면_요구사항 R15 · 카피.md NS3 가안)
} as const;

// 하단 탭 4개의 이름(화면_요구사항 R6 · K7). 상점은 카피.md 16 NS1 확정. 탭 이름은 스크린리더 이름과 같다.
export const TABS = { recommendations: '추천', likes: '호감', shop: '상점', settings: '설정' } as const;

// 16 상점(F11, 카피.md 16 · NS1 확정 · NS2 가안 · 디자인 D19 5장). 결제 전(0단계)은 무료 '내 성향 리포트' 카드 하나뿐이다. 상품 목록 · 등급은 F13.
export const SHOP = {
  headerTitle: '상점',
  reportTitle: '내 성향 리포트',
  reportFree: '무료',
  reportBody: 'AI가 정리한 내 성향을 한눈에 다시 볼 수 있어요.',
} as const;

// 06 AI 정리 중(카피.md 06 · 화면_요구사항 06 · N13). scripts/check-copy.mjs J 가 원본과 대조한다.
export const ANALYSIS = {
  headerTitle: 'AI 정리 중',
  title: '답변을 정리하고 있어요',
  subtitle: 'AI가 설문 내용을 정리하고 성향을 살펴보고 있어요. 1분쯤 걸려요.',
  aiNotice: '이 서비스는 AI(Claude)를 이용해요. 이름, 이메일, 사진은 보내지 않아요.',
  steps: ['정리', '성향 파악', '중요도 제안'],
  slow: '평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요.',
  failTitle: '정리하지 못했어요',
  failBody: '일시적인 문제로 답변을 정리하지 못했어요. 작성한 내용은 저장되어 있어요.',
  retry: '다시 시도',
  manual: '직접 입력하기',
  manualNote: '정리가 계속 되지 않아요. 직접 입력해서 이어갈 수 있어요.',
} as const;

// 07 내 성향(카피.md 07 · 화면_요구사항 07 · N14). scripts/check-copy.mjs J 가 원본과 대조한다.
export const TRAITS = {
  headerTitle: '내 성향',
  title: 'AI가 정리한 내 성향이에요',
  subtitle: 'AI가 만든 결과라서 틀릴 수 있어요. 맞지 않는 부분은 직접 고칠 수 있고, 고친 내용이 최종이에요.',
  axisNote: '막대가 어느 쪽에 있든 좋고 나쁜 건 아니에요.', // 카피 20장(3부-아 · QP-33) — 숫자를 숨긴 뒤라 숫자 말 0
  tagsTitle: '나를 나타내는 말',
  summaryTitle: '요약',
  edit: '수정하기',
  confirm: '이대로 확정',
  cancel: '취소',
  save: '저장',
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
  // N14 입력 오류. 칩 글자 수 "2~8자로 써 주세요."는 기획 확정(K5, F10) — 서버 검사(8자 이하)·태그 스키마(2~8자)와 같다
  errors: {
    tagLength: '2~8자로 써 주세요.',
    tagDuplicate: '이미 있는 말이에요.',
    summaryShort: (n: number) => `${n}자 이상 써 주세요.`,
    contact: '전화번호나 링크는 쓸 수 없어요.',
  },
  // 07 안 글(B4 확정: 마케팅/카피.md 07 보강 표)
  evidenceShow: '근거가 된 질문 보기',
  evidenceHide: '근거가 된 질문 접기',
  evidenceIntro: '이 질문들에 답한 내용을 바탕으로 정리했어요.',
  addTag: '말 더하기',
  addTagLabel: '더할 말',
  addTagPlaceholder: '2~8자',
  addTagDone: '더하기',
  removeTag: (tag: string) => `${tag} 지우기`,
  summaryLabel: '요약 고치기',
  tagCount: (n: number, max: number) => `${n} / ${max}`,
  manualTitle: '내 성향을 직접 정해요',
  manualSubtitle: '막대를 끌어서 나에게 맞는 위치로 옮기고, 나를 나타내는 말을 골라 주세요. 요약은 비워도 돼요.',
  manualTagsHint: '1~5개 골라 주세요.',
  manualTagMin: '나를 나타내는 말을 1개 이상 골라 주세요.',
  sliderHint: '왼쪽으로 갈수록 낮고, 오른쪽으로 갈수록 높아요.',
  sliderValue: (name: string, value: number) => `${name} ${value}`,
  // [이대로 확정] 실패 4종(서버 오류 코드별). go 는 이동할 화면: consent_missing → 03 · survey_incomplete → 04 · photos_incomplete → 05 · other 는 같은 화면에서 다시 시도
  confirmErrors: {
    consent_missing: { title: '동의가 더 필요해요', body: '필수 동의가 모두 있어야 성향을 확정할 수 있어요. 동의 화면에서 확인해 주세요.', go: '동의 화면으로 가기', cancel: '취소' },
    survey_incomplete: { title: '답하지 않은 질문이 있어요', body: '필수 질문에 모두 답해야 확정할 수 있어요. 설문에서 빠진 질문을 확인해 주세요.', go: '설문으로 가기', cancel: '취소' },
    photos_incomplete: { title: '사진이 더 필요해요', body: '사진 3장을 모두 올려야 확정할 수 있어요. 사진 화면에서 확인해 주세요.', go: '사진 올리러 가기', cancel: '취소' },
    other: { title: '확정하지 못했어요', body: '일시적인 문제로 확정하지 못했어요. 잠시 뒤에 다시 시도해 주세요.', go: '다시 시도', cancel: '취소' },
  },
} as const;

// 06 · 07 의 스크린리더용 이름(카피.md 07 보강, B4 확정)
export const AI_A11Y = {
  progress: '정리 진행 상태',
  stepNow: (name: string) => `지금은 ${name} 단계예요`,
} as const;

// 08 내 프로필(카피.md 08 · 화면_요구사항 08 · N10 · N15). scripts/check-copy.mjs K08 이 원본과 글자 그대로 대조한다.
export const PROFILE = {
  headerTitle: '내 프로필',
  badgeVerifyPending: '인증 대기',
  badgeVerifyPendingNote: '직접 입력한 정보예요. 서류로 확인된 것은 아니에요.',
  badgePhotoChecking: '사진 확인 중',
  badgePhotoCheckingNote: '운영팀이 사진을 확인하고 있어요. 끝나면 공개돼요.',
  badgePhotoRetry: '사진 다시 올리기',
  badgePhotoRetryNote: '사진을 다시 올려 주세요. 운영팀이 확인한 사진만 공개돼요.',
  visibilityTitle: '공개 범위',
  visibilitySubtitle: '공개하지 않은 항목도 짝을 고르는 데에는 쓰여요. 다른 분에게 보이는 항목만 내가 정해요.',
  // 토글 이름 9개(정책 2-3 표 순서). 처음에 켜짐 7개 · 꺼짐 2개(출신 학교 · 직장명)
  toggles: {
    religion: '종교',
    maritalHistory: '혼인 이력',
    children: '자녀 유무',
    school: '출신 학교',
    employer: '직장명',
    income: '연봉 구간',
    assets: '본인 자산 구간',
    parentEducation: '부모님 학력 (구간)',
    parentAssets: '부모님 자산 (구간)',
  },
  toggleLocked: '답하지 않은 항목이라 바꿀 수 없어요.',
  firstTitle: '다른 분에게 보일 항목을 확인해 주세요',
  firstBody:
    '종교, 혼인 이력, 자녀, 연봉·본인 자산 구간, 부모님 학력·자산 구간, 같은 취미는 처음에 보이도록 켜져 있어요. 보이고 싶지 않은 항목은 지금 끌 수 있어요. 짝을 고를 때는 끈 항목도 쓰여요.', // 10-28 법무 동의문구 5-6(IF2-L '같은 취미') · 카피 14-2
  firstConfirm: '확인했어요',
  save: '저장',
  saved: '저장했어요.',
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
} as const;

// 08 안에서 쓰는 글 중 원본 문서에 아직 없는 것(카피 확정 전 가안). check-copy 의 원본 대조 대상이 아니다.
export const PROFILE_DRAFT = {
  badgeVerified: '인증 완료', // 2차(서류 인증이 열린 뒤). 1차에는 보이지 않는다
  rangeNote: '구간으로만 보여요',
  photosTitle: '내 사진',
  photoSlots: { face: '얼굴 정면', full: '전신', free: '자유' },
  photoStatus: { approved: '공개 중', pending: '확인 중', rejected: '다시 올려 주세요', none: '아직 없어요' },
  photoReupload: '사진 다시 올리기',
  photoMissing: '사진을 불러오지 못했어요',
  toggleOn: '켜짐, 다른 분에게 보여요',
  toggleOff: '꺼짐, 다른 분에게 보이지 않아요',
  headLabel: (name: string, age: string, region: string) => `${name}, ${age}, ${region}`,
  ageUnit: (age: number) => `${age}세`,
} as const;

const SAFETY_MINOR = '만 19세 미만으로 보이면 24시간 안에 먼저 확인해요. 결정사는 만 24세 이상만 가입할 수 있어요.'; // L19(D-198 ②): 동의문구 5-6 — 아동 보호 우선 확인은 만 19세 기준, 가입 자격은 만 24세(QPL 6-B B8 갱신본)

// 안전 안내 한 줄(N34): 01 · 10 · 11 이 같은 글을 쓴다
export const SAFETY = {
  line: '만나기 전에 개인정보와 금전 요구에 주의하고, 불편하면 바로 신고해 주세요.',
  // 법무 L5: 신고 사유 아래(10 · 11) · 안전 안내 화면 · 아동 안전 문의가 같은 문장을 쓴다
  minorNote: SAFETY_MINOR,
  // 카피 12 NFK07-01 '12 안전 안내 맨 위' 확정 글(3부-차 · 10-30). 위기 도움 카드 둘째 줄과 12 안전 안내 맨 위가 같은 상수를 부른다
  emergency: '위급한 상황이면 112나 119에 먼저 연락해 주세요.',
} as const;

// 위기 도움 카드(라운지 · 대화방 · 12 공용 — 카피 19-14, 정책 P4-29 ~ 36). 기관 · 번호는 법무 값(자살예방 상담전화 109 — 법무 LG 15-2 공식 대조 10-29, 켜는 달 재확인 한 번)이라 글과 따로 한 곳에 둔다
export const CRISIS_LINE = { agency: '자살예방 상담전화', phone: '109' } as const;
export const CRISIS = {
  note: (agency: string, phone: string) => `혹시 많이 힘들다면 혼자 견디지 않아도 돼요. ${agency}(${phone})에서 이야기를 들어 줘요.`,
  close: '닫기',
  a11y: (body: string) => `도움 안내, ${body}`,
} as const;
/** 카드 · 12 안전 안내 맨 위가 보이는 첫째 줄(기관 · 번호를 채운 글) */
export const crisisNote = (): string => CRISIS.note(CRISIS_LINE.agency, CRISIS_LINE.phone);

// 신고 · 차단 시트(N33). 10 상단 '신고 · 차단'과 11 행의 ⋯ 가 같은 시트를 연다
export const REPORT_SHEET = {
  moreA11y: '더보기',
  title: '신고 · 차단',
  report: '신고하기',
  reportHint: '문제가 있는 프로필이나 사진을 알려 주세요.',
  block: '차단하기',
  blockHint: '차단한 분은 설정의 차단 목록에서 풀 수 있어요.',
  cancel: '취소',
  reasonTitle: '신고 사유를 골라 주세요',
  reasons: ['가짜 프로필·사칭', '허위 정보', '부적절한 사진', '욕설·혐오·성적 표현', '연락처·광고·외부 유도', '미성년자로 보임', '금전 요구·사기 의심', '기타'],
  reasonRP6Note: SAFETY_MINOR,
  anonymousNote: '신고한 분이 누구인지는 상대에게 알리지 않아요.',
  descLabel: '설명',
  descPlaceholder: '무슨 일이 있었는지 적어 주세요. (선택)',
  descPlaceholderOther: '무슨 일이 있었는지 10자 이상 적어 주세요.',
  submit: '제출하기',
  errors: {
    noReason: '신고 사유를 골라 주세요.',
    descShort: '10자 이상 써 주세요.',
    descLong: '200자까지 쓸 수 있어요.',
    already: '이미 신고했어요.',
    failed: '신고하지 못했어요. 다시 시도해 주세요.',
  },
  done: '신고했어요. 확인한 뒤에 처리할게요.',
  blockConfirm: '이분을 차단할까요? 서로 보이지 않게 돼요.',
  blockDone: '차단했어요.',
  blockFailed: '차단하지 못했어요. 다시 시도해 주세요.',
} as const;

// 12 설정 › 안전 안내 화면(N34)
export const SAFETY_GUIDE = {
  rowName: '안전 안내',
  title: '만나기 전에 확인해 주세요',
  // 맨 위 두 줄(3부-차 · 카피 12): 급할 때 112 · 119 먼저, 힘든 마음이면 상담전화 109 — 늘 보이는 정적 안내(판정 0 · 단추 0)
  emergency: SAFETY.emergency,
  crisis: crisisNote(),
  lines: [
    '처음 만날 때는 사람이 많은 공개된 장소를 골라요.',
    '만나는 날짜와 장소는 가족이나 친구에게 알려 두세요.',
    '이름 전체, 집이나 직장 주소, 계좌 정보, 신분증 사진은 충분히 믿을 수 있을 때까지 알려 주지 마세요.',
    '돈을 보내 달라거나 투자, 선물을 요구하면 응하지 말고 바로 신고해 주세요.',
    '연락처를 묻거나 다른 곳으로 옮기자는 말에는 조심하고, 불편하면 신고해 주세요.',
    "불편하거나 위험하다고 느끼면 상대 프로필의 '신고 · 차단'에서 바로 알려 주세요.",
  ],
  minorNote: SAFETY_MINOR,
} as const;

// 12 설정 › 고객센터(N27). 값 {고객센터 이메일} · {고객센터 운영 시간}은 본인 결정(D-28)이라 앱에 박지 않고 설정에서 넣는다
export const SUPPORT = {
  rowName: '고객센터',
  emailLabel: '문의 이메일 {고객센터 이메일}',
  hoursLabel: '운영 시간 {고객센터 운영 시간}',
  contactPending: '고객센터 연락처는 준비하고 있어요. 그동안 불편한 일은 앱 안 신고로 알려 주세요.', // 카피 12-Q(3부-아 · QP-31) — {고객센터 이메일} 값이 비면 이메일 · 운영 시간 줄과 [복사] · [메일 앱 열기] 대신
} as const;

// 12 고객센터 › 아동 안전 문의(N35)
export const CHILD_SAFETY = {
  row: '아동 안전 문의',
  body: "아동·청소년의 안전에 관한 문제는 아래 연락처로 알려 주세요. 앱에서는 신고 사유 '미성년자로 보임'이나 '부적절한 사진'으로도 알릴 수 있어요.",
  contact: '아동 안전 담당 연락처 {고객센터 이메일}',
  policy:
    '아동·청소년을 성적으로 이용하는 글과 사진은 모두 금지돼요. 발견하면 바로 숨기거나 삭제하고, 계정을 영구 정지하고, 관계 기관에 신고해요. 만 19세 미만으로 보이면 24시간 안에 먼저 확인해요. 결정사는 만 24세 이상만 가입할 수 있어요.', // L19(D-198 ②): SAFETY_MINOR 와 같은 문장
} as const;

// 09 오늘의 추천(F5, 카피.md 09 · N16). {시간} 은 "14시간 32분" 꼴(lib/recsLogic.ts formatRemaining)
export const RECS = {
  headerTitle: '오늘의 추천',
  remaining: (time: string) => `다음 추천까지 ${time}`,
  subtitle: '조건과 성향을 살펴 고른 세 분이에요.',
  subtitleFew: (who: string) => `조건과 성향을 살펴 고른 ${who}이에요.`, // N16: 카드가 1~2장일 때
  who: { one: '한 분', two: '두 분' },
  matchLabel: '맞는 점',
  sentLabel: '호감 보냄', // N16
  passedLabel: '넘김', // N16
  emptyTitle: '오늘은 추천할 분이 없어요', // 카피.md 09 개정(B7, D-49)
  emptyBody: '조건과 성향을 살펴봤지만 이번에는 찾지 못했어요. 내일 다시 찾아볼게요.',
  emptyHint: '희망 조건을 바꾸면 추천이 달라질 수 있어요.',
  emptyButton: '희망 조건 보기',
  allDone: (time: string) => `오늘 추천은 여기까지예요. 다음 추천까지 ${time} 남았어요.`, // 카피.md 09 개정(B7, D-49)
  loadFailed: '추천을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
  photoChecking: '사진 확인 중', // NK03 (정책 10-2 가안)
  preparing: '추천을 준비하고 있어요.', // NK02 제목(카피.md 09 확정 B5): 추천 0장 + 첫 목록 대기 아님 + 서버 ready=false
  preparingNote: '조금만 기다려 주세요. 준비가 끝나면 이 화면에 보여 드려요.', // NK02 보조(B5)
  firstWait: (hours: number) => `첫 추천은 ${hours}시간 뒤에 도착해요.`, // NK01 제목(카피.md 09 확정 B5): 추천 0장 + 서버 first_list_pending
  firstWaitMinutes: (minutes: number) => `첫 추천은 ${minutes}분 뒤에 도착해요.`, // NK01: 1시간 미만
  firstWaitToday: '오늘 오전 9시에 도착해요.', // NK01: 첫 목록이 오늘 09:00 이고 지금이 그 전일 때
  firstWaitNote: '알림을 켜 두면 추천이 도착할 때 알려 드려요.', // NK01 보조(B5)
  // 추천이 1~2명인 날 카드 아래 안내 3줄(카피.md 09 확정 B15, D-66 ①). 서버 region_hint 가 true 이고 무료 카드가 1~2장일 때만. {n} 은 카드 수 1 또는 2
  widenNote: (n: number) => `오늘은 ${n}분만 추천했어요. 지역 조건을 넓히면 추천이 달라질 수 있어요.`,
  widenOwnNote: '조건은 내가 직접 바꿀 때만 달라져요.',
  widenButton: '지역 조건 바꾸기', // 누르면 12 희망 조건 수정의 길로 이동만 한다. 누르기만 해서는 서버 값이 바뀌지 않는다
  photoA11y: '사진',
  cardA11y: (head: string) => `${head} 프로필 보기`,
} as const;

// 10 상대 프로필(F5, 카피.md 10)
export const CANDIDATE = {
  headerTitle: '프로필',
  photoIndex: (n: number, total: number) => `사진 ${n} / ${total}`,
  prevPhoto: '이전 사진',
  nextPhoto: '다음 사진',
  tableLabels: { income: '연봉 구간', parentEducation: '부모님 학력', parentAssets: '부모님 자산' },
  // 10 공개 항목 15개 구역(정책 2-5, F14). 카피.md 10 에 아직 없는 글: 마케팅 확인 대기. 이름은 설문_문항표 질문에서 줄였다
  openTitle: '공개한 정보',
  openLabels: {
    A04: '출신 지역',
    A10: '음주',
    A11: '병역',
    A08: '자녀',
    D05: '형제자매 수',
    D06: '몇째',
    B03: '전공',
    B04: '유학 경험',
    C03: '직급',
    C04: '고용 형태',
    C06: '본인 자산',
    B02: '출신 학교',
    C02: '직장명',
    G02: '체형',
    G03: '스타일',
  },
  hidden: '비공개',
  whyTitle: '왜 추천했나요',
  whyNote: '추천 점수는 보여주지 않아요.', // 법무 L10 W1 · 마케팅 B7 A7 확정(D-50). 별도 문자열이라 빼도 동작이 같다
  disclaimer: '이 프로필은 회원이 직접 입력한 내용이에요. 서류로 확인되지 않았어요.',
  pass: '넘기기',
  like: '호감 보내기',
  liked: '호감 보냄',
  likeDone: '호감을 보냈어요. 상대가 수락하면 알려 드릴게요.',
  likeConnected: '서로 수락했어요 · 연락 방법은 준비 중이에요',
  likeFailed: '호감을 보내지 못했어요. 다시 시도해 주세요.',
  likeLimit: '오늘 보낼 수 있는 호감을 모두 보냈어요. 내일 오전 9시에 다시 보낼 수 있어요.', // NK04 (정책 10-2 가안)
  passFailed: '넘기지 못했어요. 다시 시도해 주세요.',
  unavailable: '이 프로필은 더 이상 볼 수 없어요.',
  confirm: '확인',
} as const;
