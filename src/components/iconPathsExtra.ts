// 공용 아이콘 1안(components/iconPaths = 디자인 1안 원본 paths.json 61개) 밖에 앱이 더한 아이콘. 같은 규격(24 격자 · 선 1.5 · 둥근 끝 · role shape = 켜진 탭에서만 accentSoft 로 채움).
//  iconPaths.ts 는 디자인 원본과 한 글자씩 같아야 해서(staticRules) 여기에 따로 둔다 — 디자인 원본이 갱신되면 그쪽으로 옮기고 이 파일의 해당 줄을 지운다.
//  · saju(TAB-1): 하단 탭 '사주 마당'. 기존 사주 아이콘 pillars(features/saju/if5IconPaths — 네 기둥, 키가 다른 막대 넷) 모양을 따르되, 켜진 탭에서 면이 채워지게 role 을 shape 로 한다
import type { IconPart } from './iconPaths';

export const ICON_PATHS_EXTRA = {
  saju: {
    name: '사주 마당',
    parts: [
      { role: 'shape', d: 'M4.7 11H5.3A1.2 1.2 0 0 1 6.5 12.2V18.8A1.2 1.2 0 0 1 5.3 20H4.7A1.2 1.2 0 0 1 3.5 18.8V12.2A1.2 1.2 0 0 1 4.7 11z' },
      { role: 'shape', d: 'M9.7 5H10.3A1.2 1.2 0 0 1 11.5 6.2V18.8A1.2 1.2 0 0 1 10.3 20H9.7A1.2 1.2 0 0 1 8.5 18.8V6.2A1.2 1.2 0 0 1 9.7 5z' },
      { role: 'shape', d: 'M14.7 8H15.3A1.2 1.2 0 0 1 16.5 9.2V18.8A1.2 1.2 0 0 1 15.3 20H14.7A1.2 1.2 0 0 1 13.5 18.8V9.2A1.2 1.2 0 0 1 14.7 8z' },
      { role: 'shape', d: 'M19.7 13H20.3A1.2 1.2 0 0 1 21.5 14.2V18.8A1.2 1.2 0 0 1 20.3 20H19.7A1.2 1.2 0 0 1 18.5 18.8V14.2A1.2 1.2 0 0 1 19.7 13z' },
    ],
  },
} as const satisfies Record<string, { name: string; parts: readonly IconPart[] }>;

export type ExtraIconName = keyof typeof ICON_PATHS_EXTRA;
