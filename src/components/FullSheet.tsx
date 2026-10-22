// 화면 가득 올라오는 시트(요약 · 전문 읽기). 위에 제목과 닫기(✕), 아래로 읽을 내용이 스크롤된다.
// 03 의 '보기 ›' 요약 시트와 이용약관 · 개인정보 처리방침 읽기 화면이 쓴다. Android 뒤로가기는 시트를 닫는다.
import type { ReactNode } from 'react';
import { Image, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { A11Y } from '@/content/copy';
import { layout } from '@/theme/layout';
import { alpha, colors, size, space } from '@/theme/tokens';
import { UI_ICONS } from '@/theme/uiAssets';

import { AppText } from './AppText';
import { Pressable } from './Pressable';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  testID?: string;
};

export function FullSheet({ visible, title, onClose, children, testID }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} testID={testID}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <AppText variant="bodyBold" numberOfLines={2} accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
          <Pressable
            accessibilityLabel={A11Y.close}
            onPress={onClose}
            effect="none"
            testID={testID ? `${testID}-close` : undefined}
            style={({ pressed }) => [styles.close, pressed ? styles.pressed : null]}>
            <Image source={UI_ICONS.close} style={styles.icon} />
          </Pressable>
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    minHeight: size.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: size.screenPadding,
    paddingRight: space.s4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, paddingVertical: space.s8 },
  close: { width: size.touchMin, height: size.touchMin, alignItems: 'center', justifyContent: 'center' },
  icon: { width: layout.headerIcon, height: layout.headerIcon },
  pressed: { opacity: alpha.pressed },
  body: { flex: 1 },
});
