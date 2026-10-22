// 글자 입력 화면의 키보드 가림 방지(Q5A-06). iOS 는 모달 · 스크롤 화면이 키보드를 자동으로 피하지 않아 아래를 띄운다.
// Android 는 창 크기 조절(resize)이 기본이라 따로 하지 않는다. 화면 본문(헤더 아래 전체)을 감싸 입력 칸 · 제출 버튼이 키보드 위에 남게 한다.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

export function KeyboardAvoid({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="keyboard-avoid">
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
