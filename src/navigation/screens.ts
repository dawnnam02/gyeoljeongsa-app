// 화면 ID 16개. 원본: 디자인/figma_화면목록.md 틀 15화면 · 기획/화면_요구사항.md(K2) 4장 01~12 + 6장 13~15(D4가 만들 상태 화면 3개) + 4장 16 상점(K7, F11).
// 라우트 파일 1개 = 화면 ID 1개(04 설문은 쪽이 31개라 /survey/[step] 한 파일이 04 하나다).
// 13 · 14 · 15 는 부모 화면(09 · 11 · 02)의 빈 · 오류 상태를 따로 볼 수 있게 둔 라우트다(디자인 D4).
import type { Href } from 'expo-router';

// V5(W6 · 청사진 v5 초안 6-1): 새 화면 T1 탑승권(T2 기다림은 T1 의 상태 — 같은 주소) · T3 공개 순간 · T5 크레딧. T4 채팅 목록(탭) · T4R 대화방(W5 · D-159)
export const SCREEN_IDS = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', 'T1', 'T3', 'T5', 'T4', 'T4R', '16G', 'T6', 'IF-MAG', 'IF-TYPE', 'IF-PREVIEW', 'IF-BOOK', 'IF-MADANG', 'IF-SJ-CAL', 'IF-MILE', 'IF-MILE-LOG', 'IF-SJ-TALK', 'IF-SJ-TODAY',
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

// 이 화면의 본문을 채우는 세부계획(팀장/세부계획.md 2장 Phase 3)
export type FilledBy = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F11' | 'W6' | 'W5' | 'R-A' | 'LG-F' | 'IF2-F' | 'IF3-F' | 'IF5-F';

export type ScreenDef = {
  readonly id: ScreenId;
  readonly name: string; // K2 화면 이름
  readonly route: string; // 파일 경로에서 나온 주소(그룹 (tabs) 제외). 동적 구간은 [step] · [id] 그대로
  readonly href: Href; // 처음 들어갈 때 쓰는 주소
  readonly tabBar: boolean; // 탭바가 보이는 화면(K2 R6 · K7: 09 · 11 · 16 · 12 와 그 상태 13 · 14. 08 은 탭이 아니라 탭 위에 열리는 화면)
  readonly stateOf?: ScreenId; // 13 · 14 · 15: 어느 화면의 상태인가
  readonly filledBy: FilledBy;
  readonly k2: string; // K2 위치
};

