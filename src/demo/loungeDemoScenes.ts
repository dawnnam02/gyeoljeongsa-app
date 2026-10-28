// 데모 라운지 장면 이름(T6 아래 데모 줄 — 데모 모드 웹에서만 보임 · 화면 카피 아님). 장면 원본은 demo/loungeDemo LOUNGE_SCENES
import type { LoungeScene } from './loungeDemo';

export const LOUNGE_SCENE_NAMES: Readonly<Record<LoungeScene, string>> = {
  first: '처음 들어가기',
  open: '평소',
  morning: '아침',
  lightsOut: '불 끈 시간',
  landing: '착륙 준비',
  closed: '닫힘',
  captainOnly: '기장 안내만',
  emptyRoom: '빈 객실',
  paused: '쓰기 멈춤',
  kicked: '이용 멈춤',
  left: '나감',
  rules: '약속이 바뀜',
};
export const loungeSceneLine = (scene: string | null) => `데모 · 라운지 장면: ${(scene && LOUNGE_SCENE_NAMES[scene as LoungeScene]) || '처음 들어가기'} (눌러서 다음 장면)`;
