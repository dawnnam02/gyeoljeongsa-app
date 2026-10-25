// 움직임 토큰 v5 '지면'(D42-M 2안 확정 · D-173 · D-175 · 앱 적용 승인 D-176). 값의 원본은 디자인/D42_새판/모션/2안_명세.md 3 · 4장,
//  규칙의 원본은 D25_움직임체계.md(개정안 초안 디자인/D42_새판/모션/D25_개정안_초안.md). 앱의 장면 움직임 · 눌림 · 토스트 시간은 이 파일의 값만 쓴다.
//  강도 2단계: 일상(화면 전환 · 탭 · 눌림 · 목록 · 시트 · 토스트 · 칩 · 말풍선 · 로딩)은 가볍게 100 ~ 360ms, 핵심 3곳(탑승권 받기 · 수 18:00 공개 · 채팅 첫 글)과 스플래시만 풍성하게.
//  2안에서 지운 것: settle 곡선(튕김) · 로고 타일 찍힘 · 퍼지는 고리 · 카드 기울기 · 뼈대 반짝임 · 눌림 물결. 움직이는 부품은 src/motion/ 한 폴더.
//  tokens.ts motion(가이드 13장 0.97 · 70ms 차례 · 물결)은 가이드 개정 전 옛 값이라 앱 움직임 코드는 더 쓰지 않는다(가이드 8 · 13장 개정은 팀장 몫).
import { alpha, motion } from './tokens';


// 2-1 시간(ms)
export const dur = {
  instant: 100, // 버튼 눌림 · 체크 · 칩 선택
  short: 150, // 색 바뀜 · 동작 줄이기 때 투명도
  base: 250, // 글자 · 안내
  long: 400, // 옛 장면(v2 사진 이어 붙임 · 숫자 굴림)
  hero: 700, // 스플래시 · 표지 넘김 · 탑승권 받기(하루에 몇 번 안 나오는 순간)
} as const;

// 상한: 이보다 긴 움직임은 쓰지 않는다(로딩 선 왕복 · 머무는 시간 · 시작 시각은 길이가 아님). 표지 넘김은 720 대신 700(D-175)
export const DUR_MAX = dur.hero;

