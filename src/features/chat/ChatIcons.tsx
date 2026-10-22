// 채팅 아이콘 다섯(사진 · 마이크 · 재생 · 멈춤 · 녹음 멈춤) — 24 격자 선 2(가이드 아이콘 규칙과 같은 굵기). 디자인 W12 아이콘이 나오면 그림만 바꾼다.
//  색은 토큰만(부르는 쪽이 colors.* 를 넘긴다). 꾸밈 그림이라 스크린리더는 건너뛰고, 이름은 누르는 부품이 가진다
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type ChatIconName = 'photo' | 'mic' | 'play' | 'pause' | 'stop';

export function ChatIcon({ name, color, size = 24 }: { name: ChatIconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'photo' ? (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={3} stroke={color} strokeWidth={2} />
          <Circle cx={9} cy={10} r={1.8} stroke={color} strokeWidth={2} />
          <Path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'mic' ? (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} />
          <Path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'play' ? <Path d="M8 5.5v13l10-6.5-10-6.5z" fill={color} /> : null}
      {name === 'pause' ? (
        <>
          <Rect x={7} y={5.5} width={3.5} height={13} rx={1} fill={color} />
          <Rect x={13.5} y={5.5} width={3.5} height={13} rx={1} fill={color} />
        </>
      ) : null}
      {name === 'stop' ? <Rect x={7} y={7} width={10} height={10} rx={2} fill={color} /> : null}
    </Svg>
  );
}
