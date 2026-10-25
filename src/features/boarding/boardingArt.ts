// 탑승권 상태마다 장면 그림 한 장(D42-I 4안 · D-176). BoardingScreen 이 상태 카드 위에 놓는다.
//  판매 전 = 사전 오픈 대기 · 판매 중 = 탑승권 · 좌석 다 참 · 판매 끝 = 마감 · 탑승 완료 = 기다림 · 공개 = 공개 순간 / 못 찾음 · 살 수 없음 = 그림 없음
import type { IllustrationScene } from '@/theme/illustrations';

import type { BoardingView } from './boardingLogic';

export const SCENE_OF: Record<BoardingView, IllustrationScene | null> = {
  before_sale: 'preopen',
  on_sale: 'ticket',
  full: 'soldOut',
  closed: 'soldOut',
  boarded: 'waiting',
  matched: 'reveal',
  no_match: 'noMatch',
  ineligible: null,
};
