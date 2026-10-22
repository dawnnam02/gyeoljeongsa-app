// 가입 흐름(01 ~ 03)이 쓰는 그림 파일. 원본은 디자인/ 이고 앱에는 assets/ 로 복사해 쓴다(복사본이 원본과 같은지 시험이 본다).
//  back  = 디자인/아이콘/투명/05_뒤로가기.png  (상단 바 ‹ · 512×512 · 선 2 · 어두운 선, 투명 배경)
//  check = 디자인/아이콘/투명/07_체크.png       (체크 칸 안 · accent 면 위에서는 흰색으로 칠해 쓴다: 가이드 '체크 칸 규격')
//  close = 디자인/아이콘/투명/08_닫기.png      (시트 닫기)
//  wordmark = 디자인/로고/최종/결정사_로고_가로_tight.png (1x 622×272) + _2x_tight(1244×544) → wordmark@2x.png + _3x_tight(1866×816) → wordmark@3x.png. 투명 · 여백 0 · 최종 로고 D17 A1 · 2절 ≈ 2.287:1.
//            RN 이 화면 밀도에 맞는 것을 고른다. 높이는 theme/layout.ts 의 WORDMARK_PX 비율로 폭에서 계산: 01 120×52.5 · 스플래시 160×70.0
// 아이콘을 바꾸면 이 파일의 require 경로만 고친다.
export const UI_ICONS = {
  back: require('../../assets/icons/ui/back.png'),
  check: require('../../assets/icons/ui/check.png'),
  close: require('../../assets/icons/ui/close.png'),
  emptyRecs: require('../../assets/icons/ui/empty_recs.png'),
  emptyLikes: require('../../assets/icons/ui/empty_likes.png'), // 디자인/아이콘/투명/21_빈상태_호감없음.png — 14 호감 없음 그림(F6) // 디자인/아이콘/투명/20_빈상태_추천없음.png(576 투명) — 13 · NK01 · NK02 그림(D8 4차 M10)
} as const;

// 기본 프로필 그림(D19 A5 · A7, 가이드 11장): profile = 원 32 안에 사람이 든 그림(@2x · @3x 는 RN 이 고른다), person = 사람 모양만(accent, 투명 512) — 사각 · 큰 자리는 accentSoft 면 위에 얹는다
export const AVATAR_ART = {
  profile: require('../../assets/icons/avatar/default-profile.png'),
  person: require('../../assets/icons/avatar/default-person.png'),
} as const;

export const BRAND = {
  wordmark: require('../../assets/logo/wordmark.png'),
  // 로고 타일(D31 · F17): A안 앱 아이콘 그림 그대로(= 디자인/로고/최종/결정사_앱아이콘_1024.png). 모서리 22.5% 로 잘라 쓴다(motion/LogoTile)
  tile: require('../../assets/icon/app-icon.png'),
} as const;

// 01 온보딩 소개 그림 3장(디자인/온보딩/intro_1~3.png · @2x, 350×350 · 700×700). 장 순서대로. 그림 위에 글자를 올리지 않는다(D15 R5)
export const INTRO_ART = [
  require('../../assets/onboarding/intro_1.png'),
  require('../../assets/onboarding/intro_2.png'),
  require('../../assets/onboarding/intro_3.png'),
] as const;

// ── F13a: 힉스필드 새 그림(H1) 등록. 원본은 디자인/아이콘/투명/25~37 · 디자인/아이콘/등급/ 이고, app/assets/icons/{shop,state,tier}/ 에 RN 밀도별(이름.png · @2x · @3x)로 줄여 놓았다.
//  RN 이 화면 밀도에 맞는 파일을 고른다. 기준 크기(dp): shop 32 · state 144 · tier 64. 등급 계산 · 상점 결제 · 등급 화면은 F13 본체가 이 등록을 가져다 쓴다(지금은 연결하지 않은 것이 있다)