export const SCREENS: readonly ScreenDef[] = [
  { id: '01', name: '온보딩', route: '/onboarding', href: '/onboarding', tabBar: false, filledBy: 'F1', k2: '4장 01' },
  { id: '02', name: '가입·로그인', route: '/sign-in', href: '/sign-in', tabBar: false, filledBy: 'F1', k2: '4장 02' },
  { id: '03', name: '약관·동의', route: '/consent', href: '/consent', tabBar: false, filledBy: 'F1', k2: '4장 03' },
  {
    id: '04', name: '설문', route: '/survey/[step]',
    href: { pathname: '/survey/[step]', params: { step: '01' } },
    tabBar: false, filledBy: 'F2', k2: '4장 04 · 3장(04-01~04-32, 04-12 결번)',
  },
  { id: '05', name: '사진 등록', route: '/photos', href: '/photos', tabBar: false, filledBy: 'F2', k2: '4장 05' },
  { id: '06', name: 'AI 정리 중', route: '/analysis', href: '/analysis', tabBar: false, filledBy: 'F3', k2: '4장 06' },
  { id: '07', name: '내 성향', route: '/traits', href: '/traits', tabBar: false, filledBy: 'F3', k2: '4장 07' },
  { id: '08', name: '내 프로필', route: '/profile', href: '/profile', tabBar: false, filledBy: 'F4', k2: '4장 08' },
  { id: '09', name: '오늘의 추천', route: '/recommendations', href: '/recommendations', tabBar: true, filledBy: 'F5', k2: '4장 09' },
  {
    id: '10', name: '상대 프로필', route: '/candidate/[id]',
    href: { pathname: '/candidate/[id]', params: { id: 'preview' } },
    tabBar: false, filledBy: 'F5', k2: '4장 10',
  },
  { id: '11', name: '호감', route: '/likes', href: '/likes', tabBar: true, filledBy: 'F6', k2: '4장 11' },
  { id: '12', name: '설정', route: '/settings', href: '/settings', tabBar: true, filledBy: 'F7', k2: '4장 12' },
  {
    id: '13', name: '추천 없음', route: '/recommendations-empty', href: '/recommendations-empty',
    tabBar: true, stateOf: '09', filledBy: 'F5', k2: '6장 · 4장 09 빈 상태',
  },
  {
    id: '14', name: '호감 없음', route: '/likes-empty', href: '/likes-empty',
    tabBar: true, stateOf: '11', filledBy: 'F6', k2: '6장 · 4장 11 빈 상태',
  },
  {
    id: '15', name: '인증 실패', route: '/sign-in-code-error', href: '/sign-in-code-error',
    tabBar: false, stateOf: '02', filledBy: 'F1', k2: '6장 · 4장 02 오류',
  },
  { id: '16', name: '상점', route: '/shop', href: '/shop', tabBar: true, filledBy: 'F11', k2: '4장 16' },
  { id: 'T1', name: '탑승권', route: '/boarding', href: '/boarding' as Href, tabBar: true, filledBy: 'W6', k2: '청사진 v5 초안 6-1 T1 · T2' },
  { id: 'T3', name: '공개 순간', route: '/reveal', href: '/reveal' as Href, tabBar: false, filledBy: 'W6', k2: '청사진 v5 초안 6-1 T3' },
  { id: 'T5', name: '크레딧', route: '/credits', href: '/credits' as Href, tabBar: false, filledBy: 'W6', k2: '청사진 v5 초안 6-1 T5' },
  { id: 'T4', name: '채팅', route: '/chat', href: '/chat' as Href, tabBar: true, filledBy: 'W5', k2: '청사진 v5 초안 6-1 T4 목록' },
  { id: 'T4R', name: '대화방', route: '/chat/[id]', href: '/chat' as Href, tabBar: false, filledBy: 'W5', k2: '청사진 v5 초안 6-1 T4 방' },
  { id: '16G', name: '내 등급', route: '/grade', href: '/grade' as Href, tabBar: false, filledBy: 'R-A', k2: '화면_요구사항 v5 16-G · 12-1(D-200 ②)' },
  { id: 'T6', name: '탑승객 라운지', route: '/lounge', href: '/lounge' as Href, tabBar: false, filledBy: 'LG-F', k2: '화면_요구사항 T6 · 정책 L장(D-220) — 입구는 T4 목록 맨 위 라운지 줄' },
  // IF2-F(D-223): 기내 서비스 화면 셋(나머지 IF 화면은 시트) — 탭 밖 · 새 탭 0
  { id: 'IF-MAG', name: '기내지', route: '/magazine', href: '/magazine' as Href, tabBar: false, filledBy: 'IF2-F', k2: '화면_요구사항 IF-MAG · IF-CARD · 정책 PF-21 ~ PF-25' },
  { id: 'IF-TYPE', name: '내 여행 타입', route: '/type-card', href: '/type-card' as Href, tabBar: false, filledBy: 'IF2-F', k2: '화면_요구사항 IF-TYPE · 정책 PF-31 ~ PF-33' },
  { id: 'IF-PREVIEW', name: '짝에게 보이는 내 모습', route: '/preview-me', href: '/preview-me' as Href, tabBar: false, filledBy: 'IF2-F', k2: '화면_요구사항 IF-PREVIEW · 정책 PF-34' },
  // IF3-F(3부-카 · G-03): 하늘 도감 — 기내지 뒤표지 길 · 12 정보 줄에서만 들어간다(홈 입구 0)
  { id: 'IF-BOOK', name: '하늘 도감', route: '/sky-book', href: '/sky-book' as Href, tabBar: false, filledBy: 'IF3-F', k2: '화면_요구사항 IF3 · 정책 PG-31 ~ PG-33' },
  // IF5-F1(D-237): 사주 마당 한 화면(새 탭 0) + 달력 · 날짜 고르기 + 홈 '오늘 하루' 화면. 입구 = 홈 B6 칸 · B7 줄 · 오늘 하루 띠 · 12 설정 '사주 마당' 줄
  { id: 'IF-MADANG', name: '사주 마당', route: '/saju', href: '/saju' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 IF-MADANG · 정책 PS-31 ~ PS-38' },
  { id: 'IF-SJ-CAL', name: '만세력 달력 · 날짜 고르기', route: '/saju-calendar', href: '/saju-calendar' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 IF-SJ-CAL · 정책 PS-35 · PS-36 · PS-71 · PS-72' },
  // IF5-F2(D-237): 마일리지(상점 탭 0 — 설정 줄 + [충전] 길) · 내역 · 사주 이야기 나누기. 확인 시트 셋(IF-MILE-OK)은 시트라 화면 ID 0
  { id: 'IF-MILE', name: '마일리지', route: '/mileage', href: '/mileage' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 IF-MILE · 정책 PS-41 ~ PS-47' },
  { id: 'IF-MILE-LOG', name: '마일리지 내역', route: '/mileage-log', href: '/mileage-log' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 IF-MILE-LOG · 정책 PS-43' },
  { id: 'IF-SJ-TALK', name: '사주 이야기 나누기', route: '/saju-talk', href: '/saju-talk' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 IF-SJ-TALK · 정책 PS-38 · PS-45 ~ PS-53' },
  { id: 'IF-SJ-TODAY', name: '오늘 하루', route: '/saju-today', href: '/saju-today' as Href, tabBar: false, filledBy: 'IF5-F', k2: '화면_요구사항 홈 오늘 하루 띠 · 정책 PS-34' },
];

export function screenById(id: ScreenId): ScreenDef {
  const found = SCREENS.find((s) => s.id === id);
  if (!found) throw new Error(`알 수 없는 화면 ID ${id}`);
  return found;
}

// 탭바 4개: 추천 · 호감 · 상점 · 설정 (K2 R6 · K7, 가이드 5장). 순서가 곧 탭 순서다. 내 프로필(08)은 탭이 아니라 머리 오른쪽 위 원형 사진으로 들어간다.
// V5(W6): 탑승권(T1)이 첫 탭. 09 · 11 · 16 은 스위치로 숨긴 탭(navigation/v5Hide — 켜면 다시 칸이 생긴다)
export const TAB_SCREEN_IDS = ['T1', 'T4', '09', '11', '16', '12'] as const satisfies readonly ScreenId[]; // V5 W5: 채팅(T4)이 둘째 탭
