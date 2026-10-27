// 05 사진 칸 안내 그림 3장(D43 B5 · 원본 디자인/D43_사진칸그림/paths.json — 64 격자 · 선 1.5 · 둥근 끝).
//  · 선은 text, 강조 한 획은 accent(얼굴 칸 점선 타원만 점선 3 3). 색은 토큰에서 온다(원본 선 · 강조 색 = text · accent)
//  · 옛 PNG(assets/icons/art/photo-guide-*.png, D42 이전 그림체) 대신. 꾸밈 그림이라 스크린리더는 건너뛴다(칸 이름이 뜻을 말한다)
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type PhotoSlotArtName = 'face' | 'full' | 'free';

type Stroke = { d: string; dash?: string };
const ART: Readonly<Record<PhotoSlotArtName, { line: readonly string[]; accent: readonly Stroke[] }>> = {
  face: {
    line: ['M18 8h28a4 4 0 0 1 4 4v40a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z', 'M32 19a7 7 0 1 1 0 14a7 7 0 0 1 0-14z', 'M20 50c0-6.6 5.4-12 12-12s12 5.4 12 12'],
    accent: [{ d: 'M32 14c6.6 0 12 7.2 12 16s-5.4 16-12 16s-12-7.2-12-16s5.4-16 12-16z', dash: '3 3' }],
  },
  full: {
    line: [
      'M22 6h20a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z',
      'M32 11a4 4 0 1 1 0 8a4 4 0 0 1 0-8z',
      'M30 22h4a3 3 0 0 1 3 3v12H27V25a3 3 0 0 1 3-3z',
      'M29.5 37v13',
      'M34.5 37v13',
      'M27 25l-2.5 9',
      'M37 25l2.5 9',
    ],
    accent: [{ d: 'M25 53h14' }],
  },
  free: {
    line: [
      'M10 14h44a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z',
      'M21 25.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9z',
      'M13 47c0-4.7 3.6-8.5 8-8.5s8 3.8 8 8.5',
      'M44 24a6 6 0 1 1 0 12a6 6 0 0 1 0-12z',
      'M44 36v11',
      'M44 41l-3-3',
    ],
    accent: [{ d: 'M51 17l1 2.5l2.5 1l-2.5 1l-1 2.5l-1-2.5l-2.5-1l2.5-1z' }],
  },
};

export function PhotoSlotArt({ name, size = 64, testID }: { name: PhotoSlotArtName; size?: number; testID?: string }) {
  const art = ART[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={colors.text} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID}>
      {art.line.map((d) => (
        <Path key={d} d={d} />
      ))}
      {art.accent.map((s) => (
        <Path key={s.d} d={s.d} stroke={colors.accent} strokeDasharray={s.dash} />
      ))}
    </Svg>
  );
}
