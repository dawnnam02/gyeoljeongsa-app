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
    grade: '내 등급', // [확정] 카피.md 12-Q SETTINGS.rows.grade(D-200 ②) → 16-G 내 등급(아이콘 화면)
    avoid: '아는 분 피하기', // [확정] 카피.md 12-Q SETTINGS.rows.avoid(D-200 ①) → 12-5
    preferences: '희망 조건 수정', // [확정] 카피.md 12(B5) · N20
    verification: '인증 서류 제출', // [확정]
    credits: '크레딧 · 구매 내역', // [확정] 카피.md 12-Q SETTINGS.rows.credits(QP-A, 옛 SHOP16.settingsRow(NV35) 자리) → T5 크레딧 · 내역. 상점이 꺼져도 보인다
    blocked: '차단 목록', // [확정]
    reports: '신고 내역', // [확정]
    security: '보안', // [확정] N32
    support: '고객센터', // [확정] N27 (copy.ts SUPPORT.rowName 과 같은 글)
    consents: '동의 관리', // [확정] 카피.md 12 목록 · N25
    legal: '이용약관 · 개인정보 처리방침', // [확정] 카피.md 12 목록(Figma 12 3:473 한 줄)
    safety: '안전 안내', // [확정] N34 (copy.ts SAFETY_GUIDE.rowName 과 같은 글)
    infoGroup: '정보', // [확정] 카피.md 12 목록 '정보' 묶음
    licenses: '오픈소스 라이선스', // [법무] 5-6 · N29
    imageCredit: '생성형 AI 고지', // [확정] 카피.md 21-18(IF2-F · D-224 ② · 법무 동의문구 5-6 줄 이름) — 옛 '이미지 출처 고지'(카피 12 · N30)
    businessInfo: '사업자 정보', // [확정] 카피.md 12-Q 정보 묶음 새 줄 — 값 6개가 모두 있을 때만 보인다(content/businessInfo.ts)
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
  credit: '탈퇴하면 남은 크레딧은 더 쓸 수 없어요. 공개 전인 탑승권은 이용약관 제14조의2에 따라 처리해요.', // [확정] 카피.md 12-Q WITHDRAW.credit(QPM 2장 #7 고쳐 확정). 탈퇴 확인창 아래 줄(WITHDRAW_SUB_NOTE 없음)
  rejoinNote: '다시 가입해도 1년 동안은 지난 짝과 이어지지 않아요.', // [확정] 카피.md 12-Q WITHDRAW.rejoinNote(RC-L M8 · 본인 Q12 — 팀장 판단 '넣음', 3부-사). 크레딧 줄 바로 아래 · 처리방침 R44 · 약관 제22조 ⑤
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
  recommendation: '이번 주 만날 분이 정해졌을 때', // [확정] 카피.md 12-Q NOTIFY.recommendation v5(수요일 18:00 공개 알림)
  // v5 숨김(카피.md 12-Q '(줄 없음)'): 호감 · 수락이 없어 알림 화면에 그리지 않는다. 키 · 서버 값은 v4 화면(스위치 꺼짐)이 쓰는 동안 남긴다
  like: '호감을 받았을 때', // [확정] 카피.md 12(B5) · N19 — v5 화면에 없음
  match: '연결됐을 때', // [확정] 카피.md 12(B5) · N19 — v5 화면에 없음
  marketing: '마케팅 알림', // [확정] 카피.md 12 알림 설정 안
  marketingNotes: [
    '받지 않아도 서비스는 똑같이 쓸 수 있어요.', // [법무] 4-9
    '오후 9시부터 다음 날 오전 8시까지는 보내지 않아요.', // [법무] 4-9
    '이번 주 만날 분 · 대화방 새 글 알림은 이 동의와 따로예요. 설정에서 따로 끌 수 있어요.', // [법무] 4-9(R-L D-199)
  ],
  pushDenied: '알림이 꺼져 있어요. 설정에서 허용해 주세요.', // [확정] R-D18-3 (카피.md 12 B5 · N19)
  pushPrime: '이번 주 만날 분이 정해질 때와 대화방에 새 글이 올 때 알려 드려요. 알림에는 글 내용을 보여 주지 않아요. 알림을 허용하지 않아도 서비스를 쓸 수 있어요.', // [법무] 5-5 (푸시 권한을 묻기 직전 · R-L D-199)
  chat: '대화방에 새 글이 왔을 때', // [확정] 카피.md 12-Q NOTIFY.chat(D-199) — 처음 켜짐(권한을 허락한 분에게만 실제로 간다) · profiles.notify_chat(0036)
  chatNote: '글 내용은 알림에 보이지 않아요.', // [확정] 카피.md 12-Q NOTIFY.chatNote
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
  ck4OffBody: "입력한 종교 정보가 지워지고 '답하지 않음'으로 바뀌어요. 종교는 꼭 맞아야 하는 조건이라, 다시 답하기 전까지 탑승권을 살 수 없어요.", // [확정] 카피.md 12-Q CONSENT_MANAGE.ck4OffBody v5
  ck4OffConfirm: '끄기', // [확정] 카피.md 12(B5) · N25
  ck4OffBoarded: '판매 마감 전에 끄면, 이미 탄 이번 회차는 짝을 정하지 않고 크레딧 1장으로 돌려드려요.', // [확정] 12-Q CONSENT_MANAGE.ck4OffBoarded(3부-아) — 판매 마감 전 · 이번 회차 탑승권이 있을 때만 ck4OffBody 아래
  ck4OnNote: '끄면 종교 답을 바로 지워요. 다시 동의하고 답하기 전까지는 탑승권을 살 수 없어요.', // [확정] 카피.md 12-Q CONSENT_MANAGE.ck4OnNote(M-CK4 · 17-3) — CK4 켜짐일 때 덧붙이는 안내 대신 이 줄(M9)
  cancel: '취소', // [확정] 카피.md 12(B5) · N25
  saved: '저장했어요.', // [확정] 카피.md 12(B5) · N10
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.', // [확정] 08 저장 실패와 같은 글
  tooMany: '동의 기록이 가득 차서 저장하지 못했어요. 설정의 고객센터로 알려 주시면 도와 드릴게요.', // [확정] 12-Q CONSENT_MANAGE.tooMany(3부-아 · 0041 too_many_consents) — 설문 동의 카드(CK4 · CK15 · CK16)에서도 이 글
  // 03 밖 선택 동의 CK11 ~ CK16 줄(동의문구 5-6 ② · 1-1, L17A). 줄 이름은 1-1 표 이름(consentContent.ts CONSENT_LATER_NAMES), '보기 ›' 글은 4-11 ~ 4-16(CONSENT_LATER_ITEMS)을 그대로 쓴다.
  // 옛 CONSENT_LATER [제안 L17A] 5줄 — 카피.md 12-Q 에서 확정(QPM 2장 #1 ~ #5)돼 여기로 옮겼다(check:copy O 가 본다)
  askLater: '처음 쓸 때 따로 물어요.', // [확정] 12-Q CONSENT_LATER.askLater — 그 기능 · 문항에서 받는 칸(CK11 ~ CK15)이 꺼져 있을 때(스위치 잠김)
  offTitle: '동의를 거둘까요?', // [확정] 12-Q CONSENT_LATER.offTitle
  offBody: '거두면 그때부터 모으지 않고, 이미 모은 정보도 바로 지워요.', // [확정] 12-Q CONSENT_LATER.offBody — CK11 ~ CK14 · CK16
  ck15OffBody: '거두면 정치 성향 답을 바로 지워요. 다시 동의하고 답하기 전까지는 탑승권을 살 수 없어요.', // [확정] 12-Q CONSENT_LATER.ck15OffBody
  ck15OffBoarded: '판매 마감 전에 거두면, 이미 탄 이번 회차는 짝을 정하지 않고 크레딧 1장으로 돌려드려요.', // [확정] 12-Q CONSENT_LATER.ck15OffBoarded(3부-아) — ck4OffBoarded 와 같은 조건
  offConfirm: '거두기', // [확정] 12-Q CONSENT_LATER.offConfirm(취소는 cancel)
} as const;

