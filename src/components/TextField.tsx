// 입력 칸 v2(가이드 4-4 · D36 #12, F21). 높이 52 · 둥글기 12(알약 대신) · 면 card · 테두리 없음(같은 색 1) · 값 16 Regular · 자리표시 sub.
//  입력 중 · 오류: 테두리 accent 2(포커스와 같은 굵기) — 입력 중은 면 bg / 오류는 아래에 보조 Medium 13 accent 문구 / 비활성: 투명도 대신 색(바탕 line · 글자 sub)
//  테두리가 굵어지면 안 여백을 그만큼 줄여 글자 자리를 고정한다. 오류 아이콘은 그림이 없어 글만(D-118 ⑧).
//  한글 입력(F23 · 청사진 10-5 P10): 웹에서 조합 중(compositionstart ~ end)에는 칸의 글을 그대로 두고(부모 값 되쓰기 · 자르기 0) 그대로 알린다.
//   최대 글자 수는 조합이 끝난 뒤 자른다(웹은 DOM maxlength 를 쓰지 않음). 규칙은 lib/imeText. iOS · Android 는 플랫폼 입력기가 하므로 그대로
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { imeChange, imeEnd, imeIdle, imeMark, imeStart, imeValue, type ImeGate } from '@/lib/imeText';
import { layout } from '@/theme/layout';
import { colors, radius, size, space, type } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = Pick<
  TextInputProps,
  | 'keyboardType'
  | 'maxLength'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoComplete'
  | 'textContentType'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'autoFocus'
  | 'inputMode'
> & {
  label: string; // 스크린리더가 읽는 칸 이름
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string | null; // 있으면 오류 모양 + 아래에 문구
  disabled?: boolean;
  multiline?: boolean; // 여러 줄 글 상자(07 요약 고치기): 둥글기 lg · 최소 높이, 글자는 위에서부터
  testID?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, value, onChangeText, placeholder, error, disabled = false, multiline = false, testID, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const active = (focused && !disabled) || Boolean(error);
  const border = active ? size.focusRing : layout.inputBorder;
  const host = useRef<TextInput>(null);
  useImperativeHandle(ref, () => host.current as TextInput, []); // 부모가 넘긴 ref 에도 같은 칸을 준다
  const ime = useImeGuard(host, value, onChangeText, inputProps.maxLength);
  return (
    <View style={styles.wrap}>
      <TextInput
        {...inputProps}
        ref={host}
        maxLength={ime.web ? undefined : inputProps.maxLength}
        value={ime.value}
        onChangeText={ime.onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.sub}
        editable={!disabled}
        multiline={multiline}
        accessibilityLabel={label}
        aria-disabled={disabled}
        testID={testID}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { borderWidth: border, borderColor: active ? colors.accent : colors.card, backgroundColor: focused && !error ? colors.bg : colors.card, paddingHorizontal: space.s16 - (border - layout.inputBorder) },
          disabled ? styles.disabled : null,
        ]}
      />
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={testID ? `${testID}-error` : undefined} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

type HostNode = { value?: string; addEventListener?: (type: string, fn: () => void) => void; removeEventListener?: (type: string, fn: () => void) => void };

// 웹 한글 조합 지키기: 조합 중에는 칸의 글을 보이고(부모 값 무시), 조합이 끝나면 자른 값을 부모에 한 번 더 알린다
function useImeGuard(host: RefObject<TextInput | null>, value: string, onChangeText: (v: string) => void, maxLength: number | undefined) {
  const web = Platform.OS === 'web';
  const [gate, setGate] = useState<ImeGate>(() => imeIdle(value));
  const gateRef = useRef(gate);
  const latest = useRef({ onChangeText, maxLength });
  useEffect(() => {
    latest.current = { onChangeText, maxLength };
  });
  useEffect(() => {
    const node = host.current as unknown as HostNode | null;
    if (!web || !node?.addEventListener || !node.removeEventListener) return;
    const start = () => {
      if (!gateRef.current.composing) imeMark(1);
      gateRef.current = imeStart(String(node.value ?? ''));
      setGate(gateRef.current);
    };
    const end = () => {
      if (gateRef.current.composing) imeMark(-1);
      const next = imeEnd(String(node.value ?? ''), latest.current.maxLength);
      gateRef.current = next.gate;
      setGate(next.gate);
      latest.current.onChangeText(next.emit);
    };
    node.addEventListener('compositionstart', start);
    node.addEventListener('compositionend', end);
    return () => {
      node.removeEventListener?.('compositionstart', start);
      node.removeEventListener?.('compositionend', end);
      if (gateRef.current.composing) imeMark(-1); // 조합 중에 칸이 사라지면 세기에서 뺀다
    };
  }, [web, host]);
  const change = (text: string) => {
    if (!web) {
      onChangeText(text);
      return;
    }
    const next = imeChange(gateRef.current, text, maxLength);
    if (next.gate !== gateRef.current) {
      gateRef.current = next.gate;
      setGate(next.gate);
    }
    onChangeText(next.emit);
  };
  return { web, value: web ? imeValue(gate, value) : value, onChangeText: change };
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  input: {
    // 한 줄 입력은 행간(lineHeight)을 주지 않는다: iOS 에서 글자가 위로 붙는 일을 피한다. 글꼴 · 크기는 본문(16 Regular) 그대로
    fontFamily: type.body.fontFamily,
    fontSize: type.body.fontSize,
    minHeight: size.input, // 글자를 키우면 늘어난다(D22 13)
    borderRadius: radius.md,
    color: colors.text,
    paddingVertical: 0,
  },
  multiline: { height: undefined, minHeight: layout.summaryMinHeight, borderRadius: radius.lg, paddingVertical: space.s16, textAlignVertical: 'top', lineHeight: type.body.lineHeight },
  disabled: { backgroundColor: colors.line, borderColor: colors.line, color: colors.sub },
  error: { marginTop: space.s8 }, // 입력 칸 아래 8(Figma 15 오류 문구 자리)
});
