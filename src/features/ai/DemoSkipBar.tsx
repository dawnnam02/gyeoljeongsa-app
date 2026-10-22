// 데모 모드(EXPO_PUBLIC_DEMO_MODE=1)에서만 보이는 '설문 완료로 건너뛰기'. 설문 04 · 05 는 다른 직원이 만들기 때문에,
// 데모에서는 설문을 마친 것으로 보고 AI 정리(06)를 시작해 그 화면으로 간다. 모의 서버에 정상 · 실패 · 지연 중 어떤 응답을 줄지 알려 준다.
// 스토어 빌드(데모 모드 꺼짐)에는 그려지지 않는다.
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { env } from '@/config/env';
import { DEMO } from '@/content/demo';
import { aiApi } from '@/lib/services';
import { colors, size, space } from '@/theme/tokens';

export function DemoSkipBar() {
  const router = useRouter();
  if (!env.demoMode) return null;
  const skip = (scenario: 'ok' | 'fail' | 'slow') => {
    void aiApi.startDemo(scenario); // 모의 서버가 건을 바로 만든다. 처리가 끝나기를 기다리지 않고 06 이 상태를 읽는다
    router.push('/analysis');
  };
  return (
    <SafeAreaView edges={['bottom']} style={styles.bar} testID="demo-skip">
      <View style={styles.inner}>
        <AppText variant="caption" testID="demo-skip-note">
          {DEMO.skipNote}
        </AppText>
        <Button label={DEMO.skip.ok} onPress={() => skip('ok')} testID="demo-skip-ok" />
        <Button label={DEMO.skip.fail} variant="secondary" onPress={() => skip('fail')} testID="demo-skip-fail" />
        <Button label={DEMO.skip.slow} variant="secondary" onPress={() => skip('slow')} testID="demo-skip-slow" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  inner: { paddingHorizontal: size.screenPadding, paddingVertical: space.s12, gap: space.s8 },
});