// 상점 상품 6(25~30) · 등급 관리 4(31~34) — 24 격자 선 2 · 투명. 기준 32
export const SHOP_ICONS = {
  tierSubscription: require('../../assets/icons/shop/product-tier-subscription.png'), // 25 등급 구독
  oneMatch: require('../../assets/icons/shop/product-one-match.png'), // 26 1회 매칭
  traitReport: require('../../assets/icons/shop/product-trait-report.png'), // 27 내 성향 리포트 — 16 상점 카드에 연결됨
  myTierView: require('../../assets/icons/shop/product-my-tier-view.png'), // 28 내 등급 열람
  likeLetter: require('../../assets/icons/shop/product-like-letter.png'), // 29 호감 편지
  pastRecsPass: require('../../assets/icons/shop/product-past-recs-pass.png'), // 30 지난 추천 열람권
  tierVerifyUpload: require('../../assets/icons/shop/tier-verify-upload.png'), // 31 인증 올리기
  tierHistory: require('../../assets/icons/shop/tier-history.png'), // 32 변화 기록
  tierHowTo: require('../../assets/icons/shop/tier-how-to.png'), // 33 올리는 방법
  tierViewRequest: require('../../assets/icons/shop/tier-view-request.png'), // 34 열람 요청
} as const;

// 오류 · 빈 상태 그림 3(35~37, 144 격자 · 기준 144 · 그림 140). 아직 붙인 화면이 없다(15 는 기획상 빈 상태가 없는 02 의 상태, 상점은 불러오는 길이 아직 없고, 등급 화면은 F13 본체)
export const STATE_ART = {
  error15: require('../../assets/icons/state/empty-error-15.png'), // 35
  shopFail: require('../../assets/icons/state/empty-shop-fail.png'), // 36
  noTier: require('../../assets/icons/state/empty-no-tier.png'), // 37
} as const;

// 등급 배지 9 + 잠김(64 격자 · 기준 64). 등급 번호 1~9 → 배열 [번호 - 1]. 화면은 F13 본체(등급 계산은 다른 직원)
export const TIER_BADGES = [
  require('../../assets/icons/tier/tier-1.png'),
  require('../../assets/icons/tier/tier-2.png'),
  require('../../assets/icons/tier/tier-3.png'),
  require('../../assets/icons/tier/tier-4.png'),
  require('../../assets/icons/tier/tier-5.png'),
  require('../../assets/icons/tier/tier-6.png'),
  require('../../assets/icons/tier/tier-7.png'),
  require('../../assets/icons/tier/tier-8.png'),
  require('../../assets/icons/tier/tier-9.png'),
] as const;
export const TIER_BADGE_LOCKED = require('../../assets/icons/tier/tier-locked.png');

// ── F13a 추가(H2 새 그림 38~75). 원본 디자인/아이콘/투명/ · app/assets/icons/art(576 → 기준 144 · @2x 288 · @3x 432) · settings(512 → 기준 32). 이름 붙여 등록하고, 붙인 곳은 묶음마다 적는다

// 연결 · 완료 · 대기 그림(38~41): 38 서로 수락 · 39 카드 체크 · 40 호감 보냄 · 41 확인 중 — 지금은 토스트 · 글뿐인 자리라 아직 붙인 곳이 없다
export const H2_LINK_ART = {
  connectedMutual: require('../../assets/icons/art/connected-mutual.png'),
  doneCardCheck: require('../../assets/icons/art/done-card-check.png'),
  doneLikeSent: require('../../assets/icons/art/done-like-sent.png'),
  waitChecking: require('../../assets/icons/art/wait-checking.png'),
} as const;

// 빈 목록 그림(42~49): 42 차단 목록 · 43 신고 내역 · 44 보낸 호감 · 47 오늘 추천 끝에 연결됨. 45 이용권 · 46 변화 기록 · 48 복원 · 49 알림은 화면이 아직 없다
export const H2_EMPTY_ART = {
  emptyBlocked: require('../../assets/icons/art/empty-blocked.png'),
  emptyReports: require('../../assets/icons/art/empty-reports.png'),
  emptySentLikes: require('../../assets/icons/art/empty-sent-likes.png'),
  emptyPass: require('../../assets/icons/art/empty-pass.png'),
  emptyHistory: require('../../assets/icons/art/empty-history.png'),
  emptyRecsEnd: require('../../assets/icons/art/empty-recs-end.png'),
  emptyRestore: require('../../assets/icons/art/empty-restore.png'),
  emptyNotifications: require('../../assets/icons/art/empty-notifications.png'),
} as const;

