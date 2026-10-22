// 토큰 색에 투명도 규칙(tokens.ts의 alpha)을 곱한 rgba 문자열을 만든다.
// 새 색을 만들지 않는다. 입력은 항상 tokens.ts의 colors 값이다.
import { alpha, colors } from './tokens';

export function withAlpha(hex: string, a: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error('withAlpha: 6자리 hex 색이 아닙니다');
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// 두 토큰 색을 섞는다(sRGB): a 를 (1 − t), b 를 t 만큼. 새 색을 만들지 않고 토큰 사이의 값만 만든다(버튼 v3 눌림 면, D40 3장)
export function mix(a: string, b: string, t: number): string {
  const rgb = (hex: string) => {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) throw new Error('mix: 6자리 hex 색이 아닙니다');
    return [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  };
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// 가이드 1-1: tint(태그 칩 · 배지 면) · pressed(눌림 면)
export const tintAccent = withAlpha(colors.accent, alpha.tint);
export const pressedAccent = withAlpha(colors.accent, alpha.pressed);

// 가이드 1-1 · 10-2: 눌림 때 퍼지는 원. 밝은 면 위는 장미 20%, 면이 장미인 요소(주 버튼)는 흰색 20%
// (장미 위에 장미 원은 보이지 않는다). 동작 줄이기에서도 농도는 그대로이고 크기와 시간만 줄어든다(10-4).
export type PressSurface = 'light' | 'accent';

export function rippleColor(surface: PressSurface): string {
  return withAlpha(surface === 'accent' ? colors.onAccent : colors.accent, alpha.ripple);
}