// 12-5 아는 분 피하기(D-200 ① · D-201, 카피.md 14-7 · 12-Q · 화면_요구사항 12-5 · 정책 P2-05a). 상대에게 흔적 0 · '몇 명을 피했는지' 숫자 0
export const AVOID = {
  title: '아는 분 피하기', // [확정] 14-7 AVOID.title
  intro: '여기 넣은 분과는 서로 이어지지 않아요. 상대에게는 알리지 않아요.', // [확정] 14-7
  companyTitle: '피할 회사', // [확정] 14-7
  companyPlaceholder: '회사 이름', // [확정] 14-7
  schoolTitle: '피할 학교', // [확정] 14-7
  schoolPlaceholder: '학교 이름으로 찾기', // [확정] 14-7
  add: '더하기', // [확정] 14-7
  remove: '지우기', // [확정] 14-7
  full: '5곳까지 넣을 수 있어요. 하나를 지우면 더 넣을 수 있어요.', // [확정] 14-7
  saveFailed: '저장하지 못했어요. 다시 시도해 주세요.', // [확정] 14-7
  saving: '저장하는 중', // 카피 20장(3부-아 · D45) — [더하기] 점 셋 동안의 읽기 이름
  contactTitle: '지인 차단', // [확정] 14-7 — CK11 시트(동의문구 4-11) · 주소록 비교는 서버 함수(0037) · 주소록 모듈이 들어온 뒤
  shareEmail: '내 이메일을 다른 분의 지인 비교에 쓰기', // [확정] 12-Q AVOID.shareEmail(D-201, 처음 켜짐)
  shareEmailNote: '다른 분이 주소록으로 아는 사람을 피할 때, 내 이메일을 되돌릴 수 없게 바꾼 값이 비교에 쓰여요. 끄면 내 연락처를 가진 분과 이어질 수 있어요.', // [확정] 12-Q
  // [확정] 12-Q 새 9줄(마케팅 10-27, 3부-바): 기기 목록 안내 · 다른 기기 개수 · [모두 지우기] 확인창 · 토스트 · 실패
  localNote: '이름은 이 기기에만 보관해요. 기기를 바꾸면 이름은 안 보이지만 피하기는 그대로 돼요.', // 회사 · 학교 목록 아래 한 줄
  otherDevice: (n: number) => `다른 기기에서 넣은 ${n}곳도 피하고 있어요.`, // 서버 개수 > 기기 목록일 때만(n = 그 차이, 순위 · 비율 숫자 아님)
  clearAll: '모두 지우기', // 회사 · 학교가 하나라도 있을 때만(서버 개수 기준)
  clearConfirm: {
    title: '피할 회사 · 학교를 모두 지울까요?',
    body: '이 기기와 다른 기기에서 넣은 회사 · 학교가 모두 지워져요. 지운 뒤에는 그 회사 · 학교의 분과도 이어질 수 있어요.',
    confirm: '모두 지우기',
    cancel: '취소',
  },
  cleared: '모두 지웠어요.',
  clearFailed: '지우지 못했어요. 다시 시도해 주세요.',
} as const;
export const AVOID_MAX = 5; // 회사 · 학교 각각 최대 5곳(정책 P2-05a)

