// 12 설정 · 하위 화면 글(F7). 원본: 마케팅/카피.md 12(확정) · 기획/화면_요구사항.md 6장 N19 · N20 · N25 · N26 · N29 ~ N32 · 법무/동의문구.md 5-5 · 5-6 · 4-9.
// 글자는 원본 그대로다(띄어쓰기 · 가운뎃점까지). 신고 · 차단 시트(N33) · 안전 안내(N34) · 고객센터(N27) · 아동 안전(N35)은 content/copy.ts 의
// REPORT_SHEET · SAFETY_GUIDE · SUPPORT · CHILD_SAFETY 를 그대로 쓰고 여기에 다시 적지 않는다.
// 표시: [확정] 카피.md 12 확정 글(B4 · B5. 10-15 R-F7-1~10 · N19 · N20 · N25 · N30 확정 포함) · [법무] 동의문구 글자 그대로 · [K2] 화면_요구사항 4장 12 · [K3] 정책.md. 가안은 남아 있지 않다
// scripts/check-copy.mjs 의 O 그룹(10항목)이 이 파일과 원본 문서를 글자까지 대조한다(npm run check:copy).

export const SETTINGS = {
  headerTitle: '설정', // [확정] 카피.md 12 상단바
  rows: {
    notifications: '알림', // [확정]
    visibility: '공개 범위', // [확정]
    preferences: '희망 조건 수정', // [확정] 카피.md 12(B5) · N20
    verification: '인증 서류 제출', // [확정]
    blocked: '차단 목록', // [확정]
    reports: '신고 내역', // [확정]
    security: '보안', // [확정] N32
    support: '고객센터', // [확정] N27 (copy.ts SUPPORT.rowName 과 같은 글)
    consents: '동의 관리', // [확정] 카피.md 12 목록 · N25
    legal: '이용약관 · 개인정보 처리방침', // [확정] 카피.md 12 목록(Figma 12 3:473 한 줄)
    safety: '안전 안내', // [확정] N34 (copy.ts SAFETY_GUIDE.rowName 과 같은 글)
    infoGroup: '정보', // [확정] 카피.md 12 목록 '정보' 묶음
    licenses: '오픈소스 라이선스', // [법무] 5-6 · N29
    imageCredit: '이미지 출처 고지', // [확정] 카피.md 12(B5) · N30 (줄 이름 · 상단바)
  },
  verificationSoon: '준비 중', // [확정] 카피.md 12 "열리기 전에는 '준비 중'으로 표시" · Figma 12 오른쪽 글
  verificationToast: '준비 중이에요', // [확정] 카피.md 12(B5) · N19 인증 서류 제출 안내
  logout: '로그아웃', // [확정]
  withdraw: '탈퇴하기', // [확정]
  actionFailed: '처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.', // [확정] 로그아웃 · 탈퇴 실패
  rowA11yHint: '열기', // [확정] 카피.md 12(B5) · 스크린리더: 줄을 누르면 하위 화면이 열린다
  switchOn: '켜짐', // [확정] 카피.md 12(B5) · 스크린리더 스위치 값(08 토글 읽기 글의 앞말과 같음)
  switchOff: '꺼짐', // [확정] 카피.md 12(B5)
} as const;

