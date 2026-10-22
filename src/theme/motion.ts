// 움직임 토큰 v4 — 값의 원본은 디자인/D25_움직임체계.md 2장(시제품 D25_시제품/index.html 의 CSS 토큰과 같은 값) + 팀장 결정(10-17).
//  앱의 장면 움직임 · 토스트 시간은 이 파일의 값만 쓴다. 눌림 · 차례 · 뒤 어둡게 · 줄이기 값은 tokens.ts motion(가이드 8 · 13장)에서 가져온다(값은 한 곳).
//  움직임을 쓰는 훅 · 부품은 src/motion/ 한 폴더에 있다(F17). 움직임 v2(D25 10장, F21)는 이 파일에 값을, src/motion/ 에 장면을 더한다.
import { alpha, motion } from './tokens';


// 2-1 시간(ms)
export const dur = {
  instant: 100, // 버튼 눌림 · 체크 · 칩 선택
  short: 150, // 색 바뀜 · 토스트 사라짐 · 동작 줄이기 때 투명도
  base: 250, // 글자 · 목록 항목 · 안내 · 시트 닫힘
  long: 400, // 시트 열림 · 화면 옆으로 넘김
  hero: 700, // 스플래시 · 로고 타일 · 종이 펼침 · 구매 완료(하루에 몇 번 안 나오는 순간)
} as const;

// 상한: 이보다 긴 움직임은 쓰지 않는다(뼈대 반짝임 주기만 예외)
export const DUR_MAX = dur.hero;

