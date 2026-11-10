// 사주 마당 탭 메뉴 줄 → 내 사주 자세히(/saju-detail): 맨 위에 올 구역을 앱 안 메모리로 건넨다(TAB-1).
//  · 주소의 파라미터로 보내지 않는다 — 웹 주소창 · 기록에 구역 이름이 남지 않고, 남이 만든 링크로 구역이 지정되지 않는다(Q2-02 첫마디 길 openerPath 와 같은 방식)
//  · 화면을 떠나면 건넨 것은 지운다. 오래된 건넴(HANDOFF_MS)은 버린다 — 열지 못한 건넴이 나중에 되살아나지 않게
//  · 로그아웃 · 탈퇴 · 세션 만료 때도 비운다(lib/sessionGate)
import { onSessionEnd } from '@/lib/sessionGate';

export const SAJU_SECTIONS = ['pillars', 'year', 'season', 'love', 'partner', 'guide'] as const;
export type SajuSection = (typeof SAJU_SECTIONS)[number];

const HANDOFF_MS = 30_000;
let pending: { section: SajuSection; at: number } | null = null;
onSessionEnd(() => {
  pending = null;
});

export function handOffSajuSection(section: SajuSection, now: number = Date.now()): void {
  pending = { section, at: now };
}

// 읽기만 한다(React 개발 모드가 초기화를 두 번 불러도 같은 값). 지우기는 화면을 떠날 때 clearSajuSection
export function peekSajuSection(now: number = Date.now()): SajuSection | null {
  if (!pending || now - pending.at > HANDOFF_MS) return null;
  return pending.section;
}

export function clearSajuSection(): void {
  pending = null;
}
