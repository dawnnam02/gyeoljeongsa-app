// 디자인 토큰. 원본은 디자인/가이드.md 8장 코드 값이다(D3 · D10). 값을 바꾸려면 가이드를 먼저 고친다.
// 색 · 글자 · 간격 · 누름 효과 값은 이 파일에서만 정의한다(최종 청사진 F-3). 화면과 컴포넌트는 여기서 가져다 쓴다.
// 2026-10-14 F9: 색 v2 10개(디자인/브랜드색_v2.md) · radius.lg. D10 반영: alpha.ripple · type.captionBold · motion(가이드 10장).
// 2026-10-18 F17: motion 을 가이드 13장(D38) 값으로(눌림 0.97 · 카드 0.985 · 100ms std · 차례 70ms · 뒤 어둡게 40%) + bgGrad(브랜드색_v2 6장). 가이드 8장 코드 블록도 같은 변경.

export const colors = {
  bg: '#FFFBF7',
  card: '#F5EEE8',
  line: '#EADFD6',
  text: '#2B2220',
  sub: '#75665F',
  accent: '#9B3B52',
  accentSoft: '#F6E9EC',
  accentAlt: '#B04A63',
  bubbleAi: '#F1ECE4',
  onAccent: '#FFFFFF',
} as const;

export const alpha = { tint: 0.1, pressed: 0.85, disabled: 0.4, ripple: 0.2, dim: 0.4 } as const; // 시트 뒤 덮개 text 40%(v2). 버튼 눌림 덮개(pressedOverlay)는 버튼 v3(D-141)에서 전용 눌림 면으로 바뀌어 뺐다

// Pretendard 우선. 못 불러오면 Noto Sans KR 3종으로 같은 이름 매핑.
export const font = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  bold: 'Pretendard-Bold',
} as const;

export const type = {
  title:         { fontSize: 20, lineHeight: 28, fontFamily: font.bold },
  heading:       { fontSize: 24, lineHeight: 32, fontFamily: font.bold },   // 큰 제목 (D22)
  body:          { fontSize: 16, lineHeight: 24, fontFamily: font.regular },
  bodyMedium:    { fontSize: 16, lineHeight: 24, fontFamily: font.medium },
  bodyBold:      { fontSize: 16, lineHeight: 24, fontFamily: font.bold },
  small:         { fontSize: 14, lineHeight: 20, fontFamily: font.regular },   // 작은 본문 (D22)
  smallMedium:   { fontSize: 14, lineHeight: 20, fontFamily: font.medium },
  caption:       { fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  captionMedium: { fontSize: 13, lineHeight: 18, fontFamily: font.medium },
  captionBold:   { fontSize: 13, lineHeight: 18, fontFamily: font.bold },   // 활성 탭 라벨 (D10)
} as const;

export const space = { s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s32: 32, s40: 40, s48: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, sheet: 24, pill: 999 } as const; // v2(D36): xl 종이 카드 · sheet 시트 위 모서리

export const size = {
  screenPadding: 20,
  header: 56,
  listRow: 56,
  touchMin: 48,
  button: 52, buttonSmall: 36,
  input: 52,
  chip: 32,
  toggleW: 44, toggleH: 24, toggleThumb: 20, toggleThumbPressed: 24,
  tabBar: 56, tabIcon: 24,
  avatar: 32, avatarTouch: 48,   // D19 (11장): 머리 오른쪽 위 프로필 원 · 터치
  barProgress: 6, barTrait: 8,
  iconButton: 40, badge: 24,   // v2(D36): 아이콘 버튼 보이는 원(터치는 touchMin) · 인증 표시 높이
  tabIndicatorW: 56, tabIndicatorH: 28,   // v2: 탭바 현재 탭 알약
  sheetHandleW: 36, sheetHandleH: 4, sheetHandleTouch: 44,   // v2: 시트 손잡이
  ctaFade: 24,   // v2: 하단 고정 위 흐림 높이
  focusRing: 2, focusOffset: 2,   // v3(D-141): 포커스 테두리 2 · 2 띄움 — 키보드로 왔을 때만
} as const;

// 상호작용 (10장 · 13장 D38). 시스템 '동작 줄이기'가 켜지면 reduced 값을 쓴다. 장면 움직임(시간 · 곡선 · 장면표)은 theme/motion.ts(D25)가 이 값을 가져다 쓴다.
export const motion = {
  pressScale: 0.97,       // 버튼 · 칩 · 단추 (13장)
  pressScaleCard: 0.985,  // 카드 · 목록 줄 (13장)
  pressInMs: 100,         // 누를 때 1 → 0.97 (instant)
  pressOutMs: 100,        // 뗄 때 0.97 → 1 (instant)
  pressEase: [0.4, 0, 0.2, 1] as const, // 눌림 곡선 std (13장)
  rippleSpreadMs: 250,    // 지름 0 → 요소 대각선 길이
  rippleFadeMs: 150,      // 다 퍼지고 손가락을 뗀 뒤 투명해짐
  easeOut: [0, 0, 0.58, 1] as const, // ripple 곡선 (CSS ease-out, 10-2)
  staggerMs: 70,          // 목록 · 카드 등장 간격 (13장)
  staggerMax: 4,          // 최대 4개(합 280ms 이하)
  sheetInMs: 400,         // 시트 열림(D-118: D25 · 시제품과 같게)
  sheetOutMs: 250,        // 시트 닫힘 내려감(D-116 · D-118)
  shimmerMs: 1600,        // 로딩 뼈대 밝기 주기(D-118: D25 그대로)
  colorMs: 150,           // 눌림 색 · 선택 테두리 바뀜(D36)
  reduced: { pressScale: 1, rippleMs: 75, fadeMs: 150 }, // scale 변화 0 · 물결은 크기 변화 없이 투명도만(나타남 75 + 사라짐 75 = 150, D-124) · 나타남은 투명도만 150ms
} as const;

// 버튼 v3 A안 '도톰한 와인'(D40 토큰표 2장 · 본인 선택 D-141). 높이 · 글자 · 색 10개는 그대로.
//  눌림 면은 두 토큰을 섞은 값(theme/buttonLook.ts mix), 그림자는 토큰 색의 투명도 — 새 색 아님. 그림자는 버튼(주 · 위험 · 보조 · 아이콘)만(가이드 7장 예외)
export const button = {
  radius: 16,             // 버튼 모서리(입력 12 · 종이 카드 20 사이)
  paddingX: 20,           // 안 여백 좌우
  pressY: 1,              // 눌리면 1px 내려감(+ 0.97). 동작 줄이기면 0
  inlineMinW: 160,        // 혼자 놓인 버튼 최소 폭(가운데)
  inlinePaddingX: 32,     // 혼자 놓인 버튼 좌우
  pressMix: { primary: 0.14, danger: 0.12 }, // 눌림 면: 주 = accent 에 text 14% · 위험 = text 에 bg 12%
} as const;

// 화면 바탕 그라데이션 bgGrad (브랜드색_v2.md 6장 · D29). 새 색 아님: accentSoft → bg, 위 → 아래, 화면 윗부분만 덮고 아래는 단색 bg.
// 그리는 곳은 화면 공통 감싸개(components/Screen) 한 곳. 카드 · 시트 · 버튼 · 탭바는 단색 그대로.
export const bgGrad = {
  colors: [colors.accentSoft, colors.bg] as const,
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  height: { base: 260, recommendations: 300, onboarding: 360, splash: 360, connected: 460 },
} as const;
