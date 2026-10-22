// 신청 잇기 시트(K20 2-7 · P-13 · NP-12 · P-D6): 인스타그램 신청서에서 받은 신청 번호 + 잇기 코드 6자리를 넣어 앱 계정과 잇는다(선택).
//  · 번호는 'MMDD-NNNN'(붙여 쓴 8자리도 받음) · 코드 숫자 6자리 — 모양이 맞을 때만 [잇기]가 눌린다(헛걸음 0)
//  · 서버(Edge link-application)가 하루 5번 틀리면 다음 날까지 막는다. 앱은 남은 횟수를 세거나 보이지 않는다
//  · 오류 4(틀림 · 이미 이어진 번호 · 한도 · 인터넷) + 서버 문제 · 로그인 풀림. 입력은 남긴다
//  · 이어도 · 안 이어도 기능 · 순서 차이 0(K20 2-7 '효과') — 시트에 같은 글 한 줄 · '방송 아님' 고지(3곳 중 하나)
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TextButton } from '@/components/TextButton';
import { TextField } from '@/components/TextField';
import { COMMON } from '@/content/copy';
import { space } from '@/theme/tokens';

import type { LaunchApi, LinkFailure } from './launchApi';
import { normalizeApplicantNo, normalizeLinkCode } from './launchLogic';
import { LINK_SHEET, PRELAUNCH } from './prelaunchCopy';

type Props = {
  visible: boolean;
  api: Pick<LaunchApi, 'link'>;
  onClose: () => void;
  onLinked: (applicantNo: string) => void;
  onAlready?: () => void;
  testID?: string;
};

export const linkErrorText = (reason: LinkFailure): string =>
  reason === 'network' ? COMMON.offline : reason === 'server' ? COMMON.server : LINK_SHEET.errors[reason];

export function LinkSheet({ visible, api, onClose, onLinked, onAlready, testID = 'prelaunch-link' }: Props) {
  const [no, setNo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const normNo = normalizeApplicantNo(no);
  const normCode = normalizeLinkCode(code);
  const id = (part: string) => `${testID}-${part}`;

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!normNo || !normCode || busy) return;
    setBusy(true);
    setError(null);
    const r = await api.link(normNo, normCode);
    setBusy(false);
    if (!r.ok) {
      if (r.reason === 'already') onAlready?.(); // 서버: 이미 이은 계정 — 할 일 ④를 숨긴다
      setError(linkErrorText(r.reason));
      return;
    }
    setNo('');
    setCode('');
    onLinked(r.applicantNo);
  };

  return (
    <BottomSheet visible={visible} onClose={close} dismissable={!busy} testID={testID}>
      <AppText variant="title" accessibilityRole="header">
        {LINK_SHEET.title}
      </AppText>
      <AppText variant="body" testID={id('body')}>
        {LINK_SHEET.body}
      </AppText>
      <View style={styles.field}>
        <AppText variant="smallMedium">{LINK_SHEET.noLabel}</AppText>
        <TextField label={LINK_SHEET.noLabel} value={no} onChangeText={(v) => { setNo(v); setError(null); }} placeholder={LINK_SHEET.noPlaceholder} keyboardType="number-pad" inputMode="numeric" maxLength={9} autoCorrect={false} testID={id('no')} />
      </View>
      <View style={styles.field}>
        <AppText variant="smallMedium">{LINK_SHEET.codeLabel}</AppText>
        <TextField label={LINK_SHEET.codeLabel} value={code} onChangeText={(v) => { setCode(v); setError(null); }} placeholder={LINK_SHEET.codePlaceholder} keyboardType="number-pad" inputMode="numeric" maxLength={6} autoCorrect={false} autoComplete="off" testID={id('code')} />
      </View>
      {error ? (
        <AppText variant="captionMedium" tone="accent" accessibilityRole="alert" accessibilityLiveRegion="polite" testID={id('error')}>
          {error}
        </AppText>
      ) : null}
      <Button label={LINK_SHEET.submit} onPress={submit} disabled={!normNo || !normCode} loading={busy} testID={id('submit')} />
      <AppText variant="caption" testID={id('same')}>
        {LINK_SHEET.same}
      </AppText>
      <AppText variant="caption" testID={id('notice')}>
        {PRELAUNCH.notice}
      </AppText>
      <TextButton label={LINK_SHEET.close} onPress={close} disabled={busy} testID={id('close')} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.s8 },
});