// 2-2 곡선(cubic-bezier 네 값). Reanimated 의 Easing.bezier(...) 에 그대로 넣는다. settle(튕김)은 2안에서 지웠다
export const ease = {
  edOut: [0.16, 1, 0.3, 1], // 들어옴 기본 · 줄 가림 · 걷힘 · 잉크 번짐
  edInOut: [0.77, 0, 0.18, 1], // 핵심 시트 · 표지 넘김 · 스플래시 장 넘김 · 로딩 선
  out: [0.2, 0.8, 0.2, 1], // 옛 들어옴(v2 사진 이어 붙임 · 숫자 굴림 · 온보딩) — 다 바뀌면 지운다
  in: [0.4, 0, 1, 1], // 나갈 때 · 닫힘
  std: [0.4, 0, 0.2, 1], // 제자리 변화(색 · 눌림)
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type EaseName = keyof typeof ease;

// 2-3 거리(px) · 크기. 목록 · 카드 모두 8, 탭 4, 말풍선 6
export const dist = { xs: 4, bubble: 6, s: 8, m: 16, l: 24, xl: 40 } as const;

// 눌림(명세 4-1 press · 5-3): 버튼 · 카드 0.985 · 아이콘 0.92 + 눌림 덮개(text 6%). 누를 때 100 std · 뗄 때 200 edOut. 물결은 지웠다
export const press = { button: 0.985, card: 0.985, icon: 0.92, overlay: 0.06, downMs: 100, upMs: 200 } as const;

// 차례(stagger): 50ms · 최대 4개(목록 합 ≤ 230)
export const stagger = { step: 50, max: 4 } as const;
export const staggerDelay = (i: number): number => Math.min(Math.max(0, i), stagger.max - 1) * stagger.step;

// 동작 줄이기(명세 7장): 이동 · 크기 변화 없이 투명도만 150ms. 칩 색 · 햅틱은 그대로
export const reduced = { fadeMs: motion.reduced.fadeMs } as const;

// 토스트(카피 규칙 1-1 · K15, 팀장 10-17): 5초 보인다
export const TOAST_MS = 5_000;

// 뒤 어둡게(시트 · 확인창 뒤): text 색 40%
export const SCRIM_ALPHA = alpha.dim;

// 대기 단계표(D25 10-2 원칙 4): 0.3초 안 = 아무것도 · 1초 안 = 정지된 뼈대 · 1초 뒤 = 머리 아래 2px 선 왕복 · 10초 넘음 = 선을 멈추고 글 한 줄
export const waitStage = { blank: 300, still: 1_000, long: 10_000 } as const;

// ── 2안 장면표(명세 4장). 지연은 장면이 시작된 순간부터 잰다 ──────────────────────
export const scene2 = {
  // 4-1 일상
  nav: { in: 320, out: 200, popIn: 280, popOut: 240, title: 360, titleDelay: 80, rows: 260, rowsDelay: 120 },
  tab: { out: 120, in: 200, inDelay: 100, rise: dist.xs },
  list: { dur: 260, delay: 80, rise: dist.s },
  card: { dur: 300, rise: dist.s },
  toast: { in: 240, out: 160, rise: dist.s },
  sheet: { scrimIn: 240, in: 360, out: 240, titleDelay: 120 },
  chip: { color: 150, checkOn: 150, checkOff: 120 },
  bubble: { in: 240, rise: dist.bubble },
  survey: { bubbleGap: 600, chipsGap: 500, nextGap: 900 },
  load: { line: 1_400, lineDelay: waitStage.still, lineHeight: 2, swap: 200, title: 360, rowsDelay: 40 },
  // 줄 가림(명세 2장 · 5-1): 줄마다 70 차례 · 3줄 이상이면 통째로 · 글자 꼬리 자리 0.12em · 줄 높이 1.1배 아래에서
  mask: { lineGap: 70, rise: 1.1, tail: 0.12, maxLines: 2 },
  // 잉크 번짐(명세 6장 A): 둥근 View 를 0.02 → 1 로 키우고 안쪽 로고는 1/s 로 크기를 지킨다
  ink: { from: 0.02 },

  // 4-2 핵심 ① 탑승권 받기(시트 닫힌 순간부터)
  ticket: {
    scrimIn: 300, sheetIn: 520, sheetOut: 340, sheetTitle: 560, sheetTitleDelay: 300,
    ctaOut: 160, stamp: 560, title: 560, titleDelay: 200, sub: 600, subDelay: 280, msg: 600, msgDelay: 360,
  },
  // 4-3 핵심 ② 수 18:00 공개(공개 화면이 열린 순간부터). 시 · 분 · 초 카운트다운 0, 폭죽 0
  reveal: {
    swap: 240, cover: dur.hero, coverDelay: 160, coverDeg: -150, perspective: 1_400,
    title: 560, titleDelay: 180, photo: 560, photoDelay: 400, name: 480, nameDelay: 400,
    info: 480, infoDelay: 450, cta: 300, ctaDelay: 680, cta2Delay: 700,
  },
  // 4-4 핵심 ③ 채팅 첫 글: 방마다 첫 보낸 말풍선 1번만 보낸 쪽에서 걷힘
  chat: { hintOut: 160, first: 420 },
  // 4-5 스플래시(하루 한 번, 핵심 규칙). 장 넘김 = 스플래시가 10% 위로 물러나며 옅어지고 아래 첫 화면이 드러난다
  splash: {
    rule: 600, ruleDelay: 100, ruleWidth: 120, ruleHeight: 1.5, logo: 600, logoDelay: 250,
    letters: 620, lettersDelay: 450, letterStep: 80, tag: 400, tagDelay: 800,
    nextAt: 1_900, next: 640, nextLift: 0.1, reducedWait: 1_500,
  },
} as const;

// 로고 타일 크기(D31 · 명세 4장): 스플래시 104 · 공개 72 · 탑승권 도장 52 · (v4) 서로 수락 · 구매 완료 48
export const LOGO_TILE_RADIUS = 0.225;
export const logoTile = { splash: 104, reveal: 72, ticket: 52, moment: 48, sheet: 48 } as const;

// ── 남은 장면(v4 화면 · v2 '흐르는 결정사' D25 10장). 2안 일상 값으로 맞춘 줄은 scene2 를 가리킨다 ─────────
export const scene = {
  // 2 온보딩 넘김: 옆으로 이동 long · 사진 안착 700(크기 1.06 → 1) · 글자 base(60ms 간격) · 점은 알약으로 base
  onboarding: { slide: dur.long, photoSettle: 700, photoScaleFrom: 1.06, text: dur.base, textGap: 60, dot: dur.base },
  // 3 추천 도착(v4): 부제 · 시간 줄 base(60 간격) 뒤 카드가 8 아래에서 300 edOut 으로 올라온다(기울기 0)
  today: { subline: dur.base, sublineGap: 60, land: scene2.card.dur },
  // 4 호감 보내기(v4): 하트 base → 편지가 떠남 hero
  like: { heart: dur.base, mail: dur.hero, mailRise: 120 },
  // 5 서로 수락(v4): 두 원이 다가옴 long → 450ms 뒤 로고 타일 잉크 번짐 → 750ms 뒤 글 base → 2200ms 머문 뒤 걷힘 base
  match: { pair: dur.long, stampDelay: 450, textDelay: 750, text: dur.base, hold: 2_200, out: dur.base },
  // 6 로딩: 뼈대가 걷힐 때 200(load.swap)
  skeleton: { out: scene2.load.swap },
  // 7 구매 완료(v4 상점): 일상 시트 · 글 500 뒤
  buy: { textDelay: 500 },
  // 공통: 토스트 · 목록 등장(2안 일상)
  toast: scene2.toast,
  list: { rise: scene2.list.rise, dur: scene2.list.dur },
  // 8 사진 이어 붙임(09 → 10): 사진 400 · 09 는 왼쪽 16 으로 물러나며 250 · 10 의 정보는 250(60 간격)
  handoff: { photo: dur.long, back: dur.base, recede: dur.base, recedeDist: dist.m, info: dur.base, infoGap: 60 },
  // 9 숫자 굴림: 자리마다 400 · 자리 간격 30 · 늘어난 자리는 8 아래에서
  roll: { dur: dur.long, digitGap: 30, newDigitRise: dist.s },
  // 10 큰 제목 줄어듦: 스크롤 0 → 48 에 묶임 · 위로 8 · 0.9배
  collapse: { range: 48, rise: dist.s, scale: 0.9 },
  // 11 탭 넘김(2안 tab): 나감 120 → 100 뒤 들어옴 200 · 밑줄 250 std · 빠진 줄 자리 메움 250 std
  fadeThrough: { out: scene2.tab.inDelay, in: scene2.tab.in, indicator: dur.base, fill: dur.base },
  // 12 시트 끌어 닫기: 높이 40% 넘게 끌었거나 초당 800px 넘게 아래로 튕기면 닫힘 — 놓은 속도에서 출발하는 스프링(튕김 없음)
  sheetDrag: { closeRatio: 0.4, closeVelocity: 800 },
  // 13 설문 넘김: 선택 150 std → 300 뒤 문항이 16 옆으로 넘어감 · 진행 막대 250 std
  survey: { select: dur.short, delay: 300, slide: dur.base, dist: dist.m, bar: dur.base },
  // 14 스위치: 누름 100 std · 미끄럼 150 std · 저장 실패 되돌림 250 std
  toggle: { press: dur.instant, slide: dur.short, revert: dur.base },
} as const;

// spring-follow(D25 10-3): 감쇠 비율 1(튀지 않음) · 체감 길이 400. 시트 끌어 닫기에만
export const springFollow = { duration: dur.long, dampingRatio: 1 } as const;