// 12-5 지인 차단 시트 · 결과 글(3부-바 D-200 ①, 스위치 contact_block 켜짐일 때만). 원본 = 카피.md 14-7 '12-5 `CONTACT_BLOCK.*`' 줄(v5 확정, D46-A 덧붙임 10-27) 글자 그대로 —
//  옛 '12 · v4 R2 V05 지인 차단(NF5)' 개선안 글은 기록. 맞은 수 · 인원 숫자 0(5-06) · 재촉 0
export const CONTACT_BLOCK = {
  sheetTitle: '아는 분과 이어지고 싶지 않다면', // 14-7 12-5(v5 — 넘겨 보는 화면이 없어 '보이다' 대신 '이어지다')
  sheetBody: '주소록의 번호와 이메일을 기기에서 되돌릴 수 없는 값으로 바꿔 비교해요. 이름은 읽지 않고, 맞지 않은 값은 저장하지 않아요.', // 14-7 12-5('되돌릴 수 없는 값' = CK3 · AVOID.shareEmailNote)
  emailOnly: '지금은 가입한 이메일로만 찾아요. 번호로 찾는 일은 준비 중이에요.', // NF5-17 — 서버 회원 키가 이메일뿐(0037)이라 사실 그대로
  // CK11 체크 글은 법무 생성물(consentContent CONSENT_LATER_ITEMS CK11.label, 동의문구 4-11)을 쓴다 — NF5-03 가안은 쓰지 않음(법무 확정 우선)
  allow: '동의하고 주소록 허용하기', // 14-7 12-5(법무 L21 11-2 b — 누르면 CK11 동의가 기록되니 버튼에 '동의')
  later: '나중에', // 14-7 12-5(두 버튼 같은 무게)
  optionalNote: '동의하지 않아도 모든 기능을 똑같이 쓸 수 있어요.', // 14-7 12-5 — 체크 글 바로 아래 · 늘 보임(동의문구 4-11 덧붙이는 안내, L21 11-2 c)
  withdrawNote: '설정에서 언제든 동의를 거둘 수 있어요.', // 14-7 12-5 — 위 줄 다음 · 늘 보임
  done: '비교를 마쳤어요. 맞은 분과는 서로 이어지지 않아요.', // 14-7 12-5
  noContacts: '비교할 연락처가 없어요.', // NF5-08
  denied: '괜찮아요. 주소록 없이도 쓸 수 있어요.', // NF5-09
  deniedForever: '주소록은 기기 설정에서 허용할 수 있어요.', // 14-7 12-5('기기 설정' — 앱 설정과 헷갈리지 않게)
  accessOff: '주소록 접근이 꺼져 있어요', // NF5-11
  partialFail: '일부만 비교했어요. 다음 비교 때 이어서 해요.', // NF5-11
} as const;

