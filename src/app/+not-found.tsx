// 없는 주소(웹 · 딥링크) 안내 화면(QF2 F-13): expo-router 기본의 영어 'Unmatched Route' 대신 앱 말투 + [홈으로].
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { NOT_FOUND } from '@/content/copy';
import { size, space } from '@/theme/tokens';

export default function NotFoundRoute() {
  const router = useRouter();
  return (
    <Screen testID="screen-not-found">
      <View style={styles.body}>
        <AppText variant="title" accessibilityRole="header" testID="not-found-title">
          {NOT_FOUND.title}
        </AppText>
        <AppText variant="body" tone="sub" testID="not-found-body">
          {NOT_FOUND.body}
        </AppText>
        <Button label={NOT_FOUND.home} onPress={() => router.replace('/')} testID="not-found-home" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.s16, paddingHorizontal: size.screenPadding },
});
