// 라운지 아이콘 9개(LG-D · D-220) — 원본 디자인/LG_라운지/원본/paths.json 을 그대로 옮긴 경로(시험이 원본과 같은지 본다). 규격은 공용 아이콘과 같은 D42 1안:
//  24 격자 · 선 1.5(20 이하 1.75) · 끝 · 꺾임 둥글게 · role: shape(닫힌 면 — 켜짐에서만 accentSoft 채움 = empathy_on) · line · dot(선 색 채움)
//  · 색은 부르는 쪽이 토큰 색을 넘긴다. 꾸밈 그림이라 스크린리더는 건너뛰고, 이름은 누르는 부품이 가진다
//  · 공용 아이콘 목록(components/iconPaths — D42 원본 61개와 같아야 함)에는 더하지 않고 여기 따로 둔다
import Svg, { Path } from 'react-native-svg';

import { iconStroke } from '@/components/Icon';
import type { IconPart } from '@/components/iconPaths';
import { colors } from '@/theme/tokens';

export const LOUNGE_ICON_PATHS = {
  seat: { name: '라운지 좌석', parts: [{ role: 'line', d: 'M8 4v8.5A2.5 2.5 0 0 0 10.5 15H17' }, { role: 'line', d: 'M11 11.5h5a1.5 1.5 0 0 1 1.5 1.5v2' }, { role: 'line', d: 'M10 15l-1.2 5M16 15l1.2 5' }] },
  window_shade: { name: '소등(창 가리개)', parts: [{ role: 'shape', d: 'M8 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4H8a4 4 0 0 1 -4 -4V7a4 4 0 0 1 4 -4z' }, { role: 'line', d: 'M4 7.5h16M4 11h16' }, { role: 'line', d: 'M12 11v2.5' }] },
  landing: { name: '착륙 준비', parts: [{ role: 'line', d: 'M3 20.5h18' }, { role: 'shape', d: 'M5.4 7.9l1.7 .3 3 2.7 6.7 1.8c1.1 .3 1.7 1.2 1.4 1.9 -.3 .7 -1.1 .9 -2 .7L6 12.1 4.4 8.3z' }, { role: 'line', d: 'M10.4 12.9l-1.6 3.2' }] },
  door_closed: { name: '라운지 닫힘', parts: [{ role: 'shape', d: 'M6.5 21V4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21' }, { role: 'line', d: 'M4 21h16' }, { role: 'dot', d: 'M13.6 12.5a.9.9 0 1 0 1.8 0a.9.9 0 1 0 -1.8 0z' }] },
  captain: { name: '기장 안내', parts: [{ role: 'shape', d: 'M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0 -4.8z' }, { role: 'line', d: 'M9.6 11.2H2.8c.5 2.2 2.4 3.6 4.7 3.6h2.4' }, { role: 'line', d: 'M14.4 11.2h6.8c-.5 2.2 -2.4 3.6 -4.7 3.6h-2.4' }] },
  empathy: { name: '공감', parts: [{ role: 'shape', d: 'M5 4.5h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1 -2 2h-7l-4.5 3.5V17H5a2 2 0 0 1 -2 -2V6.5a2 2 0 0 1 2 -2z' }, { role: 'line', d: 'M8.8 10.4c.8 1.1 1.9 1.7 3.2 1.7s2.4 -.6 3.2 -1.7' }] },
  quote_reply: { name: '인용 답장 · 나도 답하기', parts: [{ role: 'line', d: 'M10 7L5 12l5 5' }, { role: 'line', d: 'M5 12h9a5 5 0 0 1 5 5v1.5' }] },
  hide_seat: { name: '이 좌석 글 숨기기', parts: [{ role: 'line', d: 'M2.5 12S6 5.5 12 5.5c1.9 0 3.5 .6 4.9 1.5M21.5 12s-1.3 2.4 -3.7 4.3M14.1 14.1a3 3 0 0 1 -4.2 -4.2' }, { role: 'line', d: 'M4 4l16 16' }] },
  retry: { name: '다시 시도', parts: [{ role: 'line', d: 'M4.5 12a7.5 7.5 0 1 0 2.2 -5.3' }, { role: 'line', d: 'M4.5 4.5v3h3' }] },
} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;

export type LoungeIconName = keyof typeof LOUNGE_ICON_PATHS;
export const LOUNGE_ICON_NAMES = Object.keys(LOUNGE_ICON_PATHS) as LoungeIconName[];

// on = 켜짐(원본 empathy_on.svg — 닫힌 면을 accentSoft 로 채움)
export function LoungeIcon({ name, size = 24, color = colors.text, on = false, testID }: { name: LoungeIconName; size?: number; color?: string; on?: boolean; testID?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={iconStroke(size)} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {LOUNGE_ICON_PATHS[name].parts.map((p, i) =>
        p.role === 'dot' ? <Path key={i} d={p.d} fill={color} stroke="none" /> : <Path key={i} d={p.d} fill={p.role === 'shape' && on ? colors.accentSoft : 'none'} />,
      )}
    </Svg>
  );
}
