// 공용 아이콘(D42-C · 1안 실선 1.5, D-171 · 앱 적용 D-176). 경로는 iconPaths.ts(= 디자인/D42_새판/아이콘/1안_원본/paths.json).
//  · 선 굵기: 24px 이상 1.5, 20px 이하 1.75(작은 크기 · 저시력). 끝 · 꺾임 둥글게
//  · 색: 부르는 쪽이 토큰 색을 넘긴다(기본 text). 꺼진 탭 = sub, 켜진 탭 = accent + on(닫힌 면 accentSoft)
//  · dot(더보기 점)만 선 색으로 채운다. 그 밖의 면은 켜진 탭(on)에서만 채운다
//  · 꾸밈 그림이라 스크린리더는 건너뛴다. 이름은 누르는 부품이 가진다
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { ICON_PATHS, type IconName } from './iconPaths';

export type { IconName } from './iconPaths';

export const ICON_STROKE = 1.5;
export const ICON_STROKE_SMALL = 1.75;
export const ICON_SMALL_MAX = 20;
export const iconStroke = (size: number) => (size <= ICON_SMALL_MAX ? ICON_STROKE_SMALL : ICON_STROKE);

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  on?: boolean; // 켜진 탭: 닫힌 면을 accentSoft 로 채운다
  flip?: boolean; // 좌우 뒤집기(뒤로 ‹ → 다음 ›)
  rotate?: 90 | -90 | 180; // 뒤로 ‹ 를 위 · 아래로 돌려 쓸 때
  opacity?: number;
  testID?: string;
};

export function Icon({ name, size = 24, color = colors.text, on = false, flip = false, rotate, opacity = 1, testID }: Props) {
  const transform = [...(flip ? [{ scaleX: -1 }] : []), ...(rotate ? [{ rotate: `${rotate}deg` }] : [])];
  const svg = (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={iconStroke(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}>
      {ICON_PATHS[name].parts.map((p, i) =>
        p.role === 'dot' ? (
          <Path key={i} d={p.d} fill={color} stroke="none" />
        ) : (
          <Path key={i} d={p.d} fill={p.role === 'shape' && on ? colors.accentSoft : 'none'} />
        ),
      )}
    </Svg>
  );
  // 뒤집기 · 돌리기는 감싸는 View 에 준다(웹 · 네이티브 모두 같은 방식)
  return transform.length > 0 ? <View style={{ width: size, height: size, transform }}>{svg}</View> : svg;
}
