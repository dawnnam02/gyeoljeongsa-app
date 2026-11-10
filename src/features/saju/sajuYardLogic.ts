// 사주 마당 탭 첫 화면(메뉴)의 순수 규칙(TAB-1): 상태 한 칸을 무엇으로 할지 · 메뉴 줄이 어떤 스위치에서 나타나는지 · 줄이 어디로 가는지.
//  · 꺼진 기능의 줄은 그리지 않는다(스위치 꺼짐 · 이번 주 타로 · 달력 · 날짜 고르기 · 시험판 AI · FORTUNE_TRIM 이 끈 칸 — 줄 자리째 없음)
//  · 줄 글은 앱에 이미 있는 카드 한 줄 설명(IF5_TEXT SAJU.madang.card.*)을 그대로 쓰고, 새 글은 sajuYardCopy 에만 있다(카피.md 21-6 초안)
//  · 값(마일리지)은 서버가 준 것만 — 이 파일에는 숫자가 없다
import type { Href } from 'expo-router';

import { IF5_TEXT } from '@/content/if5Copy';
import type { If5IconName } from './If5Icon';
import type { SajuSection } from './sajuSection';
import { YARD } from './sajuYardCopy';
import type { Ck17Slot } from './useSajuData';

// 상태 한 칸: 동의 전 → 시작하기 / 생일 전 → 내 정보 넣기 / 준비됨 → 오늘 하루 한 줄. 한 번에 하나만
export type YardState = 'loading' | 'error' | 'consent' | 'birth' | 'ready';
export function yardState(ck: Ck17Slot['kind'], inputLoaded: boolean, answered: boolean): YardState {
  if (ck === 'loading' || (ck === 'on' && !inputLoaded)) return 'loading';
  if (ck === 'fail') return 'error';
  if (ck === 'off') return 'consent';
  return answered ? 'ready' : 'birth';
}

export type YardTarget = { kind: 'screen'; href: Href } | { kind: 'detail'; section: SajuSection };
export type YardRowKey = 'today' | 'pillars' | 'year' | 'season' | 'love' | 'partner' | 'talk' | 'pick' | 'calendar';
export type YardRow = {
  key: YardRowKey;
  name: string;
  line: string;
  icon: If5IconName;
  to: YardTarget;
  /** 서버 마일리지 차감표의 기능 이름(값은 서버가 준다). 없으면 마일리지가 들지 않는 줄 */
  costFeature?: string;
  /** 값을 어떤 글로 보일지: ai = AI 맞춤 풀이를 받을 때 · turn = 이야기 한 번에 */
  costKind?: 'ai' | 'turn';
};

export type YardFlags = { isOn: (key: string) => boolean; aiAvailable: boolean };

// 줄 차례: 오늘 하루 · 내 네 기둥과 결 읽기 · 올해 흐름 · 인생 계절표 · 인연 이야기 · 둘이 맞춰 보기 · 사주 이야기 나누기 · (꺼져 있는 것이 켜지면) 날짜 고르기 · 만세력 달력
export function yardRows({ isOn, aiAvailable }: YardFlags): YardRow[] {
  const aiCost = isOn('saju_ai') && aiAvailable; // AI 맞춤 풀이 칸이 열려 있을 때만 값을 보인다
  const rows: (YardRow | null)[] = [
    isOn('saju_today') ? { key: 'today', name: IF5_TEXT['SAJU.today.title'], line: YARD.rows.today.line, icon: 'sun', to: { kind: 'screen', href: '/saju-today' as Href } } : null,
    isOn('three_pillars') || isOn('saju_reading')
      ? { key: 'pillars', name: YARD.rows.pillars.name, line: YARD.rows.pillars.line, icon: 'pillars', to: { kind: 'detail', section: 'pillars' }, ...(aiCost && isOn('saju_reading') ? { costFeature: 'saju_reading', costKind: 'ai' as const } : {}) }
      : null,
    isOn('saju_year') ? { key: 'year', name: IF5_TEXT['SAJU.year.label'], line: IF5_TEXT['SAJU.madang.card.year'], icon: 'calendar', to: { kind: 'detail', section: 'year' }, ...(aiCost ? { costFeature: 'sinyeon', costKind: 'ai' as const } : {}) } : null,
    isOn('saju_season') ? { key: 'season', name: IF5_TEXT['SAJU.life.title'], line: IF5_TEXT['SAJU.madang.card.life'], icon: 'diamond', to: { kind: 'detail', section: 'season' }, ...(aiCost ? { costFeature: 'daewoon', costKind: 'ai' as const } : {}) } : null,
    isOn('saju_reading') ? { key: 'love', name: IF5_TEXT['SAJU.love.label'], line: IF5_TEXT['SAJU.madang.card.love'], icon: 'face', to: { kind: 'detail', section: 'love' } } : null,
    isOn('saju_partner') ? { key: 'partner', name: IF5_TEXT['SAJU.partner.card'], line: IF5_TEXT['SAJU.madang.card.pair'], icon: 'person', to: { kind: 'detail', section: 'partner' }, ...(aiCost ? { costFeature: 'compat', costKind: 'ai' as const } : {}) } : null,
    isOn('saju_talk') && aiAvailable ? { key: 'talk', name: IF5_TEXT['SAJU.talk.entry.title'], line: IF5_TEXT['SAJU.talk.entry.body'], icon: 'chat', to: { kind: 'screen', href: '/saju-talk' as Href }, costFeature: 'saju_chat_turn', costKind: 'turn' } : null,
    isOn('saju_pickday') ? { key: 'pick', name: IF5_TEXT['SAJU.pick.title'], line: IF5_TEXT['SAJU.madang.card.date'], icon: 'check', to: { kind: 'screen', href: { pathname: '/saju-calendar', params: { mode: 'pick' } } as unknown as Href } } : null,
    isOn('saju_calendar') ? { key: 'calendar', name: IF5_TEXT['SAJU.cal.title'], line: IF5_TEXT['SAJU.madang.card.cal'], icon: 'calendar', to: { kind: 'screen', href: { pathname: '/saju-calendar', params: { mode: 'cal' } } as unknown as Href } } : null,
  ];
  return rows.filter((r): r is YardRow => r !== null);
}

// 마일리지 값 한 줄: 서버가 준 차감표에 그 기능이 있을 때만(없으면 줄 아래 글 0)
export function costLine(kind: 'ai' | 'turn', cost: number | null, fmt: (n: number) => string): string | null {
  if (cost === null || !Number.isFinite(cost)) return null;
  return kind === 'turn' ? YARD.cost.turn(fmt(cost)) : YARD.cost.ai(fmt(cost));
}