// 시스템 상태 그림(50~53): 52 인터넷 끊김은 불러오기 실패(network) 화면들에 연결됨. 50 점검 중 · 51 업데이트 · 53 사진 권한은 화면 없음(53 은 05 안의 한 줄 글뿐)
export const H2_STATE_ART = {
  stateMaintenance: require('../../assets/icons/art/state-maintenance.png'),
  stateUpdate: require('../../assets/icons/art/state-update.png'),
  stateOffline: require('../../assets/icons/art/state-offline.png'),
  statePhotoPermission: require('../../assets/icons/art/state-photo-permission.png'),
} as const;

// 사진 가이드(54~57): 54~56 은 05 사진 칸 3개에 연결됨. 57 승인은 화면 없음
export const H2_PHOTO_GUIDE = {
  photoGuideFace: require('../../assets/icons/art/photo-guide-face.png'),
  photoGuideFull: require('../../assets/icons/art/photo-guide-full.png'),
  photoGuideFree: require('../../assets/icons/art/photo-guide-free.png'),
  photoGuideApproved: require('../../assets/icons/art/photo-guide-approved.png'),
} as const;

// 안내 그림(58~61): 06 · 07 · 12 인증 준비 중 · 알림 권한 앞 안내용. 이번 범위(빈 목록 · 완료 · 상태 · 오류 · 사진 가이드) 밖이라 등록만
export const H2_INFO_ART = {
  infoAnalyzing: require('../../assets/icons/art/info-analyzing.png'),
  infoTraitsAdjust: require('../../assets/icons/art/info-traits-adjust.png'),
  infoVerifySoon: require('../../assets/icons/art/info-verify-soon.png'),
  infoNotifyPermission: require('../../assets/icons/art/info-notify-permission.png'),
} as const;

// 완료 · 상태 그림(68~75): 탈퇴 처리 · 신고 접수 · 이용권 복원 · 데이터 삭제는 지금 토스트 · 시트라 화면이 없다. 등록만
export const H2_DONE_ART = {
  doneWithdraw: require('../../assets/icons/art/done-withdraw.png'),
  doneReport: require('../../assets/icons/art/done-report.png'),
  stateLikeExpired: require('../../assets/icons/art/state-like-expired.png'),
  donePassRestore: require('../../assets/icons/art/done-pass-restore.png'),
  doneDataDelete: require('../../assets/icons/art/done-data-delete.png'),
  stateDeleteScheduled: require('../../assets/icons/art/state-delete-scheduled.png'),
  infoGetMyData: require('../../assets/icons/art/info-get-my-data.png'),
  infoSecurity: require('../../assets/icons/art/info-security.png'),
} as const;

// 설정 · 사진 아이콘 6(62~67, 24 격자 · 기준 32). 선 굵기는 24dp 에서 기존 선형 아이콘과 맞다(app/F13a_변경기록.md 측정 · 확인/스크린샷/F13a_설정아이콘_24dp_비교.png). 12 설정 줄에는 지금 아이콘 자리가 없고 팀장 지시가 보고만이라 붙이지 않았다
export const H2_SETTING_ICONS = {
  settingVisibility: require('../../assets/icons/settings/setting-visibility.png'),
  settingSecurity: require('../../assets/icons/settings/setting-security.png'),
  settingConsent: require('../../assets/icons/settings/setting-consent.png'),
  photoDelete: require('../../assets/icons/settings/photo-delete.png'),
  photoReupload: require('../../assets/icons/settings/photo-reupload.png'),
  settingSafety: require('../../assets/icons/settings/setting-safety.png'),
} as const;
