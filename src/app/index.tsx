import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { loadProgressStage } from '@/lib/progress';
import { hasStoredLogin, supabase } from '@/lib/supabase';
import { resolveEntryHref } from '@/navigation/entry';
import { screenById } from '@/navigation/screens';
import { useSignupStore } from '@/store';
import { colors } from '@/theme/tokens';

// 앱 시작(K2 2-1): 저장된 로그인이 없으면 01, 있으면 서버에 진행 단계를 물어 2-3 표대로(인증번호를 다시 받지 않는다).
export default function EntryScreen() {
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = await resolveEntryHref({
        hasLogin: hasStoredLogin,
        loadStage: () => loadProgressStage(supabase),
        setStage: (stage) => useSignupStore.getState().setStage(stage),
        firstScreen: screenById('01').href,
      });
      if (alive) setHref(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!href) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
