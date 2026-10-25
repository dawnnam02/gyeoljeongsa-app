// 가입 흐름(01 ~ 03)이 쓰는 그림 파일. 원본은 디자인/ 이고 앱에는 assets/ 로 복사해 쓴다(복사본이 원본과 같은지 시험이 본다).
//  wordmark = 디자인/로고/최종/결정사_로고_가로_tight.png (1x 622×272) + _2x_tight(1244×544) → wordmark@2x.png + _3x_tight(1866×816) → wordmark@3x.png. 투명 · 여백 0 · 최종 로고 D17 A1 · 2절 ≈ 2.287:1.
//            RN 이 화면 밀도에 맞는 것을 고른다. 높이는 theme/layout.ts 의 WORDMARK_PX 비율로 폭에서 계산: 01 120×52.5 · 스플래시 160×70.0
// D42-C(1안 실선 1.5, D-176): 뒤로 · 체크 · 닫기 같은 아이콘은 PNG 대신 공용 아이콘(components/Icon, 이름 'back' · 'check' · 'close' …)으로 그린다. 옛 PNG(ui/back · check · close)는 지웠다.
import type { IconName } from '@/components/iconPaths';

// 빈 상태 그림(그림 직원 범위, 아이콘 아님)
export const UI_ICONS = {
  emptyRecs: require('../../assets/icons/ui/empty_recs.png'),
  emptyLikes: require('../../assets/icons/ui/empty_likes.png'), // 디자인/아이콘/투명/21_빈상태_호감없음.png — 14 호감 없음 그림(F6) // 디자인/아이콘/투명/20_빈상태_추천없음.png(576 투명) — 13 · NK01 · NK02 그림(D8 4차 M10)
} as const;

// 기본 프로필 그림(D42-P · D-176): 사진이 아직 없는 회원의 자리 = 4안 '빛 실루엣' 한 장(디자인/D42_새판/인물/1안_원본/webp/기본이미지_실루엣.webp, 640×800 · 성별 · 나이 단서 없음).
//  원 · 사각 어느 자리든 칸을 꽉 채워(cover) 그린다. 데모 · 실서버 같은 그림. 옛 default-profile · default-person 그림은 쓰는 곳이 없어 지웠다
export const AVATAR_ART = {
  silhouette: require('../../assets/icons/avatar/default-silhouette.webp'),
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

// 상점 상품 6(25~30) · 등급 관리 4(31~34) — D42-C 1안 아이콘 이름(components/Icon 으로 그린다, 기준 32 · 상점 줄 28). 옛 PNG(assets/icons/shop/*)는 지웠다
export const SHOP_ICONS = {
  tierSubscription: 'tier_subscription', // 25 등급 구독
  oneMatch: 'one_match', // 26 1회 매칭
  traitReport: 'trait_report', // 27 내 성향 리포트 — 16 상점 카드에 연결됨
  myTierView: 'my_icon_view', // 28 내 등급 열람
  likeLetter: 'letter', // 29 호감 편지
  pastRecsPass: 'past_pass', // 30 지난 추천 열람권
  tierVerifyUpload: 'doc_verify', // 31 서류 인증
  tierHistory: 'history', // 32 바뀐 기록
  tierHowTo: 'how_to', // 33 아이콘이 바뀔 수 있는 일(전구, 서열 말 · 그림 0)
  tierViewRequest: 'view_request', // 34 열람 요청
} as const satisfies Record<string, IconName>;

// 오류 · 빈 상태 그림 3(35~37, 144 격자 · 기준 144 · 그림 140). 아직 붙인 화면이 없다(15 는 기획상 빈 상태가 없는 02 의 상태, 상점은 불러오는 길이 아직 없고, 등급 화면은 F13 본체)
export const STATE_ART = {
  error15: require('../../assets/icons/state/empty-error-15.png'), // 35
  shopFail: require('../../assets/icons/state/empty-shop-fail.png'), // 36
  noTier: require('../../assets/icons/state/empty-no-tier.png'), // 37
} as const;

// 등급 배지: 숫자가 그려진 옛 tier-1~9.png · tier-locked.png 와 TIER_BADGES 는 지웠다(D42-C, V5 6-2 숫자 노출 0). 등급 그림은 풍경 아이콘 9 · 잠김은 공용 아이콘 자물쇠

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

// 설정 · 사진 아이콘 6(62~67) — D42-C 1안 아이콘 이름(components/Icon 으로 그린다, 기준 24). 12 설정 줄에는 아직 아이콘 자리가 없어 등록만. 옛 PNG(assets/icons/settings/*)는 지웠다
export const H2_SETTING_ICONS = {
  settingVisibility: 'visibility',
  settingSecurity: 'security',
  settingConsent: 'consent',
  photoDelete: 'photo_delete',
  photoReupload: 'photo_reupload',
  settingSafety: 'safety',
} as const satisfies Record<string, IconName>;
