// 글자 5단계(가이드 2장, D22)를 그대로 쓰는 글자 컴포넌트. 크기 · 행간 · 글꼴은 tokens.ts 의 type 에서만 온다.
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, type } from '@/theme/tokens';

// 헤더 제목 · 탭 라벨은 글자를 키워도 1.3배까지만 커진다(D22 13): 고정 폭 자리를 넘지 않게. 본문은 제한 없음
export const HEADER_MAX_SCALE = 1.3;

export type TextVariant = keyof typeof type;
export type TextTone = 'text' | 'sub' | 'accent' | 'inverse';

const toneColor: Record<TextTone, string> = {
  text: colors.text,
  sub: colors.sub,
  accent: colors.accent,
  inverse: colors.onAccent, // 주 버튼 글자(면이 accent 일 때)
};

// 가이드 2장: 설명문 · 보조(13)는 기본 색이 sub, 나머지는 text
const defaultTone = (variant: TextVariant): TextTone =>
  variant === 'caption' || variant === 'captionMedium' || variant === 'captionBold' ? 'sub' : 'text';

// D43 E1: 웹에서는 낱말 중간에서 줄이 꺾이지 않게(word-break: keep-all, react-native-web 이 넘겨 준다). 앱(iOS · 안드로이드)은 기기 줄바꿈 그대로
const WEB_KEEP_ALL: TextStyle | null = Platform.OS === 'web' ? ({ wordBreak: 'keep-all' } as unknown as TextStyle) : null;

type Props = TextProps & { variant?: TextVariant; tone?: TextTone };

export function AppText({ variant = 'body', tone, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[type[variant], WEB_KEEP_ALL, { color: toneColor[tone ?? defaultTone(variant)] }, style]}
    />
  );
}