// 12 탈퇴 확인창(법무 5-6 글자 그대로) · 재확인 단계(N31 확정). 틀림 · 시간 지남 · 횟수 초과는 02 글(copy.ts SIGN_IN.errors)을 그대로 쓴다
export const WITHDRAW = {
  title: '정말 탈퇴할까요?', // [법무]
  body: '탈퇴하면 바로 다른 분에게 보이지 않고, 연결된 분과의 연결도 끊겨요. 프로필·사진·설문 답변은 30일 뒤에 삭제되고 되돌릴 수 없어요.', // [법무]
  sub: '법령에 따라 남기는 접속기록과, 안전한 이용을 지키고 삭제한 정보가 되살아나지 않게 하는 데 쓰는 최소한의 정보(이메일이나 계정 번호를 변환한 값, 로그인 기록 등)는 따로 보관돼요. 같은 이메일로는 30일이 지난 뒤에 다시 가입할 수 있어요. 자세한 내용은 개인정보 처리방침에서 볼 수 있어요.', // [법무]
  confirm: '탈퇴하기', // [법무]
  cancel: '취소', // [법무]
  otpHeader: '탈퇴', // [확정] 카피.md 12(B5) · Figma 12e 197:240 상단바 글
  otpTitle: '이메일로 받은 인증번호를 입력해 주세요', // [확정] N31
  otpBody: '가입한 이메일로 인증번호 6자리를 보냈어요. 인증번호를 입력하면 탈퇴가 확정돼요.', // [확정] N31
  codeLabel: '인증번호 6자리', // [확정]
  retryAfter: (mmss: string) => `${mmss} 뒤에 다시 받을 수 있어요`, // [확정] 02와 같은 글
  resend: '인증번호 다시 받기', // [확정]
  submit: '탈퇴 확정', // [확정] N31
  sendFailed: '인증번호를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.', // [확정] N31
} as const;

// 12 알림 하위 화면(N19 · N26 · R-D18-3)
export const NOTIFY = {
  headerTitle: '알림', // [확정] 줄 이름과 같은 글(Figma 12h 230:2)
  recommendation: '추천이 도착했을 때', // [확정] 카피.md 12(B5) · N19
  like: '호감을 받았을 때', // [확정] 카피.md 12(B5) · N19
  match: '연결됐을 때', // [확정] 카피.md 12(B5) · N19
  marketing: '마케팅 알림', // [확정] 카피.md 12 알림 설정 안
  marketingNotes: [
    '받지 않아도 서비스는 똑같이 쓸 수 있어요.', // [법무] 4-9
    '오후 9시부터 다음 날 오전 8시까지는 보내지 않아요.', // [법무] 4-9
    '추천 도착, 호감, 연결 알림은 이 동의와 따로예요. 설정에서 따로 끌 수 있어요.', // [법무] 4-9
  ],
  pushDenied: '알림이 꺼져 있어요. 설정에서 허용해 주세요.', // [확정] R-D18-3 (카피.md 12 B5 · N19)
  pushPrime: '추천이 도착하거나 호감을 받았을 때 알려 드려요. 알림을 허용하지 않아도 서비스를 쓸 수 있어요.', // [법무] 5-5 (푸시 권한을 묻기 직전, 2단계)
  saved: '저장했어요.', // [확정] 카피.md 12(B5) · N10
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.', // [확정] 08 저장 실패와 같은 글
} as const;

// 12 보안 하위 화면(N32 확정, 가정 D-23 BD-4: 처음값 꺼짐)
export const SECURITY = {
  headerTitle: '보안', // [확정]
  captureBlock: '상대 화면 캡처 차단', // [확정]
  captureBlockNote: '켜면 이 기기에서는 다른 분의 프로필이 보이는 화면을 캡처하거나 녹화할 수 없어요. 다른 기기로 화면을 찍는 것은 막을 수 없어요.', // [확정]
} as const;