// 12 정보 묶음 · 사업자 정보 화면 · 신고번호 한 줄(카피.md 12-Q, 법 제8조 ② · 제12조 ③ — 법무 L16). 값은 content/businessInfo.ts 한 곳에서 읽는다.
//  값이 비면 줄 자체를 그리지 않는다(빈칸 · '준비 중' 글도 없음)
export const BUSINESS = {
  headerTitle: '사업자 정보', // [확정] 12-Q 줄 이름과 같은 글
  labels: {
    name: '상호',
    ceo: '대표자',
    reportNo: '국내결혼중개업 신고번호',
    bizRegNo: '사업자등록번호',
    ecomNo: '통신판매업 신고번호', // [법무] QPL 3-2 · 7-2(D-197) — 비면 이 줄만 숨김
    address: '사무소 주소',
    phone: '전화번호',
    email: '전자우편주소', // [확정] 12-Q '줄 8개'(법무 L21 10-2) — 전화번호 다음 · 비면 이 줄만 숨김
  }, // [확정] 12-Q 사업자 정보 화면 줄(차례 그대로) + 통신판매업 줄(D-197) + 전자우편주소 줄(L21)
  // [법무] QPL 3-2 · 7-2(D-197) 연결 3줄 — 글은 마케팅이 카피.md 12-Q 에 옮기는 중(뜻을 지키면 다듬어도 됨). 줄 끝 '›'는 NavRow 화살표가 그린다
  links: {
    feeTable: '수수료표 보기',
    terms: '이용약관 보기',
    bondClaim: '보증보험 손해배상 청구 절차',
  },
  reportLine: (no: string) => `국내결혼중개업 신고번호 ${no}`, // [확정] 12-Q 설정 목록 맨 아래 · 약관 화면 맨 아래 한 줄
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
  headerTitle: '생성형 AI 고지', // [확정] 카피.md 21-18(IF2-F) — 둘째 문장(aiWriting)이 글까지 덮어 줄 이름을 넓힘
  body: '로고와 일부 그림은 생성형 AI로 만든 이미지를 다듬어 썼어요.', // [법무] 5-6 (L17 '아이콘' → '그림')
  aiWriting: '기내지 · 이번 주 타로 · 궁합 카드 · 첫마디 실마리 · 이야깃거리의 글은 생성형 AI로 미리 써 두었어요.', // [법무] 5-6 '생성형 AI 고지' 둘째 문장(IF2-L 10-28 · 사람이 다듬지 않는 판) · 카피 12
} as const;
