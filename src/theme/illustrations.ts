// D42-I 장면 그림(4안 요즘 여행 포스터 확정, D-172 · 앱 적용 D-176). 원본 디자인/D42_새판/그림/4안_원본/ → scripts/gen-illustrations.mjs → assets/illustrations/d42i.json
//  · 장면마다 라이트 · 다크 SVG 한 쌍(320×240 = 4:3). 그림 색은 그림 원본(에셋) 안에만 있고 이 파일과 부품에는 색이 없다
//  · 그리기는 components/Illustration.tsx(react-native-svg SvgXml). 그림 위에 글자를 올리지 않는다 · 얼굴 · 하트 · 숫자 0
//  · 쓰는 곳은 장면마다 적는다. 쓰는 곳이 0인 장면은 '자리 없음'으로 적고 등록만 해 둔다
import data from '../../assets/illustrations/d42i.json';

export type IllustrationScene =
  | 'onboarding1' // 01 온보딩 1장 · 나란한 좌석 둘 — features/onboarding
  | 'onboarding2' // 01 온보딩 2장 · 탑승권 한 장 — features/onboarding
  | 'onboarding3' // 01 온보딩 3장 · 의자 둘 — features/onboarding
  | 'waiting' // T2 기다림(탑승 완료 · 비행 중) — features/boarding 'boarded'
  | 'ticket' // T1 탑승권(판매 중) — features/boarding 'on_sale'
  | 'reveal' // T3 공개 순간 · 만난 분 있음 — features/boarding 'matched' · RevealScreen
  | 'noMatch' // 크레딧 · 완벽한 사람을 찾지 못함 — features/boarding 'no_match' · RevealScreen
  | 'error' // 오류 · 인터넷 끊김 — components/StateArt OfflineArt · features/boarding 불러오기 실패
  | 'preopen' // 사전 오픈 대기(첫 회차 판매 전) — features/boarding 'before_sale'
  | 'chatEmpty' // 채팅 빈 목록 — features/chat ChatListScreen
  | 'soldOut' // 탑승권 마감(좌석 다 참 · 판매 끝) — features/boarding 'full' · 'closed'
  | 'organizing'; // 정리 중(대화형 설문 끝) — 자리 없음(대화형 설문 끝 화면이 생기면 붙인다)

export type IllustrationMode = 'light' | 'dark';

export const ILLUSTRATIONS: Record<IllustrationScene, Record<IllustrationMode, string>> = data;

// 01 온보딩 소개 그림 3장(장 순서대로)
export const INTRO_SCENES: readonly IllustrationScene[] = ['onboarding1', 'onboarding2', 'onboarding3'];

// 그림 칸: 4:3(원본 320×240). 큰 칸 폭은 디자인 페이지 350 → 온보딩 칸과 같은 348까지, 상태 칸(불러오기 실패 등)은 240
export const illustration = {
  ratio: 4 / 3,
  hero: 390, // D43 D1: 화면 폭 − 40 까지 늘리되 최대 390(옛 348) · 늘 가운데
  state: 240,
} as const;