// 2-2 곡선(cubic-bezier 네 값). Reanimated · RN Animated 의 Easing.bezier(...) 에 그대로 넣는다
export const ease = {
  out: [0.2, 0.8, 0.2, 1], // 들어올 때 · 올라올 때(기본)
  in: [0.4, 0, 1, 1], // 나갈 때 · 시트 닫힘
  std: [0.4, 0, 0.2, 1], // 제자리 변화(색 · 밑줄 · 눌림)
  settle: [0.34, 1.35, 0.5, 1], // 살짝 튕겨 앉음 — 로고 타일 · 하트 · 성공 3곳만
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type EaseName = keyof typeof ease;

// 2-3 거리(px) · 크기
export const dist = { xs: 4, s: 8, m: 16, l: 24, xl: 40 } as const;
export const press = { button: motion.pressScale, card: motion.pressScaleCard } as const; // 0.97 · 0.985(가이드 13장)
export const TILT_MAX_DEG = 3; // 카드가 놓일 때만

// 차례(stagger): 70ms · 최대 4개(합 280ms 이하) — 가이드 13장
export const stagger = { step: motion.staggerMs, max: motion.staggerMax } as const;
export const staggerDelay = (i: number): number => Math.min(Math.max(0, i), stagger.max - 1) * stagger.step;

// 동작 줄이기(5장): 이동 · 크기 변화 없이 투명도만 150ms
export const reduced = { fadeMs: motion.reduced.fadeMs } as const;

// 토스트(카피 규칙 1-1 · K15, 팀장 10-17): 5초 보인다. 나타남 = 아래 8px 에서 base, 사라짐 = short
export const TOAST_MS = 5_000;

// 뒤 어둡게(시트 · 확인창 뒤): text 색 40% — 가이드 13장
export const SCRIM_ALPHA = alpha.dim; // 시트 뒤 덮개(가이드 13장 · D36 alpha.dim)

// 장면별 시간표(4장 · 시제품 장면 7개와 같은 순서 · 시간). 숫자는 위 토큰의 조합이고, 시제품에만 있는 몇 값(520 · 900 · 2200)은 여기서 이름을 붙인다
export const scene = {
  // 1 스플래시: 로고 타일 찍힘(hero) → 300ms 뒤 퍼짐 고리(hero) → 600ms 뒤 글자 로고 올라옴(long) → 2100ms 에 종이 펼침(hero). 시제품은 맨 앞 300ms 기다림이 더 있다(합계 3초 안)
  splash: { stamp: dur.hero, rippleDelay: 300, wordmarkDelay: 600, wordmark: dur.long, unfoldAt: 2_100, unfold: dur.hero, backdropFade: dur.base },
  // 2 온보딩 넘김: 옆으로 이동 long · 사진 안착 700(팀장 10-17, 시제품 900 대신) 크기 1.06 → 1 · 글자 base(60ms 간격) · 점은 알약으로 base
  onboarding: { slide: dur.long, photoSettle: 700, photoScaleFrom: 1.06, text: dur.base, textGap: 60, dot: dur.base },
  // 3 추천 3장 도착: 부제 · 시간 줄 base(60ms 간격) 뒤 카드가 한 장 520ms 로 놓인다(70ms 차례). 기울기는 카드마다 3° 안
  today: { subline: dur.base, sublineGap: 60, land: 520, tilts: [-2.6, 1.9, -1.3, 1.2] },
  // 4 호감 보내기: 눌림 instant → 하트 base(settle) → 편지가 떠남 hero → 안내 base
  like: { heart: dur.base, mail: dur.hero, mailRise: 120 },
  // 5 서로 수락: 두 원이 다가옴 long → 450ms 뒤 로고 타일 찍힘 hero → 750ms 뒤 글 base → 2200ms 머문 뒤 걷힘 base → 연결됨 줄 도착(today.land)
  match: { pair: dur.long, stampDelay: 450, textDelay: 750, text: dur.base, hold: 2_200, out: dur.base },
  // 6 스켈레톤: 반짝임 1600ms 주기(밝기 변화 작게) · 사라짐 short → 카드 도착
  skeleton: { shimmer: motion.shimmerMs, out: dur.short },
  // 7 구매 완료: 시트 올라옴 long · 로고 타일 찍힘 hero · 글 500ms 뒤 base · 닫힘 base(in)
  buy: { sheetIn: motion.sheetInMs, sheetOut: motion.sheetOutMs, stamp: dur.hero, textDelay: 500 },
  // 공통: 토스트 · 목록 등장
  toast: { in: dur.base, out: dur.short, rise: dist.s },
  list: { rise: dist.m, dur: dur.base },

  // ── v2 '흐르는 결정사'(D25 10장 · 시제품 장면 8~14 · F21) ──
  // 8 사진 이어 붙임(09 → 10): 사진 400 out · 09 는 왼쪽 16 으로 물러나며 250 in · 10 의 정보는 250 out(60 간격) / 뒤로 250 in. 모서리 12 → 16
  handoff: { photo: dur.long, back: dur.base, recede: dur.base, recedeDist: dist.m, info: dur.base, infoGap: 60 },
  // 9 숫자 굴림: 자리마다 400 out · 자리 간격 30(오른쪽 자리부터) · 늘어난 자리는 8 아래에서
  roll: { dur: dur.long, digitGap: 30, newDigitRise: dist.s },
  // 10 큰 제목 줄어듦: 스크롤 0 → 48 에 묶임(시간 없음) · 위로 8 · 0.9배
  collapse: { range: 48, rise: dist.s, scale: 0.9 },
  // 11 탭 페이드 스루: 나감 100 in → 들어옴 150 out · 밑줄 250 std · 빠진 줄 자리 메움 250 std
  fadeThrough: { out: dur.instant, in: dur.short, indicator: dur.base, fill: dur.base },
  // 12 시트 끌어 닫기: 높이 40% 넘게 끌었거나 초당 800px 넘게 아래로 튕기면 닫힘, 아니면 제자리 — 둘 다 놓은 속도에서 출발하는 스프링
  sheetDrag: { closeRatio: 0.4, closeVelocity: 800 },
  // 13 설문 넘김: 선택 150 std → 300 뒤 문항이 16 옆으로 넘어감(나감 250 in · 들어옴 250 out) · 진행 막대 250 std
  survey: { select: dur.short, delay: 300, slide: dur.base, dist: dist.m, bar: dur.base },
  // 14 스위치: 누름 100 std(썸 20 → 24) · 미끄럼 150 std · 저장 실패 되돌림 250 std
  toggle: { press: dur.instant, slide: dur.short, revert: dur.base },
} as const;

// spring-follow(D25 10-3): 감쇠 비율 1(튀지 않음) · 체감 길이 400 · 놓은 순간 손 속도를 시작 속도로. Reanimated withSpring 에 그대로 넣는다
export const springFollow = { duration: dur.long, dampingRatio: 1 } as const;

// 대기 단계표(D25 10-2 원칙 4): 0.3초 안 = 아무것도 · 1초 안 = 정지된 뼈대 · 10초 안 = 뼈대 반짝임 · 10초 넘음 = 반짝임을 멈추고 글 한 줄
export const waitStage = { blank: 300, still: 1_000, long: 10_000 } as const;

// 로고 타일(D31): A안 앱 아이콘 그림을 모서리 22.5% 로 둥글게 잘라 쓴다
export const LOGO_TILE_RADIUS = 0.225;
export const logoTile = { splash: 104, moment: 48, sheet: 48 } as const; // Figma 449:165(104) · 449:181(48) · 449:197(48)
