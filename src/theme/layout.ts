// 컴포넌트별 치수. 색 · 글자 · 간격 토큰(tokens.ts)에 없는 값만 여기 둔다.
//  tokens.ts 는 디자인/가이드.md 8장 코드와 한 글자도 다르면 안 되어서(check:tokens A) 새 치수를 거기에 더하지 않는다.
//  원본: 가이드 4장(입력 · 버튼) · 디자인/figma_화면목록.md 'D7 값' 표(체크 칸 · 안내 상자) · 'Figma 01 노드 값'.
import { size, type } from './tokens';

// 가로 로고 그림 크기(최종 로고 D17 A1 · 2절: 디자인/로고/최종/결정사_로고_가로_tight.png 1x 622×272, 여백 0 ≈ 2.287:1. 2x 1244×544 · 3x 1866×816 도 같은 비율). 화면은 폭을 정하고 높이는 이 비율로 계산한다
export const WORDMARK_PX = { w: 622, h: 272 } as const;
const wordmarkHeight = (width: number) => (width * WORDMARK_PX.h) / WORDMARK_PX.w;

export const layout = {
  // 입력(가이드 4-1 · 4-2): 테두리 1, 입력 중 · 오류는 1.5(안 여백은 0.5 줄여 글자 자리를 고정한다)
  inputBorder: 1,
  inputBorderActive: 1.5,

  // 체크 칸(D7): 20×20 · 둥글기 5 · 선 1.5 · 안의 체크 16×16
  checkBox: 20,
  checkBoxRadius: 5,
  checkBoxBorder: 1.5,
  checkIcon: 16,

  // 체크 줄: 한 줄 높이 = 터치 최소 48. 글자 줄 높이 24 를 가운데에 놓으면 위 · 아래 안 여백이 (48 − 24) ÷ 2 = 12
  rowPaddingY: (size.touchMin - type.body.lineHeight) / 2,

  // 상단 바 아이콘 · 시트 닫기: 아이콘 24, 터치 48
  headerIcon: 24,

  // 01 온보딩(Figma 3:8): 로고 폭 120, 소개 그림 칸 348 정사각(D15 v2), 장 표시 점 8
  logoWidth: 120,
  logoHeight: wordmarkHeight(120), // 여백 없는 최종 로고 비율 ≈ 52.5(D17 B2, Figma 52.54)
  introArt: 348, // 소개 그림 칸 폭 · 높이(정사각 1:1, D15 v2)
  dot: 8,

  // F9 공통 부품(브랜드색_v2 2장): 보내기 원 40 · 아바타 원 32 · 말풍선 최대 폭 264
  sendButton: 40,
  avatar: 32,
  bubbleMaxWidth: 264,
  // F3 (Figma 3:171 · 3:188): 06 도는 원 96 · 진행바 폭 260, 07 막대 이름 칸 124(좁은 폭에서는 줄어든다) · 숫자 칸 폭 32 · 끌개 24(터치는 44 높이)
  spinner: 96,
  analysisBarWidth: 260,
  traitNameMax: 124,
  traitValueWidth: 32,
  sliderThumb: 24,
  // D8 4차 M10 (Figma 88:29): 13 빈 상태 그림 칸 144 · 그림 140
  emptyArtSlot: 144,
  emptyArt: 140,
  stateArt: 96, // F13a: 불러오기 실패(인터넷 끊김) 그림 · 목록 끝 그림
  photoGuideArt: 64, // F13a: 05 사진 칸 가이드 그림
  // F13 (Figma D20 305:48): 상점 카드 제목 줄 그림 24 · 줄 그림 28 · 등급 배지 09 카드 32(최소) · 내 등급 큰 배지 64 · 시트 완료 그림 96
  shopCardIcon: 24,
  shopRowIcon: 28,
  tierBadgeCard: 32,
  tierBadgeBig: 64,
  sheetArt: 96,
  // F4 (Figma 3:253): 08 프로필 머리의 둥근 사진 칸 72
  profilePhoto: 72,
  // F11 (가이드 11장): 기본 프로필 그림의 사람 칸 = 자리 짧은 변 × 62.5%, 최대 64. 지름 44 이하 원은 원 + 사람이 든 그림 한 장(기본_프로필_32)을 그대로 쓴다
  avatarPersonRatio: 0.625,
  avatarPersonMax: 64,
  avatarArtMaxSize: 44,
  rowPhoto: 44, // 11 호감 행 사진 원(터치 최소와 별개로 44 유지, 가이드 11-3)
  // 머리 오른쪽 위 프로필 버튼: 터치 48 이 화면 오른쪽 끝에서 12 → 원의 오른쪽 끝이 화면 여백 20 에 맞는다(가이드 11-1)
  profileButtonInset: size.screenPadding - (size.avatarTouch - size.avatar) / 2,
  // D15 스플래시(디자인/스플래시_01_규격.md): 로고 160 정중앙 · 한 줄은 로고 아래 24 · 링 24(두께 3)는 한 줄 아래 24 · 안내는 링 아래 12
  // 로딩 링 두께: 24 → 3 비율(1/8)을 06 의 96 에 맞춘 값(Figma 06 의 호 두께는 미확인)
  splashLogoWidth: 160,
  splashLogoHeight: wordmarkHeight(160), // ≈ 70.0(D17 B1, Figma 70.05)
  splashGap: 24,
  splashRing: 24,
  splashRingStroke: 3,
  splashNoteGap: 12,
  spinnerStroke: 8,
  splashFadeMs: 200, // 스플래시 → 01 페이드(ease-out). 동작 줄이기는 0
  splashSlowMs: 3000, // 이 안에 준비가 안 끝나면 "불러오는 중이에요"를 더한다(가정, 조정 가능)
  summaryMinHeight: 120, // 07 요약 고치기 글 상자 최소 높이
  // F5 (Figma 3:309 · 3:376): 09 카드 사진 96×120, 10 큰 사진 칸 높이 220(폭은 화면 폭 − 40)
  cardPhotoWidth: 96,
  cardPhotoHeight: 120,
  detailPhotoHeight: 220,
  swipeDistance: 40, // 이 거리(px)보다 많이 밀어야 장이 넘어간다
} as const;
