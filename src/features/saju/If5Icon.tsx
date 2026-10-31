// 사주 마당 · 마일리지 디자인 아이콘 22(IF5-D → IF5-F1b ⓕ) 그리기. 경로는 if5IconPaths.ts(= 디자인/IF5/원본/icon_*.svg, scripts/gen-if5-assets.mjs).
//  · 색은 부르는 쪽이 토큰 색을 넘긴다(기본 text) · 선 굵기는 공용 Icon 과 같은 규칙(24 이상 1.5 · 20 이하 1.75) · 꾸밈 그림이라 스크린리더는 건너뛴다(이름은 누르는 부품이 가진다)
import Svg, { Path } from 'react-native-svg';

import { iconStroke } from '@/components/Icon';
import { colors } from '@/theme/tokens';

import { IF5_ICON_PATHS } from './if5IconPaths';

export type If5IconName = keyof typeof IF5_ICON_PATHS;
export const IF5_ICON_NAMES = Object.keys(IF5_ICON_PATHS) as If5IconName[];

export function If5Icon({ name, size = 24, color = colors.text, testID }: { name: If5IconName; size?: number; color?: string; testID?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={iconStroke(size)} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {IF5_ICON_PATHS[name].parts.map((p, i) => (
        <Path key={i} d={p.d} fill="none" />
      ))}
    </Svg>
  );
}
