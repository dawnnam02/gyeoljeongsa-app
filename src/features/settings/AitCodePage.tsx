// 12 설정 › 시험용 AI 코드 쪽(AIT-F ⑤ · 카피 23-6 `AIT_SET`).
//  · 가려 입력 · 자동완성 끔 · 읽기 이름 · 테스트 ID 에 코드 값 0. 저장해도 서버를 부르지 않는다(코드가 맞는지는 AI 기능을 처음 쓸 때 확인)
//  · 웹은 메모리에만(새로 고치면 다시 넣음) · 네이티브는 기기 안전 저장 — 각각 다른 안내 글
//  · 코드가 있는지만 '코드가 들어 있어요 / 코드가 없어요'로 보인다(글자 · 일부도 안 보임)
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { AitHead } from '@/features/ait/AitParts';
import { AIT_CODE_MAX } from '@/features/ait/aitConfig';
import { aitStore, useAitState } from '@/features/ait/aitStore';
import { ait } from '@/features/ait/aitText';
import { space } from '@/theme/tokens';

import { SubPage } from './SettingsParts';

export function AitCodePage({ onBack, onToast }: { onBack: () => void; onToast: (text: string) => void }) {
  const st = useAitState();
  const [value, setValue] = useState('');
  useEffect(() => {
    void aitStore.load();
  }, []);
  const has = st.code !== null;
  const save = async () => {
    if (await aitStore.setCode(value)) {
      setValue(''); // 입력 칸에 코드를 남기지 않는다
      onToast(ait('AIT_SET.saved'));
    }
  };
  const clear = async () => {
    await aitStore.clearCode();
    setValue('');
    onToast(ait('AIT_SET.cleared'));
  };
  return (
    <SubPage title={ait('AIT_SET.row')} onBack={onBack} testID="settings-ait">
      <View style={styles.body}>
        <AitHead testID="settings-ait-head" />
        <AppText variant="body" testID="settings-ait-lead">
          {ait('AIT_SET.lead')}
        </AppText>
        <AppText variant="bodyMedium" testID="settings-ait-status">
          {has ? ait('AIT_SET.status.on') : ait('AIT_SET.status.off')}
        </AppText>
        <AppText variant="captionMedium">{ait('AIT_SET.label')}</AppText>
        <TextField
          label={ait('AIT_SET.a11y.field')}
          value={value}
          onChangeText={setValue}
          placeholder={ait('AIT_SET.placeholder')}
          maxLength={AIT_CODE_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          testID="settings-ait-input"
          secureTextEntry
        />
        <Button label={ait('AIT_SET.save')} disabled={value.trim().length === 0} onPress={() => void save()} testID="settings-ait-save" />
        <Button label={ait('AIT_SET.clear')} variant="secondary" disabled={!has && value.length === 0} onPress={() => void clear()} testID="settings-ait-clear" />
        <AppText variant="caption" testID="settings-ait-check">
          {ait('AIT_SET.check')}
        </AppText>
        <AppText variant="caption" testID="settings-ait-share">
          {ait('AIT_SET.share')}
        </AppText>
        <AppText variant="caption" testID="settings-ait-store">
          {Platform.OS === 'web' ? ait('AIT_SET.web') : ait('AIT_SET.native')}
        </AppText>
        <AppText variant="caption" testID="settings-ait-noeffect">
          {ait('AIT_SET.noEffect')}
        </AppText>
      </View>
    </SubPage>
  );
}


const styles = StyleSheet.create({
  body: { gap: space.s12, paddingHorizontal: space.s20, paddingBottom: space.s32 },
});