// 12 동의 관리 하위 화면(N25). 줄 이름은 03 체크 문구(consentContent.ts CONSENT_ITEMS)를 그대로 쓴다 — 여기에 옮겨 적지 않는다
export const CONSENT_MANAGE = {
  headerTitle: '동의 관리', // [확정]
  optionalTitle: '선택 동의', // [확정] 카피.md 12(B5) · N25
  agreedTitle: '동의한 내용', // [확정] 카피.md 12(B5) · N25
  requiredNote: '필수 항목은 끌 수 없어요. 동의를 거두려면 탈퇴해 주세요.', // [확정] 카피.md 12(B5) · N25
  view: '보기 ›', // [확정] 03 '보기 ›'와 같은 글(copy.ts CONSENT.more)
  ck4OffTitle: '종교 정보 동의를 끌까요?', // [확정] 카피.md 12(B5) · N25
  ck4OffBody: "입력한 종교 정보가 삭제되고 '답하지 않음'으로 바뀌어요. 상대가 종교를 꼭 지켜야 할 조건으로 정했다면 내가 추천에서 빠질 수 있어요.", // [확정] 카피.md 12(B5) · N25
  ck4OffConfirm: '끄기', // [확정] 카피.md 12(B5) · N25
  cancel: '취소', // [확정] 카피.md 12(B5) · N25
  saved: '저장했어요.', // [확정] 카피.md 12(B5) · N10
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.', // [확정] 08 저장 실패와 같은 글
} as const;

// 12 차단 목록 · 신고 내역(K2 12 · R-D18-1 · R-D18-2)
export const BLOCKED = {
  headerTitle: '차단 목록', // [확정]
  unblock: '차단 해제', // [K2] 12 '차단 목록' 줄 [차단 해제]
  empty: '차단한 분이 없어요', // [확정]
  unblocked: '차단을 풀었어요.', // [확정] 카피.md 12(B5, D-40·U28) 확인창 없이 바로 풀고 토스트
  unblockFailed: '차단을 풀지 못했어요. 다시 시도해 주세요.', // [확정] 카피.md 12(B5, D-40)
  unblockA11y: (head: string) => `${head} 차단 해제`, // [확정] 카피.md 12(B5) · 스크린리더 이름(버튼 글 + 사람)
} as const;

export const REPORTS = {
  headerTitle: '신고 내역', // [확정]
  empty: '신고한 내역이 없어요', // [확정]
  status: { received: '접수됨', reviewing: '확인 중', done: '처리됨' }, // [확정] R-D18-1 (정책 P5-11)
  // [확정] R-D18-2: 올해는 "10월 15일", 해가 다르면 "2025년 12월 3일". 시각은 쓰지 않는다
  dateThisYear: (month: number, day: number) => `${month}월 ${day}일`,
  dateOtherYear: (year: number, month: number, day: number) => `${year}년 ${month}월 ${day}일`,
} as const;

// 12 고객센터 버튼(N27 확정). 줄 · 안내 글은 copy.ts SUPPORT · CHILD_SAFETY
export const SUPPORT_ACTIONS = {
  copy: '복사', // [확정] N27
  openMail: '메일 앱 열기', // [확정] N27
  copied: '복사했어요.', // [확정] 카피.md 12(B5) · 복사 뒤 토스트
} as const;

// 고객센터 값(D-28)은 content/supportContact.ts(법무/판_관리.md 7장 '값' = FILL_INS 에서 읽음). 이 파일은 Node 글 점검(check-copy)이 바로 읽게 import 를 두지 않는다

// 12 정보 › 오픈소스 라이선스(N29, 법무 5-6) · 이미지 출처 고지(N30)
export const LICENSES = {
  headerTitle: '오픈소스 라이선스', // [법무]
  intro: '결정사는 아래 오픈소스를 사용해요. 라이선스 전문은 원문 그대로 보여 드려요.', // [법무] 5-6
  item: (name: string, license: string) => `${name} · ${license}`, // [확정] 카피.md 12 · N29 "{이름} · {라이선스}"
  npmGroup: 'npm 패키지', // [확정] 카피.md 12(B5) · Figma 12p 231:120 세 번째 줄 이름
} as const;

export const IMAGE_CREDIT = {
  headerTitle: '이미지 출처 고지', // [확정] 카피.md 12(B5) · N30
  body: '로고와 일부 아이콘은 생성형 AI로 만든 이미지를 다듬어 썼어요.', // [법무] 5-6 (가정 D-24 ① — 본인 확인 대기)
} as const;
