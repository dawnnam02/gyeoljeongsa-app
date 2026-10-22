// 버튼 v3 A안 '도톰한 와인'의 면 · 그림자(디자인/D40_버튼v3/토큰표.md 2장 A열 · 본인 선택 D-141).
//  새 색 없음: 눌림 면은 두 토큰을 섞은 값(mix), 그림자는 토큰 색의 투명도(withAlpha). 값의 근거는 토큰표 3장 '파생 값 만드는 식'.
//  그림자는 버튼(주 · 위험 · 보조 · 아이콘)만 — 가이드 7장 '그림자 0'의 예외(D-141). 카드 · 바탕 · 시트는 평면 그대로.
//
// 플랫폼(설치 원본 확인, RN 0.86.3 · Expo 57 · react-native-web 0.21.4):
//  · iOS · Android(새 아키텍처만 있는 RN 0.86): 스타일 `boxShadow` 문자열을 CSS 꼴 그대로 받는다(Libraries/StyleSheet/processBoxShadow.js — inset · px · 음수 퍼짐 · rgba).
//    Android 는 바깥 그림자가 API 28(Android 9)부터, 안쪽 그림자(윗면 빛)가 API 29(Android 10)부터 그려진다(OutsetBoxShadowDrawable · InsetBoxShadowDrawable).
//  · 앱 최소 SDK 는 24(Android 7)라 API 24~27 에서는 boxShadow 가 그려지지 않는다 → 같은 느낌을 elevation(검은 그림자 · 낮게)으로 대신한다.
//  · 웹: react-native-web 이 문자열을 CSS box-shadow 로 그대로 넘긴다.
import { Platform, type ViewStyle } from 'react-native';

import { mix, withAlpha } from './color';
import { button, colors } from './tokens';

const white = (a: number) => withAlpha(colors.onAccent, a);
const ink = (a: number) => withAlpha(colors.text, a);
const wine = (a: number) => withAlpha(colors.accent, a);

// 눌림 면(한 단계 짙게) — 토큰표 3장의 주 · 위험 눌림 값과 같은 값이 나온다(시험 f21Ui 가 글자 그대로 대조)
export const buttonFace = {
  primary: colors.accent,
  primaryPressed: mix(colors.accent, colors.text, button.pressMix.primary),
  danger: colors.text,
  dangerPressed: mix(colors.text, colors.bg, button.pressMix.danger),
  secondary: colors.bg, // 아이보리 면 + line 1 선
  secondaryPressed: colors.card,
  textPressed: colors.accentSoft, // 텍스트 버튼 눌림 상자
  off: colors.card, // 비활성(주 · 위험) 면 — 글자 sub 4.78 : 1
  icon: colors.bg,
  iconPressed: colors.card,
} as const;

export type ShadowKind = 'primary' | 'primaryPressed' | 'danger' | 'dangerPressed' | 'secondary' | 'icon';

// CSS box-shadow 꼴(토큰표 2장 A열 그대로). 위험 눌림은 토큰표에 없어 주 눌림과 같은 비율로 줄였다(와인 대신 text)
export const buttonShadow: Record<ShadowKind, string> = {
  primary: `inset 0 1px 0 ${white(0.18)}, 0 1px 2px ${ink(0.1)}, 0 6px 14px -6px ${wine(0.55)}`,
  primaryPressed: `inset 0 1px 0 ${white(0.08)}, 0 1px 1px ${ink(0.1)}, 0 2px 4px -2px ${wine(0.4)}`,
  danger: `inset 0 1px 0 ${white(0.1)}, 0 1px 2px ${ink(0.12)}, 0 6px 14px -6px ${ink(0.45)}`,
  dangerPressed: `inset 0 1px 0 ${white(0.06)}, 0 1px 1px ${ink(0.12)}, 0 2px 4px -2px ${ink(0.35)}`,
  secondary: `0 1px 2px ${ink(0.06)}, 0 4px 10px -6px ${ink(0.16)}`,
  icon: `0 1px 2px ${ink(0.08)}, 0 3px 8px -4px ${ink(0.18)}`,
};

// Android 9 미만 대신 높이(elevation): 쉴 때 주 · 위험 3 · 보조 · 아이콘 1, 눌리면 1
const ELEVATION: Record<ShadowKind, number> = { primary: 3, primaryPressed: 1, danger: 3, dangerPressed: 1, secondary: 1, icon: 1 };
const ANDROID_BOX_SHADOW_MIN = 28;

export function shadowStyle(kind: ShadowKind | null): ViewStyle {
  if (kind === null) return {};
  if (Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < ANDROID_BOX_SHADOW_MIN) return { elevation: ELEVATION[kind] };
  return { boxShadow: buttonShadow[kind] };
}
